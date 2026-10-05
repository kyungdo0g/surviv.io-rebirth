# Snow map ("Snow-covered Island", Winter Classic)

> survev id `snow`, built on the main map def (mapId 0). It reconstructs the December 2018 snow map (v0.6.9) on top of the 0.8.82 main map; the relaunch client (`kong/relaunch-client-defs`) has no snow map def, but it contains the snow-map assets (`map-plane-01x`, `map-chute-01x`, `plane_02`, `bells_01`, `falling_snow_fast`, the `*x` obstacles and buildings).
> "orig" spawn/loot values come from survev's pre-fork snapshot `ae55c9a8` (`derived/git-ae55c9a8`). survev's fork reworked the mode in "Winter + Beach Update" 0.2.0 (2025-12-30) and 0.2.2 (balance.txt lines 200-246).
> The January 2020 "Stay frosty" remake (footprints, idle freeze, flask, Polar Bear, Snow Fox, slippery ice) is post-0.8.82 and is not in survev.

## Identity

- survev registers `snow: Snow`; the def sets no mapId, so it uses `MapId.Main` (0) and `desc.name` "Normal" from Main [src:survev/shared/defs/mapDefs.ts:51, survev/shared/defs/maps/snowDefs.ts:6-11, survev/shared/defs/maps/snowDefs.ts:298] [H]
- survev gives it a snowball play-button icon `img/loot/loot-throwable-snowball.svg`, buttonCss `btn-mode-snow` and splash `snow.webp`; the pre-fork def had an empty icon and buttonCss (fork) [src:survev/shared/defs/maps/snowDefs.ts:7-11, derived/git-ae55c9a8] [H]
- fandom: the Snow Map and the Main Summer map are the only maps that do not specialise the play button [src:fandom/Main_Summer_Map] [M]
- The snow map was "originally coded into all the game modes": it turned the grass white, added the snow tree and snow decals to all obstacles and buildings [src:fandom/Snow_Map] [M]
- 0.7.9 renamed the internal Snow map name to "Normal Map" [src:fandom/Changelog] [M]
- Names: fandom "Snow Map" (unofficially "Winter Map"); survev.wiki.gg "Winter Classic mode" [src:fandom/Maps, wikigg/Classic_mode] [H]
- Korean community name: 겨울 이벤트 (SNOWBALL EFFECT) [src:namu/Surviv.io/이벤트] [M]

## Dates and versions

| event | start | end | queue | notes | src |
|---|---|---|---|---|---|
| Snow-covered Island | 0.6.9, Dec 19, 2018 | Jan 1, 2019 ("The snow drifts no more") | all queues | snowball crate, festive tree, snowball, OTs-38 (gold airdrops), Tallow's Little Helper, Siberian Assault, Katana Rusted | [src:changelog/0.6.9, fandom/Changelog] [H] |
| What's cooking? | 0.6.91, Dec 26, 2018 | – | – | frags, smokes and MIRVs spawn normally again on the snow map; grenade crates spawn; snowball crate now 3 stacks of 4 snowballs | [src:changelog/0.6.91, fandom/Changelog] [H] |
| Stay frosty (post-0.8.82) | Jan 13, 2020 | Jan 22, 2020 | – | remade map (lighter beach/riverbank, ice), footprints, idle freeze, flask, Polar Bear, Snow Fox, PKM/Hawk 12G on woods | [src:fandom/Changelog, fandom/Snow_Map] [M] |
| Winter Update (post-0.8.82) | v1.2c, Dec 21, 2020 | early Jan 2021 | all Classic queues | "Winter Classic" | [src:fandom/Changelog, fandom/Snow_Map] [M] |

- namu.wiki: the winter event started on Dec 19, 2018 and ran comparatively long [src:namu/Surviv.io/이벤트] [M]
- The woods-snow event (Jan 10–14, 2019) reused the snow look on the woods map; see `modes/woods.md` [src:changelog/0.6.95, fandom/Changelog] [H]
- An early snow look existed in winter 2017 (white ground, decorated trees) during development [src:fandom/Snow_Map, fandom/Removed_Features] [M]

## Size and terrain

