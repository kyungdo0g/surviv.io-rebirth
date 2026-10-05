# Throwables and their explosions

> Every throwable def in survev `shared/defs/gameObjects/throwableDefs.ts` (16 ids: 13 from the original client, 3 fork additions) and every explosion def in `explosionsDefs.ts` (22 ids: 18 original, 4 fork), with original v0.8.82 values next to fork changes.
> "orig" values come from survev's first commit `9f64948d` (decompiled original client: `src/defs/throwableDefs.js`, `src/defs/explosionsDefs.js`), cited as `derived/survev@9f64948d:<path>:<lines>`; the 2026 Kongregate relaunch bundle (`kong/relaunch-client-defs`) agrees except where a conflict is listed.
> Projectile flight, cooking and explosion code is survev server code: the original server was never published, so those rules are survev reconstructions (several are marked by survev as estimates).

## Provenance summary

- Original throwable ids (13): `frag`, `mirv`, `mirv_mini`, `martyr_nade`, `smoke`, `strobe`, `snowball`, `snowball_heavy`, `potato`, `potato_heavy`, `potato_cannonball`, `potato_smgshot`, `bomb_iron` [src:derived/survev@9f64948d:src/defs/throwableDefs.js:1-718] [src:kong/relaunch-client-defs] [H]
- Fork throwables: `coconut` (commit `edfcd096`, 2025-12-25, beach mode), `potato_lmgshot` (commit `81a93957`, 2026-03-29, PMG-134 projectile), `tomato` (commit `f9ab4c6b`, 2026-03-29, Potato vs Tomato) (fork) [src:derived/survev-git-edfcd096] [src:derived/survev-git-81a93957] [src:derived/survev-git-f9ab4c6b] [src:kong/relaunch-client-defs] [H]
- Original explosion ids (18): frag, smoke, strobe, barrel, stove, usas, rounds, rounds_sg, mirv, mirv_mini, martyr_nade, snowball, snowball_heavy, potato, potato_heavy, potato_cannonball, potato_smgshot, bomb_iron; `explosion_rounds` and `explosion_rounds_sg` have no `type` field in the original [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:1-184] [src:kong/relaunch-client-defs] [H]
- Fork explosions: `explosion_coconut`, `explosion_tomato`, `explosion_potato_lmgshot`, `explosion_cobalt` (twins bunker expansion, commit `f0107b35`, 2026-04-17) (fork) [src:survev/shared/defs/gameObjects/explosionsDefs.ts:219-281] [src:derived/survev-git-f0107b35] [H]
- Fork balance (0.2.1, 2026-02-02): snowball damage 2 → 6 and speed 40 → 52; heavy snowball damage 5 → 28, freeze 1 → 2 s, speed 40 → 52 (sic; def speed stays 45); potato 2 → 8; heavy potato 5 → 15 and dropRandomLoot 1 → 2 (fork) [src:balance/119-133] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-194] [H]
- Fork change: strobe `strikeDelay` 2.5 → 3 and a new fixed airstrike pattern (commit `b928ff05`, 2025-08-17) (fork) [src:derived/survev-git-b928ff05] [src:kong/relaunch-client-defs] [H]
- Fork change: "heavy" logic (commit `90e277a3`, 2024-09-03) gave `snowball` a `heavyType` and both `snowball`/`potato` a `changeTime` of 1 s, and set the heavy variants' `fuseTime` 5 → 9999 (fork) [src:derived/survev-git-90e277a3] [src:kong/relaunch-client-defs] [H]
- survev added server fields `freezeDuration`, `frozenSprites` and `dropRandomLoot` to snowball/potato explosions (absent from client data; values are survev choices) [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-218] [src:derived/survev-git-f1dd66c9] [H]

## Throwable def fields (survev code)

