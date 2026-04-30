import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, newClipId, projectDuration, snapTime, clipDisplayDur } from '../state/editorStore';
import type { Clip, Track } from '../types';
import { formatTime } from '../utils/media';

const TRACK_HEADER_W = 150;
const RULER_H = 28;

export function Timeline() {
  const tracks = useEditor((s) => s.tracks);
  const clips = useEditor((s) => s.clips);
  const assets = useEditor((s) => s.assets);
  const pixelsPerSecond = useEditor((s) => s.pixelsPerSecond);
  const playhead = useEditor((s) => s.playhead);
  const selection = useEditor((s) => s.selection);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const setZoom = useEditor((s) => s.setZoom);
  const addClip = useEditor((s) => s.addClip);
  const updateClip = useEditor((s) => s.updateClip);
  const removeClip = useEditor((s) => s.removeClip);
  const splitClipAt = useEditor((s) => s.splitClipAt);
  const setSelection = useEditor((s) => s.setSelection);
  const toggleSelection = useEditor((s) => s.toggleSelection);
  const addTrack = useEditor((s) => s.addTrack);
  const removeTrack = useEditor((s) => s.removeTrack);
  const toggleMute = useEditor((s) => s.toggleTrackMute);
  const toggleHidden = useEditor((s) => s.toggleTrackHidden);
  const setTrackVolume = useEditor((s) => s.setTrackVolume);
  const setTrackHeight = useEditor((s) => s.setTrackHeight);
  const toggleTrackLock = useEditor((s) => s.toggleTrackLock);
  const trackLocked = useEditor((s) => s.trackLocked);
  const markers = useEditor((s) => s.markers);
  const clipGroupId = useEditor((s) => s.clipGroupId);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const snapInterval = useEditor((s) => s.snapInterval);
  const setSnapEnabled = useEditor((s) => s.setSnapEnabled);
  const setSnapInterval = useEditor((s) => s.setSnapInterval);
  const rippleEnabled = useEditor((s) => s.rippleEnabled);
  const setRippleEnabled = useEditor((s) => s.setRippleEnabled);

  const duration = useMemo(() => projectDuration(useEditor.getState()), [clips]);
  const totalWidth = Math.max(800, (duration + 5) * pixelsPerSecond);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement>(null);

  // React's onWheel handler is registered passively by default (modern Chrome),
  // so preventDefault() inside it is a no-op and Ctrl+Wheel falls through to
  // the browser's page zoom. Attach a native non-passive listener so we can
  // actually swallow the event when zooming the timeline.
  useEffect(() => {
    const el = timelineRootRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const cur = useEditor.getState().pixelsPerSecond;
      useEditor.getState().setZoom(cur * factor);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // delete selection with keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
        if (selection.length) {
          e.preventDefault();
          deleteSelection();
        }
      } else if (e.key.toLowerCase() === 's') {
        const target = e.target as HTMLElement;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
        razorAtPlayhead();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, removeClip, splitClipAt]);

  const razorAtPlayhead = () => {
    const st = useEditor.getState();
    if (st.selection.length === 0) return;
    const ph = st.playhead;
    for (const id of st.selection) splitClipAt(id, ph);
  };

  const deleteSelection = () => {
    const st = useEditor.getState();
    if (st.rippleEnabled) {
      // Ripple-delete each in DESCENDING start order so each removal's gap
      // closes correctly without shifting the next selection target's start.
      const ordered = [...selection]
        .map((id) => st.clips[id])
        .filter(Boolean)
        .sort((a, b) => b.start - a.start);
      for (const c of ordered) st.rippleDelete(c.id);
    } else {
      for (const id of selection) removeClip(id);
    }
  };

  // Convert a mouse clientX to a timeline time, applying snap (Alt = bypass).
  const clientXToTime = (clientX: number, rulerEl: HTMLElement | null, alt: boolean) => {
    const el = rulerEl ?? scrollRef.current?.querySelector<HTMLElement>('.ruler') ?? null;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const t = Math.max(0, x / pixelsPerSecond);
    return alt ? t : snapTime(t, { excludePlayhead: true, pps: pixelsPerSecond });
  };

  const startScrub = (e: React.MouseEvent) => {
    const rulerEl = e.currentTarget as HTMLElement;
    setPlayhead(clientXToTime(e.clientX, rulerEl, e.altKey));
    const onMove = (ev: MouseEvent) => {
      setPlayhead(clientXToTime(ev.clientX, rulerEl, ev.altKey));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const applyCrossfade = () => {
    const st = useEditor.getState();
    if (st.selection.length !== 2) return;
    const a = st.clips[st.selection[0]];
    const b = st.clips[st.selection[1]];
    if (!a || !b) return;
    if (a.trackId !== b.trackId) {
      alert('같은 트랙의 두 클립을 선택해야 합니다.');
      return;
    }
    const [left, right] = a.start <= b.start ? [a, b] : [b, a];
    const leftDur = clipDisplayDur(left);
    const rightDur = clipDisplayDur(right);
    const leftEnd = left.start + leftDur;
    const overlap = leftEnd - right.start;
    // Cap any fade at half of each clip's duration to keep things sane.
    const maxFade = Math.min(leftDur / 2, rightDur / 2);
    if (maxFade < 0.1) {
      alert('클립이 너무 짧아 크로스페이드를 적용할 수 없습니다.');
      return;
    }
    let fade: number;
    if (overlap > 0.05) {
      fade = Math.min(overlap, maxFade);
    } else {
      fade = Math.min(1.0, maxFade);
      // Pull the right clip back so it overlaps `fade` seconds with left's end.
      st.updateClip(right.id, { start: leftEnd - fade });
    }
    st.updateClip(left.id, { fadeOut: fade });
    st.updateClip(right.id, { fadeIn: fade });
  };

  const startMarquee = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only start on empty track area background (not on a clip).
    const target = e.target as HTMLElement;
    if (!target.classList.contains('track-area')) return;
    const root = timelineRootRef.current;
    if (!root) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const additive = e.shiftKey;
    const initialSel = additive ? new Set(useEditor.getState().selection) : new Set<string>();
    if (!additive) useEditor.getState().setSelection([]);
    const overlay = document.createElement('div');
    overlay.className = 'marquee';
    document.body.appendChild(overlay);

    const update = (ev: MouseEvent) => {
      const x1 = Math.min(startX, ev.clientX);
      const y1 = Math.min(startY, ev.clientY);
      const x2 = Math.max(startX, ev.clientX);
      const y2 = Math.max(startY, ev.clientY);
      overlay.style.left = `${x1}px`;
      overlay.style.top = `${y1}px`;
      overlay.style.width = `${x2 - x1}px`;
      overlay.style.height = `${y2 - y1}px`;
      const hit = new Set<string>(initialSel);
      const clipEls = root.querySelectorAll<HTMLElement>('.clip');
      clipEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right < x1 || r.left > x2 || r.bottom < y1 || r.top > y2) return;
        const id = el.dataset.clipId;
        if (id) hit.add(id);
      });
      useEditor.getState().setSelection(Array.from(hit));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', update);
      window.removeEventListener('mouseup', onUp);
      overlay.remove();
    };
    window.addEventListener('mousemove', update);
    window.addEventListener('mouseup', onUp);
  };

  const startPlayheadDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      setPlayhead(clientXToTime(ev.clientX, null, ev.altKey));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="timeline" ref={timelineRootRef}>
      <div className="timeline-toolbar">
        <button
          onClick={razorAtPlayhead}
          disabled={selection.length === 0}
          title="선택한 클립을 플레이헤드에서 자르기 (S)"
        >
          ✂ 자르기
        </button>
        <button onClick={deleteSelection} disabled={selection.length === 0} title="선택 삭제 (Del)">
          🗑 삭제
        </button>
        <button
          className={rippleEnabled ? 'on' : ''}
          onClick={() => setRippleEnabled(!rippleEnabled)}
          title="Ripple 모드: 클립 삭제 시 같은 트랙 뒤 클립을 자동으로 앞당김"
        >
          ⏩ Ripple
        </button>
        <button
          onClick={applyCrossfade}
          disabled={selection.length !== 2}
          title="같은 트랙의 두 클립 사이에 크로스페이드 적용 (겹침이 있으면 그 길이, 없으면 기본 1초로 끌어붙임)"
        >
          ⇌ 크로스페이드
        </button>
        <button
          onClick={() => useEditor.getState().groupClips(selection)}
          disabled={selection.length < 2}
          title="선택된 클립들을 묶기 (한 클립 이동 시 함께 움직임)"
        >
          🔗 그룹
        </button>
        <button
          onClick={() => {
            for (const id of selection) useEditor.getState().ungroupClip(id);
          }}
          disabled={selection.length === 0}
          title="선택된 클립들의 그룹 해제"
        >
          ✂ 그룹 해제
        </button>
        <span className="toolbar-sep" />
        <button onClick={() => addTrack('video')} title="비디오 트랙 추가">+ V</button>
        <button onClick={() => addTrack('audio')} title="오디오 트랙 추가">+ A</button>
        <span className="toolbar-sep" />
        <button
          className={snapEnabled ? 'on' : ''}
          onClick={() => setSnapEnabled(!snapEnabled)}
          title="스냅 켜기/끄기 (Alt 누르면 일시 해제)"
        >
          🧲 스냅
        </button>
        <select
          value={snapInterval}
          onChange={(e) => setSnapInterval(parseFloat(e.target.value))}
          disabled={!snapEnabled}
          title="스냅 간격"
        >
          <option value={0.0333}>1프레임 (30fps)</option>
          <option value={0.1}>0.1초</option>
          <option value={0.25}>0.25초</option>
          <option value={0.5}>0.5초</option>
          <option value={1}>1초</option>
          <option value={2}>2초</option>
          <option value={5}>5초</option>
        </select>
        <span className="zoom-info">줌: {pixelsPerSecond.toFixed(0)} px/s</span>
        <input
          type="range"
          min={10}
          max={400}
          value={pixelsPerSecond}
          onChange={(e) => setZoom(parseInt(e.target.value, 10))}
        />
        <span className="hint">Ctrl+휠/+/- 줌 · 0 리셋 · Del 삭제 · S 자르기 · M 마커 · Alt 스냅 해제</span>
      </div>
      <div className="timeline-body" ref={scrollRef}>
        <div className="timeline-grid" style={{ width: TRACK_HEADER_W + totalWidth }}>
          <Ruler
            width={totalWidth}
            pps={pixelsPerSecond}
            onMouseDown={startScrub}
            markers={markers}
            onMarkerClick={(id) => {
              const m = markers.find((x) => x.id === id);
              if (m) setPlayhead(m.time);
            }}
          />
          <div className="tracks" onMouseDown={startMarquee}>
            {tracks.map((track) => {
              // For video tracks, higher in the UI = drawn on top of canvas.
              const videoTracks = tracks.filter((t) => t.kind === 'video');
              const videoIdx = track.kind === 'video' ? videoTracks.findIndex((t) => t.id === track.id) : -1;
              const zLabel =
                videoIdx === 0 && videoTracks.length > 1
                  ? '앞'
                  : videoIdx === videoTracks.length - 1 && videoTracks.length > 1
                  ? '뒤'
                  : null;
              return (
              <TrackRow
                key={track.id}
                track={track}
                zLabel={zLabel}
                width={totalWidth}
                pps={pixelsPerSecond}
                locked={!!trackLocked[track.id]}
                onMute={() => toggleMute(track.id)}
                onHide={() => toggleHidden(track.id)}
                onRemove={() => removeTrack(track.id)}
                onVolume={(v) => setTrackVolume(track.id, v)}
                onHeight={(h) => setTrackHeight(track.id, h)}
                onToggleLock={() => toggleTrackLock(track.id)}
                onDropAsset={(assetId, atSec) => {
                  const a = assets[assetId];
                  if (!a) return;
                  const wantsKind = track.kind;
                  const compatible = wantsKind === 'video' ? a.hasVideo : a.hasAudio;
                  if (!compatible) return;
                  const clip: Clip = {
                    id: newClipId(),
                    assetId,
                    trackId: track.id,
                    start: Math.max(0, atSec),
                    inPoint: 0,
                    outPoint: a.duration,
                    fadeIn: 0,
                    fadeOut: 0,
                    volume: 1,
                    muted: false,
                    speed: 1,
                    audioTail: 0,
                  };
                  addClip(clip);
                  setSelection([clip.id]);
                }}
              >
                {Object.values(clips)
                  .filter((c) => c.trackId === track.id)
                  .map((c) => (
                    <ClipView
                      key={c.id}
                      clip={c}
                      asset={assets[c.assetId]}
                      pps={pixelsPerSecond}
                      selected={selection.includes(c.id)}
                      locked={!!trackLocked[track.id]}
                      groupId={clipGroupId[c.id]}
                      onSelect={(additive) => toggleSelection(c.id, additive)}
                      onUpdate={(p) => updateClip(c.id, p)}
                    />
                  ))}
              </TrackRow>
              );
            })}
          </div>
          <Playhead time={playhead} pps={pixelsPerSecond} onMouseDown={startPlayheadDrag} />
        </div>
      </div>
      <div className="timeline-footer">
        <span>플레이헤드: {formatTime(playhead)}</span>
        <span>길이: {formatTime(duration)}</span>
      </div>
    </div>
  );
}

