// Desktop build: same Vite build as the web target, but served from the app's
// own root rather than the GitHub Pages sub-path, so `base` must be `/`.
// Kept as a script (not an inline env var) so it works identically in
// PowerShell, cmd and bash.
import { spawnSync } from 'node:child_process';

const r = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_BASE: '/', VITE_TARGET: 'tauri' },
});
process.exit(r.status ?? 1);