| field | behaviour | sources |
|---|---|---|
| `cookable` | cooking starts the fuse in hand; the projectile gets `fuseTime − cookTicker`. Non-cookable items (smoke, strobe, coconut) start their full fuse on release | [src:survev/server/src/game/weaponManager.ts:1320-1323] [src:fandom/Smoke_Grenade] [H] |
| `fuseTime` | seconds until the projectile explodes. A cooked grenade held past its fuse is thrown automatically and explodes at once (in hand) | [src:survev/server/src/game/weaponManager.ts:341-348] [src:survev/server/src/game/objects/projectile.ts:375-378] [src:wikigg/Frag_Grenade] [H] |
| `fuseVariance` | adds `random(0, fuseVariance)` to the fuse (mirv_mini, martyr_nade) | [src:survev/server/src/game/objects/projectile.ts:169-171] [H] |
| `explodeOnImpact` | explode when hitting a taller obstacle or reaching the ground; otherwise bounce | [src:survev/server/src/game/objects/projectile.ts:330-345] [src:survev/server/src/game/objects/projectile.ts:369-371] [H] |
| `playerCollision` | explode on touching any player other than the thrower | [src:survev/server/src/game/objects/projectile.ts:347-358] [H] |
| `rad` | projectile radius = rad × 0.5; collision tests use half of that | [src:survev/server/src/game/objects/projectile.ts:163] [src:survev/server/src/game/objects/projectile.ts:268] [H] |
| `throwPhysics.speed` | throw speed = speed × clamp(mouse distance, 0, 18) / 18 | [src:survev/server/src/game/weaponManager.ts:1246-1258] [src:survev/shared/gameConfig.ts:218] [H] |
| `forceMaxThrowDistance` | always throws at full speed (snowball/potato family, potato gun projectiles) | [src:survev/server/src/game/weaponManager.ts:1249-1251] [H] |
| `throwPhysics.playerVelMult` | adds the thrower's move velocity × this (0.6 for grenades, 0 for snowball-type) | [src:survev/server/src/game/weaponManager.ts:1313-1318] [H] |
| `throwPhysics.velZ` | initial upward velocity; gravity is 10.5 units/s² (survev estimate from recorded potato cannon packets); height is clamped to 0…5 | [src:survev/server/src/game/objects/projectile.ts:14-16] [src:survev/server/src/game/objects/projectile.ts:232-241] [src:survev/shared/gameConfig.ts:314-316] [H] |
| `throwPhysics.fixedCollisionHeight` | collision height used instead of the arc height (0.25 for snowball-type), so they hit low obstacles all the way | [src:survev/server/src/game/objects/projectile.ts:242-245] [H] |
| `aimDistance` | 32 for snowball-type: the throw aims at a point 32 units ahead of the player instead of along the hand offset | [src:survev/server/src/game/weaponManager.ts:1303-1311] [H] |
| `spinVel`, `spinDrag`, `randomizeSpinDir` | client spin of the projectile sprite (rad/s); bomb_iron randomises spin direction | [src:survev/shared/defs/gameObjects/throwableDefs.ts:17-25] [H] |
| `numSplit`, `splitType` | on explosion spawn `numSplit` projectiles of `splitType` (MIRV → 6 × mirv_mini) | [src:survev/server/src/game/objects/projectile.ts:446-458] [H] |
| `strikeDelay` | strobe only: delay before the airstrike ping | [src:survev/server/src/game/weaponManager.ts:1337-1362] [H] |
| `heavyType`, `changeTime` | cooking at least `changeTime` s replaces the projectile with `heavyType`; inventory still loses the light item (fork mechanism) | [src:survev/server/src/game/weaponManager.ts:1222-1234] [src:derived/survev-git-90e277a3] [H] |
| `destroyNonCollidables` | potato gun projectiles deal 999 to non-collidable obstacles they pass (bushes) instead of 1 | [src:survev/server/src/game/objects/projectile.ts:291-296] [H] |
| `freezeOnImpact` | set on potato, coconut, tomato; no server code reads it in survev | [src:survev/shared/defs/gameObjects/throwableDefs.ts:44] [src:derived/grep-freezeOnImpact-no-readers] [M] |
| `inventoryOrder` | order in the throwable slot cycle (snowball-type 0, frag 1, mirv 2, smoke/strobe 3, internal 99) | [src:survev/shared/defs/gameObjects/throwableDefs.ts:73-972] [src:changelog/0.3.1] [H] |
| `quality`, `noPotatoSwap` | Rare Potato prefers quality 1 (mirv, strobe); internal projectiles and snowballs are never potato-swapped | [src:survev/server/src/game/objects/player.ts:4057-4068] [H] |
| `speed.equip`, `speed.attack` | 0 for every throwable | [src:survev/shared/defs/gameObjects/throwableDefs.ts:73-972] [H] |

## Throwing, cooking and flight rules (survev server)

- Pressing attack starts the cook anim (length = fuseTime, or infinite for non-cookable items); releasing throws, but only after the minimum hold `cookTime` 0.1 s [src:survev/server/src/game/weaponManager.ts:326-348] [src:survev/server/src/game/weaponManager.ts:1196-1219] [src:survev/shared/gameConfig.ts:219] [H]
- While cooking the player moves 3 slower (`cookSpeedPenalty`) [src:survev/server/src/game/objects/player.ts:4739-4741] [src:survev/shared/gameConfig.ts:203] [H]
- After a throw the throw anim lasts 0.15 + 0.3 s and the next throw is blocked for `throwTime` 0.3 s [src:survev/server/src/game/weaponManager.ts:1364-1369] [src:survev/shared/gameConfig.ts:220] [src:derived/survev@9f64948d:src/gameConfig.ts:135] [H]
- Switching away from the throwable slot while cooking releases it with zero speed (it drops at the feet); being downed also releases a cooked throwable with zero speed [src:survev/server/src/game/weaponManager.ts:334-339] [src:survev/server/src/game/weaponManager.ts:1251-1253] [src:survev/server/src/game/objects/player.ts:2593-2595] [H]
- The projectile spawns at the throwing hand, (0.5, −1.0) rotated to the aim, at height 0.5, pulled back in front of any wall between the player and the hand [src:survev/server/src/game/weaponManager.ts:1260-1301] [H]
- On the ground (height ≤ the obstacle below) velocity decays with drag 2.3 per second, 5 on water ("based on plotted data from surviv") [src:survev/server/src/game/objects/projectile.ts:222-229] [H]
- Bounce: hitting an obstacle taller than the projectile reflects the velocity about the surface normal and scales speed by max(1 + dot, 0.15); every touched obstacle takes 1 damage [src:survev/server/src/game/objects/projectile.ts:284-345] [H]
- A projectile over a lower collidable obstacle (crate, table) rides on top of it [src:survev/server/src/game/objects/projectile.ts:346-352] [H]
- Throwables can be thrown over obstacles and through windows [src:wikigg/Frag_Grenade] [src:fandom/Frag_Grenade] [M]
- Throwable loot radius is 1 [src:survev/shared/gameConfig.ts:446] [src:derived/survev@9f64948d:src/gameConfig.ts:289] [H]

