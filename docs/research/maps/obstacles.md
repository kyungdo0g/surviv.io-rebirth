# Obstacles

> Every obstacle def in survev `shared/defs/mapObjects/obstacles/` (741 ids in 5 files) with health, collision, flags, loot and behaviour, plus how the survev server and client use each field.
> "orig" values come from the obstacle defs extracted from the 2026 relaunch client bundle (v0.8.82), cited as `kong/relaunch-client-defs`; `provenance/live-vs-survev.md` lists every field difference. A row marked "orig (fork-modified)" exists in the original client but survev changed a gameplay field; the original value is given in "Fork changes".
> Wiki names come from the fandom `{{Crate}}` infoboxes (or wiki.gg `{{Obstacle}}` infoboxes) whose internal id matches; ids without a wiki page have no name.
> Collision is given as the def builds it: `circle rR` or `box ±halfWidth×halfHeight @(centre)`. "col/destr" = collidable / destructible. Loot entries are `tier`×min–max (one roll of the tier per item) or `item`×count.

## Provenance and counts

- survev splits obstacles over `buildingObjsDefs.ts` (364: doors, windows, stairs, walls), `mapObstacleDefs.ts` (137: barrels, bushes, trees, stones, crops, silos…), `crateDefs.ts` (106: crates, cases, chests, airdrops, class pods), `furnitureDefs.ts` (93) and `interactableDefs.ts` (41), merged into `ObstacleDefs` [src:survev/shared/defs/mapObjects/obstacles/obstacleDefs.ts:185-191] [src:derived/obstacle-dump] [H]
- 564 obstacle ids exist in both the original client and survev, 177 only in survev, and 3 only in the original client: `glass_wall_18`, `house_door_06`, `tire_01` [src:derived/live-vs-survev] [src:kong/relaunch-client-defs] [H]
- Per file, survev-only ids: buildingObjs 80, mapObstacle 48, furniture 22, crate 19, interactable 8 (fork) [src:derived/obstacle-dump] [src:derived/fork-vs-original-json] [H]
- The original client names the grouping field `obstacleType`; survev renamed it `category` (values crate 88 ids, furniture 37, airdrop 17, pot 17, barrel 11, potato 9, locker 6, toilet 6, vending 1, unset 549) [src:derived/live-vs-survev] [src:survev/shared/defs/mapObjects/obstacles/obstacleDefs.ts:14] [src:derived/obstacle-dump] [H]
- Categories drive "destruction" quests (crates, toilets, furniture, barrels, lockers, pots, vending machines, potatoes) [src:survev/shared/defs/gameObjects/questDefs.ts:670-891] [src:survev/server/src/game/questManager.ts:175] [H]
- Original-only `tire_01`: 1500 HP, circle r1.75, height 0.5, destructible, grass/beach, no loot, "cloth" sounds; no building in the original client places it [src:kong/relaunch-client-defs] [H]
- Original-only `house_door_06` (150-HP swinging door, 0.6 × 2.5 box from its hinge) and `glass_wall_18` (glass wall 150 HP, ±0.5 × 9); no original building places either [src:kong/relaunch-client-defs] [H]
- Fandom separates "obstacles" (do not drop loot unless they are a cache) from "crates" (drop loot); the survev schema treats both as obstacles [src:fandom/Obstacles] [src:survev/shared/defs/mapObjects/obstacles/obstacleDefs.ts:12-183] [M]

## Server behaviour by field

| field | behaviour | sources |
|---|---|---|
| `collision` | circle or AABB, transformed by position, orientation (0–3 quarter turns) and scale | [src:survev/server/src/game/objects/obstacle.ts:354-382] [H] |
| `aabb` | optional larger box used for grid/visibility bounds instead of the collision (e.g. tree canopies) | [src:survev/server/src/game/objects/obstacle.ts:358-370] [H] |
| `collidable` | players collide with collidable obstacles (tree climbing perk ignores trees); obstacle skins are never collidable | [src:survev/server/src/game/objects/player.ts:1979-1986] [src:survev/server/src/game/objects/obstacle.ts:171] [H] |
| `height` | bullets ignore obstacles lower than `bullet.height` 0.25; melee ignores those lower than `meleeHeight` 0.25; explosion rays stop at collidable obstacles taller than 0.5; thrown projectiles only hit obstacles taller than their current height | [src:survev/server/src/game/objects/bullet.ts:296-302] [src:survev/shared/gameConfig.ts:221] [src:survev/shared/gameConfig.ts:311] [src:survev/server/src/game/objects/explosion.ts:132-138] [src:survev/server/src/game/objects/projectile.ts:281] [H] |
| `destructible` / `health` | non-destructible obstacles ignore damage; health is clamped at 0 and the obstacle dies at 0 | [src:survev/server/src/game/objects/obstacle.ts:458-501] [H] |
| `scale.createMin/createMax` | random spawn scale | [src:survev/server/src/game/map.ts:1443-1459] [src:survev/server/src/game/map.ts:1903] [H] |
| `scale.destroy` | the obstacle shrinks linearly with health from its spawn scale to `scale × destroy`, and its collider shrinks with it | [src:survev/server/src/game/objects/obstacle.ts:179-180] [src:survev/server/src/game/objects/obstacle.ts:486-490] [H] |
| `reflectBullets` | bullets that hit it reflect (up to `maxReflect` 3, damage divided by reflect count + 1) | [src:survev/server/src/game/objects/bullet.ts:610-612] [src:survev/server/src/game/objects/bullet.ts:573] [H] |
| bullet damage | `damage × falloff × gun obstacleDamage` (× AP rounds multiplier); bullets keep flying through non-collidable obstacles | [src:survev/server/src/game/objects/bullet.ts:586-617] [H] |
| `explosion` | spawned at the obstacle on death (game source "", map source = obstacle type); while damaged the full object is re-sent so the client can smoke | [src:survev/server/src/game/objects/obstacle.ts:492-496] [src:survev/server/src/game/objects/obstacle.ts:661-667] [H] |
| client smoke | obstacles with an explosion emit `smoke_barrel` below 50 % health (30 % for obstacle skins) | [src:survev/client/src/objects/obstacle.ts:258-269] [src:survev/client/src/objects/obstacle.ts:469-473] [H] |
| `loot` | on death each `tierLoot(tier, min, max)` rolls the tier `randomInt(min, max)` times; `autoLoot(type, count)` drops the item; Scavenger / Master Scavenger append their loot tables | [src:survev/server/src/game/objects/obstacle.ts:570-636] [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:13-26] [H] |
| loot spread | push speed 4.75 (× `lootSpawn.speedMult`), divided by the item count when several items drop, spread in a radius-0.1 circle around the obstacle (or `lootSpawn.offset`) | [src:survev/server/src/game/objects/obstacle.ts:563-568] [src:survev/server/src/game/objects/obstacle.ts:638-655] [H] |
| `destroyType` | on death a new object of that type is generated in place (windows → broken window low wall, airdrops → crate, class shells → class pod) | [src:survev/server/src/game/objects/obstacle.ts:531-552] [H] |
| `smartLoot` | the destroyType gets the opener's role appended (`class_crate_common_<role>`) and the dropped loot is owned by the opener if they are alive within 8 units | [src:survev/server/src/game/objects/obstacle.ts:533-551] [src:survev/server/src/game/objects/obstacle.ts:586-606] [H] |
| `swapWeaponOnDestroy` | the killer's weapon used is randomly swapped (potato mode) | [src:survev/server/src/game/objects/obstacle.ts:554-557] [H] |
| `regrow` / `regrowTimer` | the dead obstacle respawns at full health and scale after the timer (60 s on potatoes and tomatoes) | [src:survev/server/src/game/objects/obstacle.ts:302-307] [src:survev/server/src/game/objects/obstacle.ts:421-432] [src:survev/server/src/game/objects/obstacle.ts:559-561] [H] |
| `createSmoke` | adds a smoke emitter on death (fire extinguisher) | [src:survev/server/src/game/objects/obstacle.ts:657-659] [H] |
| `armorPlated` / `stonePlated` | player damage only applies if the damage source has `armorPiercing` / `stonePiercing`; non-player damage (explosions, airdrops) always applies | [src:survev/server/src/game/objects/obstacle.ts:464-481] [H] |
| `isWall` | when a wall dies it also kills overlapping doors (radius-0.5 test) and broken-window low walls; the parent building counts destroyed walls toward ceiling collapse | [src:survev/server/src/game/objects/obstacle.ts:669-693] [src:survev/server/src/game/objects/building.ts:348-354] [H] |
| `damageCeiling` / `disableBuildingOccupied` | destroying it marks the roof damaged / stops the building's occupied effects (cabin and saloon stoves stop the chimney smoke) | [src:survev/server/src/game/objects/building.ts:335-346] [src:fandom/Obstacles] [H] |
| `isDecalAnchor` | destroying it removes the building decal at the same position (pumpkin lights, squash) | [src:survev/server/src/game/objects/obstacle.ts:695-701] [H] |
| `door` | see Doors below | [src:survev/server/src/game/objects/obstacle.ts:704-857] [H] |
| `button` | see Interactables below | [src:survev/server/src/game/objects/obstacle.ts:742-806] [H] |
| `airdropCrate` | marks airdrop crates for the "airdrop unlocked" quest event | [src:survev/server/src/game/objects/obstacle.ts:519-526] [H] |
| `teamId` | faction placement only (survev map gen) | [src:survev/server/src/game/map.ts:1592-1603] [H] |
| `terrain` | spawn rules for map generation (see `generation.md`) | [src:survev/shared/defs/mapObjectsTyping.ts:3-25] [H] |
| `map.display/color/scale` | minimap icon; only layer-0 objects with `display` are sent | [src:survev/server/src/game/map.ts:1921-1923] [H] |
| `isBush` (client) | a player whose 0.25-radius core overlaps a bush plays its `enter` sound and leaf particles; bushes draw at zIdx 60, alpha 0.97 above players | [src:survev/client/src/objects/player.ts:859-930] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:44-76] [H] |
| `isTree` | lets the tree-climbing perk walk through trunks | [src:survev/server/src/game/objects/player.ts:1985] [H] |
| `img.randomRotation` | survev-only flag for random sprite rotation on palm trees (fork, 2025-12-28) | [src:survev/shared/defs/mapObjects/obstacles/obstacleDefs.ts:45] [src:derived/survev-git-075f1cbd] [src:derived/live-vs-survev] [H] |
| obstacle skins | outfits with an `obstacleType` (e.g. barrel_01, stone_01, tree_07sp) spawn a non-collidable, invulnerable copy that follows the player | [src:survev/server/src/game/map.ts:1930-1951] [src:survev/shared/defs/gameObjects/outfitDefs.ts:1327-1351] [src:fandom/Obstacles] [H] |

- Explosion defs used by obstacles: `explosion_barrel` 125 damage, obstacleDamage 1, radius 5–12, 12 `shrapnel_barrel`; `explosion_stove` 125 damage, obstacleDamage 2, 16 `shrapnel_stove`; `explosion_cobalt` (fork) 175 damage, radius 5–8, 20 shrapnel [src:survev/shared/defs/gameObjects/explosionsDefs.ts:61-80] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:272-281] [H]
- Thrown projectiles deal 1 damage to obstacles they bump; types with `destroyNonCollidables` deal 999 to non-collidable ones [src:survev/server/src/game/objects/projectile.ts:281-295] [H]
- Fandom: metal obstacles (silos, hedgehogs, barrels) ricochet bullets; grenades can be thrown over stones, hedgehogs, gold crates and steam rocks [src:fandom/Obstacles] [src:fandom/Stone] [src:fandom/Hedgehog] [src:fandom/Gold_Crate] [src:fandom/Steam_Rock] [M]
- namu.wiki: oil drums and ovens explode when destroyed; silos and the police station's steel toilets ricochet bullets [src:namu/Surviv.io/오브젝트] [M]

## Materials

> `createWall` / `createDoor` merge `MaterialDefs[material]` over their defaults; a few other defs set `material` only for sounds.

| material | destructible | reflectBullets | stonePlated | notes | sources |
|---|---|---|---|---|---|
| `metal` | no | yes | – | hit "barrelChip", sounds wall_bullet / metal_punch | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:29-40] [H] |
| `wood` | yes | no | – | | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:41-50] [H] |
| `woodPerm` | no | no | – | wood look, indestructible | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:51-60] [H] |
| `brick` | no | no | – | | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:61-71] [H] |
| `concrete` | no | no | – | | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:72-82] [H] |
| `stone` | yes | no | yes | needs a stone-piercing source (stone hammer, sledgehammer) | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:83-95] [H] |
| `glass` | yes | no | – | | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:96-107] [H] |
| `cobalt` | no | yes | – | Twins bunker walls | [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:108-119] [H] |

## Factory defaults

| factory | defaults | sources |
|---|---|---|
| `createBarrel` | category barrel, circle r1.75, height 0.5, 150 HP, `explosion_barrel`, reflects, scale destroy 0.6, minimap, grass+beach | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:11-43] [H] |
| `createBush` | circle r1.4, height 10, not collidable, 100 HP, scale 1.05–1.2, isBush, zIdx 60, alpha 0.97 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:44-76] [H] |
| `createStone` / `createRiverStone` | stone 250 HP r1.6 scale 1–1.2 destroy 0.5; river stone 500 HP r2.9 scale 0.8–1.2, river terrain (centerWeight 0.5) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:318-386] [H] |
| `createTree` | circle r1.55, height 10, 175 HP, scale 0.8–1 destroy 0.5, isTree | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:387-420] [H] |
| `createCrate` | category crate, box ±2.25, height 0.5, 75 HP, `tier_world`×1, scale destroy 0.5, grass+beach+riverShore | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:12-45] [H] |
| `createCase` / `createChest` | box ±2.25×1.6; case 75 HP destroy 0.8, chest 140 HP `tier_chest`×3–4 destroy 0.75; beach terrain, hidden from minimap | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:46-113] [H] |
| `createRiverChest` | chest with box ±2.25×0.8 offset 0.8, river terrain (centerWeight 1) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:114-124] [H] |
| `createAirdrop` | box ±2.5, indestructible, 200 HP, reflects, button: "game-unlock", useOnce, destroyOnUse, useDelay 2.5 s | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:125-158] [H] |
| `createClassCrate` | circle r2.1, 150 HP | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:159-192] [H] |
| `createDoor` | height 10, 150 HP, interactionRad 0.75, openSpeed 2, autoCloseDelay 1, slideOffset 3.5, material required | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:21-80] [H] |
| `createLabDoor` | concrete sliding door: interactionRad 2, openSpeed 7, autoOpen, autoClose 1 s, slideOffset 3.75, box ±0.3×2 at hinge (0, 2) | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:82-113] [H] |
| `createWall` | isWall, height 10, 150 HP unless set, material required | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:115-143] [H] |
| `createLowWall` | isWall, height 0.2, indestructible, box ±0.4×2 (broken windows, bars, bridge rails) | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:145-174] [H] |
| `createStairs` | box ±2.5×2, not collidable, 100 HP ("broken stairs") | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:176-207] [H] |
| `createWindow` | box ±0.4×2, height 10, 1 HP, isWindow, destroyType `house_window_broken_01` | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:209-240] [H] |

## Wiki facts

