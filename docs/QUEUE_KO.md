# 후보 큐 (한국어 채널) — 다음에 뜯을 데모

`python scripts/pipeline/demo_queue_ko.py --ids ... --engine <id>=Unity --out docs/QUEUE_KO.md` 로 갱신한다.
기준은 `docs/CHANNEL_KO.md` §1. 엔진은 SteamDB의 **데모 appid** 페이지에서 손으로 확인해 넘긴다.

한국어 지원은 게이트, 한국 개발자는 최상위 가중치다. 개발사 국적은 API로 알 수 없어
스튜디오 이름에 한글이 있는 경우만 자동 판정하고 나머지는 확인 대상으로 남긴다.

| 점수 | 게임 | 개발사 / 퍼블리셔 | 엔진 | 한국어 | 리뷰 | 판정 | 데모 |
|---|---|---|---|---|---|---|---|
| 98.7 | Death at Fleming Manor Demo | SUPERTHUMb / SUPERTHUMb | ? | O | 147 (83.7%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/4137650/ |
| 98.5 | ZENONIA Demo | Com2us Holdings / Com2us Holdings | ? | O | 90 (81.1%) | GO — 한국 개발자 (리뷰 적음: 평판보다 개발자가 후크) | https://store.steampowered.com/app/4733680/ |
| 92.1 | VOID DIVER: Escape from the Abyss Demo | STUDIO NEMO / LoadComplete | ? | O | 1227 (84.1%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/4347080/ |
| 90.7 | PengPong Demo | SANDY FLOOR / SANDY FLOOR | ? | O | 134 (86.6%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/3636220/ |
| 90.0 | Kimbap Heaven Simulator Demo | Joyful Jo / Joyful Jo | ? | O | 0 (0.0%) | GO — 한국 개발자 (리뷰 적음: 평판보다 개발자가 후크) | https://store.steampowered.com/app/4390440/ |
| 90.0 | Sephiria Demo | TEAM HORAY / TEAM HORAY | ? | O | 0 (0.0%) | GO — 한국 개발자 | https://store.steampowered.com/app/2686970/ |
| 78.5 | Solateria Demo | Studio Doodal / SHINSEGAE INFORMATION and COMMUNICATION Inc. | ? | O | 110 (81.8%) | GO — 한국 개발자 | https://store.steampowered.com/app/3962990/ |
| 78.0 | DeckLand Demo | JellySnow Studio / CFK Co., Ltd. | ? | O | 10 (80.0%) | GO — 한국 개발자 (리뷰 적음: 평판보다 개발자가 후크) | https://store.steampowered.com/app/3322870/ |
| 78.0 | IRON NEST: Heavy Turret Simulator Demo | Nick Nieuwoudt / Nick Nieuwoudt | ? | O | 7715 (98.9%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/4300500/ |
| 75.7 | Dragon's Dogma 2 Character Creator & Storage | CAPCOM Co., Ltd. / CAPCOM Co., Ltd. | ? | O | 1938 (79.4%) | DROP — big publisher | https://store.steampowered.com/app/2674810/ |
| 70.4 | THANKS, LIGHT. - DEMO | Lightersgames / Game Source Entertainment | ? | O | 75 (93.3%) | GO — 한국 개발자 (리뷰 적음: 평판보다 개발자가 후크) | https://store.steampowered.com/app/3276550/ |
| 68.0 | The Legend of Fancy Realm Remake Demo |  USERJOY Technology Co.,Ltd. /  USERJOY Technology Co.,Ltd. | ? | O | 402 (83.6%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/4778780/ |
| 66.0 | Heroes of Might and Magic: Olden Era Demo | Unfrozen / Hooded Horse | ? | O | 5415 (78.4%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/3241970/ |
| 62.6 | Euro Truck Simulator 2 Demo | SCS Software / SCS Software | ? | O | 923 (97.1%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/231120/ |
| 61.8 | Servant of the Lake Demo | Rusty Lake / Rusty Lake | ? | O | 764 (99.5%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/3996940/ |
| 61.7 | Cat Mail Co. Demo | Maracas Studio / Maracas Studio | ? | O | 740 (93.8%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/4622530/ |
| 60.7 | Resident Evil 4 Chainsaw Demo | CAPCOM Co., Ltd. / CAPCOM Co., Ltd. | ? | O | 546 (89.0%) | DROP — big publisher | https://store.steampowered.com/app/2231770/ |
| 60.4 | Escape Simulator 2 Demo | Pine Studio / Pine Studio | ? | O | 483 (92.8%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/3499320/ |
| 60.0 | Pharma Noctis Demo | Yudiko Studio / Yudiko Studio | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4396310/ |
| 59.1 | Dungeon Brawls Demo | Wise Games / Wise Games | ? | O | 212 (70.8%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/4279730/ |
| 59.0 | Creator Chronicles Demo | Origin Studio / Origin Studio | ? | O | 208 (65.9%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/3978190/ |
| 58.5 | Eggstreme Farming Demo | Sagitta Studios / Sagitta Studios | ? | O | 91 (56.0%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4669490/ |
| 58.2 | Dig Raiders: Anomaly Extraction Demo | Soda Game Studio / Soda Game Studio | ? | O | 36 (77.8%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4692940/ |
| 58.1 | Backrooms Protocol Demo | Niche / Niche | ? | O | 12 (50.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4776680/ |
| 58.1 | Burger Shift: Team Rush Demo | Nova Telum Studio / Nova Telum Studio | ? | O | 29 (62.1%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4251300/ |
| 58.1 | Eco Volunteer Demo | Scope Creepers / Scope Creepers | ? | O | 29 (79.3%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4348330/ |
| 58.1 | 【重大告知】橘リルリ転生いたします！ Demo | OTL GAME / OTL GAME | ? | O | 13 (76.9%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4027000/ |
| 58.0 | Dungeon Raid Demo | 4Cats / 4Cats | ? | O | 6 (66.7%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/3828710/ |
| 58.0 | Mortal Shell II - Open Beta | Cold Symmetry / Playstack | ? | O | 5986 (90.2%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/4711740/ |
| 58.0 | REANIMAL Demo | Tarsier Studios / THQ Nordic | ? | O | 4511 (94.1%) | DROP — big publisher | https://store.steampowered.com/app/4019420/ |
| 58.0 | Stellar Blade™ Demo | SHIFT UP Corporation / PlayStation Publishing LLC (excluding China) | ? | O | 5366 (86.2%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/3564860/ |
| 51.4 | [Act1] Staffer Retro : A Supernatural Mystery Quest | Team Tetrapod / Team Tetrapod | ? | O | 272 (94.9%) | GO — 개발사 국적 확인 필요(한국이면 최우선) | https://store.steampowered.com/app/4125500/ |
| 51.0 | Bills Must Be Paid Demo | Rike Games / Rike Games | ? | O | 196 (91.8%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/4577620/ |
| 50.6 | Cat Me If You Can Demo | Cosmic Stag Games / Cosmic Stag Games | ? | O | 118 (92.4%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/4501780/ |
| 50.5 | Factorio Demo | Wube Software LTD. / Wube Software LTD. | ? | O | 110 (94.5%) | CHECK — engine unknown, look it up on SteamDB | https://store.steampowered.com/app/452280/ |
| 50.3 | Artillery Miner Demo | Alextgr8 / Alextgr8 | ? | O | 66 (90.9%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4527120/ |
| 50.2 | Fish Lab Demo | stonecodes / stonecodes | ? | O | 32 (93.8%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4601570/ |
| 50.2 | Forsworn Demo | Resummon Studios LLC / Resummon Studios LLC | ? | O | 41 (90.2%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4186400/ |
| 50.2 | Garden Ink Demo | Kranich Games / Kranich Games | ? | O | 46 (100.0%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4244070/ |
| 50.2 | Serve Or Die Demo | Dead Tape Studio / Dead Tape Studio | ? | O | 33 (87.9%) | GO — 개발사 국적 확인 필요(한국이면 최우선) | https://store.steampowered.com/app/4734990/ |
| 50.2 | Sublight Demo |  CODEBREW SOFTWARE LTD /  CODEBREW SOFTWARE LTD | ? | O | 45 (88.9%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4468530/ |
| 50.1 | Frontier: Path of Shadows Demo | Oduvan Games / Oduvan Games | ? | O | 29 (86.2%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4175920/ |
| 50.1 | Meeple Incremental Demo | Simply Artizan / Simply Artizan | ? | O | 24 (87.5%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4509720/ |
| 50.1 | Operation: Outbreak Idle Demo | DeadLogics / DeadLogics | ? | O | 15 (100.0%) | GO — 개발사 국적 확인 필요(한국이면 최우선) | https://store.steampowered.com/app/4796770/ |
| 50.1 | Slime Slayer: Endless Loot Demo | OOM Games / OOM Games | ? | O | 20 (90.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4553050/ |
| 50.1 | SmashCore Demo | Braian / Braian | ? | O | 22 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4949230/ |
| 50.1 | The Ayna Demo | Necha Games / Necha Games | ? | O | 17 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4613920/ |
| 50.1 | The Solyani's Code Demo | ANGames / ANGames | ? | O | 14 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4439710/ |
| 50.0 |  PEGTURE: Peg Solitaire Roguelike demo | Puff Games / Puff Games | ? | O | 5 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4426870/ |
| 50.0 | 771 Demo | Admia / Admia | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/5156950/ |
| 50.0 | Bookstore Incremental Demo | Exaeryth / Exaeryth | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4791960/ |
| 50.0 | Chicken Miner Demo | Team Cloud / Team Cloud | ? | O | 5 (100.0%) | GO — 개발사 국적 확인 필요(한국이면 최우선) | https://store.steampowered.com/app/4623350/ |
| 50.0 | CloverPit Demo | Panik Arcade / Panik Arcade | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/3347820/ |
| 50.0 | Corsair Fleet Tides of Plunder Demo | Velron Games / Velron Games | ? | O | 1 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/5002740/ |
| 50.0 | Davy bones Demo | Yona games / Yona games | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/5022760/ |
| 50.0 | Deep Sheol Demo | Acid Arrow Studio / Acid Arrow Studio | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4025430/ |
| 50.0 | Dicewayfarer Demo | NightCracker / NightCracker | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4587770/ |
| 50.0 | Discremental Demo | Elite Gorgon Games / Elite Gorgon Games | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4682010/ |
| 50.0 | Dragon Tiles Demo | hf_game_studio / hf_game_studio | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4928000/ |
| 50.0 | FINAL FANTASY RESONANCE DEMO | Square Enix / Square Enix | ? | O | 0 (0.0%) | DROP — big publisher | https://store.steampowered.com/app/4474710/ |
| 50.0 | Fill The Void Demo | Morph / Morph | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4646410/ |
| 50.0 | GameZone Demo | Enter Games / Enter Games | ? | O | 6 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4711540/ |
| 50.0 | Granblue Fantasy: Relink - Endless Ragnarok Demo | Cygames, Inc. / Cygames, Inc. | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4196050/ |
| 50.0 | Grandpa's Bee Haven Demo | Kickstart Now / Kickstart Now | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/3489410/ |
| 50.0 | Late Order Demo | Judas Brothers / Judas Brothers | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4802290/ |
| 50.0 | Let Me Poo! Demo | Pixel Paradise / Pixel Paradise | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/5085670/ |
| 50.0 | Monster Hunter Wilds Prologue Demo | CAPCOM Co., Ltd. / CAPCOM Co., Ltd. | ? | O | 0 (0.0%) | DROP — big publisher | https://store.steampowered.com/app/4379380/ |
| 50.0 | Night Club Simulator: Party King Demo | Bohem Games / Bohem Games | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/3946720/ |
| 50.0 | Nuktedan: The Forgotten Emotions | Saydexi / Saydexi | ? | O | 4 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4404320/ |
| 50.0 | Onimusha: Way of the Sword DEMO | CAPCOM Co., Ltd. / CAPCOM Co., Ltd. | ? | O | 0 (0.0%) | DROP — big publisher | https://store.steampowered.com/app/3974650/ |
| 50.0 | Record of Chaos - Korean Chapter - Demo | Sixstone Games / Sixstone Games | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/5020890/ |
| 50.0 | Resident Evil Requiem - Demo | CAPCOM Co., Ltd. / CAPCOM Co., Ltd. | ? | O | 0 (0.0%) | DROP — big publisher | https://store.steampowered.com/app/4459100/ |
| 50.0 | Scene Investigators Demo | EQ Studios / EQ Studios | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/1444400/ |
| 50.0 | Screen Survivors Demo | Tom Daly / Tom Daly | ? | O | 2 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4608880/ |
| 50.0 | Shadow Dungeon Demo | OO Cat / OO Cat | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4563350/ |
| 50.0 | Solvimus Demo | Iocus GmbH / Iocus GmbH | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4300250/ |
| 50.0 | Syntax:Overload Demo | Tallen games / Tallen games | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4688020/ |
| 50.0 | The Last Brazilian Demo | Estúdio Coração / Estúdio Coração | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/5107390/ |
| 50.0 | The Riftbreaker Demo | EXOR Studios / EXOR Studios | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/1317860/ |
| 50.0 | Tom Clancy's The Division 2 - Demo | Ubisoft / Ubisoft | ? | O | 0 (0.0%) | DROP — big publisher | https://store.steampowered.com/app/3834150/ |
| 50.0 | Who Haunts The Haunters? Demo | Sketchy Labs / Sketchy Labs | ? | O | 1 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4803920/ |
| 50.0 | Your Story: Games with Death Demo | BoldBox / BoldBox | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4119470/ |
| 45.4 | Digimon Story Time Stranger Demo | Media.Vision Inc. / Bandai Namco Entertainment Inc. | ? | O | 1485 (85.5%) | DROP — big publisher | https://store.steampowered.com/app/3815860/ |
| 45.2 | Dispatch Demo | AdHoc Studio / AdHoc Studio | ? | X | 3431 (97.4%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/3674060/ |
| 42.4 | Corsair Cove Demo | Limbic Entertainment / Hooded Horse | ? | O | 887 (89.7%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/3858730/ |
| 41.1 | Sovereign Tower Demo |  WILD WITS GAMES / Curve Games | ? | O | 612 (95.3%) | DROP — big publisher | https://store.steampowered.com/app/4422320/ |
| 40.6 | CODE VEIN II - Character Creator Demo | Bandai Namco Studios Inc. / Bandai Namco Entertainment Inc. | ? | O | 518 (36.3%) | DROP — big publisher | https://store.steampowered.com/app/3733960/ |
| 40.2 | Scritchy Scratchy Demo | Lunch Money Games / Funday Games | ? | O | 446 (89.0%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/4124780/ |
| 40.0 | Whiskerwood Demo | Minakata Dynamics / Hooded Horse | ? | O | 393 (87.8%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/3126370/ |
| 39.6 | Persona 3 Reload Demo | ATLUS / SEGA | ? | O | 329 (90.6%) | DROP — big publisher | https://store.steampowered.com/app/3358440/ |
| 38.7 | PowerWash Simulator Demo | FuturLab / Square Enix | ? | O | 133 (77.4%) | DROP — big publisher | https://store.steampowered.com/app/2633700/ |
| 38.3 | BrokenLore: DON’T LIE Demo | Serafini Productions / Wired Productions | ? | O | 53 (83.0%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4005770/ |
| 38.3 | Retro Arcade Shop Simulator (Demo) | Alt Tab Game / Ultimate Games S.A. | ? | O | 57 (77.2%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4135320/ |
| 38.2 | Neat Demo | Korova Games / Rogue Duck Interactive | ? | O | 42 (69.0%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/4587840/ |
| 38.1 | Between Adventures IDLE Demo | Loop Forge / Rogue Duck Interactive | ? | O | 29 (55.2%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/3815790/ |
| 38.1 | Honeycomb: The World Beyond Demo | Frozen Way / Snail Games USA | ? | O | 20 (80.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/2959440/ |
| 38.0 | Orebits Demo | Upgraded Studio / Molter | ? | O | 7 (71.4%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4521640/ |
| 30.8 | Sludgineers Demo | Snickerdoodle Games / Funk Games | ? | O | 157 (94.9%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/4493160/ |
| 30.6 | Bones and Coins Demo | Troyd Games / Rogue Duck Interactive | ? | O | 116 (86.2%) | CHECK — has a publisher; verify it is not a funded studio | https://store.steampowered.com/app/4213470/ |
| 30.3 | Golden Swirl Demo | Snako Production / Infini Fun | ? | O | 59 (89.8%) | CHECK — 리뷰 적음, 개발사 국적 확인 필요 | https://store.steampowered.com/app/3506690/ |
| 30.1 | Little Ghosties Demo | Acrylic Pixel Games / Acrylic Pixel games | ? | O | 11 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4584260/ |
| 30.1 | Medieval Juice Crafter Demo | Timeless Rush / GrabTheGames | ? | O | 25 (96.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4671850/ |
| 30.0 | Against the Storm Demo | Eremite Games / Hooded Horse | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/1400860/ |
| 30.0 | Asterika: Phantom Rose Refrain Demo | makaroll / Studio Maka | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4112250/ |
| 30.0 | Atomic Heart Demo | Mundfish / Focus Entertainment | ? | O | 0 (0.0%) | DROP — big publisher | https://store.steampowered.com/app/2407990/ |
| 30.0 | Elemental Witches Demo | Paidakang / The Bueno Interactive | ? | O | 8 (100.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4231920/ |
| 30.0 | Football Manager 26 Demo | Sports Interactive / SEGA | ? | O | 1 (100.0%) | DROP — big publisher | https://store.steampowered.com/app/3551360/ |
| 30.0 | Monster Shop Simulator Demo | For Fun Games / Cheesecake Dev | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4588130/ |
| 30.0 | Roomrush Racer Demo | Benjamin Recker / Big Bossi Games | ? | O | 0 (0.0%) | HOLD — 수요도 평판도 아직 없음 | https://store.steampowered.com/app/4823860/ |
| 30.0 | TEKKEN 8 - DEMO | Bandai Namco Studios Inc. / Bandai Namco Entertainment | ? | O | 1 (100.0%) | DROP — big publisher | https://store.steampowered.com/app/2524440/ |
| 28.6 | Yet Another Zombie Survivors Demo | Awesome Games Studio / Awesome Games Studio | ? | X | 121 (76.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/2265230/ |
| 20.6 | Black Gold: Oil Drilling Simulator Demo | CreativeForge Games / CreativeForge Games | ? | X | 123 (85.4%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/3770800/ |
| 20.1 | Moon Garden Demo | Kairos Games LLC / Kairos Games LLC | ? | X | 15 (93.3%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4735350/ |
| 20.0 | Airline Founder Demo | Nerowan / Nerowan | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4838960/ |
| 20.0 | Backseat Demo | HOGO Games / HOGO Games | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/3838190/ |
| 20.0 | Carrot Revenge Demo | Edvilson Pereira Junior / Edvilson Pereira Junior | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/2718580/ |
| 20.0 | Cloudscrapers Demo | Nementic Games / Nementic Games | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/3760120/ |
| 20.0 | Don't Stop The Pop! Demo | Not Bot Shot / Not Bot Shot | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4816120/ |
| 20.0 | Escape Simulator Demo | Pine Studio / Pine Studio | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/1538700/ |
| 20.0 | Eslabong Demo | shirowita / shirowita | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4752700/ |
| 20.0 | GRID/ Demo | ノエノエゲームズ / ノエノエゲームズ | ? | X | 2 (100.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4403750/ |
| 20.0 | Increvaders Demo | Oblomoverie / Oblomoverie | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4613740/ |
| 20.0 | Legend of Mortal Demo | Obb Studio Inc. / Obb Studio Inc. | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/1992090/ |
| 20.0 | Mixed Spirits: Bartender Demo | Rogue Duck Interactive / Rogue Duck Interactive | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/3981310/ |
| 20.0 | PRAGMATA SKETCHBOOK - DEMO | CAPCOM Co., Ltd. / CAPCOM Co., Ltd. | ? | X | 2 (100.0%) | DROP — big publisher | https://store.steampowered.com/app/4003800/ |
| 20.0 | PowerWash Simulator 2 Demo | FuturLab / FuturLab | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4043170/ |
| 20.0 | Street Fighter 6 Demo | CAPCOM Co., Ltd. / CAPCOM Co., Ltd. | ? | X | 0 (0.0%) | DROP — big publisher | https://store.steampowered.com/app/2154900/ |
| 20.0 | The Mermaid Mask Demo | SFB Games / SFB Games | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/2556770/ |
| 20.0 | The Planet Crafter Demo | Miju Games / Miju Games | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/1754850/ |
| 20.0 | Undying Flame Demo | Per Sidera Industries / Per Sidera Industries | ? | X | 2 (100.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4619380/ |
| 20.0 | Warlord: Awaji Demo | Darkmatter Games / Darkmatter Games | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/3182460/ |
| 19.7 | Moonlighter 2: The Endless Vault Demo | Digital Sun / 11 bit studios | ? | X | 736 (56.9%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/3670000/ |
| 14.8 | Wanderburg Demo | Randwerk / Sidekick Publishing | ? | X | 1351 (92.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4268810/ |
| 14.4 | MENACE Demo | Overhype Studios / Hooded Horse | ? | X | 1274 (86.2%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/2432870/ |
| 12.4 | SPRAWL zero Demo | MAETH / Kwalee | ? | X | 886 (95.8%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4247830/ |
| 0.3 | Sid Meier's Civilization® V: Demo | Firaxis Games / 2K | ? | X | 64 (85.9%) | DROP — big publisher | https://store.steampowered.com/app/65900/ |
| 0.1 | Order Automatica Demo | New Beings / better. publishing | ? | X | 27 (100.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/2577030/ |
| 0.1 | Pibcremental Demo | Arcane Cabinet / GrabTheGames | ? | X | 29 (100.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4780080/ |
| 0.0 | Tentacle Locker 2 Demo | HotPink / Saikey Studios | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4303950/ |
| 0.0 | The Last of RAM Demo | Warkuda / Warkuda Games | ? | X | 0 (0.0%) | HOLD — 한국어 미지원: 못 하는 게임은 전환이 안 됨 (사연이 있으면 예외) | https://store.steampowered.com/app/4646870/ |
