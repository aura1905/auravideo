import { useRef, useState } from 'react';
import { useEditor, newClipId } from '../state/editorStore';
import { loadMediaFile, generateWaveform, generateThumbnailStrip, formatTime } from '../utils/media';
import type { MediaAsset, Clip } from '../types';

export function MediaLibrary() {
  const assets = useEditor((s) => s.assets);
  const tracks = useEditor((s) => s.tracks);
  const clips = useEditor((s) => s.clips);
  const addAsset = useEditor((s) => s.addAsset);
  const removeAsset = useEditor((s) => s.removeAsset);
  const addClip = useEditor((s) => s.addClip);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const updateAssetSilent = (id: string, patch: Partial<MediaAsset>) => {
    const cur = useEditor.getState().assets[id];
    if (!cur) return;
    // Don't pollute undo history with derived-cache mutations like waveforms.
    const t = (useEditor as any).temporal.getState();
    t.pause();
    try {
      useEditor.setState({ assets: { ...useEditor.getState().assets, [id]: { ...cur, ...patch } } });
    } finally {
      t.resume();
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        try {
          const a = await loadMediaFile(f);
          addAsset(a);
          // Generate waveform asynchronously so the UI isn't blocked.
          generateWaveform(f, 100)
            .then((r) => {
              if (!r) return;
              updateAssetSilent(a.id, { waveform: r.peaks, waveformPeaksPerSecond: r.peaksPerSecond });
            })
            .catch(() => {});
          if (a.hasVideo && a.duration > 4) {
            generateThumbnailStrip(a.url, a.duration)
              .then((r) => {
                if (!r) return;
                updateAssetSilent(a.id, { thumbnailStrip: r.frames, thumbnailStripStep: r.step });
              })
              .catch(() => {});
          }
        } catch (e) {
          console.error(e);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const addToTimeline = (asset: MediaAsset) => {
    const trackKind = asset.hasVideo ? 'video' : 'audio';
    const candidate = tracks.find((t) => t.kind === trackKind);
    if (!candidate) return;
    // place at end of that track
    let start = 0;
    for (const c of Object.values(clips)) {
      if (c.trackId !== candidate.id) continue;
      const end = c.start + (c.outPoint - c.inPoint);
      if (end > start) start = end;
    }
    const clip: Clip = {
      id: newClipId(),
      assetId: asset.id,
      trackId: candidate.id,
      start,
      inPoint: 0,
      outPoint: asset.duration,
      fadeIn: 0,
      fadeOut: 0,
      volume: 1,
      muted: false,
      speed: 1,
    };
    addClip(clip);
  };

  const onDragStart = (e: React.DragEvent, asset: MediaAsset) => {
    e.dataTransfer.setData('text/asset-id', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className={`media-library ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="ml-header">
        <span>미디어</span>
        <button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? '불러오는 중…' : '파일 추가'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      <div className="ml-list">
        {Object.values(assets).length === 0 && (
          <div className="ml-empty">파일을 드래그하거나 "파일 추가"로 불러오세요</div>
        )}
        {Object.values(assets).map((a) => (
          <div
            key={a.id}
            className="ml-item"
            draggable
            onDragStart={(e) => onDragStart(e, a)}
            onDoubleClick={() => addToTimeline(a)}
            title="더블클릭 또는 타임라인으로 드래그"
          >
            {a.thumbnail ? (
              <img src={a.thumbnail} alt={a.name} />
            ) : (
              <div className="ml-thumb-placeholder">{a.hasVideo ? '🎬' : '🎵'}</div>
            )}
            <div className="ml-meta">
              <div className="ml-name" title={a.name}>{a.name}</div>
              <div className="ml-sub">
                {formatTime(a.duration)}
                {a.width && a.height ? ` · ${a.width}×${a.height}` : ''}
              </div>
            </div>
            <button className="ml-remove" onClick={() => removeAsset(a.id)} title="제거">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