- Trees: overlapping canopies hide players almost completely; only tree caches and logging trees drop loot (or Scavenger perks) [src:fandom/Tree] [M]
- Stones: "as common as trees"; the stone cache drops an AK-47 and the Initiative skin; grenades can be thrown over stones [src:fandom/Stone] [M]
- Bushes are not fully opaque; berry bushes (`bush_07`) are smaller, more opaque and hide one item [src:fandom/Bush] [M]
- Barrels were plain obstacles until 0.1.7 made them explode; they start smoking "at around 30 health"; only the AWM-S destroys one in a single shot [src:fandom/Barrel] [src:changelog/0.1.7] [M]
- Silver silos are the largest land obstacles; the brown potato silo has the highest health of any crate (2500) [src:fandom/Silo] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:801] [H]
- Hardstone blocks: first called "Stone Block"; one per Normal/Potato/Cobalt map, 7 in Woods including one in the Eye bunker, none on Savannah or 50v50; breakable by stone hammer, sledgehammer, airdrops or air strikes [src:fandom/Hardstone_Block] [src:fandom/Hardstone_Boulder] [M]
- Windows: weak guns break the glass in one hit but that first bullet does not pass through [src:fandom/Window] [M]
- Vault doors: the collision box jumps to the open position immediately while the sprite swings slowly; the Eye bunker vault opens after the code with a different sound [src:fandom/Vault_Door] [M]
- Sliding doors: automatic in bunkers (two one-way doors in the Hydra bunker), manual shoji in teahouses and the pavilion [src:fandom/Sliding_Door] [M]
- Fire extinguishers give a bigger smoke cloud than a smoke grenade; only the central circle has a hitbox [src:fandom/Fire_Extinguisher] [M]
- The cabin stove takes 21 punches to destroy (500 HP / 24 fist damage ≈ 21) [src:fandom/Stove] [src:derived/stove-punches] [M]
- Potato obstacles replace the weapon used to break them with a random weapon of the same kind; the Rare Potato perk biases toward quality weapons [src:fandom/Potato_(Obstacle)] [src:changelog/0.7.52] [M]
- Caches look like their normal obstacle but darker with a decal and keep their look on event maps; only one of each cache spawns, except berry bushes [src:fandom/Cache] [src:fandom/Grass] [M]
- Steam rocks (bathhouse) heal nearby players; healing inside the red zone was removed shortly after release [src:fandom/Steam_Rock] [M]
- Fandom lists post-0.8.82 obstacles that survev does not have (poppies, skittrs, crop circles, ice box, storm clouds, candy store objects) [src:fandom/Obstacles] [src:fandom/Crates] [M]

## Obstacle history (original changelog)

| version | obstacles added or changed | sources |
|---|---|---|
| 0.0.7 | destroyed obstacles leave residue | [src:changelog/0.0.7] [H] |
| 0.0.8 | metal barrels and silos | [src:changelog/0.0.8] [H] |
| 0.0.9 | crates drop loot on destruction; rare military crate | [src:changelog/0.0.9] [H] |
| 0.1.3 | bush | [src:changelog/0.1.3] [H] |
| 0.1.7 | barrels explode, dealing area damage and shrapnel | [src:changelog/0.1.7] [H] |
| 0.2.2 | hedgehog, treasure chest | [src:changelog/0.2.2] [H] |
| 0.2.4 | grenade box | [src:changelog/0.2.4] [H] |
| 0.2.6 | windows and doors (windows break and can be shot through but not walked through; doors open with F or by punching); drawers, cabinet, table, refrigerator, oven | [src:changelog/0.2.6] [H] |
| 0.3.2 / 0.3.21 | seasonal egg added, then removed | [src:changelog/0.3.2] [src:changelog/0.3.21] [H] |
| 0.3.5 | soda machine; frag grenades deal much more damage to obstacles | [src:changelog/0.3.5] [H] |
| 0.3.6 | sliding doors, vat, computer terminal, power box | [src:changelog/0.3.6] [H] |
| 0.4.0 | closed container, bollard | [src:changelog/0.4.0] [H] |
| 0.4.2 | fire extinguisher, pot | [src:changelog/0.4.2] [H] |
| 0.5.0 | ammo crates can be destroyed by the wood axe | [src:changelog/0.5.0] [H] |
| 0.6.0 | bed, couch, screen, wood pile, stove, wall mount, river bush | [src:changelog/0.6.0] [H] |
| 0.6.1 | cattle crate, tumbleweed bush (desert) | [src:changelog/0.6.1] [H] |
| 0.6.2 | all doors automatically open | [src:changelog/0.6.2] [H] |
| 0.6.3 | hatchet crate, flare gun case, leaf pile, log pile, stump (woods) | [src:changelog/0.6.3] [H] |
| 0.6.4 | pumpkin, jack-o'-lantern, withered tree (halloween) | [src:changelog/0.6.4] [H] |
| 0.6.5 | archway, glass bottle, piano, round table, round stove, small sandbag | [src:changelog/0.6.5] [H] |
| 0.6.6 | berry bush | [src:changelog/0.6.6] [H] |
| 0.6.7 | planter, crab pot | [src:changelog/0.6.7] [H] |
| 0.6.71 / 0.6.8 | hardstone block / hardstone boulder | [src:changelog/0.6.71] [src:changelog/0.6.8] [H] |
| 0.6.9 | snowball crate, festive tree (snow) | [src:changelog/0.6.9] [H] |
| 0.7.0 | military air drop, Initiative crate, faction statues (50v50) | [src:changelog/0.7.0] [H] |
| 0.7.1 | meteor case, bridge column, aged faction statues (desert); downed players can use obstacles | [src:changelog/0.7.1] [H] |
| 0.7.3 | vase, chrysanthemum chest | [src:changelog/0.7.3] [H] |
| 0.7.4 | potato (potato map) | [src:changelog/0.7.4] [H] |
| 0.7.7 | bottle crate, couch sectionals, boarded window, concrete column, towel rack, steam rocks, Soviet military crate, red emblem case, golden eye chest | [src:changelog/0.7.7] [H] |
| 0.8.3 | acacia tree, blue cloud crate, grass-covered wall, yellow PARMA crate, hunting perch, large brush, propane tank, savannah stone, marksman military crate | [src:changelog/0.8.3] [H] |
| 0.8.7 | red pumptato, golden pumpkin air drop | [src:changelog/0.8.7] [H] |
| 0.8.8 | class pods, synthetic tree, synthetic bushes, synthetic stones (cobalt) | [src:changelog/0.8.8] [H] |
| 0.8.82 | silo shack with the breakable potato silo (potato map) | [src:changelog/0.8.82] [H] |

## Obstacle tables

> Generated from the survev defs. Status `orig` = present with identical gameplay fields in the v0.8.82 client; `orig (fork-modified)` = see Fork changes; `fork` = survev-only.

### Barrels (mapObstacleDefs)

| id | wiki name | HP | collision | height | col/destr | scale min–max / destroy | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `barrel_01` | Barrel | 150 | circle r1.75 | 0.5 | CD | 1–1 / 0.6 | yes | grass+beach | – | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:455] [src:kong/relaunch-client-defs] [H] |
| `barrel_01b` | Barrel Cache | 150 | circle r1.75 | 0.5 | CD | 1–1 / 0.6 | yes | grass+beach | `tier_surviv`×2–3, 3× `mirv`×1 | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:456] [src:kong/relaunch-client-defs] [H] |
| `barrel_01w` |  | 150 | circle r1.75 | 0.5 | CD | 1–1 / 0.6 | yes | grass+beach | `tier_surviv`×1, `chest03`×1, `mirv`×1, `strobe`×1 | reflects, explodes `explosion_barrel` | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:465] [H] |
| `barrel_01bh` |  | 150 | circle r1.75 | 0.5 | CD | 1–1 / 0.6 | yes | grass+beach | `tier_surviv`×1–2, 3× `coconut`×4, `mirv`×1 | reflects, explodes `explosion_barrel` | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:474] [H] |
| `barrel_01f` |  | 150 | circle r1.75 | 0.5 | CD | 1–1 / 0.6 | yes | grass+beach | `tier_surviv`×2–3, `chest02`×1, 2× `mirv`×2, `frag`×6 | reflects, explodes `explosion_barrel` | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:484] [H] |
| `barrel_01bd` |  | 150 | circle r1.75 | 0.5 | CD | 1–1 / 0.6 | yes | grass+beach | – | reflects | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:494] [H] |
| `propane_01` | Propane Tank | 50 | circle r1.25 | 0.5 | CD | 1–1 / 0.6 | yes | grass+beach | – | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:497] [src:kong/relaunch-client-defs] [H] |

### Bushes and brush (mapObstacleDefs)

| id | wiki name | HP | collision | height | col/destr | scale min–max / destroy | minimap | terrain | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `bush_01` | Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:531] [src:kong/relaunch-client-defs] [H] |
| `bush_01b` |  | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:532] [src:kong/relaunch-client-defs] [H] |
| `bush_01cb` | Synthetic Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:533] [src:kong/relaunch-client-defs] [H] |
| `bush_01f` | Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:539] [src:kong/relaunch-client-defs] [H] |
| `bush_01sv` | Savannah Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:543] [src:kong/relaunch-client-defs] [H] |
| `brush_01sv` | Large Brush | 150 | circle r1.4 | 10 | –D | 1.5–1.75 / 0.75 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:552] [src:kong/relaunch-client-defs] [H] |
| `brush_02sv` | Large Brush | 150 | circle r1.4 | 10 | –D | 1.5–1.75 / 0.75 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:568] [src:kong/relaunch-client-defs] [H] |
| `bush_01x` | Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:584] [src:kong/relaunch-client-defs] [H] |
| `bush_02` | Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:588] [src:kong/relaunch-client-defs] [H] |
| `bush_03` | Lotus Flower | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:589] [src:kong/relaunch-client-defs] [H] |
| `bush_04` | River Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass+riverShore+river(cw 0.3) | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:592] [src:kong/relaunch-client-defs] [H] |
| `bush_04cb` | River Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass+riverShore+river(cw 0.3) | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:608] [src:kong/relaunch-client-defs] [H] |
| `bush_05` | Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:625] [src:kong/relaunch-client-defs] [H] |
| `bush_06` | Leaf Pile | 100 | circle r1.75 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:632] [src:kong/relaunch-client-defs] [H] |
| `bush_06tr` |  | 100 | circle r2.5 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:640] [H] |
| `bush_06b` |  | 100 | circle r1.75 | 10 | –D | 1–1 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:648] [src:kong/relaunch-client-defs] [H] |
| `bush_07` | Berry Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:658] [src:kong/relaunch-client-defs] [H] |
| `bush_07sp` | Berry Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:668] [src:kong/relaunch-client-defs] [H] |
| `bush_07x` | Wreath Bush | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:679] [src:kong/relaunch-client-defs] [H] |
| `bush_07cb` |  | 100 | circle r1.4 | 10 | –D | 1.05–1.2 / 1 | yes | grass | isBush | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:680] [H] |

### Trees (mapObstacleDefs)

| id | wiki name | HP | collision | height | col/destr | scale min–max / destroy | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `tree_01` | Tree | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1121] [src:kong/relaunch-client-defs] [H] |
| `tree_01cb` | Synthetic Tree | 175 | circle r1.2 | 10 | CD | 1.1–1.3 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1122] [src:kong/relaunch-client-defs] [H] |
| `tree_01sv` | Savannah Tree | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1133] [src:kong/relaunch-client-defs] [H] |
| `tree_interior_01` |  | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1137] [src:kong/relaunch-client-defs] [H] |
| `tree_interior_01bh` |  | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | – | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1138] [H] |
| `tree_interior_01de` |  | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | `tier_coconut_outfit`×1, `coconut`×3 | isTree, randomRotation | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1145] [H] |
| `tree_01x` |  | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1154] [src:kong/relaunch-client-defs] [H] |
| `tree_02` | Wood Axe Stump | 120 | circle r1.6 | 0.5 | CD | 1–1 / 0.9 | – | grass | `woodaxe`×1 | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1160] [src:kong/relaunch-client-defs] [H] |
| `tree_02h` | Wood Axe Bloodstained Stump | 120 | circle r1.6 | 0.5 | CD | 1–1 / 0.9 | – | grass | `woodaxe_bloody`×1 | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1175] [src:kong/relaunch-client-defs] [H] |
| `tree_03` | Tree Cache | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1190] [src:kong/relaunch-client-defs] [H] |
| `tree_03su` |  | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1196] [H] |
| `tree_03sp` |  | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1203] [H] |
| `tree_03x` |  | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1209] [H] |
| `tree_03sv` | Tree Cache | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1215] [src:kong/relaunch-client-defs] [H] |
| `tree_03d` |  | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1224] [H] |
| `tree_03f` |  | 200 | circle r1.55 | 10 | CD | 1.2–1.6 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1, `4xscope`×1, `helmet02`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1230] [H] |
| `tree_03w` |  | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1249] [H] |
| `tree_03h` |  | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1256] [H] |
| `tree_03cb` |  | 175 | circle r1.2 | 10 | CD | 1.1–1.3 / 0.5 | – | grass | `tier_surviv`×2–3, `mosin`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1263] [H] |
| `tree_03bh` |  | 175 | circle r1.1 | 10 | CD | 1.2–1.25 / 0.5 | – | grass | `tier_surviv`×2–3, `scout_elite`×1 | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1276] [H] |
| `tree_05` | Withered Tree | 400 | circle r2.3 | 10 | CD | 1.2–1.3 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1283] [src:kong/relaunch-client-defs] [H] |
| `tree_05b` | Withered Tree | 500 | circle r2.3 | 10 | CD | 1–1 / 0.5 | yes | grass | `tier_shotguns`×1, `tier_lmgs`×1, `outfitTreeSpooky`×1 | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1297] [src:kong/relaunch-client-defs] [H] |
| `tree_05c` | Withered Tree (Desert) | 200 | circle r1.05 | 10 | CD | 1.6–1.6 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1316] [src:kong/relaunch-client-defs] [H] |
| `tree_06` | Desert Tree | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1330] [src:kong/relaunch-client-defs] [H] |
| `tree_07` | Yellow-Green Tree | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1334] [src:kong/relaunch-client-defs] [H] |
| `tree_07sp` |  | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | yes | grass+riverShore | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1339] [src:kong/relaunch-client-defs] [H] |
| `tree_07spr` |  | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | yes | riverShore | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1345] [src:kong/relaunch-client-defs] [H] |
| `tree_07su` |  | 175 | circle r1.55 | 10 | CD | 1–1.2 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1351] [src:kong/relaunch-client-defs] [H] |
| `tree_08` | Orange Tree | 225 | circle r1.55 | 10 | CD | 1.2–1.4 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1356] [src:kong/relaunch-client-defs] [H] |
| `tree_08b` | Orange Tree | 300 | circle r1.55 | 10 | CD | 1.75–2 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1366] [src:kong/relaunch-client-defs] [H] |
| `tree_08c` | Orange Tree (logging, cache) | 500 | circle r1.55 | 10 | CD | 1.75–2 / 0.5 | yes | grass | `tier_shotguns`×2–3, `tier_lmgs`×2–3, `outfitWoodland`×1 | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1378] [src:kong/relaunch-client-defs] [H] |
| `tree_08f` | Faction Tree | 200 | circle r1.55 | 10 | CD | 1.2–1.6 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1395] [src:kong/relaunch-client-defs] [H] |
| `tree_08sp` |  | 225 | circle r1.55 | 10 | CD | 1.2–1.4 / 0.5 | yes | grass+riverShore | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1406] [src:kong/relaunch-client-defs] [H] |
| `tree_08spb` |  | 300 | circle r1.55 | 10 | CD | 1.75–2 / 0.5 | yes | grass+riverShore | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1417] [src:kong/relaunch-client-defs] [H] |
| `tree_08spc` |  | 500 | circle r1.55 | 10 | CD | 1.75–2 / 0.5 | yes | grass | `tier_shotguns`×2–3, `tier_lmgs`×2–3, `outfitWoodland`×1 | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1430] [src:kong/relaunch-client-defs] [H] |
| `tree_08spr` |  | 225 | circle r1.55 | 10 | CD | 1.2–1.4 / 0.5 | yes | riverShore | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1447] [src:kong/relaunch-client-defs] [H] |
| `tree_08su` | Summer Tree | 225 | circle r1.55 | 10 | CD | 1.2–1.4 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1458] [src:kong/relaunch-client-defs] [H] |
| `tree_08sub` |  | 300 | circle r1.55 | 10 | CD | 1.75–2 / 0.5 | yes | grass+riverShore | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1469] [src:kong/relaunch-client-defs] [H] |
| `tree_09` | Stump | 120 | circle r1.6 | 0.5 | CD | 1–1 / 0.75 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1482] [src:kong/relaunch-client-defs] [H] |
| `tree_10` | Snow Tree | 175 | circle r1.25 | 10 | CD | 0.9–1.1 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1500] [src:kong/relaunch-client-defs] [H] |
| `tree_11` |  | 175 | circle r1.25 | 10 | CD | 1–1 / 0.5 | yes | grass | – | isTree | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1506] [src:kong/relaunch-client-defs] [H] |
| `tree_interior_11` |  | 175 | circle r1.25 | 10 | CD | 1–1 / 0.5 | yes | grass | – | isTree | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1516] [H] |
| `tree_12` | Acacia Tree | 175 | circle r1.55 | 10 | CD | 0.8–1 / 0.5 | yes | grass | – | isTree | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1526] [src:kong/relaunch-client-defs] [H] |
| `tree_13` | Tree (palm) | 175 | circle r1 | 10 | CD | 1.15–1.3 / 0.75 | yes | beach | – | isTree, randomRotation | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1537] [src:kong/relaunch-client-defs] [H] |
| `tree_13bh` |  | 175 | circle r1 | 10 | CD | 1.15–1.3 / 0.75 | yes | grass+beach | – | isTree, randomRotation | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1549] [H] |
| `tree_13x` |  | 175 | circle r1 | 10 | CD | 1.2–1.4 / 0.75 | yes | grass | – | isTree, randomRotation | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1561] [H] |
| `tree_14` | Coconut Palm | 175 | circle r1 | 10 | CD | 1.15–1.3 / 0.85 | yes | grass+beach | `tier_coconut_outfit`×1, `coconut`×3 | isTree, randomRotation | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1573] [H] |
| `tree_14d` |  | 250 | circle r1 | 10 | CD | 1.5–1.7 / 0.95 | yes | grass+beach | 3× `coconut`×3 | isTree, randomRotation | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1587] [H] |
| `tree_14x` |  | 175 | circle r1 | 10 | CD | 1.15–1.3 / 0.85 | yes | grass | `tier_coconut_outfit`×1–3, `coconut`×3 | isTree, randomRotation | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1602] [H] |

