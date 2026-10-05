# Melee weapons

> Every melee def in survev `shared/defs/gameObjects/meleeDefs.ts` (47 ids: 42 from the original client, 5 fork additions), with the original v0.8.82 value next to every survev value the fork changed.
> "orig" values come from survev's first commit `9f64948d` (2023-12-11, decompiled original client, `src/defs/meleeDefs.js`), cited as `derived/survev@9f64948d:<path>:<lines>`. The 2026 Kongregate relaunch bundle (`kong/relaunch-client-defs`, v0.8.82) has the same 42 ids with the same values except the `crowbar`/`crowbar_scout` sprite (see `provenance/live-vs-survev.md` and CONFLICT crowbar-sprite).
> Display names: the UI shows l10n `game-<id>`, not the def `name` field. English from survev `client/src/en.json`, Korean from `client/public/l10n/ko.json`.

## Provenance summary

- The original 0.8.82 client has 42 melee ids: 17 base defs (fists, knuckles, karambit, bayonet, huntsman, bowie, machete, saw, woodaxe, fireaxe, katana, naginata, stonehammer, hook, pan, spade, crowbar) and 25 skins built with `defineSkin(baseType, …)` [src:derived/survev@9f64948d:src/defs/meleeDefs.js:1-1224] [src:kong/relaunch-client-defs] [H]
- survev adds 5 ids: `iceaxe` (commit `78af45bc`, 2025-12-29), `cutlass` and `cutlass_gold` (commit `0612754a`, 2025-12-25), `naginata_daemon` (commit `294ac9e6`, 2026-04-17, "feat: classless"), `karambit_borealis` (commit `18d34661`, 2026-08-28, "feat: pass 2 cosmetics") (fork) [src:derived/survev-git-78af45bc] [src:derived/survev-git-0612754a] [src:derived/survev-git-294ac9e6] [src:derived/survev-git-18d34661] [src:kong/relaunch-client-defs] [H]
- wiki.gg calls the Ice Axe "survev.io's first weapon that did not come from surviv.io" (fork) [src:wikigg/Ice_Axe] [M]
- Every original melee def carries `headshotMult: 1`. survev commit `513c60d2` (2025-12-29) deleted the field from all melee defs; the server already skipped headshot rolls for `type == "melee"` before that commit, so survev melee never rolls a headshot [src:derived/survev@9f64948d:src/defs/meleeDefs.js:18] [src:derived/survev-git-513c60d2] [src:survev/server/src/game/objects/player.ts:2459-2466] [H]
- Fork balance change: Spade (`spade`, `spade_assault`) obstacleDamage 1 → 1.3 and cooldown 0.35 → 0.3 s, logged as 0.3.13 (2026-08-23) (fork) [src:balance/326] [src:survev/shared/defs/gameObjects/meleeDefs.ts:993-1046] [src:kong/relaunch-client-defs] [H]
- Fork change: base `crowbar` lost `noPotatoSwap: true` and got its own sprite `loot-melee-crowbar.img` (commit `5015d2b5`, 2026-01-27, "add custom sprite for regular crowbar") (fork) [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [src:derived/survev-git-5015d2b5] [src:survev/shared/defs/gameObjects/meleeDefs.ts:1047-1099] [src:kong/relaunch-client-defs] [H]
- Crowbar sprites in 0.8.82: the relaunch bundle draws both `crowbar` and `crowbar_scout` with `loot-melee-crowbar-scout.img` (survev's `crowbar_scout` matches), while the decompiled first commit uses `loot-melee-crowbar-recon.img` for both; fandom records the 0.8.81 rename of the Scouting Crowbar sprite from `-recon` to `-scout`, so the relaunch value is the 0.8.82 one (see CONFLICT crowbar-sprite) [src:kong/relaunch-client-defs] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:1165-1168] [src:survev/shared/defs/gameObjects/meleeDefs.ts:1358-1364] [src:fandom/Crowbar] [M]
- Fork change: base `crowbar` was made obtainable in survev v0.2.1 (2 Feb 2026) from the Crowbar Case (`tier_crow_case_melee`) in the Alternate Warehouse; in 0.8.82 it is a never-spawned prototype def (fork) [src:wikigg/Crowbar] [src:survev/shared/defs/maps/baseDefs.ts:215] [src:fandom/Crowbar] [H]
- survev `tier_crow_case_melee` weights per map: base crowbar 1; snow crowbar 3 / iceaxe 1; desert crowbar 1 / stonehammer 1; savannah crowbar 9 / sledgehammer 1 (fork) [src:survev/shared/defs/maps/baseDefs.ts:215] [src:survev/shared/defs/maps/snowDefs.ts:191-194] [src:survev/shared/defs/maps/desertDefs.ts:209-212] [src:survev/shared/defs/maps/savannahDefs.ts:167-170] [H]
- Fork change: the crowbar family's deploy sound changed from `frag_pickup_01` to `stow_weapon_01` (commit `8bf6da99`, 2026-02-11, "fix: crowbar deploy sound"); original, relaunch and fandom all have `frag_pickup_01` (fork) [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [src:kong/relaunch-client-defs] [src:derived/survev-git-8bf6da99] [src:fandom/Crowbar] [H]
- Fork change: the knuckles, karambit, bayonet and huntsman families gained `anim.deployAnims` / `idleAnims` (plus the knuckles idle sound `knuckles_bash_01`), and the karambit attack anims changed from `["slash", "fists"]` to `["slash", "stab"]` (commit `6f67d93c`, 2026-01-21); the original and relaunch defs have none of these (fork) [src:derived/survev-git-6f67d93c] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:47-269] [src:kong/relaunch-client-defs] [H]
- Minor fork def edits: `fists` gained `sound.pickup: "none"`, and `lootImg.rad: 25` was dropped from fists and the knuckles family (fork) [src:derived/survev@9f64948d:src/defs/meleeDefs.js:10-103] [src:survev/shared/defs/gameObjects/meleeDefs.ts:83-178] [src:kong/relaunch-client-defs] [H]
- Fork change: survev added `lore` strings to karambit_rugged, bayonet_rugged, bayonet_woodland, huntsman_rugged and huntsman_burnished; the original defs have no lore for them (fork) [src:derived/survev@9f64948d:src/defs/meleeDefs.js:1005-1085] [src:survev/shared/defs/gameObjects/meleeDefs.ts:1197-1278] [H]
- Fork change: survev's Ice Axe replaces the Sledgehammer in the Alternate Barn on winter maps and the Stone Hammer in woods airdrop/hatchet tables (fork) [src:balance/205-206] [src:balance/235] [H]

## How a melee swing works (survev code)

| field / rule | behaviour | sources |
|---|---|---|
| trigger | a swing starts when no melee anim is playing, `weapon.cooldown < 0`, and the attack button was just pressed (or is held and `autoAttack` is true). It cancels any action (reload, heal) | [src:survev/server/src/game/weaponManager.ts:404-420] [H] |
| `attack.cooldownTime` | sets the weapon cooldown and the melee anim length. It is the time between swings | [src:survev/server/src/game/weaponManager.ts:418-419] [src:wikigg/Melee_weapons] [H] |
| `attack.damageTimes` | one damage event per entry, at that many seconds after the swing starts. Two entries (saw family) = two hits per swing | [src:survev/server/src/game/weaponManager.ts:420-430] [src:wikigg/Melee_weapons] [H] |
| hitbox | a circle of radius `attack.rad` centred at `attack.offset` rotated to the aim direction; the x offset grows by `scale − 1` for resized players | [src:survev/server/src/game/weaponManager.ts:1028-1039] [src:wikigg/Melee_weapons] [H] |
| obstacle filter | obstacles are hit only if same layer, not dead, not a skin, and `height >= meleeHeight` (0.25) | [src:survev/server/src/game/weaponManager.ts:1060-1066] [src:survev/shared/gameConfig.ts:221] [H] |
| `cleave` | cleaving weapons damage every target in the circle; they also ray-check each obstacle from the player and skip it if another obstacle is in front (no hitting through walls). Non-cleaving weapons hit only the single best target | [src:survev/server/src/game/weaponManager.ts:1075-1093] [src:survev/server/src/game/weaponManager.ts:1165-1168] [H] |
| player line of sight | a player is skipped if an obstacle (height ≥ 0.25) on the segment from the attacker is closer than the target | [src:survev/server/src/game/weaponManager.ts:1131-1141] [H] |
| target priority | sort by priority (enemy players 0, obstacles 1, teammates 2), then by deepest penetration | [src:survev/server/src/game/weaponManager.ts:1143-1162] [H] |
| obstacle damage | `damage × obstacleDamage`; the hit also calls `interact` (opens doors) | [src:survev/server/src/game/weaponManager.ts:1174-1184] [src:changelog/0.2.6] [H] |
| player damage | `damage` with no headshot roll, so chest reduction plus 0.3 × helmet reduction applies; teammates take no damage | [src:survev/server/src/game/weaponManager.ts:1185-1193] [src:survev/server/src/game/objects/player.ts:2423-2490] [src:fandom/Melee_weapons] [H] |
| `armorPiercing` | needed to damage `armorPlated` obstacles (ammo crates). It does not bypass player armour | [src:survev/server/src/game/objects/obstacle.ts:464-480] [src:wikigg/Melee_weapons] [src:changelog/0.5.0] [H] |
| `stonePiercing` | needed to damage `stonePlated` obstacles (hardstone blocks, eye bunker walls, safe, aged statues) | [src:survev/server/src/game/objects/obstacle.ts:479-480] [src:wikigg/Melee_weapons] [H] |
| `switchDelay` | 0.25 on every melee. Switching to melee sets cooldown to `max(remaining cooldown, switchDelay)` | [src:survev/server/src/game/weaponManager.ts:162-166] [src:survev/shared/defs/gameObjects/meleeDefs.ts:88] [H] |
| `speed.equip` | +1 to the base 12 move speed while melee is held, but only when no damage time is pending (mid-swing loses it) | [src:survev/server/src/game/objects/player.ts:4708-4720] [src:survev/shared/gameConfig.ts:201] [src:fandom/Melee_weapons] [H] |
| `speed.attack` | only knuckles define it (0). It only applies while `shotSlowdownTimer > 0`, which only guns set, so it has no effect | [src:survev/shared/defs/gameObjects/meleeDefs.ts:138-141] [src:survev/server/src/game/objects/player.ts:4722-4724] [src:survev/server/src/game/weaponManager.ts:741] [H] |
| `noDropOnDeath` | set on the knuckles, karambit, bayonet, huntsman and bowie families (loadout items): they are not dropped on death; fists are never dropped | [src:survev/server/src/game/objects/player.ts:2925-2933] [src:survev/shared/defs/gameObjects/meleeDefs.ts:128] [src:fandom/Fists] [H] |
| `noPotatoSwap` | potato swaps never roll or replace this item | [src:survev/server/src/game/objects/player.ts:4057-4098] [H] |
| `quality` | 1 = picked by the Rare Potato perk during potato swaps | [src:survev/server/src/game/objects/player.ts:4062-4068] [src:changelog/0.7.52] [H] |
| `reflectSurface` (pan) | see the Pan section; only the pan has it | [src:survev/shared/defs/gameObjects/meleeDefs.ts:970-991] [H] |
| `anim.deployAnims` / `idleAnims` (fork) | survev-only client flourishes on knuckles (spin, slam, bash), karambit (spin, rapid spin, front/back spin), bayonet (unsheathe, inspect), huntsman (catch, inspect); absent from the original defs, so drop them for 0.8.82 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:142-149] [src:survev/server/src/game/weaponManager.ts:433-440] [src:derived/survev-git-6f67d93c] [H] |
| `sound.playerHit2` | saw family plays `saw_hit_01` on the second hit | [src:survev/shared/defs/gameObjects/meleeDefs.ts:487-493] [src:fandom/Bonesaw] [H] |
| `perk` | `cutlass_gold` grants the `pirate` perk (Pirate's Bounty) while carried (fork) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1422-1430] [src:wikigg/Pirate's_Bounty] [H] |
| swing types | wikis group them as single (most), double (bonesaws) and automatic (hook) | [src:wikigg/Melee_weapons] [src:fandom/Hook] [M] |

