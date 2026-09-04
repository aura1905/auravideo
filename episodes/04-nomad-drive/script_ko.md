# 1화 Nomad Drive — 나레이션 한글 대조본

영상에 실제로 들어간 영어 나레이션과 그 뜻입니다. 검수용이며, 영상에는 영어만 나갑니다.
시각은 완성본 기준(`final.mp4`, 4분 52초).

| 시각 | 구간 |
|---|---|
| 0:00 | 콜드 오픈 |
| 0:13 | 로고 스팅 |
| 0:16 | 게임 소개 |
| 0:56 | 빌드 분해 |
| 3:44 | 리뷰 반응 |
| 4:10 | 스펙 시트 · 판정 |

---

## 콜드 오픈

**0:00** — *Two of the most upvoted reviews on this Steam demo say the same thing. It's a crypto miner. Don't install it.*
> 이 스팀 데모에서 가장 많은 추천을 받은 리뷰 두 개가 똑같은 말을 합니다. 크립토 마이너다. 설치하지 마라.

**0:06** — *It isn't. But I know why they think that, and it's sitting in the game's own file list.*
> 아닙니다. 그런데 왜 그렇게 생각하는지는 저도 압니다. 이 게임의 파일 목록에 들어 있거든요.

*(0:13 — 로고 스팅)*

## 게임 소개

**0:16** — *This is Nomad Drive. You repair a rundown RV and drive it across a procedurally generated wasteland, alone or with up to three friends.*
> 이 게임은 Nomad Drive입니다. 낡은 캠핑카를 고쳐서, 절차적으로 생성된 황무지를 달립니다. 혼자서도, 최대 네 명이서도.

**0:26** — *The demo went up on June fifteenth. Right now, while I'm recording this, about two thousand people are inside it.*
> 데모는 6월 15일에 올라왔습니다. 지금 이 녹음을 하는 순간에도 약 2천 명이 접속해 있습니다.

**0:32** — *Seven hundred ninety four recent reviews, seventy one percent positive. Steam calls that Mostly Positive.*
> 최근 리뷰 794개, 긍정 71%. 스팀은 이걸 "대체로 긍정적"이라고 부릅니다.

**0:40** — *The number that made me pick this one: the median reviewer had two hours and thirty six minutes on it before they wrote anything.*
> 제가 이 게임을 고른 이유가 된 숫자. 리뷰어의 중간값이, 한 글자 쓰기 전에 이미 2시간 36분을 찍었습니다.

**0:47** — *Two and a half hours, in a free demo. Nobody is bouncing off this. Some of them just think it's mining crypto while they play.*
> 두 시간 반, 무료 데모에서요. 아무도 튕겨 나가지 않습니다. 그중 일부가 "하는 동안 채굴당하고 있다"고 생각할 뿐입니다.

## 빌드 분해

**0:56** — *Those two things have the same cause, and I can show you, because Steam publishes a file list for every demo.*
> 이 두 가지는 원인이 같습니다. 보여드릴 수 있고요. 스팀이 모든 데모의 파일 목록을 공개하거든요.

**1:03** — *Three hundred and twenty two entries. Three point seven gigabytes. No unpacking, no decompiling, nothing private. Just names and sizes.*
> 항목 322개, 3.7기가바이트. 압축을 풀지도, 디컴파일하지도, 비공개 정보를 건드리지도 않았습니다. 파일 이름과 크기뿐입니다.

**1:12** — *Start with the engine. The first line is already odd.*
> 엔진부터. 첫 줄부터 이상합니다.

**1:16** — *It's Unity. But it's the High Definition Render Pipeline, and there's a GPU driven runtime in there too, which puts it on Unity six.*
> 유니티입니다. 그런데 HDRP(고해상도 렌더 파이프라인)이고, GPU 구동 런타임까지 들어 있습니다. 유니티 6이라는 뜻입니다.

**1:26** — *Almost every small team picks the Universal pipeline instead. It's lighter and it runs on anything. HDRP looks better and costs more to run.*
> 소규모 팀은 거의 다 URP를 씁니다. 가볍고 아무 데서나 돌아가니까요. HDRP는 더 잘 나오고, 돌리는 데 더 듭니다.

**1:36** — *Which brings us back to the crypto miner. There is no miner in that file list. What there is, is a very expensive renderer and, apparently, nothing capping the frame rate.*
> 그래서 다시 크립토 마이너 얘기로 돌아옵니다. 그 파일 목록에 채굴기는 없습니다. 있는 건 아주 비싼 렌더러와, 보아하니 프레임 제한이 없다는 사실입니다.