### Stones, hardstones and statues (mapObstacleDefs)

| id | wiki name | HP | collision | height | col/destr | scale min–max / destroy | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `statue_01` | Faction Statue Base | 250 | circle r1.6 | 0.5 | C– | 1–1 / 0.5 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:811] [src:kong/relaunch-client-defs] [H] |
| `statue_03` | Aged Faction Statue | 500 | circle r1.6 | 10 | CD | 1–1 / 0.85 | yes | grass+riverShore | – | stonePlated | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:818] [src:kong/relaunch-client-defs] [H] |
| `statue_04` | Aged Faction Statue | 500 | circle r1.6 | 10 | CD | 1–1 / 0.85 | yes | grass+riverShore | – | stonePlated | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:836] [src:kong/relaunch-client-defs] [H] |
| `statue_top_01` | Red Faction Statue | 500 | circle r2.45 | 10 | CD | 1–1 / 0.8 | – | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:854] [src:kong/relaunch-client-defs] [H] |
| `statue_top_02` | Blue Faction Statue | 500 | circle r2.45 | 10 | CD | 1–1 / 0.8 | – | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:868] [src:kong/relaunch-client-defs] [H] |
| `stone_01` | Stone | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:883] [src:kong/relaunch-client-defs] [H] |
| `stone_01b` | Stone | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:884] [src:kong/relaunch-client-defs] [H] |
| `stone_01cb` | Stone | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:887] [src:kong/relaunch-client-defs] [H] |
| `stone_01f` | Stone | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:894] [src:kong/relaunch-client-defs] [H] |
| `stone_01sv` |  | 250 | circle r1.6 | 0.5 | CD | 1.2–1.5 / 0.5 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:897] [src:kong/relaunch-client-defs] [H] |
| `stone_01x` | Stone | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:904] [src:kong/relaunch-client-defs] [H] |
| `stone_02` | Stone Cache | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | – | grass+riverShore | `tier_surviv`×2–3, `ak47`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:911] [src:kong/relaunch-client-defs] [H] |
| `stone_02sv` | Stone Cache | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | – | grass+riverShore | `tier_surviv`×2–3, `m39`×1, `tier_perks`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:916] [src:kong/relaunch-client-defs] [H] |
| `stone_02cb` |  | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | – | grass+riverShore | `tier_surviv`×2–3, `ak47`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:925] [H] |
| `stone_02w` |  | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | – | grass+riverShore | `tier_surviv`×2–3, `ak47`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:934] [H] |
| `stone_02x` |  | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | – | grass+riverShore | `tier_surviv`×2–3, `ak47`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:939] [H] |
| `stone_02bh` |  | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | – | grass+riverShore | `tier_surviv`×2–3, `groza`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:948] [H] |
| `stone_02f` |  | 250 | circle r1.6 | 0.5 | CD | 1–1.2 / 0.5 | – | grass+riverShore | `tier_surviv`×1, `ak47`×1, `helmet02`×1, `chest02`×1, `bandage`×5, `2xscope`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:953] [H] |
| `stone_03` | River Stone | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:965] [src:kong/relaunch-client-defs] [H] |
| `stone_03b` | River Stone | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:966] [src:kong/relaunch-client-defs] [H] |
| `stone_03cb` | River Stone | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:972] [src:kong/relaunch-client-defs] [H] |
| `stone_03f` | River Stone | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:978] [src:kong/relaunch-client-defs] [H] |
| `stone_03sv` |  | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:984] [H] |
| `stone_03x` | River Stone | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:990] [src:kong/relaunch-client-defs] [H] |
| `stone_03tr` |  | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:996] [H] |
| `stone_03bh` |  | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1002] [H] |
| `stone_04` | Hardstone Block | 250 | circle r1.6 | 0.5 | CD | 0.8–0.8 / 0.75 | yes | grass+beach+riverShore | `tier_eye_block`×1 | stonePlated | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1007] [src:kong/relaunch-client-defs] [H] |
| `stone_04x` |  | 250 | circle r1.6 | 0.5 | CD | 0.8–0.8 / 0.75 | yes | grass+beach+riverShore | `tier_eye_block`×1 | stonePlated | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1025] [H] |
| `stone_05` | Hardstone Boulder | 250 | circle r1.7 | 0.5 | CD | 1–1.2 / 0.5 | yes | grass+beach+riverShore | `tier_eye_stone`×1 | stonePlated | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1043] [src:kong/relaunch-client-defs] [H] |
| `stone_06` | Bridge Column | 250 | circle r1.6 | 10 | CD | 1–1 / 0.8 | yes | grass+beach+riverShore | – | stonePlated | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1056] [src:kong/relaunch-client-defs] [H] |
| `stone_07` | Savannah Stone | 500 | circle r7.75 | 0.5 | CD | 1–1 / 0.8 | yes | grass+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1069] [src:kong/relaunch-client-defs] [H] |
| `stone_08` |  | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | `tier_medical`×2–3, `tier_surviv`×1–2, `vss`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1084] [H] |
| `stone_08x` |  | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | `tier_medical`×2–3, `tier_surviv`×1–2, `m39`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1096] [H] |
| `stone_08cb` |  | 500 | circle r2.9 | 0.5 | CD | 0.8–1.2 / 0.5 | yes | river(cw 0.5) | `tier_medical`×2–3, `tier_surviv`×1–2, `svd`×1, `helmet02`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1108] [H] |

### Other map obstacles: bollard, campfire, sandbags, silos, wood piles (mapObstacleDefs)

| id | wiki name | HP | collision | height | col/destr | scale min–max / destroy | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `bollard_01` | Bollard | 300 | circle r1.25 | 0.5 | C– | 1–1 / 1 | yes | grass | – | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:503] [src:kong/relaunch-client-defs] [H] |
| `campfire_01` | Campfire | 100 | circle r2.75 | 0.5 | C– | 0.5–0.5 / 0.8 | yes | grass | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:686] [H] |
| `sandbags_01` | Sandbag | 150 | box ±3.1×1.4 | 0.5 | C– | 1–1 / 0.5 | yes | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:795] [src:kong/relaunch-client-defs] [H] |
| `sandbags_02` | Small Sandbag | 150 | box ±1.1×1.4 | 0.5 | C– | 1–1 / 0.5 | yes | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:796] [src:kong/relaunch-client-defs] [H] |
| `silo_01` | Silo | 300 | circle r7.75 | 10 | C– | 1–1 / 1 | yes | grass | – | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:800] [src:kong/relaunch-client-defs] [H] |
| `silo_01po` | Rusted Silo | 2500 | circle r7.75 | 10 | CD | 1–1 / 0.9 | yes | grass | `potato_smg`×1 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:801] [src:kong/relaunch-client-defs] [H] |
| `woodpile_01` | Wood Pile | 150 | box ±1.5×1.5 | 0.5 | CD | 1–1 / 0.75 | – | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1614] [src:kong/relaunch-client-defs] [H] |
| `woodpile_02` | Log Pile | 400 | box ±6×3 | 0.5 | CD | 1–1 / 0.75 | yes | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1615] [src:kong/relaunch-client-defs] [H] |
| `woodpile_03` |  | 175 | box ±3×1.75 | 0.5 | CD | 1–1 / 0.75 | yes | – | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1625] [H] |

### Seasonal crops: potatoes, tomatoes, eggs, pumpkins, squash (mapObstacleDefs)

| id | wiki name | HP | collision | height | col/destr | scale min–max / destroy | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `potato_01` | Potato | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach+riverShore | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:688] [src:kong/relaunch-client-defs] [H] |
| `potato_01f` |  | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s, teamId 2 | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:689] [H] |
| `potato_02` | Potato | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach+riverShore | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:693] [src:kong/relaunch-client-defs] [H] |
| `potato_02f` |  | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s, teamId 2 | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:694] [H] |
| `potato_03` | Potato | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach+riverShore | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:699] [src:kong/relaunch-client-defs] [H] |
| `potato_03f` |  | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s, teamId 2 | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:700] [H] |
| `tomato_01` |  | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s, teamId 1 | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:705] [H] |
| `tomato_02` |  | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s, teamId 1 | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:709] [H] |
| `tomato_03` |  | 100 | circle r1.1 | 0.5 | CD | 1–1 / 0.8 | – | grass+beach | `tier_potato_perks`×1 | swapWeaponOnDestroy, regrow 60 s, teamId 1 | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:715] [H] |
| `egg_01` | Egg | 80 | circle r1 | 0.5 | CD | 1–1 / 0.75 | – | grass+beach | `tier_egg_outfits`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:725] [H] |
| `egg_02` | Egg | 80 | circle r1 | 0.5 | CD | 1–1 / 0.75 | – | grass+beach | `tier_egg_outfits`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:729] [H] |
| `egg_03` | Egg | 80 | circle r1 | 0.5 | CD | 1–1 / 0.75 | – | grass+beach | `tier_egg_outfits`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:733] [H] |
| `egg_04` | Egg | 80 | circle r1 | 0.5 | CD | 1–1 / 0.75 | – | grass+beach | `tier_egg_outfits`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:737] [H] |
| `pumpkin_01` | Pumpkin | 100 | circle r1.9 | 0.5 | CD | 1–1 / 0.8 | yes | grass+riverShore | `tier_outfits`×1, `tier_pumpkin_candy`×1 | isDecalAnchor | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:742] [src:kong/relaunch-client-defs] [H] |
| `pumpkin_02` | Jack-o'-Lantern | 140 | circle r1.9 | 0.5 | CD | 1–1 / 0.8 | yes | grass+riverShore | `tier_guns`×1–2, `tier_pumpkin_candy`×1–2, `tier_outfits`×1 | isDecalAnchor | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:745] [src:kong/relaunch-client-defs] [H] |
| `pumpkin_03` | Red Pumptato | 100 | circle r1.25 | 0.5 | CD | 1–1 / 0.8 | – | grass+riverShore | `tier_pumpkin_perks`×1, `tier_fruit_xp`×1 | isDecalAnchor | orig | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:754] [src:kong/relaunch-client-defs] [H] |
| `squash_01` | Green Squash | 100 | circle r1 | 0.5 | CD | 1–1 / 0.8 | yes | grass+riverShore | `turkey_shoot`×1, `tier_world`×0–1 | isDecalAnchor | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763] [src:kong/relaunch-client-defs] [H] |
| `squash_02` |  | 200 | circle r1.5 | 0.5 | CD | 1–1 / 0.8 | yes | grass+riverShore | 2× `turkey_shoot`×1, `tier_soviet`×1–2 | isDecalAnchor | fork | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:778] [H] |

### Cases (crateDefs)

| id | wiki name | HP | collision | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|
| `case_01` | DEagle Case | 75 | box ±2.25×1.6 | – | beach | `deagle`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194] [src:kong/relaunch-client-defs] [H] |
| `case_02` | Dual DEagle Case | 75 | box ±2.25×1.6 | – | beach | `deagle_dual`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:195] [src:kong/relaunch-client-defs] [H] |
| `case_03` | Hatchet Case | 140 | box ±2.25×1.6 | – | beach | `tier_hatchet`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:199] [src:kong/relaunch-client-defs] [H] |
| `case_04` | Flare Gun Case | 140 | box ±2.25×1.6 | yes | beach | `flare_gun`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:208] [src:kong/relaunch-client-defs] [H] |
| `case_05` | Meteor Case | 140 | box ±2.25×1.6 | – | beach | `flare_gun`×1, 4× `strobe`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:218] [src:kong/relaunch-client-defs] [H] |
| `case_06` | Chrysanthemum Chest | 140 | box ±2.25×1.6 | – | beach | `tier_chest`×2–3, `tier_chrys_case`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:234] [src:kong/relaunch-client-defs] [H] |
| `case_07` | Red Emblem Case | 200 | box ±2.25×1.6 | – | beach | `tier_ring_case`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:241] [src:kong/relaunch-client-defs] [H] |
| `case_07de` | Gold Crimson Case | 200 | box ±2.25×1.6 | – | beach | `tier_airdrop_crimson`×1, `backpack03`×1, `4xscope`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:248] [H] |
| `case_08` |  | 140 | box ±2.25×1.6 | – | beach | `tier_armor`×1, `tier_medical`×1–2, `tier_crow_case_melee`×1, `tier_crow_case_skin`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:259] [H] |
| `case_08sv` |  | 140 | box ±2.25×1.6 | – | beach | `tier_armor`×1, `tier_medical`×1–2, `tier_perks`×1, `tier_crow_case_melee`×1, `tier_crow_case_skin`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:271] [H] |
| `case_09` | Cobalt Case | 140 | box ±2.25×1.6 | – | beach | `tier_guns_rare_classless`×1, `healthkit`×1, `soda`×2, `4xscope`×1, `chest02`×1, `backpack02`×1, `naginata_daemon`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:284] [H] |
| `case_10` | Cloud Case | 140 | box ±2.25×1.6 | – | beach | `backpack04_cloud`×1, `tier_perks`×1, `tier_ammo`×2–3, `tier_medical`×2 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:301] [H] |

### Chests (crateDefs)

