# Loot

> Two layers of data:
> 1. **Loot specs on objects** (`loot: [tierLoot(tier, min, max) | autoLoot(type, count)]`) are client-visible. Comparing survev with the 0.8.82 relaunch client: 112 loot-bearing obstacles match exactly, 19 differ and 60 are fork-only (table at the end).
> 2. **Loot tables** (`mapDef.lootTable`, tier → weighted items) are stripped from the production client and are **not** original in survev. Its base file says "this loot table is not the original one so its not accurate / ? are guesses based on statistics / ! are uncertain data based on leak". Many weights still match fandom's data-mined v0.7.9 numbers.

## Table structure and resolution

- `mapDef.lootTable: Record<tier, Array<{ name, count, weight, preload? }>>`. `name` is an item id, another `tier_*` table, or `""` (drop nothing) [src:survev/shared/defs/mapDefs.ts:180-188] [M]
- Object loot entries: `tierLoot(tier, min, max, props)` gives `{ tier, min, max, props }`; `autoLoot(type, count, props)` gives a fixed item. `props.preloadGuns` marks preloaded guns [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:13-26] [src:survev/shared/defs/mapObjectsTyping.ts:49-58] [src:kong/relaunch-client-defs] [H]
- Roll count: for each tier entry, `randomInt(min, max)` independent rolls, each resolved separately [src:survev/server/src/game/objects/obstacle.ts:617-628] [M]
- Weighted pick: `rng = random(0, Σweights)`, then subtract weights in table order until `rng ≤ weight`. The closure is cached per tier per game [src:survev/server/src/game/objects/loot.ts:189-211] [M]
- Nesting: a picked `tier_*` name is resolved recursively (any depth). A picked `""` yields nothing. The final entry's `count` is the stack size (e.g. `bandage` ×5, `9mm` ×60) [src:survev/server/src/game/objects/loot.ts:213-230] [src:fandom/Loot_tables] [H]
- Fandom: "Loot drops use a weight system … percentChance = itemChance / totalChance × 100" [src:fandom/Loot_tables] [M]
- Derived example (survev weights): P(level-3 helmet from one `tier_world` roll) = 0.10/0.89 × 0.2/36.4 ≈ 0.062 % [src:derived/tier_world-x-tier_armor-weights] [L]
- Unknown tiers trip an assert; every tier referenced by an object must exist in the map's table, via inheritance from Main [src:survev/server/src/game/objects/loot.ts:213-217] [M]
- Map inheritance: each map def is `util.mergeDeep({}, <parent>, mapDef)` with parent Main for most maps, Woods for woods snow/spring/summer, Potato for potato spring and Faction for Potato vs Tomato, so a map only lists the tiers it overrides (each override replaces the whole array) [src:survev/shared/defs/maps/baseDefs.ts:6-11] [src:survev/shared/defs/maps/desertDefs.ts:356] [src:survev/shared/defs/maps/woodsSnowDefs.ts:146] [src:survev/shared/defs/maps/potatoSpringDefs.ts:109] [src:survev/shared/defs/maps/factionPotatoDefs.ts:385] [M]

## Where loot comes from

| source | mechanism | sources |
|---|---|---|
| destroyed obstacles | `kill()` rolls `def.loot` at `pos` (or `lootSpawn.offset` rotated), push speed 4.75 (× `lootSpawn.speedMult`). With >1 items, speed is divided by the item count and items scatter within 0.1 u. Push direction is the killing hit's direction. Loot drops before any explosion | [src:survev/server/src/game/objects/obstacle.ts:563-667] [src:changelog/0.0.9] [H] |
| Scavenger perks | `scavenger` adds one `tier_world` roll and `scavenger_adv` (Master Scavenger) one `tier_scavenger_adv` roll to every obstacle the holder breaks | [src:survev/server/src/game/objects/obstacle.ts:570-584] [src:survev/shared/defs/gameObjects/perkDefs.ts:105-120] [src:changelog/0.8.8] [M] |
| loot spawners (`loot_tier_*`) | placed by buildings or density spawns. Each rolls its tier once and drops the item with push speed 0 (static ground loot), preloaded if the table entry has `preload`. A radius-3 spawn-block collider stops other objects spawning on it | [src:survev/server/src/game/map.ts:1194-1210] [src:fandom/Loot_Spawners] [H] |
| random ground loot | `densitySpawns`: `loot_tier_1` ×24 and `loot_tier_beach` ×4 on Main, scaled by `shoreArea / 250000` and rounded (at most ×1.56 on a 720 map, i.e. 624² before river shore areas are subtracted, giving up to ~37 and ~6) | [src:survev/shared/defs/maps/baseDefs.ts:889-911] [src:survev/server/src/game/map.ts:1126-1129] [src:derived/shore-area-624sq-div-250000] [M] |
| air drops | crate loot after unlocking the shell (see `airdrop-airstrike.md`) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:593-866] [src:kong/relaunch-client-defs] [H] |
| dead players | all droppable gear (section below) | [src:survev/server/src/game/objects/player.ts:2913-2996] [src:changelog/0.0.3] [H] |
| player drops | drop actions (section below) | [src:survev/server/src/game/objects/player.ts:4152-4290] [src:changelog/0.2.0] [H] |
| snowball/potato hits | `dropRandomLoot` knocks random items out of the target's inventory (fork values; see `explosions.md`) | [src:survev/server/src/game/objects/player.ts:4000-4045] [M] |

- Per-map `loot_tier_1` / `loot_tier_beach` densities: Main 24/4; woods 36/8; halloween 48/8; savannah 30/4 (fork, raised from 24); birthday 100/—; woods spring 36/12; beach (fork) 24/24; desert, faction, potato, snow, cobalt, turkey and main/potato spring–summer 24/4 [src:survev/shared/defs/maps/baseDefs.ts:908-909] [src:survev/shared/defs/maps/woodsDefs.ts:224-225] [src:survev/shared/defs/maps/halloweenDefs.ts:235-236] [src:survev/shared/defs/maps/savannahDefs.ts:274-275] [src:balance/342] [src:survev/shared/defs/maps/birthdayDefs.ts:167] [M]
- Changelog history of ground loot: 0.0.5 "Increased loot and ammo spawns"; 0.0.7 "More loot spawns"; 0.1.7 "Decreased number of 9mm ammo spawns"; 0.3.5 "Slightly increased chance of loot to appear in beach areas" [src:changelog/0.0.5] [src:changelog/0.0.7] [src:changelog/0.1.7] [src:changelog/0.3.5] [H]

## Loot spawners

