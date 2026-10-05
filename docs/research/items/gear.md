# Gear: ammo, backpacks, armour, scopes, heals and boosts

> Every def in survev `shared/defs/gameObjects/gearDefs.ts` (ammo, heal, boost, backpack, helmet, chest, scope) plus `GameConfig.bagSizes` and `scopeZoomRadius`, with original v0.8.82 values next to fork changes.
> "orig" values come from survev's first commit `9f64948d` (decompiled original client: `src/defs/gearDefs.js`, `src/gameConfig.ts`), cited as `derived/survev@9f64948d:<path>:<lines>`. The Kongregate relaunch bundle (`kong/relaunch-client-defs`) has the same gear defs and the same 4-level `bagSizes` table.
> Korean names from survev `client/public/l10n/ko.json` (cited `l10n/ko:<key>`); the UI shows l10n `game-<id>` rather than the def `name`.

## Provenance summary

- Original gear ids: 9 ammo (9mm, 762mm, 556mm, 12gauge, 50AE, 308sub, flare, 45acp, potato_ammo), 2 heals (bandage, healthkit), 2 boosts (soda, painkiller), 4 backpacks (backpack00–03), 4 helmets (helmet01–04) + 14 helmet skins, 4 chests (chest01–04), 5 scopes [src:derived/survev@9f64948d:src/defs/gearDefs.js:1-759] [src:kong/relaunch-client-defs] [H]
- Fork gear: `backpack04` "Tactical Pack" and `backpack04_cloud` "Experimental Pack" (commit `33eb078e`, 2026-09-07), `helmet04_captain` (commit `3844dc3f`, 2025-06-08, Captain role), `helmet04_classless` (commit `294ac9e6`, 2026-04-17) (fork) [src:derived/survev-git-33eb078e] [src:derived/survev-git-3844dc3f] [src:derived/survev-git-294ac9e6] [src:kong/relaunch-client-defs] [H]
- Fork change: `bagSizes` gained a 5th column for the level-4 pack, and .50 AE capacity changed from 49/98/147/196 to 50/100/150/200/250 in the same commit `33eb078e` (fork) [src:derived/survev-git-33eb078e] [src:survev/shared/gameConfig.ts:415-441] [src:derived/survev@9f64948d:src/gameConfig.ts:260-284] [H]
- Fork change: .308 Subsonic capacity 10/20/40/80 → 20/40/60/80 (commit `a252477e`, 2026-03-14) → 20/40/55/70/85 (commit `33eb078e`) (fork) [src:balance/252] [src:derived/survev-git-a252477e] [src:derived/survev-git-33eb078e] [H]
- Fork change: chest04 loot image `loot-chest-03.img` → `loot-chest-04.img` (commit `75b772db`, 2026-05-30) (fork) [src:derived/survev@9f64948d:src/defs/gearDefs.js:445-465] [src:derived/survev-git-75b772db] [H]
- All other gear stats (heal/boost amounts, use times, damage reductions, levels, scope zooms) are identical in the original client, survev and the relaunch [src:derived/survev@9f64948d:src/defs/gearDefs.js:1-759] [src:survev/shared/defs/gameObjects/gearDefs.ts:1-934] [src:kong/relaunch-client-defs] [H]

## Ammo

| id | en / ko name | special | minStackSize | box tint (dark) | capacity Pouch/Small/Regular/Military | sources |
|---|---|---|---|---|---|---|
| `9mm` | 9mm / 9mm | no | 15 | 0xffae00 (0xbf8300) yellow | 120 / 240 / 330 / 420 | [src:survev/shared/defs/gameObjects/gearDefs.ts:447-460] [src:derived/survev@9f64948d:src/defs/gearDefs.js:7-20] [src:derived/survev@9f64948d:src/gameConfig.ts:261] [src:l10n/ko:game-9mm] [H] |
| `762mm` | 7.62mm / 7.62mm | no | 10 | 0x0066ff (0x004dbf) blue | 90 / 180 / 240 / 300 | [src:survev/shared/defs/gameObjects/gearDefs.ts:461-474] [src:derived/survev@9f64948d:src/gameConfig.ts:262] [src:l10n/ko:game-762mm] [H] |
| `556mm` | 5.56mm / 5.56mm | no | 10 | 0x039e00 (0x027700) green | 90 / 180 / 240 / 300 | [src:survev/shared/defs/gameObjects/gearDefs.ts:475-488] [src:derived/survev@9f64948d:src/gameConfig.ts:263] [src:l10n/ko:game-556mm] [H] |
| `12gauge` | 12 gauge / 12게이지 | no | 5 | 0xff0000 (0xbf0000) red | 15 / 30 / 60 / 90 | [src:survev/shared/defs/gameObjects/gearDefs.ts:489-502] [src:derived/survev@9f64948d:src/gameConfig.ts:264] [src:l10n/ko:game-12gauge] [H] |
| `50AE` | .50 AE (survev en ".50 Caliber") / .50 AE | yes | 10 | 0x292929 (0x1f1f1f) black | orig 49 / 98 / 147 / 196; survev 50 / 100 / 150 / 200 / 250 (fork) | [src:survev/shared/defs/gameObjects/gearDefs.ts:503-517] [src:derived/survev@9f64948d:src/gameConfig.ts:265] [src:l10n/ko:game-50AE] [src:kong/relaunch-client-defs] [H] |
| `308sub` | .308 Subsonic / .308 아음속탄 | yes | 10 | 0x313800 (0x252b00) olive | orig 10 / 20 / 40 / 80; survev 20 / 40 / 55 / 70 / 85 (fork) | [src:survev/shared/defs/gameObjects/gearDefs.ts:518-532] [src:derived/survev@9f64948d:src/gameConfig.ts:266] [src:l10n/ko:game-308sub] [H] |
| `flare` | Flare / 섬광탄 | yes | 1 | 0xd44600 orange | 2 / 4 / 6 / 8 | [src:survev/shared/defs/gameObjects/gearDefs.ts:533-547] [src:derived/survev@9f64948d:src/gameConfig.ts:267] [src:l10n/ko:game-flare] [H] |
| `45acp` | .45 ACP / .45 ACP | yes | 10 | 0x7900ff (0x5b00bf) purple | 90 / 180 / 240 / 300 | [src:survev/shared/defs/gameObjects/gearDefs.ts:548-562] [src:derived/survev@9f64948d:src/gameConfig.ts:268] [src:l10n/ko:game-45acp] [H] |
| `potato_ammo` | Potato Ammo (no l10n key) | yes, `hideUi` | 10 | 0x743f1e brown | not in bagSizes (potato guns have infinite ammo) | [src:survev/shared/defs/gameObjects/gearDefs.ts:563-579] [src:derived/survev@9f64948d:src/defs/gearDefs.js:123-138] [src:fandom/Potato_Ammo] [H] |

