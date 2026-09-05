# 7화 FINAL FANTASY RESONANCE — 나레이션 한글 대조본 (검수용, 렌더 전)

영어 30줄, 나레이션 4분 17초, 완성 예상 4분 33초. 리뷰가 없는 데모(출시 전이라 스퀘어에닉스가 꺼둠)라
**"누가 만들었나 + 뭘로 만들었나 + 데모 규모"**에 무게를 뒀습니다. 증거카드 3줄 빼고 전부 트레일러 실사 위에서 갑니다.

| 시각 | 구간 |
|---|---|
| 0:00 | 콜드 오픈 (01–02) |
| 0:13 | 로고 스팅 |
| 0:16 | 게임 소개·제작진 (03–08) |
| 1:11 | 빌드 분해 (09–22) |
| 3:31 | 반응 (23–25) |
| 3:53 | 스펙 시트 · 판정 (26–30) |

---

## 콜드 오픈

**01 · 0:00** — *Four thousand four hundred people are playing this demo right now. Two days after it went up. That's more than any demo I've taken apart.*
> 지금 이 데모를 4,400명이 하고 있습니다. 올라온 지 이틀 만에요. 제가 뜯어본 데모 중 최다입니다.

**02 · 0:07** — *It's a pixel-art Final Fantasy, and the build has a machine learning runtime inside it.*
> 픽셀아트 파이널 판타지인데, 빌드 안에 머신러닝 런타임이 들어 있습니다.

## 게임 소개 · 제작진

**03 · 0:16** — *FINAL FANTASY RESONANCE is the first HD-2D Final Fantasy. Pixel characters, a 3D world, and the Octopath Traveler look.*
> FINAL FANTASY RESONANCE는 첫 HD-2D 파이널 판타지입니다. 픽셀 캐릭터, 3D 세계, 옥토패스 트래블러의 그 룩.

**04 · 0:25** — *Which makes sense, because it's the Octopath team. Team Asano at Square Enix, with a Tokyo studio called LANCARSE doing the co-development.*
> 당연한 게, 옥토패스 팀이니까요. 스퀘어에닉스 아사노 팀에, 도쿄의 LANCARSE가 공동 개발입니다.

**05 · 0:34** — *LANCARSE is the studio you've played without knowing it. Shin Megami Tensei Strange Journey, Lost Dimension, The DioField Chronicle.*
> LANCARSE는 모르고 해본 적 있는 스튜디오입니다. 진 여신전생 Strange Journey, Lost Dimension, The DioField Chronicle.

**06 · 0:43** — *The story is season one of Brave Exvius, the mobile game, rebuilt. And in battle you summon Visions, which are classic Final Fantasy characters. Cloud shows up.*
> 스토리는 모바일 게임 Brave Exvius 시즌 1을 다시 만든 것. 전투에선 '비전'을 소환하는데, 역대 FF 캐릭터들입니다. 클라우드가 나옵니다.

**07 · 0:53** — *The demo is not a slice. The Japanese title says it outright: the whole of chapter one, ahead of release. The full game lands October twenty second.*
> 데모는 맛보기가 아닙니다. 일본어 제목이 대놓고 말합니다: 1장 통째, 선행 체험. 본편은 10월 22일.

**08 · 1:03** — *There are no reviews to read. Square Enix switches them off before launch. So this one is the build and the people, which is the part I can actually check.*
> 읽을 리뷰가 없습니다. 스퀘어에닉스는 출시 전엔 꺼둡니다. 그래서 이번 편은 빌드와 사람들 얘기입니다 — 제가 실제로 확인할 수 있는 부분이죠.

## 빌드 분해

**09 · 1:11** — *Steam publishes the file list for every demo. This one is twenty six files, five point seven gigabytes.*
> 스팀은 모든 데모의 파일 목록을 공개합니다. 이건 26개, 5.7GB입니다.

**10 · 1:18** — *It's Unreal Engine 5. You can tell from two file extensions, ucas and utoc. That container format only exists in five.*
> 언리얼 엔진 5입니다. 확장자 두 개로 압니다 — ucas, utoc. 그 컨테이너 포맷은 5에만 있습니다.

**11 · 1:26** — *Almost all of the size is content. One container is four point one gigabytes, the other one point one. That's five gigabytes for one chapter.*
> 용량은 거의 전부 콘텐츠입니다. 컨테이너 하나가 4.1GB, 다른 하나가 1.1GB. 1장에 5GB입니다.

**12 · 1:35** — *And the executable is four hundred and sixty seven megabytes. That's not a launcher. That's the whole engine and the whole game, linked into one file.*
> 그리고 실행 파일이 467MB입니다. 런처가 아닙니다. 엔진 전체와 게임 전체가 파일 하나로 링크된 겁니다.

**13 · 1:44** — *Only fourteen DLLs ship, and every one of them is somebody else's. That's a very different shape from the Unity builds on this channel, where the package list is the story.*
> DLL은 14개뿐이고 전부 남의 것입니다. 패키지 목록이 이야기였던 이 채널의 유니티 빌드들과는 아주 다른 모양이죠.

**14 · 1:54** — *So with Unreal, the teardown is what's around the engine. And around this one there are a few surprises.*
> 그래서 언리얼에선 분해가 엔진 주변을 봅니다. 이 빌드 주변엔 놀라운 게 몇 개 있습니다.

**15 · 2:01** — *First. ONNX Runtime and DirectML. Together, thirty one megabytes. That's Unreal's neural network plugin. A machine learning inference runtime, in a pixel-art RPG.*
> 첫째. ONNX Runtime과 DirectML, 합쳐서 31MB. 언리얼의 신경망 플러그인입니다. 픽셀아트 RPG 안에 머신러닝 추론 런타임이요.

