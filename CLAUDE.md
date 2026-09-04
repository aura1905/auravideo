# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AuraVideo** (UI brand) — multi-track video editor, Vite + React 18 + TypeScript + Zustand. One codebase, **two targets**:

- **Desktop (Tauri)** — the primary target. Real ffmpeg with hardware encoders, no wasm memory ceiling, professional codecs, files referenced by path instead of copied. See "Desktop build".
- **Web (GitHub Pages)** — kept working and unchanged, for light editing from any machine. FFmpeg.wasm, IndexedDB, https://aura1905.github.io/auravideo/ (repo `aura1905/auravideo`).

**What it is actually used for:** LED backdrop video for Korean music broadcasts (Music Bank–style). That is not a side use case — it drives the 32:9 canvas work, the fill modes, the beat grid, the seamless loop, and the emphasis on compositing. Read "LED wall / music-show backdrop" before designing anything visual.

The sibling project `C:\Git\led_stage` is where the *content* comes from; see "Where the footage comes from" below.

## Commands

```bash
npm run dev           # web dev server, http://127.0.0.1:5173/
npm run build         # tsc -b && vite build → dist/   (web, base=/auravideo/)
npm run build:tauri   # same build with VITE_BASE=/    (desktop frontend)
npm run tauri:dev     # desktop app against the dev server
npm run tauri:build   # desktop release + NSIS installer
npx tsc --noEmit -p tsconfig.json   # type check only
```

There is no test runner and no linter configured. **Type check and build are the only automated gates** — run both before claiming anything works, and for runtime behaviour produce an actual artifact (see "Verification").

Faster desktop iteration while developing:

```bash
npx @tauri-apps/cli build --debug --no-bundle   # ~30-60 s vs ~5 min for release
```

Push to `main` triggers `.github/workflows/deploy.yml`, which builds with `VITE_BASE=/auravideo/` and deploys `dist/` to GitHub Pages. **The desktop app is not part of CI** — it is built locally.

## Verification — what counts as "it works"

This codebase has burned a lot of time on fixes that were announced from code-reading and turned out to be wrong. The rules that came out of that:

- A runtime claim needs an **artifact**: a real MP4 with a non-zero size and `ret === 0`, a frame extracted and looked at, or a measured number.
- **Native ffmpeg ≠ FFmpeg.wasm.** A graph that runs natively can still abort in wasm (it is stricter about missing streams and specifiers). Never use one as proof of the other.
- **Preview ≠ export.** They are separate implementations of the same intent, and two real bugs (blend in YUV, alpha lost in the proxy) were found *only* by capturing a preview frame and an exported frame of the same timeline and comparing them. The agent bridge's `screenshot` command exists for this.
- Prefer a measurement to an opinion: "first-vs-last-frame PSNR went 1.56 → 45.1 dB" settles a question that "looks seamless to me" does not.

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

### Cross-origin isolation — no longer used

