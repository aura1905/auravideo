import { useMemo, useState } from 'react';
import { useEditor, clipDisplayDur } from '../state/editorStore';
import { detectScenes, type SceneDetectProgress } from '../utils/sceneDetect';
import { formatTime } from '../utils/media';

type Mode = 'split' | 'marker';

export function SceneDetectDialog({ onClose }: { onClose: () => void }) {
  const clips = useEditor((s) => s.clips);
  const assets = useEditor((s) => s.assets);
  const splitClipAt = useEditor((s) => s.splitClipAt);
  const addMarker = useEditor((s) => s.addMarker);

  const eligibleClips = useMemo(() => {
    return Object.values(clips).filter((c) => {
      const a = assets[c.assetId];
      return a && a.hasVideo && !a.isImage;
    });
  }, [clips, assets]);

  const [clipId, setClipId] = useState<string>(eligibleClips[0]?.id ?? '');
  const [threshold, setThreshold] = useState(15);
  const [mode, setMode] = useState<Mode>('marker');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [done, setDone] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onProgress = (p: SceneDetectProgress) => {
    setPhase(p.phase);
    if (p.progress >= 0) setProgress(p.progress);
  };

  const start = async () => {
    const c = clips[clipId];
    if (!c) return;
    const a = assets[c.assetId];
    if (!a) return;
    setRunning(true);
    setError(null);
    setDone(null);
    setProgress(0);
    try {
      const timestamps = await detectScenes(a.file, c.inPoint, c.outPoint, threshold, onProgress);
      const speed = c.speed ?? 1;
      // Map source-media seconds to timeline seconds.
      const tlPoints = timestamps
        .map((t) => c.start + (t - c.inPoint) / speed)
        // Skip endpoints right next to the clip's edges to avoid 0-length segments.
        .filter((t) => t > c.start + 0.2 && t < c.start + clipDisplayDur(c) - 0.2);

      if (mode === 'marker') {
        for (let i = 0; i < tlPoints.length; i++) {
          addMarker({ time: tlPoints[i], text: `장면 ${i + 1}`, color: '#7ad07a' });
        }
      } else {
        // Split mode: cut from latest to earliest so each split's index lookup
        // by id stays valid (splitClipAt creates new ids for the right halves
        // but we always operate on the *current* leftmost clip id, which has
        // the same id as the original until the first split).
        // Actually splitClipAt mutates LEFT to retain id, RIGHT gets new id.
        // So splitting at the earliest point first keeps the LEFT clip with
        // the original id, but the right half (containing the rest) has a new
        // id. Subsequent splits should target whichever clip currently spans
        // the next timestamp. Easiest: re-fetch state each iteration.
        const sorted = [...tlPoints].sort((a, b) => a - b);
        for (const t of sorted) {
          const st = useEditor.getState();
          // Find a clip on the same trackId that contains time t.
          const target = Object.values(st.clips).find(
            (cl) =>
              cl.trackId === c.trackId &&
              t > cl.start + 0.05 &&
              t < cl.start + clipDisplayDur(cl) - 0.05
          );
          if (target) splitClipAt(target.id, t);
        }
      }
      setDone({ count: tlPoints.length });
      setPhase(`완료: ${tlPoints.length}개 ${mode === 'marker' ? '마커 추가됨' : '컷 분할됨'}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">장면 자동 감지</div>
        <div className="modal-body">
          {!running && !done && (
            <>
              <p>
                선택한 비디오 클립을 분석해 장면이 바뀌는 시점을 자동으로 찾습니다.
              </p>
              <label className="props-field">
                <span>소스 클립</span>
                <select value={clipId} onChange={(e) => setClipId(e.target.value)}>
                  {eligibleClips.length === 0 && <option value="">(비디오 클립이 없음)</option>}
                  {eligibleClips.map((c) => {
                    const a = assets[c.assetId];
                    const dur = clipDisplayDur(c);
                    return (
                      <option key={c.id} value={c.id}>
                        {a?.name ?? '?'} ({formatTime(c.start)} ~ {formatTime(c.start + dur)})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="props-field">
                <span>민감도 (낮을수록 더 많이 감지) — {threshold}</span>
                <input
                  type="range"
                  min={3}
                  max={50}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                />
              </label>
              <label className="props-field">
                <span>결과 처리</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                  <option value="marker">마커로 표시 (룰러에 깃발)</option>
                  <option value="split">클립 자동 분할</option>
                </select>
              </label>
              <button className="primary" onClick={start} disabled={!clipId} style={{ marginTop: 12 }}>
                분석 시작
              </button>
            </>
          )}
          {running && (
            <>
              <p>{phase}</p>
              <progress max={1} value={progress} style={{ width: '100%' }} />
            </>
          )}
          {done && (
            <p>
              <strong>{done.count}개</strong>의 장면 전환을 찾았습니다.
            </p>
          )}
          {error && <pre className="error">{error}</pre>}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
