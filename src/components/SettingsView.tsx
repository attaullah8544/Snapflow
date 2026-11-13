import { Moon, Sun, Trash2 } from 'lucide-react';
import type { AppSettings } from '../types';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onToggleTheme: (next: 'dark' | 'light') => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export function SettingsView({
  theme,
  onToggleTheme,
  settings,
  onUpdateSettings,
}: SettingsViewProps) {
  const videoQualities: Array<{ value: AppSettings['defaultVideoQuality']; label: string }> = [
    { value: '2160', label: '2160p 4K' },
    { value: '1080', label: '1080p HD' },
    { value: '720', label: '720p HD' },
    { value: '480', label: '480p SD' },
    { value: '360', label: '360p' },
  ];

  const audioQualities: Array<{ value: AppSettings['defaultAudioQuality']; label: string }> = [
    { value: '320', label: 'MP3 320 kbps' },
    { value: '192', label: 'MP3 192 kbps' },
    { value: '128', label: 'M4A 128 kbps' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Preferences
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Configure default resolutions, automatic device saving, and appearance
        </p>
      </div>

      {/* Appearance */}
      <section className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Appearance
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Switch between dark cinema surface and daylight mode
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onToggleTheme('dark')}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-orange-600/10 border-orange-500 text-orange-600 dark:text-orange-400'
                : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Moon className="w-4 h-4" aria-hidden="true" />
            <span>Dark Mode</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleTheme('light')}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-orange-600/10 border-orange-500 text-orange-600 dark:text-orange-400'
                : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Sun className="w-4 h-4" aria-hidden="true" />
            <span>Light Mode</span>
          </button>
        </div>
      </section>

      {/* Default Formats */}
      <section className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Default Resolution &amp; Audio
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Highlighted automatically when inspecting a new video link
          </p>
        </div>

        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Preferred Video Quality
          </label>
          <div className="flex flex-wrap gap-2">
            {videoQualities.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => onUpdateSettings({ defaultVideoQuality: q.value })}
                className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.defaultVideoQuality === q.value
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Preferred Audio Extraction
          </label>
          <div className="flex flex-wrap gap-2">
            {audioQualities.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => onUpdateSettings({ defaultAudioQuality: q.value })}
                className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.defaultAudioQuality === q.value
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Auto-Save to Device on Completion
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Automatically trigger browser file download when processing finishes
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoSaveToDevice}
            onClick={() =>
              onUpdateSettings({ autoSaveToDevice: !settings.autoSaveToDevice })
            }
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
              settings.autoSaveToDevice
                ? 'bg-orange-600'
                : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.autoSaveToDevice ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Optional Cookies for Authenticated / Age-Restricted Links */}
      <section className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Session Cookies (Optional)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Paste Netscape-format cookies.txt only if a platform restricts public access
            </p>
          </div>
          {settings.cookiesText && (
            <button
              type="button"
              onClick={() => onUpdateSettings({ cookiesText: '' })}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <textarea
          value={settings.cookiesText}
          onChange={(e) => onUpdateSettings({ cookiesText: e.target.value })}
          rows={4}
          placeholder="# Netscape HTTP Cookie File"
          aria-label="Optional Netscape cookies text"
          className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
        />
      </section>
    </div>
  );
}
