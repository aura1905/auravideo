"""Mine a demo's Steam review corpus for what the build teardown cannot tell you.

    python scripts/pipeline/analyze_reviews.py --app 4568400 --out episodes/04-nomad-drive [--pages 6]

Writes reviews_all.json and prints a report: score, language mix, playtime distribution,
and how often each topic appears in positive vs negative reviews. The point is to connect
a technical choice found in the build to how players actually reacted -- "HDRP on a small
team" only becomes a story if the reviews complain about performance.

Playtime is read from `playtime_at_review` (what they had played when they wrote it),
falling back to `playtime_forever`; both are minutes. The median matters more than the
mean, since a handful of long sessions drag the mean up.
"""
import argparse, collections, json, re, statistics, time, urllib.parse, urllib.request

UA = {'User-Agent': 'Mozilla/5.0'}
TOPICS = {
    'performance / fps': r'\b(fps|frame\s?rate|stutter|lagg?|laggy|optimi[sz]|performance|choppy|freeze|crash)',
    'co-op / netcode': r'\b(co-?op|multiplayer|friends?|server|join|host|desync|lobby)',
    'driving / vehicle': r'\b(driv|vehicle|\brv\b|\bcar\b|wheel|handling|physics|steer)',
    'world / procgen': r'\b(procedural|randomi|generat|open world|empty|barren|repetitive|\bmap\b)',
    'bugs': r'\b(bug|glitch|broken|soft\s?lock|stuck|unplayable|jank)',
    'looks': r'\b(graphic|beautiful|gorgeous|visual|lighting|pretty|stunning|atmospher)',
    'pace / grind': r'\b(grind|slow|tedious|boring|repetitive|clunky)',
    'potential': r'\b(potential|promising|early access|can.?t wait|wishlist|looking forward)',
    'short / content': r'\b(short|not much|little content|demo is|more content|barely)',
}


def fetch(app, pages, lang='all'):
    out, cursor = [], '*'
    for _ in range(pages):
        url = (f'https://store.steampowered.com/appreviews/{app}?json=1&filter=recent&language={lang}'
               f'&purchase_type=all&num_per_page=100&cursor={urllib.parse.quote(cursor)}')
        d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
        rs = d.get('reviews') or []
        if not rs:
            break
        out += rs
        cursor = d.get('cursor') or ''
        if not cursor:
            break
        time.sleep(0.4)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--pages', type=int, default=6)
    a = ap.parse_args()

    revs = fetch(a.app, a.pages)
    seen, uniq = set(), []
    for r in revs:
        if r['recommendationid'] in seen:
            continue
        seen.add(r['recommendationid']); uniq.append(r)
    json.dump(uniq, open(f'{a.out}/reviews_all.json', 'w', encoding='utf-8'), ensure_ascii=False)

    up = [r for r in uniq if r.get('voted_up')]
    down = [r for r in uniq if not r.get('voted_up')]
    print(f'reviews {len(uniq)}   positive {len(up)} ({len(up) / max(1, len(uniq)) * 100:.1f}%)   negative {len(down)}')

    langs = collections.Counter(r.get('language', '?') for r in uniq)
    print('languages:', ', '.join(f'{k} {v}' for k, v in langs.most_common(8)))

    def pt(r):
        au = r.get('author') or {}
        return au.get('playtime_at_review') or au.get('playtime_forever') or 0
    mins = sorted(pt(r) for r in uniq)
    if mins:
        print(f'playtime at review (min): median {statistics.median(mins):.0f}  mean {statistics.mean(mins):.1f}  '
              f'p10 {mins[len(mins) // 10]}  p90 {mins[len(mins) * 9 // 10]}  under-10-min '
              f'{sum(1 for m in mins if m < 10) / len(mins) * 100:.0f}%')
        for grp, name in ((up, 'positive'), (down, 'negative')):
            g = sorted(pt(r) for r in grp)
            if g:
                print(f'  {name:9} median {statistics.median(g):.0f} min')

    ptxt = [r.get('review') or '' for r in up]
    ntxt = [r.get('review') or '' for r in down]
    print(f'\n{"topic":22} {"pos":>5} {"neg":>5}   neg share')
    for name, pat in TOPICS.items():
        p = sum(1 for t in ptxt if re.search(pat, t, re.I))
        n = sum(1 for t in ntxt if re.search(pat, t, re.I))
        share = f'{n / max(1, p + n) * 100:3.0f}%'
        print(f'{name:22} {p:5} {n:5}   {share}')

    print('\n-- most-helpful negative reviews --')
    for r in sorted(down, key=lambda r: -float(r.get('weighted_vote_score') or 0))[:6]:
        t = ' '.join((r.get('review') or '').split())[:260]
        print(f'[{r.get("language")}, {pt(r)}min, votes {r.get("votes_up")}] {t}')
    print('\n-- most-helpful positive reviews --')
    for r in sorted(up, key=lambda r: -float(r.get('weighted_vote_score') or 0))[:4]:
        t = ' '.join((r.get('review') or '').split())[:220]
        print(f'[{r.get("language")}, {pt(r)}min, votes {r.get("votes_up")}] {t}')


if __name__ == '__main__':
    main()