| id | wiki name | HP | collision | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|
| `chest_01` | Treasure Chest | 140 | box ±2.25×1.6 | – | beach | `tier_chest`×3–4, `tier_pirate_melee`×1, `tier_pirate_outfits`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:315] [src:kong/relaunch-client-defs] [H] |
| `chest_01cb` | Treasure Chest | 140 | box ±2.25×1.6 | – | beach | `tier_chest`×3–4, `tier_pirate_melee`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:322] [src:kong/relaunch-client-defs] [H] |
| `chest_02` | Chest | 140 | box ±2.25×1.6 | yes | beach | `tier_chest`×2 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:325] [src:kong/relaunch-client-defs] [H] |
| `chest_03` | River Chest | 140 | box ±2.25×0.8 @(0,0.8) | – | beach+river(cw 1) | `tier_chest`×3–5, `outfitWaterElem`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:330] [src:kong/relaunch-client-defs] [H] |
| `chest_03cb` | River Chest | 140 | box ±2.25×0.8 @(0,0.8) | – | beach+river(cw 1) | `tier_chest`×3–5 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:334] [src:kong/relaunch-client-defs] [H] |
| `chest_03d` | River Chest | 140 | box ±2.25×0.8 @(0,0.8) | – | beach+river(cw 1) | `tier_chest`×3–5, `outfitWaterElem`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:338] [src:kong/relaunch-client-defs] [H] |
| `chest_03f` | River Chest | 140 | box ±2.25×0.8 @(0,0.8) | – | beach+river(cw 1) | `tier_chest`×3–5, `outfitKhaki`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:342] [src:kong/relaunch-client-defs] [H] |
| `chest_03sv` |  | 140 | box ±2.25×0.8 @(0,0.8) | – | beach+river(cw 1) | `tier_chest`×3–5, `outfitWaterElem`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:346] [H] |
| `chest_03x` | River Chest | 140 | box ±2.25×0.8 @(0,0.8) | – | beach+river(cw 1) | `tier_chest`×3–5, `outfitWaterElem`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:350] [src:kong/relaunch-client-defs] [H] |
| `chest_03tr` |  | 140 | box ±2.25×0.8 @(0,0.8) | – | beach+river(cw 1) | `tier_chest`×3–5, `outfitWaterElem`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:354] [H] |
| `chest_04` | Golden Eye Chest | 200 | box ±2.25×1.6 | – | beach | `tier_noir_outfit`×1, `tier_chest_04`×1, `glock_dual`×1, `smoke`×4 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:358] [src:kong/relaunch-client-defs] [H] |
| `chest_04d` | Golden Eye Chest | 200 | box ±2.25×1.6 | – | beach | `tier_noir_outfit`×1, `tier_chest_04`×1, `9mm`×300, `smoke`×4, `backpack02`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:369] [src:kong/relaunch-client-defs] [H] |

### Crates (crateDefs)

| id | wiki name | HP | collision | scale min–max / destroy | minimap | terrain | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|
| `crate_01` | Crate | 75 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:381] [src:kong/relaunch-client-defs] [H] |
| `crate_01x` | Crate | 75 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:382] [src:kong/relaunch-client-defs] [H] |
| `crate_02` | Soviet Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | – | grass+riverShore | `tier_soviet`×3–5 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383] [src:kong/relaunch-client-defs] [H] |
| `crate_02sv` |  | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `tier_soviet`×4–5, `tier_world`×1, `tier_medical`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391] [src:kong/relaunch-client-defs] [H] |
| `crate_02sv_lake` |  | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_soviet`×5–6, `tier_medical`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:403] [src:kong/relaunch-client-defs] [H] |
| `crate_02x` | Present Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | – | grass+riverShore | `tier_soviet`×3–5 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:410] [src:kong/relaunch-client-defs] [H] |
| `crate_02f` | Soviet Crate (50v50) | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `tier_guns`×3 (preloaded), `tier_armor`×2, `tier_packs`×1 | teamId 1, minDistanceFromSameType 32 | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:418] [src:kong/relaunch-client-defs] [H] |
| `crate_02d` | Soviet Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `m1014`×1, `helmet03_lt_aged`×1, `outfitRedLeaderAged`×1, `machete_taiga`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:435] [src:kong/relaunch-client-defs] [H] |
| `crate_03` | Grenade Box | 100 | box ±1.575×1.575 | 1–1 / 0.5 | yes | grass+riverShore | `tier_throwables`×2–4, `tier_fragtastic`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:448] [src:kong/relaunch-client-defs] [H] |
| `crate_03x` | Snowball Crate | 100 | box ±1.575×1.575 | 1–1 / 0.5 | yes | grass+riverShore | 3× `snowball`×4 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:457] [src:kong/relaunch-client-defs] [H] |
| `crate_04` | Ammo Crate | 225 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_ammo_crate`×1 | armorPlated | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:468] [src:kong/relaunch-client-defs] [H] |
| `crate_05` | Gold Crate | 75 | box ±2×2 | 1–1 / 0.5 | – | grass+beach+riverShore | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:482] [src:kong/relaunch-client-defs] [H] |
| `crate_06` | Ammo Crate | 175 | box ±2.25×1.1 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_ammo`×1 | armorPlated | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:494] [src:kong/relaunch-client-defs] [H] |
| `crate_07` | Bunker Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_surviv`×4–5, 4× `ak47`×1, 4× `tier_khaki_outfit`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:508] [src:kong/relaunch-client-defs] [H] |
| `crate_07b` | Bunker Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_armor`×4–5, 2× `mp220`×1, 2× `bar`×1, 4× `tier_khaki_outfit`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:524] [src:kong/relaunch-client-defs] [H] |
| `crate_07sv` | Bunker Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_surviv`×4–5, 2× `svd`×1, 2× `blr`×1, 4× `tier_khaki_outfit`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:540] [src:kong/relaunch-client-defs] [H] |
| `crate_08` | Bunker Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | – | grass+riverShore | `tier_surviv`×2–3 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:556] [src:kong/relaunch-client-defs] [H] |
| `crate_09` | Conch Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | – | grass+riverShore | `tier_chest`×1–2, `tier_conch`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:564] [src:kong/relaunch-client-defs] [H] |
| `crate_09bh` |  | 140 | box ±2.25×2.25 | 1–1 / 0.5 | – | grass+beach+riverShore | `tier_soviet`×3–5, `tier_outfits`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:572] [H] |
| `crate_09de` |  | 140 | box ±2.25×2.25 | 1–1 / 0.5 | – | grass+riverShore | `tier_chest`×2, `tier_surviv`×1, `backpack02`×1, `cutlass`×1, `tier_conch`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:579] [H] |
| `crate_10` | Meteor Crate | 200 | box ±2.25×2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_uncommon`×1, `tier_airdrop_armor`×1, `tier_medical`×2, `tier_airdrop_scopes`×1, `tier_airdrop_outfits`×1, `tier_airdrop_melee`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:593] [src:kong/relaunch-client-defs] [H] |
| `crate_11` | Gold Meteor Crate | 200 | box ±2.25×2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_rare`×1, `tier_airdrop_armor`×1, `tier_medical`×2, `tier_airdrop_scopes`×1, `tier_airdrop_outfits`×1, `tier_airdrop_melee`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:613] [src:kong/relaunch-client-defs] [H] |
| `crate_11h` | Gold Meteor Crate | 200 | circle r2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_rare`×1, `tier_airdrop_armor`×1, `tier_medical`×2, `tier_airdrop_scopes`×1, `tier_airdrop_outfits`×1, `tier_outfits`×1, `tier_airdrop_melee`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1, `tier_airdrop_xp`×2 | isDecalAnchor | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:633] [src:kong/relaunch-client-defs] [H] |
| `crate_10sv` | Meteor Crate | 200 | box ±2.25×2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_uncommon`×1, `tier_airdrop_armor`×1, `tier_medical`×2, `tier_airdrop_scopes`×1, `tier_airdrop_outfits`×1, `tier_airdrop_melee`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1, `tier_perks`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:657] [src:kong/relaunch-client-defs] [H] |
| `crate_11sv` | Gold Meteor Crate | 200 | box ±2.25×2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_rare`×1, `backpack04_cloud`×1, `tier_medical`×2, `tier_airdrop_scopes`×1, `tier_airdrop_outfits`×1, `tier_airdrop_melee`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1, `tier_perks`×2 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:678] [src:kong/relaunch-client-defs] [H] |
| `crate_11de` | Gold Meteor Crate | 200 | box ±2.25×2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_rare`×1, `tier_airdrop_armor`×1, `tier_medical`×2, `tier_airdrop_scopes`×1, `tier_airdrop_outfits`×1, `tier_airdrop_melee`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1, `tier_perks`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:699] [src:kong/relaunch-client-defs] [H] |
| `crate_11tr` | Gold Meteor Crate | 200 | box ±2.25×2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_rare`×1, `tier_airdrop_armor`×1, `tier_medical`×2, `tier_airdrop_scopes`×1, `tier_airdrop_outfits`×1, `tier_airdrop_melee`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1, `tier_airdrop_xp`×2 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:720] [src:kong/relaunch-client-defs] [H] |
| `crate_12` | Meteor Crate | 500 | box ±3.5×3.5 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_rare`×2 (preloaded), `tier_airdrop_uncommon`×7–8 (preloaded), `tier_airdrop_armor`×5–6, `tier_medical`×12–15, `tier_airdrop_scopes`×7–8, `tier_airdrop_outfits`×3–4, `tier_airdrop_melee`×6–7, `tier_airdrop_ammo`×10–12, `tier_airdrop_throwables`×6–8 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741] [src:kong/relaunch-client-defs] [H] |
| `crate_12po` |  | 500 | box ±3.5×3.5 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_rare`×2 (preloaded), `tier_airdrop_uncommon`×7–8 (preloaded), `tier_airdrop_armor`×5–6, `tier_medical`×12–15, `tier_airdrop_scopes`×7–8, `tier_airdrop_outfits`×3–4, `tier_airdrop_melee`×6–7, `tier_airdrop_ammo`×10–12, `tier_airdrop_throwables`×6–8 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:767] [H] |
| `crate_12dev` |  | 1100 | box ±3.5×3.5 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_dev_guns`×20 (preloaded), `tier_dev_melee`×6–7, `snowball`×100, `bandage`×1, `smoke`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:793] [H] |
| `crate_13` | Gold Meteor Crate | 200 | box ±3.5×3.5 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_mythic`×3–4 (preloaded), `tier_airdrop_rare`×5 (preloaded), `tier_airdrop_armor`×6–8, `tier_medical`×12–15, `tier_airdrop_scopes`×7–8, `tier_airdrop_faction_outfits`×1–2, `tier_airdrop_melee`×2–3, `tier_airdrop_faction_melee`×3, `tier_airdrop_ammo`×10–12, `tier_airdrop_throwables`×6–8, 3× `strobe`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813] [src:kong/relaunch-client-defs] [H] |
| `crate_13po` |  | 200 | box ±3.5×3.5 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_potato`×2, `tier_airdrop_mythic`×3–4 (preloaded), `tier_airdrop_rare`×5 (preloaded), `tier_airdrop_armor`×6–8, `tier_medical`×12–15, `tier_airdrop_scopes`×7–8, `tier_airdrop_faction_outfits`×1–2, `tier_airdrop_melee`×2–3, `tier_airdrop_faction_melee`×3, `tier_airdrop_ammo`×10–12, `tier_airdrop_throwables`×6–8, 3× `strobe`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:843] [H] |
| `crate_14` | Bottle Crate | 75 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:875] [src:kong/relaunch-client-defs] [H] |
| `crate_14a` | Bottle Crate | 75 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+beach+riverShore | `tier_soviet`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:881] [src:kong/relaunch-client-defs] [H] |
| `crate_15` |  | 100 | box ±2.7×1.25 | 1–1 / 0.5 | – | grass+beach+riverShore | `tier_knives`×4 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:887] [src:kong/relaunch-client-defs] [H] |
| `crate_16` |  | 100 | box ±2.7×1.25 | 1–1 / 0.5 | – | grass+beach+riverShore | `tier_knives`×4 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:896] [src:kong/relaunch-client-defs] [H] |
| `crate_17` |  | 200 | box ±2.25×2.25 | 1–1 / 0.75 | – | grass+beach+riverShore | `tier_airdrop_crimson`×1, `tier_airdrop_armor`×1, `tier_medical`×2–3, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×3, `tier_airdrop_throwables`×1–2, `tier_perks`×0–1, `outfitCasanova`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:905] [H] |
| `crate_18` | Cattle Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `tier_cattle_crate`×2–3, `tier_soviet`×1–2 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:925] [src:kong/relaunch-client-defs] [H] |
| `crate_19` | Hatchet Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `tier_guns`×1–3, `tier_surviv`×2–3 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:933] [src:kong/relaunch-client-defs] [H] |
| `crate_20` | Crab Pot | 75 | box ±1.7×1.7 | 1–1 / 0.5 | yes | grass+riverShore | `tier_armor`×1, `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:941] [src:kong/relaunch-client-defs] [H] |
| `crate_21` | Cloud Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `tier_guns`×1–2, `tier_snipers`×1, `tier_cloud_02`×1, `tier_perks`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:952] [src:kong/relaunch-client-defs] [H] |
| `crate_21b` | Cloud Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | – | grass+riverShore | `tier_guns`×1–2, `tier_snipers`×1, `tier_cloud_02`×1, `tier_perks`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:965] [src:kong/relaunch-client-defs] [H] |
| `crate_22` | Initiative Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `tier_guns`×3 (preloaded), `tier_armor`×2, `tier_packs`×1 | teamId 2, minDistanceFromSameType 32 | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:978] [src:kong/relaunch-client-defs] [H] |
| `crate_22d` | Desert Initiative Crate | 140 | box ±2.25×2.25 | 1–1 / 0.5 | yes | grass+riverShore | `an94`×1, `helmet03_lt_aged`×1, `outfitBlueLeaderAged`×1, `kukri_trad`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:995] [src:kong/relaunch-client-defs] [H] |

### Air drops (crateDefs)

| id | wiki name | collision | behaviour | status | source |
|---|---|---|---|---|---|
| `airdrop_crate_01` | Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_10`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1008] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_02` | Gold Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_11`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1021] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_03` | Air Drop | box ±4×4 | reflects, airdropCrate, destroyType `crate_12`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1034] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_03po` |  | box ±4×4 | reflects, airdropCrate, destroyType `crate_12po`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1048] [H] |
| `airdrop_crate_03dev` |  | box ±4×4 | reflects, airdropCrate, destroyType `crate_12dev`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1062] [H] |
| `airdrop_crate_04` | Gold Air Drop | box ±4×4 | reflects, airdropCrate, destroyType `crate_13`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1076] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_04po` |  | box ±4×4 | reflects, airdropCrate, destroyType `crate_13po`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1090] [H] |
| `airdrop_crate_05` | Crimson Airdrop Crate | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_17`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1104] [H] |
| `airdrop_crate_01sv` | Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_10sv`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1117] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_02sv` | Gold Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_11sv`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1130] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_02de` | Gold Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_11de`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1143] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_02h` | Gold Air Drop | circle r2.5 | reflects, airdropCrate, destroyType `cache_pumpkin_airdrop_02`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1156] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_02tr` | Gold Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_11tr`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1170] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_01x` | Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_10`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1183] [src:kong/relaunch-client-defs] [H] |
| `airdrop_crate_02x` | Gold Air Drop | box ±2.5×2.5 | reflects, airdropCrate, destroyType `crate_11`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1196] [src:kong/relaunch-client-defs] [H] |

### Class shells and class pods (crateDefs)

