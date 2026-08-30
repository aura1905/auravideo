/**
 * Desktop export path — runs a real ffmpeg binary instead of FFmpeg.wasm.
 *
 * The filter graph is NOT reimplemented here. `buildCommand` in `export.ts`
 * already produces a plain `string[]` of ffmpeg arguments, and those arguments
 * are passed through untouched, so both backends render identically. What
 * differs is only:
 *
 *   - where the input files live (a real path instead of an in-memory FS name),
 *   - where the output goes (straight to the user's chosen file — no reading a
 *     multi-GB result back into a Blob),
 *   - which encoder is used (hardware encoders are unavailable in wasm).
 *
 * Relative names that the graph embeds inside filter strings (`rnnoise.rnnn`,
 * `sub0.png`) are handled by running ffmpeg with its working directory set to
 * our scratch folder, where those files are written under exactly those names.
 * Rewriting them to absolute paths would break on Windows, where the drive
 * colon collides with ffmpeg's filter argument separator.
 */
import { buildCommand, renderSubtitleToPng } from './export';
import type { BuildArgs, ProgressCb, SubtitleAsset } from './export';
import { ffmpegRun, fileSize, tempRoot, writeTempFile, removeTempFile } from './native';

/** Parse `time=00:01:23.45` out of an ffmpeg status line. */
function parseTime(line: string): number | null {
  const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export interface NativeExportResult {
  path: string;
  bytes: number;
}

export async function exportProjectNative(
  args: BuildArgs,
  onProgress: ProgressCb,
  opts: { outPath: string; encoder?: string; jobId: string }
): Promise<NativeExportResult> {
  const scratch = await tempRoot();
  // Temp files we created and must clean up afterwards.
  const scratchFiles: string[] = [];

  onProgress({ phase: '준비 중…', progress: 0.01 });

  // Denoise model, referenced by the filter graph as a bare `rnnoise.rnnn`.
  if (args.clips.some((c) => c.denoise)) {
    onProgress({ phase: '잡음 제거 모델 준비 중…', progress: 0.02 });
    const modelUrl = `${import.meta.env.BASE_URL ?? '/'}arnndn/rnnoise.rnnn`;
    const resp = await fetch(modelUrl);
    if (!resp.ok) throw new Error(`잡음 제거 모델 로드 실패 (${modelUrl}): HTTP ${resp.status}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    scratchFiles.push(await writeTempFile('rnnoise.rnnn', bytes));
  }

  // Subtitle overlays are rendered by the browser canvas exactly as in the web
  // build, then materialised in the scratch dir as sub0.png, sub1.png, ...
  const subtitleAssets: SubtitleAsset[] = [];
  if (args.subtitles && args.subtitles.length > 0) {
    onProgress({ phase: '자막 렌더링 중…', progress: 0.03 });
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
      const newDur = s.duration - trimL - trimR;
      const png = await renderSubtitleToPng(s, W, H);
      if (!png) continue;
      const fsName = `sub${k}.png`;
      scratchFiles.push(await writeTempFile(fsName, png));
      subtitleAssets.push({
        fsName,
        bytes: png,
        start: Math.max(0, s.start - rs),
        duration: newDur,
        fadeIn: Math.min(s.fadeIn, newDur / 2),
        fadeOut: Math.min(s.fadeOut, newDur / 2),
      });
      k++;
    }
  }

  const built = buildCommand(
    { ...args, encoder: opts.encoder, outPath: opts.outPath },
    subtitleAssets
  );

  // Resolve every asset input to a real path. Assets added through the desktop
  // file picker already carry one, so nothing is copied — this is what lets the
  // desktop build work on footage far larger than memory. Assets that only
  // exist as a blob (project restored from IndexedDB, imported .zip) are
  // materialised into the scratch dir under the exact name the graph uses.
  const argv = [...built.args];
  for (const { fsName, file } of built.fileMap) {
    const realPath = (file as File & { __nativePath?: string }).__nativePath;
    if (realPath) {
      for (let i = 0; i < argv.length; i++) {
        if (argv[i] === fsName) argv[i] = realPath;
      }
    } else {
      onProgress({ phase: `입력 파일 준비 중… (${file.name})`, progress: 0.05 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      scratchFiles.push(await writeTempFile(fsName, bytes));
    }
  }

  onProgress({ phase: '인코딩 중…', progress: 0.06 });

  const logs: string[] = [];
  const total = Math.max(0.05, (args.rangeEnd ?? args.duration) - (args.rangeStart ?? 0));
  let ret: number;
  try {
    ret = await ffmpegRun(opts.jobId, argv, scratch, (line) => {
      logs.push(line);
      if (logs.length > 400) logs.shift();
      const t = parseTime(line);
      if (t !== null) {
        // Reserve the first 6% for setup and the last 2% for verification.
        onProgress({ phase: '인코딩 중…', progress: 0.06 + Math.min(1, t / total) * 0.92, log: line });
      } else {
        onProgress({ phase: '인코딩 중…', progress: -1, log: line });
      }
    });
  } finally {
    for (const p of scratchFiles) {
      try {
        await removeTempFile(p);
      } catch {
        /* leftover scratch files are harmless */
      }
    }
  }

  if (ret !== 0) {
    throw new Error(`FFmpeg 종료 코드 ${ret}\n\n${logs.slice(-25).join('\n')}`);
  }

  onProgress({ phase: '결과 확인 중…', progress: 0.99 });
  const bytes = await fileSize(opts.outPath);
  if (!bytes) {
    throw new Error(`출력 파일이 비어 있습니다: ${opts.outPath}\n\n${logs.slice(-25).join('\n')}`);
  }

  onProgress({ phase: '완료', progress: 1 });
  return { path: opts.outPath, bytes };
}
