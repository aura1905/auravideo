# Rudravati: Curse of Bhankilla — build teardown

Evidence: SteamDB public depot manifest for demo app **5105660**, depot **5105661**,
build `25152581`, seen **6 September 2026 14:20 UTC** — the demo went up the same day.
**238 entries / 228 files, 6.09 GiB on disk / 3.66 GiB download (39.89% saving).**
File names, paths and sizes only. Nothing unpacked, decompiled or redistributed.

## Who made it

| Fact | Source |
|---|---|
| Developer and publisher **LeZit Games** | Steam |
| First-person supernatural horror set in the ruins of a haunted Indian fort | Steam about |
| **English and Hindi, both with full audio** | Steam |
| Full game **2026**, demo released **6 Sep 2026** | Steam |
| 12 screenshots, 1 trailer (97 s) on the parent page; the demo page carries none of its own | Steam |
| **0 reviews** on the demo | Steam |

### The rename

SteamDB still records the parent app as **`RATNAVATI: Curse of Bhangarh`** (app 4201310)
while the store now reads **`Rudravati: Curse of Bhankilla`**. The executable is
`RUDRAVATI.exe`.

**Bhangarh Fort is a real place** in Rajasthan, widely called India's most haunted site,
and **Ratnavati** is the princess in its legend. Both were changed to invented spellings.
*Why is not visible from a manifest. State the change, not the reason.*

## Engine

**Unity, and — unusually — the Mono backend, not IL2CPP.**

| Evidence | Reading |
|---|---|
| `mono-2.0-bdwgc.dll` 7.47 MiB, `MonoBleedingEdge/` | Mono runtime, so C# is JIT-compiled at run time |
| **`Assembly-CSharp.dll` 1.02 MiB** + `Assembly-CSharp-firstpass.dll` 90.5 KiB | the game's own code, shipped as a readable assembly |
| `Unity.RenderPipelines.HighDefinition.Runtime.dll` 2.40 MiB | **HDRP** |
| `Unity.RenderPipelines.GPUDriven.Runtime.dll` | Unity 6 GPU Resident Drawer |
| `Unity.UnifiedRayTracing.Runtime.dll` | ray tracing |

Mono matters for this channel: on an IL2CPP build the package list has to be recovered
from `il2cpp_data/Resources` filenames. Here the assemblies are simply present, so the
list below is the real one, not an inference.

## The part that makes this episode

Three AI runtimes are in the shipping player build.

| File | Size | What it is |
|---|---|---|
| **`MCPForUnity.Runtime.dll`** | 31.0 KiB | the community **Model Context Protocol** bridge — it lets an AI agent drive the Unity editor |
| **`Unity.AI.MCP.Runtime.dll`** | 11.0 KiB | Unity's **own** MCP runtime. Both are present |
| `Unity.AI.Tracing.dll` | 30.0 KiB | tracing for Unity's AI features |
| **`Unity.InferenceEngine.dll`** | 1.22 MiB | Unity's neural-network inference runtime (formerly Sentis) |
| `Unity.InferenceEngine.Tokenization.dll` | 191.0 KiB | a **tokenizer** — that is text-model tooling, not image upscaling |
| **`DirectML.dll`** | 13.37 MiB | Microsoft's GPU inference runtime |

**What can be said:** the AI tooling used to build the game was still referenced when the
player build was cooked, and DirectML plus an inference engine with a tokenizer are the
shape of on-device text inference.
**What cannot:** whether any of it runs, or whether the game uses a model at run time.
An MCP bridge is an *editor* tool; finding it in a player build says it was not stripped,
not that the game talks to an agent. **Say that on camera.**

## Editor tools that came along

| File | Why it should not be here |
|---|---|
| `TinyGiantStudio.BetterInspector.dll` / `BetterMesh.dll` | Asset Store **editor** inspectors |
| `Unity.Recorder.dll` / `Unity.Recorder.Base.dll` | Unity's video capture tool, used in the editor |
| `Timeline.Samples.*` — 6 assemblies | sample code shipped with a package |
| `Unity.VisualScripting.DocCodeExamples.dll` | documentation examples |
| `MonoBleedingEdge/etc/mono/{2.0,4.0}/DefaultWsdlHelpGenerator.aspx` 59 KiB each | ASP.NET web pages, twice, from the stock Mono tree |
| `UnityEngine.AndroidJNIModule.dll`, `UnityEngine.AMDModule.dll` | platform modules for a Windows-only build |

## Size

| type | files | total |
|---|---|---|
| `resS` | 8 | **4.43 GiB** |
| `resource` | 4 | 1.02 GiB |
| `assets` | 8 | 514.90 MiB |
| `dll` | 182 | 105.16 MiB |

**`.resS` is Unity's raw resource stream — texture and audio bytes.** 4.43 of 6.09 GiB,
73% of the build, and Steam's own compression still finds 40% to squeeze out of the whole
package. That is the shape of textures that were not crunched.

The 182 DLLs break down as 118 Unity modules (19.84 MiB), 33 System/Mono assemblies
(21.01 MiB) and 31 everything else (64.31 MiB, of which `UnityPlayer.dll` is 34 and
DirectML 13).

## Also present

`Unity.Cinemachine`, `Unity.ProBuilder` (5 assemblies), `Unity.VisualScripting` (4 +
Antlr3 runtime), `Unity.Splines`, `Unity.VisualEffectGraph`, `Unity.TextMeshPro`,
`Newtonsoft.Json`, `VisualDesignCafe.Rendering.Nature` (Nature Renderer, an Asset Store
vegetation instancer), `EdgeFusion.Runtime`, `AppUINativePlugin` (x86_64 **and** ARM64).

## Three things worth saying on camera

1. **Two MCP runtimes, in a shipped horror demo.** The community bridge and Unity's own,
   side by side. This is what an AI-assisted build looks like from the outside.
2. **Mono, not IL2CPP** — so for once the package list is read, not reconstructed. Worth
   one line explaining why that matters to anyone who opens their own build.
3. **73% of the download is uncompressed texture data.** The actionable number.

## Reception

No reviews on the demo. Concurrent players in the low single digits at time of writing.
There is no reception to report — say so and move on, as in episode 10.

## Not verified / do not assert

- That the game runs a model at run time, or that MCP does anything in the player build.
- Why the title and fort name were changed.
- Anything inside `.resS`, `.assets` or `Assembly-CSharp.dll`.
- Team size. LeZit Games self-publishes, but the manifest says nothing about headcount.