| id | wiki name | HP | collision | col/destr | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|
| `class_shell_01` | Class Pod | 200 | circle r2.25 | C– | – | reflects, smartLoot, destroyType `class_crate_common`, minDistanceFromSameType 32, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1209] [src:kong/relaunch-client-defs] [H] |
| `class_shell_02` | Gold Class Pod | 200 | circle r2.25 | C– | – | reflects, smartLoot, airdropCrate, destroyType `class_crate_rare`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1229] [src:kong/relaunch-client-defs] [H] |
| `class_shell_03` | Mythic Class Pod | 200 | circle r2.25 | C– | – | reflects, airdropCrate, destroyType `class_crate_mythic`, button(game-unlock, delay 2.5 s, once, destroyOnUse) | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1244] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_scout` |  | 150 | circle r2.1 | CD | `tier_guns_common_scout`×1, `crowbar_scout`×1, `helmet01`×1, `backpack01`×1, `soda`×2 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1259] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_sniper` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_common_sniper`×1, `kukri_sniper`×1, `helmet01`×1, `backpack01`×1, `4xscope`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1269] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_healer` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_common_healer`×1, `bonesaw_healer`×1, `helmet01`×1, `backpack01`×1, `tier_health_healer`×1, `painkiller`×1, `smoke`×3 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1279] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_demo` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_common_demo`×1, `katana_demo`×1, `helmet01`×1, `chest01`×1, `backpack02`×1, `2xscope`×1, `tier_throwables_demo`×3–4 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1291] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_assault` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_common_assault`×2, `spade_assault`×1, `bandage`×5, `helmet01`×1, `chest01`×1, `backpack01`×1 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1303] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_tank` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_common_tank`×1, `warhammer_tank`×1, `helmet02`×1, `chest02`×1, `backpack01`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1314] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_classless` |  | 150 | circle r2.1 | CD | `tier_guns_common_classless`×1, `tier_medical`×1–2, `tier_throwables`×1–2, `tier_ammo`×1, `naginata_daemon`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1324] [H] |
| `class_crate_rare_scout` |  | 150 | circle r2.1 | CD | `tier_guns_rare_scout`×1, `crowbar_scout`×1, `tier_airdrop_armor`×1, `tier_medical`×1, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×2, `tier_airdrop_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1334] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_sniper` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_rare_sniper`×1, `kukri_sniper`×1, `tier_airdrop_armor`×1, `tier_medical`×1, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×2, `tier_airdrop_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1346] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_healer` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_rare_healer`×1, `bonesaw_healer`×1, `tier_airdrop_armor`×1, `tier_medical`×1, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×2, `tier_airdrop_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1358] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_demo` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_rare_demo`×1, `katana_demo`×1, `tier_airdrop_armor`×1, `tier_medical`×1, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×2, `tier_throwables_demo`×4–5 | – | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1370] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_assault` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_rare_assault`×2, `spade_assault`×1, `tier_airdrop_armor`×1, `tier_medical`×1, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×2, `tier_airdrop_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1382] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_tank` | Class Pod | 150 | circle r2.1 | CD | `tier_guns_rare_tank`×1, `warhammer_tank`×1, `tier_airdrop_armor`×1, `tier_medical`×1, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×2, `tier_airdrop_throwables`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1394] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_classless` |  | 150 | circle r2.1 | CD | `tier_guns_rare_classless`×1, `naginata_daemon`×1, `chest03`×1, `tier_medical`×2–3, `tier_airdrop_throwables`×2, `tier_airdrop_scopes`×1, `tier_airdrop_ammo`×2 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1406] [H] |
| `class_crate_mythic` | Class Pod | 150 | circle r2.1 | CD | `tier_class_crate_mythic`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1418] [src:kong/relaunch-client-defs] [H] |

### Military crates (crateDefs)

| id | wiki name | HP | collision | minimap | loot | status | source |
|---|---|---|---|---|---|---|---|
| `mil_crate_01` | Knife Crate | 100 | box ±2.7×1.25 | – | `tier_knives`×1 | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1422] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_02` | OT-38 Crate | 100 | box ±2.7×1.25 | – | 4× `ot38`×1 | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1431] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_03` | Arctic Avenger Crate | 100 | box ±2.7×1.25 | – | `ots38_dual`×1, `outfitSpetsnaz`×1 | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1445] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_04` | Soviet Military Crate | 100 | box ±2.7×1.25 | – | `tier_guns`×1, `tier_throwables`×2–3 | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1454] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_05` | Marksman Military Crate | 100 | box ±2.7×1.25 | yes | `tier_guns`×1–2, `tier_snipers`×1–2 | orig | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1463] [src:kong/relaunch-client-defs] [H] |

### Furniture (furnitureDefs)

| id | wiki name | HP | collision | height | col/destr | minimap | loot | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|---|---|
| `barrel_02` | Wood Barrel | 60 | circle r1.75 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:653] [src:kong/relaunch-client-defs] [H] |
| `barrel_03` | Wall Barrel | 20 | circle r1.75 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:654] [src:kong/relaunch-client-defs] [H] |
| `barrel_04` | Gold Wall Barrel | 20 | circle r1.75 | 0.5 | CD | yes | `tier_soviet`×2–3 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:663] [src:kong/relaunch-client-defs] [H] |
| `barrel_05` | Wood Barrel | 80 | circle r1.75 | 0.5 | CD | yes | `tier_surviv`×0–2, `tier_coconut_outfit`×1, `coconut`×4 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:673] [H] |
| `bathhouse_rocks_01` |  | 250 | box ±1.55×1.55 | 0.5 | C– | – | – | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:686] [src:kong/relaunch-client-defs] [H] |
| `bed_sm_01` | Beds | 100 | box ±1.4×3.4 | 0.5 | CD | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:691] [src:kong/relaunch-client-defs] [H] |
| `bed_lg_01` |  | 100 | box ±2.8×3.4 | 0.5 | CD | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:695] [src:kong/relaunch-client-defs] [H] |
| `bookshelf_01` | Bookshelf | 75 | box ±3.5×1 | 0.5 | CD | – | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:698] [src:kong/relaunch-client-defs] [H] |
| `bookshelf_02` | Bookshelf with Plant | 75 | box ±3.5×1 | 0.5 | CD | – | `tier_soviet`×2–3 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:702] [src:kong/relaunch-client-defs] [H] |
| `chair_01` | Chairs | 125 | box ±1×1.25 | 0.5 | CD | – | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:706] [H] |
| `chair_02` |  | 125 | circle r1.25 | 0.5 | CD | – | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:722] [H] |
| `couch_01` | Couch | 125 | box ±4.5×1.5 | 0.5 | CD | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:738] [src:kong/relaunch-client-defs] [H] |
| `couch_02` | Couch | 125 | box ±3×1.5 | 0.5 | CD | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:739] [src:kong/relaunch-client-defs] [H] |
| `couch_02b` |  | 125 | box ±3×1.5 | 0.5 | CD | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:743] [src:kong/relaunch-client-defs] [H] |
| `couch_03` | Couch | 125 | box ±1.5×1.5 | 0.5 | CD | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:747] [src:kong/relaunch-client-defs] [H] |
| `bottle_01` | Bottle | 12 | circle r0.5 | 0.5 | CD | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:751] [src:kong/relaunch-client-defs] [H] |
| `bottle_02` | Bottle | 20 | circle r1.5 | 0.5 | CD | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:768] [src:kong/relaunch-client-defs] [H] |
| `bottle_04` | Bottle | 20 | circle r0.5 | 0.5 | CD | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:785] [src:kong/relaunch-client-defs] [H] |
| `bottle_05` | Bottle | 20 | circle r1.5 | 0.5 | CD | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:802] [src:kong/relaunch-client-defs] [H] |
| `candle_01` |  | 150 | circle r0.5 | 0.5 | –– | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:819] [src:kong/relaunch-client-defs] [H] |
| `deposit_box_01` | Deposit Box | 20 | box ±2.5×1 @(0,0.15) | 10 | CD | – | `tier_world`×1 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:846] [src:kong/relaunch-client-defs] [H] |
| `deposit_box_02` | Deposit Box | 20 | box ±2.5×1 @(0,0.15) | 10 | CD | – | `tier_soviet`×1–2, `tier_guns`×1 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:850] [src:kong/relaunch-client-defs] [H] |
| `deposit_box_03` |  | 20 | box ±2.5×1 @(0,0.15) | 10 | CD | – | `tier_chest`×1, `tier_guns`×1–2, `tier_surviv`×1–2 | reflects | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:855] [H] |
| `drawers_01` | Drawer | 75 | box ±2.5×1.25 @(0,0.15) | 0.5 | CD | – | `tier_container`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:864] [src:kong/relaunch-client-defs] [H] |
| `drawers_02` | Drawer with Plant | 75 | box ±2.5×1.25 @(0,0.15) | 0.5 | CD | – | `tier_soviet`×2–3 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:868] [src:kong/relaunch-client-defs] [H] |
| `fire_ext_01` | Fire Extinguisher | 75 | circle r1 | 0.5 | CD | – | – | reflects, createSmoke | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:872] [src:kong/relaunch-client-defs] [H] |
| `grill_01` | Grill | 200 | circle r1.55 | 0.5 | CD | – | – | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:902] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_empty` |  | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:906] [H] |
| `gun_mount_01` | Wall Mount | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | `m870`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:910] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_02` | Wall Mount | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | `mp220`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:914] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_03` | Wall Mount | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | `qbb97`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:918] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_04` | Wall Mount | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | `woodaxe_bloody`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:922] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_05` | Wall Mount | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | `m1100`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:926] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_06` |  | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | `cutlass_gold`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:930] [H] |
| `gun_mount_07` |  | 50 | box ±2.25×0.7 @(0,0.2) | 0.5 | CD | – | `spas16`×1 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:934] [H] |
| `locker_01` | Locker | 20 | box ±1.5×0.6 @(0,0.15) | 10 | CD | – | `tier_world`×1 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:938] [src:kong/relaunch-client-defs] [H] |
| `locker_02` | Golden Locker | 20 | box ±1.5×0.6 @(0,0.15) | 10 | CD | – | `tier_police`×1 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:942] [src:kong/relaunch-client-defs] [H] |
| `locker_03` | Initiative Locker | 20 | box ±1.5×0.6 @(0,0.15) | 10 | CD | – | `ak47`×1, `backpack02`×1, `tier_khaki_outfit`×1 | reflects | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:946] [src:kong/relaunch-client-defs] [H] |
| `oven_01` | Oven | 200 | box ±1.7×1.3 @(0,0.15) | 0.5 | CD | – | – | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:954] [src:kong/relaunch-client-defs] [H] |
| `piano_01` | Piano | 75 | box ±3.75×1 | 0.5 | C– | – | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:955] [src:kong/relaunch-client-defs] [H] |
| `planter_01` | Planter | 100 | box ±2.25×4.25 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:988] [src:kong/relaunch-client-defs] [H] |
| `planter_02` | Planter | 100 | box ±2.25×4.25 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:989] [src:kong/relaunch-client-defs] [H] |
| `planter_03` | Planter | 100 | box ±2.25×4.25 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:992] [src:kong/relaunch-client-defs] [H] |
| `planter_04` | Planter | 100 | box ±1.5×1.5 | 0.5 | C– | yes | `tier_world`×1 | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:995] [src:kong/relaunch-client-defs] [H] |
| `planter_06` | Aged Planter | 100 | box ±2.25×4.25 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1013] [src:kong/relaunch-client-defs] [H] |
| `planter_07` | Aged Planter | 100 | box ±1.5×1.5 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1019] [src:kong/relaunch-client-defs] [H] |
| `pot_01` | Pot | 50 | circle r1.5 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1027] [src:kong/relaunch-client-defs] [H] |
| `pot_02` | Pot | 50 | circle r1.5 | 0.5 | CD | yes | `spas12`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1028] [src:kong/relaunch-client-defs] [H] |
| `pot_03` | Pot | 50 | circle r1.5 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1032] [src:kong/relaunch-client-defs] [H] |
| `pot_03b` | Vase | 50 | circle r1.5 | 0.5 | CD | yes | `outfitWoodsCloak`×1, `backpack03`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1033] [src:kong/relaunch-client-defs] [H] |
| `pot_03c` | Vase | 50 | circle r1.5 | 0.5 | CD | yes | `tier_pavilion`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1037] [src:kong/relaunch-client-defs] [H] |
| `pot_04` | Bucket | 50 | circle r1.5 | 0.5 | CD | yes | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1041] [src:kong/relaunch-client-defs] [H] |
| `pot_05` | Pot | 50 | circle r1.5 | 0.5 | CD | yes | `scout_elite`×1, `tier_islander_outfit`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1042] [src:kong/relaunch-client-defs] [H] |
| `rack_01` | Wine Rack | 75 | box ±2×1.25 @(0,0.2) | 0.5 | CD | – | `tier_revolvers`×0–1, `tier_medical`×1, `tier_vending_soda`×1–2 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1046] [H] |
| `refrigerator_01` | Refrigerator | 100 | box ±1.7×1.25 @(0,0.15) | 0.5 | C– | – | – | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1062] [src:kong/relaunch-client-defs] [H] |
| `refrigerator_01b` |  | 250 | box ±1.7×1.25 @(0,0.15) | 0.5 | C– | – | – | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1063] [src:kong/relaunch-client-defs] [H] |
| `safe_01` |  | 400 | box ±1.25×1.25 @(0,0.1) | 0.5 | CD | yes | `tier_safe_throwables`×1, `tier_safe`×1 | stonePlated | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1067] [H] |
| `safe_01de` |  | 400 | box ±1.25×1.25 @(0,0.1) | 0.5 | CD | yes | `tier_crimson_perks`×1, 2× `strobe`×1 | stonePlated | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1068] [H] |
| `screen_01` | Screen | 25 | box ±4×0.2 @(0,0.05) | 0.5 | CD | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1071] [src:kong/relaunch-client-defs] [H] |
| `sink_01` | Sink | 100 | box ±2×1.5 | 0.5 | CD | – | `tier_toilet`×2 | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1105] [H] |
| `stand_01` | Cabinet | 75 | box ±1.25×1.25 @(0,0.15) | 0.5 | CD | – | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1106] [src:kong/relaunch-client-defs] [H] |
| `power_box_01` | Power Box | 250 | box ±1×1 | 0.5 | CD | – | – | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1140] [src:kong/relaunch-client-defs] [H] |
| `stove_01` | Stove | 500 | box ±3×2.25 | 10 | CD | – | – | reflects, explodes `explosion_stove`, damageCeiling, disableBuildingOccupied | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1141] [src:kong/relaunch-client-defs] [H] |
| `stove_02` | Stove | 400 | circle r1.5 | 10 | CD | – | – | reflects, explodes `explosion_stove`, damageCeiling, disableBuildingOccupied | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1162] [src:kong/relaunch-client-defs] [H] |
| `table_01` | Table | 100 | box ±2.5×2 | 0.5 | –D | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1178] [src:kong/relaunch-client-defs] [H] |
| `table_01x` | Table | 100 | box ±2.5×2 | 0.5 | –D | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1179] [src:kong/relaunch-client-defs] [H] |
| `table_01d` |  | 100 | box ±2.5×2 @(0,-0.5) | 0.5 | –D | – | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1180] [H] |
| `table_02` | Table | 125 | box ±4.5×2.5 | 0.5 | –D | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1184] [src:kong/relaunch-client-defs] [H] |
| `table_02x` | Table | 125 | box ±4.5×2.5 | 0.5 | –D | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1196] [src:kong/relaunch-client-defs] [H] |
| `table_03` | Table | 125 | circle r2.5 | 0.5 | –D | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1208] [src:kong/relaunch-client-defs] [H] |
| `table_03x` | Table | 125 | circle r2.5 | 0.5 | –D | – | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1220] [src:kong/relaunch-client-defs] [H] |
| `table_04` |  | 225 | box ±4.5×2 | 0.5 | –D | – | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1232] [H] |
| `table_05` |  | 300 | box ±9×2.75 | 0.5 | –D | – | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1244] [H] |
| `table_06` |  | 250 | box ±4×2 | 0.5 | C– | – | – | reflects, explodes `explosion_barrel` | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1258] [H] |
| `table_07` |  | 250 | box ±3.35×1.25 @(0.05,-0.1) | 0.5 | C– | – | – | reflects, explodes `explosion_barrel` | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1265] [H] |
| `table_08` |  | 250 | box ±4×1.5 @(0,-0.05) | 0.5 | C– | – | – | reflects, explodes `explosion_barrel` | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1272] [H] |
| `table_09` |  | 250 | box ±3×2 @(0,-0.05) | 0.5 | C– | – | – | reflects, explodes `explosion_barrel` | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1279] [H] |
| `toilet_01` | Toilet | 100 | circle r1.18 | 0.5 | CD | – | `tier_toilet`×2–3 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1286] [src:kong/relaunch-client-defs] [H] |
| `toilet_02` | Toilet | 100 | circle r1.18 | 0.5 | CD | – | `tier_soviet`×3–4 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1290] [src:kong/relaunch-client-defs] [H] |
| `toilet_02b` | Toilet | 100 | circle r1.18 | 0.5 | CD | – | `fireaxe`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1294] [src:kong/relaunch-client-defs] [H] |
| `toilet_03` | Toilet | 100 | circle r1.18 | 0.5 | CD | – | `tier_world`×1–2 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1301] [src:kong/relaunch-client-defs] [H] |
| `toilet_04` | Toilet | 100 | circle r1.18 | 0.5 | CD | – | `tier_soviet`×2–3 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1316] [src:kong/relaunch-client-defs] [H] |
| `toilet_05` | Gold Toilet | 100 | circle r1.56 | 0.5 | CD | – | `tier_toilet_gold`×1, `tier_medical`×3–4, `coconut`×5, `outfitGold`×1 | reflects | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1331] [H] |
| `towelrack_01` | Towel Rack | 75 | box ±3×1 | 0.5 | CD | – | `tier_world`×1 | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1354] [src:kong/relaunch-client-defs] [H] |
| `vat_01` | Small Vat | 250 | circle r2 | 0.5 | CD | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1359] [src:kong/relaunch-client-defs] [H] |
| `vat_02` | Big Vat | 1000 | circle r3.1 | 0.5 | C– | yes | – | – | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1388] [src:kong/relaunch-client-defs] [H] |
| `vat_03` | Augmenting Vat | 250 | circle r1.75 | 0.2 | –– | yes | – | button(game-use, delay 0.1 s, once, destroyOnUse, promotes classless) | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1421] [H] |
| `vat_04` | Defective Vats | 250 | circle r2 | 0.5 | CD | yes | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1465] [H] |
| `vat_05` |  | 250 | circle r2 | 0.5 | CD | yes | – | – | fork | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1494] [H] |
| `vending_01` | Soda Machine | 150 | box ±1.7×1.25 @(0,0.15) | 0.5 | CD | – | `tier_vending_soda`×1–3, `soda`×1 | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1523] [src:kong/relaunch-client-defs] [H] |
| `wheel_01` | Wheel | 300 | circle r4.6 | 10 | C– | – | – | reflects, button(game-use, delay 2.5 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1524] [src:kong/relaunch-client-defs] [H] |
| `wheel_02` | Wheel | 300 | circle r4.6 | 10 | C– | – | – | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1536] [src:kong/relaunch-client-defs] [H] |
| `wheel_03` | Wheel | 300 | circle r4.6 | 10 | C– | – | – | reflects | orig | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1537] [src:kong/relaunch-client-defs] [H] |

