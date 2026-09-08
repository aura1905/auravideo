# 쇼츠 후보 풀 — 2026-09-09 갱신

롱폼 큐(`docs/QUEUE.md`)와 **일부러 분리**한다. 롱폼은 "빌드를 분해할 만한가"로 고르고,
쇼츠는 **도달**로 고른다(`docs/CHANNEL.md` §8-A).

1. **간체 중국어와 영어를 둘 다** 지원할 것. 중국 게임을 고르라는 게 아니라 중국 시청자가
   플레이할 수 있어야 한다는 뜻이고, 영어 나레이션이라 영어도 있어야 한다.
   한 언어만 있으면 0점(사용자, 2026-09-06).
2. **동시접속자는 바닥값이지 가중치가 아니다.** 04·05화는 접속자가 60% 차이인데 조회는
   4% 안쪽이었다. "누군가 있다"만 확인하고 순위에는 쓰지 않는다.
3. **최근 데모일 것.**
4. **진짜 관문은 파일 목록의 한 문장이다.** 스크롤을 멈추게 할 사실 하나.

규모·엔진 필터는 없다. 그건 롱폼에만 적용한다.

## 이번 스캔 (2026-09-09)

최근 5일 데모 160편 → 영어+간체 둘 다 있는 것 **63편** → 동시접속자 조회 → 빌드 확인.

**동시접속자는 이번 주 전부 바닥이다**(최대 59명: The Last Mothership). 그래서 순위는
전적으로 관문 4에서 나왔다.

### 1순위 — Mio: Resonance (`4982820`, 9/6, 草莓派)

스토어 분류가 **Indie / Simulation / Utilities**다. 게임이 아니라 **AI 컴패니언**이다 —
실시간 음성 대화, 장기 기억, 성격·외모·목소리 커스터마이즈, 그리고 "데스크톱 컴패니언 모드".

208.62 MiB, 239개 파일, **Mono**라서 패키지 목록이 통째로 보인다. 주장 하나하나가 파일로
뒷받침된다:

| 파일 | 무엇인가 |
|---|---|
| `DefaultModels/Mio_V2.vrm` 15.38 MiB | VRM 아바타 — VTuber 모델 포맷 |
| `VRM10`, `VrmLib`, `UniGLTF`, `UniHumanoid`, `MMD4Mecanim`, `FastSpringBone10` | 그 아바타를 굴리는 파이프라인 |
| `Kirurobo.UniWindowController` | **창을 투명·무테·항상 위로** 만드는 라이브러리. 데스크톱 마스코트의 그것 |
| `uLipSync.*` 어셈블리 7개 | 음성에서 실시간 립싱크 |
| `Plugins/x86_64/onnxruntime.dll` 13.55 MiB | **내 컴퓨터에서 도는** 추론 |
| `endel.nativewebsocket` | 그리고 **서버로 나가는** 소켓 |
| `SimpleFileBrowser.Runtime` | 내 VRM을 직접 불러올 수 있다 |

훅이 명확하다: **무엇이 내 기계에서 돌고 무엇이 남의 서버로 나가는가**를 파일 목록만으로
따질 수 있다. ONNX가 로컬에 있는데 웹소켓도 있다는 건, 둘 다 쓴다는 뜻이다.
12·13·14화가 이미 쥐고 있는 "빌드 속의 AI" 줄기와 이어지고, 이번엔 게임이 아니라
**AI 자체가 제품**이다.

### 2순위 — Fool King (`5102280`, 9/7, Loot Donkey)

1.05 GiB인데 다운로드는 200.19 MiB — 5.4배 압축. 429개 파일, 관리 어셈블리 270개, Mono.

```
Fool King_Data/StreamingAssets/GhostCache/ghost_cache.jsonl     2.48 MiB
Fool King_Data/StreamingAssets/GhostCache/fool_king_cache.jsonl 15.39 KiB
```

스토어 분류는 **Multi-player / PvP / Online PvP**인데, 상대를 상자에 넣어서 보냈다.
게임에서 "ghost"는 보통 녹화된 비동기 상대를 뜻하니, **온라인 PvP 데모가 붙어줄 사람을
미리 구워서 동봉한 것**으로 읽힌다. 데모의 정직한 현실이다 — 아무도 없으니까.

덤: `Autodesk.Fbx.dll`(FBX SDK, 파이프라인 도구)이 플레이어 빌드에 있고, A* Pathfinding,
Clipper2, CsvHelper, DOTween, AllIn1 셰이더까지 다 보인다.

**주의**: `.jsonl`은 언어모델 데이터에도 쓰는 포맷이라 그쪽으로 끌고 가고 싶어지는데,
이 게임은 PvP다. 파일 이름과 크기만 보고 LLM이라 말하면 안 된다.

### 3순위 — Project Spooky (`4795370`, 9/5, Team 237)

"개발자가 완성하기 전에 사라졌다. 그의 마지막 프로젝트를 재구성한 것을 플레이한다."
3.07 GiB / 52개 파일인데 **그중 1.89 GiB가 `sharedassets3.assets.resS` 한 개** — 데모의 62%다.
DLSS 52.24 MiB. Unity IL2CPP라 패키지는 안 보인다.
소재는 세지만 파일 목록의 사실은 앞의 둘보다 약하다.

## 이번 스캔에서 본 나머지

| 데모 | appid | 접속 | 빌드 | 메모 |
|---|---|---|---|---|
| The Last Mothership | 4627080 | 59 | Win 452 / macOS 521 / Linux 422 MiB | 1인 개발인데 3개 플랫폼 + 접근성 태그 7개. 착하지만 훅이 아님 |
| Shrine Full of Anomalies | 5180670 | — | 1.39 GiB / 60 파일 | 동방 2차 창작 이상현상 찾기. 13화와 장르 중복 |
| Dungeon Picnic | 5207170 | 24 | 미확인 | |
| Life Is a Dungeon | 5063310 | 22 | 미확인 | |
| OtherWorld: Infinite Loop | 5146350 | 16 | 미확인 | |

## 이미 만든 쇼츠

s01 Another Eden · s02 Stupid Never Dies · s03 Frontier Tale · s04 K-God Robot Hunters ·
s05 Tasty Chef · s06 Voxotron · s07 COMPARTMENT 666

전부 조회 1,000~1,300으로 모인다. **게임별 수요 차이라기보다 플랫폼이 신규 쇼츠에 주는
초기 노출이 비슷한 것**으로 보인다(2026-09-09 측정). 그러니 후보 선정에서 접속자 수를
더 볼 이유가 없다.
