# Woods map (autumn) and its Snow, Spring and Summer variants

> survev ids `woods`, `woods_snow`, `woods_spring`, `woods_summer`; all on mapId 2 (`woodsMode`). The 2026 relaunch bundle (`kong/relaunch-client-defs`) holds one woods def (mapId 2) for 0.8.82: autumn colours plus the King-of-the-Woods sounds.
> "orig" spawn/loot values come from survev's pre-fork snapshot `ae55c9a8` (`derived/git-ae55c9a8`). The survev woods loot tables were rebalanced heavily by the fork's 0.2.2 "Woods Update" (2026-03-09); `balance.txt` lines 226-257 list the changes.
> Logging complexes, the pavilion and the workshop are detailed in `maps/buildings.md`; the Woods eye-bunker code in `maps/puzzles.md`; Woods King perks in `items/perks.md` and `items/roles.md`.

## Identity

- `MapId.Woods = 2`; `woods_snow`, `woods_spring` and `woods_summer` merge their overrides onto `Woods`, so all four share mapId 2 and `woodsMode: true` [src:survev/shared/gameConfig.ts:100, survev/shared/defs/maps/woodsDefs.ts:8, survev/shared/defs/maps/woodsSnowDefs.ts:146, survev/shared/defs/maps/woodsSpringDefs.ts:124, survev/shared/defs/maps/woodsSummerDefs.ts:71] [H]
- `desc`: name "Woods", icon `img/gui/player-king-woods.svg` (Woods King crown), buttonCss `btn-mode-woods`, same as the 0.8.82 client [src:survev/shared/defs/maps/woodsDefs.ts:9-13, kong/relaunch-client-defs] [H]
- The woods play icon was a hatchet until 0.7.5 "Hunt or be hunted" changed it to the king icon [src:wikigg/Woods_mode] [M]
- 0.7.41 renamed the Woods Snow map and gave it a snowball event icon instead of the axe; survev's `woods_snow` keeps the woods crown icon [src:fandom/Changelog, survev/shared/defs/maps/woodsSnowDefs.ts:6-18] [M]
- survev's `woods_spring` uses buttonCss `btn-woods-spring-mode` [src:survev/shared/defs/maps/woodsSpringDefs.ts:8-10] [H]
- The map was called the "Autumn Map" in code until 0.7.0 renamed it to Woods; 0.7.9 renamed the Woods Snow and Woods Spring maps to "Woods Map" internally [src:fandom/Changelog, fandom/Maps] [M]
- Splash: survev woods inherits `img/splashes/main.webp` (fork field) [src:survev/shared/defs/maps/baseDefs.ts:19, kong/relaunch-client-defs] [H]
- Korean community names: 숲 이벤트 (Into the Woods), 숲과 눈 이벤트 (Into the Woods and Snow!), 숲의 왕 (King of the Woods) [src:namu/Surviv.io/이벤트] [M]

## Dates and versions (up to 0.8.82)

| event | map def | start | end | queue | notes | src |
|---|---|---|---|---|---|---|
| Into the woods | woods (autumn) | 0.6.3, Oct 18, 2018 | Oct 22, 2018 | squad only | hatchet bunker, hatchet crate, flare gun case, leaf pile, log pile, stump, Woodcutter's Wrap, BAR M1918, USAS-12, MIRV, fire axe; LMGs and shotguns only | [src:changelog/0.6.3, fandom/Changelog] [H] |
| If a bunker opens in a forest ... | woods | 0.6.71, Dec 6, 2018 | Dec 10, 2018 | squad only | hardstone block, stone hammer, Valiant Pineapple, Tarkhany Regal; eye bunker added to the autumn map | [src:changelog/0.6.71, fandom/Changelog] [H] |
| Two survivrs walk into a BAR | woods_snow | 0.6.95, Jan 10, 2019 | Jan 14, 2019 | duo only | autumn map recoloured like the snow map, structures replaced by snow variants, snowballs in loot | [src:changelog/0.6.95, fandom/Changelog] [H] |
| Hunt or be hunted (King of the Woods) | woods_spring | 0.7.5, Apr 15, 2019 | Apr 22, 2019 | solo, squad from Apr 19 | lake + pavilion, Shishigami no Kabuto, Woods King, PKP Pecheneg | [src:changelog/0.7.5, fandom/Changelog] [H] |
| Take the throne | woods_summer | Jul 7, 2019 | Jul 14, 2019 | solo and squad | summer reskin, Verdant Ghillie | [src:fandom/Changelog] [M] |
| Splinter shell | woods | 0.8.1, Aug 21, 2019 | Aug 27, 2019 | solo, switched to squad | fewer trees, extra clearings, Marksman Helmet (Woods) with Splinter Rounds, savannah patches | [src:changelog/0.8.1, fandom/Changelog] [H] |
| Knuckle down | woods | Oct 14, 2019 | Oct 18, 2019 | – | alternate barn removed from woods | [src:fandom/Changelog] [M] |
| Dodge This (post-0.8.82) | woods | Jan 27, 2020 | Feb 10, 2020 | – | PKM, Hawk 12G | [src:fandom/Changelog] [M] |

