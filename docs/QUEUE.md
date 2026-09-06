# 롱폼 후보 큐

기준은 `docs/CHANNEL.md` §8-B. **접속자 순위가 아니라 세 관문**으로 고른다.

1. 영상으로 봤을 때 계속 보게 되는 게임인가 — 트레일러·스샷에 인물이나 장면이 크게 잡힌
   HUD 없는 컷이 있는가. 메뉴·지도·UI뿐이면 4~6분을 못 버틴다.
2. 파일 목록이 아니라 이야기가 있는가.
3. 시청자가 옮길 한 문장이 남는가.

셋 중 하나라도 비면 쇼츠로만 낸다. 소재가 모자라면 편수를 줄이지 말고 더 넓게 찾는다.

**후보 찾는 법**: `https://store.steampowered.com/search/?category1=10&sort_by=Released_DESC&supportedlang=english`
(`_DESC`가 빠지면 스팀이 관련도순으로 되돌려 옛날 유명 데모만 나온다.)
엔진은 SteamDB의 **데모 appid** 페이지에서 손으로 확인한다.

## 제작 중

| 게임 | 데모 appid | 엔진 | 왜 |
|---|---|---|---|
| **Rudravati: Curse of Bhankilla** | 5105660 | Unity / **Mono** | 12화 제작 중. 빌드에 `MCPForUnity.Runtime.dll`과 `Unity.AI.MCP.Runtime.dll`이 **둘 다** 들어 있고 `Unity.InferenceEngine`(토크나이저 포함), `DirectML.dll` 13.4MB까지 있다. AI로 만든 흔적이 파일 목록에 통째로 남은 첫 사례. Mono라 `Assembly-CSharp.dll`이 그대로 있어 패키지 목록이 완전히 보인다. 에디터 전용 도구(`TinyGiantStudio.BetterInspector`, `BetterMesh`, `Unity.Recorder`, `Timeline.Samples.*` 6개)도 플레이어 빌드에 나갔다. 덤으로 SteamDB 본편명은 **RATNAVATI: Curse of Bhangarh**(실존 방가르 요새)인데 스토어에서 가상 이름으로 바꿨다. 인도 1인칭 호러, 영어·힌디 풀보이스, 9/6 등록 |

## 다음

| 게임 | 데모 appid | 등록 | 왜 |
|---|---|---|---|
| **K-God Robot Hunters** | 5084500 | 9/4 | 사용자 지목. 한국 신화 판타지 + 포커 로그라이크라는 조합이 특이하고, 키 아트가 이번 주 후보 177편 중 상위권(애니 사이버펑크 여신, 네온 도시). 8개 언어(영·중·일·한 포함). 개발사 StoneIronGames. **엔진 미확인 — SteamDB 확인 필요** |

## 그림으로 걸러낸 예비 후보 (2026-09-06)

이번 주 신규 데모 600편 → 트레일러+스샷 5장 이상+영어 지원 177편 → 키 아트 전수 확인.
접속자는 전부 0~2명이라 기준에서 뺐다.

| 게임 | 데모 appid | 메모 |
|---|---|---|
| PRIDEBLOOD -Born of Claws- | 4767890 | **Godot + C#** — 채널 첫 고도. DLL 186개 중 161개가 `System.*`, 게임 코드는 3.44MB뿐. "C#을 고르면 78MB가 붙는다"가 관문 3. 스샷 19장·트레일러 3개로 자료 최다. `_startup_check.log.err`도 나갔다 |
| Mo Wu Tian Gong | 4343680 | 무협, 손그림 키 아트, 트레일러 3개, 간체 |
| Airlock | 5017790 | 사실적 3D, 안개 낀 풍경 |
| Overdue | 5148500 | 호러 크리처, 간체 |
| The Black Breath | 5160770 | 다크 판타지 크리처 |
| Layang Atma | 5068530 | 인도네시아 호러, 붉은 숲 |
| Succubus Abyss | 4608720 | 애니 아트, 이 풀에서 리뷰 최다(39) |

## 걸러낸 것과 이유

| 게임 | 왜 |
|---|---|
| Revenant Survivors (4693240) | 관문 1 탈락 — 사용자: "그래픽이 B급이다". 빌드에는 이야기가 있었다(5.66GB 중 4.34GB가 압축 안 된 `.resS`) |
| IT THINKS! - Build Your Own GPU (5198250) | 관문 1 탈락 — 스샷 8장이 전부 회로도와 문서 화면. 빌드는 재미있었다(Electron, 게임 24MB에 브라우저 275MB) |
| Tasty Chef / Idle Pixel Battle / Project OC | 접속자 상위(109·89·80)지만 관문 1·2 모두 약함 |
| Oar'some Adventures (5057590) | 언리얼, 파일 32개 — 뜯을 게 없다 |
