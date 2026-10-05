# Map generation

> How a surviv.io island is generated: map size, terrain (ocean, beach, grass), rivers, lakes, bridges, the object spawn pipeline, the player spawn algorithm, seeds, and the per-map spawn tables.
> Server code is survev `server/src/game/map.ts` and `riverCreator.ts`; terrain and river polygons are shared client code in `shared/utils/terrainGen.ts` and `shared/utils/river.ts`.
> "orig" map-gen values come from the map defs survev imported in Dec 2023 – Jan 2024, cited as `derived/survev@<commit>:<path>:<lines>` (main and desert in `9f64948d`, faction/halloween/potato/woods in `0b3851a1`, the rest in `33832ffe`). Git history is cited as `derived/survev-git-<commit>`.
> Map names (Normal, Desert, …) and place names are covered in `places.md`; obstacle stats in `obstacles.md`; mode rules (gas, planes, roles) live in `modes/`.

## Provenance summary

- The original client does not carry map-generation data: the 2026 relaunch bundle has only `mapId`, `desc`, `assets`, `biome` and `gameMode` for its 8 map defs (Normal 0, Desert 1, Woods 2, 50v50 3, Potato 4, Savannah 5, Halloween 6, Cobalt 7) [src:kong/relaunch-client-defs] [H]
- survev keeps `gameConfig`, `lootTable` and `mapGen` between `STRIP_FROM_PROD_CLIENT` markers, so they exist only on the server [src:survev/shared/defs/maps/baseDefs.ts:67] [src:survev/shared/defs/maps/baseDefs.ts:957] [H]
- survev's first map-gen data (Main and Desert, with places, density/fixed spawns, river weights) arrived in its initial commit `9f64948d` (2023-12-11) as `src/defs/modes/main.ts` and `desert.ts`; the repo does not name the source [src:derived/survev@9f64948d:src/defs/modes/main.ts:63-211] [src:derived/survev-git-9f64948d] [M]
- Faction, Halloween, Potato and Woods map-gen followed in `0b3851a1` (2023-12-31); the seasonal variants, Snow, Savannah, Cobalt and Turkey defs in `33832ffe` (2024-01-09) [src:derived/survev-git-0b3851a1] [src:derived/survev-git-33832ffe] [H]
- In that import, Savannah, Cobalt and Turkey have no `mapGen` of their own (they inherit Main's), so their current spawn tables were written by survev: Cobalt in Mar–Apr 2025 (`4ee8362b`…`d2aedaff`), Savannah in Aug 2025 (`bbe1a377` "feat: savannah map generation"), Turkey in Oct 2025 (`702d6d72` "feat: turkey defs") (fork reconstruction) [src:derived/survev@33832ffe:src/defs/maps/savannahDefs.ts:1-32] [src:derived/survev@33832ffe:src/defs/maps/cobaltDefs.ts:1-48] [src:derived/survev@33832ffe:src/defs/maps/turkeyDefs.ts:1-26] [src:derived/survev-git-bbe1a377] [src:derived/survev-git-702d6d72] [H]
- `River` (polygon building) and `generateTerrain` (shore/grass outlines) are original client code, ported by survev commit `6af06b1a` "feat: port river and terrain code" (2024-01-09) [src:derived/survev-git-6af06b1a] [src:survev/shared/utils/river.ts:7-28] [src:survev/shared/utils/terrainGen.ts:75-128] [H]
- The river path generator (`RiverCreator`) is a survev rewrite from commit `c4841f72` (2025-01-12, "river generation rewrite"); the original server algorithm is unknown [src:derived/survev-git-c4841f72] [src:survev/server/src/game/riverCreator.ts:112-206] [M]
- Building/obstacle spacing scales (1.1 obstacle bounds, 1.15 building bounds) come from the original client's debug helpers ("found on BHA leak") [src:survev/server/src/game/map.ts:28-35] [src:survev/server/src/game/map.ts:100-106] [M]
- survev calibrated Woods tree counts from a captured original map message ("source is a mapMsg from original surviv", survivreloaded reference map) [src:derived/survev-git-c94e4c39] [M]
- Original map defs carry terrain fields survev's server ignores: `spawnPriority` (river_town_01 100, bunker_structure_05 100, club_complex_01/club_structure_01/logging complexes 10, kopje_patch_01 2, savannah_patch_01 1), `lakeCenter` (teapavilion_01, teapavilion_01w, teapavilion_complex_01, crate_02sv_lake), `river.centerWeight` and `nearbyRiver.radMin/radMax` [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjectsTyping.ts:3-25] [H]

## Map size

- `width = height = baseWidth × scale[small|large] + extension`; "small" is used for Solo and Duo, "large" for Squad (`teamMode > Duo`) [src:survev/server/src/game/map.ts:283-287] [H]
- Main: baseWidth 512, scale small 1.1875 / large 1.28125, extension 112 → 720 (solo/duo) and 768 (squad) units [src:survev/shared/defs/maps/baseDefs.ts:814-817] [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:291-297] [src:derived/size-formula] [H]
- wiki.gg lists the same Classic numbers: width/height 512, scale 1.1875, squads scale 1.28125, extension 112, shore inset 48, grass inset 18 [src:wikigg/Classic_mode] [M]
- The changelog increased the map size in 0.2.0 (Jan 17, 2018) and added the ocean border in 0.2.2 (Jan 23, 2018) [src:changelog/0.2.0] [src:changelog/0.2.2] [H]
- The map msg carries width and height as uint16 [src:survev/shared/net/mapMsg.ts:107-114] [H]

| map (id) | scale small / large | size solo-duo / squad | shoreInset | grassInset | sources |
|---|---|---|---|---|---|
| main, main_spring, main_summer, potato, potato_spring, snow, turkey, cobalt (0/4/7) | 1.1875 / 1.28125 | 720 / 768 | 48 | 18 | [src:survev/shared/defs/maps/baseDefs.ts:814-819] [src:derived/size-formula] [H] |
| desert (1) | 1.1875 / 1.1875 | 720 / 720 | 8 | 12 | [src:survev/shared/defs/maps/desertDefs.ts:233-235] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:195-199] [H] |
| woods + variants (2) | 1.1875 / 1.21875 | 720 / 736 | 8 | 12 | [src:survev/shared/defs/maps/woodsDefs.ts:164-166] [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:144-148] [H] |
| faction (3) | 1.5 / 1.5 | 880 / 880 | 48 | 18 | [src:survev/shared/defs/maps/factionDefs.ts:402-407] [src:derived/survev@33832ffe:src/defs/maps/factionDefs.ts:266-272] [H] |
| halloween (6) | 1.1875 / 1.1875 | 720 / 720 | 48 | 18 | [src:survev/shared/defs/maps/halloweenDefs.ts:203] [src:derived/survev@33832ffe:src/defs/maps/halloweenDefs.ts:103-106] [H] |
| savannah (5) | 1.1875 / 1.28125 | 720 / 768 | 24 | 12 | [src:survev/shared/defs/maps/savannahDefs.ts:193-194] [H] |
| faction_potato (10) (fork) | 1.5 / 1.5 | 880 / 880 | 48 | 18 | [src:survev/shared/defs/maps/factionPotatoDefs.ts:316] [H] |
| beach (9) (fork) | 1.1875 / 1.28125 | 720 / 768 | 72 | 48 | [src:survev/shared/defs/maps/beachDefs.ts:128-133] [H] |
| birthday (8) (fork) | 1.1875 / 1.21875 | 720 / 736 | -1 | 0 | [src:survev/shared/defs/maps/birthdayDefs.ts:107-112] [H] |
| test_normal, test_faction (fork) | baseWidth 128 | 264 / 276 | 48 | 18 | [src:survev/shared/defs/maps/testDefs.ts:9-12] [src:derived/size-formula] [H] |

- Fandom describes the Woods island as "notably larger", the Savannah island as "slightly bigger" than Normal and the Desert ocean as "notably smaller" [src:fandom/Woods_Map] [src:fandom/Savannah_Map] [src:fandom/Desert_Map] [M]
- The `MapId` enum: Main 0, Desert 1, Woods 2, Faction 3, Potato 4, Savannah 5, Halloween 6, Cobalt 7, Birthday 8, Beach 9, FactionPotato 10; Snow, Turkey and the spring/summer variants reuse mapId 0, Woods variants 2, Potato Spring 4 [src:survev/shared/gameConfig.ts:97-110] [src:derived/mapdefs-dump] [H]

