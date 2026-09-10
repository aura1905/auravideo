"""Check every episode's spoken numbers against the data we saved when we made it.

Ran for the first time on 2026-09-10 after a published Short got a store-page fact
backwards. Two real errors in eighteen published videos, both of them store-page
readings rather than manifest readings -- the manifest gets pasted, the store page
gets glanced at, and the glance is where it goes wrong.

    python scripts/pipeline/audit_claims.py            # all episodes
    python scripts/pipeline/audit_claims.py --slug 16-seaside-wash
"""
import argparse, json, glob, os, re

W = {'zero': 0, 'no': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
     'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12,
     'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
     'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
     'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000}
NUM = r'(?:(?:' + '|'.join(sorted(W, key=len, reverse=True)) + r'|\d+)[\s-]*(?:and[\s-]*)?)+'
CLAIM = re.compile(NUM + r'(languages?|reviews?)\b', re.I)


def to_int(s):
    s = s.strip().lower().replace(',', '')
    if s.isdigit():
        return int(s)
    tot = cur = 0
    for t in re.split(r'[\s-]+', s.replace(' and ', ' ')):
        if not t:
            continue
        if t.isdigit():
            cur += int(t); continue
        if t not in W:
            return None
        v = W[t]
        if v == 100:
            cur = max(cur, 1) * 100
        elif v == 1000:
            tot += max(cur, 1) * 1000; cur = 0
        else:
            cur += v
    return tot + cur


def truth_for(folder):
    out = {}
    ap = os.path.join(folder, 'appdetails_english.json')
    if os.path.exists(ap):
        j = json.load(open(ap, encoding='utf-8'))
        langs = re.sub('<[^>]+>', '', j.get('supported_languages') or '')
        out['language'] = len([x for x in langs.split(',') if x.strip()])
    for name in ('reviews_all.json', 'reviews.json'):   # the fresher file wins
        rp = os.path.join(folder, name)
        if os.path.exists(rp):
            try:
                n = json.load(open(rp, encoding='utf-8')).get('query_summary', {}).get('total_reviews')
                if n is not None:
                    out['review'] = n
                    break
            except Exception:
                pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--slug')
    a = ap.parse_args()
    bad = 0
    for d in sorted(glob.glob('episodes/*/')):
        slug = os.path.basename(d.rstrip(os.sep))
        if a.slug and slug != a.slug:
            continue
        t = truth_for(d)
        if not t:
            continue
        for sf in ('script.json', 'short.json'):
            p = os.path.join(d, sf)
            if not os.path.exists(p):
                continue
            for line in json.load(open(p, encoding='utf-8')):
                txt = line.get('text') or ''
                for m in CLAIM.finditer(txt):
                    kind = m.group(1).lower().rstrip('s')
                    said = to_int(m.group(0)[:-len(m.group(1))])
                    real = t.get(kind)
                    if said is None or real is None or said == real:
                        continue
                    # narration rounds on purpose -- "six thousand eight hundred reviews"
                    # for 6,803 -- and sometimes quotes a slice rather than the total
                    # ("of the last eight hundred reviews"). Only flag a flat, wrong number.
                    before = txt[max(0, m.start() - 40):m.start()].lower()
                    if re.search(r'(nearly|about|around|roughly|over|more than|almost|'
                                 r'the last|some|out of|of these)', before):
                        continue
                    if real and abs(said - real) / real < 0.02:
                        continue
                    bad += 1
                    print(f'MISMATCH  {slug}/{sf}  line {line["id"]}: said {said} {kind}s, '
                          f'saved data says {real}')
                    print(f'          {txt[:110]}')
    print('no mismatches' if not bad else f'{bad} to check by hand')
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
