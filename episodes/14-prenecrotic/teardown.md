# Prenecrotic: The Cursed School VR — demo teardown

Read from the public SteamDB depot manifest for depot **4947431** (build 25036385,
published 7 Sep 2026 09:12 UTC). File names and sizes only — nothing unpacked,
decompiled or redistributed.

- Demo app `4947430`, full game `3723640`, Elfhiem Game Studio (self-published)
- **VR only** (`onlyvrsupport: Yes`, `OpenVrSupport: Yes`), Windows only
- 10 languages, English + Simplified Chinese with full audio. No reviews yet.

## The size

| | |
|---|---|
| On disk | **22.28 GiB** |
| Download | 12.21 GiB |
| Files | 1,171 in 24 folders |
| **Store page says** | **"Storage: 9 GB available space"** |

## Where 22 GB goes — 83% is one group, six times

`Prenecrotic_Data/StreamingAssets/aa/StandaloneWindows64/` holds the Addressables
bundles. Grouped by the name Addressables gives them:

| group | bundles | each | total |
|---|---|---|---|
| `defaultlocalgroup_scenes_all_<hash>` | **6** | 3.09 GiB | **18.54 GiB** |
| `defaultlocalgroup_assets_all_<hash>` | 2 | 119.12 MiB | 0.23 GiB |
| `globalshared_assets_all` | 1 | 1.66 MiB | — |
| `contentupdate_assets_all` | 1 | 31.94 KiB | — |

The trailing hash is Addressables' **content hash**, so six different hashes means six
different builds of the same group — not six different scene sets. Each rebuild writes a
new hash-named bundle beside the old ones, and nothing deletes the old ones; the whole
folder then gets packed. Only one of the six is ever loaded.

**~15.5 GiB of the demo is previous builds of the same scenes.**

## Two folders whose names are instructions

| folder | files | size |
|---|---|---|
| `Prenecrotic_BackUpThisFolder_ButDontShipItWithYourGame/` | 1,069 | 1.06 GiB |
| `Prenecrotic_BurstDebugInformation_DoNotShip/` | 1 | 0.4 MiB |

Unity writes both names itself. Inside the first: **750 `.cpp` (931.75 MiB) and 164 `.c`
(129.87 MiB)** — the C++ that IL2CPP generated from the game's C#, plus 153 managed
assemblies. It is the build's own symbol/source backup, and the folder name is the
warning.

Subtracting the duplicates and the two folders leaves roughly **3.7 GiB** of game.

## The VR stack — three of them

`SteamVR`, `Oculus.VR` + `OVRPlugin.dll` (7.61 MiB), and `UnityOpenXR.dll` +
`XrApiLayer_METAX_operator.dll` (6.90 MiB) are all present. Also
`Prenecrotic_Data/Plugins/**ARM64**/XRSimulationSubsystem.dll` — the editor's device
simulator, in an ARM64 build, in a Windows-only game.

## What else is in there

- `nvngx_dlss.dll` **48.91 MiB** — DLSS, via the `com.alteregogames.aeg-dlss` package
- `OpenCvSharpExtern.dll` **33.94 MiB** — OpenCV
- `meta.xr.ai.agentbridge`, `meta.xr.ai.mcpbridge` — Meta's XR **MCP / AI-agent bridge**,
  editor tooling, in the player build (cf. episode 12, Rudravati)
- `Meta.XR.ImmersiveDebugger` (+ `.DevAgent`, `.Interface`), `IngameDebugConsole`
- Asset-store roster: Bakery (lightmaps), MagicaClothV2, SALSA-LipSync, RootMotion
  (Final IK), EasyRoads3Dv3, AdaptiveGI, MeshBaker, CutsceneEngine, Decalery,
  AllIn1SpriteShader, AmazingAssets/VacuumShaders TerrainToMesh, MirrorsAndReflections,
  Kamgam.MeshExtractor, LightmapSwitcher, RuntimeOptimizer

## The lesson for a dev

Three checkboxes and a delete, worth ~18.5 GB:
1. Clear `StreamingAssets/aa/` (or the Addressables build path) between builds.
2. Don't ship `*_BackUpThisFolder_ButDontShipItWithYourGame/` or `*_DoNotShip/`.
3. Pick one XR path.

## The trailers' burnt-in captions

`t0.mp4` (the newer trailer) carries the ELFHIEM studio card around **17–19 s** and the
PRENECROTIC title cards from **~98 s to the end**. On `t1.mp4` the studio card is
**~5–10.5 s** and the title card **~106–117 s**. Every `in` in `script.json` is chosen
outside those. Both trailers are also very dark: line 19 was moved off `t0` 40.5 s
because that run averages luma 4.7 for 3.5 s and read as a dead screen under the
section's punchline.

## Rebuilding this episode's assets

Everything in this folder that git does not track is ignored and reproducible.

