"""Compose the Demo Dip YouTube channel banner (2560x1440).

    python scripts/motion/make_banner.py episodes/_brand_en/banner_bg_1.png out.png

Background is model-generated (gen_brand_mark.py, gpt-image-2) with an intentionally
empty centre strip; the lockup is composited here with PIL so the wordmark is the
real brand asset instead of model-rendered text. Everything readable is kept inside
YouTube's 1546x423 mobile-safe centre box.
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 2560, 1440
SAFE_W, SAFE_H = 1546, 423
TEAL = (45, 197, 194)
CREAM = (247, 240, 227)

bg_path = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'assets/brand/demo_dip_banner.png'

# --- background: cover-crop to 16:9 ---
bg = Image.open(bg_path).convert('RGB')
s = max(W / bg.width, H / bg.height)
bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2,
              (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))

# --- soft dark scrim behind the centre so the lockup always reads ---
scrim = Image.new('L', (W, H), 0)
ImageDraw.Draw(scrim).ellipse((W // 2 - 900, H // 2 - 430, W // 2 + 900, H // 2 + 430), fill=150)
bg = Image.composite(Image.new('RGB', (W, H), (5, 14, 28)), bg, scrim.filter(ImageFilter.GaussianBox
     if False else ImageFilter.GaussianBlur(160)))

logo = Image.open('assets/brand/demo_dip_logo_rgba.png').convert('RGBA')
mark = logo.crop((0, 0, logo.width, 520)).crop(logo.crop((0, 0, logo.width, 520)).getbbox())
word = logo.crop((0, 530, logo.width, logo.height))
word = word.crop(word.getbbox())

cx, cy = W // 2, H // 2

# mark on the left of the lockup
mh = 215
mark = mark.resize((round(mark.width * mh / mark.height), mh), Image.LANCZOS)
# wordmark (DEMO DIP + tagline) on the right
ww = 620
word = word.resize((ww, round(word.height * ww / word.width)), Image.LANCZOS)

gap = 44
total_w = mark.width + gap + word.width
x = cx - total_w // 2
bg.paste(mark, (x, cy - mark.height // 2 - 46), mark)
bg.paste(word, (x + mark.width + gap, cy - word.height // 2 - 52), word)

# --- one-line positioning statement under the lockup, still inside the safe box ---
d = ImageDraw.Draw(bg)
try:
    f = ImageFont.truetype('C:/Windows/Fonts/seguibl.ttf', 34)
except OSError:
    f = ImageFont.load_default()
line = "STEAM'S TOP DEMOS, DIPPED AND DISSECTED"
tw = d.textlength(line, font=f)
ty = cy + 118
d.text((cx - tw / 2, ty), line, font=f, fill=CREAM, stroke_width=5, stroke_fill=(6, 18, 34))

# short teal rules flanking the line
d.rectangle((cx - tw / 2 - 60, ty + 17, cx - tw / 2 - 14, ty + 22), fill=TEAL)
d.rectangle((cx + tw / 2 + 16, ty + 17, cx + tw / 2 + 60, ty + 22), fill=TEAL)

bg.save(out, optimize=True)
print(out, bg.size)
