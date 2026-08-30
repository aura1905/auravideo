import { fetchFile } from '@ffmpeg/util';
import type { Clip, FillMode, MediaAsset, Subtitle, Track, ProjectSettings } from '../types';
import { BLEND_NEUTRAL } from '../types';
import { paintSubtitle } from './drawSubtitle';
import { getFFmpeg } from './ffmpegCore';

export type ProgressCb = (info: { phase: string; progress: number; log?: string }) => void;

/** Render quality tier. `delivery` is for the master that actually ships. */
export type ExportQuality = 'draft' | 'standard' | 'delivery';

export interface BuildArgs {
  clips: Clip[];
  assets: Record<string, MediaAsset>;
  tracks: Track[];
  settings: ProjectSettings;
  duration: number;
  masterVolume: number;
  subtitles: Subtitle[];
  rangeStart?: number;
  rangeEnd?: number;
  /** ffmpeg video encoder name. Only the desktop build can use anything other
   *  than `libx264` — FFmpeg.wasm has no hardware encoders. */
  encoder?: string;
  /**
   * Seconds of tail-into-head crossfade for a seamless loop. A backdrop on a
   * standby LED wall plays forever, so the join back to the start must not
   * pop. The output is shortened by exactly this much — see the graph below.
   * 0 / undefined = ordinary, non-looping output.
   */
  loopBlend?: number;
  /** Quality tier; defaults to `standard`. */
  quality?: ExportQuality;
  /** Absolute output path. Desktop writes the file straight to the location the
   *  user picked; the browser build leaves this unset and reads `output.mp4`
   *  back out of the in-memory FS. */
  outPath?: string;
}

export interface BuiltCommand {
  args: string[];
  fileMap: { fsName: string; file: File }[];
  outName: string;
}

/**
 * Rate-control flags per encoder family. Software x264 uses CRF; the hardware
 * families each spell "constant quality" differently and reject each other's
 * flags, so they can't share one code path.
 */
function encoderArgs(encoder: string, quality: ExportQuality = 'standard'): string[] {
  // One quality number per family. They do not share syntax, and each family's
  // scale differs, so the mapping is explicit rather than computed.
  const q = quality === 'delivery' ? 0 : quality === 'draft' ? 2 : 1;
  const pick = <T,>(delivery: T, standard: T, draft: T) => [delivery, standard, draft][q];

  if (encoder.endsWith('_nvenc')) {
    // NVENC's `cq` with `b:v 0` is its CRF equivalent. p5 is balanced; p7 is
    // the slowest/highest-quality preset and is what delivery should use —
    // a broadcast master is rendered once and looked at on a very large wall.
    return [
      '-c:v', encoder,
      // NVENC defaults to Main; broadcast 8-bit 4:2:0 HD masters are High.
      ...(encoder.startsWith('h264') ? ['-profile:v', 'high'] : []),
      '-preset', pick('p7', 'p5', 'p4'),
      '-rc', 'vbr',
      '-cq', pick('15', '21', '26'),
      '-b:v', '0',
      // Give VBR real headroom; without a maxrate NVENC can starve high-motion
      // frames even at a low cq.
      '-maxrate', pick('120M', '60M', '25M'),
      '-bufsize', pick('240M', '120M', '50M'),
    ];
  }
  if (encoder.endsWith('_qsv')) {
    return ['-c:v', encoder, '-preset', pick('veryslow', 'veryfast', 'veryfast'),
            '-global_quality', pick('16', '21', '26')];
  }
  if (encoder.endsWith('_amf')) {
    return ['-c:v', encoder, '-quality', pick('quality', 'balanced', 'speed'), '-rc', 'cqp',
            '-qp_i', pick('16', '22', '27'), '-qp_p', pick('18', '24', '29')];
  }
  if (encoder.endsWith('_videotoolbox')) {
    return ['-c:v', encoder, '-q:v', pick('75', '55', '40')];
  }
  return ['-c:v', 'libx264', '-profile:v', 'high',
          '-preset', pick('slow', 'veryfast', 'veryfast'),
          '-crf', pick('16', '20', '25')];
}

/**
 * Colour metadata. Untagged output is a real delivery problem: the file says
 * nothing about how to interpret its values, so whoever receives it guesses —
 * and a wall that guesses wrong shifts colour. Everything in this pipeline is
 * ordinary HD Rec.709 limited-range, so say so explicitly.
 */
const COLOR_TAG_ARGS = [
  '-colorspace', 'bt709',
  '-color_primaries', 'bt709',
  '-color_trc', 'bt709',
  '-color_range', 'tv',
];

/**
 * The output options above are NOT enough on their own. Measured with this
 * ffmpeg: `-color_primaries`/`-color_trc` given only as output options do not
 * reach the H.264 VUI — the file comes back with `color_space=bt709` but
 * `color_primaries=unknown` and `color_transfer=unknown`, on libx264 as well as
 * NVENC, with or without `-movflags +write_colr`. Stamping the frames with
 * `setparams` is what actually carries all three through.
 */
const SETPARAMS_BT709 =
  'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';

