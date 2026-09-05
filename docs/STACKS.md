# 스택 대장 — 편마다 한 줄씩 쌓는 데이터

이 채널이 파일 목록을 읽는 유일한 이유는 **"뭘로, 어떻게 만들었나"를 알려주는 것**이다.
편이 하나 끝날 때마다 이 표에 한 줄을 더한다. 열 편, 스무 편이 쌓이면 스토어 페이지 어디에도
없는 데이터가 된다 — *"스팀 데모 20개의 파일 목록을 전부 읽었습니다. 소규모 팀이 실제로 뭘 쓰는지."*

리뷰 채널은 이걸 만들 수 없다. 그리고 다음 편이 이 표를 한 줄 늘리므로, **구독할 이유**가 된다.

**한 줄을 채우는 법**: `episodes/NN-slug/teardown.md`를 쓰고 나면 필요한 값이 이미 다 있다.
`python scripts/pipeline/stack_ledger.py --add episodes/NN-slug` 로 추가한다.

---

## 표

| # | 게임 | 팀 | 엔진 | 파이프라인 | 백엔드 | 빌드 | 파일 | 씬 | 서드파티 | 산 것 / 만든 것 | 평가 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 04 | Nomad Drive | 비공개 | Unity 6 | **HDRP** | Mono | 3.71 GiB | 322 | 4 | **20+** | 어려운 건 전부 삼 | 69.8% / 1k |
| 05 | Casualties: Unknown | 1인 | Unity | **URP 2D** | Mono | 517 MiB | 189 | 2 | **1** | 전부 직접 씀 | 96.2% / 6.8k |
| 06 | Expedition: Into Darkness | 3인 | Unity | 미상(IL2CPP) | **IL2CPP** | 16.89 GiB | 1604 | 1 | 미상(IL2CPP) | 콘텐츠로 밀어붙임 | 69.7% / 911 |
| 07 | Guildrun | 미상 | Unity | 미상(IL2CPP) | **IL2CPP** | 10.58 GiB | 137 | 22 | 어셈블리 24개 복원 | 숙련된 스택 + 주간 패치 | 89.8% / 1,994 |
| 08 | Veiled Shadows | 1인 (오스트리아) | **RPG Developer Bakin** | OpenGL 4.4 / D3D12 | C# (Roslyn 동봉) | 1.42 GiB | 65 | 0 | 엔진 런타임 통째 | 노코드 툴 + 자작 콘텐츠 | 100% / 6 |
| 09 | PengPong | 미상 (SANDY FLOOR, 한국) | Unity | Addressables | Mono | 2.68 GiB | 282 | 0 | 8종 이상 | 사내 프레임워크 + 유료 에셋 $95 | 86.6% / 134 |
| 10 | FINAL FANTASY RESONANCE | Square Enix Team Asano + LANCARSE | **Unreal Engine 5** | IoStore (.ucas/.utoc) | C++ (467 MiB exe) | 5.72 GiB | 26 | 0 | DLL 14개 (전부 서드파티) | 대형 퍼블리셔, 1장 통째 데모 | 리뷰 없음 / 접속 4,400 |
| 11 | SlashZero | Streetlamp Studio (pub. Skystone Games) | **Unreal Engine 5** | IoStore (.ucas/.utoc), 3 pak chunks | C++ (234 MiB exe) | 14.22 GiB | 497 | 0 | DLL 119개 (Wwise 33 + CEF 2벌 + 바이트댄스/텐센트) | 모바일 빌드의 PC 포팅 — 스킬 영상 103개가 PC/Mobile 두 벌 | 리뷰 없음 / 접속 337 |
| ko | PengPong | 한국 인디 (인원 미공개) | Unity | **Mono 백엔드**, Addressables | Mono | 2.68 GiB (Win64 데모) | 282 | ? | **8종 이상** | 사내 프레임워크 + 유료 에셋 조합 | 데모 86.6% / 134, 본편 84.9% / 258 |

## 누적 집계 (9편 기준 — 의미 있는 수치는 10편부터)

- 엔진: Unity 6 / Unreal Engine 2 / RPG Developer Bakin 1
- 파이프라인: 미상(IL2CPP) 2 / **HDRP** 1 / **URP 2D** 1 / OpenGL 4.4 / D3D12 1 / Addressables 1 / IoStore (.ucas/.utoc) 1 / IoStore (.ucas/.utoc), 3 pak chunks 1 / **Mono 백엔드**, Addressables 1
- 스크립팅 백엔드: Mono 4 / **IL2CPP** 2 / C# (Roslyn 동봉) 1 / C++ (467 MiB exe) 1 / C++ (234 MiB exe) 1
- 중간값 빌드 크기: 3.71 GiB
- 서드파티 패키지 중간값: 11개
- 생성형 AI 공시가 있는 편: 2 / 9

## 지금까지 두 번 이상 나온 패키지

- **Steamworks** (5편), **FMOD** (4편), **Resonance Audio** (2편), **SQLite** (2편), **DOTween** (2편), **AraTrail** (2편), **NavMeshPlus** (2편), **GameAnalytics** (2편), **NVIDIA Aftermath** (2편), **oneTBB** (2편)

## 언급한 도구는 설명문에 링크한다

영상에서 이름을 말했으면 시청자가 찾아갈 수 있어야 한다. 설명문의 **The stack** 항목에
공식 페이지 링크를 넣는다(에셋스토어·깃허브·공식 사이트). 이름만 말하고 끝내면 정보 공유가 아니다.

## 편이 쌓이면 만들 수 있는 것

- **"소규모 팀이 실제로 쓰는 스택" 총정리 편** — 10편, 20편 시점
- 특정 질문 하나짜리 편: *"데모 20개 중 몇 개가 에셋스토어 차량 물리를 썼나"*
- 주간 목록형(§2-B)에서 한 줄 사실로 재활용
