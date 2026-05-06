import { fetchFile } from '@ffmpeg/util';
import type { Clip, MediaAsset, Subtitle, Track, ProjectSettings } from '../types';
import { paintSubtitle } from './drawSubtitle';
import { getFFmpeg } from './ffmpegCore';

export type ProgressCb = (info: { phase: string; progress: number; log?: string }) => void;

interface BuildArgs {
  clips: Clip[];
  assets: Record<string, MediaAsset>;
  tracks: Track[];
  settings: ProjectSettings;
  duration: number;
  masterVolume: number;
  subtitles: Subtitle[];
  rangeStart?: number;
  rangeEnd?: number;
}

interface BuiltCommand {
  args: string[];
  fileMap: { fsName: string; file: File }[];
  outName: string;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Render a subtitle to a transparent PNG sized to fit the canvas. The result
 * is meant to be overlaid at (0, 0) on the canvas — the text positioning is
 * baked into the PNG. Returns the bytes ready for FFmpeg.writeFile. */
async function renderSubtitleToPng(s: Subtitle, W: number, H: number): Promise<Uint8Array | null> {
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

interface SubtitleAsset {
  fsName: string;
  bytes: Uint8Array;
  start: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
}

function buildCommand(
  { clips, assets, tracks, settings, duration, masterVolume, subtitles, rangeStart, rangeEnd }: BuildArgs,
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

  // collect audio: from audio tracks AND from video tracks (each video clip carries its source audio)
  const audioClips: {
    clip: Clip;
    trackMuted: boolean;
    trackVolume: number;
    trackId: string;
    duckLevel: number;
  }[] = [];
  for (const t of [...videoTracks, ...audioTracks]) {
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const a = assets[c.assetId];
      if (!a) continue;
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
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      if (c.muted || t.muted) continue;
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
    const filters: string[] = [
      `trim=start=${c.inPoint.toFixed(3)}:end=${c.outPoint.toFixed(3)}`,
      speed !== 1 ? `setpts=(PTS-STARTPTS)/${speed.toFixed(4)}` : `setpts=PTS-STARTPTS`,
      `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease`,
    ];
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
    if (op < 1 - 1e-3) {
      // Multiply the alpha channel.
      filters.push(`colorchannelmixer=aa=${op.toFixed(3)}`);
    }
    if (fi > 0) filters.push(`fade=t=in:st=0:d=${fi.toFixed(3)}:alpha=1`);
    if (fo > 0) filters.push(`fade=t=out:st=${(displayDur - fo).toFixed(3)}:d=${fo.toFixed(3)}:alpha=1`);
    if (c.start > 0) {
      filters.push(`tpad=start_duration=${c.start.toFixed(3)}:start_mode=add:color=black@0`);
    }
    const label = `v${i}`;
    filterParts.push(`[${idx}:v]${filters.join(',')}[${label}]`);

    const outLabel = `vo${i}`;
    // overlay_w / overlay_h are the (possibly rotated) overlay dimensions.
    // main_w / main_h are the canvas dimensions. Center + user offset.
    filterParts.push(
      `[${lastVideoLabel}][${label}]overlay=x='(main_w-overlay_w)/2+(${tx})':y='(main_h-overlay_h)/2+(${ty})':eof_action=pass:shortest=0[${outLabel}]`
    );
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
  filterParts.push(`[${lastWithSubs}]format=yuv420p[vout]`);

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
  const outName = 'output.mp4';

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
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
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
  const ff = await getFFmpeg();
  const onLog = ({ message }: { message: string }) => onProgress({ phase: 'rendering', progress: -1, log: message });
  ff.on('log', onLog);
  try {
    if (!self.crossOriginIsolated) {
      onProgress({ phase: 'rendering', progress: -1, log: 'warning: not crossOriginIsolated — MT FFmpeg needs SAB' });
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

  const built = buildCommand(args, subtitleAssets);
  onProgress({ phase: '입력 파일 쓰는 중…', progress: 0.05 });
  for (let i = 0; i < built.fileMap.length; i++) {
    const { fsName, file } = built.fileMap[i];
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

  // Track ffmpeg progress
  const onProg = ({ progress }: { progress: number }) => {
    onProgress({ phase: '인코딩 중…', progress: 0.15 + Math.max(0, Math.min(1, progress)) * 0.8 });
  };
  ff.on('progress', onProg);

  onProgress({ phase: '렌더링 시작', progress: 0.15, log: 'ffmpeg ' + built.args.join(' ') });
  await ff.exec(built.args);
  ff.off('progress', onProg);

  onProgress({ phase: '결과 읽는 중…', progress: 0.97 });
  const data = await ff.readFile(built.outName);
  // cleanup
  try {
    await ff.deleteFile(built.outName);
    for (const { fsName } of built.fileMap) await ff.deleteFile(fsName);
    for (const sa of subtitleAssets) await ff.deleteFile(sa.fsName);
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
