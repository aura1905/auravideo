# COMPARTMENT 666: ANOMALY EXPRESS — demo teardown

From the public SteamDB depot manifest for app 5016400 (7 Sep 2026). File names and
sizes only — nothing unpacked, decompiled or redistributed.

- Demo app `5016400`, full game `5016110`, ShepherdWorks (self-published)
- Unreal Engine, IoStore (`.ucas`/`.utoc`), **1.48 GiB in 36 files**
- An anomaly hunt in the Exit 8 lineage: a 1900s express carriage, a handheld radio that
  detects what you cannot see, three lives, anomalies graded easy / medium / hard
- Went up 7 Sep 2026. Fifteen languages, no reviews.

## What the file list says

| evidence | reading |
|---|---|
| one `.ucas` at 1.16 GiB | almost the whole build is a single IoStore container |
| `COMPARTMENT_666.exe` 164.50 KiB | a launcher shim |
| `UnrealGame-Win64-Shipping.exe` 140.03 MiB | **the target was never renamed** — that is Unreal's default |
| `d3d12SDKLayers.dll` 5.53 MiB | the DirectX 12 debug layer, a developer tool |
| 9 Boost libraries incl. `boost_python311` | Unreal's Python plugin is an EDITOR feature |
| `DirectML.dll` 13 MiB + `onnxruntime.dll` 13 MiB | an ML inference stack, via Unreal's NNE plugin |
| `EOSSDK-Win64-Shipping.dll` 17.44 MiB | Epic Online Services, in a single-player listing |

Three episodes earlier FINAL FANTASY RESONANCE shipped that same `d3d12SDKLayers.dll`,
for the same reason: nobody tightened the shipping config.

## The trailer's burnt-in captions — read this before picking any `in` point

`t0.mp4` carries marketing text over the footage, and the first master of this episode
shipped **seven** of them before it was caught. Measured at 0.25 s, the caption-free
windows are:

```
1.6–3.9      6.8–10.9      13.0–18.0      20.25–32.4
```

Everything else is text: `EVERY COMPARTMENT HIDES A SECRET` (0–1.6), a glitch card and
`TRUST YOUR INSTINCTS` (3.9–6.8), `MAKE THE RIGHT CHOICE` (10.9–13.0),
`MANY DIFFERENT ANOMALIES` (18.0–20.25), then `CAN YOU FIND THEM?` and the wishlist card
from 32.4 to the end. Every `in` in `script.json` and `short.json` sits inside a clean
window; there is not enough clean footage for the whole episode, so several lines run on
screenshots instead.

## Rebuilding this episode's assets

Everything in this folder that git does not track is ignored and reproducible.

