# Air drops, air strikes, flare guns and strobes

> Both features use one `PlaneBarn` (`server/src/game/objects/plane.ts`) with `Plane.Airdrop = 0` and `Plane.Airstrike = 1`. Plane constants in `GameConfig.airdrop` / `GameConfig.airstrike` are client-visible and identical in the 0.8.82 relaunch bundle. Scheduling, targeting and crush logic are server-only survev code. Fandom map pages list per-mode "schedules" (mm:ss on the wait timer), which let the scheduled timings be checked independently.

## Plane constants

| constant | air drop | air strike | sources |
|---|---|---|---|
| `planeVel` | 48 u/s | 350 u/s | [src:survev/shared/gameConfig.ts:282-305] [src:kong/relaunch-client-bundle] [H] |
| `planeRad` | 150 | 120 | [src:survev/shared/gameConfig.ts:282-305] [src:kong/relaunch-client-bundle] [H] |
| `fallTime` | 8 s | — | [src:survev/shared/gameConfig.ts:284] [src:kong/relaunch-client-bundle] [src:fandom/Flare_Gun] [H] |
| `crushDamage` | 100 (declared, but the server applies 1e10, see below) | — | [src:survev/shared/gameConfig.ts:285] [src:survev/server/src/game/objects/airdrop.ts:86-91] [H] |
| `bombCount` / `bombOffset` / `bombJitter` / `bombVel` | — | 20 bombs, 2 u apart, ±4 u jitter, 3 u/s forward | [src:survev/shared/gameConfig.ts:293-305] [src:kong/relaunch-client-bundle] [src:fandom/Air_Strike] [H] |
| sound `soundRangeMult` / `soundRangeDelta` / `soundRangeMax` | 2.5 / 0.25 / 92 | 18 / 18 / 48 | [src:survev/shared/gameConfig.ts:288-303] [src:kong/relaunch-client-bundle] [H] |
| `fallOff` | 0 | 1.25 | [src:survev/shared/gameConfig.ts:291-304] [src:kong/relaunch-client-bundle] [H] |
| plane spawn distance from target | 48 × 15 = 720 u (15 s of flight) | 350 × 2.5 = 875 u (2.5 s) | [src:survev/server/src/game/objects/plane.ts:20-22] [M] |
| plane alive bounds | map AABB expanded by 256 on every side; removed once outside and action done | same | [src:survev/server/src/game/objects/plane.ts:51-74] [M] |
| plane id range | 1–254, recycled | same | [src:survev/server/src/game/objects/plane.ts:26] [src:survev/server/src/game/objects/plane.ts:298-313] [M] |
| plane art / sound (per biome) | `map-plane-01.img`, `plane_01`, chute `map-chute-01.img` | fighter sound `fighter_01` | [src:survev/shared/defs/maps/baseDefs.ts:56-60] [src:survev/client/src/objects/plane.ts:83] [M] |

## Air drop lifecycle