## Throwable stats

| id | name (en / ko) | fuse s | cook | impact | player coll. | throw speed | velZ | playerVelMult | rad | explosion | quality | sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `frag` | Frag Grenade / 파편 수류탄 | 4 | yes | no | no | 20 | 5 | 0.6 | 1 | explosion_frag | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:73-138] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:2-67] [src:l10n/ko:game-frag] [H] |
| `mirv` | MIRV Grenade / MIRV 수류탄 | 4 | yes | no | no | 20 | 5 | 0.6 | 1 | explosion_mirv + 6 × mirv_mini | 1 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:139-206] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:68-135] [src:l10n/ko:game-mirv] [H] |
| `mirv_mini` | MIRV Grenade / MIRV 수류탄 | 1.8 + 0–0.3 | yes | no | no | 20 | 5 | 0.6 | 1 | explosion_mirv_mini | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:207-248] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:136-177] [H] |
| `martyr_nade` | Martyrdom / 순교자의 고통 | 3 + 0–0.3 | yes | no | no | 20 | 5 | 0.6 | 1 | explosion_martyr_nade | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:249-290] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:178-219] [src:l10n/ko:game-martyr_nade] [H] |
| `smoke` | Smoke Grenade / 연막탄 | 2.5 | no | no | no | 15 | 5 | 0.6 | 1 | explosion_smoke | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:291-356] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:220-285] [src:l10n/ko:game-smoke] [H] |
| `strobe` | Strobe (def name "IR Strobe") / 스트로브 | 13.5 | no | no | no | 25 | 5 | 0.6 | 1 | explosion_strobe; strikeDelay orig 2.5, survev 3 (fork) | 1 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:357-423] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:286-352] [src:l10n/ko:game-strobe] [H] |
| `snowball` | Snowball / 스노우볼 | 9999 | yes | yes | yes | orig 40, survev 52 (fork) | 3.35 | 0 | 1 | explosion_snowball | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:424-490] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:353-417] [src:l10n/ko:game-snowball] [H] |
| `snowball_heavy` | Snowball / 스노우볼 | orig 5, survev 9999 (fork) | yes | yes | yes | 45 | 3.35 | 0 | 1.25 | explosion_snowball_heavy | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:491-533] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:418-461] [H] |
| `potato` | Potato / 감자 | 9999 | yes | yes | yes | 40 | 3.35 | 0 | 1 | explosion_potato; heavyType potato_heavy | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:534-601] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:462-528] [src:l10n/ko:game-potato] [H] |
| `potato_heavy` | Potato / 감자 | orig 5, survev 9999 (fork) | yes | yes | yes | 45 | 3.35 | 0 | 1.25 | explosion_potato_heavy | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:602-644] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:529-572] [H] |
| `potato_cannonball` | Potato Cannon / 포테이토 캐논 | 999 | yes | yes | yes | 65 | 3 | 0 | 1 | explosion_potato_cannonball | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:645-694] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:573-623] [src:l10n/ko:game-potato_cannonball] [H] |
| `potato_smgshot` | Spud Gun / 감자총 | 999 | yes | yes | yes | 85 | 3 | 0 | 0.1 | explosion_potato_smgshot | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:695-744] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:624-674] [src:l10n/ko:game-potato_smgshot] [H] |
| `bomb_iron` | (no l10n key; def "Iron Bomb") | 4 | yes | yes | no | 20 | 0 | 0.6 | 1 | explosion_bomb_iron | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:795-837] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:675-718] [H] |
| `potato_lmgshot` (fork) | PMG-134 / — | 999 | yes | yes | yes | 96 | 5 | 0 | 0.1 | explosion_potato_lmgshot | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:745-794] [src:wikigg/PMG-134] [H] |
| `coconut` (fork) | Coconut / 코코넛 | 9999 | no | yes | yes | 45 | 3.35 | 0 | 1.15 | explosion_coconut | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:838-904] [src:wikigg/Coconut] [src:l10n/ko:game-coconut] [H] |
| `tomato` (fork) | Tomato / — | 9999 | yes | yes | yes | 55 | 3.35 | 0 | 1 | explosion_tomato | 0 | [src:survev/shared/defs/gameObjects/throwableDefs.ts:905-972] [src:wikigg/Tomato_(Throwable)] [H] |

