import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './ffmpegCore';

export interface SceneDetectProgress {
  phase: string;
  progress: number; // 0..1, or -1 for indeterminate
}

/** Run FFmpeg's scdet filter on a slice of the asset and return source-media
 * timestamps (seconds) where a scene change was detected.
 *
 * Threshold: 0..100 — FFmpeg's scdet score scale. Lower = more sensitive
 * (more cuts), higher = stricter (only obvious cuts). Default 15 covers
 * typical content.
 *
 * The slice is `[startSec, endSec]` in source-media seconds. Pass 0 / asset
 * duration to scan the whole file. */
export async function detectScenes(
  file: File,
  startSec: number,
  endSec: number,
  threshold: number,
  onProgress?: (p: SceneDetectProgress) => void
): Promise<number[]> {
  onProgress?.({ phase: 'FFmpeg 로드 중…', progress: 0 });
  const ff = await getFFmpeg();

  const detected: number[] = [];
  const onLog = ({ message }: { message: string }) => {
    // scdet emits lines like:
    //   "[Parsed_scdet_0 @ ...] lavfi.scd.score=21.456000 lavfi.scd.time=2.500000"
    const m = message.match(/lavfi\.scd\.time=([0-9.]+)/);
    if (m) {
      const t = parseFloat(m[1]);
      if (isFinite(t)) detected.push(t);
    }
  };
  ff.on('log', onLog);

  const fsName = `scdet_in_${Date.now()}`;
  const data = await fetchFile(file);
  await ff.writeFile(fsName, data);
  onProgress?.({ phase: '장면 분석 중…', progress: 0.05 });

  const onProg = ({ progress }: { progress: number }) => {
    onProgress?.({ phase: '장면 분석 중…', progress: 0.05 + Math.max(0, Math.min(1, progress)) * 0.9 });
  };
  ff.on('progress', onProg);

  try {
    const args: string[] = [];
    // input seeking is faster
    if (startSec > 0) args.push('-ss', startSec.toFixed(3));
    if (endSec > startSec) args.push('-to', endSec.toFixed(3));
    args.push(
      '-i', fsName,
      '-vf', `scdet=threshold=${threshold.toFixed(1)}`,
      '-an',
      '-f', 'null', '-'
    );
    await ff.exec(args);
  } finally {
    ff.off('log', onLog);
    ff.off('progress', onProg);
    try { await ff.deleteFile(fsName); } catch {}
  }

  // The detected timestamps are relative to the slice we fed in. Convert
  // back to absolute source-media seconds.
  const absolute = detected.map((t) => t + startSec).sort((a, b) => a - b);
  // De-duplicate near-identical timestamps (within 100 ms).
  const out: number[] = [];
  for (const t of absolute) {
    if (out.length === 0 || t - out[out.length - 1] > 0.1) out.push(t);
  }
  onProgress?.({ phase: '완료', progress: 1 });
  return out;
}
