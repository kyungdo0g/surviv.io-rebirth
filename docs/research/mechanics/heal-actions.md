# Healing items and the action system

> Bandage (`bandage`), Med Kit (`healthkit`), Soda (`soda`) and Pills (`painkiller`), and the timed-action system they share with reloads and revives. Traced through survev `server/src/game/objects/player.ts` (`useHealingItem`, `useBoostItem`, `doAction`, `cancelAction`, the action block of `update`) and `weaponManager.ts`.
> Item numbers are client-visible defs: they match the original client (survev first commit `9f64948d`, cited `derived/survev@9f64948d:<path>:<lines>`) and the 2026 relaunch. The boost effects are in boost.md, movement penalties in movement.md, revives in downed-revive.md.

## Items

| item (id) | en / ko | effect | use time | `maxHeal` | capacity Pouch / Small / Regular / Military | sources |
|---|---|---|---|---|---|---|
| Bandage (`bandage`) | Bandage / 붕대 | +15 HP | 3 s | 100 | 5 / 10 / 15 / 30 | [src:survev/shared/defs/gameObjects/gearDefs.ts:388-393] [src:derived/survev@9f64948d:src/defs/gearDefs.js:139-144] [src:derived/survev@9f64948d:src/gameConfig.ts:275] [src:fandom/Bandage] [src:l10n/ko:game-bandage] [H] |
| Med Kit (`healthkit`) | Med Kit / 구급상자 | +100 HP | 6 s | 100 | 1 / 2 / 3 / 4 | [src:survev/shared/defs/gameObjects/gearDefs.ts:411-416] [src:derived/survev@9f64948d:src/defs/gearDefs.js:162-167] [src:derived/survev@9f64948d:src/gameConfig.ts:276] [src:fandom/Med_Kit] [src:l10n/ko:game-healthkit] [H] |
| Soda (`soda`) | Soda / 소다 | +25 boost | 3 s | — | 2 / 5 / 10 / 15 | [src:survev/shared/defs/gameObjects/gearDefs.ts:325-329] [src:derived/survev@9f64948d:src/defs/gearDefs.js:185-189] [src:derived/survev@9f64948d:src/gameConfig.ts:277] [src:fandom/Soda] [src:l10n/ko:game-soda] [H] |
| Pills (`painkiller`) | Pills / 알약 | +50 boost | 5 s | — | 1 / 2 / 3 / 4 | [src:survev/shared/defs/gameObjects/gearDefs.ts:347-351] [src:derived/survev@9f64948d:src/defs/gearDefs.js:207-211] [src:derived/survev@9f64948d:src/gameConfig.ts:278] [src:fandom/Pills] [src:l10n/ko:game-painkiller] [H] |

- namu lists the same use times: bandage 3 s, med kit 6 s, soda 3 s, pills 5 s [src:namu/Surviv.io/의료품] [M]
- survev adds a 5th capacity column for the fork Tactical Pack: bandage 45, healthkit 5, soda 20, painkiller 5 (fork) [src:survev/shared/gameConfig.ts:432-435] [src:wikigg/Bandage] [H]
- Heal items use the red `heal` particle emitter and aura (0xff0000); boost items use the green `boost` emitter and aura (0x199500). Use particles were added in 0.7.1 [src:survev/shared/defs/gameObjects/gearDefs.ts:405-409] [src:survev/shared/defs/gameObjects/gearDefs.ts:341-346] [src:changelog/0.7.1] [src:fandom/Consumables] [H]
- Sounds: `bandage_use_01`, `healthkit_use_01`, `soda_use_01`, `pills_use_01` (pickup `*_pickup_01`) [src:survev/shared/defs/gameObjects/gearDefs.ts:325-430] [src:fandom/Bandage] [src:fandom/Pills] [H]
- Heal particle skins (loadout `heal_effect` items): `heal_basic` (Basic Healing, stock), `heal_heart` (Healing Hearts), `heal_moon` (Blood Moon) and `heal_tomoe` (Tomoe), the last three added in 0.8.6. The fork adds `heal_diamond` (Crazy Diamond), `heal_ankh` (Ankh Charm) and `heal_menacing` (Phantom Blood) (fork) [src:survev/shared/defs/gameObjects/healEffectDefs.ts:11-62] [src:derived/survev@9f64948d:src/defs/healEffectDefs.js:2-29] [src:changelog/0.8.6] [src:kong/relaunch-client-bundle] [H]
- Boost particle skins (`boost_effect`): `boost_basic` (stock), `boost_star` (Starboost), `boost_naturalize` (Naturalize) and `boost_shuriken` (Shuriken), the last three added in 0.8.6. The fork adds `boost_club`, `boost_hermes`, `boost_lightning` and `boost_gearshift` (fork) [src:survev/shared/defs/gameObjects/healEffectDefs.ts:63-122] [src:derived/survev@9f64948d:src/defs/healEffectDefs.js:30-56] [src:changelog/0.8.6] [H]