### Interactables (interactableDefs)

| id | wiki name | HP | collision | height | col/destr | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|
| `control_panel_01` |  | 250 | box ±2.25×1.7 | 0.5 | CD | reflects, explodes `explosion_barrel`, button(game-use, delay 1.1 s, useType `cell_door_01`, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:276] [src:kong/relaunch-client-defs] [H] |
| `control_panel_02` |  | 175 | box ±2.25×1.7 | 0.5 | CD | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:290] [src:kong/relaunch-client-defs] [H] |
| `control_panel_02b` |  | 250 | box ±2.25×1.7 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:295] [src:kong/relaunch-client-defs] [H] |
| `control_panel_03` |  | 150 | box ±1.25×1.2 | 0.5 | CD | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:313] [src:kong/relaunch-client-defs] [H] |
| `control_panel_04` |  | 250 | box ±2.25×1.7 | 0.5 | CD | reflects, explodes `explosion_barrel`, button(game-use, delay 4.25 s, useType `crossing_door_01`, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:318] [src:kong/relaunch-client-defs] [H] |
| `control_panel_06` |  | 200 | box ±3×1.4 | 0.5 | CD | reflects, explodes `explosion_barrel` | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:332] [src:kong/relaunch-client-defs] [H] |
| `control_panel_07de` |  | 250 | box ±2.25×1.7 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, useType `house_door_02`, lock, close, cooldown 27) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:338] [H] |
| `control_panel_07sv` |  | 250 | box ±2.25×1.7 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, useType `lab_door_01`, lock, close, cooldown 40) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:362] [H] |
| `switch_01` | Switch | 100 | box ±0.45×0.55 | 0.5 | C– | reflects, button(game-use, delay 0.25 s, once) | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:385] [src:kong/relaunch-client-defs] [H] |
| `switch_01o` |  | 100 | box ±0.45×0.55 | 0.5 | C– | reflects, button(game-use, delay 0.25 s, once) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:386] [H] |
| `switch_01p` |  | 100 | box ±0.45×0.55 | 0.5 | C– | reflects, button(game-use, delay 0.25 s, once) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:389] [H] |
| `switch_01y` |  | 100 | box ±0.45×0.55 | 0.5 | C– | reflects, button(game-use, delay 0.25 s, once) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:392] [H] |
| `switch_02` | Switch | 250 | box ±0.45×0.55 | 0.5 | C– | reflects, explodes `explosion_barrel` | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:395] [src:kong/relaunch-client-defs] [H] |
| `switch_03` | Switch | 250 | box ±0.45×0.55 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:400] [src:kong/relaunch-client-defs] [H] |
| `bottle_02r` | Bottle Switch | 50 | box ±0.5×0.5 | 0.3 | C– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:417] [src:kong/relaunch-client-defs] [H] |
| `bottle_02o` | Bottle Switch | 50 | box ±0.5×0.5 | 0.3 | –– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:418] [src:kong/relaunch-client-defs] [H] |
| `bottle_02y` | Bottle Switch | 50 | box ±0.5×0.5 | 0.3 | –– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:422] [src:kong/relaunch-client-defs] [H] |
| `bottle_02g` | Bottle Switch | 50 | box ±0.5×0.5 | 0.3 | –– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:426] [src:kong/relaunch-client-defs] [H] |
| `bottle_02b` | Bottle Switch | 50 | box ±0.5×0.5 | 0.3 | C– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:427] [src:kong/relaunch-client-defs] [H] |
| `bottle_02i` | Bottle Switch | 50 | box ±0.5×0.5 | 0.3 | –– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:428] [src:kong/relaunch-client-defs] [H] |
| `bottle_02v` | Bottle Switch | 50 | box ±0.5×0.5 | 0.3 | C– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:432] [src:kong/relaunch-client-defs] [H] |
| `button_01` |  | 50 | box ±0.5×0.5 | 0.3 | –– | button(game-use, delay 0.25 s, once) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:433] [H] |
| `button_01g` |  | 50 | box ±0.5×0.5 | 0.3 | –– | button(game-use, delay 0.25 s, once) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:434] [H] |
| `button_01b` |  | 50 | box ±0.5×0.5 | 0.3 | –– | button(game-use, delay 0.25 s, once) | fork | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:451] [H] |
| `recorder_01` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:468] [src:kong/relaunch-client-defs] [H] |
| `recorder_02` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:471] [src:kong/relaunch-client-defs] [H] |
| `recorder_03` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:474] [src:kong/relaunch-client-defs] [H] |
| `recorder_04` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:477] [src:kong/relaunch-client-defs] [H] |
| `recorder_05` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:480] [src:kong/relaunch-client-defs] [H] |
| `recorder_06` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:483] [src:kong/relaunch-client-defs] [H] |
| `recorder_07` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:486] [src:kong/relaunch-client-defs] [H] |
| `recorder_08` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:489] [src:kong/relaunch-client-defs] [H] |
| `recorder_09` |  | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:492] [src:kong/relaunch-client-defs] [H] |
| `recorder_10` | Recorder | 250 | box ±0.9×1.5 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:495] [src:kong/relaunch-client-defs] [H] |
| `recorder_11` | Recorder | 250 | box ±0.75×1.25 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:498] [src:kong/relaunch-client-defs] [H] |
| `recorder_12` | Recorder | 250 | box ±0.75×1.25 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:506] [src:kong/relaunch-client-defs] [H] |
| `recorder_13` | Recorder | 250 | box ±0.75×1.25 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:514] [src:kong/relaunch-client-defs] [H] |
| `recorder_14` | Recorder | 250 | box ±0.75×1.25 | 0.5 | C– | reflects, explodes `explosion_barrel`, button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:522] [src:kong/relaunch-client-defs] [H] |
| `tree_switch_01` | Tree Switch | 175 | circle r1.6 | 0.5 | C– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:530] [src:kong/relaunch-client-defs] [H] |
| `tree_switch_02` | Tree Switch | 175 | circle r1.6 | 0.5 | C– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:533] [src:kong/relaunch-client-defs] [H] |
| `tree_switch_03` | Tree Switch | 175 | circle r1.6 | 0.5 | C– | button(game-use, delay 0.25 s, once) | orig | [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:536] [src:kong/relaunch-client-defs] [H] |

### Windows and stairs (buildingObjsDefs)

| id | wiki name | HP | collision | height | col/destr | behaviour | status | source |
|---|---|---|---|---|---|---|---|---|
| `house_window_01` | Window | 1 | box ±0.4×2 | 10 | CD | isWindow, destroyType `house_window_broken_01` | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:587] [src:kong/relaunch-client-defs] [H] |
| `lab_window_01` |  | 1 | box ±0.4×2 | 10 | CD | isWindow, destroyType `lab_window_broken_01` | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:591] [src:kong/relaunch-client-defs] [H] |
| `stairs_01` | Broken Stairs | 100 | box ±2.5×2 | 0.5 | –D | – | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:595] [src:kong/relaunch-client-defs] [H] |
| `stairs_02` |  | 100 | box ±2.5×4 | 0.5 | –D | – | fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:596] [H] |
| `stairs_03` |  | 150 | box ±2.5×2 | 0.5 | –D | – | fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:600] [H] |
| `club_window_01` | Boarded Window | 1 | box ±0.4×2 | 10 | CD | destroyType `club_window_broken_01` | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:605] [src:kong/relaunch-client-defs] [H] |
| `bank_window_01` |  | 75 | box ±0.4×2 | 10 | CD | isWindow | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:622] [src:kong/relaunch-client-defs] [H] |
| `reserve_window_01` |  | 1 | box ±0.4×3.5 | 10 | CD | isWindow, destroyType `reserve_window_broken_01` | fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:650] [H] |

### Doors (buildingObjsDefs)

| id | wiki name | HP | collision (hinge-anchored) | material | destructible | canUse / locked | open style | openOneWay | openDelay s | openOnce | interactionRad | openSpeed | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `house_door_01` | Door | 150 | box ±0.3×2 @(0,2) | wood | yes | yes / no | swing | 0 | 0 | no | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:243] [src:kong/relaunch-client-defs] [H] |
| `house_door_02` | Metal Door | 150 | box ±0.3×2 @(0,2) | metal | no | yes / no | swing | 0 | 0 | no | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:249] [src:kong/relaunch-client-defs] [H] |
| `house_door_03` | Door (wide) | 150 | box ±0.5×1.75 @(0,2) | wood | yes | yes / no | swing | 0 | 0 | no | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:263] [src:kong/relaunch-client-defs] [H] |
| `house_door_05` | Glass door | 150 | box ±0.3×2 @(0,2) | glass | yes | yes / no | swing | 0 | 0 | no | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:270] [src:kong/relaunch-client-defs] [H] |
| `crossing_door_01` | Metal Door | 150 | box ±0.3×2 @(0,2) | metal | no | no / no | swing | 0 | 0 | yes | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:277] [src:kong/relaunch-client-defs] [H] |
| `cell_door_01` | Metal Door (jail cell) | 150 | box ±0.3×2 @(0,2) | metal | no | no / no | swing | 0 | 0 | yes | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:292] [src:kong/relaunch-client-defs] [H] |
| `eye_door_01` | Metal Door | 150 | box ±0.3×2 @(0,2) | metal | no | no / no | swing | -1 | 0 | yes | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:307] [src:kong/relaunch-client-defs] [H] |
| `lab_door_01` | Sliding Door | 150 | box ±0.3×2 @(0,2) | concrete | no | yes / no | slide 3.75, autoOpen, autoClose 1 s | 0 | 0 | no | 2 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:323] [src:kong/relaunch-client-defs] [H] |
| `lab_door_02` | Sliding Door (one-way) | 150 | box ±0.3×2 @(0,2) | concrete | no | yes / no | slide -3.75, autoOpen, autoClose 1 s | 1 | 0 | no | 2 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:331] [src:kong/relaunch-client-defs] [H] |
| `lab_door_03` | Sliding Door (one-way) | 150 | box ±0.3×2 @(0,2) | concrete | no | yes / no | slide 3.75, autoOpen, autoClose 1 s | 1 | 0 | no | 2 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:339] [src:kong/relaunch-client-defs] [H] |
| `lab_door_locked_01` | Sliding Door (locked) | 150 | box ±0.3×2 @(0,2) | concrete | no | yes / yes | slide 3.75, autoOpen | 0 | 0 | yes | 2 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:343] [src:kong/relaunch-client-defs] [H] |
| `lab_door_chrys` | Sliding Door | 150 | box ±0.3×2 @(0,2) | concrete | no | no / no | slide 3.75 | 0 | 0 | yes | 0.75 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:352] [src:kong/relaunch-client-defs] [H] |
| `vault_door_main` | Vault Door | 150 | box ±1×3.5 @(1,3.5) | metal | no | yes / no | swing | -1 | 4.1 | yes | 1.5 | 0.23 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:382] [src:kong/relaunch-client-defs] [H] |
| `vault_door_chrys_01` | Vault Door | 150 | box ±1×3.5 @(1,3.5) | metal | no | no / no | swing | -1 | 4.1 | yes | 1.5 | 0.23 | orig (fork-modified) | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:402] [src:kong/relaunch-client-defs] [H] |
| `vault_door_chrys_02` | Vault Door | 150 | box ±1×3.5 @(1,3.5) | metal | no | no / no | swing | 0 | 0 | no | 0.75 | 2 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:423] [src:kong/relaunch-client-defs] [H] |
| `vault_door_reserve` | Vault Door | 150 | box ±1×5 @(1,5) | metal | no | no / no | swing | -1 | 4.1 | yes | 1.5 | 0.23 | fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:434] [H] |
| `vault_door_eye` | Vault Door | 150 | box ±1×3.5 @(1,3.5) | metal | no | no / no | swing | -1 | 0.1 | yes | 1.5 | 10 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:455] [src:kong/relaunch-client-defs] [H] |
| `saloon_door_secret` | secret door | 150 | box ±0.75×2 @(0,2) | wood | no | no / no | slide 4.5 | 0 | 0 | yes | 0.75 | 36 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:476] [src:kong/relaunch-client-defs] [H] |
| `teahouse_door_01` | Sliding Door (shoji) | 150 | box ±0.3×2 @(0,2) | concrete | no | yes / no | slide 3.75 | 0 | 0 | no | 2 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:502] [src:kong/relaunch-client-defs] [H] |
| `secret_door_club` | secret door | 150 | box ±0.3×2 @(0,2) | concrete | no | no / no | slide 3.75 | 0 | 0 | yes | 0.75 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:527] [src:kong/relaunch-client-defs] [H] |
| `vault_door_bathhouse` | vault door | 150 | box ±0.3×2 @(0,2) | metal | no | no / no | slide 3.75 | 0 | 0 | yes | 0.75 | 7 | orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:557] [src:kong/relaunch-client-defs] [H] |

### Walls (buildingObjsDefs, grouped)

