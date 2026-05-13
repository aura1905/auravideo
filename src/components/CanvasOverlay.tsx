import { RefObject, useEffect, useRef } from 'react';
import { useEditor } from '../state/editorStore';

type DragRole = 'move' | 'corner' | 'rotate';

/** Floating overlay anchored over the preview canvas. When a single clip is
 * selected AND active at the current playhead AND its track is a visible video
 * track, draws a bounding box with corner + rotation handles. Dragging them
 * mutates the clip's transformX/Y/Scale/Rotation in real time.
 *
 * Position is computed via the canvas's getBoundingClientRect each RAF tick
 * (using `position: fixed` viewport coords) so we don't have to wire layout
 * resize observers — the overlay simply follows the canvas as it relayouts. */
export function CanvasOverlay({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement> }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const wrapper = wrapperRef.current;
      const canvas = canvasRef.current;
      if (wrapper && canvas) {
        const s = useEditor.getState();
        // Only show when a SINGLE clip is selected (multi-select would need
        // ambiguous handles); if multi, hide.
        const id = s.selection.length === 1 ? s.selection[0] : null;
        const c = id ? s.clips[id] : null;
        const a = c ? s.assets[c.assetId] : null;
        const track = c ? s.tracks.find((t) => t.id === c.trackId) ?? null : null;
        const head = s.playhead;
        const speed = c?.speed ?? 1;
        const dur = c ? (c.outPoint - c.inPoint) / Math.max(0.01, speed) : 0;
        const isActive =
          !!c && !!a && !!track && track.kind === 'video' && !track.hidden &&
          a.hasVideo && head >= c.start && head < c.start + dur;
        if (!isActive) {
          if (wrapper.style.display !== 'none') wrapper.style.display = 'none';
        } else {
          const W = canvas.width;
          const H = canvas.height;
          const cssRect = canvas.getBoundingClientRect();
          if (cssRect.width === 0) {
            wrapper.style.display = 'none';
          } else {
            const vw = a!.width || W;
            const vh = a!.height || H;
            const baseScale = Math.min(W / vw, H / vh);
            const userScale = c!.transformScale ?? 1;
            const dw = vw * baseScale * userScale;
            const dh = vh * baseScale * userScale;
            const dx = (W - dw) / 2 + (c!.transformX ?? 0);
            const dy = (H - dh) / 2 + (c!.transformY ?? 0);
            const k = cssRect.width / W;
            wrapper.style.display = 'block';
            wrapper.style.left = `${cssRect.left + dx * k}px`;
            wrapper.style.top = `${cssRect.top + dy * k}px`;
            wrapper.style.width = `${dw * k}px`;
            wrapper.style.height = `${dh * k}px`;
            wrapper.style.transform = `rotate(${c!.transformRotation ?? 0}deg)`;
            wrapper.dataset.clipId = c!.id;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const role = target.dataset.role as DragRole | undefined;
    if (!role) return;
    e.preventDefault();
    e.stopPropagation();

    const s = useEditor.getState();
    const id = s.selection[0];
    if (!id) return;
    const c0 = s.clips[id];
    if (!c0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssRect = canvas.getBoundingClientRect();
    const k = cssRect.width / canvas.width; // CSS px per project px

    const startTransformX = c0.transformX ?? 0;
    const startTransformY = c0.transformY ?? 0;
    const startScale = c0.transformScale ?? 1;
    const startRot = c0.transformRotation ?? 0;
    // Box center in viewport CSS px, snapshot at drag start
    const centerCssX = cssRect.left + cssRect.width / 2 + startTransformX * k;
    const centerCssY = cssRect.top + cssRect.height / 2 + startTransformY * k;
    const initialDx = e.clientX - centerCssX;
    const initialDy = e.clientY - centerCssY;
    const initialDist = Math.hypot(initialDx, initialDy);
    const initialAngle = Math.atan2(initialDy, initialDx);
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    try { target.setPointerCapture(e.pointerId); } catch {}

    const onMove = (ev: PointerEvent) => {
      const updateClip = useEditor.getState().updateClip;
      if (role === 'move') {
        // Screen-space follow-the-mouse — works correctly even when the clip
        // is rotated, because we shift the clip's center in project px.
        updateClip(id, {
          transformX: startTransformX + (ev.clientX - startClientX) / k,
          transformY: startTransformY + (ev.clientY - startClientY) / k,
        });
      } else if (role === 'corner') {
        const newDist = Math.hypot(ev.clientX - centerCssX, ev.clientY - centerCssY);
        const factor = newDist / Math.max(1, initialDist);
        const newScale = Math.max(0.05, Math.min(20, startScale * factor));
        updateClip(id, { transformScale: newScale });
      } else if (role === 'rotate') {
        const curAngle = Math.atan2(ev.clientY - centerCssY, ev.clientX - centerCssX);
        let newRot = startRot + ((curAngle - initialAngle) * 180) / Math.PI;
        // Shift-snap to 15° increments
        if (ev.shiftKey) newRot = Math.round(newRot / 15) * 15;
        updateClip(id, { transformRotation: newRot });
      }
    };
    const onUp = (ev: PointerEvent) => {
      try { target.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Double-click: reset transform (a discoverable quick reset).
  const onDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.dataset.role !== 'move') return;
    e.stopPropagation();
    const id = useEditor.getState().selection[0];
    if (!id) return;
    useEditor.getState().updateClip(id, {
      transformX: 0,
      transformY: 0,
      transformScale: 1,
      transformRotation: 0,
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="canvas-overlay-box"
      style={{ display: 'none' }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title="드래그=이동, 모서리=크기, 위쪽 핸들=회전 (Shift=15° 스냅), 더블클릭=초기화"
    >
      <div data-role="move" className="overlay-body" />
      <div data-role="corner" className="overlay-corner tl" />
      <div data-role="corner" className="overlay-corner tr" />
      <div data-role="corner" className="overlay-corner bl" />
      <div data-role="corner" className="overlay-corner br" />
      <div data-role="rotate" className="overlay-rotate" />
    </div>
  );
}
