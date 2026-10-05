# Damage pipeline and armour

> How a hit becomes lost HP, traced through survev `Player.damage` (`server/src/game/objects/player.ts:2410-2540`), `bullet.ts`, `explosion.ts`, `weaponManager.ts` (melee and gun multipliers) and `gameModeManager.ts` (death and kill credit). Cross-checked against fandom, wiki.gg and namu.
> The original client defs (survev first commit `9f64948d`, cited `derived/survev@9f64948d:<path>:<lines>`) contain `headshotMult`, armour `damageReduction` and explosion damage. The headshot chance (0.15) and the reduction order are server logic that survev reconstructed. Gun stats are in items/guns.md, bullet stats in items/bullets.md, armour items in items/gear.md, and the explosion and gas models in their own mechanics files.

## Damage types

| `DamageType` | value | used for | armour applies? | sources |
|---|---|---|---|---|
| `Player` | 0 | bullets, melee, player-thrown explosives, obstacle explosions | yes | [src:survev/shared/gameConfig.ts:25-31] [src:derived/survev@9f64948d:src/gameConfig.ts:59-65] [src:survev/server/src/game/weaponManager.ts:1184-1191] [H] |
| `Bleeding` | 1 | downed bleed-out, the `trick_drain` (That Sucks) drain, and the team-wipe kill | no | [src:survev/server/src/game/objects/player.ts:1600-1630] [src:survev/server/src/game/group.ts:56-66] [src:survev/server/src/game/objects/player.ts:2454-2458] [H] |
| `Gas` | 2 | red zone | no | [src:survev/server/src/game/objects/player.ts:1648-1669] [src:survev/server/src/game/objects/player.ts:2454-2458] [src:fandom/Flak_Jacket] [H] |
| `Airdrop` | 3 | crate landing crush (survev: 1e10 damage) | yes, but 1e10 kills through anything | [src:survev/server/src/game/objects/airdrop.ts:86-91] [H] |
| `Airstrike` | 4 | airstrike bombs (explosions) | yes, as an explosion | [src:survev/server/src/game/objects/plane.ts:692] [H] |

## Pipeline order (`Player.damage`)

1. Return with no effect if: god mode (debug); the target is dead; the target is downed and less than `downedDamageBuffer` 0.1 s has passed since the down (a survev addition from 2025, first 1 s); or a perk-mode player has not picked a role yet [src:survev/server/src/game/objects/player.ts:2411-2416] [src:survev/shared/gameConfig.ts:209] [src:derived/survev-git-decfabdd] [H]
2. Teammates cannot hurt each other: if the source is a player on the same team, other than the target itself, and the target is not disconnected, the hit is dropped (fork `combat_stims` heals 6 % of the hit instead). Self-damage (own grenade, reflected bullets) is allowed [src:survev/server/src/game/objects/player.ts:2422-2443] [src:survev/server/src/game/objects/bullet.ts:273] [src:changelog/0.7.0] [src:fandom/Player] [H]
3. Gas and bleeding skip everything below up to step 8 (no headshot, no armour, no damage perks) [src:survev/server/src/game/objects/player.ts:2454-2458] [src:fandom/Flak_Jacket] [src:wikigg/Cast_Ironskin] [H]
4. Headshot roll: if the source def (`gameSourceType`) has `headshotMult` and the hit is not an explosion, `isHeadShot = random() < headshotChance (0.15)`. On a headshot `damage ×= headshotMult` [src:survev/server/src/game/objects/player.ts:2459-2468] [src:survev/shared/gameConfig.ts:200] [src:fandom/Headshot] [src:namu/Surviv.io/장비] [H]
5. Reductions. Each is `damage −= damage × mult`, where `mult ×= armorPenetration` if the hit carries one (fork `ap_rounds` 0.8). They apply in this order [src:survev/server/src/game/objects/player.ts:2447-2452] [src:survev/shared/defs/gameObjects/perkDefs.ts:41-44] [H]
   - `flak_jacket`: 0.9 against explosions (incl. shrapnel), 0.1 against everything else [src:survev/server/src/game/objects/player.ts:2470-2476] [src:survev/shared/defs/gameObjects/perkDefs.ts:17-20] [src:fandom/Flak_Jacket] [src:wikigg/Flak_Jacket] [H]
   - `steelskin` (Cast Ironskin): original 0.5, fork 0.45 (0.4 in fork 0.1.2, 0.45 in 0.1.21) [src:survev/server/src/game/objects/player.ts:2478-2480] [src:survev/shared/defs/gameObjects/perkDefs.ts:13-16] [src:balance/138-141] [src:fandom/Cast_Ironskin] [src:wikigg/Cast_Ironskin] [H]
   - chest (vest) `damageReduction`, body hits only [src:survev/server/src/game/objects/player.ts:2482-2485] [src:fandom/Vests] [src:fandom/Headshot] [H]
   - helmet `damageReduction × 1` on a headshot, `× 0.3` on a body hit [src:survev/server/src/game/objects/player.ts:2487-2490] [src:fandom/Helmets] [src:namu/Surviv.io/장비] [H]