```bash
E=episodes/13-compartment-666
SRC="SteamDB depot manifest · app 5016400 · 7 Sep 2026"

python scripts/pipeline/steam_fetch.py --demo 5016400 --out $E
# t0.mp4: the HLS master from IStoreBrowseService/GetItems (include_trailers), under
# https://video.cloudflare.steamstatic.com/store_trailers/ — appdetails returns no mp4.

python scripts/motion/render_evidence_card.py $E/ev_engine.png --title "THE BUILD" --source "$SRC" \
  --lines "COMPARTMENT_666.exe|164.50 KiB - the launcher shim" \
          "UnrealGame-Win64-Shipping.exe|140.03 MiB - the actual game" \
          "pakchunk0-WindowsClient.ucas|1.16 GiB - 79% of the build" \
          "36 files / 1.48 GB|one pak, one container"

python scripts/motion/render_evidence_card.py $E/ev_name.png --title "THE DEFAULT NAME" --subtitle "never renamed" --source "$SRC" \
  --lines "COMPARTMENT_666.exe|164.50 KiB - the launcher shim" \
          "UnrealGame-Win64-Shipping.exe|140.03 MiB - the actual game" \
          "SlashZero (ep 11)|Zero-Win64-Shipping.exe" \
          "Rising Above It|RisingAboveIt-Win64-Shipping.exe" \
          ">UnrealGame is what the template calls it."

python scripts/motion/render_evidence_card.py $E/ev_slip.png --title "THE DEBUG LAYER" --source "$SRC" \
  --lines "d3d12SDKLayers.dll|5.53 MiB - DirectX 12 debug layer" \
          "D3D12Core.dll|5.35 MiB - Agility SDK" \
          "FINAL FANTASY RESONANCE|shipped this too. Same file, same reason."

python scripts/motion/render_evidence_card.py $E/ev_python.png --title "PYTHON, IN A GAME" --subtitle "nine Boost libraries" --source "$SRC" \
  --lines "boost_python311-mt-x64.dll|208.77 KiB - Python 3.11 bindings" \
          "boost_filesystem / regex / thread / ...|9 Boost DLLs in all" \
          ">Unreal's Python plugin is an EDITOR feature." \
          ">Build scripts and asset pipelines." \
          ">It has no job in a player build."

python scripts/motion/render_evidence_card.py $E/ev_ml.png --title "AN ML RUNTIME" --source "$SRC" \
  --lines "DirectML.dll|13.30 MiB - Microsoft GPU inference" \
          "onnxruntime.dll|13.34 MiB - ONNX Runtime" \
          ">Unreal's NNE plugin pulls both in." \
          ">Present is not the same as used." \
          ">A file list cannot tell you which."

python scripts/motion/render_evidence_card.py $E/ev_eos.png --title "EPIC, IN SINGLE PLAYER" --subtitle "17.44 MiB" --source "$SRC" \
  --lines "EOSSDK-Win64-Shipping.dll|17.44 MiB" \
          "Steam categories|Single-player, Family Sharing" \
          "msquic.dll|2.44 MiB - HTTP/3 transport" \
          "GFSDK_Aftermath_Lib.x64.dll|5.20 MiB - GPU crash reports" \
          ">Achievements, telemetry, or a plan for later."

# brand layers: intro_*.mov and logo_c_rgba.png are identical every episode, copy them
# from any earlier episode folder. The spec sheet is per-episode:
python scripts/motion/render_spec_layers.py '[["ENGINE","Unreal Engine"],["THE BUILD","1.48 GB / 36 files"],["THE EXE","UnrealGame - the default"],["LEFT IN","debug layer + Python"],["ALSO","DirectML + ONNX"]]' --verdict "WORTH A DIP"
for n in header row_0 row_1 row_2 row_3 row_4 stamp; do ffmpeg -y -framerate 30 -i sc_$n/f%03d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le $E/score_$n.mov; done
# the Short needs the same seven at 1080x1920, written as v_score_*.mov:
python scripts/motion/render_spec_layers.py '[["ENGINE","Unreal Engine"],["THE BUILD","1.48 GB / 36 files"],["THE EXE","UnrealGame - default"],["LEFT IN","debug layer + Python"],["ALSO","DirectML + ONNX"]]' --verdict "WORTH A DIP" --width 1080 --height 1920 --section 9.5

python scripts/motion/kenburns.py $E
python scripts/motion/kenburns.py $E --vertical
python scripts/pipeline/build_plan.py --episode $E/episode.json --out $E/plan.json
python scripts/pipeline/build_plan.py --episode $E/episode_short.json --out $E/plan_short.json

python scripts/motion/make_thumbnail.py --bg $E/ss00.jpg --out $E/thumb.jpg \
  --line1 "COMPARTMENT {666}" --line2 "PYTHON. IN A HORROR GAME." \
  --title-size 84 --hook-size 50 --accent-scale 1.7 --zoom 1.8 --ox 0.368 --oy 0.083 --text-side left
python scripts/motion/make_thumbnail.py --bg $E/ss00.jpg --out $E/thumb_short.jpg --vertical \
  --line1 "COMPARTMENT {666}" --line2 "PYTHON. IN A HORROR GAME." \
  --title-size 88 --hook-size 50 --accent-scale 1.7 --ox 0.603 --text-y 0.545
```

Assembly and export are the same as every episode — `docs/PIPELINE.md` ⑦.
