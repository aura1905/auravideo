"""Korean-channel candidate queue: which Steam demos are worth a teardown for 데모 찍먹.

    python scripts/pipeline/demo_queue_ko.py --ids 4568400,4576510 --engine 4568400=Unity
    python scripts/pipeline/demo_queue_ko.py --from-file ids.txt --out docs/QUEUE_KO.md

The Korean channel picks its own games (docs/CHANNEL_KO.md §0), so it needs its own
ranking -- but not its own scraper. This imports `demo_queue` and reuses its fetchers
and its DROP rules verbatim; only the score and the extra Korean checks are new. The
English tool and docs/QUEUE.md are never touched, which also keeps the two sessions
working this repo out of each other's way.

What changes vs the English ranking:
- **Korean language support is a gate, not a bonus.** A viewer who cannot read the game
  will not install it, so the episode converts to nothing. No Korean -> HOLD.
- **A Korean developer is the strongest hook there is** on this channel. The API cannot
  tell us nationality, so we detect what it can (Hangul in the studio name) and flag the
  rest for a human search rather than guessing.
- Reviews still carry demand, but at lower weight: the demo hub's ranking is made by
  North American and Chinese players and does not track Korean search demand.
"""
import argparse, json, re, sys, time
import demo_queue as dq

HANGUL = re.compile(r'[가-힣]')
# Studios worth knowing by name; the list is small on purpose -- it is a shortcut for
# ones we have already verified, not a substitute for looking a new name up.
# Verified Korean studios. Steam gives no nationality, so this is a hand-kept list;
# entries come from Korean coverage (인디게임닷컴 넥스트 페스트 K-인디 특집) or a search.
# A miss means "look it up", never "not Korean" -- see verdict_ko.
KNOWN_KR = {'team horay', 'studio doodal', 'yudiko studio', 'joyful jo', 'lightersgames',
            'studio nemo', 'nemo studio', 'sandy floor', 'superthumb', 'mongma studio',
            'bucketplay inc.', 'bucketplay', 'canopener', 'can opener', 'finalblow co.',
            'jellysnow', 'alpheratz games', 'giantk games',
            'nexon', 'smilegate', 'neowiz', 'com2us', 'com2us holdings'}


def has_korean(d):
    return 'korean' in (d.get('supported_languages') or '').lower()


def korean_dev(c):
    """True only when we can actually tell. Everything else is 'unknown', not 'no'."""
    blob = f"{c['dev']} {c['pub']}"
    if HANGUL.search(blob):
        return True
    low = blob.lower()
    return any(k in low for k in KNOWN_KR)


def score_ko(c):
    s = 0.0
    s += min(c['reviews'], 4000) / 200.0          # demand, at half the English weight
    if c['reviews'] >= 300:
        s += 8
    if 40 <= c['pct'] <= 85:
        s += 8                                    # a split reception is a story
    if c['ko_lang']:
        s += 30                                   # 1순위: the viewer can actually play it
    if c['ko_dev']:
        s += 40                                   # 2순위: the strongest hook on this channel
    if c['dev'] == c['pub']:
        s += 20                                   # small-team signal
    e = (c['engine'] or '').lower()
    if e.startswith('unity'):
        s += 25                                   # Unity leaves a package list to read
    elif e.startswith('godot'):
        s += 20
    return round(s, 1)


def big_publisher(c):
    """Word-boundary match. `dq.verdict` uses substring matching, so short entries in
    its BIG set hit innocent studios -- 'ea' matches "Dead Tape Studio", '2k' would match
    "H2K". Same bug is in demo_queue.py; flagged, not edited (English track owns it)."""
    words = set(re.findall(r"[a-z0-9&.'-]+", f"{c['dev']} {c['pub']}".lower()))
    blob = f"{c['dev']} {c['pub']}".lower()
    for b in dq.BIG:
        if (' ' in b and b in blob) or (' ' not in b and b in words):
            return True
    return False


# Korean majors and their labels. dq.BIG is a Western list, so Com2us/Nexon and friends
# sail through it -- but the 규모 필터 excludes them for exactly the same reason.
KR_BIG = {'com2us', 'nexon', 'ncsoft', 'netmarble', 'smilegate', 'krafton', 'pearl abyss',
          'kakao games', 'neowiz', 'shinsegae', 'wemade', 'gravity', 'joycity', 'devsisters'}


