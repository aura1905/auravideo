# 인트로 · 점수 장면 제작법 (데모 찍먹 시리즈)

AuraVideo에는 키프레임이 없다. 그래서 **움직이는 요소는 전부 알파 채널 영상(ProRes 4444)으로
미리 렌더**하고, AuraVideo 타임라인에는 **요소 하나 = 클립 하나 = 트랙 하나**로 얹는다.
그러면 타이밍·위치·볼륨을 편집기에서 요소별로 따로 만질 수 있다. 이 원칙은 사용자가 정한 것이다:

- 마크 / 제목 / 부제는 **각각 독립된 요소**로 만들고 하나씩 컨트롤한다.
- 등장·퇴장에 **반드시 움직임**이 있어야 한다. 화면 전체를 덮는 로고 카드는 쓰지 않는다.
  **첫 프레임은 밝은 실제 배경(게임 트레일러)** 위에서 시작한다.
- 요소마다 **효과음**을 붙인다.
- 로고와 글자에는 **두꺼운 남색 외곽선 + 진한 그림자**.
- 제목 글자의 중심이 화면 중심 근처에 오도록 한다.

## 파일

| 경로 | 내용 |
|---|---|
| `scripts/motion/render_intro_layers.py` | 로고 PNG(RGBA)를 마크/제목/부제 3 밴드로 자동 분리해 3개의 알파 영상 프레임 시퀀스로 렌더 |
| `scripts/motion/render_score_layers.py` | (한국어 편 01–03) 점수 장면 7 레이어(헤더, 항목 5, 평균 도장) |
| `scripts/motion/render_spec_layers.py` | (영어 편) 스펙 시트 7 레이어. **레이어 이름·타이밍이 점수 장면과 동일**해서 `build_plan.py`와 효과음 큐를 안 건드린다. 값은 모노로 한 글자씩 타이핑되어 들어온다 |
| `scripts/motion/render_evidence_card.py` | 파일 목록 증거 카드 스틸(1920×1080 PNG). 대본의 `vis` 이미지로 쓴다. **하단 1/4(`CAPTION_TOP` 아래)는 자막 자리로 비워 둔다** — 5화에서 카드 하단 출처 줄이 자막과 겹쳤고, 출처는 제목 옆으로 옮겼다 |
| `scripts/motion/bridge_build.py` | `plan.json`을 읽어 데스크톱 앱 브리지로 트랙 추가·임포트·클립·자막 배치·캡처·export |
| `episodes/NN-slug/` | 편별 작업 폴더. `episode.json`·`script.json`·`plan.json`은 추적하고 소재·레이어·마스터는 gitignore (`episodes/README.md`) |
| `scripts/motion/gen_brand_mark.py` | 브랜드 마크 이미지 생성(gpt-image-2). 프롬프트는 `episodes/_brand_en/mark_prompt.txt` |
| `scripts/motion/cut_brand_mark.py` | 생성된 마크의 네이비 배경을 **테두리에서 플러드 필**로 제거해 RGBA로. 전역 색거리 방식은 마크 자체 외곽선을 먹어치운다 |
| `scripts/motion/build_brand_lockup.py` | 마크 + 워드마크를 조립해 로고/뱃지/아바타 3종 출력 |
| `assets/brand/demo_dip_mark_rgba.png` | 마크만(컨트롤러가 물에 잠긴 그림). 로고·뱃지의 공통 소스 |
| `assets/brand/demo_dip_logo_rgba.png` | 세로형 로고. 인트로 소스. **외곽선 없는 평면 채색** — 인트로 스크립트가 밴드별로 외곽선·그림자를 입히므로 |
| `assets/brand/demo_dip_badge_rgba.png` | 원형 뱃지(워드마크 포함). 썸네일 좌하단용 |
| `assets/brand/demo_dip_avatar_rgba.png` | 원형 아바타(마크만). 채널 프로필용 — 워드마크는 96px 이하에서 판독 불가 |
| `assets/brand/demo_jjikmeok_*` | 구 한국어 브랜드(데모 찍먹). 에피소드 01–03용, 신규 사용 안 함 |
| `assets/brand/blueprint_pouch_bg.png` | 청사진 스틸(글자 없음). 라벨 장면·점수 장면 배경 |
| `assets/sfx/` | 효과음 라이브러리 (README 참고) |

