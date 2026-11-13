export type MediaType = 'video' | 'audio';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'merging'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface ResolutionOption {
  id: string;
  label: string;
  tag: string;
  height: number | null;
  width: number | null;
  ext: 'mp4' | 'mp3' | 'm4a' | 'webm';
  type: MediaType;
  fps: number | null;
  vcodec: string | null;
  acodec: string | null;
  filesize: number | null;
  estimatedSize: number | null;
  formatSelector: string;
  isTranscode?: boolean;
  targetHeight?: number;
  audioBitrate?: number;
  note?: string;
}

export interface MediaMetadata {
  url: string;
  title: string;
  uploader: string;
  platform: string;
  duration: number;
  durationString: string;
  viewCount: number | null;
  thumbnail: string | null;
  formats: ResolutionOption[];
  playlistIndex?: number;
}

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  uploader: string;
  platform: string;
  thumbnail: string | null;
  formatId: string;
  qualityLabel: string;
  ext: string;
  type: MediaType;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  downloadedBytes: number;
  totalBytes: number | null;
  filename: string | null;
  fileSize: number | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
  duration: number;
  formatSelector: string;
  isTranscode?: boolean;
  targetHeight?: number;
  audioBitrate?: number;
  playlistIndex?: number;
}

export interface AppSettings {
  defaultVideoQuality: '2160' | '1080' | '720' | '480' | '360';
  defaultAudioQuality: '320' | '192' | '128';
  concurrentDownloads: number;
  autoSaveToDevice: boolean;
  cookiesText: string;
}

export type ActiveTab = 'home' | 'queue' | 'library' | 'settings';
