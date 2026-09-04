"""Set a channel's branding (banner, description, keywords) over the YouTube Data API.

    python scripts/youtube_branding.py show   --channel demodip
    python scripts/youtube_branding.py banner --channel demodip assets/brand/demo_dip_banner.png
    python scripts/youtube_branding.py text   --channel demodip --desc-file d.txt --keywords "a,b,c"

Reuses the OAuth plumbing in youtube_upload.py -- the same per-channel token file,
which already carries the full `youtube` scope, so no re-consent is needed for a
channel that has already been authorised for uploads.

Banner: channelBanners.insert uploads the image and returns a url, which then has to
be written back with channels.update(part='brandingSettings'). YouTube wants
2560x1440; the readable part must sit inside the centre 1546x423 (mobile safe area).
Changing branding is a live, outward-facing edit -- print the current values first.
"""
import argparse, io, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import youtube_upload as yu


def get_channel(yt, channel):
    cid = yu.CHANNELS[channel][0]
    r = yt.channels().list(part='snippet,brandingSettings', id=cid).execute()
    items = r.get('items') or []
    if not items:
        sys.exit(f'channel {cid} not visible to this token')
    return items[0]


def cmd_show(a):
    yt = yu.service(a.channel)
    it = get_channel(yt, a.channel)
    bs = it.get('brandingSettings', {})
    print(json.dumps({'title': it['snippet']['title'],
                      'description': it['snippet'].get('description', ''),
                      'keywords': bs.get('channel', {}).get('keywords', ''),
                      'banner': bs.get('image', {}).get('bannerExternalUrl', '')},
                     ensure_ascii=False, indent=2))


def cmd_banner(a):
    from PIL import Image
    w, h = Image.open(a.image).size
    if (w, h) != (2560, 1440):
        print(f'warning: {w}x{h}, YouTube expects 2560x1440', file=sys.stderr)
    size = os.path.getsize(a.image)
    if size > 6 * 1024 * 1024:
        sys.exit(f'{size} bytes exceeds the 6 MB banner limit')
    yt = yu.service(a.channel)
    yu.check_channel(yt, a.channel)
    url = yt.channelBanners().insert(media_body=a.image).execute()['url']
    cid = yu.CHANNELS[a.channel][0]
    # channels.update replaces the whole brandingSettings part -- send the
    # existing `channel` block back or the API rejects it with 400 "Required"
    # (and a partial success would blank the description).
    keep = get_channel(yt, a.channel).get('brandingSettings', {}).get('channel', {})
    r = yt.channels().update(part='brandingSettings',
                             body={'id': cid, 'brandingSettings': {
                                 'channel': keep, 'image': {'bannerExternalUrl': url}}}).execute()
    print(json.dumps({'uploaded': a.image, 'bytes': size,
                      'banner': r['brandingSettings'].get('image', {}).get('bannerExternalUrl', url)},
                     ensure_ascii=False, indent=2))


def cmd_text(a):
    yt = yu.service(a.channel)
    yu.check_channel(yt, a.channel)
    it = get_channel(yt, a.channel)
    ch = dict(it.get('brandingSettings', {}).get('channel', {}))
    if a.desc_file:
        ch['description'] = io.open(a.desc_file, encoding='utf-8').read().strip()
    if a.keywords_file:
        ch['keywords'] = io.open(a.keywords_file, encoding='utf-8').read().strip()
    elif a.keywords is not None:
        ch['keywords'] = a.keywords
    if a.title:
        # The channel name lives in brandingSettings.channel.title; snippet.title
        # is read-only on channels.update.
        ch['title'] = a.title
    if not (a.desc_file or a.keywords_file or a.keywords is not None or a.title):
        sys.exit('nothing to change: pass --title, --desc-file and/or --keywords')
    cid = yu.CHANNELS[a.channel][0]
    r = yt.channels().update(part='brandingSettings',
                             body={'id': cid, 'brandingSettings': {'channel': ch}}).execute()
    print(json.dumps(r['brandingSettings'].get('channel', {}), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--channel', default=yu.DEFAULT_CHANNEL, choices=sorted(yu.CHANNELS))
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('show').set_defaults(fn=cmd_show)
    p = sub.add_parser('banner'); p.add_argument('image'); p.set_defaults(fn=cmd_banner)
    p = sub.add_parser('text'); p.add_argument('--title'); p.add_argument('--desc-file')
    p.add_argument('--keywords'); p.add_argument('--keywords-file')
    p.set_defaults(fn=cmd_text)
    a = ap.parse_args()
    a.fn(a)
