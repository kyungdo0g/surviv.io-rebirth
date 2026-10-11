# Main map (Normal / Classic), Main Spring, Main Summer

> The default island and its two seasonal reskins. survev ids: `main`, `main_spring`, `main_summer` (all `mapId` 0).
> "orig" spawn and loot numbers come from survev's pre-fork snapshot `ae55c9a8` (cited `derived/git-ae55c9a8`) because the original client ships no loot tables or map generation; client-visible fields (colours, audio, desc) are checked against the 2026 relaunch bundle (`kong/relaunch-client-defs`), which contains only the `main` def, not the spring/summer variants.
> Building and obstacle internals live in `maps/buildings.md`, `maps/obstacles.md`, `maps/bunkers.md`; generation algorithms in `maps/generation.md`. Event dates are summarised in `modes/events.md`.

## Identity

- survev registers three map defs on mapId 0: `main` (`Main`), `main_spring` (`MainSpring`) and `main_summer` (`MainSummer`); both variants are `util.mergeDeep({}, Main, overrides)` [src:survev/shared/defs/mapDefs.ts:42-45, survev/shared/defs/maps/mainSpringDefs.ts:102, survev/shared/defs/maps/mainSummerDefs.ts:99] [H]
- `MapId.Main = 0` in the shared enum; spring and summer set no own mapId, so stats and the play button treat them as the normal map [src:survev/shared/gameConfig.ts:97-98, survev/shared/defs/maps/mainSpringDefs.ts:5-8] [H]
- `desc`: name "Normal", empty icon, empty buttonCss — identical in the original 0.8.82 client [src:survev/shared/defs/maps/baseDefs.ts:15-20, kong/relaunch-client-defs] [H]
- `desc.backgroundImg` splash (`img/splashes/main.webp`, `main_spring.webp` for spring) is a survev addition; the original map defs have no backgroundImg field (fork) [src:survev/shared/defs/maps/baseDefs.ts:19, survev/shared/defs/maps/mainSpringDefs.ts:7, kong/relaunch-client-defs] [H]
- The code originally called it the "Default" map; 0.7.0 renamed Default → Main (and Autumn → Woods) [src:fandom/Normal_Map, fandom/Changelog] [M]
- 0.7.9 secretly renamed the internal Snow, Main and Main Spring map names to "Normal Map" [src:fandom/Changelog] [M]
- Wiki names: fandom "Normal Map" / "Main Spring Map" / "Main Summer Map"; survev.wiki.gg "Classic mode" with Normal / Spring / Summer / Winter tabs [src:fandom/Normal_Map, fandom/Main_Spring_Map, fandom/Main_Summer_Map, wikigg/Classic_mode] [H]

## Dates and versions

| map | ran | evidence | src |
|---|---|---|---|
| main (Normal) | default map whenever no event replaces the queue, since 0.0.2 (Oct 11, 2017) | "the map in use when there is no event going on" | [src:fandom/Normal_Map, changelog/0.0.2] [H] |
| main_spring ("Awesome blossoms", Spring Fever) | from 0.7.3 (Mar 21, 2019); end date not logged | teahouse, vase, chrysanthemum chest, naginata added | [src:changelog/0.7.3, fandom/Changelog] [H] |
| main_summer ("Scouting ahead" / Summer Bloom) | 0.7.9 (Jun 25, 2019) to Jul 14, 2019, solo and duo queues (squads got Desert) | Scout Elite + scout hut added | [src:changelog/0.7.9, fandom/Changelog, fandom/Events] [H] |
| main_spring (post-0.8.82) | Mar 23–24, 2020 ("Spring event", rotation paused) and Apr 15, 2021 | (post-0.8.82) | [src:fandom/Changelog, namu/Surviv.io/이벤트] [M] |

- fandom's Main Spring and Teahouse pages give March 20, 2019 for the spring update; the changelog file says Mar. 21 [src:fandom/Maps, fandom/Teahouse, changelog/0.7.3] [M]
- Since 0.7.9 the teahouse count dropped from 2 (3 squads) to 1 complex (2 squads), and on Jul 14, 2019 the summer teahouse complex replaced the spring one on the normal map [src:fandom/Changelog, fandom/Teahouse] [M]

## Main map changes over time (changelog, up to 0.8.82)

