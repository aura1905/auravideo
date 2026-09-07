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
BLOOD = (222, 34, 38, 255)   # the accent run; see rich_text()
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


def split_accent(txt):
    """`"COMPARTMENT {666}"` -> [("COMPARTMENT ", False), ("666", True)].

    One word usually carries the whole thumbnail -- a number, a file name, the thing
    the episode is about -- and drawing the line at one size makes that word disappear
    into the sentence around it. Braces mark the run that should be bigger and hot.
    """
    parts, buf, acc = [], '', False
    for ch in txt:
        if ch == '{' and not acc:
            if buf: parts.append((buf, False))
            buf, acc = '', True
        elif ch == '}' and acc:
            if buf: parts.append((buf, True))
            buf, acc = '', False
        else:
            buf += ch
    if buf: parts.append((buf, acc))
    return parts or [(txt, False)]


def rich_measure(parts, size, scale):
    """Width of the whole run set, and the ascent/descent it needs, at this base size."""
    w = asc = desc = 0
    for txt, hot in parts:
        f = font_for(txt, int(size * scale) if hot else size)
        w += f.getlength(txt)
        a, d = f.getmetrics()
        asc = max(asc, a); desc = max(desc, d)
    return w, asc, desc


def fit_rich(parts, size, max_w, scale):
    while size > 40 and rich_measure(parts, size, scale)[0] > max_w:
        size -= 4
    return size


