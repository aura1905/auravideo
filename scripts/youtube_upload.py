"""Upload a finished video to YouTube (Data API v3, resumable upload).

    python scripts/youtube_upload.py auth --channel demodip     # browser consent, stores that channel's token
    python scripts/youtube_upload.py upload VIDEO.mp4 --channel demodip --title "..."         --desc-file desc.txt --tags "a,b" --privacy private|unlisted|public         [--thumb thumb.jpg] [--captions captions.en.srt] [--playlist ID] [--lang en]

Credentials: C:/Git/docs/youtube_oauth_client.json (OAuth desktop client) and one
token per channel at C:/Git/docs/youtube_token_<channel>.json. Never print either.

One Google account (hanaura@gmail.com) owns several brand channels, and a token is
bound to whichever channel was picked in the consent screen, so they cannot share a
single token file. `--channel` selects the token file; during `auth` pick the matching
channel in the browser. Every run re-checks the token's channel id against CHANNELS
and refuses to upload to the wrong one.

    demodip  UC_yuhFg577gfaCQVO4KXwyg   Demo Dip -- English, the series (default)
    aimc     UCjBAu9usnhkNa_vFFFr4cyg   AIMC -- episodes 01-03, Korean

Tags matter very little for ranking (YouTube says so, and it holds up). The title, the
words actually spoken in the video, and the caption track are what search reads, so
`--captions` is worth using on every episode: the ASR mangles studio names and package
names, which is exactly the vocabulary this channel gets found by.

Quota: an upload costs 1600 of the 10,000 daily units (~6 uploads/day); a caption
insert is 400 more, a thumbnail 50.
Videos from an unaudited API project are forced to private by YouTube until the
project passes the compliance audit -- switch to public in Studio, or get audited.
"""
import argparse, datetime, json, os, sys, time, zoneinfo

CLIENT = 'C:/Git/docs/youtube_oauth_client.json'
TOKEN_FMT = 'C:/Git/docs/youtube_token_{}.json'
CHANNELS = {  # channel key -> (channel id, default content language)
    'demodip': ('UC_yuhFg577gfaCQVO4KXwyg', 'en'),
    'aimc': ('UCjBAu9usnhkNa_vFFFr4cyg', 'ko'),
}
DEFAULT_CHANNEL = 'demodip'
# captions().insert needs force-ssl; youtube.upload alone returns 403 insufficient scope.
SCOPES = ['https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube',
          'https://www.googleapis.com/auth/youtube.force-ssl']


def token_path(channel):
    if channel not in CHANNELS:
        sys.exit(f'unknown channel {channel!r}; known: {", ".join(CHANNELS)}')
    return TOKEN_FMT.format(channel)


def creds(channel):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    tok = token_path(channel)
    c = None
    if os.path.exists(tok):
        # Compare against what the FILE records, not against SCOPES: passing SCOPES to
        # from_authorized_user_file overwrites the credential's scope list, so
        # has_scopes() would then be comparing SCOPES with itself and always pass.
        # A refresh never re-consents, so when SCOPES grows the old grant stays short
        # and the API answers 403 "insufficient scopes" — start a new flow instead.
        stored = set(json.load(open(tok, encoding='utf-8')).get('scopes') or [])
        if stored >= set(SCOPES):
            c = Credentials.from_authorized_user_file(tok, SCOPES)
        else:
            print('>> stored grant is missing a scope; asking for consent again')
    if c and c.expired and c.refresh_token:
        c.refresh(Request())
    if not c or not c.valid:
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT, SCOPES)
        # Opens the system browser; the user signs in and clicks Allow themselves.
        print(f'>> pick the "{channel}" channel in the browser consent screen', flush=True)
        c = flow.run_local_server(port=0, prompt='consent', open_browser=True)
    with open(tok, 'w', encoding='utf-8') as f:
        f.write(c.to_json())
    return c


