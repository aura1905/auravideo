import { useMemo, useState } from 'react';
import { useEditor, projectDuration } from '../state/editorStore';
import { exportProject } from '../utils/export';
import { formatTime } from '../utils/media';

type RangeMode = 'full' | 'auto' | 'custom';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('준비');
  const [running, setRunning] = useState(false);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const projDur = useMemo(() => projectDuration(useEditor.getState()), []);
  // Auto = trim leading/trailing empty space
  const autoBounds = useMemo(() => {
    const state = useEditor.getState();
    let earliest = Infinity;
    let latest = 0;
    for (const c of Object.values(state.clips)) {
      const end = c.start + (c.outPoint - c.inPoint);
      if (c.start < earliest) earliest = c.start;
      if (end > latest) latest = end;
    }
    if (!isFinite(earliest)) earliest = 0;
    return { start: earliest, end: latest };
  }, []);

  const [mode, setMode] = useState<RangeMode>('auto');
  const [customStart, setCustomStart] = useState(0);
  const [customEnd, setCustomEnd] = useState(projDur);

  const range = (() => {
    if (mode === 'full') return { start: 0, end: projDur };
    if (mode === 'auto') return autoBounds;
    return { start: customStart, end: customEnd };
  })();
  const rangeDur = Math.max(0.05, range.end - range.start);

  const start = async () => {
    setRunning(true);
    setError(null);
    setDoneUrl(null);
    try {
      const state = useEditor.getState();
      const dur = projectDuration(state);
      const blob = await exportProject(
        {
          clips: Object.values(state.clips),
          assets: state.assets,
          tracks: state.tracks,
          settings: state.settings,
          duration: dur,
          masterVolume: state.masterVolume,
          subtitles: Object.values(state.subtitles),
          rangeStart: range.start,
          rangeEnd: range.end,
        },
        (info) => {
          setPhase(info.phase);
          if (info.progress >= 0) setProgress(info.progress);
          if (info.log) setLogs((l) => [...l.slice(-200), info.log!]);
        }
      );
      const url = URL.createObjectURL(blob);
      setDoneUrl(url);
    } catch (e: any) {
      // Build a richer message: errno + recent ffmpeg log lines often pinpoint
      // the actual problem (FS error, codec failure, out-of-memory, etc).
      const parts: string[] = [];
      const msg = e?.message ?? String(e);
      parts.push(msg);
      if (typeof e?.errno === 'number') parts.push(`errno=${e.errno}`);
      if (e?.code) parts.push(`code=${e.code}`);
      const tailLogs = logs.slice(-12);
      if (tailLogs.length) parts.push('--- ffmpeg log (tail) ---', ...tailLogs);
      setError(parts.join('\n'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">내보내기 (MP4)</div>
        <div className="modal-body">
          {!running && !doneUrl && (
            <>
              <div className="range-modes">
                <label>
                  <input
                    type="radio"
                    name="rangeMode"
                    checked={mode === 'auto'}
                    onChange={() => setMode('auto')}
                  />
                  자동 트림 (첫 클립 ~ 마지막 클립)
                </label>
                <label>
                  <input
                    type="radio"
                    name="rangeMode"
                    checked={mode === 'full'}
                    onChange={() => setMode('full')}
                  />
                  타임라인 전체 (0 ~ 끝)
                </label>
                <label>
                  <input
                    type="radio"
                    name="rangeMode"
                    checked={mode === 'custom'}
                    onChange={() => setMode('custom')}
                  />
                  사용자 지정
                </label>
                {mode === 'custom' && (
                  <div className="range-inputs">
                    <label>
                      시작 (초)
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={projDur}
                        value={customStart.toFixed(2)}
                        onChange={(e) => setCustomStart(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </label>
                    <label>
                      끝 (초)
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={projDur}
                        value={customEnd.toFixed(2)}
                        onChange={(e) =>
                          setCustomEnd(Math.min(projDur, Math.max(customStart + 0.1, parseFloat(e.target.value) || 0)))
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
              <p className="range-summary">
                범위: <strong>{formatTime(range.start)}</strong> ~ <strong>{formatTime(range.end)}</strong>{' '}
                (<strong>{formatTime(rangeDur)}</strong>)
              </p>
              <button className="primary" onClick={start}>렌더링 시작</button>
            </>
          )}
          {running && (
            <>
              <p>{phase}</p>
              <progress max={1} value={progress} style={{ width: '100%' }} />
              <pre className="log">{logs.slice(-15).join('\n')}</pre>
            </>
          )}
          {doneUrl && (
            <>
              <p>완료되었습니다.</p>
              <video src={doneUrl} controls style={{ width: '100%', maxHeight: 360 }} />
              <a className="download-btn" href={doneUrl} download="auravideo-export.mp4">
                다운로드
              </a>
            </>
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