## Base defs: stats

> `reach` = offset.x + rad (derived). DPS = hits per swing × damage / cooldownTime (derived, max theoretical). Obstacle hit = damage × obstacleDamage.

| id | dmg | obstacleDamage (per hit) | cooldown s | damageTimes | offset.x | rad | reach | cleave | auto | AP | SP | quality | sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `fists` | 24 | 1 (24) | 0.25 | 0.1 | 1.35 | 0.9 | 2.25 | – | – | – | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:83-118] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:10-46] [src:kong/relaunch-client-defs] [H] |
| `knuckles` | 24 | 1 (24) | 0.25 | 0.1 | 1.35 | 0.9 | 2.25 | – | – | – | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:119-178] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:47-103] [H] |
| `karambit` | 24 | 1 (24) | 0.25 | 0.1 | 1.35 | 0.9 | 2.25 | – | – | – | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:179-237] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:104-159] [H] |
| `bayonet` | 24 | 1 (24) | 0.25 | 0.1 | 1.35 | 0.9 | 2.25 | – | – | – | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:238-295] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:160-214] [H] |
| `huntsman` | 24 | 1 (24) | 0.25 | 0.1 | 1.35 | 0.9 | 2.25 | – | – | – | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:296-353] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:215-269] [H] |
| `bowie` | 24 | 1 (24) | 0.25 | 0.1 | 1.35 | 0.9 | 2.25 | – | – | – | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:354-407] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:270-324] [H] |
| `machete` | 33 | 1 (33) | 0.3 | 0.12 | 1.5 | 1.75 | 3.25 | yes | – | – | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:408-461] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:325-379] [H] |
| `saw` | 44 ×2 | 1 (44) | 0.7 | 0.1, 0.5 | 2 | 1.75 | 3.75 | yes | – | – | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:462-517] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:380-436] [H] |
| `woodaxe` | 36 | 1.92 (69.12) | 0.36 | 0.18 | 1.35 | 1 | 2.35 | – | – | yes | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:518-572] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:437-492] [H] |
| `fireaxe` | 44 | 2.4 (105.6) | 0.42 | 0.21 | 1.35 | 1 | 2.35 | – | – | yes | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:573-627] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:493-548] [H] |
| `katana` | 40 | 1.5 (60) | 0.4 | 0.2 | 1.75 | 2 | 3.75 | yes | – | yes | – | 0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:628-683] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:549-605] [H] |
| `naginata` | 56 | 1.92 (107.52) | 0.54 | 0.27 | 3.5 | 2 | 5.5 | yes | – | yes | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:684-739] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:606-662] [H] |
| `stonehammer` | 60 | 1.92 (115.2) | 0.5 | 0.25 | 1.35 | 1.25 | 2.6 | – | – | yes | yes | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:740-795] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:663-719] [H] |
| `hook` | 18 | 1 (18) | 0.175 | 0.075 | 1.5 | 1 | 2.5 | – | yes | – | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:852-904] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:720-773] [H] |
| `pan` | 60 | 0.8 (48) | 0.5 | 0.15 | 2 | 1.5 | 3.5 | – | – | – | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:905-992] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:774-862] [H] |
| `spade` | 40 | orig 1 (40); survev 1.3 (52) (fork) | orig 0.35; survev 0.3 (fork) | 0.12 | 1.75 | 1.5 | 3.25 | – (`cleave: false`) | – | – | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:993-1046] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:863-917] [src:balance/326] [H] |
| `crowbar` | 33 | 1.4 (46.2) | 0.3 | 0.12 | 1.25 | 1.25 | 2.5 | – (`cleave: false`) | – | – | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1047-1099] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [H] |
| `iceaxe` (fork) | 44 | 2.4 (105.6) | 0.4 | 0.21 | 1.4 | 1.3 | 2.7 | – | – | yes | yes | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:796-851] [src:wikigg/Ice_Axe] [H] |
| `cutlass` (fork) | 30 | 1 (30) | 0.225 | 0.1 | 2.25 | 1.75 | 4.0 | yes | – | – | – | 1 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1100-1153] [src:wikigg/Cutlass] [H] |