## Coordinates, seeds and the map message

- World origin is the bottom-left corner, y up; the client minimap flips y (`background.scale.y = -1`) [src:survev/client/src/map.ts:575-576] [H]
- Seed: survev picks `randomInt(0, 2^32 − 1)` unless one is passed; its first commit used `randomInt(0, 2^31)` [src:survev/server/src/game/map.ts:316-317] [src:derived/survev@9f64948d:src/map.ts:18] [H]
- `util.seededRand(seed)` is a Park–Miller generator: `rng = rng × 16807 mod 2147483647`, returning `lerp(rng/2147483647, min, max)` [src:survev/shared/utils/util.ts:102-110] [H]
- Seeded steps: river masks, place-spawn reservations, lakes, the river width set and river paths share `seededRand(seed)` streams; the shore/grass outline uses its own `seededRand(seed)` [src:survev/server/src/game/map.ts:538] [src:survev/server/src/game/map.ts:590] [src:survev/server/src/game/map.ts:653] [src:survev/shared/utils/terrainGen.ts:88] [H]
- Unseeded steps (`Math.random`): faction split orientation, fixed-spawn odds, random-spawn picks, all object positions, scales and orientations, bridge positions, cabins — so a seed only reproduces the terrain, not the objects [src:survev/server/src/game/map.ts:351] [src:survev/server/src/game/map.ts:944] [src:survev/server/src/game/map.ts:928] [src:survev/server/src/game/map.ts:1443-1459] [H]
- The `MapMsg` sends mapName, seed (uint32), width, height, shoreInset, grassInset, every river (width, looped, points), the places, every minimap-visible object and ground patches; the client rebuilds shore and grass from the seed and draws rivers from the sent points [src:survev/shared/net/mapMsg.ts:95-132] [src:survev/server/src/game/map.ts:330-341] [H]
- Only objects on layer 0 with `map.display` true are put in the map message (building children are hidden when the parent has `map.displayType`) [src:survev/server/src/game/map.ts:1921-1923] [src:survev/server/src/game/map.ts:1982-1989] [H]
- If generation fails to place the faction bridges, survev logs "Failed to generate faction bridges, restarting map gen" and calls `init()` again with a new seed [src:survev/server/src/game/map.ts:866-882] [H]

## Terrain: ocean, beach, grass

- Shore outline: the square from `shoreInset` to `size − shoreInset`, with 64 subdivisions per edge; every interior vertex is jittered ±`shoreVariation` (3) perpendicular to its edge [src:survev/shared/utils/terrainGen.ts:13-54] [src:survev/shared/utils/terrainGen.ts:84-105] [src:survev/shared/gameConfig.ts:181-185] [H]
- Grass outline: each shore vertex moved toward the map centre by `grassInset ± grassVariation` (2) [src:survev/shared/utils/terrainGen.ts:107-115] [src:survev/shared/gameConfig.ts:184] [H]
- The beach (sand) is the band between the shore and grass outlines; outside the shore is ocean (water) [src:survev/shared/utils/terrainGen.ts:107-108] [src:survev/server/src/game/map.ts:2364-2374] [H]
- `GameConfig.map.gridSize` is 16, `shoreVariation` 3, `grassVariation` 2, identical in the original client config [src:survev/shared/gameConfig.ts:181-185] [src:kong/relaunch-client-defs] [H]
- Ground surface lookup order: surface decals, then building floor surfaces (highest zIdx; layer rules for stairs), then river water / river shore (not on layer 1), then grass polygon (river shore gives the biome's `riverShore` sound, "sand" on most maps), then shore polygon ("sand"), else "water" [src:survev/server/src/game/map.ts:2288-2375] [H]
- Spawn bounds: `grassBounds` = inset `shoreInset + grassInset`; `beachBounds` = inset `shoreInset` [src:survev/server/src/game/map.ts:305-313] [H]
- Map areas used by density spawns: `shoreArea = area(shore polygon) − Σ area(river shore polygons)`; `grassArea` likewise from the grass polygon [src:survev/server/src/game/map.ts:374-393] [H]
- Fandom: the beach has a zig-zag border with the water; near a river mouth it turns brown instead of tan; nothing spawns in the ocean [src:fandom/Beach] [M]
- Birthday sets shoreInset −1 and grassInset 0, so the whole map is grass (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:111-112] [H]

## Rivers

### Width sets

- One width set is drawn per game with `util.weightedRandom(rivers.weights, seededRand)`; each width becomes one river [src:survev/server/src/game/map.ts:704-725] [H]

| map | width sets (weight) | sources |
|---|---|---|
| main + seasonal, potato, snow, turkey | [4] .1, [8] .15, [8,4] .25, [16] .21, [16,8] .09, [16,8,4] .2, [16,16,8,6,4] .0001 | [src:survev/shared/defs/maps/baseDefs.ts:822-833] [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:301-313] [H] |
| desert | [4] .1, [8] .15, [8,4] .25, [8,6] .21 (orig [8]), [8,8] .09, [8,8,4] .2, [8,8,8,6,4] .0001 | [src:survev/shared/defs/maps/desertDefs.ts:251-262] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:201-212] [src:derived/survev-git-6e59c436] [H] |
| halloween, woods + variants | [4] .1, [8] .15, [8,4] .25, [8] .21, [8,8] .09, [8,8,4] .2, [8,8,8,6,4] .0001 | [src:survev/shared/defs/maps/halloweenDefs.ts:205-217] [src:survev/shared/defs/maps/woodsDefs.ts:180-191] [H] |
| faction, faction_potato | [20] 1, [20,4] 1, [20,8,4] 1; smoothness 0.15 | [src:survev/shared/defs/maps/factionDefs.ts:409-414] [src:derived/survev@33832ffe:src/defs/maps/factionDefs.ts:266-282] [H] |
| cobalt | [16,14,12,10,8,6,4] 1 (fork reconstruction) | [src:survev/shared/defs/maps/cobaltDefs.ts:87-91] [H] |
| savannah | [4] 1, [4,4] 1 (the second set added in fork 0.4.3) (fork reconstruction) | [src:survev/shared/defs/maps/savannahDefs.ts:241-244] [src:balance/344] [H] |
| beach (fork) | [20,16], [18,18,4], [18,4,4], [16,16,10], [16,16,6,4], [16,10,10] at .25 each; [16,10,10,4,4] .0001 | [src:survev/shared/defs/maps/beachDefs.ts:136-147] [H] |
| birthday (fork) | [] (no rivers) | [src:survev/shared/defs/maps/birthdayDefs.ts:115] [H] |

- Main therefore averages 1.74 rivers and has a 50 % chance of a 16-wide river (derived from the weights) [src:derived/main-river-weights] [M]
- Fandom: "There can be as little as one small river or as much as 3 rivers per game" (the 5-river set has weight 0.0001) [src:fandom/River] [src:survev/shared/defs/maps/baseDefs.ts:828-831] [M]
- `rivers.smoothness` (0.45 on most maps, 0.15 on faction, 1 on birthday) is stored but never read by survev's server [src:survev/shared/defs/maps/baseDefs.ts:834] [src:derived/grep-smoothness] [H]
- Rivers were added in 0.6.0 (Sep 7, 2018) together with large/medium bridges, cabin, crossing bunker and river bush; 0.6.95 fixed "rivers could generate unnatural bends or loops" [src:changelog/0.6.0] [src:changelog/0.6.95] [src:namu/Surviv.io] [H]

### River polygon (original client code)

- `shoreWidth = clamp(waterWidth × 0.75, 4, 8)` [src:survev/shared/utils/river.ts:28] [H]
- The water width widens toward both ends: `w(i) = (1 + e³ × 1.5) × width` with `e = 2 × (max(1 − i/n, i/n) − 0.5)`, so the mouths are 2.5× the nominal width [src:survev/shared/utils/river.ts:88-96] [src:derived/endpoint-widening] [H]
- A vertex within 2 × waterWidth of an earlier river takes that river's (larger) shoreWidth; shore widths are averaged with the previous vertex [src:survev/shared/utils/river.ts:98-127] [H]
- Endpoints that touch the map boundary get normals parallel to the edge so the river ends flush with the map bounds [src:survev/shared/utils/river.ts:56-86] [H]
- Water and shore polygon points are clamped to the map AABB [src:survev/shared/utils/river.ts:189-192] [H]
- Loot in river water drifts downstream; lakes do not move loot (fandom) [src:fandom/River] [src:fandom/Lake] [M]

