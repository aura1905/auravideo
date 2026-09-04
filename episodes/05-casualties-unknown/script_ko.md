# 2화 Casualties: Unknown — 나레이션 한글 대조본

영상에 실제로 들어간 영어 나레이션과 그 뜻입니다. 검수용이며, 영상에는 영어만 나갑니다.
시각은 완성본 기준(`final.mp4`, 4분 31초).

| 시각 | 구간 |
|---|---|
| 0:00 | 콜드 오픈 |
| 0:15 | 로고 스팅 |
| 0:18 | 게임 소개 |
| 1:02 | 빌드 분해 |
| 3:25 | 리뷰 반응 |
| 3:45 | 스펙 시트 · 판정 |

---

## 콜드 오픈

**0:00** — *Two hundred and seventy five hours. That's the longest played review on this game's demo. Not the game. The demo.*
> 275시간. 이 게임 **데모**에 달린 리뷰 중 최장 플레이 기록입니다. 게임이 아니라, 데모가요.

**0:07** — *Half the people who reviewed it had already put in ten hours. It's free, it's five hundred megabytes, and one person made all of it.*
> 리뷰를 쓴 사람의 절반이 이미 10시간을 넣은 뒤였습니다. 무료고, 500메가바이트고, 한 사람이 전부 만들었습니다.

*(0:15 — 로고 스팅)*

## 게임 소개

**0:18** — *Casualties: Unknown is a two-D cave survival game about being dropped down a hole to fetch cargo. Mostly, it's about the ways a body stops working.*
> Casualties: Unknown은 화물을 회수하러 구멍 아래로 던져지는 2D 동굴 생존 게임입니다. 사실 대부분은, 몸이 망가지는 방식들에 관한 게임입니다.

**0:28** — *Six thousand eight hundred reviews. Ninety six percent positive. Steam calls that Overwhelmingly Positive, and most finished games never get there.*
> 리뷰 6,800개, 긍정 96%. 스팀은 이걸 "압도적으로 긍정적"이라고 부르는데, 완성된 게임들도 대부분 거기까진 못 갑니다.

**0:38** — *The developer is one person in Poland who goes by Orsoniks. Before Steam this lived on itch dot io, where it still sits at four point nine out of five from twelve hundred ratings.*
> 개발자는 Orsoniks라는 이름을 쓰는 폴란드의 한 사람입니다. 스팀 이전에는 itch.io에 있었고, 거기서 1,200개 평가에 5점 만점 4.9점을 유지하고 있습니다.

**0:49** — *And on the store page, in plain text: no generative AI was used.*
> 그리고 스토어 페이지에 그대로 적혀 있습니다. "생성형 AI는 사용되지 않았습니다."

**0:54** — *So how does one person, with no team and no AI, keep people in a free demo for ten hours?*
> 그럼 팀도 AI도 없는 한 사람이, 어떻게 무료 데모에 사람을 10시간이나 붙잡아 둘까요?

## 빌드 분해

**1:02** — *Steam publishes a file list for every demo, and you can read it without installing anything. That's where I started.*
> 스팀은 모든 데모의 파일 목록을 공개하고, 설치 없이 읽을 수 있습니다. 거기서 시작했습니다.

**1:09** — *Five hundred and seventeen megabytes. A hundred and seventy one files. The last demo I took apart was three point seven gigabytes.*
> 517메가바이트, 파일 171개. 제가 지난번에 뜯은 데모는 3.7기가바이트였습니다.

**1:17** — *It's Unity, and it's the universal render pipeline in its two-D mode.*
> 유니티고, URP(범용 렌더 파이프라인)의 2D 모드입니다.

**1:22** — *That's the boring choice, and it's why the minimum spec on the store page is a laptop processor and five hundred megabytes of disk.*
> 지루한 선택이고, 그래서 스토어 최소 사양이 노트북용 프로세서와 디스크 500메가바이트입니다.

**1:30** — *Then I opened the managed folder, and this is where I stopped.*
> 그다음 Managed 폴더를 열었는데, 여기서 멈췄습니다.