- Every melee def has `switchDelay` 0.25 and `speed.equip` 1 [src:survev/shared/defs/gameObjects/meleeDefs.ts:83-1153] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:10-974] [H]
- `quality` 0 base defs: fists, knuckles, karambit, bayonet, huntsman, bowie, woodaxe, katana; all others 1 [src:survev/shared/defs/gameObjects/meleeDefs.ts:83-1153] [H]
- `noPotatoSwap: true` in the original base defs: knuckles, karambit, bayonet, huntsman, bowie, machete, saw, spade, crowbar; survev drops it from crowbar (fork) [src:derived/survev@9f64948d:src/defs/meleeDefs.js:10-974] [src:survev/shared/defs/gameObjects/meleeDefs.ts:83-1153] [src:kong/relaunch-client-defs] [H]
- Melee loot radius is 1.25 [src:survev/shared/gameConfig.ts:444] [src:derived/survev@9f64948d:src/gameConfig.ts:287] [H]

### Derived numbers

| id | max DPS (players) | obstacle DPS | sources |
|---|---|---|---|
| fists and fist-reskins | 96 | 96 | [src:derived/24/0.25] [src:namu/Surviv.io/무기] [H] |
| machete family | 110 | 110 | [src:derived/33/0.3] [H] |
| saw family | 125.7 | 125.7 | [src:derived/88/0.7] [src:fandom/Bonesaw] [H] |
| woodaxe | 100 | 192 | [src:derived/36/0.36] [H] |
| fireaxe | 104.8 | 251.4 | [src:derived/44/0.42] [H] |
| katana family | 100 | 150 | [src:derived/40/0.4] [H] |
| naginata | 103.7 | 199.1 | [src:derived/56/0.54] [src:namu/Surviv.io/무기] [H] |
| stonehammer, sledgehammer | 120 | 230.4 | [src:derived/60/0.5] [H] |
| warhammer_tank | 106.7 | 204.8 | [src:derived/64/0.6] [src:wikigg/Hammers] [H] |
| hook | 102.9 | 102.9 | [src:derived/18/0.175] [H] |
| pan | 120 | 96 | [src:derived/60/0.5] [H] |
| spade family | orig 114.3; fork 133.3 | orig 114.3; fork 173.3 | [src:derived/40/0.35-vs-0.3] [H] |
| crowbar family | 110 | 154 | [src:derived/33/0.3] [H] |
| iceaxe (fork) | 110 | 264 | [src:derived/44/0.4] [H] |
| cutlass (fork) / cutlass_gold (fork) | 133.3 / 155.6 | 133.3 / 155.6 | [src:derived/30-35/0.225] [H] |

