# SlashZero Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **5099550**, depot **5099551**,
manifest `6848674264353288254`, build `25049347`, seen **3 September 2026 15:15 UTC**.
**582 entries / 497 files, 14.22 GiB on disk / 11.98 GiB download (15.80% saving).**
File names, paths and sizes only — nothing unpacked, decompiled or redistributed.

## Who made it

| Fact | Source |
|---|---|
| Developer **Streetlamp Studio**, publisher **Skystone Games** | Steam |
| Chinese title 零境·入侵; site streetlampgame.com | Steam / store |
| Side-scrolling 3D anime action roguelike; you play a "Timehacker" | Steam about |
| Release **Q1 2027**; demo live 3 Sep 2026 | Steam |
| 6 languages, full audio in **English, Simplified Chinese, Korean** | Steam |
| **0 reviews** (demo, no review corpus); **342 concurrent** at time of writing | Steam / SteamDB |

## File types

| type | files | total |
|---|---|---|
| ucas | 4 | 12.07 GiB |
| bk2 | 208 | 809.54 MiB |
| dll | 119 | 737.81 MiB |
| pak | 119 | 327.78 MiB |
| exe | 7 | 278.23 MiB |
| sys / cat / inf | 1 / 1 / 1 | 1.12 MiB / 11.79 KiB / 1.83 KiB |

## Engine

**Unreal Engine 5.** `global.ucas`/`.utoc` plus `pakchunk0..2` — the IoStore container
format is UE5 only. Content is one chunk: `pakchunk2-Windows.ucas` is **11.93 GiB** of the
14.22 total. `pakchunk1` is a stub (`.ucas` **64 bytes**, `.utoc` 240 bytes) — an empty
chunk that was configured but never filled.

`Zero-Win64-Shipping.exe` is **234.27 MiB**, monolithic. `Zero.exe` (1006 KiB) is the
launcher shim in front of it.

## The mobile twin — 103 videos shipped twice

`Zero/Content/Movies/` holds **208 Bink videos**, and they are two identical sets:

| set | files | size |
|---|---|---|
| `Movies/Mobile/…` | 103 | 164.72 MiB |
| `Movies/PC/…` | 103 | 614.45 MiB |

Every filename in one set exists in the other — checked, zero on either side without a
partner. Same three folders each: `SkillDesc/101` (22), `SkillDesc/102` (26),
`SkillDesc/104` (30), `Tutorial` (8), `TutorialMode` (17).

Two things fall out of that:

1. **This is a mobile game's PC build.** The PC demo carries 164 MiB of phone-resolution
   skill-tutorial clips a PC player will never be shown. Nobody stripped the platform
   branch out of the cook.
2. **The character IDs are 101, 102 and 104.** 103 is missing. Three Timehackers in the
   demo, and the numbering says a fourth exists upstream.

## Two Chromium browsers, 417 MiB

| what | evidence |
|---|---|
| Unreal's own CEF3 | `Engine/Binaries/ThirdParty/CEF3/Win64/128.4.13+ge76af7e+chromium-128.0.6613.138/libcef.dll` **228.88 MiB** + `EpicWebHelper.exe` |
| A **second**, publisher-side CEF | `Zero/Binaries/Win64/libcef.dll` **188.04 MiB** + `cefsubprocess.exe` |

The second one has its own resource folder, `ttcefresource/`, containing
`back.bmp`, `forward.bmp`, `close.bmp`, `ic_reload.bmp` and `networkerror.html` — i.e.
a full browser chrome with navigation buttons and an offline error page. That is an
in-game webview for an account/login/news page, not a UI widget.

**119 `.pak` files** in the build; **110 of them are Chromium locale packs** across the
two CEF copies, for a game that ships 6 languages.

## Two real-time voice SDKs — from competing companies

