import { useEffect, useMemo, useRef } from 'react';
import { useEditor, projectDuration } from '../state/editorStore';
import type { Clip } from '../types';
import { formatTime } from '../utils/media';
import { paintSubtitle } from '../utils/drawSubtitle';

interface ClipMediaState {
  kind: 'video' | 'image';
  el: HTMLVideoElement | null;   // null for image clips
  imgEl: HTMLImageElement | null; // null for video clips
  ready: boolean;
  // Per-clip frame cache. For video: we blit the last-known good frame here
  // whenever the video reports readyState >= HAVE_CURRENT_DATA. For images:
  // we paint once after the image loads. The main canvas always reads from
  // the cache so a higher track stays on top even while a video is mid-seek.
  cache: HTMLCanvasElement;
  cacheCtx: CanvasRenderingContext2D | null;
  cacheValid: boolean;
}

export function Preview() {
  const clips = useEditor((s) => s.clips);
  const tracks = useEditor((s) => s.tracks);
  const assets = useEditor((s) => s.assets);
  const settings = useEditor((s) => s.settings);
  const playhead = useEditor((s) => s.playhead);
  const isPlaying = useEditor((s) => s.isPlaying);
  const masterVolume = useEditor((s) => s.masterVolume);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setMasterVolume = useEditor((s) => s.setMasterVolume);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const mediaMapRef = useRef<Map<string, ClipMediaState>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Compute project duration
  const duration = useMemo(() => projectDuration(useEditor.getState()), [clips]);

  // Maintain hidden video elements per clip
  useEffect(() => {
    const container = hiddenContainerRef.current;
    if (!container) return;
    const map = mediaMapRef.current;

    const removeEntry = (id: string) => {
      const st = map.get(id);
      if (!st) return;
      try {
        if (st.el) {
          st.el.pause();
          st.el.removeAttribute('src');
          st.el.load();
          st.el.remove();
        }
        if (st.imgEl) st.imgEl.remove();
      } catch {}
      map.delete(id);
    };

    // remove media for clips no longer present, or whose asset URL changed
    // (e.g. after autosave-restore / project open creates fresh object URLs).
    for (const id of Array.from(map.keys())) {
      const c = clips[id];
      if (!c) {
        removeEntry(id);
        continue;
      }
      const a = assets[c.assetId];
      const expectedSrc = a?.url ?? '';
      const m = map.get(id)!;
      const currentSrc = m.el?.currentSrc || m.el?.src || m.imgEl?.src || '';
      if (!a || currentSrc !== expectedSrc) {
        removeEntry(id);
      }
    }

    // add media for new clips
    for (const c of Object.values(clips)) {
      if (map.has(c.id)) continue;
      const a = assets[c.assetId];
      if (!a) continue;
      const cache = document.createElement('canvas');
      cache.width = a.width || 320;
      cache.height = a.height || 180;
      const cacheCtx = cache.getContext('2d');
      if (a.isImage) {
        const img = new Image();
        img.style.position = 'absolute';
        img.style.left = '-99999px';
        img.src = a.url;
        container.appendChild(img);
        const state: ClipMediaState = {
          kind: 'image',
          el: null,
          imgEl: img,
          ready: false,
          cache,
          cacheCtx,
          cacheValid: false,
        };
        img.onload = () => {
          state.ready = true;
          if (img.naturalWidth) cache.width = img.naturalWidth;
          if (img.naturalHeight) cache.height = img.naturalHeight;
          if (cacheCtx) {
            try {
              cacheCtx.drawImage(img, 0, 0, cache.width, cache.height);
              state.cacheValid = true;
            } catch {}
          }
        };
        map.set(c.id, state);
        continue;
      }
      const v = document.createElement('video');
      v.src = a.url;
      v.preload = 'auto';
      v.playsInline = true;
      v.muted = true;
      v.style.position = 'absolute';
      v.style.left = '-99999px';
      v.style.top = '-99999px';
      v.width = a.width || 320;
      v.height = a.height || 180;
      container.appendChild(v);
      const state: ClipMediaState = {
        kind: 'video',
        el: v,
        imgEl: null,
        ready: false,
        cache,
        cacheCtx,
        cacheValid: false,
      };
      v.onloadeddata = () => {
        state.ready = true;
        if (v.videoWidth) cache.width = v.videoWidth;
        if (v.videoHeight) cache.height = v.videoHeight;
      };
      map.set(c.id, state);
    }
  }, [clips, assets]);

  // Render loop: draw canvas based on playhead, sync hidden videos
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tick = (now: number) => {
      const state = useEditor.getState();
      let head = state.playhead;
      if (state.isPlaying) {
        const dt = lastTickRef.current ? (now - lastTickRef.current) / 1000 : 0;
        head = state.playhead + dt;
        const dur = projectDuration(state);
        if (head >= dur) {
          head = dur;
          setPlaying(false);
        }
        setPlayhead(head);
      }
      lastTickRef.current = now;

      drawFrame(
        ctx,
        canvas.width,
        canvas.height,
        state.tracks,
        Object.values(state.clips),
        state.assets,
        head,
        mediaMapRef.current,
        state.isPlaying,
        state.masterVolume
      );
      drawSubtitles(ctx, canvas.width, canvas.height, Object.values(state.subtitles), head);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [setPlayhead, setPlaying]);

  // When isPlaying flips, control playback of every active clip
  useEffect(() => {
    if (!isPlaying) {
      for (const m of mediaMapRef.current.values()) {
        if (m.el && !m.el.paused) m.el.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div className="preview">
      <div className="preview-stage">
        <canvas
          ref={canvasRef}
          width={settings.width}
          height={settings.height}
          style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
        />
        <div ref={hiddenContainerRef} aria-hidden="true" />
      </div>
      <div className="preview-controls">
        <button
          onClick={() => {
            setPlayhead(0);
            setPlaying(false);
          }}
          title="처음으로"
        >
          ⏮
        </button>
        <button onClick={() => setPlaying(!isPlaying)}>{isPlaying ? '⏸' : '▶'}</button>
        <button
          onClick={() => {
            setPlaying(false);
            setPlayhead(duration);
          }}
          title="끝으로"
        >
          ⏭
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.01}
          value={Math.min(playhead, duration)}
          onChange={(e) => setPlayhead(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span className="time">
          {formatTime(playhead)} / {formatTime(duration)}
        </span>
        <span className="master-vol" title="마스터 볼륨 (전체 출력에 적용)">
          <button
            className="vol-icon"
            onClick={() => setMasterVolume(masterVolume > 0 ? 0 : 1)}
            title={masterVolume > 0 ? '마스터 음소거' : '마스터 음소거 해제'}
          >
            {masterVolume === 0 ? '🔇' : masterVolume < 0.5 ? '🔈' : masterVolume < 1.2 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          />
          <span className="vol-percent">{Math.round(masterVolume * 100)}%</span>
        </span>
      </div>
    </div>
  );
}

/** Check whether *any other track* besides `excludeTrackId` has an audible
 * clip active at time `t`. Used to drive auto-ducking. A clip counts as
 * audible if (a) it overlaps the time, (b) the clip itself isn't muted, and
 * (c) the asset has audio. Track-level mute also disqualifies. */
function hasOtherActiveAudio(
  tracks: import('../types').Track[],
  clips: Clip[],
  assets: Record<string, import('../types').MediaAsset>,
  excludeTrackId: string,
  t: number
): boolean {
  for (const tr of tracks) {
    if (tr.id === excludeTrackId) continue;
    if (tr.muted) continue;
    for (const c of clips) {
      if (c.trackId !== tr.id) continue;
      if (c.muted) continue;
      const a = assets[c.assetId];
      if (!a || !a.hasAudio) continue;
      const speed = c.speed ?? 1;
      const dur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const tailCap = Math.max(0, (a.duration - c.outPoint) / Math.max(0.01, speed));
      const tail = Math.min(c.audioTail ?? 0, tailCap);
      if (t >= c.start && t < c.start + dur + tail) return true;
    }
  }
  return false;
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  subs: import('../types').Subtitle[],
  head: number
) {
  for (const s of subs) {
    if (head < s.start || head >= s.start + s.duration) continue;
    let alpha = 1;
    if (s.fadeIn > 0 && head - s.start < s.fadeIn) alpha *= (head - s.start) / s.fadeIn;
    if (s.fadeOut > 0 && s.start + s.duration - head < s.fadeOut) {
      alpha *= (s.start + s.duration - head) / s.fadeOut;
    }
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    paintSubtitle(ctx, W, H, s);
    ctx.restore();
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  tracks: import('../types').Track[],
  clips: Clip[],
  assets: Record<string, import('../types').MediaAsset>,
  head: number,
  media: Map<string, ClipMediaState>,
  isPlaying: boolean,
  masterVolume: number
) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Draw video tracks bottom→up so V1 (top in UI) is on top
  // tracks order: top first; we want V1 on top — so we draw from last video track up to first
  const videoTracks = tracks.filter((t) => t.kind === 'video' && !t.hidden);
  const drawOrder = [...videoTracks].reverse();

  for (const t of drawOrder) {
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const speed = c.speed ?? 1;
      const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const visualEnd = c.start + displayDur;
      const tail = c.audioTail ?? 0;
      const a0 = assets[c.assetId];
      const tailCap = a0 ? Math.max(0, (a0.duration - c.outPoint) / Math.max(0.01, speed)) : 0;
      const effectiveTail = Math.min(tail, tailCap);
      const audioEnd = visualEnd + effectiveTail;
      const m = media.get(c.id);
      if (!m) continue;
      const a = assets[c.assetId];
      if (!a || !a.hasVideo) continue;

      if (head >= c.start && head < visualEnd) {
        // Image clips skip all the video sync — their cache is populated once
        // at load time and never changes.
        if (m.el) {
          const localTime = c.inPoint + (head - c.start) * speed;
          try {
            const rate = Math.max(0.0625, Math.min(16, speed));
            if (m.el.playbackRate !== rate) m.el.playbackRate = rate;
            if (isPlaying) {
              if (Math.abs(m.el.currentTime - localTime) > 0.2) {
                m.el.currentTime = localTime;
              }
              if (m.el.paused) {
                m.el.muted = true;
                m.el.play().catch(() => {});
              }
            } else {
              if (!m.el.paused) m.el.pause();
              if (Math.abs(m.el.currentTime - localTime) > 0.05) {
                try {
                  m.el.currentTime = localTime;
                } catch {}
              }
            }
          } catch {}
        }
        // alpha (fade) — visual fade uses visualEnd, not audioEnd.
        let alpha = 1;
        if (c.fadeIn > 0 && head - c.start < c.fadeIn) {
          alpha *= (head - c.start) / c.fadeIn;
        }
        if (c.fadeOut > 0 && visualEnd - head < c.fadeOut) {
          alpha *= (visualEnd - head) / c.fadeOut;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        // Refresh the per-clip cache from the live video whenever a fresh
        // frame is available. (Image clips: skip — their cache was populated
        // once at load time and never changes.)
        if (m.el && m.el.readyState >= 2 && m.cacheCtx) {
          const vw = m.el.videoWidth || m.cache.width;
          const vh = m.el.videoHeight || m.cache.height;
          if (vw && vh && (m.cache.width !== vw || m.cache.height !== vh)) {
            m.cache.width = vw;
            m.cache.height = vh;
          }
          try {
            m.cacheCtx.drawImage(m.el, 0, 0, m.cache.width, m.cache.height);
            m.cacheValid = true;
          } catch {}
        }
        if (m.cacheValid) {
          const vw = m.cache.width || a.width || W;
          const vh = m.cache.height || a.height || H;
          const baseScale = Math.min(W / vw, H / vh);
          // User transform multiplies the fit-to-canvas scale.
          const userScale = c.transformScale ?? 1;
          const totalScale = baseScale * userScale;
          const dw = vw * totalScale;
          const dh = vh * totalScale;
          const dx = (W - dw) / 2 + (c.transformX ?? 0);
          const dy = (H - dh) / 2 + (c.transformY ?? 0);
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha * (c.transformOpacity ?? 1)));
          // Color correction via canvas filter — fast, GPU-accelerated where
          // available. Map our fields to the closest CSS filter primitives.
          const br = c.brightness ?? 0;
          const co = c.contrast ?? 1;
          const sa = c.saturation ?? 1;
          // CSS brightness: 1 = original, 0 = black, 2 = double
          const cssBrightness = 1 + br;
          const filterStr = `brightness(${cssBrightness.toFixed(3)}) contrast(${co.toFixed(3)}) saturate(${sa.toFixed(3)})`;
          ctx.filter = filterStr;
          const rot = c.transformRotation ?? 0;
          if (rot !== 0) {
            ctx.save();
            ctx.translate(dx + dw / 2, dy + dh / 2);
            ctx.rotate((rot * Math.PI) / 180);
            try {
              ctx.drawImage(m.cache, -dw / 2, -dh / 2, dw, dh);
            } catch {}
            ctx.restore();
          } else {
            try {
              ctx.drawImage(m.cache, dx, dy, dw, dh);
            } catch {}
          }
          ctx.filter = 'none';
        }
        ctx.globalAlpha = 1;
      } else if (head >= visualEnd && head < audioEnd && isPlaying && m.el) {
        // Visual region ended but audio tail is still playing — keep the
        // <video> element rolling so its audio output continues. Don't draw
        // anything new (lower tracks may be drawn in their own iterations).
        try {
          if (m.el.paused) {
            m.el.muted = true;
            m.el.play().catch(() => {});
          }
        } catch {}
      } else if (m.el) {
        if (!m.el.paused) m.el.pause();
      }
    }
  }

  // Audio handling: route playback for audio-only or non-active video clips
  // For MVP we only emit audio from active clips, using HTMLMediaElement volume
  const audioTracks = tracks.filter((t) => t.kind === 'audio');
  for (const t of audioTracks) {
    const duckLevel = t.autoDuckLevel ?? 1;
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const m = media.get(c.id);
      if (!m || !m.el) continue; // image clips have no <video> / no audio
      const a = assets[c.assetId];
      if (!a) continue;
      const speed = c.speed ?? 1;
      const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const visualEnd = c.start + displayDur;
      const tailCap = Math.max(0, (a.duration - c.outPoint) / Math.max(0.01, speed));
      const tail = Math.min(c.audioTail ?? 0, tailCap);
      const audioEnd = visualEnd + tail;
      if (head >= c.start && head < audioEnd) {
        const localTime = c.inPoint + (head - c.start) * speed;
        if (isPlaying) {
          const rate = Math.max(0.0625, Math.min(16, speed));
          if (m.el.playbackRate !== rate) m.el.playbackRate = rate;
          if (Math.abs(m.el.currentTime - localTime) > 0.2) m.el.currentTime = localTime;
          const ducker = duckLevel < 1 && hasOtherActiveAudio(tracks, clips, assets, t.id, head);
          let vol = c.volume * (t.volume ?? 1) * masterVolume * (ducker ? duckLevel : 1);
          if (c.fadeIn > 0 && head - c.start < c.fadeIn) vol *= (head - c.start) / c.fadeIn;
          // Combined fade-out: covers both fadeOut (within visible region)
          // and audioTail (post-visible) as ONE continuous ramp from full
          // to silence so there's no audible step at the cut.
          const fadeStart = visualEnd - c.fadeOut;
          const fadeRange = c.fadeOut + tail;
          if (fadeRange > 0.001 && head >= fadeStart && head < audioEnd) {
            vol *= Math.max(0, (audioEnd - head) / fadeRange);
          }
          if (t.muted || c.muted) vol = 0;
          m.el.volume = Math.max(0, Math.min(1, vol));
          m.el.muted = vol === 0;
          if (m.el.paused) m.el.play().catch(() => {});
        } else {
          if (!m.el.paused) m.el.pause();
        }
      } else {
        if (!m.el.paused) m.el.pause();
      }
    }
  }

  // Also apply audio volume from active VIDEO clips (their <video> elements
  // also produce audio); rate already set in the visual loop above.
  for (const t of videoTracks) {
    const duckLevel = t.autoDuckLevel ?? 1;
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const m = media.get(c.id);
      if (!m || !m.el) continue; // image clips have no audio
      const a = assets[c.assetId];
      if (!a) continue;
      const speed = c.speed ?? 1;
      const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const visualEnd = c.start + displayDur;
      const tailCap = Math.max(0, (a.duration - c.outPoint) / Math.max(0.01, speed));
      const tail = Math.min(c.audioTail ?? 0, tailCap);
      const audioEnd = visualEnd + tail;
      if (head >= c.start && head < audioEnd && isPlaying) {
        const ducker = duckLevel < 1 && hasOtherActiveAudio(tracks, clips, assets, t.id, head);
        let vol = c.volume * (t.volume ?? 1) * masterVolume * (ducker ? duckLevel : 1);
        if (c.fadeIn > 0 && head - c.start < c.fadeIn) vol *= (head - c.start) / c.fadeIn;
        const fadeStart = visualEnd - c.fadeOut;
        const fadeRange = c.fadeOut + tail;
        if (fadeRange > 0.001 && head >= fadeStart && head < audioEnd) {
          vol *= Math.max(0, (audioEnd - head) / fadeRange);
        }
        if (t.muted || c.muted) vol = 0;
        m.el.volume = Math.max(0, Math.min(1, vol));
        m.el.muted = vol === 0;
      }
    }
  }
}