- 0.2.0 (Jan 17, 2018) increased map size; 0.2.2 added ocean to the map border, hedgehogs and treasure chests [src:changelog/0.2.0, changelog/0.2.2] [H]
- 0.4.0 added the docks area (blue warehouse, green shack, closed container, bollard); 0.4.2 conch bunker and hut; 0.6.0 rivers, large/medium bridges, cabin, crossing bunker [src:changelog/0.4.0, changelog/0.4.2, changelog/0.6.0] [H]
- 0.4.1: safe zone circles more likely to move towards the map edges [src:changelog/0.4.1] [H]
- 0.6.7 added greenhouse, second red house and fisherman's shack; 0.7.3 teahouse; 0.7.7 club and alternate barn plus random building rotation (one of bank, mansion, police station does not spawn each game) [src:changelog/0.6.7, changelog/0.7.3, changelog/0.7.7] [H]
- 0.7.7 also made hardstone blocks spawn on main maps (survev `stone_04: 1`) [src:fandom/Changelog, survev/shared/defs/maps/baseDefs.ts:945] [H]
- 0.7.9 added the scout hut and removed BAR M1918 from the normal map; 0.8.35 added VSS to the normal map [src:changelog/0.7.9, changelog/0.8.35] [H]
- 0.6.31 had added BAR and MIRV to the normal map after the first woods event; BAR was removed again in 0.7.9 [src:changelog/0.6.31, changelog/0.7.9] [H]
- Jan 1 – Jan 10, 2019 the greenhouse was removed from and re-added to the default map [src:fandom/Changelog] [M]

## Size and terrain generation

| field | main / main_spring / main_summer | src |
|---|---|---|
| baseWidth × baseHeight | 512 × 512 | [src:survev/shared/defs/maps/baseDefs.ts:814-815, derived/survev@9f64948d:src/defs/modes/main.ts:65-66] [H] |
| scale small (solo, duo) / large (squad) | 1.1875 / 1.28125 | [src:survev/shared/defs/maps/baseDefs.ts:816] [H] |
| extension | 112 | [src:survev/shared/defs/maps/baseDefs.ts:817] [H] |
| resulting size | 720 × 720 (solo/duo), 768 × 768 (squad) = width·scale + extension | [src:survev/server/src/game/map.ts:283-287, derived/512x1.1875+112] [H] |
| rebirth size | 915 × 915 (solo/duo), 978 × 978 (squad): scale × 1.32 (× 1.2 from 2026-10-08), with 2 to 4 rivers (`docs/research/rebirth-deviations.md` "Bigger maps") | [src:user/2026-10-08-bigger-maps] [src:user/2026-10-11-bigger-maps] [H] |
| grid tiles (16 units) | 45 (solo/duo), 48 (squad) | [src:fandom/Game_Modes, survev/shared/gameConfig.ts:182] [H] |
| shoreInset / grassInset | 48 / 18 | [src:survev/shared/defs/maps/baseDefs.ts:818-819] [H] |
| river width sets (weight: widths) | 0.1:[4], 0.15:[8], 0.25:[8,4], 0.21:[16], 0.09:[16,8], 0.2:[16,8,4], 0.0001:[16,16,8,6,4] | [src:survev/shared/defs/maps/baseDefs.ts:822-833] [H] |
| river smoothness / lakes / masks | 0.45 / none / none | [src:survev/shared/defs/maps/baseDefs.ts:821, survev/shared/defs/maps/baseDefs.ts:834-836] [H] |
| spawnCabins | true (river cabins and docks spawn) | [src:survev/shared/defs/maps/baseDefs.ts:835] [M] |
| bridges | medium `bridge_md_structure_01`, large `bridge_lg_structure_01`, no extra-large | [src:survev/shared/defs/maps/baseDefs.ts:873-877] [H] |

- Density spawn counts scale with island area: count = round(density × shoreArea / 250000) [src:survev/server/src/game/map.ts:1127-1129] [H]
- 0.7.3 fixed the extra-large bridge spawning on normal maps [src:changelog/0.7.3] [H]

### Place names (minimap labels)

