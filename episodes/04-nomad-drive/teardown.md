# Nomad Drive Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **4568400**, depot **4568401**,
build **23974477**, manifest `1081488267790073254` dated **29 June 2026**.
322 entries / 295 files, **3.71 GiB on disk** (2.35 GiB compressed).
Nothing here comes from decompiling or unpacking — it is the public file list.

The demo itself could NOT be downloaded with `steamcmd +login anonymous`
("No subscription"), so the manifest is the source. Everything below is a file name.

## Engine

| Fact | Evidence |
|---|---|
| Unity | `UnityPlayer.dll`, `Nomad Drive Demo_Data/` |
| **HDRP, not URP** | `Unity.RenderPipelines.HighDefinition.Runtime.dll` |
| Unity 6 generation | `Unity.RenderPipelines.GPUDriven.Runtime.dll` (GPU Resident Drawer) |
| **Mono backend, not IL2CPP** | `MonoBleedingEdge/EmbedRuntime/mono-2.0-bdwgc.dll`, `Assembly-CSharp.dll` present as a real assembly |
| Burst compiled | `Unity.Burst.dll`, `lib_burst_generated.txt` |
| Addressables content pipeline | `StreamingAssets/aa/StandaloneWindows64/*.bundle` (20 bundles) |
| AMD FSR | `AMDUnityPlugin.dll`, `UnityEngine.AMDModule.dll` |
| D3D12 Agility SDK | `D3D12/D3D12Core.dll` |

**HDRP on a small team is the headline.** URP is the usual small-studio choice; HDRP
buys the look and costs performance and build size. Check this against the reviews.

## The shopping list — third-party packages, by name

Driving / physics
- **NWH Vehicle Physics 2** — `NWH.VehiclePhysics2.dll`, `NWH.WheelController.dll`, `NWH.Common.dll`, `NWH.VehiclePhysics2.SetupWizard.dll`
- **`NWH.VehiclePhysics2.Multiplayer.Mirror.dll`** — the vehicle package's own Mirror add-on
- `TechniePhysicsCreator.dll` (physics/destruction setup)

