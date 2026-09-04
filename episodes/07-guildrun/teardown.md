# Guildrun Demo — build teardown

Evidence: SteamDB public depot manifest for demo app **4425970**, depot **4425971**.
137 files, **10.58 GiB on disk / 1.17 GiB download (88.95% saving)**.
File names and sizes only — nothing unpacked, decompiled or redistributed.

Developer **Leyline**, dev = publisher. Full game app 3669200, release TBA.
The store page says the alpha launched in January 2026 and has shipped a patch every week
since. That cadence matters for the stack below.

## Engine, language, middleware

| Fact | Evidence |
|---|---|
| Unity | `UnityPlayer.dll`, `*_Data/` |
| **IL2CPP → the game is written in C#** | `GameAssembly.dll`, 138.27 MiB |
| Burst compiled jobs | `lib_burst_generated.dll` |
| D3D12 Agility SDK | `D3D12Core.dll` |
| **FMOD Studio** | `fmodstudio.dll` |
| **Google Resonance Audio** | `resonanceaudio.dll` |
| **Sentry** crash reporting | `sentry.dll`, `crashpad_wer.dll` + 6 managed `Sentry.*` assemblies |
| **SQLite** | `sqlite3.dll` + `Mono.Data.Sqlite` |
| **nanosockets** — thin native UDP layer | `nanosockets.dll` |
| Steamworks | `steam_api64.dll` |

## The 24 recovered assembly names

IL2CPP fuses the managed assemblies into `GameAssembly.dll`, so there is no directory of
package DLLs to read. **But `il2cpp_data/Resources/<assembly>.dll-resources.dat` keeps the
original assembly name** for any assembly that shipped embedded resources, and Steam lists
those files in the manifest. Here that yields 24 names:

```
Coffee.SoftMaskForUGUI.R          Sentry
Coffee.UIParticle.R               Sentry.Extensions.Logging
Microsoft.Bcl.TimeProvider        Sentry.NLog
Microsoft.Extensions.Logging.
  Abstractions                    Sentry.Unity
Mono.Data.Sqlite                  Sentry.Unity.Editor
Newtonsoft.Json                   Sentry.Unity.Native
NLog                              System.Collections.Immutable
R3                                System.ComponentModel.Annotations
System.Data                       System.Reactive
System.Drawing                    System.Text.Json
System.Threading.Channels         ZLinq
```

**Caveat, same as episode 06:** an absent name is not proof the package is absent — only
that it carried no embedded resources. The list is a floor, not a census.

### What the list says

This is not a first project's dependency list. Compared with episode 05, whose entire
third-party surface was one DiscordRPC entry:

- **Sentry** (six assemblies, plus the native crashpad handler) — crash reports from
  strangers' machines. Paired with a weekly patch cadence, this is the difference between
  fixing a crash and reading about it in a review.
- **Mono.Data.Sqlite / sqlite3** — the store page advertises *25 heroes, 180
  specializations, 300+ relics, 100+ items* **in the demo alone**. That is a content
  database, not a pile of JSON.
- **NLog** (+ `Sentry.NLog`, `Microsoft.Extensions.Logging.Abstractions`) — structured
  logging wired into the crash reporter.
- **R3** and **System.Reactive** — reactive event streams. R3 is the modern rewrite aimed
  at Unity.
- **System.Threading.Channels** — producer/consumer queues.
- **ZLinq** — zero-allocation LINQ. You install this after GC hitches have bitten you.
- **Coffee.SoftMaskForUGUI / UIParticle** — well-known free uGUI extensions.

*Estimate, stated as one:* the combination reads like a team that has shipped before.
I cannot see who they are from a file list, and the studio's history is not something the
manifest tells me.

## Where 10.58 GiB went — and why the download is 1.17

| Fact | Number |
|---|---|
| On disk | **10.58 GiB** |
| Download | **1.17 GiB** |
| Saving | **88.95%** |
| Largest single file | `sharedassets1.assets.resS`, **4.31 GiB** |
| Scenes | **22** (`level0`–`level21`; largest `level3`, 24.46 MiB) |

An 89% compression ratio on the wire means the bytes on disk are close to
**uncompressed**. Unity's own bundle compression would have shrunk the installed size too;
these files did not get it.

And the minimum requirements read: **"Storage: 15 GB available space … For 'Low' graphics
preset on Full HD. HDD okay, no SSD required."**

*My read, stated as an estimate:* uncompressed assets cost disk and save CPU at load. On a
mechanical drive with nothing to decompress, they load faster. Ten gigabytes of somebody's
drive spent to keep a hand-painted 2D game playable on 2014 hardware is a defensible
trade, and the store page's own line is the reason to think it was chosen rather than
missed. **I cannot prove intent from a manifest.** Corrections welcome.

**22 scenes** is worth noting on its own: episodes 05 and 06 shipped one scene each and
built everything at runtime. This game is authored in the editor.

## Review corpus (n = 800 recent, `analyze_reviews.py --pages 8`; 1,994 total, 89.8% "Very Positive")

- Recent window: **87.0% positive**.
- **Playtime at review: median 697 min (11.6 h), mean 1,424 min, p90 3,651 min (61 h).
  0% under ten minutes** — the only episode so far with no bounce cohort at all.
- **The inversion:** not-recommended median **880 min (14.7 h)**; recommended median
  **684 min (11.4 h)**. Every previous episode ran the other way (ep06: 462 min vs 60).
  The negative reviews here come from the most invested players, after mastery — a
  balance ceiling, not a bad first hour.
- **Performance is a non-issue**: ~10 positive mentions, 2 negative. Nobody is complaining
  about the build, which is the point of the section above.
- Named negatives: specific combos only, dead/unviable heroes, and a random draw that
  decides a run before it is played.

## Not verified / do not assert

- The studio's size, history, funding, or budget. Nothing in the manifest says.
- Anything about asset contents — `sharedassets1.assets.resS` is one opaque blob.
- Whether the uncompressed-on-disk choice is deliberate. Stated as a read, not a finding.
- Any package that shipped without embedded resources.