| family | ids | count | material | HP | destructible | height | status | source |
|---|---|---|---|---|---|---|---|---|
| archway | `archway_column_1` | 1 | wood | 150 | yes | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:788] [src:kong/relaunch-client-defs] [H] |
| bank | `bank_wall_int_3`, `bank_wall_int_4`, `bank_wall_int_5`, `bank_wall_int_8` | 4 | wood | 150 | yes | 10 | 4 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1601-1616] [src:kong/relaunch-client-defs] [H] |
| barn | `barn_column_1` | 1 | concrete | 150 | no | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1595] [src:kong/relaunch-client-defs] [H] |
| barn | `barn_wall_int_2`, `barn_wall_int_2_5`, `barn_wall_int_4`, `barn_wall_int_5` … (+5) | 9 | wood | 150 | yes | 10 | 9 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1541-1589] [src:kong/relaunch-client-defs] [H] |
| bathhouse | `bathhouse_column_1`, `bathhouse_column_2` | 2 | concrete | 150 | no | 10 | 2 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2221-2227] [src:kong/relaunch-client-defs] [H] |
| brick | `brick_wall_ext_3_0_low` | 1 | low wall (no material) | 100 | no | 0.2 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2299] [src:kong/relaunch-client-defs] [H] |
| brick | `brick_wall_ext_1`, `brick_wall_ext_2`, `brick_wall_ext_3`, `brick_wall_ext_4` … (+31) | 35 | brick | 150 | no | 10 | 35 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:876-2309] [src:kong/relaunch-client-defs] [H] |
| brick | `brick_wall_ext_short_7` | 1 | brick | 150 | no | 0.5 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:976] [src:kong/relaunch-client-defs] [H] |
| bridge_lg_under | `bridge_lg_under_column` | 1 | concrete | 150 | no | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2233] [src:kong/relaunch-client-defs] [H] |
| bridge_rail | `bridge_rail_3`, `bridge_rail_12`, `bridge_rail_20`, `bridge_rail_28` | 4 | low wall (no material) | 100 | no | 0.2 | 4 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2241-2289] [src:kong/relaunch-client-defs] [H] |
| bridge_xlg_under | `bridge_xlg_under_column` | 1 | concrete | 150 | no | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2271] [src:kong/relaunch-client-defs] [H] |
| cabin | `cabin_wall_int_5`, `cabin_wall_int_10`, `cabin_wall_int_13` | 3 | wood | 150 | yes | 10 | 3 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1883-1895] [src:kong/relaunch-client-defs] [H] |
| club | `club_wall_int_6`, `club_wall_int_10` | 2 | wood | 150 | yes | 10 | 2 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2179-2185] [src:kong/relaunch-client-defs] [H] |
| club_bar | `club_bar_small`, `club_bar_large`, `club_bar_back_large` | 3 | low wall (no material) | 100 | no | 0.2 | 3 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2191-2211] [src:kong/relaunch-client-defs] [H] |
| club_window | `club_window_broken_01` | 1 | low wall (no material) | 100 | no | 0.2 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:620] [src:kong/relaunch-client-defs] [H] |
| cobalt | `cobalt_wall_int_4` | 1 | cobalt | 150 | no | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:782] [src:kong/relaunch-client-defs] [H] |
| concrete | `concrete_wall_ext_thin_6`, `concrete_wall_ext_1_5`, `concrete_wall_ext_2`, `concrete_wall_ext_3` … (+48) | 52 | concrete | 150 | no | 10 | 50 orig / 2 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1017-2275] [src:kong/relaunch-client-defs] [H] |
| container | `container_05_collider`, `container_wall_top`, `container_wall_side`, `container_wall_side_open` | 4 | metal | 150 | no | 10 | 4 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:665-2321] [src:kong/relaunch-client-defs] [H] |
| glass | `glass_wall_9` | 1 | glass | 100 | yes | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1499] [src:kong/relaunch-client-defs] [H] |
| glass | `glass_wall_10`, `glass_wall_12` | 2 | glass | 50 | yes | 10 | 2 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1505-1511] [src:kong/relaunch-client-defs] [H] |
| glass | `glass_wall_12_2` | 1 | glass | 5000 | yes | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1517] [src:kong/relaunch-client-defs] [H] |
| glass | `glass_wall_13` | 1 | glass | 75 | yes | 10 | 1 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1523] [H] |
| glass | `glass_wall_1x19`, `glass_wall_1x23` | 2 | glass | 150 | yes | 10 | 2 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1529-1535] [H] |
| grassy | `grassy_wall_3`, `grassy_wall_8` | 2 | wood | 300 | yes | 10 | 2 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2147-2163] [src:kong/relaunch-client-defs] [H] |
| hedgehog | `hedgehog_wall` | 1 | metal | 150 | no | 0.5 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:669] [src:kong/relaunch-client-defs] [H] |
| house | `house_column_1` | 1 | concrete | 150 | no | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1877] [src:kong/relaunch-client-defs] [H] |
| house | `house_wall_int_4`, `house_wall_int_5`, `house_wall_int_8`, `house_wall_int_9` … (+2) | 6 | wood | 150 | yes | 10 | 6 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1841-1871] [src:kong/relaunch-client-defs] [H] |
| house_window | `house_window_broken_01` | 1 | low wall (no material) | 100 | no | 0.2 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:589] [src:kong/relaunch-client-defs] [H] |
| hut | `hut_wall_int_4`, `hut_wall_int_5`, `hut_wall_int_6`, `hut_wall_int_7` … (+3) | 7 | wood | 150 | yes | 10 | 5 orig / 2 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:675-711] [src:kong/relaunch-client-defs] [H] |
| hut_window | `hut_window_open_01` | 1 | low wall (no material) | 100 | no | 0.2 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:717] [src:kong/relaunch-client-defs] [H] |
| lab_window | `lab_window_broken_01` | 1 | low wall (no material) | 100 | no | 0.2 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:594] [src:kong/relaunch-client-defs] [H] |
| mansion | `mansion_column_1` | 1 | concrete | 150 | no | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1961] [src:kong/relaunch-client-defs] [H] |
| mansion | `mansion_wall_int_1`, `mansion_wall_int_5`, `mansion_wall_int_6`, `mansion_wall_int_7` … (+6) | 10 | wood | 150 | yes | 10 | 10 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1901-1955] [src:kong/relaunch-client-defs] [H] |
| metal | `metal_wall_ext_2x2`, `metal_wall_ext_2`, `metal_wall_ext_3`, `metal_wall_ext_4` … (+66) | 70 | metal | 150 | no | 10 | 20 fork / 50 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1217-2022] [src:kong/relaunch-client-defs] [H] |
| metal | `metal_wall_ext_short_6`, `metal_wall_ext_short_7` | 2 | metal | 150 | no | 0.5 | 2 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1289-1294] [src:kong/relaunch-client-defs] [H] |
| outhouse | `outhouse_wall_top`, `outhouse_wall_side`, `outhouse_wall_bot` | 3 | wood | 100 | yes | 10 | 3 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:849-867] [src:kong/relaunch-client-defs] [H] |
| police | `police_wall_int_2`, `police_wall_int_3`, `police_wall_int_4`, `police_wall_int_6` … (+3) | 7 | wood | 150 | yes | 10 | 7 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1806-1836] [src:kong/relaunch-client-defs] [H] |
| rail | `rail_4` | 1 | low wall (no material) | 100 | no | 0.2 | 1 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2251] [H] |
| reserve | `reserve_wall_int_3`, `reserve_wall_int_4` | 2 | wood | 100 | yes | 10 | 2 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1721-1727] [H] |
| reserve | `reserve_wall_int_5`, `reserve_wall_int_6`, `reserve_wall_int_8`, `reserve_wall_int_9` … (+1) | 5 | wood | 150 | yes | 10 | 5 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1733-1753] [H] |
| reserve | `reserve_wall_int_12` | 1 | wood | 125 | yes | 10 | 1 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1758] [H] |
| reserve | `reserve_wall_int_13`, `reserve_wall_int_16` | 2 | wood | 200 | yes | 10 | 2 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1764-1770] [H] |
| reserve | `reserve_perm_wall_ext_1`, `reserve_perm_wall_ext_2`, `reserve_perm_wall_ext_4`, `reserve_perm_wall_ext_6` … (+16) | 20 | woodPerm | 150 | no | 10 | 20 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1621-1716] [H] |
| reserve_bar | `reserve_bar_small`, `reserve_bar_large`, `reserve_bar_back` | 3 | low wall (no material) | 100 | no | 0.2 | 3 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1776-1796] [H] |
| reserve_window | `reserve_window_broken_01` | 1 | low wall (no material) | 100 | no | 0.2 | 1 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:655] [H] |
| saloon | `saloon_column_1` | 1 | woodPerm | 150 | no | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1967] [src:kong/relaunch-client-defs] [H] |
| saloon_bar | `saloon_bar_small`, `saloon_bar_large`, `saloon_bar_back_large`, `saloon_bar_back_small` | 4 | low wall (no material) | 100 | no | 0.2 | 4 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1973-2003] [src:kong/relaunch-client-defs] [H] |
| shack | `shack_wall_top`, `shack_wall_side_left`, `shack_wall_side_right`, `shack_wall_bot` … (+5) | 9 | wood | 150 | yes | 10 | 9 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:795-843] [src:kong/relaunch-client-defs] [H] |
| stone | `stone_wall_int_4` | 1 | stone | 150 | yes | 10 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2013] [src:kong/relaunch-client-defs] [H] |
| teahouse | `teahouse_wall_int_3`, `teahouse_wall_int_4`, `teahouse_wall_int_5`, `teahouse_wall_int_7` … (+4) | 8 | wood | 150 | yes | 10 | 8 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2096-2138] [src:kong/relaunch-client-defs] [H] |
| teahouse_window | `teahouse_window_open_01` | 1 | low wall (no material) | 100 | no | 0.2 | 1 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2144] [src:kong/relaunch-client-defs] [H] |
| warehouse | `warehouse_wall_side`, `warehouse_wall_edge`, `warehouse_wall_edge_2`, `warehouse_wall_int` … (+1) | 5 | metal | 150 | no | 10 | 2 orig / 3 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:718-734] [src:kong/relaunch-client-defs] [H] |
| wood | `wood_perm_wall_ext_5`, `wood_perm_wall_ext_6`, `wood_perm_wall_ext_7`, `wood_perm_wall_ext_14` … (+10) | 14 | woodPerm | 150 | no | 10 | 14 orig | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2026-2091] [src:kong/relaunch-client-defs] [H] |
| workshop | `workshop_wall_bot`, `workshop_wall_room_1`, `workshop_wall_room_2`, `workshop_wall_room_3` … (+2) | 6 | brick | 150 | no | 10 | 6 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:758-778] [H] |
| workshop | `workshop_wall_right`, `workshop_wall_edge`, `workshop_wall_mid_1`, `workshop_wall_mid_2` … (+1) | 5 | metal | 150 | no | 10 | 5 fork | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:738-754] [H] |

## Family notes

### Natural obstacles

- `barrel_01b` is the barrel cache (Tier Surviv 2–3 + 3 MIRVs, matching fandom's "3 MIRV Grenades and 2 Tier Surviv items"); `barrel_01w`, `barrel_01bh`, `barrel_01f` are fork cache variants and `barrel_01bd` is a fork non-exploding barrel for Birthday [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:456-496] [src:fandom/Barrel] [src:balance/155-166] [H]
- Barrels smoke below 50 % health (75 HP for a 150-HP barrel) [src:survev/client/src/objects/obstacle.ts:258-269] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:455] [H]
- Wood barrels are furniture: `barrel_02` 60 HP (Tier World), wall barrels `barrel_03` 20 HP and `barrel_04` (gold, Tier Soviet 2–3); `barrel_05` coconut barrel is fork [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:653-673] [src:fandom/Wood_Barrel] [H]
- Bush variants: `bush_04` river bush (lily pad) spawns in rivers and on river shores, `bush_05` tumbleweed (desert), `bush_06` leaf pile (radius 1.75, the bush of the `cache_03` leaf-pile cache), `bush_07` berry bush (the bush of `cache_06`), `bush_03` lotus flower, `brush_01sv/02sv` savannah large brush (150 HP, scale 1.5–1.75) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:531-680] [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:350-363] [src:survev/shared/defs/mapObjects/buildings/cacheDefs.ts:452-465] [src:fandom/Bush] [H]
- Bush and leaf-pile caches pair the bush with a `loot_tier_leaf_pile` loot spawner underneath; stone, tree and barrel caches pair a loot-dropping obstacle with the `decal_initiative_01` decal [src:derived/cache-dump] [src:fandom/Cache] [H]
- Tree variants: `tree_01` normal (sprite `map-tree-03`), `tree_03` mosin tree cache (Tier Surviv 2–3 + Mosin-Nagant), `tree_02` wood-axe stump (120 HP, height 0.5, drops a wood axe), `tree_09` plain stump (120 HP, height 0.5), `tree_05` withered tree (400 HP, r2.3), `tree_05b` withered tree cache (shotgun + LMG + spooky tree outfit), `tree_05c` desert withered tree, `tree_06` desert tree, `tree_07/08` woods yellow-green / orange trees (175 / 225 HP), `tree_08b` large orange (300 HP), `tree_08c` logging giant oak cache (500 HP, shotguns 2–3, LMGs 2–3, Woodland outfit), `tree_08f` faction tree (200 HP), `tree_10/11` snow and festive trees, `tree_12` acacia, `tree_13` palm [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1121-1537] [src:fandom/Tree] [src:fandom/Stump] [src:fandom/Withered_Tree] [H]
- Tree stumps (`tree_02`, `tree_09`) are only 0.5 high, so bullets (height 0.25) still hit them but grenades fly over [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1160] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1482] [src:survev/server/src/game/objects/projectile.ts:281] [H]
- Stone variants: `stone_01` (250 HP), `stone_02` stone cache (AK-47 + Tier Surviv 2–3), `stone_03` river stone (500 HP, r2.9), `stone_04` hardstone block (stonePlated, Tier Eye Block), `stone_05` hardstone boulder (desert, stonePlated, Tier Eye Stone), `stone_06` bridge column (stonePlated, height 10), `stone_07` savannah stone (500 HP, r7.75 like a silo), `stone_08` river-stone cache (fork) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:883-1108] [src:fandom/Stone] [src:fandom/Hardstone_Block] [src:fandom/Bridge_Column] [src:fandom/Savannah_Stone] [H]
- Statues: `statue_01` faction statue base (indestructible), `statue_top_01/02` red/blue statue tops (500 HP), `statue_03/04` aged faction statues (500 HP, stonePlated; fandom: broken by stone hammer, air drops or air strikes) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:811-882] [src:fandom/Faction_Statue] [src:fandom/Aged_Faction_Statue] [H]
- `silo_01`: indestructible, r7.75, height 10, reflects; `silo_01po` (silo shack): 2500 HP, drops the Spud Gun (`potato_smg`) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:800-810] [src:changelog/0.8.82] [src:wikigg/Silo_Shack] [H]
- Potatoes (`potato_01–03`): 100 HP, not on the minimap, Tier Potato Perks ×1, regrow after 60 s, swap the breaker's weapon; fandom: "Regrows in 60 seconds" [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:688-704] [src:fandom/Potato_(Obstacle)] [H]
- Eggs (`egg_01–04`, 80 HP, Tier Egg Outfits) are fork re-creations; the original seasonal egg existed only between 0.3.2 and 0.3.21 [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:725-740] [src:changelog/0.3.2] [src:changelog/0.3.21] [src:fandom/Egg/Before_Eggsplosion] [H]
- Pumpkins: `pumpkin_01` (100 HP: outfit + candy), `pumpkin_02` jack-o'-lantern (140 HP: guns 1–2, candy 1–2, outfit), `pumpkin_03` red pumptato (perk + fruit XP); squash `squash_01` drops a Turkey Shoot and (orig) fruit XP [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:742-794] [src:changelog/0.8.7] [src:kong/relaunch-client-defs] [H]

### Crates, cases and airdrops

