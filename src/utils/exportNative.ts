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


/**
 * Seamless loop, as a second pass over the rendered file.
 *
 *   out[0..L)   = crossfade from master[D-L..D] into master[0..L]
 *   out[L..D-L) = master[L..D-L]
 *
 * so the result is exactly `L` shorter and its last frame is adjacent in source
 * time to its first — the wrap is continuous, not merely soft.
 *
 * Each segment is a SEPARATE INPUT seeking into the same file. Doing it inside
 * one graph with `split=3` is the obvious formulation and it does not survive
 * contact with a real master: the branch consumed last gets buffered, which at
 * 3840x1080 meant ~28 s of raw frames (~5 GB) and a "Cannot allocate memory"
 * abort. Independent seeks buffer nothing.
 */
async function applyLoopBlend(
  masterPath: string,
  outPath: string,
  duration: number,
  blend: number,
  encoder: string | undefined,
  quality: string | undefined,
  cwd: string,
  jobId: string,
  onLine: (l: string) => void
): Promise<void> {
  const L = blend;
  const D = duration;
  const mid = Math.max(0.04, D - 2 * L);
  const enc =
    encoder && encoder !== 'libx264'
      ? ['-c:v', encoder, ...(encoder.startsWith('h264') ? ['-profile:v', 'high'] : []),
         '-preset', quality === 'delivery' ? 'p7' : 'p5', '-rc', 'vbr',
         '-cq', quality === 'delivery' ? '15' : '21', '-b:v', '0',
         '-maxrate', quality === 'delivery' ? '120M' : '60M',
         '-bufsize', quality === 'delivery' ? '240M' : '120M']
      : ['-c:v', 'libx264', '-profile:v', 'high', '-preset',
         quality === 'delivery' ? 'slow' : 'veryfast',
         '-crf', quality === 'delivery' ? '16' : '20'];

  const args = [
    // 0 = head, 1 = tail, 2 = middle. `-ss` before `-i` seeks on input.
    '-ss', '0', '-t', L.toFixed(3), '-i', masterPath,
    '-ss', (D - L).toFixed(3), '-t', L.toFixed(3), '-i', masterPath,
    '-ss', L.toFixed(3), '-t', mid.toFixed(3), '-i', masterPath,
    '-filter_complex',
    `[1:v]setpts=PTS-STARTPTS[t];[0:v]setpts=PTS-STARTPTS[h];` +
      `[t][h]xfade=transition=fade:duration=${L.toFixed(3)}:offset=0[x];` +
      `[2:v]setpts=PTS-STARTPTS[m];` +
      `[x][m]concat=n=2:v=1:a=0,format=yuv420p,` +
      `setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[vout]`,
    '-map', '[vout]',
    ...enc,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-an', '-y', outPath,
  ];
  const ret = await ffmpegRun(jobId, args, cwd, onLine);
  if (ret !== 0) throw new Error(`루프 처리 실패 (FFmpeg 종료 코드 ${ret})`);
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

  // With a loop blend the graph renders to a temporary master and the wrap is
  // applied as a second pass (see applyLoopBlend).
  const loopBlend = Math.max(0, args.loopBlend ?? 0);
  const totalDur = (args.rangeEnd ?? args.duration) - (args.rangeStart ?? 0);
  const wantsLoop = loopBlend > 0.05 && totalDur > loopBlend * 2 + 0.1;
  const sep = scratch.includes('\\') ? '\\' : '/';
  const masterPath = wantsLoop
    ? `${scratch}${sep}loopsrc-${opts.jobId}.mp4`
    : opts.outPath;

  const built = buildCommand(
    { ...args, encoder: opts.encoder, outPath: masterPath, loopBlend: undefined },
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

  if (wantsLoop) {
    onProgress({ phase: '심리스 루프 처리 중…', progress: 0.94 });
    try {
      await applyLoopBlend(
        masterPath, opts.outPath, totalDur, loopBlend,
        opts.encoder, (args as any).quality, scratch,
        `${opts.jobId}-loop`, (l) => logs.push(l)
      );
    } finally {
      try {
        await removeTempFile(masterPath);
      } catch {
        /* leftover master is harmless */
      }
    }
  }

  onProgress({ phase: '결과 확인 중…', progress: 0.99 });
  const bytes = await fileSize(opts.outPath);
  if (!bytes) {
    throw new Error(`출력 파일이 비어 있습니다: ${opts.outPath}\n\n${logs.slice(-25).join('\n')}`);
  }

  onProgress({ phase: '완료', progress: 1 });
  return { path: opts.outPath, bytes };
}