/**
 * Scale a source into a target box under the chosen fill mode.
 *
 * LED backdrops are usually 32:9 while generated or shot source is 16:9, so
 * this is where most of the visual decision for a wall is actually made.
 *
 * `fit` / `cover` / `stretch` are a single scale (plus a crop), so they stay a
 * linear chain. `mirror` and `blur` need a background *and* a foreground, so
 * they are emitted as their own graph segment: the background covers the whole
 * box (flipped, or blurred) and the undistorted image is overlaid on top. That
 * keeps the subject's geometry honest, which `stretch` does not.
 */
function fillIsLinear(mode: FillMode): boolean {
  return mode !== 'mirror' && mode !== 'blur';
}

function linearFill(mode: FillMode, w: number, h: number): string[] {
  switch (mode) {
    case 'stretch':
      return [`scale=${w}:${h}`];
    case 'cover':
      // Scale until the box is covered, then trim the overflow.
      return [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`];
    case 'fit':
    default:
      return [`scale=${w}:${h}:force_original_aspect_ratio=decrease`];
  }
}

/**
 * Emit the graph for `mirror` / `blur`. `inLabel` is a bracketed label, `pre`
 * are the filters that must run first (trim/setpts). Returns the new input
 * label for the rest of the clip's chain.
 */
function emitBackgroundFill(
  parts: string[],
  inLabel: string,
  pre: string[],
  mode: FillMode,
  w: number,
  h: number,
  key: string
): string {
  const chain = pre.length ? `${pre.join(',')},` : '';
  parts.push(`${inLabel}${chain}split[${key}fg][${key}bg]`);
  // Background always covers the full box; only its treatment differs.
  const bgTreat =
    mode === 'mirror'
      ? 'hflip'
      : // Blur radius scales with the canvas so the look holds at any wall size.
        `gblur=sigma=${Math.max(8, Math.round(h / 12))}`;
  parts.push(
    `[${key}bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${bgTreat}[${key}bgo]`
  );
  parts.push(`[${key}fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[${key}fgo]`);
  parts.push(
    `[${key}bgo][${key}fgo]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2:eof_action=pass:shortest=0[${key}fill]`
  );
  return `[${key}fill]`;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Render a subtitle to a transparent PNG sized to fit the canvas. The result
 * is meant to be overlaid at (0, 0) on the canvas — the text positioning is
 * baked into the PNG. Returns the bytes ready for FFmpeg.writeFile. */
export async function renderSubtitleToPng(s: Subtitle, W: number, H: number): Promise<Uint8Array | null> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  paintSubtitle(ctx, W, H, s);
  const blob: Blob | null = await new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
  if (!blob) return null;
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

export interface SubtitleAsset {
  fsName: string;
  bytes: Uint8Array;
  start: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
}

export function buildCommand(
  { clips, assets, tracks, settings, duration, masterVolume, subtitles, rangeStart, rangeEnd, encoder, outPath, loopBlend, quality }: BuildArgs,
  subtitleAssets: SubtitleAsset[] = []
): BuiltCommand {
  const W = settings.width;
  const H = settings.height;
  const FPS = settings.fps;

  const rs = Math.max(0, rangeStart ?? 0);
  const re = Math.max(rs + 0.05, rangeEnd ?? duration);
  const outDur = re - rs;

  // Translate clips and subtitles to a 0-based timeline starting at rs.
  if (rs > 0 || re < duration) {
    const transformed: Clip[] = [];
    for (const c of clips) {
      const speed = c.speed ?? 1;
      const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const cEnd = c.start + displayDur;
      if (cEnd <= rs) continue;
      if (c.start >= re) continue;
      const trimLeftTL = Math.max(0, rs - c.start);
      const trimRightTL = Math.max(0, cEnd - re);
      const newDisplayDur = displayDur - trimLeftTL - trimRightTL;
      transformed.push({
        ...c,
        start: Math.max(0, c.start - rs),
        inPoint: c.inPoint + trimLeftTL * speed,
        outPoint: c.outPoint - trimRightTL * speed,
        fadeIn: Math.min(c.fadeIn, newDisplayDur),
        fadeOut: Math.min(c.fadeOut, newDisplayDur),
      });
    }
    clips = transformed;
    const transSubs: Subtitle[] = [];
    for (const s of subtitles) {
      const sEnd = s.start + s.duration;
      if (sEnd <= rs) continue;
      if (s.start >= re) continue;
      const trimL = Math.max(0, rs - s.start);
      const trimR = Math.max(0, sEnd - re);
      const newDur = s.duration - trimL - trimR;
      transSubs.push({
        ...s,
        start: Math.max(0, s.start - rs),
        duration: newDur,
        fadeIn: Math.min(s.fadeIn, newDur / 2),
        fadeOut: Math.min(s.fadeOut, newDur / 2),
      });
    }
    subtitles = transSubs;
    duration = outDur;
  }

  // Map of assetId -> ffmpeg input index, plus list of input files.
  // We also dedupe by file CONTENT (name + size + lastModified) so that if
  // the user uploaded the same file multiple times, we don't load 14 copies
  // and run 14 decoders in parallel — they all share one ffmpeg input and
  // FFmpeg's implicit split handles multiple concurrent reads.
  const inputIndex: Record<string, number> = {};
  const fileFingerprintIndex: Record<string, number> = {};
  const fileMap: { fsName: string; file: File }[] = [];
  const inputArgs: string[] = [];
  let inputCounter = 0;

  // Top-down: V1 is top in UI; we want last drawn = on top, so we draw from bottom-most video track upward.
  // But our overlays will chain in order; later overlays draw ON TOP. So iterate from BOTTOM video track to TOP.
  const videoTracks = tracks.filter((t) => t.kind === 'video' && !t.hidden);
  const audioTracks = tracks.filter((t) => t.kind === 'audio');

  // collect ordered video clips: bottom track first → top track last
  const videoClipsOrdered: Clip[] = [];
  for (let i = videoTracks.length - 1; i >= 0; i--) {
    const t = videoTracks[i];
    const tClips = clips
      .filter((c) => c.trackId === t.id)
      .filter((c) => assets[c.assetId]?.hasVideo)
      .sort((a, b) => a.start - b.start);
    videoClipsOrdered.push(...tClips);
  }

  // collect audio: from audio tracks AND from video tracks (each video clip
  // carries its source audio). Critically: skip assets without an audio
  // stream (images, video files muxed without audio) — referencing `[idx:a]`
  // for them produces "Stream specifier ':a' matches no streams" and aborts
  // the entire filter graph in FFmpeg.wasm.
  const audioClips: {
    clip: Clip;
    trackMuted: boolean;
    trackVolume: number;
    trackId: string;
    duckLevel: number;
  }[] = [];
  // Solo: if ANY track has solo=true, only soloed tracks contribute audio.
  const anySolo = tracks.some((t) => t.solo);
  for (const t of [...videoTracks, ...audioTracks]) {
    if (anySolo && !t.solo) continue;
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const a = assets[c.assetId];
      if (!a || !a.hasAudio || a.isImage) continue;
      audioClips.push({
        clip: c,
        trackMuted: t.muted,
        trackVolume: t.volume ?? 1,
        trackId: t.id,
        duckLevel: t.autoDuckLevel ?? 1,
      });
    }
  }

  // Pre-compute time windows during which "audio from any other track" is
  // active. For each ducked track we'll merge its peers' audible intervals.
  const audibleIntervalsByTrack: Record<string, { start: number; end: number }[]> = {};
  for (const t of [...videoTracks, ...audioTracks]) {
    const arr: { start: number; end: number }[] = [];
    // A non-solo-audible track doesn't generate audio, so it can't be the
    // source of "another track is talking" for ducking purposes either.
    const trackSilencedBySolo = anySolo && !t.solo;
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      if (c.muted || t.muted) continue;
      if (trackSilencedBySolo) continue;
      const a = assets[c.assetId];
      if (!a || !a.hasAudio) continue;
      const speed = c.speed ?? 1;
      const dispDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
      const tailCap = Math.max(0, (a.duration - c.outPoint) / Math.max(0.01, speed));
      const tail = Math.min(c.audioTail ?? 0, tailCap);
      arr.push({ start: c.start, end: c.start + dispDur + tail });
    }
    audibleIntervalsByTrack[t.id] = arr;
  }
  function mergedDuckerIntervals(excludeTrackId: string): { start: number; end: number }[] {
    const merged: { start: number; end: number }[] = [];
    const all: { start: number; end: number }[] = [];
    for (const [tid, arr] of Object.entries(audibleIntervalsByTrack)) {
      if (tid === excludeTrackId) continue;
      all.push(...arr);
    }
    all.sort((a, b) => a.start - b.start);
    for (const r of all) {
      if (merged.length && r.start <= merged[merged.length - 1].end + 0.01) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
      } else {
        merged.push({ ...r });
      }
    }
    return merged;
  }

  const ensureInput = (assetId: string) => {
    if (assetId in inputIndex) return inputIndex[assetId];
    const a = assets[assetId];
    // Dedupe identical files (same name + size + lastModified) across
    // separately-uploaded assets so we don't run N decoders for what is
    // effectively the same source.
    const fp = `${a.file.name}|${a.file.size}|${a.file.lastModified}|${a.isImage ? 'img' : 'av'}`;
    if (fp in fileFingerprintIndex) {
      const idx = fileFingerprintIndex[fp];
      inputIndex[assetId] = idx;
      return idx;
    }
    const idx = inputCounter++;
    inputIndex[assetId] = idx;
    fileFingerprintIndex[fp] = idx;
    const fsName = `in${idx}_${sanitize(a.name)}`;
    fileMap.push({ fsName, file: a.file });
    // Image inputs need -loop 1 + -framerate so FFmpeg treats them as a
    // continuous video stream of the project FPS instead of a single frame.
    if (a.isImage) {
      inputArgs.push('-loop', '1', '-framerate', String(FPS));
    }
    inputArgs.push('-i', fsName);
    return idx;
  };

  const filterParts: string[] = [];
  // base color layer
  filterParts.push(
    `color=c=black:s=${W}x${H}:r=${FPS}:d=${duration.toFixed(3)},format=yuva420p[base]`
  );

  let lastVideoLabel = 'base';
  videoClipsOrdered.forEach((c, i) => {
    const a = assets[c.assetId];
    if (!a) return;
    const idx = ensureInput(c.assetId);
    const speed = c.speed ?? 1;
    const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
    const fi = Math.min(c.fadeIn, displayDur / 2);
    const fo = Math.min(c.fadeOut, displayDur / 2);
    const userScale = c.transformScale ?? 1;
    const tx = c.transformX ?? 0;
    const ty = c.transformY ?? 0;
    const rot = c.transformRotation ?? 0;
    const op = c.transformOpacity ?? 1;
    const br = c.brightness ?? 0;
    const co = c.contrast ?? 1;
    const sa = c.saturation ?? 1;
    const ga = c.gamma ?? 1;
    // 1) trim, setpts, scale to fit canvas with user scale, rotate, color
    //    correction, fades, alpha, format. Then tpad+overlay at offset.
    // Scale factor: fit-to-canvas × userScale, applied via scale=W*userScale:H*userScale
    // with force_original_aspect_ratio=decrease. We DO NOT pad to W×H so smaller
    // scales become true PIP (the overlay is the actual rendered size).
    const targetW = Math.max(2, Math.round(W * userScale));
    const targetH = Math.max(2, Math.round(H * userScale));
    // Head of the chain — everything that must happen before the glow split.
    const fillMode: FillMode = c.fillMode ?? 'fit';
    const pre: string[] = [
      `trim=start=${c.inPoint.toFixed(3)}:end=${c.outPoint.toFixed(3)}`,
      speed !== 1 ? `setpts=(PTS-STARTPTS)/${speed.toFixed(4)}` : `setpts=PTS-STARTPTS`,
    ];
    // `srcLabel` is what the rest of this clip's chain reads from. Background
    // fill modes consume the raw input and hand back a new label.
    let srcLabel = `[${idx}:v]`;
    let head: string[];
    if (fillIsLinear(fillMode)) {
      head = [...pre, ...linearFill(fillMode, targetW, targetH)];
    } else {
      srcLabel = emitBackgroundFill(filterParts, srcLabel, pre, fillMode, targetW, targetH, `f${i}`);
      head = [];
    }
    // Glow / bloom: split the trimmed+scaled source, crush the darks with a
    // soft-knee curve so only highlights survive, blur that, and screen it back
    // over the original. Sits before `eq` so grading also shapes the bloom.
    const glow = Math.max(0, Math.min(1, c.glow ?? 0));
    const glowR = Math.max(1, c.glowRadius ?? 24);
    let chainIn = srcLabel;
    if (glow > 0.001) {
      const p = `g${i}`;
      // sigma scales with the clip's rendered size so the look holds at any resolution
      const sigma = Math.max(1, (glowR * targetH) / H).toFixed(2);
      // `format=gbrp` is REQUIRED, not cosmetic. `blend` applies its formula to
      // every plane it is given; on YUV that means the screen formula is run on
      // the U and V chroma planes too, which pushes both toward 255 and casts
      // the whole picture magenta. Verified: SMPTE bars screened with pure
      // black — which must be a no-op — came back magenta with YAVG 111.7
      // instead of the source's 95.9. In planar RGB the same graph returns
      // 95.9, exactly matching the source.
      const glowHead = head.length ? `${head.join(',')},` : '';
      filterParts.push(`${srcLabel}${glowHead}format=gbrp[${p}]`);
      filterParts.push(`[${p}]split[${p}a][${p}b]`);
      filterParts.push(`[${p}b]curves=all='0/0 0.55/0 1/1',gblur=sigma=${sigma}[${p}g]`);
      filterParts.push(
        `[${p}a][${p}g]blend=all_mode=screen:all_opacity=${glow.toFixed(3)}:shortest=0[${p}o]`
      );
      chainIn = `[${p}o]`;
    }
    const filters: string[] = glow > 0.001 ? [] : [...head];
    // A background-fill chain already produced a full-size frame; if there is
    // nothing else to do, `null` the chain out with a copy so the graph stays
    // syntactically valid.
    if (filters.length === 0 && glow <= 0.001) filters.push('null');
    // Color correction via FFmpeg's eq filter — only emit when non-default
    // to keep the graph short for the common case.
    if (br !== 0 || co !== 1 || sa !== 1 || ga !== 1) {
      filters.push(`eq=brightness=${br.toFixed(3)}:contrast=${co.toFixed(3)}:saturation=${sa.toFixed(3)}:gamma=${ga.toFixed(3)}`);
    }
    filters.push('format=yuva420p');
    if (rot !== 0) {
      const rad = (rot * Math.PI) / 180;
      // Expand the rotate output canvas so corners aren't clipped.
      filters.push(
        `rotate=${rad.toFixed(5)}:c=black@0:ow=abs(iw*cos(${rad.toFixed(5)}))+abs(ih*sin(${rad.toFixed(5)})):oh=abs(iw*sin(${rad.toFixed(5)}))+abs(ih*cos(${rad.toFixed(5)}))`
      );
    }
    if (op < 1 - 1e-3 && (c.blendMode ?? 'normal') === 'normal') {
      // Multiply the alpha channel. Blend layers handle opacity via
      // `blend=all_opacity` instead — alpha has no effect on the blend math.
      filters.push(`colorchannelmixer=aa=${op.toFixed(3)}`);
    }
    const blend = c.blendMode ?? 'normal';
    const label = `v${i}`;
    const outLabel = `vo${i}`;

    if (blend === 'normal') {
      // --- alpha-over path (unchanged) ---
      if (fi > 0) filters.push(`fade=t=in:st=0:d=${fi.toFixed(3)}:alpha=1`);
      if (fo > 0) filters.push(`fade=t=out:st=${(displayDur - fo).toFixed(3)}:d=${fo.toFixed(3)}:alpha=1`);
      if (c.start > 0) {
        filters.push(`tpad=start_duration=${c.start.toFixed(3)}:start_mode=add:color=black@0`);
      }
      filterParts.push(`${chainIn}${filters.join(',')}[${label}]`);
      // overlay_w / overlay_h are the (possibly rotated) overlay dimensions.
      // main_w / main_h are the canvas dimensions. Center + user offset.
      filterParts.push(
        `[${lastVideoLabel}][${label}]overlay=x='(main_w-overlay_w)/2+(${tx})':y='(main_h-overlay_h)/2+(${ty})':eof_action=pass:shortest=0[${outLabel}]`
      );
    } else {
      // --- blend path ---
      // `blend` needs both inputs at the full canvas size for the whole
      // project duration, and it ignores alpha for the RGB math. So instead of
      // padding with transparent black we pad / fade / extend with the mode's
      // NEUTRAL colour — the value that leaves the layers below untouched
      // (black for screen-type modes, white for multiply-type, mid grey for
      // overlay/soft-light). Anything else would tint the area outside the clip.
      const neutral = BLEND_NEUTRAL[blend] ?? 'black';
      if (fi > 0) filters.push(`fade=t=in:st=0:d=${fi.toFixed(3)}:color=${neutral}`);
      if (fo > 0) filters.push(`fade=t=out:st=${(displayDur - fo).toFixed(3)}:d=${fo.toFixed(3)}:color=${neutral}`);
      filters.push(
        `pad=${W}:${H}:(ow-iw)/2+(${tx}):(oh-ih)/2+(${ty}):color=${neutral}`
      );
      if (c.start > 0) {
        filters.push(`tpad=start_duration=${c.start.toFixed(3)}:start_mode=add:color=${neutral}`);
      }
      const tail = duration - (c.start + displayDur);
      if (tail > 0.001) {
        filters.push(`tpad=stop_duration=${tail.toFixed(3)}:stop_mode=add:color=${neutral}`);
      }
      // Blend in planar RGB. `blend` runs its formula on every plane it is
      // handed, so in YUV the mode's maths would also be applied to the U and V
      // chroma planes — for screen-type modes that drives both toward 255 and
      // casts the whole frame magenta. (Measured: bars screened with black,
      // which must be a no-op, went from YAVG 95.9 to 111.7 in YUV and stayed
      // at 95.9 in gbrp.) The running canvas is converted back afterwards so
      // the rest of the graph — overlays, subtitle PNGs — is unaffected.
      filters.push('format=gbrp');
      filterParts.push(`${chainIn}${filters.join(',')}[${label}]`);
      const rgbBase = `${label}rgb`;
      filterParts.push(`[${lastVideoLabel}]format=gbrp[${rgbBase}]`);
      // all_opacity mixes the blended result back toward the base, which is
      // what the clip's opacity slider means for a blend layer.
      filterParts.push(
        `[${rgbBase}][${label}]blend=all_mode=${blend}:all_opacity=${op.toFixed(3)}:shortest=0,format=yuv420p[${outLabel}]`
      );
    }
    lastVideoLabel = outLabel;
  });

  // Subtitle overlays — chained AFTER all video clips so subtitles always
  // render on top. Each subtitle was pre-rendered to a PNG (full canvas size,
  // text positioned inside) by the caller; we add it as an input and use a
  // loop+format+fade filter so the static image becomes a fading stream.
  // Subtitle PNGs are written to FFmpeg FS by exportProject before this
  // function returns args; we just register them as inputs here so the
  // -i ordering matches the index we pin in subAssetByIdx.
  const subAssetByIdx = new Map<number, SubtitleAsset>();
  for (const sa of subtitleAssets) {
    const inputIdx = inputCounter++;
    inputArgs.push('-i', sa.fsName);
    subAssetByIdx.set(inputIdx, sa);
  }

  let lastWithSubs = lastVideoLabel;
  let subCounter = 0;
  for (const [inputIdx, sa] of subAssetByIdx) {
    const subDur = sa.duration;
    const filters: string[] = [
      `loop=loop=-1:size=1:start=0`,
      `setpts=PTS-STARTPTS`,
      `format=rgba`,
    ];
    if (sa.fadeIn > 0.001) {
      filters.push(`fade=t=in:st=0:d=${sa.fadeIn.toFixed(3)}:alpha=1`);
    }
    if (sa.fadeOut > 0.001) {
      filters.push(`fade=t=out:st=${(subDur - sa.fadeOut).toFixed(3)}:d=${sa.fadeOut.toFixed(3)}:alpha=1`);
    }
    filters.push(`trim=duration=${subDur.toFixed(3)}`);
    filters.push(`tpad=start_duration=${sa.start.toFixed(3)}:start_mode=add:color=black@0`);
    const subLabel = `s${subCounter}`;
    filterParts.push(`[${inputIdx}:v]${filters.join(',')}[${subLabel}]`);
    const next = `vs${subCounter}`;
    filterParts.push(`[${lastWithSubs}][${subLabel}]overlay=eof_action=pass:shortest=0[${next}]`);
    lastWithSubs = next;
    subCounter++;
  }

  // After all overlays (clips + subtitles), ensure final has yuv420p for x264
  // NOTE: the seamless loop is NOT built into this graph. It used to be, with
  // `split=3` feeding an xfade of head+tail and a concat with the middle — and
  // it worked at small sizes and then died with "Cannot allocate memory" on a
  // real 3840x1080 master. A split whose branches are consumed at different
  // times makes ffmpeg buffer the late branch, which here was ~28 s of raw
  // 4K-wide frames (~5 GB). The loop is now a second pass over the rendered
  // file, where each segment is an independent seek and nothing is buffered —
  // see `applyLoopBlend` in `exportNative.ts`.
  filterParts.push(`[${lastWithSubs}]format=yuv420p,${SETPARAMS_BT709}[vout]`);

  // Audio
  const audioLabels: string[] = [];
  audioClips.forEach((entry, i) => {
    const c = entry.clip;
    const a = assets[c.assetId];
    if (!a) return;
    if (c.muted || entry.trackMuted) return;
    const idx = ensureInput(c.assetId);
    const speed = c.speed ?? 1;
    const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed);
    // L-cut audio tail: extend the source-trim past outPoint so audio rings
    // out for `audioTail` extra timeline-seconds, with auto fade-out.
    const tailCap = Math.max(0, (a.duration - c.outPoint) / Math.max(0.01, speed));
    const tail = Math.min(c.audioTail ?? 0, tailCap);
    const audioOutPointSrc = c.outPoint + tail * speed;
    const totalAudioDur = displayDur + tail;
    const fi = Math.min(c.fadeIn, totalAudioDur / 2);
    const fo = Math.min(c.fadeOut, displayDur / 2);
    const startMs = Math.round(c.start * 1000);
    const filters: string[] = [
      `atrim=start=${c.inPoint.toFixed(3)}:end=${audioOutPointSrc.toFixed(3)}`,
      `asetpts=PTS-STARTPTS`,
    ];
    if (Math.abs(speed - 1) > 1e-3) {
      let remaining = speed;
      while (remaining > 2.0) {
        filters.push(`atempo=2.0`);
        remaining /= 2.0;
      }
      while (remaining < 0.5) {
        filters.push(`atempo=0.5`);
        remaining /= 0.5;
      }
      filters.push(`atempo=${remaining.toFixed(4)}`);
    }
    // Audio mastering: denoise → loudnorm → (existing volume/fade chain). Both
    // are opt-in per clip. arnndn references a model file that
    // exportProject() pre-writes to the FFmpeg FS as "rnnoise.rnnn" if any
    // clip needs it.
    if (c.denoise) {
      filters.push(`arnndn=m=rnnoise.rnnn`);
    }
    if (c.normalizeLoudness) {
      // Single-pass: cheaper than two-pass measure+apply, accuracy is
      // acceptable for export. linear=true keeps the source dynamics intact
      // when measured loudness is already within range of the target.
      filters.push(`loudnorm=I=-14:TP=-1.5:LRA=11:linear=true`);
    }
    const baseVol = c.volume * (entry.trackVolume ?? 1) * (masterVolume ?? 1);
    const duck = entry.duckLevel ?? 1;
    if (duck < 1 - 1e-3) {
      // Build a time-varying volume expression. Default = baseVol; during
      // intervals where another track is audible, multiply by duck.
      // The clip is delayed onto the timeline by `adelay`, so internally
      // its time `t` runs from 0..duration. We need to map timeline t back
      // to the clip's local frame: `localT = t + c.start` only after the
      // adelay. Since we apply `volume` BEFORE `adelay`, t inside this
      // chain equals the local clip time (0..clipDur). Convert each
      // timeline-interval [tlStart, tlEnd] into a local interval
      // [tlStart - c.start, tlEnd - c.start].
      const localIntervals = mergedDuckerIntervals(entry.trackId)
        .map((r) => ({ start: r.start - c.start, end: r.end - c.start }))
        .filter((r) => r.end > 0 && r.start < displayDur)
        .map((r) => ({ start: Math.max(0, r.start), end: Math.min(displayDur, r.end) }));
      // Build expression: volume = base * (in_any_interval ? duck : 1)
      const cond = localIntervals
        .map((r) => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`)
        .join('+');
      const expr = localIntervals.length === 0
        ? `${baseVol.toFixed(3)}`
        : `${baseVol.toFixed(3)}*(if(gt(${cond},0),${duck.toFixed(3)},1))`;
      filters.push(`volume=eval=frame:volume='${expr}'`);
    } else {
      filters.push(`volume=${baseVol.toFixed(3)}`);
    }
    if (fi > 0) filters.push(`afade=t=in:st=0:d=${fi.toFixed(3)}`);
    // Combined fade-out spanning both fadeOut (within visible) and the
    // L-cut tail (post-visible), so there's no step at the visual cut.
    const totalFadeOut = fo + tail;
    if (totalFadeOut > 0.001) {
      const fadeStart = displayDur - fo;
      filters.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=${totalFadeOut.toFixed(3)}`);
    }
    if (startMs > 0) filters.push(`adelay=${startMs}|${startMs}`);
    const label = `a${i}`;
    filterParts.push(`[${idx}:a]${filters.join(',')}[${label}]`);
    audioLabels.push(label);
  });

  let hasAudio = false;
  if (audioLabels.length > 0) {
    hasAudio = true;
    if (audioLabels.length === 1) {
      filterParts.push(`[${audioLabels[0]}]apad=whole_dur=${duration.toFixed(3)}[aout]`);
    } else {
      const inputs = audioLabels.map((l) => `[${l}]`).join('');
      filterParts.push(
        `${inputs}amix=inputs=${audioLabels.length}:duration=longest:normalize=0,apad=whole_dur=${duration.toFixed(3)}[aout]`
      );
    }
  }

  const filterComplex = filterParts.join(';');
  // Desktop writes straight to the user's chosen file; the browser build keeps
  // the fixed in-memory name it then reads back.
  const outName = outPath ?? 'output.mp4';

  const args = [
    ...inputArgs,
    '-filter_complex',
    filterComplex,
    '-map',
    '[vout]',
  ];
  if (hasAudio) {
    args.push('-map', '[aout]');
  }
  args.push(
    ...encoderArgs(encoder ?? 'libx264', quality ?? 'standard'),
    '-pix_fmt', 'yuv420p',
    ...COLOR_TAG_ARGS,
    '-r', String(FPS)
  );
  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-t', duration.toFixed(3), '-y', outName);

  return { args, fileMap, outName };
}

export async function exportProject(
  args: BuildArgs,
  onProgress: ProgressCb
): Promise<Blob> {
  onProgress({ phase: 'FFmpeg 로드 중…', progress: 0 });
  console.log('[exp] entering exportProject');
  let ff;
  try {
    ff = await getFFmpeg();
    console.log('[exp] getFFmpeg returned ok');
  } catch (e: any) {
    console.error('[exp] getFFmpeg FAILED', e, e?.stack);
    throw new Error(`FFmpeg 로드 실패: ${e?.message ?? e}`);
  }
  const onLog = ({ message }: { message: string }) => onProgress({ phase: 'rendering', progress: -1, log: message });
  ff.on('log', onLog);
  try {
    if (!self.crossOriginIsolated) {
      onProgress({ phase: 'rendering', progress: -1, log: 'warning: not crossOriginIsolated — MT FFmpeg needs SAB' });
    }
    console.log('[exp] crossOriginIsolated check passed');

  // If ANY clip opts into denoise, pre-fetch the RNN noise-suppression model
  // and write it to the FFmpeg FS as "rnnoise.rnnn". buildCommand references
  // it by that fixed name in the `arnndn=m=rnnoise.rnnn` filter call. The
  // model is BSD/public-domain (~290 KB ASCII), bundled in public/arnndn/.
  const needsRnnoise = args.clips.some((c) => c.denoise);
  if (needsRnnoise) {
    onProgress({ phase: '잡음 제거 모델 로드 중…', progress: 0.02 });
    const modelUrl = `${import.meta.env.BASE_URL ?? '/'}arnndn/rnnoise.rnnn`;
    try {
      const resp = await fetch(modelUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      await ff.writeFile('rnnoise.rnnn', bytes);
    } catch (e: any) {
      throw new Error(`잡음 제거 모델 로드 실패 (${modelUrl}): ${e?.message ?? e}`);
    }
  }

  // Pre-render subtitles (range-translation respected) to PNG bytes and write
  // them to the FFmpeg FS so buildCommand can reference them as inputs.
  // Note: the range-translation in buildCommand also clips fadeIn/fadeOut, but
  // the PNG content itself only depends on visual fields (text/font/color/x/y),
  // so we can render once at the source values.
  const subtitleAssets: SubtitleAsset[] = [];
  if (args.subtitles && args.subtitles.length > 0) {
    onProgress({ phase: '자막 렌더링 중…', progress: 0.02 });
    const W = args.settings.width;
    const H = args.settings.height;
    const rs = Math.max(0, args.rangeStart ?? 0);
    const re = Math.max(rs + 0.05, args.rangeEnd ?? args.duration);
    let k = 0;
    for (const s of args.subtitles) {
      const sEnd = s.start + s.duration;
      if (sEnd <= rs || s.start >= re) continue;
      const trimL = Math.max(0, rs - s.start);
      const trimR = Math.max(0, sEnd - re);
      const newStart = Math.max(0, s.start - rs);
      const newDur = s.duration - trimL - trimR;
      const png = await renderSubtitleToPng(s, W, H);
      if (!png) continue;
      const fsName = `sub${k}.png`;
      await ff.writeFile(fsName, png);
      subtitleAssets.push({
        fsName,
        bytes: png,
        start: newStart,
        duration: newDur,
        fadeIn: Math.min(s.fadeIn, newDur / 2),
        fadeOut: Math.min(s.fadeOut, newDur / 2),
      });
      k++;
    }
  }

  console.log('[exp] before buildCommand: subAssets=', subtitleAssets.length);
  let built;
  try {
    built = buildCommand(args, subtitleAssets);
    console.log('[exp] buildCommand ok, fileMap=', built.fileMap.length);
  } catch (e: any) {
    console.error('[exp] buildCommand FAILED', e, e?.stack);
    throw e;
  }
  console.log('[exp] before phase set 입력 파일 쓰는 중');
  onProgress({ phase: '입력 파일 쓰는 중…', progress: 0.05 });
  console.log('[exp] entering writeFile loop, count=', built.fileMap.length);
  for (let i = 0; i < built.fileMap.length; i++) {
    console.log('[exp] iter', i, 'start');
    const { fsName, file } = built.fileMap[i];
    console.log('[exp] iter', i, 'fsName=', fsName, 'file?', !!file, 'size=', file?.size, 'type=', file?.type, 'name=', file?.name);
    onProgress({
      phase: `입력 ${i + 1}/${built.fileMap.length} 읽는 중 (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      progress: 0.05 + (i / built.fileMap.length) * 0.1,
      log: `[debug] reading ${fsName}: file.size=${file.size} type=${file.type}`,
    });
    let data: Uint8Array;
    try {
      data = await fetchFile(file);
    } catch (e: any) {
      onProgress({ phase: 'fetchFile 실패', progress: -1, log: `[debug] fetchFile threw: ${e?.message ?? e}` });
      throw new Error(`입력 ${i + 1} 읽기 실패: ${e?.message ?? e}`);
    }
    onProgress({
      phase: `입력 ${i + 1}/${built.fileMap.length} 쓰는 중 (${(data.byteLength / 1024 / 1024).toFixed(1)}MB)`,
      progress: 0.05 + (i / built.fileMap.length) * 0.1,
      log: `[debug] writing ${fsName}: bytes=${data.byteLength}`,
    });
    try {
      await ff.writeFile(fsName, data);
    } catch (e: any) {
      onProgress({ phase: 'writeFile 실패', progress: -1, log: `[debug] writeFile threw at ${fsName} (${data.byteLength}B): ${e?.message ?? e}` });
      throw new Error(`입력 ${i + 1} (${fsName}, ${(data.byteLength/1024/1024).toFixed(1)}MB) 쓰기 실패: ${e?.message ?? e}`);
    }
    onProgress({
      phase: `입력 ${i + 1}/${built.fileMap.length} 준비됨`,
      progress: 0.05 + (i / built.fileMap.length) * 0.1,
    });
  }

  console.log('[exp] writeFile loop done, all files written');
  // Track ffmpeg progress
  const onProg = ({ progress }: { progress: number }) => {
    onProgress({ phase: '인코딩 중…', progress: 0.15 + Math.max(0, Math.min(1, progress)) * 0.8 });
  };
  ff.on('progress', onProg);

  onProgress({ phase: '렌더링 시작', progress: 0.15, log: 'ffmpeg ' + built.args.join(' ') });
  console.log('[exp] calling ff.exec with', built.args.length, 'args');
  // Capture all FFmpeg log output for diagnosing exec failure.
  const ffmpegStderr: string[] = [];
  const captureLog = ({ message }: { message: string }) => {
    ffmpegStderr.push(message);
  };
  ff.on('log', captureLog);
  let ret: number;
  try {
    ret = await ff.exec(built.args);
    console.log('[exp] ff.exec returned ret=', ret);
  } catch (e: any) {
    console.error('[exp] ff.exec threw', e, e?.stack);
    ff.off('log', captureLog);
    throw new Error(`ff.exec threw: ${e?.message ?? e}\n\n${ffmpegStderr.slice(-30).join('\n')}`);
  }
  ff.off('log', captureLog);
  if (ret !== 0) {
    console.error('[exp] ff.exec non-zero ret', ret, 'stderr tail:', ffmpegStderr.slice(-15));
    throw new Error(`FFmpeg 종료 코드 ${ret}\n\n${ffmpegStderr.slice(-25).join('\n')}`);
  }
  ff.off('progress', onProg);

  console.log('[exp] reading output', built.outName);
  onProgress({ phase: '결과 읽는 중…', progress: 0.97 });
  let data: Uint8Array;
  try {
    data = (await ff.readFile(built.outName)) as Uint8Array;
    console.log('[exp] readFile ok, size=', data.byteLength);
  } catch (e: any) {
    console.error('[exp] readFile FAILED', e);
    throw new Error(`출력 파일 읽기 실패: ${e?.message ?? e}\n\n${ffmpegStderr.slice(-25).join('\n')}`);
  }
  // cleanup
  try {
    await ff.deleteFile(built.outName);
    for (const { fsName } of built.fileMap) await ff.deleteFile(fsName);
    for (const sa of subtitleAssets) await ff.deleteFile(sa.fsName);
    if (needsRnnoise) await ff.deleteFile('rnnoise.rnnn');
  } catch {}

  onProgress({ phase: '완료', progress: 1 });
  const bytes = data as Uint8Array;
  // Copy into a fresh ArrayBuffer-backed Uint8Array so Blob accepts it under strict TS lib types.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'video/mp4' });
  return blob;
  } finally {
    ff.off('log', onLog);
  }
}