### River path (survev reconstruction)

- Start: a random point on a random map edge (seeded); faction rivers start at the middle of the left edge (split 0) or bottom edge (split 1) [src:survev/server/src/game/riverCreator.ts:20-31] [src:survev/server/src/game/map.ts:506-531] [H]
- End: a random edge point whose Manhattan distance from the start exceeds the map width; if the start is within width/4 (Manhattan) of a corner, the end may not be near a corner; 1000 attempts, fallback (width/2, height) [src:survev/server/src/game/riverCreator.ts:33-72] [H]
- Shape: 4 passes of midpoint displacement; each new midpoint is offset perpendicular to the start–end line by `U(0,1) × segmentLength / 7` with random sign, then clamped to the map [src:survev/server/src/game/riverCreator.ts:74-84] [src:survev/server/src/game/riverCreator.ts:123-148] [H]
- Faction river: the first pass uses midpoint + random point in a radius-16 circle instead, keeping the river straight [src:survev/server/src/game/riverCreator.ts:132-139] [H]
- Rejection: more than `max((shoreInset + grassInset) / 9, 3)` points outside grassBounds (×2 for the faction river) [src:survev/server/src/game/riverCreator.ts:150-170] [H]
- Junctions: the first segment that crosses an existing river is cut at the intersection, ending the new river there [src:survev/server/src/game/riverCreator.ts:86-110] [H]
- Fewer than 10 control points → rejected; then Catmull–Rom smoothing to 2× the point count (4× for faction) [src:survev/server/src/game/riverCreator.ts:172-192] [H]
- Any smoothed point whose radius-(2 × width) circle touches a river mask → rejected [src:survev/server/src/game/riverCreator.ts:194-203] [H]
- The map keeps a river only if it has at least 12 points; each width gets up to 500 attempts [src:survev/server/src/game/map.ts:713-724] [src:survev/server/src/game/map.ts:1229] [H]

### River masks

- Mask with `pos`: circle at (pos.x × width, pos.y × height) with radius `rad` [src:survev/server/src/game/map.ts:540-545] [H]
- Mask without `pos`: random (seeded) position inside the shore, not overlapping earlier masks; `genOnShore` masks use a random point on the map edge offset by `rad` [src:survev/server/src/game/map.ts:546-580] [H]
- Desert: centre mask radius 80 (orig) [src:survev/shared/defs/maps/desertDefs.ts:263] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:213-215] [H]
- Cobalt: centre mask radius 100 plus two radius-100 shore masks (fork reconstruction) [src:survev/shared/defs/maps/cobaltDefs.ts:93-107] [H]
- Place-spawn reservations and lake `riverMaskRad` circles are also pushed into the mask list, so rivers avoid them [src:survev/server/src/game/map.ts:642] [src:survev/server/src/game/map.ts:680-692] [H]

## Lakes

- Each lake def is rolled with `seededRand() ≤ odds`; up to 500 attempts per lake [src:survev/server/src/game/map.ts:659-698] [H]
- Centre = spawnBound.pos × map size + random point in a circle of spawnBound.rad (seeded) [src:survev/server/src/game/riverCreator.ts:208-212] [H]
- Water width = (outerRad − innerRad) / 2; 20 ring points at radius (innerRad + width) × U(0.9, 1.2), Catmull–Rom smoothed to 33 looped points [src:survev/server/src/game/riverCreator.ts:214-257] [H]
- A lake is rejected if its ring touches a river mask (circle radius 2 × width), if its AABB overlaps another lake's AABB, or if its `riverMaskRad` circle overlaps an existing mask [src:survev/server/src/game/riverCreator.ts:231-240] [src:survev/server/src/game/map.ts:666-692] [H]
- Lakes are looped rivers; the island inside is ordinary grass; `noRiverObjs` lakes get no river stones or bushes [src:survev/shared/utils/river.ts:29] [src:survev/server/src/game/map.ts:1074-1077] [H]
- The lake's `centerObj` is spawned at the lake centre before anything else [src:survev/server/src/game/map.ts:1012-1023] [H]

| map | lake (odds, innerRad / outerRad, spawn bound) | centre object | sources |
|---|---|---|---|
| woods + variants | 1, 32 / 96, centre ±100 | `teapavilion_01w` (survev added it as lake centerObj in 2026; the orig import has no centre object) | [src:survev/shared/defs/maps/woodsDefs.ts:168-179] [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:150-160] [src:derived/survev-git-e305bb67] [H] |
| desert | 1, 10 / 20, centre ±300, riverMaskRad 48, noRiverObjs | `oasis_01` (fork, added 2026-06-03) | [src:survev/shared/defs/maps/desertDefs.ts:237-250] [src:derived/survev-git-bdba09bd] [H] |
| savannah (fork reconstruction) | 1, 32 / 48, centre ±200, riverMaskRad 85 | `bunker_structure_10` (Cloud bunker, fork) | [src:survev/shared/defs/maps/savannahDefs.ts:196-240] [H] |
| savannah | 1, 10 / 20, centre ±300, riverMaskRad 48, noRiverObjs | `oasis_01sv` (fork, "Added an Oasis to Savannah" 0.4.3) | [src:survev/shared/defs/maps/savannahDefs.ts:196-240] [src:balance/343] [H] |
| savannah | 2 × (1, 16 / 32, centre ±200) | `crate_02sv_lake` | [src:survev/shared/defs/maps/savannahDefs.ts:196-240] [H] |

- The original client marks `teapavilion_01`, `teapavilion_01w`, `teapavilion_complex_01` and `crate_02sv_lake` with `terrain.lakeCenter: true`, so the original server placed pavilions and the Savannah lake crate at lake centres [src:kong/relaunch-client-defs] [H]
- Lakes were added in 0.7.5 "Hunt or be hunted" (Apr 15, 2019) with the pavilion; the changelog calls it a "mysterious lake" [src:changelog/0.7.5] [src:fandom/Lake] [H]
- Fandom (original): Woods has one huge central lake with no bridges and the pavilion island; Savannah has 3 lakes, a larger fixed central one and two random ones, each island with a gold crate; nearby Savannah lakes can flood the small island so the crate ends up in water [src:fandom/Lake] [M]

## Bridges

- `bridgeTypes` per map: medium `bridge_md_structure_01`, large `bridge_lg_structure_01`, xlarge `""` on Main; faction sets xlarge `bridge_xlg_structure_01`; beach has only medium; birthday none [src:survev/shared/defs/maps/baseDefs.ts:873-877] [src:survev/shared/defs/maps/factionDefs.ts:425-429] [src:survev/shared/defs/maps/beachDefs.ts:187-191] [H]
- Size by river width: 4 < w < 9 → medium; 8 < w < 20 → large; anything else → xlarge [src:survev/server/src/game/map.ts:820-831] [H]
- Random bridges per river: `ceil(max × points / 33)` with max medium 3, large 2, xlarge 0 (a full-length river has 33 points) [src:survev/server/src/game/map.ts:833-857] [H]
- Placement: a random t on the river spline, oriented to the spline normal [src:survev/server/src/game/map.ts:1698-1731] [H]
- Two bridges may not overlap their "bridge overlap colliders" (length × 1.5 by width × `terrain.bridge.nearbyWidthMult`: medium 8, large/xlarge 5, dock 0.75, crossing bunker 1.2, shack_03a 1, river town 1) [src:survev/server/src/game/map.ts:1296-1316] [src:survev/shared/utils/mapHelpers.ts:114-127] [src:kong/relaunch-client-defs] [H]
- `bridgeLandBounds` must be fully off water and all corners plus the centre of every `bridgeWaterBounds` must be on water [src:survev/server/src/game/map.ts:1318-1357] [H]
- The crossing bunker (`bunker_structure_05`) only spawns on rivers wider than 8 and uses `ori % 2` [src:survev/server/src/game/map.ts:1692-1696] [src:survev/server/src/game/map.ts:1726-1728] [H]
- Buildings with `terrain.nearbyRiver` (`shack_03a`, cabins) are offset 2 × waterWidth to one side of the river and face it (`facingOri` 1) [src:survev/server/src/game/map.ts:1708-1721] [H]
- 50v50: `river_town_01` and two xlarge bridges are placed on the main river at t ∈ [0.45, 0.55], [0.2, 0.3] and [0.7, 0.85]; if one fails, the remaining slots are tried; if all fail, the map regenerates [src:survev/server/src/game/map.ts:728-813] [H]
- 50v50: river town orientation is `factionModeSplitOri ^ 1` so red is on the left/bottom [src:survev/server/src/game/map.ts:782-787] [H]
- Fandom (50v50): the central river has the River Town, usually in the exact centre, 2 extra-large bridges (a third is part of River Town), 2 fisherman's shacks and 2–3 cabins on its shore [src:fandom/50v50_Map] [M]
- Changelog: extra large bridge added in 0.7.0; 0.7.3 "Fixed an issue where the extra large bridge could spawn in normal maps" [src:changelog/0.7.0] [src:changelog/0.7.3] [H]