def rich_text(parts, size, fill, outline=10, shadow=(8, 10), scale=1.42, hot=BLOOD):
    """`outlined_text` for a line whose runs differ in size and colour.

    The runs are painted into ONE bitmap and the outline is dilated from that bitmap's
    combined alpha, so the navy edge wraps the line as a single shape. Dilating each run
    on its own leaves a seam of doubled outline where two runs meet, which at a real
    246 px thumbnail reads as a smudge.

    Runs sit on a shared baseline, not a shared top edge: the accent is ~40% taller, and
    top-aligning it makes the sentence look like it slipped a line.
    """
    tw, asc, desc = rich_measure(parts, size, scale)
    pad = outline + 30
    base = Image.new('RGBA', (int(tw) + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    x = pad
    for txt, is_hot in parts:
        f = font_for(txt, int(size * scale) if is_hot else size)
        d.text((x, pad + asc - f.getmetrics()[0]), txt, font=f, fill=hot if is_hot else fill)
        x += f.getlength(txt)
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
    ap.add_argument('--zoom', type=float, default=1.0,
                    help='scale past cover-fit before cropping, so a face can fill the frame. '
                         'A 16:9 source into a 16:9 canvas crops nothing at zoom 1 -- --focus '
                         'has no effect there and this is the only way in.')
    ap.add_argument('--ox', type=float, help='crop window position 0..1 across (overrides --focus)')
    ap.add_argument('--oy', type=float, default=0.5, help='crop window position 0..1 down')
    ap.add_argument('--text-y', type=float,
                    help='where the text block starts, 0..1 down the frame. Defaults to 0.22 '
                         'vertical / 60 px wide. A 9:16 crop of a 16:9 screenshot cannot move '
                         'the subject below the middle -- the crop cannot start above the '
                         'source -- so when the face sits high the text is what moves.')
    ap.add_argument('--accent-scale', type=float, default=1.42,
                    help='how much bigger a {braced} run is drawn than the rest of its line')
    ap.add_argument('--text-side', default='left', choices=['left', 'right'])
    ap.add_argument('--title-size', type=int, default=150); ap.add_argument('--hook-size', type=int, default=92)
    ap.add_argument('--vertical', action='store_true', help='1080x1920 for a Short')
    ap.add_argument('--analysed', action='store_true',
                    help='overlay a thin instrument frame: cyan corner brackets, edge ticks and '
                         'an optional marker ring. It says "this was measured" while covering '
                         'almost none of the screenshot -- the game has to stay intact.')
    ap.add_argument('--mark', default='', metavar='X,Y',
                    help='0-1 coordinates for the marker ring, e.g. 0.72,0.42')
    ap.add_argument('--claim-first', action='store_true',
                    help='swap the hierarchy: the claim (line2) becomes the headline and the '
                         'game name shrinks above it. For an unknown demo the name earns no '
                         'click, so it should not be the largest thing on the image.')
    a = ap.parse_args()
    global W, H
    if a.vertical:
        W, H = 1080, 1920

    bg = Image.open(a.bg).convert('RGB')
    s = max(W / bg.width, H / bg.height) * a.zoom
    bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1), Image.LANCZOS)
    if a.ox is not None:
        ox = int(max(0, bg.width - W) * min(1.0, max(0.0, a.ox)))
    else:
        ox = {'center': (bg.width - W) // 2, 'left': 0, 'right': bg.width - W}[a.focus]
    oy = int(max(0, bg.height - H) * min(1.0, max(0.0, a.oy)))
    bg = bg.crop((ox, oy, ox + W, oy + H)).convert('RGBA')
    # gentle vignette on the text side only, so the art stays bright
    grad = Image.new('L', (W, H), 0); gd = ImageDraw.Draw(grad)
    if a.vertical:
        # darken the band the text sits in, leave the rest for the art
        band = (a.text_y + 0.14) if a.text_y is not None else 0.36
        for yy in range(H):
            f = 1 - abs((yy / H) - band) / 0.36
            gd.line((0, yy, W, yy), fill=int(max(0, f - 0.15) / 0.85 * 150))
    else:
        for x in range(W):
            f = (1 - x / W) if a.text_side == 'left' else x / W
            gd.line((x, 0, x, H), fill=int(max(0, f - 0.35) / 0.65 * 140))
    dark = Image.new('RGBA', (W, H), (4, 10, 28, 255)); dark.putalpha(grad); bg.alpha_composite(dark)

    # --- instrument mark. The game screenshot comes first and must not be damaged, so
    # this is ONE bold gesture, not a frame of thin chrome: a bright ring on the thing the
    # episode found, with a leader line running toward the caption. A first pass drew
    # corner brackets and ruler ticks at 3 px; at a real 246 px thumbnail they vanished
    # entirely, so the rule is one mark, thick enough to survive the downscale.
    if a.analysed and a.mark:
        try:
            mx, my = (float(v) for v in a.mark.split(','))
        except ValueError:
            mx = my = None
        if mx is not None:
            ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            od = ImageDraw.Draw(ov)
            cx, cy = int(W * mx), int(H * my)
            r = int(min(W, H) * 0.115)
            lw = max(6, int(min(W, H) / 105))
            od.ellipse((cx - r - lw, cy - r - lw, cx + r + lw, cy + r + lw),
                       outline=(6, 14, 34, 190), width=lw + 6)      # dark backing so it reads on light art
            od.ellipse((cx - r, cy - r, cx + r, cy + r), outline=TEAL, width=lw)
            # leader line toward the caption side, ending in a solid dot
            sgn = -1 if a.text_side == 'left' else 1
            x2 = cx + sgn * (r + int(W * 0.085))
            od.line((cx + sgn * r, cy, x2, cy), fill=(6, 14, 34, 190), width=lw + 5)
            od.line((cx + sgn * r, cy, x2, cy), fill=TEAL, width=lw)
            od.ellipse((x2 - lw, cy - lw, x2 + lw, cy + lw), fill=TEAL)
            bg.alpha_composite(ov)

    x0 = 40 if a.text_side == 'left' else None
    # Shorts UI covers the right ~14% and bottom ~16%; start the text block at 22% down
    y = int(H * a.text_y) if a.text_y is not None else (int(H * 0.22) if a.vertical else 60)
    usable = W - 80 - (int(W * 0.14) if a.vertical else 0)

    text_box = [W, H, 0, 0]   # x0, y0, x1, y1 of everything we draw, for the badge to dodge

    def put(img, yy):
        px = x0 if x0 is not None else W - img.width - 40
        bg.alpha_composite(img, (px, yy))
        text_box[0] = min(text_box[0], px); text_box[1] = min(text_box[1], yy)
        text_box[2] = max(text_box[2], px + img.width); text_box[3] = max(text_box[3], yy + img.height)

    if a.claim_first:
        # Claim big and white, name small above it, no engine tag. Measured against the
        # first six episodes: at a real 246 px thumbnail the game's name was the largest
        # element and the least legible reason to click, while the number that earns the
        # click sat half-size in teal over busy art. Two blocks, one of them dominant.
        if a.line1:
            p1 = split_accent(a.line1)
            n = rich_text(p1, fit_rich(p1, 54, usable, a.accent_scale), TEAL,
                          outline=8, shadow=(5, 6), scale=a.accent_scale)
            put(n, y); y += int(n.height * 0.98)
        if a.line2:
            p2 = split_accent(a.line2)
            c = rich_text(p2, fit_rich(p2, a.title_size, usable, a.accent_scale), WHITE,
                          outline=16, scale=a.accent_scale)
            put(c, y)
    else:
        if a.tag:
            t = outlined_text(a.tag, 34, TEAL, outline=6, shadow=(4, 5), label=True)
            put(t, y); y += 78
        p1 = split_accent(a.line1)
        l1 = rich_text(p1, fit_rich(p1, a.title_size, usable, a.accent_scale), WHITE,
                       outline=14, scale=a.accent_scale)
        put(l1, y); y += int(l1.height * 0.86)
        if a.line2:
            p2 = split_accent(a.line2)
            l2 = rich_text(p2, fit_rich(p2, a.hook_size, usable - 180, a.accent_scale), TEAL,
                           outline=12, scale=a.accent_scale)  # keep the hook narrower than the title
            put(l2, y)
    badge = Image.open(a.badge or BADGE).convert('RGBA'); bs = 190 / badge.height
    badge = badge.resize((int(badge.width * bs), 190), Image.LANCZOS)
    by = H - badge.height - (int(H * 0.16) + 30 if a.vertical else 30)
    bx = 36
    # The badge lives bottom-left, but --text-y can push the copy down into it (a low text
    # block on a Short clipped the first letter of the hook). If they overlap, the badge
    # moves to the other side rather than the text, because the text position was chosen
    # to clear the art and the badge only has to be somewhere.
    if bx < text_box[2] and bx + badge.width > text_box[0] and by < text_box[3] and by + badge.height > text_box[1]:
        bx = W - badge.width - 36
    bg.alpha_composite(badge, (bx, by))
    bg.convert('RGB').save(a.out, quality=90)
    print('saved', a.out)


if __name__ == '__main__':
    main()
