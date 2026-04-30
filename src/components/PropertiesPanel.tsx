import { useEditor } from '../state/editorStore';
import type { Clip } from '../types';

export function PropertiesPanel() {
  const selection = useEditor((s) => s.selection);
  const clips = useEditor((s) => s.clips);
  const assets = useEditor((s) => s.assets);
  const tracks = useEditor((s) => s.tracks);
  const updateClip = useEditor((s) => s.updateClip);
  const detachAudio = useEditor((s) => s.detachAudio);

  if (selection.length === 0) {
    return (
      <div className="props">
        <div className="props-empty">클립을 선택하세요</div>
      </div>
    );
  }

  // For multi-select, only allow editing fade/volume/muted with first as source
  const first = clips[selection[0]];
  if (!first) return null;
  const asset = assets[first.assetId];
  const clipDur = first.outPoint - first.inPoint;
  const maxFade = clipDur / 2;

  const apply = (patch: Partial<Clip>) => {
    for (const id of selection) updateClip(id, patch);
  };

  return (
    <div className="props">
      <div className="props-title">속성 ({selection.length}개 선택)</div>
      <div className="props-asset">{asset?.name ?? '?'}</div>
      <Field label="시작 (초)">
        <input
          type="number"
          step="0.05"
          value={first.start.toFixed(2)}
          onChange={(e) => apply({ start: Math.max(0, parseFloat(e.target.value) || 0) })}
        />
      </Field>
      <Field label="In (초)">
        <input
          type="number"
          step="0.05"
          min={0}
          max={asset?.duration ?? 9999}
          value={first.inPoint.toFixed(2)}
          onChange={(e) => {
            const v = Math.max(0, Math.min(first.outPoint - 0.1, parseFloat(e.target.value) || 0));
            apply({ inPoint: v });
          }}
        />
      </Field>
      <Field label="Out (초)">
        <input
          type="number"
          step="0.05"
          value={first.outPoint.toFixed(2)}
          onChange={(e) => {
            const v = Math.max(first.inPoint + 0.1, Math.min(asset?.duration ?? 9999, parseFloat(e.target.value) || 0));
            apply({ outPoint: v });
          }}
        />
      </Field>
      <SliderInput
        label="페이드 인 (초)"
        value={Math.min(first.fadeIn, maxFade)}
        min={0}
        max={maxFade}
        step={0.05}
        decimals={2}
        onChange={(v) => apply({ fadeIn: v })}
      />
      <SliderInput
        label="페이드 아웃 (초)"
        value={Math.min(first.fadeOut, maxFade)}
        min={0}
        max={maxFade}
        step={0.05}
        decimals={2}
        onChange={(v) => apply({ fadeOut: v })}
      />
      <SliderInput
        label="오디오 여운 (L-cut, 초)"
        value={first.audioTail ?? 0}
        min={0}
        max={5}
        step={0.05}
        decimals={2}
        onChange={(v) => apply({ audioTail: v })}
      />
      <SliderInput
        label="속도 (%)"
        value={(first.speed ?? 1) * 100}
        min={25}
        max={400}
        step={1}
        decimals={0}
        suffix="%"
        onChange={(v) => apply({ speed: v / 100 })}
      />
      <SliderInput
        label="볼륨 (%)"
        value={first.volume * 100}
        min={0}
        max={200}
        step={1}
        decimals={0}
        suffix="%"
        onChange={(v) => apply({ volume: v / 100 })}
      />
      <Field label="음소거">
        <input
          type="checkbox"
          checked={first.muted}
          onChange={(e) => apply({ muted: e.target.checked })}
        />
      </Field>
      <Field label="컬러 라벨">
        <div className="color-row">
          {[undefined, '#ff5470', '#f7c948', '#7ad07a', '#4fb6ff', '#a674ff', '#ff8a50'].map((c, i) => (
            <button
              key={i}
              className={`color-swatch ${(first.color ?? null) === (c ?? null) ? 'on' : ''}`}
              style={{ background: c ?? 'transparent', borderStyle: c ? 'solid' : 'dashed' }}
              title={c ?? '없음'}
              onClick={() => apply({ color: c })}
            />
          ))}
        </div>
      </Field>
      <details className="props-section">
        <summary>변환 (위치/크기/회전)</summary>
        <SliderInput
          label="X 오프셋 (px)"
          value={first.transformX ?? 0}
          min={-2000}
          max={2000}
          step={1}
          decimals={0}
          onChange={(v) => apply({ transformX: v })}
        />
        <SliderInput
          label="Y 오프셋 (px)"
          value={first.transformY ?? 0}
          min={-2000}
          max={2000}
          step={1}
          decimals={0}
          onChange={(v) => apply({ transformY: v })}
        />
        <SliderInput
          label="크기 (%)"
          value={(first.transformScale ?? 1) * 100}
          min={5}
          max={400}
          step={1}
          decimals={0}
          suffix="%"
          onChange={(v) => apply({ transformScale: v / 100 })}
        />
        <SliderInput
          label="회전 (°)"
          value={first.transformRotation ?? 0}
          min={-180}
          max={180}
          step={1}
          decimals={0}
          suffix="°"
          onChange={(v) => apply({ transformRotation: v })}
        />
        <SliderInput
          label="투명도 (%)"
          value={(first.transformOpacity ?? 1) * 100}
          min={0}
          max={100}
          step={1}
          decimals={0}
          suffix="%"
          onChange={(v) => apply({ transformOpacity: v / 100 })}
        />
        <button
          onClick={() =>
            apply({
              transformX: 0,
              transformY: 0,
              transformScale: 1,
              transformRotation: 0,
              transformOpacity: 1,
            })
          }
        >
          변환 리셋
        </button>
      </details>
      <details className="props-section">
        <summary>색 보정</summary>
        <SliderInput
          label="밝기"
          value={first.brightness ?? 0}
          min={-1}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(v) => apply({ brightness: v })}
        />
        <SliderInput
          label="대비"
          value={first.contrast ?? 1}
          min={0}
          max={2}
          step={0.01}
          decimals={2}
          onChange={(v) => apply({ contrast: v })}
        />
        <SliderInput
          label="채도"
          value={first.saturation ?? 1}
          min={0}
          max={3}
          step={0.01}
          decimals={2}
          onChange={(v) => apply({ saturation: v })}
        />
        <SliderInput
          label="감마"
          value={first.gamma ?? 1}
          min={0.1}
          max={3}
          step={0.01}
          decimals={2}
          onChange={(v) => apply({ gamma: v })}
        />
        <button
          onClick={() => apply({ brightness: 0, contrast: 1, saturation: 1, gamma: 1 })}
        >
          색 보정 리셋
        </button>
      </details>
      {(() => {
        const onVideoTrack = tracks.find((t) => t.id === first.trackId)?.kind === 'video';
        if (!onVideoTrack || !asset?.hasAudio) return null;
        return (
          <button
            onClick={() => {
              for (const id of selection) detachAudio(id);
            }}
            title="이 비디오 클립의 오디오를 새 오디오 트랙 클립으로 분리하고, 원본은 음소거합니다"
          >
            🎙 오디오 분리
          </button>
        );
      })()}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="props-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  decimals = 2,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="props-field slider-input">
      <span>{label}</span>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value.toFixed(decimals)}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            if (!isFinite(raw)) return;
            onChange(Math.max(min, Math.min(max, raw)));
          }}
        />
        {suffix && <span className="slider-suffix">{suffix}</span>}
      </div>
    </div>
  );
}