- Spin velocities: frag/mirv/mirv_mini/martyr/smoke/snowball/potato family 10π rad/s, strobe 6π, potato_cannonball 5π, potato_smgshot 9π, bomb_iron π (random direction), potato_lmgshot 0 [src:derived/survev@9f64948d:src/defs/throwableDefs.js:1-718] [src:survev/shared/defs/gameObjects/throwableDefs.ts:745-794] [H]
- Projectile sprites: frag `proj-frag-nopin-nolever-01.img`, mirv `proj-mirv-nopin-nolever.img`, mirv_mini `proj-mirv-mini-01.img`, martyr `proj-martyrdom-01.img`, smoke `proj-smoke-nopin-nolever.img`, strobe `proj-strobe-armed.img`, snowball `proj-snowball-01/02.img`, potato `proj-potato-01/02.img`, spud gun `proj-wedge-01.img`, bomb `proj-bomb-iron-01.img` [src:survev/shared/defs/gameObjects/throwableDefs.ts:101-826] [H]
- Pin sounds: grenades `frag_pin_01`, strobe `strobe_click_01`, snowball/potato none; all use `frag_throw_01` for the throw [src:survev/shared/defs/gameObjects/throwableDefs.ts:133-596] [H]
- `potato` has emote id 210 [src:survev/shared/defs/gameObjects/throwableDefs.ts:600] [M]
- `potato_cannonball` and `potato_smgshot` are fired by the Potato Cannon and Spud Gun (`projType`), not thrown from the inventory (see guns.md) [src:survev/server/src/game/weaponManager.ts:951-969] [H]

## Explosion defs

> Damage falloff (survev): full `damage` if the target is within `rad.min` (or its collider overlaps the min circle); otherwise `damage × (1 − dist / rad.max)` (linear from the centre, not from rad.min). Obstacles take damage × obstacleDamage.

| id | dmg | obstacleDamage | rad min–max | shrapnel | used by | sources |
|---|---|---|---|---|---|---|
| `explosion_frag` | 125 | 1.1 | 5–12 | 12 × shrapnel_frag | frag | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-40] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:2-11] [H] |
| `explosion_mirv` | 125 | 1.1 | 5–12 | 12 × shrapnel_frag | mirv | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:111-120] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:80-89] [H] |
| `explosion_mirv_mini` | 75 | 1.1 | 4–8 | 7 × shrapnel_mirv_mini | mirv_mini | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:121-130] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:90-99] [H] |
| `explosion_martyr_nade` | 80 | 1.1 | 4.5–9 | 8 × shrapnel_mirv_mini | martyr_nade | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:131-140] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:100-109] [H] |
| `explosion_smoke` | 0 | 1 | 5–12 | 0 | smoke (spawns a smoke emitter instead of damage) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:41-50] [src:survev/server/src/game/objects/explosion.ts:48-51] [H] |
| `explosion_strobe` | 1 | 5 | 1.5–2.5 | 3 × shrapnel_strobe | strobe (after its 13.5 s fuse) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:51-60] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:22-31] [src:fandom/Strobe] [H] |
| `explosion_bomb_iron` | 40 | 2 | 5–14 | 2 × shrapnel_bomb_iron | bomb_iron (airstrikes) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:232-241] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:174-183] [H] |
| `explosion_snowball` | orig 2, survev 6 (fork) | 1 | 1.24–1.25 | 0 | snowball | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-153] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:110-119] [src:balance/120] [H] |
| `explosion_snowball_heavy` | orig 5, survev 28 (fork) | 1 | 1.24–1.25 | 0 | snowball_heavy | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:154-166] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:120-129] [src:balance/124] [H] |
| `explosion_potato` | orig 2, survev 8 (fork); teamDamage false | 1 | 1.24–1.25 | 0 | potato | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:167-180] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:130-140] [src:balance/129] [H] |
| `explosion_potato_heavy` | orig 5, survev 15 (fork); teamDamage false | 1 | 1.24–1.25 | 0 | potato_heavy | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:181-194] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:141-151] [src:balance/132] [H] |
| `explosion_potato_cannonball` | 95; teamDamage false | 1.3 | 3.5–6.5 | 0 | potato_cannonball | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:195-205] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:152-162] [H] |
| `explosion_potato_smgshot` | 13 (survev, first commit); 12 (Kong relaunch); teamDamage false | 1.25 | 1.25–1.75 | 0 | potato_smgshot | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:206-218] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:163-173] [src:kong/relaunch-client-defs] [L] |
| `explosion_barrel` | 125 | 1 | 5–12 | 12 × shrapnel_barrel | barrels (map objects) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:61-70] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:32-41] [H] |
| `explosion_stove` | 125 | 2 | 5–12 | 16 × shrapnel_stove | stoves/ovens | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:71-80] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:42-51] [H] |
| `explosion_usas` | 42 | 4 | 3.5–6.5 | 9 × shrapnel_usas | USAS-12 frag rounds | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:81-90] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:52-61] [src:changelog/0.6.95] [H] |
| `explosion_rounds` / `explosion_rounds_sg` | 3 | 15 | 0.75–1 | 0 | Explosive Rounds perk (bullets / shotgun pellets) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:91-110] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:62-79] [src:changelog/0.8.72] [H] |
| `explosion_potato_lmgshot` (fork) | 8.5; teamDamage false; freeze 0.25 s | 1.3 | 1.25–1.75 | 0 | potato_lmgshot | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:219-231] [H] |
| `explosion_coconut` (fork) | 22; heals the thrower's team 7 instead of damaging; freeze 1 s | 1 | 1.34–1.35 | 0 | coconut | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:242-257] [src:wikigg/Coconut] [H] |
| `explosion_tomato` (fork) | 11; freeze 0.5 s; dropRandomLoot 1 | 1 | 1.29–1.3 | 0 | tomato | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:258-271] [H] |
| `explosion_cobalt` (fork) | 175 | 1 | 5–8 | 20 × shrapnel_cobalt | twins bunker building explosion (fork) | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:272-281] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:786] [H] |