- 0.6.31 "All the leaves aren't brown" ended the first woods event and moved BAR and MIRV into the normal map [src:changelog/0.6.31, fandom/Changelog] [H]
- 0.8.2 added savannah patches and a second (old) Marksman Helmet to woods; 0.8.3 removed the patches and 0.8.4 the old marksman helmet [src:wikigg/Woods_mode, fandom/Changelog] [M]
- namu.wiki gives King of the Woods dates Apr 15, 2019, Jul 7, 2019, Jan 29, 2020 and May 29, 2020 (the last two post-0.8.82) [src:namu/Surviv.io/이벤트] [M]

## Size and terrain

| field | value | src |
|---|---|---|
| scale small / large | 1.1875 / 1.21875 → 720 × 720 (solo/duo), 736 × 736 (squad) | [src:survev/shared/defs/maps/woodsDefs.ts:164, survev/server/src/game/map.ts:283-287, derived/512x1.21875+112] [H] |
| shoreInset / grassInset | 8 / 12; with a 40-unit narrower shore than main the grass island is larger ("the Island is notably larger") | [src:survev/shared/defs/maps/woodsDefs.ts:165-166, survev/shared/defs/maps/baseDefs.ts:818, fandom/Woods_Map] [H] |
| river width sets | 0.1:[4], 0.15:[8], 0.25:[8,4], 0.21:[8], 0.09:[8,8], 0.2:[8,8,4], 0.0001:[8,8,8,6,4]; smoothness 0.45 | [src:survev/shared/defs/maps/woodsDefs.ts:180-192] [H] |
| lake | always (odds 1): inner r32, outer r96, centred within r100 of the map centre; pavilion island `teapavilion_01w` in the middle | [src:survev/shared/defs/maps/woodsDefs.ts:168-179, fandom/Pavilion] [H] |
| lake centre object | survev places `teapavilion_01w` as the lake `centerObj`; the pre-fork def spawned it as a fixed spawn | [src:survev/shared/defs/maps/woodsDefs.ts:173, derived/git-ae55c9a8] [M] |
| place spawns | none in survev ("place spawns create river masks that can block the lake") ; pre-fork inherited main's 4 | [src:survev/shared/defs/maps/woodsDefs.ts:205-208, derived/git-ae55c9a8] [M] |
| place names | inherited from main (The Killpit, Sweatbath, ...) | [src:survev/shared/defs/maps/baseDefs.ts:839-872, wikigg/Woods_mode] [H] |

- The lake first appeared in the Woods Spring map (0.7.5); fandom says it has no bridges [src:fandom/Woods_Map, changelog/0.7.5] [M]

## Biome and audio

| field | woods (autumn) | woods_snow | woods_spring | woods_summer | src |
|---|---|---|---|---|---|
| background | 0x20536e | 0x093639 | 0x20536e | 0x20536e | [src:survev/shared/defs/maps/woodsDefs.ts:25, survev/shared/defs/maps/woodsSnowDefs.ts:21, survev/shared/defs/maps/woodsSpringDefs.ts:27, survev/shared/defs/maps/woodsSummerDefs.ts:10] [H] |
| water | 0x3282ab | 0x0c4d51 | 0x3282ab | 0x3282ab | [src:survev/shared/defs/maps/woodsDefs.ts:26, survev/shared/defs/maps/woodsSnowDefs.ts:22] [H] |
| beach | 0xefb35b | 0xcdb35b | 0xefb35b | 0xdc9e28 | [src:survev/shared/defs/maps/woodsDefs.ts:28, survev/shared/defs/maps/woodsSnowDefs.ts:24, survev/shared/defs/maps/woodsSpringDefs.ts:30, survev/shared/defs/maps/woodsSummerDefs.ts:13] [H] |
| riverbank | 0x77360b | 0x905e24 | 0x8a8a8a | 0xa37119 | [src:survev/shared/defs/maps/woodsDefs.ts:29, survev/shared/defs/maps/woodsSnowDefs.ts:25, survev/shared/defs/maps/woodsSpringDefs.ts:31, survev/shared/defs/maps/woodsSummerDefs.ts:14] [H] |
| grass | 0x8e832a (yellow-brown) | 0xbdbdbd (snow) | 0x426609 | 0x629522 | [src:survev/shared/defs/maps/woodsDefs.ts:30, survev/shared/defs/maps/woodsSnowDefs.ts:26, survev/shared/defs/maps/woodsSpringDefs.ts:32, survev/shared/defs/maps/woodsSummerDefs.ts:15] [H] |
| playerGhillie | 0x91852c | 0xbbbbbb (fork; pre-fork 0x83af50) | 0x41630a | 0x659825 | [src:survev/shared/defs/maps/woodsDefs.ts:33, survev/shared/defs/maps/woodsSnowDefs.ts:29, derived/git-ae55c9a8, survev/shared/defs/maps/woodsSpringDefs.ts:35, survev/shared/defs/maps/woodsSummerDefs.ts:18] [H] |
| camera particles | `falling_leaf` | `falling_snow_slow` | `falling_leaf_spring` | `falling_leaf_summer` | [src:survev/shared/defs/maps/woodsDefs.ts:35, survev/shared/defs/maps/woodsSnowDefs.ts:31, survev/shared/defs/maps/woodsSpringDefs.ts:38, survev/shared/defs/maps/woodsSummerDefs.ts:20] [H] |
| river shore sound | sand | sand | stone | sand | [src:survev/shared/defs/maps/woodsSpringDefs.ts:37, survev/shared/defs/maps/baseDefs.ts:47] [H] |

