import express from 'express';
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type {
  DownloadItem,
  MediaMetadata,
  ResolutionOption,
} from './src/types.ts';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = process.cwd();
const BIN_DIR = path.join(ROOT_DIR, 'bin');
const YTDLP_PATH = path.join(BIN_DIR, 'yt-dlp');
const DOWNLOADS_DIR = path.join(ROOT_DIR, 'downloads');
const FILES_DIR = path.join(DOWNLOADS_DIR, 'files');
const DB_PATH = path.join(DOWNLOADS_DIR, 'db.json');

fs.mkdirSync(BIN_DIR, { recursive: true });
fs.mkdirSync(FILES_DIR, { recursive: true });

// Ensure yt-dlp binary exists (auto-download in fresh runtime if missing)
async function ensureYtDlp(): Promise<string> {
  if (fs.existsSync(YTDLP_PATH)) {
    try {
      fs.chmodSync(YTDLP_PATH, 0o755);
      return YTDLP_PATH;
    } catch {
      // continue
    }
  }
  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch yt-dlp binary (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(YTDLP_PATH, buf);
  fs.chmodSync(YTDLP_PATH, 0o755);
  return YTDLP_PATH;
}

function findFfmpeg(): string | null {
  const candidates = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'ffmpeg';
}

const FFMPEG_PATH = findFfmpeg();

// Persistence helpers
function loadDownloads(): DownloadItem[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Mark any previously interrupted active jobs as error so state stays truthful
    return parsed.map((item: DownloadItem) => {
      if (item.status === 'downloading' || item.status === 'merging' || item.status === 'queued') {
        return {
          ...item,
          status: 'error',
          error: 'Interrupted when server restarted. Tap Retry to resume.',
        };
      }
      return item;
    });
  } catch {
    return [];
  }
}

let downloads: DownloadItem[] = loadDownloads();
const activeProcesses = new Map<string, ReturnType<typeof spawn>>();
const sseClients = new Set<express.Response>();
const thumbnailCache = new Map<string, { contentType: string; data: Buffer; ts: number }>();

function saveDownloads() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(downloads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist downloads db:', err);
  }
}

