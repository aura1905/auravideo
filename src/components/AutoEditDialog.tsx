import { useMemo, useState } from 'react';
import { useEditor } from '../state/editorStore';
import { formatTime } from '../utils/media';
import {
  runTalkingHeadCleanup,
  runSlideshow,
  runHighlightReel,
  runBeatCut,
  TALKING_HEAD_DEFAULTS,
  SLIDESHOW_DEFAULTS,
  HIGHLIGHT_DEFAULTS,
  BEAT_CUT_DEFAULTS,
  type AutoEditProgress,
  type TalkingHeadResult,
  type SlideshowResult,
  type HighlightResult,
  type BeatCutResult,
} from '../utils/autoEdit';
import type { WhisperModel } from '../utils/whisper';

type Template = 'talking-head' | 'slideshow' | 'highlight' | 'beat-cut';

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
  {
    value: 'highlight',
    label: '⭐ 하이라이트 릴',
    subtitle: '여러 영상의 소리가 큰 (= 흥미로운) 구간을 자동 추출해 짧은 리얼로 조립. 게임/스포츠 클립용.',
  },
  {
    value: 'beat-cut',
    label: '🥁 비트컷',
    subtitle: 'BGM의 비트를 감지해 영상 컷을 박자에 맞춤. 뮤직비디오 스타일.',
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
  { value: 'Xenova/whisper-tiny', label: 'tiny (40MB · 빠름, 영어 OK / 한국어 부정확)' },
  { value: 'Xenova/whisper-base', label: 'base (150MB · 균형)' },
  { value: 'Xenova/whisper-small', label: 'small (500MB · 한국어 권장)' },
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

  // Highlight reel state — uses same asset pool as slideshow (videos w/ audio)
  const highlightEligible = useMemo(() => {
    return Object.values(assets).filter((a) => a.hasVideo && a.hasAudio && !a.isImage);
  }, [assets]);
  const [highlightAssets, setHighlightAssets] = useState<Set<string>>(
    () => new Set(highlightEligible.map((a) => a.id))
  );
  const [hlOpts, setHlOpts] = useState({ ...HIGHLIGHT_DEFAULTS });

  // Beat-cut state — needs BGM audio asset + video assets
  const audioEligible = useMemo(() => {
    return Object.values(assets).filter((a) => a.hasAudio);
  }, [assets]);
  const videoOnlyEligible = useMemo(() => {
    return Object.values(assets).filter((a) => a.hasVideo && !a.isImage);
  }, [assets]);
  const [beatVideoAssets, setBeatVideoAssets] = useState<Set<string>>(
    () => new Set(videoOnlyEligible.map((a) => a.id))
  );
  const [bcOpts, setBcOpts] = useState(() => ({
    ...BEAT_CUT_DEFAULTS,
    bgmAssetId: audioEligible[0]?.id ?? '',
  }));

  // Shared run state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [doneTH, setDoneTH] = useState<TalkingHeadResult | null>(null);
  const [doneSS, setDoneSS] = useState<SlideshowResult | null>(null);
  const [doneHL, setDoneHL] = useState<HighlightResult | null>(null);
  const [doneBC, setDoneBC] = useState<BeatCutResult | null>(null);

  const start = async () => {
    setError(null);
    setDoneTH(null);
    setDoneSS(null);
    setDoneHL(null);
    setDoneBC(null);
    setProgress(0);
    setPhase('');
    setRunning(true);
    const onProg = (p: AutoEditProgress) => {
      setPhase(p.phase);
      if (p.progress >= 0) setProgress(p.progress);
    };
    try {
      if (template === 'talking-head') {
        if (!clipId) throw new Error('대상 클립을 선택하세요.');
        const result = await runTalkingHeadCleanup(clipId, thOpts, onProg);
        setDoneTH(result);
      } else if (template === 'slideshow') {
        if (selectedAssets.size === 0) throw new Error('슬라이드에 사용할 미디어를 1개 이상 선택하세요.');
        const result = runSlideshow([...selectedAssets], slideOpts);
        setDoneSS(result);
      } else if (template === 'highlight') {
        if (highlightAssets.size === 0) throw new Error('하이라이트에 사용할 영상을 1개 이상 선택하세요.');
        const result = await runHighlightReel([...highlightAssets], hlOpts, onProg);
        setDoneHL(result);
      } else if (template === 'beat-cut') {
        if (beatVideoAssets.size === 0) throw new Error('컷할 영상을 1개 이상 선택하세요.');
        if (!bcOpts.bgmAssetId) throw new Error('BGM 자산을 선택하세요.');
        const result = await runBeatCut([...beatVideoAssets], bcOpts, onProg);
        setDoneBC(result);
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  자를 무음: 최소 {thOpts.minSilenceSec.toFixed(2)}초
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.05}
                    value={thOpts.minSilenceSec}
                    onChange={(e) => setThOpts({ ...thOpts, minSilenceSec: parseFloat(e.target.value) })}
                    disabled={running}
                    title="이보다 짧은 무음은 그대로 남겨둠 (= 단어 사이 짧은 호흡 보존)"
                  />
                </label>
                <label>
                  자를 무음: 최대 {thOpts.maxSilenceSec.toFixed(1)}초
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={0.5}
                    value={thOpts.maxSilenceSec}
                    onChange={(e) => setThOpts({ ...thOpts, maxSilenceSec: parseFloat(e.target.value) })}
                    disabled={running}
                    title="이보다 긴 무음은 의도된 침묵으로 보고 그대로 남겨둠"
                  />
                </label>
              </div>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={thOpts.removeFillerWords}
                  onChange={(e) => setThOpts({ ...thOpts, removeFillerWords: e.target.checked })}
                  disabled={running}
                  title="word-level Whisper에서 음/어/uh/um 등 필러를 무음과 함께 잘라냄"
                />
                필러워드 자동 제거 (음 · 어 · uh · um · …)
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

          {template === 'highlight' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ marginBottom: 4 }}>
                  사용할 영상 ({highlightAssets.size}/{highlightEligible.length}) — 오디오 있는 비디오만
                </div>
                <div
                  style={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: 6,
                  }}
                >
                  {highlightEligible.length === 0 && (
                    <div style={{ color: 'var(--muted)', padding: 8 }}>
                      오디오가 있는 비디오 자산이 없습니다. (소리 없는 영상은 점수 매기기 불가)
                    </div>
                  )}
                  {highlightEligible.map((a) => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                      <input
                        type="checkbox"
                        checked={highlightAssets.has(a.id)}
                        onChange={(e) => {
                          const next = new Set(highlightAssets);
                          if (e.target.checked) next.add(a.id);
                          else next.delete(a.id);
                          setHighlightAssets(next);
                        }}
                        disabled={running}
                      />
                      <span>🎞 {a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  목표 총 길이 (초): {hlOpts.targetDurationSec}
                  <input
                    type="range"
                    min={5}
                    max={180}
                    step={1}
                    value={hlOpts.targetDurationSec}
                    onChange={(e) => setHlOpts({ ...hlOpts, targetDurationSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
                <label>
                  컷당 길이 (초): {hlOpts.segmentSec.toFixed(1)}
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={hlOpts.segmentSec}
                    onChange={(e) => setHlOpts({ ...hlOpts, segmentSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  크로스페이드 (초): {hlOpts.crossfadeSec.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={hlOpts.crossfadeSec}
                    onChange={(e) => setHlOpts({ ...hlOpts, crossfadeSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
                <label>
                  점수 하한: {hlOpts.scoreFloor.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={hlOpts.scoreFloor}
                    onChange={(e) => setHlOpts({ ...hlOpts, scoreFloor: parseFloat(e.target.value) })}
                    disabled={running}
                    title="0 = 모든 피크 허용, 0.5 = 최대 점수의 50% 이상만 채택"
                  />
                </label>
              </div>
              <label>
                배치 위치
                <select
                  value={hlOpts.insertAt}
                  onChange={(e) => setHlOpts({ ...hlOpts, insertAt: e.target.value as any })}
                  disabled={running}
                >
                  <option value="end">마지막 클립 뒤</option>
                  <option value="playhead">현재 플레이헤드</option>
                  <option value="zero">타임라인 처음</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={hlOpts.generateSubtitles}
                  onChange={(e) => setHlOpts({ ...hlOpts, generateSubtitles: e.target.checked })}
                  disabled={running}
                />
                자막 생성 (Whisper, 각 컷마다 실행하므로 시간 더 걸림)
              </label>
            </div>
          )}

          {template === 'beat-cut' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label>
                BGM (비트 검출 대상)
                <select
                  value={bcOpts.bgmAssetId}
                  onChange={(e) => setBcOpts({ ...bcOpts, bgmAssetId: e.target.value })}
                  disabled={running || audioEligible.length === 0}
                >
                  {audioEligible.length === 0 && <option value="">(오디오 있는 자산이 없습니다)</option>}
                  {audioEligible.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.isImage ? '🖼' : a.hasVideo ? '🎞' : '🎵'} {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <div style={{ marginBottom: 4 }}>
                  컷할 영상 ({beatVideoAssets.size}/{videoOnlyEligible.length})
                </div>
                <div
                  style={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: 6,
                  }}
                >
                  {videoOnlyEligible.length === 0 && (
                    <div style={{ color: 'var(--muted)', padding: 8 }}>
                      비디오 자산이 없습니다.
                    </div>
                  )}
                  {videoOnlyEligible.map((a) => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                      <input
                        type="checkbox"
                        checked={beatVideoAssets.has(a.id)}
                        onChange={(e) => {
                          const next = new Set(beatVideoAssets);
                          if (e.target.checked) next.add(a.id);
                          else next.delete(a.id);
                          setBeatVideoAssets(next);
                        }}
                        disabled={running}
                      />
                      <span>🎞 {a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  비트당 컷: {bcOpts.beatsPerCut}
                  <input
                    type="range"
                    min={1}
                    max={16}
                    step={1}
                    value={bcOpts.beatsPerCut}
                    onChange={(e) => setBcOpts({ ...bcOpts, beatsPerCut: parseInt(e.target.value, 10) })}
                    disabled={running}
                    title="1 = 매 비트마다, 4 = 한 마디(4/4)마다, 8 = 두 마디마다"
                  />
                </label>
                <label>
                  최대 길이 (초): {bcOpts.maxDurationSec}
                  <input
                    type="range"
                    min={5}
                    max={300}
                    step={5}
                    value={bcOpts.maxDurationSec}
                    onChange={(e) => setBcOpts({ ...bcOpts, maxDurationSec: parseFloat(e.target.value) })}
                    disabled={running}
                    title="0 = BGM 전체 길이까지"
                  />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  크로스페이드 (초): {bcOpts.crossfadeSec.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.05}
                    value={bcOpts.crossfadeSec}
                    onChange={(e) => setBcOpts({ ...bcOpts, crossfadeSec: parseFloat(e.target.value) })}
                    disabled={running}
                  />
                </label>
                <label>
                  영상 시작 오프셋 (초): {bcOpts.videoStartOffsetSec.toFixed(1)}
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={0.5}
                    value={bcOpts.videoStartOffsetSec}
                    onChange={(e) => setBcOpts({ ...bcOpts, videoStartOffsetSec: parseFloat(e.target.value) })}
                    disabled={running}
                    title="각 영상의 인트로를 건너뛰고 싶을 때 사용"
                  />
                </label>
              </div>
              <label>
                배치 위치
                <select
                  value={bcOpts.insertAt}
                  onChange={(e) => setBcOpts({ ...bcOpts, insertAt: e.target.value as any })}
                  disabled={running}
                >
                  <option value="end">마지막 클립 뒤</option>
                  <option value="playhead">현재 플레이헤드</option>
                  <option value="zero">타임라인 처음</option>
                </select>
              </label>
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
          {doneHL && (
            <div style={{ marginTop: 12, padding: 8, background: 'rgba(78,224,122,0.12)', borderRadius: 4 }}>
              완료: 하이라이트 <b>{doneHL.segmentsPlaced}</b>개 · 총 <b>{doneHL.totalDuration.toFixed(1)}초</b>
              {doneHL.subtitlesAdded > 0 && <> · 자막 <b>{doneHL.subtitlesAdded}</b>개</>}.
              <br />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>마음에 안 들면 Ctrl+Z로 되돌리세요.</span>
            </div>
          )}
          {doneBC && (
            <div style={{ marginTop: 12, padding: 8, background: 'rgba(78,224,122,0.12)', borderRadius: 4 }}>
              완료: <b>{doneBC.bpm}</b> BPM 검출 · <b>{doneBC.beatsTotal}</b>개 비트 · 컷 <b>{doneBC.cutsPlaced}</b>개
              · 총 <b>{doneBC.totalDuration.toFixed(1)}초</b>.
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
            {doneTH || doneSS || doneHL || doneBC ? '닫기' : '취소'}
          </button>
          <button className="primary" onClick={start} disabled={running}>
            {running ? '실행 중…' : '실행'}
          </button>
        </div>
      </div>
    </div>
  );
}
