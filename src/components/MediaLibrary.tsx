import { useRef, useState } from 'react';
import { useEditor, newClipId } from '../state/editorStore';
import { loadMediaFile, generateWaveform, generateThumbnailStrip, formatTime } from '../utils/media';
import { ensurePreviewable } from '../utils/proxy';
import type { MediaAsset, Clip } from '../types';
import { isNative, openMediaDialog, readFileAsFile } from '../utils/native';

export function MediaLibrary() {
  const assets = useEditor((s) => s.assets);
  const tracks = useEditor((s) => s.tracks);
  const clips = useEditor((s) => s.clips);
  const addAsset = useEditor((s) => s.addAsset);
  const removeAsset = useEditor((s) => s.removeAsset);
  const addClip = useEditor((s) => s.addClip);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<string>('');
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

  /**
   * On the desktop build go through the native picker: it returns absolute
   * paths, which get stamped onto the `File` so the export can hand ffmpeg the
   * original media instead of a copy. In the browser there is no such thing as
   * a file path, so fall back to the hidden `<input type=file>`.
   */
  const addFiles = async () => {
    if (!isNative()) {
      inputRef.current?.click();
      return;
    }
    let paths: string[] = [];
    try {
      paths = await openMediaDialog();
    } catch (e: any) {
      alert(`파일 선택 실패: ${e?.message ?? e}`);
      return;
    }
    if (paths.length === 0) return;
    setBusy(true);
    const files: File[] = [];
    try {
      for (const p of paths) {
        setBusyMsg(`${p.split(/[\\/]/).pop()}: 읽는 중…`);
        files.push(await readFileAsFile(p));
      }
    } catch (e: any) {
      setBusy(false);
      setBusyMsg('');
      alert(`파일 읽기 실패: ${e?.message ?? e}`);
      return;
    }
    // handleFiles manages busy state itself from here on.
    await handleFiles(files);
  };

  const handleFiles = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        try {
          // Pre-import: sources the webview can't decode (HEVC, ProRes, ...)
          // get a preview proxy. `ensurePreviewable` picks a format that keeps
          // transparency when the source has any, so a cut-out overlay looks
          // the same on screen as it does in the render, and carries
          // `__nativePath` across so the export still uses the original.
          let workingFile = f;
          if (f.type.startsWith('video/')) {
            setBusyMsg(`${f.name}: 코덱 확인 중…`);
            try {
              const r = await ensurePreviewable(f, (msg) => setBusyMsg(`${f.name}: ${msg}`));
              workingFile = r.file;
            } catch (e: any) {
              console.error('proxy failed', e);
              alert(`${f.name} 자동 변환 실패: ${e?.message ?? e}\n다른 도구로 H.264로 변환해 다시 올려주세요.`);
              continue;
            }
          }
          setBusyMsg(`${workingFile.name}: 로딩 중…`);
          const a = await loadMediaFile(workingFile);
          addAsset(a);
          // Generate waveform asynchronously so the UI isn't blocked.
          generateWaveform(workingFile, 100)
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
      setBusyMsg('');
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
      // Images get a 5s default visible duration; video/audio uses real length.
      outPoint: asset.isImage ? Math.min(5, asset.duration) : asset.duration,
      fadeIn: 0,
      fadeOut: 0,
      volume: 1,
      muted: false,
      speed: 1,
      audioTail: 0,
      transformX: 0,
      transformY: 0,
      transformScale: 1,
      transformRotation: 0,
      transformOpacity: 1,
      brightness: 0,
      contrast: 1,
      saturation: 1,
      gamma: 1,
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
        <button onClick={addFiles} disabled={busy} title={busy ? busyMsg : undefined}>
          {busy ? (busyMsg || '불러오는 중…') : '파일 추가'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
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
