# Desert map ("Desert Rain", flare gun mode)

> survev id `desert` (mapId 1). Original client def checked against the 2026 relaunch bundle (`kong/relaunch-client-defs`, which has desc, audio, biome and gameMode for desert).
> "orig" spawn and loot values come from survev's pre-fork snapshot `ae55c9a8` (`derived/git-ae55c9a8`); survev's first commit also contains an older desert def (`derived/survev@9f64948d:src/defs/modes/desert.ts`) that predates 0.8.5 (it has no Mk45G and uses the plain gold airdrop).
> The Reserve, the oasis, the Crimson airdrop and the .50-calibre guns are fork-only (see `provenance/fork-vs-original.md`).

## Identity

- `MapId.Desert = 1`; survev def `Desert = mergeDeep({}, Main, overrides)` [src:survev/shared/gameConfig.ts:99, survev/shared/defs/maps/desertDefs.ts:8, survev/shared/defs/maps/desertDefs.ts:356] [H]
- `desc`: name "Desert", icon `img/loot/loot-weapon-flare-gun.svg` (flare gun play button), buttonCss `btn-mode-desert` — same in the original client [src:survev/shared/defs/maps/desertDefs.ts:9-14, kong/relaunch-client-defs] [H]
- Splash `img/splashes/desert.webp` is a survev addition [src:survev/shared/defs/maps/desertDefs.ts:13, kong/relaunch-client-defs] [H]
- Also called the Desert Rain map, flare gun mode, "Frozen Desert" when snowed in (0.6.8) [src:fandom/Desert_Map, fandom/Maps] [M]
- Korean community name: 사막 이벤트 (DESERT RAIN), usually run together with the flare gun ("Meteor Shower") event [src:namu/Surviv.io/이벤트] [M]
- Stats URLs use `mapId=1` for desert from 0.7.9 (game-mode stats tracked separately) [src:fandom/Changelog, changelog/0.7.9] [H]

## Dates and versions (up to 0.8.82)

| event | start | end | queue | what changed on the desert map | src |
|---|---|---|---|---|---|
| Desert rain | 0.6.1, Sep 22, 2018 | Sep 24, 2018 | squad | first desert map: cattle crate, tumbleweed bush, Poncho Verde, Model 94, Peacemaker, bowie; massively increased flare guns | [src:changelog/0.6.1, fandom/Changelog] [H] |
| Gunfight at the Deadeye Saloon | 0.6.5, Nov 8–9, 2018 | Nov 13, 2018 | squad | saloon, desert towns, archway, piano, round table/stove, small sandbag; M1911, M1A1 | [src:changelog/0.6.5, fandom/Changelog] [H] |
| Frozen deserts | 0.6.8, Dec 12–13, 2018 | Dec 19, 2018 | solo (first solo flare-gun mode) | hardstone boulder, Desert Camo, Desert Ghillie; aged greenhouse/chrysanthemum bunker | [src:changelog/0.6.8, fandom/Changelog, fandom/Maps] [H] |
| Danger close | 0.7.1, Feb 22, 2019 | Mar 3, 2019 | squad | strobe, meteor case, bridge column, aged faction statues; aged River Town ("Blood Gulch") at centre | [src:changelog/0.7.1, fandom/Maps] [H] |
| Firepower-up | 0.7.51, Apr 25, 2019 | Apr 29, 2019 | squad | Firepower on aged Lieutenant Helmets; PKP drop rate in gold airdrops greatly increased | [src:changelog/0.7.51, fandom/Changelog] [H] |
| Scouting ahead | 0.7.9, Jun 25, 2019 | Jul 2, 2019 | squad | alternate barn spawned on desert (patched later) | [src:changelog/0.7.9, fandom/Changelog, fandom/Desert_Map] [H] |
| All you can shoot | 0.7.95, Aug 9, 2019 | Aug 14, 2019 | squad | temporary Savannah Patches (acacia tree, cloud crate), Endless Ammo marksman helmet | [src:changelog/0.7.95, fandom/Changelog] [H] |
| .45 in the chamber | 0.8.5, Oct 7–8, 2019 | Oct 13, 2019 | squad | Mk45G; perks .45 In The Chamber, Broken Arrow, Fabricate; gold drops give 1 perk; alternate barn removed | [src:changelog/0.8.5, fandom/Changelog] [H] |
| Bombshells | 0.8.72, Nov 12, 2019 | Nov 18, 2019 | – | perks Flak Jacket, Explosive Rounds | [src:changelog/0.8.72, fandom/Changelog] [H] |

