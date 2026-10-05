# Downed (knocked out) state and reviving

> When a player in a team mode reaches 0 HP they are "knocked out" (downed) instead of dead, bleed out over time and can be revived by a teammate. Traced through survev `gameModeManager.handlePlayerDeath`, `Player.down`, `Player.update` (bleed and revive), `getPlayerToRevive`, `revive`, `group.ts`, and the client UI. Cross-checked against fandom (Knocked Out, Revivify, Mass Medicate, Medic, 50v50 Map), wiki.gg and namu.
> Client-visible constants (`reviveHealth`, `reviveDuration`, `reviveRange`, `bleedTickRate`, `crawlTime`, `medicHealRange`, `medicReviveRange`) are in the original client config (survev first commit `9f64948d`, cited `derived/survev@9f64948d:<path>:<lines>`) and the 2026 relaunch bundle (`kong/relaunch-client-bundle`). The per-map `bleedDamage`/`bleedDamageMult` come from the original map defs. The client's bleed-particle logic is original decompiled code and also appears in the relaunch bundle.

## Constants

| constant | value | original client? | sources |
|---|---|---|---|
| `reviveHealth` | 24 HP after a revive | yes | [src:survev/shared/gameConfig.ts:191] [src:derived/survev@9f64948d:src/gameConfig.ts:122] [src:kong/relaunch-client-bundle] [src:fandom/Knocked_Out] [src:fandom/Player] [H] |
| `reviveDuration` | 8 s | yes | [src:survev/shared/gameConfig.ts:211] [src:derived/survev@9f64948d:src/gameConfig.ts:127] [src:kong/relaunch-client-bundle] [src:fandom/Knocked_Out] [src:fandom/Revivify] [H] |
| `reviveRange` | 5 u | yes | [src:survev/shared/gameConfig.ts:212] [src:derived/survev@9f64948d:src/gameConfig.ts:128] [src:kong/relaunch-client-bundle] [src:fandom/Knocked_Out] [H] |
| `bleedTickRate` | 1 s | yes | [src:survev/shared/gameConfig.ts:206] [src:derived/survev@9f64948d:src/gameConfig.ts:126] [src:kong/relaunch-client-bundle] [H] |
| `bleedDamage` (per tick, all maps) | 2 | yes (map def) | [src:survev/shared/defs/maps/baseDefs.ts:87] [src:derived/survev@9f64948d:src/defs/modes/main.ts:59] [H] |
| `bleedDamageMult` | 1 on every map except Faction (50v50) 1.25 | yes (map def) | [src:survev/shared/defs/maps/baseDefs.ts:88] [src:survev/shared/defs/maps/factionDefs.ts:245-246] [src:derived/survev@9f64948d:src/defs/modes/main.ts:60] [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts:136-137] [H] |
| `crawlTime` | 0.75 s | yes | [src:survev/shared/gameConfig.ts:213] [src:derived/survev@9f64948d:src/gameConfig.ts:129] [H] |
| `medicReviveRange` (Mass Medicate revive AoE) | 6 u | yes | [src:survev/shared/gameConfig.ts:224] [src:derived/survev@9f64948d:src/gameConfig.ts:139] [src:fandom/Medic] [H] |
| `medicHealRange` (Mass Medicate heal AoE) | 8 u | yes | [src:survev/shared/gameConfig.ts:223] [src:derived/survev@9f64948d:src/gameConfig.ts:138] [H] |
| `downedMoveSpeed` / `downedRezMoveSpeed` | 4 / 2 u/s | no (server-only) | [src:survev/shared/gameConfig.ts:207-208] [src:fandom/Player] [H] |
| `downedDamageBuffer` | 0.1 s of invulnerability right after going down | no; survev addition in 2025 | [src:survev/shared/gameConfig.ts:209] [src:derived/survev-git-ad3d7ca7] [src:derived/survev-git-decfabdd] [L] |
| `keepZoomWhileDowned` | false | no | [src:survev/shared/gameConfig.ts:210] [M] |
| `ActionMaxDuration` (net clamp, ≥ revive time) | 8.5 s | yes | [src:survev/shared/net/net.ts:16] [src:derived/survev@9f64948d:src/net/net.ts:139] [H] |

## When a player goes down (`handlePlayerDeath`)