def service(channel):
    from googleapiclient.discovery import build
    return build('youtube', 'v3', credentials=creds(channel), cache_discovery=False)


def check_channel(yt, channel):
    """The token, not the CLI flag, decides which channel gets the upload -- so verify."""
    want = CHANNELS[channel][0]
    items = yt.channels().list(part='snippet,statistics', mine=True).execute().get('items', [])
    for it in items:
        s = it['snippet']; st = it.get('statistics', {})
        print(json.dumps({'channel': s['title'], 'id': it['id'], 'subscribers': st.get('subscriberCount'),
                          'videos': st.get('videoCount')}, ensure_ascii=False))
    ids = [it['id'] for it in items]
    if want not in ids:
        sys.exit(f'token at {token_path(channel)} is for {ids} but --channel {channel} means {want}; '
                 f'delete that token file and re-run auth, picking the right channel')


def cmd_auth(a):
    check_channel(service(a.channel), a.channel)


KST = zoneinfo.ZoneInfo('Asia/Seoul')


def publish_at(spec):
    """'2026-09-05 08:00' (KST, the user's clock) or a full RFC3339 stamp -> UTC RFC3339.

    YouTube wants UTC with a Z suffix; a naive local string is read as KST because
    that is the timezone the schedule is planned in.
    """
    spec = spec.strip()
    try:
        dt = datetime.datetime.fromisoformat(spec.replace('Z', '+00:00'))
    except ValueError:
        sys.exit(f'--publish-at: cannot parse {spec!r}; use "2026-09-05 08:00" or RFC3339')
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=KST)
    if dt <= datetime.datetime.now(datetime.timezone.utc):
        sys.exit(f'--publish-at is in the past: {dt.isoformat()}')
    return dt.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def scheduled_slots(yt):
    """Every future publishAt already on the channel, as {UTC RFC3339: title}.

    Includes videos that are still private/unlisted, which is exactly the set a
    plain channel listing does not show you.
    """
    ch = yt.channels().list(part='contentDetails', mine=True).execute()['items']
    if not ch:
        return {}
    up = ch[0]['contentDetails']['relatedPlaylists']['uploads']
    ids, page = [], None
    while True:
        r = yt.playlistItems().list(part='contentDetails', playlistId=up,
                                    maxResults=50, pageToken=page).execute()
        ids += [i['contentDetails']['videoId'] for i in r['items']]
        page = r.get('nextPageToken')
        if not page:
            break
    slots = {}
    for i in range(0, len(ids), 50):
        for v in yt.videos().list(part='snippet,status', id=','.join(ids[i:i + 50])).execute()['items']:
            at = v['status'].get('publishAt')
            if at:
                slots[at] = v['snippet']['title']
    return slots