6. Fork `lifeline` (Indomitable Spirit): if the hit would take HP below 0, spend 2 boost per HP to survive at 1 HP when enough boost is held (fork) [src:survev/server/src/game/objects/player.ts:2493-2511] [src:survev/shared/defs/gameObjects/perkDefs.ts:90-93] [src:wikigg/Indomitable_Spirit] [H]
7. Overkill is clamped: damage is capped at the remaining HP [src:survev/server/src/game/objects/player.ts:2493-2511] [H]
8. Stats: `damageTaken += damage`. When the source is a player of another group, it also gets `damageDealt += damage` and a quest event; `lastDamagedBy` is set for any player source except self [src:survev/server/src/game/objects/player.ts:2513-2525] [H]
9. `health −= damage`; the health setter clamps to [0, 100] [src:survev/server/src/game/objects/player.ts:2527] [src:survev/server/src/game/objects/player.ts:647-648] [H]
10. At 0 HP: a non-downed player with `self_revive` is downed directly (solo too). Otherwise `handlePlayerDeath` decides between down, kill and team wipe (see downed-revive.md) [src:survev/server/src/game/objects/player.ts:2533-2539] [src:survev/server/src/game/gameModeManager.ts:277-327] [H]

### Armour values

| item | id | reduction | body-hit helmet share (× 0.3) | sources |
|---|---|---|---|---|
| Level 1 Vest | `chest01` | 0.25 | — | [src:survev/shared/defs/gameObjects/gearDefs.ts:30] [src:fandom/Vests] [H] |
| Level 2 Vest | `chest02` | 0.38 | — | [src:survev/shared/defs/gameObjects/gearDefs.ts:50] [src:fandom/Vests] [H] |
| Level 3 Vest | `chest03` | 0.45 | — | [src:survev/shared/defs/gameObjects/gearDefs.ts:70] [src:fandom/Vests] [H] |
| Level 4 Vest (Lone Survivr only) | `chest04` | 0.60 | — | [src:survev/shared/defs/gameObjects/gearDefs.ts:91] [src:fandom/Vests] [H] |
| Level 1 Helmet | `helmet01` | 0.25 | 0.075 | [src:survev/shared/defs/gameObjects/gearDefs.ts:128] [src:fandom/Helmets] [src:namu/Surviv.io/장비] [H] |
| Level 2 Helmet | `helmet02` | 0.40 | 0.12 | [src:survev/shared/defs/gameObjects/gearDefs.ts:150] [src:fandom/Helmets] [src:namu/Surviv.io/장비] [H] |
| Level 3 Helmet (+ helmet03 skins and role helmets) | `helmet03` | 0.55 | 0.165 | [src:survev/shared/defs/gameObjects/gearDefs.ts:172] [src:fandom/Helmets] [src:namu/Surviv.io/장비] [H] |
| Level 4 Helmet (role helmets only) | `helmet04` | 0.70 | 0.21 | [src:survev/shared/defs/gameObjects/gearDefs.ts:194] [src:fandom/Helmets] [src:namu/Surviv.io/장비] [H] |

