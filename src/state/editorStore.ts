import { create, useStore } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import type { Clip, MediaAsset, Marker, ProjectSettings, Subtitle, Track } from '../types';

interface EditorState {
  assets: Record<string, MediaAsset>;
  tracks: Track[]; // ordered top → bottom
  clips: Record<string, Clip>;
  settings: ProjectSettings;
  trackLocked: Record<string, boolean>; // by track id
  clipGroups: Record<string, string[]>; // groupId -> [clipId, ...]
  clipGroupId: Record<string, string>; // clipId -> groupId
  markers: Marker[];
  subtitles: Record<string, Subtitle>;
  subtitleSelection: string[];
  // playback
  playhead: number; // seconds
  isPlaying: boolean;
  // ui
  pixelsPerSecond: number;
  selection: string[];
  snapEnabled: boolean;
  snapInterval: number; // seconds
  masterVolume: number; // 0..2 (1 = original)
  rippleEnabled: boolean;

  // actions
  addAsset: (a: MediaAsset) => void;
  removeAsset: (id: string) => void;

  addTrack: (kind: Track['kind']) => string;
  removeTrack: (id: string) => void;
  toggleTrackMute: (id: string) => void;
  toggleTrackHidden: (id: string) => void;
  setTrackVolume: (id: string, vol: number) => void;
  setTrackHeight: (id: string, height: number) => void;
  toggleTrackLock: (id: string) => void;
  setTrackDuckLevel: (id: string, level: number) => void;

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
  setMasterVolume: (v: number) => void;
  setRippleEnabled: (b: boolean) => void;
  rippleDelete: (clipId: string) => void;
  groupClips: (clipIds: string[]) => void;
  ungroupClip: (clipId: string) => void;
  setClipColor: (clipId: string, color?: string) => void;
  addMarker: (m: Omit<Marker, 'id'>) => void;
  updateMarker: (id: string, patch: Partial<Marker>) => void;
  removeMarker: (id: string) => void;
  addSubtitle: (s: Partial<Subtitle> & { start: number }) => string;
  updateSubtitle: (id: string, patch: Partial<Subtitle>) => void;
  removeSubtitle: (id: string) => void;
  setSubtitleSelection: (ids: string[]) => void;
  toggleSubtitleSelection: (id: string, additive: boolean) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultTracks: Track[] = [
  { id: 'v1', kind: 'video', name: 'V1', height: 64, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 },
  { id: 'v2', kind: 'video', name: 'V2', height: 64, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 },
  { id: 'v3', kind: 'video', name: 'V3', height: 64, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 },
  { id: 'a1', kind: 'audio', name: 'A1', height: 56, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 },
  { id: 'a2', kind: 'audio', name: 'A2', height: 56, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 },
  { id: 'a3', kind: 'audio', name: 'A3', height: 56, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 },
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
  trackLocked: {},
  clipGroups: {},
  clipGroupId: {},
  markers: [],
  subtitles: {},
  subtitleSelection: [],
  playhead: 0,
  isPlaying: false,
  pixelsPerSecond: 80,
  selection: [],
  snapEnabled: true,
  snapInterval: 0.5,
  masterVolume: 1,
  rippleEnabled: false,

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
      tracks: [
        ...s.tracks,
        { id, kind, name, height: kind === 'video' ? 64 : 56, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 },
      ],
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
  setTrackVolume: (id, vol) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, volume: Math.max(0, Math.min(2, vol)) } : t
      ),
    })),
  setTrackHeight: (id, height) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, height: Math.max(28, Math.min(200, height)) } : t)),
    })),
  toggleTrackLock: (id) =>
    set((s) => ({ trackLocked: { ...s.trackLocked, [id]: !s.trackLocked[id] } })),
  setTrackDuckLevel: (id, level) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, autoDuckLevel: Math.max(0, Math.min(1, level)) } : t
      ),
    })),

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
    let audioTrack = s.tracks.find((t) => t.kind === 'audio');
    if (!audioTrack) {
      const id = uid();
      const newTrack: Track = { id, kind: 'audio', name: 'A1', height: 56, muted: false, hidden: false, volume: 1, autoDuckLevel: 1 };
      set((st) => ({ tracks: [...st.tracks, newTrack] }));
      audioTrack = newTrack;
    }
    const newClipId = uid();
    const newClip: Clip = { ...c, id: newClipId, trackId: audioTrack.id };
    set((st) => ({
      clips: { ...st.clips, [newClip.id]: newClip, [c.id]: { ...c, muted: true } },
    }));
    // Auto-group the original video clip with its detached audio clip so
    // they continue to move together unless the user un-groups them.
    get().groupClips([clipId, newClipId]);
  },

  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (b) => set({ isPlaying: b }),
  setZoom: (pps) => set({ pixelsPerSecond: Math.max(10, Math.min(400, pps)) }),

  setSelection: (ids) => set({ selection: ids, subtitleSelection: [] }),
  toggleSelection: (id, additive) =>
    set((s) => {
      if (!additive) return { selection: [id], subtitleSelection: [] };
      return s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id], subtitleSelection: [] };
    }),

  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  setSnapEnabled: (b) => set({ snapEnabled: b }),
  setSnapInterval: (n) => set({ snapInterval: Math.max(0.01, n) }),
  setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(2, v)) }),
  setRippleEnabled: (b) => set({ rippleEnabled: b }),
  rippleDelete: (clipId) => {
    const s = get();
    const c = s.clips[clipId];
    if (!c) return;
    const speed = c.speed ?? 1;
    const removedDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
    const removedStart = c.start;
    set((st) => {
      const { [clipId]: _, ...rest } = st.clips;
      // Pull every clip on the same track that starts after the removed one
      // earlier by the removed clip's display duration.
      const updated: Record<string, Clip> = {};
      for (const [id, cl] of Object.entries(rest)) {
        if (cl.trackId === c.trackId && cl.start > removedStart) {
          updated[id] = { ...cl, start: Math.max(0, cl.start - removedDur) };
        } else {
          updated[id] = cl;
        }
      }
      return { clips: updated, selection: st.selection.filter((x) => x !== clipId) };
    });
  },
  groupClips: (clipIds) => {
    if (clipIds.length < 2) return;
    const gid = uid();
    set((s) => {
      // remove these clips from any prior groups first
      const groups = { ...s.clipGroups };
      const idMap = { ...s.clipGroupId };
      for (const cid of clipIds) {
        const old = idMap[cid];
        if (old && groups[old]) {
          groups[old] = groups[old].filter((x) => x !== cid);
          if (groups[old].length < 2) delete groups[old];
        }
      }
      groups[gid] = [...clipIds];
      for (const cid of clipIds) idMap[cid] = gid;
      return { clipGroups: groups, clipGroupId: idMap };
    });
  },
  ungroupClip: (clipId) => {
    set((s) => {
      const gid = s.clipGroupId[clipId];
      if (!gid) return s;
      const groups = { ...s.clipGroups };
      const remaining = (groups[gid] ?? []).filter((x) => x !== clipId);
      if (remaining.length < 2) {
        // group dissolves
        delete groups[gid];
        const idMap = { ...s.clipGroupId };
        for (const cid of s.clipGroups[gid] ?? []) delete idMap[cid];
        return { clipGroups: groups, clipGroupId: idMap };
      }
      groups[gid] = remaining;
      const idMap = { ...s.clipGroupId };
      delete idMap[clipId];
      return { clipGroups: groups, clipGroupId: idMap };
    });
  },
  setClipColor: (clipId, color) =>
    set((s) => {
      const c = s.clips[clipId];
      if (!c) return s;
      return { clips: { ...s.clips, [clipId]: { ...c, color } } };
    }),
  addMarker: (m) =>
    set((s) => ({ markers: [...s.markers, { ...m, id: uid() }].sort((a, b) => a.time - b.time) })),
  updateMarker: (id, patch) =>
    set((s) => ({
      markers: s.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)).sort((a, b) => a.time - b.time),
    })),
  removeMarker: (id) => set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),
  addSubtitle: (s) => {
    const id = uid();
    const settings = get().settings;
    const sub: Subtitle = {
      id,
      text: s.text ?? '자막',
      start: Math.max(0, s.start),
      duration: s.duration ?? 3,
      fontSize: s.fontSize ?? Math.max(24, Math.round(settings.height / 18)),
      color: s.color ?? '#ffffff',
      x: s.x ?? 0,
      y: s.y ?? Math.round(settings.height * 0.35),
      align: s.align ?? 'center',
      fadeIn: s.fadeIn ?? 0,
      fadeOut: s.fadeOut ?? 0,
      bold: s.bold ?? false,
      italic: s.italic ?? false,
      outline: s.outline ?? 2,
      fontFamily: s.fontFamily ?? 'sans-serif',
      bgColor: s.bgColor ?? '',
      bgOpacity: s.bgOpacity ?? 0.65,
      bgPadding: s.bgPadding ?? 12,
      bgWidth: s.bgWidth ?? 'text',
    };
    set((st) => ({ subtitles: { ...st.subtitles, [id]: sub } }));
    return id;
  },
  updateSubtitle: (id, patch) =>
    set((st) => {
      const cur = st.subtitles[id];
      if (!cur) return st;
      return { subtitles: { ...st.subtitles, [id]: { ...cur, ...patch } } };
    }),
  removeSubtitle: (id) =>
    set((st) => {
      const { [id]: _, ...rest } = st.subtitles;
      return { subtitles: rest, subtitleSelection: st.subtitleSelection.filter((x) => x !== id) };
    }),
  setSubtitleSelection: (ids) => set({ subtitleSelection: ids, selection: [] }),
  toggleSubtitleSelection: (id, additive) =>
    set((s) => {
      // selecting a subtitle clears clip selection (mutually exclusive panels)
      if (!additive) return { subtitleSelection: [id], selection: [] };
      return s.subtitleSelection.includes(id)
        ? { subtitleSelection: s.subtitleSelection.filter((x) => x !== id) }
        : { subtitleSelection: [...s.subtitleSelection, id], selection: [] };
    }),
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
        clipGroups: state.clipGroups,
        clipGroupId: state.clipGroupId,
        trackLocked: state.trackLocked,
        markers: state.markers,
        subtitles: state.subtitles,
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
type Tracked = Pick<EditorState, 'tracks' | 'clips' | 'settings' | 'assets' | 'clipGroups' | 'clipGroupId' | 'trackLocked' | 'markers' | 'subtitles'>;
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