- All ammo uses the sprite `loot-ammo-box.img` (scale 0.2) and pickup sound `ammo_pickup_01`; ammo loot radius is 1.2 [src:survev/shared/defs/gameObjects/gearDefs.ts:447-579] [src:survev/shared/gameConfig.ts:447] [H]
- `special` ammo is hidden in the HUD ammo list while the player has none; regular ammo shows at 25 % opacity at 0 and turns orange (#ff9900) when full [src:survev/client/src/ui/ui2.ts:1266-1278] [src:changelog/0.3.5] [H]
- `hideUi` keeps potato ammo out of the HUD entirely [src:survev/client/src/ui/ui2.ts:108-112] [H]
- Dropping ammo drops half the stack, or the whole stack up to `minStackSize` when the player holds `minStackSize` or less (5 for ammo without one) [src:survev/server/src/game/objects/player.ts:4250-4264] [H]
- Which guns use each ammo is listed in guns.md; the en tooltips (e.g. "Ammo for M9, MP5, G18C, MAC-10, M93R, UMP9, Vector, P30L, VSS and CZ-3A1") include fork guns such as SPAS-16, IMD-2, S&W 500, Barrett M107 and ASh-12 (fork) [src:survev/client/src/en.json:384-398] [H]
- The ko .50 AE tooltip still says only "데저트이글 50 의 탄약입니다." (ammo for the DEagle 50) [src:l10n/ko:game-50AE-tooltip] [H]
- Ammo history: 7.62mm capacity raised in 0.1.6; all ammo capacities raised in 0.2.0; .50 AE spawns only with the DEagle (0.3.5); ammo crates (0.5.0) hold basic ammo with a small chance of special ammo [src:changelog/0.1.6] [src:changelog/0.2.0] [src:changelog/0.3.5] [src:changelog/0.5.0] [H]
- survev ammo tables (estimates): `tier_ammo` 60 × 9mm / 762mm / 556mm or 10 × 12gauge (weight 3 each); `tier_ammo_crate` adds 21 × 50AE, 5 × 308sub, 1 × flare (weight 1 each) [src:survev/shared/defs/maps/baseDefs.ts:170-184] [L]
- In 0.8.71 50v50 airdrop weapons started coming packaged with their ammo [src:changelog/0.8.71] [H]
- Post-0.8.82 ammo types on fandom (not in survev): 40mm (M79), Heart Ammo, Rainbow Ammo (post-0.8.82) [src:fandom/40mm] [src:fandom/Heart_Ammo] [src:fandom/Rainbow_Ammo] [M]

## Backpacks

| id | en / ko name | level | worn tint | `playerRad` | sources |
|---|---|---|---|---|---|
| `backpack00` | Pouch / 주머니 | 0 | 0xffffff | 0.55 | [src:survev/shared/defs/gameObjects/gearDefs.ts:222-238] [src:derived/survev@9f64948d:src/defs/gearDefs.js:229-245] [src:l10n/ko:game-backpack00] [H] |
| `backpack01` | Small Pack / 작은 가방 | 1 | 0x663300 | 0.65 | [src:survev/shared/defs/gameObjects/gearDefs.ts:239-255] [src:derived/survev@9f64948d:src/defs/gearDefs.js:246-262] [src:l10n/ko:game-backpack01] [H] |
| `backpack02` | Regular Pack / 큰 가방 | 2 | 0x006600 | 0.85 | [src:survev/shared/defs/gameObjects/gearDefs.ts:256-272] [src:derived/survev@9f64948d:src/defs/gearDefs.js:263-279] [src:l10n/ko:game-backpack02] [H] |
| `backpack03` | Military Pack / 밀리터리 가방 | 3 | 0x666633 | 1 | [src:survev/shared/defs/gameObjects/gearDefs.ts:273-289] [src:derived/survev@9f64948d:src/defs/gearDefs.js:280-296] [src:l10n/ko:game-backpack03] [H] |
| `backpack04` (fork) | Tactical Pack / — | 4 | 0x666633 | 1 | [src:survev/shared/defs/gameObjects/gearDefs.ts:290-307] [src:survev/client/src/en.json:370] [H] |
| `backpack04_cloud` (fork) | Experimental Pack / — | 4 | 0x666633 | 1; `maxPerks` 2, desc "You can equip an extra perk." | [src:survev/shared/defs/gameObjects/gearDefs.ts:917-926] [src:survev/client/src/en.json:371-372] [src:wikigg/Equipment] [H] |

- Every player starts with `backpack00`; the pouch never drops and cannot be looted [src:survev/shared/gameConfig.ts:239] [src:survev/server/src/game/objects/player.ts:3895] [src:changelog/0.1.6] [H]
- Backpacks cannot be dropped from the HUD; they drop only on death [src:fandom/Backpacks] [M]
- Pickup rule: helmets, chests and packs are compared by quality = level × 10 (+1 if a helmet has a perk, +1 if it has a role; packs +maxPerks, default 1); a lower or equal item is refused ("Better item equipped" / "Item already equipped"), a better one swaps and the old one drops [src:survev/server/src/game/objects/player.ts:777-795] [src:survev/server/src/game/objects/player.ts:3851-3896] [src:changelog/0.1.6] [src:changelog/0.1.0] [H]
- Mobile players auto-pick up better gear they walk over [src:survev/server/src/game/objects/player.ts:2025-2029] [src:survev/server/src/game/objects/player.ts:2070-2079] [H]
- Fandom: backpack worn colour now follows the outfit; earlier packs were coloured by level; the Ghillie Suit hides the pack [src:fandom/Backpacks] [M]
- Backpack loot radius 1 [src:survev/shared/gameConfig.ts:450] [H]
- survev pack loot table (estimate): backpack01 15, backpack02 6, backpack03 0.2; airdrops roll helmet03 / chest03 / backpack03 with equal weight [src:survev/shared/defs/maps/baseDefs.ts:154-158] [src:survev/shared/defs/maps/baseDefs.ts:657-661] [L]

### Full capacity table (`bagSizes`)

| item | L0 Pouch | L1 Small | L2 Regular | L3 Military | L4 Tactical (fork) | sources |
|---|---|---|---|---|---|---|
| 9mm | 120 | 240 | 330 | 420 | 510 | [src:survev/shared/gameConfig.ts:416] [src:derived/survev@9f64948d:src/gameConfig.ts:261] [src:kong/relaunch-client-defs] [H] |
| 762mm | 90 | 180 | 240 | 300 | 360 | [src:survev/shared/gameConfig.ts:417] [src:derived/survev@9f64948d:src/gameConfig.ts:262] [H] |
| 556mm | 90 | 180 | 240 | 300 | 360 | [src:survev/shared/gameConfig.ts:418] [src:derived/survev@9f64948d:src/gameConfig.ts:263] [H] |
| 12gauge | 15 | 30 | 60 | 90 | 120 | [src:survev/shared/gameConfig.ts:419] [src:derived/survev@9f64948d:src/gameConfig.ts:264] [H] |
| 50AE | orig 49 / survev 50 (fork) | 98 / 100 | 147 / 150 | 196 / 200 | 250 | [src:survev/shared/gameConfig.ts:420] [src:derived/survev@9f64948d:src/gameConfig.ts:265] [src:kong/relaunch-client-defs] [H] |
| 308sub | orig 10 / survev 20 (fork) | 20 / 40 | 40 / 55 | 80 / 70 | 85 | [src:survev/shared/gameConfig.ts:421] [src:derived/survev@9f64948d:src/gameConfig.ts:266] [src:kong/relaunch-client-defs] [H] |
| flare | 2 | 4 | 6 | 8 | 10 | [src:survev/shared/gameConfig.ts:422] [src:derived/survev@9f64948d:src/gameConfig.ts:267] [H] |
| 45acp | 90 | 180 | 240 | 300 | 360 | [src:survev/shared/gameConfig.ts:423] [src:derived/survev@9f64948d:src/gameConfig.ts:268] [H] |
| frag | 3 | 6 | 9 | 12 | 15 | [src:survev/shared/gameConfig.ts:424] [src:derived/survev@9f64948d:src/gameConfig.ts:269] [H] |
| smoke | 3 | 6 | 9 | 12 | 15 | [src:survev/shared/gameConfig.ts:425] [src:derived/survev@9f64948d:src/gameConfig.ts:270] [H] |
| strobe | 2 | 3 | 4 | 5 | 6 | [src:survev/shared/gameConfig.ts:426] [src:derived/survev@9f64948d:src/gameConfig.ts:271] [H] |
| mirv | 2 | 4 | 6 | 8 | 10 | [src:survev/shared/gameConfig.ts:427] [src:derived/survev@9f64948d:src/gameConfig.ts:272] [H] |
| snowball | 10 | 20 | 30 | 40 | 50 | [src:survev/shared/gameConfig.ts:428] [src:derived/survev@9f64948d:src/gameConfig.ts:273] [H] |
| potato | 10 | 20 | 30 | 40 | 50 | [src:survev/shared/gameConfig.ts:429] [src:derived/survev@9f64948d:src/gameConfig.ts:274] [H] |
| tomato (fork) | 10 | 20 | 30 | 40 | 50 | [src:survev/shared/gameConfig.ts:430] [H] |
| coconut (fork) | 3 | 6 | 9 | 12 | 15 | [src:survev/shared/gameConfig.ts:431] [H] |
| bandage | 5 | 10 | 15 | 30 | 45 | [src:survev/shared/gameConfig.ts:432] [src:derived/survev@9f64948d:src/gameConfig.ts:275] [src:fandom/Bandage] [H] |
| healthkit | 1 | 2 | 3 | 4 | 5 | [src:survev/shared/gameConfig.ts:433] [src:derived/survev@9f64948d:src/gameConfig.ts:276] [src:fandom/Med_Kit] [H] |
| soda | 2 | 5 | 10 | 15 | 20 | [src:survev/shared/gameConfig.ts:434] [src:derived/survev@9f64948d:src/gameConfig.ts:277] [src:fandom/Soda] [H] |
| painkiller | 1 | 2 | 3 | 4 | 5 | [src:survev/shared/gameConfig.ts:435] [src:derived/survev@9f64948d:src/gameConfig.ts:278] [src:fandom/Pills] [H] |
| each scope | 1 | 1 | 1 | 1 | 1 | [src:survev/shared/gameConfig.ts:436-440] [src:derived/survev@9f64948d:src/gameConfig.ts:279-283] [H] |

- Map overrides: the woods map doubles base frag and smoke capacity to 6 / 12 / 15 / 18 (survev adds 20 for level 4) [src:derived/survev@4b291f4d:shared/defs/maps/woodsDefs.ts:54-57] [src:survev/shared/defs/maps/woodsDefs.ts:59-62] [src:fandom/Backpacks] [H]
- Capacity is read from the map's merged `bagSizes` at the backpack level; Flak Jacket adds +3 frag / +2 MIRV only in the fork (fork) [src:survev/server/src/game/inventoryManager.ts:71-78] [src:survev/server/src/game/objects/player.ts:135-139] [src:balance/299] [H]
- If capacity drops (e.g. Flak Jacket lost), excess items are dropped [src:survev/server/src/game/inventoryManager.ts:80-88] [H]

## Helmets and chest armour (vests)

### Damage reduction rule

- Each hit: with a 15 % chance (guns with `headshotMult` only, never explosions) it is a headshot, multiplied by `headshotMult`; a headshot ignores the vest and takes the full helmet reduction; a body hit takes the vest reduction and 0.3 × the helmet reduction [src:survev/server/src/game/objects/player.ts:2459-2490] [src:survev/shared/gameConfig.ts:200] [src:fandom/Helmets] [H]
- Reductions stack multiplicatively with Flak Jacket (10 %, 90 % vs explosions) and Steelskin (45 %); AP Rounds multiply each reduction by its armorPenetration value (fork perk) [src:survev/server/src/game/objects/player.ts:2446-2490] [src:survev/shared/defs/gameObjects/perkDefs.ts:13-25] [src:survev/shared/defs/gameObjects/perkDefs.ts:41-44] [H]
- Gas and bleeding damage ignore armour [src:survev/server/src/game/objects/player.ts:2454-2458] [H]
- Armour has had no durability since 0.1.6 (earlier helmets/vests had 100 health) [src:changelog/0.1.6] [src:fandom/Vests] [H]

| id | en / ko name | level | damageReduction | worn tint (red / blue team) | sources |
|---|---|---|---|---|---|
| `helmet01` | Level 1 Helmet / 1레벨 헬멧 | 1 | 0.25 (body 0.075) | 0x317fff (0xa76b6b / 0x6290be) | [src:survev/shared/defs/gameObjects/gearDefs.ts:124-145] [src:derived/survev@9f64948d:src/defs/gearDefs.js:297-318] [src:l10n/ko:game-helmet01] [H] |
| `helmet02` | Level 2 Helmet / 2레벨 헬멧 | 2 | 0.40 (body 0.12) | 0xc6c6c6 (0x990000 / 0x0050a2) | [src:survev/shared/defs/gameObjects/gearDefs.ts:146-167] [src:derived/survev@9f64948d:src/defs/gearDefs.js:319-340] [src:l10n/ko:game-helmet02] [H] |
| `helmet03` | Level 3 Helmet / 3레벨 헬멧 | 3 | 0.55 (body 0.165) | 0x252525 (0x260404 / 0x05192d) | [src:survev/shared/defs/gameObjects/gearDefs.ts:168-189] [src:derived/survev@9f64948d:src/defs/gearDefs.js:341-362] [src:l10n/ko:game-helmet03] [src:namu/Surviv.io/장비] [H] |
| `helmet04` | Level 4 Helmet (no l10n key; prototype, never spawns) | 4 | 0.70 (body 0.21) | as level 3 | [src:survev/shared/defs/gameObjects/gearDefs.ts:190-212] [src:derived/survev@9f64948d:src/defs/gearDefs.js:363-384] [src:fandom/Helmets] [H] |
| `chest01` | Level 1 Vest / 1레벨 조끼 | 1 | 0.25 | 0xb4b4b4 | [src:survev/shared/defs/gameObjects/gearDefs.ts:26-45] [src:derived/survev@9f64948d:src/defs/gearDefs.js:385-404] [src:l10n/ko:game-chest01] [H] |
| `chest02` | Level 2 Vest / 2레벨 조끼 | 2 | 0.38 | 0x4b4b4b | [src:survev/shared/defs/gameObjects/gearDefs.ts:46-65] [src:derived/survev@9f64948d:src/defs/gearDefs.js:405-424] [src:l10n/ko:game-chest02] [H] |
| `chest03` | Level 3 Vest / 3레벨 조끼 | 3 | 0.45 | 0x000000 | [src:survev/shared/defs/gameObjects/gearDefs.ts:66-85] [src:derived/survev@9f64948d:src/defs/gearDefs.js:425-444] [src:l10n/ko:game-chest03] [src:namu/Surviv.io/장비] [H] |
| `chest04` | Level 4 Vest / 4레벨 조끼 | 4 | 0.60; `noDrop` (Lone Survivr only) | 0x1c2e06 | [src:survev/shared/defs/gameObjects/gearDefs.ts:86-107] [src:derived/survev@9f64948d:src/defs/gearDefs.js:445-465] [src:l10n/ko:game-chest04] [src:fandom/Vests] [H] |

- Helmet history: Level 3 helmet and chest drop rate lowered (0.4.0); Level 2/3 vests made less effective (0.3.5); Level 3 vest reduction lowered (0.1.7) [src:changelog/0.4.0] [src:changelog/0.3.5] [src:changelog/0.1.7] [H]
- Armour sprites: helmets `player-circle-base-01.img`, vests `player-armor-base-01.img`; pickup sounds `helmet_pickup_01` / `chest_pickup_01` [src:survev/shared/defs/gameObjects/gearDefs.ts:26-212] [H]
- Helmet and chest loot radius 1 [src:survev/shared/gameConfig.ts:451-452] [H]
- survev armour table (estimate): helmet01 9, helmet02 6, helmet03 0.2, chest01 15, chest02 6, chest03 0.2 [src:survev/shared/defs/maps/baseDefs.ts:146-153] [L]

### Special helmets (skins of helmet03 / helmet04)

> All skins keep their base level and reduction. `noDrop` items cannot be dropped and vanish on death; `perk` is granted while worn; `role` promotes the wearer.

| id | en / ko name | base | perk / role / flags | where | sources |
|---|---|---|---|---|---|
| `helmet03_leader` | Commander Helmet (def "Leader Helmet") / 지휘관 헬멧 | helmet03 | worn sprite `player-helmet-leader.img` | aged Commander helmet (desert) | [src:survev/shared/defs/gameObjects/gearDefs.ts:674-682] [src:derived/survev@9f64948d:src/defs/gearDefs.js:544-552] [src:l10n/ko:game-helmet03_leader] [H] |
| `helmet03_forest` | Shishigami no Kabuto / 시시가미의 투구 | helmet03 | role `woods_king` (Gift of the Woods + Windwalk); green pulsing map indicator `player-king-woods.img` | woods Pavilion; added 0.7.5 | [src:survev/shared/defs/gameObjects/gearDefs.ts:683-705] [src:changelog/0.7.5] [src:wikigg/Shishigami_no_Kabuto] [src:l10n/ko:game-helmet03_forest] [H] |
| `helmet03_moon` | Tsukuyomi no Kabuto / 츠쿠요미의 투구 | helmet03 | no perk | spring maps; added 0.7.3 | [src:survev/shared/defs/gameObjects/gearDefs.ts:706-715] [src:wikigg/Tsukuyomi_no_Kabuto] [src:l10n/ko:game-helmet03_moon] [H] |
| `helmet03_lt` | Lieutenant Helmet / 부관 헬멧 | helmet03 | `noDrop`; Lieutenant role helmet | 50v50 Lieutenant | [src:survev/shared/defs/gameObjects/gearDefs.ts:716-726] [src:survev/shared/defs/gameObjects/roleDefs.ts:216] [src:l10n/ko:game-helmet03_lt] [H] |
| `helmet03_lt_aged` | Lieutenant Helmet / 부관 헬멧 | helmet03 | perk `firepower` | under desert aged statues; perk added 0.7.51 | [src:survev/shared/defs/gameObjects/gearDefs.ts:727-741] [src:changelog/0.7.51] [src:wikigg/Lieutenant_Helmet_(Desert)] [H] |
| `helmet03_potato` | K-pot-ato / K-포-테토 | helmet03 | perk `rare_potato` | potato map police station golden lockers, airdrops; added 0.7.52 | [src:survev/shared/defs/gameObjects/gearDefs.ts:742-756] [src:wikigg/K-pot-ato] [src:l10n/ko:game-helmet03_potato] [H] |
| `helmet03_marksman` | Marksman Helmet / 명사수 헬멧 | helmet03 | `noDrop`; 50v50 Marksman role | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:757-772] [src:wikigg/Old_Marksman_Helmet] [src:l10n/ko:game-helmet03_marksman] [H] |
| `helmet03_recon` | Recon Helmet (no l10n key) | helmet03 | `noDrop`; Recon role (0.8.81) | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:773-788] [src:changelog/0.8.81] [H] |
| `helmet03_grenadier` | Grenadier Helmet (no l10n key) | helmet03 | `noDrop`; Grenadier role (0.8.81) | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:789-804] [src:changelog/0.8.81] [H] |
| `helmet03_bugler` | Bugler Helmet (no l10n key) | helmet03 | `noDrop`; Bugler role (0.8.81) | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:805-820] [src:changelog/0.8.81] [H] |
| `helmet04_medic` | Medic Helmet (no l10n key) | helmet04 | `noDrop`; Medic role | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:821-836] [src:survev/shared/defs/gameObjects/roleDefs.ts:244] [H] |
| `helmet04_last_man_red` / `_blue` | Lone Survivr Helmet (en key `game-helmet04_lone_survivr`) | helmet04 | `noDrop`; Lone Survivr role, team-coloured sprite `player-helmet-last-man-01/02.img` | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:837-868] [src:survev/client/src/en.json:413] [src:survev/shared/defs/gameObjects/roleDefs.ts:403-407] [H] |
| `helmet04_leader` | Commander Helmet / 지휘관 헬멧 | helmet04 | `noDrop`; Commander role | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:869-884] [src:survev/shared/defs/gameObjects/roleDefs.ts:147] [src:l10n/ko:game-helmet04_leader] [H] |
| `helmet04_captain` (fork) | Captain Helmet / 대장모 | helmet04 | `noDrop`; Captain role (fork) | 50v50 | [src:survev/shared/defs/gameObjects/gearDefs.ts:885-900] [src:l10n/ko:game-helmet04_captain] [H] |
| `helmet04_classless` (fork) | Classless Helmet / — | helmet04 | `noDrop`; Classless role, cobalt (fork) | cobalt | [src:survev/shared/defs/gameObjects/gearDefs.ts:901-916] [src:wikigg/Equipment] [H] |

