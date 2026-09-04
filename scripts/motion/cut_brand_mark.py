"""Turn a generated brand mark (flat navy background) into a trimmed RGBA cut-out.

    python scripts/motion/cut_brand_mark.py IN.png OUT.png [--thresh 40] [--feather 1]

Uses a **flood fill from the image border**, not a global colour-distance test: the
mark's own outlines are nearly the same dark navy as the background, so a global test
eats them. Only background connected to the edge is removed.
"""
import argparse
from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--thresh', type=int, default=40)
ap.add_argument('--feather', type=float, default=0.8)
ap.add_argument('--pad', type=int, default=24)
a = ap.parse_args()

im = Image.open(a.src).convert('RGB')
KEY = (255, 0, 255)
work = im.copy()
w, h = work.size
seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
for s in seeds:
    if work.getpixel(s) != KEY:
        ImageDraw.floodfill(work, s, KEY, thresh=a.thresh)

mask = Image.new('L', (w, h), 255)
px, mp = work.load(), mask.load()
for y in range(h):
    for x in range(w):
        if px[x, y] == KEY:
            mp[x, y] = 0
if a.feather:
    mask = mask.filter(ImageFilter.GaussianBlur(a.feather))

out = im.convert('RGBA'); out.putalpha(mask)
bbox = mask.point(lambda v: 255 if v > 8 else 0).getbbox()
if bbox:
    l, t, r, b = bbox
    l, t = max(0, l - a.pad), max(0, t - a.pad)
    r, b = min(w, r + a.pad), min(h, b + a.pad)
    out = out.crop((l, t, r, b))
out.save(a.out)
print(a.out, out.size)
