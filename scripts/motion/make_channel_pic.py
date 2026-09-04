"""Compose an 800x800 YouTube channel profile picture from a brand mark.

    python scripts/motion/make_channel_pic.py --channel aimc

YouTube crops the avatar to a circle and renders it as small as 48 px, so the
mark is inset well inside the ring and nothing but the mark goes in -- no text.
The ring is what makes it findable in a subscription list.
"""
import argparse, os
from PIL import Image, ImageDraw

S = 800
NAVY = (13, 27, 51)
TEAL = (45, 197, 194)

CHANNELS = {
    'demodip': dict(logo='assets/brand/demo_dip_logo_rgba.png', mark_end=520,
                    inset=0.62, out='assets/brand/demo_dip_channel_pic.png'),
    'aimc': dict(logo='assets/brand/demo_jjikmeok_logo_rgba.png', mark_end=483,
                 inset=0.60, out='assets/brand/demo_jjikmeok_channel_pic.png'),
}


def build(cfg):
    im = Image.new('RGB', (S, S), NAVY)
    d = ImageDraw.Draw(im)
    d.ellipse((28, 28, S - 28, S - 28), outline=TEAL, width=12)

    logo = Image.open(cfg['logo']).convert('RGBA')
    mark = logo.crop((0, 0, logo.width, cfg['mark_end']))
    mark = mark.crop(mark.getbbox())
    box = S * cfg['inset']
    s = min(box / mark.width, box / mark.height)
    mark = mark.resize((round(mark.width * s), round(mark.height * s)), Image.LANCZOS)
    im.paste(mark, ((S - mark.width) // 2, (S - mark.height) // 2), mark)

    im.save(cfg['out'], optimize=True)
    print(cfg['out'], im.size, os.path.getsize(cfg['out']), 'bytes')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--channel', required=True, choices=sorted(CHANNELS))
    build(CHANNELS[ap.parse_args().channel])