## River cabins, docks and river obstacles

- Cabins (`cabin_01`, only when `rivers.spawnCabins`): 1 + U{1,2} per river ≥ 16 wide + U{0,1} per river ≥ 6 wide, clamped to 1–3 [src:survev/server/src/game/map.ts:1047-1064] [H]
- Fandom agrees: "Cabins spawn alongside the river and there are 1-3 cabins per game" [src:fandom/River] [M]
- `spawnCabins` is false on Savannah, Cobalt, Birthday and the test maps (survev field, added 2025-03-05) [src:survev/shared/defs/maps/savannahDefs.ts:246] [src:survev/shared/defs/maps/cobaltDefs.ts:92] [src:derived/survev-git-446d810a] [H]
- Cabin placement: t ∈ [0.1, 0.9] on a random river, offset (waterWidth + cabin height) to a random side, rotated to face the river, fully inside grassBounds [src:survev/server/src/game/map.ts:1814-1864] [H]
- A river dock `dock_01` is added beside the cabin when the river is at least 8 wide (100 attempts, t ± 0.04) [src:survev/server/src/game/map.ts:1866-1889] [H]
- Halloween replaces `cabin_01` with `cabin_02`; Snow with `cabin_01x` [src:survev/shared/defs/maps/halloweenDefs.ts:269-276] [src:survev/shared/defs/maps/snowDefs.ts:275-294] [H]
- River obstacles: per river (and lake without `noRiverObjs`), `min(waterArea / 1000 × rate, 30)` of `stone_03` (rate 0.9) and `bush_04` (rate 0.4) [src:survev/server/src/game/map.ts:1066-1088] [H]
- A width-16 river crossing a 720 map has ≈ 22 000 water area → ≈ 20 river stones and ≈ 9 river bushes (derived, ignores the widened mouths) [src:derived/river-object-estimate] [L]
- River obstacles must have all four collision-box corners in water and must stay inside shoreInset/2 of the edge [src:survev/server/src/game/map.ts:1393-1416] [H]

## Spawn rule types (map def `mapGen`)

| rule | meaning | sources |
|---|---|---|
| `customSpawnRules.locationSpawns` | `{type, pos, rad, retryOnFailure}`: spawn once within `rad` of (pos × size); if it fails and `retryOnFailure`, re-queue it as a normal stage-2 spawn | [src:survev/server/src/game/map.ts:912-923] [src:survev/server/src/game/map.ts:986-1010] [src:survev/server/src/game/map.ts:1523-1534] [H] |
| `customSpawnRules.placeSpawns` | types reserved near a random place (place y inverted), one place per type; the reservation also becomes a river mask | [src:survev/server/src/game/map.ts:586-648] [src:survev/server/src/game/map.ts:1625-1635] [H] |
| `fixedSpawns` | `type: n`, `type: {small, large}` (count by scale) or `type: {odds}` (1 with probability odds) | [src:survev/server/src/game/map.ts:938-960] [H] |
| `randomSpawns` | `{spawns, choose}`: pick `choose` distinct types | [src:survev/server/src/game/map.ts:925-936] [H] |
| `densitySpawns` | `count = round(density × shoreArea / 250000)` | [src:survev/server/src/game/map.ts:1107-1130] [H] |
| `importantSpawns` | spawned first (in list order) and given 5000 attempts instead of 500 | [src:survev/server/src/game/map.ts:962-969] [src:survev/server/src/game/map.ts:1229] [H] |
| `spawnReplacements` | `{from: to}`, applied in `genAuto` to every generated object including building children unless the child sets `ignoreMapSpawnReplacement` | [src:survev/server/src/game/map.ts:1167-1171] [src:survev/shared/defs/mapObjects/buildings/buildingDefs.ts:72] [H] |

- Arrays in map defs (`densitySpawns`, `fixedSpawns`, `spawnReplacements`, river `weights`) are not deep-merged: a derived map replaces the whole array, which is why tables are wrapped as one-element arrays [src:survev/shared/defs/maps/baseDefs.ts:6-11] [H]
- `ignoreMapSpawnReplacement` also exists in the original client bundle; survev uses it on 74 building children [src:kong/relaunch-client-defs] [src:derived/grep-ignoreMapSpawnReplacement] [H]
- Fandom "Building Rotation": on maps with the Crimson Ring Club, one of Bank, Police Station or Mansion does not spawn (added 0.7.7, May 30, 2019) — Main's `randomSpawns` choose 2 of `mansion_structure_01`, `police_01`, `bank_01` [src:fandom/Building_Rotation] [src:changelog/0.7.7] [src:survev/shared/defs/maps/baseDefs.ts:948-953] [H]
- For densities whose type spawns only on river shores (`riverShore` without `grass`, e.g. spring river trees), the count is computed per river: `(shoreArea − waterArea) / 15000 × density` [src:survev/server/src/game/map.ts:1110-1125] [H]

## Generation pipeline

1. Clone the map def, compute size, faction split orientation (`randomInt(0,1)`) [src:survev/server/src/game/map.ts:272-314] [src:survev/server/src/game/map.ts:350-352] [H]
2. River masks [src:survev/server/src/game/map.ts:346] [H]
3. Place-spawn reservations (each type: random place, random point within half its 1.15-scaled bounds, clamped inside shoreInset + bounds, must not touch masks; adds a building grid collider and a river mask) [src:survev/server/src/game/map.ts:586-648] [H]
4. Lakes, then rivers [src:survev/server/src/game/map.ts:650-726] [H]
5. Terrain polygons and areas [src:survev/server/src/game/map.ts:359-393] [H]
6. Faction only: river town and 2 xlarge bridges (restart on failure) [src:survev/server/src/game/map.ts:866-882] [H]
7. Collect spawns: location spawns and important or bridge-terrain fixed spawns → stage 1; random spawns and other fixed spawns → stage 2; each stage sorted by importantSpawns index, then bounding-box area descending [src:survev/server/src/game/map.ts:912-984] [src:survev/server/src/game/map.ts:1031-1033] [H]
8. Lake centre objects [src:survev/server/src/game/map.ts:1012-1023] [H]
9. Stage 1 [src:survev/server/src/game/map.ts:1025-1029] [H]
10. Random bridges, river cabins (+ docks), river stones and bushes [src:survev/server/src/game/map.ts:1035-1089] [H]
11. Stage 2 [src:survev/server/src/game/map.ts:1091-1095] [H]
12. Density spawns in map-def key order [src:survev/server/src/game/map.ts:1097-1102] [H]

- Fandom: "Biomes will spawn first, then followed by buildings"; the docks very rarely fail to spawn when rivers fill the shore, and the potato silo shack or the cobalt club can be relocated off-centre when blocked [src:fandom/Maps] [M]

## Placement by terrain

