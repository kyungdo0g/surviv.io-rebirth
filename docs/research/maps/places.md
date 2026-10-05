# Places and landmarks

> Named places (the labels on the minimap), their coordinates and meanings per map, how the generator ties buildings to them, and the landmark buildings each map always tries to place.
> Building internals and loot are in `buildings.md` / `bunkers.md`; this file only covers where landmarks go and why they matter.
> Coordinates are the map-def `pos` values: x from the left edge and y from the top edge of the minimap, as fractions of the map size (derived from the client render code below).

## How places work

- Each map def has `mapGen.places`: a list of `{name, pos}` with optional `dontSpawnObjects` [src:survev/shared/defs/mapDefs.ts:229] [src:survev/shared/defs/maps/baseDefs.ts:839-872] [H]
- Places are sent to the client in the map message (array length field of 8 bits) and are not part of the client bundle [src:survev/shared/net/mapMsg.ts:120-122] [src:survev/server/src/game/map.ts:338-341] [src:kong/relaunch-client-defs] [H]
- The client writes each name at `(pos.x × size, pos.y × size)` in screen space (y down) on the full map texture: Arial bold, 22 px (20 px on mobile), white fill, black 1 px stroke, drop shadow, centred, alpha 0.75 [src:survev/client/src/map.ts:629-652] [H]
- The server converts a place to world space (y up) as `(pos.x × width, (1 − pos.y) × height)` ("places Y axis is inverted lol") [src:survev/server/src/game/map.ts:592-600] [H]
- Fandom: "Location names can be seen on the Minimap. Because maps are auto-generated, these have no actual meaning" [src:fandom/Maps] [M]
- Place spawns (survev): each type in `customSpawnRules.placeSpawns` is reserved around a different random place (not `dontSpawnObjects`), at a random point within half of its 1.15-scaled bounds, clamped inside the shore [src:survev/server/src/game/map.ts:586-648] [H]
- Main and its variants reserve `warehouse_01`, `house_red_01`, `house_red_02` and `barn_01`, so 4 of the 8 Main places get one of these buildings next to the label [src:survev/shared/defs/maps/baseDefs.ts:887] [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:365-370] [H]
- Desert reserves `desert_town_02` and `desert_town_01` (survev swapped the order in 2025 so the small town is placed first) [src:survev/shared/defs/maps/desertDefs.ts:294] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:245-248] [src:derived/survev-git-def791af] [H]
- Fandom: the small desert town "is usually named 'Los Perdidos' on the minimap", which fits towns being placed at place labels [src:fandom/Desert_Town] [M]
- Woods sets no place spawns ("since placespawns now create river masks", which would block the lake) [src:survev/shared/defs/maps/woodsDefs.ts:205-208] [H]

## Main (Normal) — also Main Spring, Main Summer, Potato, Potato Spring, Snow, Woods (all variants), Savannah, Cobalt, Turkey

| name | pos (x, y) | minimap region (derived) | meaning (fandom) | sources |
|---|---|---|---|---|
| The Killpit | 0.53, 0.64 | just south of centre | – | [src:survev/shared/defs/maps/baseDefs.ts:840-843] [src:derived/survev@9f64948d:src/defs/modes/main.ts:90-93] [src:fandom/Maps] [H] |
| Sweatbath | 0.84, 0.18 | north-east | slang for sauna | [src:survev/shared/defs/maps/baseDefs.ts:844-847] [src:fandom/Maps] [H] |
| Tarkhany | 0.15, 0.11 | north-west corner | after a locality in Russia | [src:survev/shared/defs/maps/baseDefs.ts:848-851] [src:fandom/Maps] [H] |
| Ytyk-Kyuyol | 0.25, 0.42 | west | "Holy Lake" in Yakut, after a settlement in Yakutia, Russia | [src:survev/shared/defs/maps/baseDefs.ts:852-855] [src:fandom/Maps] [H] |
| Todesfelde | 0.81, 0.85 | south-east corner | "Field of Death", after a location in Germany | [src:survev/shared/defs/maps/baseDefs.ts:856-859] [src:fandom/Maps] [H] |
| Pineapple | 0.21, 0.79 | south-west | – | [src:survev/shared/defs/maps/baseDefs.ts:860-863] [src:fandom/Maps] [H] |
| Fowl Forest | 0.73, 0.47 | east | – | [src:survev/shared/defs/maps/baseDefs.ts:864-867] [src:fandom/Maps] [H] |
| Ranchito Pollo | 0.53, 0.25 | north of centre | "chicken farm" in Spanish | [src:survev/shared/defs/maps/baseDefs.ts:868-871] [src:fandom/Maps] [H] |

