# 데모 찍먹 — 영상 한 편 자동 제작 파이프라인

2026-09-03에 첫 편(포켓 수선 / 口袋修仙, https://youtu.be/TmuPJpLNSwI)을 이 순서로 만들었다.
모든 단계가 스크립트 또는 브리지 명령으로 돌아가며, **사람(또는 Claude)의 판단이 들어가는 곳은 ★로 표시**했다.

```
① 게임 선정 ★ → ② 자료 수집 → ③ 분석·대본 ★ → ④ 나레이션(TTS) → ⑤ 브랜드·모션 레이어
→ ⑥ plan.json → ⑦ 데스크톱 앱 조립·export → ⑧ 썸네일 → ⑨ 유튜브 업로드 ★(확인)
```

작업 폴더는 편마다 하나: **`episodes/NN-slug/`** — 저장소 안에 두고 평평한 구조를 유지한다
(`plan.json`이 미디어를 파일 이름으로만 참조한다). 무엇을 커밋하고 무엇을 무시하는지는 `episodes/README.md`.
예제 설정: `scripts/pipeline/episode_example.json`.

## ① 게임 선정 ★

- 소스: 스팀 데모 허브의 **TOP DEMOS** 탭 (`https://store.steampowered.com/demos/?flavor=dailyactiveuserdemo`). 클라이언트 렌더링이라 curl로는 안 나오고 브라우저 자동화로 카드 목록을 읽는다(Show more 반복). 스팀 검색 API에는 데모 인기순이 없다.
- 후보마다 appdetails로 개발사·지원 언어를 받아 **한·중·일·대만 인디**를 거른다. 국가 판별 단서: 지원 언어(중국어만 등), 개발사명, 커뮤니티 링크(QQ 群), 웹사이트 도메인.
- 인디 기준: 인디 태그, 개발사=퍼블리셔 또는 소규모, 대형 퍼블리셔 제외.
- 최종 선택은 판단이다. "어떻게 만들었나"에 이야깃거리가 있는 게임(AI 사용 공시, 특이한 엔진, 1인 개발)이 이 채널에 맞는다.

## ② 자료 수집

```
python scripts/pipeline/steam_fetch.py --demo <데모 appid> --out episodes/<slug>
```
- 스토어 정보(영/중/한/일), 스크린샷 전부, 데모 리뷰 100개, `facts.json`.
- **SteamDB는 브라우저로**: `Technologies`(엔진), `AI Content Type`, 첫 등록일, 데모 용량, 트레일러 HLS 경로. curl은 403.
- 트레일러: **HLS 주소는 appdetails에 그대로 들어 있다** — `movies[0].hls_h264` (2026-09-04 확인). SteamDB를 거칠 필요 없다. `ffmpeg -i "<hls_264_master.m3u8>" -c copy trailer_main.mp4`. **fps를 확인할 것** — 60fps 트레일러는 컨택트 시트 눈금이 절반이 된다.
- 필요하면 bilibili/개발자 블로그 검색으로 제작 뒷이야기 보강.

## ②-B 빌드 분해 (Demo Dip의 차별점)

데모 빌드의 **파일 목록**이 스토어 페이지에 없는 사실을 말해준다. 순서:

1. `steamcmd`로 익명 다운로드를 **먼저 시도**한다:
   `steamcmd +force_install_dir <dir> +login anonymous +app_license_request <demo앱> +app_update <demo앱> validate +quit`
   — 데모 대부분은 `No subscription`으로 거부된다(Nomad Drive 확인). 계정 로그인은 하지 않는다.
2. 거부되면 **SteamDB depot 매니페스트**를 쓴다. 이게 공개돼 있고 사실상 같은 정보다:
   `steamdb.info/app/<demo앱>/depots/` → depot id → `steamdb.info/depot/<depotid>/`
   → 표 아래 페이지 크기를 `All`로 바꾸면 전체 파일 목록(이름·확장자·크기)이 나온다.
   **SteamDB는 페이지 안에서 `fetch()`도 차단한다** — 탭을 직접 이동해야 하고, 추출은 렌더된 DOM에서 한다.
3. **IL2CPP 빌드에서도 패키지 이름이 새어 나온다.** `GameAssembly.dll` 하나로 뭉쳐도
   `<게임>_Data/il2cpp_data/Resources/<어셈블리>.dll-resources.dat` 파일명에 원래 관리
   어셈블리 이름이 남는다(07화 Guildrun에서 24개 확인: `R3`, `ZLinq`, `NLog`, `Sentry.*`,
   `Mono.Data.Sqlite`, `Coffee.SoftMaskForUGUI` …).
   **단, 임베디드 리소스를 가진 어셈블리만 남는다** — 없다고 해서 패키지를 안 썼다는 뜻은
   아니다(06화 Expedition은 BCL 3개뿐이었다). "보이는 것"과 "전부"를 구분해서 말한다.
4. 읽어내는 것: 엔진과 렌더 파이프라인, 스크립팅 백엔드(Mono/IL2CPP), 서드파티 패키지 이름(`*.dll`),
   자체 어셈블리, 씬 개수와 크기 분포, Addressables 그룹 이름, 오디오 뱅크, 그리고 `*_DoNotShip` 같은 흔적.
5. 결과는 `episodes/NN-slug/teardown.md`에 **근거(파일명)와 해석을 분리해서** 적는다. 확인 안 된 것은
   "not verified / do not assert" 절에 따로 모은다(팀 규모, AI 사용 등).

**선**: 파일 목록·크기·메타데이터 분석까지만. 에셋 재배포, 코드 디컴파일, 미공개 콘텐츠 노출은 하지 않는다.

## ②-C 리뷰 코퍼스 분석

```
python scripts/pipeline/analyze_reviews.py --app <demo앱> --out episodes/<slug> --pages 8
```
- 최근 리뷰 최대 800개를 모아 언어 분포, **플레이타임 중간값**(`playtime_at_review`), 주제별 긍/부정 빈도,
  도움됨 순 상위 부정·긍정 리뷰 원문을 뽑는다.
- 목적은 **빌드에서 찾은 기술 선택을 실제 반응과 연결**하는 것. Nomad Drive에서는
  HDRP + 프레임 캡 없음 → "메뉴에서 GPU 99%" → **"크립토 마이너다"라는 상위 부정 리뷰**로 이어졌다.
  이 연결이 없으면 그냥 파일 목록 나열이 된다.

## ③ 분석·대본 ★

- 구성은 `docs/CHANNEL.md` §2를 따른다. 영어 편 04 기준 38문장 / 4분 51초:
  훅 2 → 게임 소개 5 → **분해 22** → 리뷰 반응 3 → 스펙 시트·판정 6. 분해에 시간을 몰아준다.
- 파일 목록을 말하는 문장은 **증거 카드**를 `vis` 이미지로 쓴다(스크린샷보다 훨씬 티어다운답다):
  `python scripts/motion/render_evidence_card.py OUT.png --title "THE ENGINE" --lines "파일명|해석" ">결론"`
- 영어 대본은 숫자를 **읽는 대로 풀어 쓴다**("seventy one percent", "June fifteenth"). 숫자 표기를 남기면 TTS가 흔들린다.
- 대본은 `script.json`: `[{"id":"01","sec":"hook","text":"…","vis":{"type":"image","file":"ss02.jpg","zoom":1.3}}, …]`. `vis.type`은 `image`(스크린샷) 또는 `video`(트레일러, `in` 초). 훅 2문장은 청사진 스틸 위에서 재생되므로 vis가 무시된다.
- 숫자는 **읽는 그대로** 쓴다: 순위·날짜는 한자어("삼십사 위", "오월 오일"), 개·명·달은 고유어("서른아홉 개", "넉 달").
- 확정 사실과 추정을 구분해 말한다("추정됩니다"). 개발자에게 항의받을 단정은 피한다.
- 점수 5항목(아이디어·완성도·아트·접근성·기술적 흥미)과 라벨 4개(엔진·팀·기간·특징)를 `episodes/NN-slug/episode.json`에 적는다.

## ④ 나레이션

```
python scripts/pipeline/tts_fish.py --script episodes/<slug>/script.json --out episodes/<slug>/tts
```
- **자막은 원문, 발음은 사전 (영어도 동일).** `script.json`의 `text`는 자막 표기(IL2CPP, SQLite, FMOD, DLL,
  .txt, asmdef, MCP). 발음은 사람이 쓰지 않는다 —
  `python scripts/pipeline/pron_ko.py --script script.json --out script_tts.json --dict scripts/pipeline/pron_en.json`
  이 `text=발음, sub=원문`인 `script_tts.json`을 만들고, TTS·build_plan·make_srt·make_desc는 그 파일을 쓴다
  (`episode.json`의 `script_timed`를 `script_tts_timed.json`으로). 04~07화 초기본은 발음을 자막에 직접 써서
  화면과 자막 트랙에 "I L two C P P"가 나갔다(2026-09-05 수정). 오독 위험 토큰은 사전에 추가한다:
  PvE→"P v E", LINQ→"link", VRoid→"V-roid", HDRP→"H D R P".
- Fish Audio s2-pro, 영어 채널의 고정 음성은 **"Energetic Male"** (`reference_id 802e3bc2b27e49c2995d23ef70e6ac89`, `tts_fish.py`의 기본값). 한국어 편 01–03은 `--voice 474134178bb549f3b28d6d5d9c811e03`. 기본 음성은 호출마다 목소리가 바뀌므로 절대 쓰지 않는다.
- 문장별 mp3/wav와 길이가 **`<대본이름>_timed.json`**에 기록된다(`script.json` → `script_timed.json`, `short.json` → `short_timed.json`). 이 길이가 타임라인의 기준이다.
  **주의**: 예전에는 출력 이름이 `script_timed.json`으로 고정이라, 쇼츠를 나레이션하면 롱폼 타이밍 파일을 조용히 덮어썼다(2026-09-04에 실제로 발생). 지금은 대본 파일명에서 따온다. 덮어썼다면 `tts/*.wav` 길이를 ffprobe로 재서 복원할 수 있다 — 재합성할 필요 없다.
- 다른 음성을 고르려면 `C:\Git\lordoflord\tools\voice_casting\data\fish_audio_curated.json`(한국어 검증 1,357개)에서 후보를 뽑아 같은 문장으로 샘플을 만든다.

## ⑤ 브랜드·모션 레이어 (docs/MOTION.md 참고)

```
python scripts/motion/render_intro_layers.py assets/brand/demo_dip_logo_rgba.png     # 편마다 동일, 한 번만
python scripts/motion/render_spec_layers.py '[["ENGINE","Unity 6 / HDRP"],["TEAM","not disclosed"],["IN DEV","devlogs since 2024"],["STACK","Mirror + EOS"],["THE TRICK","license the hard parts"]]' --verdict "WORTH A DIP"   # 영어 편. 한국어 편은 render_score_layers.py
for n in mark title sub: ffmpeg -framerate 30 -i lf_$n/f%03d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le intro_$n.mov
for n in header row_0 row_1 row_2 row_3 row_4 stamp: ffmpeg ... sc_$n/f%03d.png ... score_$n.mov
```
- 청사진 스틸: gpt-image-2로 **글자 없이** 생성("NO TEXT", 그 게임의 핵심 오브젝트 + 청사진 격자, 좌우 여백). `still_bg.png`.
- 편 폴더에 `intro_*.mov`, `score_*.mov`, `still_bg.png`, `logo_c_rgba.png`(=assets/brand/demo_dip_badge_rgba.png)를 둔다.

### 스틸에 움직임 굽기 — **필수**

```
python scripts/motion/kenburns.py episodes/<slug>              # ss*.jpg, ev_*.png, still_bg.png
python scripts/motion/kenburns.py episodes/<slug> --vertical   # 쇼츠용 ev_*_v.png만 (나머지는 가로와 공유)
```

AuraVideo에는 키프레임이 없다. 스크린샷·증거카드·청사진을 그대로 놓으면 **1픽셀도 움직이지 않는다.**
2026-09-05에 측정한 결과 롱폼의 41~64%, 쇼츠의 43~78%가 완전 정지 화면이었다 —
목소리만 나오는 구간이 러닝타임의 절반이었다는 뜻이다. 트레일러가 45~75초인데
자막 카드를 빼면 쓸 수 있는 실사가 20~30초뿐이라, 4분을 채우려면 구조적으로 그렇게 된다.

`kenburns.py`가 스틸마다 느린 푸시+드리프트를 미리 구워 `<stem>_mv.mp4`(세로는 `_mvv.mp4`)로 만들고,
`build_plan.py`가 자동으로 바꿔 낀다. 대본은 "화면에 **무엇**이 나오나"만 말하면 된다.

- 세기는 측정으로 정했다: 스크린샷 1.00→1.24(16초), 증거카드·청사진 1.00→1.10.
  카드는 글자판이라 크게 밀면 읽던 자리를 놓치고 우상단 출처 줄이 잘린다.
- **클립은 소스 해상도를 그대로 유지한다.** 캔버스 크기로 강제하면 3:2인 `still_bg.png`가
  가로로 18.5% 늘어난다(실제로 4·5화 마스터에 들어갔다가 이전 렌더와 프레임 비교로 발견).

## ⑥ plan.json

```
python scripts/pipeline/build_plan.py --episode episode.json --out episodes/<slug>/plan.json
```
- **콜드 오픈**(훅 문장이 실제 게임 화면 위에서 먼저, 0~15초) → 로고 스팅 3.4초(밝은 컷 + 로고 3레이어 + 효과음) → 청사진 스틸 + 라벨 4개 → 본편(문장별 스크린샷/증거카드/트레일러) → 스펙 시트(7레이어) → 마무리. 워터마크·BGM·효과음 큐는 스팅 위치에 맞춰 자동으로 밀린다.
- `cold_open_lines`(기본 = `hook_lines`)가 스팅 앞에 놓을 문장 수, `still_lines`(기본 2)가 스틸 위에 놓을 문장 수. **로고를 맨 앞에 두지 않는 이유**는 `docs/CHANNEL.md` §2 — 구독자 0명 채널에서 로고 인트로는 이탈 버튼이다.
- 트랙: 오버레이 트랙 7개를 먼저 추가하고 배경 트랙을 **마지막**에 추가한다(`track.add`는 뒤에 붙는다).

## ⑦ 조립·export (데스크톱 앱, 브리지)

```
AURAVIDEO_AGENT=1 AURAVIDEO_AGENT_FILE=C:/tmp/agent.json src-tauri/target/debug/auravideo.exe
python scripts/motion/bridge_build.py --file C:/tmp/agent.json --workdir episodes/<slug> --out episodes/<slug>/final.mp4 --shots "" --no-export
python scripts/agent_client.py export '{"outPath":"episodes/<slug>/intro_only.mp4","rangeStart":0,"rangeEnd":6.5}' --file C:/tmp/agent.json
python scripts/agent_client.py export '{"outPath":"episodes/<slug>/final.mp4","encoder":"libx264","quality":"standard"}' --file C:/tmp/agent.json
```
- **핸드셰이크 파일이 안 생기면 앱을 의심하기 전에 실행 파일이 무슨 이름을 읽는지부터 본다.**
  `grep -a -o -E "(AURAVIDEO|NABIVIDEO)_AGENT(_FILE)?" src-tauri/target/debug/*.exe`.
  2026-09-06에 하루치 작업이 여기서 막혔다: 9월 4일 커밋 e1a07f5가 환경 변수를 `AURAVIDEO_*`로
  바꿨는데 디버그 빌드는 9월 3일 것이라 옛 이름 `NABIVIDEO_*`만 알았고, 앱은 창까지 멀쩡히 뜨면서
  브리지만 조용히 꺼져 있었다. 소스를 바꿨으면 `npx @tauri-apps/cli build --debug --no-bundle`로
  실행 파일도 같이 갱신한다. (덤으로 확인한 것: Vite가 죽어 있어도, WebView2 프로필의 IndexedDB가
  14GB여도 앱은 뜬다. 그건 원인이 아니었다.)
- `export`의 `outPath`는 **절대 경로**로 준다(상대 경로는 ffmpeg가 "No such file"로 거부한다).
  긴 export는 `agent_client.py --timeout 3000` — 기본 120초를 넘기면 클라이언트만 끊기고 앱은 계속 렌더한다.
- 인트로·점수 구간만 먼저 range export해서 프레임을 뽑아 본 뒤 전체를 돌린다(1080p 3.5분 ≈ 10분).
- 검증은 export된 파일에서 한다. **프레임 격자만 보고 통과시키지 말 것** — 한 장짜리 프레임으로는
  "움직이는가"를 볼 수 없어서, 05~07화가 4~8초 정지화면으로 시작하는 채로 검수를 통과했다.

```
python scripts/pipeline/check_render.py episodes/<slug>/final.mp4 episodes/<slug>/short.mp4
```

  오프닝 움직임(원시 프레임을 파이썬에서 직접 차분), 라우드니스, 길이를 잰다.
  눈금: **완전 정지 0.002~0.006 / 켄번즈 푸시 0.11~0.40 / 실사 1.6~3.9.**
  ffmpeg `tblend`로 재는 첫 버전은 정지 오프닝을 3.55로 읽어 통과시켰다 — 측정 자체를
  아는 정답(정지 클립·움직이는 클립)으로 검증하기 전에는 믿지 않는다.

- **프레임 격자도 따로 본다.** 측정으로 안 잡히고 눈으로만 보이는 결함이 실제로 세 종류 나왔다:
  청사진 가로 늘어남, 세로 증거카드 좌우 잘림, 스펙시트 뒤 검은 구간. 앞의 둘은
  **이전 렌더와 같은 시각의 프레임을 나란히 놓아야** 보인다.
- **프리뷰 캡처로 알파 클립을 판단하지 말 것**(프리뷰 잔상 버그).
- **export 중에는 다른 ffmpeg을 돌리지 말 것.** 4분 1080p 그래프 하나가 8~16 GB를 쓴다.
  다른 세션이 동시에 렌더하면 27 GB 머신이 스왑에 들어가 export가 멈춘다.
  세션마다 `AURAVIDEO_AGENT_FILE`을 다르게 줘서 앱 인스턴스를 분리한다.
- `agent_client.py`의 HTTP 대기가 먼저 끝나도 앱 안의 ffmpeg는 계속 돈다. 파일이 `ffprobe`로 열릴 때까지 기다린다.
### 트레일러는 스팀보다 퍼블리셔 공식 유튜브가 훨씬 낫다 (2026-09-05)

스팀 HLS의 최고 변형은 **1080p / 5.8 Mbps**뿐이고, 60fps 트레일러라면 프레임당 비트가 절반이라
전투 장면이 뭉개진다. FF Resonance 공식 유튜브에는 같은 트레일러가 **1440p60 10.5 Mbps,
4K60 23 Mbps**로 올라와 있다(사용자 승인, "유튜브 공식 트레일러 써도 무방해").

```
python -m yt_dlp -F <url>                                  # 변형 확인
python -m yt_dlp -f "308+251" --merge-output-format mkv -o yt.mkv <url>   # 1440p60 + opus
ffmpeg -i yt.mkv -vf "scale=1920:1080:flags=lanczos,fps=30" -crf 15 -preset medium trailer_yt.mp4
```

1440p를 1080p로 **내려서** 쓰는 게 1080p 소스보다 선명하다. 퍼블리셔 본인의 홍보 자산에만
쓴다 — 남의 플레이 영상은 쓰지 않는다([[feedback-trailer-first-shorts-paired]]).

**화면을 확대해 화질을 깎지 말 것.** 트레일러에 자막이 구워져 있으면 `episode.json`의
`sub_mask`로 아래쪽에 어두운 띠를 덮는다. 10화에서 1.18배 확대로 가리려다 픽셀아트가
뭉개졌고 사용자가 바로 알아챘다.

- **하드웨어 인코더는 도움이 안 된다(측정, 2026-09-05).** 76초 쇼츠를 `h264_amf`로 돌려 4분 14초 —
  `libx264`와 같다. 병목은 인코딩이 아니라 입력 30개를 동시에 디코드·스케일하는 필터 그래프다.
  한 편 20~25분은 이 노트북에서의 정상값이고, 줄이는 방법은 **재렌더를 없애는 것**이다:
  조립 뒤 15초 구간 export를 2~3곳 먼저 뽑아(1분) 엔드카드·내장 자막·크롭을 확인하고
  풀 export는 한 번만 돌린다.
- **export는 항상 `rangeStart`/`rangeEnd`를 명시한다.** 범위 없이(자동 트림) 돌린 68초 쇼츠가
  두 번 연속 36초(영상 스트림은 4.5초)에서 끝났고, 같은 타임라인을 `rangeStart:0, rangeEnd:68.164`로
  돌리니 온전히 나왔다(2026-09-05). 원인은 못 잡았다 — 범위를 주는 게 확실한 우회다.
- 교체 업로드 후에는 **쇼츠 설명의 "Full teardown" 링크가 현재 롱폼 ID인지** 확인한다.
  롱폼을 다시 교체하면 ID가 또 바뀐다(7화에서 물러난 ID로 한 번 나갔다).

## ⑧ 썸네일

```
python scripts/motion/make_thumbnail.py --bg episodes/<slug>/ss00.jpg --out episodes/<slug>/thumb.jpg \
    --tag "중국 인디 데모 · 1인 개발" --line1 "포켓 수선(口袋修仙)" --line2 "AI로 혼자 4달 만에?" --focus right --title-size 120
```
- 규칙(사용자): 헤드라인은 **"한글이름(원어)"**, 점수 도장 없음, 글자 크게, 뱃지 좌하단, 배경은 게임 키아트.

## ⑨ 유튜브 업로드 ★

```
python scripts/youtube_upload.py upload episodes/<slug>/final.mp4 --title "…" --desc-file desc.txt --tags "…" --privacy public --thumb thumb.jpg
```
- 채널은 `--channel`로 고른다: `demodip`(기본, Demo Dip) / `aimc`(구 한국어 편 01–03). 채널마다 토큰이 따로다 — `C:\Git\docs\youtube_token_<채널>.json`. 만료되면 `auth --channel <채널>`을 돌리고 **브라우저 동의 화면에서 그 채널을 골라야** 한다(스크립트가 매번 토큰의 채널 id를 대조해 불일치면 거부).
- 하루 한도는 **업로드 6편**(할당량 10,000 / 업로드당 1,600).
- **API로 공개 업로드가 된다**(사용자 확인, 2026-09-04). 예전 메모에 있던 "심사 전에는 비공개로 잠긴다"는 제약은 이 프로젝트에 해당하지 않는다.
- **예약 공개**: `--publish-at "2026-09-05 08:00"`(KST로 읽어 UTC로 변환) → 비공개로 올라가고 그 시각에 유튜브가 공개로 바꾼다. 응답에 `publishAt`이 안 남으면 스크립트가 경고를 찍으니 그때만 Studio에서 직접 지정한다.
- 업로드 시각 기준: 한국 시간 **오전 8시 / 오후 8시**(북미 저녁·유럽 저녁). 하루 2편이면 두 편은 반드시 다른 게임으로.
- 설명은 스크립트로 생성한다: `python scripts/pipeline/make_desc.py --episode <ep.json> --out desc.txt --hook "..." --takeaway "..."`
  (스팀 링크, 스펙 시트, 챕터, 추정·저작권 고지, 해시태그 3개 — 순서는 `docs/CHANNEL.md` §7 고정).
  챕터 시각은 `build_plan.py`와 같은 상수(INTRO 3.0 / GAP 0.4)로 다시 계산하므로 두 파일을 같이 고쳐야 한다.
- **업로드는 매번 사용자 확인 후** 실행한다.

## 아직 손이 가는 곳 (자동화 다음 목표)

1. ① 데모 랭킹 수집을 브라우저 자동화 스크립트로 고정(puppeteer-core, `scripts/pup/` 참고).
2. ③ 대본 생성을 LLM 호출로 스크립트화(facts.json + 리뷰 → script.json). 지금은 Claude가 세션에서 쓴다.
3. ⑦ 앱 실행부터 export까지 한 명령으로 묶기(`make_episode.py`).
4. 프리뷰의 알파 클립 잔상 버그 수정.