The dev server still sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` via Vite config, but **nothing depends on cross-origin isolation any more**: we ship the single-threaded `@ffmpeg/core`, which needs no SharedArrayBuffer.

`public/coi-serviceworker.js` is no longer the vendored coi-serviceworker — it has been replaced by a stub that unregisters itself on activate. `src/main.tsx` unregisters **every** service worker on the origin at load. See "FFmpeg core: single-threaded, no service worker" below for why.

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

`public/manifest.webmanifest` + `public/icon.svg` are in place, and the topbar shows an "⬇ 앱 설치" button when the browser fires `beforeinstallprompt`; on click we call `prompt()` and dismiss the button regardless of the user's choice.

**This is very likely dead in production.** Install eligibility needs a controlling service worker with a fetch handler, and `src/main.tsx` now unregisters every SW on load (single-threaded ffmpeg made the SW unnecessary and it was breaking exports). So `beforeinstallprompt` probably never fires and the button never appears. Not verified in a browser — if PWA install is wanted back, it needs its **own** minimal SW, not the coi stub.

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

## Where the footage comes from — `C:\Git\led_stage` + ComfyUI

AuraVideo does not generate content; the sibling project does, and the two are designed to meet. Knowing this shape saves re-discovering it:

- **ComfyUI** runs locally at `http://127.0.0.1:8188` (no auth). `POST /prompt` with a graph, poll `GET /history/<id>`, read `outputs`. `GET /queue` shows what is running — **check it before submitting, the GPU is usually busy with the user's own batch, and queueing behind them stalls their work.**
- **Video generation** is MiniMax H3 image-to-video (`MiniMaxH3ImageToVideo` + `MiniMaxH3SigmaShift`, `res_multistep`, ~25 steps). `led_stage/scripts/make30_16x9.py::vid_wf()` is the proven graph — copy it rather than inventing one. Clips are generated as a *chain*: each one's last frame is the next one's first frame, so **they butt-join; a crossfade would double-expose the seam**.
- Output lands in `C:\Git\ComfyUI\outputideo\<tag>_00001_.mp4`, 24 fps, **no audio stream** (this is why `hasAudio` detection had to become real — see below).
- **Background removal** for overlay elements: `RMBG` (RMBG-2.0 / BEN2 / INSPYRENET) and `BiRefNetRMBG` — use the **matting** models (`BiRefNet-matting`, `BiRefNet-HR-matting`) for soft edges like hair or petals. `BriaTransparentVideoBackground` does whole clips. Save alpha via `VHS_VideoCombine` with `video/ProRes` or `video/8bit-png`; `SaveWEBM` and plain `SaveVideo` will not carry it.
- **Music analysis** is `led_stage/scripts/analyze_music.py` (librosa) → `<name>_analysis.json` with `bpm`, `bar_seconds`, `beat_grid`, `downbeats`, and `segments` (each with `energy_level`). `beatgrid.load` consumes that JSON **shape-for-shape, with no conversion step** — keep it that way.
- `led_stage/scripts/build_nabi_project.py` already writes `.auravideo.zip` projects at 3840×1080 @ 30000/1001. If you add fields to the project format, that script is a downstream consumer.

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

`state.beatGrid` holds the musical grid — bpm, bar length, every beat, the downbeats, and the analysed sections. It is imported straight from the JSON that `led_stage/scripts/analyze_music.py` (librosa) writes, with no conversion step. **`led_stage` is a separate repo** (locally `C:\Git\led_stage`), not part of this one — the paths in this document that start with `led_stage/` refer to it. Load the JSON through the bridge's `beatgrid.load`.

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

## Preview proxies and alpha — `src/utils/proxy.ts`

A proxy feeds the **preview only**; the export always renders from the original via `__nativePath`. So a proxy may be as lossy as it likes, with one exception it must never get wrong: **transparency**.

Cut-out overlay elements — an RMBG'd dancer, falling petals, a logo sting — arrive as ProRes 4444 or QuickTime RLE, which the webview cannot decode. Transcoding those to H.264 silently discarded the alpha, so the preview showed the element on a black rectangle while the export composited it correctly. A preview that disagrees with the render is worse than no preview.

Measured, so it isn't re-litigated later:

| format | ffmpeg (export) | webview (preview) |
|---|---|---|
| ProRes 4444 / QuickTime RLE | ✅ | ❌ |
| VP9 alpha WebM | ❌ | ✅ |

The two are exactly complementary, hence: **keep the original for export, build a `yuva420p` WebM proxy for preview.** `media_probe` reports `has_alpha` from ffprobe's `pix_fmt` so the choice isn't guesswork.

**The alpha proxy is encoded at `-crf 20 -deadline good -cpu-used 2`, deliberately.** A first attempt at `crf 32 -deadline realtime` preserved the alpha but quantised the alpha *plane* hard, giving cut-outs visible hard rims and blocking — i.e. it misrepresented the one thing it exists to show. Don't trade this back for import speed.

Desktop proxies run through native ffmpeg (`transcodeProxyNative`), not the wasm encoder, which was the slowest step in the import path.