- These 8 names and coordinates are identical in survev's first commit and now [src:derived/survev@9f64948d:src/defs/modes/main.ts:89-122] [src:survev/shared/defs/maps/baseDefs.ts:839-872] [H]
- Fandom lists "Cordial Creek" as a removed name that was "replaced by Todesfelde" [src:fandom/Maps] [M]
- The variant maps listed in the heading do not override `places`, so they inherit Main's 8 labels in survev [src:derived/mapdefs-dump] [src:survev/shared/defs/maps/woodsDefs.ts:162-266] [H]
- wiki.gg's Classic infobox lists only 7 places (no Todesfelde) [src:wikigg/Classic_mode] [M]

## Desert

| name | pos (x, y) | notes | sources |
|---|---|---|---|
| Blood Gulch | 0.51, 0.5 | centre; marks River Town 2 (`river_town_02`, location spawn at the same point, radius 50); survev adds `dontSpawnObjects` so no place spawn goes here (fork) | [src:survev/shared/defs/maps/desertDefs.ts:267-271] [src:survev/shared/defs/maps/desertDefs.ts:286-293] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:218-244] [src:derived/survev-git-def791af] [H] |
| Southhaven | 0.35, 0.76 | south-west; "haven" = area of safety (fandom) | [src:survev/shared/defs/maps/desertDefs.ts:272-275] [src:fandom/Desert_Map] [H] |
| Atonement | 0.8, 0.4 | east; reparation for a wrong / sin (fandom) | [src:survev/shared/defs/maps/desertDefs.ts:276-279] [src:fandom/Desert_Map] [H] |
| Los Perdidos | 0.33, 0.25 | north-west; Spanish "the Lost (Ones)" | [src:survev/shared/defs/maps/desertDefs.ts:280-283] [src:fandom/Desert_Map] [src:fandom/Maps] [H] |

- Fandom: Los Perdidos, Atonement and "Southaven" were added for the second desert update; Blood Gulch for the fourth (0.7.1 "Danger close", Feb 22, 2019) [src:fandom/Maps] [src:fandom/River_Town] [src:changelog/0.7.1] [M]
- Fandom: "Blood Gulch" is a narrow steep-sided ravine; the area has a paved centre with two aged faction statues hiding underground storage [src:fandom/Desert_Map] [M]
- Fandom spells the place "Southaven" in one list and "Southhaven" in another; the def says "Southhaven" [src:fandom/Maps] [src:fandom/Desert_Map] [src:survev/shared/defs/maps/desertDefs.ts:273] [H]

## 50v50 (faction) — also Potato vs Tomato (fork)

