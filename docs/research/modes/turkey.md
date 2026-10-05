# Turkey map ("Turkey shoot" 2018, "Fowl Play" 2019)

> survev id `turkey` (no own mapId → Main, 0). The original Thanksgiving events ran on the normal island: in 2018 only the M1100 feather effect and the win message changed; in 2019 ("Fowl Play") green squashes with the Perky Shoot perk were added.
> The 0.8.82 relaunch client (`kong/relaunch-client-defs`) has **no** turkey map def, but it still contains the client-side pieces: `gameMode.turkeyMode` handling, the `squash_01` obstacle, the `turkey_shoot` perk, the feather particles and sounds, and the turkey gold airdrop `airdrop_crate_02tr` / `crate_11tr`.
> survev's turkey colours, atlas, leaf piles, second squash and spawn table were written by the fork in Oct–Nov 2025 (commits `702d6d72`, `fc6f5412`, `b16cc1ac`); the pre-fork def (`derived/git-ae55c9a8`) was just main plus `turkeyMode`. Treat everything below that has no original-client or wiki source as a fork reconstruction.

## Identity

- survev registers `turkey: Turkey`; the def sets `desc.name` "Turkey", empty icon and buttonCss, splash `img/splashes/turkey.webp`, and no mapId (so mapId 0) [src:survev/shared/defs/mapDefs.ts:58, survev/shared/defs/maps/turkeyDefs.ts:5-10, survev/shared/defs/maps/turkeyDefs.ts:120] [H]
- `gameMode: { turkeyMode: true }` is merged onto Main's (80 players, kill leader on) [src:survev/shared/defs/maps/turkeyDefs.ts:46, survev/shared/defs/maps/baseDefs.ts:62-65] [H]
- The pre-fork turkey def had `desc.name` "Normal", main colours and spawns, and `turkeyMode: 1` [src:derived/git-ae55c9a8] [H]
- fandom calls the 2019 version the "Thanksgiving map" and the Thanksgiving Event [src:fandom/Changelog, fandom/Green_Squash] [M]
- Korean community name: 칠면조 이벤트 (turkey event) [src:namu/Surviv.io/이벤트] [M]

## Dates and versions

| event | start | end | queues | what it was | src |
|---|---|---|---|---|---|
| Turkey shoot | 0.6.6, Nov 19, 2018 | Nov 24, 2018 ("Bye bye birdie") | all | normal map; new M1100 shotgun whose hits make turkey feathers; berry bush obstacle; win message "Winner winner turkey dinner!" | [src:changelog/0.6.6, fandom/Changelog] [H] |
| Fowl Play | 0.8.73, Nov 26, 2019 | Dec 2, 2019 (ended with 0.8.8) | all | green squashes drop the Perky Shoot perk and rarely XP artifacts; Fowl Facade outfit (Survivr Pass 1 level 30); XP artifact Bone of Gordon | [src:changelog/0.8.73, fandom/Changelog] [H] |

- On Nov 24, 2018 the feather effect of the M1100 was removed, the win message reverted and an M1100 wall mount was added; the M1100 stayed as a common drop [src:fandom/Changelog] [M]
- namu.wiki: the 2018 turkey event (Nov 19, 2018) did not change the map or add buildings; hits with the new gun showed turkey feathers instead of blood and kills played a "꼬끼오" (cock-a-doodle) sound [src:namu/Surviv.io/이벤트] [M]
- 0.6.6 also decreased the M870 and MP220 drop rates [src:changelog/0.6.6] [H]
- 0.8.8 secret changes: Thanksgiving map ended (green squashes no longer spawn), Fowl Facade no longer drops on death, win message back to chicken dinner [src:fandom/Changelog] [M]
- fandom: Perky Shoot was "the first perk that is intentionally available in normal mode" [src:fandom/Perky_Shoot] [M]

## Mode rules (original client behaviour)