World generation
- **MapMagic 2** — `MapMagic.dll`, `Den.Tools.dll` (Denis Pahunov's node-based procedural terrain)
- `Unity.Splines.dll` (roads), `UnityEngine.AIModule.dll` (NavMesh)
- `MeshBakerCore.dll` (mesh combining — a draw-call fix)

Networking / online
- **Mirror** — `Mirror.dll`, `Mirror.Components.dll`, `Mirror.Transports.dll`, `Mirror.Authenticators.dll`, `Mirror.BouncyCastle.Cryptography.dll`
- Transports: `kcp2k.dll`, `Telepathy.dll`, `SimpleWebTransport.dll`
- **Epic Online Services** — `EOSBootstrapper.exe`, `com.Epic.OnlineServices.dll`, `com.playeveryware.eos.core.dll`
- **Steamworks** — `Facepunch.Steamworks.Win64.dll`
- **Unity Gaming Services** — `Unity.Services.Core/Authentication/...`, **`Unity.Services.Vivox.dll`** (voice chat)

Look
- **Enviro 3** — `Enviro3.Runtime.dll` (sky, weather, time of day)
- **Boxophobic The Visual Engine** — `Boxophobic.TheVisualEngine.Runtime.dll`
- `Unity.VisualEffectGraph.Runtime.dll`, `Unity.Postprocessing.Runtime.dll`, `Unity.Cinemachine.dll`
- `Coffee.UIEffect.dll` (UI effects), `Unity.TextMeshPro.dll`

Character / animation
- **Easy Character Movement 2** — `ECM2.dll`
- **Final IK** — `RootMotion.dll`

RV customisation
- **Paint in 3D** — `PaintIn3D.dll`, `PaintCore.dll` (paint/dirt on meshes at runtime)

Audio
- **BroAudio** — `BroAudio.dll`; 6 `.bank` files in the build (FMOD-style banks)

Tooling that shipped with the build
- **Odin Inspector** — `Sirenix.*.dll`
- **Rewired** — `Rewired_Core.dll` (input, alongside `Unity.InputSystem.dll`)
- **Quantum Console** — `QFSW.QC.*.dll` (in-game dev console, 9 assemblies)
- **UniTask** — `UniTask*.dll` (async without coroutines)
- **PrimeTween** — `PrimeTween.Runtime.dll`
- `ALINE.dll` (debug drawing), `CodeStage.AFPSCounter`, `CodeStage.Maintainer`,
  `TinyGiantStudio.BetterInspector/BetterMesh`, `CW.Common`, `Newtonsoft.Json.dll`
- `EvilAnalytics.SDK.dll` (telemetry)

## Their own framework

Sixteen in-house assemblies, all prefixed `EvilCore` — this is not a hobby project's
code layout, it is a studio framework:

`EvilCore.dll`, `.DI`, `.DI.Scopes`, `.Managers`, `.Networking`, `.UI`, `.Inputs`,
`.Audio`, `.Localization`, `.EvilSave`, `.Settings`, `.Particles`, `.Debugging`,
`.EvilLogger`, `.Extensions`, `.DynamicCasting`

Plus the game code itself: `Assembly-CSharp.dll`, `Assembly-CSharp-firstpass.dll`.

## Content shape

- **Only four scenes**: `level0` (37 KB), `level1` (541 KB), `level2` (187 KB), `level3` (270 KB).
  A 3.7 GiB game with four tiny scenes means the world is **assembled at runtime** —
  consistent with MapMagic + Addressables, not with hand-authored levels.
- Where the 3.7 GiB actually is:
  - `sharedassets0.assets.resS` — **1.47 GiB** (one blob)
  - `loots_assets_all_*.bundle` — **588.59 MiB**
  - `places_assets_all_*.bundle` — **518.91 MiB**
  - `resources.assets.resS` — 238.50 MiB
  - `globalgamemanagers.assets` — 98.77 MiB
- Addressable groups named `loots` and `places` — the content is organised by *loot*
  and *locations*, which is exactly what a procedural survival loop needs.

## Small tells

- **`Nomad Drive Demo_BurstDebugInformation_DoNotShip/` shipped.** Unity names that
  folder `DoNotShip` and it is in the manifest. Harmless, and a very human slip.
- `Mirror.Examples.dll`, `CodeStage.AFPSCounter.Examples.dll`, `QFSW.QC.Demo.dll`,
  `PrimeTween.Demo.dll`, `CodeStage.Maintainer.Demo.dll`, `MeshBakerExamples.dll` —
  the packages' own sample assemblies were never stripped. Costs a few MB, tells you
  nobody ran an assembly-strip pass.
- `Mono` backend means `Assembly-CSharp.dll` is plain IL. That is a choice with
  consequences (iteration speed vs. performance and reverse-engineering).

## The claims this supports

1. The driving sim at the centre of the game is **NWH Vehicle Physics 2 off the shelf**,
   including its Mirror multiplayer add-on. The team did not write a vehicle simulator.
2. The procedural world is **MapMagic 2**, not custom terrain code.
3. Co-op is **Mirror over Epic Online Services**, with Steamworks alongside and Vivox
   for voice — all free or free-tier. No dedicated server bill.
4. What the team *did* build is the glue: a 16-module framework, the survival systems,
   the RV customisation, and the content (2.6 GiB of it).
5. **HDRP** is the risky choice, and the one to test against the review corpus.

## Not verified / do not assert

- Team size. "Indie Devil" publishes as the developer and the blog author is
  "The Nomad Drive Team". No headcount is stated anywhere public.
- **No AI-content disclosure exists on the Steam page**, so make no AI claim.
- Unity's exact minor version (the manifest does not carry it).
- Whether `.bank` files are FMOD or BroAudio's own format.

## The evidence cards used on screen

Regenerate with (from the repo root):

```bash
E=episodes/04-nomad-drive
python scripts/motion/render_evidence_card.py $E/ev_engine.png --title "THE ENGINE"   --subtitle "What the demo's own file list says"   --lines "UnityPlayer.dll|it's Unity" "Unity.RenderPipelines.HighDefinition.Runtime.dll|HDRP, not URP"           "Unity.RenderPipelines.GPUDriven.Runtime.dll|Unity 6, GPU Resident Drawer"           "MonoBleedingEdge/mono-2.0-bdwgc.dll|Mono backend, not IL2CPP"           "Unity.Burst.dll|Burst compiled jobs" ">Small teams pick URP. This one didn't."
python scripts/motion/render_evidence_card.py $E/ev_driving.png --title "THE DRIVING"   --lines "NWH.VehiclePhysics2.dll|a licensed vehicle simulator" "NWH.WheelController.dll|its wheel/suspension model"           "NWH.VehiclePhysics2.Multiplayer.Mirror.dll|the package's own netcode add-on"           "TechniePhysicsCreator.dll|physics setup tooling" ">Nobody wrote a vehicle sim. They bought one."
python scripts/motion/render_evidence_card.py $E/ev_world.png --title "THE WORLD"   --lines "MapMagic.dll  +  Den.Tools.dll|MapMagic 2 procedural terrain" "Unity.Splines.dll|roads"           "level0  level1  level2  level3|four scenes, all under 550 KB"           "loots_assets_all_*.bundle|589 MB of loot" "places_assets_all_*.bundle|519 MB of locations"           ">The map is built at runtime, from a node graph."
python scripts/motion/render_evidence_card.py $E/ev_coop.png --title "THE CO-OP"   --lines "Mirror.dll  Mirror.Transports.dll|Mirror - free, open source" "kcp2k.dll  Telepathy.dll|UDP and TCP transports"           "com.Epic.OnlineServices.dll|Epic Online Services relay" "Facepunch.Steamworks.Win64.dll|Steam lobbies"           "Unity.Services.Vivox.dll|voice chat" ">Zero server bill. Latency you don't control."
python scripts/motion/render_evidence_card.py $E/ev_own.png --title "WHAT THEY BUILT"   --subtitle "Sixteen in-house assemblies, all prefixed EvilCore"   --lines "EvilCore.DI  ·  EvilCore.DI.Scopes|dependency injection"           "EvilCore.Networking  ·  EvilCore.Managers|game glue over Mirror"           "EvilCore.Localization|23 languages" "EvilCore.EvilSave  ·  EvilCore.Settings|persistence"           "EvilCore.UI  ·  EvilCore.Inputs  ·  EvilCore.Audio|the rest of the shell"           ">That's a studio framework, not a hobby layout."
python scripts/motion/render_evidence_card.py $E/ev_tells.png --title "THE SMALL TELLS"   --lines "Nomad Drive Demo_BurstDebugInformation_DoNotShip/|Unity literally named it DoNotShip"           "Mirror.Examples.dll  QFSW.QC.Demo.dll|package samples never stripped"           "PrimeTween.Demo.dll  MeshBakerExamples.dll|same"           "Assembly-CSharp.dll|plain IL, readable by anyone" ">Shipped fast. You can see where."
```

## What the review corpus said (n = 794 recent, `analyze_reviews.py --pages 8`)

- 71.5% positive. Languages: **schinese 264**, english 218, russian 119, turkish 41 — the
  23-language localisation worked, and the largest audience is Chinese.
- **Playtime at review: median 156 min, mean 270 min, only 2% under ten minutes.** For a
  free demo that is remarkable retention.
- Positive reviewers' median 198 min vs negative reviewers' 72 min — the first hour decides.
- Topic frequency (positive / negative): driving 81/34, bugs 66/25, **performance 50/15**,
  co-op 47/9, looks 30/7, world 27/7, pace 21/12, **potential 50/2**.
- The two highest-voted negative reviews (42 votes each) claim the game is a **crypto
  miner**, citing "99% GPU usage in menu and other simple areas. Low graphics in a
  RTX5070." One of them also alleges "stolen assets".
  → The manifest contains no miner, and the packages are named, commercial Asset Store
  products. The 99% GPU is what HDRP with no frame cap looks like from outside. This is
  the episode's spine: a defensible technical reading that also defends the developer.
- Chinese reviews repeatedly report 300-400 ms between players in the same city, which
  matches Mirror over a global EOS relay rather than regional servers.