- Hit counts to kill an unarmoured 100 HP player: fists 5, machete 4, woodaxe 3, katana 3, naginata 2, stonehammer 2, pan 2, warhammer_tank 2, hook 6 [src:derived/ceil(100/damage)] [src:fandom/Wood_Axe] [H]
- The naginata hitbox starts 1.5 units in front of the player centre (3.5 − 2), so targets hugging the wielder can sit in a blind spot [src:derived/naginata-offset-minus-rad] [src:fandom/Naginata] [M]

## Skins and variants

> A skin copies its base def through `defineSkin`/`defineMeleeSkin` (deep merge) and adds `baseType`. Unless a row says otherwise its stats equal the base row above.

| id | def `name` | base | en display | ko display | differences from base / notes | sources |
|---|---|---|---|---|---|---|
| `fists` (skin entry) | Fists | fists | Fists | 주먹 | rarity Stock (0), lore "The old one-two." | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1156-1160] [src:l10n/ko:game-fists] [src:survev/client/src/en.json:528] [H] |
| `knuckles_rusted` | Knuckles Rusted | knuckles | Knuckles Rusted | 녹슨 너클즈 | rarity Uncommon (2), lore "Rust up for the dust up.", noPotatoSwap false | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1161-1172] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:981-992] [src:l10n/ko:game-knuckles_rusted] [H] |
| `knuckles_heroic` | Knuckles Heroic | knuckles | Knuckles Heroic | 영웅의 너클즈 | rarity Rare (3), lore "Give 'em a hero sandwich." | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1173-1184] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:993-1004] [src:l10n/ko:game-knuckles_heroic] [H] |
| `karambit_rugged` | Karambit Rugged | karambit | Karambit Rugged | 단단한 카람빗 | rarity Rare (3) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1197-1208] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:1005-1019] [src:l10n/ko:game-karambit_rugged] [H] |
| `karambit_prismatic` | Karambit Prismatic | karambit | Karambit Prismatic | 프리즘 카람빗 | rarity Epic (4) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1209-1219] [src:l10n/ko:game-karambit_prismatic] [H] |
| `karambit_drowned` | Karambit Drowned | karambit | Karambit Drowned | 젖은 카람빗 | rarity Epic (4); added 0.6.0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1220-1230] [src:changelog/0.6.0] [src:l10n/ko:game-karambit_drowned] [H] |
| `karambit_borealis` (fork) | Karambit Borealis | karambit | Karambit Borealis | — (no ko key) | rarity Epic (4), lore "Rend the skies asunder."; Survevr Pass 2 level 75 reward (fork) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1185-1196] [src:survev/shared/defs/gameObjects/passDefs.ts:283-284] [H] |
| `bayonet_rugged` | Bayonet Rugged | bayonet | Bayonet Rugged | 튼튼한 총검 | rarity Rare (3); Survivr Pass 1 level 50 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1231-1242] [src:survev/shared/defs/gameObjects/passDefs.ts:105-106] [src:fandom/Bayonet] [H] |
| `bayonet_woodland` | Bayonet Woodland | bayonet | Bayonet Woodland | 우드랜드 총검 | rarity Epic (4); Survivr Pass 1 level 99 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1243-1254] [src:survev/shared/defs/gameObjects/passDefs.ts:109-110] [src:fandom/Bayonet] [H] |
| `huntsman_rugged` | Huntsman Rugged | huntsman | Huntsman Rugged | 튼튼한 사냥꾼 | rarity Rare (3) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1255-1266] [src:l10n/ko:game-huntsman_rugged] [H] |
| `huntsman_burnished` | Huntsman Burnished | huntsman | Huntsman Burnished | 빛나는 사냥꾼 | rarity Epic (4) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1267-1278] [src:l10n/ko:game-huntsman_burnished] [H] |
| `bowie_vintage` | Bowie Vintage | bowie | Bowie Vintage | 빈티지 보이 나이프 | rarity Rare (3) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1279-1287] [src:l10n/ko:game-bowie_vintage] [H] |
| `bowie_frontier` | Bowie Frontier | bowie | Bowie Frontier | 빈티지 보이 나이프 (same string as Vintage) | rarity Epic (4) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1288-1298] [src:l10n/ko:game-bowie_frontier] [H] |
| `machete_taiga` | UVSR Taiga | machete | Machete Taiga | 타이가 마체테 | noPotatoSwap false; red Commander weapon | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1299-1306] [src:survev/shared/defs/gameObjects/roleDefs.ts:139] [src:l10n/ko:game-machete_taiga] [H] |
| `kukri_trad` | Tallow's Kukri | machete | Tallow's Kukri | 탈로우의 쿠크리 | noPotatoSwap false; blue Commander weapon; world image pos (−0.5, −46.5) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1307-1315] [src:survev/shared/defs/gameObjects/roleDefs.ts:140] [src:l10n/ko:game-kukri_trad] [H] |
| `kukri_sniper` | Marksman's Recurve | machete | Marksman's Recurve | 명사수의 리커브 | noPotatoSwap false; Marksman role weapon; Sniper class pods (cobalt) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1372-1380] [src:survev/shared/defs/gameObjects/roleDefs.ts:279] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1272] [src:fandom/Kukri] [src:l10n/ko:game-kukri_sniper] [H] |
| `bonesaw_rusted` | Bonesaw Rusted | saw | Bonesaw Rusted | 녹슨 톱 | noPotatoSwap false; Medic role weapon | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1316-1325] [src:survev/shared/defs/gameObjects/roleDefs.ts:240] [src:l10n/ko:game-bonesaw_rusted] [H] |
| `bonesaw_healer` | The Separator | saw | The Separator | 세퍼레이터 | noPotatoSwap false; Medic class pods (cobalt) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1381-1390] [src:fandom/Bonesaw] [src:l10n/ko:game-bonesaw_healer] [H] |
| `woodaxe_bloody` | Axe Bloodstained | woodaxe | Wood Axe Bloodstained | 피 묻은 나무 도끼 | cosmetic only; added 0.6.0 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1326-1334] [src:changelog/0.6.0] [src:l10n/ko:game-woodaxe_bloody] [H] |
| `katana_rusted` | Katana Rusted | katana | Katana Rusted | 녹슨 카타나 | added 0.6.9 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1335-1341] [src:changelog/0.6.9] [src:l10n/ko:game-katana_rusted] [H] |
| `katana_orchid` | Katana Orchid | katana | Katana Orchid | 오키드 카타나 | quality 1 (base katana is 0) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1342-1349] [src:l10n/ko:game-katana_orchid] [H] |
| `katana_demo` | Hakai no Katana | katana | Hakai no Katana | 하카이의 카타나 | Demo class pods (cobalt) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1391-1395] [src:fandom/Katana] [src:l10n/ko:game-katana_demo] [H] |
| `naginata_daemon` (fork) | Naginata Daemon | naginata | Naginata Daemon | — (no ko key) | sprite only; Classless class pods and the twins-bunker classless case (fork) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1417-1421] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:285-297] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1330] [src:wikigg/Naginata] [H] |
| `sledgehammer` | Sledgehammer | stonehammer | Sledgehammer | 슬렛지해머 | added 0.7.7; world image pos (−12.5, −3.5) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1350-1357] [src:changelog/0.7.7] [src:l10n/ko:game-sledgehammer] [H] |
| `warhammer_tank` | Panzerhammer | stonehammer | Panzerhammer | 팬저해머 | damage 64, offset (1.5, 0), rad 1.75 (reach 3.25), damageTimes [0.3], cooldown 0.6; Tank class pods. The only skin with different stats | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1400-1416] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:1205-1222] [src:wikigg/Hammers] [H] |
| `spade_assault` | Trench Spade | spade | Trench Spade | 참호용 야전삽 | noPotatoSwap false; Lieutenant role weapon; Assault class pods | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1396-1399] [src:survev/shared/defs/gameObjects/roleDefs.ts:212] [src:l10n/ko:game-spade_assault] [H] |
| `crowbar_scout` | Scouting Crowbar | crowbar | Scouting Crowbar | 스카우팅 크로우바 | Scout class pods; renamed from `crowbar_recon` in 0.8.81 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1358-1364] [src:fandom/Crowbar] [src:l10n/ko:game-crowbar_scout] [H] |
| `crowbar_recon` | Crowbar Carbon | crowbar | Crowbar Carbon | 탄소 크로우바 | Recon role weapon; added 0.8.81 | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1365-1371] [src:survev/shared/defs/gameObjects/roleDefs.ts:301] [src:fandom/Crowbar] [H] |
| `cutlass_gold` (fork) | Gold Cutlass | cutlass | Cutlass Gold | 황금 커틀러스 | damage 35, `perk: "pirate"`, noPotatoSwap true (fork) | [src:survev/shared/defs/gameObjects/meleeDefs.ts:1422-1430] [src:wikigg/Cutlass] [H] |