- Solo (any map except Faction): 0 HP kills outright. The only exception is Revivify (`self_revive`), which downs the player even in solo [src:survev/server/src/game/gameModeManager.ts:277-279] [src:survev/server/src/game/objects/player.ts:2533-2536] [src:fandom/Revivify] [src:fandom/Knocked_Out] [H]
- Duo/Squad use the player's group; Faction (50v50) uses the whole red/blue team as the group [src:survev/server/src/game/gameModeManager.ts:281] [src:survev/server/src/game/gameModeManager.ts:10-17] [H]
- A non-downed player reaching 0 HP is downed, unless the group has nobody else able to revive. That is when every other member is dead or disconnected, or every other living member is downed or disconnected, and no living, connected member has Revivify [src:survev/server/src/game/gameModeManager.ts:313-325] [src:survev/server/src/game/group.ts:49-94] [src:fandom/Knocked_Out] [H]
- In that case the player is killed and every downed member is killed too (team wipe: `killAllDowned`, damage type Bleeding, each credited to whoever downed them). The group is marked `allDeadOrDisconnected` first so game-over messages are correct [src:survev/server/src/game/gameModeManager.ts:317-322] [src:survev/server/src/game/group.ts:56-66] [src:survev/tests/src/reviving.test.ts:84-116] [H]
- If one downed teammate has Revivify the group is not wiped; when that last hope is killed while downed, the rest are wiped [src:survev/server/src/game/gameModeManager.ts:304-310] [src:survev/tests/src/reviving.test.ts:237-286] [H]
- Disconnected teammates never count as standing [src:survev/server/src/game/group.ts:49-54] [src:survev/server/src/game/group.ts:71-80] [H]
- A disconnected player cannot despawn once downed: `canDespawn` needs alive under 10 s (`minActiveTime`) and not downed [src:survev/server/src/game/objects/player.ts:3116-3124] [src:survev/shared/gameConfig.ts:192] [H]

## The down itself (`Player.down`)

- `downed = true`, `downedCount++`, damage buffer 0.1 s starts, boost set to 0, health reset to 100 [src:survev/server/src/game/objects/player.ts:2581-2586] [src:fandom/Knocked_Out] [H]
- Down health is 50 instead of 100 once the gas radius is ≤ 0.1 (the zone has fully closed). survev added this in 2025-04 to stop infinite Revivify loops [src:survev/server/src/game/objects/player.ts:2590-2592] [src:derived/survev-git-042e29c7] [src:fandom/Revivify] [M]
- Knockback: velocity set to the hit direction × 10, decaying by 1/(1 + 4·dt) per tick [src:survev/server/src/game/objects/player.ts:2588] [src:survev/server/src/game/objects/player.ts:1943-1946] [M]
- A cooking grenade is dropped at the player's feet (thrown with no velocity), any action is cancelled, firing input is cleared, and the active weapon is forced to the melee slot; a pan in the melee slot is worn on the back [src:survev/server/src/game/objects/player.ts:2594-2610] [H]
- A KillMsg with `downed: true` is broadcast. The source player (if any) becomes `downedBy` and is sent as both `killerId` and `killCreditId`. The feed reads "<killer> knocked out <target> with <weapon>"; gas reads "The red zone knocked out ...", airdrops "The air drop knocked out ..." [src:survev/server/src/game/objects/player.ts:2615-2628] [src:survev/client/src/ui/ui2.ts:1420-1467] [src:survev/client/src/en.json:309] [src:l10n/ko:game-knocked-out] [H]
- In Faction mode, a knock re-checks Lone Survivr and Captain promotion [src:survev/server/src/game/objects/player.ts:2630-2634] [src:changelog/0.8.71] [H]
- Kill-feed and team UI keys: "is down" (`game-is-down`), "knocked out", "finally killed", "finally bled out" [src:survev/client/src/en.json:309-312] [src:survev/client/src/en.json:734] [src:l10n/ko:game-is-down] [src:l10n/ko:game-finally-bled-out] [H]

## While downed

