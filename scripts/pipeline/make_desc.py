"""Write the YouTube description for an episode, chapters included.

    python scripts/pipeline/make_desc.py --episode episodes/04-nomad-drive/episode.json \
        --out episodes/04-nomad-drive/desc.txt

Chapter times mirror build_plan.py's timeline: the cold open runs from 0, the logo
sting is inserted after `cold_open_lines`, and everything after it shifts by
INTRO_LEN + 0.2. If that layout changes in build_plan.py, change it here too.

Order is fixed by docs/CHANNEL.md: two searchable lines, the demo link, the spec sheet,
**the stack** (every tool named on screen, linked), chapters, the estimate/copyright
notice, three hashtags.
"""
import argparse, json

GAP = 0.4
INTRO_LEN = 3.4

# section id -> chapter label. A section with no entry gets no chapter marker.
# Section id -> chapter label. Overridable per episode via episode.json["chapters"],
# because the hook and intro labels should name what THIS episode is about.
CHAPTERS = {
    'hook': 'The hook',
    'intro': 'What it is',
    'made': 'Opening the build',
    'review': 'What players actually say',
    'score': 'The spec sheet + verdict',
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

    name = ep.get('title_en') or ep.get('title_ko') or 'this demo'
    hook = a.hook or ' '.join(segs[0]['text'].split())
    L = []
    L.append(f'{name} — {hook}')
    if a.takeaway:
        L.append(a.takeaway)
    L.append('')
    L.append(f'▶ Steam demo (free): https://store.steampowered.com/app/{ep["demo_appid"]}/')
    L.append(f'▶ The full game: https://store.steampowered.com/app/{ep["full_appid"]}/')
    L.append('')
    L.append('── How they made it ──')
    w = max(len(k) for k, _ in ep['specs'])
    for k, v in ep['specs']:
        L.append(f'{k.title():<{w}} : {v}')
    L.append(f'{"Verdict":<{w}} : {ep["verdict"].title()}')
    stack = ep.get('stack') or []
    if stack:
        L.append('')
        L.append('── The stack, if you want to use it ──')
        w2 = max(len(n) for n, _ in stack)
        for name, url in stack:
            L.append(f'{name:<{w2}} : {url}')
    L.append('')
    L.append('── Chapters ──')
    for sec, label in marks:
        L.append(f'{ts(sec)} {label}')
    L.append('')
    L.append('Everything about how this game was built is read off public information: the')
    L.append("Steam store page, the developer's own devlogs, the recent review corpus, and the")
    L.append('demo depot manifest that Steam publishes (file names and sizes only — nothing was')
    L.append('unpacked, decompiled, or redistributed). It is an outside reading, not a statement')
    L.append(f'from the developer. All game footage and images belong to {ep.get("developer", "the developer")}.')
    L.append('')
    L.append('#indiedev #gamedev #steamdemo')

    open(a.out, 'w', encoding='utf-8', newline='\n').write('\n'.join(L) + '\n')
    print(f'{a.out}  ({len(L)} lines, video ≈ {ts(total)})')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
