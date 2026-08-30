/** Assemble a music-synced LED backdrop from plates + the beat grid.
 *
 * This is the piece that turns "I have some generated footage and a librosa
 * analysis" into a finished timeline without a human placing clips. It is
 * deliberately a **rule engine, not a guesser**: every decision below is a
 * number in `BackdropOptions` that can be read, tuned and re-run. Art
 * direction (which plate belongs to which section) stays with the caller —
 * that judgement is the one thing automation has consistently got wrong here.
 *
 * The design principle, learned the hard way on the first attempt:
 *
 *   Structure (sections, 8-bar phrases) is expressed with CUTS.
 *   Rhythm (beats, downbeats) is expressed with LIGHT, never with cuts.
 *
 * A wall that re-cuts every half second reads as an advert. A wall that never
 * acknowledges the beat reads as a screensaver. So sections get clips, and
 * beats get a pulsing accent layer that sits on top of whatever is playing.
 *
 * Layer stack (top track = front, matching the editor's z-order):
 *
 *   V1  centre mask   — keeps the middle of the wall dark; members stand there
 *   V2  accents       — beat pulse, downbeat pulse, transition flashes
 *   V3  plates        — the generated footage, one run per section
 *   A1  BGM
 */
import { useEditor, newClipId } from '../state/editorStore';
import type { BeatGrid, Clip, FillMode, MediaAsset, Track } from '../types';
import { createGeneratorAsset } from './generators';

export type BackdropProgress = { phase: string; progress: number };

export interface BackdropOptions {
  /** Plates in play order. Assigned to sections round-robin unless
   *  `plateBySection` overrides. A plate shorter than its section is looped. */
  plateAssetIds: string[];
  /** Explicit section→plate assignment, by section index. */
  plateBySection?: Record<number, string>;
  /** Audio asset placed on the first audio track at `startAt`. */
  bgmAssetId?: string;
  /** Where cuts are allowed. `section` follows the analysis' own boundaries;
   *  `phrase` cuts every `phraseBars` bars regardless. */
  cutUnit: 'section' | 'phrase';
  phraseBars: number;
  /** How plates reconcile their aspect with the (usually much wider) canvas. */
  fillMode: FillMode;
  /** Crossfade length in BARS at a section boundary, by what the energy does
   *  across it. `rise: 0` means a hard cut — which is what an energy lift
   *  wants, because the cut itself is the accent. */
  transitionBars: { rise: number; same: number; fall: number };
  /** White (or coloured) flash dropped on the accent track at a hard cut. */
  flash: { enabled: boolean; color: string; level: number; bars: number };
  /** The pulsing accent layer. Levels are peak opacity, 0 disables that layer. */
  accent: {
    enabled: boolean;
    color: string;
    /** Peak opacity of the every-beat pulse at full song energy. */
    beatLevel: number;
    /** Peak opacity of the every-bar (downbeat) pulse at full song energy. */
    downbeatLevel: number;
    /** Decay time as a fraction of one beat. */
    decayBeats: number;
  };
  /** The centre mask. Radii are fractions of the canvas half-diagonal. */
  centerMask: {
    enabled: boolean;
    color: string;
    innerRadius: number;
    outerRadius: number;
    opacity: number;
  };
  /** Timeline second the song starts at. */
  startAt: number;
  /** Crossfade used when looping one plate to fill a long section (seconds). */
  loopCrossfade: number;
}

export const BACKDROP_DEFAULTS: BackdropOptions = {
  plateAssetIds: [],
  cutUnit: 'section',
  phraseBars: 8,
  // LED walls are ultra-wide and the source rarely is; `cover` keeps the
  // geometry honest and crops, which is preferable to letterboxing a wall.
  fillMode: 'cover',
  transitionBars: { rise: 0, same: 1, fall: 2 },
  flash: { enabled: true, color: '#ffffff', level: 0.5, bars: 1 },
  accent: {
    enabled: true,
    color: '#ffffff',
    // Conservative on purpose: the wall is lighting, and 80% of it is hidden
    // behind set, beams and dancers. A pulse you notice on a monitor is
    // usually far too strong on stage.
    beatLevel: 0.12,
    downbeatLevel: 0.28,
    decayBeats: 0.35,
  },
  centerMask: {
    enabled: true,
    color: '#000000',
    innerRadius: 0.0,
    outerRadius: 0.62,
    opacity: 0.55,
  },
  startAt: 0,
  loopCrossfade: 0.4,
};