| name | pos (x, y) | meaning | src |
|---|---|---|---|
| The Killpit | 0.53, 0.64 | – | [src:survev/shared/defs/maps/baseDefs.ts:840-843] [H] |
| Sweatbath | 0.84, 0.18 | slang for sauna | [src:survev/shared/defs/maps/baseDefs.ts:844-847, fandom/Maps] [H] |
| Tarkhany | 0.15, 0.11 | a locality in Russia | [src:survev/shared/defs/maps/baseDefs.ts:848-851, fandom/Maps] [H] |
| Ytyk-Kyuyol | 0.25, 0.42 | "Holy Lake" in Yakutian | [src:survev/shared/defs/maps/baseDefs.ts:852-855, fandom/Maps] [H] |
| Todesfelde | 0.81, 0.85 | "field of death" (replaced the removed "Cordial Creek") | [src:survev/shared/defs/maps/baseDefs.ts:856-859, fandom/Maps] [H] |
| Pineapple | 0.21, 0.79 | – | [src:survev/shared/defs/maps/baseDefs.ts:860-863] [H] |
| Fowl Forest | 0.73, 0.47 | – | [src:survev/shared/defs/maps/baseDefs.ts:864-867] [H] |
| Ranchito Pollo | 0.53, 0.25 | "chicken farm" in Spanish | [src:survev/shared/defs/maps/baseDefs.ts:868-871, fandom/Maps] [H] |

- The same 8 places are in survev's first-commit main def, so they are not a fork addition [src:derived/survev@9f64948d:src/defs/modes/main.ts:89-123] [H]
- survev.wiki.gg lists only 7 of them (no Todesfelde) [src:wikigg/Classic_mode] [M]

## Biome and colours

| field | main | main_spring | main_summer | src |
|---|---|---|---|---|
| background | 0x20536e | 0x20536e | 0x20536e | [src:survev/shared/defs/maps/baseDefs.ts:36, survev/shared/defs/maps/mainSpringDefs.ts:15, survev/shared/defs/maps/mainSummerDefs.ts:24, kong/relaunch-client-defs] [H] |
| water / waterRipple | 0x3282ab / 0xb3f0ff | same | same | [src:survev/shared/defs/maps/baseDefs.ts:37-38, kong/relaunch-client-defs] [H] |
| beach | 0xcdb35b | 0xf4ae48 | 0xdc9e28 | [src:survev/shared/defs/maps/baseDefs.ts:39, survev/shared/defs/maps/mainSpringDefs.ts:18, survev/shared/defs/maps/mainSummerDefs.ts:27] [H] |
| riverbank | 0x905e24 | 0x8a8a8a (grey) | 0xa37119 | [src:survev/shared/defs/maps/baseDefs.ts:40, survev/shared/defs/maps/mainSpringDefs.ts:19, survev/shared/defs/maps/mainSummerDefs.ts:28] [H] |
| grass | 0x80af49 | 0x5c910a | 0x629522 | [src:survev/shared/defs/maps/baseDefs.ts:41, survev/shared/defs/maps/mainSpringDefs.ts:20, survev/shared/defs/maps/mainSummerDefs.ts:29] [H] |
| underground | 0x1b0d03 | same | same | [src:survev/shared/defs/maps/baseDefs.ts:42] [H] |
| playerSubmerge | 0x2b8ca4 | same | same | [src:survev/shared/defs/maps/baseDefs.ts:43] [H] |
| playerGhillie (ghillie suit tint) | 0x83af50 | 0x5b8e0a | 0x659825 | [src:survev/shared/defs/maps/baseDefs.ts:44, survev/shared/defs/maps/mainSpringDefs.ts:23, survev/shared/defs/maps/mainSummerDefs.ts:32, kong/relaunch-client-defs] [H] |
| river shore sound | sand | stone | sand | [src:survev/shared/defs/maps/baseDefs.ts:47, survev/shared/defs/maps/mainSpringDefs.ts:25] [H] |
| camera particles | none | `falling_leaf_spring` (pink petals) | none | [src:survev/shared/defs/maps/baseDefs.ts:54, survev/shared/defs/maps/mainSpringDefs.ts:26, fandom/Maps] [H] |
| valueAdjust | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:46] [H] |

