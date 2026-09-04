# Expedition: Into Darkness Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **5041080**, depot **5041081**.
1,604 files, **16.89 GiB on disk / 7.88 GiB download**.
File names and sizes only — nothing unpacked, decompiled or redistributed.

Developer **Antediluvian Interactive** — a **three-person studio**, first title, dev = publisher.
Early access announced for Q4 2026.

## Engine, language, middleware

| Fact | Evidence |
|---|---|
| Unity | `UnityPlayer.dll`, `*_Data/` |
| **IL2CPP → the game is written in C#** | `GameAssembly.dll` (and its `.pdb`) |
| Burst compiled jobs | `lib_burst_generated.dll` |
| D3D12 Agility SDK | `D3D12Core.dll` |
| **FMOD Studio** | `fmodstudio.dll` |
| **Google Resonance Audio** | `resonanceaudio.dll` — spatial audio |
| Steamworks | `steam_api64.dll` |
| Unidentified native plugin | `RFLib_CNative_2018.dll` — also appears in other Unity titles (e.g. Contraband Police). **I could not establish what it is.** Ask the audience. |

IL2CPP merges the managed assemblies into `GameAssembly.dll`, so unlike episodes 04–05
there is no `Assembly-CSharp.dll` and no directory of package DLLs to read.

**One window remains, and it is worth checking every time:**
`il2cpp_data/Resources/<assembly>.dll-resources.dat` keeps the original assembly name for
any assembly that shipped embedded resources. Here that yields only `mscorlib`,
`System.Data` and `System.Drawing` — all base class library, no third-party. Episode 07
(Guildrun, also IL2CPP) yields 24 names including `R3`, `ZLinq`, `NLog`, `Sentry.*` and
`Mono.Data.Sqlite`, so the technique does work.

An empty result is **not** proof that no packages were used — only that none of them
carried embedded resources. The native DLLs above remain the reliable evidence here.

## Where 16.89 GiB actually went

- **One scene**: `level0`, 23.35 KiB. That is the entire authored scene content.
- **1,555 Addressable bundles totalling 15.47 GiB.** The largest single bundle is
  **2.05 GiB**; the next are 1.21 GiB, 972 MiB, 776 MiB, 668 MiB.
- Everything the player sees streams in from those bundles at runtime.

Two readings, and they are not exclusive:

1. **The content really is modular.** The crafting screen shows weapons assembled from
   separate parts — a shaft and a head, each with its own durability, attack stamina
   cost, inertia and cleave falloff. Armour is per-piece. Modular content multiplies
   meshes and texture sets fast, and that is a legitimate reason to be large.
2. **Compression was probably never revisited.** A single 2 GiB bundle is the usual
   signature of source-resolution textures with default import settings. *(Estimate —
   the bundles are hash-named, so their contents are not visible from the manifest.)*

**Estimate, stated as one:** three people did not hand-author sixteen gigabytes of
medieval equipment. Bought libraries and/or scanned assets, imported at source
resolution, is the likeliest explanation. I cannot prove it from the file list.

## The 770 MB slip

| File | Size |
|---|---|
| `GameAssembly.pdb` | **745.80 MiB** |
| `UnityPlayer_Win64_player_il2cpp_x64.pdb` | 24.26 MiB |
| `UnityCrashHandler64.pdb` | 1.21 MiB |
| `baselib_Win64_player_Master_il2cpp_x64.pdb` | 532.00 KiB |
| `WindowsPlayer_player_Master_il2cpp_x64.pdb` | 396.00 KiB |

**≈770 MiB of debug symbols shipped to players.** Symbols are what a crash report is
read with; they belong on a build server, never in a download. This is the same class of
slip as episode 04's `_BurstDebugInformation_DoNotShip` folder, two orders of magnitude
larger.

And the store page's minimum requirements say **"Storage: 8 GB available space"** — the
build is 16.89 GiB on disk. The 8 GB figure is close to the *download* size (7.88 GiB),
so it looks like the download number was written into the storage field.

## Review corpus (n = 800 recent, `analyze_reviews.py --pages 8`)

- 71.9% positive in the recent window; **911 total, 69.7% — "Mixed"**.
- **Playtime at review: median 304 min (5.1 h), mean 763 min, p90 2152 min (36 h),
  maximum 12,811 min (213 h).** Only 2% under ten minutes.
- Recommended: median 462 min (7.7 h). Not recommended: median 60 min. Again the
  first hour decides.
- Topic counts (positive / negative): **performance 143 / 50 — the loudest complaint by
  a distance**; potential 141 / 19; co-op 106 / **8**; bugs 95 / 23; looks 89 / 19;
  world 40 / 17; pace 56 / 16.
- **Co-op is praised and barely complained about** — 106 to 8. Three people shipped
  five-player netcode that holds up. That is the quiet achievement here.
- Named negatives: enemies spawning behind the player (50 votes), no map, volumetric fog
  that cannot be disabled, "blurry and poorly optimized" (37 votes), no reward from
  trash mobs (Chinese review, 21 votes), a bug that throws you into the air and kills
  you in a permadeath game (Japanese review).

## What the store page and specs say

- Minimum: Ryzen 5 3600X, 8 GB RAM, RX 580, broadband, **8 GB storage**.
- 13 listed languages; **only English has full audio**, the rest are text.
- Trailer is delivered at **2560×1080** — an ultrawide master.

## Not verified / do not assert

- **Anything about texture contents or compression** — the bundles are hash-named.
- What `RFLib_CNative_2018.dll` is.
- The team's budget, schedule, or where the art came from. "Bought libraries" is an
  inference from scale, not a finding.
- Whether the 8 GB storage figure is a typo or a deliberate download-size figure.
