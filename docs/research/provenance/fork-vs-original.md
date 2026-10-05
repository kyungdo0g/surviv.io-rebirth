# Fork vs original: provenance of survev content

> Classifies every id in survev `shared/defs` (game objects, map objects, maps, puzzles) as `original` (in surviv.io v0.8.82),
> `post-0.8.82` (original surviv content released after v0.8.82 and re-created by survev), `fork` (survev-only) or `unknown`.
> The machine-readable list is `fork-vs-original.json` (one entry per id: status, kind, evidence, name, defRef, firstSeen, confidence, group, forkModified).
> Git facts are cited as `derived/git-<commit>` against the survev clone in `.survev/` (full history, HEAD c6185e31).

## Method

- survev's first commit `9f64948d` (2023-12-11, "initial commit :3") adds the original client definitions as plain JS: `src/defs/gunDefs.js`, `bulletDefs.js`, `mapObjectDefs.js` (30,678 lines) and the other game-object defs [src:derived/git-9f64948d] [H]
- That imported client is v0.8.82: it already has the 0.8.82 Spud Gun (`potato_smg`) and potato silo (`silo_01po`), and none of the v0.9.0 additions (PKM, Hawk 12G, Flask, Polar Bear, Snow Fox, Ice Pick) [src:changelog/0.8.82, fandom/Changelog, derived/git-9f64948d] [H]
- survev's client footer keeps the original "ver 0.8.82" changelog link only inside an HTML comment; the visible footer shows the fork version (`ver %VITE_GAME_VERSION%`, linking to `changelogRec.html`) [src:survev/client/index.html:1719, survev/client/index.html:1722] [H]
- The 2026 relaunch client bundle (v0.8.82 plus 0.9.x fixes) has the same game-object ids as survev's import apart from survev's additions: emotes 164 shared + `emote_flagisrael`, outfits 68 shared + `outfitTree`, quests 24 shared (no `quest_top_duo`), bullets 57 shared + 12 original-only (`bullet_potato`, `bullet_bugle`, ten `bullet_*_bonus`) [src:kong/relaunch-client-defs, derived/live-vs-survev] [H]
- The original map defs were ported in three steps: `main` and `desert` in `9f64948d`, `faction`, `halloween`, `potato` and `woods` in `0b3851a1` (2023-12-31), and the remaining ten (seasonal variants, `snow`, `savannah`, `cobalt`, `turkey`) in `33832ffe` (2024-01-09, "finish porting map definitions") [src:derived/git-0b3851a1, derived/git-33832ffe] [H]
- Commit `18cb7d5c` (2025-03-12) adds `logging_complex_03sp` and says "this is the first time we add a new definition", so every def id present before it comes from the original client [src:derived/git-18cb7d5c] [H]
- Each current id was traced to the first commit whose added lines contain it as a key or quoted string; map ids were traced to the creation of their `shared/defs/maps/*Defs.ts` file [src:derived/git-log-p-scan] [H]
- survev's own release notes (fork versions 0.0.1, 2024-08-17, to 0.4.3, 2026-09-29) are in `changelogRec.html` and were used to name and date every fork addition [src:survev/client/public/changelogRec.html:36, survev/client/public/changelogRec.html:588] [H]
- `fandom` documents the original game (and its post-0.8.82 history in its Changelog page); `wikigg` documents survev and marks original versions as "Surviv vX" and fork versions as plain "vX" [src:fandom/Changelog, wikigg/Survev.io] [M]
- Status rules: `original` = present in the 2023-12 to 2024-01 import, or a survev key for content proven to exist in v0.8.82; `post-0.8.82` = original surviv content first released after 2019-12-30 that survev later re-created; `fork` = survev-only content, including survev reconstructions that do not match a v0.8.82 item [src:derived/classification-rules] [H]

## Counts

| Status | Ids | Share |
|---|---|---|
| original | 1467 | 79.1% [src:derived/fork-vs-original-json] [H] |
| post-0.8.82 | 2 | 0.1% [src:derived/fork-vs-original-json] [H] |
| fork | 385 | 20.8% [src:derived/fork-vs-original-json] [H] |
| unknown | 0 | 0.0% [src:derived/fork-vs-original-json] [H] |
| total | 1854 | 100% [src:derived/fork-vs-original-json] [H] |

| Kind | original | post-0.8.82 | fork | unknown |
|---|---|---|---|---|
| ammo | 9 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| backpack | 4 | 0 | 2 | 0 [src:derived/fork-vs-original-json] [H] |
| boost | 2 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| boost_effect | 4 | 0 | 4 | 0 [src:derived/fork-vs-original-json] [H] |
| building | 171 | 0 | 55 | 0 [src:derived/fork-vs-original-json] [H] |
| building+puzzle | 2 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| bullet | 57 | 0 | 6 | 0 [src:derived/fork-vs-original-json] [H] |
| chest | 4 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| crosshair | 30 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| decal | 38 | 0 | 3 | 0 [src:derived/fork-vs-original-json] [H] |
| emote | 164 | 1 | 24 | 0 [src:derived/fork-vs-original-json] [H] |
| explosion | 18 | 0 | 4 | 0 [src:derived/fork-vs-original-json] [H] |
| gun | 65 | 0 | 9 | 0 [src:derived/fork-vs-original-json] [H] |
| heal | 2 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| heal_effect | 4 | 0 | 3 | 0 [src:derived/fork-vs-original-json] [H] |
| helmet | 18 | 0 | 2 | 0 [src:derived/fork-vs-original-json] [H] |
| loot_spawner | 32 | 0 | 1 | 0 [src:derived/fork-vs-original-json] [H] |
| map | 15 | 0 | 5 | 0 [src:derived/fork-vs-original-json] [H] |
| melee | 42 | 0 | 5 | 0 [src:derived/fork-vs-original-json] [H] |
| obstacle | 564 | 0 | 177 | 0 [src:derived/fork-vs-original-json] [H] |
| outfit | 69 | 1 | 20 | 0 [src:derived/fork-vs-original-json] [H] |
| pass | 1 | 0 | 1 | 0 [src:derived/fork-vs-original-json] [H] |
| perk | 41 | 0 | 7 | 0 [src:derived/fork-vs-original-json] [H] |
| ping | 7 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| puzzle | 5 | 0 | 2 | 0 [src:derived/fork-vs-original-json] [H] |
| quest | 25 | 0 | 45 | 0 [src:derived/fork-vs-original-json] [H] |
| role | 17 | 0 | 2 | 0 [src:derived/fork-vs-original-json] [H] |
| scope | 5 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| structure | 23 | 0 | 5 | 0 [src:derived/fork-vs-original-json] [H] |
| throwable | 12 | 0 | 3 | 0 [src:derived/fork-vs-original-json] [H] |
| throwable+map | 1 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| unlock | 2 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |
| xp | 14 | 0 | 0 | 0 [src:derived/fork-vs-original-json] [H] |

- `building+puzzle` covers `club_01` and `bunker_chrys_01`, which are both a building id and a puzzle id; `throwable+map` is `potato` (throwable and map id) [src:survev/shared/defs/puzzles.ts:15, survev/shared/defs/puzzles.ts:18, survev/shared/defs/mapDefs.ts:1] [H]

## Non-original ids, by feature

> One block per feature. The first line gives the reason and sources; the table lists every id in that feature with its survev definition line.

### Seasonal/mode reskins of original buildings and obstacles (fork, 25 ids)

- Fork-made tinted or reskinned copies of original defs; commit 18cb7d5c says it is "the first time we add a new definition" [src:balance/150] [src:survev/client/public/changelogRec.html:406] [src:survev/client/public/changelogRec.html:479] [src:derived/git-18cb7d5c] [H]
- First appearance in survev git: 18cb7d5c 2025-03-12; 159520a4 2025-03-14; db8bf136 2025-03-25; 27cc4859 2025-07-25; faadec46 2025-08-08; fddf75b8 2026-02-23; 73160e7f 2026-04-17 [src:derived/git-18cb7d5c] [src:derived/git-159520a4] [src:derived/git-db8bf136] [src:derived/git-27cc4859] [src:derived/git-faadec46] [src:derived/git-fddf75b8] [src:derived/git-73160e7f] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `logging_complex_03sp` |  | building | 18cb7d5c 2025-03-12 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9477] [H] |
| `cache_02sp` |  | building | 159520a4 2025-03-14 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:224] [H] |
| `cache_02w` |  | building | 159520a4 2025-03-14 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:206] [H] |
| `tree_03sp` |  | obstacle | 159520a4 2025-03-14 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1203] [H] |
| `tree_03w` |  | obstacle | 159520a4 2025-03-14 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1249] [H] |
| `cache_01cb` |  | building | db8bf136 2025-03-25 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:80] [H] |
| `cache_02cb` |  | building | db8bf136 2025-03-25 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:260] [H] |
| `stone_02cb` |  | obstacle | db8bf136 2025-03-25 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:925] [H] |
| `tree_03cb` |  | obstacle | db8bf136 2025-03-25 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1263] [H] |
| `logging_complex_03su` |  | building | 27cc4859 2025-07-25 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9634] [H] |
| `cache_02d` |  | building | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:278] [H] |
| `cache_02f` |  | building | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:296] [H] |
| `cache_02h` |  | building | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:314] [H] |
| `cache_02su` |  | building | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:242] [H] |
| `tree_03d` |  | obstacle | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1224] [H] |
| `tree_03f` |  | obstacle | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1230] [H] |
| `tree_03h` |  | obstacle | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1256] [H] |
| `tree_03su` |  | obstacle | faadec46 2025-08-08 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1196] [H] |
| `cache_01w` |  | building | fddf75b8 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:98] [H] |
| `logging_complex_02x` |  | building | fddf75b8 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9616] [H] |
| `logging_complex_03x` |  | building | fddf75b8 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9617] [H] |
| `stone_02w` |  | obstacle | fddf75b8 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:934] [H] |
| `bush_07cb` |  | obstacle | 73160e7f 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:680] [H] |
| `cache_06cb` |  | building | 73160e7f 2026-04-17 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:524] [H] |
| `teahouse_complex_01cb` |  | building | 73160e7f 2026-04-17 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5271] [H] |

### Technical invisible bullet (fork, 1 id)

- Fork helper bullet replacing the original bullet_potato and bullet_bugle [src:derived/git-ffcd8993] [src:derived/git-efd77aef] [H]
- First appearance in survev git: ffcd8993 2025-03-21 [src:derived/git-ffcd8993] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `bullet_invis` |  | bullet | ffcd8993 2025-03-21 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:748] [H] |

### Eggs on Potato Spring (fork, 4 ids)

- Eggs were an April 2018 obstacle (added v0.3.2 on 2018-04-01, removed in v0.3.21 on 2018-04-02) and egg crates returned in v0.9.3 (April 2020); neither is in the v0.8.82 client, survev re-added them in fork v0.0.22 [src:changelog/0.3.2, changelog/0.3.21] [src:wikigg/Eggs] [src:fandom/Egg] [src:fandom/Egg/Before_Eggsplosion] [H]
- First appearance in survev git: 929cee54 2025-04-01 [src:derived/git-929cee54] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `egg_01` |  | obstacle | 929cee54 2025-04-01 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:725] [H] |
| `egg_02` |  | obstacle | 929cee54 2025-04-01 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:729] [H] |
| `egg_03` |  | obstacle | 929cee54 2025-04-01 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:733] [H] |
| `egg_04` |  | obstacle | 929cee54 2025-04-01 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:737] [H] |

### Spring tree costume (fork, 1 id)

- Fork variant of the original tree costume using tree_07sp [src:survev/shared/defs/gameObjects/outfitDefs.ts:1349] [src:derived/git-929cee54] [H]
- First appearance in survev git: 929cee54 2025-04-01 [src:derived/git-929cee54] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `outfitSpringTree` | Barkskin | outfit | 929cee54 2025-04-01 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1349] [H] |

### Captain role (50v50) (fork, 3 ids)

- Fork role added in fork v0.1.2 "New Leadership" [src:survev/client/public/changelogRec.html:431] [src:wikigg/Captain] [src:wikigg/Assume_Leadership] [H]
- First appearance in survev git: 3844dc3f 2025-06-08 [src:derived/git-3844dc3f] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `assume_leadership` | Assume Leadership | perk | 3844dc3f 2025-06-08 | [src:survev/shared/defs/gameObjects/perkDefs.ts:9] [H] |
| `captain` | Captain | role | 3844dc3f 2025-06-08 | [src:survev/shared/defs/gameObjects/roleDefs.ts:162] [H] |
| `helmet04_captain` | Captain Helmet | helmet | 3844dc3f 2025-06-08 | [src:survev/shared/defs/gameObjects/gearDefs.ts:885] [H] |

### Flag emotes (fork, 13 ids)