- Crate ids by wiki name: `crate_01` crate, `crate_02` Soviet crate, `crate_03` grenade crate, `crate_04`/`crate_06` ammo crates (armor-plated, need an armor-piercing melee such as the wood axe), `crate_05` gold crate (indestructible), `crate_07` bunker crate, `crate_08` bunker crate, `crate_09` conch crate, `crate_10/11` meteor crates (airdrop contents), `crate_12/13` military airdrop contents, `crate_14` bottle crate, `crate_15/16` knife crates, `crate_18` cattle crate, `crate_19` hatchet crate, `crate_20` crab pot, `crate_21` cloud crate, `crate_22` Initiative crate [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:381-1007] [src:fandom/Crates] [src:changelog/0.5.0] [H]
- Fandom lists ammo crates as single (police station 4, blue warehouses 4, crossing bunker 2) and double (warehouses 4, storm bunker 2, club vault 2) [src:fandom/Ammo_Crate] [M]
- Air drops land as `airdrop_crate_0X` (indestructible, reflect bullets); "Unlock" (2.5 s) turns them into their `destroyType`: 01 → crate_10, 02 → crate_11, 03 (8 × 8, 50v50) → crate_12, 04 → crate_13, Savannah/Desert/Halloween/Turkey/Snow variants map to their own crates [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1008-1208] [H]
- Class shells: `class_shell_01` (common, smartLoot) → `class_crate_common_<role>`, `class_shell_02` (rare, smartLoot, airdrop) → `class_crate_rare_<role>`, `class_shell_03` → `class_crate_mythic` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1209-1258] [src:fandom/Class_Pod] [H]
- Military crates: `mil_crate_01` knife crate, `mil_crate_02` OT-38 crate (4 OT-38s), `mil_crate_03` Arctic Avenger crate (dual OTs-38), `mil_crate_04` (gun + throwables), `mil_crate_05` marksman military crate (Savannah, guns 1–2 + snipers 1–2) [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1422-1472] [src:fandom/Crates] [H]
- `chest_01` treasure chest, `chest_02` (Tier Chest ×2), `chest_03` river chest (river terrain, Tier Chest 3–5 + Water Elemental outfit), `chest_04` golden eye chest (200 HP) [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:315-380] [src:fandom/Treasure_Chest] [src:fandom/River_Chest] [src:fandom/Golden_Eye_Chest] [H]
- Cases: `case_01/02` DEagle cases, `case_03` hatchet case, `case_04` flare gun case, `case_05` meteor case, `case_06` chrysanthemum case, `case_07` red emblem case [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194-258] [src:fandom/Crates] [H]

### Furniture and interactables

- Lockers (`locker_01–03`) and deposit boxes (`deposit_box_01–03`) have only 20 HP but are 10 high and reflect bullets [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:846-950] [src:fandom/Locker] [src:fandom/Deposit_Box] [H]
- Tables (`table_01–03`) are not collidable: players and bullets pass, but they still take damage [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1178-1231] [src:fandom/Obstacles] [H]
- Indestructible furniture: refrigerators, piano, vat_02 (big vat), wheels, grill/oven are destructible but explode (`explosion_barrel`), stoves explode with `explosion_stove` and damage the ceiling [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:954-1162] [H]
- Control panels: `control_panel_01` opens `cell_door_01` after 1.1 s (police station), `control_panel_04` opens `crossing_door_01` after 4.25 s (crossing bunker); both explode when destroyed [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:276-331] [src:fandom/Control_Panel] [H]
- `switch_01/03` and colored bottles `bottle_02r/o/y/g/b/i/v` are puzzle pieces (club vault switches, saloon bottle code); recorders `recorder_01–14` play audio logs; `tree_switch_01–03` are puzzle trees (see `puzzles.md`) [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:385-539] [src:fandom/Switch] [src:fandom/Recorder] [src:fandom/Tree_Switch] [H]
- Doors: interaction radius 0.75 (2 for sliding lab/teahouse doors, 1.5 for vaults); `interactCooldown` 0.1 s after a player toggle; auto-open doors only react to proximity; vault doors wait `openDelay` 4.1 s; `openOneWay` forces the swing side; `openOnce` disables the door after one use [src:survev/server/src/game/objects/obstacle.ts:704-749] [src:survev/server/src/game/objects/obstacle.ts:814-857] [H]
- Sliding doors move `slideOffset` along their axis; swinging doors rotate a quarter turn away from the player (or `useDir` / `openOneWay`) [src:survev/server/src/game/objects/obstacle.ts:825-848] [H]
- Doors on stairs switch to layer 2/3 so they can be used from both levels (`saloon_door_secret` and `house_door_01` are excluded) [src:survev/server/src/game/objects/obstacle.ts:434-456] [H]
- Buttons: toggling a button sends a delayed `toggle/open/close` (and optional lock/unlock) to every door of type `useType` in the same building; `useExpiration` restores the doors later; `destroyOnUse` kills the button after `useDelay` (airdrops) [src:survev/server/src/game/objects/obstacle.ts:756-806] [H]
- Scheduled unlocks (Cobalt twins bunker) call `unlock()`, which interacts automatically and pings `ping_unlock` on the map [src:survev/server/src/game/objects/obstacle.ts:751-754] [src:survev/server/src/game/map.ts:458-486] [H]
- Changelog 0.7.1: downed players can use obstacles (open doors, press buttons) [src:changelog/0.7.1] [H]

### Windows, walls and stairs

- `house_window_01` / `lab_window_01`: 1 HP, become a 0.2-high indestructible broken-window low wall that blocks movement but not bullets (bullets ignore obstacles below 0.25) [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:587-594] [src:survev/server/src/game/objects/bullet.ts:300] [src:changelog/0.2.6] [H]
- `club_window_01` (boarded window, 1 HP, not flagged isWindow) → `club_window_broken_01`; `bank_window_01` has 75 HP and no broken state [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:605-649] [src:fandom/Boarded_Window] [H]
- `glass_wall_12_2` is the 5000-HP bulletproof glass of the Hatchet bunker [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1517] [src:fandom/Obstacles] [H]
- `stone_wall_int_4` uses the stone material (stonePlated), the wall fandom says only a stone hammer or sledgehammer breaks (Eye bunker, Chrysanthemum bunker, Alternate Barn) [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2013] [src:fandom/Obstacles] [H]
- `grassy_wall_3/8` (savannah grass-covered wall) have 300 HP; outhouse walls 100 HP [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:849-867] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:2147-2163] [H]
- Huts and outhouses lose their roof after 2 walls are broken (wiki.gg) [src:wikigg/Classic_mode] [M]
- `stairs_01` broken stairs: 100 HP, not collidable (mansion) [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:595] [src:fandom/Broken_Stairs] [H]

## Fork changes to original obstacles

> Gameplay-relevant differences between the original v0.8.82 defs and survev for ids that exist in both (from `data/live-vs-survev.json`; sprite, particle and sound differences omitted). Revert these for 0.8.82.

| id | original (0.8.82) | survev | sources |
|---|---|---|---|
| `tree_13` (palm) | scale 0.8–1, destroy 0.5, circle r1.55, grass terrain | scale 1.15–1.3, destroy 0.75, r1, beach terrain, random rotation (fork palm-tree rework) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1537] [src:balance/209] [H] |
| `tree_12` (acacia) | canopy `aabb` ±5.75 | ±11 | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1526] [H] |
| `squash_01` | circle r1.25, loot Turkey Shoot + `tier_fruit_xp`×1, hidden from minimap | r1, Turkey Shoot + `tier_world`×0–1, on minimap | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763] [H] |
| `stone_02`, `stone_02sv`, `tree_03`, `tree_03sv` (caches) | shown on the minimap | hidden | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:911] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1190] [H] |
| `crate_06`, `woodpile_02` | hidden from the minimap | shown | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:494] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1615] [H] |
| `case_02` | 2 × `deagle` | 1 × `deagle_dual`, preloaded (`case_01` also preloaded) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194-198] [H] |
| `chest_01` | Tier Chest 3–4, pirate melee, `outfitRoyalFortune` | `tier_pirate_outfits` instead of the fixed outfit | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:315] [H] |
| `crate_02sv`, `crate_02sv_lake` | no medical drop; `crate_02sv_lake` has `terrain.lakeCenter` | + `tier_medical`×1 ("Gold Crate: Now drop 1 item from Tier Medical") | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391-409] [src:balance/224] [H] |
| `crate_02f`, `crate_22` | no preload, no spacing | preloaded guns, `minDistanceFromSameType` 32, `teamId` 1 / 2 | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:418] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:978] [H] |
| `crate_03` | Tier Throwables 2–4 | + `tier_fragtastic`×1 (fork outfit) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:448] [H] |
| `crate_11sv` | `tier_airdrop_armor`×1 | `backpack04_cloud` (fork item) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:678] [H] |
| `crate_12` | uncommon 4–6, armor 4–5, scopes 6–8, melee 5–7, + `tier_katanas`×1 | uncommon 7–8, armor 5–6, scopes 7–8, melee 6–7, no katana roll | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741] [src:balance/263-268] [H] |
| `crate_13` | mythic 3–4, rare 3–4, armor 6–8, medical 12–15, scopes 6–8, faction outfits 1–2, faction melee 3–4, ammo 10–12, throwables 6–8, katanas 1, 3 strobes | rare 5, scopes 7–8, + airdrop melee 2–3, faction melee 3, no katana roll | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813] [src:balance/270-274] [H] |
| `class_crate_common_scout` | 3 sodas | 2 sodas | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1259] [src:balance/303] [H] |
| `class_crate_common_demo` | gun, katana, helmet01, backpack02, 6 MIRVs | + chest01 and 2× scope; `tier_throwables_demo` 3–4 instead of the MIRVs | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1291] [src:balance/293] [src:balance/304-305] [H] |
| `class_crate_common_assault` | 2 guns, spade, helmet01, backpack01 | + 5 bandages, chest01 | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1303] [src:balance/306-307] [H] |
| `class_crate_common_healer` | fixed `healthkit` | `tier_health_healer` | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1279] [src:balance/323-324] [H] |
| `class_crate_rare_demo` | `tier_airdrop_throwables`×1 | `tier_throwables_demo`×4–5 | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1370] [src:balance/295] [H] |
| `class_shell_01` | `airdropCrate: true` | false, `minDistanceFromSameType` 32 | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1209] [H] |
| `mil_crate_03` | dual OTs-38 only | + Spetsnaz outfit | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1445] [H] |
| `locker_03` | AK-47, backpack02 | + `tier_khaki_outfit` | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:946] [H] |
| `control_panel_06` | box ±2.5×1.2 | ±3×1.4 | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:332] [H] |
| `switch_01` | 250 HP, explodes (`explosion_barrel`) | 100 HP, no explosion | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:385] [H] |
| `cobalt_wall_int_4` | no explosion | `explosion_cobalt` (fork) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:782] [H] |
| `metal_wall_ext_thicker_28` | box ±1.5×14.5 | ±1.5×14 | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1435] [H] |
| `vault_door_chrys_01` | `canUse: true` | false (opened by the puzzle) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:402] [H] |

- survev-only obstacle groups (fork): Reserve walls/windows/vault door (desert, 0.3.1), workshop walls (woods, 0.2.2), beach objects (palms `tree_13bh`/`tree_14`, coconut barrel, hut walls), Birthday barrel, Turkey re-skins, Savannah `stone_03sv`/`chest_03sv`, potato-vs-tomato crops and crates, eggs, safes, sinks, racks, extra tables, chairs, buttons, `toilet_05`, `stone_08` river cache, extra metal/glass/concrete walls [src:derived/fork-vs-original-json] [H]

## Spawn counts

> Map-level counts come from the map defs; see `generation.md` for the density formula and per-map tables.

- Main (survev, density): stone_01 350, tree_01 320, bush_01 78, barrel_01 76, crate_01 50, tree_13 30 (fork), hedgehog_01 24, cache_06 12, silo_01 8, crate_03 8, crate_02 4 per 250 000 shore area (≈ ×1.56 on a 720 map); fixed: stone_04 1, tree_02 3, chest_01 1, chest_03 odds 0.2, mil_crate_02 odds 0.25 [src:survev/shared/defs/maps/baseDefs.ts:889-947] [H]
- River obstacles: `stone_03` 0.9 and `bush_04` 0.4 per 1000 water area, max 30 each per river [src:survev/server/src/game/map.ts:1066-1088] [H]
- Fandom infobox quantities (Normal map): silo 10, treasure chest 1, hardstone block 1, river chest 1, grenade box 35, snowball crate 35 (snow) [src:fandom/Silo] [src:fandom/Treasure_Chest] [src:fandom/Hardstone_Block] [src:fandom/River_Chest] [src:fandom/Grenade_Box] [src:fandom/Snowball_Crate] [M]

## Conflicts

- CONFLICT barrel-smoke-threshold: fandom "At around 30 health, barrels begin smoking" [src:fandom/Barrel] vs client smoke below healthT 0.5 (75 HP of 150) [src:survev/client/src/objects/obstacle.ts:258-269]; proposed: 50 % (client code) [M]
- CONFLICT soviet-crate-hp: fandom 120 HP for `crate_02`/`crate_02f` [src:fandom/Soviet_Crate] vs 140 in the original defs [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383]; proposed: 140 [H]
- CONFLICT river-chest-hp: fandom 120 HP [src:fandom/River_Chest] vs 140 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:330]; proposed: 140 [H]
- CONFLICT hatchet-crate-hp: fandom 120 HP for `crate_19` [src:fandom/Hatchet_Crate] vs 140 [src:kong/relaunch-client-defs]; proposed: 140 [H]
- CONFLICT chrys-case-hp: fandom 120 HP for `case_06` [src:fandom/Chrysanthemum_Chest] vs 140 [src:kong/relaunch-client-defs]; proposed: 140 [H]
- CONFLICT deagle-case-hp: fandom 140 / 120 HP for `case_01` / `case_02` [src:fandom/DEagle_Case] vs 75 for both [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194-195]; proposed: 75 [H]
- CONFLICT round-stove-hp: fandom 500 HP for `stove_02` [src:fandom/Stove] vs 400 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1162]; proposed: 400 [H]
- CONFLICT military-airdrop-hp: fandom 500 HP for `airdrop_crate_03/04` and `crate_13` [src:fandom/Military_Air_Drop] [src:fandom/Meteor_Crate] vs 200 [src:kong/relaunch-client-defs]; proposed: 200 (airdrops are indestructible anyway) [H]
- CONFLICT log-pile-hp: fandom 150 HP for `woodpile_02` [src:fandom/Log_Pile] vs 400 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1615]; proposed: 400 [H]
- CONFLICT planter-hp: fandom 75 HP [src:fandom/Planter] vs 100 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:988]; proposed: 100 [H]
- CONFLICT bottle-hp: fandom and wiki.gg 20 HP for `bottle_01` [src:fandom/Bottle] [src:wikigg/Bottles] vs 12 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:751]; proposed: 12 [H]
- CONFLICT bookshelf-hp: wiki.gg 80 HP [src:wikigg/Bookshelf] vs 75 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:698]; proposed: 75 [H]
- CONFLICT summer-tree-hp: fandom 175 HP for `tree_08su` [src:fandom/Tree] vs 225 [src:kong/relaunch-client-defs]; proposed: 225 [H]
- CONFLICT oven-height: fandom height 5 [src:fandom/Oven] vs 0.5 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:954]; proposed: 0.5 [H]
- CONFLICT reflect-flags: fandom says pumpkins and the faction statue base reflect bullets and switches do not [src:fandom/Pumpkin] [src:fandom/Faction_Statue] [src:fandom/Switch] vs the opposite in the original defs [src:kong/relaunch-client-defs]; proposed: trust the defs [H]
- CONFLICT stone-cache-collide: fandom marks `stone_02` and bottle switches non-collidable [src:fandom/Stone] [src:fandom/Bottle] vs collidable in the defs [src:kong/relaunch-client-defs]; proposed: trust the defs [H]
- CONFLICT switch-01-fork: original `switch_01` 250 HP and explodes [src:kong/relaunch-client-defs] vs survev 100 HP, no explosion [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:385]; proposed: original values [H]
- CONFLICT tree-13-palm: original palm tree is a grass tree like `tree_01` [src:kong/relaunch-client-defs] vs survev beach palm with smaller collision [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1537]; proposed: original values [H]
- CONFLICT cache-minimap: original shows stone and tree caches on the minimap [src:kong/relaunch-client-defs] vs survev hides them [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:911]; fandom says caches are easy to spot because they look the same on every map [src:fandom/Cache]; proposed: original (shown) [M]

## Open questions

- What the original `tire_01` (1500 HP) was used for; no original map def or building references it in survev [src:kong/relaunch-client-defs] [L]
- Whether original airdrops and class shells used `smartLoot` ownership exactly as survev implements (8-unit owner radius) [src:survev/server/src/game/objects/obstacle.ts:586-606] [L]
- Exact original loot tier contents behind obstacle loot (survev's loot tables are reconstructions, see `mechanics/loot`) [src:survev/shared/defs/maps/baseDefs.ts:90-92] [L]
- Original `house_door_06` and `glass_wall_18` users (buildings that were removed before survev's import) [src:kong/relaunch-client-defs] [L]
