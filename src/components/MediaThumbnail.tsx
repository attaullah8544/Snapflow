import { useState } from 'react';
import { Film, Music } from 'lucide-react';
import type { MediaType } from '../types';

interface MediaThumbnailProps {
  src: string | null | undefined;
  alt: string;
  type?: MediaType;
  className?: string;
}

export function MediaThumbnail({ src, alt, type = 'video', className = '' }: MediaThumbnailProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900 text-zinc-500 dark:text-zinc-400 select-none ${className}`}
        aria-label={alt}
      >
        {type === 'audio' ? (
          <Music className="w-6 h-6 opacity-80" aria-hidden="true" />
        ) : (
          <Film className="w-6 h-6 opacity-80" aria-hidden="true" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
