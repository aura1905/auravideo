import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Copy ffmpeg-core ESM files into public/ffmpeg-core/ so they can be served
// at /ffmpeg-core/ffmpeg-core.js. We use the SINGLE-THREAD core because the
// MT core's pthread sub-workers spawn through blob: URLs which conflict with
// the coi-serviceworker fetch interception and produce hangs mid-export with
// `net::ERR_FILE_NOT_FOUND` on internal blobs. Slower but reliable.
function copyFfmpegCore() {
  return {
    name: 'copy-ffmpeg-core',
    buildStart() {
      const src = path.resolve('node_modules/@ffmpeg/core/dist/esm');
      const dst = path.resolve('public/ffmpeg-core');
      try {
        fs.mkdirSync(dst, { recursive: true });
        // Remove any leftover MT worker file from a previous build.
        const stale = path.join(dst, 'ffmpeg-core.worker.js');
        if (fs.existsSync(stale)) fs.rmSync(stale);
        const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];
        for (const f of files) {
          const from = path.join(src, f);
          const to = path.join(dst, f);
          if (!fs.existsSync(from)) continue;
          if (!fs.existsSync(to) || fs.statSync(from).mtimeMs > fs.statSync(to).mtimeMs) {
            fs.copyFileSync(from, to);
          }
        }
      } catch (e) {
        console.warn('ffmpeg-core copy skipped:', e);
      }
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
