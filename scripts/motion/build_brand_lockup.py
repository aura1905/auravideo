"""Compose the Demo Dip vertical logo and the round channel badge from the mark cut-out.

    python scripts/motion/build_brand_lockup.py [--mark assets/brand/demo_dip_mark_rgba.png]

Writes three assets: demo_dip_logo_rgba.png (vertical lockup, transparent, for the
intro), demo_dip_badge_rgba.png (round disc WITH the wordmark, for the thumbnail
corner) and demo_dip_avatar_rgba.png (round disc, mark only, for the channel
picture -- the wordmark is illegible below ~96 px).

Wordmark text is drawn here rather than generated with the mark: the image model
renders text unreliably (it dropped the "?" from the tagline in the first badge).

The logo is left as **flat fills with no baked outline** on purpose --
render_intro_layers.py dilates each band's alpha for the house outline + shadow, and
a baked outline would be doubled. It also splits the file into mark / title /
subtitle by scanning for fully empty alpha rows, so the two gaps below must stay
clear of any pixel.
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

TEAL = (46, 196, 182, 255)
CREAM = (247, 243, 232, 255)
NAVY = (13, 27, 58, 255)
OUTLINE = (8, 20, 48, 255)
TITLE = 'DEMO DIP'
TAG = "How’d they make this?"  # typographic apostrophe, not '
ANTON = 'assets/fonts/Anton-Regular.ttf'
INTER = 'assets/fonts/Inter.ttf'

ap = argparse.ArgumentParser()
ap.add_argument('--mark', default='assets/brand/demo_dip_mark_rgba.png')
ap.add_argument('--logo-out', default='assets/brand/demo_dip_logo_rgba.png')
ap.add_argument('--badge-out', default='assets/brand/demo_dip_badge_rgba.png')
ap.add_argument('--avatar-out', default='assets/brand/demo_dip_avatar_rgba.png')
a = ap.parse_args()

mark = Image.open(a.mark).convert('RGBA')


def inter(size, weight='Bold'):
    f = ImageFont.truetype(INTER, size)
    f.set_variation_by_name(weight)
    return f


def text_layer(txt, font, fill):
    """Tightly cropped RGBA of one text run, so vertical gaps are exact."""
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    l, t, r, b = probe.textbbox((0, 0), txt, font=font)
    pad = 8
    im = Image.new('RGBA', (r - l + pad * 2, b - t + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad - l, pad - t), txt, font=font, fill=fill)
    return im.crop(im.split()[3].getbbox())


def outlined(im, px, col=OUTLINE):
    pad = px + 2
    base = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    base.alpha_composite(im, (pad, pad))
    dil = base.split()[3].filter(ImageFilter.MaxFilter(px * 2 + 1))
    out = Image.new('RGBA', base.size, col); out.putalpha(dil)
    out.alpha_composite(base)
    return out


# ---- vertical lockup -------------------------------------------------------
MARK_W = 760
m = mark.resize((MARK_W, round(mark.height * MARK_W / mark.width)), Image.LANCZOS)
title = text_layer(TITLE, ImageFont.truetype(ANTON, 250), TEAL)
tag = text_layer(TAG, inter(96, 'Bold'), CREAM)
GAP1, GAP2 = 46, 34   # fully transparent rows -- the band splitter needs these
W = max(m.width, title.width, tag.width) + 40
H = m.height + GAP1 + title.height + GAP2 + tag.height
logo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
y = 0
for im in (m, None, title, None, tag):
    if im is None:
        continue
for im, gap in ((m, GAP1), (title, GAP2), (tag, 0)):
    logo.alpha_composite(im, ((W - im.width) // 2, y))
    y += im.height + gap
logo.save(a.logo_out)

# verify the two gaps really are empty, since the intro splitter depends on it
import numpy as np
rows = (np.asarray(logo)[:, :, 3] > 20).sum(1)
bands, start = [], None
for i, r in enumerate(rows):
    if r > 0 and start is None: start = i
    if r == 0 and start is not None: bands.append((start, i)); start = None
if start is not None: bands.append((start, len(rows)))
bands = [b for b in bands if b[1] - b[0] > 15]
print(a.logo_out, logo.size, 'bands', bands)
assert len(bands) == 3, f'logo must split into 3 bands, got {bands}'

# ---- round badge -----------------------------------------------------------
S = 800
badge = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(badge)
d.ellipse((0, 0, S - 1, S - 1), fill=NAVY)
d.ellipse((26, 26, S - 27, S - 27), outline=TEAL, width=14)
bm_w = int(S * 0.62)
bm = mark.resize((bm_w, round(mark.height * bm_w / mark.width)), Image.LANCZOS)
badge.alpha_composite(bm, ((S - bm.width) // 2, int(S * 0.20)))
bt = outlined(text_layer(TITLE, ImageFont.truetype(ANTON, 118), CREAM), 7)
badge.alpha_composite(bt, ((S - bt.width) // 2, int(S * 0.66)))
badge.save(a.badge_out)
print(a.badge_out, badge.size)

# ---- round avatar ----------------------------------------------------------
# The channel picture is shown at 48 px next to comments, where a wordmark turns to
# mush (measured: 'DEMO DIP' is illegible below ~96 px). So the avatar is the mark
# alone at ~78% of the disc; the lettered badge stays for thumbnail use.
av = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(av)
d.ellipse((0, 0, S - 1, S - 1), fill=NAVY)
d.ellipse((22, 22, S - 23, S - 23), outline=TEAL, width=18)
am_w = int(S * 0.78)
am = mark.resize((am_w, round(mark.height * am_w / mark.width)), Image.LANCZOS)
av.alpha_composite(am, ((S - am.width) // 2, (S - am.height) // 2 + int(S * 0.02)))
av.save(a.avatar_out)
print(a.avatar_out, av.size)