### History (original changelog and wikis)

- Health pak (Med Kit) restores to 100 and its use time goes up 1 s; painkiller use time goes down 1 s (0.1.51) [src:changelog/0.1.51] [src:fandom/Med_Kit] [H]
- Bandage use time slightly decreased in 0.3.5 and again in 0.4.3 (to 2.6 s per the wikis) [src:changelog/0.3.5] [src:changelog/0.4.3] [src:fandom/Bandage] [src:wikigg/Bandage] [H]
- 0.7.1 "Danger Close": bandages heal to 100 (previously capped at 75); bandage use time 2.6 → 3.0 s; medical-item particles added [src:changelog/0.7.1] [src:fandom/Bandage] [src:wikigg/Bandage] [H]
- Medical hotkeys 7–0 added (0.2.3); the UI was adjusted for better access to medical items (0.6.2) [src:changelog/0.2.3] [src:changelog/0.6.2] [H]
- Fixed using healing items while getting hit by snowballs (0.6.91) [src:changelog/0.6.91] [H]
- Leftover string: the tooltip `game-healing-tooltip` "Cannot heal past 75 health." still exists in en, ko and the relaunch bundle, although the cap is 100 [src:survev/client/src/en.json:375] [src:l10n/ko:game-healing-tooltip] [src:kong/relaunch-client-bundle] [H]
- Fandom lists post-0.8.82 consumables not in survev: Flask, Chocolate Box, Growler, Gunchilada, Pulse Box, Popsicle, Nitro Lace (post-0.8.82) [src:fandom/Consumables] [M]

## Starting a use (`useHealingItem` / `useBoostItem`)

- Triggers: clicking the item in the HUD or the hotkeys 7 Bandage, 8 Med Kit, 9 Soda, 0 Pills. The client sends `inputMsg.useItem = <id>`; the server validates it against the inventory [src:survev/client/src/inputBinds.ts:48-51] [src:survev/client/src/game.ts:628-656] [src:survev/client/src/en.json:149-150] [src:survev/server/src/game/objects/player.ts:3545-3558] [H]
- Downed players cannot use items ("no exceptions for any perks or roles") [src:survev/server/src/game/objects/player.ts:3545-3546] [src:fandom/Knocked_Out] [src:fandom/Health] [H]
- A heal is refused when health equals `maxHeal` (100). The check is exact equality, so 99.9 HP still allows a bandage. Mass Medicate (`aoe_heal`) skips this check [src:survev/server/src/game/objects/player.ts:3250-3261] [src:fandom/Mass_Medicate] [src:wikigg/Combat_Stimulants] [H]
- Both heals and boosts are refused while another UseItem or a Revive is in progress, or while a throwable is being cooked, or with none in the inventory [src:survev/server/src/game/objects/player.ts:3253-3264] [src:survev/server/src/game/objects/player.ts:3305-3314] [H]
- Boost items have no fullness check; a Soda at 100 boost is wasted [src:survev/server/src/game/objects/player.ts:3302-3314] [H]
- Starting a use first cancels the current action (e.g. a reload), then starts `UseItem` with duration `useTime`, or `0.75 × useTime` with Mass Medicate [src:survev/server/src/game/objects/player.ts:3271-3276] [src:survev/server/src/game/objects/player.ts:3322-3327] [src:fandom/Player] [H]
- A Mass Medicate medic always shows an emote of the item being used [src:survev/server/src/game/objects/player.ts:3266-3269] [src:fandom/Mass_Medicate] [H]

