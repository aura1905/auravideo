"""
Captions come from `sub` when a line has one (the caption-form token, e.g. IL2CPP);
`text` is the spoken form for TTS and must not reach the SRT.
Write an exact SRT for an episode, from the narration timings we already have.

    python scripts/pipeline/make_srt.py --episode episodes/05-casualties-unknown/episode.json \
        --out episodes/05-casualties-unknown/captions.en.srt

Why bother when YouTube auto-captions: search indexes the caption track, and YouTube's
ASR mangles exactly the words this channel lives on -- studio names (Orsoniks), packages
(MapMagic, kcp2k, NWH), and the game's own title. An uploaded track is also what a deaf
viewer gets, and what a viewer with sound off reads.

Timings are READ from `plan.json`, not recomputed. They used to be a second copy of
build_plan.py's arithmetic kept in sync by hand -- and the two drifted: across a `beat`
the copy ran 3.2 s late, so a 47.8 s Short got a caption track whose last cue ended at
50.6 s. The plan is what the renderer actually used, so the plan is what the captions
follow. Lines the plan draws no caption for (a Short hides the last ones behind the
spec card) are timed forward from the previous cue.

Long lines are split into at most two rows at a sentence or clause boundary, because a
caption wider than ~42 characters per row gets cut off on a phone.
"""
import argparse, json, os, re

GAP = 0.4
MAX_ROW = 42


def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def wrap(text):
    """At most two rows. Break on a sentence end near the middle, else on a space."""
    t = ' '.join(text.split())
    if len(t) <= MAX_ROW:
        return t
    mid = len(t) // 2
    breaks = [m.end() for m in re.finditer(r'[.!?,;:—]\s', t)] or [m.start() for m in re.finditer(r'\s', t)]
    b = min(breaks, key=lambda i: abs(i - mid))
    return t[:b].rstrip() + '\n' + t[b:].lstrip()


def norm(x):
    return ' '.join(x.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--episode', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--plan', help='defaults to plan.json beside the episode file')
    a = ap.parse_args()

    ep = json.load(open(a.episode, encoding='utf-8'))
    segs = json.load(open(ep['script_timed'], encoding='utf-8'))
    plan_path = a.plan or os.path.join(os.path.dirname(a.episode), 'plan.json')
    subs = json.load(open(plan_path, encoding='utf-8'))['subs']

    # plan subs also carry the still's four labels and a Short's opening stamp; the ones
    # that matter here are those whose text is a narration line, and they are in order.
    placed = {}
    for sub in subs:
        placed.setdefault(norm(sub['text']), []).append(sub)

    out, n, t, guessed = [], 0, 0.0, 0
    for seg in segs:
        if seg.get('beat') and not seg.get('text'):
            continue
        caption = seg.get('sub') or seg['text']
        hit = placed.get(norm(caption))
        if hit:
            sub = hit.pop(0)
            start, dur = float(sub['start']), float(sub['duration'])
        else:                       # drawn nowhere on screen; carry on from the last cue
            start, dur = t, seg['dur'] + 0.15
            guessed += 1
        n += 1
        out.append('%d\n%s --> %s\n%s\n' % (n, ts(start), ts(start + dur), wrap(caption)))
        t = start + dur + GAP

    open(a.out, 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
    note = f', {guessed} timed by carry-forward' if guessed else ''
    print(f'{a.out}  {n} cues, last ends {ts(t - GAP)}{note}')


if __name__ == '__main__':
    main()
