import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Copy ffmpeg-core ESM files into public/ffmpeg-core/ so they can be served
// at /ffmpeg-core/ffmpeg-core.js. We use the multi-threaded core for ~2-4x
// faster export — it requires SharedArrayBuffer (already provided by the
// COOP/COEP headers in dev and the coi-serviceworker in production).
function copyFfmpegCore() {
  return {
    name: 'copy-ffmpeg-core',
    buildStart() {
      const src = path.resolve('node_modules/@ffmpeg/core-mt/dist/esm');
      const dst = path.resolve('public/ffmpeg-core');
      try {
        fs.mkdirSync(dst, { recursive: true });
        const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js'];
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