## Action system

| `Action` | value | started by | duration | sources |
|---|---|---|---|---|
| None | 0 | — | — | [src:survev/shared/gameConfig.ts:3-10] [src:derived/survev@9f64948d:src/gameConfig.ts:66-72] [H] |
| Reload | 1 | `tryReload` | gun `reloadTime` | [src:survev/server/src/game/weaponManager.ts:527-543] [H] |
| ReloadAlt | 2 | `tryReload` (empty mag, enough ammo, gun has `reloadTimeAlt`) | `reloadTimeAlt` | [src:survev/server/src/game/weaponManager.ts:534-541] [H] |
| UseItem | 3 | heal/boost use | `useTime` (× 0.75 medic) | [src:survev/server/src/game/objects/player.ts:3272-3276] [H] |
| Revive | 4 | revive (both players get it) | `reviveDuration` 8 s | [src:survev/server/src/game/objects/player.ts:3190-3220] [H] |

- `doAction(item, type, duration, targetId)` stores the item, type, duration and target, resets `time` to 0 and bumps `actionSeq`. It is skipped while `actionDirty` is set, but that flag is cleared after every network update and by `cancelAction`, so it only blocks a second action started in the same tick. It does not protect a running action; the callers check `actionType` themselves [src:survev/server/src/game/objects/player.ts:4458-4478] [src:survev/server/src/game/objects/player.ts:424-430] [src:survev/server/src/game/objects/player.ts:4516] [H]
- Each tick `action.time += dt`, clamped to `ActionMaxDuration` 8.5 s (an original protocol constant). When `time ≥ duration` the effect applies and the action ends [src:survev/server/src/game/objects/player.ts:1676-1751] [src:survev/shared/net/net.ts:16] [src:derived/survev@9f64948d:src/net/net.ts:139] [H]
- UseItem completion: heal items `health += heal` (clamped to 100, so the excess is wasted), boost items `boost += boost`, then one item is taken from the inventory. A cancelled use costs nothing [src:survev/server/src/game/objects/player.ts:1687-1713] [src:survev/server/src/game/objects/player.ts:647-648] [H]
- With Mass Medicate the effect goes to every teammate on the same layer within `medicHealRange` 8 u (the medic included); downed players are excluded from heals and boosts [src:survev/server/src/game/objects/player.ts:3279-3300] [src:survev/server/src/game/objects/player.ts:3222-3248] [src:survev/shared/gameConfig.ts:223] [src:derived/survev@9f64948d:src/gameConfig.ts:138] [src:wikigg/Mass_Medicate] [H]
- After any completed action, an empty active gun schedules a reload (except after a revive) [src:survev/server/src/game/objects/player.ts:1742-1749] [H]
- `action.time` and `action.duration` are sent to the client as 8-bit floats over 0–8.5. The client shows a pie timer labelled "Using <item>", "Reloading" or "Reviving <name>" [src:survev/shared/net/updateMsg.ts:23-24] [src:survev/client/src/ui/ui.ts:694-742] [src:survev/client/src/en.json:291-298] [H]
- A medic using an item or reviving shows a pulsing aura scaled to the effect range: red/green from the item's `aura` tint, purple (0xff00ff) for revives [src:survev/client/src/objects/player.ts:1755-1785] [src:fandom/Medic] [src:wikigg/Mass_Medicate] [H]

## Cancel rules

