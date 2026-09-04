# 5화 Veiled Shadows — 나레이션 한글 대조본 (검수용, 렌더 전)

영어 대본 `script.json`(35줄, 나레이션 3분 55초)의 한글 대조본입니다.
**아직 렌더하지 않았습니다.** 시각은 나레이션 누적 기준의 대략치이며, 조립 후 확정됩니다.

승인하시면 그때 모션 레이어 → 조립 → export로 넘어갑니다.

| 구간 | 줄 |
|---|---|
| 콜드 오픈 | 01–02 |
| 게임 소개 | 03–06 |
| 빌드 분해 | 07–27 |
| 리뷰 반응 | 28–30 |
| 스펙 시트 · 판정 | 31–35 |

---

## 콜드 오픈

**01** — *Every demo I've taken apart on this channel was made in Unity, by people who write code. This one wasn't.*
> 이 채널에서 지금까지 뜯어본 데모는 전부 유니티였고, 코드를 쓰는 사람들이 만들었습니다. 이건 아닙니다.

**02** — *It was made in a tool sold on the promise that you never have to program. There's a C sharp compiler inside the build anyway.*
> "프로그래밍 안 해도 된다"는 약속으로 파는 툴로 만들었습니다. 그런데 빌드 안에는 C# 컴파일러가 들어 있습니다.

*(로고 스팅)*

## 게임 소개

**03** — *Veiled Shadows is a month in a rural mountain town. You build bonds during the day, and at night you go into another world.*
> Veiled Shadows는 산골 마을에서 보내는 한 달입니다. 낮에는 인연을 쌓고, 밤에는 다른 세계로 들어갑니다.

**04** — *Everyone who has played it reaches for the same word: Persona. One reviewer counted the nods to Persona four.*
> 해본 사람은 전부 같은 단어를 꺼냅니다. 페르소나. 어떤 리뷰어는 페르소나 4에 대한 오마주를 세어 봤다고 합니다.

**05** — *The battle menu is drawn as a handheld console, and your abilities are cartridges you slot into it.*
> 전투 메뉴가 휴대용 게임기 모양으로 그려져 있고, 스킬은 거기 꽂는 **카트리지**입니다.

**06** — *The demo went up five days ago. Six reviews, all positive. That's not a reception, so what I can actually read here is the build.*
> 데모는 닷새 전에 올라왔습니다. 리뷰 6개, 전부 긍정. 그건 반응이라고 부를 수 없죠. 그래서 이번에 제대로 읽을 수 있는 건 **빌드**입니다.

## 빌드 분해

**07** — *Steam publishes the file list for every demo. This one has seventy one entries.*
> 스팀은 모든 데모의 파일 목록을 공개합니다. 이건 항목이 71개입니다.

**08** — *The engine is RPG Developer Bakin, from a Japanese studio called SmileBoom. Seventy dollars on Steam, and it's sold as programming-free RPG creation.*
> 엔진은 RPG Developer Bakin, 일본 스마일붐(SmileBoom)이 만듭니다. 스팀에서 70달러고, **프로그래밍 없는 RPG 제작**이라고 팝니다.

**09** — *The game's own executable is five hundred and sixty two kilobytes. It's a launcher.*
> 게임 자체 실행 파일은 562킬로바이트입니다. 그냥 런처예요.

**10** — *What actually runs the game is bakinplayer dot exe, and the engine DLL sitting next to it.*
> 실제로 게임을 돌리는 건 bakinplayer.exe와 그 옆의 엔진 DLL입니다.

**11** — *Then there's one file that is the entire game.*
> 그리고 게임 전체나 다름없는 파일이 하나 있습니다.

**12** — *Data dot rbpack. One point three five gigabytes. Ninety five percent of the download.*
> data.rbpack. 1.35기가바이트. 다운로드의 95%입니다.

**13** — *Every map, every model, every portrait and every voice line this person made is inside that one file.*
> 이 사람이 만든 맵, 모델, 초상화, 음성 대사가 전부 그 파일 하나 안에 있습니다.

**14** — *The other seventy entries are the engine, shipped exactly as it arrived.*
> 나머지 70개는 엔진입니다. 받은 그대로 나갔습니다.

**15** — *Which is the interesting part, because of what a no-code tool puts in your game without asking.*
> 재미있는 건 여기부터입니다. 노코드 툴이 **묻지도 않고** 당신 게임에 넣어주는 것들 때문이죠.

**16** — *First. Microsoft Code Analysis, two DLLs, ten point seven megabytes. That's Roslyn. That is a C sharp compiler.*
> 첫째. Microsoft.CodeAnalysis, DLL 두 개, 10.7메가바이트. **Roslyn**입니다. C# 컴파일러예요.

**17** — *Bakin does offer an optional C sharp scripting feature, and this is what pays for it. Every game made in the tool carries a compiler, whether its author wrote a line of C sharp or not.*
> Bakin에는 선택적인 C# 스크립트 기능이 있고, 그 대가가 이겁니다. 이 툴로 만든 게임은 작성자가 C#을 한 줄이라도 썼든 안 썼든 컴파일러를 지고 다닙니다.

**18** — *Second. WebView two, and an Edge browser control. There is a web browser inside this turn-based RPG.*
> 둘째. WebView2와 엣지 브라우저 컨트롤. 이 턴제 RPG 안에 **웹 브라우저**가 들어 있습니다.

