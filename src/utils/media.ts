import type { MediaAsset } from '../types';

const uid = () => Math.random().toString(36).slice(2, 10);

export async function loadMediaFile(file: File): Promise<MediaAsset> {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  if (!isVideo && !isAudio) throw new Error(`지원하지 않는 파일: ${file.name}`);

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
    hasAudio: true, // assume; refined later if probe fails
    thumbnail,
  };
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
    v.crossOrigin = 'anonymous';
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
