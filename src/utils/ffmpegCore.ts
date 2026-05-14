import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// ffmpeg-core ESM files are copied into public/ffmpeg-core by a Vite plugin
// (see vite.config.ts). We use the single-thread build — the MT build's
// pthread sub-workers create blob: URLs that conflict with the
// coi-serviceworker and produce mid-export hangs with ENOENT on blob URLs.
//
// Prepend `import.meta.env.BASE_URL` so this works under GitHub Pages where
// the app lives under "/auravideo/" — a hard-coded "/ffmpeg-core/" would 404
// there and fall back to the SPA HTML, producing
// "SyntaxError: Unexpected token '<'" when the worker tries to import it.
const BASE = import.meta.env.BASE_URL;
const CORE_JS_URL = `${BASE}ffmpeg-core/ffmpeg-core.js`;
const CORE_WASM_URL = `${BASE}ffmpeg-core/ffmpeg-core.wasm`;
// Pre-bundled @ffmpeg/ffmpeg worker.js, written by the copyFfmpegCore Vite
// plugin. Bypasses Vite's dev-mode worker transform which would otherwise
// inject `__vite__injectQuery` + `/@vite/client` imports that crash inside
// a Web Worker context. See vite.config.ts for the bundling step.
const WORKER_JS_URL = `${BASE}ffmpeg-core/ffmpeg-worker.js`;

let singleton: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

/** Lazily loads and returns the shared FFmpeg.wasm instance. The first call
 * downloads + initializes core/wasm/worker; subsequent calls reuse the same
 * instance. Callers should `.on('log', ...)` / `.off('log', ...)` themselves
 * to scope their log handling and avoid leaks across features. */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (singleton) return singleton;
  if (loading) return loading;
  loading = (async () => {
    const ff = new FFmpeg();
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(CORE_JS_URL, 'text/javascript'),
      toBlobURL(CORE_WASM_URL, 'application/wasm'),
    ]);
    // `classWorkerURL` (option to ff.load) tells @ffmpeg/ffmpeg to instantiate
    // its main Worker from THIS URL instead of `new URL('./worker.js',
    // import.meta.url)`. In dev mode the latter routes through Vite's worker
    // transform which crashes inside a Web Worker context. The URL we pass
    // points to the pre-bundled standalone worker in public/ffmpeg-core/.
    // Resolved as absolute against the current origin to avoid Vite's URL
    // rewriting tricks.
    const classWorkerURL = new URL(WORKER_JS_URL, window.location.origin).toString();
    await ff.load({ classWorkerURL, coreURL, wasmURL });
    singleton = ff;
    loading = null;
    return ff;
  })();
  return loading;
}