- With `turkeyMode` the victory title uses `game-turkey` "Winner winner turkey dinner!" instead of `game-chicken` [src:survev/client/src/ui/ui.ts:1312-1316, l10n/en:game-turkey] [H]
- Korean win message: 위너위너 터키 디너! (normal: 위너위너 치킨 디너!) [src:l10n/ko:game-turkey, l10n/ko:game-chicken] [H]
- With `turkeyMode`, a bullet from a player who has `turkey_shoot` makes `turkeyFeathersHit` particles on the hit player [src:survev/client/src/objects/bullet.ts:414-421] [H]
- A kill by a player holding `turkey_shoot` plays the `cluck` sound group and `feather_01` and spawns 30–35 `turkeyFeathersDeath` particles (this part does not check turkeyMode) [src:survev/client/src/objects/player.ts:3019-3035] [H]
- The original client contains `turkeyMode`, `turkey_shoot`, `turkeyFeathersHit`, `turkeyFeathersDeath`, `cluck_01/02` and `feather_01` [src:kong/relaunch-client-defs] [H]
- The survev server stores `turkeyMode` but has no other turkey logic [src:survev/server/src/game/map.ts:295] [H]

## Perky Shoot (`turkey_shoot`)

- Perk "Perky Shoot", description "Gobble, gobble!", fires the turkey emote `emote_turkeyanimal` on pickup, loot border `loot-circle-outer-03` [src:survev/shared/defs/gameObjects/perkDefs.ts:857-866, l10n/en:game-turkey_shoot-desc, fandom/Perky_Shoot] [H]
- Purely cosmetic: the M1100's 2018 feather effect moved into a perk; its name combines "perk" and "turkey shoot" [src:fandom/Perky_Shoot] [M]
- Korean: 퍼키 슛, description 꼬끼오오오! [src:l10n/ko:game-turkey_shoot, l10n/ko:game-turkey_shoot-desc] [H]

## Green Squash and other obstacles