- The same values are in the original client defs and the 2026 relaunch; armour has no durability since 0.1.6 [src:derived/survev@9f64948d:src/defs/gearDefs.js:297-465] [src:kong/relaunch-client-defs] [src:changelog/0.1.6] [H]
- History: the Level 3 vest reduction was lowered (0.1.7); Level 2 and 3 vests were made less effective (0.3.5); armour now reduces fist damage reliably (0.4.3 fix) [src:changelog/0.1.7] [src:changelog/0.3.5] [src:changelog/0.4.3] [H]
- Because the vest is skipped on a headshot, a headshot can deal less than a body shot when the helmet is better than the vest (fandom) [src:fandom/Headshot] [src:derived/damage-formula] [H]
- Armour reduces melee, explosion, airstrike and airdrop damage as well as bullets; only gas and bleeding bypass it [src:survev/server/src/game/objects/player.ts:2454-2491] [H]

### Worked examples (survev formula)

| hit | result | sources |
|---|---|---|
| AK-47 bullet (13.5) body, chest02 + helmet02 | 13.5 × 0.62 × 0.88 = 7.37 | [src:derived/damage-formula] [src:survev/shared/defs/gameObjects/bulletDefs.ts:41] [M] |
| same bullet, headshot (×2), helmet02 | 27 × 0.60 = 16.2 (vest ignored) | [src:derived/damage-formula] [M] |
| fists (24) vs chest03 + helmet03 | 24 × 0.55 × 0.835 = 11.02 | [src:derived/damage-formula] [src:fandom/Player] [M] |
| any hit vs Cast Ironskin (orig 0.5) + chest03 | × 0.5 × 0.55 = × 0.275 | [src:derived/damage-formula] [M] |
| frag explosion vs Flak Jacket, no armour | × 0.1 (fandom: on top of a live frag "exactly 33 damage") | [src:derived/damage-formula] [src:fandom/Flak_Jacket] [M] |

## Headshots

- Chance 15 % per hit, independent for each pellet. Nothing changes it and the shooter gets no feedback (fandom). For 9 pellets that is a 76.8 % chance of at least one headshot [src:survev/shared/gameConfig.ts:200] [src:fandom/Headshot] [src:namu/Surviv.io/장비] [H]
- Original 0.8.82 rule: a headshot is only possible when `headshotMult > 1`. So the AWM-S (`awc`), USAS-12 (`usas`), Potato Cannon (`potato_cannon`), bugle and all melee (all `headshotMult 1` in the original defs) never headshot [src:balance/95-96] [src:derived/survev-git-c30b8d9a] [src:fandom/Headshot] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:18] [H]
- Fork change (commit `c30b8d9a`, 2025-03-09): guns with `headshotMult 1` can headshot. That deals no extra damage but makes the helmet take the full reduction and skips the vest. survev also deleted `headshotMult` from melee defs, so melee still never rolls; the relaunch melee defs keep `headshotMult 1` (fork) [src:survev/server/src/game/objects/player.ts:2462] [src:derived/survev-git-513c60d2] [src:derived/live-vs-survev] [H]
- Explosions (`isExplosion`, including shrapnel bullets) never headshot [src:survev/server/src/game/objects/player.ts:2462] [src:survev/server/src/game/objects/bullet.ts:634] [H]
- Original multipliers: 2 for most guns (47 defs: SMGs, ARs, LMGs, pistols, DMRs incl. M39/SVD/Mk 12/L86/VSS/Garand/Mk45G), 1.5 for shotguns (`m870`, `m1100`, `mp220`, `saiga`, `spas12`, `m1014`), bolt/lever-action rifles (`mosin`, `sv98`, `scout_elite`, `model94`, `blr`), the Mk 20 SSR (`scarssr`) and the Peacemaker (`colt45`, `colt45_dual`) (14 defs), 1 for `awc`, `usas`, `potato_cannon`, `bugle` [src:derived/survev@9f64948d:src/defs/gunDefs.js:1-3250] [src:fandom/Headshot] [src:namu/Surviv.io/장비] [H]
- Fork headshot changes to revert: VSS, Mk 12, L86, M39, SVD 2 → 1.5; Mk45G 2 → 1.75; Garand 2 → 1.44; Mk 20 SSR, Mosin, SV-98, M1014 1.5 → 1.25 (fork) [src:balance/44-103] [src:balance/223] [src:balance/347] [src:derived/balance-revert] [H]
- Original history: shotgun and Mosin headshot multipliers lowered with base damage raised to compensate (0.4.0) [src:changelog/0.4.0] [H]