- Explosion effect types and decals: frag/mirv `decal_frag_explosion`, mini/martyr/usas/cannonball `decal_frag_small_explosion`, smoke/strobe `decal_smoke_explosion`, snowball `decal_snowball_explosion`, potato `decal_potato_explosion`, bomb `decal_bomb_iron_explosion`, barrel/stove `decal_barrel_explosion`, rounds `decal_rounds_explosion` [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:1-184] [H]
- survev snowball/potato status fields: snowball freeze 0.5 s, heavy snowball 2 s (survev earlier used 1 s), potato 0.5 s, heavy potato 1 s, spud gun shot 1 s; snowball, heavy snowball and potato make the target drop 1 random item, heavy potato 2 (fork value; earlier 1) [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-218] [src:balance/123-133] [H]

### Shrapnel bullets

| id | dmg | obstacleDamage | distance | speed | variance | sources |
|---|---|---|---|---|---|---|
| `shrapnel_frag` | 20 | 1 | 8 | 20 | 1.5 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:788-800] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:1-836] [src:wikigg/Frag_Grenade] [H] |
| `shrapnel_mirv_mini` | 6 | 1 | 5 | 20 | 1.3 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:827-839] [src:wikigg/Mini_MIRV] [H] |
| `shrapnel_strobe` | 3 | 1 | 3 | 20 | 1.5 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:801-813] [src:fandom/Strobe] [H] |
| `shrapnel_bomb_iron` | 10 | 1 | 12 | 24 | 1.5 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:840-852] [H] |
| `shrapnel_barrel` | 2 | 1 | 8 | 20 | 1.5 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:762-774] [H] |
| `shrapnel_stove` | 5 | 2.5 | 24 | 30 | 1.5 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:775-787] [H] |
| `shrapnel_usas` | 5 | 1 | 5 | 20 | 1.2 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:814-826] [H] |
| `shrapnel_cobalt` (fork) | 5 | 0.1 | 8 | 20 | 1.5 | [src:survev/shared/defs/gameObjects/bulletDefs.ts:853-865] [H] |

- Every shrapnel def has falloff 1 and `shrapnel: true`; the original shrapnel values equal survev's [src:derived/survev@9f64948d:src/defs/bulletDefs.js:1-836] [src:kong/relaunch-client-defs] [H]
- Shrapnel is fired in uniformly random directions from the explosion centre with a random variance factor [src:survev/server/src/game/objects/explosion.ts:158-179] [H]

### How explosions apply damage (survev server)

- Rays are cast every `min(acos(1 − (0.75 / rad.max)² / 2), 0.3)` radians; each object is damaged once, by the first ray reaching it; a collidable obstacle taller than 0.5 stops the ray [src:survev/server/src/game/objects/explosion.ts:79-139] [H]
- Explosions and shrapnel never roll headshots; armour applies as chest + 0.3 × helmet [src:survev/server/src/game/objects/player.ts:2459-2490] [src:survev/server/src/game/objects/explosion.ts:250-255] [H]
- Teammates take no damage from a player's explosions (grenades stopped hurting teammates in 0.7.0); the thrower still hurts themself [src:survev/server/src/game/objects/player.ts:2423-2445] [src:changelog/0.7.0] [src:fandom/Strobe] [H]
- Loot inside the radius is pushed with force damage × random(0.15, 0.4) [src:survev/server/src/game/objects/explosion.ts:202-207] [H]
- Flak Jacket reduces explosion damage by 90 % (and other damage by 10 %) [src:survev/shared/defs/gameObjects/perkDefs.ts:17-25] [src:survev/server/src/game/objects/player.ts:2468-2474] [H]
- Frag damage against obstacles was "greatly increased" in 0.3.5 [src:changelog/0.3.5] [H]

## Per-throwable facts

### Frag Grenade (`frag`)

- Added in 0.2.4 ("Frag out!", 8 Feb 2018) with the grenade box obstacle; first throwable [src:changelog/0.2.4] [src:wikigg/Frag_Grenade] [H]
- 0.3.1 bound grenades to key 4, pressing 4 cycles throwable types [src:changelog/0.3.1] [H]
- Kills an unarmoured player at the centre (125 damage) [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:2-11] [src:namu/Surviv.io/무기] [H]
- Woods map doubles base frag and smoke capacity: 6/12/15/18 (survev adds 20 for the fork level-4 pack) [src:derived/survev@4b291f4d:shared/defs/maps/woodsDefs.ts:54-57] [src:survev/shared/defs/maps/woodsDefs.ts:59-62] [src:fandom/Frag_Grenade] [H]

