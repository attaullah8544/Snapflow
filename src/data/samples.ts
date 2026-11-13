import sampleAnimationImg from '../assets/images/sample_animation_1794566783931.jpg';
import sampleScifiImg from '../assets/images/sample_scifi_1794566783630.jpg';
import sampleNatureImg from '../assets/images/sample_nature_1794566784174.jpg';
import sampleMusicImg from '../assets/images/sample_music_1794566784950.jpg';

export interface SampleMediaItem {
  id: string;
  title: string;
  creator: string;
  platform: string;
  duration: string;
  url: string;
  thumbnail: string;
  note: string;
}

export const SUPPORTED_PLATFORMS = [
  { id: 'youtube', name: 'YouTube', example: 'https://www.youtube.com/watch?v=...' },
  { id: 'tiktok', name: 'TikTok', example: 'https://www.tiktok.com/@user/video/...' },
  { id: 'instagram', name: 'Instagram', example: 'https://www.instagram.com/reel/...' },
  { id: 'x', name: 'X / Twitter', example: 'https://x.com/user/status/...' },
  { id: 'facebook', name: 'Facebook', example: 'https://www.facebook.com/watch/?v=...' },
  { id: 'vimeo', name: 'Vimeo', example: 'https://vimeo.com/...' },
  { id: 'reddit', name: 'Reddit', example: 'https://www.reddit.com/r/.../comments/...' },
  { id: 'soundcloud', name: 'SoundCloud', example: 'https://soundcloud.com/...' },
];

export const SAMPLE_MEDIA: SampleMediaItem[] = [
  {
    id: 'sample-5mb',
    title: 'Sample 720p Reference Clip',
    creator: 'Internet Archive',
    platform: 'Internet Archive',
    duration: '0:30',
    url: 'https://archive.org/details/SampleVideo1280x7205mb',
    thumbnail: sampleNatureImg,
    note: 'Fast 5 MB test download',
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny (Open Movie)',
    creator: 'Blender Foundation',
    platform: 'Internet Archive',
    duration: '9:56',
    url: 'https://archive.org/details/BigBuckBunny_328',
    thumbnail: sampleAnimationImg,
    note: 'Multi-resolution MP4 & MP3',
  },
  {
    id: 'elephants-dream',
    title: 'Elephants Dream',
    creator: 'Orange Open Movie',
    platform: 'Internet Archive',
    duration: '10:53',
    url: 'https://archive.org/details/ElephantsDream',
    thumbnail: sampleScifiImg,
    note: 'HD animated short film',
  },
  {
    id: 'sintel-audio',
    title: 'Sintel — Soundtrack & Film',
    creator: 'Blender Institute',
    platform: 'Internet Archive',
    duration: '14:48',
    url: 'https://archive.org/details/Sintel',
    thumbnail: sampleMusicImg,
    note: 'Great for MP3 extraction',
  },
];