| event | cancels UseItem? | sources |
|---|---|---|
| firing a gun (each shot calls `cancelAction`) | yes | [src:survev/server/src/game/weaponManager.ts:741-743] [src:fandom/Consumables] [src:fandom/Soda] [H] |
| starting a melee swing | yes | [src:survev/server/src/game/weaponManager.ts:411-421] [src:fandom/Soda] [H] |
| starting to cook a throwable | yes | [src:survev/server/src/game/weaponManager.ts:1196-1201] [H] |
| switching weapon slot (any equip input, stow, swap) | yes | [src:survev/server/src/game/weaponManager.ts:175] [src:fandom/Consumables] [H] |
| dropping any item | yes | [src:survev/server/src/game/objects/player.ts:4242-4247] [src:fandom/Consumables] [H] |
| Cancel input (X; on mobile the interaction button sends Interact + Cancel) | yes | [src:survev/server/src/game/objects/player.ts:3506-3511] [src:survev/client/src/inputBinds.ts:33] [src:survev/client/src/game.ts:622-626] [src:survev/client/src/en.json:153-154] [src:fandom/Med_Kit] [H] |
| being downed or dying | yes | [src:survev/server/src/game/objects/player.ts:2603] [src:survev/server/src/game/objects/player.ts:2646-2647] [H] |
| starting another heal/boost | no (refused while one is running) | [src:survev/server/src/game/objects/player.ts:3256] [H] |
| reload input (R) | no: R sets `scheduledReload`, but `tryReload` returns early during UseItem or Revive and the scheduled flag is already consumed, so the press is lost | [src:survev/server/src/game/objects/player.ts:3501-3505] [src:survev/server/src/game/weaponManager.ts:361-363] [src:survev/server/src/game/weaponManager.ts:485-500] [H] |
| picking up loot | no; non-gun loot is refused while using an item, guns can still be picked up | [src:survev/server/src/game/objects/player.ts:3718-3723] [src:fandom/Consumables] [M] |
| taking damage, moving, opening doors | no | [src:survev/server/src/game/objects/player.ts:2410-2540] [src:fandom/Knocked_Out] [H] |

- Original 0.1.0 notes on reloads: "Players can no longer shoot while reloading a magazine-fed gun. All other modes of interrupting a reload remain (switch weapons, stow weapons, use item, loot a new gun)" [src:changelog/0.1.0] [src:fandom/Player] [H]

## Movement while using

- Speed × 0.5 while a UseItem action runs; with Combat Medic (`field_medic`) there is no penalty and +1 instead (fork value) [src:survev/server/src/game/objects/player.ts:4751-4763] [src:fandom/Consumables] [src:wikigg/Combat_Medic] [H]
- 0.0.95 "Decreased move speed penalty when using items" [src:changelog/0.0.95] [H]

## Other healing sources

| source | rate | era | sources |
|---|---|---|---|
| boost | 0.5–1.75 HP/s by tier | original (values: survev) | [src:survev/server/src/game/objects/player.ts:1520-1546] [M] |
| Gift of the Woods (`gotw`) | survev +1 HP/s, a fork value: 0.5 HP/s (and +25 % size) until fork v0.2.2 (commit `fddf75b8`, 2026-02-23). Fandom gives 1 HP/s, "the exact same as 25 % Adrenaline". No downed check in survev | original 0.7.5; value changed in the fork | [src:survev/server/src/game/objects/player.ts:1555-1557] [src:survev/shared/defs/gameObjects/perkDefs.ts:81-84] [src:derived/survev-git-fddf75b8] [src:wikigg/Gift_of_the_Woods] [src:fandom/Gift_of_the_Woods] [M] |
| Crimson Ring Club bathhouse sauna (`bathhouse_sideroom_01`) heal region | 3 HP/s | original | [src:survev/shared/defs/mapObjects/buildings/baseBuildingDefs.ts:3928-3936] [src:derived/survev@9f64948d:src/defs/mapObjectDefs.js:22894-22900] [src:fandom/Health] [H] |
| winter camp campfire heal region | 2 HP/s | fork | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:87-91] [src:wikigg/Health] [M] |
| Oasis heal region | 1 HP/s | fork | [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:1031-1035] [src:wikigg/Health] [M] |
| Takedown kill | +25 HP (wikis: 15) | original 0.8.3 | [src:survev/shared/defs/gameObjects/perkDefs.ts:85-89] [src:wikigg/Takedown] [src:fandom/Takedown] [L] |
| revive | set to 24 HP | original | [src:survev/shared/gameConfig.ts:191] [src:derived/survev@9f64948d:src/gameConfig.ts:122] [H] |
| Lone Survivr promotion | set to 100 HP | original | [src:survev/server/src/game/objects/player.ts:924-929] [src:fandom/Lone_Survivr] [H] |
| fork Combat Stimulants | bullets heal teammates for 6 % of damage for 5 s after a consumable | fork | [src:survev/server/src/game/objects/player.ts:2425-2440] [src:wikigg/Combat_Stimulants] [H] |

