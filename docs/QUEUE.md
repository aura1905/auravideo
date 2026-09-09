# 롱폼·쇼츠 후보 큐 — 2026-09-09 저녁 갱신

## 후보 찾는 법 — 그림부터 본다

`https://store.steampowered.com/search/?category1=10&sort_by=Released_DESC&supportedlang=english`
— `sort_by=Released`는 조용히 무시된다. **반드시 `Released_DESC`.**

**appdetails의 `header_image`를 전부 받아 연락처 시트로 깔고, 눈으로 먼저 고른다.**
2026-09-09에 후보 63개를 스크린샷 한 장 안 보고 매니페스트와 설명 텍스트만으로 줄 세웠다가
사용자에게 반려당했다("내가 발굴해서 알려줘야지"). 사용자가 직접 고른 것들(Night Portable,
Witchbound, Seaside Wash, The Price of Grief, Disco Ball)은 전부 **스크린샷 한 장으로 이 게임이
뭔지, 뭐가 이상한지가 즉시 보이는** 것들이었다. 분해는 영상의 *내용*이고, 그림이 클릭의 *이유*다.
순서를 바꾸면 안 된다.

헤더 URL은 콘텐츠 해시가 붙어 있어 추측할 수 없다 — 반드시 appdetails에서 받는다.

## 관문

1. **이번 주에 올라온 데모인가.** 정체성이라 예외 없음.
2. **화면이 한 장으로 말하는가.** 그리고 그게 흔한 것이 아닌가.
3. **파일 목록에 한 문장이 있는가.**
4. **후크가 이미 쓴 것과 겹치지 않는가.** ← 아래 표를 먼저 볼 것.

## 이미 쓴 후크 (겹치면 안 됨)

| 후크 | 쓴 편 |
|---|---|
| 빌드 속 AI/ML 런타임 | PengPong, FINAL FANTASY RESONANCE, Rudravati, COMPARTMENT 666 — **4회, 당분간 금지** |
| 중복·잔재 데이터 | Expedition(770 MB), SlashZero(영상 103개 두 번), Prenecrotic(18.5 GB) — **3회** |
| 용량 대비 실제 내용물 | Stupid Never Dies, K-God, Disco Ball — **3회** |
| 넣지 말라고 이름 붙은 폴더 | Frontier Tale |
| 잘못 들어간 것 | Tasty Chef(EOS 두 번), Voxotron(모드 로더) |
| 스토어와 빌드의 불일치 | Seaside Wash(언어), Another Eden(모바일 빌드) |
| 코드 없이 만든 게임 | Veiled Shadows |
| 사온 도구 값 합계 | PengPong |

## 다음 제작 — 확인 완료

### 롱폼 ① The No Jumpscare Show (`5056910`, 9/8, Polypaw)

> 점프스케어가 게으른 클리셰인 세상. Illy는 진짜 심리 공포를 약속하는 수상한 유령의 집에
> 등록한다. 안 놀라고 버티면 1만 달러. "100% 점프스케어 없는 경험 :)"

339.26 MiB / 262 파일 / Unity Mono / 영어만.

**서드파티 관리 어셈블리가 `Assembly-CSharp` 하나뿐이다.** DOTween도, Odin도, Steamworks도,
아무것도 없다. StreamingAssets 없음, Plugins 없음, DoNotShip 폴더 없음.
`level10` 한 개가 71.97 MiB로 게임의 21%.

**후크가 지금까지와 정반대다.** 열다섯 편 내내 "뭘 잘못 넣었나"였는데 이건 **"아무것도 안 사 왔다"**.
장르의 상투 수단을 거부하는 게임이 남의 코드도 안 쓴다 — 화면(완전 흑백, 종이인형)까지 같은 말을 한다.

### 롱폼 ② Octbuster: Video Rental Store Cleanup (`5159140`, 9/8, Alex)

> 80년대 비디오 대여점을 영업 후에 정리하는 아늑한 게임. **문어가 되어** 새끼고양이들과
> 진짜 촉수 팔로 VHS 테이프를 쓸어 담아 1만 개 넘게 분류한다. 타이머도 점수도 없다.

2.77 GiB(Win) / 2.87 GiB(macOS) — 그런데 **파일이 58개뿐**. IL2CPP.

| 파일 | |
|---|---|
| `sharedassets0.assets.resS` | 1.04 GiB |
| `props_assets_all_*.bundle` | **780.37 MiB** — 소품 번들 하나 |
| PNG 2장 | **69.67 MiB** (한 장에 ~35 MB) |
| `nvngx_dlss.dll` | 52.24 MiB — 문어가 가게 치우는 게임에 DLSS |