- The autumn colours (and particles `falling_leaf`) are identical in the 0.8.82 client's woods def [src:kong/relaunch-client-defs, survev/shared/defs/maps/woodsDefs.ts:24-35] [H]
- The fandom infoboxes give the same tints for all four variants (e.g. woods snow background 603705 = 0x093639, spring grass 4351497 = 0x426609, summer ghillie 6658085 = 0x659825) [src:fandom/Woods_Map] [H]
- Woods Snow tracer override: 7.62mm tracers regular 0x96a1e6, saturated 0xabc4ff, alphaRate 0.96, alphaMin 0.4 (visible on white ground) [src:survev/shared/defs/maps/woodsSnowDefs.ts:32-39, fandom/Woods_Map] [H]
- Logging Complex 01 ground tints (fandom): autumn 0x4f4810 / 0x5b5a0b, spring 0x334a0e / 0x253210, summer 0x77ad32 / 0x4e7d13 [src:fandom/Logging_Complex] [M]
- 0.8.82 woods audio preload: `vault_change_02`, `log_01`, `log_02` (sfx), `helmet03_forest_pickup_01` (ui), `ability_stim_01` (sfx, Windwalk), `leader_dead_01` (ui) [src:kong/relaunch-client-defs] [H]
- survev woods audio: `vault_change_02`, `footstep_08`, `footstep_09`, `helmet03_forest_pickup_01`; only `woods_spring` adds `ability_stim_01` and `leader_dead_01`; woods_snow adds `snowball_01`, `snowball_02`, `snowball_pickup_01` [src:survev/shared/defs/maps/woodsDefs.ts:15-20, survev/shared/defs/maps/woodsSpringDefs.ts:12-22, survev/shared/defs/maps/woodsSnowDefs.ts:8-16] [H]
- Woods King sounds per fandom: Windwalk `ability_stim_01`, kill `helmet03_forest_pickup_01`, death `leader_dead_01` [src:fandom/Woods_King, survev/shared/defs/gameObjects/roleDefs.ts:425] [H]
- Atlases: loadout, shared, woods (original adds `gradient`; pre-fork woods_snow also loaded `snow`) [src:survev/shared/defs/maps/woodsDefs.ts:21, kong/relaunch-client-defs, derived/git-ae55c9a8] [H]
- Airdrop plane and chute are the normal ones on all woods variants (woods_snow does not use the snow-map sleigh plane) [src:survev/shared/defs/maps/baseDefs.ts:56-60, survev/shared/defs/maps/woodsSnowDefs.ts:19-40] [H]

## Game mode and rules

- `gameMode: { maxPlayers: 80, woodsMode: true }`, kill leader enabled [src:survev/shared/defs/maps/woodsDefs.ts:37, kong/relaunch-client-defs] [H]
- `woodsMode` changes the Eye bunker code: the server swaps puzzle `bunker_eye_02` for `bunker_eye_02_woods` (10 recorder panels) [src:survev/server/src/game/objects/building.ts:447-449, survev/shared/defs/puzzles.ts:2-14] [H]
- Eye-bunker recorders are replaced by the woods recorders (`recorder_01` → `recorder_08`, `recorder_02` → `recorder_09`) on all woods variants [src:survev/shared/defs/maps/woodsDefs.ts:261-263, survev/shared/defs/maps/woodsSpringDefs.ts:115-116] [H]
- fandom trivia: when the spring variant was added the `woodsMode` tag was put on woods and woods spring but not on woods snow, later fixed [src:fandom/Woods_Map] [M]
- Only LMGs and shotguns spawn naturally ("Only LMGs and shotguns will spawn in woods mode"); other guns only from hardstone blocks, caches and airdrops [src:fandom/Changelog, fandom/Woods_Map, wikigg/Woods_mode] [H]
- Increased frag and smoke capacity: woods bag sizes 6/12/15/18 per backpack level versus 3/6/9/12 normally (0.6.95 note: "maybe a bug") [src:fandom/Woods_Map, fandom/Changelog, survev/shared/gameConfig.ts:424-425] [H]
- survev woods bagSizes frag/smoke = [6, 12, 15, 18, 20]; the 5th entry is for the fork backpack04, the pre-fork value was [6, 12, 15, 18] [src:survev/shared/defs/maps/woodsDefs.ts:59-62, derived/git-ae55c9a8] [H]
- Airdrops: circle 1 + 10 s and circle 3 + 2 s, crates `airdrop_crate_01` 10 : `airdrop_crate_02` 1 [src:survev/shared/defs/maps/woodsDefs.ts:40-57] [H]

