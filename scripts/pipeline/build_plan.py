"""Turn a narrated script + episode config into the plan.json that bridge_build.py assembles.

    python scripts/pipeline/build_plan.py --episode episode.json --out plan.json

episode.json (see scripts/pipeline/episode_example.json):
  workdir            folder with tts/, screenshots, trailers, intro_*.mov, score_*.mov, still_bg.png
  script_timed       script_timed.json from tts_fish.py (each line: id, text, dur, vis)
  intro_bg           {"file": "trailer_main.mp4", "in": 5.6, "out": 9.0, "scale": 1.25}  bright moving cut
  labels             4 strings for the blueprint scene ("엔진: Electron", ...)
  score_line_id      id of the "점수 드리겠습니다" line (score scene starts there, lasts 14.2 s)
  hook_lines         how many leading lines play over the blueprint still (default 2)
  bgm                {"file": "trailer_main.mp4", "volume": 0.10}
  narration_volume   default 1.6

Layout produced (front → back): v1 mark / watermark, v2 title, v3 subtitle layer,
v4..v10 score layers (added via track.add, in order), v11 background (added LAST so it
sits behind everything — appended tracks draw behind the defaults).
Audio: a1 narration, a2 bgm, a3 sfx (one clip per cue).
"""
import argparse, json, os, re, subprocess

GAP = 0.4
INTRO_LEN = 3.4      # the logo layer clips are 3.4 s long
# docs/CHANNEL.md: the episode opens COLD -- the hook plays over real game footage
# first, and the logo sting lands after it. A brand-new channel that opens on its own
# logo is asking a stranger to sit through an advert before the video starts.
# `cold_open_lines` (default: hook_lines) is how many script lines run before the sting.
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')).replace(os.sep, '/')
SFX_DIR = REPO + '/assets/sfx'   # absolute: bridge_build resolves plan files relative to the work folder otherwise


def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())


def aspect(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                                   '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', path]).decode().strip()
    w, h = (int(v) for v in out.split('x')[:2])
    return w / h


def wrap2(t):
    if len(t) <= 26:
        return t
    mid = len(t) // 2
    c = [m.end() for m in re.finditer(r'[,.!?]\s', t)] + [m.start() for m in re.finditer(r'\s', t)]
    b = min(c, key=lambda i: abs(i - mid)) if c else mid
    return t[:b].rstrip() + '\n' + t[b:].lstrip()


