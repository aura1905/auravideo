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

Timings mirror build_plan.py's timeline (cold open from 0, logo sting after
`cold_open_lines`, everything after it shifted by INTRO_LEN + 0.2). Change them here
whenever they change there -- make_desc.py carries the same copy.

Long lines are split into at most two rows at a sentence or clause boundary, because a
caption wider than ~42 characters per row gets cut off on a phone.
"""
import argparse, json, re

GAP = 0.4
INTRO_LEN = 3.4
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--episode', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    ep = json.load(open(a.episode, encoding='utf-8'))
    segs = json.load(open(ep['script_timed'], encoding='utf-8'))
    cold_n = int(ep.get('cold_open_lines', ep.get('hook_lines', 2)))
    still_start = sum(x['dur'] + GAP for x in segs[:cold_n]) + 0.2 + INTRO_LEN

    out, t, n = [], 0.0, 0
    for i, s in enumerate(segs):
        if i == cold_n:
            t = still_start
        # A `beat` is footage with no narration (build_plan.py): it occupies time on the
        # timeline but produces no caption, and carries no trailing GAP.
        if s.get('beat') and not s.get('text'):
            t += float(s['beat'])
            continue
        n += 1
        out.append(f'{n}\n{ts(t)} --> {ts(t + s["dur"] + 0.15)}\n{wrap(s.get("sub") or s["text"])}\n')
        t += s['dur'] + GAP

    open(a.out, 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
    print(f'{a.out}  {n} cues, last ends {ts(t)}')


if __name__ == '__main__':
    main()