- Base-def display names (ko has no key for the base ids knuckles, karambit, bayonet, huntsman, bowie, machete, saw, spade, crowbar): Wood Axe 나무 도끼, Fire Axe 소방 도끼, Katana 카타나, Naginata 나기나타, Stone Hammer 스톤 해머, Hook 후크, Pan 후라이팬, Ice Axe 얼음 도끼 (fork), Cutlass 커틀러스 (fork) [src:l10n/ko:game-woodaxe] [src:l10n/ko:game-fireaxe] [src:l10n/ko:game-katana] [src:l10n/ko:game-naginata] [src:l10n/ko:game-stonehammer] [src:l10n/ko:game-hook] [src:l10n/ko:game-pan] [src:l10n/ko:game-iceaxe] [src:l10n/ko:game-cutlass] [H]
- namu.wiki calls the crowbar "빠루" and the stone hammer "돌망치" [src:namu/Surviv.io/무기] [M]
- Original rarity values: knuckles_rusted 2, knuckles_heroic 3, karambit_rugged 3, karambit_prismatic 4, karambit_drowned 4, bayonet_rugged 3, bayonet_woodland 4, huntsman_rugged 3, huntsman_burnished 4, bowie_vintage 3, bowie_frontier 4 (the other skins have no rarity) [src:derived/survev@9f64948d:src/defs/meleeDefs.js:976-1105] [H]
- Survivr Pass 1 melee rewards: knuckles_rusted at level 11, knuckles_heroic at level 21, bayonet_rugged at 50, bayonet_woodland at 99 [src:survev/shared/defs/gameObjects/passDefs.ts:57-110] [src:fandom/Knuckles] [src:changelog/0.8.6] [H]
- Survevr Pass 2 (fork) melee rewards: huntsman_rugged level 20, huntsman_burnished level 30, karambit_rugged level 50, karambit_borealis level 75 (fork) [src:survev/shared/defs/gameObjects/passDefs.ts:263-284] [H]

## Per-weapon facts

### Fists (`fists`)

- Default melee slot item; cannot be dropped (a "drop fists" request does nothing) [src:survev/server/src/game/weaponManager.ts:648-653] [src:fandom/Fists] [H]
- Punch damage against players was "slightly decreased" in 0.3.0; armour not reducing fist damage was fixed in 0.4.3 [src:changelog/0.3.0] [src:changelog/0.4.3] [H]
- Fists can open doors by punching (0.2.6) [src:changelog/0.2.6] [H]

### Knives (`karambit`, `bayonet`, `huntsman`, `bowie` families) and Knuckles