- Heal regions add their `healRate` × dt while the player is inside one on the same layer, not downed, and not in the gas; they turn on the heal effect flag [src:survev/server/src/game/objects/player.ts:2141-2164] [src:wikigg/Health] [H]
- No healing of any kind while downed (fandom), except that survev's `gotw` regen has no downed check [src:fandom/Health] [src:survev/server/src/game/objects/player.ts:1555-1557] [M]
- Health bar colour steps: grey at 100, white 75–100, pink to red 25–75, flashing red at 25 or less, solid red when downed [src:survev/client/src/ui/ui2.ts:1090-1151] [src:wikigg/Health] [src:fandom/Health] [H]

## Conflicts

- CONFLICT medic-use-time: Mass Medicate use time × 0.75 [src:survev/server/src/game/objects/player.ts:3275] vs "increases the using speed by 25 %, equating to 20 % less use time" (× 0.8) [src:fandom/Mass_Medicate] [src:wikigg/Mass_Medicate]; proposed: × 0.8 (two wikis) with a knob [M]
- CONFLICT takedown-hp: +25 HP [src:survev/shared/defs/gameObjects/perkDefs.ts:86] vs +15 HP / "similar to using a bandage" [src:wikigg/Takedown] [src:wikigg/Health] [src:fandom/Takedown]; proposed: 15 for 0.8.82 with a knob (wikis agree, survev has no source) [L]
- CONFLICT gotw-regen: Gift of the Woods regenerates 1 HP/s, a fork value; it was 0.5 HP/s (survev's tier-1 boost rate) until fork v0.2.2 [src:survev/shared/defs/gameObjects/perkDefs.ts:81-84] [src:derived/survev-git-fddf75b8] [src:wikigg/Gift_of_the_Woods] vs 1 HP/s, "the exact same as 25 % Adrenaline" [src:fandom/Gift_of_the_Woods]; proposed: tie it to the tier-1 boost heal rate (1 HP/s with fandom's boost table, 0.5 with survev's) behind a knob [L]
- CONFLICT loot-pickup-cancel: survev refuses non-gun pickups during a heal without cancelling it, and gun pickups go through [src:survev/server/src/game/objects/player.ts:3718-3723] vs "You cannot switch weapons, drop or pick up equipment, or attack while consuming or it will stop" [src:fandom/Consumables]; proposed: keep survev's refusal (the use is not lost) and log it [L]
- CONFLICT gotw-while-downed: survev keeps Gift of the Woods regen while downed [src:survev/server/src/game/objects/player.ts:1555-1557] vs "You cannot gain health by any means while knocked out" [src:fandom/Health]; proposed: no regen while downed [M]

## Open questions

- Was the bandage refusal at full health exact (`health == maxHeal`) in the original, or `health >= maxHeal`? With fractional HP from boost the difference matters [src:survev/server/src/game/objects/player.ts:3255] [L]
- Did reload input cancel a heal in the original? survev silently ignores it [src:survev/server/src/game/objects/player.ts:3501-3505] [L]
