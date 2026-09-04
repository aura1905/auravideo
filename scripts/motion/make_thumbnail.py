"""YouTube thumbnail for the Demo Dip series (1280x720, < 2 MB).

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
BADGE = 'assets/brand/demo_dip_badge_rgba.png'


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
    ap.add_argument('--focus', default='center', choices=['center', 'left', 'right'])
    ap.add_argument('--text-side', default='left', choices=['left', 'right'])
    ap.add_argument('--title-size', type=int, default=150); ap.add_argument('--hook-size', type=int, default=92)
    a = ap.parse_args()

    bg = Image.open(a.bg).convert('RGB')
    s = max(W / bg.width, H / bg.height); bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1), Image.LANCZOS)
    ox = {'center': (bg.width - W) // 2, 'left': 0, 'right': bg.width - W}[a.focus]
    bg = bg.crop((ox, (bg.height - H) // 2, ox + W, (bg.height - H) // 2 + H)).convert('RGBA')
    # gentle vignette on the text side only, so the art stays bright
    grad = Image.new('L', (W, H), 0); gd = ImageDraw.Draw(grad)
    for x in range(W):
        f = (1 - x / W) if a.text_side == 'left' else x / W
        gd.line((x, 0, x, H), fill=int(max(0, f - 0.35) / 0.65 * 140))
    dark = Image.new('RGBA', (W, H), (4, 10, 28, 255)); dark.putalpha(grad); bg.alpha_composite(dark)

    x0 = 40 if a.text_side == 'left' else None
    y = 60
    if a.tag:
        t = outlined_text(a.tag, 34, TEAL, outline=6, shadow=(4, 5), label=True)
        bg.alpha_composite(t, (x0 if x0 is not None else W - t.width - 40, y)); y += 78
    usable = W - 80
    l1 = outlined_text(a.line1, fit_size(a.line1, a.title_size, usable), WHITE, outline=14)
    bg.alpha_composite(l1, (x0 if x0 is not None else W - l1.width - 40, y)); y += int(l1.height * 0.86)
    if a.line2:
        l2 = outlined_text(a.line2, fit_size(a.line2, a.hook_size, usable - 180), TEAL, outline=12)  # keep the hook narrower than the title
        bg.alpha_composite(l2, (x0 if x0 is not None else W - l2.width - 40, y))
    badge = Image.open(BADGE).convert('RGBA'); bs = 190 / badge.height
    badge = badge.resize((int(badge.width * bs), 190), Image.LANCZOS)
    bg.alpha_composite(badge, (36, H - badge.height - 30))
    bg.convert('RGB').save(a.out, quality=90)
    print('saved', a.out)


if __name__ == '__main__':
    main()