- Knives were added in 0.5.0 (bowie in 0.6.1); 0.5.01 made knives deal slightly more than fists (fandom: 27 damage); later they were reduced back to 24, the same as fists [src:changelog/0.5.0] [src:changelog/0.5.01] [src:changelog/0.6.1] [src:fandom/Huntsman] [src:fandom/Bowie] [M]
- Knives were removed from drop tables in 0.7.1; afterwards they came from the Survivr Pass, potato swaps or (Twitch extension) knife crates [src:changelog/0.7.1] [src:fandom/Knives] [M]
- In survev, knives appear only in the fork-only `tier_dev_melee` table (dev crate `crate_12dev`, added with Potato vs Tomato) (fork) [src:survev/shared/defs/maps/baseDefs.ts:788-797] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:793-805] [src:derived/survev-git-2255ceef] [M]
- Knife Crate (`crate_15`, `crate_16`: 4 × `tier_knives`; `mil_crate_01`: 1 × `tier_knives`), one per map from 0.5.0 until its removal in 0.7.1; the obstacle defs survive in the relaunch bundle and in survev, but survev's `tier_knives` is empty [src:wikigg/Knife_Crate] [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:887-899] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1422-1425] [src:survev/shared/defs/maps/baseDefs.ts:810] [M]
- Knuckles skins were added in 0.8.6 [src:changelog/0.8.6] [H]
- An unreleased "Huntsman Blackwater" skin existed in old files [src:fandom/Huntsman] [L]

### Machete Taiga / Kukri (`machete` family)

- Machete Taiga and Tallow's Kukri were added in 0.7.0 as the red and blue Commander melee [src:changelog/0.7.0] [src:fandom/Machete] [src:fandom/Kukri] [H]
- Machete Taiga also spawns in the Crimson Ring Club (`tier_club_melee`) [src:survev/shared/defs/maps/baseDefs.ts:252] [src:fandom/Machete] [H]
- The Kukri also drops from blue Aged Faction Statues on the desert map [src:fandom/Kukri] [M]
- The prototype def `machete` has the name "Machete" and is never spawned [src:survev/shared/defs/gameObjects/meleeDefs.ts:408-461] [src:fandom/Machete] [M]

### Bonesaw (`saw` family)

- Bonesaw Rusted was added in 0.7.6 for the 50v50 Medic; The Separator came with the 0.8.8 class update [src:changelog/0.7.6] [src:fandom/Bonesaw] [H]
- Two hits per swing (0.1 s and 0.5 s), and the highest original DPS of any melee [src:survev/shared/defs/gameObjects/meleeDefs.ts:475-478] [src:fandom/Bonesaw] [H]
- The base `saw` def is the never-spawned prototype of the Bonesaw [src:fandom/Saw] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:380-436] [M]

### Wood Axe (`woodaxe`) and Fire Axe (`fireaxe`)

- Wood Axe added in 0.5.0, together with ammo crates it can break; spawns in stumps (`tier_woodaxe`), cabin wall mounts and the crossing bunker [src:changelog/0.5.0] [src:survev/shared/defs/maps/baseDefs.ts:251] [src:fandom/Wood_Axe] [H]
- Wood Axe Bloodstained spawns on the cabin wall mount (fandom: 10 of 121 cabins) [src:fandom/Wood_Axe] [M]
- Fire Axe added in 0.6.3 (woods map); spawns in the 4th room of the Hatchet Bunker (`tier_hatchet_melee`: fireaxe 5, tier_katanas 3, stonehammer 1, survev estimate) and in the woods outhouse [src:changelog/0.6.3] [src:survev/shared/defs/maps/baseDefs.ts:369-374] [src:fandom/Fire_Axe] [M]

### Katana (`katana` family) and Naginata (`naginata`)

- Katana added in 0.6.7; spawns in the Chrysanthemum bunker (`tier_chrys_02`) and Teahouse chests (`tier_chrys_case`: nothing 5, tier_katanas 3, naginata 1, survev estimate); Katana Rusted replaces it on the snow map [src:changelog/0.6.7] [src:survev/shared/defs/maps/baseDefs.ts:203-214] [src:fandom/Katana] [M]
- `tier_katanas` weights: katana 4, katana_rusted 4, katana_orchid 1 (survev estimate) [src:survev/shared/defs/maps/baseDefs.ts:668-672] [L]
- Katana Orchid had obstacleDamage 1 until the 0.7.5 fix to 1.5 [src:fandom/Katana] [M]
- Naginata added in 0.7.3; found in Teahouse Chrysanthemum chests and the woods Pavilion [src:changelog/0.7.3] [src:fandom/Naginata] [src:survev/shared/defs/maps/baseDefs.ts:378-384] [M]
- Grenadier role carries a Katana [src:survev/shared/defs/gameObjects/roleDefs.ts:324] [src:fandom/Melee_weapons] [H]

### Stone Hammer family (`stonehammer`, `sledgehammer`, `warhammer_tank`)

- Stone Hammer added in 0.6.71 (woods: Eye Bunker room 2 after the code); desert Bank replaces Jester's Folly with it; Sledgehammer (0.7.7) spawns in the Alternate Barn basement [src:changelog/0.6.71] [src:changelog/0.7.7] [src:wikigg/Hammers] [src:survev/shared/defs/maps/baseDefs.ts:220] [src:survev/shared/defs/maps/baseDefs.ts:246] [M]
- The original barn basement spawner was `loot_tier_sledgehammer`; survev renamed it `loot_tier_barn_melee` so winter maps can swap in the Ice Axe (fork) [src:kong/relaunch-client-defs] [src:balance/205] [H]
- Panzerhammer: test-server damage 74, released 0.8.8 with 64 [src:fandom/War_Hammer] [M]
- Hammers break hardstone blocks/boulders, stone seals in the Eye and Chrysanthemum bunkers, the alternate barn wall and aged faction statues [src:fandom/Stone_Hammer] [src:wikigg/Hammers] [M]

### Hook (`hook`)

- Added 0.5.0; only automatic melee (hold to swing); found in treasure chests (`tier_pirate_melee`) [src:changelog/0.5.0] [src:fandom/Hook] [src:survev/shared/defs/maps/baseDefs.ts:330] [M]
- World image is drawn on the hand (`renderOnHand`) [src:survev/shared/defs/gameObjects/meleeDefs.ts:890-903] [H]

