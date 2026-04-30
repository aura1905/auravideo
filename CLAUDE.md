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
- **z-order**: top video track in the UI is drawn front-most on the canvas. The topmost video track gets a red "앞" badge, the bottom one a "뒤" badge. Per-clip frame caches in `mediaMapRef` ensure a higher track stays visible even while its source video is mid-seek.

## Keyboard shortcuts

`src/utils/shortcuts.ts` registers a global handler. Skipped while focus is in `<input>` / `<textarea>` / `<select>` / contentEditable.

- **Space** play/pause, **K** pause, **L**/**J** shuttle forward/backward (each press doubles up to 16×, capped)
- **Home/End** jump to start/end
- **←/→** step one frame, with **Shift** = 1 s
- **S** razor-cut selected clips at playhead
- **Ctrl+Z** undo, **Ctrl+Y** / **Ctrl+Shift+Z** redo
- **Del / Backspace** delete selection

## Undo / Redo

Provided by `zundo`'s `temporal` middleware on the Zustand store. `partialize` keeps only `tracks`, `clips`, `settings`, `assets` in history (UI state — playhead, selection, zoom, snap config — is excluded so scrubbing doesn't pollute history). A 200 ms `handleSet` debounce coalesces drag-edits into single undo steps. Limit 100 entries.

`src/state/editorStore.ts` exposes `undo()`, `redo()`, `clearHistory()`, and `useTemporal(selector)`. `clearHistory()` is called after `loadProject` / `importProjectZip` so Ctrl+Z doesn't undo the load itself.

## Export ranges

`exportProject` accepts optional `rangeStart` / `rangeEnd` (timeline seconds). When set, `buildCommand` pre-translates clips to a 0-based timeline starting at `rangeStart` and clipped at `rangeEnd` before building the filter graph. The export dialog has three modes: **자동 트림** (first clip → last clip, default), **타임라인 전체** (0 → end), **사용자 지정** (manual seconds).

## Project bundles

`src/utils/project.ts::exportProjectZip` packs the serialized state JSON + every asset blob into a single `.auravideo.zip`. `importProjectZip` reverses it. Available from the Save (📦 zip 내보내기) and Open (📦 zip 불러오기) dialogs. JSZip is the dependency.

## Crossfade

The "⇌ 크로스페이드" toolbar button needs exactly 2 selected clips on the same track. If they overlap, it sets `fadeOut` on the left clip and `fadeIn` on the right clip equal to the overlap duration. If they don't overlap, the right clip is pulled back by 1 s (or whatever inPoint headroom is available) before applying the fades. Note: canvas source-over compositing of both fades produces a slightly darker mid-point than a true linear crossfade — proper `xfade` would require restructuring the export filter graph.

## Detach audio

`detachAudio` action creates a duplicate clip on the first audio track (auto-creates one if none exists), keeping the same `assetId` / `start` / in-out / fades, then sets `muted: true` on the original video clip. Exposed via the "🎙 오디오 분리" button in the properties panel, only shown when a video-track clip with `hasAudio` is selected.

## Audio waveforms

Each `MediaAsset` may carry a `waveform: number[]` (packed `[min, max]` pairs) plus `waveformPeaksPerSecond`. Generated by `generateWaveform` in `utils/media.ts` using `AudioContext.decodeAudioData` — runs after the asset is added so the UI isn't blocked. Updates to `assets.waveform` are written **with `temporal.pause()`** because they're a derived cache, not a user edit, and shouldn't pollute undo history.

The `Waveform` SVG component in `Timeline.tsx` slices the peaks for the clip's `[inPoint, outPoint]` range and emits one vertical line per output column. `preserveAspectRatio="none"` makes it stretch to the clip's pixel width without re-rendering when zoom changes.

## Subtitles / text overlays

`Subtitle` is a top-level entity in `state.subtitles: Record<string, Subtitle>` — independent from clips, rendered on a single dedicated "T1 자막" track that always appears above video tracks. `state.subtitleSelection` is mutually exclusive with `state.selection` (clips); selecting a subtitle clears the clip selection and vice-versa, so the properties panel can pick the right editor based on which is non-empty.

**Preview**: `drawSubtitles()` runs after `drawFrame` so subtitles always sit on top of the composited video. It uses canvas `fillText` (with optional `strokeText` for the outline) and the browser's system font — supports any character the browser can render (Korean, emoji, etc.) without bundling a font file.

**Export**: For each subtitle that survives range translation, the export pre-renders a transparent PNG (full canvas size, text already positioned inside) using a browser `<canvas>`, writes it to FFmpeg FS, and adds it as an `-i` input. The filter chain `loop=loop=-1:size=1:start=0,setpts=PTS-STARTPTS,format=rgba,fade=t=in,fade=t=out,trim=duration=...,tpad=start_duration=...:color=black@0` turns the static image into a fading stream positioned at the right time, then `overlay=eof_action=pass:shortest=0` chains it onto the running canvas. This deliberately avoids `drawtext` so we don't have to bundle a font that supports all needed glyph sets.

The `inputCounter` in `buildCommand` is decoupled from `fileMap.length` so subtitle inputs (whose bytes are pre-written by `exportProject`) don't double-count against asset inputs (which `exportProject` writes via `fetchFile`). Cleanup deletes both.

## Visual transform (PIP, rotation, opacity)

`Clip` carries `transformX`/`transformY` (px from canvas center), `transformScale` (1 = fit-to-canvas), `transformRotation` (degrees), `transformOpacity` (0..1). Apply via the **변환** collapsible section in the properties panel; reset button restores defaults.

**Preview**: in `drawFrame` the cached frame is drawn at `(W - dw)/2 + transformX, (H - dh)/2 + transformY` where `dw = vw * baseScale * userScale`. Rotation uses `ctx.translate + rotate + drawImage(-dw/2,-dh/2,...)` around the clip center. Color correction is applied via `ctx.filter = brightness() contrast() saturate()` before the draw and reset to `'none'` after.

**Export**: the per-clip filter chain is `trim → setpts → scale=W*userScale:H*userScale:force_original_aspect_ratio=decrease` (no longer pads to canvas — that's how PIP works), then optional `eq=brightness=:contrast=:saturation=:gamma=`, then `format=yuva420p`, optional `rotate=rad:c=black@0:ow=...:oh=...` with bounding-box expressions, optional `colorchannelmixer=aa=opacity` for static opacity, then fades, then `tpad`. Final `overlay` uses expressions `x=(main_w-overlay_w)/2+TX` so the rotated bounding box is centered correctly.

## Color correction

`brightness` (-1..1, FFmpeg eq additive), `contrast` (0..2, multiplicative around 0.5), `saturation` (0..3), `gamma` (0.1..3). Defaults are `0/1/1/1` (identity). The export filter is only emitted when at least one differs from default. Preview's CSS filter approximates the same look (it doesn't have a separate gamma primitive, so subtle gamma differences won't appear in preview but will in the final export).

## PWA install

`public/manifest.webmanifest` + `public/icon.svg` provide install eligibility. The existing `coi-serviceworker.js` satisfies the service-worker requirement. The topbar conditionally shows an "⬇ 앱 설치" button when the browser fires `beforeinstallprompt`; on click we call `prompt()` and dismiss the button regardless of the user's choice.

## Audio tail (L-cut)

`Clip.audioTail` (seconds) extends a clip's audio playback past its visual end so background sound rings out smoothly across the next visual cut. Implementation principle: visual logic uses `visualEnd = start + displayDur` unchanged; **audio** logic uses `audioEnd = visualEnd + min(audioTail, tailCap)` where `tailCap = (asset.duration - outPoint) / speed` is what's actually available in the source media.

The fade-out is **combined** with `clip.fadeOut` into a single continuous ramp from `visualEnd - fadeOut` to `audioEnd`. Both Preview (`drawFrame`) and Export emit the unified curve so there's no discontinuity at the visual cut. In the export filter graph the audio's `atrim` end is `outPoint + tail*speed` and a single `afade=t=out` covers `fadeOut + tail` seconds total.

In Preview, the `<video>` element is kept playing during the tail period (visual loop won't pause it until past `audioEnd`) but no new frames are drawn to the canvas.

The tail is shown on the timeline as a translucent green gradient extending past the clip's right edge — rendered as a sibling of `.clip` in the track-area so it can overflow the clip's `overflow: hidden`.

## Volume & mute

There are four levels that all multiply together for both preview and export:
1. `clip.volume` (0–2, properties panel slider/input)
2. `track.volume` (0–2, slider in track header)
3. `state.masterVolume` (0–2, slider in preview controls)
4. Fade in/out (clamps at clip boundaries)

Plus three independent kill-switches: `clip.muted`, `track.muted`, and the master mute icon (toggles `masterVolume` to 0/1). Export multiplies the same factors into a single `volume=` filter per clip; the GainNode/Web-Audio path is intentionally not used (kept simple via `HTMLMediaElement.volume`).

## Track features

- `track.volume` (0–2), `track.muted`, `track.hidden`, `track.height` (28–200), and `state.trackLocked[id]` are all per-track. Locked tracks reject drops and disable clip drag/trim (selection still works).
- Track height is dragged via the bottom edge of the track row.

## Clip groups

`state.clipGroups` (groupId → clipId[]) and `state.clipGroupId` (clipId → groupId) maintain bidirectional pointers. `groupClips` removes the given clips from any prior group then creates a new one. `ungroupClip` dissolves the group when fewer than 2 members remain. `detachAudio` auto-groups the original video clip with its newly-created audio clip so they stay in sync until the user un-groups them.

When dragging a clip in 'move' mode, the drag captures `memberStarts` for every group sibling at drag-start and applies a single absolute delta on each mousemove (not incremental). This avoids accumulating drift from rapid mousemove events.

## Markers

`state.markers: Marker[]` (id, time, text, color). Press **M** to add at the playhead. Right-click a marker on the ruler to delete; click/scrub seeks to it. Markers are tracked by the temporal middleware so undo/redo also covers them.

## Multi-threaded FFmpeg

We ship `@ffmpeg/core-mt` (not the single-thread `@ffmpeg/core`). It needs SharedArrayBuffer, which requires `crossOriginIsolated` — provided by the COOP/COEP headers in dev (Vite config) and `coi-serviceworker.js` in production. The Vite `copyFfmpegCore` plugin now also copies `ffmpeg-core.worker.js` from `node_modules/@ffmpeg/core-mt/dist/esm/` to `public/ffmpeg-core/`, and `export.ts` passes its URL through `toBlobURL` as `workerURL` in `ff.load()`.

## Snap

`snapTime(t, opts)` returns the nearest of three candidates within an 8-px-equivalent tolerance: the grid value (if `snapEnabled`), every other clip's start/end (excluding ones in `opts.excludeClipIds`), and the playhead. Caller is expected to pass `excludeClipIds: [draggedId]` so a dragged clip doesn't snap to itself. `pps` should be passed for accurate pixel-distance comparisons at non-default zoom.

## Clip speed

`Clip.speed` (default 1) scales playback. **Source-media duration** is `outPoint - inPoint`; **timeline duration** is `(outPoint - inPoint) / speed` — always go through the `clipDisplayDur` helper from `editorStore.ts`. Code to audit when touching anything timeline-related:

- Timeline `ClipView` width and trim drags use timeline-seconds, then convert to source-media seconds before patching `inPoint` / `outPoint` (multiply by `speed`).
- `splitClipAt` converts the click's timeline offset into a media offset before splitting.
- `Preview.drawFrame` sets `m.el.playbackRate = speed` and computes `localTime = inPoint + (head - start) * speed`.
- `export.ts` emits `setpts=(PTS-STARTPTS)/speed` for video and chains `atempo` (each instance limited to `[0.5, 2.0]`) for audio. Range translation also multiplies the timeline trim by `speed` when adjusting `inPoint`/`outPoint`.

## Gotchas

- **Don't restart the dev server casually after touching `vite.config.ts`** — Vite re-optimizes deps and the public dir lookup can lag. If `/` returns 404 or `/ffmpeg-core/*` returns SPA HTML after a config change, kill all node processes (`Get-Process node | Stop-Process -Force`) and restart cleanly.
- `public/ffmpeg-core/` is **auto-generated**; do not commit. The Vite plugin re-copies on next start.
- `package-lock.json` **is** committed and required by CI (`npm ci`).
- `.claude/` (Claude Code per-user settings) is gitignored.
