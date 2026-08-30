/** Generated layers and the beat-accent envelope.
 *
 * Two things live here because they are two halves of the same job — putting
 * *light* on an LED wall in time with the music, without regenerating any AI
 * footage:
 *
 *  1. `createGeneratorAsset` paints a solid / gradient / radial layer to a PNG
 *     and returns it as an ordinary `MediaAsset`. Materialising it as a real
 *     file is deliberate: preview caching, export inputs, the project zip and
 *     autosave then need no knowledge of generators at all.
 *  2. `pulseAt` / `pulseGeqExpr` are the SAME envelope evaluated for the two
 *     renderers — the canvas preview needs a number per frame, the export
 *     needs one FFmpeg expression. Keeping them adjacent is what stops the
 *     two from drifting, which is the failure mode this codebase has hit
 *     before (preview vs. export disagreeing on blend colourspace).
 */
import type { GeneratorSpec, MediaAsset, PulseEnvelope } from '../types';

const uid = () => Math.random().toString(36).slice(2, 10);

/** `#rrggbb` (+ alpha 0..1) → `rgba()`, so the spec's opacity can be baked in. */
function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color; // already a CSS colour — use as-is
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Fully transparent version of a colour, for gradient stops that fade out. */
function transparent(color: string): string {
  return withAlpha(color, 0);
}

/** Paint a spec onto a 2D context sized `w`x`h`. Exported so a preview
 *  swatch can reuse exactly the same painting code as the real asset. */