| `def.terrain` | placement | sources |
|---|---|---|
| `waterEdge {dir, distMin, distMax}` | random side (faction: the team's side), rotated so `dir` points to the ocean; distance from shore `U(distMin, distMax)` with survev hacks: huts −16, docks −(shoreInset − 6.5), conch bunker −24 | [src:survev/server/src/game/map.ts:1461-1521] [H] |
| `river` | random t on a random river, offset uniformly within (water width − obstacle radius − 1) | [src:survev/server/src/game/map.ts:1753-1785] [H] |
| `bridge` | see Bridges | [src:survev/server/src/game/map.ts:1684-1751] [H] |
| `grass` (or none) | uniform in the shore AABB shrunk on each side by the object's rotated bounding width/height + grassInset (objects allowed on the beach skip the grassInset margin) | [src:survev/server/src/game/map.ts:1536-1647] [H] |
| `beach` only | random side; distance from the map edge within `[shoreInset + r, shoreInset + r + grassInset − 2·grassVariation]` (r = half the larger bounding dimension); never on a grass surface | [src:survev/server/src/game/map.ts:1649-1677] [src:survev/server/src/game/map.ts:1418-1422] [H] |
| `riverShore` only | random river, offset between water width and water + shore width, either side | [src:survev/server/src/game/map.ts:1787-1812] [H] |

- Terrain flags on buildings and structures in the original client: huts `waterEdge` dir (0,1) dist −8.5…0; `shack_03b` (fisherman's shack) dist 4–5; `warehouse_complex_01` (docks) dir (−1,0) dist 72; `bunker_structure_04` (conch) dir (−1,0) dist 15–16; `hedgehog_01` beach only; containers grass+beach+riverShore [src:kong/relaunch-client-defs] [src:derived/terrain-dump] [H]
- Fandom: the conch bunker "can only be found at the edges of the map (exactly at the beach)"; the docks are "always on the shoreline" [src:wikigg/Classic_mode] [src:fandom/Docks] [M]

## Collision and spacing checks (`canSpawn`)

- Non-river objects must have their origin inside grassBounds (beach objects: beachBounds) [src:survev/server/src/game/map.ts:1255-1260] [H]
- A static `MapGrid` with 32-unit cells stores "obstacle" and "building" colliders; it only grows during generation [src:survev/server/src/game/map.ts:96-177] [H]
- Every placed top-level object adds its bounding collider (×1.0 for obstacles, ×1.1 for buildings/structures) or its `mapObstacleBounds` as an "obstacle" collider; buildings/structures also add a ×1.15 "building" collider plus `bridgeLandBounds` [src:survev/server/src/game/map.ts:2063-2142] [H]
- Children of buildings add no colliders ("they are literally WRONG") [src:survev/server/src/game/map.ts:2069-2074] [H]
- A new building/structure fails if its 1.15-scaled bounds (plus `bridgeLandBounds`, `mapObstacleBounds` and child structures' bounds) touch a grid collider; its ground-layer bounds ignore underground colliders, its underground bounds test everything [src:survev/server/src/game/map.ts:30-94] [src:survev/server/src/game/map.ts:1262-1276] [H]
- A new obstacle only checks layer-0 "obstacle" colliders [src:survev/server/src/game/map.ts:1277-1293] [H]
- Objects without `river`/`bridge` terrain may not touch a river shore polygon; `riverShore` objects may not touch river water [src:survev/server/src/game/map.ts:1360-1391] [H]
- `terrain.minDistanceFromSameType`: no obstacle of the same type within that distance (32 for `class_shell_01`, `crate_02f`, `crate_22`, all survev additions) [src:survev/server/src/game/map.ts:1424-1438] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1209] [H]
- Bounding collider of a building = AABB of its floor surfaces, zoom regions and children; of a structure = AABB of its layers and stairs + 1 margin; of a loot spawner = circle radius 3 [src:survev/shared/utils/mapHelpers.ts:13-87] [H]
- Orientation: buildings/structures pick from `oris`, else `ori`, else 0–3; obstacles get `scale = U(createMin, createMax)` and orientation 0 [src:survev/server/src/game/map.ts:1443-1459] [H]
- Every spawn attempt loop (`trySpawn`) gives up after 500 attempts (5000 for important spawns) and logs "Failed to spawn" [src:survev/server/src/game/map.ts:1223-1239] [H]
- Map-gen loot spawners (`loot_tier_1`, `loot_tier_beach`, …) roll each loot entry once, drop the item with push speed 0 and add a radius-3 obstacle collider [src:survev/server/src/game/map.ts:1194-1211] [H]
- Changelog 0.1.77: "Buildings should be less likely to spawn overlapped" [src:changelog/0.1.77] [H]

## Faction (50v50) placement

- The island is split into 10 strips along the split axis; team buildings (`teamId`) go to the farthest strip of their team's half, team crops (`potato_0Xf`, `tomato_0X`) anywhere in their half, `warehouse_01f`, `house_red_01`, `house_red_02`, `barn_01` to either outer strip, `greenhouse_01` and the storm bunker to the 8 inner strips [src:survev/server/src/game/map.ts:1563-1620] [H]
- Water-edge team buildings use the team's map side (red bottom/left, blue top/right) [src:survev/server/src/game/map.ts:1474-1487] [H]
- Fandom (original): each faction spawns in the sixth farthest from the centre; each side has 3 team warehouses, 2 barns and 3 red houses; Bank and Mansion spawn on the red side, Police Station and Docks on the blue side; 11 Soviet crates (red) vs 11 Initiative crates (blue) [src:fandom/50v50_Map] [M]
- In survev the team crates `crate_02f` (team 1) and `crate_22` (team 2) are density spawns (5 each) with team placement; their `teamId` is a survev addition [src:survev/shared/defs/maps/factionDefs.ts:434-455] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:418] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:978] [H]

## Player spawn algorithm

- Default: a uniform point in beachBounds (inset shoreInset on every side) [src:survev/server/src/game/map.ts:2151-2176] [H]
- 50v50: the point is drawn from the outermost tenth of the map on the team's side ("farthest fifth" of the team's half) [src:survev/server/src/game/map.ts:2162-2172] [H]
- Teammates joining a group with a spawn position spawn within `teammateSpawnRadius` 5 of it [src:survev/server/src/game/map.ts:2177-2183] [src:survev/shared/gameConfig.ts:214] [H]
- A candidate is rejected if it is in water, overlaps a collidable obstacle, a building floor surface or a zoom-in region [src:survev/server/src/game/map.ts:2239-2275] [H]
- … or is closer than `minSpawnRad` 25 to a living player of another group/team, 8 to an airdrop, or 16 to an enemy's ground-layer projectile; 500 attempts, the last candidate is used anyway [src:survev/server/src/game/map.ts:2187-2237] [src:survev/shared/gameConfig.ts:227] [H]
- Changelog 0.6.95 "Fixed an issue with spawning underneath air drops or near live grenades" matches the airdrop/projectile checks [src:changelog/0.6.95] [H]
- Debug `spawnMode: "fixed"` spawns everyone at a configured position (survev config) [src:survev/server/src/game/map.ts:2145-2147] [H]

## Per-map generation parameters

