import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// ffmpeg-core ESM files are copied into public/ffmpeg-core by a Vite plugin
// (see vite.config.ts). Multi-threaded build: needs SharedArrayBuffer
// (provided by COOP/COEP headers / coi-serviceworker).
const CORE_JS_URL = '/ffmpeg-core/ffmpeg-core.js';
const CORE_WASM_URL = '/ffmpeg-core/ffmpeg-core.wasm';
const CORE_WORKER_URL = '/ffmpeg-core/ffmpeg-core.worker.js';

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
