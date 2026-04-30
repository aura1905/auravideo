# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AuraVideo** — browser-based multi-track video editor. Vite + React 18 + TypeScript, Zustand for state, FFmpeg.wasm for export, IndexedDB for project storage. Deployed at https://aura1905.github.io/auravideo/ (repo `aura1905/auravideo`).

## Commands

```bash
npm run dev           # http://127.0.0.1:5173/
npm run build         # tsc -b && vite build → dist/
npm run preview       # serve dist/
npx tsc --noEmit -p tsconfig.json   # type check only
```

There is no test runner and no linter configured.

Push to `main` triggers `.github/workflows/deploy.yml` which builds with `VITE_BASE=/auravideo/` and deploys `dist/` to GitHub Pages.

## Architecture

### State (Zustand)

`src/state/editorStore.ts` is the single source of truth: `assets` (id → MediaAsset), `tracks[]`, `clips` (id → Clip), `settings`, `playhead`, `selection`, snap config, zoom. Components subscribe via `useEditor` selectors. `useEditor.getState()` is used inside the RAF render loop and serializers to read the current snapshot without re-renders.

A `Clip` has both a **timeline position** (`start`) and an **in/out into the source media** (`inPoint`, `outPoint`). Trimming a clip's left edge moves both `inPoint` and `start`; trimming the right edge moves only `outPoint`. Splitting at time `t` creates two clips that share the source asset.

### Preview rendering — `src/components/Preview.tsx`

The preview is a canvas composited every RAF tick from hidden `<video>` elements (one per clip on the timeline, kept in `mediaMapRef`). Drawing order is `videoTracks` reversed so V1 stays on top. Per-clip alpha fade-in/out is applied via `ctx.globalAlpha` before `drawImage`. Audio routes directly through each video element's `volume`/`muted` (no Web Audio API).

**The media-map effect must recreate a `<video>` when an asset's URL changes**, not only when a clip is added/removed. After a project load (autosave restore or open dialog) clip IDs are reused but `URL.createObjectURL(...)` produces fresh URLs — old video elements end up holding revoked URLs and the canvas goes black. The effect compares `el.currentSrc` against `asset.url` and tears down stale entries.

**Do not set `crossOrigin='anonymous'`** on these video elements. Blob URLs are same-origin and the attribute interacts badly with the COEP=`require-corp` header (verified: caused black-frame regressions earlier).

### Export — `src/utils/export.ts`

Builds an FFmpeg `filter_complex` graph dynamically from the current editor state:

- A `color` source produces the W×H base layer at the project FPS for the full duration.
- Each video clip → `trim → setpts → scale+pad → format=yuva420p → fade(alpha=1) → tpad(start_duration=start, color=black@0)` then `overlay`ed onto the running base. Overlays chain bottom-track-first so the topmost UI track ends up last (= visually on top).
- Audio comes from both audio-track clips **and** video-track clips. Each: `atrim → asetpts → volume → afade → adelay`. All non-muted streams `amix` together, padded to project duration.
- Output: H.264 (libx264, CRF 20, veryfast), AAC 192k, yuv420p, capped via `-t duration`.

Each unique asset becomes one ffmpeg `-i` input even if used by multiple clips (`ensureInput` keeps a map).

### FFmpeg core loading — fragile, do not casually change

`@ffmpeg/ffmpeg@0.12` spawns the worker as `type: 'module'`, so its `importScripts(coreURL)` always throws and the worker falls back to `await import(coreURL)`. That fallback **requires the ESM build of `@ffmpeg/core`**, not UMD.

`vite.config.ts` contains a `copyFfmpegCore` plugin that copies `node_modules/@ffmpeg/core/dist/esm/{ffmpeg-core.js,ffmpeg-core.wasm}` into `public/ffmpeg-core/` at `buildStart`. `public/ffmpeg-core/` is gitignored.

`src/utils/export.ts` references the files at hardcoded paths `/ffmpeg-core/ffmpeg-core.js` and `/ffmpeg-core/ffmpeg-core.wasm`, then runs them through `toBlobURL` (same-origin blob URLs are required because the worker `import()`s them). **The path `/ffmpeg/` does not work** — some Vite middleware intercepts it and returns the SPA fallback HTML; we use `/ffmpeg-core/` instead.

### Cross-origin isolation

The dev server sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` via Vite config. GitHub Pages can't set custom headers, so `public/coi-serviceworker.js` (a vendored `coi-serviceworker`) provides the equivalent in production. `src/main.tsx` registers it conditionally — only when `!window.crossOriginIsolated` and not in dev — and forces a single reload so the page becomes SW-controlled. The base path uses `import.meta.env.BASE_URL` so the SW URL is correct under `/auravideo/`.

We use the **single-threaded** `@ffmpeg/core` (not `core-mt`) so SAB is technically optional, but the SW is kept as a safety net.

### Persistence — IndexedDB

`src/utils/db.ts` opens `auravideo` DB with three stores: `projects` (keyPath `id`, holds the serialized state), `blobs` (key = `${projectId}:${assetId}`, holds File objects), `meta` (autosave id, last project id).

`src/utils/project.ts` serializes the editor state to JSON-friendly form (each asset reduced to metadata + the File goes into the blob store). `loadProject` reconstructs `File`/object-URL for each asset, **revokes prior object URLs**, then calls `useEditor.setState(...)` with the reconstructed assets/clips/tracks/settings.

`src/utils/autosave.ts` subscribes to the store and writes to a single `_autosave` slot (1.5 s debounce). The subscription **skips pure UI state changes** (selection, playhead, isPlaying) so transient interactions don't trigger writes. On startup `tryRestoreLast` reads the `lastProjectId` meta key and loads it before autosave is enabled (gated by the `restored` state in `App.tsx`).

### Vite base path

`vite.config.ts` sets `base` only for `command === 'build'`: defaults to `/auravideo/`, overridable via `VITE_BASE`. Local dev always uses `/`. The CI workflow sets `VITE_BASE=/${{ github.event.repository.name }}/` so renaming the repo doesn't break the build.

## UI conventions

- `S` splits the **selected** clips at the playhead. With no selection it does nothing — this is intentional, an earlier "split everything intersecting the playhead" behaviour was confusing.
- **Alt** held during any drag/click bypasses snap. Snap default is 0.5 s.
- Volume range is `0..2` (200%). The properties panel slider is bound to that range.
- Clip mute (`clip.muted`) silences audio while keeping the video visible — this is exposed both as the on-clip 🔊/🔇 button and the properties panel checkbox.
- Track-level mute is `track.muted` (the M button on the track header). Both `clip.muted` and `track.muted` are honoured in preview audio routing and in export's `amix` selection.
- Resolution must be even-numbered for x264; the topbar inputs round to the next even pixel automatically.

## Gotchas

- **Don't restart the dev server casually after touching `vite.config.ts`** — Vite re-optimizes deps and the public dir lookup can lag. If `/` returns 404 or `/ffmpeg-core/*` returns SPA HTML after a config change, kill all node processes (`Get-Process node | Stop-Process -Force`) and restart cleanly.
- `public/ffmpeg-core/` is **auto-generated**; do not commit. The Vite plugin re-copies on next start.
- `package-lock.json` **is** committed and required by CI (`npm ci`).
- `.claude/` (Claude Code per-user settings) is gitignored.