| map | location spawns | place spawns | important spawns | replacements | other | sources |
|---|---|---|---|---|---|---|
| main | `club_complex_01` at centre, rad 150, retry | warehouse_01, house_red_01, house_red_02, barn_01 | club_complex_01 | – | choose 2 of mansion_structure_01 / police_01 / bank_01 | [src:survev/shared/defs/maps/baseDefs.ts:878-955] [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:357-438] [H] |
| desert | `river_town_02` at (0.51, 0.5), rad 50, no retry | desert_town_02, desert_town_01 | desert_town_01, desert_town_02, river_town_02 | tree_01→tree_06, bush_01→bush_05, crate_02→crate_18, stone_01→stone_01b, stone_03→stone_03b | Blood Gulch place has `dontSpawnObjects` (fork) | [src:survev/shared/defs/maps/desertDefs.ts:266-351] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:218-309] [src:derived/survev-git-def791af] [H] |
| faction | – (river town is a faction bridge) | – | river_town_01, police_01, bank_01, mansion_structure_01, warehouse_complex_01 | bush_01→bush_01f, crate_02→crate_01, stone_01→stone_01f, stone_03→stone_03f, tree_01→tree_08f | – | [src:survev/shared/defs/maps/factionDefs.ts:430-500] [src:derived/survev@33832ffe:src/defs/maps/factionDefs.ts:297-366] [H] |
| halloween | none (survev removed the club, 2024-09-11) | inherits main | club_complex_01 (unused) | tree_01→tree_07, stone_03→stone_01, cabin_01→cabin_02 (orig also house_red_01/02→house_red_01b) | – | [src:survev/shared/defs/maps/halloweenDefs.ts:219-276] [src:derived/survev@33832ffe:src/defs/maps/halloweenDefs.ts:164-175] [src:derived/survev-git-4dbd2ed8] [H] |
| potato, potato_spring | `shilo_01` (silo shack) at centre, rad 50, retry (survev 2025-03-16) | inherits main | club_complex_01 | potato_spring: tree_01→tree_07sp | choose 2 of mansion/police/bank | [src:survev/shared/defs/maps/potatoDefs.ts:163-236] [src:derived/survev-git-22e147b2] [H] |
| woods + variants | `logging_complex_01` (sp/su variants) at centre, rad 200, retry | none ("placespawns now create river masks") | club_complex_01; spring: logging_complex_01sp/02sp | tree_01→tree_07, crate_02/08/09→crate_19, recorder_01/02→recorder_08/09 | lake | [src:survev/shared/defs/maps/woodsDefs.ts:196-266] [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:176-238] [H] |
| snow | inherits main | inherits main | club_complex_01 | 16 `x` re-skins (tree_01→tree_10, crate_01→crate_01x, mil_crate_02→mil_crate_03, …) | choose 2 of the `x` mansion/police/bank | [src:survev/shared/defs/maps/snowDefs.ts:269-294] [src:derived/survev@33832ffe:src/defs/maps/snowDefs.ts:112-148] [H] |
| savannah (fork reconstruction) | none | none | club_complex_01 (unused) | tree_01→tree_01sv, bush_01→bush_01sv, stone_03→stone_03sv | 4 lakes, no cabins | [src:survev/shared/defs/maps/savannahDefs.ts:191-312] [H] |
| cobalt (fork reconstruction) | `bunker_structure_09` (twins bunker) at centre, rad 50, retry | inherits main | club_complex_01, warehouse_complex_01, bunker_structure_09 | tree_01→tree_01cb, stone_01→stone_01cb, bush_01→bush_01cb, bush_04→bush_04cb, stone_03→stone_03cb | masks, no cabins | [src:survev/shared/defs/maps/cobaltDefs.ts:84-193] [H] |
| turkey (fork reconstruction) | inherits main | inherits main | club_complex_01 | tree_01→tree_08, stone_03→stone_03tr | – | [src:survev/shared/defs/maps/turkeyDefs.ts:49-116] [H] |
| beach (fork) | club_complex_01 (inherited) | inherits main | club_complex_01, warehouse_complex_01 | bush_01→bush_03, stone_03→stone_03bh | randomSpawns emptied | [src:survev/shared/defs/maps/beachDefs.ts:126-266] [H] |
| birthday (fork) | none | none | none | – | no rivers, no fixed spawns | [src:survev/shared/defs/maps/birthdayDefs.ts:105-183] [H] |

## Spawn tables: Main (Normal)

- Density (survev; `tree_13: 30` is a fork addition, "Density Spawns (Classic): Added 30 Palm Trees" 0.2.0): stone_01 350, barrel_01 76, silo_01 8, crate_01 50, crate_02 4, crate_03 8, bush_01 78, cache_06 12, tree_01 320, tree_13 30 (fork), hedgehog_01 24, container_01–04 5 each, shack_01 7, outhouse_01 5, loot_tier_1 24, loot_tier_beach 4 [src:survev/shared/defs/maps/baseDefs.ts:889-911] [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:372-393] [src:balance/209] [H]
- Fixed (orig import): warehouse_01 2, house_red_01 3/4, house_red_02 3/4, barn_01 1/3, barn_02 1, hut_01 4, hut_02 1, shack_03a 2, shack_03b 2/3, greenhouse_01 1, cache_01 1, cache_02 1, cache_07 1, bunker_structure_01 odds 0.05, bunker_structure_02–05 1 each, warehouse_complex_01 1, chest_01 1, chest_03 odds 0.2, mil_crate_02 odds 0.25, tree_02 3, teahouse_complex_01su 1/2, stone_04 1, club_complex_01 1 [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:394-426] [src:derived/survev@9f64948d:src/defs/modes/main.ts:166-198] [H]
- Fixed (survev): warehouse_01 1/2 + `warehouse_03` (alternate warehouse) 1 (fork 0.2.1), hut_01 3 + hut_03 (scout hut) 1, `cache_04` river stone cache 1 (fork 2026-04-17), club_complex_01 removed from fixedSpawns (it is a location spawn) [src:survev/shared/defs/maps/baseDefs.ts:912-947] [src:balance/212-214] [src:derived/survev-git-2ae32333] [src:derived/survev-git-952db93c] [src:derived/survev-git-96e2fb54] [src:derived/survev-git-255bd448] [H]
- Fandom Normal Map lists 5 huts: 3 normal, 1 gold hut (hut_02) and 1 scout hut (hut_03) — matching survev's hut_01 3 + hut_02 1 + hut_03 1, and the orig Main Summer import has the same three [src:fandom/Normal_Map] [src:derived/survev@33832ffe:src/defs/maps/mainSummerDefs.ts:54-87] [M]
- Main Spring (orig): density as Main but tree_01 300 plus tree_08sp 30, tree_08spb 30, tree_07spr 160, tree_08spr 80; fixed with house_red 2/3, barn_01 2/4, bank_01 + police_01 + mansion_structure_01 always, hut_01 4, teahouse_01 2/3 instead of the teahouse complex, no club [src:derived/survev@33832ffe:src/defs/maps/mainSpringDefs.ts:24-86] [H]
- Main Spring (survev): tree_07sp 300 instead of tree_01, Main-style random trio, club location spawn, warehouse_03, hut_03, cache_02sp, cache_04 [src:survev/shared/defs/maps/mainSpringDefs.ts:38-97] [H]
- Fandom: the spring map has 2 teahouses (3 in squads) instead of teahouse complexes and more trees along the river [src:fandom/Maps] [M]
- Main Summer (orig): Main density, fixed with hut_01 3 + hut_02 1 + hut_03 1, teahouse_complex_01su 1/2, club_complex_01 1; replacements bush_01→bush_01f, tree_01→tree_08su [src:derived/survev@33832ffe:src/defs/maps/mainSummerDefs.ts:31-94] [H]
- Potato (orig): Main density + potato_01–03 50 each; fixed as Main orig (hut_01 4, no scout hut) with teahouse_complex_01s and club_complex_01 [src:derived/survev@33832ffe:src/defs/maps/potatoDefs.ts:157-224] [H]
- Potato (survev): adds `shilo_01` as a centre location spawn ("Adds shilo to potato mode"), hut_01 3 + hut_03 1 [src:survev/shared/defs/maps/potatoDefs.ts:163-236] [src:derived/survev-git-22e147b2] [H]
- Potato Spring: the orig import is a copy of Main Summer ("spring potato using the completely wrong data"); survev rebuilt it with spring trees and `egg_01–04` 15 each (eggs are fork) [src:derived/survev@33832ffe:src/defs/maps/potatoSpringDefs.ts:31-94] [src:survev/shared/defs/maps/potatoSpringDefs.ts:58-105] [src:derived/survev-git-22e147b2] [src:derived/survev-git-929cee54] [H]
- Snow (orig): Main fixed spawns re-skinned by replacements; density stone_01x 350, crate_01 38, crate_03x 1, tree_01 320 (→ tree_10) [src:derived/survev@33832ffe:src/defs/maps/snowDefs.ts:87-148] [H]
- Snow (survev 0.2.0+): explicit `x` fixed spawns, tree_10 300 + tree_11 20, stone_04x 3 (orig 1, "Hardstone Block amount increased from 1 -> 3"), camp_01 2/3 (fork), warehouse_03x, cache_04 [src:survev/shared/defs/maps/snowDefs.ts:204-294] [src:balance/201] [src:balance/228] [H]
- Turkey (survev, fork reconstruction): squash_01 25, squash_02 12 (fork), stone_01 200, silo_01 9, crate_01 45, bush_06tr 70, cache_03tr 50, tree_07 20, tree_08 170, tree_08b 4, outhouse_01 7, outhouse_02 2, woodpile_02 4; fixed hut_01 1, hut_02/hut_03 odds 0.05, tree_02 4 [src:survev/shared/defs/maps/turkeyDefs.ts:49-116] [src:balance/195-198] [H]

## Spawn tables: other maps

