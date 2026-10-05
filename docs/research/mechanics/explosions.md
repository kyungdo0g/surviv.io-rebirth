# Explosions

> Explosion stats (`ExplosionDefs`) are client-visible, and survev's values match the 0.8.82 relaunch client for every original explosion except the snowball/potato family, which the fork buffed (balance.txt 0.2.1). The damage model (raycast occlusion, falloff curve, obstacle multiplier) is survev server code. survev's authors say the current falloff "is apparently what surviv used from the data we got" (commit `7a59be97`).

## Explosion definition fields

| field | meaning | sources |
|---|---|---|
| `damage` | damage at the centre / inside `rad.min` | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:1-28] [src:kong/relaunch-client-defs] [H] |
| `obstacleDamage` | multiplier applied when the target is an obstacle | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:1-28] [src:survev/server/src/game/objects/explosion.ts:246-248] [H] |
| `rad.min` / `rad.max` | full-damage radius / outer radius (damage reaches 0 at `rad.max`) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:1-28] [src:survev/server/src/game/objects/explosion.ts:195-200] [H] |
| `shrapnelCount` / `shrapnelType` | number of shrapnel bullets fired in random directions and their bullet def | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:1-28] [src:survev/server/src/game/objects/explosion.ts:158-179] [H] |
| `explosionEffectType` / `decalType` | client particle/sound preset and the scorch decal left behind | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:1-28] [src:survev/server/src/game/objects/explosion.ts:38-46] [H] |
| `teamDamage` | `false` on potato/tomato/coconut explosions (informational; team damage is blocked for all player-sourced damage, see below) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:167-271] [src:kong/relaunch-client-defs] [M] |
| `freezeDuration` + `frozenSprites` | slows (freezes) hit enemies and overlays a "covered in snow/mash" sprite | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:20-27] [src:survev/server/src/game/objects/explosion.ts:222-229] [M] |
| `dropRandomLoot` | number of random items knocked out of a hit enemy's inventory | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:17] [src:survev/server/src/game/objects/explosion.ts:230-234] [M] |
| `healTeam` / `healAmount` | (fork, coconut) heals teammates instead of damaging them | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:242-257] [src:survev/server/src/game/objects/explosion.ts:214-220] [M] |

## Explosion types

