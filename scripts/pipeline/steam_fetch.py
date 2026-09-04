"""Collect everything Steam gives us about one game into a work folder.

    python scripts/pipeline/steam_fetch.py --demo 4777710 --out C:/tmp/ep/pocket

Writes: appdetails_<lang>.json (demo + full game), reviews.json (demo reviews),
ss00..N.jpg (store screenshots), and prints the facts the script needs.
Trailers: Steam's appdetails often has empty mp4 fields; take the HLS master path
from SteamDB (browser only, curl gets 403) and run
    ffmpeg -i "https://video.akamai.steamstatic.com/store_trailers/<path>/hls_264_master.m3u8" -c copy trailer_main.mp4
Engine/"Technologies" and the AI-content flag are also on SteamDB — read them in a browser.
"""
import argparse, json, os, re, time, urllib.request

UA = {'User-Agent': 'Mozilla/5.0'}


def get(url, raw=False):
    req = urllib.request.Request(url, headers=UA)
    b = urllib.request.urlopen(req, timeout=60).read()
    return b if raw else json.loads(b)


def appdetails(appid, lang):
    d = get(f'https://store.steampowered.com/api/appdetails?appids={appid}&l={lang}')
    return (d.get(str(appid)) or {}).get('data') or {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--demo', type=int, help='demo appid (full game is resolved via fullgame)')
    ap.add_argument('--app', type=int, help='full-game appid if there is no demo')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    demo = appdetails(a.demo, 'english') if a.demo else {}
    full_id = a.app or int((demo.get('fullgame') or {}).get('appid') or 0)
    if not full_id:
        raise SystemExit('cannot resolve the full-game appid')
    facts = {'demo_appid': a.demo, 'full_appid': full_id}
    for lang in ('english', 'schinese', 'koreana', 'japanese'):
        d = appdetails(full_id, lang)
        if not d:
            continue
        json.dump(d, open(os.path.join(a.out, f'appdetails_{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        if lang == 'english':
            facts.update({
                'name': d.get('name'), 'developers': d.get('developers'), 'publishers': d.get('publishers'),
                'release': (d.get('release_date') or {}).get('date'), 'coming_soon': (d.get('release_date') or {}).get('coming_soon'),
                'genres': [g['description'] for g in d.get('genres', [])],
                'languages': re.sub(r'<[^>]+>', '', d.get('supported_languages', '')),
                'website': d.get('website'), 'short': d.get('short_description'),
                'about': re.sub(r'<[^>]+>', ' ', d.get('detailed_description', ''))[:4000],
                'min_req': re.sub(r'<[^>]+>', ' ', (d.get('pc_requirements') or {}).get('minimum', '')),
                'movies': [{'id': m['id'], 'name': m.get('name')} for m in d.get('movies', [])],
            })
            for i, s in enumerate(d.get('screenshots', [])):
                p = os.path.join(a.out, f'ss{i:02d}.jpg')
                if not os.path.exists(p):
                    open(p, 'wb').write(get(s['path_full'], raw=True))
            facts['screenshots'] = len(d.get('screenshots', []))
        time.sleep(0.3)
    # reviews (demo first — that is where pre-release feedback lives)
    # Prefer the demo's reviews (pre-release feedback); fall back to the full game
    # when the demo has none, which is the normal case for an already-released title.
    r = get(f'https://store.steampowered.com/appreviews/{a.demo or full_id}?json=1&language=all&purchase_type=all&num_per_page=100&filter=recent')
    if not (r.get('query_summary') or {}).get('total_reviews'):
        r = get(f'https://store.steampowered.com/appreviews/{full_id}?json=1&language=all&purchase_type=all&num_per_page=100&filter=recent')
    json.dump(r, open(os.path.join(a.out, 'reviews.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    q = r.get('query_summary', {})
    facts['reviews'] = {'total': q.get('total_reviews'), 'positive': q.get('total_positive'), 'desc': q.get('review_score_desc')}
    json.dump(facts, open(os.path.join(a.out, 'facts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in facts.items() if k not in ('about',)}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