- Desert density (survev): stone_01 280, barrel_01 76, silo_01 4, crate_01 50, crate_03 8, bush_01 90, tree_06 220, tree_05c 96 (orig 144, reduced 2026-07-10), tree_09 40, hedgehog_01 12, containers 5 each, shack_01 8, outhouse_01 5, loot_tier_1 24, loot_tier_beach 4 [src:survev/shared/defs/maps/desertDefs.ts:296-317] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:250-271] [src:derived/survev-git-5b2575d7] [H]
- Desert fixed (orig): warehouse_01 4, house_red_01 3, house_red_02 1, barn_01 1, barn_02d 1, cache_01 1, cache_02 1, bunker_structure_01 odds 0.05, bunker_structure_03 1, chest_01 1, chest_03d odds 1, mil_crate_02 odds 0.25, crate_18 12, tree_02 3, desert_town_01 1, desert_town_02 1, river_town_02 1, greenhouse_02 1, stone_05 6 [src:derived/survev@9f64948d:src/defs/modes/desert.ts:272-294] [H]
- Desert fixed (survev): warehouse_01 2 + warehouse_03 1, house_red_01 2, cache_02d (fork re-skin), river_town_02 only as location spawn; the second desert town was overhauled into The Reserve (fork 0.3.1) [src:survev/shared/defs/maps/desertDefs.ts:318-340] [src:derived/survev-git-94bf1f97] [src:balance/317] [H]
- Faction density (orig = survev): stone_01 350, barrel_01 76, silo_01 8, crate_01 38, crate_02f 5, crate_22 5, crate_03 8, bush_01 78, tree_08f 320, hedgehog_01 24, containers 5 each, shack_01 7, outhouse_01 5, loot_tier_1 24, loot_tier_beach 4 [src:survev/shared/defs/maps/factionDefs.ts:434-455] [src:derived/survev@33832ffe:src/defs/maps/factionDefs.ts:300-321] [H]
- Faction fixed (orig): warehouse_01f 6, house_red_01 4, house_red_02 4, barn_01 4, bank_01 1, police_01 1, hut_01 4, hut_02 1, shack_03a 2, shack_03b 3, greenhouse_01 1, cache_01/02/07 1, mansion_structure_01 1, bunker_structure_01 odds 1, bunker_structure_03 1, bunker_structure_04 1, warehouse_complex_01 1, chest_01 1, chest_03f 1, mil_crate_02 odds 1, tree_02 3, river_town_01 1; survev swaps the caches for `_f` variants (fork 0.2.3) [src:derived/survev@33832ffe:src/defs/maps/factionDefs.ts:322-349] [src:survev/shared/defs/maps/factionDefs.ts:456-482] [src:balance/158-166] [H]
- Faction Potato (fork): faction tables + potato_01f–03f and tomato_01–03 40 each and `shilo_01` [src:survev/shared/defs/maps/factionPotatoDefs.ts:316-381] [H]
- Halloween density (orig = survev): stone_01 125, barrel_01 76, crate_01 120, crate_02 6, crate_03 8, bush_01 90, hedgehog_01 12, cache_pumpkin_01 32, cache_pumpkin_03 32, shack_01 6, outhouse_01 6, loot_tier_1 48, loot_tier_beach 8 [src:survev/shared/defs/maps/halloweenDefs.ts:222-238] [src:derived/survev@33832ffe:src/defs/maps/halloweenDefs.ts:121-137] [H]
- Halloween fixed (orig): junkyard_01 1, warehouse_01h 4, house_red_01h 7, cache_03 36, cache_01 1, cache_02 1, mansion_structure_02 1, bunker_structure_01/03/07 1, mil_crate_02 odds 0.25, tree_05 72, tree_07 700, tree_08 200, tree_09 36, barrel_02/oven_01/refrigerator_01/table_01/vending_01/woodpile_01 24 each [src:derived/survev@33832ffe:src/defs/maps/halloweenDefs.ts:138-162] [H]
- Halloween fixed (survev): house_red_01h 2/3 + house_red_02h 2/3, barn_01h 1, cache_02h, tree_02h 6/8, stone_04 1 [src:survev/shared/defs/maps/halloweenDefs.ts:239-267] [src:derived/survev-git-24e34f49] [src:derived/survev-git-2585e4bc] [src:derived/survev-git-202e3355] [H]
- Fandom (Halloween): obstacles normally found indoors (ovens, tables, fridges, wood piles, toilets, vending machines) are scattered outside for hide-and-seek; no silos; one Halloween mansion is the only unique building [src:fandom/Grass] [src:fandom/Halloween_Map] [M]
- Woods density (orig): stone_01 48, barrel_01 36, crate_01 60, crate_03 12, bush_01 54, hedgehog_01 12, containers 2 each, shack_01 2, outhouse_01 1, loot_tier_1 36, loot_tier_beach 8; survev outhouse_01 6 ("5 Outhouses" fork 0.2.2) [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:187-204] [src:survev/shared/defs/maps/woodsDefs.ts:210-227] [src:balance/231] [H]
- Woods fixed (orig): logging_complex_01 1, logging_complex_02 1, warehouse_01 3, house_red_01 3, barn_01 3, cache_03 48, cache_01 1, cache_02 1, bunker_structure_01b 1, bunker_structure_03 1, bunker_structure_07 1, chest_03 odds 0.5, crate_19 12, stone_04 6, tree_02 6, tree_07 1400, tree_08 1300, tree_08b 200, tree_09 84 [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:205-227] [H]
- Woods fixed (survev): tree_07 1100, tree_08 1100, tree_08b 150 (from an original map msg), logging_complex_03 3, warehouse/house/barn 3/4, stone_04 and tree_02 6/8, teahouse_01 2/3, cache_01w/02w/07w, workshop_complex_01 1 (fork) [src:survev/shared/defs/maps/woodsDefs.ts:228-253] [src:derived/survev-git-c94e4c39] [src:derived/survev-git-ad996608] [src:derived/survev-git-2b4d69d3] [src:balance/229-230] [H]
- Changelog 0.8.1: "Reduced number of trees in woods mode" and "Added additional clearings in woods mode" [src:changelog/0.8.1] [H]
- Woods Spring (orig): density with tree_08sp 408, tree_08spb 128, tree_07sp 1380, tree_07spr 106, tree_08spr 53, tree_09 60, cache_06 34; fixed with teahouse_01 2/3 and `teapavilion_01w` 1 as an important spawn [src:derived/survev@33832ffe:src/defs/maps/woodsSpringDefs.ts:44-118] [H]
- Woods Spring (survev): tree_08sp 350, tree_08spb 100, tree_07sp 1200; teapavilion moved to the lake centre [src:survev/shared/defs/maps/woodsSpringDefs.ts:50-119] [H]
- Woods Snow and Woods Summer only re-skin Woods (survev adds camp_01w 2/3 and logging_complex_03x 2 to Woods Snow, fork 0.2.2) [src:survev/shared/defs/maps/woodsSnowDefs.ts:92-142] [src:survev/shared/defs/maps/woodsSummerDefs.ts:23-67] [src:balance/227-228] [H]
- Savannah (fork reconstruction): density stone_01 72, barrel_01 48, propane_01 24, stone_07 6, crate_01 70, crate_02sv 6, crate_03 10, crate_21b 3, bush_01sv 48, tree_01sv 48, hedgehog_01 24, tree_12 24, containers 5, shack_01 7, outhouse_01 5, loot_tier_1 30, loot_tier_beach 4 (several raised in fork 0.4.3) [src:survev/shared/defs/maps/savannahDefs.ts:254-277] [src:balance/342] [H]
- Savannah fixed (fork reconstruction): grassy_cover_01–03 8/9, grassy_cover_complex_01 2/3, brush_clump_01–03 11/13, perch_01 11/13, kopje_patch_01 2/3, savannah_patch_01 4/5, mansion_structure_01 1, warehouse_01 3/4, warehouse_03sv 1, cache_01sv/02sv/07 1, bunker_structure_01sv 1, bunker_structure_03 1, chest_01 1, chest_03sv 1, mil_crate_05 6/8, tree_02 3 [src:survev/shared/defs/maps/savannahDefs.ts:278-303] [H]
- Fandom (original Savannah): only the shack, outhouse, warehouse, storm bunker, egg bunker and mansion spawn among normal structures; rivers "don't always spawn nor cross the map" [src:fandom/Savannah_Map] [src:fandom/Maps] [M]
- Cobalt (fork reconstruction): Main density with `cb` re-skins; fixed as Main plus `class_shell_01` 45/55 (balance.txt 0.3.0 logs "30 -> 35-45"; the def now says 45/55), cache_log_13 1, teahouse_complex_01cb, chest_01cb, chest_03cb, club_complex_01 1 [src:survev/shared/defs/maps/cobaltDefs.ts:119-178] [src:balance/296] [H]
- Beach (fork): density stone_01 275, silo_01 3, crate_09bh 6, cache_06bh 12, tree_01 75, tree_13bh 195, tree_14 35, hedgehog_01 10, loot_tier_beach 24, barrel_05 10; fixed hut_01bh 5/6, hut_04 1, chest_02 2, mansion_structure_03 1, bunker_structure_01 odds 0.25 [src:survev/shared/defs/maps/beachDefs.ts:192-252] [H]
- Birthday (fork): stone_01 250, barrel_01bd 70, silo_01 16, crate_01 120, tree_01 300, loot_tier_1 100 [src:survev/shared/defs/maps/birthdayDefs.ts:160-169] [H]

