# Movement

> Player movement speed, its modifiers and the per-tick position update, traced through survev `server/src/game/objects/player.ts` (`update`, `recalculateSpeed`) and `shared/gameConfig.ts`, cross-checked against fandom, wiki.gg and namu.
> Most `GameConfig.player` speed constants (`moveSpeed`, `waterSpeedPenalty`, `cookSpeedPenalty`, `frozenSpeedPenalty`, `boostMoveSpeed`, `hasteSpeedBonus`, `downedMoveSpeed`, `downedRezMoveSpeed`) are server-only. The original client config (survev first commit `9f64948d`, cited `derived/survev@9f64948d:<path>:<lines>`) and the 2026 relaunch client bundle (`kong/relaunch-client-bundle`, `research-cache/live/app.e5465b46.js`) do not contain them. survev added them in commit `f96f88cd` (2024-03-29), so treat them as survev reconstructions that wikis corroborate.
> Units are world units per second (u/s). The player radius is 1 u. The server ticks at 100 Hz.

## Constants

| constant | value | in original client config? | sources |
|---|---|---|---|
| `moveSpeed` (base) | 12 | no (server-only) | [src:survev/shared/gameConfig.ts:201] [src:fandom/Player] [src:wikigg/Adrenaline] [H] |
| `waterSpeedPenalty` | −3 | no | [src:survev/shared/gameConfig.ts:202] [src:fandom/Player] [src:fandom/One_With_Nature] [H] |
| `cookSpeedPenalty` (cooking a throwable) | −3 | no | [src:survev/shared/gameConfig.ts:203] [src:fandom/Player] [H] |
| `frozenSpeedPenalty` (snowball/potato hit) | −3 | no | [src:survev/shared/gameConfig.ts:204] [M] |
| `boostMoveSpeed` (boost ≥ 50) | +1.85 | no | [src:survev/shared/gameConfig.ts:194] [src:fandom/Adrenaline] [src:wikigg/Adrenaline] [H] |
| `hasteSpeedBonus` (Windwalk / Takedown / Inspire) | +4.8 | no (`HasteType` enum is) | [src:survev/shared/gameConfig.ts:205] [src:wikigg/Windwalk] [src:wikigg/Takedown] [src:fandom/Inspiration] [H] |
| `downedMoveSpeed` | 4 | no | [src:survev/shared/gameConfig.ts:207] [src:fandom/Player] [H] |
| `downedRezMoveSpeed` (downed and being revived) | 2 | no | [src:survev/shared/gameConfig.ts:208] [src:fandom/Player] [H] |
| reviver speed | `downedMoveSpeed + 2` = 6, marked in code "not specified in game config so i just estimated" | no | [src:survev/server/src/game/objects/player.ts:4693-4697] [L] |
| `radius` | 1 | yes | [src:survev/shared/gameConfig.ts:187] [src:derived/survev@9f64948d:src/gameConfig.ts:118] [src:kong/relaunch-client-bundle] [H] |
| `crawlTime` (downed crawl animation) | 0.75 s | yes | [src:survev/shared/gameConfig.ts:213] [src:derived/survev@9f64948d:src/gameConfig.ts:129] [src:kong/relaunch-client-bundle] [H] |
| `HasteType` | None 0, Windwalk 1, Takedown 2, Inspire 3 | yes | [src:survev/shared/gameConfig.ts:49-55] [src:derived/survev@9f64948d:src/gameConfig.ts:106-111] [H] |
| server tick / net sync rate | `gameTps` 100, `netSyncTps` 33 (survev config) | n/a | [src:survev/config.ts:40-41] [M] |

## Speed formula (`recalculateSpeed`)

> The order below matters because one multiplier (×0.5) is applied after all the additive terms. Code: `server/src/game/objects/player.ts:4690-4766`.

