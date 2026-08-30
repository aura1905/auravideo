/**
 * Frontend half of the agent control bridge.
 *
 * Commands arrive as `agent://request` events from the Rust bridge and are
 * applied through the ordinary store actions — the same ones the UI calls — so
 * an automated edit and a hand edit go down identical code paths. The reply
 * goes back via the `agent_reply` command.
 *
 * Only active in the desktop build, and only when the Rust side actually opened
 * the bridge (which requires NABIVIDEO_AGENT=1).
 */
import { useEditor, newClipId, projectDuration, clipDisplayDur } from '../state/editorStore';
import type { BeatGrid, BlendMode, Clip, FillMode, GeneratorSpec, PulseEnvelope, Subtitle } from '../types';
import { loadMediaFile, generateWaveform } from './media';
import { createGeneratorAsset } from './generators';
import { assembleMusicBackdrop, BACKDROP_DEFAULTS, type BackdropOptions } from './musicBackdrop';
import { ensurePreviewable } from './proxy';
import { isNative, readFileAsFile, tempRoot } from './native';
import { exportProjectNative } from './exportNative';

type Args = Record<string, any>;

/**
 * The optional look fields, pulled off a command's args in one place.
 *
 * `clip.add` and `clip.update` both accept them, so an agent can place a
 * pulsing screen-blended accent layer in a single call instead of an add
 * followed by a patch. Anything absent is left alone rather than reset —
 * these are patches, not full states.
 */
function visualPatch(a: Args): Partial<Clip> {
  const p: Partial<Clip> = {};
  const num = (k: keyof Clip, v: any) => {
    if (typeof v === 'number' && Number.isFinite(v)) (p as any)[k] = v;
  };
  num('transformX', a.transformX);
  num('transformY', a.transformY);
  num('transformScale', a.transformScale);
  num('transformRotation', a.transformRotation);
  num('transformOpacity', a.transformOpacity);
  num('brightness', a.brightness);
  num('contrast', a.contrast);
  num('saturation', a.saturation);
  num('gamma', a.gamma);
  num('glow', a.glow);
  num('glowRadius', a.glowRadius);
  if (typeof a.blendMode === 'string') p.blendMode = a.blendMode as BlendMode;
  if (typeof a.fillMode === 'string') p.fillMode = a.fillMode as FillMode;
  if (typeof a.color === 'string') p.color = a.color;
  if (a.pulse === null) p.pulse = undefined;
  else if (a.pulse && typeof a.pulse === 'object') {
    const q = a.pulse as Partial<PulseEnvelope>;
    p.pulse = {
      period: Number(q.period ?? 0.5),
      phase: Number(q.phase ?? 0),
      decay: Number(q.decay ?? 0.18),
      min: Number(q.min ?? 0),
      max: Number(q.max ?? 1),
    };
  }
  return p;
}

function summary() {
  const s = useEditor.getState();
  return {
    settings: s.settings,
    playhead: s.playhead,
    duration: projectDuration(s),
    tracks: s.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      muted: t.muted,
      hidden: t.hidden,
      volume: t.volume,
      solo: !!t.solo,
    })),
    assets: Object.values(s.assets).map((a) => ({
      id: a.id,
      name: a.name,
      duration: a.duration,
      width: a.width,
      height: a.height,
      hasAudio: a.hasAudio,
      hasVideo: a.hasVideo,
      isImage: a.isImage,
    })),
    clips: Object.values(s.clips).map((c) => ({
      id: c.id,
      assetId: c.assetId,
      trackId: c.trackId,
      start: c.start,
      inPoint: c.inPoint,
      outPoint: c.outPoint,
      displayDur: clipDisplayDur(c),
      speed: c.speed,
      volume: c.volume,
      muted: c.muted,
      fadeIn: c.fadeIn,
      fadeOut: c.fadeOut,
      blendMode: c.blendMode,
      glow: c.glow,
    })),
    subtitles: Object.values(s.subtitles).map((x) => ({
      id: x.id,
      text: x.text,
      start: x.start,
      duration: x.duration,
    })),
  };
}

/** Give the RAF loop time to paint the current playhead, including any video
 *  seek it triggered. There is no reliable "canvas has settled" signal, so the
 *  wait is a configurable delay. */