| id | name | original client | survev | src |
|---|---|---|---|---|
| `squash_01` | Green Squash | 100 HP, circle r1.25, hidden on the minimap, sprite `map-squash-01`, loot Perky Shoot + 1 `tier_fruit_xp` | 100 HP, r1, shown on the minimap (0x627344, scale 1.25), sprite `map-squash-03`, loot Perky Shoot + 0–1 `tier_world` (XP commented out) | [src:kong/relaunch-client-defs, survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763-777] [H] |
| `squash_02` | large squash (fork) | absent | 200 HP, r1.5, sprite `map-squash-02`, loot 2 × Perky Shoot + 1–2 `tier_soviet` | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:778-792, kong/relaunch-client-defs] [H] |
| `airdrop_crate_02tr` → `crate_11tr` | turkey gold airdrop | exists: gold crate whose contents add 2 × `tier_airdrop_xp` | exists but the turkey def does not use it (planes inherit main's `airdrop_crate_01` / `_02`) | [src:kong/relaunch-client-defs, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:720-739, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1170-1182, survev/shared/defs/maps/baseDefs.ts:81-84] [H] |

- fandom Green Squash: internal `squash_01`, found on grass, 100 HP, loot Perky Shoot (1) and Tier Pumpkin XP (1), "found scarcely around the map", very rarely an XP artifact [src:fandom/Green_Squash] [M]
- Fowl Play changed red pumptatos to drop `tier_fruit_xp` like the squash instead of `tier_pumpkin_xp` [src:fandom/Changelog] [M]
- XP artifacts are disabled in survev (`tier_fruit_xp` = nothing 40); Bone of Gordon (`xp_bone`, 고든의 뼈) sits in survev's unused `tier_xp_rare` at 0.1 [src:survev/shared/defs/maps/baseDefs.ts:701-716, l10n/ko:game-xp_bone] [H]
- Squash hits use `squashChip` / `squashBreak` particles and the pumpkin break sound [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:770-771, survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:224-256, kong/relaunch-client-defs] [H]

## survev turkey reconstruction (fork)

### Biome and audio

| field | value | src |
|---|---|---|
| background / water / waterRipple | 0x474d4a / 0x707b76 / 0x7e8984 (grey) | [src:survev/shared/defs/maps/turkeyDefs.ts:35-37, derived/git-ae55c9a8] [L] |
| beach / riverbank | 0xcc975b / 0xbd5c21 | [src:survev/shared/defs/maps/turkeyDefs.ts:38-39] [L] |
| grass | 0xa08b2f (autumn yellow-brown) | [src:survev/shared/defs/maps/turkeyDefs.ts:40] [L] |
| underground / playerSubmerge | 0x1b0d03 / 0x2b8ca4 (main) | [src:survev/shared/defs/maps/turkeyDefs.ts:41-42] [H] |
| playerGhillie | 0xa48e2e | [src:survev/shared/defs/maps/turkeyDefs.ts:43] [L] |

- Audio preload: club music, `ambient_steam_01`, `cluck_01`, `cluck_02`, `feather_01`, `xp_pickup_01/02`, `xp_drop_01/02`, `pumpkin_break_01`, `log_05`, `vault_change_03`, `watering_01` [src:survev/shared/defs/maps/turkeyDefs.ts:12-30] [H]
- The pre-fork def already listed cluck, feather, XP and pumpkin sounds; survev added `log_05`, `vault_change_03`, `watering_01` [src:derived/git-ae55c9a8, survev/shared/defs/maps/turkeyDefs.ts:27-29] [M]
- Atlas `turkey` (fork atlas, Nov 2025) replaces main's [src:survev/shared/defs/maps/turkeyDefs.ts:31, survev/shared/defs/mapDefs.ts:37] [M]
- No camera particles, no ambience override, normal plane and chute [src:survev/shared/defs/maps/turkeyDefs.ts:33-45] [H]

### Spawns (s = solo/duo, l = squad)

| id | object | survev | pre-fork (= main) | src |
|---|---|---|---|---|
| `squash_01` / `squash_02` | squashes (density) | 25 / 12 | absent | [src:survev/shared/defs/maps/turkeyDefs.ts:52-53, derived/git-ae55c9a8] [H] |
| `bush_06tr` | turkey leaf pile without loot (fork) | 70 | absent (no bush; main had `bush_01` 78) | [src:survev/shared/defs/maps/turkeyDefs.ts:60, balance/198] [H] |
| `cache_03tr` | turkey leaf-pile loot cache (fork) | 50 | absent | [src:survev/shared/defs/maps/turkeyDefs.ts:61, balance/196] [H] |
| `cache_06` | berry bush cache | removed | 12 | [src:balance/197, derived/git-ae55c9a8] [H] |
| `tree_07` / `tree_08` / `tree_08b` | autumn trees (`tree_01` → `tree_08`) | 20 / 170 / 4 | `tree_01` 320 | [src:survev/shared/defs/maps/turkeyDefs.ts:62-64, survev/shared/defs/maps/turkeyDefs.ts:112, derived/git-ae55c9a8] [H] |
| `stone_01` | stone | 200 | 350 | [src:survev/shared/defs/maps/turkeyDefs.ts:54, derived/git-ae55c9a8] [H] |
| `silo_01` / `crate_01` / `crate_02` / `crate_03` | silo, crates | 9 / 45 / 3 / 7 | 8 / 50 / 4 / 8 | [src:survev/shared/defs/maps/turkeyDefs.ts:56-59, derived/git-ae55c9a8] [H] |
| `outhouse_01` / `outhouse_02` | outhouse / red fire-axe outhouse | 7 / 2 | 5 / absent | [src:survev/shared/defs/maps/turkeyDefs.ts:71-72, derived/git-ae55c9a8] [H] |
| `woodpile_02` | refined wood pile (fork obstacle) | 4 | absent | [src:survev/shared/defs/maps/turkeyDefs.ts:75, derived/git-ae55c9a8] [M] |
| `hedgehog_01`, `container_01`–`04`, `shack_01`, `loot_tier_1`, `loot_tier_beach` | as main | 24, 5 each, 7, 24, 4 | same | [src:survev/shared/defs/maps/turkeyDefs.ts:65-74] [H] |
| `hut_01` / `hut_02` / `hut_03` | huts | 1 / p 0.05 / p 0.05 | 3 / 1 / 1 | [src:survev/shared/defs/maps/turkeyDefs.ts:87-89, derived/git-ae55c9a8] [H] |
| `cache_02w` | Mosin tree (woods skin) | 1 | `cache_02` | [src:survev/shared/defs/maps/turkeyDefs.ts:94, derived/git-ae55c9a8] [H] |
| `chest_03tr` | river chest (turkey skin, fork) | p 0.2 | `chest_03` p 0.2 | [src:survev/shared/defs/maps/turkeyDefs.ts:104, derived/git-ae55c9a8] [H] |
| `tree_02` | wood-axe stump | 4 | 3 | [src:survev/shared/defs/maps/turkeyDefs.ts:106, derived/git-ae55c9a8] [H] |
| `teahouse_complex_01su` | Summer Teahouse Complex | removed | 1/2 | [src:survev/shared/defs/maps/turkeyDefs.ts:78-108, derived/git-ae55c9a8] [H] |
| `warehouse_01` / `warehouse_03` | warehouses | 1/2 + 1 (fork) | 2 | [src:survev/shared/defs/maps/turkeyDefs.ts:81-82, balance/212, balance/213] [H] |
| `cache_04` | river stone cache (fork) | 1 | absent | [src:survev/shared/defs/maps/turkeyDefs.ts:95, derived/git-ae55c9a8] [H] |
| other fixed spawns | red houses 3/4, barn 1/3, alternate barn 1, fisherman's shacks, greenhouse, stone & barrel caches, egg/hydra/storm/conch/crossing bunkers, docks, treasure chest, OT-38 crate, hardstone block | as main | as main | [src:survev/shared/defs/maps/turkeyDefs.ts:78-108, survev/shared/defs/maps/baseDefs.ts:912-946] [H] |

- The club (centre location spawn), the 2-of-3 bank/police/mansion rotation, places and terrain are inherited unchanged from main [src:survev/shared/defs/maps/baseDefs.ts:878-955, survev/shared/defs/maps/turkeyDefs.ts:47-117] [H]
- Spawn replacements: `tree_01` → `tree_08`, river stone `stone_03` → `stone_03tr` [src:survev/shared/defs/maps/turkeyDefs.ts:110-115] [H]
- `bush_06tr`, `cache_03tr`, `chest_03tr`, `stone_03tr`, `squash_02` and `cache_02w` are not in the 0.8.82 client (fork ids) [src:kong/relaunch-client-defs] [H]
- No loot-table overrides: turkey uses main's tables (including survev's fork BAR) [src:survev/shared/defs/maps/turkeyDefs.ts:47-117, balance/146] [H]