## Agent control bridge

The editor is drivable by an external process — a script or an AI agent — so edits can be made and verified without a human at the mouse. Every command is forwarded to the frontend and applied through the **ordinary store actions**, so there is no second editing implementation that could drift from the UI's.

- **Off by default.** The Rust side (`src-tauri/src/bridge.rs`) opens nothing unless the app is launched with `AURAVIDEO_AGENT=1`. It then binds a loopback-only HTTP server on a random port and writes `{port, token}` to `<temp>/auravideo/agent.json`. Every request must carry `X-Agent-Token`.
- **Frontend** (`src/utils/agentBridge.ts`) listens for `agent://request`, dispatches, and answers via the `agent_reply` command.
- Commands (the `handlers` map in `agentBridge.ts` is the authority): `ping`, `state`, `project.reset`, `settings.set`, `media.import`, `generator.add`, `clip.add|update|split|remove`, `clip.cutOnBeats`, `subtitle.add|update`, `beatgrid.load`, `beatgrid.clear`, `music.assemble`, `playhead.set`, `screenshot`, `export`.
- `clip.add` and `clip.update` also take the look fields directly (`blendMode`, `fillMode`, `glow`, `transform*`, colour correction, `pulse`), so placing a pulsing screen-blended accent layer is one call rather than an add plus a patch.
- `screenshot` seeks, waits `settleMs` for the decoder, and writes the preview canvas to a PNG — this is how an agent *sees* its edit, and it is what caught the blend colourspace bug by disagreeing with the export.

### Driving it

```powershell
$env:AURAVIDEO_AGENT = "1"
Start-Process C:/Git/auravideo/src-tauri/target/debug/auravideo.exe
# then read port + token from %TEMP%/auravideo/agent.json
```

```python
import json, urllib.request
hs = json.load(open(r"C:/Users/<user>/AppData/Local/Temp/auravideo/agent.json"))
def call(cmd, args=None):
    body = json.dumps({"cmd": cmd, "args": args or {}}).encode("utf-8")
    req = urllib.request.Request(f"http://127.0.0.1:{hs['port']}/", data=body,
        headers={"X-Agent-Token": hs["token"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=3600) as r:
        return json.loads(r.read().decode("utf-8"))
```

Pass file paths with **forward slashes** — backslashes have to be escaped through JSON and it is a needless source of breakage; Windows accepts `/` fine.

**Two instances at once.** The handshake path is `AURAVIDEO_AGENT_FILE` when set, otherwise `<temp>/auravideo/agent.json`. Without the override the second app to start silently overwrites the first one's file and the next client to read it drives the wrong window — which is what happens the moment two agents work on this repo at the same time. Pass a private path per instance:

```
AURAVIDEO_AGENT=1 AURAVIDEO_AGENT_FILE=C:/tmp/agent2.json src-tauri/target/release/auravideo.exe
```

`scripts/agent_client.py` is the client (`python scripts/agent_client.py <cmd> '<json>' [--file PATH]`). It exists because request bodies must be UTF-8 and shell `curl -d` mangles Korean.

**Send request bodies as UTF-8 from a real HTTP client, not by interpolating text into a shell command.** Korean subtitle text passed through Git Bash into `curl -d` arrived mangled and the bridge rejected it as an unreadable body; the same payload posted from Python worked. The client is `scripts/agent_client.py`.

## Desktop build (Tauri) — `src-tauri/`

The same React app ships as both the web build (GitHub Pages, unchanged) and a native desktop app. The desktop build exists because the browser imposes hard limits that no optimisation removes: the wasm32 heap ceiling (~2 GB usable), no hardware encoders, and no ability to decode professional codecs.