로고 원본은 gpt-image-2로 생성하고 배경은 PIL로 제거해 RGBA로 만든다. 세 단계가 스크립트로 남아 있다:

```
python scripts/motion/gen_brand_mark.py episodes/_brand_en/mark_dip.png --prompt-file episodes/_brand_en/mark_prompt.txt --n 3
python scripts/motion/cut_brand_mark.py episodes/_brand_en/mark_dip_2.png assets/brand/demo_dip_mark_rgba.png --thresh 14
python scripts/motion/build_brand_lockup.py
```

주의할 점 둘:

- **배경 제거 임계값.** 마크의 외곽선(4,14,48)과 배경(6,21,57)의 채널 합산 색차가 18뿐이다. 처음 쓴 `--thresh 40`은 플러드 필이 외곽선을 통과해 선을 전부 지워버렸다(측정: 외곽선이 투명 틈으로 남음). 14가 선을 살리면서 배경 잡티도 남기지 않는 값.
- **워드마크는 모델이 아니라 PIL로 그린다.** 첫 뱃지에서 gpt-image가 `How'd they make this?`의 물음표를 빼먹었다. 글자는 Anton(제목)·Inter Bold(부제)로 직접 조판한다.
- **로고의 두 빈 줄을 지우지 말 것.** `render_intro_layers.py`가 알파가 완전히 0인 행을 찾아 마크/제목/부제로 자른다. 검증: 새 로고에서 `bands mark (22,487) title (555,774) sub (808,901)`, 3 밴드 × 102 프레임 정상 렌더.

젓가락은 왜 뺐나: 채널이 영어권으로 바뀌면서 "젓가락으로 소스에 찍는다"(찍먹)가 번역되지 않는다. `dip a toe in`(잠깐 담가본다)은 같은 뜻이 영어에 그대로 있어서, 마크를 **컨트롤러가 물에 잠기고 파문이 퍼지는** 그림으로 바꿨다. 식기가 없어 문화 중립이고 48px에서도 형태가 읽힌다.

## 1. 인트로 (3.4초)

```
python scripts/motion/render_intro_layers.py assets/brand/demo_dip_logo_rgba.png
for k in mark title sub: ffmpeg -framerate 30 -i lf_$k/f%03d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le intro_$k.mov
```

- 스크립트가 로고의 알파를 행 단위로 스캔해 빈 줄로 **3 밴드(마크/제목/부제)** 를 나눈다. 밴드가 3개가 아니면 assert.
- 각 레이어에 외곽선 12px(남색) + 그림자(블러 7, 오프셋 10/14)를 입힌다.
- 모션 (초):
  - 마크: 0.0~0.7 위에서 낙하 + 살짝 회전, ease-out-back 바운스 → 2.7~3.2 위로 퇴장 + 페이드
  - 제목: 0.35~0.95 왼쪽에서 오버슈트 슬라이드 → 2.8~3.25 오른쪽으로 퇴장
  - 부제: 0.85~1.35 아래에서 떠오름 + 페이드인 → 2.75~3.15 페이드아웃
- 배경: 트레일러의 **밝고 움직임 있는 컷** (口袋修仙은 사계절 지도 5.6~9.0초). `transformScale 1.25`로 살짝 확대해 하단 캡션을 화면 밖으로 밀어냄. **어둡게 하지 않는다.**
- 트랙: 배경은 **마지막에 추가한 트랙**(뒤), 레이어는 v1/v2/v3. (`track.add`로 추가한 트랙은 뒤로 붙는다.)
- 효과음 (A3, 각각 클립): 0.02 whoosh_drop, 0.35 whoosh_title, 0.58 thud, 0.85 blip_sub, 1.05 chime, 2.72 whoosh_exit, 3.05 ui_open, 3.6부터 0.45초 간격으로 label_blip ×4.
- 3.0초부터 청사진 스틸로 전환, 라벨 4개(엔진/팀/기간/AI)는 **자막**으로 얹는다. 이미지 안에 글자를 굽지 않는다 — 편마다 값이 바뀌고, 생성 모델의 한글은 믿을 수 없다.

