import { useState } from 'react';
import { Download, Film, Music, Check } from 'lucide-react';
import type { MediaMetadata, MediaType, ResolutionOption } from '../types';
import { formatBytes } from '../utils/format';
import { MediaThumbnail } from './MediaThumbnail';

interface ResolutionListProps {
  media: MediaMetadata;
  preferredVideoHeight: string;
  preferredAudioBitrate: string;
  activeDownloadFormats: Set<string>;
  onDownload: (option: ResolutionOption) => void;
}

export function ResolutionList({
  media,
  preferredVideoHeight,
  preferredAudioBitrate,
  activeDownloadFormats,
  onDownload,
}: ResolutionListProps) {
  const [selectedType, setSelectedType] = useState<MediaType>('video');

  const videoOptions = media.formats.filter((f) => f.type === 'video');
  const audioOptions = media.formats.filter((f) => f.type === 'audio');
  const visibleOptions = selectedType === 'video' ? videoOptions : audioOptions;

  const isRecommended = (opt: ResolutionOption): boolean => {
    if (opt.type === 'video') {
      return String(opt.height) === preferredVideoHeight;
    }
    return String(opt.audioBitrate) === preferredAudioBitrate;
  };

  return (
    <section
      aria-label="Available download resolutions"
      className="rounded-2xl bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-zinc-800/80 overflow-hidden"
    >
      {/* Media Summary Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="relative w-full sm:w-44 aspect-video rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-900">
          <MediaThumbnail
            src={media.thumbnail}
            alt={media.title}
            className="w-full h-full"
          />
          {media.durationString !== '0:00' && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
              {media.durationString}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-orange-600 dark:text-orange-400">
                {media.platform}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{media.uploader}</span>
              {media.durationString !== '0:00' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{media.durationString}</span>
                </>
              )}
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50 leading-snug line-clamp-2">
              {media.title}
            </h2>
          </div>

          {/* Interactive Video / Audio Segmented Control */}
          <div
            role="tablist"
            aria-label="Format category"
            className="inline-flex items-center p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-full sm:w-auto self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedType === 'video'}
              onClick={() => setSelectedType('video')}
              className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedType === 'video'
                  ? 'bg-white dark:bg-[#1E2128] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Video ({videoOptions.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedType === 'audio'}
              onClick={() => setSelectedType('audio')}
              className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedType === 'audio'
                  ? 'bg-white dark:bg-[#1E2128] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Audio ({audioOptions.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Resolution Rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
        {visibleOptions.map((option) => {
          const isQueued = activeDownloadFormats.has(option.id);
          const recommended = isRecommended(option);
          const sizeBytes = option.filesize || option.estimatedSize;

          return (
            <div
              key={option.id}
              className="px-4 sm:px-5 py-3 min-h-[64px] flex items-center justify-between gap-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-12 h-10 rounded-xl flex items-center justify-center font-mono text-xs font-semibold shrink-0 border ${
                    recommended
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {option.tag}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {option.label}
                    </span>
                    {recommended && (
                      <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 whitespace-nowrap shrink-0">
                        · Default
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    <span className="uppercase">{option.ext}</span>
                    {option.width && option.height && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {option.width}×{option.height}
                        </span>
                      </>
                    )}
                    {option.fps && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{option.fps} fps</span>
                      </>
                    )}
                    {option.note && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{option.note}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden xs:inline-block sm:inline-block font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums text-right min-w-[60px]">
                  {sizeBytes ? `~${formatBytes(sizeBytes)}` : 'Auto'}
                </span>

                <button
                  type="button"
                  onClick={() => onDownload(option)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
                    isQueued
                      ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-600/30'
                      : 'bg-orange-600 hover:bg-orange-500 text-white shadow-sm shadow-orange-600/20'
                  }`}
                >
                  {isQueued ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" aria-hidden="true" />
                      <span>Download</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