- Speed 4 u/s (survev adds the forced melee's +1, see movement.md); crawl animation every 3 u of travel [src:survev/server/src/game/objects/player.ts:4702-4703] [src:survev/server/src/game/objects/player.ts:2322-2335] [src:fandom/Knocked_Out] [H]
- View forced to the 1× scope zoom; the previous scope returns after the revive (0.2.3) [src:survev/server/src/game/objects/player.ts:2259-2261] [src:changelog/0.2.3] [src:fandom/Knocked_Out] [H]
- No weapons: the weapon manager does not run for downed players, and every input except Interact, Use (doors and buttons, since 0.7.1), Cancel and (with Revivify) Revive is ignored [src:survev/server/src/game/weaponManager.ts:296-300] [src:survev/server/src/game/objects/player.ts:3345-3355] [src:changelog/0.7.1] [src:fandom/Knocked_Out] [H]
- No items: medical items are refused, loot cannot be picked up, but items can still be dropped [src:survev/server/src/game/objects/player.ts:3545-3546] [src:survev/server/src/game/objects/player.ts:3457-3479] [src:survev/server/src/game/objects/player.ts:4202-4248] [src:fandom/Knocked_Out] [H]
- Boost stays 0; heal regions do not work [src:survev/server/src/game/objects/player.ts:1544-1546] [src:survev/server/src/game/objects/player.ts:2144-2148] [src:fandom/Health] [H]
- Client visuals: weapons and backpack hidden, feet sprites shown ("the only time you can see a survivr's legs"), drawn below standing players, health bar solid red [src:survev/client/src/objects/player.ts:1742-1754] [src:survev/client/src/objects/player.ts:1545-1552] [src:survev/client/src/objects/player.ts:1451-1452] [src:survev/client/src/ui/ui2.ts:1139-1141] [src:fandom/Knocked_Out] [H]
- Bullets fired by a downed (or dead) player no longer damage players [src:survev/server/src/game/objects/bullet.ts:565-569] [H]
- Enemies can keep shooting or meleeing a downed player; teammates still cannot hurt them unless the downed player is disconnected [src:survev/server/src/game/objects/player.ts:2422-2443] [src:survev/server/src/game/weaponManager.ts:1108-1113] [src:fandom/Player] [H]

## Bleeding

- Every `bleedTickRate` (1 s), while downed and not in an action (i.e. not being revived), the player takes Bleeding damage. Armour does not apply [src:survev/server/src/game/objects/player.ts:1600-1630] [src:survev/server/src/game/objects/player.ts:2454-2458] [src:fandom/Knocked_Out] [H]
- The original client plays the blood-splat effect under exactly the same condition (downed and action None), so bleeding pauses during a revive in the original too [src:survev/client/src/objects/player.ts:992-1026] [src:kong/relaunch-client-bundle] [src:fandom/Knocked_Out] [H]
- Damage per tick = `bleedDamage × (bleedDamageMult ≠ 1 ? downedCount × bleedDamageMult : 1)` [src:survev/server/src/game/objects/player.ts:1614-1620] [src:derived/survev-git-d62349ac] [M]

| map | 1st down | 2nd down | 3rd down | time to bleed out from 100 HP (1st / 2nd / 3rd) | sources |
|---|---|---|---|---|---|
| all except Faction (`bleedDamageMult` 1) | 2 / s | 2 / s | 2 / s | 50 s each | [src:derived/bleed-formula] [src:survev/shared/defs/maps/baseDefs.ts:87-88] [M] |
| Faction / 50v50 (`bleedDamageMult` 1.25) | 2.5 / s | 5 / s | 7.5 / s | 40 s / 20 s / 13.3 s | [src:derived/bleed-formula] [src:survev/shared/defs/maps/factionDefs.ts:245-246] [src:fandom/50v50_Map] [M] |

- The first effective tick lands about 1 s after the down (the tick at the down is absorbed by the damage buffer) [src:survev/server/src/game/objects/player.ts:1574-1580] [src:survev/server/src/game/objects/player.ts:1601-1608] [M]
- Gas keeps damaging downed players on top of bleeding (fandom: in late stages the red zone hits harder than bleeding) [src:survev/server/src/game/objects/player.ts:1648-1669] [src:fandom/Knocked_Out] [H]
- That Sucks (`trick_drain`, Halloween 0.8.7): 1 Bleeding damage every 3 s (`bleedTickRate × 3`) even while standing; the original client shows the same 3 s cadence [src:survev/server/src/game/objects/player.ts:1603-1620] [src:survev/shared/defs/gameObjects/perkDefs.ts:149-151] [src:survev/client/src/objects/player.ts:999-1002] [src:fandom/That_Sucks] [H]
- namu: a downed squad player slowly loses health and dies unless a teammate revives them [src:namu/Surviv.io] [M]

## Reviving a teammate

- Who can be revived (`getPlayerToRevive`): the reviver must be in a team mode, standing, with no action running. The target must be a downed teammate on the same layer within `reviveRange` 5 u who is not already in a Revive action. The closest one is picked [src:survev/server/src/game/objects/player.ts:3153-3188] [H]
- The original client shows the "Revive Teammate" button under the same conditions: own action None, not downed (or has Revivify), teammate downed, not dead, not already being revived, distance < 5, same layer [src:survev/client/src/ui/ui2.ts:780-813] [src:survev/client/src/en.json:295] [H]
- Revive is bound to Interact (F) and to a separate Revive bind (unbound by default, 0.5.1) [src:survev/server/src/game/objects/player.ts:3452-3486] [src:survev/client/src/inputBinds.ts:34-35] [src:changelog/0.5.1] [H]
- Start: both players get a Revive action of 8 s (the reviver's carries the target id) and the reviver plays the Revive animation for 8 s; a cooking grenade is thrown [src:survev/server/src/game/objects/player.ts:3190-3220] [src:survev/client/src/animData.ts:573] [H]
- Revives work through thin walls and doors, since there is no line-of-sight check (fandom) [src:survev/server/src/game/objects/player.ts:3161-3185] [src:fandom/Knocked_Out] [H]
- During the revive both players can move: the reviver at a survev-estimated 6 u/s + weapon equip, the target at 2 u/s (fandom: × 0.5 for both) [src:survev/server/src/game/objects/player.ts:4693-4701] [src:fandom/Knocked_Out] [L]
- Cancels when the two are more than 5 u apart, when the target dies, or on any `cancelAction` from either side (reviver shoots, swings, switches weapon, drops an item, presses Cancel, goes down). Cancelling one side cancels the other [src:survev/server/src/game/objects/player.ts:1562-1572] [src:survev/server/src/game/objects/player.ts:4480-4518] [src:fandom/Knocked_Out] [H]
- Completion: the target gets `downed = false`, `downedBy` cleared, the damage buffer cleared, health = 24, and stops wearing the pan if it is held [src:survev/server/src/game/objects/player.ts:1716-1735] [src:fandom/Knocked_Out] [H]
- After a revive the player keeps all gear and inventory but has 0 boost [src:fandom/Knocked_Out] [src:survev/server/src/game/objects/player.ts:2585] [H]
- Revive particles: since 0.7.6 the downed player gives off purple heal particles while being revived [src:fandom/Knocked_Out] [src:fandom/Player] [M]
- 0.2.2 fixed reduced health after reviving another player; 0.2.1 fixed a stuck reviving pose [src:changelog/0.2.2] [src:fandom/Player] [M]
- namu advises throwing a smoke grenade before reviving in duo, squad and 50v50 [src:namu/Surviv.io/팁] [M]

## Revivify (`self_revive`) and the Medic

- Revivify (original 0.8.65, Savannah first; Faction Medic from 0.8.71): a downed holder may start a Revive action on themselves (Interact or Revive input). It lasts 8 s, the holder moves at 2 u/s and the bleed pauses. A "Revive Self" button appears [src:survev/server/src/game/objects/player.ts:3156] [src:survev/server/src/game/objects/player.ts:3195-3201] [src:survev/client/src/ui/ui2.ts:1651-1659] [src:changelog/0.8.65] [src:changelog/0.8.71] [src:wikigg/Revivify] [H]
- Teammates can still revive a Revivify holder normally; the holder can cancel the teammate's revive [src:survev/server/src/game/objects/player.ts:3345-3354] [src:fandom/Revivify] [src:wikigg/Revivify] [H]
- Mass Medicate (`aoe_heal`, Medic role since 0.7.6): when the medic finishes a revive, every downed teammate within `medicReviveRange` 6 u is revived. This also happens when the medic self-revives or when someone revives the medic. The aura is purple and smaller than the 8 u heal aura [src:survev/server/src/game/objects/player.ts:3279-3300] [src:survev/server/src/game/objects/player.ts:3137-3150] [src:survev/client/src/objects/player.ts:1755-1785] [src:fandom/Mass_Medicate] [src:fandom/Medic] [src:wikigg/Mass_Medicate] [H]
- Mass Medicate does not speed up revives (8 s) [src:survev/server/src/game/objects/player.ts:3196-3212] [src:fandom/Mass_Medicate] [src:wikigg/Mass_Medicate] [H]
- Faction Medic role perks: `aoe_heal`, `self_revive` [src:survev/shared/defs/gameObjects/roleDefs.ts:235] [src:derived/survev@9f64948d:src/defs/roleDefs.js:32] [H]
- Players inside a medic's revive aura but not the medic's direct target have no Revive action of their own, so survev keeps bleeding them until the revive completes [src:survev/server/src/game/objects/player.ts:1603] [src:survev/server/src/game/objects/player.ts:3137-3150] [L]

## Kill credit for downed players

- Finishing a downed player credits the player who downed them when: the finisher is on the downer's team; the finishing damage is not `Player` (bleed-out, gas, airstrike, crush); or the victim's own teammate finishes a player downed by an enemy [src:survev/server/src/game/gameModeManager.ts:286-302] [src:survev/tests/src/kill.test.ts:25-246] [H]
- Otherwise the finisher gets the kill. For example, if a teammate downed a disconnected player and an enemy finishes them, the enemy gets it [src:survev/tests/src/kill.test.ts:181-214] [H]
- The bleed-out KillMsg leaves `killerId` empty but carries `killCreditId`. The feed shows "<downer> finally killed <target>" or "<target> finally bled out"; the credited player sees "You finally killed X" [src:survev/server/src/game/objects/player.ts:2798-2804] [src:survev/client/src/ui/ui2.ts:1430-1438] [src:survev/client/src/ui/ui2.ts:1563-1569] [H]
- Takedown triggers only on a credited kill: knocking out does not trigger it, and finishing someone a teammate downed gives the kill (and the perk) to the teammate [src:survev/server/src/game/objects/player.ts:2721-2725] [src:wikigg/Takedown] [src:fandom/Takedown] [H]
- Kills of downed players by the team wipe go to each victim's `downedBy` [src:survev/server/src/game/group.ts:56-66] [H]

## Conflicts

- CONFLICT bleed-escalation-scope: escalation only on maps with `bleedDamageMult ≠ 1` (Faction) [src:survev/server/src/game/objects/player.ts:1616-1618] [src:fandom/50v50_Map] vs "The rate at which a person bleeds out will increase with the number of times they are knocked out" in general [src:fandom/Knocked_Out]; proposed: Faction-only (the map defs only carry a multiplier for Faction, and the 50v50 page says it is a 50v50 rule) [M]
- CONFLICT bleed-escalation-shape: survev uses `downedCount × 1.25` (2.5, 5, 7.5 per tick) [src:survev/server/src/game/objects/player.ts:1618] vs survev's first implementation compounding ×1.25 per down (2.5, 3.125, 3.9) [src:derived/survev-git-e16781bd]; proposed: keep the linear survev form as a knob, since neither is sourced [L]
- CONFLICT down-health-50: down at 50 HP once the gas radius is ≤ 0.1 [src:survev/server/src/game/objects/player.ts:2590-2592] vs fandom: after multiple self-revives "some other feature kicks in" and gas-downs give less health [src:fandom/Revivify]; proposed: keep survev's rule, log the original trigger as open [L]
- CONFLICT revive-drop-cancel: dropping an item cancels the action, revives included [src:survev/server/src/game/objects/player.ts:4242-4243] vs "A reviver can drop items without interrupting reviving" [src:fandom/Knocked_Out]; proposed: exempt Revive actions from the drop cancel [M]
- CONFLICT revivify-version: Revivify added in 0.8.65 [src:changelog/0.8.65] [src:wikigg/Revivify] vs v0.8.5 "Proxy party" [src:fandom/Revivify]; proposed: 0.8.65 (changelog) [H]

## Open questions

- Original reviver movement speed (survev's 6 is a self-declared estimate) [src:survev/server/src/game/objects/player.ts:4697] [L]
- Does the original have the 0.1 s post-down invulnerability, and does it pause bleeding for players in a medic's revive aura? [src:survev/shared/gameConfig.ts:209] [src:survev/server/src/game/objects/player.ts:1603] [L]
- Did the original give knock credit or assists for downs that end in a team wipe in 50v50, where the "group" is the whole faction? [src:survev/server/src/game/gameModeManager.ts:281] [L]
