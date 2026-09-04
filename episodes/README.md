# episodes/ — 편별 작업 폴더

한 편 = 한 폴더 (`NN-slug`). **폴더는 평평하게** 둔다: `plan.json`이 미디어를 파일 이름으로만
참조하고 `bridge_build.py --workdir`가 그 폴더를 기준으로 풀기 때문에, 하위 폴더로 나누면 경로가 깨진다.

| 파일 | 성격 | git |
|---|---|---|
| `episode.json` | 편 설정(제목, 앱 아이디, 인트로 컷, 라벨, 점수, 썸네일, 유튜브 메타) | 추적 |
| `script.json` / `script_timed.json` | 대본과 문장별 길이 | 추적 |
| `plan.json` | 타임라인 (build_plan.py 산출물) | 추적 |
| `facts.json`, `appdetails_*.json`, `reviews.json` | 수집한 스팀 자료 | 추적 |
| `desc.txt`, `analysis*.md`, `thumb.jpg`, `still_bg.png` | 유튜브 설명, 분석 노트, 썸네일, 청사진 배경 | 추적 |
| `ss*.jpg`, `trailer_*.mp4`, `tts/`, `intro_*.mov`, `score_*.mov`, `final.mp4` | 소재·중간물·마스터 | **제외** (`.gitignore`) |

제외된 것들은 전부 재생성 가능하다: `scripts/pipeline/steam_fetch.py`(소재) →
`tts_fish.py`(나레이션) → `scripts/motion/render_*_layers.py`(모션 레이어) →
`build_plan.py` → `bridge_build.py`(조립·렌더). 절차는 `docs/PIPELINE.md`.

## 편 목록

| 편 | 게임 | 국가 | 결과 |
|---|---|---|---|
| 01 | 포켓 수선 (口袋修仙) | 중국 | https://youtu.be/TmuPJpLNSwI |
| 02 | 세피리아 (Sephiria) | 한국 | https://youtu.be/KPBBbfE0DC4 |
| 03 | 비스트포크 바버 (Beastfolk Barber / 異獸髮廊) | 대만 | https://youtu.be/7poPc-v8cqA |
| 03s | 〃 쇼츠 (9:16, 46초) | 대만 | https://youtube.com/shorts/wkqTp0crqDM |
