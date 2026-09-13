"""Short layout v2 (trial, s22-titanic, 2026-09-13): headline band + media band + chunked captions.

    python scripts/pipeline/build_plan_v2.py episodes/s22-titanic/v2 \
        --headline "FREE STEAM DEMO" "TITANIC TYCOON" --keywords "White Star Line" "mannequins" ...

Modelled on a 248K-view Korean Short (docs: memory feedback-shorts-voice-and-info):
  - a headline that stays on screen for the whole video, on a black band at the top,
  - the footage in a near-square band across the middle (16:9 zoomed, sides cropped),
  - captions two to four words at a time, just under the footage, keywords in yellow,
  - short gaps between lines, no spec card, a quick sign-off.

Captions are rendered here as PNG overlays rather than bridge subtitles, so the font
(Anton), the colour per chunk and the timing per chunk are all under our control.
Chunk timing is proportional to characters inside each TTS line -- there are no word
timestamps -- which holds up because the narration is one steady TTS voice.
Reads <dir>/short_tts_timed.json, writes <dir>/plan.json and <dir>/cap/*.png.
"""
import argparse, json, os, re

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ANTON = os.path.join(ROOT, 'assets', 'fonts', 'Anton-Regular.ttf')
YELLOW = (255, 214, 0, 255)
WHITE = (255, 255, 255, 255)
BAND_H = 1010                 # media band height; 16:9 at this height is 1796 wide
CAP_Y = 960 + BAND_H // 2 + 40
GAP = 0.15


def outlined(draw, xy, text, font, fill, stroke=10):
    draw.text(xy, text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0, 255))


def headline_png(path, l1, l2):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(ANTON, 78)
    size = 150
    while ImageFont.truetype(ANTON, size).getlength(l2) > W - 90:
        size -= 6
    f2 = ImageFont.truetype(ANTON, size)
    y2 = 455 - 30 - size
    outlined(d, ((W - f1.getlength(l1)) / 2, y2 - 96), l1, f1, WHITE, 8)
    outlined(d, ((W - f2.getlength(l2)) / 2, y2), l2, f2, YELLOW, 12)
    im.save(path)


