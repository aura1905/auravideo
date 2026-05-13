import { useMemo, useState } from 'react';
import { useEditor } from '../state/editorStore';
import { formatTime } from '../utils/media';
import {
  runTalkingHeadCleanup,
  runSlideshow,
  TALKING_HEAD_DEFAULTS,
  SLIDESHOW_DEFAULTS,
  type AutoEditProgress,
  type TalkingHeadResult,
  type SlideshowResult,
} from '../utils/autoEdit';
import type { WhisperModel } from '../utils/whisper';

type Template = 'talking-head' | 'slideshow';

const TEMPLATES: { value: Template; label: string; subtitle: string }[] = [
  {
    value: 'talking-head',
    label: '🎙 토킹헤드 정리',
    subtitle: 'Whisper로 무음 구간 자동 제거 + 자막 생성. 강의 / 인터뷰 / 브이로그 정리용.',
  },
  {
    value: 'slideshow',
    label: '🖼 슬라이드쇼',
    subtitle: '이미지·영상을 순서대로 일정 간격으로 배치하고 크로스페이드. 사진 모음 / 포트폴리오용.',
  },
];

const LANGUAGES = [
  { value: 'auto', label: '자동 감지' },
  { value: 'korean', label: '한국어' },
  { value: 'english', label: 'English' },
  { value: 'japanese', label: '日本語' },
  { value: 'chinese', label: '中文' },
];

const MODELS: { value: WhisperModel; label: string }[] = [
  { value: 'Xenova/whisper-tiny', label: 'tiny (40MB · 빠름)' },
  { value: 'Xenova/whisper-base', label: 'base (150MB · 균형)' },
  { value: 'Xenova/whisper-small', label: 'small (500MB · 정확)' },
];

