# 6화 PengPong (펭퐁) — 나레이션 한글 대조본 (검수용, 렌더 전)

한국어 채널 3화(`episodes/ko-03-pengpong`)와 **같은 분해 자료로 새로 쓴 영어 대본**입니다. 번역이 아닙니다.
영어 40줄, 나레이션 4분 45초, 완성 예상 5분 05초. 자막에는 IL2CPP / FMOD / DLL / asmdef가
원문 표기로 나가고, 발음은 `pron_en.json` 사전이 TTS에만 적용합니다.

| 시각 | 구간 |
|---|---|
| 0:00 | 콜드 오픈 (01–02) |
| 0:11 | 로고 스팅 |
| 0:14 | 게임 소개 (03–07) |
| 0:49 | 빌드 분해 (08–32) |
| 4:05 | 리뷰 반응 (33–35) |
| 4:23 | 스펙 시트 · 판정 (36–40) |

---

## 콜드 오픈

**01 · 0:00** — *Ninety five dollars. That is every paid tool in this build, added up.*
> 95달러. 이 빌드에 들어간 유료 도구를 전부 합친 값입니다.

**02 · 0:04** — *Everything else is free or open source. And one file in there was never supposed to ship at all.*
> 나머지는 전부 무료거나 오픈소스입니다. 그리고 그 안에, 애초에 출시본에 있으면 안 되는 파일이 하나 있습니다.

## 게임 소개

**03 · 0:14** — *PengPong is a survivors-like where a penguin with a hockey stick whacks whatever is in front of it. Guns. Pufferfish. Other penguins.*
> 펭퐁은 펭귄이 하키채로 눈앞의 아무거나 후려치는 뱀서라이크입니다. 총이든, 복어든, 다른 펭귄이든.

**04 · 0:23** — *It's from a Korean studio called SANDY FLOOR, and the full game came out on August twentieth.*
> 한국 스튜디오 SANDY FLOOR 작품이고, 본편은 8월 20일에 나왔습니다.

**05 · 0:28** — *The demo sits at eighty six percent, the full game at eighty five. Nearly all of the praise is for the art.*
> 데모 평가 86%, 본편 85%. 칭찬은 거의 전부 그림에 몰려 있습니다.

**06 · 0:35** — *Nineteen thirties rubber-hose cartoon. Cuphead comes up in review after review. That look normally costs a lot of money.*
> 1930년대 러버호스 카툰. 리뷰마다 Cuphead 얘기가 나옵니다. 이런 그림은 보통 돈이 많이 듭니다.

**07 · 0:44** — *So that was my question. What did this team buy, and what did they build.*
> 그래서 궁금했습니다. 이 팀은 뭘 샀고, 뭘 직접 만들었을까.

## 빌드 분해

**08 · 0:49** — *Steam publishes the list of files a demo installs. PengPong's is two hundred and eighty two files, two point six eight gigabytes.*
> 스팀은 데모가 설치하는 파일 목록을 공개합니다. 펭퐁은 282개, 2.68GB입니다.

**09 · 0:57** — *The first clue is a folder name. MonoBleedingEdge.*
> 첫 단서는 폴더 이름입니다. MonoBleedingEdge.

**10 · 1:01** — *Unity builds your code one of two ways. IL2CPP turns the C# into native code and fuses it into one block. Mono leaves the DLLs as they are.*
> 유니티는 코드를 두 방식 중 하나로 빌드합니다. IL2CPP는 C#을 네이티브로 바꿔 한 덩어리로 합치고, Mono는 DLL을 그대로 둡니다.

**11 · 1:12** — *PengPong is Mono. So everything this team pulled in is sitting there under its own file name.*
> 펭퐁은 Mono입니다. 그래서 이 팀이 갖다 쓴 게 전부 제 파일 이름을 달고 놓여 있습니다.

**12 · 1:18** — *Audio is FMOD. Four sound bank files, twenty nine megabytes.*
> 오디오는 FMOD. 사운드 뱅크 파일 4개, 29MB.

**13 · 1:23** — *Take this one with you. FMOD is free below two hundred thousand dollars a year in revenue. There is no reason an indie can't use commercial audio middleware.*
> 이건 가져가세요. FMOD는 연매출 20만 달러 미만이면 무료입니다. 인디가 상용 오디오 미들웨어를 못 쓸 이유가 없습니다.