- `npm run tauri:dev` / `npm run tauri:build`. The desktop frontend build is `npm run build:tauri` (`scripts/build-tauri.mjs`), which is just `npm run build` with `VITE_BASE=/` — the app is served from its own root, not the Pages sub-path.
- Rust commands live in `src-tauri/src/ffmpeg.rs` and `src-tauri/src/files.rs`; `src/utils/native.ts` is the typed frontend bridge. `isNative()` gates everything, and all Tauri imports are dynamic so the web bundle never pulls them in.
- **ffmpeg is not bundled** — it is resolved at runtime from `AURAVIDEO_FFMPEG`, then a binary next to the executable, then `PATH`. `ffmpeg_info` reports the resolved path, version, and which hardware encoders the build exposes, so the export dialog only offers encoders that actually exist.

### Native export — `src/utils/exportNative.ts`

**The filter graph is not reimplemented.** `buildCommand` in `export.ts` already returns a plain `string[]`, and those args are passed to the native binary verbatim, so both backends render identically. Only three things differ:

1. **Inputs.** Assets added through the desktop picker carry an absolute path on the `File` as a non-enumerable `__nativePath`, and the export rewrites the input arg to that path — nothing is copied, which is what lets the desktop build work on footage larger than memory. Blob-only assets (project restored from IndexedDB, imported `.zip`) fall back to being written into the scratch dir.
2. **Output.** The user picks the destination up front and ffmpeg writes there directly; a multi-GB render never passes through a `Blob`.
3. **Encoder.** `encoderArgs()` in `export.ts` maps an encoder name to its rate-control flags — the families do not share syntax (x264 `-crf`, NVENC `-cq` + `-b:v 0`, QSV `-global_quality`, AMF `-qp_i`/`-qp_p`).

**The filter graph goes to ffmpeg as a file, not an argument.** `exportNative` writes it to `graph-<jobId>.txt` in the scratch dir and passes `-filter_complex_script`. A motion-graphics timeline (95 clips + 32 subtitles) blew past the Windows command-line limit and `CreateProcess` failed with "파일 이름이나 확장명이 너무 깁니다 (os error 206)" before ffmpeg started; the script file has no such limit.

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

## Generated layers — `src/utils/generators.ts`

A music-show backdrop is *plates plus light*: the AI footage, and then a beat
flash, a section grading wash, and a mask that keeps the middle of the wall
dark because that is where the members stand. The last three are one rectangle
each, and having to leave the app to make a PNG for them is what stopped a
timeline from being buildable by script.

`GeneratorSpec` is `solid` | `linear` | `radial` (radial takes `invert` for a
vignette). `createGeneratorAsset(spec, w, h)` paints it and returns an ordinary
`MediaAsset` — **the layer is materialised as a real PNG `File` at creation
time**, so preview caching, export inputs, the project zip and autosave need no
knowledge of generators at all; they see an image. `asset.generator` keeps the
spec so the layer can be repainted (`repaintGeneratorAsset`) when its colours or
the canvas size change.

Radii are fractions of the half-diagonal, so a mask authored on a 16:9 canvas
behaves the same when the project is 32:9.

Created from the 생성 레이어 row in the media library, or over the bridge with
`generator.add`.

## Beat pulse — `Clip.pulse`

The second half of the same job, and the reason cuts are not the answer:

> Structure (sections, 8-bar phrases) is expressed with **cuts**.
> Rhythm (beats, downbeats) is expressed with **light**, never with cuts.

A wall that re-cuts every half second reads as an advert; LED is closer to a
lighting instrument than to a screen. So `PulseEnvelope` modulates a layer that
stays on screen:

```
E(t) = min + (max-min) · max(0, 1 - ((t - phase) mod period) / decay)
```

`phase` is an **absolute timeline second**, not a clip offset — trimming or
moving the clip does not slide the accents off the beat. `period` comes from
the beat grid (`barSeconds/4` for beats, `barSeconds` for downbeats).

`pulseAt` (preview: a number per frame) and `pulseGeqExpr` (export: one FFmpeg
expression) live side by side in `generators.ts` precisely because this is
where preview and export drift apart if they are written twice. Measured
agreement: max 1/255, i.e. 8-bit rounding.