export function AutoEditDialog({ onClose }: { onClose: () => void }) {
  const clips = useEditor((s) => s.clips);
  const assets = useEditor((s) => s.assets);

  const [template, setTemplate] = useState<Template>('talking-head');

  // Talking-head state
  const talkingHeadEligible = useMemo(() => {
    return Object.values(clips).filter((c) => {
      const a = assets[c.assetId];
      return a && a.hasAudio && !a.isImage;
    });
  }, [clips, assets]);
  const [clipId, setClipId] = useState<string>(talkingHeadEligible[0]?.id ?? '');
  const [thOpts, setThOpts] = useState({ ...TALKING_HEAD_DEFAULTS });

  // Slideshow state — eligible = images or any video assets
  const slideEligible = useMemo(() => {
    return Object.values(assets).filter((a) => a.hasVideo || a.isImage);
  }, [assets]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(
    () => new Set(slideEligible.map((a) => a.id))
  );
  const [slideOpts, setSlideOpts] = useState({ ...SLIDESHOW_DEFAULTS });

  // Shared run state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [doneTH, setDoneTH] = useState<TalkingHeadResult | null>(null);
  const [doneSS, setDoneSS] = useState<SlideshowResult | null>(null);

  const start = async () => {
    setError(null);
    setDoneTH(null);
    setDoneSS(null);
    setProgress(0);
    setPhase('');
    setRunning(true);
    try {
      if (template === 'talking-head') {
        if (!clipId) throw new Error('대상 클립을 선택하세요.');
        const result = await runTalkingHeadCleanup(
          clipId,
          thOpts,
          (p: AutoEditProgress) => {
            setPhase(p.phase);
            if (p.progress >= 0) setProgress(p.progress);
          }
        );
        setDoneTH(result);
      } else {
        if (selectedAssets.size === 0) throw new Error('슬라이드에 사용할 미디어를 1개 이상 선택하세요.');
        const result = runSlideshow([...selectedAssets], slideOpts);
        setDoneSS(result);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 480, maxWidth: 640 }}>
        <div className="modal-title">✨ 자동 편집</div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {TEMPLATES.map((t) => (
              <label
                key={t.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: template === t.value ? 'rgba(79,140,255,0.12)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.value}
                  checked={template === t.value}
                  onChange={() => setTemplate(t.value)}
                  disabled={running}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.subtitle}</div>
                </div>
              </label>
            ))}
          </div>

          {template === 'talking-head' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label>
                대상 클립
                <select
                  value={clipId}
                  onChange={(e) => setClipId(e.target.value)}
                  disabled={running || talkingHeadEligible.length === 0}
                  style={{ width: '100%' }}
                >
                  {talkingHeadEligible.length === 0 && <option value="">(오디오 있는 클립이 없습니다)</option>}
                  {talkingHeadEligible.map((c) => {
                    const a = assets[c.assetId];
                    return (
                      <option key={c.id} value={c.id}>
                        {a?.name ?? c.id} · {formatTime(c.outPoint - c.inPoint)}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  언어
                  <select
                    value={thOpts.language}
                    onChange={(e) => setThOpts({ ...thOpts, language: e.target.value })}
                    disabled={running}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Whisper 모델
                  <select
                    value={thOpts.model}
                    onChange={(e) => setThOpts({ ...thOpts, model: e.target.value as WhisperModel })}
                    disabled={running}
                  >
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                자를 무음 길이 (초): {thOpts.minSilenceSec.toFixed(2)}
                <input
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.05}
                  value={thOpts.minSilenceSec}
                  onChange={(e) => setThOpts({ ...thOpts, minSilenceSec: parseFloat(e.target.value) })}
                  disabled={running}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  앞 여유 (초): {thOpts.leadPadSec.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.05}
                    value={thOpts.leadPadSec}
                    onChange={(e) => setThOpts({ ...thOpts, leadPadSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
                <label>
                  뒤 여유 (초): {thOpts.tailPadSec.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.05}
                    value={thOpts.tailPadSec}
                    onChange={(e) => setThOpts({ ...thOpts, tailPadSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
              </div>
              <label>
                조각 사이 크로스페이드 (초): {thOpts.crossfadeSec.toFixed(2)}
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={thOpts.crossfadeSec}
                  onChange={(e) => setThOpts({ ...thOpts, crossfadeSec: parseFloat(e.target.value) })}
                  disabled={running}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={thOpts.generateSubtitles}
                  onChange={(e) => setThOpts({ ...thOpts, generateSubtitles: e.target.checked })}
                  disabled={running}
                />
                자막도 함께 생성
              </label>
            </div>
          )}

          {template === 'slideshow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ marginBottom: 4 }}>
                  사용할 미디어 ({selectedAssets.size}/{slideEligible.length})
                </div>
                <div
                  style={{
                    maxHeight: 160,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: 6,
                  }}
                >
                  {slideEligible.length === 0 && (
                    <div style={{ color: 'var(--muted)', padding: 8 }}>
                      이미지·영상 미디어가 없습니다. 먼저 좌측 미디어 라이브러리에 파일을 추가하세요.
                    </div>
                  )}
                  {slideEligible.map((a) => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                      <input
                        type="checkbox"
                        checked={selectedAssets.has(a.id)}
                        onChange={(e) => {
                          const next = new Set(selectedAssets);
                          if (e.target.checked) next.add(a.id);
                          else next.delete(a.id);
                          setSelectedAssets(next);
                        }}
                        disabled={running}
                      />
                      <span>{a.isImage ? '🖼' : '🎞'} {a.name}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedAssets(new Set(slideEligible.map((a) => a.id)))}
                    disabled={running}
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAssets(new Set())}
                    disabled={running}
                  >
                    선택 해제
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  슬라이드당 길이 (초): {slideOpts.perSlideSec.toFixed(1)}
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={slideOpts.perSlideSec}
                    onChange={(e) => setSlideOpts({ ...slideOpts, perSlideSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
                <label>
                  크로스페이드 (초): {slideOpts.crossfadeSec.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={slideOpts.crossfadeSec}
                    onChange={(e) => setSlideOpts({ ...slideOpts, crossfadeSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  배치 위치
                  <select
                    value={slideOpts.insertAt}
                    onChange={(e) => setSlideOpts({ ...slideOpts, insertAt: e.target.value as any })}
                    disabled={running}
                  >
                    <option value="end">마지막 클립 뒤</option>
                    <option value="playhead">현재 플레이헤드</option>
                    <option value="zero">타임라인 처음</option>
                  </select>
                </label>
                <label>
                  순서
                  <select
                    value={slideOpts.order}
                    onChange={(e) => setSlideOpts({ ...slideOpts, order: e.target.value as any })}
                    disabled={running}
                  >
                    <option value="given">선택 순서 그대로</option>
                    <option value="shuffle">랜덤 셔플</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {running && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{phase}</div>
              <progress value={progress >= 0 ? progress : undefined} max={1} style={{ width: '100%' }} />
            </div>
          )}
          {doneTH && (
            <div style={{ marginTop: 12, padding: 8, background: 'rgba(78,224,122,0.12)', borderRadius: 4 }}>
              완료: 잘라낸 무음 구간 <b>{doneTH.cutsRemoved}</b>개 · 유지된 조각 <b>{doneTH.fragmentsKept}</b>개 ·
              자막 <b>{doneTH.subtitlesAdded}</b>개 · 절약 시간 <b>{doneTH.secondsRemoved.toFixed(1)}초</b>.
              <br />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>마음에 안 들면 Ctrl+Z로 되돌리세요.</span>
            </div>
          )}
          {doneSS && (
            <div style={{ marginTop: 12, padding: 8, background: 'rgba(78,224,122,0.12)', borderRadius: 4 }}>
              완료: 슬라이드 <b>{doneSS.slidesPlaced}</b>개 배치 · 총 <b>{doneSS.totalDuration.toFixed(1)}초</b>.
              <br />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>마음에 안 들면 Ctrl+Z로 되돌리세요.</span>
            </div>
          )}
          {error && (
            <pre className="error" style={{ marginTop: 12 }}>
              {error}
            </pre>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={onClose} disabled={running}>
            {doneTH || doneSS ? '닫기' : '취소'}
          </button>
          <button className="primary" onClick={start} disabled={running}>
            {running ? '실행 중…' : '실행'}
          </button>
        </div>
      </div>
    </div>
  );
}