**1:34** — *The entire game — every system, every item, every wound — is one file. Assembly dash C sharp dot D L L. Eight hundred and fifty eight kilobytes.*
> 게임 전체가 — 모든 시스템, 모든 아이템, 모든 상처가 — 파일 하나입니다. Assembly-CSharp.dll, 858킬로바이트.

**1:45** — *The Unity runtime sitting next to it, the part Unity wrote, is thirty megabytes. The engine is thirty five times bigger than the game it runs.*
> 그 옆에 있는 유니티 런타임, 즉 유니티가 쓴 부분은 30메가바이트입니다. 엔진이 자기가 돌리는 게임보다 35배 큽니다.

**1:54** — *And there are two scenes in the build. Two. One is eighty kilobytes, the other is three hundred and thirty.*
> 그리고 빌드 안에 씬이 두 개뿐입니다. 두 개요. 하나는 80킬로바이트, 다른 하나는 330킬로바이트.

**2:00** — *So where's the game? None of it is laid out by hand. It's generated, and it runs off data files.*
> 그럼 게임은 어디 있을까요? 손으로 배치한 게 하나도 없습니다. 생성되고, 데이터 파일로 돌아갑니다.

**2:10** — *Next I went looking for the shopping list. The third party packages every Unity project leans on.*
> 다음으로 쇼핑 목록을 찾아봤습니다. 유니티 프로젝트라면 다들 기대는 서드파티 패키지들 말입니다.

**2:16** — *There is one. Discord rich presence, so your friends can see which layer you died on.*
> 하나 있습니다. 디스코드 리치 프레즌스. 친구들이 당신이 몇 층에서 죽었는지 볼 수 있게 해주는 것.

**2:22** — *No audio middleware. No inspector plugin. No character controller. No save framework. The game I took apart last time had more than twenty of those.*
> 오디오 미들웨어 없음. 인스펙터 플러그인 없음. 캐릭터 컨트롤러 없음. 세이브 프레임워크 없음. 지난번에 뜯은 게임은 그런 게 스무 개 넘게 있었습니다.

**2:32** — *There's a real trade here, and it's worth saying out loud. Packages get you shipped. Writing it yourself gets you something nobody else has.*
> 여기에 진짜 트레이드오프가 있고, 소리 내어 말할 값어치가 있습니다. 패키지는 당신을 출시시켜 줍니다. 직접 쓰면 아무도 안 가진 물건이 남습니다.

**2:41** — *There is one more thing in that file list I did not expect to find.*
> 그 파일 목록에서 찾을 줄 몰랐던 게 하나 더 있습니다.

**2:45** — *A folder called Lang. English, three hundred and forty eight kilobytes of text. Simplified Chinese, three hundred and thirty five.*
> Lang이라는 폴더입니다. 영어 텍스트 348킬로바이트, 중국어 간체 335킬로바이트.

**2:54** — *The Steam page says this game supports English only. The Chinese is in the build anyway, because the translations are made by the community and the developer just ships them.*
> 스팀 페이지에는 영어만 지원한다고 되어 있습니다. 그런데 중국어가 빌드에 들어 있습니다. 번역을 커뮤니티가 만들고, 개발자는 그걸 그냥 실어 보내기 때문입니다.

**3:04** — *You can see it land. Of the last eight hundred reviews, four hundred and seventy six are English. A hundred and seventy five are Russian.*
> 효과가 보입니다. 최근 리뷰 800개 중 476개가 영어, 175개가 러시아어입니다.

**3:11** — *There's also a folder called custom music, with a read me inside. You can drop your own tracks into the game and it will play them.*
> custommusic이라는 폴더도 있고 안에 읽어보기 파일이 들어 있습니다. 자기 음악을 넣으면 게임이 틀어줍니다.

**3:19** — *None of that comes free with Unity. Somebody sat down and decided each one.*
> 그중 어느 것도 유니티가 공짜로 주지 않습니다. 누군가 앉아서 하나하나 결정한 겁니다.

