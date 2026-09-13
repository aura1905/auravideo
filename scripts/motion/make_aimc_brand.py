"""Build the AIMC channel brand set: logo lockup, banner, channel picture.

    python scripts/motion/make_aimc_brand.py

The channel (UCjBAu9usnhkNa_vFFFr4cyg) reverts from the 데모 찍먹 branding to AIMC,
now carrying AI news and short-form video. Its own script rather than a new entry in
make_banner.py / make_channel_pic.py so the Demo Dip assets keep their tuned numbers.

The mark is model-generated (gen_brand_mark.py, gpt-image-2) and cut with
cut_brand_mark.py --thresh 16 -- higher thresholds flood through the mark's own dark
navy outline and eat it.

The vertical lockup is left as flat fills with NO baked outline, and its three blocks
(mark / wordmark / tagline) are separated by fully empty alpha rows, so
render_intro_layers.py can split it and add the house outline itself.

Banner: everything readable stays inside YouTube's 1546x423 mobile-safe centre box.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

VIOLET = (124, 92, 255, 255)
CREAM = (242, 245, 255, 255)
INK = (11, 15, 26)

MARK = 'assets/brand/aimc_mark_rgba.png'
BG = os.environ['TEMP'] + '/aimc_brand/banner_bg_1.png'
ANTON = 'assets/fonts/Anton-Regular.ttf'
TITLE = 'AIMC'

LOGO_OUT = 'assets/brand/aimc_logo_rgba.png'
BANNER_OUT = 'assets/brand/aimc_banner.png'
PIC_OUT = 'assets/brand/aimc_channel_pic.png'

W, H = 2560, 1440
SAFE_W, SAFE_H = 1546, 423


def text_layer(txt, font, fill, tracking=0):
    """Tightly cropped RGBA of one text run, so vertical gaps are exact."""
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    if tracking:
        widths = [probe.textlength(c, font=font) for c in txt]
        w = int(sum(widths) + tracking * (len(txt) - 1)) + 8
        _, t, _, b = probe.textbbox((0, 0), txt, font=font)
        im = Image.new('RGBA', (w, b + 8), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x = 4
        for c, cw in zip(txt, widths):
            d.text((x, 0), c, font=font, fill=fill)
            x += cw + tracking
    else:
        l, t, r, b = probe.textbbox((0, 0), txt, font=font)
        im = Image.new('RGBA', (r + 8, b + 8), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((0, 0), txt, font=font, fill=fill)
    return im.crop(im.getbbox())


def build_logo():
    """Vertical lockup: mark then AIMC -- a blank alpha row between the blocks."""
    mark = Image.open(MARK).convert('RGBA')
    mh = 460
    mark = mark.resize((round(mark.width * mh / mark.height), mh), Image.LANCZOS)

    word = text_layer(TITLE, ImageFont.truetype(ANTON, 250), CREAM, tracking=14)

    gap = 46
    w = max(mark.width, word.width)
    im = Image.new('RGBA', (w, mark.height + gap + word.height), (0, 0, 0, 0))
    im.paste(mark, ((w - mark.width) // 2, 0), mark)
    im.paste(word, ((w - word.width) // 2, mark.height + gap), word)
    im.save(LOGO_OUT)
    print(LOGO_OUT, im.size, os.path.getsize(LOGO_OUT), 'bytes')
    return mark, word


def build_banner(mark, word):
    bg = Image.open(BG).convert('RGB')
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2,
                  (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))

    # Soft dark pool behind the centre so the lockup reads whatever the art did.
    scrim = Image.new('L', (W, H), 0)
    ImageDraw.Draw(scrim).ellipse((W // 2 - 880, H // 2 - 400, W // 2 + 880, H // 2 + 400), fill=145)
    bg = Image.composite(Image.new('RGB', (W, H), INK), bg,
                         scrim.filter(ImageFilter.GaussianBlur(170)))

    # No strapline -- the wordmark carries the banner alone, so both blocks grow
    # and the pair sits centred in the safe box instead of above a caption.
    m = mark.copy()
    mh = 330
    m = m.resize((round(m.width * mh / m.height), mh), Image.LANCZOS)
    wm = word.copy()
    ww = 780
    wm = wm.resize((ww, round(wm.height * ww / wm.width)), Image.LANCZOS)

    cx, cy = W // 2, H // 2
    gap = 62
    x = cx - (m.width + gap + wm.width) // 2
    bg.paste(m, (x, cy - m.height // 2), m)
    bg.paste(wm, (x + m.width + gap, cy - wm.height // 2), wm)

    bg.save(BANNER_OUT, optimize=True)
    print(BANNER_OUT, bg.size, os.path.getsize(BANNER_OUT), 'bytes')
    safe = BANNER_OUT.replace('.png', '_safe.png')
    bg.crop(((W - SAFE_W) // 2, (H - SAFE_H) // 2,
             (W + SAFE_W) // 2, (H + SAFE_H) // 2)).save(safe)
    print('safe area ->', safe)


def build_pic(mark):
    S = 800
    im = Image.new('RGB', (S, S), INK)
    ImageDraw.Draw(im).ellipse((26, 26, S - 26, S - 26), outline=VIOLET[:3], width=13)
    m = mark.copy()
    box = S * 0.60
    s = min(box / m.width, box / m.height)
    m = m.resize((round(m.width * s), round(m.height * s)), Image.LANCZOS)
    im.paste(m, ((S - m.width) // 2, (S - m.height) // 2), m)
    im.save(PIC_OUT, optimize=True)
    print(PIC_OUT, im.size, os.path.getsize(PIC_OUT), 'bytes')


if __name__ == '__main__':
    mark, word = build_logo()
    build_banner(mark, word)
    build_pic(Image.open(MARK).convert('RGBA'))
