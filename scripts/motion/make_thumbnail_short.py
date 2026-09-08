"""Vertical Short thumbnail (1080x1920) built from the teardown, not from a caption.

    python scripts/motion/make_thumbnail_short.py --bg SHOT.jpg --out thumb_short.jpg \
        --kind number   --value "14 GB"         --unit "ONE DEMO"      --tag "UNREAL 5"
        --kind contrast --value "4,400 PLAYING" --against "0 REVIEWS"  --tag "UNREAL 5"
        --kind file     --value "driver.sys"    --unit "IN A GAME DEMO" --tag "UNREAL 5"

`make_thumbnail.py --vertical` was the 16:9 layout on a 9:16 canvas: one line per string
in the top third, the bottom half empty, the title shrunk by `fit_size`. Unreadable at
feed size, and the picture carried nothing.

What this channel owns is the figure you can only get by opening the depot manifest --
14 GB, 103 videos, a kernel driver, 858 KB of code. A store number like "92% POSITIVE"
is what every review channel already shows. So the thumbnail is a fragment of the
teardown, drawn in the spec card's own language (navy plate, teal value, JetBrains Mono),
and it changes shape with the kind of hook:

  number    one figure at full width with a small caption. Scale is the story.
  contrast  two figures stacked with a rule between them. The gap is the story.
  file      a monospaced filename on a plate, a line lifted out of the manifest.
            Nobody else can show this.

Bands: claim across the top ~30%, the game untouched through the middle, supporting
facts low. The bottom 16% and right 14% stay clear of the Shorts UI.

Teal is the only accent -- the same one the spec card and the badge use, so a Short and
its long-form read as one channel. No second accent colour: that was borrowed from
another channel's grid and it is not ours.
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_thumbnail import TEAL, WHITE, BADGE, font_for, outlined_text  # noqa: E402

W, H = 1080, 1920
SAFE_R, SAFE_B = 0.86, 0.84
MARGIN = 56
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MONO = os.path.join(ROOT, 'assets', 'fonts', 'JetBrainsMono-Bold.ttf')
LABEL = (150, 190, 210, 255)
PLATE = (10, 26, 56)


def fit(txt, size, max_w, mono=False):
    while size > 44:
        f = ImageFont.truetype(MONO, size) if mono else font_for(txt, size)
        if f.getlength(txt) <= max_w:
            break
        size -= 4
    return size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bg', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--kind', default='number', choices=['number', 'contrast', 'file'])
    ap.add_argument('--value', required=True, help='the figure / filename that is the hook')
    ap.add_argument('--against', default='', help='contrast only: the second figure')
    ap.add_argument('--unit', default='', help='small caption under the figure')
    ap.add_argument('--tag', default='', help='engine label, top left')
    ap.add_argument('--facts', nargs='*', default=[], help='0-2 supporting facts, low on the frame')
    ap.add_argument('--badge', default=None)
    ap.add_argument('--focus', default='center', choices=['center', 'left', 'right', 'top', 'bottom'])
    ap.add_argument('--zoom', type=float, default=1.0,
                    help='scale past cover-fit, so a character can fill the frame and the '
                         "game's own UI text falls outside it")
    ap.add_argument('--ox', type=float, default=None, help='horizontal crop position 0..1 (overrides --focus)')
    ap.add_argument('--oy', type=float, default=None, help='vertical crop position 0..1')
    a = ap.parse_args()

    # A 16:9 grab is exactly 1920 tall once it covers a 1080x1920 frame, so without zoom
    # there is no vertical freedom at all and the game's own HUD lands in the type band.
    # --zoom buys that freedom; --ox/--oy then place the character.
    src = Image.open(a.bg).convert('RGB')
    s = max(W / src.width, H / src.height) * max(1.0, a.zoom)
    src = src.resize((int(src.width * s) + 1, int(src.height * s) + 1), Image.LANCZOS)
    fx = {'left': 0.0, 'right': 1.0}.get(a.focus, 0.5) if a.ox is None else a.ox
    fy = {'top': 0.0, 'bottom': 1.0}.get(a.focus, 0.5) if a.oy is None else a.oy
    ox = int((src.width - W) * min(1.0, max(0.0, fx)))
    oy = int((src.height - H) * min(1.0, max(0.0, fy)))
    bg = src.crop((ox, oy, ox + W, oy + H)).convert('RGBA')

    # Scrim only under the claim; the middle of the frame stays bright.
    grad = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(grad)
    for y in range(H):
        f = y / H
        gd.line((0, y, W, y), fill=int(150 * min(1.0, (0.32 - f) / 0.20)) if f < 0.32 else 0)
    dark = Image.new('RGBA', (W, H), (4, 12, 30, 255))
    dark.putalpha(grad.filter(ImageFilter.GaussianBlur(28)))
    bg.alpha_composite(dark)

    usable = int(W * SAFE_R) - MARGIN * 2
    y = 18

    if a.tag:
        t = outlined_text(a.tag + ' TEARDOWN', 38, TEAL, outline=7, shadow=(4, 5), label=True)
        bg.alpha_composite(t, (MARGIN - 30, y))
        y += 76

    if a.kind == 'contrast':
        # outlined_text pads its box, so the glyphs sit well inside it; the rule has to be
        # placed from the drawn box's bottom, not from the advance, or it crosses the text.
        sz = min(fit(a.value, 148, usable), fit(a.against, 148, usable))
        top = outlined_text(a.value, sz, WHITE, outline=17)
        bg.alpha_composite(top, (MARGIN - 32, y))
        # Place the rule under the ink, not under the advance: outlined_text pads its box
        # and the glyph bottom is wherever the alpha ends. Measuring it is the only way
        # the rule cannot land on the text.
        ink = top.split()[3].getbbox()
        rule_y = y + (ink[3] if ink else int(sz * 1.2)) + 26
        ImageDraw.Draw(bg).line((MARGIN, rule_y, MARGIN + 340, rule_y), fill=TEAL, width=8)
        y = rule_y + 22
        bg.alpha_composite(outlined_text(a.against, sz, TEAL, outline=17), (MARGIN - 32, y))
        y += int(sz * 1.20)
    elif a.kind == 'file':
        sz = fit(a.value, 116, usable - 80, mono=True)
        f = ImageFont.truetype(MONO, sz)
        tw, ph = int(f.getlength(a.value)), int(sz * 1.80)
        pl = Image.new('RGBA', (tw + 76, ph), (0, 0, 0, 0))
        ImageDraw.Draw(pl).rounded_rectangle((0, 0, tw + 74, ph - 2), radius=24,
                                             fill=PLATE + (232,), outline=TEAL, width=5)
        ImageDraw.Draw(pl).text((38, int(sz * 0.34)), a.value, font=f, fill=TEAL)
        bg.alpha_composite(pl, (MARGIN, y))
        y += ph + 18
    else:
        sz = fit(a.value, 208, usable)
        bg.alpha_composite(outlined_text(a.value, sz, WHITE, outline=19), (MARGIN - 36, y))
        y += int(sz * 1.14)

    if a.unit:
        bg.alpha_composite(outlined_text(a.unit, 54, LABEL, outline=9, label=True),
                           (MARGIN - 26, y))

    fy = int(H * SAFE_B) - 200 - len(a.facts) * 104
    for fact in a.facts:
        bg.alpha_composite(outlined_text(fact, 76, WHITE, outline=12, label=True), (MARGIN - 24, fy))
        fy += 104

    badge = Image.open(a.badge or BADGE).convert('RGBA')
    bs = 150 / badge.height
    badge = badge.resize((int(badge.width * bs), 150), Image.LANCZOS)
    bg.alpha_composite(badge, (MARGIN - 10, int(H * SAFE_B) - badge.height - 14))

    bg.convert('RGB').save(a.out, quality=90)
    print('saved', a.out, Image.open(a.out).size)


if __name__ == '__main__':
    main()
