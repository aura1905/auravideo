# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**NabiVideo** (UI brand) — browser-based multi-track video editor. Vite + React 18 + TypeScript, Zustand for state, FFmpeg.wasm for export, IndexedDB for project storage. Deployed at https://aura1905.github.io/auravideo/ (repo `aura1905/auravideo`). The repo + URL keep the old `auravideo` name; only the user-facing brand is "NabiVideo".

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

The preview is a canvas composited every RAF tick from hidden `<video>`/`<img>` elements — **one per _asset_**, shared by every clip referencing it, kept in `mediaMapRef` keyed by `assetId`. Sharing matters for the talking-head workflow, where dozens of fragments come from one source: one element means a single decode pipeline and small forward seeks at cuts instead of N decoders each seeking from zero. The trade-off is that only one clip from a given asset can be the active one in a frame (two simultaneous PIPs of the same source at different times are not handled). Drawing order is `videoTracks` reversed so V1 stays on top. Per-clip alpha fade-in/out is applied via `ctx.globalAlpha` before `drawImage`. Audio routes directly through each video element's `volume`/`muted` (no Web Audio API).

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
- **Track solo** (`track.solo`, the S button next to M). Rule: if ANY track in the project has `solo=true`, only soloed tracks are audible; non-soloed tracks are silenced regardless of their own `muted` state. Implemented via `isTrackSoloAudible(track, tracks)` in `editorStore.ts` and applied in both `Preview.tsx` (audio-track and video-track audio paths, plus `hasOtherActiveAudio` so a silenced peer doesn't trigger ducking) and `export.ts` (audio-clip collection AND the ducker-interval merge).
- Resolution must be even-numbered for x264; the topbar inputs round to the next even pixel automatically.
- **z-order**: top video track in the UI is drawn front-most on the canvas. The topmost video track gets a red "앞" badge, the bottom one a "뒤" badge. Per-clip frame caches in `mediaMapRef` ensure a higher track stays visible even while its source video is mid-seek.

## Keyboard shortcuts

`src/utils/shortcuts.ts` registers a global handler. Skipped while focus is in `<input>` / `<textarea>` / `<select>` / contentEditable.

- **Space** play/pause, **K** pause, **L**/**J** shuttle forward/backward (each press doubles up to 16×, capped)
- **Home/End** jump to start/end
- **←/→** step one frame, with **Shift** = 1 s
- **S** razor-cut selected clips at playhead
- **Ctrl+Z** undo, **Ctrl+Y** / **Ctrl+Shift+Z** redo
- **Ctrl+C** / **Ctrl+V** copy / paste clips; **Ctrl+D** duplicate-in-place
- **Del / Backspace** delete selection

`Ctrl+C` snapshots the current selection into a module-level clipboard in `shortcuts.ts` (a copy of each `Clip`, with the leftmost `start` remembered as origin). `Ctrl+V` instantiates new clips with fresh ids at the playhead, preserving inter-clip offsets so a multi-clip paste reproduces their relative layout. `Ctrl+D` skips the buffer and starts each duplicate right after its source on the same track. When the page has a text selection (`window.getSelection().toString()` non-empty), `Ctrl+C` falls through to the browser so users can still copy plain text.

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

## Scene detection

`src/utils/sceneDetect.ts` runs FFmpeg's `scdet` filter on a clip's source range and parses log lines like `lavfi.scd.time=2.500000` to collect timestamps. Threshold (0–100) controls sensitivity; the dialog defaults to 15. The `SceneDetectDialog` lets the user pick "마커로 표시" (adds yellow-green markers on the ruler) or "클립 자동 분할" (splits the clip at each detected point — splits in ascending order, re-fetching state each iteration since `splitClipAt` creates new ids for the right half).

The shared FFmpeg singleton lives in `src/utils/ffmpegCore.ts` so scene detection and export share the same instance and don't pay the load cost twice.

## Audio ducking

`Track.autoDuckLevel` (0..1, default 1 = no duck). When set < 1, this track's effective volume is multiplied by `autoDuckLevel` whenever any *other* track has audio audible at the current time. The track-header slider (orange-tinted, only shown for audio tracks) controls it.

**Preview**: `hasOtherActiveAudio(tracks, clips, assets, excludeTrackId, t)` scans all other tracks for clips overlapping `t` (audible = not muted, asset has audio). Each frame, if true, multiply the ducked clip's vol by `duckLevel`.

**Export**: For each ducked audio clip, we pre-compute the *merged* timeline intervals during which any other track is audible. Those intervals are translated to the clip's local time (`adelay` shifts the clip onto the timeline AFTER the volume filter, so inside the volume filter `t` is the clip's local time = 0..clipDur). We emit `volume=eval=frame:volume='base*(if(gt(between(t,a,b)+between(t,c,d)+...,0),duck,1))'` so the duck activates within each interval. If no other track is audible in the clip's range, the expression simplifies to a plain `volume=base` constant.

There's no smooth attack/release — ducking is binary on/off at interval boundaries. Adding ramps would require either keyframed `volume` or a `sidechaincompress` rebuild; left for a future round.

## Whisper auto-subtitles

`src/utils/whisper.ts` wraps `@xenova/transformers` (lazy-loaded via dynamic import — kept out of the main bundle so users who never run transcription don't pay the ~830 KB cost). The flow:

1. `extractAudioForWhisper(file)` — `AudioContext.decodeAudioData` on the asset's File, then `OfflineAudioContext` resamples to **16 kHz mono** (Whisper's required input format).
2. `transcribe(audio, { model, language })` — first call downloads the model (40–500 MB cached in browser) and instantiates the ASR pipeline. Subsequent calls reuse the cached pipeline if model didn't change.
3. Returns `TranscriptionChunk[]` with `start/end` in source-media seconds + `text`.

`WhisperDialog` is opened from the **🎙 자동** button in the T1 subtitle track header. The user picks a clip (must have audio and not be an image), language, and model size. After processing, each chunk becomes a `Subtitle` with timeline mapping:

```
timelineStart = clip.start + chunk.start / clip.speed
```

Defaults are styled for video subs: ~white text with black outline + semi-transparent black background box, positioned at lower-third (`y = canvas.height * 0.38`).

Models are served from HuggingFace; the `coi-serviceworker` rewrites response headers so cross-origin caching plays nicely with the COEP=`require-corp` page environment.

## Subtitles / text overlays

`Subtitle` is a top-level entity in `state.subtitles: Record<string, Subtitle>` — independent from clips, rendered on a single dedicated "T1 자막" track that always appears above video tracks. `state.subtitleSelection` is mutually exclusive with `state.selection` (clips); selecting a subtitle clears the clip selection and vice-versa, so the properties panel can pick the right editor based on which is non-empty.

**Preview**: `drawSubtitles()` runs after `drawFrame` so subtitles always sit on top of the composited video. It uses canvas `fillText` (with optional `strokeText` for the outline) and the browser's system font — supports any character the browser can render (Korean, emoji, etc.) without bundling a font file.

**Export**: For each subtitle that survives range translation, the export pre-renders a transparent PNG (full canvas size, text already positioned inside) using a browser `<canvas>`, writes it to FFmpeg FS, and adds it as an `-i` input. The filter chain `loop=loop=-1:size=1:start=0,setpts=PTS-STARTPTS,format=rgba,fade=t=in,fade=t=out,trim=duration=...,tpad=start_duration=...:color=black@0` turns the static image into a fading stream positioned at the right time, then `overlay=eof_action=pass:shortest=0` chains it onto the running canvas. This deliberately avoids `drawtext` so we don't have to bundle a font that supports all needed glyph sets.

The `inputCounter` in `buildCommand` is decoupled from `fileMap.length` so subtitle inputs (whose bytes are pre-written by `exportProject`) don't double-count against asset inputs (which `exportProject` writes via `fetchFile`). Cleanup deletes both.

## Visual transform (PIP, rotation, opacity)

`Clip` carries `transformX`/`transformY` (px from canvas center), `transformScale` (1 = fit-to-canvas), `transformRotation` (degrees), `transformOpacity` (0..1). Apply via the **변환** collapsible section in the properties panel; reset button restores defaults. Also directly manipulable on the preview canvas — see `CanvasOverlay`.

**Preview**: in `drawFrame` the cached frame is drawn at `(W - dw)/2 + transformX, (H - dh)/2 + transformY` where `dw = vw * baseScale * userScale`. Rotation uses `ctx.translate + rotate + drawImage(-dw/2,-dh/2,...)` around the clip center. Color correction is applied via `ctx.filter = brightness() contrast() saturate()` before the draw and reset to `'none'` after.

**Export**: the per-clip filter chain is `trim → setpts → scale=W*userScale:H*userScale:force_original_aspect_ratio=decrease` (no longer pads to canvas — that's how PIP works), then optional `eq=brightness=:contrast=:saturation=:gamma=`, then `format=yuva420p`, optional `rotate=rad:c=black@0:ow=...:oh=...` with bounding-box expressions, optional `colorchannelmixer=aa=opacity` for static opacity, then fades, then `tpad`. Final `overlay` uses expressions `x=(main_w-overlay_w)/2+TX` so the rotated bounding box is centered correctly.

## Blend modes & glow

`Clip.blendMode` (`normal` | `screen` | `addition` | `multiply` | `overlay` | `softlight` | `lighten` | `darken`, default `normal`) plus `Clip.glow` (0..1) and `Clip.glowRadius` (px). Exposed in the **합성** section of the properties panel. The three lookup tables live in `src/types.ts`.

**Preview** maps the mode to `ctx.globalCompositeOperation` via `BLEND_CANVAS`, and approximates glow by redrawing the cached frame blurred + crushed with `globalCompositeOperation='lighter'`.

**Export**:

- Glow = `split` → `curves=all='0/0 0.55/0 1/1'` (crush darks to isolate highlights) → `gblur` → `blend=all_mode=screen` back over the original. It sits *before* `eq`, so colour correction shapes the bloom too. `gblur` is a CPU filter and is genuinely expensive at 1080p — it, not the encoder, is the bottleneck on a glow-heavy timeline.
- Blend layers take a **separate chain from the normal overlay path**. `blend` ignores alpha for the RGB math and needs both inputs at full canvas size, so the layer is padded / faded / time-extended with the mode's **neutral colour** from `BLEND_NEUTRAL` (black for screen-type, white for multiply-type, mid-grey for overlay/soft-light) instead of transparent black — anything else tints the area outside the clip. Opacity goes through `blend=all_opacity=` rather than `colorchannelmixer=aa=`, which has no effect on blend math.

### `blend` must run in RGB — do not remove `format=gbrp`

`blend` applies its mode's formula to **every plane it is handed**. Given YUV, it runs the screen/multiply/etc. maths on the U and V *chroma* planes as if they were luma, which for screen-type modes drives both toward 255 and casts the entire frame magenta.

Measured: SMPTE bars screened against pure black — which must be an exact no-op — came back at `YAVG=111.7` against the source's `95.9`, visibly all-magenta. With `format=gbrp` on both inputs the same graph returns `95.9`, byte-for-byte the source.

So both blend sites convert to planar RGB first, and the layer path converts the running canvas back to `yuv420p` afterwards so overlays and subtitle PNGs downstream are unaffected. The preview never had this bug: canvas `globalCompositeOperation` already composites in RGB — which is exactly why preview and export disagreed until this was found.

Verified end-to-end: an agent-driven edit (glow + screen-blended PIP + Korean subtitle) exported through native NVENC now matches its preview frame for frame. **The wasm path for blend/glow is still unverified** — FFmpeg.wasm is stricter than the native binary, so confirm with a real browser export before trusting it there.

## Direct manipulation on preview canvas

`src/components/CanvasOverlay.tsx` renders a floating bounding box over the selected clip's rendered position on the preview canvas, with 4 corner scale handles + a top rotation handle. It's mounted as a child of `.preview-stage` next to the canvas. Position is recomputed every RAF tick by reading `canvasRef.current.getBoundingClientRect()` and translating the clip's project-pixel transform (`(W - dw)/2 + transformX`, etc. — same math as `drawFrame`) into viewport-px via the `cssWidth / settings.width` scale factor. The wrapper uses `position: fixed` so it doesn't need a positioned ancestor.

The overlay is only shown when (a) exactly ONE clip is selected, (b) that clip is on a visible video track, (c) its asset is a video/image with `hasVideo=true`, and (d) the playhead is within the clip's display range — otherwise it hides. Pointer interactions:

- **Drag inside (`data-role="move"`)** → updates `transformX/Y` by the screen-px delta divided by the project-px scale; works even when the clip is rotated because we translate the clip's center in project space, not screen space.
- **Drag a corner (`data-role="corner"`)** → uniform `transformScale` = `startScale * (currentDistFromCenter / initialDistFromCenter)`, clamped to `[0.05, 20]`.
- **Drag the top handle (`data-role="rotate"`)** → `transformRotation += angleDelta` where the angles are computed from the box's center in viewport coords. Holding Shift snaps the result to 15° increments.
- **Double-click the body** → reset all four transform fields to defaults.

The wrapper has `pointer-events: none` and each handle child sets `pointer-events: auto`, so clicks outside the box pass through to the canvas (and clicks inside the box hit the body / corner / rotate handles directly via `data-role`).

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

## FFmpeg core: single-threaded, no service worker

We ship the **single-threaded** `@ffmpeg/core`. An earlier round used `@ffmpeg/core-mt` + `coi-serviceworker` for SharedArrayBuffer, but the SW caused more export breakage than the threading was worth. Current state:

- `vite.config.ts`'s `copyFfmpegCore` copies `node_modules/@ffmpeg/core/dist/esm/{ffmpeg-core.js,ffmpeg-core.wasm}` plus `@ffmpeg/ffmpeg/dist/esm/worker.js` (as `ffmpeg-worker.js`) into `public/ffmpeg-core/`, and actively deletes a stale `ffmpeg-core.worker.js` if one is left over from the core-mt era.
- `src/main.tsx` **unregisters every service worker** on load and reloads once if one was controlling the page, so no cached SW can intercept requests.
- No `workerURL` is passed to `ff.load()` — only `classWorkerURL`, `coreURL`, `wasmURL`.

Do not reintroduce core-mt without also re-adding cross-origin isolation; and if you do, verify an actual export produces a real MP4 first.

## Playback performance — the playhead bus

`src/state/playheadBus.ts` is a tiny module-level pub/sub that carries the playhead value at 60 fps **outside** the Zustand store.

The problem it solves: the RAF loop advances the playhead every frame, and `Timeline` used to subscribe to `state.playhead`. Timeline renders every track, clip, waveform, subtitle and marker, so the entire tree was rebuilt 60 times a second — and `Waveform` rebuilt its SVG path (a scan over peaks stored at 100/sec) on each of those renders. Cost grew with clip count, which is why the editor got slower the more you cut.

Rules to preserve:

- **Never `useEditor((s) => s.playhead)` in a component that renders the timeline or the clip tree.** `Timeline` and `Preview` both deliberately do not. Read `useEditor.getState().playhead` inside handlers instead — the store is still the source of truth and stays exact, because `setPlayhead` writes to the store *and* publishes to the bus.
- Things that must move at 60 fps subscribe to the bus and poke the DOM directly: `Playhead` (writes `style.transform`), `PlayheadReadout`, `SeekBar`, `PlayheadTime`.
- `Waveform`, `ThumbStrip` and `ClipView` are `React.memo`ed. `ClipView` derives its select/update callbacks from `useEditor.getState()` internally rather than taking them as props — passing arrow functions from `Timeline` would create new references every render and defeat the memo.

## LED wall / music-show backdrop

This project's primary use is generating and cutting LED backdrops for music broadcasts. Three things follow from that, and they drive several design choices:

### Canvas and fill modes

Broadcast LED walls are commonly **32:9** (3840×1080, 2560×720, 2048×576) while generated or shot source is 16:9, so "scale it" is never the whole answer. `Clip.fillMode` (`FillMode` in `types.ts`, default `fit` = previous behaviour):

| mode | what it does |
|---|---|
| `fit` | letterbox/pillarbox, aspect preserved |
| `cover` | scale to fill, crop the overflow — geometry stays honest |
| `stretch` | scale axes independently; fills, but distorts |
| `mirror` | fit, then fill the sides with a flipped covering copy |
| `blur` | fit, then fill the sides with a blurred covering copy |

`fit`/`cover`/`stretch` are a linear filter chain. **`mirror` and `blur` are not** — they need a background *and* a foreground, so `emitBackgroundFill` in `export.ts` emits its own graph segment (split → covering background → overlay the fitted image) and hands back a new input label, the same pattern the glow chain uses. The preview mirrors all five in `drawFrame`.

The resolution dropdown has an "LED 월" optgroup, and FPS offers 29.97 because `led_stage/scripts/build_nabi_project.py` builds its projects at 30000/1001.

### Beat grid

`state.beatGrid` holds the musical grid — bpm, bar length, every beat, the downbeats, and the analysed sections. It is imported straight from the JSON that `led_stage/scripts/analyze_music.py` (librosa) writes, with no conversion step.

- The ruler draws section bands (tinted by `energyLevel`), downbeats, and — only when they are more than 6 px apart — individual beats.
- **`snapTime` treats downbeats and section boundaries with double the normal tolerance.** On a music-show backdrop, a cut landing a frame off the bar is the mistake worth engineering against; ordinary beats keep the standard tolerance.
- `clip.cutOnBeats` slices a clip on the grid (`every` counts bars, or beats with `unit: "beat"`). The phase is anchored to the song start, not to the clip, so `every: 2` means every second bar *of the song*.

### Seamless loop

A standby wall plays its backdrop forever, so the wrap must not pop. `BuildArgs.loopBlend` (seconds) restructures the tail of the graph:

```
out[0..L)   = crossfade from source[D-L..D] into source[0..L]
out[L..D-L) = source[L..D-L]
```

The output is exactly `L` shorter, and its last frame is adjacent in source time to its first — so looping is continuous rather than merely soft. Verified by measuring first-vs-last-frame PSNR on the same timeline: **1.56 dB without the loop blend, 45.10 dB with it**.

## Agent control bridge

The editor is drivable by an external process — a script or an AI agent — so edits can be made and verified without a human at the mouse. Every command is forwarded to the frontend and applied through the **ordinary store actions**, so there is no second editing implementation that could drift from the UI's.

- **Off by default.** The Rust side (`src-tauri/src/bridge.rs`) opens nothing unless the app is launched with `NABIVIDEO_AGENT=1`. It then binds a loopback-only HTTP server on a random port and writes `{port, token}` to `<temp>/nabivideo/agent.json`. Every request must carry `X-Agent-Token`.
- **Frontend** (`src/utils/agentBridge.ts`) listens for `agent://request`, dispatches, and answers via the `agent_reply` command.
- Commands: `ping`, `state`, `project.reset`, `media.import`, `clip.add|update|split|remove`, `subtitle.add|update`, `playhead.set`, `screenshot`, `export`.
- `screenshot` seeks, waits `settleMs` for the decoder, and writes the preview canvas to a PNG — this is how an agent *sees* its edit, and it is what caught the blend colourspace bug by disagreeing with the export.

**Send request bodies as UTF-8 from a real HTTP client, not by interpolating text into a shell command.** Korean subtitle text passed through Git Bash into `curl -d` arrived mangled and the bridge rejected it as an unreadable body; the same payload posted from Python worked. `scripts/` has no client — write one where you need it.

## Desktop build (Tauri) — `src-tauri/`

The same React app ships as both the web build (GitHub Pages, unchanged) and a native desktop app. The desktop build exists because the browser imposes hard limits that no optimisation removes: the wasm32 heap ceiling (~2 GB usable), no hardware encoders, and no ability to decode professional codecs.

- `npm run tauri:dev` / `npm run tauri:build`. The desktop frontend build is `npm run build:tauri` (`scripts/build-tauri.mjs`), which is just `npm run build` with `VITE_BASE=/` — the app is served from its own root, not the Pages sub-path.
- Rust commands live in `src-tauri/src/ffmpeg.rs` and `src-tauri/src/files.rs`; `src/utils/native.ts` is the typed frontend bridge. `isNative()` gates everything, and all Tauri imports are dynamic so the web bundle never pulls them in.
- **ffmpeg is not bundled** — it is resolved at runtime from `NABIVIDEO_FFMPEG`, then a binary next to the executable, then `PATH`. `ffmpeg_info` reports the resolved path, version, and which hardware encoders the build exposes, so the export dialog only offers encoders that actually exist.

### Native export — `src/utils/exportNative.ts`

**The filter graph is not reimplemented.** `buildCommand` in `export.ts` already returns a plain `string[]`, and those args are passed to the native binary verbatim, so both backends render identically. Only three things differ:

1. **Inputs.** Assets added through the desktop picker carry an absolute path on the `File` as a non-enumerable `__nativePath`, and the export rewrites the input arg to that path — nothing is copied, which is what lets the desktop build work on footage larger than memory. Blob-only assets (project restored from IndexedDB, imported `.zip`) fall back to being written into the scratch dir.
2. **Output.** The user picks the destination up front and ffmpeg writes there directly; a multi-GB render never passes through a `Blob`.
3. **Encoder.** `encoderArgs()` in `export.ts` maps an encoder name to its rate-control flags — the families do not share syntax (x264 `-crf`, NVENC `-cq` + `-b:v 0`, QSV `-global_quality`, AMF `-qp_i`/`-qp_p`).

**Relative names inside filter strings** (`rnnoise.rnnn`, `sub0.png`) are NOT rewritten to absolute paths — on Windows the drive colon collides with ffmpeg's filter argument separator. Instead `ffmpeg_run` takes a `cwd` and runs from the scratch dir where those files are written under exactly those names.

When the preview needs a transcoded proxy (HEVC etc.), `__nativePath` is carried across to the proxy `File` so the **export still renders from the untouched original** — native ffmpeg reads what the webview cannot.

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
