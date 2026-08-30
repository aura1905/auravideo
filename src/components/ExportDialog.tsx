import { useEffect, useMemo, useState } from 'react';
import { useEditor, projectDuration } from '../state/editorStore';
import { exportProject } from '../utils/export';
import { exportProjectNative } from '../utils/exportNative';
import { formatTime } from '../utils/media';
import {
  ffmpegCancel,
  ffmpegInfo,
  isNative,
  revealPath,
  saveDialog,
  type FfmpegInfo,
} from '../utils/native';

/** Human labels for the encoders we know how to drive. */
const ENCODER_LABELS: Record<string, string> = {
  libx264: 'H.264 (소프트웨어 x264) — 가장 호환성 높음',
  h264_nvenc: 'H.264 (NVIDIA NVENC) — GPU 가속',
  hevc_nvenc: 'H.265 (NVIDIA NVENC) — GPU 가속, 용량 절감',
  h264_qsv: 'H.264 (Intel QuickSync) — GPU 가속',
  hevc_qsv: 'H.265 (Intel QuickSync) — GPU 가속',
  h264_amf: 'H.264 (AMD AMF) — GPU 가속',
  hevc_amf: 'H.265 (AMD AMF) — GPU 가속',
  h264_videotoolbox: 'H.264 (Apple VideoToolbox) — GPU 가속',
  hevc_videotoolbox: 'H.265 (Apple VideoToolbox) — GPU 가속',
};

/** Order we offer hardware encoders in when several are available. */
const ENCODER_PREFERENCE = [
  'h264_nvenc',
  'h264_qsv',
  'h264_amf',
  'h264_videotoolbox',
  'hevc_nvenc',
  'hevc_qsv',
  'hevc_amf',
  'hevc_videotoolbox',
];

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

type RangeMode = 'full' | 'auto' | 'custom';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('준비');
  const [running, setRunning] = useState(false);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const [donePath, setDonePath] = useState<{ path: string; bytes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Desktop build: discover the real ffmpeg and which hardware encoders exist.
  const native = isNative();
  const [ffInfo, setFfInfo] = useState<FfmpegInfo | null>(null);
  const [ffError, setFfError] = useState<string | null>(null);
  const [encoder, setEncoder] = useState('libx264');
  const [jobId] = useState(() => `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!native) return;
    let alive = true;
    ffmpegInfo()
      .then((info) => {
        if (!alive) return;
        setFfInfo(info);
        // Default to the fastest hardware encoder present, falling back to x264.
        const best = ENCODER_PREFERENCE.find((e) => info.encoders.includes(e));
        if (best) setEncoder(best);
      })
      .catch((e) => alive && setFfError(e?.message ?? String(e)));
    return () => {
      alive = false;
    };
  }, [native]);

  const encoderOptions = useMemo(() => {
    const avail = ffInfo?.encoders ?? [];
    return ['libx264', ...ENCODER_PREFERENCE.filter((e) => avail.includes(e))];
  }, [ffInfo]);

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
    // On the desktop the user picks the destination up front and ffmpeg writes
    // there directly — a multi-GB render never passes through a Blob.
    let outPath: string | null = null;
    if (native) {
      try {
        outPath = await saveDialog('nabivideo-export.mp4');
      } catch (e: any) {
        setError(`저장 위치 선택 실패: ${e?.message ?? e}`);
        return;
      }
      if (!outPath) return; // cancelled
    }

    setRunning(true);
    setError(null);
    setDoneUrl(null);
    setDonePath(null);
    setProgress(0);
    try {
      const state = useEditor.getState();
      const dur = projectDuration(state);
      const buildArgs = {
        clips: Object.values(state.clips),
        assets: state.assets,
        tracks: state.tracks,
        settings: state.settings,
        duration: dur,
        masterVolume: state.masterVolume,
        subtitles: Object.values(state.subtitles),
        rangeStart: range.start,
        rangeEnd: range.end,
      };
      const onInfo = (info: { phase: string; progress: number; log?: string }) => {
        setPhase(info.phase);
        if (info.progress >= 0) setProgress(info.progress);
        if (info.log) setLogs((l) => [...l.slice(-200), info.log!]);
      };

      if (native && outPath) {
        const res = await exportProjectNative(buildArgs, onInfo, { outPath, encoder, jobId });
        setDonePath(res);
      } else {
        const blob = await exportProject(buildArgs, onInfo);
        setDoneUrl(URL.createObjectURL(blob));
      }
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
          {!running && !doneUrl && !donePath && (
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
              {native && (
                <div className="encoder-pick">
                  <label>
                    인코더
                    <select value={encoder} onChange={(e) => setEncoder(e.target.value)}>
                      {encoderOptions.map((e) => (
                        <option key={e} value={e}>
                          {ENCODER_LABELS[e] ?? e}
                        </option>
                      ))}
                    </select>
                  </label>
                  {ffInfo && (
                    <p className="hint">
                      {ffInfo.version.replace(/^ffmpeg version /, 'FFmpeg ')}
                      {ffInfo.encoders.length === 0 && ' — 하드웨어 인코더 없음 (소프트웨어 인코딩)'}
                    </p>
                  )}
                  {ffError && (
                    <p className="error">
                      FFmpeg를 찾지 못했습니다: {ffError}
                      <br />
                      ffmpeg를 설치하고 PATH에 추가하거나, NABIVIDEO_FFMPEG 환경변수로 경로를 지정하세요.
                    </p>
                  )}
                </div>
              )}
              <button className="primary" onClick={start} disabled={native && !!ffError}>
                렌더링 시작
              </button>
            </>
          )}
          {running && (
            <>
              <p>{phase}</p>
              <progress max={1} value={progress} style={{ width: '100%' }} />
              {native && (
                <button onClick={() => ffmpegCancel(jobId).catch(() => {})}>렌더링 취소</button>
              )}
              <pre className="log">{logs.slice(-15).join('\n')}</pre>
            </>
          )}
          {donePath && (
            <>
              <p>
                완료되었습니다. <strong>{formatBytes(donePath.bytes)}</strong>
              </p>
              <pre className="log">{donePath.path}</pre>
              <button className="primary" onClick={() => revealPath(donePath.path).catch(() => {})}>
                폴더에서 보기
              </button>
            </>
          )}
          {doneUrl && (
            <>
              <p>완료되었습니다.</p>
              <video src={doneUrl} controls style={{ width: '100%', maxHeight: 360 }} />
              <a className="download-btn" href={doneUrl} download="nabivideo-export.mp4">
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