- The first desert (Sep 2018) was only a reskin of the normal map with normal water; 0.6.5 removed many buildings and added the towns and new guns [src:fandom/Desert_Map] [M]
- 0.8.3 removed the Savannah Patches from desert, woods and potato maps [src:fandom/Changelog, wikigg/Desert_mode] [M]
- After 0.8.82, the "Sinko de Ammo" event (Apr 20, 2020) used a modified desert map (Cinco de Mayo map) (post-0.8.82) [src:fandom/Desert_Map, fandom/Changelog] [M]
- Fork history (survev v0.1.23 and v0.3.1, 2025–2026): PKP/Mk45G/Desert Camo drop-rate changes, The Reserve, oasis, S&W 500, ASh-12, Barrett M107, .50-cal drops in the saloon cellar (fork) [src:wikigg/Desert_mode, balance/315, balance/317, balance/318] [H]

## Size and terrain

| field | value | src |
|---|---|---|
| scale small / large | 1.1875 / 1.1875 → 720 × 720 in every team mode (squads do not get a bigger island) | [src:survev/shared/defs/maps/desertDefs.ts:233, survev/server/src/game/map.ts:283-287, derived/survev@9f64948d:src/defs/modes/desert.ts:197] [H] |
| shoreInset / grassInset | 8 / 12 (narrow beach, "the ocean is notably smaller") | [src:survev/shared/defs/maps/desertDefs.ts:234-235, fandom/Desert_Map] [H] |
| river width sets | 0.1:[4], 0.15:[8], 0.25:[8,4], 0.21:[8] (fork: [8,6]), 0.09:[8,8], 0.2:[8,8,4], 0.0001:[8,8,8,6,4] | [src:survev/shared/defs/maps/desertDefs.ts:251-262, derived/survev@9f64948d:src/defs/modes/desert.ts:201-212, derived/git-ae55c9a8] [H] |
| river mask | no rivers within radius 80 of the map centre (keeps Blood Gulch dry) | [src:survev/shared/defs/maps/desertDefs.ts:263, derived/survev@9f64948d:src/defs/modes/desert.ts:213-215] [H] |
| lake | oasis `oasis_01` (inner r10, outer r20, within r300 of centre, no river bushes/stones, river mask 48) (fork, 2026-06) | [src:survev/shared/defs/maps/desertDefs.ts:237-250, wikigg/Desert_mode] [H] |
| bridges | inherited from main: medium + large | [src:survev/shared/defs/maps/baseDefs.ts:873-877] [M] |

### Place names

| name | pos | note | src |
|---|---|---|---|
| Blood Gulch | 0.51, 0.50 | the centre with the aged faction statues; survev adds `dontSpawnObjects` (fork) | [src:survev/shared/defs/maps/desertDefs.ts:267-271, derived/survev@9f64948d:src/defs/modes/desert.ts:219-222, fandom/Desert_Map] [H] |
| Southhaven | 0.35, 0.76 | "haven" = area of safety | [src:survev/shared/defs/maps/desertDefs.ts:272-275, fandom/Desert_Map] [H] |
| Atonement | 0.80, 0.40 | – | [src:survev/shared/defs/maps/desertDefs.ts:276-279] [H] |
| Los Perdidos | 0.33, 0.25 | Spanish "the lost"; the small desert town is usually there | [src:survev/shared/defs/maps/desertDefs.ts:280-283, fandom/Desert_Town] [H] |

