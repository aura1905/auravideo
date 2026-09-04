"""Build the episode candidate queue: which Steam demos are worth a teardown right now.

    python scripts/pipeline/demo_queue.py --ids 4568400,4576510,...   # score these
    python scripts/pipeline/demo_queue.py --from-file ids.txt
    python scripts/pipeline/demo_queue.py --ids ... --out docs/QUEUE.md

Hand-picking candidates became the bottleneck at two episodes a day: Steam's demo hub is
client-rendered and its TOP DEMOS panel often yields nothing, and every candidate then
needs its engine, reception and studio checked one page at a time.

This script does the second half. Give it demo appids and it fetches what Steam's own API
will tell us (developer, publisher, languages, reviews, release), scores each against the
rules in docs/CHANNEL.md, and writes a ranked queue.

**The engine still has to come from SteamDB by hand** — `Technologies` on the *demo's*
appid page — because SteamDB blocks scripted fetches. Pass what you found with
`--engine 4568400=Unity` so the filter can use it; without it a candidate is scored but
flagged `engine?`.

Filters, from docs/CHANNEL.md §8:
- Unreal is dropped. Its content is one `.pak`/`.ucas` blob, so the teardown has nothing
  to read, and the 1–2 person audience does not use it.
- Big publishers, famous IPs, utilities and old releases are dropped.
- A funded studio founded by ex-AAA veterans is dropped even when it calls itself indie —
  that check needs a human search, so this only flags `dev != publisher` for review.
"""
import argparse, json, re, sys, time, urllib.parse, urllib.request

UA = {'User-Agent': 'Mozilla/5.0'}
BIG = {'capcom', 'square enix', 'sega', 'bandai', 'ubisoft', 'ea', 'electronic arts',
       'activision', 'blizzard', 'nintendo', 'sony', 'microsoft', 'xbox', '2k', 'take-two',
       'devolver', 'annapurna', 'paradox', 'focus', 'thq', 'kepler', 'raw fury', 'team17',
       'tinybuild', 'humble', 'curve', 'valve'}
UTILITY_HINTS = ('soundpad', '3dmark', 'benchmark', 'wallpaper')


def get(url, timeout=40):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read())


def appdetails(appid):
    d = get(f'https://store.steampowered.com/api/appdetails?appids={appid}&l=english')
    return (d.get(str(appid)) or {}).get('data') or {}


def reviews(appid):
    url = (f'https://store.steampowered.com/appreviews/{appid}?json=1&filter=all&language=all'
           f'&purchase_type=all&num_per_page=0')
    return (get(url).get('query_summary') or {})


# How much a build of each engine actually tells us. Unity/Mono and Electron name every
# dependency; Godot and Unreal hand back one opaque blob.
ENGINE_READABILITY = {
    'electron': 30,     # app.asar + node_modules == the literal npm dependency list
    'unity': 25,        # package DLLs, or IL2CPP's *.dll-resources.dat
    'gamemaker': 18,    # one data.win, but extensions ship as named DLLs
    'monogame': 18,
    'rpgmaker': 18,
    'bakin': 18,
    'godot': 8,         # a single .pck
    'unreal': 0,
}

# Engines already spent. A fifth Unity episode teaches the audience nothing new, and the
# user said so directly: "계속 유니티 밖에 없네".
DONE_ENGINES = ('unity',)


def engine_key(e):
    e = (e or '').lower()
    for k in ENGINE_READABILITY:
        if k in e.replace(' ', '').replace('_', ''):
            return k
    return ''


def score(c, weekly=False):
    """Rank by demand first, then by how much a teardown would have to work with.

    `weekly` re-calibrates for the channel's actual pool: demos registered in the last
    seven days. A week-old demo with 60 reviews is a hit; demanding 300 throws away
    every candidate (it did -- the whole shortlist came back HOLD).
    """
    s = 0.0
    k = engine_key(c['engine'])
    if weekly:
        s += min(c['reviews'], 100) / 2.0                   # 0-50: within-the-week demand
        if c['reviews'] >= 5:
            s += 10                                         # enough to read *something*
        if 55 <= c['pct'] <= 90:
            s += 12                                         # a split reception is a story
        s += ENGINE_READABILITY.get(k, 5)
        if k and k not in DONE_ENGINES:
            s += 15                                         # a new engine is a new ledger row
    else:
        s += min(c['reviews'], 4000) / 100.0
        if c['reviews'] >= 300:
            s += 15
        if 40 <= c['pct'] <= 85:
            s += 12
        s += ENGINE_READABILITY.get(k, 5)
    if c['dev'] == c['pub']:
        s += 20                                             # dev = publisher, the small-team signal
    return round(s, 1)