export interface BackdropSectionInfo {
  index: number;
  start: number;
  end: number;
  bars: number;
  energy: number;
  plateAssetId: string | null;
  transitionIn: 'cut' | 'crossfade' | 'none';
}

export interface BackdropResult {
  sections: BackdropSectionInfo[];
  plateClips: number;
  accentClips: number;
  flashes: number;
  duration: number;
  bpm: number;
}

/**
 * Energy as a 0..1 number.
 *
 * The numeric field wins when present. The analysis' coarse label is close to
 * useless on real material — the first song came back with 10 of its 11
 * sections marked `mid`, which would flatten every transition rule to the same
 * branch — while the raw number still separates a breakdown from a hook.
 */
function energyOf(sg: { energy?: number; energyLevel?: string }): number {
  if (typeof sg.energy === 'number' && Number.isFinite(sg.energy)) {
    return Math.max(0, Math.min(1, sg.energy));
  }
  return energyOfLabel(sg.energyLevel);
}

function energyOfLabel(level?: string): number {
  switch ((level ?? '').toLowerCase()) {
    case 'low':
    case 'quiet':
      return 0.25;
    case 'high':
    case 'peak':
      return 1;
    case 'mid':
    case 'medium':
      return 0.6;
    default: {
      const n = Number(level);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.6;
    }
  }
}

/** Median gap between beats — more robust than 60/bpm when the analysis
 *  rounded its tempo, and it degrades gracefully if beats are sparse. */
function beatPeriodOf(grid: BeatGrid): number {
  const b = grid.beats;
  if (b.length < 3) return grid.barSeconds > 0 ? grid.barSeconds / 4 : 0.5;
  const gaps: number[] = [];
  for (let i = 1; i < b.length; i++) gaps.push(b[i] - b[i - 1]);
  gaps.sort((x, y) => x - y);
  return gaps[Math.floor(gaps.length / 2)] || 0.5;
}

/** The sections to cut on, in timeline seconds (grid offset already applied). */
function buildSections(grid: BeatGrid, opts: BackdropOptions): BackdropSectionInfo[] {
  const off = (grid.offset ?? 0) + opts.startAt;
  const out: BackdropSectionInfo[] = [];

  if (opts.cutUnit === 'section' && grid.segments.length > 0) {
    grid.segments.forEach((sg, i) => {
      out.push({
        index: i,
        start: sg.start + off,
        end: sg.end + off,
        bars: grid.barSeconds > 0 ? (sg.end - sg.start) / grid.barSeconds : 0,
        energy: energyOf(sg),
        plateAssetId: null,
        transitionIn: 'none',
      });
    });
  } else {
    // Phrase grid: every Nth downbeat. Anchored to the song, not to the first
    // section, so an 8-bar phrase is the song's 8 bars.
    const step = Math.max(1, Math.round(opts.phraseBars));
    const dbs = grid.downbeats.length > 1 ? grid.downbeats : grid.beats;
    for (let i = 0; i < dbs.length - 1; i += step) {
      const start = dbs[i];
      const end = dbs[Math.min(i + step, dbs.length - 1)];
      if (end - start < 0.1) continue;
      out.push({
        index: out.length,
        start: start + off,
        end: end + off,
        bars: grid.barSeconds > 0 ? (end - start) / grid.barSeconds : 0,
        energy: 0.6,
        plateAssetId: null,
        transitionIn: 'none',
      });
    }
    // Carry the analysis' energy onto phrase sections when it has segments.
    if (grid.segments.length) {
      for (const s of out) {
        const mid = s.start - off + (s.end - s.start) / 2;
        const sg = grid.segments.find((g) => mid >= g.start && mid < g.end);
        if (sg) s.energy = energyOf(sg);
      }
    }
  }
  return out;
}

/** Tint a section's clip by energy so the timeline is readable at a glance. */
function energyColor(e: number): string {
  if (e >= 0.85) return '#e0524a';
  if (e >= 0.55) return '#d9a13b';
  return '#3f7fbf';
}