| id | damage | obstacle × | rad min–max | shrapnel | source(s) | status | sources |
|---|---|---|---|---|---|---|---|
| `explosion_frag` | 125 | 1.1 | 5–12 | 12 × `shrapnel_frag` | frag grenade | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-40] [src:kong/relaunch-client-defs] [src:fandom/Frag_Grenade] [src:wikigg/Frag_Grenade] [H] |
| `explosion_smoke` | 0 | 1 | 5–12 | 0 | smoke grenade; spawns a smoke emitter and returns without damage | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:41-50] [src:survev/server/src/game/objects/explosion.ts:48-51] [src:kong/relaunch-client-defs] [H] |
| `explosion_strobe` | 1 | 5 | 1.5–2.5 | 3 × `shrapnel_strobe` | strobe at fuse end (13.5 s) | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:51-60] [src:kong/relaunch-client-defs] [src:fandom/Strobe] [H] |
| `explosion_barrel` | 125 | 1 | 5–12 | 12 × `shrapnel_barrel` | barrels, propane tank, oven, grill, power box, control panels, switches, recorders, bathhouse rocks | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:61-70] [src:kong/relaunch-client-defs] [src:wikigg/Barrel] [H] |
| `explosion_stove` | 125 | 2 | 5–12 | 16 × `shrapnel_stove` | `stove_01` (500 HP), `stove_02` (400 HP) | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:71-80] [src:kong/relaunch-client-defs] [H] |
| `explosion_usas` | 42 | 4 | 3.5–6.5 | 9 × `shrapnel_usas` | USAS-12 `bullet_frag` on hit | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:81-90] [src:kong/relaunch-client-defs] [src:changelog/0.6.95] [H] |
| `explosion_rounds` | 3 | 15 | 0.75–1 | 0 | Explosive Rounds perk bullet impact | original (0.8.72) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:91-100] [src:kong/relaunch-client-defs] [src:changelog/0.8.72] [src:fandom/Explosive_Rounds] [H] |
| `explosion_rounds_sg` | 3 | 15 | 0.75–1 | 0 | Explosive Rounds on shotguns (`useExplosiveRoundsAlt`), quieter effect | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:101-110] [src:survev/server/src/game/objects/bullet.ts:380-386] [src:kong/relaunch-client-defs] [H] |
| `explosion_mirv` | 125 | 1.1 | 5–12 | 12 × `shrapnel_frag` | MIRV main charge (then splits into 6 `mirv_mini`) | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:111-120] [src:kong/relaunch-client-defs] [H] |
| `explosion_mirv_mini` | 75 | 1.1 | 4–8 | 7 × `shrapnel_mirv_mini` | MIRV bomblets (fuse 1.8 s + 0–0.3 s) | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:121-130] [src:kong/relaunch-client-defs] [src:fandom/MIRV_Grenade] [H] |
| `explosion_martyr_nade` | 80 | 1.1 | 4.5–9 | 8 × `shrapnel_mirv_mini` | Martyrdom perk death grenades (fuse 3 s + 0–0.3 s) | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:131-140] [src:kong/relaunch-client-defs] [H] |
| `explosion_snowball` | original 2; (fork) 6 | 1 | 1.24–1.25 | 0 | snowball | fork buff | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-153] [src:kong/relaunch-client-defs] [src:balance/120] [H] |
| `explosion_snowball_heavy` | original 5; (fork) 28 | 1 | 1.24–1.25 | 0 | heavy snowball | fork buff | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:154-166] [src:kong/relaunch-client-defs] [src:balance/124] [H] |
| `explosion_potato` | original 2; (fork) 8 | 1 | 1.24–1.25 | 0 | potato throwable | fork buff | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:167-180] [src:kong/relaunch-client-defs] [src:balance/129] [H] |
| `explosion_potato_heavy` | original 5; (fork) 15 | 1 | 1.24–1.25 | 0 | heavy potato | fork buff | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:181-194] [src:kong/relaunch-client-defs] [src:balance/132] [H] |
| `explosion_potato_cannonball` | 95 | 1.3 | 3.5–6.5 | 0 | potato cannon (0.8.6x potato event) | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:195-205] [src:kong/relaunch-client-defs] [H] |
| `explosion_potato_smgshot` | original 12; survev 13 | 1.25 | 1.25–1.75 | 0 | spud gun (0.8.82) shot; also enlarges the target ("fat") | survev differs from client | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:206-218] [src:survev/server/src/game/objects/explosion.ts:236-238] [src:kong/relaunch-client-defs] [src:changelog/0.8.82] [H] |
| `explosion_bomb_iron` | 40 | 2 | 5–14 | 2 × `shrapnel_bomb_iron` | air strike bombs | original | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:232-241] [src:kong/relaunch-client-defs] [src:wikigg/Airstrike_Bomb] [H] |
| `explosion_potato_lmgshot` | 8.5 | 1.3 | 1.25–1.75 | 0 | PMG-134; lowers the target's view distance | (fork) 2026-03-29 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:219-231] [src:survev/server/src/game/objects/explosion.ts:240-242] [src:derived/survev-git-81a93957] [M] |
| `explosion_coconut` | 22 | 1 | 1.34–1.35 | 0 | coconut (beach); heals teammates 7 | (fork) 2025-12-25 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:242-257] [src:derived/survev-git-edfcd096] [M] |
| `explosion_tomato` | 11 | 1 | 1.29–1.3 | 0 | tomato throwable | (fork) 2026-03-29 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:258-271] [src:derived/survev-git-f9ab4c6b] [M] |
| `explosion_cobalt` | 175 | 1 | 5–8 | 20 × `shrapnel_cobalt` | `cobalt_wall_int_4` (twins bunker puzzle wall) | (fork) 2026-04-17 | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:272-281] [src:derived/survev-git-f0107b35] [M] |

- (fork) survev also gives snowball/potato explosions `freezeDuration` (snowball 0.5 s, heavy snowball 2, potato 0.5, heavy potato 1, spud-gun shot 1) and `dropRandomLoot` (snowball 1, heavy snowball 1, potato 1, heavy potato 2). The relaunch defs have neither field, and balance.txt records heavy snowball freeze 1 → 2 s and heavy potato drop 1 → 2 as fork changes [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-218] [src:kong/relaunch-client-defs] [src:balance/125] [src:balance/133] [M]
- survev's source comment says `dropRandomLoot` in the original was "only called on snowball or potato collision" [src:survev/server/src/game/objects/player.ts:4000-4001] [L]