1. Schedule: on each `circleIdx` change, every `planes.timings` entry with that `circleIdx` is queued with its `wait` delay in seconds [src:survev/server/src/game/objects/gas.ts:305-309] [src:survev/server/src/game/objects/plane.ts:169-174] [H]
2. Target: when the wait expires the drop point is `gas.posNew + randomPointInCircle(gas.radNew)`, a uniform point inside the next safe circle [src:survev/server/src/game/objects/plane.ts:94-102] [src:fandom/Meteor_Crate] [src:namu/Surviv.io] [H]
3. Crate type: `options.airdropType` if set, otherwise a weighted pick from the map's `planes.crates` [src:survev/server/src/game/objects/plane.ts:315] [H]
4. Overlap avoidance (up to 10,000 tries): the crate collider is pushed out of non-destructible layer-0 obstacles, out of the `zoomIn` (ceiling) regions of buildings with indestructible ceilings, and away from landed and in-flight crates; opened (dead) crate shells stay in the grid and still count. Box-against-box pushes go along the axis of the larger overlap (`coldet.intersectAabbAabb`). On tries where `attempts % 100 > 75` it is nudged 3 u in a random direction, and it is clamped to map bounds each try (a box by its larger side, a round crate by its radius); the push can carry a scheduled crate a few units outside the safe circle, nothing re-rolls it [src:survev/server/src/game/objects/plane.ts:319-423] [src:survev/shared/utils/coldet.ts:405-428] [src:changelog/0.5.02] [M]
5. Consequence: crates never land on indestructible roofs but can land on destructible-ceiling buildings (shacks, huts, outhouses, greenhouses …) [src:survev/server/src/game/objects/plane.ts:353-371] [M]
6. Plane: spawned 720 u from the requested point in a random direction, flying straight at the adjusted drop point at 48 u/s. It releases when within 5 u (≈15 s after the call) and keeps flying until out of bounds [src:survev/server/src/game/objects/plane.ts:431-438] [src:survev/server/src/game/objects/plane.ts:636-651] [src:fandom/Flare_Gun] [H]
7. Release: an `Airdrop` object (parachute) is created and a `ping_airdrop` map ping is broadcast at the drop point. The ping is orange `0xff6600`, `pingLife` 4 s and `mapLife` 10 s, map/minimap only (`worldDisplay: false`), with sound `ping_airdrop_01` [src:survev/server/src/game/objects/airdrop.ts:17-22] [src:survev/shared/defs/gameObjects/pingDefs.ts:58-69] [src:fandom/Air_Drop] [H]
8. Fall: `fallT` goes 0→1 over 8 s. The client shrinks the chute radius from 12 to 5 (`lerp((1 − fallT)^1.1, 5, 12)`) and plays `airdrop_chute_01` and `airdrop_fall_01` [src:survev/server/src/game/objects/airdrop.ts:61-71] [src:survev/client/src/objects/airdrop.ts:157-199] [M]
9. Landing: every player and obstacle on the same layer whose collider (or obstacle AABB) overlaps the crate takes 1e10 `DamageType.Airdrop` damage. Destructible-ceiling buildings whose `zoomIn` overlaps lose their ceiling. Then the crate obstacle is spawned and nearby loot is re-simulated [src:survev/server/src/game/objects/airdrop.ts:68-110] [src:fandom/Flare_Gun] [H]
10. Landing FX: 10 `airdropSmoke` particles and crash sound `airdrop_crash_01` (`airdrop_crash_02` with 12 ripples on water). The parachute object is deleted 1 s after landing [src:survev/client/src/objects/airdrop.ts:117-155] [src:survev/server/src/game/objects/airdrop.ts:29-36] [M]
11. Players never spawn within 8 u of a falling or landed air-drop object [src:survev/server/src/game/map.ts:2209-2215] [src:changelog/0.6.95] [H]

- Kill feed for crushing: "<player> crushed" with killer "The air drop" (`game-crushed`, `game-the-air-drop`; Korean 깔렸습니다.) [src:l10n/en:game-crushed] [src:l10n/en:game-the-air-drop] [src:l10n/ko:game-crushed] [H]
- Fandom: a flare fired next to a hardstone block or boulder breaks it when the drop lands. wiki.gg says the same [src:fandom/Flare_Gun] [src:wikigg/Flare_Gun] [H]
- Timing check: fandom "about 15 seconds after a flare is fired for an air drop to appear, then 8 seconds for it to hit the ground"; Cobalt schedule "0:55 Air Drop (#1, dropped: 0:41-0:35)" (released 14–20 s after the call, matching survev's 15 s flight; landing takes a further 8 s). namu says about 20 s [src:fandom/Flare_Gun] [src:fandom/Cobalt_Map] [src:namu/Surviv.io/무기] [H]

## Opening the crate (shell → loot crate)

| step | value | sources |
|---|---|---|
| shell obstacle (`createAirdrop`) | category `airdrop`, health 200 but `destructible: false`, `reflectBullets: true`, collision AABB ±2.5 (military ±4) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:125-157] [src:kong/relaunch-client-defs] [src:wikigg/Airdrop_Crate] [H] |
| interaction | button: `interactionRad 1`, text `game-unlock` ("Unlock" / 잠금 해제), `useOnce`, `destroyOnUse`, `useDelay 2.5` s, sound `airdrop_open_01` | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:139-149] [src:kong/relaunch-client-defs] [src:l10n/en:game-unlock] [src:l10n/ko:game-unlock] [H] |
| after 2.5 s | shell is killed (kill ticker uses `DamageType.Airdrop`), the `destroyType` loot crate is spawned in place, and the `airdrop_unlocked` quest event fires for the opener | [src:survev/server/src/game/objects/obstacle.ts:290-300] [src:survev/server/src/game/objects/obstacle.ts:519-552] [src:survev/server/src/game/objects/obstacle.ts:801-804] [M] |
| loot crate | normal destructible crate (200 HP; military `crate_12` 500 HP; gold military `crate_13` 200 HP in the client, 500 per fandom) that drops its loot when broken (see `loot.md`) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:593-866] [src:kong/relaunch-client-defs] [src:fandom/Meteor_Crate] [H] |
| Cobalt class shells | `class_shell_01`/`_02` have `smartLoot`: the pod spawned is `<destroyType>_<role>` of the opener, and loot is owned by the opener for 2 s if within 8 u. `class_shell_03` (mythic) has no `smartLoot` | [src:survev/server/src/game/objects/obstacle.ts:531-552] [src:survev/server/src/game/objects/obstacle.ts:586-606] [M] |
| quest | `quest_airdrop` "Unlock air drops" (plus `_ltm`, `_ltm_hard`, `quest_airdrop_rare`) | [src:l10n/en:quest_airdrop] [src:l10n/en:quest_airdrop_rare] [src:changelog/0.8.61] [H] |

