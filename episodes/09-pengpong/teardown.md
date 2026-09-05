# PengPong Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **3636220**, depot **3636222** (Win64).
**282 files, 2.68 GiB.** File names and sizes only — nothing unpacked, decompiled or
redistributed. Korean-channel original: `episodes/ko-03-pengpong/teardown.md`.

Developer **SANDY FLOOR** (Korea), dev = publisher. Full game app 2766910, released
2026-08-20. Demo **86.6% / 134**, full game 84.9%. Base languages English + Korean;
Chinese (simplified) is the largest review language on the full game.

## Engine, language, backend

| Fact | Evidence |
|---|---|
| Unity, **Mono scripting backend** | `MonoBleedingEdge/`, `Managed/*.dll` present |
| Game code lives outside the default assembly | `Assembly-CSharp.dll` **5 KB**; `COre.dll` **2.37 MiB** |
| Addressables | 17 `.bundle`, 529 MiB |
| SQLite for saves | `Mono.Data.Sqlite.dll` |
| Localization package | 8 languages |

Mono means every managed dependency sits in `Managed/` under its own name — the most
readable kind of Unity build (contrast episodes 06–07, IL2CPP).

## What they paid for — $95, total

| Package | Price | In the build |
|---|---|---|
| Febucci **Text Animator** | $65 | yes |
| **AraTrail** | $30 | yes |
| Spine (personal) | $349 | **no** — `Unity 2D Animation` + `2D IK` packages instead ($0) |
| DOTween, Coffee.UIParticle, NavMeshPlus, GameAnalytics | free / OSS | yes |
| **FMOD Studio** | free under $200k/yr revenue | `FMODUnity.dll` + 4 `.bank` (29.76 MiB) |

The Cuphead-style bone animation reviewers praise is done with Unity's own free 2D
Animation package, not Spine.

## Eight in-house modules

`Assembly-CSharp.dll` at 5 KB means the code was moved out through Assembly Definitions
(asmdef). The resulting modules all carry the studio's name:

`SandyToolkit` · `SandyToolkitCore` · `SandyAddressable` · `SandyAudio` · `SandyPooling` ·
`SandySetting` · `SandyDependency` · `SandyDamageFontManager`

Pooling, audio, settings, dependency injection — the layer a studio carries to its next
project. *Estimate, stated as one:* this is a second-project codebase, not a first one.

## Two things that should not be in a release build

1. **`Unity.Recorder`** — editor-only video capture. Harmless; forgotten.
2. **`MCPForUnity.Runtime.dll`** — the Model Context Protocol bridge that lets an AI model
   drive the Unity editor. **Confirmed: the file is in the shipped build.** Not confirmed:
   how much it was used, or for what. The script says so in those words.

## Size

2.68 GiB total: art and sound ≈ 2.2 GiB; all 195 DLLs together 91 MiB.

## Reviews (demo n=134 summary; full-game corpus n=258, 219 positive)

- Praise concentrates on the 1930s rubber-hose art; Cuphead is named repeatedly.
- The full game's complaint concentrates on **three stages at launch**.
- Median playtime at review (full-game corpus): 171 min.

## Not verified / do not assert

- Team size or budget. "Korean studio" and the module names are all the manifest says.
- What MCP for Unity was used for. Presence only.
- Anything inside the Addressables bundles.
