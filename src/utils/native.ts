/**
 * Desktop (Tauri) bridge.
 *
 * Everything here is optional: the same bundle runs in a plain browser, where
 * `isNative()` is false and none of the dynamic imports are ever evaluated.
 * That keeps the web build byte-identical in behaviour and keeps the Tauri
 * packages out of its dependency graph.
 */

export interface FfmpegInfo {
  path: string;
  version: string;
  /** Hardware encoders this ffmpeg build actually exposes, e.g. `h264_nvenc`. */
  encoders: string[];
}

/** True when running inside the Tauri desktop shell. */
export function isNative(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function core() {
  return await import('@tauri-apps/api/core');
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: inv } = await core();
  return (await inv(cmd, args)) as T;
}

/** Turn an absolute path into a URL the webview can stream from directly.
 *  Critically this does NOT read the file into memory — a 20 GB source plays
 *  in the preview without ever being copied, which is the whole reason the
 *  desktop build exists. */
export async function pathToUrl(path: string): Promise<string> {
  const { convertFileSrc } = await core();
  return convertFileSrc(path);
}

export async function ffmpegInfo(): Promise<FfmpegInfo> {
  return invoke<FfmpegInfo>('ffmpeg_info');
}

export interface MediaProbe {
  has_video: boolean;
  has_audio: boolean;
  /** True when the video stream carries an alpha channel. */
  has_alpha: boolean;
  pix_fmt: string;
  width: number;
  height: number;
  duration: number;
}

/** Authoritative stream info from ffprobe. Only available on the desktop. */
export async function probeMediaNative(path: string): Promise<MediaProbe> {
  return invoke<MediaProbe>('media_probe', { path });
}

export async function ffmpegCancel(jobId: string): Promise<boolean> {
  return invoke<boolean>('ffmpeg_cancel', { jobId });
}

export async function tempRoot(): Promise<string> {
  return invoke<string>('temp_root');
}

/**
 * Write bytes into the scratch dir and return the absolute path.
 *
 * Uses the fs plugin rather than a custom `invoke`: passing a `Uint8Array`
 * through `invoke` serialises it as a JSON array of numbers, which is fine for
 * a subtitle PNG but pathological for a multi-GB blob-only asset.
 */
export async function writeTempFile(name: string, data: Uint8Array): Promise<string> {
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const dir = await tempRoot();
  const leaf = name.split(/[\\/]/).pop() || 'tmp.bin';
  const sep = dir.includes('\\') ? '\\' : '/';
  const path = `${dir}${sep}${leaf}`;
  await writeFile(path, data);
  return path;
}

export async function removeTempFile(path: string): Promise<boolean> {
  return invoke<boolean>('remove_temp_file', { path });
}

export async function fileSize(path: string): Promise<number> {
  return invoke<number>('file_size', { path });
}

/**
 * Run ffmpeg, streaming its stderr to `onLine` as it goes.
 * Returns the process exit code (non-zero is returned, not thrown, so the
 * caller can show the log alongside it).
 */
export async function ffmpegRun(
  jobId: string,
  args: string[],
  cwd: string | undefined,
  onLine: (line: string) => void
): Promise<number> {
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<{ job_id: string; line: string }>('ffmpeg://log', (e) => {
    if (e.payload.job_id === jobId) onLine(e.payload.line);
  });
  try {
    return await invoke<number>('ffmpeg_run', { jobId, args, cwd });
  } finally {
    unlisten();
  }
}

/** Native "save as" dialog. Returns null if the user cancelled. */
export async function saveDialog(defaultName: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  return await save({
    defaultPath: defaultName,
    filters: [{ name: 'MP4 비디오', extensions: ['mp4'] }],
  });
}