### The Woods King

- Picking up `helmet03_forest` (Shishigami no Kabuto, a level-3 helmet) from the pavilion assigns role `woods_king` [src:survev/shared/defs/gameObjects/gearDefs.ts:684-685, fandom/Woods_King] [H]
- Role `woods_king`: perks `gotw` (Gift of the Woods) and `windwalk`; kill feed on death in colour #12ff00; death sound `leader_dead_01`; not announced on assignment [src:survev/shared/defs/gameObjects/roleDefs.ts:421-427] [H]
- Kills by the Woods King ping the victim's location on every minimap with a sound; a dropped helmet shows a flower symbol on the map [src:fandom/Woods_King, wikigg/Woods_mode] [M]
- Kill-feed text "(player) killed the Woods King!" or "The Woods King is dead!" for indirect kills, in green [src:fandom/Woods_King] [M]
- Pavilion contents: the helmet in the centre, left vase `tier_pavilion` (naginata 2, PKP 2, DP-28 1, BAR 1, M9 1), right vase military pack + Greencloak outfit [src:fandom/Pavilion, survev/shared/defs/maps/baseDefs.ts:378-384] [M]
- Jul 11, 2019: teammate bullets no longer trigger the Woods King's Windwalk [src:fandom/Changelog] [M]
- Korean: 숲의 왕 (role), 시시가미의 투구 (helmet), 숲의 선물 (Gift of the Woods), 윈드워크 (Windwalk) [src:l10n/ko:game-woods_king, l10n/ko:game-helmet03_forest, l10n/ko:game-gotw, l10n/ko:game-windwalk] [H]

## Spawns (woods autumn; variants below)

| id | building / object | survev (s / l) | orig | src |
|---|---|---|---|---|
| `logging_complex_01` | Logging Complex 01 (blue warehouse, hatchet bunker `bunker_structure_06`, 2 outhouses incl. red fire-axe outhouse, 3 containers) | 1, location spawn at centre r200, retry | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:197-204, derived/git-ae55c9a8, fandom/Logging_Complex] [H] |
| `logging_complex_02` | Logging Complex 02 (clearing with a loot tree, crates, ammo crates, barrels) | 1 | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:241, fandom/Logging_Complex] [H] |
| `logging_complex_03` | Logging Complex 03 (2 crates, barrel, stump) | 3 | 3 | [src:survev/shared/defs/maps/woodsDefs.ts:242, fandom/Logging_Complex] [H] |
| `teapavilion_01w` | Pavilion on the lake island | 1 (lake centre) | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:173, derived/git-ae55c9a8] [H] |
| `warehouse_01` | Warehouse | 3 / 4 | 3 | [src:survev/shared/defs/maps/woodsDefs.ts:250, derived/git-ae55c9a8] [M] |
| `house_red_01` | Red House | 3 / 4 | 3 | [src:survev/shared/defs/maps/woodsDefs.ts:240, derived/git-ae55c9a8] [M] |
| `barn_01` | Barn | 3 / 4 | 3 | [src:survev/shared/defs/maps/woodsDefs.ts:230, derived/git-ae55c9a8] [M] |
| `teahouse_01` | Teahouse | 2 / 3 | 2 / 3 | [src:survev/shared/defs/maps/woodsDefs.ts:244] [H] |
| `bunker_structure_01b` | Egg bunker (woods variant) | 1 | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:231] [H] |
| `bunker_structure_03` | Storm bunker | 1 | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:232] [H] |
| `bunker_structure_07` | Eye bunker | 1 | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:233, changelog/0.6.71] [H] |
| `cache_01w` | stone cache (woods skin, fork id) | 1 | 1 (`cache_01`) | [src:survev/shared/defs/maps/woodsDefs.ts:234, derived/git-ae55c9a8, balance/150] [H] |
| `cache_02w` | Mosin tree cache (woods) | 1 | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:235] [H] |
| `cache_03` | leaf-pile cache (`bush_06` + leaf-pile loot) | 48 | 48 | [src:survev/shared/defs/maps/woodsDefs.ts:236, fandom/Woods_Map] [H] |
| `cache_07w` | barrel cache (woods) | 1 (fork, 0.2.2) | absent | [src:survev/shared/defs/maps/woodsDefs.ts:237, balance/229] [H] |
| `workshop_complex_01` | Workshop (fork building) | 1 (fork, 0.2.2) | absent | [src:survev/shared/defs/maps/woodsDefs.ts:251, balance/230] [H] |
| `chest_03` | River Chest | p = 0.5 | p = 0.5 | [src:survev/shared/defs/maps/woodsDefs.ts:238] [H] |
| `crate_19` | woods crate (1–3 `tier_guns` + 2–3 `tier_surviv`) | 12 | 12 | [src:survev/shared/defs/maps/woodsDefs.ts:239, kong/relaunch-client-defs] [H] |
| `stone_04` | Hardstone Block | 6 / 8 | 6 | [src:survev/shared/defs/maps/woodsDefs.ts:243, derived/git-ae55c9a8] [M] |
| `tree_02` | wood-axe stump | 6 / 8 | 6 | [src:survev/shared/defs/maps/woodsDefs.ts:245, derived/git-ae55c9a8] [M] |
| `tree_07` / `tree_08` / `tree_08b` | yellow-green tree / orange tree / large orange tree | 1100 / 1100 / 150 | same | [src:survev/shared/defs/maps/woodsDefs.ts:246-248] [M] |
| `tree_09` | stump | 84 | 84 | [src:survev/shared/defs/maps/woodsDefs.ts:249] [M] |

