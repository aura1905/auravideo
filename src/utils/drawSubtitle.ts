import type { Subtitle } from '../types';

/** Draw a single subtitle onto a 2D canvas context. Used by both the live
 * preview and the export PNG renderer so the result on screen matches the
 * exported video frame-for-frame. The caller is responsible for setting
 * `ctx.globalAlpha` (for fade in/out) — this routine writes its own font
 * properties but doesn't touch alpha. */
export function paintSubtitle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: Subtitle
) {
  const weight = s.bold ? 'bold' : 'normal';
  const style = s.italic ? 'italic' : 'normal';
  const family = s.fontFamily || 'sans-serif';
  ctx.font = `${style} ${weight} ${s.fontSize}px ${family}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = s.align;
  const cx = W / 2 + s.x;
  const cy = H / 2 + s.y;
  const lines = s.text.split(/\r?\n/);
  const lineHeight = s.fontSize * 1.2;
  const totalH = lineHeight * lines.length;
  const topY = cy - totalH / 2 + lineHeight / 2;

  // Background box (drawn first so text sits on top)
  if (s.bgColor) {
    let widest = 0;
    for (const line of lines) {
      const m = ctx.measureText(line || ' ');
      if (m.width > widest) widest = m.width;
    }
    const pad = s.bgPadding ?? 0;
    let bgX: number;
    let bgW: number;
    if (s.bgWidth === 'full') {
      bgX = 0;
      bgW = W;
    } else {
      // text-fitted, anchored by alignment relative to cx
      let leftEdge: number;
      if (s.align === 'left') leftEdge = cx;
      else if (s.align === 'right') leftEdge = cx - widest;
      else leftEdge = cx - widest / 2;
      bgX = leftEdge - pad;
      bgW = widest + pad * 2;
    }
    const bgY = topY - lineHeight / 2 - pad;
    const bgH = totalH + pad * 2;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * (s.bgOpacity ?? 1);
    ctx.fillStyle = s.bgColor;
    ctx.fillRect(bgX, bgY, bgW, bgH);
    ctx.globalAlpha = prevAlpha;
  }

  // Outline first so the fill is clean over the strokes.
  if (s.outline > 0) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = s.outline * 2;
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => ctx.strokeText(line, cx, topY + i * lineHeight));
  }
  ctx.fillStyle = s.color;
  lines.forEach((line, i) => ctx.fillText(line, cx, topY + i * lineHeight));
}

/** Curated list of font families that work in modern browsers + decent
 * Korean fallback for system fonts. Custom names can be typed in the input. */
export const FONT_PRESETS: { label: string; value: string }[] = [
  { label: 'Sans-serif (시스템)', value: 'system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif' },
  { label: 'Sans-serif (기본)', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Pretendard', value: 'Pretendard, sans-serif' },
  { label: 'Noto Sans KR', value: '"Noto Sans KR", sans-serif' },
  { label: 'Apple SD Gothic Neo', value: '"Apple SD Gothic Neo", sans-serif' },
  { label: '맑은 고딕 (Malgun Gothic)', value: '"Malgun Gothic", sans-serif' },
  { label: '나눔고딕 (NanumGothic)', value: 'NanumGothic, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];