def verdict_ko(c):
    blob = f"{c['dev']} {c['pub']}".lower()
    if any(b in blob for b in KR_BIG):
        return 'DROP — 대기업/중견: 1~2인이 흉내낼 수 있는 규모가 아님'
    v = dq.verdict(c)                             # inherit every DROP/HOLD rule
    if v == 'DROP — big publisher' and not big_publisher(c):
        v = 'GO'                                  # false positive from substring matching
    if v.startswith('DROP'):
        return v
    if not c['ko_lang']:
        return 'HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외)'
    # The English tool holds anything under 100 reviews. That floor is wrong here: it was
    # set against demo-hub candidates with thousands, while a Korean indie demo rarely
    # clears it -- 세피리아 has 0 and was still this channel's best-performing episode.
    # Reception is a nice-to-have; a Korean developer is the hook.
    if v.startswith('HOLD — too few reviews'):
        if c['ko_dev']:
            return 'GO — 한국 개발자 (리뷰 적음: 평판보다 개발자가 후크)'
        if c['reviews'] >= 30:
            return 'CHECK — 리뷰 적음, 개발사 국적 확인 필요'
        return 'HOLD — 수요도 평판도 아직 없음'
    if v.startswith('HOLD') or v.startswith('CHECK'):
        return v
    if c['ko_dev']:
        return 'GO — 한국 개발자'
    return 'GO — 개발사 국적 확인 필요(한국이면 최우선)'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='')
    ap.add_argument('--from-file')
    ap.add_argument('--engine', action='append', default=[], help='appid=Engine (SteamDB, by hand)')
    ap.add_argument('--out')
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
            d = dq.appdetails(i)
            if not d:
                print(f'{i}: no appdetails', file=sys.stderr); continue
            q = dq.reviews(i)
            tot = int(q.get('total_reviews') or 0)
            pos = int(q.get('total_positive') or 0)
            c = {'id': i, 'name': d.get('name', '?'),
                 'dev': (d.get('developers') or ['?'])[0], 'pub': (d.get('publishers') or ['?'])[0],
                 'engine': engines.get(i, ''), 'reviews': tot,
                 'pct': round(pos / tot * 100, 1) if tot else 0.0,
                 'ko_lang': has_korean(d),
                 'release': (d.get('release_date') or {}).get('date', '')}
            c['ko_dev'] = korean_dev(c)
            rows.append(c)
        except Exception as e:
            print(f'{i}: {e}', file=sys.stderr)
        time.sleep(0.4)

    for r in rows:
        r['score'] = score_ko(r)
        r['verdict'] = verdict_ko(r)
    rows.sort(key=lambda r: (-r['score'], r['name']))

    lines = ['# 후보 큐 (한국어 채널) — 다음에 뜯을 데모', '',
             '`python scripts/pipeline/demo_queue_ko.py --ids ... --engine <id>=Unity --out docs/QUEUE_KO.md` 로 갱신한다.',
             '기준은 `docs/CHANNEL_KO.md` §1. 엔진은 SteamDB의 **데모 appid** 페이지에서 손으로 확인해 넘긴다.', '',
             '한국어 지원은 게이트, 한국 개발자는 최상위 가중치다. 개발사 국적은 API로 알 수 없어',
             '스튜디오 이름에 한글이 있는 경우만 자동 판정하고 나머지는 확인 대상으로 남긴다.', '',
             '| 점수 | 게임 | 개발사 / 퍼블리셔 | 엔진 | 한국어 | 리뷰 | 판정 | 데모 |',
             '|---|---|---|---|---|---|---|---|']
    for r in rows:
        lines.append(f"| {r['score']} | {r['name']} | {r['dev']} / {r['pub']} | {r['engine'] or '?'} | "
                     f"{'O' if r['ko_lang'] else 'X'} | {r['reviews']} ({r['pct']}%) | {r['verdict']} | "
                     f"https://store.steampowered.com/app/{r['id']}/ |")
    text = '\n'.join(lines) + '\n'
    print(text)
    if a.out:
        open(a.out, 'w', encoding='utf-8', newline='\n').write(text)
        print(f'wrote {a.out}', file=sys.stderr)


if __name__ == '__main__':
    main()
