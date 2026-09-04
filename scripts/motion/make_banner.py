"""Compose a YouTube channel banner (2560x1440) from a brand lockup.

    python scripts/motion/make_banner.py --channel demodip
    python scripts/motion/make_banner.py --channel aimc

Backgrounds are model-generated (gen_brand_mark.py, gpt-image-2) with an
intentionally empty centre strip; the lockup is composited here with PIL so the
wordmark is the real brand asset instead of model-rendered text.

Everything readable must sit inside YouTube's 1546x423 mobile-safe centre box --
that is the only part every viewer sees. The full 2560x1440 shows on TV, the
middle ~1855 wide on desktop. Verify with --safe-out and actually look at it.
"""
import argparse, io, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 2560, 1440
SAFE_W, SAFE_H = 1546, 423
TEAL = (45, 197, 194)
CREAM = (247, 240, 227)
INK = (6, 18, 34)

# Each channel: the logo file, the row where the mark ends and the wordmark
# block begins (found from the alpha profile), the strapline, and its font.
CHANNELS = {
    'demodip': dict(
        logo='assets/brand/demo_dip_logo_rgba.png',
        mark_end=520, word_start=530,
        line="STEAM'S TOP DEMOS, DIPPED AND DISSECTED",
        font='C:/Windows/Fonts/seguibl.ttf', font_size=34,
        bg='episodes/_brand_en/banner_bg_1.png',
        out='assets/brand/demo_dip_banner.png'),
    'aimc': dict(
        logo='assets/brand/demo_jjikmeok_logo_rgba.png',
        mark_end=483, word_start=505,
        line='요즘 뜨는 스팀 데모, 직접 해보고 뜯어봅니다',
        font='C:/Windows/Fonts/NotoSansKR-VF.ttf', font_size=38, font_variation='Bold',
        bg='episodes/_brand_en/banner_bg_2.png',
        # The Korean wordmark is far heavier than the English one, so the mark
        # needs to grow with it or the lockup reads as text with a sticker.
        mark_h=262, mark_dy=-58, word_w=660,
        out='assets/brand/demo_jjikmeok_banner.png'),
}


def load_font(path, size, variation=None):
    f = ImageFont.truetype(path, size)
    if variation:
        try:
            f.set_variation_by_name(variation)
        except Exception:
            pass  # static font, or no such named instance -- the regular weight still reads
    return f


def build(cfg, safe_out=None):
    bg = Image.open(cfg['bg']).convert('RGB')
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2,
                  (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))

    # Soft dark pool behind the centre so the lockup reads no matter what the
    # generated art put there.
    scrim = Image.new('L', (W, H), 0)
    ImageDraw.Draw(scrim).ellipse((W // 2 - 900, H // 2 - 430, W // 2 + 900, H // 2 + 430), fill=150)
    bg = Image.composite(Image.new('RGB', (W, H), (5, 14, 28)), bg,
                         scrim.filter(ImageFilter.GaussianBlur(160)))

    logo = Image.open(cfg['logo']).convert('RGBA')
    mark = logo.crop((0, 0, logo.width, cfg['mark_end']))
    mark = mark.crop(mark.getbbox())
    word = logo.crop((0, cfg['word_start'], logo.width, logo.height))
    word = word.crop(word.getbbox())

    cx, cy = W // 2, H // 2
    mh = cfg.get('mark_h', 215)
    mark = mark.resize((round(mark.width * mh / mark.height), mh), Image.LANCZOS)
    ww = cfg.get('word_w', 620)
    word = word.resize((ww, round(word.height * ww / word.width)), Image.LANCZOS)

    gap = cfg.get('gap', 44)
    dy = cfg.get('mark_dy', -46)
    x = cx - (mark.width + gap + word.width) // 2
    bg.paste(mark, (x, cy - mark.height // 2 + dy), mark)
    bg.paste(word, (x + mark.width + gap, cy - word.height // 2 - 52), word)

    d = ImageDraw.Draw(bg)
    f = load_font(cfg['font'], cfg['font_size'], cfg.get('font_variation'))
    tw = d.textlength(cfg['line'], font=f)
    ty = cy + 118
    d.text((cx - tw / 2, ty), cfg['line'], font=f, fill=CREAM, stroke_width=5, stroke_fill=INK)
    d.rectangle((cx - tw / 2 - 60, ty + 17, cx - tw / 2 - 14, ty + 22), fill=TEAL)
    d.rectangle((cx + tw / 2 + 14, ty + 17, cx + tw / 2 + 60, ty + 22), fill=TEAL)

    bg.save(cfg['out'], optimize=True)
    print(cfg['out'], bg.size, os.path.getsize(cfg['out']), 'bytes')
    if safe_out:
        bg.crop(((W - SAFE_W) // 2, (H - SAFE_H) // 2,
                 (W + SAFE_W) // 2, (H + SAFE_H) // 2)).save(safe_out)
        print('safe area ->', safe_out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--channel', required=True, choices=sorted(CHANNELS))
    ap.add_argument('--safe-out')
    a = ap.parse_args()
    build(CHANNELS[a.channel], a.safe_out)