- Snow overrides no map size or river parameters: 720 × 720 (solo/duo) or 768 × 768 (squad), shore inset 48, the same rivers and place names as main [src:survev/shared/defs/maps/snowDefs.ts:204-294, survev/shared/defs/maps/baseDefs.ts:813-872] [H]
- Large bridges use the snow deck `bridge_lg_01x` [src:survev/shared/defs/maps/snowDefs.ts:277] [H]

## Biome, audio, visuals

| field | value | src |
|---|---|---|
| background | 0x093639 (dark blue-black) | [src:survev/shared/defs/maps/snowDefs.ts:24, fandom/Snow_Map] [H] |
| water / waterRipple | 0x0c4d51 / 0xb3f0ff | [src:survev/shared/defs/maps/snowDefs.ts:25-26, fandom/Snow_Map] [H] |
| beach / riverbank | 0xcdb35b / 0x905e24 (main values) | [src:survev/shared/defs/maps/snowDefs.ts:27-28, fandom/Snow_Map] [H] |
| grass (snow) | 0xbdbdbd | [src:survev/shared/defs/maps/snowDefs.ts:29, fandom/Snow_Map] [H] |
| underground / playerSubmerge | 0x1b0d03 / 0x2b8ca4 | [src:survev/shared/defs/maps/snowDefs.ts:30-31, fandom/Snow_Map] [H] |
| playerGhillie | 0xbbbbbb, with a survev comment that "surviv never had a snow color for the ghillie" | [src:survev/shared/defs/maps/snowDefs.ts:32] [M] |
| camera particles | `falling_snow_fast` | [src:survev/shared/defs/maps/snowDefs.ts:34] [H] |
| airdrop plane / sound / chute | `map-plane-01x.img` / `plane_02` / `map-chute-01x.img` | [src:survev/shared/defs/maps/snowDefs.ts:35-39, kong/relaunch-client-defs] [H] |