- The fandom infobox colours for Normal and Main Spring match survev exactly (e.g. spring beach 16035400 = 0xf4ae48, grass 6066442 = 0x5c910a) [src:fandom/Normal_Map, fandom/Main_Spring_Map] [H]
- Main Summer's fandom infobox repeats the spring beach/grass values and the main riverbank, unlike survev (see Conflicts) [src:fandom/Main_Summer_Map] [L]
- Up to 0.7.5 the spring map and main map shared one ghillie colour; 0.7.41 recoloured the ghillie to the spring grass and 0.7.5 separated the "Vernal Ghillie" (spring) and later the "Verdant Ghillie" (summer, Jul 7, 2019); 0.8.3 removed the separate ghillie outfits because the ghillie now takes the map's playerGhillie tint [src:fandom/Changelog, fandom/Main_Spring_Map] [M]
- Korean names of the old seasonal ghillies: 봄의 길리 수트 (Vernal), 파릇파릇한 길리 수트 (Verdant) [src:l10n/ko:game-outfitSpringGhillie, l10n/ko:game-outfitSummerGhillie] [H]

## Audio and atlases

- Original main def preloads only `club_music_01`, `club_music_02`, `ambient_steam_01` (ambient channel) and uses atlases gradient, loadout, shared, main [src:kong/relaunch-client-defs] [H]
- survev main adds `log_05`, `log_11`, `log_12`, `vault_change_03`, `watering_01` (sfx) and drops the `gradient` atlas; survev's first commit had `log_11`/`log_12` only [src:survev/shared/defs/maps/baseDefs.ts:22-32, derived/survev@9f64948d:src/defs/modes/main.ts:7-15] [M]
- main_spring overrides `audio: []`; survev's mergeDeep replaces arrays instead of merging them, so the spring map preloads no extra sounds (no club music), while main_summer repeats Main's list [src:survev/shared/defs/maps/mainSpringDefs.ts:9-12, survev/shared/defs/maps/baseDefs.ts:6-11, survev/shared/defs/maps/mainSummerDefs.ts:7-20] [H]
- `biome.ambience` (menu music `menu_music_01`, wind `ambient_wind_01`, river `ambient_stream_01`, waves `ambient_waves_01`) is a survev field; the client ambiance defaults to the same tracks and the victory jingle plays `ambience.music` (fork field) [src:survev/shared/defs/maps/baseDefs.ts:48-53, survev/client/src/ambiance.ts:49-52, survev/client/src/game.ts:1552, kong/relaunch-client-defs] [H]
- Airdrop visuals: plane `map-plane-01.img`, sound `plane_01`, chute `map-chute-01.img` [src:survev/shared/defs/maps/baseDefs.ts:56-60, kong/relaunch-client-defs] [H]

## Game mode and rules

- `gameMode`: maxPlayers 80, killLeaderEnabled true, no special mode flag [src:survev/shared/defs/maps/baseDefs.ts:62-65, kong/relaunch-client-defs] [H]
- bleedDamage 2, bleedDamageMult 1, no bag-size overrides [src:survev/shared/defs/maps/baseDefs.ts:86-88, derived/survev@9f64948d:src/defs/modes/main.ts:58-60] [H]
- Airdrop planes: circle 1 + 10 s and circle 3 + 2 s; crate weights `airdrop_crate_01` 10 : `airdrop_crate_02` (gold) 1 [src:survev/shared/defs/maps/baseDefs.ts:68-85, derived/survev@9f64948d:src/defs/modes/main.ts:40-56] [H]
- With gas waits of 80/65/50/40 s, these timings put airdrop #1 at 0:55 on the step-1 timer and #2 at 0:38 on step 3, as the fandom schedule says [src:survev/server/src/game/objects/gas.ts:21-62, fandom/Normal_Map] [H]
- Main Summer is (with the Snow Map) the only map that does not give the play button a special icon [src:fandom/Main_Summer_Map] [M]
- Win message "Winner winner chicken dinner!" (Korean 위너위너 치킨 디너!) [src:l10n/en:game-chicken, l10n/ko:game-chicken] [H]

## Spawns

### Fixed spawns (s = solo/duo, l = squad)

