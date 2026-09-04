# 플레밍 저택의 죽음 (Death at Fleming Manor) — 빌드 분해

- 데모 appid **4137650** / 본편 3758950 · 개발사 **SUPERTHUMb**(한국)
- 데모 평가 **83.7% / 147개** · Windows 전용 · 2025-11-20 데모 공개

## 결론부터: 이 방법으로는 뜯을 게 없다

depot 4137652, **파일 10개 / 181.52 MiB**가 전부다.

```
Fleming_demo/data.win          159.63 MiB   ← 게임 전체가 여기 한 덩어리
Fleming_demo/Fleming_demo.exe    7.51 MiB
Fleming_demo/audiogroup1.dat    10.52 MiB
Fleming_demo/audiogroup2.dat     3.06 MiB
Fleming_demo/steam_api64.dll  + Steamworks_x64.dll
```

**GameMaker 엔진**이다. 코드·리소스·스크립트가 전부 `data.win` 하나에 들어가므로
파일 목록에서 나오는 서드파티는 **Steamworks 확장 하나뿐**이다.
언리얼(`.pak`/`.ucas` 한 덩어리)과 정확히 같은 이유로 우리 방법이 통하지 않는다.

→ **`docs/CHANNEL_KO.md`의 엔진 필터에 GameMaker를 추가할 것.**

## 한국 관심도도 낮다

리뷰 147개 중 **한국어는 13개(9%)**뿐이고 중국어 간체 59 / 영어 41 / 일본어 26이다.
한국 개발사지만 한국에서는 안 알려졌다. 중간 플레이타임 40분(부정 24분).

## 판정

**보류.** 게임 자체는 괜찮아 보이지만 이 채널의 형식(빌드 분해)에 맞지 않고,
한국 시청자 수요 신호도 약하다. 개발자 인터뷰나 공개 발언이 재료의 중심이 되는
다른 형식이라면 가능.
