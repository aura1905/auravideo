"""Long-form captions in the Short v2 style: Anton, two to four words at a time, keywords in yellow.

    python scripts/pipeline/long_captions.py episodes/17-inkborn --keywords INKBORN "Godot 4" Tidewrack

Runs AFTER build_plan.py. It takes the narration captions build_plan wrote as bridge
subtitles (the ones without an explicit x/y -- the blueprint labels and stamps keep
theirs), renders each as a sequence of transparent 1920x1080 PNG chunks, and puts those
on track v3 in plan.json. v3 only carries the logo sting's subtitle layer, and the sting
has no narration over it, so the two never overlap.

Why: the Titanic Short (2026-09-13) tested this caption style and the user kept it --
"편집이 시원시원하고 폰트도 강렬하고". A five-minute video of two-line Inter captions reads
like a lecture next to it. Chunk splitting is shared with build_plan_v2.py so a phrase is
broken the same way in both formats.
"""
import argparse, json, os, re, sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_plan_v2 import chunks  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
ANTON = os.path.join(ROOT, 'assets', 'fonts', 'Anton-Regular.ttf')
W, H = 1920, 1080
YELLOW = (255, 214, 0, 255)
WHITE = (255, 255, 255, 255)
BASELINE = 930            # text bottom; keeps the 12% bottom safe area clear of the progress bar
TRACK = 'v3'


def render(path, text, hot):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    size = 108
    while ImageFont.truetype(ANTON, size).getlength(text) > W - 240:
        size -= 4
    f = ImageFont.truetype(ANTON, size)
    x = (W - f.getlength(text)) / 2
    d.text((x, BASELINE - size), text, font=f, fill=YELLOW if hot else WHITE,
           stroke_width=11, stroke_fill=(0, 0, 0, 255))
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('workdir')
    ap.add_argument('--plan', default='plan.json')
    ap.add_argument('--keywords', nargs='*', default=[])
    a = ap.parse_args()
    wd = a.workdir.rstrip('/\\')
    path = os.path.join(wd, a.plan)
    plan = json.load(open(path, encoding='utf-8'))
    if any(c['track'] == TRACK and c['file'].startswith('cap/') for c in plan['clips']):
        plan['clips'] = [c for c in plan['clips'] if not (c['track'] == TRACK and c['file'].startswith('cap/'))]
    os.makedirs(os.path.join(wd, 'cap'), exist_ok=True)
    for f in os.listdir(os.path.join(wd, 'cap')):
        os.remove(os.path.join(wd, 'cap', f))

    kw = [k.lower() for k in a.keywords]
    keep, narr = [], []
    for s in plan['subs']:
        (narr if 'x' not in s else keep).append(s)
    n = 0
    for s in narr:
        text = s['text'].replace('\n', ' ')
        parts = chunks(text, keep=a.keywords, max_chars=30)
        total = sum(len(p) + 2 for p in parts)
        t, dur = s['start'], s['duration'] - 0.15
        for p in parts:
            cd = dur * (len(p) + 2) / total
            hot = any(k in p.lower() for k in kw) or bool(re.search(r'\d', p))
            name = f'cap/c{n:03d}.png'
            render(os.path.join(wd, name), p.upper(), hot)
            plan['clips'].append({'track': TRACK, 'file': name, 'start': round(t, 3), 'in': 0,
                                  'out': round(cd - 0.01, 3), 'fillMode': 'fit', 'muted': True})
            t += cd; n += 1
    plan['subs'] = keep
    json.dump(plan, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(narr)} narration captions -> {n} chunks on {TRACK}; {len(keep)} positioned subtitles kept')


if __name__ == '__main__':
    main()