| id | building | main | main_spring | main_summer | src |
|---|---|---|---|---|---|
| `warehouse_01` | Warehouse | 1 s / 2 l (fork; orig 2) | 1/2 (orig 2) | 1/2 (orig 2) | [src:survev/shared/defs/maps/baseDefs.ts:915, balance/212, derived/git-ae55c9a8, derived/survev@9f64948d:src/defs/modes/main.ts:168] [H] |
| `warehouse_03` | Alternate Warehouse (fork) | 1 (orig absent) | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:916, balance/213, derived/git-ae55c9a8] [H] |
| `house_red_01` | Red House | 3/4 | 2/3 | 3/4 | [src:survev/shared/defs/maps/baseDefs.ts:917, survev/shared/defs/maps/mainSpringDefs.ts:69, survev/shared/defs/maps/mainSummerDefs.ts:63] [H] |
| `house_red_02` | Second Red House | 3/4 | 2/3 | 3/4 | [src:survev/shared/defs/maps/baseDefs.ts:918, survev/shared/defs/maps/mainSpringDefs.ts:70] [H] |
| `barn_01` | Barn | 1/3 | 1/3 | 1/3 | [src:survev/shared/defs/maps/baseDefs.ts:919] [H] |
| `barn_02` | Alternate Barn (basement, P30L chest) | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:920, fandom/Normal_Map] [H] |
| `hut_01` | Hut | 3 | 3 | 3 | [src:survev/shared/defs/maps/baseDefs.ts:921, fandom/Normal_Map] [H] |
| `hut_02` | Golden Hut (SPAS-12) | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:922, fandom/Normal_Map] [H] |
| `hut_03` | Scout Hut (Scout Elite) | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:923, fandom/Main_Summer_Map] [M] |
| `shack_03a` | Fisherman's Shack (bridge) | 2 | 2 | 2 | [src:survev/shared/defs/maps/baseDefs.ts:924] [H] |
| `shack_03b` | Fisherman's Shack (coast) | 2/3 | 2/3 | 2/3 | [src:survev/shared/defs/maps/baseDefs.ts:925] [H] |
| `greenhouse_01` | Greenhouse (Chrysanthemum bunker) | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:926] [H] |
| `cache_01` | stone cache | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:927] [H] |
| `cache_02` / `cache_02sp` / `cache_02su` | Mosin tree cache (`tree_03` / spring / summer skin) | 1 | 1 (`cache_02sp`) | 1 (`cache_02su`, orig `cache_02`) | [src:survev/shared/defs/maps/baseDefs.ts:928, survev/shared/defs/maps/mainSpringDefs.ts:80, survev/shared/defs/maps/mainSummerDefs.ts:74, derived/git-ae55c9a8] [H] |
| `cache_04` | river stone cache (fork, 2026-04-17) | 1 (orig absent) | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:929, derived/git-ae55c9a8] [H] |
| `cache_07` | barrel cache | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:930] [H] |
| `bunker_structure_01` | Egg bunker | p = 0.05 | p = 0.05 | p = 0.05 | [src:survev/shared/defs/maps/baseDefs.ts:931] [H] |
| `bunker_structure_02` | Hydra bunker | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:932] [H] |
| `bunker_structure_03` | Storm bunker | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:933] [H] |
| `bunker_structure_04` | Conch bunker | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:934] [H] |
| `bunker_structure_05` | Crossing bunker | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:935] [H] |
| `warehouse_complex_01` | Docks | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:936] [H] |
| `chest_01` | Treasure Chest | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:937] [H] |
| `chest_03` | River Chest | p = 0.2 | p = 0.2 | p = 0.2 | [src:survev/shared/defs/maps/baseDefs.ts:938] [H] |
| `mil_crate_02` | OT-38 crate | p = 0.25 | p = 0.25 | p = 0.25 | [src:survev/shared/defs/maps/baseDefs.ts:939, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1431] [H] |
| `tree_02` | wood-axe stump | 3 | 3 | 3 | [src:survev/shared/defs/maps/baseDefs.ts:940] [H] |
| `teahouse_complex_01su` / `teahouse_01` | Summer Teahouse Complex / bare Teahouse | 1/2 complexes | 2/3 bare teahouses | 1/2 complexes | [src:survev/shared/defs/maps/baseDefs.ts:941-944, survev/shared/defs/maps/mainSpringDefs.ts:93, survev/shared/defs/maps/mainSummerDefs.ts:87-90, fandom/Maps] [H] |
| `stone_04` | Hardstone Block (eye-block loot) | 1 | 1 | 1 | [src:survev/shared/defs/maps/baseDefs.ts:945] [H] |
| `club_complex_01` | Crimson Ring Club | 1 at map centre (location spawn r150, retry on failure, "important") | same | same | [src:survev/shared/defs/maps/baseDefs.ts:879-886, survev/shared/defs/maps/baseDefs.ts:955] [H] |

