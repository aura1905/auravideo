"""An 'evidence' thumbnail: game art plus the actual file list, one row ringed.

    python scripts/motion/make_thumb_evidence.py --bg ss03.jpg --out thumb.jpg \
        --claim "A KERNEL DRIVER" --game "SlashZero" \
        --rows "Zero-Win64-Shipping.exe|234 MB" "libcef.dll|229 MB" \
               "*GPLDriver.sys|1.12 MB" "gmesdk.dll|3.75 MB"

Why this exists. The first six episode thumbnails were the same template every time --
game screenshot, name in white, claim in teal, badge bottom-left -- so six of our videos
in one search page looked like one video repeated, and none of them showed the thing the
channel actually does that a review channel cannot. The evidence cards inside the episodes
are the differentiator and they never reached the thumbnail.

So: real game art, and beside it a panel of real filenames with one row ringed. A viewer
scrolling past sees a file listing, which no other video about that demo has, and the
ringed row says what the video found. Mark the row to ring with a leading '*'.

Rules kept from make_thumbnail.py: text is drawn by us (image models misspell), thick
navy outline plus shadow, series badge bottom-left, no score stamp.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1280, 720
TEAL = (25, 198, 183, 255)
WHITE = (245, 255, 252, 255)
DIM = (150, 180, 200, 255)
PANEL = (9, 20, 44, 232)
RING = (255, 214, 64, 255)          # the one colour used nowhere else, so it means "look here"
ANTON = 'assets/fonts/Anton-Regular.ttf'
MONO = 'assets/fonts/JetBrainsMono-Bold.ttf'
BADGE = 'assets/brand/demo_dip_badge_rgba.png'


def outlined(txt, font, fill, outline=12, shadow=(7, 8), oc=(6, 14, 34, 255)):
    d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    x0, y0, x1, y1 = d.textbbox((0, 0), txt, font=font)
    pad = outline + max(shadow) + 6
    im = Image.new('RGBA', (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    dd = ImageDraw.Draw(im)
    ox, oy = pad - x0, pad - y0
    dd.text((ox + shadow[0], oy + shadow[1]), txt, font=font, fill=(0, 0, 0, 170))
    for a in range(0, 360, 20):
        import math
        dd.text((ox + outline * math.cos(math.radians(a)), oy + outline * math.sin(math.radians(a))),
                txt, font=font, fill=oc)
    dd.text((ox, oy), txt, font=font, fill=fill)
    return im


def fit(txt, path, start, max_w):
    s = start
    while s > 18:
        f = ImageFont.truetype(path, s)
        if ImageDraw.Draw(Image.new('RGBA', (1, 1))).textlength(txt, font=f) <= max_w:
            return f
        s -= 2
    return ImageFont.truetype(path, 18)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bg', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--claim', required=True, help='2-4 words, the thing the video found')
    ap.add_argument('--game', default='')
    ap.add_argument('--rows', nargs='+', required=True,
                    help='"name|size" per row; prefix the one to ring with *')
    ap.add_argument('--focus', default='left', choices=['center', 'left', 'right'],
                    help='which part of the art to keep; the panel covers the right 44%%')
    a = ap.parse_args()

    bg = Image.open(a.bg).convert('RGB')
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1), Image.LANCZOS)
    ox = {'center': (bg.width - W) // 2, 'left': 0, 'right': bg.width - W}[a.focus]
    bg = bg.crop((ox, (bg.height - H) // 2, ox + W, (bg.height - H) // 2 + H)).convert('RGBA')

    # --- the file panel, right 44%, blurred art behind it so the mono text stays readable
    pw = int(W * 0.38)
    px = W - pw
    blur = bg.crop((px, 0, W, H)).filter(ImageFilter.GaussianBlur(9))
    bg.paste(blur, (px, 0))
    panel = Image.new('RGBA', (pw, H), PANEL)
    bg.alpha_composite(panel, (px, 0))
    d = ImageDraw.Draw(bg)
    for gx in range(px, W, 44):
        d.line((gx, 0, gx, H), fill=(255, 255, 255, 10))

    rows = [r for r in a.rows]
    n = len(rows)
    row_h = min(92, int((H - 120) / max(n, 1)))
    # The ringed row is the whole point of the panel, so it is set solid and larger while
    # the others stay dim -- at 246 px the rest only has to read as "a file listing".
    y = (H - row_h * n) // 2
    for r in rows:
        ring = r.startswith('*')
        txt = r[1:] if ring else r
        name, _, size = txt.partition('|')
        pad = 14
        nf = ImageFont.truetype(MONO, int(row_h * (0.42 if ring else 0.30)))
        sf = ImageFont.truetype(MONO, int(row_h * (0.30 if ring else 0.24)))
        while d.textlength(name.strip(), font=nf) > pw - 2 * pad - 26 and nf.size > 12:
            nf = ImageFont.truetype(MONO, nf.size - 1)
        if ring:
            d.rounded_rectangle((px + pad, y + 3, W - pad, y + row_h - 3), 9, fill=RING)
            d.text((px + pad + 14, y + row_h * 0.10), name.strip(), font=nf, fill=(10, 18, 38, 255))
            if size:
                d.text((px + pad + 14, y + row_h * 0.58), size.strip(), font=sf, fill=(28, 44, 78, 255))
        else:
            d.text((px + pad + 14, y + row_h * 0.16), name.strip(), font=nf, fill=TEAL)
            if size:
                d.text((px + pad + 14, y + row_h * 0.58), size.strip(), font=sf, fill=DIM)
        y += row_h

    # --- claim, bottom-left over the art
    usable = px - 84
    cf = fit(a.claim, ANTON, 132, usable)
    cl = outlined(a.claim, cf, WHITE, outline=15)
    cy = H - cl.height - 34
    if a.game:
        gf = fit(a.game, ANTON, 52, usable)
        gl = outlined(a.game, gf, TEAL, outline=8, shadow=(4, 5))
        cy -= int(gl.height * 0.92)
        bg.alpha_composite(gl, (40, cy))
        bg.alpha_composite(cl, (34, cy + int(gl.height * 0.92)))
    else:
        bg.alpha_composite(cl, (34, cy))

    badge = Image.open(BADGE).convert('RGBA')
    bs = 150 / badge.height
    badge = badge.resize((int(badge.width * bs), 150), Image.LANCZOS)
    bg.alpha_composite(badge, (W - badge.width - 26, H - badge.height - 22))

    bg.convert('RGB').save(a.out, quality=90)
    print('saved', a.out)


if __name__ == '__main__':
    main()
