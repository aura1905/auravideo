"""Turn every still in an episode into a slowly moving clip.

    python scripts/motion/kenburns.py episodes/05-casualties-unknown
    python scripts/motion/kenburns.py episodes/05-casualties-unknown --vertical

Why this exists: measured with scripts/pipeline/check_render.py, 50-63% of every
long-form master and 62-78% of every Short was a frozen picture -- a voice talking
over a still screenshot for most of the runtime. The cause is structural, not a bad
shot choice: a store trailer gives 20-30 s of usable footage and the script needs
four minutes, so most lines fall back to a screenshot or an evidence card, and
AuraVideo has no keyframes, so those do not move at all.

So the motion is baked in before the timeline ever sees them. Each still becomes an
mp4 with a slow push and drift. build_plan then places it as a video clip.

Two different amounts, on purpose:

Every clip keeps its SOURCE resolution -- a 16:9 screenshot stays 16:9 even in a 9:16
episode, exactly like the image it replaces, so build_plan's blur fill still applies.
Forcing 1080x1920 stretched them. --vertical therefore only renders the 9:16 evidence
cards (ev_*_v.png); the screenshots and blueprint are shared with the 16:9 run.

  screenshots    1.00 -> 1.24 over 16 s, with a diagonal drift. A narration line uses
                 about six of those seconds, so the visible push is ~9% -- a normal
                 documentary move, not a zoom.
  evidence cards 1.00 -> 1.10, centred push only. These are text on a panel; pan
                 them and the reader loses their place, crop them hard and the
                 source line at the top-right goes off screen.

zoompan judders on a 1:1 source because it rounds the crop origin to integer pixels,
so the input is upscaled first and the result scaled back down -- the standard fix.
"""
import argparse, glob, json, math, os, subprocess, sys

FPS = 30
LEN = 16.0          # every clip is long enough for the longest narration line
SS_ZOOM = 0.24      # screenshots
CARD_ZOOM = 0.10    # evidence cards, still_bg


def probe(path):
    out = subprocess.check_output(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', path]).decode().strip()
    w, h = out.split('x')[:2]
    return int(w), int(h)


def render(src, dst, zoom, drift, seconds=LEN, fps=FPS):
    """Slow push from 1.0 to 1+zoom, with `drift` = (dx, dy) in fractions of the
    over-scan, so successive stills do not all move the same way."""
    w, h = probe(src)
    w -= w % 2; h -= h % 2
    n = int(seconds * fps)
    dx, dy = drift
    # upscale 2x before zoompan, then back down: kills the integer-origin judder
    zexpr = f'1+{zoom}*on/{n - 1}'
    # x/y walk from one corner of the available over-scan to the other
    xexpr = f'(iw-iw/zoom)*({0.5 - dx / 2}+{dx}*on/{n - 1})'
    yexpr = f'(ih-ih/zoom)*({0.5 - dy / 2}+{dy}*on/{n - 1})'
    vf = (f'scale={w * 2}:{h * 2}:flags=lanczos,'
          f"zoompan=z='{zexpr}':x='{xexpr}':y='{yexpr}':d={n}:s={w * 2}x{h * 2}:fps={fps},"
          f'scale={w}:{h}:flags=lanczos,format=yuv420p')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-i', src,
                    '-vf', vf, '-frames:v', str(n),
                    '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', dst],
                   check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('workdir')
    ap.add_argument('--vertical', action='store_true', help='1080x1920 instead of 1920x1080')
    ap.add_argument('--seconds', type=float, default=LEN)
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    suffix = '_mvv.mp4' if a.vertical else '_mv.mp4'

    stills = [] if a.vertical else sorted(glob.glob(os.path.join(a.workdir, 'ss*.jpg')))
    cards = sorted(p for p in glob.glob(os.path.join(a.workdir, 'ev_*.png'))
                   if not p.endswith(('_v.png',)) or a.vertical)
    if a.vertical:
        cards = sorted(glob.glob(os.path.join(a.workdir, 'ev_*_v.png')))
    else:
        cards = sorted(p for p in glob.glob(os.path.join(a.workdir, 'ev_*.png'))
                       if not p.endswith('_v.png'))

    # four drift directions, cycled, so consecutive stills never move alike
    drifts = [(0.8, 0.5), (-0.7, -0.6), (0.6, -0.8), (-0.8, 0.7)]
    made = []
    # the blueprint still sits under the label section right after the logo sting AND
    # under the spec sheet at the end -- measured as two frozen blocks, 20-35 s and
    # 233-242 s. Gentle and centred: the labels are drawn over it at fixed positions.
    bg = os.path.join(a.workdir, 'still_bg.png')
    if os.path.exists(bg) and not a.vertical:
        dst = bg.rsplit('.', 1)[0] + suffix
        if a.force or not os.path.exists(dst):
            render(bg, dst, CARD_ZOOM, (0.0, 0.0), max(a.seconds, 20.0))
        made.append(dst)
        print('  bg   ', os.path.basename(dst))

    for i, src in enumerate(stills):
        dst = src.rsplit('.', 1)[0] + suffix
        if a.force or not os.path.exists(dst):
            render(src, dst, SS_ZOOM, drifts[i % 4], a.seconds)
        made.append(dst)
        print('  still', os.path.basename(dst))
    for i, src in enumerate(cards):
        dst = src.rsplit('.', 1)[0] + suffix
        if a.force or not os.path.exists(dst):
            render(src, dst, CARD_ZOOM, (0.0, 0.0), a.seconds)
        made.append(dst)
        print('  card ', os.path.basename(dst))
    print(f'{len(made)} moving clips in {a.workdir}')


if __name__ == '__main__':
    main()
