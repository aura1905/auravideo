# Veiled Shadows Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **5060640**, depot **5060641**.
**71 entries (65 files), 1.42 GiB on disk / 1.33 GiB download — only 6.16% saving.**
File names and sizes only — nothing unpacked, decompiled or redistributed.

Developer **Party of One Games**, dev = publisher. Full game app 4122240, Q1 2027.
A reviewer identifies them as **a solo developer from Austria**; the studio name says the
same thing. Store page lists **English only**, and full audio — there is voice acting.

## The engine is not Unity, and that is the episode

| Fact | Evidence |
|---|---|
| **RPG Developer Bakin** (KMY Engine) | SteamDB Technologies; `bakinengine.dll`, `bakinplayer.exe`, `bakinplayer.pak` |
| Bakin is by **SmileBoom** (Japan), **$69.99** on Steam | successor to SMILE GAME BUILDER; EA Oct 2022, 1.0 Aug 2025 |
| Sold as **programming-free** RPG creation | SmileBoom's own press release |
| Renderer: **both** OpenGL and D3D12 | `kmyOGL.dll`, `kmyDX12.dll`, `glew32.dll` |
| Store minimum spec asks for **OpenGL 4.4** | so the OpenGL path is the shipped default |

`VeiledShadowsDemo.exe` is **562 KiB**. It is a launcher. The program that actually runs
the game is `bakinplayer.exe` (332 KiB) driving `bakinengine.dll`.

## Where the 1.42 GiB went

| File | Size | Share |
|---|---|---|
| `data/data.rbpack` | **1.35 GiB** | **95%** |
| 39 × `.dll` | 52.20 MiB | 3.6% |
| 8 × `.dlp` (Bakin loader plugins) | 12.17 MiB | 0.8% |
| everything else | < 1 MiB | — |

**One file is the game.** Every map, model, portrait, line of dialogue and voice clip the
developer authored is inside `data.rbpack`. The other 70 entries are Bakin's runtime,
shipped as-is. The 6.16% compression saving says the pack is already compressed.

That ratio is the story: a month of one person's authored content against ~67 MiB of
engine they did not write and cannot change.

## Three things a "no-code" tool ships inside your game

1. **A C# compiler.** `Microsoft.CodeAnalysis.CSharp.dll` (6.28 MiB) +
   `Microsoft.CodeAnalysis.dll` (4.43 MiB) — that is **Roslyn**, ~10.7 MiB of it. Bakin
   does offer an optional C# script feature, and this is what pays for it: every game
   made in it carries a compiler, whether or not the author wrote a line of C#.
2. **A web browser.** `Microsoft.Web.WebView2.Core.dll`, `WebView2Loader.dll`,
   `EdgeBrowserControl.dll` — an embedded Edge control inside a turn-based RPG.
   *(What it is used for is not visible from a file list. Estimate only.)*
3. **A VTuber avatar loader.** `VRMLoader.dlp` (1.14 MiB). **VRM** is the avatar format
   VRoid Studio exports. Next to `FBXLoader.dlp` (9.44 MiB), that means a character can
   come from an avatar maker rather than a modelling package — a real answer to "where
   does a solo dev get 3D characters".

Also present: `BulletPhysics.dlp` (Bullet physics), `Sharplibsimplewebm.dll` (WebM video
playback — the likely path for cutscenes), `SharpDX.DirectInput.dll` (gamepad),
`YamlDotNet.dll`, `OGGLoader/WAVLoader/PNGLoader/HDRLoader/BMPLoader.dlp`.

## Shader source ships as plain text

`data/lib/sysresource/shader/include/*.cgh` — seven shader include files, **38.15 KiB
total, uncompiled**. `v2_fpcommon.cgh` is 20.35 KiB; `transform.cgh` is **6 bytes**.
With `dxcompiler.dll` (17.14 MiB) and `dxil.dll` alongside them, shaders are compiled on
the player's machine at runtime rather than baked at build time.

## The slip: a log file from the developer's machine

`data/bakinplayer_log.txt`, **13.95 KiB**, shipped in the release build. Tiny next to
episode 06's 770 MB of debug symbols, but the same category of thing: an artifact of the
developer's own session that nobody removed before publishing.

Four readmes ship too — `readme_en`, `readme_jp`, `readme_zh-Hans`, `readme_zh-Hant` —
in a build whose store page lists **English only**. They are Bakin's own runtime readmes,
which is further evidence the runtime folder went out untouched.

## Review corpus (n = 6 — too small for statistics, quoted not counted)

**6 reviews, 100% positive.** English 5, French 1. Median playtime at review **70 min**;
one reviewer had **434 min (7.2 h)** on a demo covering "the first few in-game days".

This is a week-old demo, so there is no reception to measure. What the reviews do give:

- *"a solo developer from Austria"* — the team-size fact, from a player, not a press kit.
- *"a well thought out love letter to the Persona franchise"* … *"caught a couple of
  references and nods to P4"*.
- *"there's even proper voice acting"* — twice.
- *"chunky console-style visuals"*.
- One asks for more combat depth in the demo.

## Not verified / do not assert

- What `data.rbpack` contains. It is one opaque file.
- What WebView2 is used for.
- Whether this developer wrote any C# at all — Roslyn ships either way.
- The developer's identity, budget or schedule beyond "solo, Austria" as reported by a
  reviewer and implied by the studio name.
- Any reception claim. Six reviews is an anecdote.
