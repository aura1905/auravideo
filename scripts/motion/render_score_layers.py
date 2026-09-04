"""Score scene layers for 데모 찍먹 — each element is its own alpha clip.

Layers (all 1920x1080 RGBA PNG sequences -> ProRes 4444):
  score_header : "데모 찍먹 점수" title, slides down from the top edge
  score_row_0..4 : label + bar + counting number, slide in from the left, bar fills, number counts
  score_stamp : average badge, slams down (scale 2.2 -> 1.0) with a small bounce
Times are seconds from the section start. Exit: rows leave to the right (staggered), header up, stamp shrinks.
"""
import math, os, json, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

opt = {}
for _i, _a in enumerate(sys.argv[1:]):
    if _a.startswith('--'):
        opt[_a[2:]] = sys.argv[_i + 2]
W = int(opt.get('width', 1920)); H = int(opt.get('height', 1080))
VERT = H > W
FPS = 30
SECTION = float(opt.get('section', 14.2))
N = int(SECTION * FPS)
TEAL = (25, 198, 183, 255); WHITE = (240, 255, 251, 255); NAVY = (8, 20, 48, 255); DIM = (14, 32, 70, 200)
FONT_B = opt.get('font', 'C:/Windows/Fonts/malgunbd.ttf')
# Strings are options so the same renderer serves the Korean and English shows.
HEADER = opt.get('header', '데모 찍먹 점수')
AVG_LABEL = opt.get('avg-label', '평균 / 10')
# [[min_average, label], ...] highest first
VERDICTS = json.loads(opt.get('verdicts', '[[8.5,"꼭 사먹"],[6,"찍먹 각"],[4.5,"지켜보기"],[0,"패스"]]'))
_pos = [a for a in sys.argv[1:] if not a.startswith('--')]
scores = json.loads(_pos[0]) if _pos else [["아이디어", 8], ["완성도", 5], ["아트", 6], ["접근성", 3], ["기술적 흥미", 9]]
# Timing scales with the section: the episode gives it 14.2 s, a Short ~9 s.
_LONG = SECTION > 12
ROW_T0 = float(opt.get('row-start', 1.4 if _LONG else 0.9))
ROW_GAP = float(opt.get('row-gap', 0.95 if _LONG else 0.62))
ROW_IN = [ROW_T0 + i * ROW_GAP for i in range(5)]
FILL = 0.7 if _LONG else 0.5
STAMP_T = float(opt.get('stamp-t', 6.85 if _LONG else ROW_T0 + 5 * ROW_GAP + 0.35))
EXIT_T = float(opt.get('exit-t', 13.3 if _LONG else SECTION - 0.9))

def clamp(x): return max(0.0, min(1.0, x))
def eob(t, s=1.4): t -= 1; return 1 + t * t * ((s + 1) * t + s)
def eio(t): return t * t * (3 - 2 * t)
def ein(t): return t * t

def outlined(draw_fn, size, outline=8, shadow=(8, 10)):
    """Render draw_fn onto a layer, then add a navy outline + heavy shadow (logo house style)."""
    pad = outline + 30
    base = Image.new('RGBA', (size[0] + pad * 2, size[1] + pad * 2), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(base), pad)
    a = base.split()[3]
    dil = a.filter(ImageFilter.MaxFilter(outline * 2 + 1)).filter(ImageFilter.GaussianBlur(0.8))
    ol = Image.new('RGBA', base.size, NAVY); ol.putalpha(dil)
    sh = Image.new('RGBA', base.size, (0, 0, 0, 255)); sh.putalpha(dil.point(lambda v: int(v * 0.85)))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(sh, shadow); out.alpha_composite(ol); out.alpha_composite(base)
    return out, pad

def blank(): return Image.new('RGBA', (W, H), (0, 0, 0, 0))

# ---------- header ----------
f_head = ImageFont.truetype(FONT_B, 64)
def header_img():
    txt = HEADER
    tw = int(f_head.getlength(txt))
    def d(dr, pad): dr.text((pad, pad), txt, font=f_head, fill=WHITE)
    return outlined(d, (tw, 80), outline=7)[0]
HEAD = header_img()

