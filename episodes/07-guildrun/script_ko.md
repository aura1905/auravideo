# 4화 Guildrun — 나레이션 한글 대조본

영상에 실제로 들어간 영어 나레이션과 그 뜻입니다. 검수용이며, 영상에는 영어만 나갑니다.
시각은 완성본 기준(`final.mp4`, 4분 15초).

| 시각 | 구간 |
|---|---|
| 0:00 | 콜드 오픈 |
| 0:13 | 로고 스팅 |
| 0:16 | 게임 소개 |
| 0:39 | 빌드 분해 |
| 3:05 | 리뷰 반응 |
| 3:37 | 스펙 시트 · 판정 |

---

## 콜드 오픈

**0:00** — *Half the people who reviewed this free demo had already played it for eleven hours. Not one of them quit inside ten minutes. Not one.*
> 이 무료 데모에 리뷰를 쓴 사람의 절반은 이미 11시간을 넣은 뒤였습니다. 10분 안에 그만둔 사람은 한 명도 없습니다. 단 한 명도요.

**0:08** — *And the people leaving negative reviews had played longer than the people leaving positive ones.*
> 그리고 부정적 리뷰를 쓴 사람들이 긍정적 리뷰를 쓴 사람들보다 **더 오래** 플레이했습니다.

*(0:13 — 로고 스팅)*

## 게임 소개

**0:16** — *Guildrun is a PvE autobattler roguelike. You build a team, you bend heroes out of their class, and you watch the fight resolve itself.*
> Guildrun은 PvE 오토배틀러 로그라이크입니다. 팀을 짜고, 영웅을 원래 클래스 밖으로 비틀고, 전투가 알아서 풀리는 걸 지켜봅니다.

**0:25** — *Nearly two thousand reviews, ninety percent positive, and about two and a half thousand people in it as I record this. That's the biggest demo I've taken apart.*
> 리뷰 약 2천 개, 90% 긍정, 녹음 시점 동시접속 약 2,500명. 지금까지 뜯어본 데모 중 가장 큽니다.

**0:35** — *It's also the first one where the file list told me the team had done this before.*
> 그리고 파일 목록만으로 "이 팀은 해본 사람들이다"라는 게 읽힌 첫 사례이기도 합니다.

## 빌드 분해

**0:39** — *Start with the awkward part. This is an IL2CPP build, so all the C# is fused into one Game Assembly file.*
> 껄끄러운 부분부터. IL2CPP 빌드라서, C# 코드가 전부 GameAssembly 파일 하나로 녹아 있습니다.

**0:47** — *In the last teardown that was a dead end. There's no folder of package names to read.*
> 지난 편에서는 여기가 막다른 길이었습니다. 패키지 이름이 담긴 폴더가 없거든요.

**0:53** — *Except it isn't quite a dead end. Any assembly that shipped with embedded resources leaves its name behind in a data file, and Steam lists those.*
> 그런데 완전한 막다른 길은 아닙니다. 내장 리소스를 가진 어셈블리는 데이터 파일에 **이름을 남기고**, 스팀이 그 파일 목록을 공개합니다.

**1:02** — *Twenty four names came out. Here's what a team that has shipped before installs.*
> 24개가 나왔습니다. 출시 경험이 있는 팀이 무엇을 까는지 보시죠.

**1:06** — *Sentry, with six assemblies and a native crash handler behind it. They've shipped a patch every single week since January. That's what makes that survivable.*
> Sentry — 어셈블리 6개에 네이티브 크래시 핸들러까지. 이 팀은 1월부터 **매주** 패치를 냈습니다. 그게 가능한 이유가 이겁니다.

**1:16** — *SQLite, because the demo alone has three hundred relics and a hundred items. At some point that stops being a pile of JSON files.*
> SQLite — 데모에만 유물 300개, 아이템 100개가 들어 있습니다. 어느 순간부터 JSON 파일 더미로는 감당이 안 됩니다.

**1:24** — *NLog for structured logging. R3 and System Reactive for event streams. Threading Channels for the producer-consumer work.*
> 구조적 로깅은 NLog. 이벤트 스트림은 R3와 System.Reactive. 생산자-소비자 처리는 Threading.Channels.

**1:33** — *And ZLinq, which exists for one reason: doing LINQ without allocating. You install that when you've been bitten by garbage collection hitches.*
> 그리고 ZLinq — 존재 이유가 딱 하나입니다. 할당 없이 LINQ 쓰기. GC 끊김에 데어 본 사람이 까는 물건입니다.

**1:41** — *None of that is exciting. It's the stuff you only know to install because something went wrong on the last project.*
> 하나도 화려하지 않습니다. 지난 프로젝트에서 뭔가 터져 봤기 때문에 알게 되는 것들이죠.

**1:48** — *Compare the solo demo I took apart two episodes ago. Its entire third party list was one entry: Discord rich presence.*
> 두 편 전에 뜯은 1인 개발 데모와 비교해 보세요. 서드파티 목록 전체가 딱 한 줄, Discord Rich Presence였습니다.

**1:56** — *Neither is wrong. But if you're about to start your second project, that list up there is a shopping list.*
> 어느 쪽도 틀리지 않았습니다. 다만 두 번째 프로젝트를 시작하려는 분이라면, 저 목록은 그대로 장바구니입니다.

