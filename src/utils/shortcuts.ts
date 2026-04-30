import { useEffect } from 'react';
import { useEditor, undo, redo, projectDuration } from '../state/editorStore';

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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