export function paintGenerator(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: GeneratorSpec
): void {
  ctx.clearRect(0, 0, w, h);
  const op = spec.opacity ?? 1;

  if (spec.type === 'solid') {
    ctx.fillStyle = withAlpha(spec.color, op);
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (spec.type === 'linear') {
    // Angle in degrees, 0 = left→right. The ramp is drawn across the
    // rectangle's projection on that direction so it always spans the canvas.
    const rad = ((spec.angle ?? 0) * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;
    const half = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h) / 2;
    const g = ctx.createLinearGradient(
      cx - Math.cos(rad) * half,
      cy - Math.sin(rad) * half,
      cx + Math.cos(rad) * half,
      cy + Math.sin(rad) * half
    );
    g.addColorStop(0, withAlpha(spec.color, op));
    g.addColorStop(1, withAlpha(spec.color2 ?? transparent(spec.color), op));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // radial — a centre wash, or (inverted) a vignette. Radii are fractions of
  // the half-diagonal so the same numbers behave the same on any canvas ratio,
  // which matters when the project is 32:9 and the layer was authored at 16:9.
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(w, h) / 2;
  const inner = Math.max(0, Math.min(1, spec.innerRadius ?? 0)) * maxR;
  const outer = Math.max(inner + 1, Math.min(1, spec.outerRadius ?? 0.75) * maxR);
  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  const edge = spec.color2 ?? transparent(spec.color);
  if (spec.invert) {
    g.addColorStop(0, withAlpha(edge, op));
    g.addColorStop(1, withAlpha(spec.color, op));
    // Outside `outer` a radial gradient keeps its last stop, so an inverted
    // one already tints the corners — which is what a vignette wants.
  } else {
    g.addColorStop(0, withAlpha(spec.color, op));
    g.addColorStop(1, withAlpha(edge, op));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function defaultName(spec: GeneratorSpec): string {
  const kind =
    spec.type === 'solid' ? '단색' : spec.type === 'linear' ? '그라데이션' : spec.invert ? '비네트' : '방사형';
  return `${kind} ${spec.color}`;
}

/**
 * Paint `spec` at `w`x`h` and wrap the PNG as a `MediaAsset`.
 *
 * The asset is an image in every respect (`isImage`, nominal 600 s duration,
 * `hasVideo` so it composites on a video track) — the only difference is that
 * `generator` is set, which is how the UI knows it can be repainted.
 */
export async function createGeneratorAsset(
  spec: GeneratorSpec,
  w: number,
  h: number,
  name?: string
): Promise<MediaAsset> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(w));
  canvas.height = Math.max(2, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.');
  paintGenerator(ctx, canvas.width, canvas.height, spec);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 생성 실패'))), 'image/png')
  );
  const label = name ?? defaultName(spec);
  const file = new File([blob], `${label.replace(/[^\w가-힣.-]+/g, '_')}.png`, {
    type: 'image/png',
    lastModified: Date.now(),
  });
  const url = URL.createObjectURL(file);
  return {
    id: uid(),
    name: label,
    file,
    url,
    duration: 600,
    width: canvas.width,
    height: canvas.height,
    hasVideo: true,
    hasAudio: false,
    isImage: true,
    thumbnail: url,
    generator: spec,
  };
}

/** Repaint an existing generator asset (colour change, canvas resize). The id
 *  is preserved so every clip referencing it keeps working; the caller is
 *  responsible for revoking the old object URL. */
export async function repaintGeneratorAsset(
  asset: MediaAsset,
  spec: GeneratorSpec,
  w: number,
  h: number
): Promise<MediaAsset> {
  const next = await createGeneratorAsset(spec, w, h, asset.name);
  return { ...next, id: asset.id, name: asset.name };
}

export const PULSE_DEFAULTS: PulseEnvelope = {
  period: 0.5,
  phase: 0,
  decay: 0.18,
  min: 0,
  max: 1,
};

/** Normalise a pulse so both renderers see identical, safe numbers. */
function norm(p: PulseEnvelope) {
  const period = Math.max(0.02, p.period);
  const decay = Math.max(0.01, Math.min(period, p.decay));
  const lo = Math.max(0, Math.min(1, p.min));
  const hi = Math.max(0, Math.min(1, p.max));
  return { period, decay, lo, hi };
}

/**
 * The envelope at an absolute timeline time. Returns a 0..1 multiplier.
 *
 * `phase` is absolute, so `t` must be too — pass the playhead, not a
 * clip-local offset.
 */
export function pulseAt(p: PulseEnvelope, t: number): number {
  const { period, decay, lo, hi } = norm(p);
  let d = (t - p.phase) % period;
  if (d < 0) d += period;
  const ramp = Math.max(0, 1 - d / decay);
  return lo + (hi - lo) * ramp;
}

/**
 * The same curve as an FFmpeg expression over `T`, for a `geq` source.
 *
 * `startOffset` is where the generated source's own clock (T = 0) sits on the
 * project timeline — i.e. the clip's `start`, since the source is built inside
 * the clip's chain and only later `tpad`ed into place. Folding the phase in
 * here is what keeps export accents on the same beats as the preview's.
 */
export function pulseGeqExpr(p: PulseEnvelope, startOffset: number): string {
  const { period, decay, lo, hi } = norm(p);
  // Local phase in [0, period): the time within the source at which the first
  // peak lands.
  let localPhase = (p.phase - startOffset) % period;
  if (localPhase < 0) localPhase += period;
  const f = (n: number) => n.toFixed(4);
  // max(0, 1 - mod(T - phase, period)/decay), with the mod made non-negative
  // by adding one period before taking it.
  // Commas are left raw: callers wrap the expression in single quotes inside
  // the filtergraph, the same way the audio ducker's `volume=eval=frame`
  // expression is emitted.
  const d = `mod(T-${f(localPhase)}+${f(period)},${f(period)})`;
  const ramp = `max(0,1-${d}/${f(decay)})`;
  return `${f(lo)}+${f(hi - lo)}*${ramp}`;
}

/** True when the envelope actually does something (a flat one is skipped so
 *  no extra filters are emitted for it). */
export function pulseIsActive(p?: PulseEnvelope): p is PulseEnvelope {
  if (!p) return false;
  return Math.abs(p.max - p.min) > 0.001 && p.period > 0.02;
}