- Fork-added default emotes; the six Pride flags (41cffbb7) shipped in fork v0.1.3 ("Added new emotes") [src:survev/client/public/changelogRec.html:433] [src:survev/client/public/changelogRec.html:395] [src:survev/client/public/changelogRec.html:350] [src:survev/client/public/changelogRec.html:191] [src:survev/client/public/changelogRec.html:166] [H]
- First appearance in survev git: 83e2acbf 2025-06-09; 41cffbb7 2025-10-01; c8732391 2025-12-27; 49284a43 2026-06-01; c7747d28 2026-07-14 [src:derived/git-83e2acbf] [src:derived/git-41cffbb7] [src:derived/git-c8732391] [src:derived/git-49284a43] [src:derived/git-c7747d28] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `emote_flagpalestine` | Flag Palestine | emote | 83e2acbf 2025-06-09 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1617] [H] |
| `emote_flagasexual` | Flag Asexual | emote | 41cffbb7 2025-10-01 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1697] [H] |
| `emote_flaggay` | Flag Gay | emote | 41cffbb7 2025-10-01 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1687] [H] |
| `emote_flaglesbian` | Flag Lesbian | emote | 41cffbb7 2025-10-01 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1677] [H] |
| `emote_flagnonbinary` | Flag Non-Binary | emote | 41cffbb7 2025-10-01 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1707] [H] |
| `emote_flagpride` | Flag Pride | emote | 41cffbb7 2025-10-01 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1667] [H] |
| `emote_flagtransgender` | Flag Transgender | emote | 41cffbb7 2025-10-01 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1657] [H] |
| `emote_flagbosnia` | Flag Bosnia | emote | c8732391 2025-12-27 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:757] [H] |
| `emote_flaglibya` | Flag Libya | emote | c8732391 2025-12-27 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:767] [H] |
| `emote_flagbisexual` | Flag Bisexual | emote | 49284a43 2026-06-01 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1717] [H] |
| `emote_flagiran` | Flag Iran | emote | c7747d28 2026-07-14 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1627] [H] |
| `emote_flaglebanon` | Flag Lebanon | emote | c7747d28 2026-07-14 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1637] [H] |
| `emote_flagyemen` | Flag Yemen | emote | c7747d28 2026-07-14 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1647] [H] |

### AP Rounds perk (fork, 1 id)

- Fork perk added in fork v0.1.2 [src:survev/client/public/changelogRec.html:432] [src:wikigg/AP_Rounds] [H]
- First appearance in survev git: 1277302c 2025-06-11 [src:derived/git-1277302c] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `ap_rounds` | AP Rounds | perk | 1277302c 2025-06-11 | [src:survev/shared/defs/gameObjects/perkDefs.ts:41] [H] |

### survev staff outfits (fork, 2 ids)

- Fork-only cosmetic outfits [src:derived/git-edece2d6] [src:derived/git-fea4497d] [H]
- First appearance in survev git: edece2d6 2025-08-04; fea4497d 2026-08-22 [src:derived/git-edece2d6] [src:derived/git-fea4497d] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `outfitGD` | Game Designr | outfit | edece2d6 2025-08-04 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:246] [H] |
| `outfitMaintainer` | Maintainer Swag | outfit | fea4497d 2026-08-22 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:226] [H] |

### Savannah map-generation obstacles (fork, 2 ids)

- Fork obstacles added when survev wrote Savannah map generation (Aug 2025), before reintroducing Savannah in fork v0.2.1 [src:derived/git-bbe1a377] [src:survev/client/public/changelogRec.html:319] [H]
- First appearance in survev git: bbe1a377 2025-08-09 [src:derived/git-bbe1a377] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `chest_03sv` |  | obstacle | bbe1a377 2025-08-09 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:346] [H] |
| `stone_03sv` |  | obstacle | bbe1a377 2025-08-09 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:984] [H] |

### Server test maps (fork, 2 ids)

- Fork-only maps used by the server test suite [src:derived/git-043922c9] [src:survev/shared/defs/maps/testDefs.ts:1] [H]
- First appearance in survev git: 043922c9 2025-08-13 [src:derived/git-043922c9] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `test_faction` | Normal | map | 043922c9 2025-08-13 | [src:survev/shared/defs/maps/testDefs.ts:1] [H] |
| `test_normal` | Normal | map | 043922c9 2025-08-13 | [src:survev/shared/defs/maps/testDefs.ts:1] [H] |

### Fragtastic outfit (post-0.8.82, 1 id)

- Original outfit added in v0.9.5c (June 22, 2020) through Survivr Pass 3; survev re-added it in fork v0.1.3 [src:fandom/Fragtastic] [src:fandom/Survivr_Pass_3] [src:survev/client/public/changelogRec.html:389] [H]
- First appearance in survev git: b2f9932f 2025-10-02 [src:derived/git-b2f9932f] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `outfitFragtastic` | Fragtastic | outfit | b2f9932f 2025-10-02 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:828] [H] |

### Turkey map rework objects (fork, 4 ids)

- Fork v0.1.3 updated the Turkey map with new obstacle variants [src:survev/client/public/changelogRec.html:387] [src:survev/client/public/changelogRec.html:391] [src:survev/client/public/changelogRec.html:392] [H]
- First appearance in survev git: 9915d68c 2025-10-02; 702d6d72 2025-10-02 [src:derived/git-9915d68c] [src:derived/git-702d6d72] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `bush_06tr` |  | obstacle | 9915d68c 2025-10-02 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:640] [H] |
| `cache_03tr` |  | building | 702d6d72 2025-10-02 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:368] [H] |
| `chest_03tr` |  | obstacle | 702d6d72 2025-10-02 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:354] [H] |
| `stone_03tr` |  | obstacle | 702d6d72 2025-10-02 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:996] [H] |

### Birthday mode (fork, 3 ids)

- Fork mode (fork v0.1.3) that reproduces early-access Classic; not a v0.8.82 mode [src:survev/client/public/changelogRec.html:386] [src:wikigg/Birthday_mode] [H]
- First appearance in survev git: 1b2c8cb3 2025-10-06; 87a5cc86 2025-10-08; 8dc78c7b 2025-10-19 [src:derived/git-1b2c8cb3] [src:derived/git-87a5cc86] [src:derived/git-8dc78c7b] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `birthday` | Birthday | map | 1b2c8cb3 2025-10-06 | [src:survev/shared/defs/maps/birthdayDefs.ts:1] [H] |
| `barrel_01bd` |  | obstacle | 87a5cc86 2025-10-08 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:494] [H] |
| `emote_cake` | Cake | emote | 8dc78c7b 2025-10-19 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1057] [H] |

### Faction-specific caches (fork, 4 ids)

- Fork v0.2.3 faction stone/barrel/tree caches [src:balance/158] [src:balance/160] [src:balance/163] [src:balance/260] [src:derived/git-919b1cc2] [H]
- First appearance in survev git: 1b2c8cb3 2025-10-06; 919b1cc2 2026-03-29 [src:derived/git-1b2c8cb3] [src:derived/git-919b1cc2] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `barrel_01f` |  | obstacle | 1b2c8cb3 2025-10-06 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:484] [H] |
| `cache_01f` |  | building | 919b1cc2 2026-03-29 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:134] [H] |
| `cache_07f` |  | building | 919b1cc2 2026-03-29 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:542] [H] |
| `stone_02f` |  | obstacle | 919b1cc2 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:953] [H] |

### Large squash (fork, 1 id)

- Fork v0.1.3 "New Large Squash variant"; the small squash is original (0.8.73) [src:survev/client/public/changelogRec.html:388] [src:wikigg/Squash] [H]
- First appearance in survev git: fc6f5412 2025-10-08 [src:derived/git-fc6f5412] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `squash_02` |  | obstacle | fc6f5412 2025-10-08 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:778] [H] |

### survev Beach mode (fork, 33 ids)

- Fork v0.2.0 "The Palms Sway" reconstruction; the original Beach Map (v0.9.5b, June 15, 2020) had different content (Water Gun, Water Balloon, Popsicle, Speedo, Ice Box) [src:survev/client/public/changelogRec.html:343] [src:survev/client/public/changelogRec.html:344] [src:survev/client/public/changelogRec.html:345] [src:survev/client/public/changelogRec.html:346] [src:survev/client/public/changelogRec.html:347] [src:survev/client/public/changelogRec.html:348] [src:survev/client/public/changelogRec.html:349] [src:wikigg/Beach_mode] [src:wikigg/Cutlass] [src:wikigg/Coconut] [src:wikigg/Pirate's_Bounty] [src:fandom/Beach_Map] [H]
- First appearance in survev git: c061aba1 2025-12-25; aa37de9c 2025-12-25; edfcd096 2025-12-25; 0612754a 2025-12-25; 342c5a93 2025-12-25; 075f1cbd 2025-12-28; 7d4a30d2 2026-01-17 [src:derived/git-c061aba1] [src:derived/git-aa37de9c] [src:derived/git-edfcd096] [src:derived/git-0612754a] [src:derived/git-342c5a93] [src:derived/git-075f1cbd] [src:derived/git-7d4a30d2] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `barrel_05` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:673] [H] |
| `beach` | Beach | map | aa37de9c 2025-12-25 | [src:survev/shared/defs/maps/beachDefs.ts:1] [H] |
| `cache_01bh` |  | building | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:116] [H] |
| `cache_02bh` |  | building | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:332] [H] |
| `cache_06bh` |  | building | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:470] [H] |
| `coconut` | Coconut | throwable | edfcd096 2025-12-25 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:838] [H] |
| `crate_09bh` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:572] [H] |
| `cutlass` | Cutlass | melee | 0612754a 2025-12-25 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1100] [H] |
| `cutlass_gold` | Cutlass Gold | melee | 0612754a 2025-12-25 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1422] [H] |
| `explosion_coconut` |  | explosion | edfcd096 2025-12-25 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:242] [H] |
| `gun_mount_06` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:930] [H] |
| `hut_01bh` |  | building | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5252] [H] |
| `hut_04` |  | building | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5256] [H] |
| `hut_wall_int_10` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:699] [H] |
| `hut_wall_int_7` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:693] [H] |
| `mansion_03` |  | building | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5258] [H] |
| `mansion_cellar_03` |  | building | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5265] [H] |
| `mansion_structure_03` |  | structure | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/structureDefs.ts:471] [H] |
| `outfitBeachCamo` | Beach Shored | outfit | 342c5a93 2025-12-25 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1040] [H] |
| `outfitCoconut` | Coconut Frenzy | outfit | 342c5a93 2025-12-25 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1057] [H] |
| `outfitParrotfish` | Parrotfish | outfit | 342c5a93 2025-12-25 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1096] [H] |
| `outfitWave` | Tidal Wave | outfit | 342c5a93 2025-12-25 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1076] [H] |
| `pirate` | Pirate's Bounty | perk | 0612754a 2025-12-25 | [src:survev/shared/defs/gameObjects/perkDefs.ts:121] [H] |
| `stone_02bh` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:948] [H] |
| `stone_03bh` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1002] [H] |
| `tree_03bh` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1276] [H] |
| `tree_14` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1573] [H] |
| `tree_interior_01bh` |  | obstacle | c061aba1 2025-12-25 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1138] [H] |
| `tree_13bh` |  | obstacle | 075f1cbd 2025-12-28 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1549] [H] |
| `tree_13x` |  | obstacle | 075f1cbd 2025-12-28 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1561] [H] |
| `tree_14x` |  | obstacle | 075f1cbd 2025-12-28 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1602] [H] |
| `barrel_01bh` |  | obstacle | 7d4a30d2 2026-01-17 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:474] [H] |
| `cache_07bh` |  | building | 7d4a30d2 2026-01-17 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:560] [H] |

### Winter (snow) rework, Ice Axe, winter gun skins (fork, 15 ids)

- Fork v0.2.0 snow-map changes (iced hardstone, Ice Axe, winter world images) [src:survev/client/public/changelogRec.html:345] [src:survev/client/public/changelogRec.html:346] [src:survev/client/public/changelogRec.html:353] [src:wikigg/Ice_Axe] [src:balance/201] [src:balance/205] [H]
- First appearance in survev git: 27403cea 2025-12-29; bbe89dee 2025-12-29; 78af45bc 2025-12-29; 8e662996 2026-01-04 [src:derived/git-27403cea] [src:derived/git-bbe89dee] [src:derived/git-78af45bc] [src:derived/git-8e662996] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `awc_winter` | AWM-S | gun | 27403cea 2025-12-29 | [src:survev/shared/defs/gameObjects/gunDefs.ts:3657] [H] |
| `barn_02x` |  | building | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:8927] [H] |
| `barn_basement_structure_01x` |  | structure | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/structureDefs.ts:326] [H] |
| `cache_01x` |  | building | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:44] [H] |
| `cache_02x` |  | building | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:170] [H] |
| `iceaxe` | Ice Axe | melee | 78af45bc 2025-12-29 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:796] [H] |
| `mansion_structure_01x` |  | structure | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/structureDefs.ts:396] [H] |
| `stone_02x` |  | obstacle | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:939] [H] |
| `stone_04x` |  | obstacle | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1025] [H] |
| `sv98_winter` | SV-98 | gun | 27403cea 2025-12-29 | [src:survev/shared/defs/gameObjects/gunDefs.ts:3650] [H] |
| `svd_winter` | SVD-63 | gun | 27403cea 2025-12-29 | [src:survev/shared/defs/gameObjects/gunDefs.ts:3643] [H] |
| `teahouse_complex_01x` |  | building | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9325] [H] |
| `tree_03x` |  | obstacle | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1209] [H] |
| `tree_interior_11` |  | obstacle | bbe89dee 2025-12-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1516] [H] |
| `teahouse_01x` |  | building | 8e662996 2026-01-04 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9297] [H] |

### Barn melee loot spawner (fork, 1 id)

- Fork refactor replacing loot_tier_sledgehammer [src:derived/git-e99d1355] [H]
- First appearance in survev git: e99d1355 2026-01-04 [src:derived/git-e99d1355] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `loot_tier_barn_melee` |  | loot_spawner | e99d1355 2026-01-04 | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:57] [H] |

### Alternate warehouse and Construction Case (fork, 9 ids)

