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
    // Single-thread core has no workerURL.
    await ff.load({
      coreURL: await toBlobURL(CORE_JS_URL, 'text/javascript'),
      wasmURL: await toBlobURL(CORE_WASM_URL, 'application/wasm'),
    });
    singleton = ff;
    loading = null;
    return ff;
  })();
  return loading;
}
