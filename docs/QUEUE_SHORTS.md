# 쇼츠 후보 풀 (중화권 우선)

`python scripts/pipeline/shorts_queue.py --pages 20 --out docs/QUEUE_SHORTS.md`

롱폼 큐(`QUEUE.md`)와 **별도로 관리한다.** 롱폼은 분해가 깊게 되는 빌드를 찾지만, 쇼츠는 도달이
목적이고 그 슬롯의 주 시청자는 중화권이다(04화 리뷰 코퍼스가 중국어 264 / 영어 218, 22:00 KST가
중화권 저녁). 그래서 규모·엔진 필터를 걸지 않고 중화권 지원과 후크만 본다.

## 공급 현실 (2026-09-06 실측)

**최근 등록된 데모 1,000편 중 동시접속 30명 이상은 14편뿐이다.** 100명 이상은 7편,
그중 둘은 이미 10·11화로 썼다. 데모는 하루에도 쏟아지지만 **사람이 들어가 있는 데모는 주당 한 자릿수**다.
그래서 접속자를 통과 기준으로 쓰면 하루 두 편을 채울 수 없다.

**그래서 접속자는 기준이 아니라 참고 수치로만 둔다.** 근거: 잘된 쇼츠 두 편이 각각 1,148·1,194뷰인데
그 게임들의 동시접속은 1,446·882명이었다. 게임의 검색 수요보다 많은 조회가 나왔다는 뜻이고,
초기 조회가 쇼츠 피드에서 왔다는 얘기다. 피드는 게임이 유명한지가 아니라 **첫 3초가 붙잡는지**로 돌아간다.

## 통과 기준

1. 최근 등록 데모일 것 (채널 정체성)
2. 중화권 지원 — 간체 지원(O), 중국어 원제(C)
3. **파일 목록에 한 문장으로 스크롤을 멈추게 할 사실이 있을 것** — 이것만이 진짜 관문이다.
   없으면 접속자가 4,000명이어도 넘긴다(10화가 그렇게 실패했다).

| 접속 | 중 | 개발사 | 게임 | 데포 | 메모 |
|---|---|---|---|---|---|
| 4892 | OC | Square Enix, LANCARSE | [FINAL FANTASY RESONANCE DEMO](https://store.steampowered.com/app/4474710/) | [SteamDB](https://steamdb.info/app/4474710/depots/) | 10화로 사용 |
| 242 | O | Haymaker Games | [Oar'some Adventures Demo](https://store.steampowered.com/app/5057590/) | [SteamDB](https://steamdb.info/app/5057590/depots/) | 언리얼, 파일 32개 — 후크 없음 |
| 193 | - | TEAM42 | [World of Slime Demo](https://store.steampowered.com/app/4793900/) | [SteamDB](https://steamdb.info/app/4793900/depots/) | 번체만 있고 간체 없음 — 기준 미달 |
| 188 | OC | Biang Studio | [口袋修仙 Demo](https://store.steampowered.com/app/4777710/) | [SteamDB](https://steamdb.info/app/4777710/depots/) | **탈락 — 간체 전용.** 영어권이 못 하는 게임은 이 슬롯에 안 맞는다 |
| 184 | OC | Streetlamp Studio | [SlashZero Demo](https://store.steampowered.com/app/5099550/) | [SteamDB](https://steamdb.info/app/5099550/depots/) | 11화로 사용 |
| 155 | O | WRIGHT FLYER STUDIOS | [Another Eden Begins Demo](https://store.steampowered.com/app/4391790/) | [SteamDB](https://steamdb.info/app/4391790/depots/) | **s01로 사용** (9/6 13:00) |
| 135 | OC | GPTRACK50 Inc. | [Stupid Never Dies: First Bite Demo](https://store.steampowered.com/app/4880100/) | [SteamDB](https://steamdb.info/app/4880100/depots/) | **s02로 사용** (9/6 16:00) |
| 48 | O | Max Ritters | [Idle Pixel Battle Demo](https://store.steampowered.com/app/5020820/) | [SteamDB](https://steamdb.info/app/5020820/depots/) |  |
| 45 | OC | APOPHIS GAME STUDIO | [Frontier Tale Demo](https://store.steampowered.com/app/5010220/) | [SteamDB](https://steamdb.info/app/5010220/depots/) |  |
| 38 | O | Chugget | [Into the Planet's Flesh Demo](https://store.steampowered.com/app/4797850/) | [SteamDB](https://steamdb.info/app/4797850/depots/) |  |
| 35 | O | Weird Penguin Games | [ShredDead Demo](https://store.steampowered.com/app/4900640/) | [SteamDB](https://steamdb.info/app/4900640/depots/) |  |
| 33 | O | Lapismine | [Dungeon Picnic Demo](https://store.steampowered.com/app/5207170/) | [SteamDB](https://steamdb.info/app/5207170/depots/) | 최신 등록 |
| 33 | O | 偶尔不帅 | [Boar Knight Demo](https://store.steampowered.com/app/5126860/) | [SteamDB](https://steamdb.info/app/5126860/depots/) | 중국 개발사 |
| 32 | OC | KDream | [My Fairy Princess Demo](https://store.steampowered.com/app/4036120/) | [SteamDB](https://steamdb.info/app/4036120/depots/) |  |