- Fork v0.2.1 building and obstacle [src:survev/client/public/changelogRec.html:320] [src:survev/client/public/changelogRec.html:321] [src:wikigg/Construction_Case] [src:balance/212] [H]
- First appearance in survev git: a2136d44 2026-01-27 [src:derived/git-a2136d44] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `case_08` |  | obstacle | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:259] [H] |
| `case_08sv` |  | obstacle | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:271] [H] |
| `rail_4` |  | obstacle | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2251] [H] |
| `warehouse_03` |  | building | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/buildings/baseBuildingDefs.ts:9763] [H] |
| `warehouse_03sv` |  | building | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:7780] [H] |
| `warehouse_03x` |  | building | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:8703] [H] |
| `warehouse_column` |  | obstacle | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:734] [H] |
| `warehouse_wall_edge_2` |  | obstacle | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:726] [H] |
| `warehouse_wall_int` |  | obstacle | a2136d44 2026-01-27 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:730] [H] |

### High-Velocity Rounds perk (fork, 1 id)

- Fork v0.2.1 perk [src:survev/client/public/changelogRec.html:322] [src:wikigg/High-Velocity_Rounds] [H]
- First appearance in survev git: 2462d0b9 2026-01-27 [src:derived/git-2462d0b9] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `high_velocity` | High-Velocity Rounds | perk | 2462d0b9 2026-01-27 | [src:survev/shared/defs/gameObjects/perkDefs.ts:141] [H] |

### Woods update: Workshop, Camp, SPAS-16, IMD-2, skins (fork, 30 ids)

- Fork v0.2.2 "Snow, Smoke, & Shells" [src:survev/client/public/changelogRec.html:296] [src:survev/client/public/changelogRec.html:297] [src:survev/client/public/changelogRec.html:298] [src:survev/client/public/changelogRec.html:299] [src:wikigg/Workshop] [src:wikigg/SPAS-16] [src:wikigg/IMD-2] [src:wikigg/Campfire] [src:wikigg/Safe] [H]
- First appearance in survev git: fddf75b8 2026-02-23; 51bd6ceb 2026-02-23; 603b6db5 2026-02-23; ef2d9c24 2026-02-23; 13e271b9 2026-02-23 [src:derived/git-fddf75b8] [src:derived/git-51bd6ceb] [src:derived/git-603b6db5] [src:derived/git-ef2d9c24] [src:derived/git-13e271b9] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `barrel_01w` |  | obstacle | fddf75b8 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:465] [H] |
| `bullet_imbel` |  | bullet | 51bd6ceb 2026-02-23 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:586] [H] |
| `cache_07w` |  | building | fddf75b8 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:506] [H] |
| `camp_01` |  | building | 603b6db5 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9404] [H] |
| `camp_01w` |  | building | 603b6db5 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9618] [H] |
| `campfire_01` |  | obstacle | 603b6db5 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:686] [H] |
| `gun_mount_07` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:934] [H] |
| `gun_mount_empty` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:906] [H] |
| `imbel` | IMD-2 | gun | 51bd6ceb 2026-02-23 | [src:survev/shared/defs/gameObjects/gunDefs.ts:1212] [H] |
| `outfitBlackIce` | Black Ice | outfit | 13e271b9 2026-02-23 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1022] [H] |
| `outfitSnow` | Snowed Over | outfit | 13e271b9 2026-02-23 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1003] [H] |
| `safe_01` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1067] [H] |
| `spas16` | SPAS-16 | gun | 51bd6ceb 2026-02-23 | [src:survev/shared/defs/gameObjects/gunDefs.ts:2009] [H] |
| `table_04` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1232] [H] |
| `woodpile_03` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1625] [H] |
| `workshop_01` |  | building | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9396] [H] |
| `workshop_01w` |  | building | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9481] [H] |
| `workshop_complex_01` |  | building | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9400] [H] |
| `workshop_complex_01w` |  | building | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:9563] [H] |
| `workshop_wall_bot` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:758] [H] |
| `workshop_wall_edge` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:742] [H] |
| `workshop_wall_left` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:778] [H] |
| `workshop_wall_mid_1` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:746] [H] |
| `workshop_wall_mid_2` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:750] [H] |
| `workshop_wall_mid_3` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:754] [H] |
| `workshop_wall_right` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:738] [H] |
| `workshop_wall_room_1` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:762] [H] |
| `workshop_wall_room_2` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:766] [H] |
| `workshop_wall_room_3` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:770] [H] |
| `workshop_wall_room_4` |  | obstacle | ef2d9c24 2026-02-23 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:774] [H] |

### Potato vs Tomato (faction_potato), PMG-134, Tomato (fork, 19 ids)

- Fork v0.2.3 mode and items [src:survev/client/public/changelogRec.html:253] [src:survev/client/public/changelogRec.html:254] [src:wikigg/PMG-134] [src:wikigg/Tomato_(Throwable)] [src:wikigg/50v50_mode] [H]
- First appearance in survev git: 2255ceef 2026-03-29; f9ab4c6b 2026-03-29; 81a93957 2026-03-29 [src:derived/git-2255ceef] [src:derived/git-f9ab4c6b] [src:derived/git-81a93957] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `airdrop_crate_03dev` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1062] [H] |
| `airdrop_crate_03po` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1048] [H] |
| `airdrop_crate_04po` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1090] [H] |
| `crate_12dev` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:793] [H] |
| `crate_12po` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:767] [H] |
| `crate_13po` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:843] [H] |
| `emote_tomato` | Tomato | emote | f9ab4c6b 2026-03-29 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1047] [H] |
| `explosion_potato_lmgshot` |  | explosion | 81a93957 2026-03-29 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:219] [H] |
| `explosion_tomato` |  | explosion | f9ab4c6b 2026-03-29 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:258] [H] |
| `faction_potato` | Potato vs Tomato | map | 2255ceef 2026-03-29 | [src:survev/shared/defs/maps/factionPotatoDefs.ts:1] [H] |
| `potato_01f` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:689] [H] |
| `potato_02f` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:694] [H] |
| `potato_03f` |  | obstacle | 2255ceef 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:700] [H] |
| `potato_lmg` | PMG-134 | gun | 81a93957 2026-03-29 | [src:survev/shared/defs/gameObjects/gunDefs.ts:3525] [H] |
| `potato_lmgshot` | PMG-134 | throwable | 81a93957 2026-03-29 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:745] [H] |
| `tomato` | Tomato | throwable | f9ab4c6b 2026-03-29 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:905] [H] |
| `tomato_01` |  | obstacle | f9ab4c6b 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:705] [H] |
| `tomato_02` |  | obstacle | f9ab4c6b 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:709] [H] |
| `tomato_03` |  | obstacle | f9ab4c6b 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:715] [H] |

### Cobalt 0.3.0: Classless, new perks, Cobalt Case, Augmenting Vat, twins expansion (fork, 21 ids)

- Fork v0.3.0 "Precursor" [src:survev/client/public/changelogRec.html:218] [src:survev/client/public/changelogRec.html:219] [src:survev/client/public/changelogRec.html:220] [src:survev/client/public/changelogRec.html:221] [src:wikigg/Classless] [src:wikigg/Combat_Stimulants] [src:wikigg/Hyperfragmentation] [src:wikigg/Indomitable_Spirit] [src:wikigg/Cobalt_Case] [src:wikigg/Vats] [src:wikigg/Switches] [H]
- First appearance in survev git: daf9f39b 2026-04-17; f0107b35 2026-04-17; 294ac9e6 2026-04-17; 28c4b09b 2026-04-17; 06101a21 2026-04-21; 70a2d5da 2026-04-26 [src:derived/git-daf9f39b] [src:derived/git-f0107b35] [src:derived/git-294ac9e6] [src:derived/git-28c4b09b] [src:derived/git-06101a21] [src:derived/git-70a2d5da] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `amped_explosives` | Hyperfragmentation | perk | daf9f39b 2026-04-17 | [src:survev/shared/defs/gameObjects/perkDefs.ts:26] [H] |
| `button_01` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:433] [H] |
| `button_01b` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:451] [H] |
| `button_01g` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:434] [H] |
| `case_09` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:284] [H] |
| `class_crate_common_classless` |  | obstacle | 294ac9e6 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1324] [H] |
| `class_crate_rare_classless` |  | obstacle | 294ac9e6 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1406] [H] |
| `classless` |  | role | f0107b35 2026-04-17 | [src:survev/shared/defs/gameObjects/roleDefs.ts:557] [H] |
| `combat_stims` | Combat Stimulants | perk | 28c4b09b 2026-04-17 | [src:survev/shared/defs/gameObjects/perkDefs.ts:97] [H] |
| `explosion_cobalt` |  | explosion | f0107b35 2026-04-17 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:272] [H] |
| `helmet04_classless` | Classless Helmet | helmet | 294ac9e6 2026-04-17 | [src:survev/shared/defs/gameObjects/gearDefs.ts:901] [H] |
| `metal_wall_ext_thicker_49` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1467] [H] |
| `naginata_daemon` | Naginata Daemon | melee | f0107b35 2026-04-17 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1417] [H] |
| `outfitClassless` | Basic Outfit | outfit | 294ac9e6 2026-04-17 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:169] [H] |
| `shrapnel_cobalt` |  | bullet | f0107b35 2026-04-17 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:853] [H] |
| `switch_01o` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:386] [H] |
| `switch_01p` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:389] [H] |
| `switch_01y` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:392] [H] |
| `vat_03` |  | obstacle | f0107b35 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1421] [H] |
| `metal_wall_ext_thicker_30` |  | obstacle | 06101a21 2026-04-21 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1443] [H] |
| `lifeline` | Indomitable Spirit | perk | 70a2d5da 2026-04-26 | [src:survev/shared/defs/gameObjects/perkDefs.ts:90] [H] |

### River stone cache (fork, 7 ids)

- Fork-made cache variant added with the 0.3.0 Cobalt update [src:derived/git-96e2fb54] [src:wikigg/Caches] [H]
- First appearance in survev git: 96e2fb54 2026-04-17; 0c33c771 2026-05-14 [src:derived/git-96e2fb54] [src:derived/git-0c33c771] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `cache_04` |  | building | 96e2fb54 2026-04-17 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:386] [H] |
| `cache_04cb` |  | building | 96e2fb54 2026-04-17 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:430] [H] |
| `decal_caduceus_01` |  | decal | 96e2fb54 2026-04-17 | [src:survev/shared/defs/mapObjects/decalDefs.ts:306] [H] |
| `stone_08` |  | obstacle | 96e2fb54 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1084] [H] |
| `stone_08cb` |  | obstacle | 96e2fb54 2026-04-17 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1108] [H] |
| `cache_04x` |  | building | 0c33c771 2026-05-14 | [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:408] [H] |
| `stone_08x` |  | obstacle | 0c33c771 2026-05-14 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1096] [H] |

### Twins bunker class-switch puzzle (fork, 1 id)

- The Twins bunker itself is original (0.8.8) but the class-switch puzzle and its buttons/switches came with the fork's 0.3.0 "twins bunker expansion" [src:changelog/0.8.8] [src:survev/shared/defs/puzzles.ts:20] [src:survev/client/public/changelogRec.html:210] [src:survev/client/public/changelogRec.html:115] [src:derived/git-f0107b35] [H]
- First appearance in survev git: f0107b35 2026-04-17 [src:derived/git-f0107b35] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `bunker_twins` |  | puzzle | f0107b35 2026-04-17 | [src:survev/shared/defs/puzzles.ts:20] [H] |

### Event Winnr outfit (fork, 1 id)

- Fork v0.3.0 skin [src:survev/client/public/changelogRec.html:221] [H]
- First appearance in survev git: 0f4da46b 2026-04-28 [src:derived/git-0f4da46b] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `outfitEvent` | Event Winnr | outfit | 0f4da46b 2026-04-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1115] [H] |

### Oasis (fork, 3 ids)

- Fork v0.3.1 structure (Savannah variant in v0.4.3) [src:survev/client/public/changelogRec.html:162] [src:survev/client/public/changelogRec.html:45] [src:wikigg/Oasis] [H]
- First appearance in survev git: bdba09bd 2026-06-03; b31fd75d 2026-09-27 [src:derived/git-bdba09bd] [src:derived/git-b31fd75d] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `oasis_01` |  | building | bdba09bd 2026-06-03 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5850] [H] |
| `tree_14d` |  | obstacle | bdba09bd 2026-06-03 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1587] [H] |
| `oasis_01sv` |  | building | b31fd75d 2026-09-27 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:8547] [H] |

### The Reserve, .50 Caliber guns, Crimson airdrop (fork, 78 ids)