**2:03** — *Audio is FMOD with Resonance, same as the last one. Networking is nanosockets, a thin UDP layer.*
> 오디오는 FMOD + Resonance, 지난 편과 같습니다. 네트워크는 얇은 UDP 계층인 nanosockets.

**2:11** — *Then the number I stared at for a while.*
> 그리고 한참 들여다본 숫자가 하나 있습니다.

**2:13** — *The demo is ten and a half gigabytes on disk. The download is one point one seven.*
> 이 데모는 디스크에서 10.5GB입니다. 다운로드는 1.17GB고요.

**2:19** — *That's an eighty nine percent saving. Which means the files sitting on your drive are barely compressed at all.*
> 89% 절감입니다. 즉, 드라이브에 놓인 파일들은 사실상 압축이 거의 안 된 상태입니다.

**2:25** — *My first thought was that somebody forgot the import settings. My second thought was to read the store page.*
> 처음엔 임포트 설정을 깜빡했나 싶었습니다. 두 번째로는 상점 페이지를 읽어 봤고요.

**2:31** — *Minimum requirements: fifteen gigabytes of storage, and a line that says HDD okay, no SSD required.*
> 최소 사양: 저장 공간 15GB, 그리고 "HDD 괜찮음, SSD 불필요"라는 한 줄.

**2:39** — *Uncompressed assets cost disk and save CPU. On a hard drive with no decompression to do, they load faster. My read is that this is deliberate.*
> 비압축 에셋은 디스크를 쓰고 CPU를 아낍니다. 압축 해제가 없는 하드디스크에서는 오히려 더 빨리 읽힙니다. 제 해석은 **의도된 선택**이라는 겁니다.

**2:49** — *They spent ten gigabytes of somebody's drive to keep the game playable on old hardware. Tell me in the comments if I've got that backwards.*
> 구형 하드웨어에서도 돌아가게 하려고 남의 드라이브 10GB를 쓴 겁니다. 제가 거꾸로 읽은 거라면 댓글로 알려주세요.

**2:56** — *There are also twenty two scenes in here. The last two games I took apart shipped one each and built everything at runtime. This one is authored in the editor.*
> 씬도 22개 들어 있습니다. 지난 두 편은 각각 씬 1개로 전부 런타임에 만들었죠. 이건 에디터에서 직접 만든 게임입니다.

## 리뷰 반응

**3:05** — *So the engineering is careful. The fight in the reviews is about something else entirely.*
> 엔지니어링은 꼼꼼합니다. 그런데 리뷰에서 벌어지는 싸움은 완전히 다른 얘기입니다.

**3:10** — *Performance barely comes up. Ten mentions positive, two negative. Nobody is complaining about the build.*
> 성능 얘기는 거의 없습니다. 긍정 10건, 부정 2건. 빌드를 탓하는 사람이 없어요.

**3:17** — *They're complaining about balance. Certain combinations only, dead heroes, and a random draw that decides your run before you play it.*
> 불만은 밸런스입니다. 특정 조합만 되고, 못 쓰는 영웅이 있고, 시작 전에 런의 승패가 뽑기로 정해진다는 것.

**3:25** — *And that's why the negative reviewers had fifteen hours in. You don't find a balance ceiling in an hour. You find it after you've mastered the thing.*
> 부정 리뷰어들이 15시간을 넣은 이유가 그겁니다. 밸런스 한계는 한 시간 만에 안 보입니다. 다 익힌 뒤에야 보이죠.

**3:33** — *Which is a very different problem from the demos where people quit in the first hour.*
> 첫 한 시간에 사람들이 나가버리는 데모와는 아주 다른 종류의 문제입니다.

## 스펙 시트 · 판정

**3:37** — *Here's the whole teardown on one card.*
> 분해 결과를 카드 한 장에 정리했습니다.

**3:40** — *Unity, IL2CPP, C#. A stack full of things you only reach for the second time around. Ten gigabytes of deliberately uncompressed art.*
> Unity, IL2CPP, C#. 두 번째 프로젝트에서야 손대게 되는 것들로 채운 스택. 그리고 의도적으로 압축하지 않은 10GB의 아트.

**3:50** — *Worth a dip, and be careful, because eleven hours is the median.*
> 한번 찍먹해 볼 만합니다. 다만 조심하세요, 중앙값이 11시간입니다.

**3:55** — *If you're starting your next project, take the boring half of that list. Crash reporting on day one is the cheapest thing you will ever install.*
> 다음 프로젝트를 시작한다면, 저 목록에서 지루한 쪽 절반을 가져가세요. 첫날 붙이는 크래시 리포팅이 평생 가장 싼 투자입니다.

**4:03** — *That's my read from the outside. If you made this and I got something wrong, say so and I'll pin the correction. Next time, another demo, another file list. This is Demo Dip.*
> 여기까지가 바깥에서 본 제 해석입니다. 만드신 분이 보시고 틀린 게 있다면 알려주세요, 정정 댓글을 고정하겠습니다. 다음에도 또 다른 데모, 또 다른 파일 목록으로. Demo Dip이었습니다.