| name | pos (x, y) | notes | sources |
|---|---|---|---|
| Riverside | 0.51, 0.5 | centre; the River Town (`river_town_01`) placed on the main river at t 0.45–0.55 | [src:survev/shared/defs/maps/factionDefs.ts:417-424] [src:survev/server/src/game/map.ts:738-742] [src:derived/survev@33832ffe:src/defs/maps/factionDefs.ts:283-296] [H] |
| Pineapple | 0.84, 0.18 | north-east (Main's Sweatbath spot) | [src:survev/shared/defs/maps/factionDefs.ts:417-424] [H] |
| Tarkhany | 0.21, 0.79 | south-west (Main's Pineapple spot) | [src:survev/shared/defs/maps/factionDefs.ts:417-424] [H] |

- Fandom: Riverside was added with 50v50 in 0.7.0 "Incursion recursion" (Jan 31, 2019) [src:fandom/Maps] [src:fandom/River_Town] [src:changelog/0.7.0] [M]
- The faction river's direction (horizontal or vertical) is random each game, but the three labels are fixed, so they do not always sit on a specific team's side (derived) [src:survev/server/src/game/map.ts:350-352] [src:survev/server/src/game/riverCreator.ts:20-41] [M]

## Halloween

- survev's Halloween defines no `places`, so it shows Main's 8 names [src:survev/shared/defs/maps/halloweenDefs.ts:201-276] [src:derived/mapdefs-dump] [H]
- Fandom: for the 2019 Halloween map almost every place was renamed (2018 used the normal names) [src:fandom/Maps] [src:fandom/Halloween_Map] [M]

| original name | Halloween 2019 name | meaning (fandom) | sources |
|---|---|---|---|
| Tarkhany | Tarscary | – | [src:fandom/Maps] [src:fandom/Halloween_Map] [M] |
| Sweatbath | Bloodbath | – | [src:fandom/Maps] [src:fandom/Halloween_Map] [M] |
| Ranchito Pollo | Ranchito Muerto | "Dead Farm" in Spanish | [src:fandom/Maps] [src:fandom/Halloween_Map] [M] |
| Ytyk-Kyuyol | Strashny Prizrak / Strashnyy Prizrak | "scary ghost" in Russian | [src:fandom/Maps] [src:fandom/Halloween_Map] [M] |
| Fowl Forest | Haunted Hollow | – | [src:fandom/Halloween_Map] [M] |
| Pineapple | Pumpkin | – | [src:fandom/Maps] [src:fandom/Halloween_Map] [M] |
| Todesfelde | Fields of Death | – | [src:fandom/Maps] [src:fandom/Halloween_Map] [M] |
| The Killpit | The Killpit (unchanged) | – | [src:fandom/Maps] [src:fandom/Halloween_Map] [M] |

## Fork maps

| map | places (pos) | sources |
|---|---|---|
| beach (fork) | The Sandpit (0.53, 0.64), Sunburn (0.84, 0.18), Okhotsk (0.15, 0.11), Ytyk-Plaz (0.25, 0.42), Todesinsel (0.81, 0.85), Coconut (0.21, 0.79), Sandy Shores (0.73, 0.47), Playa Pollo (0.53, 0.25) — Main's positions with beach puns | [src:survev/shared/defs/maps/beachDefs.ts:153-186] [H] |
| birthday (fork) | Main's names minus Ranchito Pollo, with "Cordial Creek" at Todesfelde's position (0.81, 0.85) | [src:survev/shared/defs/maps/birthdayDefs.ts:121-150] [H] |
| test_normal, test_faction (fork) | Main's 8 | [src:survev/shared/defs/maps/testDefs.ts:1-40] [H] |

## Landmarks per map

> "Important" here means the map def's `importantSpawns` (placed first, 5000 attempts) or a location spawn; the rest are unique buildings with a fixed count of 1. Counts are survev values with the orig import in brackets where it differs.

### Main (Normal)

| landmark (id) | how it is placed | sources |
|---|---|---|
| Crimson Ring Club (`club_complex_01`: club + bathhouse basement + shack) | important spawn; location spawn within 150 of the centre, re-queued as a normal spawn if that fails | [src:survev/shared/defs/maps/baseDefs.ts:879-886] [src:survev/shared/defs/maps/baseDefs.ts:955] [src:derived/club-children] [H] |
| Docks (`warehouse_complex_01`: 3 blue warehouses, 2 green shacks, containers, bollards) | 1, on the shoreline (`waterEdge` dir (−1,0), dist 72) | [src:survev/shared/defs/maps/baseDefs.ts:936] [src:kong/relaunch-client-defs] [src:fandom/Docks] [H] |
| 2 of Mansion (`mansion_structure_01`), Police Station (`police_01`), Bank (`bank_01`) | `randomSpawns` choose 2 ("Building Rotation", 0.7.7) | [src:survev/shared/defs/maps/baseDefs.ts:948-953] [src:fandom/Building_Rotation] [H] |
| Greenhouse (`greenhouse_01`) with the Chrysanthemum bunker (`bunker_structure_08`) below | 1 | [src:survev/shared/defs/maps/baseDefs.ts:926] [src:derived/greenhouse-children] [H] |
| Teahouse Complex (`teahouse_complex_01su`) | 1 solo/duo, 2 squad | [src:survev/shared/defs/maps/baseDefs.ts:941-944] [H] |
| Hydra, Storm, Conch, Crossing bunkers (`bunker_structure_02`–`05`) | 1 each; Egg bunker (`bunker_structure_01`) with odds 0.05 | [src:survev/shared/defs/maps/baseDefs.ts:931-935] [H] |
| Alternate Barn (`barn_02`, basement with sledgehammer) | 1 (normal `barn_01` 1/3) | [src:survev/shared/defs/maps/baseDefs.ts:919-920] [src:wikigg/Classic_mode] [H] |
| Gold hut (`hut_02`, "spas hut") and Scout Hut (`hut_03`) | 1 each, on the water edge with 3 normal huts | [src:survev/shared/defs/maps/baseDefs.ts:921-923] [src:fandom/Normal_Map] [H] |
| Caches: stone (`cache_01`), mosin tree (`cache_02`), barrel (`cache_07`) 1 each; berry bush caches (`cache_06`) by density 12; river stone cache (`cache_04`, fork) | fixed / density | [src:survev/shared/defs/maps/baseDefs.ts:927-930] [src:survev/shared/defs/maps/baseDefs.ts:898] [src:balance/150-166] [H] |
| Treasure chest (`chest_01`) 1, river chest (`chest_03`) odds 0.2, OT-38 crate (`mil_crate_02`) odds 0.25, hardstone block (`stone_04`) 1, wood-axe stumps (`tree_02`) 3 | fixed | [src:survev/shared/defs/maps/baseDefs.ts:937-945] [H] |

- wiki.gg lists Police Station, Mansion, Bank, Docks, Crimson Ring Club and Hydra Bunker as Classic's major structures [src:wikigg/Classic_mode] [M]
- Fandom: Docks were added in 0.4.0 "Log and load" (June 2, 2018) as "the Island's once-bustling port", the largest building area, with up to 17 containers [src:fandom/Docks] [src:changelog/0.4.0] [H]
- Fandom: the Club (0.7.7, May 30, 2019) has a car park, lounge, a switch-coded vault with a machete, and a bathhouse basement with saunas that heal and a pool that turns red after 6 kills [src:fandom/Crimson_Ring_Club] [src:changelog/0.7.7] [M]
- Main Spring (orig) spawns Bank, Police and Mansion together with no club and 2/3 teahouses instead of the complex; survev uses Main's club + trio [src:derived/survev@33832ffe:src/defs/maps/mainSpringDefs.ts:51-81] [src:survev/shared/defs/maps/mainSpringDefs.ts:65-96] [H]
- Main Summer: teahouse complex and scout hut; fandom says the summer map has "a Scout Hut instead of the Gold Hut" [src:derived/survev@33832ffe:src/defs/maps/mainSummerDefs.ts:54-87] [src:fandom/Maps] [M]

### Desert

| landmark (id) | how it is placed | sources |
|---|---|---|
| Blood Gulch / River Town 2 (`river_town_02`: two aged faction statues `statue_structure_03/04` with underground rooms, a meteor case) | important; location spawn at (0.51, 0.5) radius 50, no retry; a radius-80 river mask keeps rivers away from the centre | [src:survev/shared/defs/maps/desertDefs.ts:263] [src:survev/shared/defs/maps/desertDefs.ts:286-293] [src:derived/river-town-children] [H] |
| Large Desert Town (`desert_town_01`: saloon with cellar, police station, bank, barn, 2 cabins, archways, cattle crates) | important; place spawn | [src:survev/shared/defs/maps/desertDefs.ts:294] [src:survev/shared/defs/maps/desertDefs.ts:351] [src:fandom/Desert_Town] [src:derived/desert-town-children] [H] |
| Small Desert Town (`desert_town_02`, orig: 2 archways, red house, second red house, bank, shack, outhouse, cattle crate) | important; place spawn; survev rebuilt it around The Reserve (fork 0.3.1) | [src:kong/relaunch-client-defs] [src:fandom/Desert_Town] [src:balance/317] [H] |
| Aged Greenhouse (`greenhouse_02`) with the aged Chrysanthemum bunker | 1 | [src:survev/shared/defs/maps/desertDefs.ts:318-340] [src:fandom/Maps] [H] |
| Alternate barn `barn_02d`, Storm bunker, Egg bunker (odds 0.05), river chest `chest_03d` (odds 1), 6 hardstone boulders `stone_05`, 12 cattle crates `crate_18` | fixed | [src:survev/shared/defs/maps/desertDefs.ts:318-340] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:272-294] [H] |
| Oasis (`oasis_01`) | lake centre (fork, 2026) | [src:survev/shared/defs/maps/desertDefs.ts:237-250] [src:wikigg/Oasis] [H] |

- Fandom: many Normal buildings (Mansion, most bunkers) are absent from Desert [src:fandom/Desert_Map] [M]

### 50v50 (faction)

| landmark (id) | how it is placed | sources |
|---|---|---|
| River Town / Riverside (`river_town_01`: extra-large bridge, barn, two red houses, 6 containers, 2 blue warehouses, 2 green shacks, 2 faction statues, one Soviet and one Initiative crate) | first faction bridge, t 0.45–0.55 on the main river; red houses face red | [src:survev/server/src/game/map.ts:728-813] [src:derived/river-town-children] [src:fandom/River_Town] [H] |
| Police Station, Bank, Mansion, Docks | important spawns, 1 each | [src:survev/shared/defs/maps/factionDefs.ts:456-500] [H] |
| 6 team warehouses `warehouse_01f`, 4+4 red houses, 4 barns | fixed, on the outer strips | [src:survev/shared/defs/maps/factionDefs.ts:456-482] [src:survev/server/src/game/map.ts:1567-1572] [H] |
| Greenhouse and Storm bunker | in the inner strips, near the river | [src:survev/server/src/game/map.ts:1584-1588] [src:fandom/50v50_Map] [H] |
| Egg bunker (odds 1), Conch bunker, OT-38 crate (odds 1), river chest `chest_03f` | fixed | [src:survev/shared/defs/maps/factionDefs.ts:456-482] [H] |

- Fandom: the River Town's town part faces the red half and the warehouse part the blue half; Bank and Mansion are on the red side, Police Station and Docks on the blue side [src:fandom/50v50_Map] [M]
- Fandom: the 50v50 map lacks the Hydra and Crossing bunkers [src:fandom/Maps] [src:survev/shared/defs/maps/factionDefs.ts:456-482] [H]

### Woods

| landmark (id) | how it is placed | sources |
|---|---|---|
| Large Logging Complex (`logging_complex_01`: blue warehouse, Hatchet bunker, 2 outhouses one possibly the fire-axe outhouse, containers, crates, chest or flare-gun case, log piles, axe stumps) | location spawn within 200 of the centre, retry | [src:survev/shared/defs/maps/woodsDefs.ts:196-204] [src:fandom/Logging_Complex] [src:derived/logging-complex-children] [H] |
| Medium logging complex (`logging_complex_02`: crates, 2 ammo crates and a giant oak cache `tree_08c`) | 1 | [src:survev/shared/defs/maps/woodsDefs.ts:228-253] [src:wikigg/Logging_Complexes] [src:fandom/Grass] [M] |
| Small logging complexes (`logging_complex_03`) | 3 (survev; not in the orig import) | [src:survev/shared/defs/maps/woodsDefs.ts:228-253] [src:derived/survev-git-ad996608] [src:wikigg/Logging_Complexes] [M] |
| Lake with Pavilion (`teapavilion_01w`, Shishigami no Kabuto helmet) | lake centre, lake within 100 of the map centre | [src:survev/shared/defs/maps/woodsDefs.ts:168-179] [src:wikigg/Pavilion] [src:fandom/Lake] [H] |
| Eye bunker (`bunker_structure_07`), Storm bunker, Egg bunker (`bunker_structure_01b`) | 1 each | [src:survev/shared/defs/maps/woodsDefs.ts:228-253] [src:fandom/Woods_Map] [H] |
| Workshop (`workshop_complex_01`) | 1 (fork 0.2.2) | [src:survev/shared/defs/maps/woodsDefs.ts:228-253] [src:balance/230] [H] |

- Fandom: Woods lacks the Bank, Docks and Police Station; only warehouses, red houses and cabins plus the logging complex [src:fandom/Maps] [M]
- wiki.gg: the large logging complex was the only source of the USAS-12 (via the Hatchet bunker) [src:wikigg/Logging_Complexes] [M]

### Halloween, Potato, Snow, Savannah, Cobalt, Turkey

| map | landmarks | sources |
|---|---|---|
| halloween | Junkyard (`junkyard_01`: withered tree cache `tree_05b` ringed by 5 candles, random fridges/ovens/tables/toilets/vending machines/leaf piles), Halloween mansion `mansion_structure_02`, Eye bunker `bunker_structure_07`; survev removed the club location spawn | [src:survev/shared/defs/maps/halloweenDefs.ts:239-267] [src:kong/relaunch-client-defs] [src:fandom/Junkyard] [src:derived/survev-git-4dbd2ed8] [H] |
| potato | Silo Shack (`shilo_01`, breakable 2500-HP potato silo with the Spud Gun) at the centre (survev location spawn); Main landmarks otherwise | [src:survev/shared/defs/maps/potatoDefs.ts:163-173] [src:wikigg/Silo_Shack] [src:changelog/0.8.82] [H] |
| snow | Main landmarks re-skinned (`x` variants); survev adds camps `camp_01` (fork) | [src:survev/shared/defs/maps/snowDefs.ts:229-268] [src:balance/228] [H] |
| savannah (fork reconstruction) | mansion, central lake (survev: Cloud bunker, fork), hunting perches, savannah/kopje patches | [src:survev/shared/defs/maps/savannahDefs.ts:196-303] [src:fandom/Savannah_Map] [H] |
| cobalt (fork reconstruction) | Twins bunker (`bunker_structure_09`) location spawn at the centre (important), club, docks; twins sublevel doors unlock 30 s after circle 1 | [src:survev/shared/defs/maps/cobaltDefs.ts:109-193] [src:survev/shared/defs/maps/cobaltDefs.ts:45-52] [src:balance/301] [H] |
| turkey (fork reconstruction) | Main landmarks; gold and scout huts only at odds 0.05 | [src:survev/shared/defs/maps/turkeyDefs.ts:78-109] [H] |

- Fandom: the Twins bunker was added in 0.8.8 (cobalt map only) and the silo shack in 0.8.82 (potato map only) [src:changelog/0.8.8] [src:changelog/0.8.82] [H]
- Fandom: if a Silo Shack or the Cobalt club is blocked from its normal location it is relocated, so they can appear off-centre [src:fandom/Maps] [M]

## Conflicts

- CONFLICT halloween-place-names: survev Halloween uses Main's names [src:survev/shared/defs/maps/halloweenDefs.ts:201-276] vs fandom's 2019 Halloween names (Tarscary, Bloodbath, Ranchito Muerto, Strashny Prizrak, Haunted Hollow, Pumpkin, Fields of Death, The Killpit) [src:fandom/Maps] [src:fandom/Halloween_Map]; proposed: use the 2019 names for Halloween 0.8.82 at Main's coordinates (pairing by original name) [M]
- CONFLICT classic-place-count: wiki.gg Classic lists 7 places without Todesfelde [src:wikigg/Classic_mode] vs 8 places in the def [src:survev/shared/defs/maps/baseDefs.ts:839-872] and fandom [src:fandom/Maps]; proposed: 8 [H]
- CONFLICT desert-small-town: survev `desert_town_02` contains The Reserve (fork) [src:balance/317] vs the original small town (red houses, bank, shack, outhouse) [src:kong/relaunch-client-defs] [src:fandom/Desert_Town]; proposed: original layout [H]
- CONFLICT southhaven-spelling: "Southaven" [src:fandom/Maps] vs "Southhaven" [src:survev/shared/defs/maps/desertDefs.ts:273] [src:fandom/Desert_Map]; proposed: "Southhaven" (def) [M]
- CONFLICT strashny-spelling: "Strashny Prizrak" [src:fandom/Maps] vs "Strashnyy Prizrak" [src:fandom/Halloween_Map]; proposed: "Strashny Prizrak" [L]

## Open questions

- Coordinates of the Halloween 2019 labels (assumed identical to Main's) and whether 2019's Haunted Hollow replaced Fowl Forest [src:fandom/Halloween_Map] [src:fandom/Maps] [L]
- Whether the original server tied buildings to place labels as survev's `placeSpawns` does, beyond fandom's Los Perdidos remark [src:fandom/Desert_Town] [src:survev/server/src/game/map.ts:586-648] [L]
- When "Cordial Creek" was renamed to Todesfelde (fandom gives no version) [src:fandom/Maps] [L]
- Place names for original Savannah, Cobalt and Turkey (survev inherits Main's) [src:derived/mapdefs-dump] [L]