## 리뷰 반응

**3:25** — *So what do people say about it?*
> 그래서 사람들은 이 게임을 어떻게 이야기할까요?

**3:29** — *The praise is about depth and atmosphere. The complaints are almost entirely about the interface, and about losing an eight hour run to a crash.*
> 칭찬은 깊이와 분위기에 관한 것입니다. 불만은 거의 전부 인터페이스, 그리고 충돌로 8시간짜리 플레이를 날린 것에 관한 것입니다.

**3:38** — *And the split is the widest I've measured. People who recommended it had played eleven hours. People who didn't, one.*
> 그리고 이 격차는 제가 측정한 것 중 가장 큽니다. 추천한 사람은 11시간을 플레이했고, 추천하지 않은 사람은 1시간이었습니다.

## 스펙 시트 · 판정

**3:45** — *Here's the whole teardown on one card.*
> 분해 결과를 카드 한 장으로 정리하면 이렇습니다.

**3:48** — *Unity two-D. One developer. Years on itch dot io before it ever reached Steam. Almost no third party code at all.*
> 유니티 2D. 개발자 한 명. 스팀에 오기 전 itch.io에서 수년. 서드파티 코드는 사실상 전무.

**3:57** — *And the trick worth stealing: eight hundred and fifty eight kilobytes of systems, instead of gigabytes of content.*
> 훔쳐갈 만한 요령은 이겁니다. 기가바이트의 콘텐츠 대신, 858킬로바이트의 시스템.

**4:04** — *Worth a dip. It's free, and it will cost you an evening. Or ten.*
> 찍먹할 가치 있음. 무료고, 저녁 한 번을 가져갑니다. 아니면 열 번을.

**4:08** — *If you're one or two people, this is the counter argument to the last episode. That game bought every hard system and shipped in months. This one wrote them and took years.*
> 당신이 한두 명이라면, 이건 지난 편에 대한 반론입니다. 그 게임은 어려운 시스템을 전부 사서 몇 달 만에 냈습니다. 이 게임은 직접 써서 몇 년이 걸렸습니다.

**4:20** — *Both of those work. Just know which one you're doing. Next time, another demo, another file list. This is Demo Dip.*
> 둘 다 됩니다. 다만 자기가 뭘 하고 있는지는 알고 하세요. 다음에도 또 다른 데모, 또 다른 파일 목록으로. Demo Dip이었습니다.

---

## 화면에 나오는 증거 카드 (영어 그대로 표시됨)

| 카드 | 제목 | 결론 문구 |
|---|---|---|
| 1:17 | THE ENGINE | *The boring, correct choice.* — 지루하지만 옳은 선택 |
| 1:34 | THE WHOLE GAME | *Two scenes. The world is generated.* — 씬 두 개. 세계는 생성된다 |
| 2:16 | THE SHOPPING LIST | *That is the entire list.* — 이게 목록의 전부다 |
| 2:45 | THE PART I DIDN'T EXPECT | *Translations come from the players.* — 번역은 플레이어들에게서 온다 |

## 썸네일 / 제목

- 썸네일: **Casualties: Unknown** / *858 KB. ONE DEV.* / 라벨 `UNITY 2D TEARDOWN`
- 제목: *Casualties: Unknown — one dev, 858 KB of code, and a free demo people play for 10 hours*
  → "개발자 한 명, 코드 858KB, 그리고 사람들이 10시간씩 하는 무료 데모"

## 주의해서 다룬 지점

- 게임에 폭력·유혈·우울·자해 묘사에 대한 스토어 경고가 있고, 한 리뷰어는 그 경고가 **약하게 표현됐다**고 지적합니다. 나레이션에서는 농담거리로 쓰지 않았습니다.
- 캐릭터 디자인(수인풍) 때문에 처음에 튕겨 나갔다가 남은 리뷰가 많은데, 이 부분은 다루지 않았습니다 — 제작 방식과 무관하고 조롱으로 읽힐 여지가 있어서입니다.
