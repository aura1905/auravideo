import { create, useStore } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import type { Clip, MediaAsset, ProjectSettings, Track } from '../types';

interface EditorState {
  assets: Record<string, MediaAsset>;
  tracks: Track[]; // ordered top → bottom
  clips: Record<string, Clip>;
  settings: ProjectSettings;
  // playback
  playhead: number; // seconds
  isPlaying: boolean;
  // ui
  pixelsPerSecond: number;
  selection: string[];
  snapEnabled: boolean;
  snapInterval: number; // seconds

  // actions
  addAsset: (a: MediaAsset) => void;
  removeAsset: (id: string) => void;

  addTrack: (kind: Track['kind']) => string;
  removeTrack: (id: string) => void;
  toggleTrackMute: (id: string) => void;
  toggleTrackHidden: (id: string) => void;

  addClip: (clip: Clip) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  splitClipAt: (clipId: string, time: number) => void;
  detachAudio: (clipId: string) => void;

  setPlayhead: (t: number) => void;
  setPlaying: (b: boolean) => void;
  setZoom: (pps: number) => void;

  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string, additive: boolean) => void;

  setSettings: (s: Partial<ProjectSettings>) => void;
  setSnapEnabled: (b: boolean) => void;
  setSnapInterval: (s: number) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultTracks: Track[] = [
  { id: 'v1', kind: 'video', name: 'V1', height: 64, muted: false, hidden: false },
  { id: 'v2', kind: 'video', name: 'V2', height: 64, muted: false, hidden: false },
  { id: 'v3', kind: 'video', name: 'V3', height: 64, muted: false, hidden: false },
  { id: 'a1', kind: 'audio', name: 'A1', height: 56, muted: false, hidden: false },
  { id: 'a2', kind: 'audio', name: 'A2', height: 56, muted: false, hidden: false },
  { id: 'a3', kind: 'audio', name: 'A3', height: 56, muted: false, hidden: false },
];

// Debounce state used by the temporal handleSet hook below. Shared with
// clearHistory() so project loads can cancel a pending burst push.
let pendingPushTimer: number | undefined;
let pendingPushState: any = null;