## Damage before `Player.damage`

### Bullets

- Bullet damage = `bulletDef.damage × damageMult`, then `× 1/(reflectCount + 1)` (each ricochet halves, then thirds...), then `× lerp(1 → bulletDef.falloff)` linearly over the travelled fraction of its max distance [src:survev/server/src/game/objects/bullet.ts:267] [src:survev/server/src/game/objects/bullet.ts:572-579] [src:survev/shared/gameConfig.ts:308-313] [H]
- Gun `damageMult` perks (survev): `splinter` main ×0.6 (splits ×0.5); Last Breath bloodlust ×1.08; `bonus_assault` (Hollow-points) or `treat_super` ×1.08; ammo perks (`bonus_9mm`, `bonus_45`, `treat_9mm/762/556/12g`) ×1.12, which is a fork value (original 1.08); `chambered` ×1.25 on the first and last round of a magazine, not shotguns (0.8.8); fork `combat_stims` ×1.15; fork empowered .45 ×1.25 [src:survev/server/src/game/weaponManager.ts:692-715] [src:survev/server/src/game/weaponManager.ts:815-836] [src:survev/server/src/game/weaponManager.ts:874-882] [src:balance/336] [src:balance/334] [src:changelog/0.8.8] [src:fandom/Last_Breath] [H]
- `targeting` (High-Value Targets, 0.8.4): ×1.25 against players holding any perk [src:survev/server/src/game/objects/bullet.ts:618-623] [src:survev/shared/defs/gameObjects/perkDefs.ts:61-63] [src:changelog/0.8.4] [H]
- A bullet whose shooter is dead or downed no longer damages players. It still damages obstacles [src:survev/server/src/game/objects/bullet.ts:565-569] [src:survev/server/src/game/objects/bullet.ts:616-640] [H]
- Bullets hit any non-dead player on the same layer, or a player on stairs (layer bit 2), except the shooter unless the bullet is reflected or is shrapnel [src:survev/server/src/game/objects/bullet.ts:446-456] [src:survev/server/src/game/objects/bullet.ts:273] [H]
- Pans: a held pan (not mid-swing) or a pan worn on the back reflects bullets that hit its segment first. `steelskin` players also spawn a reflection at the body hit point while still taking the (reduced) hit [src:survev/server/src/game/objects/bullet.ts:466-555] [src:survev/server/src/game/objects/player.ts:1258-1290] [src:fandom/Cast_Ironskin] [H]

### Melee

- Melee damage = `meleeDef.damage`, unmodified by perks, against the best target in the melee circle. Enemies are preferred over obstacles and teammates (priority 0 / 1 / 2), then the deepest penetration wins; a `cleave` weapon hits all targets [src:survev/server/src/game/weaponManager.ts:1041-1192] [H]
- A player behind an obstacle closer than the player along the swing line is not hit. Downed players can be hit; dead ones cannot [src:survev/server/src/game/weaponManager.ts:1108-1156] [H]
- Fists deal 24 per punch, killing an unarmoured player in 5 hits. Punch damage against players was slightly lowered in 0.3.0; knives were set slightly above fists in 0.5.01 [src:derived/survev@9f64948d:src/defs/meleeDefs.js:16] [src:fandom/Player] [src:changelog/0.3.0] [src:changelog/0.5.01] [H]

### Explosions

