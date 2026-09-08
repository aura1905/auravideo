"""Derive the TTS text from the caption text with a pronunciation dictionary.

    python scripts/pipeline/pron_ko.py --script script.json --out script_tts.json

The authored line (`text`) is the caption: Latin names and figures as they should be
read on screen -- FMOD, DLL, 2.68 GiB, $95. A voice reads those literally ("깁",
"에프엠오디"), so the TTS needs a spoken form. That form is NOT written by hand:
`pron_ko.json` maps token -> pronunciation and this script applies it mechanically,
longest key first. Nothing else in the sentence can change, which is the whole point --
a hand-edited TTS text drifted from the caption once already and the viewer noticed.

Output lines carry `text` = spoken form (for tts_fish.py) and `sub` = the original
caption (build_plan.py prefers `sub` for captions when present).
"""
import argparse, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))


def load_dict(path):
    d = json.load(open(path, encoding='utf-8'))
    d.pop('_comment', None)
    return sorted(d.items(), key=lambda kv: -len(kv[0]))   # longest first


def spoken(text, table):
    for k, v in table:
        text = text.replace(k, v)
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--script', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--dict', default=os.path.join(HERE, 'pron_ko.json'))
    a = ap.parse_args()
    table = load_dict(a.dict)
    lines = json.load(open(a.script, encoding='utf-8'))
    out, leftovers = [], []
    for x in lines:
        if 'text' not in x:          # a beat: footage with no narration, nothing to pronounce
            out.append(dict(x)); continue
        cap = x['text']
        sp = spoken(cap, table)
        y = dict(x); y['text'] = sp; y['sub'] = cap
        out.append(y)
        for tok in re.findall(r'[A-Za-z][A-Za-z0-9#.+-]*', sp):
            leftovers.append((x['id'], tok))
    json.dump(out, open(a.out, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    changed = sum(1 for x, y in zip(lines, out) if x.get('text') != y.get('text'))
    print(f'{a.out}: {len(out)} lines, {changed} with a spoken form')
    if leftovers:
        print('사전에 없는 영문 토큰 (TTS가 글자대로 읽는다):')
        for i, t in leftovers:
            print(f'  line {i}: {t}')


if __name__ == '__main__':
    main()
