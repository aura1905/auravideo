import { useEditor } from '../state/editorStore';
import type { Clip } from '../types';

export function PropertiesPanel() {
  const selection = useEditor((s) => s.selection);
  const clips = useEditor((s) => s.clips);
  const assets = useEditor((s) => s.assets);
  const updateClip = useEditor((s) => s.updateClip);

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
      <Field label={`페이드 인: ${first.fadeIn.toFixed(2)}s`}>
        <input
          type="range"
          min={0}
          max={maxFade}
          step={0.05}
          value={Math.min(first.fadeIn, maxFade)}
          onChange={(e) => apply({ fadeIn: parseFloat(e.target.value) })}
        />
      </Field>
      <Field label={`페이드 아웃: ${first.fadeOut.toFixed(2)}s`}>
        <input
          type="range"
          min={0}
          max={maxFade}
          step={0.05}
          value={Math.min(first.fadeOut, maxFade)}
          onChange={(e) => apply({ fadeOut: parseFloat(e.target.value) })}
        />
      </Field>
      <Field label={`볼륨: ${(first.volume * 100).toFixed(0)}%`}>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={first.volume}
          onChange={(e) => apply({ volume: parseFloat(e.target.value) })}
        />
      </Field>
      <Field label="음소거">
        <input
          type="checkbox"
          checked={first.muted}
          onChange={(e) => apply({ muted: e.target.checked })}
        />
      </Field>
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