- Los Perdidos, Atonement and Southhaven were added with the second desert update; Blood Gulch with the fourth [src:fandom/Maps] [M]

## Biome, audio, visuals

| field | value | src |
|---|---|---|
| background | 0x6a7543 | [src:survev/shared/defs/maps/desertDefs.ts:30, kong/relaunch-client-defs] [H] |
| water / waterRipple | 0x8a9b4e / 0xd1e685 (murky green) | [src:survev/shared/defs/maps/desertDefs.ts:31-32, kong/relaunch-client-defs, fandom/Desert_Map] [H] |
| beach / riverbank | 0xc9843a / 0xb25e24 | [src:survev/shared/defs/maps/desertDefs.ts:33-34, kong/relaunch-client-defs] [H] |
| grass (sand) | 0xdfa757 | [src:survev/shared/defs/maps/desertDefs.ts:38, kong/relaunch-client-defs] [H] |
| underground | 0x3d0d03 | [src:survev/shared/defs/maps/desertDefs.ts:39, kong/relaunch-client-defs] [H] |
| playerSubmerge / playerGhillie | 0x4e9b8f / 0xdfa761 | [src:survev/shared/defs/maps/desertDefs.ts:40-41, kong/relaunch-client-defs] [H] |
| lakeWater / lakeWaterRipple / lakeRiverbank | 0x42b0ba / 0xb3f0ff / 0x916e27 (oasis only, fork) | [src:survev/shared/defs/maps/desertDefs.ts:35-37, kong/relaunch-client-defs] [H] |
| camera particles | none | [src:survev/shared/defs/maps/desertDefs.ts:43, kong/relaunch-client-defs] [H] |

- Original audio preload: `piano_02`, `log_03`, `log_04` (sfx) and `piano_music_01` (ambient, the saloon piano) [src:kong/relaunch-client-defs, survev/shared/defs/maps/desertDefs.ts:19-24] [H]
- survev adds `reserve_music_01`, `reserve_music_02`, `coconut_01`, `potato_pickup_01` for The Reserve (fork) [src:survev/shared/defs/maps/desertDefs.ts:17-23, wikigg/Desert_mode] [H]
- survev.wiki.gg calls desert "the only mode that has irregular menu theme" and links `reserve_music_01`; that theme is fork-only [src:wikigg/Desert_mode, kong/relaunch-client-defs] [M]
- Atlas: loadout, shared, desert (the original also loads `gradient`) [src:survev/shared/defs/maps/desertDefs.ts:26, kong/relaunch-client-defs] [H]
- 0.6.8 "Frozen deserts": snow fell on the desert map only when the weather wheel in the Chrysanthemum Bunker was turned [src:fandom/Desert_Map] [M]

## Game mode and rules

