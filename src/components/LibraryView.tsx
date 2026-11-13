import { useMemo, useState } from 'react';
import { Play, Download, Trash2, Search } from 'lucide-react';
import type { DownloadItem, MediaType } from '../types';
import { formatBytes, formatDuration, formatRelativeTime } from '../utils/format';
import { MediaThumbnail } from './MediaThumbnail';

interface LibraryViewProps {
  downloads: DownloadItem[];
  onPlay: (item: DownloadItem) => void;
  onDelete: (id: string) => void;
  onGoHome: () => void;
}

export function LibraryView({
  downloads,
  onPlay,
  onDelete,
  onGoHome,
}: LibraryViewProps) {
  const [filter, setFilter] = useState<'all' | MediaType>('all');
  const [query, setQuery] = useState('');

  const completed = useMemo(
    () => downloads.filter((d) => d.status === 'completed'),
    [downloads]
  );

  const totalBytes = useMemo(
    () => completed.reduce((acc, item) => acc + (item.fileSize || 0), 0),
    [completed]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return completed.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (q) {
        return (
          item.title.toLowerCase().includes(q) ||
          item.uploader.toLowerCase().includes(q) ||
          item.platform.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [completed, filter, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Saved Library
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            {completed.length} {completed.length === 1 ? 'file' : 'files'} ·{' '}
            {formatBytes(totalBytes)} stored
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div
          role="tablist"
          aria-label="Filter library"
          className="inline-flex items-center p-1 bg-zinc-200/70 dark:bg-zinc-900 rounded-xl self-start"
        >
          {(['all', 'video', 'audio'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filter === tab}
              onClick={() => setFilter(tab)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab
                  ? 'bg-white dark:bg-[#1E2128] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {completed.length > 0 && (
        <div className="relative">
          <Search
            className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved videos and audio…"
            aria-label="Search saved library"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
        </div>
      )}

      {completed.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-8 text-center">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Your library is empty
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Completed MP4 videos and MP3 audio tracks appear here for offline playback and device export.
          </p>
          <button
            type="button"
            onClick={onGoHome}
            className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Download First Video
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No saved media matches your current filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 overflow-hidden flex flex-col"
            >
              <button
                type="button"
                onClick={() => onPlay(item)}
                className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-900 group text-left cursor-pointer overflow-hidden"
                aria-label={`Play ${item.title}`}
              >
                <MediaThumbnail
                  src={item.thumbnail}
                  alt={item.title}
                  type={item.type}
                  className="w-full h-full transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/65 backdrop-blur-sm text-white flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                    <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                  </div>
                </div>
                {item.duration > 0 && (
                  <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                    {formatDuration(item.duration)}
                  </span>
                )}
              </button>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {item.platform}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.qualityLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatBytes(item.fileSize)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {item.uploader} · {formatRelativeTime(item.completedAt || item.createdAt)}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPlay(item)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Play</span>
                    </button>
                    <a
                      href={`/api/downloads/${item.id}/file`}
                      download
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Save</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