```bash
E=episodes/14-prenecrotic
SRC="SteamDB depot manifest · app 4947430 · 7 Sep 2026"

python scripts/pipeline/steam_fetch.py --demo 4947430 --out $E

# Trailers. appdetails returns no mp4 for this app; these are the HLS masters from
# IStoreBrowseService/GetItems (include_trailers), prefixed by
# https://video.cloudflare.steamstatic.com/store_trailers/
ffmpeg -i ".../4947430/1010525261/7e0a6169430c5801f710ba1421a441c45c6d4765/1786095496/hls_264_master.m3u8" -c copy $E/t0.mp4
ffmpeg -i ".../4947430/1758818695/c2e481ce45545271640f6c9457a8d3f1a972c14d/1783590815/hls_264_master.m3u8" -c copy $E/t1.mp4

python scripts/motion/render_evidence_card.py $E/ev_size.png --title "TWENTY-TWO GIGABYTES" --subtitle "for a demo" --source "$SRC" \
  --lines "Size on disk|22.28 GiB" "Download|12.21 GiB" "Files|1,171" \
          ">The store page asks for 9 GB of free space."

python scripts/motion/render_evidence_card.py $E/ev_dupes.png --title "ONE GROUP, SIX TIMES" --subtitle "StreamingAssets/aa/StandaloneWindows64/" --source "$SRC" \
  --lines "defaultlocalgroup_scenes_all_077c3f93.bundle|3.09 GiB" \
          "defaultlocalgroup_scenes_all_4de905e4.bundle|3.09 GiB" \
          "defaultlocalgroup_scenes_all_6ca1e842.bundle|3.09 GiB" \
          "defaultlocalgroup_scenes_all_6d09ec54.bundle|3.09 GiB" \
          "defaultlocalgroup_scenes_all_c2471578.bundle|3.09 GiB" \
          "defaultlocalgroup_scenes_all_df3250f0.bundle|3.09 GiB" \
          ">Six content hashes = six builds of one group. 18.54 GiB."

python scripts/motion/render_evidence_card.py $E/ev_folder.png --title "THE FOLDER NAME IS THE WARNING" --subtitle "Unity writes this name itself" --source "$SRC" \
  --lines "Prenecrotic_BackUpThisFolder_ButDontShipItWithYourGame/|1,069 files - 1.06 GiB" \
          "750 x .cpp|931.75 MiB - what IL2CPP generated" \
          "164 x .c|129.87 MiB" \
          "153 x .dll|the managed assemblies" \
          "Prenecrotic_BurstDebugInformation_DoNotShip/|also shipped"

python scripts/motion/render_evidence_card.py $E/ev_vr.png --title "THREE WAYS INTO A HEADSET" --subtitle "all present in one build" --source "$SRC" \
  --lines "SteamVR.dll|Valve's own runtime" \
          "OVRPlugin.dll|7.61 MiB - Meta" \
          "UnityOpenXR.dll|the open standard" \
          "Plugins/ARM64/XRSimulationSubsystem.dll|the editor's fake headset" \
          ">The game is Windows-only. ARM64 cannot run."

python scripts/motion/render_evidence_card.py $E/ev_odd.png --title "TWO THAT DO NOT BELONG" --source "$SRC" \
  --lines "OpenCvSharpExtern.dll|33.94 MiB - computer vision" \
          "nvngx_dlss.dll|48.91 MiB - DLSS, in VR" \
          "meta.xr.ai.mcpbridge.dll|Meta's XR agent bridge" \
          "meta.xr.ai.agentbridge.dll|editor tooling, in a player build"

python scripts/motion/render_evidence_card.py $E/ev_left.png --title "WHAT IS ACTUALLY THE GAME" --subtitle "22.28 GiB, accounted for" --source "$SRC" \
  --lines "Stale scene bundles|18.54 GiB" \
          "BackUpThisFolder / DoNotShip|1.06 GiB" \
          ">Everything else - the game - is about 3.7 GiB."

# still_bg.png is tracked. It was gpt-image-2, prompt: an exploded cyan wireframe VR
# headset over a school desk and chair on a navy drafting grid, wide empty margins,
# absolutely no text.

# brand layers: intro_*.mov and logo_c_rgba.png are identical every episode, copy them
# from any earlier episode folder. The spec sheet is per-episode:
python scripts/motion/render_spec_layers.py '[["ENGINE","Unity - IL2CPP - VR only"],["THE BUILD","22.28 GB / 1,171 files"],["THE WASTE","18.54 GB of old builds"],["LEFT IN","the DoNotShip folders"],["ALSO","3 XR runtimes, OpenCV"]]' --verdict "WORTH A DIP"
for n in header row_0 row_1 row_2 row_3 row_4 stamp; do ffmpeg -y -framerate 30 -i sc_$n/f%03d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le $E/score_$n.mov; done

python scripts/motion/kenburns.py $E
python scripts/pipeline/build_plan.py --episode $E/episode.json --out $E/plan.json

python scripts/motion/make_thumbnail.py --bg $E/ss00.jpg --out $E/thumb.jpg \
  --line1 "A {22 GB} DEMO" --line2 "18 GB OF IT IS OLD BUILDS" --tag "UNITY VR TEARDOWN" \
  --title-size 92 --hook-size 50 --accent-scale 1.5 --zoom 1.5 --ox 0.21 --oy 0.31 --text-side left
```

Assembly and export are the same as every episode — `docs/PIPELINE.md` ⑦. This one is
263 s, so export in two halves at a real clip boundary (128.158 s) and `concat -c copy`.