export function snapTime(
  t: number,
  opts?: { excludeClipIds?: string[]; pps?: number; excludePlayhead?: boolean }
): number {
  const s = useEditor.getState();
  if (!s.snapEnabled) return t;
  let best = t;
  let bestDist = Infinity;
  if (s.snapInterval > 0) {
    const grid = Math.round(t / s.snapInterval) * s.snapInterval;
    const d = Math.abs(grid - t);
    if (d < bestDist) {
      best = grid;
      bestDist = d;
    }
  }
  const exclude = new Set(opts?.excludeClipIds ?? []);
  const pps = opts?.pps ?? s.pixelsPerSecond;
  const edgeTol = 8 / Math.max(1, pps);
  for (const c of Object.values(s.clips)) {
    if (exclude.has(c.id)) continue;
    const dur = clipDisplayDur(c);
    for (const cand of [c.start, c.start + dur]) {
      const d = Math.abs(cand - t);
      if (d < bestDist && d <= edgeTol) {
        best = cand;
        bestDist = d;
      }
    }
  }
  // Playhead is a snap target except when the playhead itself is being moved.
  if (!opts?.excludePlayhead) {
    const d = Math.abs(s.playhead - t);
    if (d < bestDist && d <= edgeTol) best = s.playhead;
  }
  return best;
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
