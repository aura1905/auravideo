# 펭퐁 (PengPong) — 빌드 분해

- 데모 appid **3636220** / 본편 2766910 · 개발사 **SANDY FLOOR**(한국)
- 데모 평가 **86.6% / 134개** · Windows 32/64 + macOS · 2025-11-10 데모 공개
- SteamDB `baselanguages: English, Korean`
- **한국어 리뷰 30개(22%)**, 중국어 간체 50개

## 파일 목록에서 읽히는 것

depot 3636222 (Win64), **파일 282개 / 2.68 GiB**.

| 확인된 사실 | 파일 근거 |
|---|---|
| 유니티, **Mono 백엔드** | `MonoBleedingEdge/`, `Managed/*.dll` 노출 |
| Addressables | `.bundle` 17개 / 529 MiB |
| 데이터 저장에 SQLite | `Mono.Data.Sqlite.dll` |

### 자체 프레임워크를 갖고 있다 — 인디에서 드문 일

스튜디오 이름을 딴 모듈이 **8개**:
`SandyToolkit` · `SandyToolkitCore` · `SandyAddressable` · `SandyAudio` ·
`SandyPooling` · `SandySetting` · `SandyDependency` · `SandyDamageFontManager`

그리고 **`Assembly-CSharp.dll`이 5 KB밖에 안 된다.** 유니티 기본 어셈블리가 비어 있다는 건
코드를 전부 asmdef(어셈블리 정의)로 쪼갰다는 뜻이다. 게임 코드는 `COre.dll` 2.37 MiB에 있다.
**한 편을 만들고 끝낼 코드가 아니라, 다음 프로젝트에 그대로 들고 갈 사내 엔진 레이어다.**

### 서드파티

- **FMOD** (`FMODUnity.dll` + `.bank` 4개 29.76 MiB) — 상용 오디오 미들웨어
- **DOTween**, **Febucci Text Animator**(유료), **AraTrail**(유료 트레일)
- **Coffee.UIParticle**, **NavMeshPlus**(2D 내비메시) — 오픈소스
- **GameAnalytics** SDK — 플레이 데이터를 실제로 수집한다
- `com.rlabrecque.steamworks.net` — Steamworks.NET

### 그리고 이것 — **`MCPForUnity.Runtime.dll`**

MCP(Model Context Protocol)를 유니티에 붙이는 런타임이 **출시 빌드에 들어 있다.**
개발 과정에서 AI 에이전트로 에디터를 조작했다는 흔적이다. 확인된 건 "DLL이 있다"는
사실까지이고, 어디에 얼마나 썼는지는 알 수 없다 — **그건 추정이라고 말해야 한다.**
이 채널 시청자층(AI를 끼고 만드는 1~2인)에게는 가장 직접적인 재료다.

## 리뷰가 말하는 것

중간 플레이타임 70분. 칭찬은 **컵헤드풍 1940~60년대 카툰 비주얼**에 몰려 있고,
불만은 하나로 모인다 — **"당겨서 발사하는 핀볼 매커니즘"이 불편하다.**
아트는 팔리는데 핵심 조작이 발목을 잡는 전형이다.

## 영상의 각도 (초안)

> 이 팀은 게임을 만들기 전에 도구부터 만들었다. 자기 이름을 붙인 모듈이 여덟 개고,
> 유니티 기본 어셈블리는 5 KB로 비어 있다. 그리고 빌드 안에 MCP가 들어 있다.

**따라할 수 있는 한 문장**: 두 번째 게임을 만들 생각이라면, 첫 게임에서 나온 코드를
asmdef로 갈라두는 것부터가 자산이다.