export const useEditor = create<EditorState>()(
  temporal(
    (set, get) => ({
  assets: {},
  tracks: defaultTracks,
  clips: {},
  settings: { width: 1920, height: 1080, fps: 30, duration: 60 },
  playhead: 0,
  isPlaying: false,
  pixelsPerSecond: 80,
  selection: [],
  snapEnabled: true,
  snapInterval: 0.5,

  addAsset: (a) => set((s) => ({ assets: { ...s.assets, [a.id]: a } })),
  removeAsset: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.assets;
      const remainingClips: Record<string, Clip> = {};
      for (const c of Object.values(s.clips)) {
        if (c.assetId !== id) remainingClips[c.id] = c;
      }
      return { assets: rest, clips: remainingClips };
    }),

  addTrack: (kind) => {
    const id = uid();
    const sameKind = get().tracks.filter((t) => t.kind === kind);
    const name = `${kind === 'video' ? 'V' : 'A'}${sameKind.length + 1}`;
    set((s) => ({
      tracks: [...s.tracks, { id, kind, name, height: kind === 'video' ? 64 : 56, muted: false, hidden: false }],
    }));
    return id;
  },
  removeTrack: (id) =>
    set((s) => {
      const remaining: Record<string, Clip> = {};
      for (const c of Object.values(s.clips)) {
        if (c.trackId !== id) remaining[c.id] = c;
      }
      return { tracks: s.tracks.filter((t) => t.id !== id), clips: remaining };
    }),
  toggleTrackMute: (id) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)) })),
  toggleTrackHidden: (id) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, hidden: !t.hidden } : t)) })),

  addClip: (clip) => set((s) => ({ clips: { ...s.clips, [clip.id]: clip } })),
  updateClip: (id, patch) =>
    set((s) => {
      const c = s.clips[id];
      if (!c) return s;
      return { clips: { ...s.clips, [id]: { ...c, ...patch } } };
    }),
  removeClip: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.clips;
      return { clips: rest, selection: s.selection.filter((x) => x !== id) };
    }),
  splitClipAt: (clipId, time) => {
    const s = get();
    const c = s.clips[clipId];
    if (!c) return;
    const speed = c.speed ?? 1;
    const localTimelineOffset = time - c.start;
    const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
    if (localTimelineOffset <= 0.05 || localTimelineOffset >= displayDur - 0.05) return;
    // Convert timeline offset into source-media offset.
    const mediaOffset = localTimelineOffset * speed;
    const left: Clip = {
      ...c,
      outPoint: c.inPoint + mediaOffset,
      fadeOut: 0,
    };
    const right: Clip = {
      ...c,
      id: uid(),
      start: c.start + localTimelineOffset,
      inPoint: c.inPoint + mediaOffset,
      fadeIn: 0,
    };
    set((st) => ({ clips: { ...st.clips, [left.id]: left, [right.id]: right } }));
  },
  detachAudio: (clipId) => {
    const s = get();
    const c = s.clips[clipId];
    if (!c) return;
    const a = s.assets[c.assetId];
    if (!a || !a.hasAudio) return;
    // Find the first non-hidden audio track or create one.
    let audioTrack = s.tracks.find((t) => t.kind === 'audio');
    if (!audioTrack) {
      const id = uid();
      const newTrack: Track = { id, kind: 'audio', name: 'A1', height: 56, muted: false, hidden: false };
      set((st) => ({ tracks: [...st.tracks, newTrack] }));
      audioTrack = newTrack;
    }
    const newClip: Clip = { ...c, id: uid(), trackId: audioTrack.id };
    set((st) => ({
      clips: { ...st.clips, [newClip.id]: newClip, [c.id]: { ...c, muted: true } },
    }));
  },

  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (b) => set({ isPlaying: b }),
  setZoom: (pps) => set({ pixelsPerSecond: Math.max(10, Math.min(400, pps)) }),

  setSelection: (ids) => set({ selection: ids }),
  toggleSelection: (id, additive) =>
    set((s) => {
      if (!additive) return { selection: [id] };
      return s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id] };
    }),

  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  setSnapEnabled: (b) => set({ snapEnabled: b }),
  setSnapInterval: (n) => set({ snapInterval: Math.max(0.01, n) }),
    }),
    {
      // Only track edit-meaningful state. UI state (playhead, isPlaying,
      // selection, zoom, snap toggles) is excluded so undo doesn't bounce
      // around when scrubbing.
      partialize: (state) => ({
        tracks: state.tracks,
        clips: state.clips,
        settings: state.settings,
        assets: state.assets,
      }),
      // Coalesce rapid changes (drags, scrubbing-while-trimming) into one
      // undo step. The FIRST past-state in a burst is what we eventually push,
      // so undo restores the state from before the drag started, not just
      // before the very last micro-update.
      handleSet: (handleSet) => (state) => {
        if (pendingPushTimer === undefined) {
          pendingPushState = state;
        }
        if (pendingPushTimer !== undefined) window.clearTimeout(pendingPushTimer);
        pendingPushTimer = window.setTimeout(() => {
          handleSet(pendingPushState);
          pendingPushTimer = undefined;
          pendingPushState = null;
        }, 200);
      },
      limit: 100,
    }
  )
);

// Hook for components that need to react to undo/redo availability.
type Tracked = Pick<EditorState, 'tracks' | 'clips' | 'settings' | 'assets'>;
export function useTemporal<T>(selector: (s: TemporalState<Tracked>) => T) {
  return useStore(useEditor.temporal as any, selector as (state: unknown) => T);
}

export function undo() {
  (useEditor.temporal.getState() as TemporalState<Tracked>).undo();
}
export function redo() {
  (useEditor.temporal.getState() as TemporalState<Tracked>).redo();
}
export function clearHistory() {
  // Cancel any pending burst push so it doesn't repopulate history right after.
  if (pendingPushTimer !== undefined) {
    window.clearTimeout(pendingPushTimer);
    pendingPushTimer = undefined;
    pendingPushState = null;
  }
  (useEditor.temporal.getState() as TemporalState<Tracked>).clear();
}

/** Visible duration of a clip on the timeline, after speed scaling.
 * (Source media duration is `outPoint - inPoint`; at speed S it occupies
 * `(outPoint - inPoint) / S` seconds of timeline.) */
export function clipDisplayDur(c: Clip): number {
  const speed = c.speed ?? 1;
  return (c.outPoint - c.inPoint) / Math.max(0.01, speed);
}

export function snapTime(t: number): number {
  const s = useEditor.getState();
  if (!s.snapEnabled) return t;
  const step = s.snapInterval;
  if (step <= 0) return t;
  return Math.round(t / step) * step;
}

export function projectDuration(state: EditorState): number {
  let max = 0;
  for (const c of Object.values(state.clips)) {
    const end = c.start + clipDisplayDur(c);
    if (end > max) max = end;
  }
  return Math.max(max, 5); // minimum visible
}

export const newClipId = uid;