**1:46** — *Players reported ninety nine percent GPU load sitting in the menu. On a five thousand series card. Doing nothing.*
> 플레이어들이 메뉴 화면에서 GPU 점유율 99%를 보고했습니다. 5000번대 그래픽카드에서요. 아무것도 안 하고 있는데도.

**1:54** — *That's what an uncapped render loop looks like from outside. Your fans spin up on a menu screen, and you assume something is stealing from you.*
> 제한 없는 렌더 루프는 밖에서 보면 그렇습니다. 메뉴 화면인데 팬이 돌기 시작하면, 뭔가 훔쳐 가고 있다고 생각하게 되죠.

**2:02** — *So that's the look. What about the driving, which is the entire point of the game?*
> 여기까지가 비주얼입니다. 그럼 이 게임의 핵심인 주행은요?

**2:08** — *They licensed it. Vehicle Physics two, its wheel controller, and the multiplayer add on that ships with it.*
> 사 왔습니다. Vehicle Physics 2, 그 휠 컨트롤러, 그리고 거기 딸려 오는 멀티플레이 애드온까지.

**2:14** — *Which is the right call. Writing a vehicle simulator is a year of your life, easily. Nobody should be doing that twice.*
> 옳은 판단입니다. 차량 시뮬레이터를 직접 쓰면 1년은 그냥 갑니다. 그걸 두 번 할 이유는 없죠.

**2:22** — *Same story for the world. The terrain is MapMagic two, a node graph that generates the map at runtime.*
> 월드도 같은 이야기입니다. 지형은 MapMagic 2, 실행 중에 맵을 생성하는 노드 그래프입니다.

**2:29** — *That explains a complaint that shows up over and over in the Chinese reviews. It gets repetitive a few hours in.*
> 중국어 리뷰에서 반복해서 나오는 불만이 이걸로 설명됩니다. 몇 시간 하면 반복적이 된다는 것.

**2:38** — *And there are only four scenes in the whole build, the biggest one half a megabyte. The gigabytes are all loot and locations, streamed in.*
> 그리고 빌드 전체에 씬이 네 개뿐입니다. 제일 큰 게 0.5메가바이트. 기가바이트 단위는 전부 전리품과 장소이고, 스트리밍으로 불러옵니다.

**2:46** — *Then the co-op, which is where a small team usually drowns.*
> 다음은 코옵입니다. 소규모 팀이 대개 빠져 죽는 지점이죠.

**2:50** — *Mirror, which is free and open source, running over the Epic Online Services relay, with Steam lobbies next to it and Vivox for voice.*
> Mirror입니다. 무료 오픈소스고, Epic Online Services 릴레이 위에서 돌아갑니다. 옆에는 스팀 로비, 음성은 Vivox.

**2:59** — *Server bill, zero. That shows up in the reviews too. Two players in the same city, five kilometres apart, getting three to four hundred milliseconds.*
> 서버 비용 0원. 그게 리뷰에도 나타납니다. 같은 도시에서 5km 떨어진 두 플레이어가 300~400밀리초를 찍습니다.

**3:09** — *That's not a bug in their code. That's what a free global relay does. Your traffic goes wherever the relay happens to be.*
> 그들 코드의 버그가 아닙니다. 무료 글로벌 릴레이가 원래 그렇습니다. 트래픽이 릴레이가 있는 곳으로 갑니다.

**3:16** — *So the driving is bought, the world is bought, the netcode is bought. What did they actually build?*
> 주행도 샀고, 월드도 샀고, 네트워크도 샀습니다. 그럼 이 팀은 뭘 만든 걸까요?

**3:22** — *Sixteen assemblies of their own. Dependency injection, save system, localization, input, audio, settings, and the glue over Mirror.*
> 자체 어셈블리 16개입니다. 의존성 주입, 세이브 시스템, 현지화, 입력, 오디오, 설정, 그리고 Mirror 위를 덮는 접착층.

**3:30** — *That is a studio framework. Whoever is behind Indie Devil has shipped software before.*
> 그건 스튜디오 프레임워크입니다. Indie Devil 뒤에 있는 사람이 누구든, 전에 소프트웨어를 출시해 본 사람입니다.

