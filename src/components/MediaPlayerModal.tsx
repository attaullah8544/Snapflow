import { useEffect } from 'react';
import { X, Download, Music } from 'lucide-react';
import type { DownloadItem } from '../types';
import { formatBytes } from '../utils/format';
import { MediaThumbnail } from './MediaThumbnail';

interface MediaPlayerModalProps {
  item: DownloadItem | null;
  onClose: () => void;
}

export function MediaPlayerModal({ item, onClose }: MediaPlayerModalProps) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const streamUrl = `/api/downloads/${item.id}/stream`;
  const downloadUrl = `/api/downloads/${item.id}/file`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${item.title}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white dark:bg-[#15171B] border-t sm:border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile bottom-sheet drag affordance */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-50 truncate">
              {item.title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {item.platform} · {item.qualityLabel} · {formatBytes(item.fileSize)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Surface */}
        <div className="bg-black">
          {item.type === 'video' ? (
            <video
              key={item.id}
              src={streamUrl}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[60vh] aspect-video bg-black"
            />
          ) : (
            <div className="p-6 sm:p-8 flex flex-col items-center gap-5 bg-zinc-950">
              <div className="relative w-44 h-44 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
                <MediaThumbnail
                  src={item.thumbnail}
                  alt={item.title}
                  type="audio"
                  className="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                    <Music className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
                    <span className="uppercase">{item.ext}</span>
                  </div>
                </div>
              </div>
              <audio
                key={item.id}
                src={streamUrl}
                controls
                autoPlay
                className="w-full max-w-md"
              />
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 bg-zinc-50 dark:bg-[#111317] border-t border-zinc-200 dark:border-zinc-800 pb-safe">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {item.uploader}
          </span>
          <a
            href={downloadUrl}
            download
            className="min-h-[44px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Save File</span>
          </a>
        </div>
      </div>
    </div>
  );
}