### MIRV Grenade (`mirv`, `mirv_mini`)

- Added in 0.6.3 (woods event, 18 Oct 2018); added to the normal map in 0.6.31 [src:changelog/0.6.3] [src:changelog/0.6.31] [src:fandom/MIRV_Grenade] [H]
- On explosion it releases 6 mini grenades at the same point, each with velocity 0.6 × parent velocity + a random vector up to 4 units/s, height 1, fuse 1.8 + 0–0.3 s [src:survev/server/src/game/objects/projectile.ts:61-90] [src:survev/server/src/game/objects/projectile.ts:446-458] [H]
- If a MIRV explodes on landing the minis fly on in the throw direction [src:fandom/MIRV_Grenade] [M]

### Smoke Grenade (`smoke`)

- Added in 0.3.1 (23 Mar 2018) [src:changelog/0.3.1] [src:fandom/Smoke_Grenade] [H]
- survev emitter: 3 smoke puffs at once, then one every 1.75 s up to 8 more, emitter active 16 s; each puff grows to a random 5.5–6.5 radius [src:survev/server/src/game/objects/smoke.ts:24-44] [src:survev/server/src/game/objects/smoke.ts:89-92] [src:survev/server/src/game/objects/smoke.ts:122] [H]
- Fandom: the smoke lasts about 18 s [src:fandom/Smoke_Grenade] [M]
- A player inside smoke has vision obscured: zoom forced to 1x until 0.5 s after leaving [src:survev/server/src/game/objects/player.ts:2229-2259] [src:fandom/Scopes] [H]

### Strobe (`strobe`) → airstrike

- Added in 0.7.1 (desert map); returned in 0.7.2 for 50v50 [src:changelog/0.7.1] [src:fandom/Strobe] [H]
- Original behaviour (wiki): calls an airstrike to its landing spot 2.5 s after being thrown, in the throw direction, with a map ping; 3 planes (5 with Broken Arrow) each drop 20 iron bombs in a line [src:fandom/Strobe] [src:fandom/Air_Strike] [src:namu/Surviv.io/무기] [M]
- survev: after `strikeDelay` it adds the `ping_airstrike` map ping, then launches 3 airstrikes (+2 with Broken Arrow) spread evenly over 3 s; the first lands on the strobe, later ones alternate sides 5 units apart perpendicular to the throw; the side order is random ("was not in surviv") (fork estimate) [src:survev/server/src/game/weaponManager.ts:1337-1362] [src:survev/server/src/game/objects/projectile.ts:173-211] [src:survev/shared/defs/gameObjects/perkDefs.ts:64-66] [H]
- Before commit `b928ff05` survev used a 3 s ping delay and random offsets up to ±90° at 7 units (fork history) [src:derived/survev-git-b928ff05] [H]
- Each airstrike plane drops `bombCount` 20 bombs spaced `bombOffset` 2 apart with jitter 4, plane speed 350 [src:survev/server/src/game/objects/plane.ts:441-470] [src:survev/shared/gameConfig.ts:293-305] [src:derived/survev@9f64948d:src/gameConfig.ts:153-165] [H]
- The strobe itself explodes after its 13.5 s fuse for 1 damage (5× vs obstacles) plus 3 × 3-damage shrapnel [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:22-31] [src:fandom/Strobe] [src:wikigg/Strobe] [H]
- Strobe airstrikes damage the thrower but not their teammates; kills credit the thrower [src:fandom/Strobe] [src:fandom/Air_Strike] [M]

### Iron Bomb (`bomb_iron`)

- Unobtainable; dropped by airstrike planes; explodes on impact [src:fandom/Iron_Bomb] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:675-718] [H]
- survev destroys a bomb without exploding when it lands inside the zoom region of an indestructible building [src:survev/server/src/game/objects/projectile.ts:383-407] [src:fandom/Air_Strike] [H]
- Airstrike bombs break stone-plated obstacles and ammo crates [src:fandom/Iron_Bomb] [src:fandom/Air_Strike] [M]

### Martyrdom (`martyr_nade`)

- On death a player with the Martyrdom perk (survev also: grenadier or demo role) releases 12 martyr_nades with zero base velocity and random velocity up to 5 [src:survev/server/src/game/objects/player.ts:2809-2823] [src:survev/shared/defs/gameObjects/perkDefs.ts:57-60] [src:fandom/Martyrdom_(Throwable)] [H]
- Martyrdom perk added in 0.8.3 [src:changelog/0.8.3] [H]

### Snowball (`snowball`, `snowball_heavy`)

- Added in 0.6.9 (snow map, 19 Dec 2018); 0.6.91 fixed snowballs dealing no damage [src:changelog/0.6.9] [src:changelog/0.6.91] [src:fandom/Snowball] [H]
- Fandom history: 0.6.95 cut damage 4 → 2 and hardened damage 12 → 5 [src:fandom/Snowball] [M]
- A hit slows the target and makes it drop one random item; cooking hardens it for more damage and a longer slow [src:fandom/Snowball] [M]
- Snowball crates give 12 snowballs; other crates drop stacks of 5 [src:fandom/Snowball] [M]

### Potato (`potato`, `potato_heavy`)