- Removed Marksman Helmets (`helmet03_dm01/02/03` on fandom): desert (0.7.95, Endless Ammo), woods (0.8.1, Splinter Rounds), potato (0.8.2, Small Arms), found in savannah cloud crates, all removed in 0.8.4; they are not in the 0.8.82 defs [src:wikigg/Old_Marksman_Helmet] [src:fandom/Helmets] [src:changelog/0.7.95] [src:derived/survev@9f64948d:src/defs/gearDefs.js:544-755] [H]
- With a role helmet worn, any other helmet pickup is refused [src:survev/server/src/game/objects/player.ts:3860-3864] [src:fandom/Helmets] [H]
- Picking up or dropping a perk/role helmet adds or removes that perk/role [src:survev/server/src/game/objects/player.ts:3870-3892] [H]
- Fandom says the Commander Helmet was briefly level 9, then 3, then 4 [src:fandom/Helmets] [L]

## Scopes

| id | en / ko name | level | zoom radius desktop | zoom radius mobile | sources |
|---|---|---|---|---|---|
| `1xscope` | 1x Scope / 1배율 스코프 | 1 | 28 | 32 | [src:survev/shared/defs/gameObjects/gearDefs.ts:596-610] [src:survev/shared/gameConfig.ts:399-414] [src:derived/survev@9f64948d:src/gameConfig.ts:244-259] [src:l10n/ko:game-1xscope] [H] |
| `2xscope` | 2x Scope / 2배율 스코프 | 2 | 36 | 40 | [src:survev/shared/defs/gameObjects/gearDefs.ts:611-625] [src:survev/shared/gameConfig.ts:399-414] [src:l10n/ko:game-2xscope] [H] |
| `4xscope` | 4x Scope / 4배율 스코프 | 4 | 48 | 48 | [src:survev/shared/defs/gameObjects/gearDefs.ts:626-640] [src:survev/shared/gameConfig.ts:399-414] [src:l10n/ko:game-4xscope] [H] |
| `8xscope` | 8x Scope / 8배율 스코프 | 8 | 68 | 64 | [src:survev/shared/defs/gameObjects/gearDefs.ts:641-655] [src:survev/shared/gameConfig.ts:399-414] [src:l10n/ko:game-8xscope] [H] |
| `15xscope` | 15x Scope / 15배율 스코프 | 15 | 104 | 88 | [src:survev/shared/defs/gameObjects/gearDefs.ts:656-671] [src:survev/shared/gameConfig.ts:399-414] [src:l10n/ko:game-15xscope] [H] |

