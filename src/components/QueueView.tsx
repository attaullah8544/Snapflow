import { Ban, RotateCcw, Trash2, Download, Play, AlertCircle } from 'lucide-react';
import type { DownloadItem } from '../types';
import { formatBytes, formatRelativeTime } from '../utils/format';
import { MediaThumbnail } from './MediaThumbnail';

interface QueueViewProps {
  downloads: DownloadItem[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onPlay: (item: DownloadItem) => void;
  onGoHome: () => void;
}

export function QueueView({
  downloads,
  onCancel,
  onRetry,
  onDelete,
  onPlay,
  onGoHome,
}: QueueViewProps) {
  const queueItems = downloads.filter(
    (d) => d.status !== 'completed'
  );
  const recentCompleted = downloads
    .filter((d) => d.status === 'completed')
    .slice(0, 3);

  const renderStatusLabel = (item: DownloadItem) => {
    switch (item.status) {
      case 'queued':
        return 'Queued';
      case 'downloading':
        return `${item.progress}% · ${item.speed || 'Downloading'}${item.eta && item.eta !== '--:--' ? ` · ETA ${item.eta}` : ''}`;
      case 'merging':
        return `${item.progress}% · ${item.speed || 'Processing media'}`;
      case 'cancelled':
        return 'Cancelled';
      case 'error':
        return 'Failed';
      case 'completed':
        return `Saved · ${formatBytes(item.fileSize)}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Download Queue
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Live multi-resolution transfers and audio conversions
          </p>
        </div>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap shrink-0">
          {queueItems.length} active
        </span>
      </div>

      {queueItems.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 p-8 text-center">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No active transfers
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Paste any social video link in the Downloader tab and choose a resolution to begin downloading.
          </p>
          <button
            type="button"
            onClick={onGoHome}
            className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Add Video Link
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
          {queueItems.map((item) => {
            const isActive =
              item.status === 'queued' ||
              item.status === 'downloading' ||
              item.status === 'merging';

            return (
              <div key={item.id} className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-20 sm:w-24 aspect-video rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-900">
                    <MediaThumbnail
                      src={item.thumbnail}
                      alt={item.title}
                      type={item.type}
                      className="w-full h-full"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {item.title}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{item.platform}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.qualityLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="uppercase">{item.ext}</span>
                    </div>

                    <div
                      className={`mt-1.5 text-xs font-mono tabular-nums ${
                        item.status === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : isActive
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {renderStatusLabel(item)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => onCancel(item.id)}
                        aria-label={`Cancel ${item.title}`}
                        className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onRetry(item.id)}
                          aria-label={`Retry ${item.title}`}
                          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-600 hover:text-orange-600 dark:text-zinc-300 dark:hover:text-orange-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          aria-label={`Remove ${item.title}`}
                          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar (compositor-only transform: scaleX) */}
                {isActive && (
                  <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full w-full bg-orange-500 origin-left transition-transform duration-150"
                      style={{ transform: `scaleX(${Math.max(0.03, item.progress / 100)})` }}
                    />
                  </div>
                )}

                {item.status === 'error' && item.error && (
                  <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item.error}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recently Completed Section */}
      {recentCompleted.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Recently Finished
          </h2>
          <div className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
            {recentCompleted.map((item) => (
              <div
                key={item.id}
                className="p-3.5 sm:px-5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 aspect-video rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-900">
                    <MediaThumbnail
                      src={item.thumbnail}
                      alt={item.title}
                      type={item.type}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate tabular-nums">
                      {item.qualityLabel} · {formatBytes(item.fileSize)} ·{' '}
                      {formatRelativeTime(item.completedAt || item.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlay(item)}
                    aria-label={`Play ${item.title}`}
                    className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <a
                    href={`/api/downloads/${item.id}/file`}
                    download
                    aria-label={`Save ${item.title} to device`}
                    className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