**14 · 1:32** — *The paid items are exactly two. Text Animator, sixty five dollars. Ara Trails, thirty.*
> 돈 주고 산 건 정확히 두 개입니다. Text Animator 65달러, Ara Trails 30달러.

**15 · 1:39** — *DOTween, GameAnalytics, UIParticle, NavMeshPlus. All free, or open source.*
> DOTween, GameAnalytics, UIParticle, NavMeshPlus. 전부 무료거나 오픈소스입니다.

**16 · 1:45** — *So what did they animate that Cuphead look with. Normally that's Spine, and a personal licence for Spine is three hundred and forty nine dollars.*
> 그럼 저 Cuphead풍 애니메이션은 뭘로 했을까요. 보통은 Spine이고, 개인 라이선스가 349달러입니다.

**17 · 1:54** — *There is no Spine in this build. There is Unity's own 2D Animation package, and the IK package next to it.*
> 이 빌드에 Spine은 없습니다. 유니티 자체 2D Animation 패키지와 그 옆의 IK 패키지가 있습니다.

**18 · 2:01** — *Same idea. You put bones in a drawing and move the bones. And you get it from the Package Manager for nothing.*
> 원리는 같습니다. 그림에 뼈를 심고 뼈를 움직입니다. 그리고 Package Manager에서 공짜로 받습니다.

**19 · 2:08** — *Now the strangest thing in the list. Assembly-CSharp.dll is five kilobytes.*
> 이제 목록에서 제일 이상한 것. Assembly-CSharp.dll이 5KB입니다.

**20 · 2:14** — *Unless you tell it otherwise, Unity puts all of your game code in that one file. Five kilobytes means the code has been moved out.*
> 따로 설정하지 않으면 유니티는 게임 코드를 전부 그 파일 하나에 넣습니다. 5KB라는 건 코드를 밖으로 빼놨다는 뜻입니다.

**21 · 2:22** — *The mechanism is called an Assembly Definition, asmdef for short. One small file in a folder, and that folder compiles to its own DLL.*
> 그 장치를 Assembly Definition, 줄여서 asmdef라고 합니다. 폴더에 작은 파일 하나를 두면 그 폴더가 별도 DLL로 컴파일됩니다.

**22 · 2:33** — *What you get is compile time. Change one line and only that module rebuilds, not the whole project. The bigger the project, the bigger the difference.*
> 얻는 건 컴파일 시간입니다. 한 줄 고치면 프로젝트 전체가 아니라 그 모듈만 다시 빌드됩니다. 프로젝트가 클수록 차이가 큽니다.

**23 · 2:42** — *Eight modules came out of this, and every one carries the studio's name. SandyToolkit. SandyAudio. SandyPooling. SandySetting. SandyDependency.*
> 그렇게 나온 모듈이 8개고, 전부 스튜디오 이름이 붙어 있습니다. SandyToolkit, SandyAudio, SandyPooling, SandySetting, SandyDependency.

**24 · 2:53** — *Pooling, audio, settings, dependency injection. The things you rewrite for every game. This team carries them to the next project as folders.*
> 풀링, 오디오, 세팅, 의존성 주입. 게임마다 다시 짜게 되는 것들입니다. 이 팀은 그걸 폴더째 다음 프로젝트로 가져갑니다.

**25 · 3:02** — *Saves go through SQLite. With over three hundred items, that beats one big JSON file.*
> 세이브는 SQLite로 갑니다. 아이템이 300개 넘으면 JSON 파일 하나보다 낫습니다.

**26 · 3:10** — *Content is split into seventeen Addressables bundles, five hundred and twenty nine megabytes. A patch only downloads the bundles that changed.*
> 콘텐츠는 Addressables 번들 17개, 529MB로 나뉘어 있습니다. 패치 때는 바뀐 번들만 내려받습니다.

**27 · 3:18** — *There's a Localization package too. Eight languages go through it.*
> Localization 패키지도 있습니다. 8개 언어가 이걸로 들어갑니다.

**28 · 3:23** — *And then two things that should not be in a release build. The first is Unity Recorder, an editor tool for capturing video. Harmless. Somebody forgot to take it out.*
> 그리고 출시 빌드에 있으면 안 되는 게 둘. 첫째는 Unity Recorder, 에디터용 영상 캡처 도구입니다. 무해하지만, 빼는 걸 잊은 거죠.