- The zoom radius is the half-height of the visible world in units; step ratios on desktop are 1.29, 1.33, 1.42, 1.53 (fandom quotes ~1.3, ~1.33, ~1.4, ~1.53) [src:derived/36/28-48/36-68/48-104/68] [src:fandom/Scopes] [H]
- Scopes are inventory items (one of each); the player starts with `1xscope`, which cannot be dropped [src:survev/shared/gameConfig.ts:242-270] [src:fandom/Scopes] [H]
- The 1x zoom is forced inside smoke (until 0.5 s after leaving), while downed, and in building zoom regions; the Crimson Ring Club bathhouse zoom region uses 4x [src:survev/server/src/game/objects/player.ts:2249-2266] [src:fandom/Scopes] [H]
- After a revive the zoom returns to the pre-downed scope (0.2.3) [src:changelog/0.2.3] [H]
- Keybinds Equip Previous/Next Scope added (unbound) in 0.5.1; the scroll wheel cycles weapons, not scopes, since 0.2.3 [src:changelog/0.5.1] [src:changelog/0.2.3] [H]
- PMG-134 shots (fork) shrink the zoom radius by 1.5 per hit, never below the 1x radius (fork) [src:survev/server/src/game/objects/player.ts:2106-2109] [src:survev/server/src/game/objects/player.ts:4592-4597] [H]
- Scope loot radius 1 [src:survev/shared/gameConfig.ts:453] [H]
- survev scope table (estimate): 2x 24, 4x 5, 8x 1, 15x 0.02; Chrysanthemum bunker `tier_chrys_03`: 4x 7.5, 8x 5, 15x 0.25 [src:survev/shared/defs/maps/baseDefs.ts:140-145] [src:survev/shared/defs/maps/baseDefs.ts:205-209] [L]
- 50v50 roles start with scopes: Commander, Marksman and Lone Survivr 8x; Lieutenant, Medic, Recon, Grenadier, Bugler 4x [src:survev/shared/defs/gameObjects/roleDefs.ts:156-414] [src:fandom/Scopes] [H]
- namu: there are 5 scope magnifications, and 1x is the default [src:namu/Surviv.io/장비] [M]

