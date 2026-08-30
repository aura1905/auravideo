export type TrackKind = 'video' | 'audio';

/** Layer blend modes. Names are the FFmpeg `blend=all_mode=` names; the canvas
 * preview maps them onto the matching `globalCompositeOperation`. */
export type BlendMode =
  | 'normal'
  | 'screen'
  | 'addition'
  | 'multiply'
  | 'overlay'
  | 'softlight'
  | 'lighten'
  | 'darken';

/** Canvas `globalCompositeOperation` for each blend mode. */
export const BLEND_CANVAS: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  screen: 'screen',
  addition: 'lighter',
  multiply: 'multiply',
  overlay: 'overlay',
  softlight: 'soft-light',
  lighten: 'lighten',
  darken: 'darken',
};

/** The colour that leaves the layers below untouched for each mode. Used to
 * pad / fade / extend a blend layer so the area outside the clip is inert. */
export const BLEND_NEUTRAL: Record<BlendMode, string> = {
  normal: 'black@0',
  screen: 'black',
  addition: 'black',
  lighten: 'black',
  multiply: 'white',
  darken: 'white',
  overlay: 'gray',
  softlight: 'gray',
};

export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: '표준',
  screen: '스크린',
  addition: '더하기',
  multiply: '곱하기',
  overlay: '오버레이',
  softlight: '소프트라이트',
  lighten: '밝게',
  darken: '어둡게',
};

/**
 * How a clip fills a canvas whose aspect ratio differs from the source.
 *
 * This exists for LED walls: broadcast backdrops are commonly 32:9
 * (3840x1080, 2048x576, 2560x720) while generated or shot source is 16:9, so
 * "just scale it" is never the whole answer.
 *
 * - `fit`     letterbox/pillarbox, preserving aspect (the historical default)
 * - `cover`   scale to fill, cropping the overflow — keeps geometry honest
 * - `stretch` scale each axis independently, distorting to fill
 * - `mirror`  fit, then fill the sides with a mirrored copy of the edges
 * - `blur`    fit, then fill the sides with a blurred, scaled-up copy
 */
export type FillMode = 'fit' | 'cover' | 'stretch' | 'mirror' | 'blur';

export const FILL_LABELS: Record<FillMode, string> = {
  fit: '맞춤 (여백)',
  cover: '채우기 (잘림)',
  stretch: '늘리기 (왜곡)',
  mirror: '거울 확장',
  blur: '블러 확장',
};

/** One musical section from the librosa analysis. */
export interface BeatSegment {
  index: number;
  start: number;
  end: number;
  label?: string;
  energyLevel?: string;
}

/**
 * Musical grid for the project, imported from the librosa analysis JSON that
 * `led_stage/scripts/analyze_music.py` produces. Cuts in a music-show backdrop
 * have to land on beats, so the editor needs to know where they are.
 */
export interface BeatGrid {
  bpm: number;
  barSeconds: number;
  /** Every beat, in seconds. */
  beats: number[];
  /** Bar starts (every 4th beat in 4/4). */
  downbeats: number[];
  segments: BeatSegment[];
  /** Offset applied to every time above, so the grid can be nudged to match a
   *  clip that doesn't start at 0. */
  offset: number;
}

/**
 * A layer painted by the editor instead of loaded from disk: a solid colour,
 * a linear gradient, or a radial falloff. These exist because a music-show
 * backdrop is assembled from *plates plus light* — a beat flash, a section
 * grading wash, a mask that keeps the centre of the wall dark so the members
 * stand out. All three are one solid rectangle away, and requiring the user
 * (or an agent) to go make a PNG in another program to get them is the thing
 * that stopped the timeline from being buildable by script.
 *
 * A generator asset is materialised as a real PNG `File` at creation time, so
 * every existing path — preview cache, export input, project zip, autosave —
 * handles it as an ordinary image with no special-casing. `spec` is kept so
 * the layer can be repainted when its colours or the canvas size change.
 */
export type GeneratorType = 'solid' | 'linear' | 'radial';