| id (density) | object | survev | orig | src |
|---|---|---|---|---|
| `stone_01` / `barrel_01` | stone / barrel | 48 / 36 | same | [src:survev/shared/defs/maps/woodsDefs.ts:212-213] [H] |
| `crate_01` / `crate_03` | crate / grenade crate | 60 / 12 | same | [src:survev/shared/defs/maps/woodsDefs.ts:214-215] [H] |
| `bush_01` / `hedgehog_01` | bush / hedgehog | 54 / 12 | same | [src:survev/shared/defs/maps/woodsDefs.ts:216-217] [H] |
| `container_01`–`04` | containers | 2 each | same | [src:survev/shared/defs/maps/woodsDefs.ts:218-221] [H] |
| `shack_01` | shack | 2 | 2 | [src:survev/shared/defs/maps/woodsDefs.ts:222] [H] |
| `outhouse_01` | outhouse | 6 (fork 0.2.2) | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:223, balance/231] [H] |
| `loot_tier_1` / `loot_tier_beach` | ground loot | 36 / 8 | same | [src:survev/shared/defs/maps/woodsDefs.ts:224-225] [H] |

- Spawn replacements: `tree_01` → `tree_07`; Soviet crate `crate_02` and `crate_08`/`crate_09` → `crate_19` [src:survev/shared/defs/maps/woodsDefs.ts:255-264] [H]
- No random-rotation buildings, no docks, bank, police station, mansion, club, greenhouse or huts on woods [src:survev/shared/defs/maps/woodsDefs.ts:228-254, fandom/Maps] [H]
- fandom building list (autumn): logging complex, shack, warehouse, blue warehouse, barn, cabin, outhouse, red house, containers, bridges (river dock, medium bridge); bunkers egg, hatchet, eye, storm [src:fandom/Woods_Map] [M]
- 0.8.1 reduced the number of trees and added clearings; the original tree counts before and after are not known [src:changelog/0.8.1] [H]
- The alternate barn (`barn_02`) was removed from woods on Oct 14, 2019; survev woods has none [src:fandom/Changelog, survev/shared/defs/maps/woodsDefs.ts:228-253] [H]

## Loot (woods; inherited by all variants unless overridden)

| tier | survev | original (pre-fork) | src |
|---|---|---|---|
| `tier_guns` | DP-28 2.75, BAR 2.75, IMB-2 (`imbel`, fork gun) 2.75, M1100 3, M870 2.5, SPAS-12 2.5, MP220 2, Saiga 0.15, QBB-97 0.125, M249 0.011, PKP 0.007 | DP-28 3.5, M1100 3, SPAS-12 3, BAR 3, MP220 1.5, Saiga 0.1, QBB-97 0.1, PKP 0.005 (no M870, no M249, no IMB-2) | [src:survev/shared/defs/maps/woodsDefs.ts:73-85, balance/237, balance/238, balance/249, balance/254, derived/git-ae55c9a8] [H] |
| `tier_ammo` / `tier_ammo_crate` | 7.62 ×60 3, 5.56 ×60 6, 12 ga ×10 1 (no 9mm) | same | [src:survev/shared/defs/maps/woodsDefs.ts:86-95] [H] |
| `tier_throwables` | frag ×3 1, MIRV ×2 0.5, smoke 1, strobe 0.2 | same | [src:survev/shared/defs/maps/woodsDefs.ts:96-101] [H] |
| `tier_armor` | helmets / vests lv1 2.5, lv2 2.5, lv3 1 | lv1 3, lv2 2, lv3 1 | [src:survev/shared/defs/maps/woodsDefs.ts:102-109, balance/239] [H] |
| `tier_packs` | backpack01 2, 02 3, 03 1 | 3 / 2 / 1 | [src:survev/shared/defs/maps/woodsDefs.ts:110-114, balance/240] [H] |
| `tier_chest` | DP-28 0.5, Saiga 0.1, SPAS 1, QBB 0.1, BAR 1, lv3 helmet 1, lv3 vest 1, 4x 1, 8x 0.5, PKP 0.05, M249 0.05 | same without M249 | [src:survev/shared/defs/maps/woodsDefs.ts:115-127, derived/git-ae55c9a8] [H] |
| `tier_toilet` | medical 0.75, outfits 0.05 | medical 0.6, outfits 0.025 (main values) | [src:survev/shared/defs/maps/woodsDefs.ts:66-72, balance/234] [H] |
| `tier_airdrop_uncommon` | MIRV ×8 0.75, strobe ×2 0.75, Saiga 1, SPAS-16 (fork) 1, QBB 1 | MIRV ×8 1, strobe ×2 0.5, Saiga 1, QBB 2 | [src:survev/shared/defs/maps/woodsDefs.ts:133-139, balance/241, balance/242] [H] |
| `tier_airdrop_rare` | USAS-12 1.5, PKP 0.75, M249 1, M9 0.005 | USAS-12 2, PKP 0.08, M249 1, M9 0.005 | [src:survev/shared/defs/maps/woodsDefs.ts:140-145, balance/243] [H] |
| `tier_airdrop_ammo` | 7.62 ×30, 5.56 ×30, 12 ga ×5 (3 each) | same | [src:survev/shared/defs/maps/woodsDefs.ts:146-150] [H] |
| `tier_airdrop_throwables` | frag ×2 1, MIRV ×2 0.5, strobe 0.5 | same | [src:survev/shared/defs/maps/woodsDefs.ts:128-132] [H] |
| `tier_hatchet` (hatchet bunker / hatchet case) | USAS-12 2, PKP 0.25, M249 0.75 | USAS-12 2, PKP 0.08, M249 1 | [src:survev/shared/defs/maps/woodsDefs.ts:151-155, balance/244] [H] |
| `tier_airdrop_melee` | nothing 13, stone hammer 3, pan 1 | nothing 19, stone hammer 1, pan 1 | [src:survev/shared/defs/maps/woodsDefs.ts:156-160, balance/245, balance/257] [H] |

