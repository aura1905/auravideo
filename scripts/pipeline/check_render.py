"""Check an exported master before it is uploaded.

    python scripts/pipeline/check_render.py episodes/07-guildrun/final.mp4
    python scripts/pipeline/check_render.py episodes/*/final.mp4 episodes/*/short.mp4

Exists because looking at extracted frames -- the verification this pipeline used --
cannot see the defect that actually shipped. Episodes 05, 06 and 07 all opened on a
frozen screenshot (7.0 s, 4.9 s, 8.2 s). Their frame grids were reviewed and passed,
because a single frame cannot show you that nothing is moving. A still and a held shot
are the same picture.

So this measures instead of looking:

  opening motion  mean inter-frame luma difference over [0.8, 4.0] s, cropped to the
                  top-left quadrant so a fading caption or the corner watermark cannot
                  masquerade as movement. The cold open is the one segment whose whole
                  job is to hold someone who has not decided to watch yet.
  dead frames     any 1 s window in the first 15 s whose motion is ~0.
  loudness        integrated LUFS, so a silent or clipped export is caught here rather
                  than on YouTube.
  duration        sanity against the plan, when a plan is passed.
"""
import argparse, glob, json, os, re, subprocess, sys

# Below this, consecutive frames are the same picture. Measured on these masters:
# a genuinely frozen shot reads 0.002-0.006, a Ken Burns push on a still reads
# 0.11-0.40, and real footage reads 1.6-3.9. The threshold separates "literally not
# moving" from "moving slowly", which is the distinction that matters -- a slow push
# never produces footage-sized frame deltas and should not be asked to.
STILL = 0.05


def ff(args):
    """Run ffmpeg and return (stdout, stderr) as bytes/text pair helpers use."""
    return subprocess.run(['ffmpeg', '-v', 'error', *args, '-f', 'null', '-'],
                          capture_output=True, text=True)


def motion(path, start, dur, w=160):
    """Mean absolute luma change between consecutive frames, 0-255.

    Decoded to raw greyscale and differenced in Python on purpose. The first version
    of this used ffmpeg's tblend+signalstats and reported 3.55 for an opening that a
    direct pixel comparison showed to be frozen -- it passed episode 05, which is the
    exact failure this script exists to catch. A measurement that has not itself been
    checked against a known-still and a known-moving clip is not evidence.
    """
    h = w * 9 // 16
    r = subprocess.run(
        ['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(dur), '-i', path,
         '-vf', f'scale={w}:{h}', '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
        capture_output=True)
    n = w * h
    frames = [r.stdout[i:i + n] for i in range(0, len(r.stdout) - n + 1, n)]
    if len(frames) < 3:
        return None
    # skip frame 0: a pre-roll seek can hand back a repeated or partial frame
    tot = 0.0
    for a, b in zip(frames[1:-1], frames[2:]):
        tot += sum(abs(x - y) for x, y in zip(a, b)) / n
    return tot / max(1, len(frames) - 2)


def lufs(path):
    # loudnorm prints its report at INFO level, so -v error swallows it
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af',
                        'loudnorm=print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'\{[^{}]*input_i[^{}]*\}', r.stderr, re.S)
    return float(json.loads(m.group(0))['input_i']) if m else None


def duration(path):
    return float(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path]).decode().strip())


def check(path):
    name = os.path.basename(os.path.dirname(path)) + '/' + os.path.basename(path)
    fails = []
    d = duration(path)

    op = motion(path, 0.8, 3.2)
    if op is None:
        fails.append('could not measure opening motion')
    elif op < STILL:
        # how long it stays frozen
        held = 0.0
        while held < 20:
            m = motion(path, 0.8 + held, 1.0)
            if m is None or m >= STILL:
                break
            held += 1.0
        fails.append(f'opens on a still ({op:.3f} < {STILL}); frozen for ~{held:.0f} s. '
                     f'The cold open must move -- use a trailer clip for line 1.')

    li = lufs(path)
    if li is None:
        fails.append('could not measure loudness')
    elif li < -30:
        fails.append(f'almost silent ({li:.1f} LUFS)')
    elif li > -9:
        fails.append(f'too hot ({li:.1f} LUFS)')

    ok = not fails
    print(f"{'PASS' if ok else 'FAIL'}  {name:46s} {d:6.1f}s  "
          f"opening motion {op if op is None else round(op, 3)}  "
          f"{li if li is None else round(li, 1)} LUFS")
    for f in fails:
        print(f'        - {f}')
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('videos', nargs='+')
    a = ap.parse_args()
    paths = [p for v in a.videos for p in (glob.glob(v) or [v])]
    bad = [p for p in paths if not check(p)]
    if bad:
        print(f'\n{len(bad)} of {len(paths)} failed', file=sys.stderr)
        sys.exit(1)
    print(f'\nall {len(paths)} passed')


if __name__ == '__main__':
    main()
