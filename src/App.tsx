import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardPaste,
  Download,
  FolderCheck,
  History,
  Link2,
  Loader2,
  Moon,
  Play,
  Settings,
  Sun,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import type {
  ActiveTab,
  AppSettings,
  DownloadItem,
  MediaMetadata,
  ResolutionOption,
} from './types';
import { SAMPLE_MEDIA, SUPPORTED_PLATFORMS } from './data/samples';
import { formatBytes } from './utils/format';
import { MediaThumbnail } from './components/MediaThumbnail';
import { ResolutionList } from './components/ResolutionList';
import { QueueView } from './components/QueueView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { MediaPlayerModal } from './components/MediaPlayerModal';

const SETTINGS_STORAGE_KEY = 'snapflow_settings_v1';
const THEME_STORAGE_KEY = 'snapflow_theme_v1';

const DEFAULT_SETTINGS: AppSettings = {
  defaultVideoQuality: '1080',
  defaultAudioQuality: '320',
  concurrentDownloads: 2,
  autoSaveToDevice: false,
  cookiesText: '',
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return 'dark';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const [urlInput, setUrlInput] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaMetadata | null>(null);

  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [playingItem, setPlayingItem] = useState<DownloadItem | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const prevCompletedIdsRef = useRef<Set<string>>(new Set());
  const initialSyncDoneRef = useRef(false);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Subscribe to SSE real-time download progress
  useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: number | null = null;

    const applyList = (list: DownloadItem[]) => {
      setDownloads(list);

      if (!initialSyncDoneRef.current) {
        const initialDone = new Set(
          list.filter((d) => d.status === 'completed').map((d) => d.id)
        );
        prevCompletedIdsRef.current = initialDone;
        initialSyncDoneRef.current = true;
        return;
      }

      if (settings.autoSaveToDevice) {
        for (const item of list) {
          if (
            item.status === 'completed' &&
            !prevCompletedIdsRef.current.has(item.id)
          ) {
            prevCompletedIdsRef.current.add(item.id);
            const anchor = document.createElement('a');
            anchor.href = `/api/downloads/${item.id}/file`;
            anchor.download = '';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
          }
        }
      } else {
        for (const item of list) {
          if (item.status === 'completed') {
            prevCompletedIdsRef.current.add(item.id);
          }
        }
      }
    };

    const fetchInitial = async () => {
      try {
        const res = await fetch('/api/downloads');
        if (res.ok) {
          const data = (await res.json()) as { downloads: DownloadItem[] };
          applyList(data.downloads || []);
        }
      } catch {
        // ignore
      }
    };

    void fetchInitial();

    try {
      es = new EventSource('/api/downloads/events');
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type: string;
            downloads: DownloadItem[];
          };
          if (payload.type === 'sync' && Array.isArray(payload.downloads)) {
            applyList(payload.downloads);
          }
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        if (!pollTimer) {
          pollTimer = window.setInterval(() => {
            void fetchInitial();
          }, 2500);
        }
      };
    } catch {
      pollTimer = window.setInterval(() => {
        void fetchInitial();
      }, 2500);
    }

    return () => {
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [settings.autoSaveToDevice]);

  const inspectUrl = useCallback(
    async (targetUrl: string) => {
      const trimmed = targetUrl.trim();
      if (!trimmed) {
        setInspectError('Enter or paste a valid video URL first.');
        return;
      }

      setInspecting(true);
      setInspectError(null);
      setClipboardNotice(null);

      try {
        const res = await fetch('/api/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: trimmed,
            cookiesText: settings.cookiesText || undefined,
          }),
        });
        const data = (await res.json()) as MediaMetadata & { error?: string };
        if (!res.ok) {
          setInspectError(
            data.error || 'Could not inspect this URL. Please verify the link.'
          );
          setMedia(null);
        } else {
          setMedia(data);
        }
      } catch {
        setInspectError('Network error while inspecting URL. Please try again.');
        setMedia(null);
      } finally {
        setInspecting(false);
      }
    },
    [settings.cookiesText]
  );

  const handlePasteLink = useCallback(async () => {
    setActiveTab('home');
    setClipboardNotice(null);

    try {
      if (navigator.clipboard?.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text) {
          setUrlInput(text);
          if (text.startsWith('http://') || text.startsWith('https://')) {
            void inspectUrl(text);
          } else {
            urlInputRef.current?.focus();
          }
          return;
        }
      }
    } catch {
      // Clipboard read may be blocked inside iframe without focus/permission
    }

    urlInputRef.current?.focus();
    setClipboardNotice('Paste your link directly into the address field (Ctrl+V / Cmd+V).');
  }, [inspectUrl]);

  const handleStartDownload = useCallback(
    async (option: ResolutionOption) => {
      if (!media) return;
      try {
        const res = await fetch('/api/downloads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: media.url,
            title: media.title,
            uploader: media.uploader,
            platform: media.platform,
            thumbnail: media.thumbnail,
            duration: media.duration,
            playlistIndex: media.playlistIndex,
            formatOption: option,
            cookiesText: settings.cookiesText || undefined,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { download: DownloadItem };
          setDownloads((prev) => {
            if (prev.some((d) => d.id === data.download.id)) return prev;
            return [data.download, ...prev];
          });
        }
      } catch {
        // SSE/poll handles sync
      }
    },
    [media, settings.cookiesText]
  );

  const handleCancelDownload = useCallback(async (id: string) => {
    await fetch(`/api/downloads/${id}/cancel`, { method: 'POST' });
  }, []);

  const handleRetryDownload = useCallback(
    async (id: string) => {
      await fetch(`/api/downloads/${id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookiesText: settings.cookiesText || undefined,
        }),
      });
    },
    [settings.cookiesText]
  );

  const handleDeleteDownload = useCallback(async (id: string) => {
    await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const activeQueueCount = useMemo(
    () =>
      downloads.filter(
        (d) =>
          d.status === 'queued' ||
          d.status === 'downloading' ||
          d.status === 'merging'
      ).length,
    [downloads]
  );

  const completedCount = useMemo(
    () => downloads.filter((d) => d.status === 'completed').length,
    [downloads]
  );

  const activeFormatsForCurrentMedia = useMemo(() => {
    if (!media) return new Set<string>();
    return new Set(
      downloads
        .filter(
          (d) =>
            d.url === media.url &&
            (d.status === 'queued' ||
              d.status === 'downloading' ||
              d.status === 'merging' ||
              d.status === 'completed')
        )
        .map((d) => d.formatId)
    );
  }, [downloads, media]);

  const navItems: Array<{ id: ActiveTab; label: string; count?: number }> = [
    { id: 'home', label: 'Downloader' },
    { id: 'queue', label: 'Queue', count: activeQueueCount },
    { id: 'library', label: 'Library', count: completedCount },
    { id: 'settings', label: 'Settings' },
  ];

  const activeTabLabel =
    navItems.find((n) => n.id === activeTab)?.label || 'Downloader';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#0B0C0E] text-zinc-900 dark:text-zinc-100">
      {/* Desktop Top Bar (3-Zone Contract) */}
      <header className="hidden md:block sticky top-0 z-30 h-14 bg-white/85 dark:bg-[#0B0C0E]/85 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto h-full px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="font-display text-xl font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Snap<span className="text-orange-600 dark:text-orange-500">Flow</span>
          </button>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav aria-label="Primary navigation" className="flex items-center gap-7">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <span>
                    {item.label}
                    {typeof item.count === 'number' && item.count > 0
                      ? ` (${item.count})`
                      : ''}
                  </span>
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-[11px] h-0.5 bg-orange-600 dark:bg-orange-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <button
            type="button"
            onClick={() => void handlePasteLink()}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
            <span>Paste Link</span>
          </button>
        </div>
      </header>

      {/* Mobile Compact Top App Bar (48px) */}
      <header className="md:hidden sticky top-0 z-30 h-12 px-4 bg-white/90 dark:bg-[#0B0C0E]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="font-display text-lg font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          Snap<span className="text-orange-600 dark:text-orange-500">Flow</span>
        </button>

        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate">
          {activeTabLabel}
        </span>

        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-12">
        {activeTab === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Primary Left/Center Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* Hero URL Input Surface */}
              <section className="rounded-3xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-5 sm:p-7 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white [text-wrap:balance]">
                      Download social videos in every resolution
                    </h1>
                    <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl">
                      Paste a link from YouTube, TikTok, Instagram, X, Facebook, or Vimeo to save MP4 up to 4K or extract MP3 audio.
                    </p>
                  </div>

                  {/* Desktop quick theme switcher inside workspace */}
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    className="hidden md:flex min-w-[44px] min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                  >
                    {theme === 'dark' ? (
                      <Sun className="w-4 h-4" />
                    ) : (
                      <Moon className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* URL Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void inspectUrl(urlInput);
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <div className="relative flex-1 flex items-center">
                    <Link2
                      className="w-4 h-4 text-zinc-400 absolute left-4 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      ref={urlInputRef}
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or paste any video URL"
                      aria-label="Video or social post URL"
                      className="w-full h-12 sm:h-13 pl-11 pr-24 rounded-2xl bg-zinc-50 dark:bg-[#0E1013] border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePasteLink()}
                      className="absolute right-1.5 min-h-[38px] px-3 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Paste
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={inspecting}
                    className="h-12 sm:h-13 px-6 rounded-2xl bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {inspecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Analyzing…</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span>Get Formats</span>
                      </>
                    )}
                  </button>
                </form>

                {clipboardNotice && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {clipboardNotice}
                  </p>
                )}

                {inspectError && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-red-700 dark:text-red-300">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{inspectError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600/25 text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
                    >
                      Open Settings
                    </button>
                  </div>
                )}

                {/* Supported Platforms Selector */}
                <div className="pt-1">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2.5">
                    Supported Platforms
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {SUPPORTED_PLATFORMS.map((platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => {
                          setUrlInput(platform.example.replace('...', ''));
                          urlInputRef.current?.focus();
                        }}
                        className="min-h-[44px] px-2 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 hover:border-orange-500/50 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors truncate cursor-pointer"
                      >
                        {platform.name}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Inspection Loading Skeleton */}
              {inspecting && (
                <div
                  aria-busy="true"
                  className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-44 aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="flex-1 space-y-2.5 py-1">
                      <div className="h-3.5 w-32 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                      <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                      <div className="h-9 w-48 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {/* Inspected Resolution Options */}
              {!inspecting && media && (
                <ResolutionList
                  media={media}
                  preferredVideoHeight={settings.defaultVideoQuality}
                  preferredAudioBitrate={settings.defaultAudioQuality}
                  activeDownloadFormats={activeFormatsForCurrentMedia}
                  onDownload={(option) => void handleStartDownload(option)}
                />
              )}

              {/* Quick-Try Open License Media Grid */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Quick-Try Open Media
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                      Tap any open-license film to test multi-resolution inspection and downloading
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SAMPLE_MEDIA.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setUrlInput(sample.url);
                        void inspectUrl(sample.url);
                      }}
                      className="group text-left rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 hover:border-orange-500/50 overflow-hidden transition-colors cursor-pointer"
                    >
                      <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                        <MediaThumbnail
                          src={sample.thumbnail}
                          alt={sample.title}
                          className="w-full h-full transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                        <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                          {sample.duration}
                        </span>
                      </div>
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {sample.creator} · {sample.note}
                          </p>
                          <h3 className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {sample.title}
                          </h3>
                        </div>
                        <ArrowRight
                          className="w-4 h-4 text-zinc-400 group-hover:text-orange-500 shrink-0 transition-colors"
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            {/* Secondary Desktop Right Column: Live Transfers & Recent Files */}
            <aside className="lg:col-span-4 space-y-5">
              <div className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Recent Transfers
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('queue')}
                    className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    View Queue
                  </button>
                </div>

                {downloads.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      No transfers yet
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Pick a Quick-Try film or paste any social video link to start downloading.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {downloads.slice(0, 5).map((item) => {
                      const isActive =
                        item.status === 'queued' ||
                        item.status === 'downloading' ||
                        item.status === 'merging';

                      return (
                        <div key={item.id} className="p-3.5 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-14 aspect-video rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-900">
                              <MediaThumbnail
                                src={item.thumbnail}
                                alt={item.title}
                                type={item.type}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-mono tabular-nums">
                                {item.qualityLabel} ·{' '}
                                {item.status === 'completed'
                                  ? formatBytes(item.fileSize)
                                  : isActive
                                  ? `${item.progress}%`
                                  : item.status}
                              </p>
                            </div>
                            {item.status === 'completed' && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPlayingItem(item)}
                                  aria-label={`Play ${item.title}`}
                                  className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={`/api/downloads/${item.id}/file`}
                                  download
                                  aria-label={`Save ${item.title}`}
                                  className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>

                          {isActive && (
                            <div className="w-full h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full w-full bg-orange-500 origin-left transition-transform duration-150"
                                style={{
                                  transform: `scaleX(${Math.max(0.04, item.progress / 100)})`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Format Capabilities Summary */}
              <div className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Resolution &amp; Audio Engine
                </h3>
                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/70">
                    <span>Ultra HD Video</span>
                    <span className="font-mono text-zinc-900 dark:text-zinc-200 tabular-nums">
                      2160p · 1440p · 1080p
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/70">
                    <span>Standard &amp; Saver</span>
                    <span className="font-mono text-zinc-900 dark:text-zinc-200 tabular-nums">
                      720p · 480p · 360p
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span>Audio Extraction</span>
                    <span className="font-mono text-zinc-900 dark:text-zinc-200 tabular-nums">
                      MP3 320k · 192k · M4A
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'queue' && (
          <QueueView
            downloads={downloads}
            onCancel={(id) => void handleCancelDownload(id)}
            onRetry={(id) => void handleRetryDownload(id)}
            onDelete={(id) => void handleDeleteDownload(id)}
            onPlay={(item) => setPlayingItem(item)}
            onGoHome={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            downloads={downloads}
            onPlay={(item) => setPlayingItem(item)}
            onDelete={(id) => void handleDeleteDownload(id)}
            onGoHome={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            theme={theme}
            onToggleTheme={setTheme}
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar (58px, Thumb-Zone Ergonomic) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0B0C0E]/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800/80 pb-safe"
      >
        <div className="grid grid-cols-4 h-[58px] items-center">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`h-full flex flex-col items-center justify-center cursor-pointer ${
              activeTab === 'home'
                ? 'text-orange-600 dark:text-orange-500'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Download className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight mt-1">
              Downloader
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`relative h-full flex flex-col items-center justify-center cursor-pointer ${
              activeTab === 'queue'
                ? 'text-orange-600 dark:text-orange-500'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <History className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight mt-1 tabular-nums">
              Queue{activeQueueCount > 0 ? ` (${activeQueueCount})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`h-full flex flex-col items-center justify-center cursor-pointer ${
              activeTab === 'library'
                ? 'text-orange-600 dark:text-orange-500'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <FolderCheck className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight mt-1 tabular-nums">
              Library{completedCount > 0 ? ` (${completedCount})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`h-full flex flex-col items-center justify-center cursor-pointer ${
              activeTab === 'settings'
                ? 'text-orange-600 dark:text-orange-500'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight mt-1">
              Settings
            </span>
          </button>
        </div>
      </nav>

      {/* In-App Video & Audio Player Modal / Bottom Sheet */}
      <MediaPlayerModal item={playingItem} onClose={() => setPlayingItem(null)} />
    </div>
  );
}
