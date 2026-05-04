import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// ffmpeg-core ESM files are copied into public/ffmpeg-core by a Vite plugin
// (see vite.config.ts). Multi-threaded build: needs SharedArrayBuffer
// (provided by COOP/COEP headers / coi-serviceworker).
//
// We MUST prepend `import.meta.env.BASE_URL` so this works under GitHub
// Pages where the app lives under "/auravideo/" — a hard-coded "/ffmpeg-core/"
// would 404 there and fall back to the SPA HTML, producing
// "SyntaxError: Unexpected token '<'" when the worker tries to import it.
const BASE = import.meta.env.BASE_URL;
const CORE_JS_URL = `${BASE}ffmpeg-core/ffmpeg-core.js`;
const CORE_WASM_URL = `${BASE}ffmpeg-core/ffmpeg-core.wasm`;
const CORE_WORKER_URL = `${BASE}ffmpeg-core/ffmpeg-core.worker.js`;

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
    await ff.load({
      coreURL: await toBlobURL(CORE_JS_URL, 'text/javascript'),
      wasmURL: await toBlobURL(CORE_WASM_URL, 'application/wasm'),
      workerURL: await toBlobURL(CORE_WORKER_URL, 'text/javascript'),
    });
    singleton = ff;
    loading = null;
    return ff;
  })();
  return loading;
}
