# FINAL FANTASY RESONANCE Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **4474710**, depot **4474711**.
**71 entries (26 files), 5.72 GiB on disk / 5.38 GiB download (5.91% saving).**
File names and sizes only — nothing unpacked, decompiled or redistributed.
Manifest dated **3 July 2026**; demo went live **3 September 2026**, full game **22 October 2026**.

## Who made it

| Fact | Source |
|---|---|
| Developer **Square Enix + LANCARSE Ltd.**, publisher Square Enix | Steam / SteamDB |
| **Team Asano** (Octopath Traveler, Triangle Strategy): EP Tomoya Asano, producer Keisuke Nakashima, director Hiroto Furuya | GamesRadar, Inven Global |
| **LANCARSE**: Shinjuku, Tokyo. Co-dev credits: SMT Strange Journey (Atlus), Lost Dimension, Zanki Zero, Monark, **The DioField Chronicle** (with Square Enix) | lancarse.co.jp, MobyGames |
| First **HD-2D** Final Fantasy; adapts season 1 of *FF Brave Exvius*; "Visions" summon classic FF characters mid-battle | FF Wiki, GamesRadar |
| Demo = **the whole of Chapter 1** (JP title: 第一章まるごと先行体験版) | SteamDB name_localized |
| Price ₩62,800; 8 languages, full audio EN/JA | Steam |
| **4,424 in the demo** at time of writing; **0 reviews** — pre-release demos of major publishers have reviews off | SteamDB / Steam |

## Engine and what the file list says

| Fact | Evidence |
|---|---|
| **Unreal Engine 5** | `FFRS-Windows.ucas` / `.utoc` — the IoStore container format is UE5 only |
| Content is two containers | `FFRS-Windows.ucas` **4.11 GiB** + `FFRS-Windows.pak` **1.09 GiB** = 5.2 GiB of the 5.72 |
| **`FFRS-Win64-Shipping.exe` is 467 MiB** | one monolithic executable — everything is statically linked; only 14 DLLs ship, all third-party |
| D3D12 Agility SDK | `D3D12Core.dll` — and **`d3d12SDKLayers.dll` (5.5 MiB), the D3D12 *debug* layer**, which has no business in a shipping build |
| **ONNX Runtime + DirectML** | `Engine/Plugins/NNE/NNERuntimeORT/…/onnxruntime.dll` **14 MiB**, `DirectML.dll` **17.7 MiB** — Unreal's Neural Network Engine plugin, i.e. an ML inference runtime inside a pixel-art RPG |
| NVIDIA Aftermath | `GFSDK_Aftermath_Lib.x64.dll` — GPU crash reporting |
| Intel oneTBB | `tbb12.dll`, `tbbmalloc.dll` |
| MsQuic | `msquic.dll` — HTTP/3 transport (telemetry / online services) |
| Audio: **XAudio2 + Ogg Vorbis** | `xaudio2_9redist.dll`, `libvorbis_64.dll` — no Wwise, no FMOD |
| Steamworks v1.57 | `steam_api64.dll` |
| Leftovers | `Engine/Config/StagedBuild_FFRS.ini` (3 bytes), `SlateDebug/Fonts/LastResort.ttf` (5.15 MiB debug fallback font) |

### Three things worth saying on camera

1. **The demo is a fifth of the game's engine surface and all of its first chapter.** 5.2 GiB of
   content for one chapter suggests the full game will be large; Square Enix's minimum spec
   says 15 GB.
2. **An ML runtime ships in an HD-2D game.** ONNX Runtime + DirectML via UE's NNE plugin. What
   it does is not visible from a file list — candidates are upscaling, animation, or a plugin
   dependency that was never trimmed. *Estimate. Say so.*
3. **The D3D12 debug layer is in the build.** Same category as episode 06's debug symbols:
   harmless to players, a sign the staging config wasn't tightened. Big studio, same slip.

## Reception

No Steam reviews (disabled pre-release). What there is: **4,400+ concurrent in the demo two
days after launch** — more than any demo this channel has covered (Guildrun's 2,800 was the
previous high). Community hub and press previews are the only text signal; quote, don't count.

## Not verified / do not assert

- What the NNE/ONNX runtime is used for.
- Anything inside the `.ucas`/`.pak` containers.
- LANCARSE's share of the work versus Team Asano's.
- Any reception number. There are none.