export interface GeneratorSpec {
  type: GeneratorType;
  /** Primary colour, `#rgb`/`#rrggbb`. For `radial` this is the centre. */
  color: string;
  /** Linear: the far end of the ramp. Radial: the outer edge (default transparent). */
  color2?: string;
  /** Linear only: ramp direction in degrees. 0 = left→right, 90 = top→bottom. */
  angle?: number;
  /** Radial only: fraction of the half-diagonal that stays fully `color`. */
  innerRadius?: number;
  /** Radial only: fraction of the half-diagonal where the falloff ends. */
  outerRadius?: number;
  /** Radial only: swap the stops, giving a vignette (clear centre, tinted edges). */
  invert?: boolean;
  /** Uniform alpha multiplier baked into the PNG, 0..1 (default 1). */
  opacity?: number;
}

export const GENERATOR_LABELS: Record<GeneratorType, string> = {
  solid: '단색',
  linear: '그라데이션',
  radial: '방사형 / 마스크',
};

/**
 * Periodic opacity envelope — the beat accent.
 *
 * A backdrop is synced to music on two different time scales, and they need
 * different tools. Structure (sections, 8-bar phrases) is expressed by CUTS;
 * rhythm (beats, downbeats) must NOT be, because a wall that re-cuts every
 * 0.5 s reads as an advert, not as stage lighting. Rhythm is expressed by
 * *modulating* a layer that stays on screen — which is what this is.
 *
 * `E(t) = min + (max-min) · max(0, 1 - ((t - phase) mod period) / decay)`
 *
 * One period, one attack-decay ramp. `period` comes straight from the beat
 * grid (a beat, or `barSeconds` for downbeat accents) and `phase` is an
 * absolute timeline second, so the envelope is anchored to the SONG, not to
 * the clip — trimming or moving the clip does not slide the accents off the
 * beat.
 *
 * Preview multiplies it into `globalAlpha`; export builds the same curve as a
 * tiny greyscale source and merges it into the layer. See `utils/generators.ts`.
 */
export interface PulseEnvelope {
  /** Seconds between pulses. */
  period: number;
  /** Timeline seconds of one pulse peak; the grid extends from here. */
  phase: number;
  /** Seconds to fall from `max` to `min`. Clamped to `period`. */
  decay: number;
  /** Opacity multiplier between pulses, 0..1. */
  min: number;
  /** Opacity multiplier at the peak, 0..1. */
  max: number;
}

