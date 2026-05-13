import { useEffect } from 'react';
import { useEditor, undo, redo, projectDuration, newClipId, clipDisplayDur } from '../state/editorStore';
import type { Clip } from '../types';

// Module-level clipboard. Holds deep-cloned Clip snapshots so subsequent
// edits to the source clips don't mutate the buffer. Tracks the leftmost
// `start` so paste can offset every clip to land at the playhead.
let clipboardClips: Clip[] = [];
let clipboardOriginStart = 0;

// J/K/L shuttle: K = pause, J = -1x (rewind), L = +1x (forward, next press doubles)
let shuttleSpeed = 0;
let shuttleTimer: number | null = null;

function startShuttle() {
  if (shuttleTimer !== null) return;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (shuttleSpeed === 0) {
      stopShuttle();
      return;
    }
    const s = useEditor.getState();
    const dur = projectDuration(s);
    const next = Math.max(0, Math.min(dur, s.playhead + shuttleSpeed * dt));
    useEditor.getState().setPlayhead(next);
    shuttleTimer = requestAnimationFrame(tick);
  };
  shuttleTimer = requestAnimationFrame(tick);
}
function stopShuttle() {
  if (shuttleTimer !== null) cancelAnimationFrame(shuttleTimer);
  shuttleTimer = null;
  shuttleSpeed = 0;
}

function isTextTarget(t: EventTarget | null): boolean {
  if (!t) return false;
  const el = t as HTMLElement;
  if (!el.tagName) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          stopShuttle();
          useEditor.getState().setPlaying(false);
          undo();
          return;
        }
        if ((k === 'y') || (k === 'z' && e.shiftKey)) {
          e.preventDefault();
          stopShuttle();
          useEditor.getState().setPlaying(false);
          redo();
          return;
        }
        if (k === 'c') {
          // Don't hijack the browser copy when the user has actual text selected
          // (e.g. selecting subtitle text in an input — already filtered above —
          // or selecting plain text in the page). copyClips uses store selection.
          const sel = window.getSelection?.();
          if (sel && sel.toString().length > 0) return;
          if (copyClips()) e.preventDefault();
          return;
        }
        if (k === 'v') {
          if (pasteClips()) e.preventDefault();
          return;
        }
        if (k === 'd') {
          // Duplicate-in-place: copy + paste at the original positions, slightly
          // offset so the new clips don't perfectly overlap their source.
          if (duplicateClips()) e.preventDefault();
          return;
        }
        return; // let other ctrl combos pass through
      }

      // No-modifier transport
      switch (e.key) {
        case ' ': {
          e.preventDefault();
          stopShuttle();
          const s = useEditor.getState();
          s.setPlaying(!s.isPlaying);
          break;
        }
        case 'k':
        case 'K': {
          e.preventDefault();
          stopShuttle();
          useEditor.getState().setPlaying(false);
          break;
        }
        case 'l':
        case 'L': {
          e.preventDefault();
          useEditor.getState().setPlaying(false);
          shuttleSpeed = shuttleSpeed > 0 ? Math.min(shuttleSpeed * 2, 16) : 1;
          startShuttle();
          break;
        }
        case 'j':
        case 'J': {
          e.preventDefault();
          useEditor.getState().setPlaying(false);
          shuttleSpeed = shuttleSpeed < 0 ? Math.max(shuttleSpeed * 2, -16) : -1;
          startShuttle();
          break;
        }
        case 'Home': {
          e.preventDefault();
          stopShuttle();
          useEditor.getState().setPlaying(false);
          useEditor.getState().setPlayhead(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          stopShuttle();
          useEditor.getState().setPlaying(false);
          useEditor.getState().setPlayhead(projectDuration(useEditor.getState()));
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const s = useEditor.getState();
          const step = e.shiftKey ? 1 : 1 / s.settings.fps;
          s.setPlayhead(Math.max(0, s.playhead - step));
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const s = useEditor.getState();
          const step = e.shiftKey ? 1 : 1 / s.settings.fps;
          s.setPlayhead(Math.min(projectDuration(s), s.playhead + step));
          break;
        }
        case '=':
        case '+': {
          e.preventDefault();
          const s = useEditor.getState();
          s.setZoom(s.pixelsPerSecond * 1.25);
          break;
        }
        case '-':
        case '_': {
          e.preventDefault();
          const s = useEditor.getState();
          s.setZoom(s.pixelsPerSecond / 1.25);
          break;
        }
        case '0': {
          e.preventDefault();
          useEditor.getState().setZoom(80);
          break;
        }
        case 'm':
        case 'M': {
          e.preventDefault();
          const s = useEditor.getState();
          const t = s.playhead;
          const text = prompt('마커 이름 (선택사항):', '') ?? '';
          s.addMarker({ time: t, text, color: '#f7c948' });
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Snapshot the currently selected clips into the module clipboard.
 * Returns true if anything was copied (so the caller can `preventDefault`). */
function copyClips(): boolean {
  const s = useEditor.getState();
  if (s.selection.length === 0) return false;
  const picked: Clip[] = [];
  let minStart = Infinity;
  for (const id of s.selection) {
    const c = s.clips[id];
    if (!c) continue;
    picked.push({ ...c });
    if (c.start < minStart) minStart = c.start;
  }
  if (picked.length === 0) return false;
  clipboardClips = picked;
  clipboardOriginStart = isFinite(minStart) ? minStart : 0;
  return true;
}

/** Paste clipboard clips at the playhead. Each clip preserves its relative
 * offset from the leftmost clip at copy time. New ids are minted. The pasted
 * clips become the new selection so the user can immediately move/delete them. */
function pasteClips(): boolean {
  if (clipboardClips.length === 0) return false;
  const s = useEditor.getState();
  const playhead = s.playhead;
  const newIds: string[] = [];
  for (const src of clipboardClips) {
    const id = newClipId();
    const clip: Clip = {
      ...src,
      id,
      start: playhead + (src.start - clipboardOriginStart),
    };
    s.addClip(clip);
    newIds.push(id);
  }
  s.setSelection(newIds);
  return true;
}

/** Duplicate selection in-place. Each new clip starts right after its source
 * (source's end + 0.01s) so they're visible as separate blocks. Useful for
 * repeating a B-roll insert. */
function duplicateClips(): boolean {
  const s = useEditor.getState();
  if (s.selection.length === 0) return false;
  const newIds: string[] = [];
  for (const id of s.selection) {
    const src = s.clips[id];
    if (!src) continue;
    const nid = newClipId();
    const dur = clipDisplayDur(src);
    const clip: Clip = { ...src, id: nid, start: src.start + dur + 0.01 };
    s.addClip(clip);
    newIds.push(nid);
  }
  if (newIds.length === 0) return false;
  s.setSelection(newIds);
  return true;
}
