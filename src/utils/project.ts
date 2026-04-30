import JSZip from 'jszip';
import { useEditor, clearHistory } from '../state/editorStore';
import type { Clip, MediaAsset, Track, ProjectSettings } from '../types';
import { putProject, getProject, getBlob, type StoredProject } from './db';

export interface SerializedAsset {
  id: string;
  name: string;
  fileType: string;
  duration: number;
  width?: number;
  height?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  thumbnail?: string;
}

export interface SerializedState {
  version: 1;
  tracks: Track[];
  clips: Clip[];
  settings: ProjectSettings;
  pixelsPerSecond: number;
  snapEnabled: boolean;
  snapInterval: number;
  assets: SerializedAsset[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function serializeState(): { state: SerializedState; assetBlobs: Map<string, Blob> } {
  const s = useEditor.getState();
  const assets: SerializedAsset[] = [];
  const blobs = new Map<string, Blob>();
  for (const a of Object.values(s.assets)) {
    assets.push({
      id: a.id,
      name: a.name,
      fileType: a.file.type,
      duration: a.duration,
      width: a.width,
      height: a.height,
      hasVideo: a.hasVideo,
      hasAudio: a.hasAudio,
      thumbnail: a.thumbnail,
    });
    blobs.set(a.id, a.file);
  }
  const state: SerializedState = {
    version: 1,
    tracks: s.tracks,
    clips: Object.values(s.clips),
    settings: s.settings,
    pixelsPerSecond: s.pixelsPerSecond,
    snapEnabled: s.snapEnabled,
    snapInterval: s.snapInterval,
    assets,
  };
  return { state, assetBlobs: blobs };
}

export async function saveProject(name: string, id?: string): Promise<string> {
  const { state, assetBlobs } = serializeState();
  const projectId = id ?? uid();
  const stored: StoredProject = {
    id: projectId,
    name,
    updatedAt: Date.now(),
    state,
    assetIds: state.assets.map((a) => a.id),
  };
  await putProject(stored, assetBlobs);
  return projectId;
}

export async function loadProject(id: string): Promise<boolean> {
  const stored = await getProject(id);
  if (!stored) return false;
  const state = stored.state as SerializedState;
  // reconstruct assets with fresh File + URL
  const assets: Record<string, MediaAsset> = {};
  for (const meta of state.assets) {
    const blob = await getBlob(id, meta.id);
    if (!blob) continue;
    const file = new File([blob], meta.name, { type: meta.fileType || blob.type });
    const url = URL.createObjectURL(blob);
    assets[meta.id] = {
      id: meta.id,
      name: meta.name,
      file,
      url,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      hasVideo: meta.hasVideo,
      hasAudio: meta.hasAudio,
      thumbnail: meta.thumbnail,
    };
  }
  // revoke previous object URLs
  const prev = useEditor.getState().assets;
  for (const a of Object.values(prev)) {
    try {
      URL.revokeObjectURL(a.url);
    } catch {}
  }
  // restore state
  useEditor.setState({
    assets,
    tracks: state.tracks,
    clips: Object.fromEntries(state.clips.map((c) => [c.id, c])),
    settings: state.settings,
    pixelsPerSecond: state.pixelsPerSecond ?? 80,
    snapEnabled: state.snapEnabled ?? true,
    snapInterval: state.snapInterval ?? 0.5,
    selection: [],
    playhead: 0,
    isPlaying: false,
  });
  // Reset undo history so Ctrl+Z doesn't undo the load itself.
  clearHistory();
  return true;
}

/** Bundle the current project (state JSON + all media blobs) into a single
 * `.auravideo.zip` file the user can download for backup or transfer. */
export async function exportProjectZip(name: string, onProgress?: (p: number) => void): Promise<Blob> {
  const { state, assetBlobs } = serializeState();
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(state, null, 2));
  const mediaDir = zip.folder('media')!;
  for (const a of state.assets) {
    const blob = assetBlobs.get(a.id);
    if (blob) mediaDir.file(`${a.id}-${a.name}`, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (meta) => {
    onProgress?.(meta.percent / 100);
  });
}

/** Restore from a `.auravideo.zip` file produced by exportProjectZip. */
export async function importProjectZip(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(file);
  const json = await zip.file('project.json')?.async('string');
  if (!json) throw new Error('project.json이 zip에 없습니다');
  const state = JSON.parse(json) as SerializedState;

  const assets: Record<string, MediaAsset> = {};
  for (const meta of state.assets) {
    // Filenames in /media are `${id}-${name}`. We can match on the prefix.
    const prefix = `media/${meta.id}-`;
    const entry = Object.values(zip.files).find((f) => f.name.startsWith(prefix));
    if (!entry) continue;
    const blob = await entry.async('blob');
    const file = new File([blob], meta.name, { type: meta.fileType || blob.type });
    const url = URL.createObjectURL(blob);
    assets[meta.id] = {
      id: meta.id,
      name: meta.name,
      file,
      url,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      hasVideo: meta.hasVideo,
      hasAudio: meta.hasAudio,
      thumbnail: meta.thumbnail,
    };
  }

  // revoke prior object URLs
  const prev = useEditor.getState().assets;
  for (const a of Object.values(prev)) {
    try {
      URL.revokeObjectURL(a.url);
    } catch {}
  }
  useEditor.setState({
    assets,
    tracks: state.tracks,
    clips: Object.fromEntries(state.clips.map((c) => [c.id, c])),
    settings: state.settings,
    pixelsPerSecond: state.pixelsPerSecond ?? 80,
    snapEnabled: state.snapEnabled ?? true,
    snapInterval: state.snapInterval ?? 0.5,
    selection: [],
    playhead: 0,
    isPlaying: false,
  });
  clearHistory();
}
