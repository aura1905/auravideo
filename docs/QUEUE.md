# 롱폼 후보 큐 — 2026-09-09 갱신

세 관문(`docs/CHANNEL.md` §8-B). 순서대로 걸러내는 게 아니라 셋을 다 보고 순위를 매긴다.

1. **이번 주에 올라온 데모인가.** 채널 정체성이라 예외 없음.
2. **파일 목록이 아니라 이야기가 있는가.** 크기·이름·빠진 것·있으면 안 되는 것 중
   한 문장으로 스크롤을 멈추게 할 사실.
3. **영상으로 계속 볼 만한 게임인가.** 이슈가 될 소재인가, 게임성이 독특한가.
   재미없을 것 같으면 거른다(사용자, 2026-09-06).

**후보 찾는 법**: `https://store.steampowered.com/search/?category1=10&sort_by=Released_DESC&supportedlang=english`
— `sort_by=Released`는 조용히 무시된다. **반드시 `Released_DESC`.**
엔진과 depot 크기는 SteamDB에서 손으로 본다(스크립트 fetch 차단, 탭 이동 필요).

## 이번 스캔 (2026-09-09)

Steam 검색 6페이지 300개 → 상세 조회 160개 → 전부 최근 5일. 그중 빌드까지 열어본 것:

| 데모 | appid | 등록 | 빌드 | 판정 |
|---|---|---|---|---|
| **1.44MB RESCUE** | 5139920 | 9/7 | **1023.22 KiB / 파일 2개** | **다음 편** |
| Did You See That? | 5164600 | 9/6 | 3.86 GiB | 보류 — 2인 협동이라 혼자 못 찍음 |
| Project Spooky | 4795370 | 9/5 | 3.07 GiB | 예비 |
| Night Portable | 5065360 | 9/5 | 743.43 MiB | 예비 |

### 제작 예정 — 1.44MB RESCUE (5139920)

본편 `5027770`, 1440 Works 자체 배급, Q4 2026 예정. 데모는 9/7 17:39 UTC 등록.

데모 전체가 **두 파일**이다.

```
game.exe          711.57 KiB
steam_api64.dll   311.65 KiB
```

관문 2를 가장 극단적인 방식으로 통과한다 — **읽을 파일 목록이 없다는 것 자체가 이야기다.**
엔진 런타임도, 데이터 폴더도, 에셋 번들도, 서드파티 DLL도 없다. 아트·사운드·코드가 전부
711 KB짜리 실행 파일 하나 안에 들어 있다. 그리고 이 데모에서 제일 큰 단일 의존성은
**밸브의 Steam API DLL**이고, 그게 데모 용량의 30%다.

바로 앞 편과 붙여 놓으면 그림이 선다:

| | 14화 Prenecrotic | 15화 1.44MB RESCUE |
|---|---|---|
| 크기 | 22.28 GiB | 1023 KiB |
| 파일 | 1,171개 | **2개** |
| 배수 | | **약 22,000배 차이** |

관문 3도 통과한다. 게임 자체가 1.44 MB 플로피를 복구하는 프로그래밍 퍼즐이고,
파이썬 비슷한 코드를 짜서 패처를 만든다. **소재가 곧 이 채널의 주제**다 — 용량.
데모가 자기가 구하려는 플로피보다 작다.

## 이번 스캔에서 눈에 띈 것들 (아직 빌드 안 봄)

- **5180670 Shrine Full of Anomalies** — 동방 2차 창작 이상현상 찾기. 13화와 장르가
  겹쳐서 당장은 안 쓴다.
- **4852000 ChocoPhobia** — 화염방사기로 살점 먹는 초콜릿을 태운다. 소재가 튄다.
- **5128940 PSYCHO CASKET** — "정통 이모 RPG", 뱀파이어.
- **5199770 The Day I Became a Werewolf**
- **5135710 AI School Simulator** — AI 학생들이 있는 학원물. AI 각도.
- **데스크톱 위젯 게임이 한 주에 넷** — 5069600 Desktop Forge, 5119870 TBF: Task Bar
  Fishing, 5125580 Goats and Shrubs: Desktop Topiary, 5191390 Kawaii Evolution Clicker
  Desktop Edition. 흐름으로는 흥미롭지만 **게임 하나를 깊게 파는 게 정체성**이라
  묶음 영상은 만들지 않는다(사용자, 2026-09-06).

## 이미 만든 것

| 데모 | appid | 편 |
|---|---|---|
| COMPARTMENT 666 : ANOMALY EXPRESS | 5016400 | 13화 + 쇼츠 |
| Prenecrotic: The Cursed School VR | 4947430 | 14화 |
| Rudravati: Curse of Bhankilla | 5105660 | 12화 + 쇼츠 |
| Voxotron | 5107400 | 쇼츠 s06 |
| Rising Above It | 5183320 | — 사용자 추천, 미제작 |
| Tasty Chef | 5067140 | 쇼츠 s05 |
| K-God Robot Hunters | 5084500 | 쇼츠 s04 |