## Fowl Facade

- `outfitTurkey` "Fowl Facade": Survivr Pass 1 bonus unlock at level 30 added in 0.8.73, lore "M1100 not included.", tints body 0xf0cebb (15781563), hands/pack 0xa51300 (10818304); a loadout skin that dropped on death until 0.8.8 [src:fandom/Fowl_Facade, changelog/0.8.73, l10n/en:game-outfitTurkey-lore] [M]
- Korean: 파울 파사드 [src:l10n/ko:game-outfitTurkey] [H]

## Conflicts

- CONFLICT turkey-map-look: survev gives turkey its own grey/autumn biome, autumn trees and leaf piles (fork reconstruction) [src:survev/shared/defs/maps/turkeyDefs.ts:34-44, survev/shared/defs/maps/turkeyDefs.ts:50-77] vs the original events ran on the normal island, the 2018 one with no map changes at all [src:namu/Surviv.io/이벤트, fandom/Perky_Shoot, fandom/Changelog]; proposed: 2018 = main + `turkeyMode` + feather M1100; 2019 = main + `turkeyMode` + green squashes; keep survev's look as an optional theme [L]
- CONFLICT squash-01-def: r1.25, hidden on the minimap, sprite `map-squash-01`, loot Perky Shoot + `tier_fruit_xp` [src:kong/relaunch-client-defs, fandom/Green_Squash] vs r1, minimap dot, sprite `map-squash-03`, loot Perky Shoot + 0–1 `tier_world` [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763-777]; proposed: original def [H]
- CONFLICT turkey-gold-airdrop: turkey uses the plain gold crate [src:survev/shared/defs/maps/baseDefs.ts:81-84] vs the original client ships a dedicated turkey gold crate `airdrop_crate_02tr` (XP artifacts inside) [src:kong/relaunch-client-defs]; proposed: use `airdrop_crate_02tr` as the 1-in-11 gold crate on the 2019 turkey map [M]

## Open questions

- How many green squashes spawned in 2019 ("scarcely") and whether the 2019 map changed anything besides adding them [src:fandom/Green_Squash, survev/shared/defs/maps/turkeyDefs.ts:52] [L]
- Whether the 2019 Thanksgiving map def had its own biome colours (the 0.8.82 client no longer contains it) [src:kong/relaunch-client-defs, fandom/Changelog] [L]