export interface MediaAsset {
  id: string;
  name: string;
  url: string; // object URL
  file: File;
  duration: number; // seconds (for images: a generous nominal — the clip
                     //  itself is what defines visible duration on the timeline)
  width?: number;
  height?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  isImage?: boolean; // true for PNG/JPG/etc — rendered as a still frame
  thumbnail?: string; // dataURL — single representative frame
  // Multi-frame strip: one dataURL every `thumbnailStripStep` source seconds,
  // generated lazily so long clips show a filmstrip instead of a single frame.
  thumbnailStrip?: string[];
  thumbnailStripStep?: number;
  // Mono audio peaks: a Float32Array of [min0, max0, min1, max1, ...]
  // packed pairs covering the full duration, ~200 buckets per second target.
  // Generated lazily after the asset is added to the library.
  waveform?: number[];
  waveformPeaksPerSecond?: number;
  /** Set when this asset was painted by the editor rather than imported.
   *  The PNG in `file` is the render of this spec at `width`x`height`. */
  generator?: GeneratorSpec;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  // position on timeline (seconds)
  start: number;
  // in/out within the source media (seconds)
  inPoint: number;
  outPoint: number;
  // effects
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  volume: number; // 0..2 (1 = original)
  muted: boolean;
  // playback speed multiplier (1 = normal, >1 = fast, <1 = slow). The clip's
  // visible duration on the timeline is (outPoint - inPoint) / speed.
  speed: number;
  // Optional user-assigned color label (CSS color), for visual organization.
  color?: string;
  // L-cut tail: audio plays for `audioTail` extra timeline-seconds past the
  // visual end with an automatic fade-out, so background sound rings out
  // naturally over the next visual cut. Source media must have material to
  // cover the tail (clamped at asset duration). Default 0 = no tail.
  audioTail: number;
  // Visual transform applied during compositing. All defaults make the clip
  // fill the canvas with original aspect ratio (current behavior unchanged).
  transformX: number;       // px offset from canvas center, default 0
  transformY: number;       // px offset from canvas center, default 0
  transformScale: number;   // 1 = fit-to-canvas (current default), <1 shrinks
  transformRotation: number; // degrees, default 0
  transformOpacity: number; // 0..1, default 1
  // Layer blend mode. 'normal' = alpha-over (default, previous behavior).
  // The others composite this clip against everything below it, which is how
  // a grading / glow / texture layer is stacked on top of a base plate.
  // Preview maps these to canvas `globalCompositeOperation`; export maps them
  // to FFmpeg `blend=all_mode=…`. Undefined = 'normal'.
  blendMode?: BlendMode;
  // Glow / bloom. The clip's bright areas are isolated, blurred, and screened
  // back over itself — the look every LED wall content has. Applied to the
  // SOURCE, before colour correction, so grading affects the glow too.
  // 0 = off (default).
  glow?: number;        // 0..1 intensity
  glowRadius?: number;  // blur radius in canvas px, default 24
  // How to reconcile the source's aspect ratio with the canvas. Undefined =
  // 'fit', which is the behaviour every existing project already has.
  fillMode?: FillMode;
  // Color correction (FFmpeg eq filter compatible)
  brightness: number;  // -1..1, default 0 (additive)
  contrast: number;    // 0..2, default 1 (multiplicative around 0.5)
  saturation: number;  // 0..3, default 1
  gamma: number;       // 0.1..10, default 1
  // Audio mastering, applied only at export (preview leaves audio raw):
  // - normalizeLoudness: FFmpeg `loudnorm=I=-14:TP=-1.5:LRA=11`, single-pass.
  //   Sits BEFORE the clip's volume multiplier so user-set volume still scales.
  // - denoise: FFmpeg `arnndn=m=…rnnn` using a bundled BSD-licensed RNN model.
  //   Sits BEFORE loudnorm so noise is removed before the level is targeted.
  // Both default off (undefined = off).
  normalizeLoudness?: boolean;
  denoise?: boolean;
  // Beat accent. Multiplies `transformOpacity` with a periodic ramp anchored
  // to absolute timeline time, so accents stay on the song's grid no matter
  // how the clip is trimmed or moved. Undefined = steady (previous behaviour).
  pulse?: PulseEnvelope;
}

export interface Marker {
  id: string;
  time: number;
  text: string;
  color: string;
}

/** Text overlay (subtitle/title) — independent from clips, lives on a single
 * dedicated subtitle track that always renders on top of all video tracks. */
export interface Subtitle {
  id: string;
  text: string;
  start: number;       // timeline seconds
  duration: number;    // timeline seconds
  fontSize: number;    // px (relative to project canvas height — scales in preview)
  color: string;       // CSS color
  x: number;           // px offset from canvas center
  y: number;           // px offset from canvas center
  align: 'left' | 'center' | 'right';
  fadeIn: number;
  fadeOut: number;
  bold: boolean;
  italic: boolean;
  // Optional black outline thickness for legibility against any background.
  // 0 = no outline.
  outline: number;
  // CSS font-family. Default 'sans-serif'. Stored as a CSS font-family string
  // so users can pick from a curated list or type their own.
  fontFamily: string;
  // Background box behind the text. Empty/falsy = no box.
  bgColor: string;
  bgOpacity: number;      // 0..1
  bgPadding: number;      // px around the text
  bgWidth: 'text' | 'full'; // text-fitted vs. full-canvas-width (lower-third)
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  height: number;
  muted: boolean;
  hidden: boolean;
  volume: number; // 0..2 (1 = original)
  // Auto-ducking level. When < 1, this track's effective volume is multiplied
  // by `autoDuckLevel` whenever any other track has audio playing at the
  // current time (typical use: a BGM track auto-quiets while narration
  // is active). 1 = no ducking (default).
  autoDuckLevel: number;
  // Whether to render audio waveforms on this track's clips. Default true.
  // Useful to declutter video tracks or hide waveforms on a noisy track.
  waveformVisible?: boolean;
  // Solo flag. When ANY track has solo=true, only soloed tracks produce
  // audio in preview + export — non-soloed tracks are silenced regardless
  // of their own `muted` state. When no track is soloed, this flag has no
  // effect and normal mute rules apply.
  solo?: boolean;
}

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  duration: number; // computed
}

export interface EditorSelection {
  clipIds: string[];
}
