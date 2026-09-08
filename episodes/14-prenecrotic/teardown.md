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