1. Base: reviving a teammate 6 (estimate); being revived or self-reviving while downed 2; downed 4; otherwise 12. A debug override replaces the base [src:survev/server/src/game/objects/player.ts:4691-4706] [H]
2. `+ weaponDef.speed.equip` of the active weapon, but only while no melee hit is pending (`meleeAttacks.length == 0`). With `small_arms`, a gun's equip value becomes 1 [src:survev/server/src/game/objects/player.ts:4708-4720] [src:survev/shared/defs/gameObjects/perkDefs.ts:33-36] [H]
3. `+ weaponDef.speed.attack` while `shotSlowdownTimer > 0` (set to the gun's `fireDelay` on every shot) [src:survev/server/src/game/objects/player.ts:4722-4724] [src:survev/server/src/game/weaponManager.ts:741] [H]
4. In water: `−3`, or `+2` with `tree_climbing` (One With Nature) [src:survev/server/src/game/objects/player.ts:4726-4732] [src:survev/shared/defs/gameObjects/perkDefs.ts:102-104] [src:fandom/One_With_Nature] [H]
5. `+1.85` when boost ≥ 50 [src:survev/server/src/game/objects/player.ts:4734-4737] [H]
6. `−3` while the Cook animation plays (holding a cooked grenade) [src:survev/server/src/game/objects/player.ts:4739-4741] [H]
7. `+4.8` while any haste is active (they do not stack) [src:survev/server/src/game/objects/player.ts:4743-4745] [src:fandom/Last_Breath] [H]
8. `−3` while frozen [src:survev/server/src/game/objects/player.ts:4747-4749] [M]
9. `× 0.5` while `shotSlowdownTimer > 0`, or while using a heal/boost item without `field_medic` [src:survev/server/src/game/objects/player.ts:4751-4759] [src:fandom/Consumables] [src:fandom/Health] [H]
10. `+1` (`field_medic.speedBoost`) while using an item with Combat Medic (fork value; it was 1.5 before fork commit `39a6c829` and 0 before `5379cc72`) [src:survev/server/src/game/objects/player.ts:4761-4763] [src:survev/shared/defs/gameObjects/perkDefs.ts:94-96] [src:wikigg/Combat_Medic] [M]
11. Clamp to [1, 10000] [src:survev/server/src/game/objects/player.ts:4765] [H]

- Speed is recomputed only on ticks with movement input; with no input, speed is 0 and the collision loop runs once [src:survev/server/src/game/objects/player.ts:1952-1964] [H]
- History of the ×0.5 rule: survev first used a flat −6 for item use and shooting, then switched to ×0.5 in commit `aa28f360` ("more accurate(?) player speed", 2024-07-10) [src:derived/survev-git-aa28f360] [L]
- Original changelog: "Move faster without a weapon" (0.0.6); "Decreased move speed penalty when using items" (0.0.95); "Slightly lowered adrenaline duration and move speed bonus" (0.4.1, and again in 0.4.3) [src:changelog/0.0.6] [src:changelog/0.0.95] [src:changelog/0.4.1] [src:changelog/0.4.3] [H]

## Per-weapon modifiers (`speed.equip` / `speed.attack`)

> Every gun not listed has `equip 0, attack 0`; every throwable has `0 / 0`. The values match the original client defs exactly for every weapon that exists in both.

| weapon (id) | equip | attack | original def | sources |
|---|---|---|---|---|
| all melee (`fists`, `karambit`, `bayonet`, `huntsman`, `bowie`, `machete`, `saw`, `woodaxe`, `fireaxe`, `katana`, `naginata`, `stonehammer`, `hook`, `pan`, `spade`, `crowbar`, `sledgehammer`, `kukri_*`, `bonesaw_*`, `warhammer_tank`, and skins) | +1 | — (unused) | same | [src:survev/shared/defs/gameObjects/meleeDefs.ts:100-102] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:28-30] [src:fandom/Fists] [src:fandom/Player] [H] |
| `knuckles`, `knuckles_rusted`, `knuckles_heroic` | +1 | 0 | same | [src:survev/shared/defs/gameObjects/meleeDefs.ts:138-141] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:67-70] [H] |
| `p30l` (single P30L only; `p30l_dual` 0/0) | +1 | +1 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:2534] [src:derived/survev@9f64948d:src/defs/gunDefs.js:2351] [src:wikigg/Small_Arms] [H] |
| `scout_elite` (Scout Elite) | 0 | +5 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:798] [src:derived/survev@9f64948d:src/defs/gunDefs.js:705] [H] |
| `bar` (BAR M1918) | 0 | −1.5 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:1188] [src:derived/survev@9f64948d:src/defs/gunDefs.js:1095] [H] |
| `usas` (USAS-12) | 0 | −1 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:2133] [src:derived/survev@9f64948d:src/defs/gunDefs.js:1943] [H] |
| `dp28` (DP-28), `qbb97` (QBB-97) | 0 | −2 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:1136] [src:survev/shared/defs/gameObjects/gunDefs.ts:744] [src:derived/survev@9f64948d:src/defs/gunDefs.js:1043] [src:derived/survev@9f64948d:src/defs/gunDefs.js:652] [H] |
| `m249` (M249) | 0 | −4 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:692] [src:derived/survev@9f64948d:src/defs/gunDefs.js:602] [H] |
| `pkp` (PKP Pecheneg) | 0 | −5 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:1282] [src:derived/survev@9f64948d:src/defs/gunDefs.js:1142] [H] |
| `potato_cannon` (Potato Cannon) | −3 | 0 | same | [src:survev/shared/defs/gameObjects/gunDefs.ts:3435] [src:derived/survev@9f64948d:src/defs/gunDefs.js:3102] [H] |
| `potato_lmg` (Spud LMG, not in the original defs) | −1.5 | −6 | absent (post-0.8.82) | [src:survev/shared/defs/gameObjects/gunDefs.ts:3553] [src:derived/survev@9f64948d:src/defs/gunDefs.js:1-3250] [M] |
| `imbel` (fork), `spas16` (fork) | 0 | −1 | absent | [src:survev/shared/defs/gameObjects/gunDefs.ts:1235] [src:survev/shared/defs/gameObjects/gunDefs.ts:2035] [H] |
| `barrett` (fork) | −1 | −4 | absent | [src:survev/shared/defs/gameObjects/gunDefs.ts:3174] [H] |
| `sw500` (fork) | +0.5 | 0 | absent | [src:survev/shared/defs/gameObjects/gunDefs.ts:3226] [H] |
| `ash12` (fork) | −1 | 0 | absent | [src:survev/shared/defs/gameObjects/gunDefs.ts:3273] [H] |