## Crate types

> The rebirth splits the plain normal drop (`airdrop_crate_01`, `_01x`, `_01sv`) into tier 1 and tier 2 drops that open into their own crates, at the owner's request; see `rebirth-deviations.md` "Air drop tiers".

- The gold shell looks like the normal one: `airdrop_crate_01` and `airdrop_crate_02` both draw `map-airdrop-01.img` (opened: `map-airdrop-02.img`), as do the desert, savannah and turkey gold shells (`_02de`, `_02sv`, `_02tr`), so a gold drop shows only once its loot crate `crate_11` (gold corners) appears [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1008-1033] [H]
- Snow is the exception: the original client draws its gold shell `airdrop_crate_02x` with its own `map-airdrop-02x.img` against the normal `airdrop_crate_01x`'s `map-airdrop-01x.img` (both open into `map-crate-13x.img`), so a snow gold drop shows before it is opened; survev draws both with `map-airdrop-01x.img` [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1183-1208] [H]
- Neither client ships `map-crate-13x.img` (the original drew an opened snow drop as nothing); survev opens both snow drops on `map-airdrop-02x.img`, which the rebirth takes for the opened image only (`tools/port-survev/policy.json` survevSpriteFixes); the closed images stay the original's [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1183-1208] [H]

| shell id | → loot crate | where used | status | sources |
|---|---|---|---|---|
| `airdrop_crate_01` | `crate_10` (regular "meteor crate") | main, desert, woods, potato, halloween, beach (fork) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1008] [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [H] |
| `airdrop_crate_02` | `crate_11` (gold) | main, woods, potato, halloween, beach (fork) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1021] [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [H] |
| `airdrop_crate_03` | `crate_12` (military, AABB ±4) | 50v50 scheduled and flare drops | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1034] [src:kong/relaunch-client-defs] [src:fandom/Military_Air_Drop] [H] |
| `airdrop_crate_04` | `crate_13` (gold military) | 50v50 golden drop | original object; fork trigger logic | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1076] [src:kong/relaunch-client-defs] [src:fandom/Military_Air_Drop] [H] |
| `airdrop_crate_01sv` / `_02sv` | `crate_10sv` / `crate_11sv` (+ perks) | savannah | original (post-0.8.82 savannah content is in the client) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1117-1142] [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [H] |
| `airdrop_crate_02de` | `crate_11de` (+1 perk) | desert | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1143] [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [H] |
| `airdrop_crate_02h` | `cache_pumpkin_airdrop_02` (golden pumpkin) | halloween, forced at circle 3 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1156-1169] [src:survev/shared/defs/maps/halloweenDefs.ts:118-124] [src:kong/relaunch-client-defs] [src:changelog/0.8.7] [H] |
| `airdrop_crate_02tr` | `crate_11tr` (+2 XP) | Thanksgiving (turkey) event in the original; survev's turkey map does not reference it | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1170] [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [M] |
| `airdrop_crate_01x` / `_02x` | `crate_10` / `crate_11` with snow art | snow | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1183-1208] [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [H] |
| `class_shell_01` / `_02` / `_03` | role pod / gold role pod / `class_crate_mythic` | cobalt (`_02` w10, `_03` w1 by air) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1209-1258] [src:survev/shared/defs/maps/cobaltDefs.ts:39-44] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_05` | `crate_17` (crimson) | desert | (fork) 2026-06-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1104] [src:balance/319] [src:derived/survev-git-94bf1f97] [H] |
| `airdrop_crate_03po` / `_04po` / `_03dev` | `crate_12po` / `crate_13po` / `crate_12dev` ("troll" dev crate) | Potato vs Tomato | (fork) 2026-03-29 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1048-1103] [src:balance/331] [src:derived/survev-git-2255ceef] [H] |

## Per-mode schedules (`mapDef.gameConfig.planes`)

> "wait" is seconds after the start of that circle's Waiting phase; "timer" is the wait countdown shown on the HUD at that moment (Waiting durations 80/65/50/40/30/25/20/15 s for circleIdx 0–7). Maps inherit Main's `timings` unless they redefine the array.

| map | circleIdx → wait → timer | crates (weight) | sources |
|---|---|---|---|
| Main (normal), and by inheritance cobalt, savannah, turkey, main spring/summer | 1 → 10 s → 0:55; 3 → 2 s → 0:38 | `01` w10, `02` w1 (gold ≈ 9.1 %) | [src:survev/shared/defs/maps/baseDefs.ts:68-85] [src:fandom/Normal_Map] [src:fandom/Cobalt_Map] [H] |
| Desert | same timings | (fork) `01` w12, `02de` w1, `05` w1; original `01` w10, `02de` w1 | [src:survev/shared/defs/maps/desertDefs.ts:48-66] [src:balance/319] [src:fandom/Desert_Map] [src:fandom/Cinco_de_Mayo_Map] [H] |
| Woods | same timings | `01` w10, `02` w1 | [src:survev/shared/defs/maps/woodsDefs.ts:40-57] [M] |
| Snow | 0 → 10 s → 1:10; 1 → 10 s → 0:55; 2 → 6 s → 0:44; 3 → 2 s → 0:38 | `01x` w10, `02x` w1 | [src:survev/shared/defs/maps/snowDefs.ts:43-70] [src:fandom/Snow_Map] [H] |
| Halloween | 1 → 10 s → 0:55; 3 → 2 s → 0:38 with forced `airdrop_crate_02h` | `01` w10, `02` w1 | [src:survev/shared/defs/maps/halloweenDefs.ts:110-130] [src:fandom/Halloween_Map] [src:wikigg/Airdrop_Crate] [H] |
| Potato | 1 → 10 s; 3 → 2 s | `01` w1, `02` w1 (gold 50 %) | [src:survev/shared/defs/maps/potatoDefs.ts:51-68] [M] |
| Savannah | inherited Main timings | `01sv` w10, `02sv` w1 | [src:survev/shared/defs/maps/savannahDefs.ts:37-42] [M] |
| Cobalt | inherited Main timings | `class_shell_02` w10, `class_shell_03` w1 | [src:survev/shared/defs/maps/cobaltDefs.ts:39-44] [src:fandom/Cobalt_Map] [src:wikigg/Airdrops] [H] |
| Birthday | `timings: []` (no scheduled drops) | inherited | [src:survev/shared/defs/maps/birthdayDefs.ts:46-48] [M] |
| Woods snow / spring / summer | inherit Woods (timings and `01` w10 / `02` w1; woods snow does not switch to the `_x` snow shells) | inherited | [src:survev/shared/defs/maps/woodsSnowDefs.ts:146] [src:survev/shared/defs/maps/woodsSpringDefs.ts:124] [src:survev/shared/defs/maps/woodsSummerDefs.ts:71] [M] |
| Potato spring | inherits Potato | inherited | [src:survev/shared/defs/maps/potatoSpringDefs.ts:109] [M] |
| Beach (fork) | 0 → 25 s; 1 → 10 s; 3 → 2 s | `01` w10, `02` w1 | [src:survev/shared/defs/maps/beachDefs.ts:35-57] [M] |
| 50v50 (faction) | airstrike 1 → 10 s (0:55); military drop 2 → 6 s (0:44); airstrike 2 → 30 s; airstrike 3 → 8 s (0:32); military drop 4 → 3 s (0:27); airstrike 4 → 21 s; airstrike 5 → 6 s (0:19) | `airdrop_crate_03` w1 | [src:survev/shared/defs/maps/factionDefs.ts:104-193] [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map] [H] |
| Potato vs Tomato (fork) | inherits 50v50 timings | `03po` w1110, `03dev` w1 (balance log says 1/1111) | [src:survev/shared/defs/maps/factionPotatoDefs.ts:102-107] [src:balance/331] [M] |

- Fandom notes that scheduled events "typically appear at the next second as it waits until the second ends" [src:fandom/50v50_Map] [M]
- wiki.gg: air drops start "after the first few red zone advances" [src:wikigg/Airdrops] [M]

## Flare gun

- `flare_gun` (1 flare, `ammoSpawnCount 1`) and `flare_gun_dual` (2) fire `bullet_flare`: damage 0, speed 4, distance 16. `addFlare: true` makes `fireBullet` call `planeBarn.addAirdrop(bullet start pos)` with the map's weighted crate list [src:survev/shared/defs/gameObjects/gunDefs.ts:3301-3360] [src:survev/shared/defs/gameObjects/bulletDefs.ts:730] [src:survev/server/src/game/objects/bullet.ts:116-119] [src:kong/relaunch-client-defs] [H]
- The drop target is wherever the gun is fired, including in the red zone. Flare drops skip the safe-circle restriction but still go through the overlap avoidance [src:survev/server/src/game/objects/bullet.ts:116-119] [src:fandom/Flare_Gun] [src:fandom/Meteor_Crate] [H]
- `outsideOnly: true`: firing indoors is refused with "Gun cannot be fired here!" (`game-gun-cannot-fire`) [src:survev/shared/defs/gameObjects/gunDefs.ts:3310] [src:survev/server/src/game/weaponManager.ts:731-736] [src:wikigg/Flare_Gun] [src:l10n/en:game-gun-cannot-fire] [H]
- survev's `indoors` flag is set inside any live-ceiling `zoomIn` region, destructible roofs included, so a flare cannot be fired inside an intact hut; fandom's strategy section says a hut or collapsed shack lets the player fire the flare inside [src:survev/server/src/game/objects/player.ts:2166-2186] [src:survev/server/src/game/weaponManager.ts:731-736] [src:fandom/Flare_Gun] [L]
- In 50v50 the crate list is military (`airdrop_crate_03`), so a flare calls a military drop. Golden military drops cannot be called by flare [src:survev/shared/defs/maps/factionDefs.ts:192] [src:wikigg/Airdrop_Crate] [src:fandom/50v50_Map] [H]
- 50v50 Commander (`leader`) spawns with a flare gun and 1 flare. The commander cannot drop or swap it before firing (`canDropFlare`) [src:survev/shared/defs/gameObjects/roleDefs.ts:135] [src:survev/server/src/game/weaponManager.ts:661-668] [src:wikigg/50v50_mode] [M]
- (fork) The commander auto-fires the flare 15 s after promotion, added 2025-06-11 (`1277302c`) [src:survev/server/src/game/objects/player.ts:1478-1494] [src:derived/survev-git-1277302c] [src:wikigg/Flare_Gun] [M]
- Changelog history: added 0.5.0; 0.6.95 "Fixed an issue with flare guns sometimes not spawning air drops"; 0.7.4 "Added ability to dual wield flare guns" [src:changelog/0.5.0] [src:changelog/0.6.95] [src:changelog/0.7.4] [H]
- Flare ammo `flare` holds 2/4/6/8 for backpack levels 0–3 in the 0.8.82 client; survev's fifth value (10) only serves the fork's level-4 pack. Extra flares come from ammo crates (`tier_ammo_crate` flare w1) [src:kong/relaunch-client-defs] [src:survev/shared/gameConfig.ts:422] [src:survev/shared/defs/maps/baseDefs.ts:176-184] [src:fandom/Flare] [H]

## Air strikes: shared mechanics

| item | value | sources |
|---|---|---|
| plane approach | spawns 875 u behind the target along `−dir` and flies along `dir` at 350 u/s, reaching the target in 2.5 s | [src:survev/server/src/game/objects/plane.ts:441-483] [M] |
| bomb positions | `target + dir × 2 × i + randomPointInCircle(4)` for i = 0..19 (a 38 u strip) | [src:survev/server/src/game/objects/plane.ts:465-471] [src:fandom/Air_Strike] [H] |
| bomb release | after the plane passes the target, one bomb every second server tick until 20 are dropped | [src:survev/server/src/game/objects/plane.ts:660-722] [M] |
| bomb projectile `bomb_iron` | spawned at height 5, velocity `dir × 3`, fuse 4 s, cookable, `explodeOnImpact`, `damageType Airstrike`, owner = strobe thrower or 0 (the game) | [src:survev/server/src/game/objects/plane.ts:678-696] [src:survev/shared/defs/gameObjects/throwableDefs.ts:795-837] [src:kong/relaunch-client-defs] [H] |
| bomb explosion `explosion_bomb_iron` | 40 damage, ×2 vs obstacles, radius 5–14, 2 × `shrapnel_bomb_iron` (10 dmg, speed 24, range 12) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:232-241] [src:survev/shared/defs/gameObjects/bulletDefs.ts:840] [src:kong/relaunch-client-defs] [src:wikigg/Airstrike_Bomb] [H] |
| indoor rule | a bomb inside the `zoomIn` region of a building with an indestructible ceiling is deleted without exploding. Destructible-ceiling buildings are hit | [src:survev/server/src/game/objects/projectile.ts:362-394] [src:survev/server/src/game/objects/projectile.ts:429-432] [src:fandom/Air_Strike] [H] |
| kill feed | killer name "The air strike" (`game-the-air-strike`) for game-spawned strikes | [src:l10n/en:game-the-air-strike] [src:fandom/Air_Strike] [H] |
| map ping | `ping_airstrike`: yellow `0xeaff00`, 2 s world and 2 s map, shown in the world, sound `ping_airstrike_01` | [src:survev/shared/defs/gameObjects/pingDefs.ts:70-81] [src:fandom/Air_Strike] [H] |
| potato mode | bombs carry `weaponSourceType "strobe"` so kills swap weapons like a strobe kill | [src:survev/server/src/game/objects/plane.ts:694] [M] |

## Strobe (player-called air strike)

- `strobe` ("IR Strobe"): throw speed 25, velZ 5, not cookable, does not explode on impact, fuse 13.5 s ending in `explosion_strobe` (1 dmg, ×5 vs obstacles, radius 1.5–2.5, 3 × `shrapnel_strobe` at 3 dmg, range 3) [src:survev/shared/defs/gameObjects/throwableDefs.ts:357-375] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:51-60] [src:kong/relaunch-client-defs] [src:fandom/Strobe] [H]
- `strikeDelay`: 2.5 s in the original (relaunch defs, fandom). survev changed it to 3 ("Changed this from 2.5 to 3"), and wiki.gg documents 3 s; the rebirth uses 3 s, survev being its gameplay baseline (conflicts.md `strobe-strike-delay`) [src:kong/relaunch-client-defs] [src:fandom/Strobe] [src:survev/shared/defs/gameObjects/throwableDefs.ts:367] [src:wikigg/Strobe] [H]
- Sequence: `strikeDelay` s after the throw, `ping_airstrike` at the strobe's current position. 1 s later the first plane, then the rest every `3 / n` s (n = 3, or 5 with Broken Arrow) [src:survev/server/src/game/weaponManager.ts:1337-1362] [src:survev/server/src/game/objects/projectile.ts:174-209] [M]
- Strike lines: all planes fly in the throw direction. Line k is offset sideways by `ceil(k/2) × 5` u, alternating sides: 0, +5, −5, +10, −10 [src:survev/server/src/game/objects/projectile.ts:194-206] [src:wikigg/Airstrike_Bomb] [M]
- survev randomises which side gets the first offset, a choice its source flags as "was not in surviv" [src:survev/server/src/game/weaponManager.ts:1343-1347] [M]
- The rebirth plays survev's pattern (conflicts.md `strobe-airstrike-offset`); its variant strobes call heavy shell and carpet strike lines (`rebirth-deviations.md` "Variant strobes") [src:survev/server/src/game/objects/projectile.ts:194-206] [src:user/2026-10-07-strobes] [H]
- Strobe bombs belong to the thrower: teammates take no damage and kills credit the thrower [src:survev/server/src/game/objects/player.ts:2422-2424] [src:fandom/Air_Strike] [src:fandom/Strobe] [H]
- Broken Arrow (`broken_arrow`, desert only, added 0.8.5): +2 strikes (`bonusAirstrikes: 2`), giving 5 [src:survev/shared/defs/gameObjects/perkDefs.ts:64-66] [src:fandom/Broken_Arrow] [src:wikigg/Broken_Arrow] [H]
- Fandom: the perk check happens when the ping appears, not at throw time; survev checks at throw time [src:fandom/Broken_Arrow] [src:survev/server/src/game/weaponManager.ts:1349-1351] [L]
- Strobe was added in 0.7.1 (desert map only) [src:changelog/0.7.1] [src:fandom/Strobe] [H]
- Strobe sources: meteor case `case_05` (flare gun + 4 strobes), gold military crate `crate_13` (3 strobes), `tier_eye_stone` (w1), desert/savannah/woods `tier_throwables` (w0.2, "rare" in grenade crates) and `tier_airdrop_throwables`, and potato-mode weapon swaps [src:fandom/Strobe] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:218] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813-842] [src:survev/shared/defs/maps/baseDefs.ts:233-245] [src:survev/shared/defs/maps/desertDefs.ts:194-198] [src:kong/relaunch-client-defs] [H]

## Air strike zones (50v50 scheduled strikes)

> The rebirth rolls a variant for every scheduled zone (normal as below, heavy shells, carpet bombing with 6 planes over a wider area) at the owner's request; see `rebirth-deviations.md`.

- Timing options per entry: `airstrikeZoneRad` (60, 55, 50, 45, 40 for circles 1–5), `wait` 1.5 s before the first plane, `delay` 1 s between planes [src:survev/shared/defs/maps/factionDefs.ts:104-193] [M]
- Plane-count weights: circle 1 {3: 5, 4: 1, 5: 0.1}; circle 2 {3: 4, 4: 1, 5: 0.1}; circle 3 {3: 3, …}; circle 4 {3: 2, …}; circle 5 {3: 1, 4: 1, 5: 0.1}; default 3 [src:survev/shared/defs/maps/factionDefs.ts:107-187] [src:survev/server/src/game/objects/plane.ts:109-111] [M]
- Zone centre (`getAirstrikeZonePos`): connected living players are shuffled. For each, count non-dead, non-underground (layer ≠ 1) players that the grid query of a `rad` circle returns (every player in the 16 u grid cells under the circle's box, by its 3.75 u grid bounds: there is no exact distance test), keep the best, and stop early once more than ⅓ of players are covered. Falls back to the safe-zone centre, then adds `randomPointInCircle(3)` and clamps to the map [src:survev/server/src/game/objects/plane.ts:128-163] [src:survev/server/src/game/grid.ts:21] [src:survev/server/src/game/grid.ts:101-124] [src:fandom/Air_Strike] [H]
- Zone duration = `wait + 2.5 + planes × delay + 2.5`, asserted ≤ 60 s (`AirstrikeZoneMaxDuration`). Radius ≤ 256 (`AirstrikeZoneMaxRad`) [src:survev/server/src/game/objects/plane.ts:176-191] [src:survev/shared/net/net.ts:17-18] [M]
- One random plane direction is shared by every plane in a zone [src:survev/server/src/game/objects/plane.ts:497-518] [M]
- Per-plane aim: random point in the zone, or with 50 % chance a random connected above-ground player inside the zone ± 10 u (`bombCount × bombOffset / 4`). The aim point is shifted back 21.75 u so the strip centres on it [src:survev/server/src/game/objects/plane.ts:520-562] [src:wikigg/Airstrike_Bomb] [M]
- Client: a yellow (`0xeaff00`) circle with 1.5 px outline and 0.2 fill alpha on the map, fading in and out over 0.5 s at each end of the zone duration [src:survev/client/src/objects/plane.ts:150-176] [src:fandom/Air_Strike] [H]
- Game-spawned strikes hit everyone; no player is credited [src:survev/server/src/game/objects/plane.ts:685] [src:fandom/Air_Strike] [H]
- Air strikes were added in 0.7.0 with the 50v50 map [src:changelog/0.7.0] [src:fandom/Air_Strike] [src:wikigg/Airstrikes] [H]
- If the game ends mid-strike, planes still fly but drop nothing [src:fandom/Air_Strike] [M]

## 50v50 golden military drop

- (fork) survev trigger: on every kill in faction mode, if `circleIdx ≠ 0`, help has not been sent yet, and the connected alive counts differ by ≥ 10 % (`(max−min)/(max+min)`) or by ≥ 5 players [src:survev/server/src/game/objects/plane.ts:212-231] [src:survev/server/src/game/objects/player.ts:2826-2834] [M]
- (fork) The drop then sends `airdrop_crate_04` (`_04po` in potato) 5 u from the losing team's connected, non-gassed player furthest from the winning team's mean position, plus a special airstrike zone (rad 50, 5 planes, wait 1.5, delay 1) [src:survev/server/src/game/objects/plane.ts:233-296] [M]
- Fork history: 2025-01-19 first version at circle 2, 2025-01-24 "rework for balancing reasons", refactored 2025-08-07 [src:derived/survev-git-14b1afe3] [src:derived/survev-git-635251b4] [src:derived/survev-git-05700661] [src:wikigg/50v50_mode] [H]
- Original (fandom): one golden military drop per match that appears "on its own schedule at the same time each match" ("timings are unknown, however they are predetermined"), placed by fandom around a shrink with timer ~0:02, exact step unknown [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map] [M]
- wiki.gg's "drops sometime during mid-game, far away from player activity" describes the survev fork (its history lists the 2025 golden-drop rework), so it is not evidence for the original's placement [src:wikigg/50v50_mode] [src:wikigg/Airdrop_Crate] [M]
- Changelog 0.8.71: "Weapons in 50v50 air drops now come packaged with their specific ammo" (`preloadGuns`) [src:changelog/0.8.71] [src:fandom/Meteor_Crate] [H]

## Conflicts

- CONFLICT strobe-strike-delay: strobe `strikeDelay` 2.5 s [src:kong/relaunch-client-defs] [src:fandom/Strobe] vs 3 s [src:survev/shared/defs/gameObjects/throwableDefs.ts:367] [src:wikigg/Strobe]; resolved: 3 s, survev being the baseline (conflicts.md) [H]
- CONFLICT airstrike-plane-count: natural strikes use 3–5 planes (weights per circle) [src:survev/shared/defs/maps/factionDefs.ts:107-187] [src:wikigg/50v50_mode] vs "can range from 2 to 5" [src:fandom/Air_Strike]; proposed: keep 3–5 [L]
- CONFLICT faction-airstrike-2-time: 50v50 air strike #2 at circleIdx 2 wait 30 s (timer 0:20) [src:survev/shared/defs/maps/factionDefs.ts:127-128] vs timer 0:26 (wait 24 s) [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map]; proposed: 24 s, since every other fandom 50v50 timing matches survev to the second [M]
- CONFLICT faction-airstrike-4-time: air strike #4 at circleIdx 4 wait 21 s (timer 0:09) [src:survev/shared/defs/maps/factionDefs.ts:162-163] vs timer 0:12 (wait 18 s) [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map]; proposed: 18 s [M]
- CONFLICT faction-golden-drop-trigger: golden military drop triggered by team-imbalance on kill, with a bonus strike [src:survev/server/src/game/objects/plane.ts:212-296] vs a fixed, predetermined per-match schedule [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map]; proposed: a scheduled single drop; time unknown, so make it a config knob (default: late in a circle around circleIdx 2–3) [L]
- CONFLICT desert-airdrop-weights: desert crates `01` w12 / `02de` w1 / `05` w1 [src:survev/shared/defs/maps/desertDefs.ts:48-66] vs original `01` w10 / `02de` w1 [src:balance/319]; proposed: original weights, no `airdrop_crate_05` [H]
- CONFLICT crush-damage: `GameConfig.airdrop.crushDamage = 100` [src:survev/shared/gameConfig.ts:285] [src:kong/relaunch-client-bundle] and fandom trivia that Flak Jacket and Cast Ironskin holders survive standing under a landing drop [src:fandom/Flak_Jacket] [src:fandom/Cast_Ironskin] vs the server applying 1e10 [src:survev/server/src/game/objects/airdrop.ts:86-91]; proposed: default to survev's instant kill, with a knob for finite `crushDamage` 100 passed through normal damage reduction [L]
- CONFLICT military-shell-hp: fandom infobox gives the military shell 500 HP [src:fandom/Military_Air_Drop] vs shell health 200 and indestructible, with 500 HP on the inner `crate_12` [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741]; proposed: client defs [H]
- CONFLICT gold-military-crate-hp: gold military loot crate `crate_13` has 200 HP [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813] vs 500 HP in the fandom infobox [src:fandom/Meteor_Crate]; proposed: 200 (client def) [H]
- CONFLICT flare-gun-hut: flare gun refused inside any intact roofed building, huts included [src:survev/server/src/game/objects/player.ts:2166-2186] [src:survev/server/src/game/weaponManager.ts:731-736] vs fandom saying it can be fired inside a hut [src:fandom/Flare_Gun]; proposed: keep survev's rule, expose "destructible roofs count as outside" as a knob (it would match air drops being allowed to land on such roofs) [L]
- CONFLICT broken-arrow-check-time: survev applies Broken Arrow at throw time [src:survev/server/src/game/weaponManager.ts:1349-1351] vs fandom saying it is applied when the strike warning appears [src:fandom/Broken_Arrow]; resolved: at the throw, survev being the baseline (conflicts.md) [M]

## Open questions

- Original crush damage: the fandom Dec 4, 2019 fix entry only mentions the red zone, while both perk pages' trivia say Flak Jacket / Cast Ironskin users survive crushing, so 0.8.82 may have applied a finite, reducible crush damage [src:fandom/Flak_Jacket] [src:fandom/Cast_Ironskin] [L]
- The exact time of the original 50v50 golden military drop and how it chose its position (fandom gives neither; wiki.gg's "far away from player activity" describes the fork) [src:fandom/50v50_Map] [src:wikigg/50v50_mode] [L]
- Did the original turkey (Thanksgiving) map drop `airdrop_crate_02tr`, and on what schedule? It exists in the client, but survev's turkey map inherits Main's crates [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [L]
- Was the strobe strike side order deterministic in the original (survev randomises it)? [src:survev/server/src/game/weaponManager.ts:1343-1347] [L]