- Fork v0.3.1 "Breaking the Bank" desert-town overhaul [src:survev/client/public/changelogRec.html:162] [src:survev/client/public/changelogRec.html:163] [src:survev/client/public/changelogRec.html:164] [src:survev/client/public/changelogRec.html:165] [src:balance/317] [src:wikigg/The_Reserve] [src:wikigg/Barrett_M107] [src:wikigg/ASh-12] [src:wikigg/S&W_500] [H]
- First appearance in survev git: 94bf1f97 2026-06-29; 3f313672 2026-06-29 [src:derived/git-94bf1f97] [src:derived/git-3f313672] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `airdrop_crate_05` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1104] [H] |
| `ash12` | ASh-12 | gun | 94bf1f97 2026-06-29 | [src:survev/shared/defs/gameObjects/gunDefs.ts:3250] [H] |
| `barrett` | Barrett M107 | gun | 94bf1f97 2026-06-29 | [src:survev/shared/defs/gameObjects/gunDefs.ts:3150] [H] |
| `bullet_ash12` |  | bullet | 3f313672 2026-06-29 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:467] [H] |
| `bullet_barrett` |  | bullet | 3f313672 2026-06-29 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:441] [H] |
| `bullet_sw500` |  | bullet | 3f313672 2026-06-29 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:454] [H] |
| `case_07de` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:248] [H] |
| `chair_01` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:706] [H] |
| `chair_02` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:722] [H] |
| `concrete_wall_column_2x8` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1105] [H] |
| `concrete_wall_column_8x3` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1129] [H] |
| `crate_17` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:905] [H] |
| `decal_camera_01` |  | decal | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/decalDefs.ts:210] [H] |
| `decal_pipe_01` |  | decal | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/decalDefs.ts:222] [H] |
| `deposit_box_03` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:855] [H] |
| `glass_wall_13` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1523] [H] |
| `metal_wall_ext_16` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1273] [H] |
| `metal_wall_ext_2` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1221] [H] |
| `metal_wall_ext_2x2` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1217] [H] |
| `metal_wall_ext_thick_16` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1319] [H] |
| `metal_wall_ext_thick_23` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1331] [H] |
| `metal_wall_ext_thick_28` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1335] [H] |
| `metal_wall_ext_thick_5` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1299] [H] |
| `metal_wall_ext_thick_8` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1311] [H] |
| `metal_wall_ext_thicker_1_5` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1339] [H] |
| `outfitGold` | Capital Gains | outfit | 94bf1f97 2026-06-29 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1135] [H] |
| `rack_01` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1046] [H] |
| `reserve_01` |  | building | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:6086] [H] |
| `reserve_armory_01` |  | building | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:6088] [H] |
| `reserve_bar_back` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1796] [H] |
| `reserve_bar_large` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1786] [H] |
| `reserve_bar_small` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1776] [H] |
| `reserve_basement_01` |  | building | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:6087] [H] |
| `reserve_perm_wall_ext_1` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1621] [H] |
| `reserve_perm_wall_ext_10` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1651] [H] |
| `reserve_perm_wall_ext_11` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1656] [H] |
| `reserve_perm_wall_ext_12` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1661] [H] |
| `reserve_perm_wall_ext_14` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1666] [H] |
| `reserve_perm_wall_ext_18` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1671] [H] |
| `reserve_perm_wall_ext_2` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1626] [H] |
| `reserve_perm_wall_ext_20` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1676] [H] |
| `reserve_perm_wall_ext_22` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1681] [H] |
| `reserve_perm_wall_ext_23` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1686] [H] |
| `reserve_perm_wall_ext_25` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1691] [H] |
| `reserve_perm_wall_ext_2x10` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1706] [H] |
| `reserve_perm_wall_ext_2x11` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1701] [H] |
| `reserve_perm_wall_ext_38` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1696] [H] |
| `reserve_perm_wall_ext_3x13` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1716] [H] |
| `reserve_perm_wall_ext_3x4` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1711] [H] |
| `reserve_perm_wall_ext_4` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1631] [H] |
| `reserve_perm_wall_ext_6` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1636] [H] |
| `reserve_perm_wall_ext_7` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1641] [H] |
| `reserve_perm_wall_ext_8` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1646] [H] |
| `reserve_security_01` |  | building | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:6089] [H] |
| `reserve_structure_01` |  | structure | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/structureDefs.ts:509] [H] |
| `reserve_vault` |  | puzzle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/puzzles.ts:21] [H] |
| `reserve_vault_01` |  | building | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:6090] [H] |
| `reserve_wall_int_10` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1753] [H] |
| `reserve_wall_int_12` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1758] [H] |
| `reserve_wall_int_13` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1764] [H] |
| `reserve_wall_int_16` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1770] [H] |
| `reserve_wall_int_3` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1721] [H] |
| `reserve_wall_int_4` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1727] [H] |
| `reserve_wall_int_5` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1733] [H] |
| `reserve_wall_int_6` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1738] [H] |
| `reserve_wall_int_8` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1743] [H] |
| `reserve_wall_int_9` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1748] [H] |
| `reserve_window_01` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:650] [H] |
| `reserve_window_broken_01` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:655] [H] |
| `sink_01` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1105] [H] |
| `stairs_02` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:596] [H] |
| `stairs_03` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:600] [H] |
| `sw500` | S&W 500 | gun | 94bf1f97 2026-06-29 | [src:survev/shared/defs/gameObjects/gunDefs.ts:3202] [H] |
| `table_01d` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1180] [H] |
| `table_05` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1244] [H] |
| `toilet_05` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1331] [H] |
| `tree_interior_01de` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1145] [H] |
| `vault_door_reserve` |  | obstacle | 94bf1f97 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:434] [H] |

### Boffy emote (post-0.8.82, 1 id)

- Original emote from Survivr Pass 4 (v0.9.8, Sept 2020); survev re-added it as a default emote in fork v0.3.1 [src:fandom/Changelog] [src:fandom/Emotes] [src:survev/client/public/changelogRec.html:166] [M]
- First appearance in survev git: 612eebf0 2026-07-13 [src:derived/git-612eebf0] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `emote_boffy` | Boffy | emote | 612eebf0 2026-07-13 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:267] [H] |

### Fork default emotes (fork, 3 ids)

- Fork-added default emotes (Leaf in fork v0.3.1; Sad Boffy and Antisocial in fork v0.4.0) [src:survev/client/public/changelogRec.html:166] [src:survev/client/public/changelogRec.html:88] [H]
- First appearance in survev git: 612eebf0 2026-07-13; 3bd1e951 2026-08-28; 52ba33af 2026-09-08 [src:derived/git-612eebf0] [src:derived/git-3bd1e951] [src:derived/git-52ba33af] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `emote_leaf` | Leaf | emote | 612eebf0 2026-07-13 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1397] [H] |
| `emote_antisocial` | Antisocial | emote | 3bd1e951 2026-08-28 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1807] [H] |
| `emote_sadboffy` | Sad Boffy | emote | 52ba33af 2026-09-08 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:277] [H] |

### Desert map improvements (fork, 2 ids)

- Fork v0.3.1x desert/reserve follow-ups [src:derived/git-4cd6ab9f] [src:derived/git-c21699fd] [H]
- First appearance in survev git: 4cd6ab9f 2026-07-19; c21699fd 2026-07-19 [src:derived/git-4cd6ab9f] [src:derived/git-c21699fd] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `crate_09de` |  | obstacle | 4cd6ab9f 2026-07-19 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:579] [H] |
| `safe_01de` |  | obstacle | c21699fd 2026-07-19 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1068] [H] |

### Fork quest system (LTM / difficult / location quests) (fork, 45 ids)