**16 · 2:13** — *What it's for, I can't see from a file list. It could be upscaling. It could be animation. It could be a plugin dependency nobody trimmed. If you know, the comments are right there.*
> 용도는 파일 목록으론 안 보입니다. 업스케일링일 수도, 애니메이션일 수도, 아무도 안 뺀 플러그인 의존성일 수도. 아시는 분은 댓글 부탁드립니다.

**17 · 2:24** — *Second. NVIDIA Aftermath, for GPU crash reports, and MsQuic, which is the transport under HTTP/3. So something in here phones home over QUIC.*
> 둘째. GPU 크래시 리포트용 NVIDIA Aftermath, 그리고 HTTP/3 밑단인 MsQuic. 뭔가가 QUIC으로 서버와 통신한다는 뜻입니다.

**18 · 2:37** — *Third, the audio. XAudio2 and Ogg Vorbis. No Wwise, no FMOD. A Final Fantasy shipping on the engine's stock audio path is worth noting.*
> 셋째, 오디오. XAudio2와 Ogg Vorbis. Wwise도 FMOD도 없습니다. 파이널 판타지가 엔진 기본 오디오 경로로 나간다는 건 기록해둘 만합니다.

**19 · 2:47** — *And then the slip. d3d12SDKLayers.dll. That's the DirectX 12 debug layer. Five and a half megabytes that exist to help a developer find bugs, shipped to players.*
> 그리고 실수 하나. d3d12SDKLayers.dll — DirectX 12 디버그 레이어입니다. 개발자가 버그 잡으라고 있는 5.5MB가 플레이어에게 나갔습니다.

**20 · 3:01** — *Next to it, a five megabyte debug fallback font, and a three byte staging config file. None of it hurts you. All of it says the shipping config wasn't tightened.*
> 그 옆엔 5MB짜리 디버그 대체 폰트, 3바이트짜리 스테이징 설정 파일. 해는 없습니다. 다만 출시 설정을 조이지 않았다는 뜻이죠.

**21 · 3:11** — *Three episodes ago a three-person team shipped seven hundred megabytes of debug symbols. Different scale, same mistake. It happens at Square Enix too.*
> 세 편 전엔 3인 팀이 디버그 심볼 700MB를 내보냈습니다. 규모는 다르고 실수는 같습니다. 스퀘어에닉스도 합니다.

**22 · 3:21** — *One more date. The manifest says this build was made on July third. Two months before the demo went live. That's the buffer a publisher this size keeps.*
> 날짜 하나 더. 매니페스트는 이 빌드가 7월 3일에 만들어졌다고 합니다. 데모 공개 두 달 전. 이 규모 퍼블리셔가 두는 여유입니다.

## 반응

**23 · 3:31** — *Reception, then. There are no reviews, so here's the only number there is.*
> 반응 차례인데, 리뷰가 없으니 있는 숫자 하나만 보겠습니다.

**24 · 3:36** — *Four thousand four hundred people in the demo at once, on a Saturday, two days in. The previous record on this channel was Guildrun at two thousand eight hundred.*
> 토요일, 이틀째, 동시 접속 4,400명. 이 채널의 이전 최고는 Guildrun의 2,800명이었습니다.

**25 · 3:45** — *A whole chapter for free, from the Octopath team, in a series people already trust. The number isn't surprising. It's still big.*
> 옥토패스 팀이, 이미 믿는 시리즈로, 1장 통째를 무료로. 놀라운 숫자는 아닙니다. 그래도 큽니다.

## 스펙 시트 · 판정

**26 · 3:53** — *Here's the whole teardown on one card.*
> 분해 결과를 카드 한 장에 정리했습니다.

**27 · 3:56** — *Unreal 5. Team Asano and LANCARSE. A four hundred and sixty seven megabyte executable, an ML runtime, and the debug layer left in.*
> 언리얼 5. 아사노 팀과 LANCARSE. 467MB 실행 파일, ML 런타임, 그리고 남겨진 디버그 레이어.

**28 · 4:06** — *Worth a dip. It's a full chapter, it's free, and it goes away when the game ships.*
> 찍먹할 만합니다. 1장 통째고, 무료고, 본편 나오면 사라집니다.

**29 · 4:12** — *If you build in Unreal, the thing to take from this is the shipping config. Open your packaged folder and look for SDKLayers. If it's there, so is everyone else's.*
> 언리얼로 만드신다면 가져갈 건 출시 설정입니다. 패키징 폴더를 열어 SDKLayers를 찾아보세요. 거기 있으면, 남들 것도 다 있는 겁니다.

**30 · 4:22** — *That's my read from the outside. If you worked on this and I got something wrong, say so and I'll pin the correction. Next time, another demo, another file list. This is Demo Dip.*
> 바깥에서 본 제 해석입니다. 이 게임에 참여하셨고 틀린 게 있다면 알려주세요, 정정을 고정하겠습니다. 다음에도 또 다른 데모, 또 다른 파일 목록으로. Demo Dip이었습니다.

---

## 검수 포인트

- 리뷰 0개라 **24번의 접속자 수가 유일한 반응 지표**입니다. 렌더 직전에 다시 재서 숫자를 갱신합니다.
- 15–16번(ML 런타임)은 "있다"까지만 확인, 용도는 추정으로 명시했습니다.
- 격언조 마무리: 12, 21, 25, 29 — 상한(4) 안입니다.
- 발음 사전에 이번 편 토큰(ONNX, DirectML, MsQuic, ucas/utoc, HD-2D, LANCARSE, Exvius, Wwise)을 추가했습니다.
