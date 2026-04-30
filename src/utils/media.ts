import type { MediaAsset } from '../types';

const uid = () => Math.random().toString(36).slice(2, 10);

export async function loadMediaFile(file: File): Promise<MediaAsset> {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isAudio && !isImage) throw new Error(`지원하지 않는 파일: ${file.name}`);

  if (isImage) {
    const meta = await probeImage(url);
    return {
      id: uid(),
      name: file.name,
      file,
      url,
      // Generous nominal duration — the clip's outPoint defines visible
      // duration on the timeline. Source media is a still image that loops.
      duration: 600,
      width: meta.width,
      height: meta.height,
      hasVideo: true, // composited like a video clip
      hasAudio: false,
      isImage: true,
      thumbnail: url, // the image itself doubles as its thumbnail
    };
  }

  const meta = await probeMedia(url, isVideo);
  const thumbnail = isVideo ? await captureThumbnail(url, Math.min(0.5, meta.duration / 2)) : undefined;

  return {
    id: uid(),
    name: file.name,
    file,
    url,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    hasVideo: isVideo,
    hasAudio: true,
    thumbnail,
  };
}

function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => reject(new Error('이미지 로딩 실패'));
    img.src = url;
  });
}

/** Generate evenly spaced thumbnails across a video so long clips can show
 * a filmstrip on the timeline. Returns dataURLs and the source-second step
 * between frames. Capped at 12 frames to keep memory in check. */
export async function generateThumbnailStrip(
  url: string,
  duration: number,
  maxFrames = 12
): Promise<{ frames: string[]; step: number } | null> {
  if (!duration || duration < 0.5) return null;
  const frames: string[] = [];
  const v = document.createElement('video');
  v.preload = 'auto';
  v.muted = true;
  v.src = url;
  await new Promise<void>((resolve, reject) => {
    v.onloadeddata = () => resolve();
    v.onerror = () => reject(new Error('video load failed'));
  }).catch(() => null);
  if (!v.videoWidth) {
    v.removeAttribute('src');
    v.load();
    return null;
  }
  const step = duration / Math.min(maxFrames, Math.max(2, Math.ceil(duration / 2)));
  const W = 80;
  const H = Math.round((v.videoHeight / Math.max(1, v.videoWidth)) * W) || 45;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  for (let t = step / 2; t < duration; t += step) {
    try {
      v.currentTime = t;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          v.removeEventListener('seeked', onSeeked);
          resolve();
        };
        v.addEventListener('seeked', onSeeked);
        // safety timeout
        setTimeout(() => {
          v.removeEventListener('seeked', onSeeked);
          resolve();
        }, 3000);
      });
      ctx.drawImage(v, 0, 0, W, H);
      frames.push(c.toDataURL('image/jpeg', 0.6));
    } catch {
      break;
    }
  }
  v.removeAttribute('src');
  v.load();
  if (frames.length === 0) return null;
  return { frames, step };
}

/** Decode the asset's audio into a compact min/max peak array. Heavy work,
 * intended to be called after the asset is added to the library so the UI
 * isn't blocked. Returns the peaks array and the bucket density. */
export async function generateWaveform(
  file: File,
  peaksPerSecond = 100
): Promise<{ peaks: number[]; peaksPerSecond: number } | null> {
  try {
    const ab = await file.arrayBuffer();
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(ab.slice(0));
    } catch {
      ctx.close();
      return null;
    }
    const totalSamples = buffer.length;
    const dur = buffer.duration;
    const numBuckets = Math.max(1, Math.floor(dur * peaksPerSecond));
    const samplesPerBucket = Math.max(1, Math.floor(totalSamples / numBuckets));
    // Mix down to mono peaks (max abs across channels).
    const peaks: number[] = new Array(numBuckets * 2);
    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
    for (let i = 0; i < numBuckets; i++) {
      const start = i * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, totalSamples);
      let mn = 0;
      let mx = 0;
      for (let s = start; s < end; s++) {
        let sample = 0;
        for (const ch of channels) {
          if (Math.abs(ch[s]) > Math.abs(sample)) sample = ch[s];
        }
        if (sample < mn) mn = sample;
        else if (sample > mx) mx = sample;
      }
      peaks[i * 2] = mn;
      peaks[i * 2 + 1] = mx;
    }
    ctx.close();
    return { peaks, peaksPerSecond };
  } catch {
    return null;
  }
}

function probeMedia(url: string, isVideo: boolean): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    const el: HTMLVideoElement | HTMLAudioElement = isVideo ? document.createElement('video') : document.createElement('audio');
    el.preload = 'metadata';
    el.muted = true;
    el.src = url;
    el.onloadedmetadata = () => {
      if (isVideo) {
        const v = el as HTMLVideoElement;
        resolve({ duration: v.duration || 0, width: v.videoWidth, height: v.videoHeight });
      } else {
        resolve({ duration: el.duration || 0 });
      }
    };
    el.onerror = () => reject(new Error('미디어 로딩 실패'));
  });
}

function captureThumbnail(url: string, atSec: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
      v.src = url;
    const cleanup = () => {
      v.removeAttribute('src');
      v.load();
    };
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.max(0.05, atSec);
      } catch {
        resolve(undefined);
      }
    };
    v.onseeked = () => {
      try {
        const c = document.createElement('canvas');
        const W = 160;
        const H = Math.round((v.videoHeight / Math.max(1, v.videoWidth)) * W) || 90;
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        if (!ctx) {
          cleanup();
          return resolve(undefined);
        }
        ctx.drawImage(v, 0, 0, W, H);
        cleanup();
        resolve(c.toDataURL('image/jpeg', 0.7));
      } catch {
        cleanup();
        resolve(undefined);
      }
    };
    v.onerror = () => {
      cleanup();
      resolve(undefined);
    };
  });
}

export function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 100);
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(ms)}` : `${pad(m)}:${pad(sec)}.${pad(ms)}`;
}