## Shrapnel bullets

| id | damage | obstacle × | speed | range | variance | status | sources |
|---|---|---|---|---|---|---|---|
| `shrapnel_frag` | 20 | 1 | 20 | 8 | 1.5 | original | [src:survev/shared/defs/gameObjects/bulletDefs.ts:788] [src:kong/relaunch-client-defs] [src:fandom/Frag_Grenade] [H] |
| `shrapnel_barrel` | 2 | 1 | 20 | 8 | 1.5 | original | [src:survev/shared/defs/gameObjects/bulletDefs.ts:762] [src:kong/relaunch-client-defs] [src:wikigg/Barrel] [H] |
| `shrapnel_stove` | 5 | 2.5 | 30 | 24 | 1.5 | original | [src:survev/shared/defs/gameObjects/bulletDefs.ts:775] [src:kong/relaunch-client-defs] [H] |
| `shrapnel_usas` | 5 | 1 | 20 | 5 | 1.2 | original | [src:survev/shared/defs/gameObjects/bulletDefs.ts:814] [src:kong/relaunch-client-defs] [H] |
| `shrapnel_mirv_mini` | 6 | 1 | 20 | 5 | 1.3 | original | [src:survev/shared/defs/gameObjects/bulletDefs.ts:827] [src:kong/relaunch-client-defs] [src:fandom/MIRV_Grenade] [H] |
| `shrapnel_strobe` | 3 | 1 | 20 | 3 | 1.5 | original | [src:survev/shared/defs/gameObjects/bulletDefs.ts:801] [src:kong/relaunch-client-defs] [src:fandom/Strobe] [H] |
| `shrapnel_bomb_iron` | 10 | 1 | 24 | 12 | 1.5 | original | [src:survev/shared/defs/gameObjects/bulletDefs.ts:840] [src:kong/relaunch-client-defs] [src:wikigg/Airstrike_Bomb] [H] |
| `shrapnel_cobalt` | 5 | 0.1 | 20 | 8 | 1.5 | (fork) | [src:survev/shared/defs/gameObjects/bulletDefs.ts:853] [M] |

- Shrapnel is fired from the explosion centre in uniformly random directions (`v2.randomUnit()`) on the explosion's layer, using the explosion's damage type and source player [src:survev/server/src/game/objects/explosion.ts:160-179] [H]
- Shrapnel is a normal bullet: it can hit the shooter (`damageSelf` for shrapnel), reflects off metal and is stopped by walls. Its tracer colour is `shrapnel` (`0x333333`) [src:survev/server/src/game/objects/explosion.ts:162-178] [src:survev/shared/gameConfig.ts:391-395] [M]
- (fork) `amped_explosives` (Hyperfragmentation) multiplies shrapnel count ×2, damage ×1.5 and speed ×1.4. The perk is not in the 0.8.82 client [src:survev/server/src/game/objects/explosion.ts:146-158] [src:survev/shared/defs/gameObjects/perkDefs.ts:26-32] [src:kong/relaunch-client-defs] [src:wikigg/Hyperfragmentation] [H]

## Damage model (survev server `ExplosionBarn`)

