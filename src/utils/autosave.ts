import { useEffect, useRef } from 'react';
import { useEditor } from '../state/editorStore';
import { saveProject, loadProject } from './project';
import { getMeta, setMeta, listProjects } from './db';

const AUTOSAVE_DELAY_MS = 1500;
const AUTOSAVE_NAME = '_autosave';
const META_LAST_PROJECT = 'lastProjectId';
const META_AUTOSAVE_ID = 'autosaveProjectId';

export function useAutosave(enabled: boolean) {
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const unsub = useEditor.subscribe((state, prev) => {
      // skip pure UI changes (selection, playhead, isPlaying)
      if (
        state.assets === prev.assets &&
        state.clips === prev.clips &&
        state.tracks === prev.tracks &&
        state.settings === prev.settings &&
        state.snapEnabled === prev.snapEnabled &&
        state.snapInterval === prev.snapInterval &&
        state.pixelsPerSecond === prev.pixelsPerSecond &&
        state.masterVolume === prev.masterVolume &&
        state.rippleEnabled === prev.rippleEnabled &&
        state.clipGroups === prev.clipGroups &&
        state.clipGroupId === prev.clipGroupId &&
        state.trackLocked === prev.trackLocked &&
        state.markers === prev.markers &&
        state.subtitles === prev.subtitles
      ) {
        return;
      }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        try {
          const existingId = (await getMeta<string>(META_AUTOSAVE_ID)) ?? undefined;
          const id = await saveProject(AUTOSAVE_NAME, existingId);
          await setMeta(META_AUTOSAVE_ID, id);
          await setMeta(META_LAST_PROJECT, id);
        } catch (e) {
          console.error('autosave failed', e);
        } finally {
          savingRef.current = false;
        }
      }, AUTOSAVE_DELAY_MS);
    });
    return () => {
      unsub();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled]);
}

export async function tryRestoreLast(): Promise<boolean> {
  const lastId = await getMeta<string>(META_LAST_PROJECT);
  if (!lastId) return false;
  const list = await listProjects();
  const found = list.find((p) => p.id === lastId);
  if (!found) return false;
  return loadProject(lastId);
}

export async function setLastProject(id: string) {
  await setMeta(META_LAST_PROJECT, id);
}

export const AUTOSAVE_PROJECT_NAME = AUTOSAVE_NAME;