- Added in 0.7.4 (Potato map, April Fools 2019); functionally the same as the snowball [src:changelog/0.7.4] [src:fandom/Potato_(Throwable)] [H]
- Potato explosions have `teamDamage: false` [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:130-151] [H]

### Spud Gun / Potato Cannon projectiles

- Potato Cannon (0.7.8) fires `potato_cannonball` (95 damage, 3.5–6.5 radius); Spud Gun (0.8.82) fires `potato_smgshot` wedges [src:changelog/0.7.8] [src:changelog/0.8.82] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:152-173] [H]
- Spud Gun hits enlarge and slow the target (also teammates); survev adds +0.06 scale per hit up to +0.6, decaying after 2.5 s [src:fandom/Spud_Gun] [src:survev/server/src/game/objects/player.ts:4585-4590] [src:survev/server/src/game/objects/explosion.ts:236-238] [M]
- PMG-134 shots (fork) reduce the target's view distance by 1.5 per hit up to 32, for 2.5 s (fork) [src:survev/server/src/game/objects/player.ts:4592-4597] [src:survev/server/src/game/objects/explosion.ts:240-242] [H]

### Fork-only throwables

- Coconut: beach mode (0.2.0, 18 Jan 2026), heals allies 7 HP, slows 1 s (fork) [src:wikigg/Coconut] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:242-257] [H]
- Tomato: Potato vs Tomato (0.2.3, 1 Apr 2026); wiki.gg history 0.2.31: throw speed 60 → 55 (fork) [src:wikigg/Tomato_(Throwable)] [H]

## Inventory capacity (bag sizes)

| item | Pouch | Small | Regular | Military | Tactical (fork) | sources |
|---|---|---|---|---|---|---|
| frag | 3 | 6 | 9 | 12 | 15 | [src:survev/shared/gameConfig.ts:424] [src:derived/survev@9f64948d:src/gameConfig.ts:269] [src:kong/relaunch-client-defs] [H] |
| smoke | 3 | 6 | 9 | 12 | 15 | [src:survev/shared/gameConfig.ts:425] [src:derived/survev@9f64948d:src/gameConfig.ts:270] [H] |
| strobe | 2 | 3 | 4 | 5 | 6 | [src:survev/shared/gameConfig.ts:426] [src:derived/survev@9f64948d:src/gameConfig.ts:271] [H] |
| mirv | 2 | 4 | 6 | 8 | 10 | [src:survev/shared/gameConfig.ts:427] [src:derived/survev@9f64948d:src/gameConfig.ts:272] [H] |
| snowball | 10 | 20 | 30 | 40 | 50 | [src:survev/shared/gameConfig.ts:428] [src:derived/survev@9f64948d:src/gameConfig.ts:273] [H] |
| potato | 10 | 20 | 30 | 40 | 50 | [src:survev/shared/gameConfig.ts:429] [src:derived/survev@9f64948d:src/gameConfig.ts:274] [H] |
| tomato (fork) | 10 | 20 | 30 | 40 | 50 | [src:survev/shared/gameConfig.ts:430] [H] |
| coconut (fork) | 3 | 6 | 9 | 12 | 15 | [src:survev/shared/gameConfig.ts:431] [H] |

- Flak Jacket gives +3 frag and +2 MIRV capacity only in the fork (0.3.01) (fork) [src:survev/shared/defs/gameObjects/perkDefs.ts:21-24] [src:balance/299] [H]
- Fabricate (0.8.5): survev refills explosives every 10 s, weights frag 60 / mirv 35 / strobe 5 (fork value per balance 0.3.1) [src:survev/shared/defs/gameObjects/perkDefs.ts:67-76] [src:balance/316] [src:changelog/0.8.5] [H]
- Amped Explosives (fork perk): throw range ×1.75, throw speed ×2, shrapnel count ×2, shrapnel damage ×1.5, shrapnel speed ×1.4 (fork) [src:survev/shared/defs/gameObjects/perkDefs.ts:26-32] [src:kong/relaunch-client-defs] [H]

## Throwables documented on wikis but absent from survev (post-0.8.82)

- Heart Frag (`heart_frag`): frag clone that applies the Frenemies effect, added 0.9.1 (10 Feb 2020) (post-0.8.82) [src:fandom/Heart_Frag] [M]
- Mine: arms 5 s after throw, then explodes like a frag (125 damage) when players, bullets or throwables come near; added 0.9.4 (4 May 2020) (post-0.8.82) [src:fandom/Mine] [src:fandom/Throwables] [M]
- Water Balloon (`water_balloon`): applies Wet (−30 % movement, fire and reload speed), added 0.9.5b (15 Jun 2020) (post-0.8.82) [src:fandom/Water_Balloon] [M]
- Skittrnade (`skitternade`): smoke-like cloud that applies the Contacted effect (post-0.8.82) [src:fandom/Skittrnade] [M]
- Foam Grenade (`antiFire`): removes the Burning effect (post-0.8.82) [src:fandom/Foam_Grenade] [M]
- Cannon Shot (`explosion_motherShip`): fired by the Mothrship, unobtainable (post-0.8.82) [src:fandom/Cannon_Shot] [M]

## Fork changes to original throwables (revert list)