## Heals and boosts

| id | en / ko name | type | effect | use time s | sources |
|---|---|---|---|---|---|
| `bandage` | Bandage / 붕대 | heal | +15 HP, up to `maxHeal` 100 | 3 | [src:survev/shared/defs/gameObjects/gearDefs.ts:388-410] [src:derived/survev@9f64948d:src/defs/gearDefs.js:139-161] [src:l10n/ko:game-bandage] [src:wikigg/Bandage] [H] |
| `healthkit` | Med Kit / 구급상자 | heal | +100 HP (full) | 6 | [src:survev/shared/defs/gameObjects/gearDefs.ts:411-434] [src:derived/survev@9f64948d:src/defs/gearDefs.js:162-184] [src:l10n/ko:game-healthkit] [src:wikigg/Med_Kit] [H] |
| `soda` | Soda / 소다 | boost | +25 adrenaline | 3 | [src:survev/shared/defs/gameObjects/gearDefs.ts:325-346] [src:derived/survev@9f64948d:src/defs/gearDefs.js:185-206] [src:l10n/ko:game-soda] [src:wikigg/Soda] [H] |
| `painkiller` | Pills / 알약 | boost | +50 adrenaline | 5 | [src:survev/shared/defs/gameObjects/gearDefs.ts:347-369] [src:derived/survev@9f64948d:src/defs/gearDefs.js:207-228] [src:l10n/ko:game-painkiller] [src:wikigg/Pills] [H] |

