import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Copy ffmpeg-core ESM files into public/ffmpeg/ so they can be served
// at /ffmpeg/ffmpeg-core.js. We use ESM because @ffmpeg/ffmpeg 0.12 spawns
// a module-type Worker and falls back to dynamic import for the core.
function copyFfmpegCore() {
  return {
    name: 'copy-ffmpeg-core',
    buildStart() {
      const src = path.resolve('node_modules/@ffmpeg/core/dist/esm');
      const dst = path.resolve('public/ffmpeg-core');
      try {
        fs.mkdirSync(dst, { recursive: true });
        for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
          const from = path.join(src, f);
          const to = path.join(dst, f);
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