/** Native "open media" dialog. Returns absolute paths. */
export async function openMediaDialog(): Promise<string[]> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const res = await open({
    multiple: true,
    filters: [
      {
        name: '미디어 파일',
        // Desktop ffmpeg reads far more than the browser can decode; the
        // preview still relies on the webview, so professional codecs may
        // export fine while previewing as audio-only.
        extensions: [
          'mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'mts', 'm2ts', 'mxf', 'braw', 'r3d',
          'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus',
          'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff',
        ],
      },
    ],
  });
  if (!res) return [];
  return Array.isArray(res) ? res : [res];
}

/** Reveal a finished export in the OS file manager. */
export async function revealPath(path: string): Promise<void> {
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm',
  avi: 'video/x-msvideo', m4v: 'video/x-m4v', mts: 'video/mp2t', m2ts: 'video/mp2t',
  mxf: 'application/mxf',
  mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', flac: 'audio/flac',
  m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/opus',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
};

/**
 * Read a file off disk into a `File`, tagged with the absolute path it came
 * from. The tag is what lets the export skip copying the media entirely and
 * point ffmpeg straight at the original — including when the preview is using
 * a transcoded proxy, so exports keep full source quality.
 */
export async function readFileAsFile(path: string): Promise<File & { __nativePath: string }> {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const bytes = await readFile(path);
  const name = path.split(/[\\/]/).pop() || 'media';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const type = MIME_BY_EXT[ext] ?? '';
  const copy = new Uint8Array(bytes);
  const file = new File([copy], name, { type }) as File & { __nativePath: string };
  // configurable/writable so a proxy built from this file can re-point the
  // property at the ORIGINAL source (the proxy is preview-only).
  Object.defineProperty(file, '__nativePath', {
    value: path,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return file;
}

/**
 * Build a preview proxy with native ffmpeg.
 *
 * Two reasons this exists rather than the wasm transcode in `transcode.ts`:
 *
 * 1. Speed — the wasm encoder is the slowest thing in the import path, and on
 *    the desktop there is a real ffmpeg (with NVENC) right there.
 * 2. **Alpha.** The webview cannot decode ProRes 4444 / QuickTime RLE, so an
 *    overlay element with transparency has to be proxied — and an H.264 proxy
 *    silently drops the alpha, which made the preview show cut-out elements
 *    sitting on a black rectangle while the export composited them correctly.
 *    Chromium *can* decode VP9 alpha in WebM (verified), and ffmpeg can encode
 *    it, so alpha sources get a `yuva420p` WebM proxy and keep their
 *    transparency on screen.
 *
 * The export is unaffected either way: it renders from `__nativePath`, i.e. the
 * untouched original.
 */
export async function transcodeProxyNative(
  srcPath: string,
  hasAlpha: boolean,
  onLine: (line: string) => void = () => {}
): Promise<string> {
  const dir = await tempRoot();
  const sep = dir.includes('\\') ? '\\' : '/';
  const leaf = (srcPath.split(/[\\/]/).pop() || 'proxy').replace(/\.[^.]+$/, '');
  const stamp = Date.now().toString(36);
  const out = hasAlpha
    ? `${dir}${sep}${leaf}_proxy_${stamp}.webm`
    : `${dir}${sep}${leaf}_proxy_${stamp}.mp4`;

  const args = hasAlpha
    ? [
        '-i', srcPath,
        // libvpx-vp9 is the only widely-playable alpha video the webview takes.
        // `-auto-alt-ref 0` is required — alt-ref frames and alpha don't mix.
        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0',
        // Quality matters more here than it does for an opaque proxy. The alpha
        // plane carries the cut-out's edge, and quantising it hard produces
        // exactly the hard rims and blocking that make a soft matte look wrong
        // on screen — the thing the proxy exists to represent faithfully.
        '-b:v', '0', '-crf', '20', '-deadline', 'good', '-cpu-used', '2',
        '-row-mt', '1',
        '-an', '-y', out,
      ]
    : [
        '-i', srcPath,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-y', out,
      ];

  const ret = await ffmpegRun(`proxy-${stamp}`, args, dir, onLine);
  if (ret !== 0) throw new Error(`프록시 변환 실패 (ffmpeg 종료 코드 ${ret})`);
  return out;
}
