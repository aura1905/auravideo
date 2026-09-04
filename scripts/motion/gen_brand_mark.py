"""Generate a brand mark image with OpenAI's image model.

    python scripts/motion/gen_brand_mark.py OUT.png --prompt-file p.txt [--n 2] [--size 1024x1024]

The logo/badge marks are model-generated (gpt-image-2) and then background-removed
into RGBA by `cut_brand_mark.py`. Wordmark text is composited separately with PIL --
the model renders text unreliably (it dropped the "?" from "How'd they make this?"
in the first badge).

Key: C:/Git/docs/openai.txt (first non-empty line that looks like a key). Never print it.
"""
import argparse, base64, io, json, os, sys, urllib.request

KEY_FILE = 'C:/Git/docs/openai.txt'


def api_key():
    for line in io.open(KEY_FILE, encoding='utf-8'):
        line = line.strip()
        if line.startswith('sk-'):
            return line
    sys.exit(f'no sk- key found in {KEY_FILE}')


def generate(prompt, model, size, n):
    body = json.dumps({'model': model, 'prompt': prompt, 'size': size, 'n': n}).encode('utf-8')
    req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=body,
                                 headers={'Authorization': f'Bearer {api_key()}',
                                          'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read().decode('utf-8'))['data']


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--prompt'); ap.add_argument('--prompt-file')
    ap.add_argument('--model', default='gpt-image-2')
    ap.add_argument('--size', default='1024x1024')
    ap.add_argument('--n', type=int, default=1)
    a = ap.parse_args()
    prompt = io.open(a.prompt_file, encoding='utf-8').read() if a.prompt_file else a.prompt
    if not prompt:
        sys.exit('need --prompt or --prompt-file')
    root, ext = os.path.splitext(a.out)
    for i, d in enumerate(generate(prompt, a.model, a.size, a.n)):
        p = a.out if a.n == 1 else f'{root}_{i + 1}{ext}'
        open(p, 'wb').write(base64.b64decode(d['b64_json']))
        print(p, os.path.getsize(p))
