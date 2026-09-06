"""Build the **Shorts** candidate pool — kept deliberately separate from `demo_queue.py`.

    python scripts/pipeline/shorts_queue.py --days 10 --out docs/QUEUE_SHORTS.md

Why a second queue. The long-form queue exists to find demos whose *build* can be taken
apart: small team, Unity/Mono, a readable file list. Shorts have a different job — they
are the discovery surface, and the audience there is led by Greater China (episode 04's
review corpus was Chinese 264 / English 218; the 22:00 KST slot is the Chinese evening).
Running both off one score kept pushing Chinese-language demos below Anglophone indies
that happened to ship a nicer DLL list, which is backwards for the slot they'd fill.

So this ranks on *reach*, not on teardown depth:

- **Chinese reach** is the heaviest term, but it means *playable by* the Chinese audience,
  not *made in* China. A Simplified-Chinese interface scores; a Chinese-only release is
  penalised, because the channel narrates in English and a demo an English speaker cannot
  play is no use to either half of the audience. (User, 2026-09-06, after I picked a
  Simplified-Chinese-only title: "중국 유저들도 좋아할만한 게임으로 하라고, 중국 게임으로
  하지 말고.")
- **Demand** (concurrent players) is a *floor*, not a weight. Episodes 04 and 05 landed
  within 4% of each other on views while their player counts differed by 60%, so the
  number does not rank anything; it only tells us somebody is there.
- **Recency** matters — the channel's premise is this week's demos.

Nothing here filters on studio size or engine. That is the standing rule for Shorts
(user, 2026-09-05: pick by demand, keep the size/engine filters on long-form only).
The one gate a candidate still has to pass is human: **is there a one-sentence fact in
the file list that would stop a scroll?** This script cannot answer that, so it prints
the SteamDB depot link for each survivor and the answer is written in by hand.
"""
import argparse, io, json, re, sys, time, urllib.request

UA = {'User-Agent': 'Mozilla/5.0'}
MIN_PLAYERS = 60          # a floor, not a ranking weight — see the module docstring
CJK = re.compile(r'[㐀-鿿]')