- These are the fandom "2018" tab colours; the fandom "2020" tab (Stay frosty) has water 0x9be2ff, beach and riverbank 0xa1bdc9 and ghillie 0xc1c1c1 (post-0.8.82) [src:fandom/Snow_Map] [M]
- The fandom 2018 infobox also lists a 7.62mm tracer override (0x96a1e6 / 0xabc4ff, alpha rate 0.96, min 0.4), which survev applies only to `woods_snow`, not to `snow` [src:fandom/Snow_Map, survev/shared/defs/maps/woodsSnowDefs.ts:32-39, survev/shared/defs/maps/snowDefs.ts:22-40] [M]
- Audio preload: `snowball_01`, `snowball_02` (sfx), `plane_02` (sfx), `bells_01` (ui), `snowball_pickup_01` (ui) [src:survev/shared/defs/maps/snowDefs.ts:13-19] [H]
- Atlases: loadout, shared, snow (the snow atlas replaces main's) [src:survev/shared/defs/maps/snowDefs.ts:20] [H]
- The pre-fork def listed `frozenSprites` `player-snow-01..03` for frozen (snowball-hit) players; survev now derives frozen sprites from the explosion def (fork refactor) [src:derived/git-ae55c9a8, survev/shared/defs/maps/snowDefs.ts:22-40] [M]
- The menu/victory music stays `menu_music_01` (ambience inherited from main) [src:survev/shared/defs/maps/baseDefs.ts:48-53] [M]

## Game mode and rules

- `gameMode` is Main's (80 players, kill leader on); there is no `snowMode` flag; snowballs work through their explosion defs on any map [src:survev/shared/defs/maps/baseDefs.ts:62-65, survev/shared/defs/maps/snowDefs.ts:6-41] [H]
- Four airdrops instead of two: circle 0 + 10 s, circle 1 + 10 s, circle 2 + 6 s, circle 3 + 2 s [src:survev/shared/defs/maps/snowDefs.ts:43-65] [H]
- With gas waits of 80/65/50/40 s these fall at 1:10 (10 s into the game), 0:55, 0:44 and 0:38, exactly the fandom schedule [src:survev/server/src/game/objects/gas.ts:21-62, fandom/Snow_Map] [H]
- Airdrop crates: `airdrop_crate_01x` 10 : `airdrop_crate_02x` 1 (snow skins, open into `crate_10` / `crate_11`) [src:survev/shared/defs/maps/snowDefs.ts:66-69, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1190-1206, kong/relaunch-client-defs] [H]
- Snowballs (0.6.9): a hit deals a little damage, slows the target briefly and makes it drop a random item; a "cooked" snowball becomes a heavy snowball with more damage and a longer slow [src:fandom/Changelog, changelog/0.6.9] [H]
- Original snowball damage 2 and heavy snowball 5 (after 0.6.95 lowered them from 4 / 12); survev raised them to 6 / 28 and throw speed 40 → 52 (fork) [src:balance/120, balance/124, balance/121, fandom/Changelog, kong/relaunch-client-defs] [H]
- 0.6.91 fixed snowball hits interrupting healing and snowballs dealing no damage [src:changelog/0.6.91] [H]
- The OTs-38 revolver (0.6.9) was only in gold airdrops at launch [src:fandom/Changelog] [M]
- Strategy notes (fandom): Arctic Avenger is the best camouflage; most tracers are harder to see on white ground [src:fandom/Snow_Map] [M]

## Spawns

### Fixed spawns (s = solo/duo, l = squad)

| id | building / object | survev | orig (pre-fork) | src |
|---|---|---|---|---|
| `warehouse_01x` | Warehouse (snow) | 1 / 2 | 2 (`warehouse_01` replaced by `warehouse_01x`) | [src:survev/shared/defs/maps/snowDefs.ts:232, balance/214, derived/git-ae55c9a8] [H] |
| `warehouse_03x` | Alternate Warehouse (snow, fork) | 1 | absent | [src:survev/shared/defs/maps/snowDefs.ts:233, balance/213] [H] |
| `house_red_01x` / `house_red_02x` | Red House / Second Red House (snow) | 3/4 each | 3/4 each (via replacement) | [src:survev/shared/defs/maps/snowDefs.ts:234-235, derived/git-ae55c9a8] [H] |
| `barn_01x` | Barn (snow) | 1/3 | 1/3 | [src:survev/shared/defs/maps/snowDefs.ts:236] [H] |
| `barn_02x` | Alternate Barn (snow, fork id) | 1 | `barn_02` 1 (no snow skin) | [src:survev/shared/defs/maps/snowDefs.ts:237, derived/git-ae55c9a8] [M] |
| `hut_01x` / `hut_02x` / `hut_03` | Hut / Golden Hut (snow) / Scout Hut | 3 / 1 / 1 | 3 / 1 / 1 | [src:survev/shared/defs/maps/snowDefs.ts:238-240] [H] |
| `shack_03a` / `shack_03x` | Fisherman's Shack (bridge) / snow coastal shack | 2 / 2-3 | 2 / 2-3 (`shack_03b`) | [src:survev/shared/defs/maps/snowDefs.ts:241-242, derived/git-ae55c9a8] [M] |
| `greenhouse_02` | aged Greenhouse | 1 | 1 (`greenhouse_01` replaced) | [src:survev/shared/defs/maps/snowDefs.ts:243, derived/git-ae55c9a8] [H] |
| `cache_01x` / `cache_02x` | stone cache / Mosin tree (snow skins) | 1 / 1 | `cache_01` / `cache_02` | [src:survev/shared/defs/maps/snowDefs.ts:244-245, derived/git-ae55c9a8] [M] |
| `cache_04` | river stone cache (fork) | 1 | absent | [src:survev/shared/defs/maps/snowDefs.ts:246, derived/git-ae55c9a8] [H] |
| `cache_07` | barrel cache | 1 | 1 | [src:survev/shared/defs/maps/snowDefs.ts:247] [H] |
| `bunker_structure_01`–`05` | Egg (p 0.05), Hydra, Storm, Conch, Crossing | as main | as main | [src:survev/shared/defs/maps/snowDefs.ts:248-252] [H] |
| `warehouse_complex_01` | Docks | 1 | 1 | [src:survev/shared/defs/maps/snowDefs.ts:253] [H] |
| `chest_01` / `chest_03x` | Treasure Chest / River Chest (snow) | 1 / p 0.2 | 1 / p 0.2 | [src:survev/shared/defs/maps/snowDefs.ts:254-255] [H] |
| `mil_crate_03` | OTs-38 crate (dual OTs-38; survev adds Siberian Assault) | p 0.25 | p 0.25 (`mil_crate_02` replaced) | [src:survev/shared/defs/maps/snowDefs.ts:256, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1445-1453, kong/relaunch-client-defs] [H] |
| `tree_02` | wood-axe stump | 3 | 3 | [src:survev/shared/defs/maps/snowDefs.ts:257] [H] |
| `teahouse_complex_01x` | Teahouse Complex (snow, fork) | 1/2 | `teahouse_complex_01su` 1/2 | [src:survev/shared/defs/maps/snowDefs.ts:258-261, derived/git-ae55c9a8] [H] |
| `stone_04x` | Hardstone Block (iced, fork id) | 3 | 1 (`stone_04`) | [src:survev/shared/defs/maps/snowDefs.ts:262, balance/201] [H] |
| `camp_01` | Camp (campfire, crates, snowball crate, stump; fork) | 2/3 | absent | [src:survev/shared/defs/maps/snowDefs.ts:263-266, balance/228, wikigg/Classic_mode] [H] |
| `club_complex_01` | Crimson Ring Club (location spawn inherited from main) | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:879-886, derived/git-ae55c9a8] [M] |

