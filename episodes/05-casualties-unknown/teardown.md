# Casualties: Unknown Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **4576510**, depot **4576511**,
build **24774057**, manifest `419854421620503848` dated **17 August 2026**.
189 entries / 171 files, **517.19 MiB on disk** (312.56 MiB compressed).
File names and sizes only — nothing unpacked, decompiled or redistributed.

Developer **Orsoniks** (Poland, also known as Moffee), published by Oro Interactive.
This is the counter-example to episode 04 (Nomad Drive), which bought every hard system.

## Engine

| Fact | Evidence |
|---|---|
| Unity | `UnityPlayer.dll` (29.66 MiB), `CasualtiesUnknown_Data/` |
| **URP, 2D renderer** | `Unity.RenderPipelines.Universal.Runtime.dll`, `Unity.RenderPipelines.Universal.2D.Internal.dll` |
| 2D physics | `UnityEngine.Physics2DModule.dll` |
| **Mono backend** | `MonoBleedingEdge/EmbedRuntime/mono-2.0-bdwgc.dll`; `Assembly-CSharp.dll` present as a real assembly |
| Burst compiled | `Unity.Burst.dll`, `lib_burst_generated.dll` |
| Also present | `Unity.TextMeshPro.dll`, `Unity.Timeline.dll`, `UnityEngine.AIModule.dll`, `UnityEngine.TerrainModule.dll` |

URP 2D is the ordinary small-team choice, and it shows in the store page's minimum
spec: an **Intel Core i3-8130U** laptop CPU and **500 MB** of disk.

## The whole game is one 858 KB assembly

- `CasualtiesUnknown_Data/Managed/Assembly-CSharp.dll` — **858.50 KiB**
- `UnityPlayer.dll` — **29.66 MiB**. The engine is **≈35×** larger than the game it runs.
- **Two scenes**: `level0` (80.03 KiB), `level1` (331.88 KiB). Nothing else.
- Bulk of the download: `resources.resource` **242.07 MiB**, `sharedassets0.assets` 86.86 MiB,
  `resources.assets` 33.02 MiB.

Two scenes at that size means the world is **generated and data-driven**, not authored.
The store copy backs it: eleven procedurally generated cave layers.

## The shopping list — in full

Non-Unity, non-runtime assemblies in the entire build:

| File | What it is |
|---|---|
| `Assembly-CSharp.dll` | the game |
| `DiscordRPC.dll` | Discord rich presence |
| `com.lachee.discordrpc.runtime.dll` | its Unity wrapper |
| `Newtonsoft.Json.dll` | JSON, pulled in by the above (and by the Lang files) |
| `NativeNamedPipe.dll` | how the Discord library talks to the client |
| `Microsoft.Win32.Registry.dll` | .NET base class library |

That is the list. **No audio middleware** (no `.bank` files, no FMOD/Wwise), no Odin,
no character controller package, no save framework, no tweening library, no networking
stack. Compare episode 04, which shipped more than twenty commercial packages.

## Things in the file list that are decisions, not features

- **`CasualtiesUnknown_Data/Lang/EN.json` (348.05 KiB) and `Lang/zh-CN.json` (335.07 KiB).**
  A hand-rolled JSON localisation system — `UnityEngine.LocalizationModule.dll` is the
  stub module, not Unity's Localization package. The Steam page lists **English only**,
  yet Simplified Chinese ships in the build: the itch.io page says translations are
  **maintained by the community**, and the developer simply ships them.
  It works — of the last 800 reviews, 476 are English and **175 are Russian**.
- **`CasualtiesUnknown_Data/custommusic/READ_ME.txt`.** Players can drop their own audio
  files in and the game plays them.
- 348 KB of English strings is a lot of writing for one person.

## What the review corpus says (n = 800 recent, `analyze_reviews.py --pages 8`)

- 94.4% positive in the recent window; **6,803 total reviews, 96.2% positive
  ("Overwhelmingly Positive")** — a tier most shipped games never reach.
- **Playtime at review: median 604 min (10.1 h), mean 1602 min (26.7 h), p90 4025 min
  (67 h), maximum 16,506 min (275 h). Only 1% under ten minutes.** In a free demo.
