# 김밥천국 시뮬레이터 (Kimbap Heaven Simulator) — 빌드 분해

- 데모 appid **4390440** / 본편 4206910 · 개발사 **Joyful Jo**(한국)
- 데모 **리뷰 0개** · Windows 전용 · 2026-02-21 데모 공개
- SteamDB `baselanguages: English`

## 유니티지만 IL2CPP라 패키지 목록이 안 나온다

depot 4390441, **파일 37개 / 2.83 GiB**.

```
GameAssembly.dll                        55.78 MiB  ← C# 전체가 네이티브로 컴파일됨
il2cpp_data/Metadata/global-metadata.dat 12.45 MiB
Kimbap Heaven_Data/level1               852.68 MiB
Kimbap Heaven_Data/sharedassets1.resS     1.09 GiB
Plugins/x86_64/lib_burst_generated.dll   434.50 KiB  ← Burst
```

`Managed/` 폴더가 없다. **IL2CPP 백엔드**라 `Assembly-CSharp.dll`도 서드파티 DLL도
`GameAssembly.dll` 하나로 합쳐졌다. 즉 "어떤 패키지를 샀는가"를 파일 이름으로 읽을 수 없다.
(`ScriptingAssemblies.json`에 어셈블리 이름이 들어 있지만 SteamDB는 파일 목록만 주고
내용은 주지 않는다.)

읽히는 것은 여기까지다: 유니티 / IL2CPP / Burst / Addressables 없음(`.bundle` 없음) /
용량 2.83 GiB 중 **1.7 GiB가 `resS`** — 에셋 덩어리 게임.

## 수요 신호가 아직 없다

데모 리뷰 0개. 소재("김밥천국")는 한국 시청자에게 강한 후크지만 지금은
**게임에 대해 할 말이 없다.** 리뷰가 쌓일 때까지 보류.

## 판정

**보류.** 소재는 1순위급인데 (a) IL2CPP라 분해가 얕고 (b) 반응 데이터가 없다.
본편 출시 후 다시 볼 것.
