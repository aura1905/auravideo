"""Depot sizes straight from Steam, no browser: anonymous PICS product info.

    .venv-steam/Scripts/python.exe scripts/pipeline/steam_pics.py 5072550 --out episodes/s13-sql-data

Writes <out>/pics.json with each public depot's size on disk, download size and OS.

Why this exists. The teardown's file list comes from SteamDB, which only answers a
real browser (curl gets 403), so when the Chrome extension is disconnected the whole
pipeline stops. Steam's own anonymous client can still read product info -- which
carries each depot's manifest size -- but it is refused the manifest itself: an
anonymous account holds no licence for demo depots, and get_manifest_request_code
fails with SteamError 15. So this gives the SIZE of a build, never its CONTENTS.
Anything a script says about what is inside a build still has to come from SteamDB.

Runs in its own venv (.venv-steam) because the `steam` package pins protobuf 3.20,
and installing it into the base interpreter downgraded protobuf 7.34 for every other
tool on the machine (2026-09-11).
"""
import argparse, json, os
from steam.client import SteamClient


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('appids', nargs='+', type=int)
    ap.add_argument('--out', help='episode folder (only with a single appid)')
    a = ap.parse_args()

    c = SteamClient()
    if c.anonymous_login() != 1:
        raise SystemExit('anonymous login failed')
    info = c.get_product_info(apps=a.appids, timeout=60) or {}
    result = {}
    for app in a.appids:
        node = (info.get('apps') or {}).get(app) or {}
        depots = []
        for k, v in (node.get('depots') or {}).items():
            if not str(k).isdigit():
                continue
            pub = (v.get('manifests') or {}).get('public') or {}
            if not isinstance(pub, dict) or 'size' not in pub:
                continue
            depots.append({'depot': int(k), 'gid': str(pub.get('gid')),
                           'size': int(pub['size']), 'download': int(pub.get('download') or 0),
                           'oslist': (v.get('config') or {}).get('oslist', '')})
        result[app] = {'name': (node.get('common') or {}).get('name'),
                       'type': (node.get('common') or {}).get('type'), 'depots': depots}
        line = ', '.join(f"{d['oslist'] or '?'} {d['size']/1048576:.1f} MiB (dl {d['download']/1048576:.1f})"
                         for d in depots)
        print(f"{app} {result[app]['name']}: {line or 'no public depot sizes'}")
    c.logout()

    if a.out:
        if len(a.appids) != 1:
            raise SystemExit('--out needs exactly one appid')
        os.makedirs(a.out, exist_ok=True)
        json.dump(result[a.appids[0]], open(os.path.join(a.out, 'pics.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