- The USAS-12 fires 12-gauge frag rounds; it is woods-exclusive and only in hatchet loot and gold airdrops; 0.6.95 lowered its drop rate and frag radius [src:changelog/0.6.3, changelog/0.6.95, wikigg/Woods_mode] [H]
- The PKP "will spawn far more frequently in woods mode" than on normal maps (0.7.5) [src:fandom/Changelog] [M]
- Fire Axe: only in logging complex 01 (red outhouse) and the hatchet bunker, so at most 2 per game [src:fandom/Logging_Complex] [M]
- fandom: the only assault rifles on woods are the AK-47 from the stone cache and the M4A1-S from hardstone blocks; snipers only Mosin (tree cache) and AWM-S (hardstone block) [src:fandom/Woods_Map] [M]
- balance.txt still says the woods rock cache drops a DP-28, but survev reverted that; the woods stone cache drops `tier_surviv` + AK-47 like the original [src:balance/152, balance/153, survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:937] [M]
- Hardstone block loot on woods: survev uses the base `tier_eye_block` (M9, dual OTs-38, flare gun, Peacemaker, .45 ACP, pills, M4A1-S, M249, AWM-S, PKP, weight 1 each) [src:survev/shared/defs/maps/baseDefs.ts:221-232, fandom/Woods_Map] [H]

## Woods Snow (`woods_snow`)

- Overrides only audio, biome, some loot and spawns; mapId, woodsMode, lake, planes and bag sizes come from Woods [src:survev/shared/defs/maps/woodsSnowDefs.ts:6-146] [H]
- fandom: Woods Snow = woods with snowballs, snow particles, matte white ground and snow-covered buildings; no strobes "currently" [src:fandom/Woods_Map] [M]
- Trees stay autumn orange/yellow (`tree_07`, `tree_08`, `tree_08b`) under the snow [src:survev/shared/defs/maps/woodsSnowDefs.ts:112-114, fandom/Woods_Map] [H]

| field | survev woods_snow | original (pre-fork) | src |
|---|---|---|---|
| `tier_throwables` | frag ×3 1, MIRV ×2 0.75, smoke 0.75, snowball ×5 0.5, strobe 0.2 | frag ×3 1, MIRV ×2 0.5, smoke 1, snowball ×5 0.25, no strobe | [src:survev/shared/defs/maps/woodsSnowDefs.ts:43-49, balance/236, derived/git-ae55c9a8, fandom/Woods_Map] [H] |
| `tier_airdrop_throwables` | MIRV ×2 1, strobe 0.5, snowball ×20 0.25 | MIRV ×2 1, snowball ×10 0.25 | [src:survev/shared/defs/maps/woodsSnowDefs.ts:50-54, balance/246, derived/git-ae55c9a8] [H] |
| `tier_airdrop_melee` | nothing 13, ice axe (fork melee) 3, pan 1 | nothing 19, stone hammer 1, pan 1 | [src:survev/shared/defs/maps/woodsSnowDefs.ts:55-59, balance/235, derived/git-ae55c9a8] [H] |
| `tier_airdrop_outfits` | nothing 16, Siberian Assault 5, Meteor 5, Ghillie 0.5 | nothing 20, Meteor 5, Heaven 1, Ghillie 0.5 | [src:survev/shared/defs/maps/woodsSnowDefs.ts:60-65, derived/git-ae55c9a8] [M] |
| `tier_outfits` | Cobalt Shell 0.3, Woodland 0.3, Black Ice (fork) 0.2, Camo 0.15, Snowed Over (fork) 0.15, Ghillie 0.01 | Cobalt Shell 0.2, Key Lime 0.15, Woodland 0.1, Camo 0.1, Ghillie 0.01 | [src:survev/shared/defs/maps/woodsSnowDefs.ts:66-73, balance/233, derived/git-ae55c9a8] [H] |
| `tier_hatchet_melee` | fire axe 5, katanas 3, ice axe 1 | fire axe 5, katanas 3, stone hammer 1 | [src:survev/shared/defs/maps/woodsSnowDefs.ts:74-78, balance/235] [H] |
| `tier_eye_block` | winter table (SVD/SV-98/AWM-S winter skins, 7.62mm, snowball, SCAR) (fork) | base eye-block table | [src:survev/shared/defs/maps/woodsSnowDefs.ts:79-90, balance/253, derived/git-ae55c9a8] [H] |
| spawns | `barn_01x` 3/4, `house_red_01x` 3/4, `teahouse_01x` 2/3, `stone_04x` 6/8, `logging_complex_02x` 1, `logging_complex_03x` 2, `camp_01w` 2/3, `workshop_complex_01w` 1, `cache_07w` 1 | barn, red house, teahouse, hardstone block and logging complexes as in woods (3 × logging 03), snow skins via spawn replacements; no camp, workshop or barrel cache | [src:survev/shared/defs/maps/woodsSnowDefs.ts:93-119, balance/227, balance/228, derived/git-ae55c9a8] [H] |
| replacements | bridge, container_01, outhouse, shack, warehouse_01/02, bush, river chest, crate_01, stone_01/03 → snow `x` skins; crate_02/08/09 → crate_19; recorders → woods recorders | also bank, barn, cabin, greenhouse (→ `greenhouse_02`), red houses, huts, mansion, police, green shack, fisherman's shack; no recorder swap | [src:survev/shared/defs/maps/woodsSnowDefs.ts:120-141, derived/git-ae55c9a8] [H] |

