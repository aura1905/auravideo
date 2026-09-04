"""Write the YouTube description for a 데모 찍먹 (Korean) episode, chapters included.

    python scripts/pipeline/make_desc_ko.py --episode episodes/ko-03-pengpong/episode.json         --out episodes/ko-03-pengpong/desc.txt

A copy of make_desc.py with the boilerplate in Korean. The timeline maths is identical
and must stay in step with build_plan.py; only the wording differs. The estimate/copyright
notice matters as much here as in English -- it is what keeps an outside teardown honest,
and docs/CHANNEL_KO.md requires that estimates are labelled as estimates.
"""
import argparse, json

GAP = 0.4
INTRO_LEN = 3.4

# section id -> chapter label. A section with no entry gets no chapter marker.
# Section id -> chapter label. Overridable per episode via episode.json["chapters"],
# because the hook and intro labels should name what THIS episode is about.
CHAPTERS = {
    'hook': '후크',
    'intro': '어떤 게임인가',
    'made': '빌드 뜯어보기',
    'review': '플레이어들이 하는 말',
    'score': '스펙 시트와 판정',
}


def ts(sec):
    sec = max(0, int(sec))
    return f'{sec // 60}:{sec % 60:02d}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--episode', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--hook', default='', help='one-line hook for line 1 (defaults to the first script line)')
    ap.add_argument('--takeaway', default='', help='line 2: what a small-team dev gets out of it')
    a = ap.parse_args()

    ep = json.load(open(a.episode, encoding='utf-8'))
    segs = json.load(open(ep['script_timed'], encoding='utf-8'))
    CHAPTERS.update(ep.get('chapters') or {})

    # walk the same timeline build_plan.py lays out
    cold_n = int(ep.get('cold_open_lines', ep.get('hook_lines', 2)))
    cold_len = sum(x['dur'] + GAP for x in segs[:cold_n])
    sting_at = cold_len + 0.2
    still_start = sting_at + INTRO_LEN

    t = 0.0
    marks, seen = [], set()
    for i, s in enumerate(segs):
        if i == cold_n:
            t = still_start
        if s['sec'] not in seen and s['sec'] in CHAPTERS:
            seen.add(s['sec'])
            marks.append((0.0 if not marks else t, CHAPTERS[s['sec']]))
        t += s['dur'] + GAP
    total = t + 0.8

    name = ep.get('title_ko') or ep.get('title_en') or '이 데모'
    hook = a.hook or ' '.join(segs[0]['text'].split())
    L = []
    L.append(f'{name} — {hook}')
    if a.takeaway:
        L.append(a.takeaway)
    L.append('')
    L.append(f'▶ 무료 데모: https://store.steampowered.com/app/{ep["demo_appid"]}/')
    L.append(f'▶ 본편: https://store.steampowered.com/app/{ep["full_appid"]}/')
    L.append('')
    L.append('── 이렇게 만들었습니다 ──')
    # Hangul is double-width in a monospaced client, so pad by display width, and never
    # call .title() on it -- that would only mangle any Latin inside a Korean label.
    def dw(s): return sum(2 if ord(c) > 0x1100 else 1 for c in s)
    rows = list(ep['specs']) + [['판정', ep['verdict']]]
    w = max(dw(k) for k, _ in rows)
    for k, v in rows:
        L.append(f'{k}{" " * (w - dw(k))} : {v}')
    stack = ep.get('stack') or []
    if stack:
        L.append('')
        L.append('── 쓰인 도구들 ──')
        w2 = max(dw(n) for n, _ in stack)
        for name, url in stack:
            L.append(f'{name}{" " * (w2 - dw(name))} : {url}')
    L.append('')
    L.append('── 챕터 ──')
    for sec, label in marks:
        L.append(f'{ts(sec)} {label}')
    L.append('')
    L.append('이 영상의 제작 분석은 전부 공개된 정보만 보고 쓴 것입니다. 스팀 상점 페이지, 개발사의')
    L.append('공개 발언, 최근 리뷰, 그리고 스팀이 공개하는 데모 depot 파일 목록(파일 이름과 크기만')
    L.append('봤고 해체·디컴파일·재배포는 하지 않았습니다). 개발사의 공식 설명이 아니라 바깥에서 읽은')
    L.append('것이고, 추정은 추정이라고 밝혔습니다. 틀린 부분은 댓글로 알려주시면 정정해 고정하겠습니다.')
    L.append(f'게임 영상과 이미지의 권리는 {ep.get("developer", "개발사")}에 있습니다.')
    L.append('')
    # The one-line credential. It is what separates this from an outsider's guess, so it
    # rides on every video — but it stays one line, never a biography.
    L.append('게임 개발 20년 넘게 한 사람이 만듭니다.')
    L.append('')
    L.append('#인디게임 #게임개발 #스팀데모')

    open(a.out, 'w', encoding='utf-8', newline='\n').write('\n'.join(L) + '\n')
    print(f'{a.out}  ({len(L)} lines, video ≈ {ts(total)})')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
