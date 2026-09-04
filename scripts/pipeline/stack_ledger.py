"""Keep docs/STACKS.md's table and totals in sync with the episodes.

    python scripts/pipeline/stack_ledger.py            # rebuild the table + totals
    python scripts/pipeline/stack_ledger.py --check    # non-zero exit if it is stale

The ledger is the channel's compounding asset: after ten or twenty teardowns it answers
"what do small teams actually ship with", which no store page can. Doing it by hand
means forgetting a row, so each episode declares its own facts in `episode.json["ledger"]`
and this script renders the document.

    "ledger": {"team": "one person", "engine": "Unity", "pipeline": "URP 2D",
               "backend": "Mono", "build": "517 MiB", "files": 189, "scenes": 2,
               "third_party": 1, "approach": "wrote it all", "reception": "96.2% / 6.8k",
               "packages": ["DiscordRPC"], "ai_disclosure": "none used"}
"""
import argparse, glob, json, os, re, statistics, sys

DOC = 'docs/STACKS.md'
COLS = ['게임', '팀', '엔진', '파이프라인', '백엔드', '빌드', '파일', '씬', '서드파티', '산 것 / 만든 것', '평가']


def rows():
    out = []
    for p in sorted(glob.glob('episodes/*/episode.json')):
        ep = json.load(open(p, encoding='utf-8'))
        led = ep.get('ledger')
        if not led:
            continue
        num = os.path.basename(os.path.dirname(p)).split('-')[0]
        out.append((num, ep.get('title_en') or ep.get('title_ko') or '?', led))
    return out


def size_gib(text):
    m = re.match(r'([\d.]+)\s*(MiB|GiB)', str(text))
    if not m:
        return None
    v = float(m.group(1))
    return v / 1024 if m.group(2) == 'MiB' else v


def render():
    rs = rows()
    if not rs:
        return None
    body = ['| # | ' + ' | '.join(COLS) + ' |', '|' + '---|' * (len(COLS) + 1)]
    for num, name, d in rs:
        body.append('| {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} |'.format(
            num, name, d.get('team', '?'), d.get('engine', '?'), d.get('pipeline', '?'),
            d.get('backend', '?'), d.get('build', '?'), d.get('files', '?'),
            d.get('scenes', '?'), d.get('third_party', '?'), d.get('approach', '?'),
            d.get('reception', '?')))

    eng, pipe, back, pkgs = {}, {}, {}, {}
    sizes, thirds, ai = [], [], 0

    def family(v):
        """'Unity 6' and 'Unity' are the same engine for a tally; the version is a row detail."""
        return re.sub(r'\*|\s*\d.*$', '', str(v)).strip() or '?'

    for _, _, d in rs:
        e = family(d.get('engine', '?'))
        eng[e] = eng.get(e, 0) + 1
        pipe[d.get('pipeline', '?')] = pipe.get(d.get('pipeline', '?'), 0) + 1
        back[d.get('backend', '?')] = back.get(d.get('backend', '?'), 0) + 1
        g = size_gib(d.get('build'))
        if g:
            sizes.append(g)
        m = re.search(r'\d+', str(d.get('third_party', '')))
        if m:
            thirds.append(int(m.group()))
        if d.get('ai_disclosure'):
            ai += 1
        for pk in d.get('packages') or []:
            pkgs[pk] = pkgs.get(pk, 0) + 1

    def tally(dd):
        return ' / '.join(f'{k} {v}' for k, v in sorted(dd.items(), key=lambda kv: -kv[1]))

    n = len(rs)
    tot = [f'## 누적 집계 ({n}편 기준' + (' — 의미 있는 수치는 10편부터' if n < 10 else '') + ')', '',
           f'- 엔진: {tally(eng)}',
           f'- 파이프라인: {tally(pipe)}',
           f'- 스크립팅 백엔드: {tally(back)}']
    if sizes:
        tot.append(f'- 중간값 빌드 크기: {statistics.median(sizes):.2f} GiB')
    if thirds:
        tot.append(f'- 서드파티 패키지 중간값: {statistics.median(thirds):g}개')
    tot.append(f'- 생성형 AI 공시가 있는 편: {ai} / {n}')

    rep = [pk for pk, c in sorted(pkgs.items(), key=lambda kv: -kv[1]) if c >= 2]
    dup = ['## 지금까지 두 번 이상 나온 패키지', '']
    dup.append('- ' + ', '.join(f'**{p}** ({pkgs[p]}편)' for p in rep) if rep
               else '아직 없음. (같은 패키지가 여러 편에 나오기 시작하면 그게 "소규모 팀의 표준 스택"이다.)')
    return '\n'.join(body), '\n'.join(tot), '\n'.join(dup)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()

    built = render()
    if not built:
        sys.exit('no episode.json carries a "ledger" block yet')
    table, totals, dups = built
    doc = open(DOC, encoding='utf-8').read()

    def swap(text, start, end, new):
        i = text.index(start)
        j = text.index(end, i)
        return text[:i] + new + '\n\n' + text[j:]

    out = swap(doc, '| # | 게임', '## 누적 집계', table)
    out = swap(out, '## 누적 집계', '## 지금까지 두 번 이상', totals)
    out = swap(out, '## 지금까지 두 번 이상', '## 언급한 도구는', dups)

    if a.check:
        sys.exit(0 if out == doc else f'{DOC} is stale — run stack_ledger.py')
    open(DOC, 'w', encoding='utf-8', newline='\n').write(out)
    print(f'{DOC} updated — {len(rows())} episodes')


if __name__ == '__main__':
    main()