def chunks(text, keep=(), max_chars=22):
    """Clause first (split at punctuation), then balanced pieces of <= max_chars.
    Phrases in `keep` (names, keywords) are never split across two chunks."""
    out = []
    for clause in re.split(r'(?<=[.,?!:;])\s+', text.strip()):
        toks = clause.split()
        # glue keep-phrases into single tokens
        for k in sorted(keep, key=len, reverse=True):
            kw = k.split()
            if len(kw) < 2:
                continue
            i = 0
            while i <= len(toks) - len(kw):
                if [t.strip('.,?!:;').lower() for t in toks[i:i + len(kw)]] == [x.lower() for x in kw]:
                    toks[i:i + len(kw)] = [' '.join(toks[i:i + len(kw)])]
                i += 1
        n = max(1, -(-len(clause) // max_chars))          # pieces needed
        target = len(clause) / n
        cur = []
        for t in toks:
            if cur and len(' '.join(cur + [t])) > target + 4 and len(out) < 999:
                out.append(' '.join(cur)); cur = []
            cur.append(t)
        if cur:
            out.append(' '.join(cur))
    # a lone short word joins its neighbour when the pair still fits
    i = 0
    while i < len(out):
        if len(out[i].split()) == 1 and len(out[i]) <= 10 and len(out) > 1:
            j = i - 1 if i > 0 and not re.search(r'[.?!]$', out[i - 1]) else i + 1
            if 0 <= j < len(out) and len(out[i]) + len(out[j]) + 1 <= max_chars + 5:
                out[min(i, j)] = out[min(i, j)] + ' ' + out[max(i, j)]
                del out[max(i, j)]
                continue
        i += 1
    return out


def caption_png(path, text, hot):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    size = 96
    while ImageFont.truetype(ANTON, size).getlength(text) > W - 80:
        size -= 4
    f = ImageFont.truetype(ANTON, size)
    outlined(d, ((W - f.getlength(text)) / 2, CAP_Y), text, f, YELLOW if hot else WHITE, 11)
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir')
    ap.add_argument('--headline', nargs=2, required=True)
    ap.add_argument('--keywords', nargs='*', default=[])
    ap.add_argument('--bgm', default='t0.mp4')
    ap.add_argument('--bgm-volume', type=float, default=0.06)
    ap.add_argument('--media-zoom', type=float, default=1.0, help='extra zoom for letterboxed trailers')
    a = ap.parse_args()
    D = a.dir.replace('\\', '/').rstrip('/')
    ep = os.path.dirname(D)
    rel = os.path.abspath(ep).replace('\\', '/')     # media one level up; the bridge refuses ../ paths
    lines = json.load(open(f'{D}/short_tts_timed.json', encoding='utf-8'))
    os.makedirs(f'{D}/cap', exist_ok=True)
    headline_png(f'{D}/headline.png', *a.headline)

    clips, t = [], 0.0
    vis_runs = []            # [start, file, in, type]
    kw = [k.lower() for k in a.keywords]
    n_cap = 0
    for ln in lines:
        dur = float(ln['dur'])
        wav = os.path.relpath(ln['wav'], D).replace('\\', '/') if os.path.isabs(ln['wav']) else \
            os.path.relpath(os.path.join(ROOT, ln['wav']), os.path.join(ROOT, D)).replace('\\', '/')
        clips.append({'track': 'a1', 'file': wav, 'start': round(t, 3), 'in': 0, 'out': dur, 'volume': 1.6})
        v = ln['vis']
        if v['type'] != 'continue':
            vis_runs.append([t, v['file'], float(v.get('in', 0)), v['type']])
        text = ln.get('sub') or ln['text']
        parts = chunks(text, keep=a.keywords)
        total_chars = sum(len(p) + 2 for p in parts)
        ct = t
        for p in parts:
            cd = dur * (len(p) + 2) / total_chars
            hot = any(k in p.lower() for k in kw) or bool(re.search(r'\d', p))
            name = f'cap/c{n_cap:03d}.png'
            caption_png(f'{D}/{name}', p, hot)
            clips.append({'track': 'v2', 'file': name, 'start': round(ct, 3), 'in': 0, 'out': round(cd - 0.01, 3),
                          'fillMode': 'fit', 'muted': True})
            ct += cd; n_cap += 1
        t += dur + GAP
    total = round(t - GAP + 0.5, 3)

    for i, (st, f, fin, typ) in enumerate(vis_runs):
        end = vis_runs[i + 1][0] if i + 1 < len(vis_runs) else total
        src = f'{rel}/{f}' if not f.startswith('ev_') else f
        c = {'track': 'v4', 'file': src, 'start': round(st, 3), 'in': fin if typ == 'video' else 0,
             'out': round((fin if typ == 'video' else 0) + end - st, 3), 'muted': True, 'fadeIn': 0.12, 'fadeOut': 0.12,
             # cover at BAND_H/1920 puts a 16:9 frame exactly BAND_H tall; --media-zoom makes up for
             # trailers that carry their own letterbox (Titanic's is 2.58:1 inside 16:9)
             'fillMode': 'cover' if typ == 'video' else 'fit',
             'transformScale': round(BAND_H / 1920 * a.media_zoom if typ == 'video' else 1.0, 4)}
        clips.append(c)

    clips.append({'track': 'v1', 'file': 'headline.png', 'start': 0.0, 'in': 0, 'out': total, 'fillMode': 'fit', 'muted': True})
    clips.append({'track': 'a2', 'file': f'{rel}/{a.bgm}', 'start': 0.0, 'in': 0, 'out': total,
                  'volume': a.bgm_volume, 'fadeIn': 0.6, 'fadeOut': 1.0})
    plan = {'settings': {'width': W, 'height': H, 'fps': 30}, 'clips': clips, 'subs': [],
            'tracks_extra': [{'kind': 'video', 'name': 'MEDIA'}], 'total': total}
    json.dump(plan, open(f'{D}/plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'plan: {len(clips)} clips, {n_cap} caption chunks, total {total}')


if __name__ == '__main__':
    main()