function Ruler({
  width,
  pps,
  onMouseDown,
  markers,
  onMarkerClick,
}: {
  width: number;
  pps: number;
  onMouseDown: (e: React.MouseEvent) => void;
  markers: import('../types').Marker[];
  onMarkerClick: (id: string) => void;
}) {
  const targetPx = 80;
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300];
  const interval = candidates.find((v) => v * pps >= targetPx) ?? 60;
  const ticks: number[] = [];
  for (let t = 0; t * pps < width; t += interval) ticks.push(t);
  return (
    <div className="ruler-row" style={{ height: RULER_H }}>
      <div className="ruler-corner" style={{ width: TRACK_HEADER_W }} />
      <div className="ruler" style={{ width, height: RULER_H }} onMouseDown={onMouseDown}>
        {ticks.map((t) => (
          <div key={t} className="tick" style={{ left: t * pps }}>
            <span>{formatTime(t).replace(/\.\d+$/, '')}</span>
          </div>
        ))}
        {markers.map((m) => (
          <div
            key={m.id}
            className="marker"
            style={{ left: m.time * pps, ['--marker-color' as any]: m.color }}
            title={`${m.text} (${formatTime(m.time)})`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onMarkerClick(m.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`마커 삭제: "${m.text}"?`)) {
                useEditor.getState().removeMarker(m.id);
              }
            }}
          >
            <div className="marker-flag" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackRow({
  track,
  zLabel,
  width,
  pps,
  locked,
  children,
  onMute,
  onHide,
  onRemove,
  onVolume,
  onHeight,
  onToggleLock,
  onDropAsset,
}: {
  track: Track;
  zLabel: string | null;
  width: number;
  pps: number;
  locked: boolean;
  children: React.ReactNode;
  onMute: () => void;
  onHide: () => void;
  onRemove: () => void;
  onVolume: (v: number) => void;
  onHeight: (h: number) => void;
  onToggleLock: () => void;
  onDropAsset: (assetId: string, atSec: number) => void;
}) {
  const [over, setOver] = useState(false);
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startH = track.height;
    const onMove = (ev: MouseEvent) => onHeight(startH + (ev.clientY - startY));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return (
    <div
      className={`track-row ${locked ? 'locked' : ''}`}
      style={{ height: track.height }}
      data-track-id={track.id}
      data-track-kind={track.kind}
    >
      <div
        className="track-header"
        style={{ width: TRACK_HEADER_W }}
        title={
          track.kind === 'video'
            ? '비디오 트랙 — 위쪽 트랙(V1)이 캔버스 앞에, 아래로 갈수록 뒤로 깔립니다'
            : undefined
        }
      >
        <div className="track-header-row">
          <span className={`track-name ${track.kind}`}>{track.name}</span>
          {zLabel && <span className={`z-badge ${zLabel === '앞' ? 'front' : 'back'}`}>{zLabel}</span>}
        </div>
        <div className="track-buttons">
          <button onClick={onMute} className={track.muted ? 'on' : ''} title="음소거">M</button>
          {track.kind === 'video' && (
            <button onClick={onHide} className={track.hidden ? 'on' : ''} title="숨김">H</button>
          )}
          <button onClick={onToggleLock} className={locked ? 'on' : ''} title="잠금">🔒</button>
          <button onClick={onRemove} title="트랙 삭제">×</button>
        </div>
        <input
          type="range"
          className="track-vol"
          min={0}
          max={2}
          step={0.01}
          value={track.volume ?? 1}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
          title={`트랙 볼륨: ${Math.round((track.volume ?? 1) * 100)}%`}
        />
      </div>
      <div
        className={`track-area ${over ? 'over' : ''}`}
        style={{ width, height: track.height }}
        onDragOver={(e) => {
          if (locked) return;
          if (e.dataTransfer.types.includes('text/asset-id')) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (locked) return;
          e.preventDefault();
          setOver(false);
          const assetId = e.dataTransfer.getData('text/asset-id');
          if (!assetId) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          onDropAsset(assetId, x / pps);
        }}
      >
        {children}
      </div>
      <div className="track-resize" onMouseDown={onResizeMouseDown} title="트랙 높이 드래그" />
    </div>
  );
}

function ClipView({
  clip,
  asset,
  pps,
  selected,
  locked,
  groupId,
  onSelect,
  onUpdate,
}: {
  clip: Clip;
  asset: import('../types').MediaAsset | undefined;
  pps: number;
  selected: boolean;
  locked: boolean;
  groupId?: string;
  onSelect: (additive: boolean) => void;
  onUpdate: (p: Partial<Clip>) => void;
}) {
  const speed = clip.speed ?? 1;
  const displayDur = clipDisplayDur(clip);
  const left = clip.start * pps;
  const width = Math.max(2, displayDur * pps);
  const dragRef = useRef<{ mode: 'move' | 'left' | 'right'; startX: number; clip: Clip } | null>(null);

  const onMouseDown = (e: React.MouseEvent, mode: 'move' | 'left' | 'right') => {
    e.stopPropagation();
    onSelect(e.shiftKey);
    if (locked) return; // selection allowed, but no drag/trim on locked tracks
    // Snapshot starts of all group members at drag-start so subsequent
    // mousemoves can apply a single absolute delta instead of accumulating.
    const st0 = useEditor.getState();
    const gid = st0.clipGroupId[clip.id];
    const memberIds = gid ? (st0.clipGroups[gid] ?? [clip.id]) : [clip.id];
    const memberStarts: Record<string, number> = {};
    for (const mid of memberIds) {
      const m = st0.clips[mid];
      if (m) memberStarts[mid] = m.start;
    }
    (dragRef as any).current = { mode, startX: e.clientX, clip, memberStarts };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxSec = (ev.clientX - d.startX) / pps;
      const noSnap = ev.altKey;
      const snap = (t: number) => (noSnap ? t : snapTime(t, { excludeClipIds: [d.clip.id], pps }));
      if (d.mode === 'move') {
        const target = Math.max(0, d.clip.start + dxSec);
        const snapped = snap(target);
        const delta = snapped - d.clip.start;
        const memberStarts = (d as any).memberStarts as Record<string, number> | undefined;
        if (memberStarts) {
          let allowed = delta;
          for (const mid of Object.keys(memberStarts)) {
            if (memberStarts[mid] + allowed < 0) allowed = -memberStarts[mid];
          }
          for (const mid of Object.keys(memberStarts)) {
            useEditor.getState().updateClip(mid, { start: Math.max(0, memberStarts[mid] + allowed) });
          }
        } else {
          onUpdate({ start: snapped });
        }
        // Vertical: detect a track under the cursor and switch the dragged
        // clip onto it. Only the dragged clip moves between tracks — grouped
        // siblings stay where they are so V+A links don't break.
        const rows = document.querySelectorAll<HTMLElement>('.track-row');
        for (const row of Array.from(rows)) {
          const r = row.getBoundingClientRect();
          if (ev.clientY < r.top || ev.clientY > r.bottom) continue;
          const tid = row.dataset.trackId;
          const tkind = row.dataset.trackKind as 'video' | 'audio' | undefined;
          if (!tid || !tkind) break;
          if (row.classList.contains('locked')) break;
          // Already on this track — nothing to do.
          const cur = useEditor.getState().clips[d.clip.id];
          if (!cur || tid === cur.trackId) break;
          // Audio-only assets can only live on audio tracks.
          if (asset && !asset.hasVideo && tkind === 'video') break;
          useEditor.getState().updateClip(d.clip.id, { trackId: tid });
          break;
        }
      } else if (d.mode === 'left') {
        // (no group sync on trim — only on move)
        const newStart = snap(Math.max(0, d.clip.start + dxSec));
        const consumed = newStart - d.clip.start; // timeline seconds
        // At speed S, every timeline second consumed eats S seconds of source media.
        const mediaConsumed = consumed * speed;
        const maxIn = d.clip.outPoint - 0.1;
        const newIn = Math.min(Math.max(0, d.clip.inPoint + mediaConsumed), maxIn);
        const adjustedMedia = newIn - d.clip.inPoint;
        const adjustedTimeline = adjustedMedia / speed;
        onUpdate({ inPoint: newIn, start: Math.max(0, d.clip.start + adjustedTimeline) });
      } else if (d.mode === 'right') {
        // snap the end position on the timeline, derive outPoint
        const dispDur0 = clipDisplayDur(d.clip);
        const newEnd = snap(Math.max(d.clip.start + 0.1, d.clip.start + dispDur0 + dxSec));
        const newTimelineDur = newEnd - d.clip.start;
        const newMediaDur = newTimelineDur * speed;
        const newOut = Math.max(d.clip.inPoint + 0.1, Math.min((asset?.duration ?? Infinity), d.clip.inPoint + newMediaDur));
        onUpdate({ outPoint: newOut });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const tailWidth = (clip.audioTail ?? 0) * pps;
  const clipBox = (
    <div
      className={`clip ${selected ? 'selected' : ''} ${asset?.hasVideo ? 'video' : 'audio'} ${clip.muted ? 'muted' : ''} ${groupId ? 'grouped' : ''} ${clip.color ? 'has-color' : ''}`}
      data-clip-id={clip.id}
      style={{
        left,
        width,
        ...(groupId ? { ['--group-color' as any]: groupColor(groupId) } : {}),
        ...(clip.color ? { ['--clip-color' as any]: clip.color } : {}),
      }}
      title={asset?.name ?? ''}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="clip-handle left" onMouseDown={(e) => onMouseDown(e, 'left')} />
      <div className="clip-content">
        {asset?.hasVideo && asset.thumbnailStrip && asset.thumbnailStripStep ? (
          <ThumbStrip
            frames={asset.thumbnailStrip}
            step={asset.thumbnailStripStep}
            inPoint={clip.inPoint}
            outPoint={clip.outPoint}
            width={width}
          />
        ) : (
          asset?.thumbnail && asset.hasVideo && (
            <div className="clip-thumb" style={{ backgroundImage: `url(${asset.thumbnail})` }} />
          )
        )}
        {asset?.waveform && asset.waveformPeaksPerSecond && (
          <Waveform
            peaks={asset.waveform}
            pps={asset.waveformPeaksPerSecond}
            inPoint={clip.inPoint}
            outPoint={clip.outPoint}
            width={width}
            video={!!asset.hasVideo}
          />
        )}
        <span className="clip-label">{asset?.name ?? '?'}</span>
        {clip.fadeIn > 0 && (
          <div className="fade-marker fade-in" style={{ width: clip.fadeIn * pps }} />
        )}
        {clip.fadeOut > 0 && (
          <div className="fade-marker fade-out" style={{ width: clip.fadeOut * pps }} />
        )}
      </div>
      <button
        className={`clip-mute ${clip.muted ? 'on' : ''}`}
        title={clip.muted ? '오디오 켜기' : '오디오 끄기'}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate({ muted: !clip.muted });
        }}
      >
        {clip.muted ? '🔇' : '🔊'}
      </button>
      <div className="clip-handle right" onMouseDown={(e) => onMouseDown(e, 'right')} />
    </div>
  );
  if (tailWidth > 0) {
    return (
      <>
        {clipBox}
        <div
          className="audio-tail"
          style={{ left: left + width, width: tailWidth }}
          title={`오디오 여운 ${(clip.audioTail ?? 0).toFixed(2)}s`}
        />
      </>
    );
  }
  return clipBox;
}

function groupColor(id: string): string {
  // Map a group id to a deterministic pleasant hue.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 70%, 60%)`;
}

function ThumbStrip({
  frames,
  step,
  inPoint,
  outPoint,
  width,
}: {
  frames: string[];
  step: number;
  inPoint: number;
  outPoint: number;
  width: number;
}) {
  // Pick frames whose source-time bucket falls inside [inPoint, outPoint],
  // then space them evenly across the clip's pixel width.
  const startIdx = Math.max(0, Math.floor(inPoint / step));
  const endIdx = Math.min(frames.length, Math.ceil(outPoint / step));
  const visible = frames.slice(startIdx, Math.max(startIdx + 1, endIdx));
  // Density: about one frame per 80 px.
  const slots = Math.max(1, Math.min(visible.length, Math.floor(width / 80) || 1));
  const picks: string[] = [];
  for (let i = 0; i < slots; i++) {
    const idx = Math.floor((i / Math.max(1, slots - 1)) * (visible.length - 1));
    picks.push(visible[Math.min(idx, visible.length - 1)]);
  }
  return (
    <div className="clip-strip">
      {picks.map((src, i) => (
        <div
          key={i}
          className="clip-strip-cell"
          style={{ backgroundImage: `url(${src})`, flex: 1 }}
        />
      ))}
    </div>
  );
}

function Waveform({
  peaks,
  pps,
  inPoint,
  outPoint,
  width,
  video,
}: {
  peaks: number[];
  pps: number; // peaks per second
  inPoint: number;
  outPoint: number;
  width: number;
  video: boolean;
}) {
  // Sample the peaks within [inPoint, outPoint] mapped to [0, width].
  const startIdx = Math.max(0, Math.floor(inPoint * pps));
  const endIdx = Math.min(peaks.length / 2, Math.ceil(outPoint * pps));
  const span = Math.max(1, endIdx - startIdx);
  // Render at most ~3 peaks/px to avoid pathological SVG sizes.
  const targetCols = Math.min(span, Math.max(20, Math.floor(width * 1.5)));
  const step = span / targetCols;
  const H = 40;
  const mid = H / 2;
  let path = '';
  for (let i = 0; i < targetCols; i++) {
    const sub = startIdx + Math.floor(i * step);
    const subEnd = startIdx + Math.floor((i + 1) * step);
    let mn = 0;
    let mx = 0;
    for (let j = sub; j < subEnd && j < endIdx; j++) {
      const lo = peaks[j * 2];
      const hi = peaks[j * 2 + 1];
      if (lo < mn) mn = lo;
      if (hi > mx) mx = hi;
    }
    const x = (i / targetCols) * 100;
    const y1 = mid + mn * mid * 0.95;
    const y2 = mid + mx * mid * 0.95;
    path += `M${x.toFixed(2)} ${y1.toFixed(2)}L${x.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return (
    <svg
      className={`clip-waveform ${video ? 'video' : 'audio'}`}
      preserveAspectRatio="none"
      viewBox={`0 0 100 ${H}`}
      aria-hidden="true"
    >
      <path d={path} stroke="currentColor" strokeWidth={0.5} fill="none" />
    </svg>
  );
}

function Playhead({
  time,
  pps,
  onMouseDown,
}: {
  time: number;
  pps: number;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="playhead" style={{ left: TRACK_HEADER_W + time * pps }}>
      <div
        className="playhead-cap"
        onMouseDown={onMouseDown}
        title="드래그해서 시간 이동 (Alt: 스냅 해제)"
      />
      <div className="playhead-line" />
      <div className="playhead-hit" onMouseDown={onMouseDown} />
    </div>
  );
}