def get(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8', 'replace')


def recent_demo_ids(pages=3):
    """Newest-first demo appids from Steam's own search (category1=10 is 'Demo')."""
    ids = []
    for start in range(0, pages * 50, 50):
        url = ('https://store.steampowered.com/search/results/?query&start=%d&count=50'
               '&dynamic_data=&sort_by=Released_DESC&category1=10&infinite=1&json=1' % start)
        try:
            html = json.loads(get(url)).get('results_html', '')
        except Exception:
            break
        ids += [int(m) for m in re.findall(r'data-ds-appid="(\d+)"', html)]
        time.sleep(0.7)
    seen, out = set(), []
    for a in ids:
        if a not in seen:
            seen.add(a); out.append(a)
    return out


def appdetails(appid, lang='english'):
    url = f'https://store.steampowered.com/api/appdetails?appids={appid}&l={lang}'
    d = json.loads(get(url)).get(str(appid), {})
    return d.get('data') if d.get('success') else None


def players(appid):
    try:
        u = ('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/'
             f'v1/?appid={appid}')
        return json.loads(get(u, 20))['response'].get('player_count', -1)
    except Exception:
        return -1


def china_score(d, sc_name):
    """0-50. Would the Greater China audience be able to play this, and want to?

    Reach, not origin. Simplified Chinese is what lets that audience in; English is what
    keeps the rest of the channel's viewers able to follow. A demo with only one of the
    two is worth less than a demo with both, and a Chinese-only release scores zero
    however hyped it is."""
    langs = (d.get('supported_languages') or '').lower()
    sc = 'simplified chinese' in langs
    en = 'english' in langs
    if not (sc and en):
        return 0                      # single-audience release — not for these slots
    s = 30                            # both doors open
    if 'traditional chinese' in langs:
        s += 5
    head = langs.split('languages with full audio support')[0]
    if sc and '<strong>*</strong>' in head.split('simplified chinese')[-1][:40]:
        s += 10                       # full Chinese audio, not just an interface pass
    if len(re.findall(r'<strong>\*</strong>', langs)) >= 2:
        s += 5                        # voiced in more than one language = a real localisation budget
    return min(s, 50)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', type=int, default=3, help='50 demos per page, newest first')
    ap.add_argument('--limit', type=int, default=40, help='how many to detail-fetch')
    ap.add_argument('--out', help='write markdown here as well as printing')
    a = ap.parse_args()

    ids = recent_demo_ids(a.pages)
    print(f'{len(ids)} recent demos; checking who is actually playing them', file=sys.stderr)

    # Two passes on purpose. Sorted newest-first, the top of the list is mostly demos
    # nobody has opened yet — a straight detail-fetch of the first N returns an empty
    # queue. The player count is one cheap call, so use it to pick who is worth the
    # three detail calls, then rank the survivors.
    live = []
    for i, appid in enumerate(ids):
        p = players(appid)
        if p >= MIN_PLAYERS:
            live.append((appid, p, i))
        time.sleep(0.25)
    live.sort(key=lambda t: -t[1])
    print(f'{len(live)} above the {MIN_PLAYERS}-player floor; detailing the top {a.limit}',
          file=sys.stderr)

    rows = []
    for appid, p, i in live[:a.limit]:
        d = appdetails(appid)
        if not d or d.get('type') != 'demo':
            continue
        sc = appdetails(appid, 'schinese') or {}
        cs = china_score(d, sc.get('name'))
        score = cs + min(max(p, 0), 2000) / 100.0 + (len(ids) - i) / len(ids) * 10
        rows.append({
            'appid': appid, 'name': d.get('name', '?'), 'sc_name': sc.get('name', ''),
            'dev': ', '.join(d.get('developers') or []) or '?',
            'pub': ', '.join(d.get('publishers') or []) or '?',
            'players': p, 'china': cs, 'score': round(score, 1),
        })
        time.sleep(0.6)

    rows.sort(key=lambda r: -r['score'])

    head = ('# 쇼츠 후보 풀 (중화권 우선)\n\n'
            '`python scripts/pipeline/shorts_queue.py --pages 3 --out docs/QUEUE_SHORTS.md`\n\n'
            '롱폼 큐(`QUEUE.md`)와 **별도로 관리한다.** 여기는 분해 깊이가 아니라 도달을 기준으로 줄 세운다 '
            '— 중화권 지원, 수요(접속자는 하한선일 뿐 가중치가 아니다), 최신성. 규모·엔진 필터 없음.\n\n'
            '**마지막 관문은 사람이 판단한다: 파일 목록에 한 문장으로 스크롤을 멈추게 할 사실이 있는가.** '
            '없으면 점수가 높아도 넘긴다.\n\n'
            '| 점수 | 게임 | 중국어명 | 개발사 | 접속 | 중화권 | 데포 |\n|---|---|---|---|---|---|---|\n')
    lines = []
    for r in rows:
        lines.append('| {score} | [{name}](https://store.steampowered.com/app/{appid}/) | {sc} | {dev} | {pl} | {ch} | '
                     '[SteamDB](https://steamdb.info/app/{appid}/depots/) |'.format(
                         score=r['score'], name=r['name'], appid=r['appid'],
                         sc=r['sc_name'] if CJK.search(r['sc_name'] or '') else '',
                         dev=r['dev'], pl=r['players'] if r['players'] >= 0 else '?', ch=r['china']))
    md = head + '\n'.join(lines) + '\n'
    print(md)
    if a.out:
        io.open(a.out, 'w', encoding='utf-8', newline='\n').write(md)
        print(f'wrote {a.out}  ({len(rows)} candidates)', file=sys.stderr)


if __name__ == '__main__':
    main()
