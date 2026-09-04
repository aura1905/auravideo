# 스테퍼 레트로 (Staffer Retro) — 빌드 분해

- 데모 appid **4125500** / 본편 3837350 · 개발사 **Team Tetrapod**(한국, 8인)
- 퍼블리셔 Team Tetrapod + **GamePia Co., Ltd.**
- 데모 평가 **94.9% / 272개** · Windows + macOS · 2025-12-05 데모 공개
- **한국어 리뷰 105개(39%)** — 후보 중 한국 관심도 1위

## 파일 목록에서 읽히는 것

SteamDB depot 4125501 (Windows), **파일 212개 / 3.87 GiB**, 매니페스트 10개.

| 확인된 사실 | 파일 근거 |
|---|---|
| 유니티 | `StafferRetro_Data/`, `globalgamemanagers` |
| **Mono 백엔드 (IL2CPP 아님)** | `MonoBleedingEdge/`, `Managed/*.dll`이 그대로 남음 |
| **URP** | `Unity.RenderPipelines.Universal.*` |
| D3D12 | `D3D12/D3D12Core.dll` |
| 2D 전용 스택 | `Unity.2D.Animation/IK/PixelPerfect/SpriteShape/Tilemap.Extras` |

### 서드파티 — 여기가 이야기다

- **`Elringus.Naninovel.Runtime.dll` (1.52 MiB) + `Naninovel.Common.dll`**
  나니노벨. 유니티 에셋스토어의 **유료 비주얼노벨 프레임워크**다. 대사·연출·세이브·
  스크립트 언어가 전부 여기서 온다. 추리 어드벤처의 뼈대를 직접 짜지 않았다는 뜻.
- **`spine-csharp.dll` / `spine-unity.dll`** — Spine. 2D 스켈레탈 애니메이션 유료 툴.
- `Newtonsoft.Json`, `Unity.InputSystem`, `Unity.Burst`, `Unity.Collections`
- **`Unity.Recorder.dll` / `Unity.Recorder.Base.dll`** — 개발용 녹화 패키지가
  출시 빌드에 그대로 들어있다. 트레일러를 에디터에서 뽑는 팀의 흔적.

### 자체 코드의 크기

`Assembly-CSharp.dll` **429 KB**. 나니노벨(1.52 MB)보다 작다.
**"8명이 만든 추리 게임"의 코드는 429 KB이고, 대사 엔진은 사서 썼다.**

### 용량이 어디에 쓰였나

`resS` 3개 = **3.48 GiB** (전체 3.87 GiB의 90%), `resource` 236 MiB.
코드도 로직도 아닌 **그림과 소리**다. 8명 중 다수가 아트·시나리오라는 팀 구성과 맞는다.

## 리뷰가 말하는 것

272개 중 한국어 105 / 중국어 간체 86 / 일본어 46. 중간 플레이타임 **150분**(데모치고 길다).
부정 리뷰의 요지는 기술이 아니라 **추리 난이도** — "너무 쉽다", "시리즈의 반전 공식이
반복된다". 즉 나니노벨을 산 선택은 아무도 문제 삼지 않았고, 문제는 설계 쪽이다.

## 영상의 각도 (초안)

> 추리 게임을 만들려면 대사 시스템부터 짜야 한다고들 한다. 이 팀은 그걸 샀다.
> 자기 코드는 429 KB고, 나머지 3.5 GB는 전부 그림이다.

**따라할 수 있는 한 문장**: 서사 게임에서 직접 짜야 하는 건 대사 엔진이 아니라 추리 설계다.