1. Explosions are queued with `addExplosion` and resolved in `ExplosionBarn.update` (after projectiles each tick). Explosions queued during resolution (barrel chains) are resolved in the same tick [src:survev/server/src/game/objects/explosion.ts:28-33] [src:survev/server/src/game/objects/explosion.ts:262-279] [src:survev/server/src/game/game.ts:235-239] [M]
2. Candidates: players, obstacles and loot on the same layer (`util.sameLayer`) and not dead, within `rad.max` [src:survev/server/src/game/objects/explosion.ts:53-73] [H]
3. Rays: cast from the centre to `rad.max` at angular step `min(acos(1 − (0.75 / rad.max)² / 2), 0.3)`, so adjacent rays are at most 0.75 u apart at the rim (a 12-u frag uses ~100 rays) [src:survev/server/src/game/objects/explosion.ts:79-90] [M]
4. Per ray: every candidate whose collider the ray crosses is recorded with its hit distance. A candidate containing the centre counts at distance 0. Hits are sorted nearest-first [src:survev/server/src/game/objects/explosion.ts:92-121] [M]
5. Occlusion: walking outward, each object is damaged once per explosion (the first ray to reach it). The ray stops at the first collidable obstacle taller than 0.5 (walls, doors, trees, stones), but passes over low or non-collidable ones such as crates (height 0.5) and low walls (0.2) [src:survev/server/src/game/objects/explosion.ts:123-138] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:18] [M]
6. The blocking obstacle itself is still damaged, so walls and doors take explosion damage [src:survev/server/src/game/objects/explosion.ts:123-129] [M]
7. Falloff: full `damage` if the hit distance ≤ `rad.min` or the target's collider touches the `rad.min` circle. Otherwise `damage × (1 − dist / rad.max)`, clamped at 0, measured from the centre rather than from `rad.min` [src:survev/server/src/game/objects/explosion.ts:195-200] [M]
8. That gives a step at `rad.min`: a frag does 125 inside 5 u, ~72.9 just past 5 u, 62.5 at 6 u, 0 at 12 u [src:derived/explosion-falloff-from-explosion.ts:195-200] [M]
9. History: before 2025-03-26 survev remapped from `rad.min` to `rad.max`, which is smooth. The change was made to match "the data we got" from surviv [src:derived/survev-git-7a59be97] [M]
10. Obstacles take `damage × obstacleDamage` [src:survev/server/src/game/objects/explosion.ts:246-248] [H]
11. Loot is not damaged; it is pushed away from the centre with force `damage × U(0.15, 0.4)` [src:survev/server/src/game/objects/explosion.ts:202-207] [M]
12. Players receive `isExplosion: true` damage, which can never be a headshot. Armor still applies (chest fully, helmet × 0.3) [src:survev/server/src/game/objects/player.ts:2458-2490] [M]
13. Flak Jacket cuts explosion damage by 90 % (`explosionDamageReduction 0.9`) and other damage by 10 % [src:survev/shared/defs/gameObjects/perkDefs.ts:17-25] [src:survev/server/src/game/objects/player.ts:2470-2476] [src:fandom/Flak_Jacket] [H]
14. Shrapnel hits are sent with `isExplosion: this.isShrapnel`, so shrapnel also gets the 90 % Flak Jacket reduction and never headshots. Shrapnel (and ricochets) can also hit the player who caused it (`damageSelf`) [src:survev/server/src/game/objects/bullet.ts:273] [src:survev/server/src/game/objects/bullet.ts:634] [src:fandom/Flak_Jacket] [H]

## Friendly fire and credit

- Damage from a teammate (any player-sourced damage, including grenades and strobe bombs) is ignored unless the target is disconnected. Changelog 0.7.0: "Grenades no longer damage teammates." [src:survev/server/src/game/objects/player.ts:2422-2424] [src:changelog/0.7.0] [src:fandom/Frag_Grenade] [H]
- Self-damage is allowed: your own grenade hurts you, since the teammate check excludes `source === this` [src:survev/server/src/game/objects/player.ts:2422-2423] [src:fandom/Red_Zone] [M]
- An exploding obstacle keeps the `source` of whoever destroyed it, with `gameSourceType ""` and `mapSourceType` = obstacle type. Kill feed: "… with a barrel" [src:survev/server/src/game/objects/obstacle.ts:661-667] [src:fandom/Air_Strike] [M]
- Game-spawned air strikes have no source player; their kills are credited to "The air strike" [src:survev/server/src/game/objects/plane.ts:685] [src:l10n/en:game-the-air-strike] [H]

## Obstacles and explosions