- Recommended: median 655 min. Not recommended: median 65 min. A ten-to-one split —
  the widest measured on this channel so far.
- Topic counts (positive / negative): co-op & social 50/2, looks 39/4, potential 39/1,
  content 21/1, pace 19/3, bugs 14/1, **performance only 6/2**. Performance is a
  non-issue here, which is exactly what a 517 MB URP 2D build should look like.
- The negatives are about **UI/UX** ("the devs seem to completely ignore UI and UX",
  13 votes) and about **losing long runs to a crash** ("I have just lost my eight hour
  run", 11 votes), plus tutorials locked behind progression and RNG frustration.
- Content warning on the store page covers violence, gore, depression and self-harm; one
  reviewer argues it understates it. Worth a sentence on screen, not a joke.

## Developer's own record

- itch.io (`orsonik.itch.io/scav-prototype`): **4.9 / 5 from 1,274 ratings**, demo zip
  286 MB. Update 2 in March 2025, Demo 3 in May 2025, Steam demo 28 April 2026 — so the
  project predates the Steam listing by well over a year.
- The page states plainly: **"No generative AI was used."**
- Community translations are credited to fans; there is a Discord.

## Not verified / do not assert

- Exact team size beyond "one developer" — that is what the itch page and the store
  credits say, but no headcount statement exists.
- Unity's exact version (the manifest does not carry it).
- When development actually started; only the itch update dates are public.
- Why the tutorials are gated — reviewers complain, the developer has not answered
  publicly as far as I could find.

## The evidence cards used on screen

```bash
E=episodes/05-casualties-unknown
python scripts/motion/render_evidence_card.py $E/ev_engine.png --title "THE ENGINE" --subtitle "Read off the demo's public file list" --lines "UnityPlayer.dll|it's Unity" "Unity.RenderPipelines.Universal.Runtime.dll|URP, not HDRP" "Unity.RenderPipelines.Universal.2D.Internal.dll|the 2D renderer" "UnityEngine.Physics2DModule.dll|2D physics" "mono-2.0-bdwgc.dll|Mono backend" ">The boring, correct choice."
python scripts/motion/render_evidence_card.py $E/ev_code.png --title "THE WHOLE GAME" --lines "Managed/Assembly-CSharp.dll|858.50 KiB - every system, every wound" "UnityPlayer.dll|29.66 MiB - the engine that runs it" "level0|80.03 KiB" "level1|331.88 KiB" ">Two scenes. The world is generated."
python scripts/motion/render_evidence_card.py $E/ev_stack.png --title "THE SHOPPING LIST" --subtitle "Third-party packages, in full" --lines "DiscordRPC.dll|Discord rich presence" "com.lachee.discordrpc.runtime.dll|its Unity wrapper" "Newtonsoft.Json.dll|ships with it" "NativeNamedPipe.dll|ships with it" ">That is the entire list."
python scripts/motion/render_evidence_card.py $E/ev_lang.png --title "THE PART I DIDN'T EXPECT" --lines "Lang/EN.json|348.05 KiB of text" "Lang/zh-CN.json|335.07 KiB - store says English only" "custommusic/READ_ME.txt|drop in your own soundtrack" ">Translations come from the players."
```

## Side by side with episode 04

| | Nomad Drive (ep 04) | Casualties: Unknown (ep 05) |
|---|---|---|
| Build | 3.71 GiB, 322 entries | **517 MiB, 189 entries** |
| Render pipeline | HDRP (Unity 6) | **URP 2D** |
| Scripting backend | Mono | Mono |
| Third-party packages | 20+ (NWH, MapMagic, Mirror, EOS, Odin, Rewired, Enviro, Final IK, …) | **1** (DiscordRPC) |
| Own framework | 16 `EvilCore` assemblies | one 858 KB `Assembly-CSharp.dll` |
| Scenes | 4 | **2** |
| Localisation | 23 languages, shipped | English + community Chinese, hand-rolled JSON |
| Steam reviews | 69.8% recent / 1k | **96.2% all-time / 6.8k** |
| Median playtime at review | 156 min | **604 min** |
| Time to ship | months | years (itch first) |

Neither is wrong. That contrast is the point of running these two episodes back to back:
buying the hard systems is how you ship, writing them is how you end up with something
nobody can copy.