- Heal items use the red aura `part-aura-circle-01.img` (0xff0000) and the `heal` emitter; boosts the same aura in 0x199500 green and the `boost` emitter; sounds `bandage_use_01`, `healthkit_use_01`, `soda_use_01`, `pills_use_01` [src:survev/shared/defs/gameObjects/gearDefs.ts:325-434] [src:changelog/0.7.1] [H]
- Heal/boost loot radius 1 [src:survev/shared/gameConfig.ts:448-449] [H]
- Use rules (survev): a heal is refused at full health (unless the user has the Medic `aoe_heal` perk), and both item types are refused while another item is in use, while reviving, or while cooking a throwable; starting one cancels reloads [src:survev/server/src/game/objects/player.ts:3250-3277] [src:survev/server/src/game/objects/player.ts:3302-3328] [H]
- The effect applies when the use timer completes; the item is consumed then [src:survev/server/src/game/objects/player.ts:1679-1712] [H]
- While using an item the player moves at half speed, unless they have Field Medic (`field_medic`, +1 speed instead) [src:survev/server/src/game/objects/player.ts:4751-4765] [src:survev/shared/defs/gameObjects/perkDefs.ts:94-96] [src:fandom/Med_Kit] [H]
- The Medic `aoe_heal` perk cuts use time to 0.75× and applies the item to nearby non-downed teammates (heal range 8 in config) [src:survev/server/src/game/objects/player.ts:3275] [src:survev/server/src/game/objects/player.ts:3279-3300] [src:survev/shared/gameConfig.ts:223] [H]
- Bandage history: hotkey 7 (0.2.3); use time cut (0.3.5) and cut again (0.4.3, to 2.6 s); 0.7.1 removed the 75 HP heal cap and raised use time 2.6 → 3.0 s [src:changelog/0.3.5] [src:changelog/0.4.3] [src:changelog/0.7.1] [src:fandom/Bandage] [H]
- The en/ko string `game-healing-tooltip` "Cannot heal past 75 health." / "체력이 75를 넘어 치료할 수 없습니다." is a leftover from before 0.7.1 [src:survev/client/src/en.json:375] [src:l10n/ko:game-healing-tooltip] [src:changelog/0.7.1] [H]
- Med Kit ("health pak" in early changelogs) restores to full and its use time grew by 1 s in 0.1.51; painkiller use time fell by 1 s in the same patch [src:changelog/0.1.51] [src:fandom/Med_Kit] [H]
- Bandages spawn in stacks of 5 (`tier_medical`: bandage ×5 weight 16, healthkit 4, soda 15, painkiller 5; survev estimate) [src:survev/shared/defs/maps/baseDefs.ts:159-164] [src:fandom/Bandage] [M]
- Tooltips: "Left-click to restore 15 health." / "…100 health." / "Left-click to boost adrenaline by 25." / "…by 50." [src:survev/client/src/en.json:374-382] [src:l10n/ko:game-soda-tooltip] [H]

