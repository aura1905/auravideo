"""Build the 口袋修仙 timeline in the AuraVideo DESKTOP app over the agent bridge.

    python bridge_build.py --file C:/tmp/agent_pc.json [--out C:/tmp/pocket_cultivation/desktop.mp4] [--encoder libx264]

Reads plan.json (same plan the web run used), imports the same files by path,
adds clips + subtitles through the bridge, screenshots a few frames, exports.
"""
import argparse, json, os, sys, time
sys.path.insert(0, r'C:\Git\auravideo\scripts')
from agent_client import call, load_handshake

PC = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
ap = argparse.ArgumentParser()
ap.add_argument('--file', required=True)
ap.add_argument('--plan', default='plan.json', help='plan file inside the workdir (use plan_short.json for a Short)')
ap.add_argument('--workdir', help='folder holding plan.json and the media it names (default: this script folder)')
ap.add_argument('--out', default=None, help='output mp4 (default: <workdir>/final.mp4)')
ap.add_argument('--encoder', default='libx264')
ap.add_argument('--shots', default='')
ap.add_argument('--no-export', action='store_true')
ns = ap.parse_args()
PC = os.path.abspath(ns.workdir or SCRIPT_DIR).replace(os.sep, '/').rstrip('/')  # absolute: media.import needs real paths
OUT = (ns.out or f'{PC}/final.mp4').replace(os.sep, '/')
hs = load_handshake(ns.file)

def rpc(cmd, args=None, timeout=3600):
    r = call(cmd, args or {}, hs, timeout)
    if not r.get('ok'):
        sys.exit(f'{cmd} failed: {r.get("error")}')
    return r['data']

print('ping', rpc('ping'))
plan = json.load(open(os.path.join(PC, ns.plan), encoding='utf-8'))
rpc('project.reset')
print('settings', rpc('settings.set', plan['settings']))

track_map = {}
for i, t in enumerate(plan.get('tracks_extra', [])):
    r = rpc('track.add', t)
    track_map[f"v{4+i}" if t['kind'] == 'video' else f"a{4+i}"] = r['id']
    print('track.add', t, '->', r['id'])
files = sorted({c['file'] for c in plan['clips']})
paths = [f if os.path.isabs(f) else f'{PC}/{f}' for f in files]
t0 = time.time()
imported = rpc('media.import', {'paths': paths})['assets']
print(f'imported {len(imported)} assets in {time.time()-t0:.1f}s')
asset_by_file = {}
for f, a in zip(files, imported):
    asset_by_file[f] = a['id']
    stem = os.path.splitext(os.path.basename(f))[0]
    if not a['name'].startswith(stem):  # alpha/HEVC proxies get renamed '<stem>_proxy_*.webm'
        sys.exit(f'import order mismatch: {f} vs {a["name"]}')

for c in plan['clips']:
    args = {'assetId': asset_by_file[c['file']], 'trackId': track_map.get(c['track'], c['track']), 'start': c['start'],
            'inPoint': c['in'], 'outPoint': c['out'], 'fadeIn': c.get('fadeIn', 0), 'fadeOut': c.get('fadeOut', 0),
            'volume': c.get('volume', 1), 'muted': bool(c.get('muted', False)), 'fillMode': c.get('fillMode', 'fit')}
    for k in ('transformScale', 'transformX', 'transformY', 'transformOpacity', 'brightness', 'saturation', 'contrast'):
        if k in c:
            args[k] = c[k]
    rpc('clip.add', args)
for s in plan['subs']:
    # docs/CHANNEL.md: English captions are white with a heavy outline and NO background
    # box -- a translucent box reads as a CapCut default in long form. The Korean
    # episodes used bgOpacity 0.55; pass it back per-sub if a card ever needs it.
    base = {'fontSize': 44, 'y': 400, 'outline': 6, 'bold': True, 'fadeIn': 0.1, 'fadeOut': 0.1,
            'bgColor': '#000000', 'bgOpacity': 0.0, 'bgPadding': 14, 'bgWidth': 'text',
            'fontFamily': 'Inter, "Segoe UI", "Malgun Gothic", sans-serif'}
    base.update(s)
    rpc('subtitle.add', base)
st = rpc('state')
print(f"clips {len(st['clips'])} subs {len(st['subtitles'])} duration {st['duration']:.2f}")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
for t in [float(x) for x in ns.shots.split(',') if x]:
    r = rpc('screenshot', {'t': t, 'settleMs': 1500, 'path': f'{os.path.dirname(OUT)}/desk_shot_{t:.0f}.png'})
    print('shot', t, r['bytes'], 'bytes')

if ns.no_export:
    sys.exit(0)
t0 = time.time()
r = rpc('export', {'outPath': OUT, 'encoder': ns.encoder, 'quality': 'standard'})
print(f'export {r} in {time.time()-t0:.1f}s')