- Random building rotation: 2 of `mansion_structure_01`, `police_01`, `bank_01` per game [src:survev/shared/defs/maps/baseDefs.ts:948-953, changelog/0.7.7, fandom/Normal_Map] [H]
- Place spawns (buildings placed at named places first): `warehouse_01`, `house_red_01`, `house_red_02`, `barn_01` [src:survev/shared/defs/maps/baseDefs.ts:887] [H]
- survev's first-commit main def lists `hut_01: 4`, `hut_02: 1` and no `hut_03`, while survev today and the wiki use 3 huts + golden hut + scout hut (see Conflicts) [src:derived/survev@9f64948d:src/defs/modes/main.ts:173-174, survev/shared/defs/maps/baseDefs.ts:921-923, fandom/Normal_Map] [L]
- fandom counts "5 huts: 3 normal, one gold, one scout" on the normal map [src:fandom/Normal_Map] [M]
- fandom says the Main Summer map always spawns a Scout Hut whose green pot drops Island Time and a Scout Elite; 0.7.9 secretly stopped Island Time spawning in gold pots [src:fandom/Main_Summer_Map, fandom/Maps, fandom/Changelog] [M]

### Density spawns (per 250 000 shore area)

| id | object | main | main_spring | main_summer | src |
|---|---|---|---|---|---|
| `stone_01` | stone | 350 | 350 | 350 | [src:survev/shared/defs/maps/baseDefs.ts:891] [H] |
| `barrel_01` | barrel | 76 | 76 | 76 | [src:survev/shared/defs/maps/baseDefs.ts:892] [H] |
| `silo_01` | silo | 8 | 8 | 8 | [src:survev/shared/defs/maps/baseDefs.ts:893] [H] |
| `crate_01` / `crate_02` / `crate_03` | crate / Soviet crate / grenade crate | 50 / 4 / 8 | same | same | [src:survev/shared/defs/maps/baseDefs.ts:894-896] [H] |
| `bush_01` | bush (summer: replaced by `bush_01f`) | 78 | 78 | 78 → `bush_01f` | [src:survev/shared/defs/maps/baseDefs.ts:897, survev/shared/defs/maps/mainSummerDefs.ts:94] [H] |
| `cache_06` | berry bush cache | 12 | 12 | 12 | [src:survev/shared/defs/maps/baseDefs.ts:898] [H] |
| `tree_01` | tree (spring → `tree_07sp`, summer → `tree_08su`) | 320 | replaced by cherry trees below | 320 → `tree_08su` | [src:survev/shared/defs/maps/baseDefs.ts:899, survev/shared/defs/maps/mainSpringDefs.ts:97, survev/shared/defs/maps/mainSummerDefs.ts:47, survev/shared/defs/maps/mainSummerDefs.ts:94] [H] |
| `tree_07sp` / `tree_08sp` / `tree_08spb` | spring cherry trees (normal, large, large-b) | – | 300 / 30 / 30 | – | [src:survev/shared/defs/maps/mainSpringDefs.ts:49-51] [H] |
| `tree_07spr` / `tree_08spr` | spring river-shore cherry trees (density per river shore area / 15000) | – | 160 / 80 | – | [src:survev/shared/defs/maps/mainSpringDefs.ts:52-53, survev/server/src/game/map.ts:1113-1121] [H] |
| `tree_13` | palm tree (fork, beach) | 30 (orig absent) | – | – | [src:survev/shared/defs/maps/baseDefs.ts:900, balance/209, derived/git-ae55c9a8] [H] |
| `hedgehog_01` | hedgehog | 24 | 24 | 24 | [src:survev/shared/defs/maps/baseDefs.ts:901] [H] |
| `container_01`–`04` | containers | 5 each | 5 each | 5 each | [src:survev/shared/defs/maps/baseDefs.ts:902-905] [H] |
| `shack_01` | shack | 7 | 7 | 7 | [src:survev/shared/defs/maps/baseDefs.ts:906] [H] |
| `outhouse_01` | outhouse | 5 | 5 | 5 | [src:survev/shared/defs/maps/baseDefs.ts:907] [H] |
| `loot_tier_1` / `loot_tier_beach` | ground loot / beach loot | 24 / 4 | 24 / 4 | 24 / 4 | [src:survev/shared/defs/maps/baseDefs.ts:908-909] [H] |

- fandom: the spring map has more trees than the normal map and trees grow along the river [src:fandom/Main_Spring_Map, fandom/Maps] [M]
- Spring replaces `tree_01` with `tree_07sp`; summer replaces `bush_01` → `bush_01f` and `tree_01` → `tree_08su` (also inside buildings) [src:survev/shared/defs/maps/mainSpringDefs.ts:97, survev/shared/defs/maps/mainSummerDefs.ts:94] [H]

