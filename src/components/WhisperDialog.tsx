import { useMemo, useState } from 'react';
import { useEditor } from '../state/editorStore';
import { extractAudioForWhisper, transcribe, type WhisperModel, type TranscribeProgress } from '../utils/whisper';
import { formatTime } from '../utils/media';

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'auto', label: '자동 감지' },
  { value: 'korean', label: '한국어' },
  { value: 'english', label: 'English' },
  { value: 'japanese', label: '日本語' },
  { value: 'chinese', label: '中文' },
  { value: 'spanish', label: 'Español' },
];

const MODELS: { value: WhisperModel; label: string }[] = [
  { value: 'Xenova/whisper-tiny', label: 'tiny (40MB · 빠름)' },
  { value: 'Xenova/whisper-base', label: 'base (150MB · 균형)' },
  { value: 'Xenova/whisper-small', label: 'small (500MB · 정확)' },
];

export function WhisperDialog({ onClose }: { onClose: () => void }) {
  const clips = useEditor((s) => s.clips);
  const assets = useEditor((s) => s.assets);
  const settings = useEditor((s) => s.settings);
  const addSubtitle = useEditor((s) => s.addSubtitle);

  const eligibleClips = useMemo(() => {
    return Object.values(clips).filter((c) => {
      const a = assets[c.assetId];
      return a && a.hasAudio && !a.isImage;
    });
  }, [clips, assets]);

  const [clipId, setClipId] = useState<string>(eligibleClips[0]?.id ?? '');
  const [language, setLanguage] = useState<string>('korean');
  const [model, setModel] = useState<WhisperModel>('Xenova/whisper-tiny');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onProgress = (p: TranscribeProgress) => {
    setPhase(p.phase);
    if (p.progress >= 0) setProgress(p.progress);
    setLogs((l) => [...l.slice(-30), `${p.phase}${p.log ? ' — ' + p.log : ''}`]);
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
      // Decode the asset's full audio at 16 kHz mono, then slice to the
      // clip's source range.
      const fullMono = await extractAudioForWhisper(a.file, onProgress);
      const SR = 16000;
      const startS = Math.floor(c.inPoint * SR);
      const endS = Math.min(fullMono.length, Math.floor(c.outPoint * SR));
      const slice = fullMono.subarray(startS, endS);
      const chunks = await transcribe(slice, {
        model,
        language: language === 'auto' ? undefined : language,
        onProgress,
      });
      // Map chunks back to the project timeline. The chunk timestamps are in
      // *source-media seconds* relative to the slice start (i.e. inPoint).
      // At clip speed S, every source-second occupies 1/S timeline-seconds,
      // and the clip starts on the timeline at c.start.
      const speed = c.speed ?? 1;
      let added = 0;
      for (const ch of chunks) {
        const startTL = c.start + ch.start / speed;
        const endTL = c.start + ch.end / speed;
        const dur = Math.max(0.3, endTL - startTL);
        addSubtitle({
          start: startTL,
          duration: dur,
          text: ch.text,
          fontSize: Math.max(28, Math.round(settings.height / 22)),
          color: '#ffffff',
          x: 0,
          y: Math.round(settings.height * 0.38),
          align: 'center',
          fadeIn: 0.1,
          fadeOut: 0.1,
          outline: 3,
          bgColor: '#000000',
          bgOpacity: 0.55,
          bgPadding: 14,
          bgWidth: 'text',
        });
        added++;
      }
      setDone({ count: added });
      setPhase(`완료: ${added}개 자막 생성됨`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">자막 자동 생성 (Whisper)</div>
        <div className="modal-body">
          {!running && !done && (
            <>
              <p>
                선택한 클립의 음성을 인식해 자막을 자동 생성합니다. 첫 사용 시 모델 다운로드 (40~500MB)가 필요합니다.
              </p>
              <label className="props-field">
                <span>소스 클립</span>
                <select value={clipId} onChange={(e) => setClipId(e.target.value)}>
                  {eligibleClips.length === 0 && <option value="">(오디오 있는 클립이 없음)</option>}
                  {eligibleClips.map((c) => {
                    const a = assets[c.assetId];
                    const dur = c.outPoint - c.inPoint;
                    return (
                      <option key={c.id} value={c.id}>
                        {a?.name ?? '?'} ({formatTime(c.start)} ~ {formatTime(c.start + dur / (c.speed ?? 1))})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="props-field">
                <span>언어</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </label>
              <label className="props-field">
                <span>모델</span>
                <select value={model} onChange={(e) => setModel(e.target.value as WhisperModel)}>
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                onClick={start}
                disabled={!clipId}
                style={{ marginTop: 12 }}
              >
                자막 생성 시작
              </button>
            </>
          )}
          {running && (
            <>
              <p>{phase}</p>
              <progress max={1} value={progress} style={{ width: '100%' }} />
              <pre className="log">{logs.slice(-15).join('\n')}</pre>
            </>
          )}
          {done && (
            <p>
              <strong>{done.count}개</strong>의 자막이 타임라인에 추가되었습니다.
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