- survev: 2 of `mansion_structure_01x`, `police_01x`, `bank_01x` (fork snow mansion structure) [src:survev/shared/defs/maps/snowDefs.ts:269-274] [H]
- The pre-fork snow def had `randomSpawns: []` (no bank, police station or mansion at all), while the fandom 2018 infobox lists bank, police station, mansion, hydra bunker, docks and greenhouse as special buildings [src:derived/git-ae55c9a8, fandom/Snow_Map] [M]
- Random building rotation only arrived in 0.7.7 (May 2019), so the December 2018 snow map spawned all of bank, police station and mansion [src:changelog/0.7.7, changelog/0.6.9] [M]

### Density spawns

| id | object | survev | orig | src |
|---|---|---|---|---|
| `stone_01x` | snow stone | 350 | 350 | [src:survev/shared/defs/maps/snowDefs.ts:207] [H] |
| `barrel_01` / `silo_01` | barrel / silo | 76 / 8 | same | [src:survev/shared/defs/maps/snowDefs.ts:208-209] [H] |
| `crate_01x` / `crate_02x` | crate / Soviet crate (snow) | 38 / 4 | 38 / 4 (via replacement) | [src:survev/shared/defs/maps/snowDefs.ts:210-211, derived/git-ae55c9a8] [H] |
| `crate_03` | grenade crate | 8 | 8 | [src:survev/shared/defs/maps/snowDefs.ts:212] [H] |
| `crate_03x` | Snowball Crate (3 × 4 snowballs) | 1 | 1 | [src:survev/shared/defs/maps/snowDefs.ts:213, kong/relaunch-client-defs] [H] |
| `bush_01x` | snow bush | 78 | 78 | [src:survev/shared/defs/maps/snowDefs.ts:214] [H] |
| `cache_06` | berry bush cache | 12 | 12 | [src:survev/shared/defs/maps/snowDefs.ts:215] [H] |
| `tree_10` / `tree_11` | snow tree / tree_11 | 300 / 20 (fork split) | 320 × `tree_01` → `tree_10` | [src:survev/shared/defs/maps/snowDefs.ts:216-217, survev/shared/defs/maps/snowDefs.ts:290, derived/git-ae55c9a8] [H] |
| `hedgehog_01` | hedgehog | 24 | 24 | [src:survev/shared/defs/maps/snowDefs.ts:218] [H] |
| `container_01x`, `container_02`–`04` | containers | 5 each | 5 each | [src:survev/shared/defs/maps/snowDefs.ts:219-222] [H] |
| `shack_01x` / `outhouse_01x` | shack / outhouse (snow) | 7 / 5 | 7 / 5 | [src:survev/shared/defs/maps/snowDefs.ts:223-224] [H] |
| `loot_tier_1` / `loot_tier_beach` | ground loot | 24 / 4 | 24 / 4 | [src:survev/shared/defs/maps/snowDefs.ts:225-226] [H] |

