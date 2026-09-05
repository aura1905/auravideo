"""Narrate a script with ONE fixed Fish Audio voice and measure every line.

    python scripts/pipeline/tts_fish.py --script script.json --out C:/tmp/ep/pocket/tts [--voice ID] [--speed 1.0]

script.json: [{"id":"01","text":"...","vis":{...}}, ...]  (vis is passed through)
Writes tts/<id>.mp3 + .wav (48 kHz stereo) and script_timed.json with "dur" per line.

Rules (user): ONE fixed voice via reference_id — never Fish's default, which changes per
request (the first episode came back with 28 sentences in several different voices).
Write numbers the way they are read aloud: in English scripts spell them out ("seventy one
percent", "June fifteenth") rather than leaving digits, since the model reads digits
inconsistently. For the Korean episodes the rule was ranks/dates Sino-Korean ("삼십사 위")
and counters native ("서른아홉 개").
"""
import argparse, json, os, subprocess, time, urllib.request

KEY_FILE = 'C:/Git/docs/fishaudio.txt'
# The English channel's narrator: Fish Audio "Energetic Male", picked by the user 2026-09-03.
DEFAULT_VOICE = '802e3bc2b27e49c2995d23ef70e6ac89'
# The Korean episodes 01-03 used #11 '본부장님' — pass it with --voice if you ever rebuild them.
VOICE_KO = '474134178bb549f3b28d6d5d9c811e03'


def key():
    return open(KEY_FILE, encoding='utf-8').read().split()[1].strip()


def synth(text, voice, speed, out, k):
    body = json.dumps({'text': text, 'reference_id': voice, 'format': 'mp3', 'prosody': {'speed': speed}}).encode()
    req = urllib.request.Request('https://api.fish.audio/v1/tts', data=body,
                                 headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'model': 's2-pro'})
    for attempt in range(3):
        try:
            open(out, 'wb').write(urllib.request.urlopen(req, timeout=120).read()); return
        except Exception as e:
            print('retry', attempt, e); time.sleep(2)
    raise SystemExit('tts failed: ' + out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--script', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--voice', default=DEFAULT_VOICE); ap.add_argument('--speed', type=float, default=1.0)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--timed-out', help='where to write the timed script (default: <out>/../script_timed.json)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    segs = json.load(open(a.script, encoding='utf-8')); k = key(); total = 0
    for s in segs:
        # A 'beat' is footage with no narration: the trailer plays for that many seconds
        # with its own sound. Nothing to synthesise; the duration is the beat itself.
        if s.get('beat'):
            s['dur'] = float(s['beat']); s['wav'] = None; total += s['dur']
            print(s['id'], f"{s['dur']:5.2f}s", '(beat, no narration)')
            continue
        mp3 = os.path.join(a.out, f"{s['id']}.mp3"); wav = os.path.join(a.out, f"{s['id']}.wav")
        if a.force or not os.path.exists(mp3):
            synth(s['text'], a.voice, a.speed, mp3, k)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ar', '48000', '-ac', '2', wav], check=True)
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).decode().strip())
        s['dur'] = round(dur, 3); s['wav'] = wav.replace('\\', '/'); total += dur
        print(s['id'], f'{dur:5.2f}s', s['text'][:40])
    # Name the timed file after the SCRIPT, not a fixed 'script_timed.json' -- an episode
    # has both script.json and short.json, and the fixed name meant narrating the Short
    # silently overwrote the long-form's timings (build_plan / make_desc / make_srt all
    # read them). script.json -> script_timed.json, short.json -> short_timed.json.
    stem = os.path.splitext(os.path.basename(a.script))[0]
    out = a.timed_out or os.path.join(os.path.dirname(a.script), stem + '_timed.json')
    json.dump(segs, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('TOTAL', round(total, 1), 's ->', out)


if __name__ == '__main__':
    main()