### Adrenaline (boost) effects

- Adrenaline is capped at 100 and decays 0.375 per second (survev config; matches fandom and wiki.gg) [src:survev/shared/gameConfig.ts:193] [src:fandom/Adrenaline] [src:wikigg/Adrenaline] [H]
- Breakpoints `[1, 1, 1.5, 0.5]` split the bar into 0–25, 25–50, 50–87.5, 87.5–100 [src:derived/survev@9f64948d:src/gameConfig.ts:123] [src:survev/server/src/game/objects/player.ts:72-84] [H]
- survev regen per level: 0.5, 1.25, 1.5, 1.75 HP/s (`boostHealAmounts`, server-only value) [src:survev/shared/gameConfig.ts:195] [src:survev/server/src/game/objects/player.ts:1522-1532] [src:wikigg/Adrenaline] [M]
- At 50 adrenaline or more the player gains +1.85 move speed (base 12) [src:survev/shared/gameConfig.ts:194] [src:survev/server/src/game/objects/player.ts:4734-4737] [src:wikigg/Adrenaline] [M]
- Adrenaline duration and speed bonus were slightly lowered in 0.4.1 and again in 0.4.3 [src:changelog/0.4.1] [src:changelog/0.4.3] [H]
- Downed players lose all adrenaline [src:survev/server/src/game/objects/player.ts:1544-1546] [H]
- Full boost/healing mechanics belong to `mechanics/boost.md` and `mechanics/healing.md` [src:derived/kb-layout] [L]