## Density count estimates (derived)

> `count = round(density × shoreArea / 250000)`; ignoring the ±3 shore jitter and river area, shoreArea ≈ (size − 2·shoreInset)². Each river removes roughly 2·(width + shoreWidth)·length (≈ 34 000 for a 16-wide river across a 720 map).

| map / team size | shoreArea (no rivers) | multiplier | examples | sources |
|---|---|---|---|---|
| Main solo/duo (720) | 624² = 389 376 | 1.56 | stone_01 ≈ 545, tree_01 ≈ 498, bush_01 ≈ 121, barrel_01 ≈ 118, crate_01 ≈ 78, loot_tier_1 ≈ 37, silo_01 ≈ 12 | [src:derived/density-estimate] [M] |
| Main squad (768) | 672² = 451 584 | 1.81 | stone_01 ≈ 632, tree_01 ≈ 578, crate_01 ≈ 90, silo_01 ≈ 14 | [src:derived/density-estimate] [M] |
| Desert (720) | 704² = 495 616 | 1.98 | stone_01 ≈ 555, tree_06 ≈ 436, tree_05c ≈ 190 (orig ≈ 285) | [src:derived/density-estimate] [M] |
| Woods 720 / 736 | 704² / 720² | 1.98 / 2.07 | crate_01 ≈ 119 / 124 | [src:derived/density-estimate] [M] |
| Faction (880) | 784² = 614 656 | 2.46 | stone_01 ≈ 861, tree_08f ≈ 787, crate_02f / crate_22 ≈ 12 each | [src:derived/density-estimate] [M] |
| Savannah 720 / 768 | 672² / 720² | 1.81 / 2.07 | – | [src:derived/density-estimate] [M] |

- Fandom's Silo infobox gives a quantity of 10 on the Normal map, consistent with ≈ 12 before river area is subtracted [src:fandom/Silo] [src:derived/density-estimate] [M]

## Conflicts

- CONFLICT main-hut-count: orig Main import has hut_01 4 and no scout hut [src:derived/survev@9f64948d:src/defs/modes/main.ts:173-174] vs survev hut_01 3 + hut_03 1 [src:survev/shared/defs/maps/baseDefs.ts:921-923], the orig Main Summer import [src:derived/survev@33832ffe:src/defs/maps/mainSummerDefs.ts:54-87] and fandom's "3 Normal Huts, One Gold Hut, One Scout Hut" [src:fandom/Normal_Map]; proposed: hut_01 3 + hut_02 1 + hut_03 1 (scout hut added in 0.7.9) [M]
- CONFLICT main-warehouses: orig warehouse_01 2 [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:396] vs survev warehouse_01 1/2 + warehouse_03 1 [src:survev/shared/defs/maps/baseDefs.ts:915-916] [src:balance/212-214]; proposed: revert to warehouse_01 2, no warehouse_03 (fork) [H]
- CONFLICT main-palm-trees: survev density tree_13 30 [src:survev/shared/defs/maps/baseDefs.ts:900] vs orig Main without tree_13 [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:372-393] [src:balance/209]; proposed: no tree_13 on Main for 0.8.82 (fork) [H]
- CONFLICT desert-lake: survev Desert has an oasis lake [src:survev/shared/defs/maps/desertDefs.ts:237-250] vs orig Desert with no lake [src:derived/survev@9f64948d:src/defs/modes/desert.ts:200-216]; proposed: no lake for 0.8.82, keep as option (fork) [H]
- CONFLICT desert-river-weights: survev [8,6] at weight 0.21 [src:survev/shared/defs/maps/desertDefs.ts:255] vs orig [8] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:205]; proposed: orig [8] (survev changed it to remove a "repeated" entry) [M]
- CONFLICT woods-tree-counts: orig import tree_07 1400 / tree_08 1300 / tree_08b 200 [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:205-227] vs survev 1100 / 1100 / 150 from an original map msg [src:derived/survev-git-c94e4c39] and the 0.8.1 tree reduction [src:changelog/0.8.1]; proposed: 1100 / 1100 / 150 (the import predates 0.8.1) [M]
- CONFLICT woods-pavilion: orig Woods import has a lake without a centre object [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:150-160] vs fandom (Woods Map has the pavilion on the lake island) [src:fandom/Woods_Map] [src:fandom/Lake] and the original `teapavilion_01w` with `lakeCenter: true` [src:kong/relaunch-client-defs]; proposed: spawn `teapavilion_01w` at the lake centre as survev does [M]
- CONFLICT halloween-houses: orig house_red_01h 7 with house_red_01/02→house_red_01b replacements [src:derived/survev@33832ffe:src/defs/maps/halloweenDefs.ts:138-175] vs survev house_red_01h 2/3 + house_red_02h 2/3 [src:survev/shared/defs/maps/halloweenDefs.ts:239-267]; proposed: orig values; fandom says dark red houses do not appear on Halloween [src:fandom/Grass] [M]
- CONFLICT savannah-generation: survev's Savannah has a central cloud-bunker lake, an oasis and 2 crate lakes, rivers [4]/[4,4] [src:survev/shared/defs/maps/savannahDefs.ts:196-244] vs fandom's original 3 lakes (one fixed central, two random) each with a crate on the island [src:fandom/Lake]; proposed: 3 lakes (central + 2 random) with `crate_02sv_lake` centres, no cloud bunker or oasis [M]
- CONFLICT river-count: fandom "as much as 3 rivers per game" [src:fandom/River] vs width sets of up to 5 rivers at weight 0.0001 [src:survev/shared/defs/maps/baseDefs.ts:828-831]; proposed: keep the 5-river set (practically never seen) [L]
- CONFLICT cobalt-class-pods: survev class_shell_01 45/55 [src:survev/shared/defs/maps/cobaltDefs.ts:141-178] vs survev's own earlier 30 [src:balance/296]; both are fork reconstructions, the original count is unknown; proposed: 30, config knob [L]

## Open questions

- Original river path algorithm (survev's is a 2025 rewrite) and what `rivers.smoothness` controlled [src:derived/survev-git-c4841f72] [src:survev/shared/defs/maps/baseDefs.ts:834] [L]
- Semantics of the original `spawnPriority`, `river.centerWeight` and `nearbyRiver.radMin/radMax` terrain fields [src:kong/relaunch-client-defs] [L]
- Original Cobalt, Savannah and Turkey spawn tables (survev's are reconstructions) [src:derived/survev@33832ffe:src/defs/maps/cobaltDefs.ts:1-48] [src:derived/survev@33832ffe:src/defs/maps/savannahDefs.ts:1-32] [L]
- Whether the original server used `Math.random` for object placement (survev does), i.e. whether a seed reproduced a full map [src:survev/server/src/game/map.ts:1637-1646] [L]
- The survev waterEdge distance hacks (hut −16, docks −(shoreInset − 6.5), conch −24) replace unknown original uses of `distMin/distMax` [src:survev/server/src/game/map.ts:1495-1503] [L]
- Original Snow (0.6.9 / 0.8.x) spawn counts beyond the replacements in the import, e.g. stone_04x count [src:derived/survev@33832ffe:src/defs/maps/snowDefs.ts:87-148] [src:balance/201] [L]