- Each explosion casts rays at most 0.75 u apart around the centre; the first collidable obstacle taller than 0.5 stops a ray. Each object is damaged once [src:survev/server/src/game/objects/explosion.ts:53-138] [H]
- Damage = full `def.damage` inside `rad.min` (or when the object overlaps that circle), else `remap(dist, 0, rad.max, damage, 0)`, i.e. linear from the centre to 0 at `rad.max` [src:survev/server/src/game/objects/explosion.ts:195-200] [src:survev/shared/utils/math.ts:113-116] [H]
- Explosion hits pass `isExplosion: true` (no headshot; Flak Jacket's 0.9 applies). They keep the thrower as source, so teammates take no damage (0.7.0: "Grenades no longer damage teammates") and the thrower can hurt himself [src:survev/server/src/game/objects/explosion.ts:209-221] [src:survev/server/src/game/objects/explosion.ts:250-255] [src:changelog/0.7.0] [H]
- Shrapnel bullets from explosions are flagged `isExplosion` through `bulletDef.shrapnel` [src:survev/server/src/game/objects/bullet.ts:269] [src:survev/server/src/game/objects/bullet.ts:634] [H]
- Freeze, `dropRandomLoot` and the potato fat/view effects apply only to non-teammates; fork `healTeam` explosions (coconut) heal teammates [src:survev/server/src/game/objects/explosion.ts:209-243] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:242-256] [H]

### Environment

- Gas: the stage's `damage` every `damageTickRate` 2 s while outside the safe zone, × (1 + 0.025 × seconds continuously inside) from the 4th circle on; disconnected players take a flat 22. No armour (details in mechanics/gas.md) [src:survev/server/src/game/objects/player.ts:1648-1669] [src:survev/shared/gameConfig.ts:178-180] [src:survev/server/src/game/objects/gas.ts:248-253] [H]
- Bleeding: 2 per second while downed (see downed-revive.md) [src:survev/server/src/game/objects/player.ts:1600-1630] [src:survev/shared/defs/maps/baseDefs.ts:87-88] [H]
- Airdrop crush: survev deals 1e10 to every player and obstacle under the crate on landing. The original config has `airdrop.crushDamage: 100` [src:survev/server/src/game/objects/airdrop.ts:86-91] [src:survev/shared/gameConfig.ts:285] [src:derived/survev@9f64948d:src/gameConfig.ts:145] [H]

## Damage-related perks (summary)

| perk (id) | effect on damage taken | era | sources |
|---|---|---|---|
| Cast Ironskin (`steelskin`) | −50 % all sources except gas/bleed, reflects bullets, +40 % size | original 0.8.3 (buffed 30 → 50 % in 0.8.8); fork 45 % | [src:survev/shared/defs/gameObjects/perkDefs.ts:13-16] [src:fandom/Cast_Ironskin] [src:wikigg/Cast_Ironskin] [src:changelog/0.8.3] [H] |
| Flak Jacket (`flak_jacket`) | −90 % explosions and shrapnel, −10 % other hits; +20 % size (fork: +10 %); fork +3 frag / +2 MIRV capacity | original 0.8.72 | [src:survev/shared/defs/gameObjects/perkDefs.ts:17-25] [src:fandom/Flak_Jacket] [src:wikigg/Flak_Jacket] [src:balance/135-136] [src:changelog/0.8.72] [H] |
| Indomitable Spirit (`lifeline`) | fatal damage paid with boost at 2 boost/HP | fork | [src:survev/shared/defs/gameObjects/perkDefs.ts:90-93] [src:wikigg/Indomitable_Spirit] [H] |
| AP Rounds (`ap_rounds`) | attacker perk: every reduction × 0.8 | fork | [src:survev/shared/defs/gameObjects/perkDefs.ts:41-44] [src:derived/fork-vs-original-json] [H] |
| Revivify (`self_revive`) | downed instead of killed, even in solo | original 0.8.65 | [src:survev/server/src/game/objects/player.ts:2533-2536] [src:fandom/Revivify] [src:changelog/0.8.65] [H] |

## Kill credit