- Exploding obstacles (`explosion` field) detonate in `kill()` after dropping loot. All 0.8.82 ones use `explosion_barrel`, except stoves (`explosion_stove`) [src:survev/server/src/game/objects/obstacle.ts:661-667] [src:kong/relaunch-client-defs] [H]
- Original exploding obstacles that can actually be destroyed: `barrel_01` and `barrel_01b` (150 HP), `propane_01` (50), `oven_01` and `grill_01` (200), `power_box_01` (250), `control_panel_01` (250), `_02` (175), `_03` (150), `_04` (250), `_06` (200), `stove_01` (500) and `stove_02` (400) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:455-510] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:686] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:902-960] [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:276-530] [src:kong/relaunch-client-defs] [H]
- `control_panel_02b`, `switch_01/02/03`, `recorder_01`–`recorder_14` and `bathhouse_rocks_01` also carry `explosion_barrel` (inherited from the control-panel template) but are `destructible: false`, so they never explode [src:kong/relaunch-client-defs] [src:survev/server/src/game/objects/obstacle.ts:661-667] [M]
- (fork) survev's `switch_01` was rebuilt by the 2026-04-17 twins-bunker commit (`f0107b35`) with `createSwitch` (100 HP, `explosion: ""`), while the 0.8.82 client's `switch_01` is a control panel with `explosion_barrel` and 250 HP; both are indestructible, so this has no gameplay effect [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:180-189] [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:385] [src:derived/survev-git-f0107b35] [src:kong/relaunch-client-defs] [H]
- (fork) Extra exploding objects not in the 0.8.82 client: `barrel_01w/01bh/01f`, `table_06`–`table_09`, `control_panel_07de/07sv`, `cobalt_wall_int_4` [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:465] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1258] [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:338] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:782] [M]
- Obstacles with an `explosion` are sent as full updates on every damage so the client can draw smoke from heavily damaged barrels as a warning [src:survev/server/src/game/objects/obstacle.ts:492-496] [src:wikigg/Barrel] [H]
- `fire_ext_01` (fire extinguisher) uses `createSmoke` instead of exploding: destroying it spawns a smoke emitter [src:survev/server/src/game/objects/obstacle.ts:657-659] [M]
- Stoves have `damageCeiling`: destroying one marks the parent building's ceiling as damaged [src:survev/server/src/game/objects/building.ts:335-341] [M]
- Armor/stone plating: for `DamageType.Player` hits, `armorPlated` obstacles (`crate_04`, `crate_06`) need an `armorPiercing` weapon. `stonePlated` ones (`stone_04/05/06`, `statue_03/04`, `stone_wall_int_4`; fork additions `stone_04x`, `safe_01`, `safe_01de`) need `stonePiercing`. Explosions from thrown grenades carry the grenade type, which is not piercing, so grenades cannot hurt them [src:survev/server/src/game/objects/obstacle.ts:464-481] [M]
- Air strike and air drop damage use other damage types, so they bypass plating. Fandom confirms air strikes break ammo crates, hardstone blocks/boulders, aged faction statues and bridge columns [src:survev/server/src/game/objects/obstacle.ts:464] [src:fandom/Air_Strike] [H]
- Changelog: 0.0.8 metal barrels added; 0.1.7 "Barrels now explode upon destruction, dealing massive area-of-effect damage and creating damaging shrapnel"; 0.3.5 "Greatly increased damage of frag grenades against obstacles" [src:changelog/0.0.8] [src:changelog/0.1.7] [src:changelog/0.3.5] [H]

## Explosive projectiles

- Thrown projectiles explode when the fuse runs out, on impact if `explodeOnImpact` (iron bomb, potato and snowball family), or on touching a player if `playerCollision` [src:survev/server/src/game/objects/projectile.ts:312-313] [src:survev/server/src/game/objects/projectile.ts:333-345] [src:survev/server/src/game/objects/projectile.ts:371-381] [H]
- Projectiles fly over obstacles lower than their current height and bounce off taller ones (velocity × max(1 + dot, 0.15)) [src:survev/server/src/game/objects/projectile.ts:282-323] [M]
- Projectiles change layer on stairs like players, so grenades can be thrown down into bunkers [src:survev/server/src/game/objects/projectile.ts:355-356] [M]
- Cooking subtracts the cook time from the fuse; a fully cooked grenade explodes in hand [src:survev/server/src/game/weaponManager.ts:1320-1323] [src:wikigg/Frag_Grenade] [H]
- A cooking throwable is thrown automatically when the holder is downed [src:survev/server/src/game/objects/player.ts:2594-2596] [M]
- MIRV: on explosion spawns `numSplit` 6 × `mirv_mini` with velocity spread 4, then detonates its own `explosion_mirv` [src:survev/server/src/game/objects/projectile.ts:409-427] [src:kong/relaunch-client-defs] [src:fandom/MIRV_Grenade] [H]
- USAS-12: `bullet_frag` has `onHit: "explosion_usas"`. The explosion spawns 0.1 u behind where the bullet stopped. Changelog 0.6.95: "Slightly decreased radius of USAS-12 frag explosions." [src:survev/server/src/game/objects/bullet.ts:380-399] [src:kong/relaunch-client-defs] [src:changelog/0.6.95] [H]
- Explosive Rounds perk: bullets get `explosion_rounds` on hit. Bullets that reach max range without hitting do not explode, and these bullets cannot ricochet [src:survev/server/src/game/weaponManager.ts:946] [src:survev/server/src/game/objects/bullet.ts:206-211] [src:survev/server/src/game/objects/bullet.ts:371-377] [M]