- `shotSlowdownTimer` equals the gun's `fireDelay`. Every shot halves speed for that long, e.g. 0.1 s for the AK-47, 0.9 s for the M870, 1.75 s for the Mosin. A continuously fired automatic stays at half speed [src:survev/server/src/game/weaponManager.ts:741] [src:survev/shared/defs/gameObjects/gunDefs.ts:837] [src:survev/shared/defs/gameObjects/gunDefs.ts:1775] [src:survev/shared/defs/gameObjects/gunDefs.ts:1478] [src:fandom/Fists] [H]
- Switching weapons resets `shotSlowdownTimer` to 0 [src:survev/server/src/game/weaponManager.ts:127] [H]
- Melee swings do not set `shotSlowdownTimer`. During a swing the +1 melee equip bonus is lost until the last damage time passes [src:survev/server/src/game/objects/player.ts:4713-4720] [src:survev/server/src/game/weaponManager.ts:411-430] [src:fandom/Player] [H]

## Worked speeds (survev formula, no perks)

| situation | speed u/s | sources |
|---|---|---|
| gun out (equip 0) | 12 | [src:derived/movement-formula] [src:fandom/Player] [H] |
| melee or fists out | 13 | [src:derived/movement-formula] [src:fandom/Player] [H] |
| melee + boost ≥ 50 | 14.85 | [src:derived/movement-formula] [H] |
| melee + haste | 17.8; with boost 19.65 | [src:derived/movement-formula] [M] |
| gun in water / gun while cooking | 9 | [src:derived/movement-formula] [src:fandom/Player] [H] |
| gun in water while cooking | 6 | [src:derived/movement-formula] [src:fandom/Player] [H] |
| gun out, using an item | 6; melee 6.5; melee + boost 7.425 | [src:derived/movement-formula] [M] |
| firing M249 | (12 − 4) × 0.5 = 4 | [src:derived/movement-formula] [M] |
| firing PKP | (12 − 5) × 0.5 = 3.5 | [src:derived/movement-formula] [M] |
| downed (melee forced, +1 equip still added) | 5 in survev; fandom says 4 | [src:derived/movement-formula] [src:fandom/Player] [L] |
| downed and being revived | 3 in survev (2 + 1 melee); fandom says 2 | [src:derived/movement-formula] [src:fandom/Player] [L] |
| downed, being revived, in water | clamps to 1 | [src:derived/movement-formula] [src:fandom/Player] [H] |
| reviving a teammate with melee out | 7 in survev (6 + 1); fandom: "0.5x speed multiplier" for both players | [src:derived/movement-formula] [src:fandom/Knocked_Out] [L] |

## Position update (per tick, `Player.update`)

