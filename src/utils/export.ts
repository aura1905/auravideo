import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { Clip, MediaAsset, Track, ProjectSettings } from '../types';

// ffmpeg-core ESM files are copied into public/ffmpeg-core by a Vite plugin
// (see vite.config.ts). Multi-threaded build: needs the worker file too, plus
// SharedArrayBuffer (provided by COOP/COEP headers / coi-serviceworker).
const CORE_JS_URL = '/ffmpeg-core/ffmpeg-core.js';
const CORE_WASM_URL = '/ffmpeg-core/ffmpeg-core.wasm';
const CORE_WORKER_URL = '/ffmpeg-core/ffmpeg-core.worker.js';

export type ProgressCb = (info: { phase: string; progress: number; log?: string }) => void;

let ffmpegSingleton: FFmpeg | null = null;

async function getFFmpeg(onLog?: (m: string) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  const ff = new FFmpeg();
  ff.on('log', ({ message }) => {
    onLog?.(message);
  });
  // Load core from local bundle. toBlobURL is required because the worker
  // that runs ffmpeg-core needs same-origin blob URLs to importScripts the JS.
  // For the multi-threaded core we also pass the worker script URL.
  if (!self.crossOriginIsolated) {
    onLog?.('warning: not crossOriginIsolated — multi-threaded ffmpeg requires SharedArrayBuffer');
  }
  await ff.load({
    coreURL: await toBlobURL(CORE_JS_URL, 'text/javascript'),
    wasmURL: await toBlobURL(CORE_WASM_URL, 'application/wasm'),
    workerURL: await toBlobURL(CORE_WORKER_URL, 'text/javascript'),
  });
  ffmpegSingleton = ff;
  return ff;
}

interface BuildArgs {
  clips: Clip[];
  assets: Record<string, MediaAsset>;
  tracks: Track[];
  settings: ProjectSettings;
  duration: number;
  masterVolume: number;
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

function buildCommand({ clips, assets, tracks, settings, duration, masterVolume, rangeStart, rangeEnd }: BuildArgs): BuiltCommand {
  const W = settings.width;
  const H = settings.height;
  const FPS = settings.fps;

  const rs = Math.max(0, rangeStart ?? 0);
  const re = Math.max(rs + 0.05, rangeEnd ?? duration);
  const outDur = re - rs;

  // Translate clips to a 0-based timeline starting at rs, clipping to [rs, re].
  // All time values here are TIMELINE seconds; trims must be converted to
  // source-media seconds when adjusting inPoint/outPoint for a sped-up clip.
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
    duration = outDur;
  }

  // Map of assetId -> ffmpeg input index, plus list of input files
  const inputIndex: Record<string, number> = {};
  const fileMap: { fsName: string; file: File }[] = [];
  const inputArgs: string[] = [];

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
  const audioClips: { clip: Clip; trackMuted: boolean; trackVolume: number }[] = [];
  for (const t of [...videoTracks, ...audioTracks]) {
    for (const c of clips) {
      if (c.trackId !== t.id) continue;
      const a = assets[c.assetId];
      if (!a) continue;
      audioClips.push({ clip: c, trackMuted: t.muted, trackVolume: t.volume ?? 1 });
    }
  }

  const ensureInput = (assetId: string) => {
    if (assetId in inputIndex) return inputIndex[assetId];
    const a = assets[assetId];
    const idx = fileMap.length;
    inputIndex[assetId] = idx;
    const fsName = `in${idx}_${sanitize(a.name)}`;
    fileMap.push({ fsName, file: a.file });
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
    const displayDur = (c.outPoint - c.inPoint) / Math.max(0.01, speed); // timeline-seconds
    const fi = Math.min(c.fadeIn, displayDur / 2);
    const fo = Math.min(c.fadeOut, displayDur / 2);
    const filters: string[] = [
      `trim=start=${c.inPoint.toFixed(3)}:end=${c.outPoint.toFixed(3)}`,
      // After trim/setpts the stream's duration is (outPoint-inPoint). Scaling
      // PTS by 1/speed then makes the output occupy displayDur seconds.
      speed !== 1 ? `setpts=(PTS-STARTPTS)/${speed.toFixed(4)}` : `setpts=PTS-STARTPTS`,
      `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
      `pad=${W}:${H}:(${W}-iw)/2:(${H}-ih)/2:color=black`,
      `format=yuva420p`,
    ];
    if (fi > 0) filters.push(`fade=t=in:st=0:d=${fi.toFixed(3)}:alpha=1`);
    if (fo > 0) filters.push(`fade=t=out:st=${(displayDur - fo).toFixed(3)}:d=${fo.toFixed(3)}:alpha=1`);
    if (c.start > 0) {
      filters.push(`tpad=start_duration=${c.start.toFixed(3)}:start_mode=add:color=black@0`);
    }
    const label = `v${i}`;
    filterParts.push(`[${idx}:v]${filters.join(',')}[${label}]`);

    const outLabel = `vo${i}`;
    filterParts.push(
      `[${lastVideoLabel}][${label}]overlay=eof_action=pass:shortest=0[${outLabel}]`
    );
    lastVideoLabel = outLabel;
  });

  // After all overlays, ensure final has yuv420p for x264
  filterParts.push(`[${lastVideoLabel}]format=yuv420p[vout]`);

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
    const effectiveVol = c.volume * (entry.trackVolume ?? 1) * (masterVolume ?? 1);
    filters.push(`volume=${effectiveVol.toFixed(3)}`);
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
  const ff = await getFFmpeg((m) => onProgress({ phase: 'rendering', progress: -1, log: m }));

  const built = buildCommand(args);
  onProgress({ phase: '입력 파일 쓰는 중…', progress: 0.05 });
  for (let i = 0; i < built.fileMap.length; i++) {
    const { fsName, file } = built.fileMap[i];
    const data = await fetchFile(file);
    await ff.writeFile(fsName, data);
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
  } catch {}

  onProgress({ phase: '완료', progress: 1 });
  const bytes = data as Uint8Array;
  // Copy into a fresh ArrayBuffer-backed Uint8Array so Blob accepts it under strict TS lib types.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'video/mp4' });
  return blob;
}