# ---------- rows ----------
f_lab = ImageFont.truetype(FONT_B, 44); f_num = ImageFont.truetype(FONT_B, 60); f_small = ImageFont.truetype(FONT_B, 30)
ROW_W, ROW_H = (W - 120, 104) if VERT else (1180, 92)
BAR_X = int(ROW_W * 0.30)
BAR_W = int(ROW_W * (0.50 if VERT else 0.542))
BAR_H = 34
ROW_X = (W - ROW_W) // 2 if VERT else 110
ROW_Y0 = int(H * 0.30) if VERT else 236
ROW_DY = 132 if VERT else 118
HEAD_Y = int(H * 0.175) if VERT else 120
STAMP_C = (W // 2, int(H * 0.80)) if VERT else (1590, 560)
STAMP_S = 460 if VERT else 420
def row_img(label, value, fill_frac, shown_num):
    def d(dr, pad):
        # translucent panel
        dr.rounded_rectangle((pad, pad, pad + ROW_W, pad + ROW_H), radius=22, fill=DIM)
        dr.text((pad + 34, pad + 20), label, font=f_lab, fill=WHITE)
        # bar track + fill
        y0 = pad + (ROW_H - BAR_H) // 2
        dr.rounded_rectangle((pad + BAR_X, y0, pad + BAR_X + BAR_W, y0 + BAR_H), radius=BAR_H // 2, fill=(30, 50, 90, 255))
        fw = int(BAR_W * fill_frac * value / 10)
        if fw > BAR_H:
            dr.rounded_rectangle((pad + BAR_X, y0, pad + BAR_X + fw, y0 + BAR_H), radius=BAR_H // 2, fill=TEAL)
        elif fw > 0:
            dr.ellipse((pad + BAR_X, y0, pad + BAR_X + BAR_H, y0 + BAR_H), fill=TEAL)
        # ticks
        for k in range(1, 10):
            tx = pad + BAR_X + BAR_W * k // 10
            dr.line((tx, y0 + 6, tx, y0 + BAR_H - 6), fill=(8, 20, 48, 120), width=2)
        # number
        num = f'{shown_num}'
        nw = f_num.getlength(num)
        dr.text((pad + ROW_W - 150 - nw / 2, pad + 8), num, font=f_num, fill=TEAL if shown_num >= 7 else WHITE)
        dr.text((pad + ROW_W - 92, pad + 34), '/10', font=f_small, fill=(180, 200, 220, 255))
    return outlined(d, (ROW_W, ROW_H), outline=5, shadow=(6, 8))[0]

# ---------- stamp ----------
avg = sum(v for _, v in scores) / len(scores)
verdict = next(lbl for lo, lbl in VERDICTS if avg >= lo)
f_big = ImageFont.truetype(FONT_B, 120); f_mid = ImageFont.truetype(FONT_B, 40); f_v = ImageFont.truetype(FONT_B, 54)
def stamp_img():
    S = STAMP_S
    im = Image.new('RGBA', (S + 80, S + 80), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    c = (S + 80) // 2; r = S // 2
    dr.ellipse((c - r, c - r, c + r, c + r), fill=(8, 20, 48, 235), outline=TEAL, width=14)
    dr.ellipse((c - r + 26, c - r + 26, c + r - 26, c + r - 26), outline=(25, 198, 183, 120), width=3)
    t = f'{avg:.1f}'; tw = f_big.getlength(t)
    dr.text((c - tw / 2, c - 118), t, font=f_big, fill=TEAL)
    dr.text((c - f_mid.getlength(AVG_LABEL) / 2, c + 12), AVG_LABEL, font=f_mid, fill=(200, 220, 235, 255))
    # verdict ribbon
    rw = int(f_v.getlength(verdict)) + 70
    dr.rounded_rectangle((c - rw // 2, c + 70, c + rw // 2, c + 140), radius=18, fill=TEAL)
    dr.text((c - f_v.getlength(verdict) / 2, c + 76), verdict, font=f_v, fill=NAVY)
    im = im.rotate(-10, resample=Image.BICUBIC, expand=True)
    sh = Image.new('RGBA', (im.width + 40, im.height + 40), (0, 0, 0, 0))
    s2 = Image.new('RGBA', im.size, (0, 0, 0, 255)); s2.putalpha(im.split()[3].point(lambda v: int(v * 0.8)))
    sh.alpha_composite(s2.filter(ImageFilter.GaussianBlur(8)), (20 + 10, 20 + 14)); sh.alpha_composite(im, (20, 20))
    return sh
STAMP = stamp_img()

def paste_scaled(fr, im, cx, cy, sc):
    if sc <= 0.01: return
    w, h = max(1, int(im.width * sc)), max(1, int(im.height * sc))
    im2 = im.resize((w, h), Image.LANCZOS) if sc != 1 else im
    fr.alpha_composite(im2, (int(cx - w / 2), int(cy - h / 2)))

def render(name, fn):
    os.makedirs(f'sc_{name}', exist_ok=True)
    for i in range(N):
        fr = blank(); fn(fr, i / FPS); fr.save(f'sc_{name}/f{i:03d}.png')

# header: top edge -> y=120, exits up
def head(fr, t):
    p = clamp((t - 0.1) / 0.6); y = -HEAD.height + (HEAD_Y + HEAD.height) * eob(p)
    if t > EXIT_T + 0.5: y -= (y + HEAD.height + 20) * eio(clamp((t - EXIT_T - 0.5) / 0.4))
    if p <= 0: return
    fr.alpha_composite(HEAD, (int(ROW_X + ROW_W / 2 - HEAD.width / 2), int(y)))

def make_row(i, label, value):
    def fn(fr, t):
        t0 = ROW_IN[i]
        if t < t0: return
        p = clamp((t - t0) / 0.5)
        fillp = clamp((t - t0 - 0.15) / FILL)
        shown = int(round(value * eio(fillp)))
        im = row_img(label, value, eio(fillp), shown)
        x = ROW_X - (ROW_X + ROW_W + 160) * (1 - eob(p))
        if t > EXIT_T + i * 0.08: x += (W + 100) * ein(clamp((t - EXIT_T - i * 0.08) / 0.45))
        y = ROW_Y0 + i * ROW_DY
        fr.alpha_composite(im, (int(x), int(y)))
    return fn

def stamp(fr, t):
    if t < STAMP_T: return
    q = clamp((t - STAMP_T) / 0.22)
    sc = 2.2 - 1.2 * ein(q)
    if q >= 1:
        b = clamp((t - STAMP_T - 0.22) / 0.25); sc = 1.0 + 0.08 * math.sin(b * math.pi) * (1 - b)
    if t > EXIT_T + 0.3: sc *= 1 - eio(clamp((t - EXIT_T - 0.3) / 0.35))
    paste_scaled(fr, STAMP, STAMP_C[0], STAMP_C[1], sc)

if __name__ == '__main__':
    render('header', head)
    for i, (lab, val) in enumerate(scores): render(f'row_{i}', make_row(i, lab, val))
    render('stamp', stamp)
    print(f'canvas {W}x{H} avg {round(avg,2)} verdict {verdict} frames {N}')