후크는 **테이프**다. 1만 개가 진짜 개별 오브젝트고 표지가 있으니 소품 번들이 780 MB다.
"용량 대비 내용물"과 다르다 — 여기선 **용량이 곧 게임의 요점**이다.

### 쇼츠 ① INKBORN (`5187060`, 9/8, OverLKD Studio)

151.66 MiB, **파일 3개**. Windows + Linux. 8개 언어(간체 포함).

```
INKBORN_Demo.exe                                 147.58 MiB
libgodotsteam.windows.template_release.x86_64.dll  3.78 MiB
steam_api64.dll                                    311.65 KiB
```

**`libgodotsteam` — 고닷이다. 채널 열다섯 편이 전부 유니티 아니면 언리얼이었다.**
Godot은 게임을 실행 파일 하나에 통째로 넣어 내보내서 읽을 파일 목록이 없다.
분해 방법 자체가 달라진다는 게 할 말이다. 손으로 그린 연필 아트라 화면도 눈에 띈다.

### 쇼츠 ② Haunted House Hellshift (`5196080`, 9/8, Deege Games)

2.14 GiB / 363 파일 / Unity Mono / 11개 언어(한국어·간체 포함) / Win·mac·Linux.

관리 어셈블리 255개 중 서드파티가 40개 이상이다 — AllIn1 3D Shader, A* Pathfinding,
CartoonFX, DOTween Pro, DamageNumbersPro, EasySave3, Febucci Text Animator(6개),
Heathen Steamworks, Kamgam UIToolkit(3개), KinoBloom, Clipper2, AFPSCounter,
그리고 에디터 도구인 `AssetInventory.Examples`까지.

**후크는 `DunGen`이다** — 절차적 던전 생성기. 유령의 집이 근무 때마다 다시 지어진다는 뜻이고,
파일 목록에서 *게임 플레이*를 읽어내는 종류라 제일 좋은 발견이다.
("사온 도구 값 합계"는 PengPong에서 이미 썼으니 그쪽으로 몰지 말 것.)

### 쇼츠 ③ The Last Wait (`5092070`, 9/8)

2.43 GiB / 322 파일 / **Unreal** / 간체 지원.

```
Movies/Eye_1_Anim.mp4    153.40 MiB
```

2.4 GB짜리 공포 데모에 "Eye_1_Anim"이라는 이름의 **153 MB짜리 동영상 한 개**.

**주의**: 이 빌드에도 `DirectML.dll`(17.68 MiB)과 `onnxruntime.dll`(14.01 MiB)이 있다.
다섯 번째다. **거기로 가지 말 것** — 영상은 그 동영상 파일로 끌고 간다.

## 눈으로 골랐지만 빌드 미확인 (예비)

| 데모 | appid | 왜 |
|---|---|---|
| Lethal Wedding | 4768410 | Mega Cat Studios, 광대가 신랑을 납치, 신부+장모가 총 든 16비트 |
| Tommy Gun Marionettes | 5051860 | 마녀·오징어인간·돼지인간 느와르 포인트앤클릭 |
| Newtone's Gospel | 4853020 | 뉴턴이 눈에서 레이저 쏘는 노트 UI 로그라이크, EN+JP+CN |
| DEAD RECALL | 5194570 | 크리처 공포 |
| Cardsharp | 5157490 | 조커+칼, CN |
| Did You See That? | 5164600 | 서로 다른 현실을 보는 2인 공포 — **혼자 못 찍어서 보류** |
| Night Portable | 5065360 | `HorrorSubliminal1.mp4`. 사용자 추천, 아직 미제작 |
| Witchbound | 5158760 | 유령이 주인공, 729 MB 중 569 MB가 한 파일. 사용자 추천, 미제작 |
| The Price of Grief | 5134320 | Godot, 파일 3개. 본편은 12/18이지만 **데모는 지금 배포 중** |
| 1.44MB RESCUE | 5139920 | 파일 2개, 엔진 없음. 아직 미제작 |

## 이미 만든 것

| 데모 | appid | |
|---|---|---|
| Nomad Drive 4568400 · Casualties 4576510 · Expedition 5041080 · Guildrun 4425970 | | 롱폼+쇼츠 |
| FF RESONANCE 4474710 · SlashZero 5099550 · Rudravati 5105660 · COMPARTMENT 666 5016400 | | 롱폼+쇼츠 |
| Prenecrotic 4947430 | | 롱폼 |
| Another Eden 4391790 · Stupid Never Dies 4880100 · Frontier Tale 5010220 · K-God 5084500 | | 쇼츠 |
| Tasty Chef 5067140 · Voxotron 5107400 · Seaside Wash 4924230 · Disco Ball 5089460 | | 쇼츠 |
| PengPong 3636220 · Veiled Shadows 5060640 | | 한국어/보류 |
