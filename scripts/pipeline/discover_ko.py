"""Find Steam demos worth an episode on the Korean channel.

    python scripts/pipeline/discover_ko.py --pages 3 --out ko_ids.txt

Steam's demo hub is client-rendered and its ranking is built by North American and
Chinese players, so it is the wrong starting point here (docs/CHANNEL_KO.md §1).
This walks the other way round, straight down the Korean channel's first filter:

  Steam search, supportedlang=koreana  ->  appdetails  ->  keep the ones with a demo

`appdetails` on a full game carries `demos: [{appid}]`, so the demo appid comes out of
the same call that confirms Korean support. Hangul in the studio name is reported too --
it is the only nationality signal the API gives, and a positive is decisive while a
negative means "look it up", not "not Korean".

Results are cached so a re-run costs no Steam requests; the store rate-limits appdetails
hard (roughly 200 per five minutes) and a 429 poisons the rest of the run.
"""
import argparse, json, os, re, sys, time, urllib.request

UA = {'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9'}
HANGUL = re.compile(r'[가-힣]')
FILTERS = ['popularnew', 'comingsoon', 'topsellers', '']


def get(url, timeout=40):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read().decode('utf-8', 'replace')


def search(filt, start, count=50):
    url = ('https://store.steampowered.com/search/results/?query&infinite=1'
           f'&start={start}&count={count}&supportedlang=koreana&cc=kr&l=koreana'
           + (f'&filter={filt}' if filt else ''))
    r = json.loads(get(url))
    html = r.get('results_html', '')
    ids = re.findall(r'data-ds-appid="([\d,]+)"', html)
    names = re.findall(r'<span class="title">([^<]+)</span>', html)
    out = []
    for i, n in zip(ids, names):
        first = i.split(',')[0]
        if first.isdigit():
            out.append((first, n))
    return out, int(r.get('total_count') or 0)


def appdetails(appid, cache):
    if appid in cache:
        return cache[appid]
    url = f'https://store.steampowered.com/api/appdetails?appids={appid}&cc=kr&l=koreana'
    d = (json.loads(get(url)).get(str(appid)) or {}).get('data') or {}
    cache[appid] = d
    time.sleep(1.0)                      # appdetails throttles hard; a 429 ruins the run
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', type=int, default=2, help='search pages (50 apps each) per filter')
    ap.add_argument('--cache', default='steam_cache.json')
    ap.add_argument('--out', help='write demo appids here, one per line, for demo_queue_ko.py')
    ap.add_argument('--report', help='write the full candidate table as JSON here')
    a = ap.parse_args()

    cache = {}
    if os.path.exists(a.cache):
        cache = json.load(open(a.cache, encoding='utf-8'))

    # Rank inside the Korean store's own listings is the demand signal we want. The
    # global demo hub is ranked by North American and Chinese players; this is not.
    seen, order, rank = set(), [], {}
    for f in FILTERS:
        for p in range(a.pages):
            try:
                rows, total = search(f, p * 50)
            except Exception as e:
                print(f'search {f or "default"} p{p}: {e}', file=sys.stderr); break
            for pos, (i, n) in enumerate(rows):
                r = p * 50 + pos + 1
                rank[i] = min(rank.get(i, 10**6), r)
                if i not in seen:
                    seen.add(i); order.append((i, n))
            print(f'  search {f or "default"} p{p}: +{len(rows)} (total {total})', file=sys.stderr)
            if not rows:
                break
            time.sleep(0.5)

    print(f'{len(order)} Korean-supporting apps found; checking for demos', file=sys.stderr)

    cands = []
    for n, (appid, name) in enumerate(order, 1):
        try:
            d = appdetails(appid, cache)
        except Exception as e:
            print(f'{appid}: {e}', file=sys.stderr); continue
        if not d or d.get('type') != 'game':
            continue
        demos = d.get('demos') or []
        if not demos:
            continue
        dev = (d.get('developers') or ['?'])[0]
        pub = (d.get('publishers') or ['?'])[0]
        cands.append({'demo_id': str(demos[0]['appid']), 'full_id': appid, 'name': d.get('name', name),
                      'kr_rank': rank.get(appid),
                      'dev': dev, 'pub': pub, 'ko_dev': bool(HANGUL.search(f'{dev} {pub}')),
                      'release': (d.get('release_date') or {}).get('date', ''),
                      'genres': [g['description'] for g in (d.get('genres') or [])]})
        print(f'  [{n}/{len(order)}] demo: {d.get("name")} — {dev}', file=sys.stderr)
        json.dump(cache, open(a.cache, 'w', encoding='utf-8'), ensure_ascii=False)

    json.dump(cache, open(a.cache, 'w', encoding='utf-8'), ensure_ascii=False)
    cands.sort(key=lambda c: (not c['ko_dev'], c['kr_rank'] or 10**6))
    print(json.dumps(cands, ensure_ascii=False, indent=1))
    if a.out:
        open(a.out, 'w', encoding='utf-8', newline='\n').write(
            '\n'.join(f"{c['demo_id']}  # {c['name']} / {c['dev']}" for c in cands) + '\n')
        print(f'wrote {a.out} ({len(cands)} demos)', file=sys.stderr)
    if a.report:
        json.dump(cands, open(a.report, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