- Keyboard input builds a vector from MoveUp (+y), MoveDown (−y), MoveLeft (−x) and MoveRight (+x). When both axes are non-zero, each axis is multiplied by `Math.SQRT1_2`, so diagonal movement is not faster [src:survev/server/src/game/objects/player.ts:1928-1939] [H]
- Touch input uses `touchMoveDir` (normalized) at full speed. `touchMoveLen` is received but not used to scale speed [src:survev/server/src/game/objects/player.ts:1925-1927] [src:survev/server/src/game/objects/player.ts:3368-3371] [M]
- Knockback velocity `vel` is applied first and decays as `vel *= 1 / (1 + 4·dt)` each tick until it is below 0.01. Only the down event sets it (`dir × 10`) [src:survev/server/src/game/objects/player.ts:1943-1946] [src:survev/server/src/game/objects/player.ts:2588] [H]
- Collision substeps: `steps = round(max(speed·dt + 5, 5))`, which is 5 at 100 Hz for any normal speed. Each step advances `speed/steps·dt` along the move vector [src:survev/server/src/game/objects/player.ts:1950-1977] [H]
- Broadphase: one grid query per tick with radius `maxVisualRadius (3.75) × scale + speed·dt` [src:survev/server/src/game/objects/player.ts:1969-1974] [src:survev/shared/gameConfig.ts:188] [H]
- Narrowphase: after each substep, every collidable, non-dead obstacle on the same layer pushes the player circle out along the collision normal by `pen + 0.001`. With `tree_climbing`, trees are skipped [src:survev/server/src/game/objects/player.ts:1979-1998] [src:fandom/One_With_Nature] [H]
- Players never collide with other players. Only obstacles are resolved [src:survev/server/src/game/objects/player.ts:1979-1998] [H]
- The final position is clamped to the map bounds, inset by the player radius [src:survev/server/src/game/objects/player.ts:2303] [src:survev/server/src/game/map.ts:2277-2285] [H]
- Water test (`map.isOnWater`, at the player centre): a decal surface wins first, then the highest-zIdx building surface on the layer, then river water polygons (not on layer 1). Lakes and the sea count as river polygons [src:survev/server/src/game/map.ts:2378-2440] [H]
- Speed scales with nothing else: player size (`scale`) changes the collision radius `1 × scale`, not speed [src:survev/server/src/game/objects/player.ts:582-584] [M]
- Direction comes from the client's `toMouseDir` every input message. Since 0.6.2 the mobile player faces its movement direction when not firing [src:survev/server/src/game/objects/player.ts:3361] [src:changelog/0.6.2] [H]
- 0.6.2 also "Adjusted left pad to enter full speed movement sooner", which suggests the original mobile pad was analog near its centre [src:changelog/0.6.2] [M]

## Haste

- `giveHaste(type, duration)` sets `hasteType` and a timer. A new haste overwrites the current one (no stacking). On expiry `hasteType` returns to None [src:survev/server/src/game/objects/player.ts:4599-4604] [src:survev/server/src/game/objects/player.ts:1783-1792] [H]
- Windwalk (`windwalk`, original 0.7.5): haste 3 s when an enemy bullet passes within 5 u or hits the player. It cannot re-trigger while Windwalk haste is active, and teammates' bullets do not trigger it (fandom: patched 2019-07-11) [src:survev/server/src/game/objects/bullet.ts:458-465] [src:survev/shared/defs/gameObjects/perkDefs.ts:77-80] [src:wikigg/Windwalk] [src:fandom/Windwalk] [H]
- Takedown (`takedown`, 0.8.3): haste 3 s on a credited kill (with +25 HP and +25 boost in survev) [src:survev/server/src/game/objects/player.ts:2721-2725] [src:survev/shared/defs/gameObjects/perkDefs.ts:85-89] [src:wikigg/Takedown] [H]
- Inspiration (Bugler, 0.8.81): firing the bugle gives Inspire haste for 3 s to nearby alive team players within 30 u [src:survev/server/src/game/objects/player.ts:4562-4583] [src:fandom/Inspiration] [H]
- Last Breath (`final_bugle`, 0.8.81): on the bugler's death, Inspire haste for 5 s (fandom: 6 s) within 60 u, plus +20 % size and ×1.08 damage [src:survev/server/src/game/objects/player.ts:4528-4560] [src:survev/shared/defs/gameObjects/perkDefs.ts:48-53] [src:fandom/Last_Breath] [M]
- Lone Survivr promotion grants Windwalk haste for 5 s with full health and boost [src:survev/server/src/game/objects/player.ts:924-929] [src:fandom/Lone_Survivr] [M]

## Frozen