- `strobe.strikeDelay` 3 → 2.5; restore a strike pattern without survev's alternating offsets (fork) [src:kong/relaunch-client-defs] [src:derived/survev-git-b928ff05] [H]
- `snowball.throwPhysics.speed` 52 → 40; remove `heavyType`/`changeTime` from snowball and `changeTime` from potato; `snowball_heavy.fuseTime` and `potato_heavy.fuseTime` 9999 → 5 (fork) [src:derived/survev@9f64948d:src/defs/throwableDefs.js:353-572] [src:kong/relaunch-client-defs] [H]
- Explosion damage: snowball 6 → 2, snowball_heavy 28 → 5, potato 8 → 2, potato_heavy 15 → 5; heavy potato dropRandomLoot 2 → 1; heavy snowball freeze 2 → 1 (survev's earlier estimate) (fork) [src:balance/119-133] [src:derived/survev-git-f1dd66c9] [H]
- Remove coconut, tomato, potato_lmgshot and their explosions, explosion_cobalt, shrapnel_cobalt (fork) [src:kong/relaunch-client-defs] [H]

## Conflicts

- CONFLICT spud-gun-explosion-damage: survev and its first commit give `explosion_potato_smgshot` 13 damage, fandom also 13 [src:survev/shared/defs/gameObjects/explosionsDefs.ts:206-218] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:163-173] [src:fandom/Spud_Gun] vs 12 in the Kongregate relaunch bundle [src:kong/relaunch-client-defs]; proposed: 13 for 0.8.82 (12 may be a 0.9.x relaunch tweak), config knob [L]
- CONFLICT strobe-delay: original/fandom strikeDelay 2.5 s [src:derived/survev@9f64948d:src/defs/throwableDefs.js:286-352] [src:fandom/Strobe] vs survev and wiki.gg 3 s [src:survev/shared/defs/gameObjects/throwableDefs.ts:357-423] [src:wikigg/Strobe]; proposed: 2.5 [H]
- CONFLICT snowball-stats-wikigg: wiki.gg lists snowball speed 52, damage 6, heavy 28 [src:wikigg/Snowball] vs original 40 / 2 / 5 [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:110-129] [src:fandom/Snowball]; proposed: original values (wiki.gg documents the fork) [H]
- CONFLICT smoke-duration: fandom "around 18 seconds" [src:fandom/Smoke_Grenade] vs survev emitter active 16 s plus puff fade [src:survev/server/src/game/objects/smoke.ts:33-36]; proposed: keep survev timing, expose as knob [L]
- CONFLICT frag-cook-text: fandom says a frag is "cooked for 3 seconds" and elsewhere "cooking time (5 seconds)" [src:fandom/Frag_Grenade] [src:fandom/Throwables] vs fuseTime 4 [src:derived/survev@9f64948d:src/defs/throwableDefs.js:2-67]; proposed: 4 s fuse [H]
- CONFLICT throwables-table-smoke-velmult: fandom smoke infobox playerVelMult 6 [src:fandom/Smoke_Grenade] vs def 0.6 [src:derived/survev@9f64948d:src/defs/throwableDefs.js:220-285]; proposed: 0.6 [H]
- CONFLICT heavy-snowball-speed-balance: balance.txt logs the heavy snowball speed as 40 → 52 [src:balance/126] vs `snowball_heavy` throw speed 45 in both the original and survev defs [src:derived/survev@9f64948d:src/defs/throwableDefs.js:418-461] [src:survev/shared/defs/gameObjects/throwableDefs.ts:491-533]; proposed: 45 (the balance log line is wrong) [H]
- CONFLICT heavy-snowball-damage-history: fandom says hardened snowballs dealt 12 before 0.6.95 [src:fandom/Snowball] vs no such entry in the changelog [src:changelog/0.6.95]; proposed: irrelevant for 0.8.82 (5) [L]

## Open questions

- How long did the original server require cooking before a snowball/potato became "heavy"? The original client has `heavyType` only on potato and no `changeTime` anywhere; survev's 1 s is its own choice [src:derived/survev@9f64948d:src/defs/throwableDefs.js:353-572] [src:derived/survev-git-90e277a3] [L]
- Original slow (freeze) durations and random-drop counts for snowball/potato hits are not in client data; survev's pre-balance values were 0.5 s / 1 s and 1 item [src:derived/survev-git-f1dd66c9] [src:fandom/Snowball] [L]
- Original projectile gravity (survev: 10.5, derived from potato cannon packets) and ground drag (2.3 / 5 on water, "plotted data") are reconstructions [src:survev/server/src/game/objects/projectile.ts:14-16] [src:survev/server/src/game/objects/projectile.ts:222-229] [L]
- Exact original airstrike offset pattern for strobes (survev randomises the side, its comment says the original did not) [src:survev/server/src/game/weaponManager.ts:1342-1346] [L]
- Fandom and survev disagree on whether the snowball's random item drop applies to backpacks: fandom says backpacks can drop when hit by snowballs or potatoes, survev's `dropRandomLoot` lists inventory, weapons, armour and perks [src:fandom/Backpacks] [src:survev/server/src/game/objects/player.ts:4001-4015] [L]