- `logging_complex_02x`, `logging_complex_03x`, `teahouse_01x`, `stone_04x`, `camp_01w`, `workshop_complex_01w` are survev ids not present in the 0.8.82 client (fork reskins) [src:kong/relaunch-client-defs, survev/shared/defs/maps/woodsSnowDefs.ts:103-117] [H]
- The 0.6.95 secret update also cut snowball damage from 4 to 2 (heavy 12 to 5) on the woods snow map [src:fandom/Changelog] [M]

## Woods Spring (`woods_spring`)

- Spring colours, stone river-shore sound, pink `falling_leaf_spring` petals; cherry trees everywhere except the tree cache; teahouses 2 (3 squad) [src:survev/shared/defs/maps/woodsSpringDefs.ts:24-38, fandom/Woods_Map] [H]
- Location spawn `logging_complex_01sp` (spring Logging Complex) at centre r200; important spawns `logging_complex_01sp`, `logging_complex_02sp` (pre-fork also `teapavilion_01w`) [src:survev/shared/defs/maps/woodsSpringDefs.ts:51-59, survev/shared/defs/maps/woodsSpringDefs.ts:119, derived/git-ae55c9a8] [H]
- Fixed: barn, red house, warehouse 3/4; egg (woods), storm, eye bunkers 1 each; `cache_01w` 1 (orig `cache_01`), `cache_02sp` 1, `cache_07w` 1 (fork); river chest p 0.5; `logging_complex_02sp` 1, `logging_complex_03sp` 3; hardstone blocks 6/8; teahouse 2/3; wood-axe stumps 6/8; workshop 1 (fork) [src:survev/shared/defs/maps/woodsSpringDefs.ts:87-105, derived/git-ae55c9a8] [H]
- Density: stone 48, barrel 36, berry-bush cache `cache_06` 34, crate 60, grenade crate 12, woods crate `crate_19` 12, bush 54, hedgehog 12, containers 2, shack 2, outhouse 3, ground loot 36, beach loot 12 [src:survev/shared/defs/maps/woodsSpringDefs.ts:61-78] [H]
- Spring trees (density): `tree_07sp` 1200, `tree_08sp` 350, `tree_08spb` 100, river-shore `tree_07spr` 106 and `tree_08spr` 53, stumps `tree_09` 60 [src:survev/shared/defs/maps/woodsSpringDefs.ts:79-84] [H]
- Spring uses berry bushes (spring variant) instead of leaf piles; fandom calls it the second map with its own berry bush variant after the snow map's wreath bush [src:survev/shared/defs/maps/woodsSpringDefs.ts:65, fandom/Woods_Map] [M]
- Replacements: `bush_07` → `bush_07sp`, `tree_01`/`tree_07` → `tree_07sp`, crate_02/08/09 → crate_19, recorders → woods recorders [src:survev/shared/defs/maps/woodsSpringDefs.ts:107-117] [H]
- Loot: teahouse chest `tier_chrys_case` = nothing 2, Tsukuyomi no Kabuto 3, katanas 3, naginata 1 ("not from the leak") [src:survev/shared/defs/maps/woodsSpringDefs.ts:41-48] [M]
- The spring map used the Vernal Ghillie (pre-fork `tier_ghillie`); since 0.8.3 the ghillie takes the map tint [src:fandom/Woods_Map, fandom/Changelog, derived/git-ae55c9a8] [M]
- fandom: logging tree in `logging_complex_02sp` drops 2 BAR M1918 and 2 MP220 [src:fandom/Logging_Complex] [M]