**19** — *I could not work out what it's for from a file list. If you've built something in Bakin, the comments are right there.*
> 파일 목록만으로는 용도를 알아내지 못했습니다. Bakin으로 만들어 보신 분은 댓글 부탁드립니다.

**20** — *Third, and this is the one worth taking away. VRM Loader.*
> 셋째, 그리고 이건 가져갈 만합니다. VRMLoader.

**21** — *VRM is the avatar format VRoid Studio exports. The format VTubers use.*
> VRM은 VRoid Studio가 내보내는 아바타 포맷입니다. 버튜버들이 쓰는 그 포맷이요.

**22** — *So a solo developer can pull a three-D character out of an avatar maker instead of modelling one from scratch.*
> 즉 1인 개발자가 3D 캐릭터를 처음부터 모델링하는 대신 **아바타 메이커에서 뽑아 쓸 수 있다**는 뜻입니다.

**23** — *The shaders ship as plain text, uncompiled. Seven include files, thirty eight kilobytes between them. One is six bytes long.*
> 셰이더는 컴파일 안 된 **평문 텍스트**로 들어갑니다. include 파일 7개, 합쳐서 38킬로바이트. 그중 하나는 6바이트짜리입니다.

**24** — *They get compiled on your machine when you play. That's what the seventeen megabyte DirectX shader compiler next to them is for.*
> 플레이할 때 당신 컴퓨터에서 컴파일됩니다. 옆에 있는 17메가바이트짜리 DirectX 셰이더 컴파일러가 그래서 있는 거고요.

**25** — *And there's a log file in there. Bakinplayer log dot txt, from the developer's own session, shipped to players.*
> 그리고 로그 파일이 하나 들어 있습니다. bakinplayer_log.txt — 개발자 본인 세션에서 나온 게 플레이어에게 그대로 갔습니다.

**26** — *It's fourteen kilobytes. Two episodes ago the same mistake was seven hundred and seventy megabytes of debug symbols. Four orders of magnitude apart.*
> 14킬로바이트입니다. 두 편 전에는 같은 실수가 770메가바이트짜리 디버그 심볼이었죠. 자릿수로 네 자리 차이입니다.

**27** — *There are four readme files too, in English, Japanese and both kinds of Chinese, on a store page that lists English only. Those are the engine's own readmes, which tells you the folder went out untouched.*
> readme 파일도 4개 있습니다. 영어, 일본어, 그리고 중국어 간체·번체 — 상점 페이지에는 영어만 있는데 말이죠. 엔진 자체의 readme고, 그 폴더가 손도 안 댄 채 나갔다는 뜻입니다.

## 리뷰 반응

**28** — *Now the six reviews. You can't count six of anything, but you can read them.*
> 이제 리뷰 6개. 6개로는 셀 수 없지만, 읽을 수는 있습니다.

**29** — *One of them tells me the developer is one person in Austria. That's the team size, from a player, not a press kit.*
> 그중 하나가 개발자는 **오스트리아의 1인**이라고 알려줍니다. 보도자료가 아니라 플레이어에게서 나온 팀 규모입니다.

**30** — *Two of them mention the voice acting, unprompted. And one had seven hours on a demo that covers a few in-game days.*
> 둘은 묻지도 않았는데 **성우 연기**를 언급합니다. 그리고 한 명은 게임 내 며칠치밖에 안 되는 데모에 7시간을 넣었습니다.

## 스펙 시트 · 판정

**31** — *Here's the whole teardown on one card.*
> 분해 결과를 카드 한 장에 정리했습니다.

**32** — *Bakin, seventy dollars, one person. One point three five gigabytes of their content against sixty seven megabytes of engine they didn't write.*
> Bakin, 70달러, 1인. 본인이 만든 콘텐츠 1.35기가바이트 대 직접 쓰지 않은 엔진 67메가바이트.

**33** — *Worth a dip, and worth it for the art alone.*
> 찍먹해 볼 만합니다. 그림만으로도 값을 합니다.

**34** — *If somebody has told you no-code means a low ceiling, this build ships a C sharp compiler. The ceiling is wherever you stop.*
> 노코드는 천장이 낮다고 누가 말했다면, 이 빌드는 C# 컴파일러를 싣고 나갑니다. 천장은 당신이 멈추는 자리입니다.

**35** — *And before you publish, open your engine folder. That's my read from the outside, though. If you made this and I got something wrong, say so and I'll pin the correction. Next time, another demo, another file list. This is Demo Dip.*
> 그리고 배포 전에 엔진 폴더를 한 번 열어보세요. 어디까지나 바깥에서 본 제 해석입니다. 만드신 분이 보시고 틀린 게 있다면 알려주세요, 정정 댓글을 고정하겠습니다. 다음에도 또 다른 데모, 또 다른 파일 목록으로. Demo Dip이었습니다.

---

## 검수 포인트

- **28번**은 리뷰가 6개뿐이라는 걸 영상 안에서 먼저 인정하고 들어갑니다. 숨기면 신뢰를 잃는 자리입니다.
- **19번**(WebView2 용도 모름)과 **35번**(정정 요청)이 이번 편의 "모르는 건 모른다" 표시입니다.
- **26번**은 6화(Expedition)를 직접 참조합니다 — 편이 쌓일수록 이런 연결이 구독 이유가 됩니다.
- 마무리가 격언조로 끝나는 줄은 14·26·34·35 네 개로, `docs/CHANNEL.md`의 상한(4)에 맞췄습니다.