### Pan (`pan`)

- Added 0.5.0; normal-mode airdrop melee roll: nothing 19 : pan 1 (5 %); 50v50 military airdrops always roll a pan (`tier_airdrop_faction_melee`) [src:changelog/0.5.0] [src:survev/shared/defs/maps/baseDefs.ts:653-656] [src:survev/shared/defs/maps/baseDefs.ts:745] [src:wikigg/Pan] [M]
- Reflect segments (player-local units): equipped p0 (2.65, −0.125) → p1 (1.35, −0.74); holstered on the back p0 (−0.625, −1.2) → p1 (−1.4, −0.25) [src:survev/shared/defs/gameObjects/meleeDefs.ts:970-991] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:836-861] [H]
- The pan reflects while it is the held weapon and not mid-swing, or while worn on the back (`wearingPan`, any other slot selected); downed players switch to melee and wear the pan [src:survev/server/src/game/objects/player.ts:1258-1263] [src:survev/server/src/game/weaponManager.ts:177-183] [src:survev/server/src/game/objects/player.ts:2604-2610] [H]
- Segments scale with player size: holstered segment × scale; equipped segment shifted by ((scale − 1) × 0.75, −(scale − 1) × 0.75) [src:survev/server/src/game/objects/player.ts:1265-1286] [src:fandom/Pan] [H]
- A reflected bullet mirrors its direction about the surface normal, keeps its damage, and can bounce at most 3 times; remaining range is divided by 1.5^reflectCount [src:survev/server/src/game/objects/bullet.ts:650-680] [src:survev/shared/gameConfig.ts:308-313] [H]
- The pan blocks bullets and shrapnel but not explosions, melee or potato projectiles [src:fandom/Pan] [src:wikigg/Pan] [M]
- Hip image `loot-melee-pan-black-side.img` at (−17.25, 7.5), rotation 0.78π, scale 0.3; bullet hit sound `pan_bullet` [src:survev/shared/defs/gameObjects/meleeDefs.ts:957-969] [src:survev/shared/defs/gameObjects/meleeDefs.ts:929-935] [H]
- The pan is the only melee with obstacleDamage below 1 [src:fandom/Pan] [src:survev/shared/defs/gameObjects/meleeDefs.ts:912] [H]
- Bugler is given a pan on promotion only in the fork (2025-07-23 change) (fork) [src:balance/179] [src:survev/shared/defs/gameObjects/roleDefs.ts:348] [H]

### Spade (`spade`, `spade_assault`) and Crowbar (`crowbar`, `crowbar_scout`, `crowbar_recon`)

- Both added in 0.8.8 (cobalt classes); Crowbar Carbon added in 0.8.81 [src:fandom/Spade] [src:fandom/Crowbar] [M]
- The crowbar cannot break ammo crates (no armorPiercing) despite its obstacle multiplier 1.4 [src:survev/shared/defs/gameObjects/meleeDefs.ts:1047-1099] [src:fandom/Crowbar] [H]
- namu: one-handed melee cannot break ammo crates, two-handed melee can [src:namu/Surviv.io/무기] [M]

### Fork-only melee

- Ice Axe (`iceaxe`): winter-mode alternative to the Stone Hammer; sprite `loot-melee-ice_pick.img` (fork) [src:survev/shared/defs/gameObjects/meleeDefs.ts:796-851] [src:wikigg/Ice_Axe] [src:balance/205-206] [H]
- Cutlass (`cutlass`): beach mode, from pirate chests and airdrops (fork) [src:wikigg/Cutlass] [M]
- Gold Cutlass (`cutlass_gold`): beach Pirate Hut mount and desert Reserve; grants Pirate's Bounty (fork) [src:wikigg/Cutlass] [src:survev/shared/defs/gameObjects/meleeDefs.ts:1422-1430] [M]

## Melee items documented on wikis but absent from survev (post-0.8.82)

- Ice Pick (`icePick`): added 0.9.0 "Stay frosty" (13 Jan 2020), snow map winter crates; damage 52, obstacleDamage 2.8, cooldown 0.42, armour piercing, not stone piercing (post-0.8.82) [src:fandom/Ice_Pick] [M]
- Lasr Swrd (`lasr_swrd`, 3 colours): added 0.9.3b (4 May 2020), space crates; damage 60, obstacleDamage 1.5, offset 1.75, rad 2.1, damageTimes 0.3, cooldown 0.6, cleave, armour piercing, reflects bullets while held (post-0.8.82) [src:fandom/Lasr_Swrd] [M]
- Survivr Pass 2–4 cosmetic fist skins (not dropped on pickup): Blue Velvet, Split the diff, Frostpunch (pass 2); Moss, Immolate, Rainbow Hands, Bullet Bills, Poke, Darklets, Black Holes (pass 3); Ranger, Ember, Lined Up, Tree Puncher, Flynn, Raptor (pass 4) (post-0.8.82) [src:fandom/Melee_weapons] [M]
- Later pass melee skins such as Swords (Survivr Pass 9, 2021) and Coco Nut (Survivr Pass 7) (post-0.8.82) [src:fandom/Swords] [src:fandom/Coco_Nut] [M]
- Fist reskins added in 0.9.1 (10 Feb 2020): Red Gloves (`red_gloves`), Crab Claws (`crab_gloves`), Feral Claws (`feral_gloves`, stock), all 24 damage and undroppable (post-0.8.82) [src:fandom/Red_Gloves] [src:fandom/Crab_Claws] [src:fandom/Feral_Claws] [M]
- Paws (0.9.5c, 22 Jun 2020, shown in the Pass 3 promo but unused); Dreidel (1.2.0c, Holiday Crate); Be Present (`bePresent`) and Pine Fury (`pineFury`) (1.2d, 5 Jan 2021, New Year Crate) (post-0.8.82) [src:fandom/Paws] [src:fandom/Dreidel] [src:fandom/Be_Present] [src:fandom/Pine_Fury] [M]
- Pass melee skins: Purptog (Pass 5 gold level 18); Gold Drops (Pass 6 level 18) and Grizzly (`grizzly`, Pass 6 gold level 28); Condimentium (Pass 9 level 2); BonkBonk! (Pass 10 level 10), Orange MintStones (Pass 10 gold level 2), First Tool (level 18), Fuzzy Hooves (level 20), Ston-edgy (level 24) (post-0.8.82) [src:fandom/Purptog] [src:fandom/Gold_Drops] [src:fandom/Grizzly] [src:fandom/Condimentium] [src:fandom/BonkBonk!] [src:fandom/Orange_MintStones] [src:fandom/First_Tool] [src:fandom/Fuzzy_Hooves] [src:fandom/Ston-edgy] [M]

