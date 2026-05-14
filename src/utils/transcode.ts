/** Auto-transcode for browser-unsupported video codecs on import.
 *
 * Mobile devices (especially iOS) record in HEVC/H.265 by default. Many
 * desktop browsers — particularly Chrome on Windows without the paid HEVC
 * extension — can parse the container but refuse to decode the video
 * stream. The <video> element silently shows a black frame.
 *
 * On import we detect this case by loading file metadata into a hidden
 * <video> and checking that `videoWidth > 0`. If it's 0 the browser can't
 * decode, and we fall back to FFmpeg.wasm to transcode the file to H.264
 * before treating it as a normal asset. */

import { getFFmpeg } from './ffmpegCore';

/** Returns true if the browser can decode at least one frame of the file.
 * For audio-only and image files always returns true (they don't need to
 * decode video). For video files: loads metadata into a hidden <video> and
 * checks that `videoWidth > 0` within a few seconds. */
export async function canBrowserPlayVideo(file: File): Promise<boolean> {
  if (!file.type.startsWith('video/')) return true;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<boolean>((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      const done = (ok: boolean) => {
        v.onloadedmetadata = null;
        v.onerror = null;
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), 5000);
      v.onloadedmetadata = () => done(v.videoWidth > 0);
      // `error` fires when the codec is decisively unsupported (the
      // browser refuses to even parse the container).
      v.onerror = () => done(false);
      v.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type TranscodeProgress = { phase: string; progress: number };

/** Transcode an arbitrary video file to H.264/yuv420p + AAC MP4 via
 * FFmpeg.wasm. Throws on failure (callers should surface a friendly error).
 * `onProgress` is called with `phase` strings + `progress` in [0,1] (or -1
 * when the underlying FFmpeg progress event hasn't fired yet). */
export async function transcodeToH264(
  file: File,
  onProgress?: (p: TranscodeProgress) => void
): Promise<File> {
  onProgress?.({ phase: 'FFmpeg 로딩 중…', progress: -1 });
  const ff = await getFFmpeg();
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const stamp = Date.now().toString(36);
  const inName = `tc_in_${stamp}.${ext}`;
  const outName = `tc_out_${stamp}.mp4`;

  onProgress?.({ phase: '입력 파일 쓰는 중…', progress: -1 });
  const ab = await file.arrayBuffer();
  await ff.writeFile(inName, new Uint8Array(ab));

  // Capture stderr lines for diagnostics — only printed on failure.
  const logs: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > 200) logs.shift();
  };
  ff.on('log', logHandler);

  const progHandler = ({ progress }: { progress: number }) => {
    onProgress?.({ phase: '비디오 변환 중…', progress });
  };
  ff.on('progress', progHandler);

  onProgress?.({ phase: '비디오 변환 중…', progress: 0 });

  try {
    const ret = await ff.exec([
      '-i', inName,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      // Even dimensions are required by libx264. `scale='trunc(iw/2)*2:trunc(ih/2)*2'`
      // is a no-op for already-even sizes (the common case) and pads otherwise.
      '-vf', "scale='trunc(iw/2)*2:trunc(ih/2)*2'",
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outName,
    ]);
    if (ret !== 0) {
      const tail = logs.slice(-10).join('\n');
      throw new Error(`FFmpeg 변환 실패 (ret=${ret}). 마지막 로그:\n${tail}`);
    }
    onProgress?.({ phase: '출력 파일 읽는 중…', progress: 1 });
    const data = await ff.readFile(outName);
    // ff.readFile returns Uint8Array; the union with `string` is just for the
    // 'utf8' encoding overload which we don't use.
    const src = data as Uint8Array;
    // Copy into a fresh ArrayBuffer-backed Uint8Array so File/Blob accepts it
    // under strict TS lib types (the original may be SAB-backed).
    const copy = new Uint8Array(src.byteLength);
    copy.set(src);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newFile = new File([copy], `${baseName}_h264.mp4`, { type: 'video/mp4' });
    return newFile;
  } finally {
    ff.off('log', logHandler);
    ff.off('progress', progHandler);
    try { await ff.deleteFile(inName); } catch {}
    try { await ff.deleteFile(outName); } catch {}
  }
}
