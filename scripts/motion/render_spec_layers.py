"""Spec-sheet scene layers for Demo Dip — the teardown card that replaces the score card.

    python scripts/motion/render_spec_layers.py '[["ENGINE","Unity 6 / URP"],["TEAM","1 person"],
        ["IN DEV","4 months"],["AI STACK","SD + ChatGPT"],["THE TRICK","hand-fixed AI art"]]' \
        --verdict "WORTH A DIP" [--width 1920] [--height 1080] [--section 14.2]

Writes sc_header/, sc_row_0..4/, sc_stamp/ PNG sequences — **the same seven layer
names and the same timing constants as render_score_layers.py**, so build_plan.py and
its SFX cue table need no change. This renderer replaces that one for the English
show; the Korean episodes 01–03 keep the score card.

Why a spec sheet and not scores: the audience is people who want to know how a demo
was built — especially one- and two-person studios working with AI. What helps them is
what we *found out* (engine, team, time, tool stack, the one clever trick), not what we
*rated*. The judgement survives as a single verdict badge.

Typography follows the three-role rule (docs/CHANNEL.md): Anton for display, Inter for
labels, **JetBrains Mono for every value** — monospaced figures are what reads as
"technical teardown" to an English-speaking developer audience.
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

opt = {}
for _i, _a in enumerate(sys.argv[1:]):
    if _a.startswith('--'):
        opt[_a[2:]] = sys.argv[_i + 2]
W = int(opt.get('width', 1920)); H = int(opt.get('height', 1080))
VERT = H > W
FPS = 30
SECTION = float(opt.get('section', 9.5 if VERT else 14.2))
N = int(SECTION * FPS)
TEAL = (25, 198, 183, 255); WHITE = (240, 255, 251, 255); NAVY = (8, 20, 48, 255)
DIM = (14, 32, 70, 200); LABEL = (168, 196, 214, 255)
ANTON = 'assets/fonts/Anton-Regular.ttf'
INTER = 'assets/fonts/Inter.ttf'
MONO = 'assets/fonts/JetBrainsMono-Bold.ttf'
HEADER = opt.get('header', 'HOW THEY MADE IT')
VERDICT = opt.get('verdict', 'WORTH A DIP')
VERDICT_LABEL = opt.get('verdict-label', 'THE VERDICT')
_pos = [a for a in sys.argv[1:] if not a.startswith('--')]
# Defaults document the intent: five dev-facing facts, not five opinions.
specs = json.loads(_pos[0]) if _pos else [['ENGINE', 'Unity 6 / URP'], ['TEAM', '1 person'],
                                          ['IN DEV', '4 months'], ['AI STACK', 'SD + ChatGPT'],
                                          ['THE TRICK', 'hand-fixed AI art']]
assert len(specs) == 5, f'the scene has exactly 5 rows, got {len(specs)}'

_LONG = SECTION > 12
ROW_T0 = float(opt.get('row-start', 1.4 if _LONG else 0.9))
ROW_GAP = float(opt.get('row-gap', 0.95 if _LONG else 0.62))
ROW_IN = [ROW_T0 + i * ROW_GAP for i in range(5)]
TYPE_DUR = 0.7 if _LONG else 0.5          # the value types itself in, char by char
STAMP_T = float(opt.get('stamp-t', 6.85 if _LONG else ROW_T0 + 5 * ROW_GAP + 0.35))
EXIT_T = float(opt.get('exit-t', 13.3 if _LONG else SECTION - 0.9))


def clamp(x): return max(0.0, min(1.0, x))
def eob(t, s=1.4): t -= 1; return 1 + t * t * ((s + 1) * t + s)
def eio(t): return t * t * (3 - 2 * t)
def ein(t): return t * t


def inter(size, weight='Bold'):
    f = ImageFont.truetype(INTER, size); f.set_variation_by_name(weight); return f


def outlined(draw_fn, size, outline=8, shadow=(8, 10)):
    pad = outline + 30
    base = Image.new('RGBA', (size[0] + pad * 2, size[1] + pad * 2), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(base), pad)
    al = base.split()[3]
    dil = al.filter(ImageFilter.MaxFilter(outline * 2 + 1)).filter(ImageFilter.GaussianBlur(0.8))
    ol = Image.new('RGBA', base.size, NAVY); ol.putalpha(dil)
    sh = Image.new('RGBA', base.size, (0, 0, 0, 255)); sh.putalpha(dil.point(lambda v: int(v * 0.85)))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(sh, shadow); out.alpha_composite(ol); out.alpha_composite(base)
    return out


def blank(): return Image.new('RGBA', (W, H), (0, 0, 0, 0))


# ---------- layout ----------
ROW_W, ROW_H = (W - 150, 104) if VERT else (1180, 92)
ROW_X = (W - ROW_W) // 2 if VERT else 110
ROW_Y0 = int(H * 0.26) if VERT else 236
ROW_DY = 132 if VERT else 118
HEAD_Y = int(H * 0.175) if VERT else 120
# In 9:16 the bottom ~16% is YouTube's own title and handle strip, so the verdict --
# the payoff shot -- sits above it. It also has to clear the five rows, which end
# around 0.26 H + 5 * 132 px, hence 0.72 rather than something higher.
STAMP_C = (W // 2, int(H * 0.72)) if VERT else (1590, 560)
STAMP_S = 380 if VERT else 420
VAL_X = int(ROW_W * 0.33)                 # values start on one column: a spec sheet aligns

f_head = ImageFont.truetype(ANTON, 74)
f_lab = inter(36, 'Black')
f_small = inter(26, 'Bold')


def mono_fitted(text, box_w, start=52, floor=26):
    """Shrink the value until it fits the row — a rigid column beats wrapped text here."""
    size = start
    while size > floor and ImageFont.truetype(MONO, size).getlength(text) > box_w:
        size -= 2
    return ImageFont.truetype(MONO, size)


HEAD = outlined(lambda dr, pad: dr.text((pad, pad), HEADER, font=f_head, fill=WHITE),
                (int(f_head.getlength(HEADER)), 92), outline=7)


def row_img(label, value, shown):
    """One spec row: Inter label, dotted leader, mono value revealed `shown` chars in."""
    fv = mono_fitted(value, ROW_W - VAL_X - 60)

    def d(dr, pad):
        dr.rounded_rectangle((pad, pad, pad + ROW_W, pad + ROW_H), radius=22, fill=DIM)
        dr.text((pad + 34, pad + (ROW_H - 44) // 2), label, font=f_lab, fill=LABEL)
        lx0 = pad + 34 + int(f_lab.getlength(label)) + 18
        lx1 = pad + VAL_X - 18
        ly = pad + ROW_H // 2 + 4
        for x in range(lx0, max(lx0, lx1), 10):
            dr.line((x, ly, x + 3, ly), fill=(80, 120, 150, 180), width=2)
        txt = value[:shown]
        dr.text((pad + VAL_X, pad + (ROW_H - fv.size - 10) // 2), txt, font=fv, fill=TEAL)
        if shown < len(value):          # a solid caret while the value types in
            cx = pad + VAL_X + fv.getlength(txt)
            dr.rectangle((cx + 2, ly - fv.size // 2, cx + 2 + fv.size * 0.55, ly + fv.size // 3),
                         fill=(25, 198, 183, 150))
    return outlined(d, (ROW_W, ROW_H), outline=5, shadow=(6, 8))


def stamp_img():
    S = STAMP_S
    im = Image.new('RGBA', (S + 80, S + 80), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    c = (S + 80) // 2; r = S // 2
    dr.ellipse((c - r, c - r, c + r, c + r), fill=(8, 20, 48, 235), outline=TEAL, width=14)
    dr.ellipse((c - r + 26, c - r + 26, c + r - 26, c + r - 26), outline=(25, 198, 183, 120), width=3)
    dr.text((c - f_small.getlength(VERDICT_LABEL) / 2, c - 96), VERDICT_LABEL, font=f_small, fill=LABEL)
    words = VERDICT.split()
    if len(words) > 2:                  # "WORTH A DIP" -> two lines, big
        words = [' '.join(words[:-1]), words[-1]]
    size = 92
    while size > 40 and max(ImageFont.truetype(ANTON, size).getlength(w) for w in words) > S - 90:
        size -= 4
    fv = ImageFont.truetype(ANTON, size)
    y = c - 46
    for w in words:
        dr.text((c - fv.getlength(w) / 2, y), w, font=fv, fill=TEAL); y += int(size * 1.02)
    im = im.rotate(-10, resample=Image.BICUBIC, expand=True)
    sh = Image.new('RGBA', (im.width + 40, im.height + 40), (0, 0, 0, 0))
    s2 = Image.new('RGBA', im.size, (0, 0, 0, 255)); s2.putalpha(im.split()[3].point(lambda v: int(v * 0.8)))
    sh.alpha_composite(s2.filter(ImageFilter.GaussianBlur(8)), (30, 34)); sh.alpha_composite(im, (20, 20))
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


def head(fr, t):
    p = clamp((t - 0.1) / 0.6)
    if p <= 0: return
    y = -HEAD.height + (HEAD_Y + HEAD.height) * eob(p)
    if t > EXIT_T + 0.5: y -= (y + HEAD.height + 20) * eio(clamp((t - EXIT_T - 0.5) / 0.4))
    fr.alpha_composite(HEAD, (int(ROW_X + ROW_W / 2 - HEAD.width / 2), int(y)))


def make_row(i, label, value):
    def fn(fr, t):
        t0 = ROW_IN[i]
        if t < t0: return
        p = clamp((t - t0) / 0.5)
        typed = clamp((t - t0 - 0.15) / TYPE_DUR)
        im = row_img(label, value, int(round(len(value) * eio(typed))))
        x = ROW_X - (ROW_X + ROW_W + 160) * (1 - eob(p))
        if t > EXIT_T + i * 0.08: x += (W + 100) * ein(clamp((t - EXIT_T - i * 0.08) / 0.45))
        fr.alpha_composite(im, (int(x), int(ROW_Y0 + i * ROW_DY)))
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
    for i, (lab, val) in enumerate(specs):
        render(f'row_{i}', make_row(i, lab, val))
    render('stamp', stamp)
    print(f'canvas {W}x{H} verdict {VERDICT!r} frames {N}')