function baseClip(assetId: string, trackId: string, start: number, len: number): Clip {
  return {
    id: newClipId(),
    assetId,
    trackId,
    start,
    inPoint: 0,
    outPoint: len,
    fadeIn: 0,
    fadeOut: 0,
    volume: 1,
    muted: false,
    speed: 1,
    audioTail: 0,
    transformX: 0,
    transformY: 0,
    transformScale: 1,
    transformRotation: 0,
    transformOpacity: 1,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    gamma: 1,
  };
}

/** Make sure `count` video tracks exist and return them top-first. */
function ensureVideoTracks(count: number): Track[] {
  const st = useEditor.getState();
  let vids = st.tracks.filter((t) => t.kind === 'video');
  while (vids.length < count) {
    useEditor.getState().addTrack('video');
    vids = useEditor.getState().tracks.filter((t) => t.kind === 'video');
  }
  return vids;
}

/**
 * Build the whole backdrop. Existing clips are left alone — the caller decides
 * whether to `project.reset` first — so this can also be run onto a timeline
 * that already holds a rough cut.
 */
export async function assembleMusicBackdrop(
  opts: BackdropOptions,
  onProgress?: (p: BackdropProgress) => void
): Promise<BackdropResult> {
  const st0 = useEditor.getState();
  const grid = st0.beatGrid;
  if (!grid) throw new Error('비트 그리드가 없습니다. 먼저 음악 분석 JSON을 불러오세요 (beatgrid.load).');
  if (opts.plateAssetIds.length === 0) throw new Error('플레이트로 쓸 자산이 없습니다.');

  const report = (phase: string, progress: number) => onProgress?.({ phase, progress });
  report('구간 계산', -1);

  const sections = buildSections(grid, opts);
  if (sections.length === 0) throw new Error('비트 그리드에서 구간을 만들 수 없습니다.');

  // Absolute energy thresholds do not survive contact with real audio: a song
  // captured off a broadcast sits in a narrow band (measured: 0.156–0.494
  // across a whole track) because compression and crowd noise flatten the
  // dynamics. So rank the sections against EACH OTHER — the rules then mean
  // "louder than this song's average", which is what a cut pattern should
  // follow. If the song really is flat, everything lands mid and the rules
  // degrade to uniform crossfades rather than firing at random.
  {
    const es = sections.map((s) => s.energy);
    const lo = Math.min(...es);
    const hi = Math.max(...es);
    const span = hi - lo;
    for (const s of sections) s.energy = span > 0.05 ? (s.energy - lo) / span : 0.5;
  }

  const beatPeriod = beatPeriodOf(grid);
  const barSeconds = grid.barSeconds > 0 ? grid.barSeconds : beatPeriod * 4;
  const offAbs = (grid.offset ?? 0) + opts.startAt;
  // Phase for the pulse envelopes: an absolute timeline second where a
  // downbeat lands. Anchoring to the song (not to a clip) is what keeps the
  // accents on the beat when clips are later trimmed or moved by hand.
  const downbeatPhase = (grid.downbeats[0] ?? grid.beats[0] ?? 0) + offAbs;
  const beatPhase = (grid.beats[0] ?? 0) + offAbs;

  // Layers, front to back.
  const tracks = ensureVideoTracks(3);
  const maskTrack = tracks[0];
  const accentTrack = tracks[1];
  const plateTrack = tracks[2];

  const assets = useEditor.getState().assets;
  const plates = opts.plateAssetIds.filter((id) => assets[id]);
  if (plates.length === 0) throw new Error('플레이트 자산을 찾을 수 없습니다.');

  // --- transitions -------------------------------------------------------
  // Decided per boundary from what the energy does across it. A lift gets a
  // hard cut (the cut IS the accent); a drop gets a long dissolve; a flat
  // boundary gets one bar.
  const plateFor = (i: number) => opts.plateBySection?.[i] ?? plates[i % plates.length];
  const xfade: number[] = sections.map((s, i) => {
    if (i === 0) return 0;
    const d = s.energy - sections[i - 1].energy;
    const bars =
      d > 0.1 ? opts.transitionBars.rise : d < -0.1 ? opts.transitionBars.fall : opts.transitionBars.same;
    let x = Math.max(0, bars) * barSeconds;
    // A dissolve can only be as long as the material on both sides of it.
    // Sections are looped from plates that are often much shorter than the
    // section, so cap the fade at half the shorter plate (and a quarter of the
    // shorter section) — otherwise the planned overlap and the fade lengths
    // disagree and the join goes lumpy instead of smooth.
    const allAssets = useEditor.getState().assets;
    for (const idx of [i - 1, i]) {
      const a = allAssets[plateFor(idx)];
      if (a && !a.isImage) x = Math.min(x, a.duration / 2);
      const sec = sections[idx];
      x = Math.min(x, (sec.end - sec.start) / 4);
    }
    return x;
  });

  /**
   * How one section gets tiled by its plate, for a given set of transitions.
   *
   * Repeats are EQUAL length rather than "full chunks plus a remainder": a
   * stub at the end of a section would be shorter than the dissolve that has
   * to cross it, so the dissolve would be clipped and the join would land in
   * the wrong place. Equal chunks make the last one end exactly on the
   * boundary — no overshoot past a hard cut, and always enough material.
   */
  const planSection = (i: number, x: number[]) => {
    const sec = sections[i];
    const a = useEditor.getState().assets[plateFor(i)];
    const need = Math.max(0.1, sec.end - sec.start + (x[i] ?? 0) / 2 + (x[i + 1] ?? 0) / 2);
    const srcDur = Math.max(0.2, a?.duration ?? need);
    const chunkMax = a?.isImage ? need : Math.min(srcDur, need);
    const loopX = a?.isImage ? 0 : Math.min(opts.loopCrossfade, chunkMax / 4);
    const n = Math.max(1, Math.ceil((need - loopX) / Math.max(0.05, chunkMax - loopX)));
    return { n, loopX, len: (need + (n - 1) * loopX) / n, need };
  };

  // A crossfade is an OVERLAP and a pair of fades, and the two have to be the
  // same number or the join goes lumpy — a fade shorter than its overlap shows
  // the underlying clip pop. The overlap is set here, but the fade is capped
  // at half a clip, and how long a clip is depends on the overlap… so solve
  // the fixed point instead of guessing: shrink, re-plan, repeat. It converges
  // downward in two or three passes; four is free insurance.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < sections.length; i++) {
      if (xfade[i] <= 0) continue;
      const prev = planSection(i - 1, xfade).len;
      const cur = planSection(i, xfade).len;
      xfade[i] = Math.min(xfade[i], prev / 2, cur / 2);
    }
  }

  report('플레이트 배치', 0.1);
  let plateClips = 0;
  let flashes = 0;

  sections.forEach((sec, i) => {
    const assetId = plateFor(i);
    const a: MediaAsset | undefined = useEditor.getState().assets[assetId];
    if (!a) return;
    sec.plateAssetId = assetId;
    sec.transitionIn = i === 0 ? 'none' : xfade[i] > 0.001 ? 'crossfade' : 'cut';

    // Crossfades are centred on the boundary: the outgoing clip runs half a
    // fade past it and the incoming one starts half a fade early, so the
    // midpoint of the dissolve lands exactly on the downbeat.
    const inX = xfade[i];
    const outX = i + 1 < sections.length ? xfade[i + 1] : 0;
    const start = sec.start - inX / 2;
    const end = sec.end + outX / 2;

    // A plate shorter than its section is looped: generate one loop-safe
    // 8-bar plate, let it repeat, and spend render time only on the sections
    // that actually change.
    const { n, loopX, len } = planSection(i, xfade);
    for (let k = 0; k < n; k++) {
      const t = start + k * (len - loopX);
      const clip = baseClip(assetId, plateTrack.id, t, len);
      clip.fillMode = opts.fillMode;
      clip.color = energyColor(sec.energy);
      // Fades: the section-boundary crossfade on the outer edges, the loop
      // crossfade on the inner joins. Both are capped at half the clip so the
      // emitted fade is the one that was planned — the export clamps to
      // displayDur/2 too, and a fade that gets clamped there no longer matches
      // the overlap it was paired with.
      const cap = len / 2;
      clip.fadeIn = Math.min(k === 0 ? inX : loopX, cap);
      clip.fadeOut = Math.min(k === n - 1 ? outX : loopX, cap);
      useEditor.getState().addClip(clip);
      plateClips++;
    }

    // Hard cut into a lift: put a flash on the accent track at the boundary.
    if (i > 0 && sec.transitionIn === 'cut' && opts.flash.enabled && opts.flash.level > 0.001) {
      sec.transitionIn = 'cut';
      flashes++;
    }
  });

  // --- generated layers ---------------------------------------------------
  report('생성 레이어', 0.6);
  const settings = useEditor.getState().settings;
  let accentClips = 0;

  if (opts.accent.enabled || (opts.flash.enabled && flashes > 0)) {
    const accentAsset = await createGeneratorAsset(
      { type: 'solid', color: opts.accent.color },
      settings.width,
      settings.height,
      '액센트'
    );
    useEditor.getState().addAsset(accentAsset);

    if (opts.accent.enabled) {
      for (const sec of sections) {
        const len = sec.end - sec.start;
        if (len < 0.05) continue;
        // Two envelopes: every beat (fine grain) and every bar (the accent an
        // audience actually reads). Both scale with the section's energy, so a
        // verse breathes and a hook drives without any per-section authoring.
        const mk = (period: number, phase: number, level: number, name: string) => {
          const peak = level * sec.energy;
          if (peak < 0.005) return;
          const clip = baseClip(accentAsset.id, accentTrack.id, sec.start, len);
          clip.blendMode = 'screen';
          clip.fillMode = 'stretch';
          clip.transformOpacity = 1;
          clip.color = '#8a6ad0';
          clip.pulse = {
            period,
            phase,
            decay: Math.max(0.02, opts.accent.decayBeats * beatPeriod),
            min: 0,
            max: Math.min(1, peak),
          };
          void name;
          useEditor.getState().addClip(clip);
          accentClips++;
        };
        mk(beatPeriod, beatPhase, opts.accent.beatLevel, 'beat');
        mk(barSeconds, downbeatPhase, opts.accent.downbeatLevel, 'bar');
      }
    }

    if (opts.flash.enabled) {
      sections.forEach((sec, i) => {
        if (i === 0 || sec.transitionIn !== 'cut' || opts.flash.level <= 0.001) return;
        const len = Math.max(0.1, opts.flash.bars * barSeconds);
        const clip = baseClip(accentAsset.id, accentTrack.id, sec.start, len);
        clip.blendMode = 'screen';
        clip.fillMode = 'stretch';
        // A single decay from the cut, expressed as a pulse whose period is
        // the clip itself — NOT as `fadeOut = len`. The export clamps a fade
        // to half the clip and the preview does not, so a full-length fade is
        // the one shape where the two renderers disagree. The pulse envelope
        // is evaluated identically by both.
        clip.transformOpacity = 1;
        clip.pulse = {
          period: len,
          phase: sec.start,
          decay: len,
          min: 0,
          max: Math.min(1, opts.flash.level * (0.5 + sec.energy / 2)),
        };
        clip.color = '#c8b4ff';
        useEditor.getState().addClip(clip);
        accentClips++;
      });
    }
  }

  const songStart = sections[0].start;
  const songEnd = sections[sections.length - 1].end;

  if (opts.centerMask.enabled && opts.centerMask.opacity > 0.001) {
    // The one composition rule of a music-show wall: the members stand centre
    // and low, so the centre of the picture must stay dark. Prompting for it
    // does not work (it was tried); masking it does, and it stays adjustable
    // right up to rehearsal.
    const maskAsset = await createGeneratorAsset(
      {
        type: 'radial',
        color: opts.centerMask.color,
        innerRadius: opts.centerMask.innerRadius,
        outerRadius: opts.centerMask.outerRadius,
        opacity: opts.centerMask.opacity,
      },
      settings.width,
      settings.height,
      '중앙 마스크'
    );
    useEditor.getState().addAsset(maskAsset);
    const clip = baseClip(maskAsset.id, maskTrack.id, songStart, Math.max(0.1, songEnd - songStart));
    clip.fillMode = 'stretch';
    clip.color = '#555';
    useEditor.getState().addClip(clip);
  }

  if (opts.bgmAssetId) {
    const bgm = useEditor.getState().assets[opts.bgmAssetId];
    const audioTrack = useEditor.getState().tracks.find((t) => t.kind === 'audio');
    if (bgm && audioTrack) {
      const clip = baseClip(bgm.id, audioTrack.id, opts.startAt, bgm.duration);
      useEditor.getState().addClip(clip);
    }
  }

  report('완료', 1);
  return {
    sections,
    plateClips,
    accentClips,
    flashes,
    duration: songEnd - songStart,
    bpm: grid.bpm,
  };
}
