import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, newClipId, projectDuration, snapTime } from '../state/editorStore';
import type { Clip, Track } from '../types';
import { formatTime } from '../utils/media';

const TRACK_HEADER_W = 110;
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
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const snapInterval = useEditor((s) => s.snapInterval);
  const setSnapEnabled = useEditor((s) => s.setSnapEnabled);
  const setSnapInterval = useEditor((s) => s.setSnapInterval);

  const duration = useMemo(() => projectDuration(useEditor.getState()), [clips]);
  const totalWidth = Math.max(800, (duration + 5) * pixelsPerSecond);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onWheelZoom = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(pixelsPerSecond * factor);
  };

  // delete selection with keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
        if (selection.length) {
          e.preventDefault();
          for (const id of selection) removeClip(id);
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
    for (const id of selection) removeClip(id);
  };

  // Convert a mouse clientX to a timeline time, applying snap (Alt = bypass).
  const clientXToTime = (clientX: number, rulerEl: HTMLElement | null, alt: boolean) => {
    const el = rulerEl ?? scrollRef.current?.querySelector<HTMLElement>('.ruler') ?? null;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const t = Math.max(0, x / pixelsPerSecond);
    return alt ? t : snapTime(t);
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
    <div className="timeline" onWheel={onWheelZoom}>
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
        <span className="hint">Ctrl+휠 줌 · Del 삭제 · S 자르기 · Alt: 스냅 해제</span>
      </div>
      <div className="timeline-body" ref={scrollRef}>
        <div className="timeline-grid" style={{ width: TRACK_HEADER_W + totalWidth }}>
          <Ruler width={totalWidth} pps={pixelsPerSecond} onMouseDown={startScrub} />
          <div className="tracks">
            {tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                width={totalWidth}
                pps={pixelsPerSecond}
                onMute={() => toggleMute(track.id)}
                onHide={() => toggleHidden(track.id)}
                onRemove={() => removeTrack(track.id)}
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
                      onSelect={(additive) => toggleSelection(c.id, additive)}
                      onUpdate={(p) => updateClip(c.id, p)}
                    />
                  ))}
              </TrackRow>
            ))}
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
}: {
  width: number;
  pps: number;
  onMouseDown: (e: React.MouseEvent) => void;
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
      </div>
    </div>
  );
}

function TrackRow({
  track,
  width,
  pps,
  children,
  onMute,
  onHide,
  onRemove,
  onDropAsset,
}: {
  track: Track;
  width: number;
  pps: number;
  children: React.ReactNode;
  onMute: () => void;
  onHide: () => void;
  onRemove: () => void;
  onDropAsset: (assetId: string, atSec: number) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div className="track-row" style={{ height: track.height }}>
      <div className="track-header" style={{ width: TRACK_HEADER_W }}>
        <span className={`track-name ${track.kind}`}>{track.name}</span>
        <div className="track-buttons">
          <button onClick={onMute} className={track.muted ? 'on' : ''} title="음소거">M</button>
          {track.kind === 'video' && (
            <button onClick={onHide} className={track.hidden ? 'on' : ''} title="숨김">H</button>
          )}
          <button onClick={onRemove} title="트랙 삭제">×</button>
        </div>
      </div>
      <div
        className={`track-area ${over ? 'over' : ''}`}
        style={{ width, height: track.height }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('text/asset-id')) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
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
    </div>
  );
}

function ClipView({
  clip,
  asset,
  pps,
  selected,
  onSelect,
  onUpdate,
}: {
  clip: Clip;
  asset: import('../types').MediaAsset | undefined;
  pps: number;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onUpdate: (p: Partial<Clip>) => void;
}) {
  const dur = clip.outPoint - clip.inPoint;
  const left = clip.start * pps;
  const width = Math.max(2, dur * pps);
  const dragRef = useRef<{ mode: 'move' | 'left' | 'right'; startX: number; clip: Clip } | null>(null);

  const onMouseDown = (e: React.MouseEvent, mode: 'move' | 'left' | 'right') => {
    e.stopPropagation();
    onSelect(e.shiftKey);
    dragRef.current = { mode, startX: e.clientX, clip };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxSec = (ev.clientX - d.startX) / pps;
      const noSnap = ev.altKey;
      const snap = (t: number) => (noSnap ? t : snapTime(t));
      if (d.mode === 'move') {
        const target = Math.max(0, d.clip.start + dxSec);
        onUpdate({ start: snap(target) });
      } else if (d.mode === 'left') {
        // snap on the timeline-position side, derive inPoint from the diff
        const newStart = snap(Math.max(0, d.clip.start + dxSec));
        const consumed = newStart - d.clip.start;
        const maxIn = d.clip.outPoint - 0.1;
        const newIn = Math.min(Math.max(0, d.clip.inPoint + consumed), maxIn);
        const adjustedConsumed = newIn - d.clip.inPoint;
        onUpdate({ inPoint: newIn, start: Math.max(0, d.clip.start + adjustedConsumed) });
      } else if (d.mode === 'right') {
        // snap the end position on the timeline, derive outPoint
        const dur0 = d.clip.outPoint - d.clip.inPoint;
        const newEnd = snap(Math.max(d.clip.start + 0.1, d.clip.start + dur0 + dxSec));
        const newDur = newEnd - d.clip.start;
        const newOut = Math.max(d.clip.inPoint + 0.1, Math.min((asset?.duration ?? Infinity), d.clip.inPoint + newDur));
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

  return (
    <div
      className={`clip ${selected ? 'selected' : ''} ${asset?.hasVideo ? 'video' : 'audio'} ${clip.muted ? 'muted' : ''}`}
      style={{ left, width }}
      title={asset?.name ?? ''}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="clip-handle left" onMouseDown={(e) => onMouseDown(e, 'left')} />
      <div className="clip-content">
        {asset?.thumbnail && asset.hasVideo && (
          <div className="clip-thumb" style={{ backgroundImage: `url(${asset.thumbnail})` }} />
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
