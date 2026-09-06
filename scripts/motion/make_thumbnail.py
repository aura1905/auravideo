"""YouTube thumbnail for the Demo Dip series (1280x720, < 2 MB; --vertical for 1080x1920).

Shorts: **thumbnails.set does accept a custom 9:16 image on a Short** (verified
2026-09-05 on two Shorts once the channel's thumbnail rate limit cleared). The same
words are also baked into the Short's first second by build_plan's `opening_stamp`,
so the first frame reads as a thumbnail wherever YouTube shows a frame instead.

Rate limit: after many re-uploads in a day, thumbnails.set returns 429 "uploaded too
many thumbnails recently" for hours. youtube_upload.py treats that as non-fatal; retry
later with the API rather than re-uploading the video.

    python scripts/motion/make_thumbnail.py --bg ss00.jpg --out thumb.jpg         --line1 "Pocket Cultivation" --line2 "1 DEV. 4 MONTHS." --tag "SOLO DEV / AI ART"

Composition rules (house style): real game art as background, never a dark card; text
drawn by us with a thick navy outline + heavy shadow (image models misspell text); the
series badge bottom-left. **No score stamp** -- the user's rule, and since the
spec-sheet card replaced the score card there is no number left to stamp.

`line1` is the game's name and stays the headline (user's rule); `line2` is the claim
that earns the click and should be four words or fewer.

Fonts are chosen per string: Anton for Latin (the English channel's display face),
Malgun Gothic Bold when the text contains Hangul or CJK, because Anton has no such
glyphs and the Korean episodes 01-03 still render through this script.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1280, 720
TEAL = (25, 198, 183, 255); WHITE = (245, 255, 252, 255); NAVY = (8, 20, 48, 255)
ANTON = 'assets/fonts/Anton-Regular.ttf'
INTER = 'assets/fonts/Inter.ttf'
CJK = 'C:/Windows/Fonts/malgunbd.ttf'
BADGE = 'assets/brand/demo_dip_badge_rgba.png'   # --badge overrides (한국어 편은 데모 찍먹 배지)


def font_for(txt, size, label=False):
    """Anton for Latin display text; Malgun Gothic when the string has Hangul/CJK."""
    if any(ord(c) > 0x2E80 for c in txt):
        return ImageFont.truetype(CJK, size)
    if label:
        f = ImageFont.truetype(INTER, size); f.set_variation_by_name('Black'); return f
    return ImageFont.truetype(ANTON, size)


def fit_size(txt, size, max_w, label=False):
    """Shrink until the line fits the usable width — episode titles vary a lot in length."""
    while size > 40 and font_for(txt, size, label).getlength(txt) > max_w:
        size -= 4
    return size


def outlined_text(txt, size, fill, outline=10, shadow=(8, 10), label=False):
    f = font_for(txt, size, label)
    tw, th = int(f.getlength(txt)), int(size * 1.25)
    pad = outline + 30
    base = Image.new('RGBA', (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(base).text((pad, pad), txt, font=f, fill=fill)
    a = base.split()[3]
    dil = a.filter(ImageFilter.MaxFilter(outline * 2 + 1)).filter(ImageFilter.GaussianBlur(0.8))
    ol = Image.new('RGBA', base.size, NAVY); ol.putalpha(dil)
    sh = Image.new('RGBA', base.size, (0, 0, 0, 255)); sh.putalpha(dil.point(lambda v: int(v * 0.85)))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(sh, shadow); out.alpha_composite(ol); out.alpha_composite(base)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bg', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--line1', required=True); ap.add_argument('--line2', default='')
    ap.add_argument('--tag', default='')
    ap.add_argument('--badge', help='series badge PNG; defaults to the English one')
    ap.add_argument('--focus', default='center', choices=['center', 'left', 'right'])
    ap.add_argument('--text-side', default='left', choices=['left', 'right'])
    ap.add_argument('--title-size', type=int, default=150); ap.add_argument('--hook-size', type=int, default=92)
    ap.add_argument('--vertical', action='store_true', help='1080x1920 for a Short')
    ap.add_argument('--claim-first', action='store_true',
                    help='swap the hierarchy: the claim (line2) becomes the headline and the '
                         'game name shrinks above it. For an unknown demo the name earns no '
                         'click, so it should not be the largest thing on the image.')
    a = ap.parse_args()
    global W, H
    if a.vertical:
        W, H = 1080, 1920

    bg = Image.open(a.bg).convert('RGB')
    s = max(W / bg.width, H / bg.height); bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1), Image.LANCZOS)
    ox = {'center': (bg.width - W) // 2, 'left': 0, 'right': bg.width - W}[a.focus]
    bg = bg.crop((ox, (bg.height - H) // 2, ox + W, (bg.height - H) // 2 + H)).convert('RGBA')
    # gentle vignette on the text side only, so the art stays bright
    grad = Image.new('L', (W, H), 0); gd = ImageDraw.Draw(grad)
    if a.vertical:
        # darken the band the text sits in (upper-middle), leave the bottom for the art
        for yy in range(H):
            f = 1 - abs((yy / H) - 0.36) / 0.36
            gd.line((0, yy, W, yy), fill=int(max(0, f - 0.15) / 0.85 * 150))
    else:
        for x in range(W):
            f = (1 - x / W) if a.text_side == 'left' else x / W
            gd.line((x, 0, x, H), fill=int(max(0, f - 0.35) / 0.65 * 140))
    dark = Image.new('RGBA', (W, H), (4, 10, 28, 255)); dark.putalpha(grad); bg.alpha_composite(dark)

    x0 = 40 if a.text_side == 'left' else None
    # Shorts UI covers the right ~14% and bottom ~16%; start the text block at 22% down
    y = int(H * 0.22) if a.vertical else 60
    usable = W - 80 - (int(W * 0.14) if a.vertical else 0)

    def put(img, yy):
        bg.alpha_composite(img, (x0 if x0 is not None else W - img.width - 40, yy))

    if a.claim_first:
        # Claim big and white, name small above it, no engine tag. Measured against the
        # first six episodes: at a real 246 px thumbnail the game's name was the largest
        # element and the least legible reason to click, while the number that earns the
        # click sat half-size in teal over busy art. Two blocks, one of them dominant.
        if a.line1:
            n = outlined_text(a.line1, fit_size(a.line1, 54, usable), TEAL, outline=8, shadow=(5, 6))
            put(n, y); y += int(n.height * 0.98)
        if a.line2:
            c = outlined_text(a.line2, fit_size(a.line2, a.title_size, usable), WHITE, outline=16)
            put(c, y)
    else:
        if a.tag:
            t = outlined_text(a.tag, 34, TEAL, outline=6, shadow=(4, 5), label=True)
            put(t, y); y += 78
        l1 = outlined_text(a.line1, fit_size(a.line1, a.title_size, usable), WHITE, outline=14)
        put(l1, y); y += int(l1.height * 0.86)
        if a.line2:
            l2 = outlined_text(a.line2, fit_size(a.line2, a.hook_size, usable - 180), TEAL, outline=12)  # keep the hook narrower than the title
            put(l2, y)
    badge = Image.open(a.badge or BADGE).convert('RGBA'); bs = 190 / badge.height
    badge = badge.resize((int(badge.width * bs), 190), Image.LANCZOS)
    bg.alpha_composite(badge, (36, H - badge.height - (int(H * 0.16) + 30 if a.vertical else 30)))
    bg.convert('RGB').save(a.out, quality=90)
    print('saved', a.out)


if __name__ == '__main__':
    main()