**29 · 3:33** — *The second is MCP for Unity. That's the open source bridge that lets an AI model drive the Unity editor directly.*
> 둘째는 MCP for Unity. AI 모델이 유니티 에디터를 직접 조작하게 이어주는 오픈소스입니다.

**30 · 3:40** — *What I can confirm is that the file is in the shipped build. How much they used it, and for what, only the developer knows.*
> 확인된 건 그 파일이 출시 빌드에 들어 있다는 것까지입니다. 얼마나, 어디에 썼는지는 개발자만 압니다.

**31 · 3:47** — *My guess is it was wired up for development and went out with everything else. If I'm wrong, say so in the comments and I'll pin the correction.*
> 제 짐작은 개발용으로 붙여뒀다가 나머지와 함께 나간 쪽입니다. 틀렸다면 댓글로 알려주세요, 정정을 고정하겠습니다.

**32 · 3:55** — *For scale: of the two point six eight gigabytes, art and sound are two point two. All one hundred and ninety five DLLs together are ninety one megabytes.*
> 규모감: 2.68GB 중 그림과 소리가 2.2GB. DLL 195개를 다 합쳐도 91MB입니다.

## 리뷰 반응

**33 · 4:05** — *Now the reviews of the full game, where the complaints land in one place. It launched with three stages.*
> 이제 본편 리뷰. 불만이 한곳에 몰립니다. 스테이지 3개로 출시했다는 것.

**34 · 4:12** — *Tools outlive the game they were built for. But the hours that went into them are hours this game's content did not get.*
> 도구는 그걸 만든 게임보다 오래 남습니다. 하지만 거기 들어간 시간은 이 게임의 콘텐츠가 받지 못한 시간입니다.

**35 · 4:18** — *Eight frameworks and three stages. Those two numbers come from the same team.*
> 프레임워크 8개와 스테이지 3개. 이 두 숫자가 같은 팀에서 나옵니다.

## 스펙 시트 · 판정

**36 · 4:23** — *Here's the whole teardown on one card.*
> 분해 결과를 카드 한 장에 정리했습니다.

**37 · 4:25** — *Unity, Mono. Ninety five dollars of paid assets. Unity 2D Animation instead of Spine. Eight in-house modules. Three stages.*
> Unity, Mono. 유료 에셋 95달러. Spine 대신 Unity 2D Animation. 자체 모듈 8개. 스테이지 3개.

**38 · 4:36** — *Worth a dip. The demo is free, and hitting things with that stick feels as good as it looks.*
> 찍먹할 만합니다. 데모는 무료고, 그 채로 후려치는 손맛은 보이는 만큼 좋습니다.

**39 · 4:41** — *Three things to take away. FMOD is free for indies. You can do bone animation without paying for Spine. And splitting your code into asmdefs is what makes a big project compile fast.*
> 가져갈 것 세 가지. FMOD는 인디에게 무료. Spine 없이도 뼈 애니메이션은 됩니다. 그리고 코드를 asmdef로 쪼개는 게 큰 프로젝트를 빨리 컴파일하게 만듭니다.

**40 · 4:53** — *That's my read from the outside. If you made this and I got something wrong, say so and I'll pin the correction. Next time, another demo, another file list. This is Demo Dip.*
> 바깥에서 본 제 해석입니다. 만드신 분이 보시고 틀린 게 있다면 알려주세요, 정정을 고정하겠습니다. 다음에도 또 다른 데모, 또 다른 파일 목록으로. Demo Dip이었습니다.

---

## 검수 포인트

- 한국어판과 사실은 같지만 문장은 새로 썼습니다. 특히 **28–31번**(Unity Recorder / MCP)은 "확인된 것"과 "추정"을 영어로도 분리해 뒀습니다.
- 격언조로 끝나는 줄: 06, 13, 22, 35 — 상한(4)에 맞췄습니다(34번은 평서문으로 바꿨습니다).
- 발음: PvE/LINQ 같은 오독 위험 토큰은 이 편에 없고, IL2CPP·SQLite·FMOD·DLL·asmdef·MCP는 사전에 있습니다.