- Fork v0.4.0 quest additions [src:survev/client/public/changelogRec.html:91] [src:survev/client/public/changelogRec.html:92] [src:survev/client/public/changelogRec.html:93] [H]
- First appearance in survev git: 0c58cdba 2026-08-21 [src:derived/git-0c58cdba] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `quest_airdrop_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:620] [H] |
| `quest_airdrop_ltm_hard` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:631] [H] |
| `quest_airdrop_rare` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:642] [H] |
| `quest_assault_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1321] [H] |
| `quest_assault_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1219] [H] |
| `quest_be_mvp` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1000] [H] |
| `quest_classless_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1338] [H] |
| `quest_damage_12gauge_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:380] [H] |
| `quest_damage_45acp` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:398] [H] |
| `quest_damage_556mm_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:344] [H] |
| `quest_damage_762mm_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:308] [H] |
| `quest_damage_9mm_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:272] [H] |
| `quest_damage_grenade_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:517] [H] |
| `quest_damage_harder` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:237] [H] |
| `quest_damage_melee_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:554] [H] |
| `quest_damage_potato_ammo` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:416] [H] |
| `quest_damage_rare_ammo` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:434] [H] |
| `quest_damage_rare_ammo_ltm` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:456] [H] |
| `quest_damage_woods_king` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:478] [H] |
| `quest_demo_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1304] [H] |
| `quest_demo_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1202] [H] |
| `quest_desert_town_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:951] [H] |
| `quest_docks_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:923] [H] |
| `quest_factions_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1033] [H] |
| `quest_factions_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1095] [H] |
| `quest_hardstone` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:791] [H] |
| `quest_healer_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1236] [H] |
| `quest_healer_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1134] [H] |
| `quest_initiative_crate` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:840] [H] |
| `quest_kills_harder` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:215] [H] |
| `quest_last_man_damage_hard` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1072] [H] |
| `quest_logging_complex_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:979] [H] |
| `quest_potatoes` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:879] [H] |
| `quest_promote_hunted` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1016] [H] |
| `quest_pvt_swappers` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:858] [H] |
| `quest_reserve_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:965] [H] |
| `quest_river_town_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:937] [H] |
| `quest_scout_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1287] [H] |
| `quest_scout_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1185] [H] |
| `quest_sniper_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1270] [H] |
| `quest_sniper_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1168] [H] |
| `quest_soviet_crate` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:816] [H] |
| `quest_tank_damage` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1253] [H] |
| `quest_tank_kills` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:1151] [H] |
| `quest_win_any` |  | quest | 0c58cdba 2026-08-21 | [src:survev/shared/defs/gameObjects/questDefs.ts:179] [H] |

### Survevr Pass 2 cosmetics (fork, 23 ids)

- First battle pass designed by survev (fork v0.4.0); unrelated to the original Survivr Pass 2 (March 2020) [src:survev/client/public/changelogRec.html:87] [src:wikigg/Survevr_Passes] [src:fandom/Survivr_Pass_2] [H]
- First appearance in survev git: 18d34661 2026-08-28 [src:derived/git-18d34661] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `boost_club` | Club Cola | boost_effect | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:91] [H] |
| `boost_gearshift` | Gearshift | boost_effect | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:115] [H] |
| `boost_hermes` | Winged Grace | boost_effect | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:99] [H] |
| `boost_lightning` | Surged | boost_effect | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:107] [H] |
| `emote_bruh` | b r u h | emote | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1840] [H] |
| `emote_flatteredface` | Flattered Face | emote | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1850] [H] |
| `emote_salutingface` | Saluting Face | emote | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1860] [H] |
| `emote_screamingface` | Screaming Face | emote | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1870] [H] |
| `emote_timeout` | Timeout! | emote | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1820] [H] |
| `emote_traumatizedface` | Traumatized Face | emote | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/emoteDefs.ts:1830] [H] |
| `heal_ankh` | Ankh Charm | heal_effect | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:47] [H] |
| `heal_diamond` | Crazy Diamond | heal_effect | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:39] [H] |
| `heal_menacing` | Phantom Blood | heal_effect | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:55] [H] |
| `karambit_borealis` | Karambit Borealis | melee | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1185] [H] |
| `outfitAurora` | Auroric Ascension | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1299] [H] |
| `outfitChameleon` | The Chameleon | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1197] [H] |
| `outfitChrys` | Chrysanthemum Garb | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1238] [H] |
| `outfitCowz` | Cowz Cloak | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1177] [H] |
| `outfitFahrenheit` | Fahrenheit 5182 | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1258] [H] |
| `outfitPastel` | Pastel Sky | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1217] [H] |
| `outfitPotatoskin` | Potatoskin | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1279] [H] |
| `outfitRain` | Rainy Day | outfit | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/outfitDefs.ts:1156] [H] |
| `pass_survivr2` |  | pass | 18d34661 2026-08-28 | [src:survev/shared/defs/gameObjects/passDefs.ts:114] [H] |

### Tactical and Experimental packs (fork, 2 ids)

- Fork v0.4.2 equipment [src:survev/client/public/changelogRec.html:58] [H]
- First appearance in survev git: 33eb078e 2026-09-07 [src:derived/git-33eb078e] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `backpack04` | Tactical Pack | backpack | 33eb078e 2026-09-07 | [src:survev/shared/defs/gameObjects/gearDefs.ts:290] [H] |
| `backpack04_cloud` | Experimental Pack | backpack | 33eb078e 2026-09-07 | [src:survev/shared/defs/gameObjects/gearDefs.ts:917] [H] |

### Cloud Bunker (fork, 25 ids)

- Fork v0.4.2 structure; fandom notes the original only ever had the Cloud Crate and players expected a Cloud Bunker that never came [src:survev/client/public/changelogRec.html:57] [src:wikigg/Cloud_Bunker] [src:fandom/Cloud_Crate] [H]
- First appearance in survev git: 24275240 2026-09-15 [src:derived/git-24275240] [H]

| Id | Name | Kind | First seen | Definition |
|---|---|---|---|---|
| `bunker_cloud_01` |  | building | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/buildings/bunkerDefs.ts:1482] [H] |
| `bunker_cloud_compartment_01` |  | building | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/buildings/bunkerDefs.ts:2430] [H] |
| `bunker_cloud_compartment_02` |  | building | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/buildings/bunkerDefs.ts:2473] [H] |
| `bunker_cloud_sublevel_01` |  | building | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/buildings/bunkerDefs.ts:1596] [H] |
| `bunker_structure_10` |  | structure | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/structureDefs.ts:1066] [H] |
| `case_10` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:301] [H] |
| `control_panel_07de` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:338] [H] |
| `control_panel_07sv` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:362] [H] |
| `glass_wall_1x19` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1529] [H] |
| `glass_wall_1x23` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1535] [H] |
| `metal_wall_1x15` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1269] [H] |
| `metal_wall_2x5_5` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1303] [H] |
| `metal_wall_5x10` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1475] [H] |
| `metal_wall_5x13` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1479] [H] |
| `metal_wall_5x22_5` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1483] [H] |
| `metal_wall_5x23` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1487] [H] |
| `metal_wall_5x26` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1491] [H] |
| `metal_wall_5x6` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1471] [H] |
| `metal_wall_6x8` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1495] [H] |
| `table_06` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1258] [H] |
| `table_07` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1265] [H] |
| `table_08` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1272] [H] |
| `table_09` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1279] [H] |
| `vat_04` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1465] [H] |
| `vat_05` |  | obstacle | 24275240 2026-09-15 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1494] [H] |

## Original content with notes

- `bunker_eye_02_woods`: Woods Eye-bunker puzzle key: survev-assigned key for the original Woods-mode Eye bunker puzzle (10 control panels); the woods recorders recorder_08/recorder_09 are in the original import [src:wikigg/Eye_Bunker] [src:wikigg/Recorders] [src:fandom/Eye_Bunker] [src:survev/shared/defs/puzzles.ts:3] [M]
- `outfitHalloweenTree`: Original tree costume (renamed): same def as the original `outfitTree` ("Tree Costume", obstacleType tree_07); survev renamed `outfitTree` to `outfitHalloweenTree` in 929cee54 (2025-04-01) when it added `outfitSpringTree` [src:survev/shared/defs/gameObjects/outfitDefs.ts:1357] [src:derived/git-9f64948d:src/defs/outfitDefs.js:914] [src:derived/git-929cee54] [src:kong/relaunch-client-defs] [H]
- `quest_top_duo`: Top 8 in Duos quest: missing from the v0.8.82 client questDefs (survev import and the 2026 relaunch client both list only 24 quests), but fandom records its removal in the 0.9.2 update (2020-03-09), so it existed in the target era; survev re-added it in 2b6d1265 (2026-07-15, "Added back") [src:fandom/Changelog] [src:survev/client/public/changelogRec.html:170] [src:kong/relaunch-client-defs] [src:derived/git-2b6d1265] [L]
- `bar` (BAR M1918) is original: added in 0.6.3 (woods map), added to the normal map in 0.6.31, removed from the normal map again in 0.7.9, so in v0.8.82 it was not in normal loot; the fork added it to Classic and Faction loot in fork v0.1.2 [src:changelog/0.6.3, changelog/0.6.31, changelog/0.7.9, survev/client/public/changelogRec.html:434, balance/146] [H]
- `pass_survivr1` is the original Survivr Pass 1 id; survev filled it with its own "Survevr Pass 1" in fork v0.3.0 [src:changelog/0.8.7, survev/client/public/changelogRec.html:217] [M]
- `savannah` is an original map (Savannah weapons arrived in 0.8.3) that survev "reintroduced" in fork v0.2.1 and later changed (2x scope spawn, Oasis, second river, Barrett, S&W 500) [src:changelog/0.8.3, survev/client/public/changelogRec.html:319, survev/client/public/changelogRec.html:45, balance/343, balance/344] [H]
- `turkey` is an original map (0.8.73 Fowl Facade, Perky Shoot, squash), reworked in fork v0.1.3 and 0.1.31 [src:changelog/0.8.73, wikigg/Squash, survev/client/public/changelogRec.html:387, survev/client/public/changelogRec.html:382] [M]
- `snow`, `woods`, `woods_snow`, `desert`, `cobalt`, `faction` and `main` are original maps whose loot tables and spawns the fork changed; `balance-revert.md` lists each change [src:balance/200, balance/226, balance/315, balance/285, balance/170] [H]
- `bunker_twins_01`, `bunker_twins_sublevel_01` and `bunker_twins_compartment_01` are original (0.8.8) but the fork's twins expansion (f0107b35, fork 0.3.0) changed their contents: the sublevel gained `button_01b`, `button_01g`, `switch_01`, `switch_01o/p/y`, the compartment gained `case_09` (Cobalt Case), `vat_03` and extra walls, the entrance gained a `tree_01cb` [src:derived/git-f0107b35, survev/shared/defs/mapObjects/buildings/bunkerDefs.ts:7348, derived/git-ae55c9a8] [H]
- The original Twins sublevel (relaunch client) holds four `lab_door_locked_01` doors, a `control_panel_03`, a `class_shell_03` and barrels, with no buttons or switches [src:kong/relaunch-client-defs] [H]
- `desert_town_02` is original but its children were overhauled in fork v0.3.1: original `bank_01b`, `house_red_01`, `house_red_02`, `shack_01`, `tree_06` (plus archways, sandbags, `crate_18`, `outhouse_01`); survev now has `reserve_structure_01`, `barn_01`, a random house, `barrel_05`, palm trees [src:kong/relaunch-client-defs, survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5601, derived/git-94bf1f97, balance/317] [H]
- `faction` is an original map whose airdrop crates (`crate_12`, `crate_13`), airdrop tiers and caches the fork changed (fork 0.2.3, 0.4.0), and whose role promotion order the fork changed in fork 0.0.18; `balance-revert.md` lists each change [src:balance/260, balance/263, balance/270, balance/280, balance/329, survev/client/public/changelogRec.html:509] [H]
- survev itself warns that its base loot table "is not the original one so its not accurate", with `?` marking guesses from statistics and `!` marking uncertain leak data [src:survev/shared/defs/maps/baseDefs.ts:90] [H]

### Original ids removed from survev

| Original id | Kind | Removed by | Note |
|---|---|---|---|
| `outfitTree` | outfit | 929cee54 2025-04-01 | renamed to `outfitHalloweenTree` ("feat: eggs on potato spring") [src:derived/git-9f64948d, derived/git-929cee54] [H] |
| `emote_flagisrael` | emote | 663bdd6e 2026-06-08 | "fix: some more possible crashes because of definitions" [src:derived/git-9f64948d, derived/git-663bdd6e] [H] |
| `bullet_potato` | bullet | efd77aef 2025-03-22 | replaced by `bullet_invis` [src:derived/git-9f64948d, derived/git-efd77aef] [H] |
| `bullet_bugle` | bullet | efd77aef 2025-03-22 | replaced by `bullet_invis` [src:derived/git-9f64948d, derived/git-efd77aef] [H] |
| `bullet_mp5_bonus, bullet_m9_bonus, bullet_mac10_bonus, bullet_ump9_bonus, bullet_vector_bonus, bullet_glock_bonus, bullet_m93r_bonus, bullet_scorpion_bonus, bullet_vss_bonus, bullet_p30l_bonus` | bullet | 2462d0b9 2026-01-27 | 9mm Overpressure bonus bullets, deleted by "High-Velocity Rounds + Speed/Distance Refactor"; the guns' leftover `bulletTypeBonus` fields went in 7d27e9f9 (2026-03-08, "Remove 9mm Overpressure Artifact") [src:derived/git-9f64948d, derived/git-2462d0b9, derived/git-7d27e9f9] [H] |
| `tire_01` | obstacle | aeb229b5 2026-07-22 | mapObjectDefs split [src:derived/git-9f64948d, derived/git-aeb229b5] [H] |
| `house_door_06` | obstacle | 94bf1f97 2026-06-29 | Reserve desert-town overhaul [src:derived/git-9f64948d, derived/git-94bf1f97] [H] |
| `glass_wall_18` | obstacle | 24275240 2026-09-15 | Cloud Bunker commit [src:derived/git-9f64948d, derived/git-24275240] [H] |
| `loot_tier_sledgehammer` | loot_spawner | e99d1355 2026-01-04 | replaced by `loot_tier_barn_melee` [src:derived/git-9f64948d, derived/git-e99d1355] [H] |
| `loot_tier_eye_01, loot_tier_chrys_02b, loot_tier_helmet_potato` | loot_spawner | 900c36b7 2025-08-07 | commented out by "fix: fix mapObejctDefs for tests"; still present as comments [src:derived/git-9f64948d, derived/git-900c36b7, survev/shared/defs/mapObjects/lootSpawnerDefs.ts:101, survev/shared/defs/mapObjects/lootSpawnerDefs.ts:121, survev/shared/defs/mapObjects/lootSpawnerDefs.ts:133] [H] |

## Original ids by kind

> Every id below is in the original v0.8.82 import, except the three "25th/69th/5th" lines, which are survev keys for original content. Ids changed by `balance.txt` (or by an unlogged fork change, see the notes above) carry `forkModified` in the JSON.

- ammo (9): `12gauge`, `308sub`, `45acp`, `50AE`, `556mm`, `762mm`, `9mm`, `flare`, `potato_ammo` [src:survev/shared/defs/gameObjects/gearDefs.ts, derived/git-9f64948d] [H]
- backpack (4): `backpack00`, `backpack01`, `backpack02`, `backpack03` [src:survev/shared/defs/gameObjects/gearDefs.ts, derived/git-9f64948d] [H]
- boost (2): `painkiller`, `soda` [src:survev/shared/defs/gameObjects/gearDefs.ts, derived/git-9f64948d] [H]
- boost_effect (4): `boost_basic`, `boost_naturalize`, `boost_shuriken`, `boost_star` [src:survev/shared/defs/gameObjects/healEffectDefs.ts, derived/git-9f64948d] [H]
- building (1-80 of 171): `archway_01`, `bank_01`, `bank_01b`, `bank_01x`, `barn_01`, `barn_01h`, `barn_01x`, `barn_02`, `barn_02d`, `barn_basement_floor_01`, `barn_basement_floor_01d`, `barn_basement_floor_02`, `barn_basement_floor_02d`, `barn_basement_stairs_01`, `bathhouse_01`, `bathhouse_sideroom_01`, `bathhouse_sideroom_02`, `bridge_lg_01`, `bridge_lg_01x`, `bridge_lg_under_01`, `bridge_md_01`, `bridge_md_under_01`, `bridge_xlg_01`, `bridge_xlg_under_01`, `brush_clump_01`, `brush_clump_02`, `brush_clump_03`, `bunker_chrys_compartment_01`, `bunker_chrys_compartment_01b`, `bunker_chrys_compartment_02`, `bunker_chrys_compartment_02b`, `bunker_chrys_compartment_03`, `bunker_chrys_compartment_03b`, `bunker_chrys_sublevel_01`, `bunker_chrys_sublevel_01b`, `bunker_conch_01`, `bunker_conch_compartment_01`, `bunker_conch_sublevel_01`, `bunker_crossing_01`, `bunker_crossing_bathroom`, `bunker_crossing_compartment_01`, `bunker_crossing_stairs_01`, `bunker_crossing_stairs_01b`, `bunker_crossing_sublevel_01`, `bunker_egg_01`, `bunker_egg_sublevel_01`, `bunker_egg_sublevel_01sv`, `bunker_egg_sublevel_02`, `bunker_eye_01`, `bunker_eye_compartment_01`, `bunker_eye_sublevel_01`, `bunker_hatchet_01`, `bunker_hatchet_compartment_01`, `bunker_hatchet_compartment_02`, `bunker_hatchet_compartment_03`, `bunker_hatchet_sublevel_01`, `bunker_hydra_01`, `bunker_hydra_compartment_01`, `bunker_hydra_compartment_02`, `bunker_hydra_compartment_03`, `bunker_hydra_sublevel_01`, `bunker_storm_01`, `bunker_storm_sublevel_01`, `bunker_twins_01`, `bunker_twins_compartment_01`, `bunker_twins_stairs_01`, `bunker_twins_sublevel_01`, `cabin_01`, `cabin_01x`, `cabin_02`, `cache_01`, `cache_01sv`, `cache_02`, `cache_02sv`, `cache_03`, `cache_06`, `cache_07`, `cache_log_13`, `cache_pumpkin_01`, `cache_pumpkin_02` [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts, derived/git-9f64948d] [H]
- building (81-160 of 171): `cache_pumpkin_03`, `cache_pumpkin_airdrop_02`, `candle_lit_01`, `candle_lit_02`, `club_complex_01`, `club_vault`, `container_01`, `container_01x`, `container_02`, `container_03`, `container_04`, `container_05`, `container_06`, `desert_town_01`, `desert_town_02`, `dock_01`, `grassy_cover_01`, `grassy_cover_02`, `grassy_cover_03`, `grassy_cover_complex_01`, `greenhouse_01`, `greenhouse_02`, `hedgehog_01`, `house_red_01`, `house_red_01h`, `house_red_01x`, `house_red_02`, `house_red_02h`, `house_red_02x`, `hut_01`, `hut_01x`, `hut_02`, `hut_02x`, `hut_03`, `junkyard_01`, `kopje_brush_01`, `kopje_patch_01`, `logging_complex_01`, `logging_complex_01sp`, `logging_complex_01su`, `logging_complex_02`, `logging_complex_02sp`, `logging_complex_02su`, `logging_complex_03`, `mansion_01`, `mansion_01x`, `mansion_02`, `mansion_cellar_01`, `mansion_cellar_02`, `outhouse_01`, `outhouse_01x`, `outhouse_02`, `panicroom_01`, `perch_01`, `police_01`, `police_01x`, `river_town_01`, `river_town_02`, `saferoom_01`, `saloon_01`, `saloon_cellar_01`, `savannah_patch_01`, `shack_01`, `shack_01x`, `shack_02`, `shack_02x`, `shack_03a`, `shack_03b`, `shack_03x`, `shilo_01`, `statue_building_03`, `statue_building_04`, `statue_structure_01`, `statue_structure_02`, `statue_underground_03`, `statue_underground_04`, `teahouse_01`, `teahouse_complex_01s`, `teahouse_complex_01su`, `teapavilion_01` [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts, derived/git-9f64948d] [H]
- building (161-171 of 171): `teapavilion_01w`, `teapavilion_complex_01`, `vault_01`, `vault_01b`, `warehouse_01`, `warehouse_01f`, `warehouse_01h`, `warehouse_01x`, `warehouse_02`, `warehouse_02x`, `warehouse_complex_01` [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts, derived/git-9f64948d] [H]
- building+puzzle (2): `bunker_chrys_01`, `club_01` [src:survev/shared/defs/mapObjects/buildings/bunkerDefs.ts, derived/git-9f64948d] [H]
- bullet (57): `bullet_ak47`, `bullet_an94`, `bullet_awc`, `bullet_bar`, `bullet_birdshot`, `bullet_blr`, `bullet_buckshot`, `bullet_colt45`, `bullet_deagle`, `bullet_dp28`, `bullet_famas`, `bullet_flare`, `bullet_flechette`, `bullet_frag`, `bullet_garand`, `bullet_glock`, `bullet_groza`, `bullet_grozas`, `bullet_hk416`, `bullet_l86`, `bullet_m1911`, `bullet_m1a1`, `bullet_m249`, `bullet_m39`, `bullet_m4a1`, `bullet_m9`, `bullet_m93r`, `bullet_m9_cursed`, `bullet_mac10`, `bullet_mk12`, `bullet_mkg45`, `bullet_model94`, `bullet_mosin`, `bullet_mp5`, `bullet_ot38`, `bullet_ots38`, `bullet_p30l`, `bullet_pkp`, `bullet_qbb97`, `bullet_scar`, `bullet_scarssr`, `bullet_scorpion`, `bullet_scout`, `bullet_slug`, `bullet_sv98`, `bullet_svd`, `bullet_ump9`, `bullet_vector`, `bullet_vector45`, `bullet_vss`, `shrapnel_barrel`, `shrapnel_bomb_iron`, `shrapnel_frag`, `shrapnel_mirv_mini`, `shrapnel_stove`, `shrapnel_strobe`, `shrapnel_usas` [src:survev/shared/defs/gameObjects/bulletDefs.ts, derived/git-9f64948d] [H]
- chest (4): `chest01`, `chest02`, `chest03`, `chest04` [src:survev/shared/defs/gameObjects/gearDefs.ts, derived/git-9f64948d] [H]
- crosshair (30): `crosshair_001`, `crosshair_005`, `crosshair_007`, `crosshair_010`, `crosshair_022`, `crosshair_027`, `crosshair_038`, `crosshair_040`, `crosshair_045`, `crosshair_051`, `crosshair_064`, `crosshair_080`, `crosshair_086`, `crosshair_094`, `crosshair_098`, `crosshair_101`, `crosshair_102`, `crosshair_109`, `crosshair_118`, `crosshair_124`, `crosshair_125`, `crosshair_136`, `crosshair_158`, `crosshair_160`, `crosshair_173`, `crosshair_176`, `crosshair_177`, `crosshair_181`, `crosshair_184`, `crosshair_default` [src:survev/shared/defs/gameObjects/crosshairDefs.ts, derived/git-9f64948d] [H]
- decal (38): `decal_barrel_explosion`, `decal_bathhouse_pool_01`, `decal_blood_01`, `decal_blood_02`, `decal_blood_03`, `decal_bomb_iron_explosion`, `decal_chrys_01`, `decal_club_01`, `decal_club_02`, `decal_flyer_01`, `decal_frag_explosion`, `decal_frag_small_explosion`, `decal_hydra_01`, `decal_initiative_01`, `decal_light_01`, `decal_light_02`, `decal_light_03`, `decal_light_04`, `decal_oil_01`, `decal_oil_02`, `decal_oil_03`, `decal_oil_04`, `decal_oil_05`, `decal_oil_06`, `decal_pipes_01`, `decal_pipes_02`, `decal_pipes_03`, `decal_pipes_04`, `decal_pipes_05`, `decal_plank_01`, `decal_potato_explosion`, `decal_rounds_explosion`, `decal_smoke_explosion`, `decal_snowball_explosion`, `decal_vent_01`, `decal_vent_02`, `decal_vent_03`, `decal_web_01` [src:survev/shared/defs/mapObjects/decalDefs.ts, derived/git-9f64948d] [H]
- emote (1-80 of 164): `emote_acorn`, `emote_alienface`, `emote_ammo`, `emote_ammo12gauge`, `emote_ammo308sub`, `emote_ammo45acp`, `emote_ammo50ae`, `emote_ammo556mm`, `emote_ammo762mm`, `emote_ammo9mm`, `emote_ammoflare`, `emote_angryface`, `emote_baguette`, `emote_bandagedface`, `emote_bugle_final_blue`, `emote_bugle_final_red`, `emote_bugle_inspiration_blue`, `emote_bugle_inspiration_red`, `emote_campfire`, `emote_candycorn`, `emote_cattle`, `emote_chick`, `emote_chickendinner`, `emote_coconut`, `emote_crab`, `emote_cupcake`, `emote_dabface`, `emote_disappointface`, `emote_donut`, `emote_egg`, `emote_eggplant`, `emote_fish`, `emote_flagalbania`, `emote_flagalgeria`, `emote_flagargentina`, `emote_flagaustralia`, `emote_flagaustria`, `emote_flagazerbaijan`, `emote_flagbelarus`, `emote_flagbelgium`, `emote_flagbolivia`, `emote_flagbrazil`, `emote_flagcanada`, `emote_flagchile`, `emote_flagchina`, `emote_flagcolombia`, `emote_flagcroatia`, `emote_flagczechia`, `emote_flagdenmark`, `emote_flagdominicanrepublic`, `emote_flagecuador`, `emote_flagegypt`, `emote_flagestonia`, `emote_flagfinland`, `emote_flagfrance`, `emote_flaggeorgia`, `emote_flaggermany`, `emote_flaggreece`, `emote_flagguatemala`, `emote_flaghonduras`, `emote_flaghongkong`, `emote_flaghungary`, `emote_flagindia`, `emote_flagindonesia`, `emote_flagitaly`, `emote_flagjapan`, `emote_flagkazakhstan`, `emote_flaglatvia`, `emote_flaglithuania`, `emote_flagmalaysia`, `emote_flagmexico`, `emote_flagmorocco`, `emote_flagnetherlands`, `emote_flagnewzealand`, `emote_flagnorway`, `emote_flagperu`, `emote_flagphilippines`, `emote_flagpoland`, `emote_flagportugal`, `emote_flagromania` [src:survev/shared/defs/gameObjects/emoteDefs.ts, derived/git-9f64948d] [H]
- emote (81-160 of 164): `emote_flagrussia`, `emote_flagserbia`, `emote_flagsingapore`, `emote_flagslovakia`, `emote_flagsouthkorea`, `emote_flagspain`, `emote_flagsweden`, `emote_flagswitzerland`, `emote_flagtaiwan`, `emote_flagthailand`, `emote_flagtrinidad`, `emote_flagturkey`, `emote_flaguae`, `emote_flaguk`, `emote_flagukraine`, `emote_flaguruguay`, `emote_flagus`, `emote_flagvenezuela`, `emote_flagvietnam`, `emote_flex`, `emote_forest`, `emote_gg`, `emote_ghost_base`, `emote_happyface`, `emote_headshotface`, `emote_heart`, `emote_heartface`, `emote_icecream`, `emote_impface`, `emote_joyface`, `emote_leek`, `emote_logocaduceus`, `emote_logochrysanthemum`, `emote_logocloud`, `emote_logoconch`, `emote_logocrossing`, `emote_logoegg`, `emote_logohatchet`, `emote_logohydra`, `emote_logometeor`, `emote_logostorm`, `emote_logosurviv`, `emote_logoswine`, `emote_logotwins`, `emote_loot`, `emote_medical`, `emote_monocleface`, `emote_ok`, `emote_picassoface`, `emote_pilgrimhat`, `emote_pineapple`, `emote_police`, `emote_pooface`, `emote_potato`, `emote_pumpkin`, `emote_question`, `emote_rainbow`, `emote_sadface`, `emote_salt`, `emote_santahat`, `emote_sleepy`, `emote_snowflake`, `emote_snowman`, `emote_sobface`, `emote_sunglassface`, `emote_surviv`, `emote_teabag`, `emote_thinkingface`, `emote_thumbsup`, `emote_tombstone`, `emote_treat_12g`, `emote_treat_556`, `emote_treat_762`, `emote_treat_9mm`, `emote_treat_super`, `emote_trick_chatty`, `emote_trick_drain`, `emote_trick_m9`, `emote_trick_nothing`, `emote_trick_size` [src:survev/shared/defs/gameObjects/emoteDefs.ts, derived/git-9f64948d] [H]
- emote (161-164 of 164): `emote_trunk`, `emote_turkeyanimal`, `emote_upsidedownface`, `emote_whale` [src:survev/shared/defs/gameObjects/emoteDefs.ts, derived/git-9f64948d] [H]
- explosion (18): `explosion_barrel`, `explosion_bomb_iron`, `explosion_frag`, `explosion_martyr_nade`, `explosion_mirv`, `explosion_mirv_mini`, `explosion_potato`, `explosion_potato_cannonball`, `explosion_potato_heavy`, `explosion_potato_smgshot`, `explosion_rounds`, `explosion_rounds_sg`, `explosion_smoke`, `explosion_snowball`, `explosion_snowball_heavy`, `explosion_stove`, `explosion_strobe`, `explosion_usas` [src:survev/shared/defs/gameObjects/explosionsDefs.ts, derived/git-9f64948d] [H]
- gun (65): `ak47`, `an94`, `awc`, `bar`, `blr`, `bugle`, `colt45`, `colt45_dual`, `deagle`, `deagle_dual`, `dp28`, `famas`, `flare_gun`, `flare_gun_dual`, `garand`, `glock`, `glock_dual`, `groza`, `grozas`, `hk416`, `l86`, `m1014`, `m1100`, `m1911`, `m1911_dual`, `m1a1`, `m249`, `m39`, `m4a1`, `m870`, `m9`, `m93r`, `m93r_dual`, `m9_cursed`, `m9_dual`, `mac10`, `mk12`, `mkg45`, `model94`, `mosin`, `mp220`, `mp5`, `ot38`, `ot38_dual`, `ots38`, `ots38_dual`, `p30l`, `p30l_dual`, `pkp`, `potato_cannon`, `potato_smg`, `qbb97`, `saiga`, `scar`, `scarssr`, `scorpion`, `scout_elite`, `spas12`, `sv98`, `svd`, `ump9`, `usas`, `vector`, `vector45`, `vss` [src:survev/shared/defs/gameObjects/gunDefs.ts, derived/git-9f64948d] [H]
- heal (2): `bandage`, `healthkit` [src:survev/shared/defs/gameObjects/gearDefs.ts, derived/git-9f64948d] [H]
- heal_effect (4): `heal_basic`, `heal_heart`, `heal_moon`, `heal_tomoe` [src:survev/shared/defs/gameObjects/healEffectDefs.ts, derived/git-9f64948d] [H]
- helmet (18): `helmet01`, `helmet02`, `helmet03`, `helmet03_bugler`, `helmet03_forest`, `helmet03_grenadier`, `helmet03_leader`, `helmet03_lt`, `helmet03_lt_aged`, `helmet03_marksman`, `helmet03_moon`, `helmet03_potato`, `helmet03_recon`, `helmet04`, `helmet04_last_man_blue`, `helmet04_last_man_red`, `helmet04_leader`, `helmet04_medic` [src:survev/shared/defs/gameObjects/gearDefs.ts, derived/git-9f64948d] [H]
- loot_spawner (32): `loot_tier_1`, `loot_tier_2`, `loot_tier_airdrop_armor`, `loot_tier_beach`, `loot_tier_chrys_01`, `loot_tier_chrys_02`, `loot_tier_chrys_03`, `loot_tier_club_melee`, `loot_tier_eye_02`, `loot_tier_fireaxe`, `loot_tier_hatchet_melee`, `loot_tier_helmet_forest`, `loot_tier_imperial_outfit`, `loot_tier_islander_outfit`, `loot_tier_leaf_pile`, `loot_tier_loot_test`, `loot_tier_lumber_outfit`, `loot_tier_mansion_floor`, `loot_tier_perk_test`, `loot_tier_pineapple_outfit`, `loot_tier_police_floor`, `loot_tier_saloon`, `loot_tier_scopes_sniper`, `loot_tier_sniper_test`, `loot_tier_spetsnaz_outfit`, `loot_tier_stonehammer`, `loot_tier_surviv`, `loot_tier_sv98`, `loot_tier_tarkhany_outfit`, `loot_tier_vault_floor`, `loot_tier_verde_outfit`, `loot_tier_woodaxe` [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts, derived/git-9f64948d] [H]
- map (15): `cobalt`, `desert`, `faction`, `halloween`, `main`, `main_spring`, `main_summer`, `potato_spring`, `savannah`, `snow`, `turkey`, `woods`, `woods_snow`, `woods_spring`, `woods_summer` [src:survev/shared/defs/maps/cobaltDefs.ts, derived/git-33832ffe] [H]
- melee (42): `bayonet`, `bayonet_rugged`, `bayonet_woodland`, `bonesaw_healer`, `bonesaw_rusted`, `bowie`, `bowie_frontier`, `bowie_vintage`, `crowbar`, `crowbar_recon`, `crowbar_scout`, `fireaxe`, `fists`, `hook`, `huntsman`, `huntsman_burnished`, `huntsman_rugged`, `karambit`, `karambit_drowned`, `karambit_prismatic`, `karambit_rugged`, `katana`, `katana_demo`, `katana_orchid`, `katana_rusted`, `knuckles`, `knuckles_heroic`, `knuckles_rusted`, `kukri_sniper`, `kukri_trad`, `machete`, `machete_taiga`, `naginata`, `pan`, `saw`, `sledgehammer`, `spade`, `spade_assault`, `stonehammer`, `warhammer_tank`, `woodaxe`, `woodaxe_bloody` [src:survev/shared/defs/gameObjects/meleeDefs.ts, derived/git-9f64948d] [H]
- obstacle (1-80 of 564): `airdrop_crate_01`, `airdrop_crate_01sv`, `airdrop_crate_01x`, `airdrop_crate_02`, `airdrop_crate_02de`, `airdrop_crate_02h`, `airdrop_crate_02sv`, `airdrop_crate_02tr`, `airdrop_crate_02x`, `airdrop_crate_03`, `airdrop_crate_04`, `archway_column_1`, `bank_wall_int_3`, `bank_wall_int_4`, `bank_wall_int_5`, `bank_wall_int_8`, `bank_window_01`, `barn_column_1`, `barn_wall_int_11`, `barn_wall_int_13`, `barn_wall_int_2`, `barn_wall_int_2_5`, `barn_wall_int_4`, `barn_wall_int_5`, `barn_wall_int_6`, `barn_wall_int_7`, `barn_wall_int_8`, `barrel_01`, `barrel_01b`, `barrel_02`, `barrel_03`, `barrel_04`, `bathhouse_column_1`, `bathhouse_column_2`, `bathhouse_rocks_01`, `bed_lg_01`, `bed_sm_01`, `bollard_01`, `bookshelf_01`, `bookshelf_02`, `bottle_01`, `bottle_02`, `bottle_02b`, `bottle_02g`, `bottle_02i`, `bottle_02o`, `bottle_02r`, `bottle_02v`, `bottle_02y`, `bottle_04`, `bottle_05`, `brick_wall_ext_1`, `brick_wall_ext_10`, `brick_wall_ext_11`, `brick_wall_ext_11_5`, `brick_wall_ext_12`, `brick_wall_ext_12_5`, `brick_wall_ext_13`, `brick_wall_ext_14`, `brick_wall_ext_15`, `brick_wall_ext_16`, `brick_wall_ext_17`, `brick_wall_ext_18`, `brick_wall_ext_19`, `brick_wall_ext_2`, `brick_wall_ext_20`, `brick_wall_ext_21`, `brick_wall_ext_23`, `brick_wall_ext_3`, `brick_wall_ext_33`, `brick_wall_ext_3_0_low`, `brick_wall_ext_4`, `brick_wall_ext_41`, `brick_wall_ext_5`, `brick_wall_ext_6`, `brick_wall_ext_7`, `brick_wall_ext_8`, `brick_wall_ext_9`, `brick_wall_ext_short_7`, `brick_wall_ext_thicker_15` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- obstacle (81-160 of 564): `brick_wall_ext_thicker_16`, `brick_wall_ext_thicker_24`, `brick_wall_ext_thicker_4`, `brick_wall_ext_thicker_5`, `brick_wall_ext_thicker_6`, `brick_wall_ext_thicker_7`, `brick_wall_ext_thicker_8`, `brick_wall_ext_thicker_9`, `bridge_lg_under_column`, `bridge_rail_12`, `bridge_rail_20`, `bridge_rail_28`, `bridge_rail_3`, `bridge_xlg_under_column`, `brush_01sv`, `brush_02sv`, `bush_01`, `bush_01b`, `bush_01cb`, `bush_01f`, `bush_01sv`, `bush_01x`, `bush_02`, `bush_03`, `bush_04`, `bush_04cb`, `bush_05`, `bush_06`, `bush_06b`, `bush_07`, `bush_07sp`, `bush_07x`, `cabin_wall_int_10`, `cabin_wall_int_13`, `cabin_wall_int_5`, `candle_01`, `case_01`, `case_02`, `case_03`, `case_04`, `case_05`, `case_06`, `case_07`, `cell_door_01`, `chest_01`, `chest_01cb`, `chest_02`, `chest_03`, `chest_03cb`, `chest_03d`, `chest_03f`, `chest_03x`, `chest_04`, `chest_04d`, `class_crate_common_assault`, `class_crate_common_demo`, `class_crate_common_healer`, `class_crate_common_scout`, `class_crate_common_sniper`, `class_crate_common_tank`, `class_crate_mythic`, `class_crate_rare_assault`, `class_crate_rare_demo`, `class_crate_rare_healer`, `class_crate_rare_scout`, `class_crate_rare_sniper`, `class_crate_rare_tank`, `class_shell_01`, `class_shell_02`, `class_shell_03`, `club_bar_back_large`, `club_bar_large`, `club_bar_small`, `club_wall_int_10`, `club_wall_int_6`, `club_window_01`, `club_window_broken_01`, `cobalt_wall_int_4`, `concrete_wall_column_4x24`, `concrete_wall_column_4x8` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- obstacle (161-240 of 564): `concrete_wall_column_4x9`, `concrete_wall_column_5x10`, `concrete_wall_column_5x4`, `concrete_wall_column_7x10`, `concrete_wall_column_9x4`, `concrete_wall_ext_10_5`, `concrete_wall_ext_11`, `concrete_wall_ext_11_5`, `concrete_wall_ext_13`, `concrete_wall_ext_14`, `concrete_wall_ext_15`, `concrete_wall_ext_16`, `concrete_wall_ext_17`, `concrete_wall_ext_1_5`, `concrete_wall_ext_2`, `concrete_wall_ext_23`, `concrete_wall_ext_24`, `concrete_wall_ext_25`, `concrete_wall_ext_3`, `concrete_wall_ext_4`, `concrete_wall_ext_5`, `concrete_wall_ext_6`, `concrete_wall_ext_7`, `concrete_wall_ext_8`, `concrete_wall_ext_9`, `concrete_wall_ext_9_5`, `concrete_wall_ext_thick_11`, `concrete_wall_ext_thicker_10`, `concrete_wall_ext_thicker_11`, `concrete_wall_ext_thicker_12`, `concrete_wall_ext_thicker_13`, `concrete_wall_ext_thicker_14`, `concrete_wall_ext_thicker_15`, `concrete_wall_ext_thicker_17`, `concrete_wall_ext_thicker_19`, `concrete_wall_ext_thicker_21`, `concrete_wall_ext_thicker_22`, `concrete_wall_ext_thicker_27`, `concrete_wall_ext_thicker_30`, `concrete_wall_ext_thicker_31`, `concrete_wall_ext_thicker_4`, `concrete_wall_ext_thicker_42`, `concrete_wall_ext_thicker_5`, `concrete_wall_ext_thicker_54`, `concrete_wall_ext_thicker_6`, `concrete_wall_ext_thicker_8`, `concrete_wall_ext_thicker_9`, `concrete_wall_ext_thin_6`, `container_05_collider`, `container_wall_side`, `container_wall_side_open`, `container_wall_top`, `control_panel_01`, `control_panel_02`, `control_panel_02b`, `control_panel_03`, `control_panel_04`, `control_panel_06`, `couch_01`, `couch_02`, `couch_02b`, `couch_03`, `crate_01`, `crate_01x`, `crate_02`, `crate_02d`, `crate_02f`, `crate_02sv`, `crate_02sv_lake`, `crate_02x`, `crate_03`, `crate_03x`, `crate_04`, `crate_05`, `crate_06`, `crate_07`, `crate_07b`, `crate_07sv`, `crate_08`, `crate_09` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- obstacle (241-320 of 564): `crate_10`, `crate_10sv`, `crate_11`, `crate_11de`, `crate_11h`, `crate_11sv`, `crate_11tr`, `crate_12`, `crate_13`, `crate_14`, `crate_14a`, `crate_15`, `crate_16`, `crate_18`, `crate_19`, `crate_20`, `crate_21`, `crate_21b`, `crate_22`, `crate_22d`, `crossing_door_01`, `deposit_box_01`, `deposit_box_02`, `drawers_01`, `drawers_02`, `eye_door_01`, `fire_ext_01`, `glass_wall_10`, `glass_wall_12`, `glass_wall_12_2`, `glass_wall_9`, `grassy_wall_3`, `grassy_wall_8`, `grill_01`, `gun_mount_01`, `gun_mount_02`, `gun_mount_03`, `gun_mount_04`, `gun_mount_05`, `hedgehog_wall`, `house_column_1`, `house_door_01`, `house_door_02`, `house_door_03`, `house_door_05`, `house_wall_int_11`, `house_wall_int_14`, `house_wall_int_4`, `house_wall_int_5`, `house_wall_int_8`, `house_wall_int_9`, `house_window_01`, `house_window_broken_01`, `hut_wall_int_12`, `hut_wall_int_14`, `hut_wall_int_4`, `hut_wall_int_5`, `hut_wall_int_6`, `hut_window_open_01`, `lab_door_01`, `lab_door_02`, `lab_door_03`, `lab_door_chrys`, `lab_door_locked_01`, `lab_window_01`, `lab_window_broken_01`, `locker_01`, `locker_02`, `locker_03`, `mansion_column_1`, `mansion_wall_int_1`, `mansion_wall_int_10`, `mansion_wall_int_11`, `mansion_wall_int_12`, `mansion_wall_int_13`, `mansion_wall_int_5`, `mansion_wall_int_6`, `mansion_wall_int_7`, `mansion_wall_int_8`, `mansion_wall_int_9` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- obstacle (321-400 of 564): `metal_wall_column_4x8`, `metal_wall_column_5x12`, `metal_wall_ext_10`, `metal_wall_ext_12`, `metal_wall_ext_12_5`, `metal_wall_ext_13`, `metal_wall_ext_18`, `metal_wall_ext_23`, `metal_wall_ext_3`, `metal_wall_ext_4`, `metal_wall_ext_43`, `metal_wall_ext_5`, `metal_wall_ext_6`, `metal_wall_ext_7`, `metal_wall_ext_8`, `metal_wall_ext_9`, `metal_wall_ext_short_6`, `metal_wall_ext_short_7`, `metal_wall_ext_thick_12`, `metal_wall_ext_thick_20`, `metal_wall_ext_thick_6`, `metal_wall_ext_thicker_10`, `metal_wall_ext_thicker_11`, `metal_wall_ext_thicker_12`, `metal_wall_ext_thicker_13`, `metal_wall_ext_thicker_14`, `metal_wall_ext_thicker_15`, `metal_wall_ext_thicker_16`, `metal_wall_ext_thicker_17`, `metal_wall_ext_thicker_18`, `metal_wall_ext_thicker_19`, `metal_wall_ext_thicker_20`, `metal_wall_ext_thicker_21`, `metal_wall_ext_thicker_22`, `metal_wall_ext_thicker_23`, `metal_wall_ext_thicker_24`, `metal_wall_ext_thicker_25`, `metal_wall_ext_thicker_26`, `metal_wall_ext_thicker_27`, `metal_wall_ext_thicker_28`, `metal_wall_ext_thicker_29`, `metal_wall_ext_thicker_32`, `metal_wall_ext_thicker_34`, `metal_wall_ext_thicker_35`, `metal_wall_ext_thicker_4`, `metal_wall_ext_thicker_42`, `metal_wall_ext_thicker_48`, `metal_wall_ext_thicker_5`, `metal_wall_ext_thicker_6`, `metal_wall_ext_thicker_7`, `metal_wall_ext_thicker_8`, `metal_wall_ext_thicker_9`, `mil_crate_01`, `mil_crate_02`, `mil_crate_03`, `mil_crate_04`, `mil_crate_05`, `outhouse_wall_bot`, `outhouse_wall_side`, `outhouse_wall_top`, `oven_01`, `piano_01`, `planter_01`, `planter_02`, `planter_03`, `planter_04`, `planter_06`, `planter_07`, `police_wall_int_10`, `police_wall_int_2`, `police_wall_int_3`, `police_wall_int_4`, `police_wall_int_6`, `police_wall_int_7`, `police_wall_int_8`, `pot_01`, `pot_02`, `pot_03`, `pot_03b`, `pot_03c` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- obstacle (401-480 of 564): `pot_04`, `pot_05`, `potato_01`, `potato_02`, `potato_03`, `power_box_01`, `propane_01`, `pumpkin_01`, `pumpkin_02`, `pumpkin_03`, `recorder_01`, `recorder_02`, `recorder_03`, `recorder_04`, `recorder_05`, `recorder_06`, `recorder_07`, `recorder_08`, `recorder_09`, `recorder_10`, `recorder_11`, `recorder_12`, `recorder_13`, `recorder_14`, `refrigerator_01`, `refrigerator_01b`, `saloon_bar_back_large`, `saloon_bar_back_small`, `saloon_bar_large`, `saloon_bar_small`, `saloon_column_1`, `saloon_door_secret`, `sandbags_01`, `sandbags_02`, `screen_01`, `secret_door_club`, `shack_wall_bot`, `shack_wall_ext_10`, `shack_wall_ext_14`, `shack_wall_ext_2`, `shack_wall_ext_5`, `shack_wall_ext_9`, `shack_wall_side_left`, `shack_wall_side_right`, `shack_wall_top`, `silo_01`, `silo_01po`, `squash_01`, `stairs_01`, `stand_01`, `statue_01`, `statue_03`, `statue_04`, `statue_top_01`, `statue_top_02`, `stone_01`, `stone_01b`, `stone_01cb`, `stone_01f`, `stone_01sv`, `stone_01x`, `stone_02`, `stone_02sv`, `stone_03`, `stone_03b`, `stone_03cb`, `stone_03f`, `stone_03x`, `stone_04`, `stone_05`, `stone_06`, `stone_07`, `stone_wall_int_4`, `stove_01`, `stove_02`, `switch_01`, `switch_02`, `switch_03`, `table_01`, `table_01x` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- obstacle (481-560 of 564): `table_02`, `table_02x`, `table_03`, `table_03x`, `teahouse_door_01`, `teahouse_wall_int_12`, `teahouse_wall_int_13`, `teahouse_wall_int_14`, `teahouse_wall_int_18`, `teahouse_wall_int_3`, `teahouse_wall_int_4`, `teahouse_wall_int_5`, `teahouse_wall_int_7`, `teahouse_window_open_01`, `toilet_01`, `toilet_02`, `toilet_02b`, `toilet_03`, `toilet_04`, `towelrack_01`, `tree_01`, `tree_01cb`, `tree_01sv`, `tree_01x`, `tree_02`, `tree_02h`, `tree_03`, `tree_03sv`, `tree_05`, `tree_05b`, `tree_05c`, `tree_06`, `tree_07`, `tree_07sp`, `tree_07spr`, `tree_07su`, `tree_08`, `tree_08b`, `tree_08c`, `tree_08f`, `tree_08sp`, `tree_08spb`, `tree_08spc`, `tree_08spr`, `tree_08su`, `tree_08sub`, `tree_09`, `tree_10`, `tree_11`, `tree_12`, `tree_13`, `tree_interior_01`, `tree_switch_01`, `tree_switch_02`, `tree_switch_03`, `vat_01`, `vat_02`, `vault_door_bathhouse`, `vault_door_chrys_01`, `vault_door_chrys_02`, `vault_door_eye`, `vault_door_main`, `vending_01`, `warehouse_wall_edge`, `warehouse_wall_side`, `wheel_01`, `wheel_02`, `wheel_03`, `wood_perm_wall_ext_14`, `wood_perm_wall_ext_17`, `wood_perm_wall_ext_35`, `wood_perm_wall_ext_5`, `wood_perm_wall_ext_6`, `wood_perm_wall_ext_7`, `wood_perm_wall_ext_thicker_10`, `wood_perm_wall_ext_thicker_12`, `wood_perm_wall_ext_thicker_13`, `wood_perm_wall_ext_thicker_18`, `wood_perm_wall_ext_thicker_21`, `wood_perm_wall_ext_thicker_6` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- obstacle (561-564 of 564): `wood_perm_wall_ext_thicker_7`, `wood_perm_wall_ext_thicker_8`, `woodpile_01`, `woodpile_02` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts, derived/git-9f64948d] [H]
- outfit (68 of 69, in the original import): `outfitAirdrop`, `outfitAqua`, `outfitAssault`, `outfitBarrel`, `outfitBase`, `outfitBlueLeader`, `outfitBlueLeaderAged`, `outfitBush`, `outfitBushRiver`, `outfitCamo`, `outfitCarbonFiber`, `outfitCasanova`, `outfitCobaltShell`, `outfitCoral`, `outfitCrab`, `outfitCrate`, `outfitDarkGloves`, `outfitDarkShirt`, `outfitDemo`, `outfitDesertCamo`, `outfitDev`, `outfitElf`, `outfitGhillie`, `outfitHeaven`, `outfitImperial`, `outfitIslander`, `outfitJester`, `outfitKeyLime`, `outfitKhaki`, `outfitLeafPile`, `outfitLumber`, `outfitMedic`, `outfitMeteor`, `outfitMod`, `outfitNoir`, `outfitOven`, `outfitParma`, `outfitParmaPrestige`, `outfitPineapple`, `outfitPrisoner`, `outfitPumpkin`, `outfitRed`, `outfitRedLeader`, `outfitRedLeaderAged`, `outfitRefrigerator`, `outfitRoyalFortune`, `outfitScout`, `outfitSniper`, `outfitSoviet`, `outfitSpetsnaz`, `outfitStone`, `outfitStump`, `outfitStumpAxe`, `outfitTable`, `outfitTank`, `outfitTarkhany`, `outfitToilet`, `outfitTreeSpooky`, `outfitTurkey`, `outfitVending`, `outfitVerde`, `outfitWaterElem`, `outfitWheat`, `outfitWhite`, `outfitWoodBarrel`, `outfitWoodland`, `outfitWoodpile`, `outfitWoodsCloak` [src:survev/shared/defs/gameObjects/outfitDefs.ts, derived/git-9f64948d] [H]
- outfit (69th): `outfitHalloweenTree` is the original `outfitTree` renamed by survev in 929cee54 [src:survev/shared/defs/gameObjects/outfitDefs.ts:1357, derived/git-929cee54, kong/relaunch-client-defs] [H]
- pass (1): `pass_survivr1` [src:survev/shared/defs/gameObjects/passDefs.ts, derived/git-9f64948d] [H]
- perk (41): `aoe_heal`, `bonus_45`, `bonus_9mm`, `bonus_assault`, `broken_arrow`, `chambered`, `endless_ammo`, `explosive`, `fabricate`, `field_medic`, `final_bugle`, `firepower`, `flak_jacket`, `gotw`, `halloween_mystery`, `hunted`, `inspiration`, `leadership`, `martyrdom`, `rare_potato`, `scavenger`, `scavenger_adv`, `self_revive`, `small_arms`, `splinter`, `steelskin`, `takedown`, `targeting`, `treat_12g`, `treat_556`, `treat_762`, `treat_9mm`, `treat_super`, `tree_climbing`, `trick_chatty`, `trick_drain`, `trick_m9`, `trick_nothing`, `trick_size`, `turkey_shoot`, `windwalk` [src:survev/shared/defs/gameObjects/perkDefs.ts, derived/git-9f64948d] [H]
- ping (7): `ping_airdrop`, `ping_airstrike`, `ping_coming`, `ping_danger`, `ping_help`, `ping_unlock`, `ping_woodsking` [src:survev/shared/defs/gameObjects/pingDefs.ts, derived/git-9f64948d] [H]
- puzzle (4 of 5, puzzle names in the original import): `bunker_chrys_02`, `bunker_eye_02`, `club_02`, `saloon` [src:survev/shared/defs/puzzles.ts, derived/git-9f64948d] [H]
- puzzle (5th): `bunker_eye_02_woods` is a survev-assigned key (5ec2f658, 2025-03-02) for the original Woods Eye-bunker puzzle; see the notes above [src:survev/shared/defs/puzzles.ts:3, derived/git-5ec2f658, wikigg/Eye_Bunker] [M]
- quest (24 of 25, in the original import): `quest_airdrop`, `quest_barrels`, `quest_boost`, `quest_club_kills`, `quest_crates`, `quest_damage`, `quest_damage_12gauge`, `quest_damage_556mm`, `quest_damage_762mm`, `quest_damage_9mm`, `quest_damage_grenade`, `quest_damage_hard`, `quest_damage_melee`, `quest_furniture`, `quest_heal`, `quest_kills`, `quest_kills_hard`, `quest_lockers`, `quest_pots`, `quest_survived`, `quest_toilets`, `quest_top_solo`, `quest_top_squad`, `quest_vending` [src:survev/shared/defs/gameObjects/questDefs.ts, derived/git-9f64948d] [H]
- quest (25th): `quest_top_duo` was added to survev in 2b6d1265 (2026-07-15) and is counted as original because fandom records the quest until 0.9.2 (2020-03-09); see the conflict below [src:survev/shared/defs/gameObjects/questDefs.ts:139, derived/git-2b6d1265, fandom/Changelog] [L]
- role (17): `assault`, `bugler`, `demo`, `grenadier`, `healer`, `kill_leader`, `last_man`, `leader`, `lieutenant`, `marksman`, `medic`, `recon`, `scout`, `sniper`, `tank`, `the_hunted`, `woods_king` [src:survev/shared/defs/gameObjects/roleDefs.ts, derived/git-9f64948d] [H]
- scope (5): `15xscope`, `1xscope`, `2xscope`, `4xscope`, `8xscope` [src:survev/shared/defs/gameObjects/gearDefs.ts, derived/git-9f64948d] [H]
- structure (23): `barn_basement_structure_01`, `barn_basement_structure_01d`, `bridge_lg_structure_01`, `bridge_md_structure_01`, `bridge_xlg_structure_01`, `bunker_structure_01`, `bunker_structure_01b`, `bunker_structure_01sv`, `bunker_structure_02`, `bunker_structure_03`, `bunker_structure_04`, `bunker_structure_05`, `bunker_structure_06`, `bunker_structure_07`, `bunker_structure_08`, `bunker_structure_08b`, `bunker_structure_09`, `club_structure_01`, `mansion_structure_01`, `mansion_structure_02`, `saloon_structure_01`, `statue_structure_03`, `statue_structure_04` [src:survev/shared/defs/mapObjects/structureDefs.ts, derived/git-9f64948d] [H]
- throwable (12): `bomb_iron`, `frag`, `martyr_nade`, `mirv`, `mirv_mini`, `potato_cannonball`, `potato_heavy`, `potato_smgshot`, `smoke`, `snowball`, `snowball_heavy`, `strobe` [src:survev/shared/defs/gameObjects/throwableDefs.ts, derived/git-9f64948d] [H]
- throwable+map (1): `potato` [src:survev/shared/defs/gameObjects/throwableDefs.ts, derived/git-0b3851a1] [H]
- unlock (2): `unlock_default`, `unlock_new_account` [src:survev/shared/defs/gameObjects/unlockDefs.ts, derived/git-9f64948d] [H]
- xp (14): `xp_10`, `xp_100`, `xp_25`, `xp_bone`, `xp_book_greene`, `xp_book_kuga`, `xp_book_nevelskoy`, `xp_book_parma`, `xp_book_rinzo`, `xp_book_tallow`, `xp_compass`, `xp_donut`, `xp_glasses`, `xp_stump` [src:survev/shared/defs/gameObjects/xpDefs.ts, derived/git-9f64948d] [H]

## Conflicts

- CONFLICT quest-top-duo-absent-from-client: the v0.8.82 client `questDefs` has only `quest_top_solo` and `quest_top_squad`, in both survev's import and the 2026 relaunch client [src:derived/git-9f64948d, kong/relaunch-client-defs] vs fandom recording that the "Top 8 in Duos" quest was removed in a March 2020 update and survev saying it "Added back" the quest [src:fandom/Changelog, survev/client/public/changelogRec.html:170]; proposed: treat `quest_top_duo` as original but optional, since it may have been server-side only [L]
- CONFLICT beach-original-vs-survev: the original Beach Map (v0.9.5b, 2020-06-15) had the Water Gun, Popsicle, Speedo and Ice Box [src:fandom/Beach_Map] vs survev's Beach with palms, Pirate Hut, Cutlass and Coconut [src:wikigg/Beach_mode, survev/client/public/changelogRec.html:343]; proposed: survev `beach` is `fork`, the original Beach is post-0.8.82 and not in survev [M]
- CONFLICT eggs-version: wiki.gg says eggs first appeared in Surviv v0.3.2 (April 2018) and were removed the next update [src:wikigg/Eggs] vs fandom's Egg page, which dates egg crates to v0.9.3 (2020-04-06) [src:fandom/Egg]; proposed: both events are outside v0.8.82, so `egg_01`-`egg_04` stay `fork` [M]
- CONFLICT fandom-role-pages-mixed: fandom role pages contain survev data (survev.io audio links, "AP rounds in survev.io", a Captain row marked "is assumed") [src:fandom/Grenadier, fandom/Lone_Survivr, fandom/Roles] vs their use as an original-game source; proposed: do not use fandom role tables alone for v0.8.82 role loadouts [M]
- CONFLICT twins-bunker-puzzle: the Twins bunker is original (0.8.8) [src:changelog/0.8.8] vs its current class-switch puzzle, which only arrived with the fork's 0.3.0 "twins bunker expansion" [src:derived/git-f0107b35, survev/shared/defs/puzzles.ts:20]; proposed: keep the bunker, drop the `bunker_twins` puzzle and its buttons for v0.8.82 and take the sublevel and compartment layouts from the relaunch client [src:kong/relaunch-client-defs] [M]

## Open questions

- How did the original Twins bunker (0.8.8) open before survev's puzzle and 30-second timer? The original sublevel has four `lab_door_locked_01` doors and a `control_panel_03`, which fits a timed server unlock, but the timing itself is server-side and survev's pre-fork value (circle 2 + 5 s) is a reconstruction [src:changelog/0.8.8, survev/client/public/changelogRec.html:210, kong/relaunch-client-defs, derived/git-ae55c9a8] [L]
- Does survev's 10-panel Woods Eye-bunker order (`bunker_eye_02_woods`) match the original? Only wiki.gg documents it [src:survev/shared/defs/puzzles.ts:3, wikigg/Eye_Bunker] [L]
- survev's original-era map spawns and loot tables are partly reconstructed (`?`/`!` comments), so original ids are certain but their spawn weights are not [src:survev/shared/defs/maps/baseDefs.ts:90] [M]
- The Boffy emote and Fragtastic outfit were re-drawn by survev; asset fidelity to the 2020 originals has not been checked [src:survev/client/public/changelogRec.html:166, survev/client/public/changelogRec.html:389] [L]