- Spawn replacements: bridge, berry bush (`bush_07` → `bush_07x`, the wreath bush), cabin, container, crates, mil crate, shacks, stone_03, tables (`table_01x`–`03x`), `tree_01` → `tree_10`, blue warehouse → snow skins [src:survev/shared/defs/maps/snowDefs.ts:275-293] [H]
- fandom: the table had a cookie and a glass of milk on the 2018 map (removed in Stay frosty) [src:fandom/Snow_Map] [M]
- The Festive Tree (snow map only) is a tree with loot under it that spawns as part of red houses, barns and the mansion; fandom gives its id as `tree_11b` [src:fandom/Festive_Tree, changelog/0.6.9] [M]
- fandom: the teahouse is the only place with green grass on the snow map (its grass is part of the structure) [src:fandom/Snow_Map] [M]
- Snowball crates (`crate_03x`): 100 HP; fandom says they are about as common as grenade crates on the normal map and gives a quantity of 35 (see Conflicts) [src:fandom/Snowball_Crate, kong/relaunch-client-defs] [L]

## Loot overrides

| tier | survev | original difference | src |
|---|---|---|---|
| `tier_throwables` | frag ×2 1, smoke 1, MIRV ×2 0.05, snowball ×5 1 | snowball weight 0.5 | [src:survev/shared/defs/maps/snowDefs.ts:77-82, balance/208] [H] |
| `tier_airdrop_throwables` | frag ×2 1, MIRV ×2 0.5, snowball ×10 0.5 | same | [src:survev/shared/defs/maps/snowDefs.ts:174-178] [H] |
| `tier_airdrop_outfits` | nothing 3, Tallow's Little Helper (`outfitElf`) 1 | same | [src:survev/shared/defs/maps/snowDefs.ts:73-76] [H] |
| `tier_guns`, `tier_chest`, `tier_airdrop_uncommon`, `tier_sv98` | main tables with SV-98 swapped for the fork winter skin `sv98_winter` | plain `sv98` | [src:survev/shared/defs/maps/snowDefs.ts:83-164, derived/git-ae55c9a8] [H] |
| `tier_airdrop_rare` | AWM-S as fork skin `awc_winter` 3, Garand 6, M4A1-S 4, CZ-3A1 5, dual OTs-38 4.5, M249 0.1, PKP 0.08 | plain `awc` 3 | [src:survev/shared/defs/maps/snowDefs.ts:165-173, derived/git-ae55c9a8] [H] |
| `tier_barn_melee` | ice axe (fork) | sledgehammer (`tier_sledgehammer`) | [src:survev/shared/defs/maps/snowDefs.ts:143, balance/205] [H] |
| `tier_airdrop_melee` | nothing 18, ice axe 1, pan 1 | nothing 19, pan 1 | [src:survev/shared/defs/maps/snowDefs.ts:144-148, balance/206, balance/207] [H] |
| `tier_eye_block` (hardstone block) | dual OTs-38 1.5, flare gun 1.5, SVD (winter) 1.5, SCAR 1.5, M9 1, 7.62mm 1, snowball 1, SV-98 (winter) 1, AWM-S (winter) 0.75, PKP 0.75 | base table: M9, dual OTs-38, flare gun, Peacemaker, .45 ACP, pills, M4A1-S, M249, AWM-S, PKP at 1 each | [src:survev/shared/defs/maps/snowDefs.ts:179-190, balance/202, balance/203, balance/204] [H] |
| `tier_crow_case_melee` | crowbar 3, ice axe 1 (fork construction case) | fork | [src:survev/shared/defs/maps/snowDefs.ts:191-194] [H] |
| `tier_outfits` | Cobalt Shell 0.3, Woodland 0.3, Black Ice 0.2, Camo 0.15, Snowed Over 0.15, Ghillie 0.01 | main table (Cobalt Shell 0.2, Key Lime 0.15, Woodland 0.1, Camo 0.1, Ghillie 0.01) | [src:survev/shared/defs/maps/snowDefs.ts:195-202, balance/233, derived/git-ae55c9a8] [H] |

