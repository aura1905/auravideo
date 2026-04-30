import { useState } from 'react';
import { useEditor, projectDuration } from '../state/editorStore';
import { exportProject } from '../utils/export';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('준비');
  const [running, setRunning] = useState(false);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

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
      setError(e?.message ?? String(e));
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
              <p>현재 타임라인을 MP4로 렌더링합니다. 큰 영상은 시간이 오래 걸릴 수 있습니다.</p>
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
