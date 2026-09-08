"""Weekly channel metrics: per-video views, Shorts subscriber conversion, watch hours.

    python scripts/pipeline/channel_metrics.py                      # Data API tier, snapshot + table
    python scripts/pipeline/channel_metrics.py --auth               # one-time: grant Analytics scope
    python scripts/pipeline/channel_metrics.py --out docs/METRICS.md
    python scripts/pipeline/channel_metrics.py --channel demodip --days 28

Two tiers, so it is useful before anyone clicks a consent screen:

  Data API  (existing upload token)  -> subscribers, per-video views/likes/comments, type
                                        (Short = <= 3 min), privacy, superseded re-uploads.
                                        Deltas come from the previous snapshot in docs/metrics/.
  Analytics (separate token, --auth) -> per-video estimatedMinutesWatched, subscribersGained /
                                        subscribersLost, averageViewDuration; channel watch hours
                                        for the trailing 365 days and Shorts views for 90 days --
                                        the two YPP counters. Conversion = subscribersGained / views.

Why this exists (docs/CHANNEL.md 2-C): Shorts bring the views, the close brings the
subscription, and the only way to know which Shorts subjects actually convert is to measure
subscribersGained per Short every week. YPP thresholds: 500 subs + 3,000 h (fan funding),
1,000 subs + 4,000 h or 10M Shorts views / 90 d (ads).

The Analytics token is its own file (youtube_token_<channel>_analytics.json) with read-only
scopes, so the upload token and its SCOPES list are never touched.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import youtube_upload as yu  # noqa: E402

AN_SCOPES = ['https://www.googleapis.com/auth/yt-analytics.readonly',
             'https://www.googleapis.com/auth/youtube.readonly']
AN_TOKEN_FMT = 'C:/Git/docs/youtube_token_{}_analytics.json'
SNAP_DIR = os.path.normpath(os.path.join(HERE, '..', '..', 'docs', 'metrics'))
SHORT_MAX_SEC = 180


def analytics_creds(channel, interactive):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    tok = AN_TOKEN_FMT.format(channel)
    c = None
    if os.path.exists(tok):
        c = Credentials.from_authorized_user_file(tok, AN_SCOPES)
        if c.expired and c.refresh_token:
            c.refresh(Request())
    if (not c or not c.valid) and interactive:
        from google_auth_oauthlib.flow import InstalledAppFlow
        flow = InstalledAppFlow.from_client_secrets_file(yu.CLIENT, AN_SCOPES)
        print(f'>> pick the "{channel}" channel in the browser consent screen', flush=True)
        c = flow.run_local_server(port=0, prompt='consent', open_browser=True)
        open(tok, 'w', encoding='utf-8').write(c.to_json())
    return c if (c and c.valid) else None


def iso_dur(s):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', s or '')
    h, mi, se = (int(x or 0) for x in m.groups()) if m else (0, 0, 0)
    return h * 3600 + mi * 60 + se


def data_tier(yt, cid):
    ch = yt.channels().list(part='snippet,statistics,contentDetails', id=cid).execute()['items'][0]
    up = ch['contentDetails']['relatedPlaylists']['uploads']
    ids, tok = [], None
    while True:
        r = yt.playlistItems().list(part='snippet', playlistId=up, maxResults=50, pageToken=tok).execute()
        ids += [i['snippet']['resourceId']['videoId'] for i in r.get('items', [])]
        tok = r.get('nextPageToken')
        if not tok:
            break
    vids = []
    for i in range(0, len(ids), 50):
        vids += yt.videos().list(part='snippet,statistics,contentDetails,status',
                                 id=','.join(ids[i:i + 50])).execute()['items']
    rows = []
    for v in vids:
        d = iso_dur(v['contentDetails']['duration'])
        title = v['snippet']['title']
        rows.append({'id': v['id'], 'published': v['snippet']['publishedAt'][:10], 'title': title,
                     'type': 'short' if d <= SHORT_MAX_SEC else 'long', 'sec': d,
                     'privacy': v['status']['privacyStatus'],
                     'superseded': title.startswith('[superseded]'),
                     'views': int(v['statistics'].get('viewCount', 0)),
                     'likes': int(v['statistics'].get('likeCount', 0)),
                     'comments': int(v['statistics'].get('commentCount', 0))})
    rows.sort(key=lambda r: (r['published'], r['id']))
    st = ch['statistics']
    return {'channel': ch['snippet']['title'], 'subscribers': int(st.get('subscriberCount', 0)),
            'views_total': int(st.get('viewCount', 0)), 'videos': rows}


def analytics_tier(creds, rows, days):
    from googleapiclient.discovery import build
    an = build('youtubeAnalytics', 'v2', credentials=creds, cache_discovery=False)
    today = dt.date.today()

    def q(**kw):
        return an.reports().query(ids='channel==MINE', **kw).execute()

    out = {'per_video': {}, 'channel': {}}
    y = q(startDate=(today - dt.timedelta(days=365)).isoformat(), endDate=today.isoformat(),
          metrics='estimatedMinutesWatched,views,subscribersGained,subscribersLost')
    r = (y.get('rows') or [[0, 0, 0, 0]])[0]
    out['channel'].update({'watch_hours_365d': round(r[0] / 60, 1), 'views_365d': int(r[1]),
                           'subs_gained_365d': int(r[2]), 'subs_lost_365d': int(r[3])})
    try:
        s = q(startDate=(today - dt.timedelta(days=90)).isoformat(), endDate=today.isoformat(),
              metrics='views', dimensions='creatorContentType')
        out['channel']['shorts_views_90d'] = int(next((row[1] for row in s.get('rows', []) if row[0] == 'SHORTS'), 0))
    except Exception as e:  # dimension not available on every account
        out['channel']['shorts_views_90d'] = f'n/a ({str(e)[:60]})'
    ids = [r['id'] for r in rows if r['privacy'] == 'public']
    for i in range(0, len(ids), 200):
        chunk = ids[i:i + 200]
        v = q(startDate=(today - dt.timedelta(days=days)).isoformat(), endDate=today.isoformat(),
              metrics='views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
              dimensions='video', filters='video==' + ','.join(chunk), maxResults=200, sort='-views')
        for row in v.get('rows', []):
            out['per_video'][row[0]] = {'views': int(row[1]), 'min_watched': round(row[2], 1),
                                       'avg_view_sec': round(row[3], 1),
                                       'subs_gained': int(row[4]), 'subs_lost': int(row[5])}
    return out


def load_prev():
    snaps = sorted(glob.glob(os.path.join(SNAP_DIR, '*.json')))
    return json.load(open(snaps[-1], encoding='utf-8')) if snaps else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--channel', default='demodip', choices=sorted(yu.CHANNELS))
    ap.add_argument('--days', type=int, default=28, help='Analytics per-video window')
    ap.add_argument('--auth', action='store_true', help='grant the Analytics scope (opens a browser)')
    ap.add_argument('--out', help='also write the markdown table here')
    a = ap.parse_args()

    if a.auth:
        c = analytics_creds(a.channel, interactive=True)
        print('analytics token:', 'ok' if c else 'FAILED')
        return

    yt = yu.service(a.channel)
    cid = yu.CHANNELS[a.channel][0]
    snap = data_tier(yt, cid)
    snap['date'] = dt.date.today().isoformat()
    prev = load_prev()
    if prev and prev.get('date') == snap['date']:
        prev = None  # same-day rerun: no meaningful delta
    prev_v = {v['id']: v for v in (prev or {}).get('videos', [])}

    an = None
    c = analytics_creds(a.channel, interactive=False)
    if c:
        try:
            an = analytics_tier(c, snap['videos'], a.days)
            snap['analytics'] = an
        except Exception as e:
            print('analytics failed:', str(e)[:200], file=sys.stderr)

    os.makedirs(SNAP_DIR, exist_ok=True)
    with open(os.path.join(SNAP_DIR, f"{snap['date']}.json"), 'w', encoding='utf-8') as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)

    L = [f"# {snap['channel']} — {snap['date']}", '']
    dsub = (snap['subscribers'] - prev['subscribers']) if prev else None
    L.append(f"구독 **{snap['subscribers']}**" + (f" ({dsub:+d} since {prev['date']})" if prev else ''))
    if an:
        ch = an['channel']
        L.append(f"시청시간(365일) **{ch['watch_hours_365d']} h** / 4,000 h · "
                 f"쇼츠 조회(90일) **{ch['shorts_views_90d']}** / 10,000,000 · "
                 f"구독 +{ch['subs_gained_365d']} −{ch['subs_lost_365d']}")
    else:
        L.append('시청시간·구독 전환: Analytics 토큰 없음 → `python scripts/pipeline/channel_metrics.py --auth`')
    L += ['', '| 날짜 | 형식 | 조회 | Δ | 좋아요 | 구독+ | 전환 | 평균시청(s) | 제목 |',
          '|---|---|---|---|---|---|---|---|---|']
    pub = [v for v in snap['videos'] if v['privacy'] == 'public']
    for v in sorted(pub, key=lambda x: -x['views']):
        d = (v['views'] - prev_v[v['id']]['views']) if v['id'] in prev_v else None
        pv = (an or {}).get('per_video', {}).get(v['id'], {})
        conv = f"{pv['subs_gained'] / pv['views'] * 100:.2f}%" if pv.get('views') else ''
        kind = '쇼츠' if v['type'] == 'short' else '롱폼'
        delta = f"{d:+d}" if d is not None else ''
        L.append(f"| {v['published'][5:]} | {kind} | {v['views']} | {delta} | {v['likes']} | "
                 f"{pv.get('subs_gained', '')} | {conv} | {pv.get('avg_view_sec', '')} | {v['title'][:48]} |")
    waste = [v for v in snap['videos'] if v['superseded'] or v['privacy'] != 'public']
    lost = sum(v['views'] for v in waste)
    L += ['', f"비공개/교체본 {len(waste)}개 (조회 {lost}회는 시청시간에 잡히지 않음)"]
    text = '\n'.join(L) + '\n'
    print(text)
    if a.out:
        with open(a.out, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)


if __name__ == '__main__':
    main()
