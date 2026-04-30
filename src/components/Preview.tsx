import { useEffect, useMemo, useRef } from 'react';
import { useEditor, projectDuration } from '../state/editorStore';
import type { Clip } from '../types';
import { formatTime } from '../utils/media';

interface ClipMediaState {
  el: HTMLVideoElement;
  ready: boolean;
  // Per-clip frame cache. We blit the last-known good frame here whenever the
  // video reports readyState >= HAVE_CURRENT_DATA. The main canvas always reads
  // from the cache, so a video being mid-seek can no longer cause a higher
  // track to "disappear" and reveal a lower track underneath.
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
        st.el.pause();
        st.el.removeAttribute('src');
        st.el.load();
      } catch {}
      st.el.remove();
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
      const currentSrc = map.get(id)!.el.currentSrc || map.get(id)!.el.src;
      if (!a || currentSrc !== expectedSrc) {
        removeEntry(id);
      }
    }

    // add media for new clips
    for (const c of Object.values(clips)) {
      if (map.has(c.id)) continue;
      const a = assets[c.assetId];
      if (!a) continue;
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
      const cache = document.createElement('canvas');
      cache.width = a.width || 320;
      cache.height = a.height || 180;
      const cacheCtx = cache.getContext('2d');
      const state: ClipMediaState = {
        el: v,
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
        if (!m.el.paused) m.el.pause();
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
      const end = c.start + displayDur;
      const m = media.get(c.id);
      if (!m) continue;
      const a = assets[c.assetId];
      if (!a || !a.hasVideo) continue;

      if (head >= c.start && head < end) {
        // Map timeline position to source-media time taking speed into account.
        const localTime = c.inPoint + (head - c.start) * speed;
        try {
          // Browsers clamp playbackRate to ~[0.0625, 16]; mirror that.
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
        // alpha (fade)
        let alpha = 1;
        if (c.fadeIn > 0 && head - c.start < c.fadeIn) {
          alpha *= (head - c.start) / c.fadeIn;
        }
        if (c.fadeOut > 0 && end - head < c.fadeOut) {
          alpha *= (end - head) / c.fadeOut;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        // Refresh the per-clip cache from the live video whenever a fresh
        // frame is available. This keeps a "last known good frame" around so
        // a higher track stays on top even while its source is mid-seek.
        if (m.el.readyState >= 2 && m.cacheCtx) {
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
          const scale = Math.min(W / vw, H / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          const dx = (W - dw) / 2;
          const dy = (H - dh) / 2;
          try {
            ctx.drawImage(m.cache, dx, dy, dw, dh);
          } catch {}
        }
        ctx.globalAlpha = 1;
      } else {
        if (!m.el.paused) m.el.pause();
      }
    }
  }

  // Audio handling: route playback for audio-only or non-active video clips
  // For MVP we only emit audio from active clips, using HTMLMediaElement volume
  const audioTracks = tracks.filter((t) => t.kind === 'audio');
  for (const t of audioTracks) {
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const m = media.get(c.id);
      if (!m) continue;
      const a = assets[c.assetId];
      if (!a) continue;
      const speed = c.speed ?? 1;
      const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const end = c.start + displayDur;
      if (head >= c.start && head < end) {
        const localTime = c.inPoint + (head - c.start) * speed;
        if (isPlaying) {
          const rate = Math.max(0.0625, Math.min(16, speed));
          if (m.el.playbackRate !== rate) m.el.playbackRate = rate;
          if (Math.abs(m.el.currentTime - localTime) > 0.2) m.el.currentTime = localTime;
          let vol = c.volume * (t.volume ?? 1) * masterVolume;
          if (c.fadeIn > 0 && head - c.start < c.fadeIn) vol *= (head - c.start) / c.fadeIn;
          if (c.fadeOut > 0 && end - head < c.fadeOut) vol *= (end - head) / c.fadeOut;
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
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const m = media.get(c.id);
      if (!m) continue;
      const speed = c.speed ?? 1;
      const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const end = c.start + displayDur;
      if (head >= c.start && head < end && isPlaying) {
        let vol = c.volume * (t.volume ?? 1) * masterVolume;
        if (c.fadeIn > 0 && head - c.start < c.fadeIn) vol *= (head - c.start) / c.fadeIn;
        if (c.fadeOut > 0 && end - head < c.fadeOut) vol *= (end - head) / c.fadeOut;
        if (t.muted || c.muted) vol = 0;
        m.el.volume = Math.max(0, Math.min(1, vol));
        m.el.muted = vol === 0;
      }
    }
  }
}