| SDK | files |
|---|---|
| **ByteDance** VolcEngine RTC | `VolcEngineRTC.dll` **23.22 MiB** |
| **Tencent** GME | `gmesdk.dll` 3.75 MiB, `TencentGME.dll` 247.29 KiB |

Both are voice/video chat middleware. Both are in the same build.

## The rest of the ByteDance stack

`gsdk.dll` 3.90 MiB, `logsdk.dll` 2.22 MiB, `deviceregister_shared.dll` 290 KiB,
`sscronet.dll` 6.92 MiB, `ssgamesdkcronet.dll` 1.62 MiB, `downloader.dll`,
`parfait.dll` + `parfait_crash_handler.exe`, `gsdk.ico`. Cronet is Chromium's network
stack shipped standalone — a third network layer, on top of `libcurl.dll` and UE's own.

## A kernel driver

`Zero/Binaries/Win64/GPLDriver.sys` **1.12 MiB**, signed (`gpldriver.cat`) and installable
(`GPLDriver.inf`), alongside `gp.dll` 7.04 MiB, `gpm.dll`, `gpmperf.dll`. A ring-0 driver
in a single-player side-scrolling demo. *What it does is not visible from a file list —
say "kernel-mode driver", not "anti-cheat".*

## Slips left in the shipping build

| leftover | size |
|---|---|
| **Wwise `…/x64_vc170/Profile/bin/`** — the *Profile* sound engine, not Release. 33 `Ak*` plugins including `AkRecorder`, `AkSineTone`, `AkSilenceGenerator`, `AkMeter` | 3.08 MiB engine + plugins |
| `Manifest_UFSFiles_Win64.txt` — the full cook file manifest, in plain text | **8.56 MiB** |
| `Engine/Content/SlateDebug/Fonts/LastResort.ttf` — debug fallback font | 5.15 MiB |
| `Engine/Config/StagedBuild_Zero.ini` | 3 B |
| `Zero/EarliestPossibleStartup/Engine.ini` | 92 B |
| `vc_redist.arm64.exe` shipped next to the x64 one | 11.18 MiB |

The Wwise one is the interesting one: a Profile build keeps the authoring-tool connection
open. It is the same category of mistake as episode 10's D3D12 debug layer, one layer deeper.

## Upscaling, both vendors

NVIDIA `nvngx_dlss.dll` 28.59 MiB, `nvngx_dlssd.dll` 27.23 MiB (ray reconstruction),
`nvngx_dlssg.dll` 7.16 MiB (frame generation), `nvngx_deepdvc.dll` 3.00 MiB, plus
Streamline (`sl.common`, `sl.interposer`, `sl.reflex`, `sl.pcl`, `sl.dlss_g`, `sl.deepdvc`).
AMD FidelityFX FSR under `Zero/Plugins/AMD/FSR/…/signedbin`. Full DLSS 3 + FSR stack.

Also: Steamworks **v1.61** with `sdkencryptedappticket64.dll` (server-verified identity),
Discord Game SDK, Intel oneTBB, `libcrypto-1_1`, D3D12 Agility SDK, NVIDIA Aftermath.

## Three things worth saying on camera

1. **103 videos, shipped twice.** The Mobile set proves the PC build is a port of a phone
   game, and it is 164 MiB the PC player will never see.
2. **Two Chromium browsers and two rival voice SDKs.** 417 MiB of Chromium, plus ByteDance
   and Tencent RTC side by side, in a 14 GiB demo with no visible multiplayer.
3. **The Wwise Profile build.** Not the debug layer this time — the audio engine itself is
   the profiling variant, with every stock authoring plugin along for the ride.

## Reception

No Steam reviews. **342 concurrent in the demo** is the only number. State it as the only
number, the way episode 10 did.

## Not verified / do not assert

- What `GPLDriver.sys` does. It is a kernel driver; call it that.
- Whether the RTC SDKs are ever initialised, or what the webview loads.
- Anything inside `.ucas` / `.pak`.
- Why 103 is missing from the character IDs.