## Gear documented on wikis but absent from survev (post-0.8.82)

- Fandom's backpack capacity template lists 40mm (10/20/30/40), heart_ammo and rainbow_ammo (1) and mine rows, which belong to post-0.8.82 items (post-0.8.82) [src:fandom/Backpacks] [M]
- Flask (consumable sharing the soda sounds, used against Idle Freeze on snow maps) (post-0.8.82) [src:fandom/Soda] [src:fandom/Snowball] [L]

## Fork changes to original gear (revert list)

- `bagSizes`: drop the 5th column; restore 50AE 49/98/147/196 and 308sub 10/20/40/80; remove tomato and coconut rows (fork) [src:derived/survev@9f64948d:src/gameConfig.ts:260-284] [src:kong/relaunch-client-defs] [H]
- Woods `bagSizes` override: frag/smoke 6/12/15/18 (drop the 20) (fork) [src:derived/survev@4b291f4d:shared/defs/maps/woodsDefs.ts:54-57] [H]
- Remove backpack04, backpack04_cloud, helmet04_captain, helmet04_classless; restore chest04 loot sprite `loot-chest-03.img` (fork) [src:kong/relaunch-client-defs] [src:derived/survev-git-75b772db] [H]
- Flak Jacket capacity bonuses (+3 frag, +2 MIRV) are fork-only (fork) [src:balance/299] [H]
- en name ".50 Caliber" is a fork rename of ".50 AE" (fork) [src:survev/client/src/en.json:391] [src:derived/survev@9f64948d:src/defs/gearDefs.js:63-77] [src:l10n/ko:game-50AE] [H]

## Conflicts

- CONFLICT 308sub-capacity-fandom: fandom backpack template lists .308 Subsonic 10/20/30/40 [src:fandom/Backpacks] vs original config 10/20/40/80, also on fandom's own .308 page [src:derived/survev@9f64948d:src/gameConfig.ts:266] [src:fandom/.308_Subsonic] [src:kong/relaunch-client-defs]; proposed: 10/20/40/80 [H]
- CONFLICT 308sub-capacity-fork: balance.txt says 20/40/60/80 [src:balance/252] vs survev config 20/40/55/70/85 [src:survev/shared/gameConfig.ts:421]; proposed: irrelevant for 0.8.82, use 10/20/40/80 [M]
- CONFLICT 50ae-capacity: original 49/98/147/196 [src:derived/survev@9f64948d:src/gameConfig.ts:265] [src:fandom/.50_AE] vs survev 50/100/150/200/250 [src:survev/shared/gameConfig.ts:420]; proposed: 49/98/147/196 [H]
- CONFLICT adrenaline-regen: fandom table gives 1 / 3.75 / 4.75 / 5 HP per second by level [src:fandom/Adrenaline] vs survev and wiki.gg 0.5 / 1.25 / 1.5 / 1.75 HP/s [src:survev/shared/gameConfig.ts:195] [src:wikigg/Adrenaline]; proposed: keep survev values as a knob (fandom numbers may be per 2 s or another unit) [L]
- CONFLICT bandage-heal-wording: fandom says bandages heal "15% of a player's health" [src:fandom/Bandage] vs flat +15 HP [src:derived/survev@9f64948d:src/defs/gearDefs.js:139-161]; proposed: flat 15 HP (max health is 100, so equal) [H]
- CONFLICT 15x-scope-level-fandom: fandom infobox gives the 15x scope `level` 8 [src:fandom/Scopes] vs def level 15 [src:derived/survev@9f64948d:src/defs/gearDefs.js:526-541]; proposed: 15 [H]
- CONFLICT leader-helmet-name: def `name` "Leader Helmet" [src:survev/shared/defs/gameObjects/gearDefs.ts:674-682] vs displayed "Commander Helmet" [src:survev/client/src/en.json:406]; proposed: display l10n [H]
- CONFLICT lone-survivr-helmet-level: fandom infobox lists the Lone Survivr helmets as level 3 with 0.7 reduction [src:fandom/Helmets] vs defs level 4, 0.7 [src:derived/survev@9f64948d:src/defs/gearDefs.js:707-738]; proposed: level 4 [H]

## Open questions

- Original adrenaline regen per level and decay are not in client data (only `boostBreakpoints`); survev's values are unverified against the original server [src:derived/survev@9f64948d:src/gameConfig.ts:117-140] [src:fandom/Adrenaline] [L]
- Original loot weights for armour, packs, scopes and medical items are survev estimates (`// ?`, `// !`) [src:survev/shared/defs/maps/baseDefs.ts:94-164] [L]
- Did the original slow players to half speed while healing (survev: ×0.5), and by how much did Field Medic change it? [src:survev/server/src/game/objects/player.ts:4751-4765] [src:fandom/Med_Kit] [L]