## Fork changes to original melee (revert list)

- `spade`, `spade_assault`: obstacleDamage 1.3 → revert to 1; cooldownTime 0.3 → revert to 0.35 (fork) [src:balance/326] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:863-917] [H]
- `crowbar`: restore `noPotatoSwap: true` and the 0.8.82 loot/world sprite `loot-melee-crowbar-scout.img` (relaunch value; the first commit has `-recon`); restore deploy sound `frag_pickup_01` on all three crowbars; remove the base crowbar from spawn tables (fork) [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [src:kong/relaunch-client-defs] [src:derived/survev-git-8bf6da99] [H]
- Knuckles, karambit, bayonet, huntsman families: remove `deployAnims`/`idleAnims`/`sound.idle` and restore karambit attack anims `["slash", "fists"]` (fork) [src:derived/survev-git-6f67d93c] [src:kong/relaunch-client-defs] [H]
- `headshotMult: 1` on every melee def was removed (fork; no gameplay effect in survev) [src:derived/survev-git-513c60d2] [H]
- Remove `iceaxe`, `cutlass`, `cutlass_gold`, `naginata_daemon`, `karambit_borealis` for 0.8.82 (fork) [src:kong/relaunch-client-defs] [H]

## Conflicts

- CONFLICT melee-headshot-roll: original defs give every melee `headshotMult: 1`, which under survev's current damage code would roll 15 % headshots that skip vest reduction [src:derived/survev@9f64948d:src/defs/meleeDefs.js:18] [src:survev/server/src/game/objects/player.ts:2459-2490] vs survev (and earlier survev code) never rolling headshots for melee, and wikis saying melee has no headshots [src:derived/survev-git-513c60d2] [src:fandom/Melee_weapons] [src:namu/Surviv.io/무기]; proposed: melee never headshots (chest + 0.3 × helmet always), keep as config knob [M]
- CONFLICT fireaxe-cooldown: fandom infobox 0.4 s [src:fandom/Fire_Axe] vs def 0.42 s [src:derived/survev@9f64948d:src/defs/meleeDefs.js:493-548]; proposed: 0.42 [H]
- CONFLICT stonehammer-rad: fandom infobox rad 1 [src:fandom/Stone_Hammer] vs def 1.25 [src:derived/survev@9f64948d:src/defs/meleeDefs.js:663-719] [src:wikigg/Hammers]; proposed: 1.25 [H]
- CONFLICT crowbar-hitbox: fandom infobox offset 1.5, rad 1.75, cleave true [src:fandom/Crowbar] vs def offset 1.25, rad 1.25, cleave false [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [src:wikigg/Crowbar]; proposed: trust the def [H]
- CONFLICT woodaxe-attack-speed: fandom infobox attackSpeed 1 [src:fandom/Wood_Axe] vs def with no `speed.attack` [src:derived/survev@9f64948d:src/defs/meleeDefs.js:437-492]; proposed: no attack speed modifier [H]
- CONFLICT fandom-melee-rarity: fandom rarity knuckles_rusted 1, knuckles_heroic 4, bayonet_woodland 5 [src:fandom/Knuckles] [src:fandom/Bayonet] vs defs 2, 3, 4 [src:derived/survev@9f64948d:src/defs/meleeDefs.js:981-1063]; proposed: trust the defs [M]
- CONFLICT knife-nerf-version: fandom says knives returned to 24 damage in 0.7.5 [src:fandom/Fists] vs the 0.7.5 changelog, which lists no melee change [src:changelog/0.7.5]; proposed: date unknown, 24 is the 0.8.82 value either way [L]
- CONFLICT machete-name: def `name` "UVSR Taiga" (fandom transcribes "USVR Taiga") [src:survev/shared/defs/gameObjects/meleeDefs.ts:1299-1306] [src:fandom/Machete] vs displayed "Machete Taiga" [src:survev/client/src/en.json:566]; proposed: display l10n "Machete Taiga" [H]
- CONFLICT woodaxe-bloody-name: def `name` "Axe Bloodstained" [src:survev/shared/defs/gameObjects/meleeDefs.ts:1326-1334] vs displayed "Wood Axe Bloodstained" [src:survev/client/src/en.json:554]; proposed: display l10n [H]
- CONFLICT crowbar-sprite: decompiled first commit gives `crowbar` and `crowbar_scout` the sprite `loot-melee-crowbar-recon.img` [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:1165-1168] vs the relaunch bundle's `loot-melee-crowbar-scout.img`, matching fandom's note that 0.8.81 renamed the Scouting Crowbar sprite to `-scout` [src:kong/relaunch-client-defs] [src:fandom/Crowbar]; proposed: `loot-melee-crowbar-scout.img` for both [M]
- CONFLICT bowie-frontier-ko: ko l10n gives Bowie Frontier the same string as Bowie Vintage ("빈티지 보이 나이프") [src:l10n/ko:game-bowie_frontier] [src:l10n/ko:game-bowie_vintage]; proposed: keep the official string, flag as translation bug [M]

## Open questions

- Did the original server roll headshots for melee (headshotMult 1 skips vest reduction)? No original server code exists; wikis only say melee has no headshot multiplier [src:fandom/Melee_weapons] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:18] [L]
- Original melee spawn weights (hatchet bunker, chrysanthemum chest, airdrop melee) are survev estimates marked `// ?` [src:survev/shared/defs/maps/baseDefs.ts:210-214] [src:survev/shared/defs/maps/baseDefs.ts:369-374] [L]
- Exact knife damage history between 0.5.01 (27) and 0.8.82 (24) [src:fandom/Huntsman] [src:changelog/0.5.01] [L]