## Loot

> survev marks its own main loot table as "not the original one", with `?` = statistical guesses and `!` = uncertain leak data. Full tier contents belong in `mechanics/loot.md`; only map-specific points are listed here.

- Header comment of survev's main loot table: "this loot table is not the original one so its not accurate" [src:survev/shared/defs/maps/baseDefs.ts:90-92] [H]
- main `tier_guns` most common entries: M9 19, MP5 10, M870 9, OT-38 8, G18C 7, MAC-10 6, M1100 6, M93R 5, HK416 4 [src:survev/shared/defs/maps/baseDefs.ts:253-286] [M]
- Fork change: survev's main `tier_guns` has mosin 0.05, scout_elite 0.1, vss 0.1; the pre-fork table and fandom have mosin 0.1, scout_elite 0.05 (VSS weight unknown, fandom estimate 0.1) [src:survev/shared/defs/maps/baseDefs.ts:263, survev/shared/defs/maps/baseDefs.ts:284-285, derived/git-ae55c9a8, fandom/Loot_tables/Basic] [H]
- Fork change: BAR M1918 (`bar`) in main `tier_guns` 0.05, `tier_chest` 0.27, `tier_hatchet` 0.25 (replacing hk416 0.25) and `tier_airdrop_uncommon` 1; originally BAR was absent on the normal map after 0.7.9 [src:balance/146, survev/shared/defs/maps/baseDefs.ts:262, derived/git-ae55c9a8, changelog/0.7.9] [H]
- Fork change: `tier_airdrop_uncommon` mosin 1.5 / scout_elite 2.5 / vss 2.5; pre-fork and fandom have mosin 2.5, scout_elite 1.5 [src:survev/shared/defs/maps/baseDefs.ts:600, survev/shared/defs/maps/baseDefs.ts:609-610, derived/git-ae55c9a8, fandom/Loot_tables] [H]
- Fork change: `tier_airdrop_mythic` (gold airdrops) usas 1, awc 0.75, pkp 1, m249 1, sv98 1, barrett 1; originals usas 0.5, awc 0.1, pkp 0.3, m249 0.3, no sv98, no barrett [src:balance/276, balance/277, balance/330, survev/shared/defs/maps/baseDefs.ts:627-636] [H]
- Fork change: main `tier_outfits` weights CobaltShell 0.3, KeyLime 0.25, Woodland 0.3, Camo 0.2 (orig 0.2 / 0.15 / 0.1 / 0.1), Ghillie 0.01 unchanged [src:survev/shared/defs/maps/baseDefs.ts:396-402, derived/git-ae55c9a8] [M]
- `tier_chrys_03` (Chrysanthemum chest scopes) is 4x 7.5 / 8x 5 / 15x 0.25 in survev; pre-fork 2x 5 / 4x 5 / 8x 5 / 15x 0.1 (fork chrysanthemum bunker rework, 2026-05-30) [src:survev/shared/defs/maps/baseDefs.ts:205-209, derived/git-ae55c9a8] [M]
- `tier_barn_melee` (alternate-barn basement) holds the sledgehammer on main; it was named `tier_sledgehammer` before the fork refactor [src:survev/shared/defs/maps/baseDefs.ts:246, derived/git-ae55c9a8] [H]
- `tier_perks` on main gained fork entries `bonus_45` and `high_velocity`; `high_velocity` is a fork perk [src:survev/shared/defs/maps/baseDefs.ts:760-762, derived/git-ae55c9a8] [M]
- Spring override: `tier_chrys_case` (teahouse chrysanthemum chest) = nothing 2, `helmet03_moon` (Tsukuyomi no Kabuto) 3, `tier_katanas` 3, naginata 1, marked "not from the leak"; main's chest is nothing 5, katanas 3, naginata 1 [src:survev/shared/defs/maps/mainSpringDefs.ts:29-37, survev/shared/defs/maps/baseDefs.ts:210-214] [M]
- Tsukuyomi no Kabuto (0.7.3) is a level-3 helmet reskin found only on the spring map, from the teahouse chest; it grants no perk [src:fandom/Changelog, fandom/Maps, wikigg/Classic_mode] [H]
- The naginata is a spring-mode teahouse melee per fandom ("spring mode only") [src:fandom/Teahouse, changelog/0.7.3] [M]
- main_summer has no loot override; its only content differences are trees, bush, colours and the summer mosin-tree skin [src:survev/shared/defs/maps/mainSummerDefs.ts:5-97] [H]