function broadcastDownloads() {
  const payload = `data: ${JSON.stringify({ type: 'sync', downloads })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function updateDownload(id: string, patch: Partial<DownloadItem>, persist = false) {
  const idx = downloads.findIndex((d) => d.id === id);
  if (idx === -1) return;
  downloads[idx] = { ...downloads[idx], ...patch };
  if (persist) saveDownloads();
  broadcastDownloads();
}

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function detectPlatform(url: string, extractor?: string): string {
  const target = `${url} ${extractor || ''}`.toLowerCase();
  if (target.includes('youtube') || target.includes('youtu.be')) return 'YouTube';
  if (target.includes('tiktok')) return 'TikTok';
  if (target.includes('instagram')) return 'Instagram';
  if (target.includes('twitter') || target.includes('x.com')) return 'X / Twitter';
  if (target.includes('facebook') || target.includes('fb.watch')) return 'Facebook';
  if (target.includes('vimeo')) return 'Vimeo';
  if (target.includes('reddit')) return 'Reddit';
  if (target.includes('soundcloud')) return 'SoundCloud';
  if (target.includes('twitch')) return 'Twitch';
  if (target.includes('dailymotion')) return 'Dailymotion';
  if (target.includes('archive.org')) return 'Internet Archive';
  if (target.includes('wikimedia')) return 'Wikimedia';
  return 'Web Media';
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'media';
}

function isValidHttpUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface RawYtFormat {
  format_id?: string;
  ext?: string;
  height?: number;
  width?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  abr?: number;
  vbr?: number;
  format_note?: string;
}

interface RawYtInfo {
  _type?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  extractor?: string;
  extractor_key?: string;
  duration?: number;
  view_count?: number;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string; width?: number }>;
  formats?: RawYtFormat[];
  entries?: RawYtInfo[];
}

function buildResolutionOptions(info: RawYtInfo, duration: number): ResolutionOption[] {
  const rawFormats = Array.isArray(info.formats) ? info.formats : [];
  const videoFormats = rawFormats.filter(
    (f) => f.vcodec !== 'none' && Boolean(f.height || f.width)
  );
  const audioFormats = rawFormats.filter(
    (f) => f.vcodec === 'none' && Boolean(f.acodec && f.acodec !== 'none')
  );

  // Estimate best audio size for merged video+audio estimation
  const bestAudio = audioFormats.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];
  const bestAudioSize =
    bestAudio?.filesize ||
    bestAudio?.filesize_approx ||
    (bestAudio?.abr && duration ? Math.round((bestAudio.abr * 1000 * duration) / 8) : 0);

  const maxNativeHeight = videoFormats.reduce((max, f) => Math.max(max, f.height || 0), 0);

  const tierDefs = [
    { height: 2160, minH: 1900, maxH: 2500, label: '2160p 4K Ultra HD', tag: '4K' },
    { height: 1440, minH: 1300, maxH: 1899, label: '1440p 2K QHD', tag: '2K' },
    { height: 1080, minH: 960, maxH: 1299, label: '1080p Full HD', tag: 'FHD' },
    { height: 720, minH: 640, maxH: 959, label: '720p HD', tag: 'HD' },
    { height: 480, minH: 420, maxH: 639, label: '480p SD', tag: 'SD' },
    { height: 360, minH: 300, maxH: 419, label: '360p Standard', tag: '360p' },
    { height: 240, minH: 180, maxH: 299, label: '240p Data Saver', tag: '240p' },
  ];

  const options: ResolutionOption[] = [];

  for (const tier of tierDefs) {
    const matches = videoFormats.filter(
      (f) => (f.height || 0) >= tier.minH && (f.height || 0) <= tier.maxH
    );

    if (matches.length > 0) {
      // Pick highest bitrate / fps MP4-compatible match
      const bestMatch = matches.sort((a, b) => {
        const aMp4 = a.ext === 'mp4' ? 1 : 0;
        const bMp4 = b.ext === 'mp4' ? 1 : 0;
        if (aMp4 !== bMp4) return bMp4 - aMp4;
        return (b.tbr || b.vbr || 0) - (a.tbr || a.vbr || 0);
      })[0];

      const hasAudioInStream = bestMatch.acodec && bestMatch.acodec !== 'none';
      const rawSize =
        bestMatch.filesize ||
        bestMatch.filesize_approx ||
        (bestMatch.tbr && duration ? Math.round((bestMatch.tbr * 1000 * duration) / 8) : null);

      const totalEstimated = rawSize
        ? rawSize + (hasAudioInStream ? 0 : bestAudioSize)
        : null;

      const formatSelector = hasAudioInStream
        ? `${bestMatch.format_id}/best[height<=${tier.height}]`
        : `bestvideo[height<=${tier.height}]+bestaudio/best[height<=${tier.height}]/${bestMatch.format_id}+bestaudio/best`;

      options.push({
        id: `vid-${tier.height}`,
        label: tier.label,
        tag: tier.tag,
        height: bestMatch.height || tier.height,
        width: bestMatch.width || Math.round((tier.height * 16) / 9),
        ext: 'mp4',
        type: 'video',
        fps: bestMatch.fps ? Math.round(bestMatch.fps) : null,
        vcodec: bestMatch.vcodec || 'h264',
        acodec: hasAudioInStream ? bestMatch.acodec || 'aac' : 'aac',
        filesize: totalEstimated,
        estimatedSize: totalEstimated,
        formatSelector,
        isTranscode: false,
        note: bestMatch.ext && bestMatch.ext !== 'mp4' ? `Remuxed from ${bestMatch.ext.toUpperCase()} to MP4` : undefined,
      });
    } else if (maxNativeHeight > tier.height && tier.height >= 360 && tier.height <= 720) {
      // Provide ffmpeg-powered resolution downscale when source lacks intermediate native tier
      const approxMbps = tier.height === 720 ? 2.4 : tier.height === 480 ? 1.2 : 0.7;
      const estimated = duration ? Math.round((approxMbps * 1_000_000 * duration) / 8) : null;
      options.push({
        id: `vid-transcode-${tier.height}`,
        label: tier.label,
        tag: tier.tag,
        height: tier.height,
        width: Math.round((tier.height * 16) / 9),
        ext: 'mp4',
        type: 'video',
        fps: 30,
        vcodec: 'h264',
        acodec: 'aac',
        filesize: null,
        estimatedSize: estimated,
        formatSelector: 'bestvideo+bestaudio/best',
        isTranscode: true,
        targetHeight: tier.height,
        note: `Transcoded to ${tier.height}p MP4`,
      });
    }
  }

  // Fallback if format metadata didn't expose heights at all
  if (options.length === 0) {
    options.push({
      id: 'vid-best',
      label: 'Best Available Video',
      tag: 'HD',
      height: 720,
      width: 1280,
      ext: 'mp4',
      type: 'video',
      fps: 30,
      vcodec: 'h264',
      acodec: 'aac',
      filesize: null,
      estimatedSize: duration ? Math.round((1.8 * 1_000_000 * duration) / 8) : null,
      formatSelector: 'bestvideo+bestaudio/best',
      isTranscode: false,
    });
    options.push({
      id: 'vid-transcode-480',
      label: '480p SD',
      tag: 'SD',
      height: 480,
      width: 854,
      ext: 'mp4',
      type: 'video',
      fps: 30,
      vcodec: 'h264',
      acodec: 'aac',
      filesize: null,
      estimatedSize: duration ? Math.round((1.1 * 1_000_000 * duration) / 8) : null,
      formatSelector: 'bestvideo+bestaudio/best',
      isTranscode: true,
      targetHeight: 480,
      note: 'Transcoded to 480p MP4',
    });
  }

  // Audio extraction options (always supported via yt-dlp + ffmpeg)
  const audioTiers = [
    { id: 'aud-mp3-320', label: 'MP3 320 kbps', tag: 'MP3', ext: 'mp3' as const, bitrate: 320, note: 'High fidelity stereo' },
    { id: 'aud-mp3-192', label: 'MP3 192 kbps', tag: 'MP3', ext: 'mp3' as const, bitrate: 192, note: 'Balanced quality' },
    { id: 'aud-m4a-128', label: 'M4A 128 kbps', tag: 'M4A', ext: 'm4a' as const, bitrate: 128, note: 'Compact mobile audio' },
  ];

  for (const aud of audioTiers) {
    const estSize = duration ? Math.round((aud.bitrate * 1000 * duration) / 8) : null;
    options.push({
      id: aud.id,
      label: aud.label,
      tag: aud.tag,
      height: null,
      width: null,
      ext: aud.ext,
      type: 'audio',
      fps: null,
      vcodec: null,
      acodec: aud.ext,
      filesize: null,
      estimatedSize: estSize,
      formatSelector: 'bestaudio/best',
      audioBitrate: aud.bitrate,
      note: aud.note,
    });
  }

  return options;
}

function writeTempCookies(cookiesText?: string): string | null {
  if (!cookiesText || !cookiesText.trim()) return null;
  const cookiePath = path.join(DOWNLOADS_DIR, `cookies-${crypto.randomUUID()}.txt`);
  fs.writeFileSync(cookiePath, cookiesText, 'utf-8');
  return cookiePath;
}

function cleanupFile(filePath: string | null) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

async function runDownloadJob(job: DownloadItem, cookiesText?: string) {
  let cookiePath: string | null = null;
  let tempRawPath: string | null = null;

  try {
    const ytdlp = await ensureYtDlp();
    cookiePath = writeTempCookies(cookiesText);

    updateDownload(job.id, { status: 'downloading', progress: 1, speed: 'Connecting…', eta: '--:--', error: null }, true);

    const safeTitle = sanitizeFilename(job.title);
    const shortId = job.id.slice(0, 8);
    const finalFileName = `${safeTitle} [${job.qualityLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}]_${shortId}.${job.ext}`;
    const finalFilePath = path.join(FILES_DIR, finalFileName);

    const isTranscode = Boolean(job.isTranscode && job.targetHeight);
    const outputTemplate = isTranscode
      ? path.join(FILES_DIR, `tmp_${shortId}.%(ext)s`)
      : path.join(FILES_DIR, `${safeTitle} [${job.qualityLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}]_${shortId}.%(ext)s`);

    const args: string[] = [
      '--newline',
      '--progress',
      '--no-warnings',
      '--no-check-certificates',
      '--force-overwrites',
    ];

    if (FFMPEG_PATH) {
      args.push('--ffmpeg-location', path.dirname(FFMPEG_PATH));
    }

    if (job.playlistIndex && job.playlistIndex > 0) {
      args.push('--playlist-items', String(job.playlistIndex));
    } else {
      args.push('--no-playlist');
    }

    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }

    if (job.type === 'audio') {
      args.push(
        '-f',
        job.formatSelector || 'bestaudio/best',
        '-x',
        '--audio-format',
        job.ext === 'm4a' ? 'm4a' : 'mp3',
        '--audio-quality',
        job.audioBitrate === 320 ? '0' : job.audioBitrate === 192 ? '2' : '5',
        '-o',
        outputTemplate,
        job.url
      );
    } else {
      args.push(
        '-f',
        job.formatSelector || 'bestvideo+bestaudio/best',
        '--merge-output-format',
        'mp4',
        '-o',
        outputTemplate,
        job.url
      );
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(ytdlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      activeProcesses.set(job.id, child);

      let stderrBuf = '';

      const handleLine = (line: string) => {
        // Parse: [download]  42.3% of   12.34MiB at    2.10MiB/s ETA 00:04
        const match = line.match(
          /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([^\s]+)(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/i
        );
        if (match) {
          const rawPct = parseFloat(match[1]);
          const scaledPct = isTranscode ? Math.round(rawPct * 0.6) : Math.min(99, Math.round(rawPct));
          const speed = match[3] || 'Active';
          const eta = match[4] || '--:--';
          updateDownload(job.id, {
            status: 'downloading',
            progress: scaledPct,
            speed,
            eta,
          });
        } else if (line.includes('[Merger]') || line.includes('[ExtractAudio]') || line.includes('Post-process')) {
          updateDownload(job.id, {
            status: 'merging',
            progress: isTranscode ? 62 : 96,
            speed: 'Processing',
            eta: '00:02',
          });
        }
      };

      child.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString('utf-8').split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) handleLine(line);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stderrBuf += text;
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) handleLine(line);
        }
      });

      child.on('error', (err) => {
        activeProcesses.delete(job.id);
        reject(err);
      });

      child.on('close', (code) => {
        activeProcesses.delete(job.id);
        const current = downloads.find((d) => d.id === job.id);
        if (current?.status === 'cancelled') {
          reject(new Error('CANCELLED'));
          return;
        }
        if (code !== 0) {
          const cleanErr = stderrBuf
            .split(/\r?\n/)
            .filter((l) => l.includes('ERROR:'))
            .pop()
            ?.replace(/^ERROR:\s*/i, '') || `Download failed (exit code ${code})`;
          reject(new Error(cleanErr));
          return;
        }
        resolve();
      });
    });

    // Find downloaded file
    const prefix = isTranscode
      ? `tmp_${shortId}.`
      : `${safeTitle} [${job.qualityLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}]_${shortId}.`;

    const matchedFile = fs
      .readdirSync(FILES_DIR)
      .find((f) => f.startsWith(prefix) && !f.endsWith('.part'));

    if (!matchedFile) {
      throw new Error('Downloaded file could not be located on disk.');
    }

    const matchedPath = path.join(FILES_DIR, matchedFile);

    if (isTranscode && job.targetHeight) {
      tempRawPath = matchedPath;
      updateDownload(job.id, {
        status: 'merging',
        progress: 65,
        speed: `Encoding ${job.targetHeight}p`,
        eta: '--:--',
      });

      await new Promise<void>((resolve, reject) => {
        const ffArgs = [
          '-y',
          '-i',
          matchedPath,
          '-vf',
          `scale=-2:${job.targetHeight}`,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '23',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          '-progress',
          'pipe:1',
          finalFilePath,
        ];

        const ff = spawn(FFMPEG_PATH || 'ffmpeg', ffArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        activeProcesses.set(job.id, ff);

        ff.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          const outTimeMatch = text.match(/out_time_us=(\d+)/);
          if (outTimeMatch && job.duration > 0) {
            const sec = Number(outTimeMatch[1]) / 1_000_000;
            const ratio = Math.min(1, sec / job.duration);
            const pct = Math.min(99, Math.round(65 + ratio * 34));
            updateDownload(job.id, {
              status: 'merging',
              progress: pct,
              speed: `Encoding ${job.targetHeight}p`,
            });
          }
        });

        ff.on('error', (err) => {
          activeProcesses.delete(job.id);
          reject(err);
        });

        ff.on('close', (code) => {
          activeProcesses.delete(job.id);
          const current = downloads.find((d) => d.id === job.id);
          if (current?.status === 'cancelled') {
            reject(new Error('CANCELLED'));
            return;
          }
          if (code !== 0) {
            reject(new Error(`Transcode failed (exit code ${code})`));
            return;
          }
          resolve();
        });
      });

      cleanupFile(tempRawPath);
      tempRawPath = null;

      const stat = fs.statSync(finalFilePath);
      updateDownload(
        job.id,
        {
          status: 'completed',
          progress: 100,
          speed: '',
          eta: '',
          filename: finalFileName,
          fileSize: stat.size,
          downloadedBytes: stat.size,
          totalBytes: stat.size,
          completedAt: Date.now(),
        },
        true
      );
    } else {
      const stat = fs.statSync(matchedPath);
      const actualExt = path.extname(matchedFile).replace('.', '') || job.ext;
      updateDownload(
        job.id,
        {
          status: 'completed',
          progress: 100,
          speed: '',
          eta: '',
          ext: actualExt,
          filename: matchedFile,
          fileSize: stat.size,
          downloadedBytes: stat.size,
          totalBytes: stat.size,
          completedAt: Date.now(),
        },
        true
      );
    }
  } catch (err) {
    cleanupFile(tempRawPath);
    const message = err instanceof Error ? err.message : 'Download failed';
    if (message === 'CANCELLED') {
      updateDownload(job.id, { status: 'cancelled', speed: '', eta: '' }, true);
    } else {
      updateDownload(
        job.id,
        {
          status: 'error',
          speed: '',
          eta: '',
          error: message,
        },
        true
      );
    }
  } finally {
    cleanupFile(cookiePath);
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ytdlp: fs.existsSync(YTDLP_PATH),
      ffmpeg: Boolean(FFMPEG_PATH),
    });
  });

  // Thumbnail proxy so social platform images never fail CORS/hotlink checks
  app.get('/api/thumbnail', async (req, res) => {
    const targetUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!isValidHttpUrl(targetUrl)) {
      res.status(400).send('Invalid thumbnail URL');
      return;
    }

    const cached = thumbnailCache.get(targetUrl);
    if (cached && Date.now() - cached.ts < 1000 * 60 * 30) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.send(cached.data);
      return;
    }

    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          Accept: 'image/*,*/*;q=0.8',
        },
      });
      if (!upstream.ok) {
        res.status(upstream.status).send('Thumbnail fetch failed');
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const data = Buffer.from(await upstream.arrayBuffer());

      if (thumbnailCache.size >= 60) {
        const oldestKey = thumbnailCache.keys().next().value;
        if (oldestKey) thumbnailCache.delete(oldestKey);
      }
      thumbnailCache.set(targetUrl, { contentType, data, ts: Date.now() });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.send(data);
    } catch {
      res.status(502).send('Thumbnail unavailable');
    }
  });

  // Inspect any social/video URL and return multi-resolution formats
  app.post('/api/inspect', async (req, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const cookiesText = typeof req.body?.cookiesText === 'string' ? req.body.cookiesText : undefined;

    if (!isValidHttpUrl(rawUrl)) {
      res.status(400).json({ error: 'Please enter a valid http:// or https:// video URL.' });
      return;
    }

    let cookiePath: string | null = null;

    try {
      const ytdlp = await ensureYtDlp();
      cookiePath = writeTempCookies(cookiesText);

      const args = [
        '--dump-single-json',
        '--no-warnings',
        '--no-check-certificates',
        '--playlist-items',
        '1',
      ];
      if (cookiePath) {
        args.push('--cookies', cookiePath);
      }
      args.push(rawUrl);

      const { stdout } = await execFileAsync(ytdlp, args, {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 35000,
      });

      const parsed = JSON.parse(stdout) as RawYtInfo;
      let target: RawYtInfo = parsed;
      let playlistIndex: number | undefined;

      if (parsed._type === 'playlist' && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        let bestIdx = 0;
        let maxFormats = -1;
        parsed.entries.forEach((entry, idx) => {
          const count = Array.isArray(entry?.formats) ? entry.formats.length : 0;
          if (count > maxFormats) {
            maxFormats = count;
            bestIdx = idx;
          }
        });
        target = parsed.entries[bestIdx] || parsed.entries[0];
        playlistIndex = bestIdx + 1;
      }

      const duration = Number(target.duration || 0);
      const rawThumb =
        target.thumbnail ||
        parsed.thumbnail ||
        (Array.isArray(target.thumbnails) && target.thumbnails.length > 0
          ? target.thumbnails[target.thumbnails.length - 1]?.url
          : null);

      const metadata: MediaMetadata = {
        url: rawUrl,
        title: target.title || parsed.title || 'Untitled Media',
        uploader: target.uploader || target.channel || parsed.uploader || 'Creator',
        platform: detectPlatform(rawUrl, target.extractor || parsed.extractor),
        duration,
        durationString: formatDuration(duration),
        viewCount: typeof target.view_count === 'number' ? target.view_count : null,
        thumbnail: rawThumb ? `/api/thumbnail?url=${encodeURIComponent(rawThumb)}` : null,
        formats: buildResolutionOptions(target, duration),
        playlistIndex,
      };

      res.json(metadata);
    } catch (err: unknown) {
      const stderr =
        (err as { stderr?: string })?.stderr ||
        (err instanceof Error ? err.message : 'Unable to inspect video URL.');

      let friendlyError = 'Could not extract video details from this URL.';
      if (stderr.includes('Sign in to confirm') || stderr.includes('cookies')) {
        friendlyError =
          'This platform requested authentication for this link. Paste Netscape cookies in Settings or try another public link.';
      } else if (stderr.includes('Unsupported URL')) {
        friendlyError = 'This URL does not point to a supported video or audio stream.';
      } else if (stderr.includes('404') || stderr.includes('not found')) {
        friendlyError = 'Media not found or removed (404). Check the link and try again.';
      } else if (stderr.includes('Private video')) {
        friendlyError = 'This video is private and cannot be accessed without account cookies.';
      } else if (stderr.includes('ERROR:')) {
        const line = stderr
          .split(/\r?\n/)
          .find((l) => l.includes('ERROR:'));
        if (line) friendlyError = line.replace(/^ERROR:\s*/i, '').slice(0, 220);
      }

      res.status(422).json({ error: friendlyError });
    } finally {
      cleanupFile(cookiePath);
    }
  });

  // SSE stream for live progress
  app.get('/api/downloads/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'sync', downloads })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // List downloads
  app.get('/api/downloads', (_req, res) => {
    res.json({ downloads });
  });

  // Start a new download
  app.post('/api/downloads', (req, res) => {
    const body = req.body as {
      url?: string;
      title?: string;
      uploader?: string;
      platform?: string;
      thumbnail?: string | null;
      duration?: number;
      playlistIndex?: number;
      formatOption?: ResolutionOption;
      cookiesText?: string;
    };

    if (!body?.url || !isValidHttpUrl(body.url) || !body?.formatOption) {
      res.status(400).json({ error: 'Invalid download payload.' });
      return;
    }

    const opt = body.formatOption;
    const job: DownloadItem = {
      id: crypto.randomUUID(),
      url: body.url,
      title: body.title || 'Untitled Media',
      uploader: body.uploader || 'Creator',
      platform: body.platform || detectPlatform(body.url),
      thumbnail: body.thumbnail || null,
      formatId: opt.id,
      qualityLabel: opt.label,
      ext: opt.ext,
      type: opt.type,
      status: 'queued',
      progress: 0,
      speed: 'Queued',
      eta: '--:--',
      downloadedBytes: 0,
      totalBytes: opt.filesize || opt.estimatedSize || null,
      filename: null,
      fileSize: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
      duration: Number(body.duration || 0),
      formatSelector: opt.formatSelector,
      isTranscode: opt.isTranscode,
      targetHeight: opt.targetHeight,
      audioBitrate: opt.audioBitrate,
      playlistIndex: body.playlistIndex,
    };

    downloads = [job, ...downloads];
    saveDownloads();
    broadcastDownloads();

    // Start asynchronously
    void runDownloadJob(job, body.cookiesText);

    res.status(201).json({ download: job });
  });

  // Cancel active download
  app.post('/api/downloads/:id/cancel', (req, res) => {
    const item = downloads.find((d) => d.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Download not found.' });
      return;
    }

    updateDownload(item.id, { status: 'cancelled', speed: '', eta: '' }, true);
    const proc = activeProcesses.get(item.id);
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      activeProcesses.delete(item.id);
    }

    res.json({ ok: true });
  });

  // Retry failed or cancelled download
  app.post('/api/downloads/:id/retry', (req, res) => {
    const item = downloads.find((d) => d.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Download not found.' });
      return;
    }

    const cookiesText = typeof req.body?.cookiesText === 'string' ? req.body.cookiesText : undefined;
    updateDownload(
      item.id,
      { status: 'queued', progress: 0, speed: 'Retrying…', eta: '--:--', error: null },
      true
    );

    const updated = downloads.find((d) => d.id === item.id)!;
    void runDownloadJob(updated, cookiesText);
    res.json({ download: updated });
  });

  // Delete download and local file
  app.delete('/api/downloads/:id', (req, res) => {
    const idx = downloads.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Download not found.' });
      return;
    }

    const item = downloads[idx];
    const proc = activeProcesses.get(item.id);
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      activeProcesses.delete(item.id);
    }

    if (item.filename) {
      cleanupFile(path.join(FILES_DIR, item.filename));
    }

    downloads.splice(idx, 1);
    saveDownloads();
    broadcastDownloads();
    res.json({ ok: true });
  });

  // Download file attachment to user device
  app.get('/api/downloads/:id/file', (req, res) => {
    const item = downloads.find((d) => d.id === req.params.id);
    if (!item || !item.filename) {
      res.status(404).send('File not found.');
      return;
    }

    const filePath = path.join(FILES_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).send('File no longer exists on server.');
      return;
    }

    const cleanName = `${sanitizeFilename(item.title)} (${item.qualityLabel}).${item.ext}`;
    res.download(filePath, cleanName);
  });

  // HTTP Range stream for in-app playback
  app.get('/api/downloads/:id/stream', (req, res) => {
    const item = downloads.find((d) => d.id === req.params.id);
    if (!item || !item.filename) {
      res.status(404).send('Media not found.');
      return;
    }

    const filePath = path.join(FILES_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).send('Media file missing.');
      return;
    }

    const stat = fs.statSync(filePath);
    const total = stat.size;
    const ext = item.ext.toLowerCase();
    const mime =
      ext === 'mp3'
        ? 'audio/mpeg'
        : ext === 'm4a'
        ? 'audio/mp4'
        : ext === 'webm'
        ? 'video/webm'
        : 'video/mp4';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Vite dev middleware or static production assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SnapFlow server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
