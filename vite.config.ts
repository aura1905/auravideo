import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

// Copy ffmpeg-core ESM files into public/ffmpeg-core/ so they can be served
// at /ffmpeg-core/ffmpeg-core.js. We use the SINGLE-THREAD core because the
// MT core's pthread sub-workers spawn through blob: URLs which conflict with
// the coi-serviceworker fetch interception and produce hangs mid-export with
// `net::ERR_FILE_NOT_FOUND` on internal blobs. Slower but reliable.
//
// We ALSO pre-bundle @ffmpeg/ffmpeg's worker.js into public/ffmpeg-core/. In
// dev mode, Vite's transform pipeline rewrites the worker's source to insert
// HMR client + `__vite__injectQuery` imports, which crash in a Web Worker
// context with "Cannot use 'import.meta' outside a module" → ff.load() hangs
// forever. By pre-bundling the worker as a self-contained ESM and passing it
// as `workerURL`, Vite never sees it and the worker boots cleanly.
// Sync helper: copy core files + bundle the @ffmpeg/ffmpeg worker into
// public/ffmpeg-core/. Runs at module-load time (top-level of this config),
// BEFORE Vite registers public/ middleware — guarantees Vite sees the
// bundled worker on its first scan instead of falling back to SPA HTML.
function ensureFfmpegPublicAssets() {
  const src = path.resolve('node_modules/@ffmpeg/core/dist/esm');
  const dst = path.resolve('public/ffmpeg-core');
  try {
    fs.mkdirSync(dst, { recursive: true });
    // Remove leftover MT worker file from any previous build.
    const stale = path.join(dst, 'ffmpeg-core.worker.js');
    if (fs.existsSync(stale)) fs.rmSync(stale);
    for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
      const from = path.join(src, f);
      const to = path.join(dst, f);
      if (!fs.existsSync(from)) continue;
      if (!fs.existsSync(to) || fs.statSync(from).mtimeMs > fs.statSync(to).mtimeMs) {
        fs.copyFileSync(from, to);
      }
    }
    // Bundle the @ffmpeg/ffmpeg main worker as a standalone ESM module.
    // In dev mode Vite would otherwise rewrite this worker to insert
    // `__vite__injectQuery` + `/@vite/client` imports that crash inside
    // a Web Worker context — by serving a pre-bundled copy from public/,
    // Vite's transform pipeline never sees the worker source.
    //
    // buildSync ensures completion before this config function returns,
    // so the file exists when Vite's static middleware registers public/.
    const workerSrc = path.resolve('node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js');
    const workerDst = path.join(dst, 'ffmpeg-worker.js');
    if (fs.existsSync(workerSrc)) {
      const srcMtime = fs.statSync(workerSrc).mtimeMs;
      const dstMtime = fs.existsSync(workerDst) ? fs.statSync(workerDst).mtimeMs : 0;
      if (srcMtime > dstMtime) {
        esbuild.buildSync({
          entryPoints: [workerSrc],
          bundle: true,
          format: 'esm',
          outfile: workerDst,
          platform: 'browser',
          target: 'es2020',
        });
      }
    }
  } catch (e) {
    console.warn('ffmpeg-core asset setup skipped:', e);
  }
}

// Trigger the setup once, eagerly, at config-load time.
ensureFfmpegPublicAssets();

function copyFfmpegCore() {
  // Plugin form kept for production `vite build` which calls buildStart
  // (the eager call above happens during dev or build's first config load,
  // but re-running here is cheap thanks to mtime checks).
  return {
    name: 'copy-ffmpeg-core',
    buildStart() {
      ensureFfmpegPublicAssets();
    },
  };
}

export default defineConfig(({ command }) => ({
  // Local dev → "/", production build → "/<repo-name>/" (override with VITE_BASE).
  // The GitHub Action sets VITE_BASE to "/${repo}/" automatically.
  base: command === 'build' ? (process.env.VITE_BASE || '/auravideo/') : '/',
  plugins: [react(), copyFfmpegCore()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
}));
