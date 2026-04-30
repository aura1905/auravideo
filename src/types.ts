export type TrackKind = 'video' | 'audio';

export interface MediaAsset {
  id: string;
  name: string;
  url: string; // object URL
  file: File;
  duration: number; // seconds
  width?: number;
  height?: number;
  hasVideo: boolean;
  hasAudio: boolean;
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
}

export interface Marker {
  id: string;
  time: number;
  text: string;
  color: string;
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
