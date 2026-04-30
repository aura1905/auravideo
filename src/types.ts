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
  thumbnail?: string; // dataURL
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
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  height: number;
  muted: boolean;
  hidden: boolean;
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