**Export.** The envelope is evaluated by `geq` on a **32x32** source and then
blown up with `flags=neighbor` — the expression is per-pixel, so at canvas size
it would cost 4 M evaluations a frame to produce one number. The pulse is
applied *after* `tpad`, so the source's `T` is already project time.

- **Alpha path** (`blendMode: normal`): `split → alphaextract → blend=multiply
  with the envelope → alphamerge`. The alpha is multiplied, not replaced, so a
  rotated or fitted layer keeps the transparent border `overlay` needs. The
  envelope is sized with `scale2ref` against the layer rather than recomputing
  the rendered size — that geometry already exists once, and copies drift.
- **Blend path**: `blend` reads RGB only, so the accent moves the layer toward
  the mode's **neutral colour** (same target as the padding). `L' = N + E·(L-N)`
  reduces to `blend=multiply` with the envelope for black-neutral modes
  (screen/addition/lighten), `blend=screen` with the *inverted* envelope for
  white-neutral ones (multiply/darken), and only overlay / soft-light need the
  per-pixel `blend=all_expr`.

Verified against native ffmpeg 8.1: between pulses the output is **identical to
the untouched base** (YAVG 126 → 126 on the blend path, 16 → 16 on the alpha
path), and a 25%-area white layer at peak gives exactly the predicted 70.75. A
pulse at its floor is a true no-op, which is the property the whole design
rests on.

**Fades and pulses are not interchangeable.** The export clamps `fadeIn/fadeOut`
to half the clip and the preview does not, so a full-length fade is the one
shape where the two renderers disagree. A single decay (a transition flash) is
therefore written as a pulse whose `period` equals the clip length, never as
`fadeOut = duration`.

## Music backdrop assembly — `src/utils/musicBackdrop.ts`

`assembleMusicBackdrop(opts)` turns a beat grid plus a list of plates into a
finished timeline. It is a **rule engine, not a guesser** — every decision is a
number in `BackdropOptions`. Which plate belongs to which section stays with the
caller: that judgement is the one thing automation has repeatedly got wrong here.

Layer stack (top track = front):

| track | contents |
|---|---|
| V1 | centre mask — radial, keeps the middle of the wall dark |
| V2 | accents — beat pulse, downbeat pulse, transition flashes |
| V3 | plates — the footage, looped to fill each section |
| A1 | BGM |

- **Sections** come from the analysis' own segments (`cutUnit: 'section'`) or
  from every Nth downbeat (`'phrase'`, default 8 bars). Phrase boundaries are
  anchored to the song, not to the first section.
- **Transitions** are chosen by what the energy does across the boundary: a
  lift → **hard cut** (the cut is the accent) plus a flash; a drop → 2-bar
  dissolve; flat → 1 bar. Crossfades are **centred on the boundary**, so the
  midpoint of the dissolve lands on the downbeat.
- **Looping.** A plate shorter than its section is repeated in **equal** chunks,
  not "full chunks plus a remainder" — a stub at the end of a section is shorter
  than the dissolve that has to cross it. Solving for a whole number of equal
  chunks makes the last one end exactly on the boundary: no overshoot past a
  hard cut, always enough material for the fade.
- **A crossfade is an overlap AND a pair of fades, and they must be the same
  number.** The overlap is planned from the rules, but a fade is capped at half
  a clip, and clip length depends on the overlap — so the two are solved as a
  fixed point (shrink, re-plan, repeat; four passes).
- **Accent levels are deliberately low** (0.12 beat / 0.28 bar at full energy)
  and scale with each section's energy. 80% of the wall is hidden behind set,
  beams and dancers; a pulse that reads well on a monitor is far too strong on
  stage.

Verified on a synthetic 120 BPM / 3-section song: sections tile 0→48 s with no
gaps, the hard cut lands exactly on 16.000, and the dissolve's overlap (2.34 s)
equals its fade length with its midpoint exactly on 32.000.

Driven over the bridge with `music.assemble`, which takes the same options
(deep-merged over `BACKDROP_DEFAULTS`) and returns the section table it decided
on, so an agent can inspect the edit without a screenshot.

## Auto-edit templates — `src/utils/autoEdit.ts`

Local-only automatic editing (no LLM). Each template is a **plain async function** — not a hook — that reads editor state + an options object, computes a timeline patch, and applies it through the ordinary `useEditor` actions. There is no separate state shape for auto-edit. Progress is reported via an optional `onProgress({phase, progress})` (`progress: -1` = indeterminate, e.g. while a Whisper model downloads); errors are thrown and surfaced by the dialog. `AutoEditDialog.tsx` (opened from the toolbar) is the only caller.

| function | what it builds | inputs |
|---|---|---|
| `runTalkingHeadCleanup` | Whisper-driven silence + filler removal, splits one clip into fragments, optional per-chunk subtitles | one clip with audio |
| `runSlideshow` | images/videos placed sequentially with crossfades | asset ids |
| `runHighlightReel` | picks loudness peaks (`analyzeLoudness`) and concatenates them into a short reel | asset ids |
| `runBeatCut` | detects BGM tempo (`detectBeats`) and cycles videos through cuts on every Nth beat | video asset ids + one BGM asset |

Each has an exported `*_DEFAULTS` constant; the dialog spreads it and patches fields.

### Talking-head — the defaults encode hard-won lessons

- **`model: 'Xenova/whisper-small'`** for Korean. `tiny`/`base` make consistent Korean phoneme errors (함흥냉면→할당냉면). `small` is a ~500 MB one-time download, cached by the browser afterwards.
- **`maxSilenceSec: 4`** — gaps *longer* than this are kept, on the theory that a long pause was intentional (dramatic beat, B-roll hole). Only short gaps get cut.
- **`useWordLevel: true`** — silences are detected at Whisper word boundaries, not segment boundaries, so cuts never land mid-word. `removeFillerWords` requires it.
- **`FILLER_WORDS` is deliberately conservative.** Single-syllable Korean phonemes (어/에/아/으) were removed from the list: Whisper often mis-tokenizes the tail of a stretched word ("출바알") as a standalone syllable, and including them ate real word endings. Only 음, doubled syllables, and unambiguous interjections remain.
- **`endingTailSec: 0.6`** extends only the *last* fragment's `outPoint` so the video doesn't end mid-breath, and drives an auto fade-out of half that value (capped 0.5 s). Capped by the source headroom past the last spoken word — it never invents frames.
- **`crossfadeSec: 0` (hard cut) is the safe default.** Same-track crossfades darken at the midpoint because the canvas compositor alpha-blends both fragments against black (same limitation as the Crossfade section above).
- Subtitles are generated **after** the silence removal, mapped onto the resulting fragment layout — regenerating them per fragment is why a partial re-run must rebuild the whole subtitle set.

### Presets

`PRESETS` in `AutoEditDialog.tsx` are one-click "template + option patch" chips (유튜브 쇼츠 / 강의 정리 / 브이로그 / 빠른 하이라이트 …). The chip stays highlighted until the user edits any field by hand. They exist because novice users asked for "click this, then run" — when adding a template, add a preset for it too.

## Audio analysis — `src/utils/audioAnalysis.ts`

Two primitives, both used only by the auto-editor:

- **`analyzeLoudness`** — decodes the file, RMS energy over fixed windows, smooths, returns ranked segments whose energy peaks above a local baseline. Drives the highlight reel (loudest ≈ most interesting).
- **`detectBeats`** — per-frame energy + positive derivative, adaptive-threshold peak picking with a minimum-gap rule, BPM estimated from inter-beat intervals. Drives the beat-cut template.

Both decode the **entire** file through `AudioContext.decodeAudioData` (`decodeMono` mixes channels down). Fine for 5–10 min sources; long-form material would need a streaming decode, which is not implemented.

**There are two independent beat sources — don't conflate them:**

| | `detectBeats` (this file) | `state.beatGrid` (LED wall) |
|---|---|---|
| origin | in-browser onset detection | JSON from `led_stage`'s librosa script, via bridge `beatgrid.load` |
| output | bare beat times + BPM, consumed once by `runBeatCut` | persistent musical grid: bars, downbeats, sections |
| used by | auto-edit beat-cut template | ruler drawing, `snapTime`, `clip.cutOnBeats` |

`runBeatCut` does **not** read `state.beatGrid`, and the LED-wall grid features do **not** call `detectBeats`.

## Audio mastering (loudnorm / denoise)

Two per-clip booleans on `Clip`, both **export-only — preview leaves audio raw**, so a user who A/Bs them in the preview will hear nothing change (the tooltips in `PropertiesPanel.tsx` say so):

- `denoise` → `arnndn=m=rnnoise.rnnn` (RNN-based, good on steady fan/aircon/mic noise).
- `normalizeLoudness` → `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true` (single-pass, YouTube/podcast target).

Order in the chain is **denoise → loudnorm → volume/fades**, so noise is gone before the level is measured and the user's volume multiplier still scales the normalized result.

The model file is `public/arnndn/rnnoise.rnnn` (BSD/public-domain, ~290 KB ASCII, committed). Both backends write it out under exactly that bare name before running — `exportProject` into the FFmpeg.wasm FS (deleted again on cleanup), `exportNative` into the scratch dir it sets as ffmpeg's `cwd` — because a relative name is the only form that survives a filter string on Windows.

## Import transcode — `src/utils/transcode.ts`

Phones (iOS especially) record HEVC/H.265, and Chrome on Windows will parse the container but refuse to decode it, showing a silent black frame. On import, `canBrowserPlayVideo(file)` loads metadata into a hidden `<video>` and treats `videoWidth === 0` (or an `error` event, or a 5 s timeout) as "cannot decode"; `transcodeToH264` then re-encodes via FFmpeg.wasm and the result is used as the asset.

In the desktop build the original's `__nativePath` is carried onto the proxy `File`, so **export still renders from the untouched original** while the preview uses the H.264 proxy — see the native export section.

`transcode.ts` is now called only from `src/utils/proxy.ts`, which owns the import-time decision (playable as-is / H.264 proxy / alpha-preserving WebM proxy) — see "Preview proxies and alpha" above. Add new proxy policy there, not here.

## The Demo Dip pipeline — `docs/PIPELINE.md` + `docs/CHANNEL.md`

The laptop-side purpose of this repo is a zero-touch YouTube series. It is now an
**English channel, "Demo Dip"** (`UC_yuhFg577gfaCQVO4KXwyg`) — pick a Steam demo that
people are actually playing, work out how it was built, narrate it, assemble, upload.
The old Korean 데모 찍먹 branding survives only in episodes 01–03 on the AIMC channel.

- **`docs/CHANNEL.md` decides *what* to make**: two audience layers (gamers who searched
  the game, and one-to-two-person devs who want the build), the six-part episode shape,
  the rules that hold curiosity, typography (Anton / Inter / JetBrains Mono — never
  Malgun Gothic for Latin), thumbnail and description templates, cadence, and metrics.
- **`docs/PIPELINE.md` decides *how***, step by step with the exact commands:
  `steam_fetch.py` → **build teardown** (SteamDB depot manifest; `steamcmd` anonymous is
  refused for demos) → `analyze_reviews.py` → script ★ → `tts_fish.py` → motion layers →
  `build_plan.py` → bridge assembly → `make_thumbnail.py` / `make_desc.py` →
  `youtube_upload.py` ★.

The teardown is the differentiator: a demo's public file list names its engine, render
pipeline, and every third-party package, and that evidence is what connects a technical
choice to how players reacted. `episodes/04-nomad-drive/teardown.md` is the worked
example. Never decompile, unpack or redistribute assets — file names and sizes only.

`render_spec_layers.py` replaced `render_score_layers.py` for the English show and
deliberately emits **the same seven layer names and timings**, so `build_plan.py` and its
SFX cue table did not change. Uploads are always confirmed with the user first.

## Motion graphics without keyframes — `docs/MOTION.md`

AuraVideo has no keyframes, so anything that moves (the series logo intro, the
score card) is pre-rendered as **one ProRes 4444 alpha clip per element** by
`scripts/motion/render_*_layers.py` and placed as separate clips on separate
tracks, so each element stays individually adjustable in the editor. The
brand assets live in `assets/brand/`, reusable sound effects in `assets/sfx/`.
`docs/MOTION.md` records the exact timings, layout and rules the user set
(bright background, motion on every in/out, thick outline + heavy shadow,
labels as subtitles not baked into images). Note `track.add` appends tracks
**behind** the defaults — add overlay tracks first and the background track last.

## Desktop plumbing self-test — `src/utils/selftest.ts`

The filter graph can be checked from a shell, but the JS↔Rust seam (command names, argument casing, event payload shape, fs permissions, working directory) can only be exercised inside the real app. `runSelfTest` runs the whole native export path end-to-end on a generated clip and writes step-by-step results to `<temp>/auravideo/selftest.json`, so a desktop build can be verified without driving the GUI.

Gated at build time behind `VITE_SELFTEST=1` (`src/main.tsx`) — it is never present in a normal build.

## State of play (2026-08-30)

Shipped this round, all verified on real generated footage:

1. **Playback performance** — the editor got slower the more you cut, because the RAF loop wrote the playhead to the store 60×/s and `Timeline` subscribed to it. Fixed with `playheadBus` + memoisation.
2. **Desktop build (Tauri)** — native ffmpeg export with hardware encoders, path-referenced inputs, direct-to-file output.
3. **Agent control bridge** — the editor is drivable head-lessly and can screenshot its own preview.
4. **`blend` in YUV** — was casting every blend/glow magenta. Now forced through `format=gbrp`.
5. **`hasAudio` was hardcoded true** — every silent clip (i.e. all generated footage) failed to export.
6. **LED features** — 32:9 presets, five fill modes, beat grid + beat-locked cuts, seamless loop.
7. **Alpha preview proxies** — cut-out overlays now look the same on screen as they render.

Known gaps / next steps, roughly in order:

- **ComfyUI client inside the app.** Generation still happens by hand in `led_stage`. The intended end state is a `generate.insert`-style command: prompt + a bar number → generate → RMBG → alpha encode → import → place on that downbeat.
- **The wasm path for `blendMode` / `glow` has never been verified end-to-end.** Native is confirmed; the browser is not. Do not assume.
- **Chroma key** — for green-screen stock, as an alternative to alpha sources.
- **Built-in overlay generators** (petals / snow / embers / bokeh) so elements don't have to be sourced externally.
- **Keyframe animation** — nothing moves over time yet; a logo cannot pulse and a petal layer cannot drift on its own.
- **Web build's `hasAudio`** is still assumed `true`; only the desktop probes it. A silent clip will still break a browser export.
- Everything from this round is committed locally but **not pushed**.

## Gotchas

- **Don't restart the dev server casually after touching `vite.config.ts`** — Vite re-optimizes deps and the public dir lookup can lag. If `/` returns 404 or `/ffmpeg-core/*` returns SPA HTML after a config change, kill all node processes (`Get-Process node | Stop-Process -Force`) and restart cleanly.
- `public/ffmpeg-core/` is **auto-generated**; do not commit. The Vite plugin re-copies on next start.
- `package-lock.json` **is** committed and required by CI (`npm ci`).
- `.claude/` (Claude Code per-user settings) is gitignored.
- `@ffmpeg/core-mt` is still in `package.json` but has **zero references in the source** — a leftover of the abandoned multi-threaded attempt. Don't take its presence as a sign core-mt is in use.
- `public/ffmpeg/` is an empty leftover directory (the path that doesn't work; see the FFmpeg core section). The real files live in `public/ffmpeg-core/`.
