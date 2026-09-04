"""Render an "evidence card" still: a monospaced file/fact list on the brand ground.

    python scripts/motion/render_evidence_card.py OUT.png --title "THE ENGINE" \
        --lines "Unity.RenderPipelines.HighDefinition.Runtime.dll|HDRP, not URP" \
                "Unity.RenderPipelines.GPUDriven.Runtime.dll|Unity 6 GPU Resident Drawer"

A teardown that says "the file list shows" should show the file list. These cards are
plain 1920x1080 PNGs used as `vis` images in script.json, so build_plan.py needs no new
concept -- they are just pictures, like a screenshot.

Left column is the evidence (JetBrains Mono, teal), right of the pipe is the reading of
it (Inter, dim). Rows can be given a `>` prefix to mark them as a conclusion rather than
a file name; those render in Inter white without the mono column.

**The bottom quarter of the frame is left empty on purpose.** These cards are shown with
narration captions over them, and in episode 05 the source line at the bottom of the card
ran straight through the caption. Everything now lives above CAPTION_TOP, and the source
credit sits under the title instead of at the foot.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080        # overridden by --width/--height; 1080x1920 for a Short
CAPTION_FRAC = 0.74      # captions start below this; keep card content above it
NAVY = (11, 22, 46, 255)
PANEL = (16, 34, 66, 235)
TEAL = (46, 208, 192, 255)
WHITE = (238, 248, 250, 255)
DIM = (150, 180, 200, 255)
RULE = (40, 72, 110, 255)
ANTON = 'assets/fonts/Anton-Regular.ttf'
INTER = 'assets/fonts/Inter.ttf'
MONO = 'assets/fonts/JetBrainsMono-Regular.ttf'
MONO_B = 'assets/fonts/JetBrainsMono-Bold.ttf'


def inter(size, weight='SemiBold'):
    f = ImageFont.truetype(INTER, size); f.set_variation_by_name(weight); return f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--title', required=True)
    ap.add_argument('--subtitle', default='')
    ap.add_argument('--lines', nargs='+', required=True,
                    help='"evidence|reading" per row, or ">conclusion" for a full-width note')
    ap.add_argument('--source', default='SteamDB depot manifest · app 4568400 · 29 Jun 2026')
    ap.add_argument('--width', type=int, default=W); ap.add_argument('--height', type=int, default=H)
    a = ap.parse_args()

    w, h = a.width, a.height
    CAPTION_TOP = int(h * CAPTION_FRAC)
    im = Image.new('RGB', (w, h), NAVY[:3])
    d = ImageDraw.Draw(im, 'RGBA')

    # a faint grid, so the card reads as a blueprint rather than a slide
    for x in range(0, w, 60):
        d.line((x, 0, x, h), fill=(255, 255, 255, 8))
    for y in range(0, h, 60):
        d.line((0, y, w, y), fill=(255, 255, 255, 8))

    f_title = ImageFont.truetype(ANTON, 76)
    f_src = ImageFont.truetype(MONO, 24)
    y = (322 if a.subtitle else 286) + (40 if w < h else 0)

    rows = [l for l in a.lines]
    # shrink to fit whatever was passed rather than clipping
    fm_size = 38
    while fm_size > 20 and len(rows) * (fm_size + (58 if w < h else 30)) > CAPTION_TOP - 60 - y:
        fm_size -= 2
    fm = ImageFont.truetype(MONO_B, fm_size)
    fr = inter(max(20, fm_size - 6), 'Medium')
    fc = inter(max(22, fm_size - 2), 'Bold')

    # A 9:16 card would otherwise leave a huge empty panel under four rows, so the
    # panel is sized to the rows and centred in the space above the captions.
    body_h = len(rows) * (fm_size + (58 if w < h else 30))
    top = 120 if w > h else max(120, (CAPTION_TOP - (y - 120 + body_h)) // 2)
    shift = top - 120
    panel_bottom = top + (y - 120) + body_h + 40
    d.rounded_rectangle((70, top, w - 70, min(CAPTION_TOP - 20, panel_bottom)), radius=26, fill=PANEL)
    d.text((120, 160 + shift), a.title, font=f_title, fill=WHITE)
    if a.subtitle:
        d.text((124, 252 + shift), a.subtitle, font=inter(30, 'Medium'), fill=DIM)
    sx = w - 120 - f_src.getlength(a.source)
    sy = (186 if sx > 700 else 262) + shift   # a narrow card has no room beside the title
    d.text((max(120, sx), sy), a.source, font=f_src, fill=(110, 140, 165, 255))
    y += shift
    d.line((120, y, w - 120, y), fill=RULE, width=3)
    y += 30
    for row in rows:
        if row.startswith('>'):
            d.text((120, y), row[1:].strip(), font=fc, fill=TEAL)
            y += fm_size + (58 if w < h else 30)
            continue
        ev, _, reading = row.partition('|')
        d.text((120, y), ev.strip(), font=fm, fill=TEAL)
        if reading.strip():
            ew = fm.getlength(ev.strip())
            if w < h:      # vertical: the reading goes under the file name, not beside it
                d.text((120, y + fm_size + 4), '— ' + reading.strip(), font=fr, fill=DIM)
            else:
                d.text((160 + ew + 34, y + 5), '— ' + reading.strip(), font=fr, fill=DIM)
        y += fm_size + (58 if w < h else 30)

    im.save(a.out)
    print('saved', a.out, im.size)


if __name__ == '__main__':
    main()