| id | rolls | terrain (random placement) | status | sources |
|---|---|---|---|---|
| `loot_tier_1` | `tier_world` ×1 | grass, beach, river shore | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:5-9] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_2` | `tier_container` ×1 | grass, beach, river shore (building use only) | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:10-14] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_beach` | `tier_world` ×1 | beach only | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:15-19] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_surviv` | `tier_surviv` ×1 | grass, beach, river shore | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:20-24] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_vault_floor` / `_police_floor` / `_mansion_floor` | `tier_vault_floor` (Jester) / `tier_police_floor` (Prisoner) / `tier_mansion_floor` (Casanova) | — | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:25-36] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_sv98`, `loot_tier_scopes_sniper` | `tier_sv98`, `tier_scopes_sniper` | — | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:37-44] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_woodaxe` / `_fireaxe` / `_stonehammer` / `_hatchet_melee` / `_club_melee` | melee tiers | — | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:45-68] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_barn_melee` | `tier_barn_melee` (sledgehammer) | — | (fork) replaces the original `loot_tier_sledgehammer` (`tier_sledgehammer`) | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:57-60] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_leaf_pile` | `tier_leaf_pile` | — | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:69-72] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| outfit spawners `_islander`, `_verde`, `_lumber`, `_imperial`, `_pineapple`, `_tarkhany`, `_spetsnaz` | one outfit each | — | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:73-100] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_eye_02`, `_saloon`, `_chrys_01`, `_chrys_02`, `_chrys_03`, `_airdrop_armor` | named tiers | — | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:105-132] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_eye_01`, `loot_tier_chrys_02b`, `loot_tier_helmet_potato`, `loot_tier_sledgehammer` | `tier_eye_01`, `tier_chrys_02b`, `tier_potato_helmet`, `tier_sledgehammer` | — | original; commented out or missing in survev | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:101-137] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_helmet_forest` | `tier_forest_helmet` (woods king helmet) | grass | original | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:179-183] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |
| `loot_tier_perk_test`, `loot_tier_sniper_test`, `loot_tier_loot_test` | fixed test item sets | grass | original (test only; fandom lists an older perk-test set) | [src:survev/shared/defs/mapObjects/lootSpawnerDefs.ts:138-178] [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [H] |

## Ground loot objects

- Collider radius per loot type (`GameConfig.lootRadius`): melee, gun and perk 1.25; ammo 1.2; everything else 1 [src:survev/shared/gameConfig.ts:442-456] [M]
- Loot-to-loot separation uses an enlarged radius (1.25 × rad; survev's comment says this "seems to match it from the recorded packets"). Overlapping items are pushed apart at `max(pen / rad, 0.125) × 2.5` per second [src:survev/server/src/game/objects/loot.ts:36-61] [src:survev/server/src/game/objects/loot.ts:291-295] [M]
- Motion: initial push `dir × pushSpeed`, drag `vel × 1 / (1 + 2.5·dt)`. Items are pushed out of collidable obstacles on their layer and clamped to map bounds [src:survev/server/src/game/objects/loot.ts:349-392] [src:survev/server/src/game/objects/loot.ts:486-491] [M]
- Items stop updating when still, and are woken when nearby colliders change (doors, obstacle damage/regrowth, airdrop landing) [src:survev/server/src/game/objects/loot.ts:338-347] [src:survev/server/src/game/objects/loot.ts:169-181] [M]
- Rivers: loot on river water outside building/decal surfaces drifts along the river tangent at 0.5 u/s². Bridges have `lootOnly` stairs so loot floats under them [src:survev/server/src/game/objects/loot.ts:448-473] [src:survev/server/src/game/objects/loot.ts:440-446] [src:fandom/Beach] [src:fandom/River] [H]
- Loot changes layer on stairs like players [src:survev/server/src/game/objects/loot.ts:433-436] [M]
- Owned loot (Cobalt class pods): only the owner can pick it up for 2 s, or until the owner dies or disconnects [src:survev/server/src/game/objects/loot.ts:325-336] [src:survev/server/src/game/objects/player.ts:3580-3582] [M]
- Some loot carries a map indicator (`mapIndicator` on the item def, e.g. the woods-king helmet) that follows the item [src:survev/server/src/game/objects/loot.ts:302-308] [src:survev/shared/defs/gameObjects/gearDefs.ts:686] [M]
- Explosions push loot (force = damage × U(0.15, 0.4)) but never destroy it [src:survev/server/src/game/objects/explosion.ts:202-207] [M]
- Loot never despawns in survev; there is no lifetime field [src:survev/server/src/game/objects/loot.ts:233-311] [L]

## Ammo side stacks and preloaded guns

- A gun spawned as loot (not preloaded, ammo not infinite) also spawns its `ammoSpawnCount` of ammo as two stacks at offsets (−0.75, −0.075) and (+0.75, −0.075): `ceil(n/2)` left, the rest right [src:survev/server/src/game/objects/loot.ts:18-19] [src:survev/server/src/game/objects/loot.ts:136-166] [M]
- Examples (`ammoSpawnCount`): MP5 90, AK-47 90, M9 45, G18C 51, M870 10, M1100 12, Mosin 20, AWM-S 20, USAS-12 30, DP-28 120, DEagle 56, flare gun 1 [src:kong/relaunch-client-defs] [src:survev/shared/defs/gameObjects/gunDefs.ts] [src:changelog/0.4.1] [H]
- Changelog 0.3.5: DEagle ".50 AE ammo … only spawns with the gun and does not appear with regular ammo"; 0.4.1: "DEagle 50 now spawns with 7 more rounds (total 56)" [src:changelog/0.3.5] [src:changelog/0.4.1] [H]
- Preloaded guns (`props.preloadGuns` or a table entry's `preload`, not from players): no side stacks. On pickup the player gets `ammoSpawnCount` into the inventory (`giveAndDrop`, overflow dropped). This is used by military air drops from 0.8.71 ("packaged with their specific ammo") [src:survev/server/src/game/objects/loot.ts:125-135] [src:survev/server/src/game/objects/player.ts:3789-3795] [src:changelog/0.8.71] [src:fandom/Meteor_Crate] [H]
- (fork) survev also preloads guns in `case_01`/`case_02` (DEagle cases), `crate_02f` and `crate_22`; the original specs have no `preloadGuns` there [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194-195] [H]
- Guns dropped by players carry their magazine: the magazine goes into the inventory first and overflow becomes the side stacks (`useCountForAmmo`). Dual pistols drop as two singles [src:survev/server/src/game/weaponManager.ts:598-624] [src:changelog/0.3.1] [H]

## Pickup rules

- Reach: nearest same-layer loot whose centre is within `player.rad + loot.rad` (mobile: `player.rad + loot.rad × 1.4`, `touchLootRadMult`). Owner restriction applies [src:survev/server/src/game/objects/player.ts:3568-3598] [src:survev/shared/gameConfig.ts:222] [M]
- Cooldown 0.1 s between pickups (0.2 s after taking a gun). Blocked while reviving, and while using a heal/boost unless the item is a gun [src:survev/server/src/game/objects/player.ts:3714-3726] [src:survev/server/src/game/objects/player.ts:3802] [M]
- Ammo, scopes, heals, boosts, throwables: added up to backpack capacity (`bagSizes`). The remainder is re-dropped at the item's position (push 4–4.5 opposite the player's facing, no side ammo) [src:survev/server/src/game/objects/player.ts:3734-3753] [src:survev/server/src/game/objects/player.ts:3983-3994] [src:survev/shared/gameConfig.ts:415-441] [M]
- Nothing fits: "Not enough space!" (`Full`), or for scopes "Item already owned!" [src:survev/server/src/game/objects/player.ts:3743-3750] [src:l10n/en:game-not-enough-space] [src:l10n/en:game-item-already-owned] [H]
- Guns: a matching single pistol makes duals; otherwise the first empty gun slot; otherwise the active gun slot is replaced and the old gun dropped. With melee or throwable equipped and both slots full the result is `Full` [src:survev/server/src/game/objects/player.ts:3651-3711] [src:survev/server/src/game/objects/player.ts:3755-3848] [src:changelog/0.3.1] [M]
- A role-locked gun (`noDrop`) or an unfired commander flare gun blocks replacement [src:survev/server/src/game/objects/player.ts:3770-3786] [M]
- Taking a new gun into an empty slot while holding melee switches to it [src:survev/server/src/game/objects/player.ts:3840-3846] [M]
- Melee: swaps, dropping the old one (fists are never dropped). The same melee gives "Item already equipped!" [src:survev/server/src/game/objects/player.ts:3755-3763] [src:survev/server/src/game/weaponManager.ts:648-655] [src:l10n/en:game-item-already-equipped] [H]
- Helmet, chest, backpack: refused with "Better item equipped!" when the equipped level is higher (or a role helmet is worn). Otherwise swapped, with the old one dropped only if its level is ≥ 1 (changelog 0.1.6: "Armor items below your current equipped armor cannot be looted", "Pouches no longer drop after looting a new pack") [src:survev/server/src/game/objects/player.ts:3850-3897] [src:changelog/0.1.6] [src:l10n/en:game-better-item-equipped] [H]
- Outfits: swap, dropping the old one. Refused in 50v50 if the outfit belongs to the other faction, or if the role forbids outfit changes [src:survev/server/src/game/objects/player.ts:3898-3922] [M]
- Perks: refused at 4 perks with no droppable slot ("Maximum perks equipped!"). A droppable perk is swapped out when the backpack's `maxPerks` slots are full. `halloween_mystery` rolls `tier_halloween_mystery_perks` [src:survev/server/src/game/objects/player.ts:3923-3981] [src:l10n/en:game-max-perks] [M]
- XP items (`type "xp"`) have no pickup branch in survev: they are destroyed with no effect (the Survivr Pass is not implemented) [src:survev/server/src/game/objects/player.ts:3728-3999] [L]
- Mobile auto-pickup (no button): a gun into an empty, non-active slot; melee only over fists; perks only if no droppable perk is held (never `halloween_mystery`); armor/backpacks only if better; stackables until full; never outfits. It is suppressed for 3 s after the player drops something [src:survev/server/src/game/objects/player.ts:2022-2091] [src:survev/server/src/game/objects/player.ts:4152-4160] [M]
- Changelog 0.1.0: "A message will now appear if a player is unable to loot an item (no room in pack, better item already equipped, already have that item)." [src:changelog/0.1.0] [H]

## Dropping items

- Drop push speed U(7.5, 11) opposite the player's facing (`source "player"`, so never preloaded) [src:survev/server/src/game/objects/player.ts:4152-4160] [M]
- Ammo: drops `max(1, floor(n/2))`. If n ≤ the ammo's `minStackSize` (9mm 15, 7.62/5.56/.50AE/.308/.45/`potato_ammo` 10, 12-gauge 5, flare 1) or n ≤ 5, it drops min(that size, n). Large amounts are split into 60-round stacks [src:survev/server/src/game/objects/player.ts:4250-4265] [src:survev/server/src/game/objects/player.ts:4192-4200] [src:kong/relaunch-client-defs] [M]
- Heals, boosts and throwables drop half (min 1); throwables cannot be dropped while cooking. Scopes drop one [src:survev/server/src/game/objects/player.ts:4266-4290] [M]
- Changelog 0.2.0: "Added option to drop items (right-click item to drop)." [src:changelog/0.2.0] [H]

## Death drops

- On death the body drops: every gun (with magazine ammo), the melee unless fists or `noDropOnDeath`, every inventory stack except the 1x scope (and the 2x scope in sniper mode), helmet/chest/backpack of level ≥ 1 unless `noDrop`, the outfit if droppable and not the player's loadout outfit, and droppable perks (or their `replaceOnDeath` item). Each is pushed U(7.5, 11) in a random direction [src:survev/server/src/game/objects/player.ts:2913-2996] [M]
- Changelog 0.0.3: "Armor and skins now drop from dead players." [src:changelog/0.0.3] [H]
- Fandom: the 1x scope cannot be dropped, even on death [src:fandom/Scopes] [M]
- Role perks and role helmets do not drop in 50v50 [src:fandom/50v50_Map] [src:survev/server/src/game/objects/player.ts:2985-2996] [H]

## XP drops (Survivr Pass)

- XP loot ids (all in the 0.8.82 client): generic `xp_10` (8 XP), `xp_25` (24 XP), `xp_100` (96 XP); 8-XP books `xp_book_tallow`, `_greene`, `_parma`, `_nevelskoy`, `_rinzo`, `_kuga`; 24-XP items `xp_glasses`, `xp_compass`, `xp_stump`, `xp_bone`; 96-XP `xp_donut` [src:survev/shared/defs/gameObjects/xpDefs.ts:18-140] [src:kong/relaunch-client-defs] [src:fandom/Loot_tables/Airdrops] [H]
- Changelog 0.8.7: "Added new loot type: XP artifact. Looting XP artifacts grants progress towards the Survivr Pass (halloween map only)." [src:changelog/0.8.7] [H]
- Original sources: `tier_airdrop_xp` ×2 in `crate_11h` (halloween gold) and `crate_11tr` (thanksgiving gold), `tier_fruit_xp` in `squash_01` and halloween fruit [src:kong/relaunch-client-defs] [src:fandom/Meteor_Crate] [H]
- survev neutralises these: `tier_fruit_xp` = `""` w40 and `tier_airdrop_xp` = `""` w15, with the XP sub-tiers commented out "until we have a pass". Its comment says these weights are "guessed with no base on real data" [src:survev/shared/defs/maps/baseDefs.ts:708-724] [M]
- survev's (commented) nesting was uncommon w1, rare w0.1, mythic w0.001; inner tables `tier_xp_uncommon` (6 books w1), `tier_xp_rare` (4 items w0.1), `tier_xp_mythic` (donut w0.01) [src:survev/shared/defs/maps/baseDefs.ts:693-724] [L]

## Which survev tables are guesses

- `baseDefs.ts` (Main) loot table header: "NOTE: this loot table is not the original one so its not accurate", "? are guesses based on statistics", "! are uncertain data based on leak" [src:survev/shared/defs/maps/baseDefs.ts:90-92] [H]
- The same header is copied into `birthdayDefs.ts` [src:survev/shared/defs/maps/birthdayDefs.ts:50-52] [H]
- `?` markers in other maps: faction `vss` in `tier_guns`; spring `tier_chrys_case` ("this override is not from the leak!"); savannah `tier_scopes` and `tier_snipers`-style lists [src:survev/shared/defs/maps/factionDefs.ts:280] [src:survev/shared/defs/maps/mainSpringDefs.ts:30-35] [src:survev/shared/defs/maps/potatoSpringDefs.ts:48-51] [src:survev/shared/defs/maps/savannahDefs.ts:47-97] [H]
- `!` markers in other maps: desert and savannah `mkg45` / `vss` weights [src:survev/shared/defs/maps/desertDefs.ts:116] [src:survev/shared/defs/maps/savannahDefs.ts:95-96] [H]
- XP and halloween-perk tables are "guessed with no base on real data!" [src:survev/shared/defs/maps/baseDefs.ts:708] [H]
- `tier_world` and `tier_surviv` category weights carry "TODO get more data on this from original" [src:survev/shared/defs/maps/baseDefs.ts:95] [src:survev/shared/defs/maps/baseDefs.ts:104] [H]
- Fandom's figures: "Almost all actual numbers were obtained in the v0.7.9 Scouting Ahead update"; other maps' defaults were inferred from those [src:fandom/Loot_tables] [M]
- Confidence below: a survev row is `[L]` if it carries `?`/`!`/TODO markers and `[M]` otherwise (unmarked, but still from a file declared "not the original"). It is raised to `[H]` only in the fandom comparison where both sources agree [src:derived/kb-confidence-rule-loot] [L]

## Cross-check: survev base tables vs fandom (v0.7.9 data)

| tier | survev (Main) | fandom | verdict | sources |
|---|---|---|---|---|
| `tier_armor` | helmet01 9, helmet02 6, helmet03 0.2, chest01 15, chest02 6, chest03 0.2 | identical (total 36.4) | match | [src:survev/shared/defs/maps/baseDefs.ts:146-153] [src:fandom/Loot_tables] [H] |
| `tier_medical` | bandage ×5 16, healthkit 4, soda 15, painkiller 5 | identical (total 40) | match | [src:survev/shared/defs/maps/baseDefs.ts:159-164] [src:fandom/Loot_tables] [H] |
| `tier_ammo` | 9mm ×60, 762mm ×60, 556mm ×60, 12gauge ×10, all w3 | identical (fandom's basic subpage shows 9mm "1 or 3") | match | [src:survev/shared/defs/maps/baseDefs.ts:170-175] [src:fandom/Loot_tables] [src:fandom/Loot_tables/Basic] [H] |
| `tier_throwables` | frag ×2 1, smoke 1, mirv ×2 0.05 | identical (fandom also lists mine ×2 "???", an item absent from the 0.8.82 client and changelog) | match | [src:survev/shared/defs/maps/baseDefs.ts:165-169] [src:fandom/Loot_tables/Basic] [H] |
| `tier_container` | guns .29, ammo .04, scopes .15, armor .10, medical .17, throwables .05, packs .09, outfits .035 | same; outfits "0.11 if total = 1, 0.035 if 50v50 is normal" | match (outfits uncertain) | [src:survev/shared/defs/maps/baseDefs.ts:110-119] [src:fandom/Loot_tables/General] [M] |
| `tier_toilet` | guns .1, scopes .05, medical .6, throwables .05, outfits .025 | same; outfits ".20 or .025" | match (outfits uncertain) | [src:survev/shared/defs/maps/baseDefs.ts:133-139] [src:fandom/Loot_tables/General] [M] |
| `tier_guns` | as fandom except mosin .05, flare_gun .145, flare_gun_dual .0025, scout_elite .1, vss .1, and (fork) bar .05 | famas .9, m416 4, mk12 .1, pkp .005, m249 .006, ak47 2.7, scar .01, dp28 .5, mosin .1, m39 .1, mp5 10, mac10 6, ump9 3, m870 9, m1100 6, mp220 2, saiga .1, ot38 8, m9 19, m93r 5, glock 7, deagle .05, vector .01, sv98 .01, spas12 1, qbb97 .01, flare .1 (main page) or .01 (subpage), groza .8, scout_elite .05; VSS/M79/M134 unknown | mostly match | [src:survev/shared/defs/maps/baseDefs.ts:253-286] [src:fandom/Loot_tables] [src:fandom/Loot_tables/Basic] [src:balance/146] [M] |
| `tier_airdrop_uncommon` | mk12 2.5, scar .75, bar 1, mosin 1.5, m39 2.5, saiga 1, deagle 1, vector 1, sv98 .5, qbb97 1.5, m9 .01, flare .5, scout_elite 2.5, vss 2.5 | mk12 2.5, scar .75, mosin 2.5, m39 2.5, saiga 1, deagle 1, vector 1, sv98 .5, qbb97 1.5, m9 .01, flare .5, scout_elite 1.5 (total 15.26; no bar, no vss) | differ | [src:survev/shared/defs/maps/baseDefs.ts:596-611] [src:fandom/Loot_tables/Airdrops] [L] |
| `tier_airdrop_rare` | garand 6, awc 3, pkp .08, m249 .1, m4a1 4, scorpion 5 (?), ots38_dual 4.5 | garand 6, awc 3, pkp ???, m249 .1, m4a1 4, ots38_dual 4.5, CZ-3A1 ??? | match where known | [src:survev/shared/defs/maps/baseDefs.ts:612-620] [src:fandom/Loot_tables/Airdrops] [M] |
| `tier_airdrop_mythic` | usas 1, scarssr 1, sv98 1, p30l_dual 1, pkp 1, m249 1, (fork) barrett 1, awc .75 | dual P30L, PKP, M249, USAS-12, AWM-S (weights unknown; no SSR, SV-98 or Barrett) | differ | [src:survev/shared/defs/maps/baseDefs.ts:627-636] [src:fandom/Loot_tables/Airdrops] [src:balance/276-277] [src:balance/330] [L] |
| `tier_airdrop_outfits` | "" 20, outfitMeteor 5, outfitHeaven 1, outfitGhillie .5 | none 20, Falling Star 5, Celestial Garb 1, Ghillie .5 | match | [src:survev/shared/defs/maps/baseDefs.ts:643-648] [src:fandom/Loot_tables/Airdrops] [H] |
| `tier_airdrop_throwables` | frag ×2 1, mirv ×2 .5 | identical | match | [src:survev/shared/defs/maps/baseDefs.ts:649-652] [src:fandom/Loot_tables/Airdrops] [H] |
| `tier_airdrop_armor` | helmet03, chest03, backpack03, w1 each | identical | match | [src:survev/shared/defs/maps/baseDefs.ts:657-661] [src:fandom/Loot_tables/Airdrops] [H] |
| `tier_airdrop_melee` | "" 19, pan 1 | none 19, pan 1 | match | [src:survev/shared/defs/maps/baseDefs.ts:653-656] [src:fandom/Loot_tables/Airdrops] [H] |
| `tier_airdrop_scopes` | "" 24, 4x 5, 8x 1, 15x .02 (all `?`) | none 18, others ??? | differ | [src:survev/shared/defs/maps/baseDefs.ts:662-667] [src:fandom/Loot_tables/Airdrops] [L] |
| `tier_airdrop_ammo` | 9mm ×30, 762mm ×30, 556mm ×30, 12gauge ×5, w3 | 9mm ×60, 7.62 ×60, 5.56 ×60, 12g ×10 (looks copied from Tier Ammo) | differ | [src:survev/shared/defs/maps/baseDefs.ts:637-642] [src:fandom/Loot_tables/Airdrops] [L] |
| `tier_faction_outfits` | outfitVerde, Woodland, KeyLime, Camo, w1 each | Poncho Verde, Woodland Combat, Key Lime, Forest Camo, ??? | match (names) | [src:survev/shared/defs/maps/baseDefs.ts:738-743] [src:fandom/Loot_tables/Basic] [M] |
| `tier_class_crate_mythic` | scavenger_adv, explosive, splinter, (fork) lifeline | Master Scavenger, Explosive Rounds, Splinter Rounds | match minus fork perk | [src:survev/shared/defs/maps/baseDefs.ts:529-534] [src:fandom/Loot_tables/Class_Pod] [src:kong/relaunch-client-defs] [H] |
| `tier_knives` | empty array; its users, knife crates `crate_15`/`crate_16` (4 rolls) and `mil_crate_01` (1 roll), are placed by no building def in survev or the client, and survev's weighted pick would fail on an empty tier | 8 knives with unknown weights (`bayonet_rugged`, `karambit_rugged`, `huntsman_rugged`, `bowie_vintage`, `bayonet_woodland`, `karambit_prismatic`, `huntsman_burnished`, `bowie_frontier`), "removed from usage"; changelog 0.7.1 "Removed knives from drop tables" | consistent (no knives in 0.8.82 drops) | [src:survev/shared/defs/maps/baseDefs.ts:810] [src:fandom/Loot_tables/Basic] [src:changelog/0.7.1] [M] |

## Fork-touched entries inside survev's base tables

- (fork) Items absent from the 0.8.82 client appear in base tiers: `barrett` (`tier_airdrop_mythic`, `tier_airdrop_crimson`), `ash12` (`tier_airdrop_crimson`), `sw500` (`tier_airdrop_crimson`, `tier_revolvers`), `imbel` (Cobalt tank/classless pods), `spas16` (`tier_guns_rare_demo`, `_classless`, `tier_scavenger_adv`), `lifeline` (`tier_class_crate_mythic`), `high_velocity` (`tier_perks`, added 2026-01-30 `e6439aa4`), `ap_rounds` (`tier_crimson_perks`), `potato_lmg` (`tier_airdrop_potato`), and outfits `outfitFragtastic`, `outfitSpringTree`, `outfitCoconut` [src:survev/shared/defs/maps/baseDefs.ts:93-811] [src:kong/relaunch-client-defs] [src:balance/329-330] [src:derived/survev-git-e6439aa4] [H]
- (fork) Whole tiers with no 0.8.82 client reference: `tier_airdrop_crimson`, `tier_revolvers`, `tier_toilet_gold`, `tier_coconut_outfit`, `tier_guns_common_classless`, `tier_guns_rare_classless`, `tier_throwables_demo`, `tier_health_healer`, `tier_crimson_perks`, `tier_airdrop_potato`, `tier_safe`, `tier_safe_throwables`, `tier_pirate`, `tier_pirate_rare`, `tier_pirate_outfits`, `tier_egg_outfits`, `tier_crow_case_melee`, `tier_crow_case_skin`, `tier_barn_melee`, `tier_fragtastic`, `tier_dev_guns`, `tier_dev_melee` [src:kong/relaunch-client-defs] [src:derived/base-tiers-unreferenced-by-0.8.82-objects] [M]
- Some tiers in that list may be original but only reached through nesting or code (e.g. `tier_scopes`, `tier_xp_*`, `tier_halloween_mystery_perks`, `tier_faction_outfits`), so "unreferenced" is not proof of fork origin [src:survev/server/src/game/objects/player.ts:3926-3931] [L]
- (fork) `tier_saloon` gained `tier_airdrop_crimson` (w0.22) in 0.3.1 [src:survev/shared/defs/maps/baseDefs.ts:674-678] [src:balance/318] [H]
- (fork) `tier_airdrop_mythic` reweighted in 0.2.3 (usas 0.5 → 1, awc 0.1 → 0.75, pkp 0.3 → 1, m249 0.3 → 1, sv98 added) and `barrett` added in 0.4.0. Pre-fork survev weights were usas 0.5, awc 0.1, pkp 0.3, m249 0.3 [src:balance/276-277] [src:balance/330] [H]
- (fork) "+ Added bar to normal loot tables" (`tier_guns` `bar` 0.05) [src:balance/146] [H]
- Cobalt pod tables (`tier_guns_common_*`, `tier_guns_rare_*`) were rebalanced in 2025-10-22, 0.3.0 and 0.3.01 [src:balance/182-193] [src:balance/285-313] [H]
- Fandom's original pod lists: recon common = dual G18C, dual OT-38; sniper common = BLR, Mosin; medic common = Mk 12, M39; demo common = M870, SPAS-12; assault common = AK-47, M416, Groza, FAMAS; tank common = DP-28, QBB-97; rare: recon = dual OTs-38, dual P30L, dual DEagle; sniper = Mosin, AWM-S; medic = SVD, L86, Garand; demo = MP220, Saiga, USAS; assault = SCAR, Groza-S, M4A1, AN-94; tank = QBB-97, M249, PKP, M134 [src:fandom/Loot_tables/Class_Pod] [M]
- balance.txt mixes per-mode table edits (winter, savannah, PvT) without always naming the map. Treat `provenance/balance-revert.md` as the authority for reverting them [src:balance/200-352] [L]

## Base loot tables (survev Main, all tiers)

> One row per tier in `Main.lootTable` (baseDefs.ts lines 93–811). Entries are `id×count:weight`; `(nothing)` is the empty name `""`. Markers are the survev comments: `?` guess from statistics, `!` uncertain leak data, TODO.

| tier | entries | markers | sources |
|---|---|---|---|
| `tier_world` | `tier_guns`:0.29, `tier_ammo`:0.04, `tier_scopes`:0.15, `tier_armor`:0.1, `tier_medical`:0.17, `tier_throwables`:0.05, `tier_packs`:0.09 | ? TODO | [src:survev/shared/defs/maps/baseDefs.ts:94-102] [L] |
| `tier_surviv` | `tier_scopes`:0.15, `tier_armor`:0.1, `tier_medical`:0.17, `tier_throwables`:0.05, `tier_packs`:0.09 | ? TODO | [src:survev/shared/defs/maps/baseDefs.ts:103-109] [L] |
| `tier_container` | `tier_guns`:0.29, `tier_ammo`:0.04, `tier_scopes`:0.15, `tier_armor`:0.1, `tier_medical`:0.17, `tier_throwables`:0.05, `tier_packs`:0.09, `tier_outfits`:0.035 | ! | [src:survev/shared/defs/maps/baseDefs.ts:110-119] [L] |
| `tier_leaf_pile` | `tier_ammo`:0.2, `tier_scopes`:0.2, `tier_armor`:0.2, `tier_medical`:0.2, `tier_throwables`:0.15, `tier_packs`:0.05 | — | [src:survev/shared/defs/maps/baseDefs.ts:120-127] [M] |
| `tier_soviet` | `tier_guns`:3, `tier_armor`:2, `tier_packs`:1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:128-132] [L] |
| `tier_toilet` | `tier_guns`:0.1, `tier_scopes`:0.05, `tier_medical`:0.6, `tier_throwables`:0.05, `tier_outfits`:0.025 | ! | [src:survev/shared/defs/maps/baseDefs.ts:133-139] [L] |
| `tier_scopes` | `2xscope`:24, `4xscope`:5, `8xscope`:1, `15xscope`:0.02 | ? | [src:survev/shared/defs/maps/baseDefs.ts:140-145] [L] |
| `tier_armor` | `helmet01`:9, `helmet02`:6, `helmet03`:0.2, `chest01`:15, `chest02`:6, `chest03`:0.2 | ! | [src:survev/shared/defs/maps/baseDefs.ts:146-153] [L] |
| `tier_packs` | `backpack01`:15, `backpack02`:6, `backpack03`:0.2 | ! | [src:survev/shared/defs/maps/baseDefs.ts:154-158] [L] |
| `tier_medical` | `bandage`×5:16, `healthkit`:4, `soda`:15, `painkiller`:5 | — | [src:survev/shared/defs/maps/baseDefs.ts:159-164] [M] |
| `tier_throwables` | `frag`×2:1, `smoke`:1, `mirv`×2:0.05 | ! | [src:survev/shared/defs/maps/baseDefs.ts:165-169] [L] |
| `tier_ammo` | `9mm`×60:3, `762mm`×60:3, `556mm`×60:3, `12gauge`×10:3 | — | [src:survev/shared/defs/maps/baseDefs.ts:170-175] [M] |
| `tier_ammo_crate` | `9mm`×60:3, `762mm`×60:3, `556mm`×60:3, `12gauge`×10:3, `50AE`×21:1, `308sub`×5:1, `flare`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:176-184] [M] |
| `tier_vending_soda` | `soda`:1, `tier_ammo`:1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:185-188] [L] |
| `tier_sv98` | `sv98`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:189-189] [M] |
| `tier_scopes_sniper` | `4xscope`:5, `8xscope`:1, `15xscope`:0.02 | ? | [src:survev/shared/defs/maps/baseDefs.ts:190-194] [L] |
| `tier_mansion_floor` | `outfitCasanova`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:195-195] [M] |
| `tier_vault_floor` | `outfitJester`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:196-196] [M] |
| `tier_police_floor` | `outfitPrisoner`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:197-197] [M] |
| `tier_fragtastic` | `(nothing)`:1, `outfitFragtastic`:0.15 | — | [src:survev/shared/defs/maps/baseDefs.ts:198-201] [M] |
| `tier_chrys_01` | `outfitImperial`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:202-202] [M] |
| `tier_chrys_02` | `katana`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:203-203] [M] |
| `tier_chrys_03` | `4xscope`:7.5, `8xscope`:5, `15xscope`:0.25 | (fork) set 2026-05-30 (`7d063420`); survev's earlier guess was `2xscope`:5, `4xscope`:5, `8xscope`:5, `15xscope`:0.1, all `?` | [src:survev/shared/defs/maps/baseDefs.ts:205-209] [src:derived/survev-git-7d063420] [L] |
| `tier_chrys_case` | `(nothing)`:5, `tier_katanas`:3, `naginata`:1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:210-214] [L] |
| `tier_crow_case_melee` | `crowbar`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:215-215] [M] |
| `tier_crow_case_skin` | `tier_outfits`:0.8, `outfitVerde`:0.2 | — | [src:survev/shared/defs/maps/baseDefs.ts:216-219] [M] |
| `tier_eye_02` | `stonehammer`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:220-220] [M] |
| `tier_eye_block` | `m9`:1, `ots38_dual`:1, `flare_gun`:1, `colt45`:1, `45acp`:1, `painkiller`:1, `m4a1`:1, `m249`:1, `awc`:1, `pkp`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:221-232] [M] |
| `tier_eye_stone` | `vector45`:1, `45acp`:1, `garand`:1, `strobe`:1, `healthkit`:1, `painkiller`:1, `m4a1`:0.7, `m249`:0.2, `scarssr`:0.1, `awc`:0.1, `pkp`:0.1 | — | [src:survev/shared/defs/maps/baseDefs.ts:233-245] [M] |
| `tier_barn_melee` | `sledgehammer`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:246-246] [M] |
| `tier_chest_04` | `p30l`:40, `p30l_dual`:1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:247-250] [L] |
| `tier_woodaxe` | `woodaxe`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:251-251] [M] |
| `tier_club_melee` | `machete_taiga`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:252-252] [M] |
| `tier_guns` | `famas`:0.9, `hk416`:4, `mk12`:0.1, `pkp`:0.005, `m249`:0.006, `ak47`:2.7, `scar`:0.01, `dp28`:0.5, `bar`:0.05, `mosin`:0.05, `m39`:0.1, `mp5`:10, `mac10`:6, `ump9`:3, `m870`:9, `m1100`:6, `mp220`:2, `saiga`:0.1, `ot38`:8, `m9`:19, `m93r`:5, `glock`:7, `deagle`:0.05, `vector`:0.01, `sv98`:0.01, `spas12`:1, `qbb97`:0.01, `flare_gun`:0.145, `flare_gun_dual`:0.0025, `groza`:0.8, `scout_elite`:0.1, `vss`:0.1 | ! | [src:survev/shared/defs/maps/baseDefs.ts:253-286] [L] |
| `tier_police` | `scar`:0.5, `helmet03`:0.15, `chest03`:0.1, `backpack03`:0.25 | — | [src:survev/shared/defs/maps/baseDefs.ts:287-292] [M] |
| `tier_ring_case` | `grozas`:0.75, `ots38_dual`:0.15, `pkp`:0.1, `m9`:0.01 | ? | [src:survev/shared/defs/maps/baseDefs.ts:293-298] [L] |
| `tier_chest` | `famas`:1.15, `hk416`:4, `mk12`:0.55, `m249`:0.07, `ak47`:4, `scar`:0.27, `dp28`:0.55, `bar`:0.27, `mosin`:0.55, `m39`:0.55, `saiga`:0.26, `mp220`:1.5, `deagle`:0.15, `vector`:0.1, `sv98`:0.1, `spas12`:1, `groza`:1.15, `helmet02`:1, `helmet03`:0.25, `chest02`:1, `chest03`:0.25, `4xscope`:0.5, `8xscope`:0.25 | — | [src:survev/shared/defs/maps/baseDefs.ts:299-323] [M] |
| `tier_conch` | `outfitAqua`:1, `outfitCoral`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:324-327] [M] |
| `tier_noir_outfit` | `outfitNoir`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:328-328] [M] |
| `tier_khaki_outfit` | `outfitKhaki`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:329-329] [M] |
| `tier_pirate_melee` | `hook`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:330-330] [M] |
| `tier_hatchet` | `vector`:0.4, `bar`:0.25, `mp220`:0.15, `pkp`:0.01, `m249`:0.01, `m9`:0.01 | — | [src:survev/shared/defs/maps/baseDefs.ts:331-338] [M] |
| `tier_lmgs` | `dp28`:2, `bar`:1.5, `qbb97`:0.5, `m249`:0.05, `pkp`:0.05 | ? | [src:survev/shared/defs/maps/baseDefs.ts:339-345] [L] |
| `tier_shotguns` | `spas12`:2, `mp220`:1.5, `m1100`:1, `m870`:1, `saiga`:0.15, `usas`:0.01 | ? | [src:survev/shared/defs/maps/baseDefs.ts:346-353] [L] |
| `tier_snipers` | `model94`:6, `blr`:6, `scout_elite`:3, `mk12`:2, `m39`:2, `vss`:1.5, `mosin`:0.75, `mkg45`:0.75, `l86`:0.75, `svd`:0.75, `garand`:0.45, `scarssr`:0.15, `awc`:0.15, `sv98`:0.1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:354-369] [L] |
| `tier_hatchet_melee` | `fireaxe`:5, `tier_katanas`:3, `stonehammer`:1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:370-374] [L] |
| `tier_fireaxe` | `fireaxe`:5 | — | [src:survev/shared/defs/maps/baseDefs.ts:375-377] [M] |
| `tier_pavilion` | `naginata`:2, `pkp`:2, `dp28`:1, `bar`:1, `m9`:1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:378-384] [L] |
| `tier_safe` | `m9`:0.01, `fabricate`:1, `flak_jacket`:1, `explosive`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:385-390] [M] |
| `tier_safe_throwables` | `(nothing)`:1, `strobe`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:391-394] [M] |
| `tier_forest_helmet` | `helmet03_forest`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:395-395] [M] |
| `tier_outfits` | `outfitCobaltShell`:0.3, `outfitKeyLime`:0.25, `outfitWoodland`:0.3, `outfitCamo`:0.2, `outfitGhillie`:0.01 | — | [src:survev/shared/defs/maps/baseDefs.ts:396-402] [M] |
| `tier_egg_outfits` | `outfitBarrel`:1, `outfitWoodBarrel`:1, `outfitStone`:1, `outfitSpringTree`:1, `outfitBush`:1, `outfitCrate`:1, `outfitTable`:1, `outfitSoviet`:1, `outfitOven`:1, `outfitRefrigerator`:1, `outfitVending`:1, `outfitToilet`:1, `outfitBushRiver`:1, `outfitCrab`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:403-418] [M] |
| `tier_pirate_outfits` | `outfitRoyalFortune`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:419-419] [M] |
| `tier_islander_outfit` | `outfitIslander`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:420-420] [M] |
| `tier_imperial_outfit` | `outfitImperial`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:421-421] [M] |
| `tier_pineapple_outfit` | `outfitPineapple`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:422-422] [M] |
| `tier_tarkhany_outfit` | `outfitTarkhany`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:423-423] [M] |
| `tier_spetsnaz_outfit` | `outfitSpetsnaz`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:424-424] [M] |
| `tier_lumber_outfit` | `outfitLumber`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:425-425] [M] |
| `tier_verde_outfit` | `outfitVerde`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:426-426] [M] |
| `tier_coconut_outfit` | `(nothing)`:19, `outfitCoconut`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:427-430] [M] |
| `tier_guns_common_scout` | `glock_dual`:1, `ot38_dual`:1, `m93r_dual`:1, `deagle`:0.3 | — | [src:survev/shared/defs/maps/baseDefs.ts:434-439] [M] |
| `tier_guns_common_sniper` | `blr`:1, `mosin`:0.2, `scout_elite`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:440-444] [M] |
| `tier_guns_common_healer` | `mk12`:1, `m39`:1, `vss`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:445-449] [M] |
| `tier_guns_common_demo` | `m870`:1, `spas12`:1, `mp220`:0.5 | — | [src:survev/shared/defs/maps/baseDefs.ts:450-454] [M] |
| `tier_guns_common_assault` | `hk416`:1, `ak47`:1, `groza`:1, `famas`:1, `scar`:0.4 | — | [src:survev/shared/defs/maps/baseDefs.ts:455-461] [M] |
| `tier_guns_common_tank` | `dp28`:1, `imbel`:0.5, `qbb97`:0.25, `bar`:0.5 | — | [src:survev/shared/defs/maps/baseDefs.ts:462-467] [M] |
| `tier_guns_common_classless` | `glock_dual`:1, `m93r_dual`:1, `blr`:1, `scout_elite`:1, `mk12`:1, `m39`:1, `m870`:1, `spas12`:1, `ak47`:1, `famas`:1, `imbel`:1, `bar`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:468-481] [M] |
| `tier_guns_rare_scout` | `ots38_dual`:1, `p30l_dual`:0.75, `deagle_dual`:0.75 | — | [src:survev/shared/defs/maps/baseDefs.ts:482-486] [M] |
| `tier_guns_rare_sniper` | `mosin`:1, `sv98`:0.2, `awc`:0.1 | — | [src:survev/shared/defs/maps/baseDefs.ts:487-491] [M] |
| `tier_guns_rare_demo` | `saiga`:0.5, `spas16`:0.4, `usas`:0.15, `m1014`:0.15 | — | [src:survev/shared/defs/maps/baseDefs.ts:492-497] [M] |
| `tier_guns_rare_healer` | `svd`:1, `l86`:1, `garand`:0.44, `scarssr`:0.2 | — | [src:survev/shared/defs/maps/baseDefs.ts:498-503] [M] |
| `tier_guns_rare_assault` | `scar`:1, `grozas`:1, `m4a1`:1, `an94`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:504-509] [M] |
| `tier_guns_rare_tank` | `qbb97`:1, `pkp`:0.1, `m249`:0.2 | — | [src:survev/shared/defs/maps/baseDefs.ts:510-514] [M] |
| `tier_guns_rare_classless` | `ots38_dual`:1, `p30l_dual`:1, `mosin`:1, `sv98`:1, `saiga`:1, `spas16`:1, `l86`:1, `garand`:1, `grozas`:1, `m4a1`:1, `m249`:1, `pkp`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:515-528] [M] |
| `tier_class_crate_mythic` | `scavenger_adv`:1, `explosive`:1, `splinter`:1, `lifeline`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:529-534] [M] |
| `tier_throwables_demo` | `frag`×3:1, `mirv`×2:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:535-538] [M] |
| `tier_health_healer` | `bandage`×5:4, `healthkit`:6 | — | [src:survev/shared/defs/maps/baseDefs.ts:539-542] [M] |
| `tier_scavenger_adv` | `m9`:1, `ots38_dual`:1, `p30l_dual`:1, `saiga`:1, `spas16`:1, `deagle_dual`:1, `vector`:1, `scorpion`:1, `m4a1`:1, `garand`:1, `grozas`:1, `flare_gun`:1, `awc`:1, `scarssr`:1, `pkp`:1, `m249`:1, `sv98`:1, `pan`:1, `8xscope`:1, `15xscope`:1, `mirv`×4:1, `outfitGhillie`:1, `painkiller`×2:1, `healthkit`:1, `helmet03`:1, `chest03`:1, `backpack03`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:543-571] [M] |
| `tier_pirate` | `tier_ammo`:0.1, `tier_scopes`:0.1, `tier_armor`:0.05, `tier_medical`:0.25, `tier_throwables`:0.15, `tier_packs`:0.05 | — | [src:survev/shared/defs/maps/baseDefs.ts:572-579] [M] |
| `tier_pirate_rare` | `m9`:0.5, `m4a1`:1, `scorpion`:1, `scar`:1, `flare_gun`:1, `garand`:0.75, `mosin`:0.5, `deagle`:1, `saiga`:1, `p30l_dual`:0.5, `deagle_dual`:0.5, `sv98`:0.3, `awc`:0.3, `m249`:0.25 | — | [src:survev/shared/defs/maps/baseDefs.ts:580-595] [M] |
| `tier_airdrop_uncommon` | `mk12`:2.5, `scar`:0.75, `bar`:1, `mosin`:1.5, `m39`:2.5, `saiga`:1, `deagle`:1, `vector`:1, `sv98`:0.5, `qbb97`:1.5, `m9`:0.01, `flare_gun`:0.5, `scout_elite`:2.5, `vss`:2.5 | ! | [src:survev/shared/defs/maps/baseDefs.ts:596-611] [L] |
| `tier_airdrop_rare` | `garand`:6, `awc`:3, `pkp`:0.08, `m249`:0.1, `m4a1`:4, `scorpion`:5, `ots38_dual`:4.5 | ? | [src:survev/shared/defs/maps/baseDefs.ts:612-620] [L] |
| `tier_airdrop_crimson` | `deagle_dual`:1, `ash12`:1, `sw500`:1, `barrett`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:621-626] [M] |
| `tier_airdrop_mythic` | `usas`:1, `scarssr`:1, `sv98`:1, `p30l_dual`:1, `pkp`:1, `m249`:1, `barrett`:1, `awc`:0.75 | — | [src:survev/shared/defs/maps/baseDefs.ts:627-636] [M] |
| `tier_airdrop_ammo` | `9mm`×30:3, `762mm`×30:3, `556mm`×30:3, `12gauge`×5:3 | — | [src:survev/shared/defs/maps/baseDefs.ts:637-642] [M] |
| `tier_airdrop_outfits` | `(nothing)`:20, `outfitMeteor`:5, `outfitHeaven`:1, `outfitGhillie`:0.5 | ! | [src:survev/shared/defs/maps/baseDefs.ts:643-648] [L] |
| `tier_airdrop_throwables` | `frag`×2:1, `mirv`×2:0.5 | — | [src:survev/shared/defs/maps/baseDefs.ts:649-652] [M] |
| `tier_airdrop_melee` | `(nothing)`:19, `pan`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:653-656] [M] |
| `tier_airdrop_armor` | `helmet03`:1, `chest03`:1, `backpack03`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:657-661] [M] |
| `tier_airdrop_scopes` | `(nothing)`:24, `4xscope`:5, `8xscope`:1, `15xscope`:0.02 | ? | [src:survev/shared/defs/maps/baseDefs.ts:662-667] [L] |
| `tier_katanas` | `katana`:4, `katana_rusted`:4, `katana_orchid`:1 | ? | [src:survev/shared/defs/maps/baseDefs.ts:668-672] [L] |
| `tier_stonehammer` | `stonehammer`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:673-673] [M] |
| `tier_saloon` | `vector45`:1, `mkg45`:1, `tier_airdrop_crimson`:0.22 | — | [src:survev/shared/defs/maps/baseDefs.ts:674-678] [M] |
| `tier_cattle_crate` | `m1a1`:1, `model94`:1, `colt45`:1, `outfitVerde`:0.1, `outfitDesertCamo`:0.3 | (fork) desert camo raised 0.1 → 0.3 (2025-09-09, `47f7af83`) | [src:survev/shared/defs/maps/baseDefs.ts:679-685] [src:balance/147] [M] |
| `tier_cloud_02` | `(nothing)`:1, `outfitWheat`:0.3 | — | [src:survev/shared/defs/maps/baseDefs.ts:686-689] [M] |
| `tier_pumpkin_candy` | `(nothing)`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:691-691] [M] |
| `tier_pumpkin_perks` | `halloween_mystery`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:692-692] [M] |
| `tier_xp_uncommon` | `xp_book_tallow`:1, `xp_book_greene`:1, `xp_book_parma`:1, `xp_book_nevelskoy`:1, `xp_book_rinzo`:1, `xp_book_kuga`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:693-700] [M] |
| `tier_xp_rare` | `xp_glasses`:0.1, `xp_compass`:0.1, `xp_stump`:0.1, `xp_bone`:0.1 | — | [src:survev/shared/defs/maps/baseDefs.ts:701-706] [M] |
| `tier_xp_mythic` | `xp_donut`:0.01 | — | [src:survev/shared/defs/maps/baseDefs.ts:707-707] [M] |
| `tier_fruit_xp` | `(nothing)`:40 | — | [src:survev/shared/defs/maps/baseDefs.ts:709-716] [M] |
| `tier_airdrop_xp` | `(nothing)`:15 | — | [src:survev/shared/defs/maps/baseDefs.ts:717-724] [M] |
| `tier_halloween_mystery_perks` | `trick_nothing`:1, `trick_size`:1, `trick_m9`:1, `trick_chatty`:1, `trick_drain`:1, `treat_9mm`:1, `treat_12g`:1, `treat_556`:1, `treat_762`:1, `treat_super`:0.1 | — | [src:survev/shared/defs/maps/baseDefs.ts:725-737] [M] |
| `tier_faction_outfits` | `outfitVerde`:1, `outfitWoodland`:1, `outfitKeyLime`:1, `outfitCamo`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:738-743] [M] |
| `tier_airdrop_faction_outfits` | `outfitGhillie`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:744-744] [M] |
| `tier_airdrop_faction_melee` | `pan`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:745-745] [M] |
| `tier_perks` | `firepower`:1, `windwalk`:1, `endless_ammo`:1, `steelskin`:1, `splinter`:1, `small_arms`:1, `takedown`:1, `field_medic`:1, `tree_climbing`:1, `scavenger`:1, `chambered`:1, `martyrdom`:1, `self_revive`:1, `bonus_9mm`:1, `bonus_45`:1, `high_velocity`:1 | (fork) `high_velocity` is not in the 0.8.82 client | [src:survev/shared/defs/maps/baseDefs.ts:746-763] [src:kong/relaunch-client-defs] [M] |
| `tier_crimson_perks` | `ap_rounds`:1, `splinter`:1, `steelskin`:1, `takedown`:1, `windwalk`:1, `field_medic`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:764-771] [M] |
| `tier_potato_perks` | `(nothing)`:25, `tier_perks`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:772-775] [M] |
| `tier_airdrop_potato` | `potato_cannon`:1, `potato_smg`:1, `potato_lmg`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:776-780] [M] |
| `tier_dev_guns` | `m1100`:11, `m9`:9, `m1911`:3, `garand`:1, `m9_cursed`:0.1 | — | [src:survev/shared/defs/maps/baseDefs.ts:781-787] [M] |
| `tier_dev_melee` | `bowie_frontier`:1, `bowie_vintage`:1, `huntsman_burnished`:1, `huntsman_rugged`:1, `bayonet_woodland`:1, `bayonet_rugged`:1, `karambit_drowned`:1, `karambit_prismatic`:1 | — | [src:survev/shared/defs/maps/baseDefs.ts:788-797] [M] |
| `tier_revolvers` | `ot38`:5, `colt45`:5, `ots38`:2, `sw500`:0.5 | — | [src:survev/shared/defs/maps/baseDefs.ts:798-803] [M] |
| `tier_toilet_gold` | `(nothing)`:0.95, `awc`:0.02, `garand`:0.02, `m9`:0.01 | — | [src:survev/shared/defs/maps/baseDefs.ts:804-809] [M] |
| `tier_knives` | (empty) | — | [src:survev/shared/defs/maps/baseDefs.ts:810-810] [M] |

## Per-mode loot table overrides (tier names only)

| map | overridden tiers | sources |
|---|---|---|
| Desert | `tier_guns`, `tier_airdrop_uncommon`, `tier_airdrop_rare`, `tier_ammo`, `tier_ammo_crate`, `tier_airdrop_ammo`, `tier_airdrop_outfits`, `tier_airdrop_melee`, `tier_chest`, `tier_hatchet`, `tier_throwables`, `tier_airdrop_throwables`, `tier_perks`, `tier_crow_case_melee`, `tier_pirate_rare` | [src:survev/shared/defs/maps/desertDefs.ts:68-230] [M] |
| Woods | `tier_toilet`, `tier_guns`, `tier_ammo`, `tier_ammo_crate`, `tier_throwables`, `tier_armor`, `tier_packs`, `tier_chest`, `tier_airdrop_throwables`, `tier_airdrop_uncommon`, `tier_airdrop_rare`, `tier_airdrop_ammo`, `tier_hatchet`, `tier_airdrop_melee` | [src:survev/shared/defs/maps/woodsDefs.ts:65-161] [M] |
| 50v50 (faction) | `tier_guns`, `tier_toilet`, `tier_container`, `tier_medical`, `tier_airdrop_uncommon`, `tier_airdrop_rare`, `tier_airdrop_melee`, `tier_airdrop_outfits`, `tier_airdrop_scopes`, `tier_ammo_crate`, `tier_mansion_floor`, `tier_conch`, `tier_chrys_01` | [src:survev/shared/defs/maps/factionDefs.ts:248-399] [M] |
| Potato | `tier_guns`, `tier_throwables`, `tier_airdrop_throwables`, `tier_ammo`, `tier_ammo_crate`, `tier_airdrop_ammo`, `tier_armor`, `tier_police`, `tier_airdrop_armor`, `tier_hatchet`, `tier_ring_case`, `tier_airdrop_rare` | [src:survev/shared/defs/maps/potatoDefs.ts:70-162] [M] |
| Potato spring | `tier_chrys_case`, `tier_airdrop_outfits` | [src:survev/shared/defs/maps/potatoSpringDefs.ts:46-57] [M] |
| Halloween | `tier_throwables`, `tier_airdrop_outfits`, `tier_toilet`, `tier_container`, `tier_scopes`, `tier_airdrop_scopes`, `tier_outfits` | [src:survev/shared/defs/maps/halloweenDefs.ts:132-200] [M] |
| Snow | `tier_airdrop_outfits`, `tier_throwables`, `tier_sv98`, `tier_guns`, `tier_chest`, `tier_barn_melee`, `tier_airdrop_melee`, `tier_airdrop_uncommon`, `tier_airdrop_rare`, `tier_airdrop_throwables`, `tier_eye_block`, `tier_crow_case_melee`, `tier_outfits` | [src:survev/shared/defs/maps/snowDefs.ts:72-203] [M] |
| Woods snow | `tier_throwables`, `tier_airdrop_throwables`, `tier_airdrop_melee`, `tier_airdrop_outfits`, `tier_outfits`, `tier_hatchet_melee`, `tier_eye_block` | [src:survev/shared/defs/maps/woodsSnowDefs.ts:42-91] [M] |
| Savannah | `tier_scopes`, `tier_guns`, `tier_armor`, `tier_airdrop_uncommon`, `tier_airdrop_rare`, `tier_ammo`, `tier_ammo_crate`, `tier_airdrop_ammo`, `tier_chest`, `tier_hatchet`, `tier_throwables`, `tier_airdrop_throwables`, `tier_crow_case_skin`, `tier_crow_case_melee`, `tier_perks` | [src:survev/shared/defs/maps/savannahDefs.ts:44-190] [M] |
| Cobalt | `tier_outfits` (replaced by chest02/helmet02 so no outfits drop), `tier_armor` ((fork) added in 0.3.01, 2026-05-14 `a04c6e00`; before that survev's Cobalt used Main's `tier_armor`), the floor/outfit tiers redirected to `tier_outfits`, `tier_fragtastic`, `tier_conch`, `tier_noir_outfit`, `tier_khaki_outfit`, `tier_islander_outfit`, `tier_imperial_outfit`, `tier_club_melee`, `tier_airdrop_outfits` | [src:survev/shared/defs/maps/cobaltDefs.ts:56-83] [M] |
| Birthday | `tier_world`, `tier_scopes`, `tier_armor`, `tier_packs`, `tier_medical`, `tier_guns`, `tier_outfits` (header marks it as not original) | [src:survev/shared/defs/maps/birthdayDefs.ts:50-104] [M] |
| Main spring / woods spring | `tier_chrys_case` ("this override is not from the leak!") | [src:survev/shared/defs/maps/mainSpringDefs.ts:29-37] [src:survev/shared/defs/maps/woodsSpringDefs.ts:41-49] [M] |
| (fork) Beach | `tier_soviet`, `tier_throwables`, `tier_chest`, `tier_airdrop_throwables`, `tier_pirate_melee`, `tier_outfits`, `tier_airdrop_melee`, `tier_airdrop_outfits`, `tier_pirate_outfits` | [src:survev/shared/defs/maps/beachDefs.ts:60-125] [M] |
| (fork) Potato vs Tomato | `tier_throwables`, `tier_ammo`, `tier_ammo_crate`, `tier_airdrop_ammo`, `tier_armor`, `tier_police`, `tier_airdrop_armor`, `tier_airdrop_rare`, `tier_airdrop_throwables` | [src:survev/shared/defs/maps/factionPotatoDefs.ts:229-315] [M] |
| Turkey, main summer, woods summer | no loot-table overrides (inherit Main/Woods) | [src:survev/shared/defs/maps/turkeyDefs.ts] [src:survev/shared/defs/maps/mainSummerDefs.ts] [src:survev/shared/defs/maps/woodsSummerDefs.ts] [M] |

- Changelog drop-rate notes for the per-mode tables: 0.6.31 "Removed DP-28 from air drops"; 0.7.1 "Removed knives from drop tables"; 0.7.51 "Increased PKP drop rate in desert map"; many MP220/M870/QBB/Saiga/M9 nerfs in 0.1.x–0.6.x [src:changelog/0.6.31] [src:changelog/0.7.1] [src:changelog/0.7.51] [src:changelog/0.6.6] [H]
- Changelog 0.1.5: "Military crate now has a higher chance to drop guns, armor and backpacks"; 0.1.6 "Increased chance for medical items to drop" and "Decreased chance for armor items to drop" [src:changelog/0.1.5] [src:changelog/0.1.6] [H]
- Fandom's 50v50 secret update (Feb 5 2019) gave faction tiers special outfits (Cobalt Shell in the Chrysanthemum bunker, Key Lime in Tier Conch, The Professional in the mansion), matching faction overrides of `tier_chrys_01`, `tier_conch`, `tier_mansion_floor` [src:wikigg/50v50_mode] [src:survev/shared/defs/maps/factionDefs.ts:248-399] [M]

## Obstacle loot specs: survev vs 0.8.82 client

> Every map obstacle with a non-empty `loot` list. "original" means survev equals the relaunch client def; "DIFFERS" gives the original value; "(fork)" means the id is not in the 0.8.82 client. Air-drop shells have empty loot (their contents are on the `crate_1x` they turn into). Destroyed buildings and loot spawners are listed above.

| obstacle | HP | loot (rolls) | status | sources |
|---|---|---|---|---|
| `barrel_01b` | 150 | tier_surviv 2–3; mirv (×3) | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:456] [src:kong/relaunch-client-defs] [H] |
| `barrel_01bh` | 150 | tier_surviv 1–2; coconut ×4 (×3); mirv | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:474] [M] |
| `barrel_01f` | 150 | tier_surviv 2–3; chest02; mirv ×2 (×2); frag ×6 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:484] [M] |
| `barrel_01w` | 150 | tier_surviv 1; chest03; mirv; strobe | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:465] [M] |
| `barrel_02` | 60 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:653] [src:kong/relaunch-client-defs] [H] |
| `barrel_03` | 20 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:654] [src:kong/relaunch-client-defs] [H] |
| `barrel_04` | 20 | tier_soviet 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:663] [src:kong/relaunch-client-defs] [H] |
| `barrel_05` | 80 | tier_surviv 0–2; tier_coconut_outfit 1; coconut ×4 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:673] [M] |
| `bookshelf_01` | 75 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:698] [src:kong/relaunch-client-defs] [H] |
| `bookshelf_02` | 75 | tier_soviet 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:702] [src:kong/relaunch-client-defs] [H] |
| `case_01` | 75 | deagle (preload) | DIFFERS — original: deagle | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194] [src:kong/relaunch-client-defs] [H] |
| `case_02` | 75 | deagle_dual (preload) | DIFFERS — original: deagle (×2) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:195] [src:kong/relaunch-client-defs] [H] |
| `case_03` | 140 | tier_hatchet 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:199] [src:kong/relaunch-client-defs] [H] |
| `case_04` | 140 | flare_gun | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:208] [src:kong/relaunch-client-defs] [H] |
| `case_05` | 140 | flare_gun; strobe (×4) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:218] [src:kong/relaunch-client-defs] [H] |
| `case_06` | 140 | tier_chest 2–3; tier_chrys_case 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:234] [src:kong/relaunch-client-defs] [H] |
| `case_07` | 200 | tier_ring_case 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:241] [src:kong/relaunch-client-defs] [H] |
| `case_07de` | 200 | tier_airdrop_crimson 1; backpack03; 4xscope | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:248] [M] |
| `case_08` | 140 | tier_armor 1; tier_medical 1–2; tier_crow_case_melee 1; tier_crow_case_skin 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:259] [M] |
| `case_08sv` | 140 | tier_armor 1; tier_medical 1–2; tier_perks 1; tier_crow_case_melee 1; tier_crow_case_skin 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:271] [M] |
| `case_09` | 140 | tier_guns_rare_classless 1; healthkit; soda ×2; 4xscope; chest02; backpack02; naginata_daemon | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:284] [M] |
| `case_10` | 140 | backpack04_cloud; tier_perks 1; tier_ammo 2–3; tier_medical 2 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:301] [M] |
| `chest_01` | 140 | tier_chest 3–4; tier_pirate_melee 1; tier_pirate_outfits 1 | DIFFERS — original: tier_chest 3–4; tier_pirate_melee 1; outfitRoyalFortune | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:315] [src:kong/relaunch-client-defs] [H] |
| `chest_01cb` | 140 | tier_chest 3–4; tier_pirate_melee 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:322] [src:kong/relaunch-client-defs] [H] |
| `chest_02` | 140 | tier_chest 2 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:325] [src:kong/relaunch-client-defs] [H] |
| `chest_03` | 140 | tier_chest 3–5; outfitWaterElem | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:330] [src:kong/relaunch-client-defs] [H] |
| `chest_03cb` | 140 | tier_chest 3–5 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:334] [src:kong/relaunch-client-defs] [H] |
| `chest_03d` | 140 | tier_chest 3–5; outfitWaterElem | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:338] [src:kong/relaunch-client-defs] [H] |
| `chest_03f` | 140 | tier_chest 3–5; outfitKhaki | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:342] [src:kong/relaunch-client-defs] [H] |
| `chest_03sv` | 140 | tier_chest 3–5; outfitWaterElem | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:346] [M] |
| `chest_03tr` | 140 | tier_chest 3–5; outfitWaterElem | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:354] [M] |
| `chest_03x` | 140 | tier_chest 3–5; outfitWaterElem | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:350] [src:kong/relaunch-client-defs] [H] |
| `chest_04` | 200 | tier_noir_outfit 1; tier_chest_04 1; glock_dual; smoke ×4 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:358] [src:kong/relaunch-client-defs] [H] |
| `chest_04d` | 200 | tier_noir_outfit 1; tier_chest_04 1; 9mm ×300; smoke ×4; backpack02 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:369] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_assault` | 150 | tier_guns_common_assault 2; spade_assault; bandage ×5; helmet01; chest01; backpack01 | DIFFERS — original: tier_guns_common_assault 2; spade_assault; helmet01; backpack01 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1303] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_classless` | 150 | tier_guns_common_classless 1; tier_medical 1–2; tier_throwables 1–2; tier_ammo 1; naginata_daemon | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1324] [M] |
| `class_crate_common_demo` | 150 | tier_guns_common_demo 1; katana_demo; helmet01; chest01; backpack02; 2xscope; tier_throwables_demo 3–4 | DIFFERS — original: tier_guns_common_demo 1; katana_demo; helmet01; backpack02; mirv (×6) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1291] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_healer` | 150 | tier_guns_common_healer 1; bonesaw_healer; helmet01; backpack01; tier_health_healer 1; painkiller; smoke ×3 | DIFFERS — original: tier_guns_common_healer 1; bonesaw_healer; helmet01; backpack01; healthkit; painkiller; smoke ×3 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1279] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_scout` | 150 | tier_guns_common_scout 1; crowbar_scout; helmet01; backpack01; soda ×2 | DIFFERS — original: tier_guns_common_scout 1; crowbar_scout; helmet01; backpack01; soda (×3) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1259] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_sniper` | 150 | tier_guns_common_sniper 1; kukri_sniper; helmet01; backpack01; 4xscope | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1269] [src:kong/relaunch-client-defs] [H] |
| `class_crate_common_tank` | 150 | tier_guns_common_tank 1; warhammer_tank; helmet02; chest02; backpack01 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1314] [src:kong/relaunch-client-defs] [H] |
| `class_crate_mythic` | 150 | tier_class_crate_mythic 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1418] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_assault` | 150 | tier_guns_rare_assault 2; spade_assault; tier_airdrop_armor 1; tier_medical 1; tier_airdrop_scopes 1; tier_airdrop_ammo 2; tier_airdrop_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1382] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_classless` | 150 | tier_guns_rare_classless 1; naginata_daemon; chest03; tier_medical 2–3; tier_airdrop_throwables 2; tier_airdrop_scopes 1; tier_airdrop_ammo 2 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1406] [M] |
| `class_crate_rare_demo` | 150 | tier_guns_rare_demo 1; katana_demo; tier_airdrop_armor 1; tier_medical 1; tier_airdrop_scopes 1; tier_airdrop_ammo 2; tier_throwables_demo 4–5 | DIFFERS — original: tier_guns_rare_demo 1; katana_demo; tier_airdrop_armor 1; tier_medical 1; tier_airdrop_scopes 1; tier_airdrop_ammo 2; tier_airdrop_throwables 1 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1370] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_healer` | 150 | tier_guns_rare_healer 1; bonesaw_healer; tier_airdrop_armor 1; tier_medical 1; tier_airdrop_scopes 1; tier_airdrop_ammo 2; tier_airdrop_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1358] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_scout` | 150 | tier_guns_rare_scout 1; crowbar_scout; tier_airdrop_armor 1; tier_medical 1; tier_airdrop_scopes 1; tier_airdrop_ammo 2; tier_airdrop_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1334] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_sniper` | 150 | tier_guns_rare_sniper 1; kukri_sniper; tier_airdrop_armor 1; tier_medical 1; tier_airdrop_scopes 1; tier_airdrop_ammo 2; tier_airdrop_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1346] [src:kong/relaunch-client-defs] [H] |
| `class_crate_rare_tank` | 150 | tier_guns_rare_tank 1; warhammer_tank; tier_airdrop_armor 1; tier_medical 1; tier_airdrop_scopes 1; tier_airdrop_ammo 2; tier_airdrop_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1394] [src:kong/relaunch-client-defs] [H] |
| `crate_01` | 75 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:381] [src:kong/relaunch-client-defs] [H] |
| `crate_01x` | 75 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:382] [src:kong/relaunch-client-defs] [H] |
| `crate_02` | 140 | tier_soviet 3–5 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383] [src:kong/relaunch-client-defs] [H] |
| `crate_02d` | 140 | m1014; helmet03_lt_aged; outfitRedLeaderAged; machete_taiga | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:435] [src:kong/relaunch-client-defs] [H] |
| `crate_02f` | 140 | tier_guns 3 (preload); tier_armor 2; tier_packs 1 | DIFFERS — original: tier_guns 3; tier_armor 2; tier_packs 1 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:418] [src:kong/relaunch-client-defs] [H] |
| `crate_02sv` | 140 | tier_soviet 4–5; tier_world 1; tier_medical 1 | DIFFERS — original: tier_soviet 4–5; tier_world 1 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391] [src:kong/relaunch-client-defs] [H] |
| `crate_02sv_lake` | 140 | tier_soviet 5–6; tier_medical 1 | DIFFERS — original: tier_soviet 5–6 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:403] [src:kong/relaunch-client-defs] [H] |
| `crate_02x` | 140 | tier_soviet 3–5 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:410] [src:kong/relaunch-client-defs] [H] |
| `crate_03` | 100 | tier_throwables 2–4; tier_fragtastic 1 | DIFFERS — original: tier_throwables 2–4 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:448] [src:kong/relaunch-client-defs] [H] |
| `crate_03x` | 100 | snowball ×4 (×3) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:457] [src:kong/relaunch-client-defs] [H] |
| `crate_04` | 225 | tier_ammo_crate 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:468] [src:kong/relaunch-client-defs] [H] |
| `crate_06` | 175 | tier_ammo 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:494] [src:kong/relaunch-client-defs] [H] |
| `crate_07` | 140 | tier_surviv 4–5; ak47 (×4); tier_khaki_outfit 1 (×4) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:508] [src:kong/relaunch-client-defs] [H] |
| `crate_07b` | 140 | tier_armor 4–5; mp220 (×2); bar (×2); tier_khaki_outfit 1 (×4) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:524] [src:kong/relaunch-client-defs] [H] |
| `crate_07sv` | 140 | tier_surviv 4–5; svd (×2); blr (×2); tier_khaki_outfit 1 (×4) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:540] [src:kong/relaunch-client-defs] [H] |
| `crate_08` | 140 | tier_surviv 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:556] [src:kong/relaunch-client-defs] [H] |
| `crate_09` | 140 | tier_chest 1–2; tier_conch 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:564] [src:kong/relaunch-client-defs] [H] |
| `crate_09bh` | 140 | tier_soviet 3–5; tier_outfits 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:572] [M] |
| `crate_09de` | 140 | tier_chest 2; tier_surviv 1; backpack02; cutlass; tier_conch 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:579] [M] |
| `crate_10` | 200 | tier_airdrop_uncommon 1; tier_airdrop_armor 1; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:593] [src:kong/relaunch-client-defs] [H] |
| `crate_10sv` | 200 | tier_airdrop_uncommon 1; tier_airdrop_armor 1; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1; tier_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:657] [src:kong/relaunch-client-defs] [H] |
| `crate_11` | 200 | tier_airdrop_rare 1; tier_airdrop_armor 1; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:613] [src:kong/relaunch-client-defs] [H] |
| `crate_11de` | 200 | tier_airdrop_rare 1; tier_airdrop_armor 1; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1; tier_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:699] [src:kong/relaunch-client-defs] [H] |
| `crate_11h` | 200 | tier_airdrop_rare 1; tier_airdrop_armor 1; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1; tier_airdrop_xp 2 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:633] [src:kong/relaunch-client-defs] [H] |
| `crate_11sv` | 200 | tier_airdrop_rare 1; backpack04_cloud; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1; tier_perks 2 | DIFFERS — original: tier_airdrop_rare 1; tier_airdrop_armor 1; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1; tier_perks 2 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:678] [src:kong/relaunch-client-defs] [H] |
| `crate_11tr` | 200 | tier_airdrop_rare 1; tier_airdrop_armor 1; tier_medical 2; tier_airdrop_scopes 1; tier_airdrop_outfits 1; tier_airdrop_melee 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1; tier_airdrop_xp 2 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:720] [src:kong/relaunch-client-defs] [H] |
| `crate_12` | 500 | tier_airdrop_rare 2 (preload); tier_airdrop_uncommon 7–8 (preload); tier_airdrop_armor 5–6; tier_medical 12–15; tier_airdrop_scopes 7–8; tier_airdrop_outfits 3–4; tier_airdrop_melee 6–7; tier_airdrop_ammo 10–12; tier_airdrop_throwables 6–8 | DIFFERS — original: tier_airdrop_rare 2 (preload); tier_airdrop_uncommon 4–6 (preload); tier_airdrop_armor 4–5; tier_medical 12–15; tier_airdrop_scopes 6–8; tier_airdrop_outfits 3–4; tier_airdrop_melee 5–7; tier_airdrop_ammo 10–12; tier_airdrop_throwables 6–8; tier_katanas 1 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741] [src:kong/relaunch-client-defs] [H] |
| `crate_12dev` | 1100 | tier_dev_guns 20 (preload); tier_dev_melee 6–7; snowball ×100; bandage; smoke | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:793] [M] |
| `crate_12po` | 500 | tier_airdrop_rare 2 (preload); tier_airdrop_uncommon 7–8 (preload); tier_airdrop_armor 5–6; tier_medical 12–15; tier_airdrop_scopes 7–8; tier_airdrop_outfits 3–4; tier_airdrop_melee 6–7; tier_airdrop_ammo 10–12; tier_airdrop_throwables 6–8 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:767] [M] |
| `crate_13` | 200 | tier_airdrop_mythic 3–4 (preload); tier_airdrop_rare 5 (preload); tier_airdrop_armor 6–8; tier_medical 12–15; tier_airdrop_scopes 7–8; tier_airdrop_faction_outfits 1–2; tier_airdrop_melee 2–3; tier_airdrop_faction_melee 3; tier_airdrop_ammo 10–12; tier_airdrop_throwables 6–8; strobe (×3) | DIFFERS — original: tier_airdrop_mythic 3–4 (preload); tier_airdrop_rare 3–4 (preload); tier_airdrop_armor 6–8; tier_medical 12–15; tier_airdrop_scopes 6–8; tier_airdrop_faction_outfits 1–2; tier_airdrop_faction_melee 3–4; tier_airdrop_ammo 10–12; tier_airdrop_throwables 6–8; tier_katanas 1; strobe (×3) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813] [src:kong/relaunch-client-defs] [H] |
| `crate_13po` | 200 | tier_airdrop_potato 2; tier_airdrop_mythic 3–4 (preload); tier_airdrop_rare 5 (preload); tier_airdrop_armor 6–8; tier_medical 12–15; tier_airdrop_scopes 7–8; tier_airdrop_faction_outfits 1–2; tier_airdrop_melee 2–3; tier_airdrop_faction_melee 3; tier_airdrop_ammo 10–12; tier_airdrop_throwables 6–8; strobe (×3) | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:843] [M] |
| `crate_14` | 75 | tier_throwables 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:875] [src:kong/relaunch-client-defs] [H] |
| `crate_14a` | 75 | tier_soviet 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:881] [src:kong/relaunch-client-defs] [H] |
| `crate_15` | 100 | tier_knives 4 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:887] [src:kong/relaunch-client-defs] [H] |
| `crate_16` | 100 | tier_knives 4 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:896] [src:kong/relaunch-client-defs] [H] |
| `crate_17` | 200 | tier_airdrop_crimson 1; tier_airdrop_armor 1; tier_medical 2–3; tier_airdrop_scopes 1; tier_airdrop_ammo 3; tier_airdrop_throwables 1–2; tier_perks 0–1; outfitCasanova | (fork) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:905] [M] |
| `crate_18` | 140 | tier_cattle_crate 2–3; tier_soviet 1–2 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:925] [src:kong/relaunch-client-defs] [H] |
| `crate_19` | 140 | tier_guns 1–3; tier_surviv 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:933] [src:kong/relaunch-client-defs] [H] |
| `crate_20` | 75 | tier_armor 1; tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:941] [src:kong/relaunch-client-defs] [H] |
| `crate_21` | 140 | tier_guns 1–2; tier_snipers 1; tier_cloud_02 1; tier_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:952] [src:kong/relaunch-client-defs] [H] |
| `crate_21b` | 140 | tier_guns 1–2; tier_snipers 1; tier_cloud_02 1; tier_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:965] [src:kong/relaunch-client-defs] [H] |
| `crate_22` | 140 | tier_guns 3 (preload); tier_armor 2; tier_packs 1 | DIFFERS — original: tier_guns 3; tier_armor 2; tier_packs 1 | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:978] [src:kong/relaunch-client-defs] [H] |
| `crate_22d` | 140 | an94; helmet03_lt_aged; outfitBlueLeaderAged; kukri_trad | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:995] [src:kong/relaunch-client-defs] [H] |
| `deposit_box_01` | 20 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:846] [src:kong/relaunch-client-defs] [H] |
| `deposit_box_02` | 20 | tier_soviet 1–2; tier_guns 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:850] [src:kong/relaunch-client-defs] [H] |
| `deposit_box_03` | 20 | tier_chest 1; tier_guns 1–2; tier_surviv 1–2 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:855] [M] |
| `drawers_01` | 75 | tier_container 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:864] [src:kong/relaunch-client-defs] [H] |
| `drawers_02` | 75 | tier_soviet 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:868] [src:kong/relaunch-client-defs] [H] |
| `egg_01` | 80 | tier_egg_outfits 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:725] [M] |
| `egg_02` | 80 | tier_egg_outfits 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:729] [M] |
| `egg_03` | 80 | tier_egg_outfits 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:733] [M] |
| `egg_04` | 80 | tier_egg_outfits 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:737] [M] |
| `gun_mount_01` | 50 | m870 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:910] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_02` | 50 | mp220 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:914] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_03` | 50 | qbb97 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:918] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_04` | 50 | woodaxe_bloody | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:922] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_05` | 50 | m1100 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:926] [src:kong/relaunch-client-defs] [H] |
| `gun_mount_06` | 50 | cutlass_gold | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:930] [M] |
| `gun_mount_07` | 50 | spas16 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:934] [M] |
| `locker_01` | 20 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:938] [src:kong/relaunch-client-defs] [H] |
| `locker_02` | 20 | tier_police 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:942] [src:kong/relaunch-client-defs] [H] |
| `locker_03` | 20 | ak47; backpack02; tier_khaki_outfit 1 | DIFFERS — original: ak47; backpack02 | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:946] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_01` | 100 | tier_knives 1 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1422] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_02` | 100 | ot38 (×4) | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1431] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_03` | 100 | ots38_dual; outfitSpetsnaz | DIFFERS — original: ots38_dual | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1445] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_04` | 100 | tier_guns 1; tier_throwables 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1454] [src:kong/relaunch-client-defs] [H] |
| `mil_crate_05` | 100 | tier_guns 1–2; tier_snipers 1–2 | original | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1463] [src:kong/relaunch-client-defs] [H] |
| `piano_01` | 75 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:955] [src:kong/relaunch-client-defs] [H] |
| `planter_01` | 100 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:988] [src:kong/relaunch-client-defs] [H] |
| `planter_02` | 100 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:989] [src:kong/relaunch-client-defs] [H] |
| `planter_03` | 100 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:992] [src:kong/relaunch-client-defs] [H] |
| `planter_04` | 100 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:995] [src:kong/relaunch-client-defs] [H] |
| `planter_06` | 100 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1013] [src:kong/relaunch-client-defs] [H] |
| `planter_07` | 100 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1019] [src:kong/relaunch-client-defs] [H] |
| `pot_01` | 50 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1027] [src:kong/relaunch-client-defs] [H] |
| `pot_02` | 50 | spas12 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1028] [src:kong/relaunch-client-defs] [H] |
| `pot_03` | 50 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1032] [src:kong/relaunch-client-defs] [H] |
| `pot_03b` | 50 | outfitWoodsCloak; backpack03 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1033] [src:kong/relaunch-client-defs] [H] |
| `pot_03c` | 50 | tier_pavilion 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1037] [src:kong/relaunch-client-defs] [H] |
| `pot_04` | 50 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1041] [src:kong/relaunch-client-defs] [H] |
| `pot_05` | 50 | scout_elite; tier_islander_outfit 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1042] [src:kong/relaunch-client-defs] [H] |
| `potato_01` | 100 | tier_potato_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:688] [src:kong/relaunch-client-defs] [H] |
| `potato_01f` | 100 | tier_potato_perks 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:689] [M] |
| `potato_02` | 100 | tier_potato_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:693] [src:kong/relaunch-client-defs] [H] |
| `potato_02f` | 100 | tier_potato_perks 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:694] [M] |
| `potato_03` | 100 | tier_potato_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:699] [src:kong/relaunch-client-defs] [H] |
| `potato_03f` | 100 | tier_potato_perks 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:700] [M] |
| `pumpkin_01` | 100 | tier_outfits 1; tier_pumpkin_candy 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:742] [src:kong/relaunch-client-defs] [H] |
| `pumpkin_02` | 140 | tier_guns 1–2; tier_pumpkin_candy 1–2; tier_outfits 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:745] [src:kong/relaunch-client-defs] [H] |
| `pumpkin_03` | 100 | tier_pumpkin_perks 1; tier_fruit_xp 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:754] [src:kong/relaunch-client-defs] [H] |
| `rack_01` | 75 | tier_revolvers 0–1; tier_medical 1; tier_vending_soda 1–2 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1046] [M] |
| `safe_01` | 400 | tier_safe_throwables 1; tier_safe 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1067] [M] |
| `safe_01de` | 400 | tier_crimson_perks 1; strobe (×2) | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1068] [M] |
| `silo_01po` | 2500 | potato_smg | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:801] [src:kong/relaunch-client-defs] [H] |
| `sink_01` | 100 | tier_toilet 2 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1105] [M] |
| `squash_01` | 100 | turkey_shoot; tier_world 0–1 | DIFFERS — original: turkey_shoot; tier_fruit_xp 1 | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763] [src:kong/relaunch-client-defs] [H] |
| `squash_02` | 200 | turkey_shoot (×2); tier_soviet 1–2 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:778] [M] |
| `stand_01` | 75 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1106] [src:kong/relaunch-client-defs] [H] |
| `stone_02` | 250 | tier_surviv 2–3; ak47 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:911] [src:kong/relaunch-client-defs] [H] |
| `stone_02bh` | 250 | tier_surviv 2–3; groza | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:948] [M] |
| `stone_02cb` | 250 | tier_surviv 2–3; ak47 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:925] [M] |
| `stone_02f` | 250 | tier_surviv 1; ak47; helmet02; chest02; bandage ×5; 2xscope | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:953] [M] |
| `stone_02sv` | 250 | tier_surviv 2–3; m39; tier_perks 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:916] [src:kong/relaunch-client-defs] [H] |
| `stone_02w` | 250 | tier_surviv 2–3; ak47 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:934] [M] |
| `stone_02x` | 250 | tier_surviv 2–3; ak47 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:939] [M] |
| `stone_04` | 250 | tier_eye_block 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1007] [src:kong/relaunch-client-defs] [H] |
| `stone_04x` | 250 | tier_eye_block 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1025] [M] |
| `stone_05` | 250 | tier_eye_stone 1 | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1043] [src:kong/relaunch-client-defs] [H] |
| `stone_08` | 500 | tier_medical 2–3; tier_surviv 1–2; vss | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1084] [M] |
| `stone_08cb` | 500 | tier_medical 2–3; tier_surviv 1–2; svd; helmet02 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1108] [M] |
| `stone_08x` | 500 | tier_medical 2–3; tier_surviv 1–2; m39 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1096] [M] |
| `toilet_01` | 100 | tier_toilet 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1286] [src:kong/relaunch-client-defs] [H] |
| `toilet_02` | 100 | tier_soviet 3–4 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1290] [src:kong/relaunch-client-defs] [H] |
| `toilet_02b` | 100 | fireaxe | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1294] [src:kong/relaunch-client-defs] [H] |
| `toilet_03` | 100 | tier_world 1–2 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1301] [src:kong/relaunch-client-defs] [H] |
| `toilet_04` | 100 | tier_soviet 2–3 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1316] [src:kong/relaunch-client-defs] [H] |
| `toilet_05` | 100 | tier_toilet_gold 1; tier_medical 3–4; coconut ×5; outfitGold | (fork) | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1331] [M] |
| `tomato_01` | 100 | tier_potato_perks 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:705] [M] |
| `tomato_02` | 100 | tier_potato_perks 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:709] [M] |
| `tomato_03` | 100 | tier_potato_perks 1 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:715] [M] |
| `towelrack_01` | 75 | tier_world 1 | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1354] [src:kong/relaunch-client-defs] [H] |
| `tree_02` | 120 | woodaxe | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1160] [src:kong/relaunch-client-defs] [H] |
| `tree_02h` | 120 | woodaxe_bloody | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1175] [src:kong/relaunch-client-defs] [H] |
| `tree_03` | 175 | tier_surviv 2–3; mosin | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1190] [src:kong/relaunch-client-defs] [H] |
| `tree_03bh` | 175 | tier_surviv 2–3; scout_elite | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1276] [M] |
| `tree_03cb` | 175 | tier_surviv 2–3; mosin | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1263] [M] |
| `tree_03d` | 175 | tier_surviv 2–3; mosin | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1224] [M] |
| `tree_03f` | 200 | tier_surviv 2–3; mosin; 4xscope; helmet02 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1230] [M] |
| `tree_03h` | 175 | tier_surviv 2–3; mosin | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1256] [M] |
| `tree_03sp` | 175 | tier_surviv 2–3; mosin | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1203] [M] |
| `tree_03su` | 175 | tier_surviv 2–3; mosin | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1196] [M] |
| `tree_03sv` | 175 | tier_surviv 2–3; mosin | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1215] [src:kong/relaunch-client-defs] [H] |
| `tree_03w` | 175 | tier_surviv 2–3; mosin | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1249] [M] |
| `tree_03x` | 175 | tier_surviv 2–3; mosin | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1209] [M] |
| `tree_05b` | 500 | tier_shotguns 1; tier_lmgs 1; outfitTreeSpooky | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1297] [src:kong/relaunch-client-defs] [H] |
| `tree_08c` | 500 | tier_shotguns 2–3; tier_lmgs 2–3; outfitWoodland | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1378] [src:kong/relaunch-client-defs] [H] |
| `tree_08spc` | 500 | tier_shotguns 2–3; tier_lmgs 2–3; outfitWoodland | original | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1430] [src:kong/relaunch-client-defs] [H] |
| `tree_14` | 175 | tier_coconut_outfit 1; coconut ×3 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1573] [M] |
| `tree_14d` | 250 | coconut ×3 (×3) | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1587] [M] |
| `tree_14x` | 175 | tier_coconut_outfit 1–3; coconut ×3 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1602] [M] |
| `tree_interior_01de` | 175 | tier_coconut_outfit 1; coconut ×3 | (fork) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1145] [M] |
| `vending_01` | 150 | tier_vending_soda 1–3; soda | original | [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1523] [src:kong/relaunch-client-defs] [H] |

- namu confirms the original class pod contents: scout pod = crowbar, 3 sodas, dual G18C / dual M93R / dual OT-38, rarely dual P30L; demo pod = level-2 backpack, a backpack-full of MIRVs, katana, M870 or SPAS-12. This matches the client defs, not survev's fork pods [src:namu/Surviv.io/이벤트] [src:kong/relaunch-client-defs] [M]
- namu: air drops yield level-3 gear, rare guns (QBB-97, Saiga-12, Vector), Ghillie and drop-only outfits; warehouses hold 7 crates, the middle one often a Soviet crate [src:namu/Surviv.io] [M]

## Conflicts

- CONFLICT military-crate-contents: `crate_12` rolls uncommon 7–8, armor 5–6, scopes 7–8, melee 6–7, no katana [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741] [src:balance/263-268] vs uncommon 4–6, armor 4–5, scopes 6–8, melee 5–7 + `tier_katanas` 1 [src:kong/relaunch-client-defs] [src:fandom/Meteor_Crate]; proposed: client values [H]
- CONFLICT gold-military-crate-contents: `crate_13` rare 5, scopes 7–8, `tier_airdrop_melee` 2–3, faction melee 3, no katana [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813] [src:balance/270-274] vs rare 3–4, scopes 6–8, faction melee 3–4, `tier_katanas` 1, no airdrop melee [src:kong/relaunch-client-defs] [src:fandom/Meteor_Crate]; proposed: client values [H]
- CONFLICT class-pod-contents: survev Cobalt pods (scout 2 sodas; healer `tier_health_healer`; demo `tier_throwables_demo` 3–4 + chest01 + 2x scope; assault +5 bandages + chest01; rare demo `tier_throwables_demo` 4–5) [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1259-1417] [src:balance/293-307] vs original (scout 3 sodas; healer healthkit; demo 6 MIRVs; assault no bandages/chest; rare demo 1 `tier_airdrop_throwables`) [src:kong/relaunch-client-defs] [src:fandom/Loot_tables/Class_Pod] [src:namu/Surviv.io/이벤트]; proposed: client values [H]
- CONFLICT airdrop-uncommon-weights: survev `tier_airdrop_uncommon` has mosin 1.5, scout_elite 2.5 and adds bar 1, vss 2.5 [src:survev/shared/defs/maps/baseDefs.ts:596-611] vs mosin 2.5, scout_elite 1.5, no bar/vss [src:fandom/Loot_tables/Airdrops]; proposed: fandom v0.7.9 weights, plus later 0.8.x additions only if evidenced [L]
- CONFLICT airdrop-ammo-stack: `tier_airdrop_ammo` stacks of 30/30/30/5 [src:survev/shared/defs/maps/baseDefs.ts:637-642] vs 60/60/60/10 [src:fandom/Loot_tables/Airdrops]; proposed: keep survev's (fandom appears to duplicate Tier Ammo) but expose a knob [L]
- CONFLICT airdrop-scopes-none-weight: `tier_airdrop_scopes` "" weight 24 [src:survev/shared/defs/maps/baseDefs.ts:662-667] vs 18 [src:fandom/Loot_tables/Airdrops]; proposed: 18 (fandom data) [L]
- CONFLICT tier-guns-flare-weight: `flare_gun` 0.145 and `flare_gun_dual` 0.0025 in `tier_guns` [src:survev/shared/defs/maps/baseDefs.ts:253-286] vs 0.1 (fandom main page) / 0.01 (fandom basic subpage) [src:fandom/Loot_tables] [src:fandom/Loot_tables/Basic]; proposed: 0.1 [L]
- CONFLICT tier-guns-mosin-scout: `mosin` 0.05 and `scout_elite` 0.1 [src:survev/shared/defs/maps/baseDefs.ts:253-286] vs 0.1 and 0.05 [src:fandom/Loot_tables]; proposed: fandom values [L]
- CONFLICT soviet-crate-medical: `crate_02sv` / `crate_02sv_lake` add `tier_medical` 1 [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391-409] vs no medical roll [src:kong/relaunch-client-defs]; proposed: client values [H]
- CONFLICT preload-on-ground-crates: `case_01`, `case_02`, `crate_02f`, `crate_22` preload their guns, and `case_02` drops `deagle_dual` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194-195] vs no preload and `case_02` dropping two single DEagles [src:kong/relaunch-client-defs]; proposed: client values [H]
- CONFLICT extra-outfit-rolls: survev adds `tier_fragtastic` to `crate_03`, `tier_khaki_outfit` to `locker_03`, `outfitSpetsnaz` to `mil_crate_03`, and replaces `outfitRoyalFortune` with `tier_pirate_outfits` in `chest_01` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:448] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1445] vs none of these in the client [src:kong/relaunch-client-defs]; proposed: client values [H]
- CONFLICT squash-loot: `squash_01` rolls `tier_world` 0–1 [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763] vs `tier_fruit_xp` 1 [src:kong/relaunch-client-defs]; proposed: client value (XP neutral until a pass exists) [H]
- CONFLICT container-outfit-weight: `tier_container` outfits 0.035 and `tier_toilet` outfits 0.025 [src:survev/shared/defs/maps/baseDefs.ts:110-139] vs fandom's alternative 0.11 / 0.20 [src:fandom/Loot_tables/General]; proposed: survev values (fandom itself favours them if "50v50 is normal") [L]

## Open questions

- Real 0.8.82 weights for `tier_world`, `tier_surviv`, `tier_soviet`, `tier_scopes`, `tier_packs`, `tier_leaf_pile` (survev marks them `?`/TODO; fandom lists only rarity words) [src:survev/shared/defs/maps/baseDefs.ts:94-132] [src:fandom/Loot_tables/General] [L]
- Did original ground loot ever despawn? [src:survev/server/src/game/objects/loot.ts:233-311] [L]
- Exact original rule for re-dropping the remainder of a partially picked-up stack (survev pushes it 4–4.5 u/s opposite the player's facing) [src:survev/server/src/game/objects/player.ts:3983-3994] [L]
- Original XP artifact rates (survev: commented guess uncommon 1 / rare 0.1 / mythic 0.001 against "" 40 or 15) [src:survev/shared/defs/maps/baseDefs.ts:709-724] [L]
- The contents of the original-only tiers `tier_eye_01`, `tier_chrys_02b`, `tier_sledgehammer`, `tier_potato_helmet` (referenced by 0.8.82 loot spawners, absent from survev) [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [L]