function settle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function previewCanvas(): HTMLCanvasElement {
  const c = document.querySelector<HTMLCanvasElement>('.preview-stage canvas');
  if (!c) throw new Error('프리뷰 캔버스를 찾지 못했습니다');
  return c;
}

async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  await writeFile(path, bytes);
}

function joinPath(dir: string, leaf: string): string {
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir}${sep}${leaf}`;
}

const handlers: Record<string, (a: Args) => Promise<any> | any> = {
  ping: () => ({ ok: true, native: isNative() }),

  state: () => summary(),

  'project.reset': () => {
    useEditor.getState().resetProject();
    return { ok: true };
  },

  /** Set canvas size / fps. Width and height are rounded up to even numbers
   *  because x264 rejects odd dimensions. */
  'settings.set': (a: Args) => {
    const patch: Args = {};
    if (typeof a.width === 'number') patch.width = Math.ceil(a.width / 2) * 2;
    if (typeof a.height === 'number') patch.height = Math.ceil(a.height / 2) * 2;
    if (typeof a.fps === 'number') patch.fps = a.fps;
    if (typeof a.duration === 'number') patch.duration = a.duration;
    useEditor.getState().setSettings(patch);
    return { settings: useEditor.getState().settings };
  },

  /** Import media by absolute path, the same way the desktop file picker does. */
  'media.import': async (a: Args) => {
    const paths: string[] = a.paths ?? [];
    const out: any[] = [];
    for (const p of paths) {
      const original = await readFileAsFile(p);
      // ensurePreviewable keeps transparency intact — an RMBG'd element must
      // not lose its alpha on the way to the preview.
      const { file: working } = await ensurePreviewable(original);
      const asset = await loadMediaFile(working);
      useEditor.getState().addAsset(asset);
      const wf = await generateWaveform(working, 100).catch(() => null);
      if (wf) {
        const cur = useEditor.getState().assets[asset.id];
        if (cur) {
          useEditor.setState({
            assets: {
              ...useEditor.getState().assets,
              [asset.id]: {
                ...cur,
                waveform: wf.peaks,
                waveformPeaksPerSecond: wf.peaksPerSecond,
              },
            },
          });
        }
      }
      out.push({
        id: asset.id,
        name: asset.name,
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
        hasAudio: asset.hasAudio,
        hasVideo: asset.hasVideo,
        isImage: asset.isImage,
      });
    }
    return { assets: out };
  },

  'clip.add': (a: Args) => {
    const s = useEditor.getState();
    const asset = s.assets[a.assetId];
    if (!asset) throw new Error(`알 수 없는 assetId: ${a.assetId}`);
    const trackId: string | undefined =
      a.trackId ?? s.tracks.find((t) => t.kind === (asset.hasVideo ? 'video' : 'audio'))?.id;
    if (!trackId) throw new Error('사용할 트랙이 없습니다');
    const clip: Clip = {
      id: newClipId(),
      assetId: asset.id,
      trackId,
      start: a.start ?? 0,
      inPoint: a.inPoint ?? 0,
      outPoint: a.outPoint ?? (asset.isImage ? Math.min(5, asset.duration) : asset.duration),
      fadeIn: a.fadeIn ?? 0,
      fadeOut: a.fadeOut ?? 0,
      volume: a.volume ?? 1,
      muted: a.muted ?? false,
      speed: a.speed ?? 1,
      audioTail: a.audioTail ?? 0,
      transformX: 0,
      transformY: 0,
      transformScale: 1,
      transformRotation: 0,
      transformOpacity: 1,
      brightness: 0,
      contrast: 1,
      saturation: 1,
      gamma: 1,
      ...visualPatch(a),
    };
    useEditor.getState().addClip(clip);
    return { id: clip.id };
  },

  'clip.update': (a: Args) => {
    useEditor.getState().updateClip(a.id, { ...visualPatch(a), ...(a.patch ?? {}) });
    return { ok: true, clip: useEditor.getState().clips[a.id] ?? null };
  },

  /**
   * Paint a generated layer (solid / gradient / radial) and add it to the
   * library. Defaults to the project canvas size, which is what a full-bleed
   * wash or a centre mask wants; pass width/height for anything else.
   *
   * This is the piece that lets a timeline be built entirely by script: beat
   * flashes, section grading washes and the mask that keeps the middle of the
   * wall dark are all one of these plus a blend mode.
   */
  'generator.add': async (a: Args) => {
    const s = useEditor.getState();
    const spec: GeneratorSpec = {
      type: (a.type as GeneratorSpec['type']) ?? 'solid',
      color: a.color ?? '#ffffff',
      color2: a.color2,
      angle: a.angle,
      innerRadius: a.innerRadius,
      outerRadius: a.outerRadius,
      invert: a.invert,
      opacity: a.opacity,
    };
    const asset = await createGeneratorAsset(
      spec,
      a.width ?? s.settings.width,
      a.height ?? s.settings.height,
      a.name
    );
    useEditor.getState().addAsset(asset);
    return { id: asset.id, name: asset.name, width: asset.width, height: asset.height };
  },

  'clip.split': (a: Args) => {
    const before = new Set(Object.keys(useEditor.getState().clips));
    useEditor.getState().splitClipAt(a.id, a.time);
    const after = Object.keys(useEditor.getState().clips);
    return { ok: true, newClipIds: after.filter((id) => !before.has(id)) };
  },

  'clip.remove': (a: Args) => {
    useEditor.getState().removeClip(a.id);
    return { ok: true };
  },

  'subtitle.add': (a: Args) => {
    const id = useEditor
      .getState()
      .addSubtitle({ ...a, start: a.start ?? 0 } as Partial<Subtitle> & { start: number });
    return { id };
  },

  'subtitle.update': (a: Args) => {
    useEditor.getState().updateSubtitle(a.id, a.patch ?? {});
    return { ok: true };
  },

  /**
   * Load the musical grid produced by `led_stage/scripts/analyze_music.py`.
   * Accepts that file's JSON shape directly so no conversion step is needed.
   */
  'beatgrid.load': (a: Args) => {
    const j = a.analysis ?? a;
    const grid: BeatGrid = {
      bpm: Number(j.bpm) || 120,
      barSeconds: Number(j.bar_seconds ?? j.barSeconds) || 240 / (Number(j.bpm) || 120),
      beats: (j.beat_grid ?? j.beats ?? []).map(Number),
      downbeats: (j.downbeats ?? []).map(Number),
      segments: (j.segments ?? []).map((sg: any, i: number) => ({
        index: Number(sg.index ?? i + 1),
        start: Number(sg.start) || 0,
        end: Number(sg.end) || 0,
        label: sg.label ?? sg.name,
        energyLevel: sg.energy_level ?? sg.energyLevel,
        energy: typeof (sg.energy ?? sg.rms) === 'number' ? Number(sg.energy ?? sg.rms) : undefined,
      })),
      offset: Number(a.offset ?? 0),
    };
    useEditor.getState().setBeatGrid(grid);
    return {
      bpm: grid.bpm,
      beats: grid.beats.length,
      downbeats: grid.downbeats.length,
      segments: grid.segments.length,
    };
  },

  'beatgrid.clear': () => {
    useEditor.getState().setBeatGrid(null);
    return { ok: true };
  },

  /**
   * Cut a clip on the musical grid. `every` counts downbeats (bars) by
   * default, or beats when `unit` is "beat" — the two things a music-show
   * backdrop actually cuts on.
   */
  'clip.cutOnBeats': (a: Args) => {
    const s = useEditor.getState();
    const grid = s.beatGrid;
    if (!grid) throw new Error('비트 그리드가 없습니다 (beatgrid.load 먼저)');
    const src = a.unit === 'beat' ? grid.beats : grid.downbeats;
    const every = Math.max(1, Math.round(a.every ?? 1));
    const off = grid.offset ?? 0;
    const clip = s.clips[a.id];
    if (!clip) throw new Error(`알 수 없는 clipId: ${a.id}`);
    const from = clip.start;
    const to = clip.start + clipDisplayDur(clip);
    // Collect the cut points first: splitting renews ids as it goes, so the
    // list has to be computed against the clip as it is now.
    const points = src
      .map((t: number) => t + off)
      .filter((t: number, i: number) => i % every === 0 && t > from + 0.05 && t < to - 0.05)
      .sort((x: number, y: number) => x - y);
    let cur = a.id;
    const made: string[] = [];
    for (const t of points) {
      const before = new Set(Object.keys(useEditor.getState().clips));
      useEditor.getState().splitClipAt(cur, t);
      const after = Object.keys(useEditor.getState().clips);
      const fresh = after.filter((id) => !before.has(id));
      if (fresh.length === 0) break;
      made.push(...fresh);
      cur = fresh[fresh.length - 1]; // keep cutting the right-hand remainder
    }
    return { cuts: points.length, newClipIds: made };
  },

  /**
   * Build a whole music-synced backdrop in one call: plates cut onto the
   * section grid, beat/downbeat accent layers, transition flashes and the
   * centre mask. Every rule is an option — see `musicBackdrop.ts` — and the
   * defaults are the LED-wall ones, so the minimum call is just the plate
   * list.
   *
   * Requires a beat grid (`beatgrid.load`) and returns the section table it
   * decided on, so the caller can inspect the edit without a screenshot.
   */
  'music.assemble': async (a: Args) => {
    const d = BACKDROP_DEFAULTS;
    const opts: BackdropOptions = {
      ...d,
      ...a,
      transitionBars: { ...d.transitionBars, ...(a.transitionBars ?? {}) },
      flash: { ...d.flash, ...(a.flash ?? {}) },
      accent: { ...d.accent, ...(a.accent ?? {}) },
      centerMask: { ...d.centerMask, ...(a.centerMask ?? {}) },
      plateAssetIds: a.plateAssetIds ?? [],
    };
    const res = await assembleMusicBackdrop(opts);
    return res;
  },

  'playhead.set': (a: Args) => {
    useEditor.getState().setPlayhead(a.t ?? 0);
    return { ok: true, playhead: useEditor.getState().playhead };
  },

  /**
   * Seek, then capture what the preview is actually showing. This is how an
   * agent "looks at" its edit: the PNG is the same composite the export
   * produces, minus the export-only audio work.
   */
  screenshot: async (a: Args) => {
    if (typeof a.t === 'number') useEditor.getState().setPlayhead(a.t);
    await settle(a.settleMs ?? 900);
    const canvas = previewCanvas();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/png'));
    if (!blob) throw new Error('캔버스 캡처 실패');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const path: string = a.path ?? joinPath(await tempRoot(), `shot-${Date.now()}.png`);
    await writeBytes(path, bytes);
    return { path, width: canvas.width, height: canvas.height, bytes: bytes.length };
  },

  export: async (a: Args) => {
    const s = useEditor.getState();
    const dur = projectDuration(s);
    return await exportProjectNative(
      {
        clips: Object.values(s.clips),
        assets: s.assets,
        tracks: s.tracks,
        settings: s.settings,
        duration: dur,
        masterVolume: s.masterVolume,
        subtitles: Object.values(s.subtitles),
        rangeStart: a.rangeStart ?? 0,
        rangeEnd: a.rangeEnd ?? dur,
        loopBlend: a.loopBlend,
        quality: a.quality,
      },
      () => {},
      { outPath: a.outPath, encoder: a.encoder, jobId: `agent-${Date.now()}` }
    );
  },
};

export async function installAgentBridge(): Promise<void> {
  if (!isNative()) return;
  const { listen } = await import('@tauri-apps/api/event');
  const { invoke } = await import('@tauri-apps/api/core');
  await listen<{ id: string; cmd: string; args: Args }>('agent://request', async (e) => {
    const { id, cmd, args } = e.payload;
    let result: any;
    try {
      const h = handlers[cmd];
      if (!h) throw new Error(`알 수 없는 명령: ${cmd}`);
      result = { ok: true, data: await h(args ?? {}) };
    } catch (err: any) {
      result = { ok: false, error: err?.message ?? String(err) };
    }
    try {
      await invoke('agent_reply', { id, result });
    } catch (err) {
      console.error('[agent] reply failed', err);
    }
  });
  console.log('[agent] bridge installed');
}