## 2. 점수 장면 (14.2초, 나레이션 "점수 드리겠습니다…" ~ "한 줄 평…")

```
python scripts/motion/render_score_layers.py '[["아이디어",8],["완성도",5],["아트",6],["접근성",3],["기술적 흥미",9]]'
for n in header row_0 row_1 row_2 row_3 row_4 stamp: ffmpeg ... sc_$n/f%03d.png ... score_$n.mov
```

- 레이어 7개: 헤더(위에서 낙하), 항목 5개(왼쪽에서 슬라이드, 0.95초 간격, 막대 0.7초 채움 + 숫자 카운트업, 7점↑ 청록), 평균 도장(2.2→1.0 축소로 "쾅" + 바운스, 판정 리본).
- 판정은 평균으로 자동: 8.5↑ 꼭 사먹 / 6↑ 찍먹 각 / 4.5↑ 지켜보기 / 그 외 패스.
- 레이아웃: 항목 x=110 폭 1180, 도장 중심 (1590, 560) — 겹치지 않게 좌/우 분리.
- 퇴장: 13.3초부터 항목 오른쪽으로(0.08초 간격), 도장 축소, 헤더 위로.
- 배경: 청사진 스틸. 트랙: 오버레이 트랙 7개를 먼저 추가하고 배경 트랙을 **마지막**에 추가.
- 효과음: 항목마다 whoosh_title + label_blip(0.8초 후), 도장에 thud + chime, 퇴장 whoosh_exit.
- 타이밍 상수(`ROW_IN`, `STAMP_T`, `EXIT_T`)는 나레이션 길이에 맞춰 수정. 섹션 시작 = "점수 드리겠습니다" 자막 시작 시각.

## 3. 조립과 확인

```
AURAVIDEO_AGENT=1 AURAVIDEO_AGENT_FILE=C:/tmp/agent_pc.json src-tauri/target/debug/auravideo.exe
python scripts/motion/bridge_build.py --file C:/tmp/agent_pc.json --workdir episodes/<slug> --out episodes/<slug>/final.mp4 --shots "" --no-export
python scripts/agent_client.py export '{"outPath":"episodes/<slug>/intro_only.mp4","rangeStart":0,"rangeEnd":6.5}' --file C:/tmp/agent_pc.json
```

- 구간 export(`rangeStart/rangeEnd`)로 인트로·점수 장면만 먼저 뽑아 확인하고, 통과하면 전체 export.
- **프리뷰 캡처로 알파 영상 클립을 판단하지 말 것.** 알파 프록시(WebM)를 탐색할 때 프리뷰가 이전 프레임을 겹쳐 그리는 버그가 있어 잔상처럼 보인다. export에는 없다(프레임 추출로 확인됨). 고쳐야 할 버그.
- 나레이션은 Fish Audio `reference_id` 고정(11번 '본부장님', s2-pro). 순위·날짜는 한자어 수사로 쓴다("삼십사 위").

## 4. 다음 편에서 바꾸는 것

1. `episodes/NN-slug/episode.json`을 새로 쓰고 `build_plan.py`로 plan을 생성 → 인트로 컷, 라벨 4개, 점수 5개, 썸네일 문구.
2. 청사진 스틸을 그 게임의 핵심 오브젝트로 새로 생성(gpt-image-2, "NO TEXT").
3. 인트로 배경으로 쓸 트레일러의 밝은 컷 in/out 지정. 트레일러 fps를 확인할 것(60fps면 컨택트 시트 눈금이 절반이다).
4. `render_score_layers.py`에 점수 JSON을 넘겨 다시 렌더.