## Perks

- No perks spawn as world loot on main / spring / summer in 0.8.82 apart from role perks; `tier_perks` is used by potato, savannah and gold desert drops, not by main spawns [src:survev/shared/defs/maps/baseDefs.ts:746-763, fandom/Normal_Map] [M]

## Trivia and descriptions

- fandom: the Normal Map is "the map in use when there is no event going on"; special buildings bank, police station, mansion, hydra bunker, docks, greenhouse, teahouse complex, Crimson Ring Club [src:fandom/Normal_Map] [M]
- fandom spring map: 2 (3 squad) teahouses instead of complexes, pink trees, ground "a few hexes darker", big trees and more trees along rivers, small pink leaves falling [src:fandom/Maps] [M]
- survev.wiki.gg: .45 ACP weapons do not spawn by default in Classic mode; only frag, smoke and MIRV throwables [src:wikigg/Classic_mode] [M]
- Wiki: the Main Summer map is "similar to the Main Spring Map" with greener grass and summer trees and bushes [src:fandom/Main_Summer_Map] [M]
- Christmas 2017 and the early snow test turned the normal map's trees into decorated trees (pre-0.6.9) [src:fandom/Snow_Map, fandom/Removed_Features] [M]
- Korean community names: 봄 이벤트 (Spring Fever) for the spring map [src:namu/Surviv.io/이벤트] [M]

## Conflicts

- CONFLICT main-summer-colours: survev main_summer beach 0xdc9e28 / riverbank 0xa37119 / grass 0x629522 (same as woods_summer and the fandom Woods Summer infobox) [src:survev/shared/defs/maps/mainSummerDefs.ts:27-29, fandom/Woods_Map] vs fandom Main Summer infobox beach 0xf4ae48 / riverbank 0x905e24 / grass 0x5c910a (spring values) [src:fandom/Main_Summer_Map]; proposed: keep survev (the wiki row looks copied from Main Spring), expose as config [L]
- CONFLICT main-hut-mix: 3 `hut_01` + `hut_02` + `hut_03` [src:survev/shared/defs/maps/baseDefs.ts:921-923, fandom/Normal_Map] vs 4 `hut_01` + `hut_02`, no scout hut [src:derived/survev@9f64948d:src/defs/modes/main.ts:173-174]; proposed: 3+1+1 (wiki and current survev agree) [L]
- CONFLICT main-tier-guns-snipers: mosin 0.05 / scout_elite 0.1 / vss 0.1 [src:survev/shared/defs/maps/baseDefs.ts:263] vs mosin 0.1 / scout_elite 0.05 / vss ~0.1 [src:derived/git-ae55c9a8, fandom/Loot_tables/Basic]; proposed: original mosin 0.1, scout_elite 0.05, vss 0.1 [M]
- CONFLICT spring-release-date: Mar 21, 2019 [src:changelog/0.7.3] vs Mar 20, 2019 [src:fandom/Teahouse, fandom/Maps]; proposed: Mar 21 (changelog; likely a time-zone difference) [L]
- CONFLICT main-warehouses: `warehouse_01` 1/2 + fork `warehouse_03` 1 [src:survev/shared/defs/maps/baseDefs.ts:915-916] vs `warehouse_01` 2 [src:derived/git-ae55c9a8, balance/212]; proposed: original 2 × `warehouse_01`, no `warehouse_03` [H]

## Open questions

- When did main_spring stop being the default map in 2019 (fandom only implies the summer complex replaced the spring one on Jul 14, 2019)? [src:fandom/Changelog, fandom/Teahouse] [L]
- Original weights of the main loot tables are unknown; survev's own table is a statistical guess [src:survev/shared/defs/maps/baseDefs.ts:90-92] [M]
- Korean community name for the plain normal map (only event names are found in namu.wiki snippets) [src:namu/Surviv.io/이벤트] [L]
- Whether `cache_06` (berry bush cache) density 12 and `tree_02` count 3 match the original; only the survev reconstructions agree [src:survev/shared/defs/maps/baseDefs.ts:898, derived/git-ae55c9a8] [L]