**3:36** — *Although they also shipped a folder that Unity itself names Do Not Ship, and left every asset package's sample code in the build.*
> 물론 유니티가 직접 "출하하지 말 것"이라고 이름 붙인 폴더도 같이 출하했고, 에셋 패키지들의 샘플 코드도 전부 빌드에 남겨뒀습니다.

## 리뷰 반응

**3:44** — *That's what shipping fast looks like. In the reviews, driving is what people talk about most, and performance is what they complain about loudest.*
> 빠르게 내면 그렇게 됩니다. 리뷰에서 가장 많이 이야기되는 건 주행이고, 가장 크게 불평받는 건 성능입니다.

**3:53** — *And the split is telling. Positive reviewers had played three hours and eighteen minutes. Negative reviewers, one hour and twelve.*
> 그리고 이 격차가 말해줍니다. 긍정 리뷰어는 3시간 18분을 플레이했고, 부정 리뷰어는 1시간 12분이었습니다.

**4:01** — *The word potential shows up in fifty positive reviews and two negative ones. People aren't asking for a finished game. They want it to run.*
> "가능성"이라는 단어가 긍정 리뷰 50개, 부정 리뷰 2개에 나옵니다. 사람들은 완성된 게임을 요구하는 게 아닙니다. 돌아가기를 원하는 겁니다.

## 스펙 시트 · 판정

**4:10** — *Here's the whole teardown on one card.*
> 분해 결과를 카드 한 장으로 정리하면 이렇습니다.

**4:12** — *Unity six on HDRP. Team size never disclosed. Public devlogs going back to twenty twenty four. Mirror, Epic Online Services, MapMagic, and Vehicle Physics two.*
> 유니티 6, HDRP. 팀 규모는 비공개. 공개 데브로그는 2024년까지 거슬러 올라감. Mirror, Epic Online Services, MapMagic, Vehicle Physics 2.

**4:25** — *And the trick, if you want one: they licensed every hard system and spent their own time on the glue and the content.*
> 요령을 하나 가져가자면, 어려운 시스템은 전부 사고 자기 시간은 접착층과 콘텐츠에 썼다는 것.

**4:32** — *Worth a dip. Early access is set for September thirtieth, and the demo is free right now.*
> 찍먹할 가치 있음. 얼리액세스는 9월 30일 예정이고, 데모는 지금 무료입니다.

**4:38** — *If you're shipping a demo this year, the lesson costs you one afternoon. Cap your frame rate in the menu, or the internet will decide you're a miner.*
> 올해 데모를 낼 생각이라면, 이 교훈은 오후 한나절이면 됩니다. 메뉴에서 프레임 제한을 거세요. 아니면 인터넷이 당신을 채굴기로 판정합니다.

**4:46** — *Next time, another demo, another file list. This is Demo Dip.*
> 다음에도 또 다른 데모, 또 다른 파일 목록으로 찾아옵니다. Demo Dip이었습니다.

---

## 화면에 나오는 증거 카드 (영어 그대로 표시됨)

| 카드 | 제목 | 결론 문구 |
|---|---|---|
| 1:16 | THE ENGINE | *Small teams pick URP. This one didn't.* — 소규모 팀은 URP를 고른다. 여긴 아니었다 |
| 2:08 | THE DRIVING | *Nobody wrote a vehicle sim. They bought one.* — 아무도 차량 시뮬을 쓰지 않았다. 사 왔다 |
| 2:22 | THE WORLD | *The map is built at runtime, from a node graph.* — 맵은 실행 중에 노드 그래프로 만들어진다 |
| 2:50 | THE CO-OP | *Zero server bill. Latency you don't control.* — 서버 비용 0. 대신 지연시간은 통제 불가 |
| 3:22 | WHAT THEY BUILT | *That's a studio framework, not a hobby layout.* — 취미 프로젝트 구조가 아니라 스튜디오 프레임워크다 |
| 3:36 | THE SMALL TELLS | *Shipped fast. You can see where.* — 빠르게 냈다. 어디서 그랬는지 보인다 |

## 썸네일 / 제목

- 썸네일: **Nomad Drive** / *99% GPU. IN THE MENU.* / 라벨 `UNITY 6 / HDRP TEARDOWN`
- 제목: *Nomad Drive — players think this demo is a crypto miner. Here's what's really in it*
  → "플레이어들은 이 데모가 크립토 마이너라고 생각한다. 실제로 안에 뭐가 들었는지 보자"