## Woods Summer (`woods_summer`)

- Summer colours and `falling_leaf_summer` particles (green leaves with a brownish tone) [src:survev/shared/defs/maps/woodsSummerDefs.ts:7-20, fandom/Woods_Map] [H]
- survev (fork, 2026-03 "Woods Spring / Summer Structures") swaps in summer structures: location `logging_complex_01su`, `logging_complex_02su` 1, `logging_complex_03su` 3, `cache_02su`, berry-bush caches `cache_06` 48 instead of leaf piles, summer trees `tree_07su` 1100 / `tree_08su` 1100 / `tree_08sub` 150 [src:survev/shared/defs/maps/woodsSummerDefs.ts:22-58, derived/git-ae55c9a8] [H]
- The pre-fork woods_summer was a pure recolour of autumn woods (autumn logging complexes, `cache_03` leaf piles, autumn trees) [src:derived/git-ae55c9a8] [M]
- fandom Woods Summer: summer trees except the tree cache, teahouse complexes 2 (3 squad), lily pads and berry bushes [src:fandom/Woods_Map] [M]
- `logging_complex_01su` and `logging_complex_02su` exist in the 0.8.82 client; `logging_complex_03su`, `cache_02su` do not [src:kong/relaunch-client-defs] [H]
- survev woods_summer keeps `teahouse_01` (bare teahouse) 2/3 although fandom says summer teahouse complexes spawn [src:survev/shared/defs/maps/woodsSummerDefs.ts:50, fandom/Woods_Map] [L]

## Trivia

- Woods mode has the most seasonal versions: winter, spring, summer and autumn (normal) [src:wikigg/Woods_mode] [M]
- fandom: the Logging Complex is the only place where Flare Gun Cases spawn; the stump right outside the hatchet bunker always holds a wood axe [src:fandom/Logging_Complex] [M]
- survev.wiki.gg's Woods notes mention leaf bushes with loot and wood piles, and call the central lake "the main attraction" [src:wikigg/Woods_mode] [M]
- Korean item names: 소방 도끼 (Fire Axe), 나무꾼 복장 (Woodcutter's Wrap), 초록색망토 (Greencloak), PKP 페체네그 [src:l10n/ko:game-fireaxe, l10n/ko:game-outfitLumber, l10n/ko:game-outfitWoodsCloak, l10n/ko:game-pkp] [H]

## Conflicts

- CONFLICT woods-audio: 0.8.82 woods preloads `log_01`, `log_02`, `ability_stim_01`, `leader_dead_01` [src:kong/relaunch-client-defs] vs survev woods `footstep_08`, `footstep_09` and no Woods King sounds (only `woods_spring` has them) [src:survev/shared/defs/maps/woodsDefs.ts:15-20]; proposed: use the original list for the autumn woods def [H]
- CONFLICT woods-building-counts: warehouse/red house/barn 3 (all modes), hardstone blocks and wood-axe stumps 6 [src:derived/git-ae55c9a8] vs 3/4 and 6/8 by team size [src:survev/shared/defs/maps/woodsDefs.ts:230-250]; proposed: keep survev scaling as a config knob, default to the pre-fork flat counts [L]
- CONFLICT woods-airdrop-melee-stonehammer: stone hammer weight 3 [src:survev/shared/defs/maps/woodsDefs.ts:158] vs 6 [src:balance/257] vs original 1 [src:derived/git-ae55c9a8]; proposed: 1 [H]
- CONFLICT woods-snow-ghillie: playerGhillie 0xbbbbbb [src:survev/shared/defs/maps/woodsSnowDefs.ts:29] vs 0x83af50 inherited in the pre-fork def [src:derived/git-ae55c9a8]; proposed: no original evidence, keep 0xbbbbbb [L]
- CONFLICT woods-summer-teahouse: bare `teahouse_01` 2/3 [src:survev/shared/defs/maps/woodsSummerDefs.ts:50] vs teahouse complexes 2/3 [src:fandom/Woods_Map]; proposed: keep survev, open question [L]
- CONFLICT woods-island-size: map 720 / 736 units [src:survev/shared/defs/maps/woodsDefs.ts:164] vs "the Island is notably larger" [src:fandom/Woods_Map]; proposed: both true — the map square is no bigger than main, but the 8-unit shore inset makes the grass island larger [M]

## Open questions

- Original tree counts on woods before and after 0.8.1's "reduced number of trees" (survev uses 1100/1100/150 + 84 stumps) [src:changelog/0.8.1, survev/shared/defs/maps/woodsDefs.ts:246-249] [L]
- Was the plain autumn `woods` def in 0.8.82 the one with the lake and pavilion (the client's audio suggests yes), and did the snow variant have them? [src:kong/relaunch-client-defs, fandom/Woods_Map] [L]
- Original bag sizes for strobes/MIRVs on woods (only frag and smoke are overridden in survev) [src:survev/shared/defs/maps/woodsDefs.ts:59-62] [L]