- `kill()` credits `params.killCreditSource ?? params.source`. A player credit counts a kill (and runs on-kill perks such as Takedown) only if it is not the victim and not on the victim's team [src:survev/server/src/game/objects/player.ts:2693-2701] [src:survev/server/src/game/objects/player.ts:2721-2725] [H]
- Killing a disconnected teammate shows a kill message but does not raise the kill count (fandom) [src:survev/server/src/game/objects/player.ts:2699] [src:fandom/Player] [H]
- Finishing a downed player: credit goes back to the player who downed them (`downedBy`) when the finisher is on the downer's team, when the finishing blow is not player damage (bleeding, gas, airstrike, crush), or when the victim's own teammate finishes them while an enemy did the down [src:survev/server/src/game/gameModeManager.ts:286-302] [src:survev/tests/src/kill.test.ts:115-246] [H]
- The kill message carries `killerId` (the finisher, left empty for bleeding) and `killCreditId` (the credited player). The client prints "finally killed" / "finally bled out" when the two differ, and "You finally killed X" for credited bleed-outs [src:survev/server/src/game/objects/player.ts:2798-2804] [src:survev/client/src/game.ts:1317-1371] [src:survev/client/src/en.json:309-316] [H]
- The kill leader needs at least 3 kills (`killLeaderMinKills`) [src:survev/shared/gameConfig.ts:226] [H]

## Conflicts

- CONFLICT headshot-mult-1-rule: survev rolls headshots for any gun with `headshotMult` [src:survev/server/src/game/objects/player.ts:2462] vs original/early-survev rule of `headshotMult > 1` only, with fandom listing AWM-S, Potato Cannon and melee as never headshotting [src:balance/95-96] [src:fandom/Headshot]; proposed: original rule `headshotMult > 1` [H]
- CONFLICT steelskin-reduction: 0.45 [src:survev/shared/defs/gameObjects/perkDefs.ts:15] vs 0.5 in 0.8.8 [src:fandom/Cast_Ironskin] [src:wikigg/Cast_Ironskin] [src:balance/138-141]; proposed: 0.5 for 0.8.82 [H]
- CONFLICT flak-size: scale +0.1 [src:survev/shared/defs/gameObjects/perkDefs.ts:18] vs +20 % in 0.8.8 [src:wikigg/Flak_Jacket] [src:balance/135-136] vs +10 % [src:fandom/Player]; proposed: +0.2 for 0.8.82 (fork changed it in 0.1.2) [M]
- CONFLICT ammo-perk-mult: ammo perks ×1.12 [src:survev/shared/defs/gameObjects/perkDefs.ts:165] vs 8 % [src:fandom/Last_Breath] [src:balance/336]; proposed: 1.08 [H]
- CONFLICT airdrop-crush-damage: 1e10 [src:survev/server/src/game/objects/airdrop.ts:89] vs original config `crushDamage: 100` and wiki notes that damage perks let players survive a landing crate [src:derived/survev@9f64948d:src/gameConfig.ts:145] [src:fandom/Cast_Ironskin] [src:fandom/Flak_Jacket]; proposed: deal `crushDamage` 100 through the normal pipeline (so it is lethal to almost everyone) and log the perk exemption question [L]
- CONFLICT steelskin-zone-bug: survev never reduces gas with perks [src:survev/server/src/game/objects/player.ts:2454-2458] vs 0.8.8 shipped with Cast Ironskin and Flak Jacket reducing red zone and airdrop damage, fixed on 2019-12-04 [src:wikigg/Cast_Ironskin] [src:wikigg/Flak_Jacket] [src:fandom/Cast_Ironskin]; proposed: no reduction (the fix predates 0.8.82) [M]

## Open questions

- Was the 15 % headshot roll per pellet, per shot or per bullet in the original? survev rolls per bullet hit [src:survev/server/src/game/objects/player.ts:2463] [src:fandom/Headshot] [L]
- Does `downedDamageBuffer` (0.1 s of invulnerability after a down) exist in the original? It was added to survev in 2025 with no cited source [src:derived/survev-git-ad3d7ca7] [src:derived/survev-git-decfabdd] [L]
- Order of perk and armour reductions in the original: multiplicative order does not change the result, but `armorPenetration` and the original Lone Survivr airdrop note ("lose half (50) health") depend on how crush damage interacts with perks [src:fandom/Lone_Survivr] [L]