- Snowball/potato-type explosions call `freeze(type, ori, duration)`. The frozen penalty is −3 for `freezeDuration` (survev: snowball 0.5 s, heavy snowball 2 s, potato 0.5 s, heavy potato 1 s) [src:survev/server/src/game/objects/player.ts:4520-4526] [src:survev/server/src/game/objects/explosion.ts:222-229] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-191] [M]
- `freezeDuration` is not in the original client explosion defs (they only carry `freezeOnImpact` on the throwable). balance.txt says the heavy snowball went from 1 to 2 s in the fork, so the original heavy snowball value was 1 s [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:110-130] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:467] [src:balance/123] [src:balance/125] [M]

## Downed and revive movement

- Downed players move at `downedMoveSpeed` 4 (plus the forced melee's equip +1 in survev). Boost is forced to 0 so the 1.85 bonus never applies [src:survev/server/src/game/objects/player.ts:4702-4703] [src:survev/server/src/game/objects/player.ts:1544-1546] [src:survev/server/src/game/objects/player.ts:2606] [H]
- Crawl animation: after more than 3 u travelled with no other animation, play CrawlForward, or CrawlBackward when facing away from the move direction, for `crawlTime` 0.75 s [src:survev/server/src/game/objects/player.ts:2322-2335] [H]
- Both players keep moving during a revive. It cancels if they are more than `reviveRange` 5 u apart (see downed-revive.md) [src:survev/server/src/game/objects/player.ts:1562-1572] [src:fandom/Knocked_Out] [H]
- Self-reviving (Revivify) players use the being-revived speed (2), so they get no reviver bonus [src:survev/server/src/game/objects/player.ts:4694-4701] [H]

## Fork and post-0.8.82 notes

- Fork perks that change speed: `field_medic.speedBoost` 1 (fork value), `assume_leadership` minBoost 50 (always above the 1.85 threshold), `bonus_assault` bullet speed only (fork) [src:survev/shared/defs/gameObjects/perkDefs.ts:9-12] [src:survev/shared/defs/gameObjects/perkDefs.ts:152-156] [src:balance/325] [H]
- Post-0.8.82 wiki effects not in survev: Storm Map rivers slow more, Snow Map ice speeds players up (+3), Sugar Rush, Popsicle (+10 %), Wet and Contacted effects (post-0.8.82) [src:fandom/River] [src:fandom/One_With_Nature] [src:fandom/Effects] [src:fandom/Consumables] [M]

## Conflicts

- CONFLICT water-penalty-depth: flat −3 anywhere in water [src:survev/server/src/game/objects/player.ts:4726-4732] [src:fandom/Player] vs "the further into a body of water a Player wades, the greater the slowing effect becomes, to a maximum of −2" [src:fandom/Water]; proposed: keep the flat −3 (two sources, fandom Player and One With Nature pages agree) and expose `waterSpeedPenalty` as a knob [L]
- CONFLICT downed-melee-equip-bonus: survev adds the forced melee's +1 equip bonus while downed (5 u/s, 3 u/s being revived) [src:survev/server/src/game/objects/player.ts:4702-4720] vs 4 u/s downed and 2 u/s being revived [src:fandom/Player]; proposed: skip the equip bonus while downed so the wiki numbers hold [L]
- CONFLICT reviver-speed: reviver base 6 + equip and boost (estimate in code) [src:survev/server/src/game/objects/player.ts:4697] vs "a 0.5x speed multiplier is applied to both" [src:fandom/Knocked_Out]; proposed: reviver = normal speed formula × 0.5 (12 → 6 with a gun, matching survev's base), downed target stays at 2 [L]
- CONFLICT last-breath-haste-duration: Inspire haste 5 s [src:survev/shared/defs/gameObjects/perkDefs.ts:52] vs 6 s [src:fandom/Last_Breath]; proposed: 5 s with a knob, since fandom gives no source [L]
- CONFLICT field-medic-speed: survev +1 while using items (fork-tuned, was 1.5) [src:survev/shared/defs/gameObjects/perkDefs.ts:95] vs fandom "you can move faster than you could with adrenaline" [src:fandom/Combat_Medic]; proposed: +1 knob, original value unknown [L]

## Open questions

- Original mobile analog movement: did `touchMoveLen` scale speed below full deflection before 0.6.2? [src:changelog/0.6.2] [src:survev/server/src/game/objects/player.ts:1925-1927] [L]
- Was the item-use slowdown a multiplier (survev ×0.5) or a flat penalty (survev's earlier −6) in the original? The 0.0.95 changelog only says the penalty was reduced [src:changelog/0.0.95] [src:derived/survev-git-aa28f360] [L]
- `frozenSpeedPenalty` −3 and the freeze durations are survev values with no wiki confirmation [src:survev/shared/gameConfig.ts:204] [L]
