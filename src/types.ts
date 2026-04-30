export type TrackKind = 'video' | 'audio';

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
  // Color correction (FFmpeg eq filter compatible)
  brightness: number;  // -1..1, default 0 (additive)
  contrast: number;    // 0..2, default 1 (multiplicative around 0.5)
  saturation: number;  // 0..3, default 1
  gamma: number;       // 0.1..10, default 1
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