def cmd_upload(a):
    from googleapiclient.http import MediaFileUpload
    yt = service(a.channel)
    check_channel(yt, a.channel)
    desc = open(a.desc_file, encoding='utf-8').read() if a.desc_file else (a.desc or '')
    lang = a.lang or CHANNELS[a.channel][1]
    body = {
        'snippet': {'title': a.title, 'description': desc, 'tags': [t.strip() for t in a.tags.split(',') if t.strip()],
                    'categoryId': a.category, 'defaultLanguage': lang, 'defaultAudioLanguage': lang},
        'status': {'privacyStatus': a.privacy, 'selfDeclaredMadeForKids': False},
    }
    if a.publish_at:
        # A scheduled video must be uploaded private; YouTube flips it public itself.
        body['status']['privacyStatus'] = 'private'
        body['status']['publishAt'] = publish_at(a.publish_at)
        # Two videos in the same slot is the mistake that actually happened (episodes
        # 06-07 were scheduled on top of 04-05 because the queue was never read first).
        # Scheduled videos are private, so nothing in the public channel shows the clash.
        taken = scheduled_slots(yt)
        clash = taken.get(body['status']['publishAt'])
        if clash and not a.allow_slot_clash:
            sys.exit(f"--publish-at {body['status']['publishAt']} is already taken by "
                     f"{clash!r}. Pick another slot, or pass --allow-slot-clash if two "
                     f"videos really should go out together.")
        print('scheduled for', body['status']['publishAt'], '(UTC)')
        if taken:
            print('   queue:', ', '.join(sorted(taken)))
    media = MediaFileUpload(a.video, chunksize=8 * 1024 * 1024, resumable=True, mimetype='video/mp4')
    req = yt.videos().insert(part='snippet,status', body=body, media_body=media)
    t0 = time.time(); resp = None
    while resp is None:
        status, resp = req.next_chunk()
        if status:
            print(f'  {status.progress() * 100:5.1f}%  {time.time() - t0:5.0f}s', flush=True)
    vid = resp['id']
    st = resp['status']
    print(json.dumps({'id': vid, 'url': f'https://youtu.be/{vid}', 'privacy': st['privacyStatus'],
                      'publishAt': st.get('publishAt'), 'uploadStatus': st.get('uploadStatus')},
                     ensure_ascii=False))
    if a.publish_at and not st.get('publishAt'):
        print('WARNING: YouTube did not keep the schedule -- the video stayed plain private. '
              'An unaudited API project cannot publish; schedule it by hand in Studio.')
    if a.thumb:
        # A custom thumbnail needs a *verified* channel (youtube.com/verify). Without it
        # the API returns 403 — which must not abort the caption upload that follows,
        # so this is reported and stepped over rather than raised.
        try:
            yt.thumbnails().set(videoId=vid, media_body=MediaFileUpload(a.thumb)).execute()
            print('thumbnail set')
        except Exception as e:
            print('WARNING: thumbnail rejected —', str(e)[:160])
            print('  the channel is probably unverified; verify at youtube.com/verify, '
                  'then set the thumbnail in Studio or re-run with --thumb-only')
    if a.captions:
        yt.captions().insert(
            part='snippet',
            body={'snippet': {'videoId': vid, 'language': lang, 'name': '', 'isDraft': False}},
            media_body=MediaFileUpload(a.captions, mimetype='application/octet-stream'),
        ).execute()
        print('captions uploaded', a.captions)
    if a.playlist:
        yt.playlistItems().insert(part='snippet', body={'snippet': {'playlistId': a.playlist,
                                  'resourceId': {'kind': 'youtube#video', 'videoId': vid}}}).execute()
        print('added to playlist', a.playlist)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    def chan(p):  # per-subcommand so it can be written after the verb
        p.add_argument('--channel', default=DEFAULT_CHANNEL, choices=sorted(CHANNELS),
                       help=f'which channel/token to use (default {DEFAULT_CHANNEL})')
        return p
    chan(sub.add_parser('auth'))
    u = chan(sub.add_parser('upload'))
    u.add_argument('video'); u.add_argument('--title', required=True)
    u.add_argument('--desc'); u.add_argument('--desc-file')
    u.add_argument('--tags', default=''); u.add_argument('--privacy', default='private', choices=['private', 'unlisted', 'public'])
    u.add_argument('--category', default='20')  # 20 = Gaming
    u.add_argument('--thumb'); u.add_argument('--playlist')
    u.add_argument('--captions', help='SRT track to attach (scripts/pipeline/make_srt.py writes one)')
    u.add_argument('--lang', help="content language override, e.g. en / ko (default: the channel's)")
    u.add_argument('--allow-slot-clash', action='store_true',
                   help='permit --publish-at to reuse a slot another scheduled video holds')
    u.add_argument('--publish-at', help='schedule: "2026-09-05 08:00" (KST) or RFC3339. '
                                        'Forces privacy=private until that moment.')
    a = ap.parse_args()
    {'auth': cmd_auth, 'upload': cmd_upload}[a.cmd](a)