- The original snow map had a white-reskinned AWM-S held sprite (0.6.9), reverted on Jan 1, 2019; survev models this as the separate fork gun id `awc_winter` [src:fandom/Changelog, fandom/Snow_Map, kong/relaunch-client-defs] [M]
- `sv98_winter`, `svd_winter`, `awc_winter`, the ice axe, Black Ice and Snowed Over are survev ids that the 0.8.82 client does not have (fork) [src:kong/relaunch-client-defs, survev/shared/defs/maps/snowDefs.ts:83-202] [H]
- At launch (0.6.9) frags, smokes and MIRVs did not spawn normally on the snow map; 0.6.91 restored them [src:fandom/Changelog] [M]
- Korean names: 스노우볼 (snowball), 탈로우의 작은 조력자 (Tallow's Little Helper), 시베리안 어설트 (Siberian Assault), OTs-38 [src:l10n/ko:game-snowball, l10n/ko:game-outfitElf, l10n/ko:game-outfitSpetsnaz, l10n/ko:game-ots38] [H]

## Perks

- No perks spawn on the 2018 snow map; Polar Bear and Snow Fox arrived with Stay frosty in January 2020 (post-0.8.82) [src:fandom/Changelog, survev/shared/defs/maps/snowDefs.ts:72-203] [M]

## Trivia

- The Snow Map was hinted by the Saloon's recorder [src:fandom/Maps] [M]
- The Arctic Avenger crate exists but stopped giving the skin once it joined Survivr Pass 1 [src:fandom/Snow_Map] [M]
- Winter Classic (survev.wiki.gg): airdrops change appearance "to match a Christmas like vibe"; the Camp is exclusive to it (fork) [src:wikigg/Classic_mode] [M]

## Conflicts

- CONFLICT snow-random-buildings: 2 of snow mansion/police/bank [src:survev/shared/defs/maps/snowDefs.ts:269-274] vs none [src:derived/git-ae55c9a8] vs all three on the 2018 map [src:fandom/Snow_Map, changelog/0.7.7]; proposed: 2-of-3 rotation as on the 0.8.82 main map, config knob for all three [L]
- CONFLICT snow-tracer-762: no tracer override [src:survev/shared/defs/maps/snowDefs.ts:22-40] vs 7.62mm tracers 0x96a1e6 / 0xabc4ff [src:fandom/Snow_Map]; proposed: add the woods_snow tracer override to snow [M]
- CONFLICT snowball-crate-count: `crate_03x` density 1 (≈2 per map) [src:survev/shared/defs/maps/snowDefs.ts:213, derived/git-ae55c9a8] vs quantity 35, "as common as a grenade box" [src:fandom/Snowball_Crate]; proposed: raise to grenade-crate density 8 as a config knob [L]
- CONFLICT snow-hardstone-count: 3 iced `stone_04x` [src:survev/shared/defs/maps/snowDefs.ts:262] vs 1 `stone_04` [src:balance/201, derived/git-ae55c9a8]; proposed: 1 [H]
- CONFLICT snow-tree-id: `tree_10` replaces normal trees [src:survev/shared/defs/maps/snowDefs.ts:290] vs a `tree_01x` snowy tree also present in the original client [src:kong/relaunch-client-defs]; proposed: keep `tree_10`, open question [L]

## Open questions

- Which snow tree (`tree_01x` or `tree_10`) the December 2018 map used, and whether `tree_11` was spawned outside structures [src:kong/relaunch-client-defs, fandom/Festive_Tree] [L]
- The exact original snowball crate density and festive-tree placement [src:fandom/Snowball_Crate, fandom/Festive_Tree] [L]
- Whether the 2018 snow map spawned the alternate barn, teahouse complex or club at all (all three post-date it; survev adds them via the 0.8.82 main def) [src:changelog/0.7.3, changelog/0.7.7, survev/shared/defs/maps/snowDefs.ts:237-261] [L]