- `gameMode: { maxPlayers: 80, desertMode: true }`; killLeaderEnabled is inherited true [src:survev/shared/defs/maps/desertDefs.ts:45, kong/relaunch-client-defs] [H]
- `desertMode` is stored by the survev server but no game logic reads it; desert behaviour comes entirely from its loot tables and spawns [src:survev/server/src/game/map.ts:297] [H]
- 9mm is replaced by .45 ACP: `tier_ammo`, `tier_ammo_crate` and `tier_airdrop_ammo` swap `9mm` for `45acp` (60 / 60 / 30 rounds) [src:survev/shared/defs/maps/desertDefs.ts:126-146, fandom/Desert_Map] [H]
- 9mm guns are nearly absent; fandom says the only ways are an M9 from a hardstone boulder or a single 9mm round in the saloon cellar, and the M9 0.01 in airdrops [src:fandom/Desert_Map, survev/shared/defs/maps/desertDefs.ts:111] [M]
- Flare guns are about 110 times more likely: 18.6 % of `tier_guns` weight on desert versus 0.17 % on main (survev.wiki.gg says "~130x") [src:survev/shared/defs/maps/desertDefs.ts:92-97, survev/shared/defs/maps/baseDefs.ts:281-282, derived/flare-share, wikigg/Desert_mode] [H]
- Strobes (air-strike throwables) exist only on desert in 0.8.82 world loot: `tier_throwables` strobe 0.2 and airdrop throwables strobe 1 [src:survev/shared/defs/maps/desertDefs.ts:191-200, changelog/0.7.1] [H]
- Airdrops: planes at circle 1 + 10 s and circle 3 + 2 s (same as main) [src:survev/shared/defs/maps/desertDefs.ts:48-60] [H]
- Original crate weights: `airdrop_crate_01` 10 : `airdrop_crate_02de` 1; the desert gold crate opens into `crate_11de`, which adds 1 item from `tier_perks` (0.8.5) [src:derived/git-ae55c9a8, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:699-719, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1143-1155, fandom/Changelog, kong/relaunch-client-defs] [H]
- Fork crates: `airdrop_crate_01` 12 and Crimson `airdrop_crate_05` 1 (opens into `crate_17` with `tier_airdrop_crimson`, perks 0–1 and a Casanova outfit) (fork) [src:survev/shared/defs/maps/desertDefs.ts:61-65, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:905-924, balance/319] [H]
- Before 0.8.5 the desert used the plain gold `airdrop_crate_02` (as in survev's first-commit desert def) [src:derived/survev@9f64948d:src/defs/modes/desert.ts:55-58, fandom/Changelog] [M]
- 0.8.5 made Dual Peacemakers spawn from airdrops instead of a single one [src:fandom/Changelog, fandom/Desert_Map] [M]

## Spawns

### Fixed spawns (same count in all team modes)

| id | building / object | survev | orig | src |
|---|---|---|---|---|
| `desert_town_01` | Large Desert Town (police station, 2 cabins, barn, bank `bank_01b`, saloon, cattle crates) | 1, place spawn, important | 1 | [src:survev/shared/defs/maps/desertDefs.ts:335, fandom/Desert_Town] [H] |
| `desert_town_02` | Small Desert Town; orig: shack, outhouse, 2 red houses, bank `bank_01b`; fork: The Reserve, red house, random house, barn | 1, place spawn, important | 1 (orig layout) | [src:survev/shared/defs/maps/desertDefs.ts:336, balance/317, fandom/Desert_Town, kong/relaunch-client-defs] [H] |
| `river_town_02` | aged River Town at Blood Gulch (aged faction statues, meteor case) | location spawn at centre, r50, no retry, important | 1 (also a fixed spawn in the pre-fork def) | [src:survev/shared/defs/maps/desertDefs.ts:285-293, derived/git-ae55c9a8, wikigg/Desert_mode] [H] |
| `warehouse_01` | Warehouse | 2 (fork) | 4 | [src:survev/shared/defs/maps/desertDefs.ts:320, balance/317, derived/survev@9f64948d:src/defs/modes/desert.ts:274] [H] |
| `warehouse_03` | Alternate Warehouse (fork) | 1 | absent | [src:survev/shared/defs/maps/desertDefs.ts:321, balance/317] [H] |
| `house_red_01` | Red House | 2 (fork) | 3 | [src:survev/shared/defs/maps/desertDefs.ts:322, balance/317] [H] |
| `house_red_02` | Second Red House | 1 | 1 | [src:survev/shared/defs/maps/desertDefs.ts:323] [H] |
| `barn_01` | Barn | 1 | 1 | [src:survev/shared/defs/maps/desertDefs.ts:324] [H] |
| `barn_02d` | Alternate Barn (desert basement) | 1 | 1 in the reconstructions; fandom says the alternate barn was removed from desert in 0.8.5 | [src:survev/shared/defs/maps/desertDefs.ts:325, fandom/Changelog] [L] |
| `cache_01` | stone cache | 1 | 1 | [src:survev/shared/defs/maps/desertDefs.ts:326] [H] |
| `cache_02d` | Mosin tree cache, desert skin (fork id; orig `cache_02`) | 1 | 1 (`cache_02`) | [src:survev/shared/defs/maps/desertDefs.ts:327, derived/git-ae55c9a8] [H] |
| `bunker_structure_01` | Egg bunker | p = 0.05 | p = 0.05 | [src:survev/shared/defs/maps/desertDefs.ts:328] [H] |
| `bunker_structure_03` | Storm bunker | 1 | 1 | [src:survev/shared/defs/maps/desertDefs.ts:329] [H] |
| `chest_01` | Treasure Chest | 1 | 1 | [src:survev/shared/defs/maps/desertDefs.ts:330] [H] |
| `chest_03d` | River Chest (desert) | p = 1 | p = 1 | [src:survev/shared/defs/maps/desertDefs.ts:331] [H] |
| `mil_crate_02` | OT-38 crate | p = 0.25 | p = 0.25 | [src:survev/shared/defs/maps/desertDefs.ts:332] [H] |
| `crate_18` | Cattle Crate | 12 | 12 | [src:survev/shared/defs/maps/desertDefs.ts:333] [H] |
| `tree_02` | wood-axe stump | 3 | 3 | [src:survev/shared/defs/maps/desertDefs.ts:334] [H] |
| `greenhouse_02` | aged Greenhouse (aged Chrysanthemum bunker) | 1 | 1 | [src:survev/shared/defs/maps/desertDefs.ts:337] [H] |
| `stone_05` | Hardstone Boulder (`tier_eye_stone`) | 6 | 6 | [src:survev/shared/defs/maps/desertDefs.ts:338, fandom/Hardstone_Boulder] [H] |

- No random building rotation: `randomSpawns: []`, so no stand-alone mansion, police station or bank outside the towns [src:survev/shared/defs/maps/desertDefs.ts:341, fandom/Desert_Map] [H]
- Not spawned on desert: docks, hydra/conch/crossing bunkers, huts, fisherman's shacks, club, teahouse, mansion [src:survev/shared/defs/maps/desertDefs.ts:318-340, fandom/Desert_Map] [H]
- Place spawns: `desert_town_02`, `desert_town_01` (fork order; orig `desert_town_01` first) [src:survev/shared/defs/maps/desertDefs.ts:294, derived/survev@9f64948d:src/defs/modes/desert.ts:245-248] [M]
- Important spawns (the map is regenerated until they fit): `desert_town_01`, `desert_town_02`, `river_town_02` [src:survev/shared/defs/maps/desertDefs.ts:351] [H]

### Density spawns

| id | object | survev | orig | src |
|---|---|---|---|---|
| `stone_01` → `stone_01b` | desert stone | 280 | 280 | [src:survev/shared/defs/maps/desertDefs.ts:298, survev/shared/defs/maps/desertDefs.ts:347] [H] |
| `barrel_01` | barrel | 76 | 76 | [src:survev/shared/defs/maps/desertDefs.ts:299] [H] |
| `silo_01` | silo | 4 | 4 | [src:survev/shared/defs/maps/desertDefs.ts:300] [H] |
| `crate_01` / `crate_03` | crate / grenade crate | 50 / 8 | 50 / 8 | [src:survev/shared/defs/maps/desertDefs.ts:301-302] [H] |
| `bush_01` → `bush_05` | tumbleweed | 90 | 90 | [src:survev/shared/defs/maps/desertDefs.ts:303, survev/shared/defs/maps/desertDefs.ts:345, changelog/0.6.1] [H] |
| `tree_06` | desert tree | 220 | 220 | [src:survev/shared/defs/maps/desertDefs.ts:304] [H] |
| `tree_05c` | withered tree (desert) | 96 (fork, 2026-07) | 144 | [src:survev/shared/defs/maps/desertDefs.ts:305, derived/git-ae55c9a8, derived/survev@9f64948d:src/defs/modes/desert.ts:259] [H] |
| `tree_09` | stump | 40 | 40 | [src:survev/shared/defs/maps/desertDefs.ts:306] [H] |
| `hedgehog_01` | hedgehog | 12 | 12 | [src:survev/shared/defs/maps/desertDefs.ts:307] [H] |
| `container_01`–`04` | containers | 5 each | 5 each | [src:survev/shared/defs/maps/desertDefs.ts:308-311] [H] |
| `shack_01` / `outhouse_01` | shack / outhouse | 8 / 5 | 8 / 5 | [src:survev/shared/defs/maps/desertDefs.ts:312-313] [H] |
| `loot_tier_1` / `loot_tier_beach` | ground loot | 24 / 4 | 24 / 4 | [src:survev/shared/defs/maps/desertDefs.ts:314-315] [H] |

- Spawn replacements: `tree_01` → `tree_06`, `bush_01` → `bush_05`, `crate_02` (Soviet crate) → `crate_18` (cattle crate), `stone_01` → `stone_01b`, `stone_03` → `stone_03b` [src:survev/shared/defs/maps/desertDefs.ts:342-350, derived/survev@9f64948d:src/defs/modes/desert.ts:296-304] [H]
- No berry-bush caches and no Soviet crates spawn on desert (no `cache_06`, `crate_02` replaced) [src:survev/shared/defs/maps/desertDefs.ts:296-317] [H]

## Loot overrides

| tier | desert content (survev) | original difference | src |
|---|---|---|---|
| `tier_guns` | M1911 19, M1A1 10, M870 9, OT-38 8, M1100 6, HK416 4, flare gun 14.5, dual flare 0.25, AK 2.7, MP220 2, SPAS 1, FAMAS 0.9, Groza 0.8, DP-28 0.5, Mk45G 0.1, rare guns ≤ 0.1; total weight 79.341 | orig mosin 0.1 (fork 0.05), scout_elite 0.05 (fork 0.1), no BAR (fork 0.05); orig total 79.191 = fandom's total | [src:survev/shared/defs/maps/desertDefs.ts:69-101, derived/git-ae55c9a8, fandom/Desert_Map] [H] |
| `tier_airdrop_uncommon` | Mk12 2.5, M39 2.5, Model 94 2, QBB 1.5, mosin 1.5, scout 2.5, Mk45G 2.5, saiga 1, deagle 1, Peacemaker 1, SCAR 0.75, SV-98 0.5, flare 0.5, M9 0.01 | orig mosin 2.5, scout 1.5, Mk45G absent in the reconstruction (fandom: weight "???") | [src:survev/shared/defs/maps/desertDefs.ts:102-117, derived/git-ae55c9a8, fandom/Desert_Map] [H] |
| `tier_airdrop_rare` | Garand 6, AWM-S 3, PKP 0.08, M249 0.1, M4A1-S 4, dual OTs-38 4.5 | orig PKP 3 ("greatly increased" in 0.7.51); survev lowered it to 0.08 in 2025 without a balance.txt entry (fork) | [src:survev/shared/defs/maps/desertDefs.ts:118-125, derived/git-ae55c9a8, changelog/0.7.51, fandom/Desert_Map] [H] |
| `tier_airdrop_outfits` | nothing 20, Meteor 5, Heaven 1, Ghillie 0.5 | the older def used `outfitDesertGhillie`; since 0.8.3 the ghillie takes the biome tint | [src:survev/shared/defs/maps/desertDefs.ts:147-152, derived/survev@9f64948d:src/defs/modes/desert.ts:137-146, fandom/Changelog] [M] |
| `tier_airdrop_melee` | nothing 19, Stone Hammer 1, Pan 1 | same | [src:survev/shared/defs/maps/desertDefs.ts:153-157, fandom/Desert_Map] [H] |
| `tier_chest` | as main but Vector .45 (`vector45`) instead of Vector | fork adds BAR 0.27 | [src:survev/shared/defs/maps/desertDefs.ts:158-182, fandom/Desert_Map] [H] |
| `tier_hatchet` | Vector .45 0.4, HK416 0.25, MP220 0.15, PKP / M249 / M9 0.01 | same | [src:survev/shared/defs/maps/desertDefs.ts:183-190, fandom/Desert_Map] [H] |
| `tier_throwables` | frag ×2 1, smoke 1, strobe 0.2, MIRV ×2 0.05 | same | [src:survev/shared/defs/maps/desertDefs.ts:191-196, fandom/Desert_Map] [H] |
| `tier_airdrop_throwables` | strobe 1, frag ×3 0.1 | same | [src:survev/shared/defs/maps/desertDefs.ts:197-200, fandom/Desert_Map] [H] |
| `tier_perks` (gold airdrop perk) | Broken Arrow, Fabricate, Flak Jacket, .45 In The Chamber (`bonus_45`), Hyperfragmentation (`amped_explosives`, fork), Explosive Rounds (`explosive`) — 1 each | pre-fork had only the first four; fandom says Explosive Rounds came "very rarely" from desert airdrops (see Conflicts) | [src:survev/shared/defs/maps/desertDefs.ts:201-208, balance/320, derived/git-ae55c9a8, fandom/Explosive_Rounds] [L] |
| `tier_crow_case_melee` | crowbar 1, stonehammer 1 (construction case of the fork alternate warehouse) | fork | [src:survev/shared/defs/maps/desertDefs.ts:209-212, balance/317] [H] |
| `tier_pirate_rare` | includes S&W 500, ASh-12, Barrett (fork beach/pirate tier) | fork | [src:survev/shared/defs/maps/desertDefs.ts:213-229] [H] |
| `tier_saloon` (base def) | Vector .45 1, Mk45G 1, fork `tier_airdrop_crimson` 0.22 | orig no crimson; 0.8.5 replaced `tier_vector45` with `tier_saloon` | [src:survev/shared/defs/maps/baseDefs.ts:674-678, balance/318, fandom/Changelog] [H] |
| `tier_cattle_crate` (base def) | M1A1 1, Model 94 1, Peacemaker 1, Poncho Verde 0.1, Desert Camo 0.3 | orig Desert Camo 0.1 | [src:survev/shared/defs/maps/baseDefs.ts:679-685, balance/147] [H] |
| `tier_eye_stone` (hardstone boulder, base def) | Vector .45, .45 ACP, Garand, strobe, medkit, pills 1 each; M4A1-S 0.7, M249 0.2, SCAR-SSR 0.1, AWM-S 0.1, PKP 0.1 | SCAR-SSR added by the fork; no M9 or 9mm in survev | [src:survev/shared/defs/maps/baseDefs.ts:233-245, derived/git-ae55c9a8] [M] |

- Cattle crates (`crate_18`, 140 HP) drop 2–3 `tier_cattle_crate` items plus 1–2 `tier_soviet` items [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:925-930, kong/relaunch-client-defs] [H]
- The Stone Hammer is in the desert bank vault and breaks aged faction statues, hardstone boulders and the stone wall of the aged chrysanthemum bunker [src:fandom/Desert_Map, fandom/Desert_Town] [M]
- Aged statues at Blood Gulch hold faction crates: the desert Initiative crate (Stifled Blue, kukri, Lieutenant Helmet, AN-94, 7.62mm) and desert Soviet crate (Red Victorious, machete, Lieutenant Helmet, Super 90, 12 gauge) [src:fandom/Desert_Map] [M]
- The aged Lieutenant Helmet grants Firepower since 0.7.51 [src:changelog/0.7.51, wikigg/Desert_mode] [H]
- The aged Chrysanthemum bunker shows an Eye-bunker logo, dead planters, and a stone wall hiding a meteor case with strobes and a flare gun [src:fandom/Desert_Map] [M]

## Perks

- Gold desert airdrops drop 1 perk from `tier_perks` since 0.8.5 (Broken Arrow, Fabricate, .45 In The Chamber; Flak Jacket and Explosive Rounds from 0.8.72); Firepower comes with the aged Lieutenant Helmet [src:fandom/Changelog, fandom/Desert_Map, changelog/0.8.5, changelog/0.8.72] [H]
- Korean perk names live in `items/perks.md`; the desert-specific Korean item names are 섬광탄 총 (flare gun), 스트로브 (strobe), 스톤 해머 (stone hammer), 사막 위장 (Desert Camo), 사막용 길리 수트 (Desert Ghillie) [src:l10n/ko:game-flare_gun, l10n/ko:game-strobe, l10n/ko:game-stonehammer, l10n/ko:game-outfitDesertCamo, l10n/ko:game-outfitDesertGhillie] [H]

## Trivia

- fandom calls the desert a "broken and aged" version of the 50v50 map: aged faction statues, stone-armoured bridge columns, Red Leader and Blue Leader guns [src:fandom/Desert_Map] [M]
- The very first increased-flare event (Meteor Shower, Aug 2018) did not use the desert map, only more flares on the normal map [src:fandom/Desert_Map, fandom/Events] [M]
- The desert is the "Desert Rain" event map; survev.wiki.gg lists its major structures as the Aged River Town, Saloon and (fork) The Reserve [src:fandom/Desert_Map, wikigg/Desert_mode] [M]

## Conflicts

- CONFLICT desert-pkp-airdrop-rare: PKP 0.08 [src:survev/shared/defs/maps/desertDefs.ts:121] vs PKP 3 [src:derived/git-ae55c9a8, fandom/Desert_Map, changelog/0.7.51]; proposed: 3 (original) [H]
- CONFLICT desert-alt-barn: `barn_02d` spawns once [src:survev/shared/defs/maps/desertDefs.ts:325, derived/git-ae55c9a8] vs "Removed Alternate Barn from Desert Map" in 0.8.5 [src:fandom/Changelog, fandom/Desert_Map]; proposed: keep `barn_02d` as a config knob defaulting to off for 0.8.82, log in open-questions [L]
- CONFLICT desert-explosive-rounds: Explosive Rounds absent from the original desert `tier_perks` (fork added it in 0.3.1) [src:balance/320, derived/git-ae55c9a8] vs "very rarely from Air Drops in Desert Mode" [src:fandom/Explosive_Rounds, fandom/Changelog]; proposed: include `explosive` with a low weight, keep `amped_explosives` out [L]
- CONFLICT desert-model94-airdrop: Model 94 weight 2 in `tier_airdrop_uncommon` [src:survev/shared/defs/maps/desertDefs.ts:114, derived/survev@9f64948d:src/defs/modes/desert.ts:105] vs 0.01 [src:fandom/Desert_Map]; proposed: 2 (two survev snapshots) [L]
- CONFLICT desert-warehouses: 2 × `warehouse_01` + 1 × `warehouse_03`, 2 × `house_red_01` [src:survev/shared/defs/maps/desertDefs.ts:320-322] vs 4 × `warehouse_01`, 3 × `house_red_01` [src:derived/git-ae55c9a8, balance/317]; proposed: original 4 / 3, no `warehouse_03` [H]
- CONFLICT desert-town-date: Desert towns added in 0.6.1 (Sep 22, 2018) [src:fandom/Desert_Town] vs added with the saloon in 0.6.5 [src:fandom/Changelog, fandom/Desert_Map]; proposed: 0.6.5 [M]
- CONFLICT desert-boulder-m9: hardstone boulders can give an M9 and one 9mm round [src:fandom/Desert_Map] vs `tier_eye_stone` has no M9 or 9mm [src:survev/shared/defs/maps/baseDefs.ts:233-245]; proposed: keep survev table, open question [L]

## Open questions

- Original weight of the Mk45G in desert `tier_guns` and airdrops (fandom lists "???"; survev's 0.1 / 2.5 are marked uncertain) [src:fandom/Desert_Map, survev/shared/defs/maps/desertDefs.ts:116] [L]
- Was the desert alternate barn (`barn_02d`) the 0.8.5 replacement for the removed alternate barn, or was no alternate barn spawned at all in 0.8.82? [src:fandom/Changelog, kong/relaunch-client-defs] [L]
- Whether airdrop Peacemakers come as duals (fandom, 0.8.5) — survev's table holds a single `colt45` [src:fandom/Changelog, survev/shared/defs/maps/desertDefs.ts:115] [L]