def verdict(c):
    e = (c['engine'] or '').lower()
    if 'unreal' in e:
        return 'DROP — Unreal: content is one blob, nothing to read'
    if any(h in c['name'].lower() for h in UTILITY_HINTS):
        return 'DROP — utility, not a game'
    # Match whole words: a substring test read "Purple Bean Games" as EA.
    words = set(re.findall(r"[a-z0-9&+-]+", f"{c['dev']} {c['pub']}".lower()))
    blob = f"{c['dev']} {c['pub']}".lower()
    if any((b in words) if ' ' not in b else (b in blob) for b in BIG):
        return 'DROP — big publisher'
    if c['reviews'] < c['min_reviews']:
        return f"HOLD — under {c['min_reviews']} reviews, reception unreadable"
    if c['dev'] != c['pub']:
        return 'CHECK — has a publisher; verify it is not a funded studio'
    if not c['engine']:
        return 'CHECK — engine unknown, look it up on SteamDB'
    return 'GO'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='', help='comma-separated demo appids')
    ap.add_argument('--from-file', help='file with one appid per line')
    ap.add_argument('--engine', action='append', default=[],
                    help='appid=Engine, e.g. --engine 4568400=Unity (from SteamDB by hand)')
    ap.add_argument('--out', help='write a markdown queue here as well as printing it')
    ap.add_argument('--weekly', action='store_true',
                    help="score for the channel's real pool: demos registered in the last "
                         '7 days, where 60 reviews is already a hit. Rewards an engine the '
                         'ledger has not seen yet.')
    a = ap.parse_args()

    ids = [x.strip() for x in a.ids.split(',') if x.strip()]
    if a.from_file:
        ids += [l.split('#')[0].strip() for l in open(a.from_file, encoding='utf-8') if l.split('#')[0].strip()]
    if not ids:
        sys.exit('give --ids or --from-file')
    engines = dict(e.split('=', 1) for e in a.engine)

    rows = []
    for i in ids:
        try:
            d = appdetails(i)
            if not d:
                print(f'{i}: no appdetails', file=sys.stderr); continue
            q = reviews(i)
            tot = int(q.get('total_reviews') or 0)
            pos = int(q.get('total_positive') or 0)
            rows.append({
                'id': i, 'name': d.get('name', '?'),
                'dev': (d.get('developers') or ['?'])[0], 'pub': (d.get('publishers') or ['?'])[0],
                'engine': engines.get(i, ''), 'reviews': tot,
                'pct': round(pos / tot * 100, 1) if tot else 0.0,
                'full': (d.get('fullgame') or {}).get('appid', ''),
                'release': (d.get('release_date') or {}).get('date', ''),
            })
        except Exception as e:
            print(f'{i}: {e}', file=sys.stderr)
        time.sleep(0.4)

    for r in rows:
        r['min_reviews'] = 5 if a.weekly else 100
        r['score'] = score(r, a.weekly)
        r['verdict'] = verdict(r)
    rows.sort(key=lambda r: (-r['score'], r['name']))

    lines = ['# 후보 큐 — 다음에 뜯을 데모', '',
             '`python scripts/pipeline/demo_queue.py --ids ... --engine <id>=Unity --out docs/QUEUE.md` 로 갱신한다.',
             '엔진은 SteamDB의 **데모 appid** 페이지에서 손으로 확인해 `--engine`으로 넘긴다(SteamDB는 스크립트 fetch를 막는다).', '',
             '| 점수 | 게임 | 개발사 / 퍼블리셔 | 엔진 | 리뷰 | 판정 | 데모 |',
             '|---|---|---|---|---|---|---|']
    for r in rows:
        lines.append(f"| {r['score']} | {r['name']} | {r['dev']} / {r['pub']} | {r['engine'] or '?'} | "
                     f"{r['reviews']} ({r['pct']}%) | {r['verdict']} | "
                     f"https://store.steampowered.com/app/{r['id']}/ |")
    text = '\n'.join(lines) + '\n'
    print(text)
    if a.out:
        open(a.out, 'w', encoding='utf-8', newline='\n').write(text)
        print(f'wrote {a.out}', file=sys.stderr)


if __name__ == '__main__':
    main()
