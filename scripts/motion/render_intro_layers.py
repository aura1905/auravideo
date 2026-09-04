"""Render the series logo as three independently animated alpha layers.

    python scripts/motion/render_intro_layers.py [LOGO.png] [--width 1920] [--height 1080]
                                                 [--logo-height 600] [--title-frac 0.465]

Writes lf_mark/, lf_title/, lf_sub/ PNG sequences in the CWD (wrap them with
ffmpeg -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le).

The logo PNG is split into three horizontal bands (mark / title / subtitle) by
scanning its alpha for empty rows, so each element can move on its own — see
docs/MOTION.md for why. Layout is computed from the canvas, so the same script
serves the 16:9 episode and the 9:16 Short.
"""
from PIL import Image, ImageFilter
import numpy as np, os, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {}
for i, a in enumerate(sys.argv[1:]):
    if a.startswith('--'):
        opt[a[2:]] = sys.argv[i + 2]
LOGO = args[0] if args else 'assets/brand/demo_dip_logo_rgba.png'
W = int(opt.get('width', 1920)); H = int(opt.get('height', 1080))
LOGO_H = int(opt.get('logo-height', 600 if W >= H else 620))
TITLE_FRAC = float(opt.get('title-frac', 0.465 if W >= H else 0.42))
FPS, DUR = 30, 3.4
N = int(DUR * FPS)

logo = Image.open(LOGO).convert('RGBA')
a = np.asarray(logo)[:, :, 3]; rows = (a > 20).sum(1)
bands = []; start = None
for i, r in enumerate(rows):
    if r > 0 and start is None: start = i
    if r == 0 and start is not None: bands.append((start, i)); start = None
if start is not None: bands.append((start, len(rows)))
bands = [b for b in bands if b[1] - b[0] > 15]
if len(bands) == 2:
    # Some logo renders leave no empty row between the wordmark and the subtitle.
    # Split the lower band at its thinnest row (the natural gap) instead of failing.
    lo, hi = bands[1]
    mid = lo + (hi - lo) // 2
    win = rows[lo + 10:hi - 10]
    if len(win):
        cut = lo + 10 + int(np.argmin(win))
        if lo + 20 < cut < hi - 20:
            mid = cut
    bands = [bands[0], (lo, mid), (mid, hi)]
assert len(bands) == 3, bands
mark, title, sub = bands
print('bands mark', mark, 'title', title, 'sub', sub)


def crop(b): return logo.crop((0, b[0], logo.width, b[1]))


layers = {'mark': crop(mark), 'title': crop(title), 'sub': crop(sub)}
SCALE = LOGO_H / logo.height
# A tall canvas is narrower: keep the logo inside the frame with a margin.
SCALE = min(SCALE, (W * 0.86) / logo.width)


def shadow(im, outline=12, out_col=(8, 20, 48, 255)):
    """Thick navy outline (dilated alpha) plus a heavy drop shadow — house style."""
    pad = outline + 34
    base = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    base.alpha_composite(im, (pad, pad))
    al = base.split()[3]
    dil = al.filter(ImageFilter.MaxFilter(outline * 2 + 1)).filter(ImageFilter.GaussianBlur(0.8))
    ol = Image.new('RGBA', base.size, out_col); ol.putalpha(dil)
    sh = Image.new('RGBA', base.size, (0, 0, 0, 255)); sh.putalpha(dil.point(lambda v: int(v * 0.9)))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (10, 14)); out.alpha_composite(ol); out.alpha_composite(base)
    return out


L = {k: shadow(v.resize((max(1, int(v.width * SCALE)), max(1, int(v.height * SCALE))), Image.LANCZOS))
     for k, v in layers.items()}
# Place so the TITLE band's centre lands at TITLE_FRAC of the canvas height —
# the user's rule is that the words, not the whole lockup, read as centred.
title_mid = ((title[0] + title[1]) / 2 - mark[0]) * SCALE
cy0 = int(H * TITLE_FRAC - title_mid)
ys = {'mark': cy0,
      'title': cy0 + int((title[0] - mark[0]) * SCALE),
      'sub': cy0 + int((sub[0] - mark[0]) * SCALE)}
SLIDE = int(W * 0.26)      # title slide-in distance, proportional to the canvas
DROP = int(H * 0.30)       # mark drop distance


def eob(t, s=1.5): t -= 1; return 1 + t * t * ((s + 1) * t + s)
def eio(t): return t * t * (3 - 2 * t)
def clamp(x): return max(0, min(1, x))


def anim(k, t):
    im = L[k]; x = (W - im.width) // 2; y = ys[k]; al = 1; rot = 0
    if k == 'mark':
        p = clamp(t / 0.7); y = y - DROP * (1 - eob(p)); al = clamp(t / 0.2); rot = -14 * (1 - p)
        if t > 2.7: q = clamp((t - 2.7) / 0.5); y -= DROP * 0.38 * eio(q); al = 1 - q
    elif k == 'title':
        p = clamp((t - 0.35) / 0.6); x = x - SLIDE * (1 - eob(p)); al = clamp((t - 0.35) / 0.25)
        if t > 2.8: q = clamp((t - 2.8) / 0.45); x += SLIDE * 0.8 * eio(q); al = 1 - q
    else:
        p = clamp((t - 0.85) / 0.5); y = y + 60 * (1 - eio(p)); al = clamp((t - 0.85) / 0.4)
        if t > 2.75: q = clamp((t - 2.75) / 0.4); al = 1 - q
    return im, int(x), int(y), al, rot


for k in L:
    os.makedirs(f'lf_{k}', exist_ok=True)
    for i in range(N):
        t = i / FPS; im, x, y, al, rot = anim(k, t)
        if rot: im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
        if al < 1:
            im = im.copy(); im.putalpha(im.split()[3].point(lambda v: int(v * al)))
        fr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        fr.alpha_composite(im, (x, y))
        fr.save(f'lf_{k}/f{i:03d}.png')
print(f'canvas {W}x{H}, frames {N}')