## Client presentation

- Effects per `explosionEffectType` (burst sound, ripple count on water, camera shake, lifetime): frag/barrel/mirv shake 0.2 for 0.35 s with `explosion_01`; `bomb_iron` shake 0.25 for 0.4 s; usas/potato cannonball 0.12/0.25 s with `explosion_03`/`explosion_05`; mirv_mini/martyr 0.1/0.2 s; smoke, strobe, rounds and snow/potato have no shake [src:survev/client/src/objects/explosion.ts:331-716] [M]
- Water variant sound `explosion_02` for frags [src:survev/client/src/objects/explosion.ts:189-206] [src:wikigg/Frag_Grenade] [src:fandom/Frag_Grenade] [H]
- Decals: `decal_frag_explosion`, `decal_frag_small_explosion`, `decal_barrel_explosion`, `decal_smoke_explosion`, `decal_rounds_explosion` (fades after a few seconds), `decal_bomb_iron_explosion`, `decal_snowball_explosion`, `decal_potato_explosion` [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-281] [src:fandom/Explosive_Rounds] [src:fandom/Air_Strike] [H]

## Conflicts

- CONFLICT snow-potato-explosion-damage: snowball / heavy snowball / potato / heavy potato explosion damage 6 / 28 / 8 / 15 [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-194] vs 2 / 5 / 2 / 5 in the 0.8.82 client [src:kong/relaunch-client-defs] [src:balance/119-133]; proposed: original 2 / 5 / 2 / 5, no freeze or drop fields unless separately evidenced [H]
- CONFLICT spud-gun-explosion-damage: `explosion_potato_smgshot` 13 [src:survev/shared/defs/gameObjects/explosionsDefs.ts:206-218] vs 12 [src:kong/relaunch-client-defs]; proposed: 12 (client-visible original) [H]
- CONFLICT mirv-radius: MIRV main charge radius 5–12 [src:survev/shared/defs/gameObjects/explosionsDefs.ts:111-120] [src:kong/relaunch-client-defs] vs 4–8 in the fandom infobox [src:fandom/MIRV_Grenade]; proposed: 5–12 (fandom copied the mini values) [H]
- CONFLICT switch-01-explosion: `switch_01` explodes (`explosion_barrel`, 250 HP) [src:kong/relaunch-client-defs] vs no explosion and 100 HP after the fork's twins-bunker rework [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:180-189] [src:derived/survev-git-f0107b35]; proposed: client def (cosmetic only: the switch is indestructible either way) [H]
- CONFLICT explosion-falloff-curve: step falloff (`remap(dist, 0, rad.max)`, a ~42 % drop at `rad.min`) [src:survev/server/src/game/objects/explosion.ts:195-200] vs survev's own earlier smooth remap from `rad.min` [src:derived/survev-git-7a59be97]; proposed: keep survev's current curve (based on captured data per its authors) but expose both as a knob [L]

## Open questions

- Did the original stop explosion rays at obstacles taller than 0.5, or use another rule (e.g. `collidable` plus `isWall`)? [src:survev/server/src/game/objects/explosion.ts:131-137] [L]
- Fandom gives Flak Jacket "91 % reduction from grenades and shrapnel" (0.9 + 0.1 stacked multiplicatively). survev applies 0.9 to explosions and shrapnel, but the general 0.1 only to non-explosion hits; which did the original do? [src:fandom/Flak_Jacket] [src:survev/server/src/game/objects/player.ts:2470-2476] [L]
- Exact original snowball/potato freeze durations (client defs show the sprites but no duration) [src:kong/relaunch-client-defs] [L]