def wrap_n(t, width):
    """Greedy wrap for the 9:16 caption: Shorts put their buttons over the right edge,
    so a 16:9-width line runs straight under them."""
    words, lines, cur = t.split(), [], ''
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur); cur = w
        else:
            cur = f'{cur} {w}'.strip()
    if cur:
        lines.append(cur)
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--episode', required=True); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    ep = json.load(open(a.episode, encoding='utf-8'))
    wd = ep['workdir'].replace('\\', '/')
    segs = json.load(open(ep['script_timed'], encoding='utf-8'))
    # Canvas: 16:9 episode by default, 9:16 for a Short. Every layout constant
    # below is derived from these, so one builder serves both formats.
    cv = ep.get('canvas') or {}
    CW, CH = int(cv.get('width', 1920)), int(cv.get('height', 1080))
    VERT = CH > CW
    SCORE_LEN = float(ep.get('score_len', 9.5 if VERT else 14.2))
    # A 16:9 source in a 9:16 frame: 'blur' fills the sides with a blurred copy
    # instead of cropping the game away.
    FILL = ep.get('fill_mode', 'blur' if VERT else 'cover')
    # y is measured from the canvas centre; the bottom 16% of a Short belongs to its
    # title and handle, so the caption block sits well above that.
    # A 9:16 Short keeps the 16:9 source's full height, so a trailer's burnt-in dialogue
    # subtitles land exactly under our caption (FF Resonance). `sub_y` lifts the caption
    # clear of that band for the episode; the long-form crops it away with visual_scale.
    SUB = {'fontSize': 50, 'y': int(ep.get('sub_y', 330)), 'bgOpacity': 0.62} if VERT else {}
    LABEL_POS = ([(0, -640), (0, -500), (0, -360), (0, -220)] if VERT
                 else [(-560, -230), (560, -230), (-560, 60), (560, 60)])
    LABEL_FS = 46 if VERT else 40
    # 16:9 footage fitted into 9:16 is small; enlarge it (sides are cropped by the
    # canvas, the blurred fill covers the rest) so the game still reads on a phone.
    VIS_SCALE = float(ep.get('visual_scale', 1.0))
    # A Short lives in the SAME flat episode folder as the episode, so its
    # vertical layers and narration need distinct names.
    LP = ep.get('layer_prefix', '')
    TTS = ep.get('tts_dir', 'tts')
    WM = ({'transformScale': 0.14, 'transformX': 370, 'transformY': -830} if VERT
          else {'transformScale': 0.13, 'transformX': 810, 'transformY': -425})
    vid_dur = {}
    def vdur(f):
        if f not in vid_dur:
            vid_dur[f] = dur(os.path.join(wd, f))
        return vid_dur[f]

    plan = {'settings': {'width': CW, 'height': CH, 'fps': 30}, 'clips': [], 'subs': [],
            'tracks_extra': [{'kind': 'video', 'name': f'FX{i+1}'} for i in range(7)] + [{'kind': 'video', 'name': 'BG'},
                             {'kind': 'audio', 'name': 'TRL'}]}
    C, S = plan['clips'], plan['subs']
    BG = 'v11'
    TRL = 'a12'   # trailer sound under a beat (bridge_build: 9th extra track -> a12)
    hook_n = ep.get('hook_lines', 2)
    cold_n = int(ep.get('cold_open_lines', hook_n))     # lines that run BEFORE the logo sting
    still_n = int(ep.get('still_lines', 2))             # lines over the blueprint still, after it
    nvol = ep.get('narration_volume', 1.6)

    # A Short cannot spend 3.4 s on a logo, so `"sting": false` drops it (and the
    # blueprint still with it) and lets the narration run straight from zero.
    sting_on = ep.get('sting', True)
    cold_n = cold_n if sting_on else len(segs)
    still_n = still_n if sting_on else 0
    cold_len = sum(x['dur'] + GAP for x in segs[:cold_n])
    sting_at = round(cold_len + 0.2, 3)
    still_from, still_to = cold_n, cold_n + still_n

    # --- logo sting: a bright cut from the game + the three logo layers
    if sting_on:
        ib = ep['intro_bg']
        C.append({'track': BG, 'file': ib['file'], 'start': sting_at, 'in': ib['in'], 'out': ib['out'], 'fillMode': ib.get('fillMode', FILL), 'muted': True,
                  'transformScale': ib.get('scale', 1.0), 'saturation': 1.05, 'fadeIn': 0.2, 'fadeOut': 0.3})
        for tr, nm in (('v1', 'intro_mark'), ('v2', 'intro_title'), ('v3', 'intro_sub')):
            C.append({'track': tr, 'file': f'{LP}{nm}.mov', 'start': sting_at, 'in': 0, 'out': INTRO_LEN, 'fillMode': 'fit', 'muted': True})

    # --- blueprint still + staggered evidence labels, under the lines right after the sting
    # kenburns.py also renders a drifting version of the blueprint still; without it the
    # label section and the spec-sheet background are two frozen blocks in every episode.
    still_file = 'still_bg.png'
    for _mv in (['still_bg_mvv.mp4', 'still_bg_mv.mp4'] if VERT else ['still_bg_mv.mp4']):
        if os.path.exists(os.path.join(wd, _mv)):
            still_file = _mv
            break

    still_start = round(sting_at + INTRO_LEN, 3) if sting_on else 0.0
    still_end = still_start + sum(x['dur'] + GAP for x in segs[still_from:still_to])
    if still_n:
        C.append({'track': BG, 'file': still_file, 'start': still_start, 'in': 0, 'out': round(still_end - still_start, 3),
                  'fillMode': FILL, 'fadeIn': 0.3, 'fadeOut': 0.3})
        for i, (txt, (x, y)) in enumerate(zip(ep['labels'], LABEL_POS)):
            st = still_start + 0.4 + i * 0.45
            S.append({'text': txt, 'start': round(st, 3), 'duration': round(still_end - st - 0.2, 3), 'x': x, 'y': y, 'fontSize': LABEL_FS,
                      'bgColor': '#0b1a3a', 'bgOpacity': 0.85, 'bgPadding': 18, 'outline': 0, 'color': '#eafffb', 'fadeIn': 0.25, 'fadeOut': 0.3})

    # --- swap every still for its pre-rendered moving version, if one exists
    # scripts/motion/kenburns.py writes <stem>_mv.mp4 (or _mvv.mp4 for 9:16) next to
    # each screenshot and evidence card. Measured before this existed: 50-63% of a
    # long-form and 62-78% of a Short was a frozen picture. Substituting here rather
    # than rewriting every script keeps the scripts about *what* is on screen.
    mv_suffix = '_mvv.mp4' if VERT else '_mv.mp4'
    swapped = 0
    for s_ in segs:
        vis = s_.get('vis') or {}
        if vis.get('type') != 'image':
            continue
        stem = os.path.splitext(vis['file'])[0]
        # a 9:16 episode prefers its own card clips but shares the screenshot ones
        for cand in ([stem + mv_suffix, stem + '_mv.mp4'] if VERT else [stem + '_mv.mp4']):
            if os.path.exists(os.path.join(wd, cand)):
                vis['type'] = 'video'; vis['file'] = cand; vis['in'] = 0
                swapped += 1
                break
    if swapped:
        print(f'  {swapped} stills replaced with their moving version ({mv_suffix})')

    # --- the cold open must MOVE
    # A screenshot is "real game footage" in the sense docs/PIPELINE.md meant, but it is
    # frozen, and the first seconds are the ones that decide whether anyone stays.
    # Episodes 05-07 all shipped with 4-8 s of a still as their opening shot before this
    # check existed; episode 07's was 8.2 s.
    if segs and (segs[0].get('vis') or {}).get('type') != 'video':
        print(f"  WARNING line {segs[0]['id']}: the opening shot is "
              f"{(segs[0].get('vis') or {}).get('file')}, a still. The cold open holds it "
              f"frozen for {segs[0].get('dur', 0):.1f} s. Use a trailer clip for line 1.")

    # --- opening stamp (Shorts): the first second reads as a thumbnail
    # YouTube offers no custom thumbnail for a Short, only a frame pick, so the title is
    # drawn over the hook footage for the first 1.4 s and fades. Same words as the
    # vertical thumbnail so the two match.
    stamp = ep.get('opening_stamp')
    if stamp:
        base = {'x': 0, 'bgColor': '#0b1a3a', 'bgOpacity': 0.0, 'bgPadding': 0, 'outline': 10,
                'color': '#ffffff', 'fadeIn': 0.0, 'fadeOut': 0.35, 'start': 0.0,
                'duration': float(stamp.get('seconds', 1.4))}
        S.append({**base, 'text': stamp['line1'], 'y': int(stamp.get('y1', -560)),
                  'fontSize': int(stamp.get('size1', 108))})
        if stamp.get('line2'):
            S.append({**base, 'text': stamp['line2'], 'y': int(stamp.get('y2', -420)),
                      'fontSize': int(stamp.get('size2', 72)), 'color': '#19c6b7'})

    # --- narration + visuals
    t = 0.0
    score_t0 = None
    for idx, s in enumerate(segs):
        if idx == cold_n:
            t = still_start          # jump the timeline past the sting
        d = s['dur']; vis = s.get('vis') or {}
        # A beat is footage with no narration -- the trailer plays with its own sound.
        # "매번 플레이 영상에 대본을 써야 하는건 아님": the game gets to be seen on its own.
        is_beat = bool(s.get('beat'))
        span = d if is_beat else d + GAP
        if s['id'] == ep['score_line_id']:
            score_t0 = t
        if not is_beat:
            C.append({'track': 'a1', 'file': f"{TTS}/{s['id']}.wav", 'start': round(t, 3), 'in': 0, 'out': round(d, 3), 'volume': nvol})
        elif vis.get('type') == 'video':
            C.append({'track': TRL, 'file': vis['file'], 'start': round(t, 3), 'in': vis['in'],
                      'out': round(min(vdur(vis['file']), vis['in'] + span), 3),
                      'volume': float(ep.get('beat_volume', 0.55)), 'fadeIn': 0.4, 'fadeOut': 0.8})
        in_score = score_t0 is not None and t < score_t0 + SCORE_LEN - 0.5
        on_still = still_from <= idx < still_to
        if not on_still and not in_score and vis and vis.get('type') == 'continue':
            # Keep the previous shot running under this line instead of cutting. This is
            # how a trailer gets to play for 20-30 s unbroken while three lines of
            # narration go by -- one visual per line was making every shot 4-6 s long,
            # and the user's note was that the game itself never got to be seen.
            prev = next((c for c in reversed(C) if c['track'] == BG), None)
            if prev is not None:
                try:
                    avail = vdur(prev['file']) - prev['in']
                except Exception:
                    avail = None
                want = (prev['out'] - prev['in']) + span
                if avail is not None and want > avail:
                    print(f"  WARNING line {s['id']}: 'continue' runs {want - avail:.1f}s past the "
                          f"end of {prev['file']} -- the held shot will freeze on its last frame")
                    want = avail
                prev['out'] = round(prev['in'] + want, 3)
        elif not on_still and not in_score and vis:
            if vis['type'] == 'image':
                c = {'track': BG, 'file': vis['file'], 'start': round(t, 3), 'in': 0, 'out': round(span, 3), 'fillMode': FILL, 'fadeIn': 0.25, 'fadeOut': 0.25}
                c['transformScale'] = vis.get('zoom', VIS_SCALE)
                # A still authored at the canvas shape (an evidence card) must be shown
                # whole: scaling it the way 16:9 gameplay is scaled crops its edges off.
                try:
                    if abs(aspect(os.path.join(wd, vis['file'])) - CW / CH) < 0.05:
                        c['fillMode'] = 'fit'; c['transformScale'] = vis.get('zoom', 1.0)
                except Exception:
                    pass
            else:
                i0 = vis['in']; i1 = min(vdur(vis['file']), i0 + span)
                # A store trailer ends on a static "wishlist now" card. Cutting to it
                # reads as filler, and three different lines landing on the same card
                # (episode 06, first pass) looks like nobody watched the export.
                tail = vdur(vis['file']) - 15
                if i0 >= tail:
                    print(f"  WARNING line {s['id']}: {vis['file']} in={i0}s is within 15 s of "
                          f"the end ({vdur(vis['file']):.0f}s) — probably the end card")
                c = {'track': BG, 'file': vis['file'], 'start': round(t, 3), 'in': i0, 'out': round(i1, 3), 'fillMode': FILL, 'fadeIn': 0.25, 'fadeOut': 0.25, 'muted': True, 'transformScale': VIS_SCALE}
                # Same rule as the still branch: anything authored at the canvas shape
                # is shown whole. It matters here because kenburns.py turns evidence
                # cards into video clips, and without this the 9:16 cards lost their
                # left and right edges -- the first Short built this way cropped
                # "UnityPlayer.dll" down to "layer.dll".
                # Only for a still turned into a clip (kenburns' _mv/_mvv): a real trailer
                # that happens to match the canvas aspect must still honour visual_scale --
                # this override silently cancelled the 1.18x crop meant to remove the FF
                # Resonance trailer's burnt-in subtitles.
                if vis['file'].endswith(('_mv.mp4', '_mvv.mp4')):
                    try:
                        if abs(aspect(os.path.join(wd, vis['file'])) - CW / CH) < 0.05:
                            c['fillMode'] = 'fit'; c['transformScale'] = 1.0
                    except Exception:
                        pass
            C.append(c)
        # In 9:16 the score card fills the frame, so a caption over it would sit
        # on the stamp. The card shows the numbers and the narration says them.
        if not (VERT and in_score) and not is_beat:
            # A line may carry a separate `sub`: the TTS text spells foreign words the
            # way they are pronounced ("디엘엘"), which is what the voice needs, but a
            # caption must show the real token ("DLL") or the viewer cannot search for
            # it. When `sub` is absent the caption is the narration, as before.
            caption = s.get('sub') or s['text']
            if VERT:
                txt = wrap_n(caption, 26)
                # a five-line caption at 50 px would climb into the footage, so the
                # long ones shrink rather than push upward
                sub = {**SUB, 'fontSize': 50 if txt.count(chr(10)) < 3 else 42}
            else:
                txt, sub = wrap2(caption), SUB
            S.append({'text': txt, 'start': round(t, 3), 'duration': round(d + 0.15, 3), **sub})
        t += span
    total = t + 0.8

    # --- score scene: blueprint still + 7 layers
    if score_t0 is not None:
        T0 = score_t0
        C.append({'track': BG, 'file': still_file, 'start': round(T0 - 0.2, 3), 'in': 0, 'out': SCORE_LEN + 0.4, 'fillMode': FILL, 'fadeIn': 0.3, 'fadeOut': 0.3})
        layers = ['score_header'] + [f'score_row_{i}' for i in range(5)] + ['score_stamp']
        for i, n in enumerate(layers):
            C.append({'track': f'v{4+i}', 'file': f'{LP}{n}.mov', 'start': round(T0, 3), 'in': 0, 'out': SCORE_LEN, 'fillMode': 'fit', 'muted': True})

    # --- watermark badge, top-right, after the intro
    wm_from = round(sting_at + INTRO_LEN + 0.2, 3) if sting_on else 0.5
    C.append({'track': 'v1', 'file': 'logo_c_rgba.png', 'start': wm_from, 'in': 0, 'out': round(total - wm_from, 3),
              'fillMode': 'fit', 'transformOpacity': 0.6, 'fadeIn': 0.5, **WM})

    # --- bgm (trailer audio, looped in 60 s chunks)
    bgm = ep.get('bgm')
    if bgm:
        bt = 0.0
        while bt < total:
            seg = min(60.0, total - bt)
            C.append({'track': 'a2', 'file': bgm['file'], 'start': round(bt, 3), 'in': 0, 'out': round(seg, 3), 'volume': bgm.get('volume', 0.10), 'fadeIn': 1.0, 'fadeOut': 1.5})
            bt += seg

    # --- sfx cues (each its own clip on a3)
    # The sting's cue times are relative to it, not to zero, now that it moved.
    cues = [(n, sting_at + off, v) for n, off, v in
            ([('whoosh_drop', 0.02, 0.55), ('whoosh_title', 0.35, 0.5), ('thud', 0.58, 0.6), ('blip_sub', 0.85, 0.45),
              ('chime_complete', 1.05, 0.5), ('whoosh_exit', 2.72, 0.55), ('ui_open', 3.05, 0.5)]
             + [('ui_add', 3.6 + i * 0.45, 0.35) for i in range(4)])] if sting_on else []
    if score_t0 is not None:
        cues.append(('whoosh_drop', T0 + 0.1, 0.5))
        rt0, rgap = (1.4, 0.95) if SCORE_LEN > 12 else (0.9, 0.62)
        for i in range(5):
            tt = rt0 + i * rgap
            cues += [('whoosh_title', T0 + tt, 0.45), ('ui_add', T0 + tt + 0.55, 0.4)]
        st = rt0 + 5 * rgap + 0.35
        cues += [('thud', T0 + st + 0.2, 0.9), ('chime_complete', T0 + st + 0.45, 0.6),
                 ('whoosh_exit', T0 + (13.3 if SCORE_LEN > 12 else SCORE_LEN - 0.9), 0.5)]
    for n, tt, v in cues:
        f = f'{SFX_DIR}/{n}.wav'
        C.append({'track': 'a3', 'file': f, 'start': round(tt, 3), 'in': 0, 'out': round(dur(f), 3), 'volume': v})

    # --- close gaps on the background track
    # Nothing else is behind BG, so a gap there renders as black. Every episode had one
    # after the spec sheet, where the card's backdrop ended before the next line's visual
    # began: 0.24 s in episode 04, 0.87 s in 06, 2.92 s in 07 and 4.64 s in 05. Extend
    # the earlier clip over the gap, as far as its source actually has material.
    bgs = sorted([c for c in C if c['track'] == BG], key=lambda c: c['start'])
    closed = []
    for a_, b_ in zip(bgs, bgs[1:]):
        end = a_['start'] + (a_['out'] - a_['in'])
        gap = b_['start'] - end
        if gap <= 0.02:
            continue
        try:
            avail = vdur(a_['file']) - a_['in']
        except Exception:
            avail = None
        want = (a_['out'] - a_['in']) + gap + 0.1
        if avail is not None and want > avail:
            want = avail
        if want > (a_['out'] - a_['in']) + 0.02:
            a_['out'] = round(a_['in'] + want, 3)
            closed.append((round(end, 2), round(gap, 2)))
    if closed:
        print(f'  closed {len(closed)} background gap(s): '
              + ', '.join(f'{g}s at {t}s' for t, g in closed))

    plan['total'] = round(total, 3)
    json.dump(plan, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"plan: {CW}x{CH}, total {plan['total']}s, clips {len(C)}, subs {len(S)}, score at {score_t0}")


if __name__ == '__main__':
    main()
