# Gas (red zone)

> The shrinking play area is called "gas" in code and "red zone" in the UI. survev hard-codes one 17-entry stage table (`GasStages`) on the server. The original 0.8.82 client only carries the `GasMode` enum, so the timings and damage cannot be checked against client data. The fandom wiki's step table (which says its damage values are unconfirmed) matches survev's durations, damage and radius fractions exactly.
> Radii are fractions of `mapSize = (map.width + map.height) / 2`. Main-map sizes are 720 (solo/duo) and 768 (squad); 50v50 is 880.

## Identifiers and constants

| item | value | sources |
|---|---|---|
| gas state enum `GasMode` | `Inactive = 0`, `Waiting = 1`, `Moving = 2` | [src:survev/shared/gameConfig.ts:43-47] [src:kong/relaunch-client-bundle] [H] |
| damage type | `DamageType.Gas = 2` (Player 0, Bleeding 1, Gas 2, Airdrop 3, Airstrike 4) | [src:survev/shared/gameConfig.ts:25-31] [src:kong/relaunch-client-bundle] [H] |
| `GameConfig.gas.damageTickRate` | 2 s between damage ticks | [src:survev/shared/gameConfig.ts:178-180] [src:fandom/Red_Zone] [H] |
| `mapSize` | `(map.width + map.height) / 2` | [src:survev/server/src/game/objects/gas.ts:219] [H] |
| map width/height | `baseWidth * scale + extension`: 512 × 1.1875 + 112 = 720 (solo/duo), 512 × 1.28125 + 112 = 768 (squad) | [src:survev/server/src/game/map.ts:286-287] [src:survev/shared/defs/maps/baseDefs.ts:812-818] [src:fandom/50v50_Map] [H] |
| 50v50 map size | 512 × 1.5 + 112 = 880 | [src:survev/shared/defs/maps/factionDefs.ts:400-406] [src:fandom/50v50_Map] [src:wikigg/50v50_mode] [H] |
| initial state (before start) | mode Inactive, `radOld = 0.85 × mapSize`, `currentRad = radNew = 0.7425 × mapSize`, centred on the map | [src:survev/server/src/game/objects/gas.ts:217-229] [M] |
| client placeholder radius before the first gas message | `(√2 + 0.01) × 1024` | [src:survev/client/src/gas.ts:177-186] [M] |
| network format | mode u8, duration float32, posOld/posNew map positions, radOld/radNew 16-bit floats in [0, 2048]; progress `gasT` is a separate 16-bit float in [0, 1] | [src:survev/shared/net/updateMsg.ts:202-227] [src:survev/shared/net/updateMsg.ts:333-340] [M] |

## Stage table

> `stage` is the index into `GasStages`; `circleIdx` is incremented each time a Waiting stage starts (it starts at −1). Plane, role and unlock schedules key off `circleIdx`. Radius columns are the target (safe-circle) radius reached at the end of that circle's Moving stage. Area % is π·r²/mapSize².

| stage | mode | duration s | rad fraction | damage / tick | circleIdx | r @720 | r @768 | r @880 | area % of map | sources |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Inactive | 0 | 0.7425 | 0 | −1 | 534.6 | 570.2 | 653.4 | >100 (covers corners) | [src:survev/server/src/game/objects/gas.ts:15-20] [M] |
| 1 | Waiting | 80 | 0.45 | 1.4 | 0 | 324 | 345.6 | 396 | 63.6 | [src:survev/server/src/game/objects/gas.ts:21-26] [src:fandom/Red_Zone] [H] |
| 2 | Moving | 30 | 0.45 | 1.4 | 0 | 324 | 345.6 | 396 | 63.6 | [src:survev/server/src/game/objects/gas.ts:27-32] [src:fandom/Red_Zone] [H] |
| 3 | Waiting | 65 | 0.3125 | 2.2 | 1 | 225 | 240 | 275 | 30.7 | [src:survev/server/src/game/objects/gas.ts:33-38] [src:fandom/Red_Zone] [H] |
| 4 | Moving | 25 | 0.3125 | 2.2 | 1 | 225 | 240 | 275 | 30.7 | [src:survev/server/src/game/objects/gas.ts:39-44] [src:fandom/Red_Zone] [H] |
| 5 | Waiting | 50 | 0.2125 | 3.5 | 2 | 153 | 163.2 | 187 | 14.2 | [src:survev/server/src/game/objects/gas.ts:45-50] [src:fandom/Red_Zone] [H] |
| 6 | Moving | 20 | 0.2125 | 3.5 | 2 | 153 | 163.2 | 187 | 14.2 | [src:survev/server/src/game/objects/gas.ts:51-56] [src:fandom/Red_Zone] [H] |
| 7 | Waiting | 40 | 0.1375 | 7.5 | 3 | 99 | 105.6 | 121 | 5.9 | [src:survev/server/src/game/objects/gas.ts:57-62] [src:fandom/Red_Zone] [H] |
| 8 | Moving | 15 | 0.1375 | 7.5 | 3 | 99 | 105.6 | 121 | 5.9 | [src:survev/server/src/game/objects/gas.ts:63-68] [src:fandom/Red_Zone] [H] |
| 9 | Waiting | 30 | 0.075 | 10 | 4 | 54 | 57.6 | 66 | 1.77 | [src:survev/server/src/game/objects/gas.ts:69-74] [src:fandom/Red_Zone] [H] |
| 10 | Moving | 10 | 0.075 | 10 | 4 | 54 | 57.6 | 66 | 1.77 | [src:survev/server/src/game/objects/gas.ts:75-80] [src:fandom/Red_Zone] [H] |
| 11 | Waiting | 25 | 0.045 | 14 | 5 | 32.4 | 34.6 | 39.6 | 0.64 | [src:survev/server/src/game/objects/gas.ts:81-86] [src:fandom/Red_Zone] [H] |
| 12 | Moving | 5 | 0.045 | 14 | 5 | 32.4 | 34.6 | 39.6 | 0.64 | [src:survev/server/src/game/objects/gas.ts:87-92] [src:fandom/Red_Zone] [H] |
| 13 | Waiting | 20 | 0.0225 | 22 | 6 | 16.2 | 17.3 | 19.8 | 0.16 | [src:survev/server/src/game/objects/gas.ts:93-98] [src:fandom/Red_Zone] [H] |
| 14 | Moving | 6 | 0.0225 | 22 | 6 | 16.2 | 17.3 | 19.8 | 0.16 | [src:survev/server/src/game/objects/gas.ts:99-104] [src:fandom/Red_Zone] [H] |
| 15 | Waiting | 15 | 0 | 22 | 7 | 0 | 0 | 0 | 0 | [src:survev/server/src/game/objects/gas.ts:105-110] [src:fandom/Red_Zone] [H] |
| 16 | Moving | 15 | 0 | 22 | 7 | 0 | 0 | 0 | 0 | [src:survev/server/src/game/objects/gas.ts:111-116] [src:fandom/Red_Zone] [H] |

- Fandom's "Area Left" column (100 %, 64 %, 31 %, 14 %, 6 %, 1.8 %, 0.6 %, 0.15 %, 0 %) is shifted one step: step N lists the area at the start of step N, which equals π·fraction² of survev's previous circle (step 0 = 100 %), an independent check of the radius table [src:fandom/Red_Zone] [src:derived/pi-r2-of-GasStages-fractions] [H]
- Fandom numbers the circles as steps 0–8 (eight closing steps, then step 8 with 0 s and 22 damage) [src:fandom/Red_Zone] [M]
- Fandom itself notes "the damage values have no real confirmation" [src:fandom/Red_Zone] [M]

## Timeline from game start

| circle (circleIdx) | wait ends at | move ends at | sources |
|---|---|---|---|
| 0 | 1:20 | 1:50 | [src:derived/cumulative-GasStages-durations] [src:fandom/Red_Zone] [H] |
| 1 | 2:55 | 3:20 | [src:derived/cumulative-GasStages-durations] [H] |
| 2 | 4:10 | 4:30 | [src:derived/cumulative-GasStages-durations] [H] |
| 3 | 5:10 | 5:25 | [src:derived/cumulative-GasStages-durations] [H] |
| 4 | 5:55 | 6:05 | [src:derived/cumulative-GasStages-durations] [H] |
| 5 | 6:30 | 6:35 | [src:derived/cumulative-GasStages-durations] [H] |
| 6 | 6:55 | 7:01 | [src:derived/cumulative-GasStages-durations] [H] |
| 7 | 7:16 | 7:31 (radius 0, whole map is gas) | [src:derived/cumulative-GasStages-durations] [src:fandom/Red_Zone] [H] |

- Totals: 325 s of waiting plus 126 s of moving = 451 s (7:31). Fandom gives the same 451 s total, but lists waiting as 300 s, which is an arithmetic slip [src:derived/cumulative-GasStages-durations] [src:fandom/Red_Zone] [M]
- After stage 16 there is no stage data. The gas stops advancing and stays at radius 0, dealing 22 per tick [src:survev/server/src/game/objects/gas.ts:261-266] [M]

## Start condition

- The game (and so the gas) starts when `isGameStarted()` is true, i.e. `cantDespawnAliveCount() > 1`. At that point `gas.advanceGasStage()` moves Inactive → stage 1 [src:survev/server/src/game/game.ts:183-186] [src:survev/server/src/game/gameModeManager.ts:135-137] [H]
- Fandom: with only one player in the game (e.g. Twitch servers) the red-zone countdown does not start until a second player joins [src:fandom/Red_Zone] [M]
- Until the gas starts the client shows "Waiting for players" (`game-waiting-for-players`). The first gas full-state message hides it [src:survev/client/src/gas.ts:218-224] [src:l10n/en:game-waiting-for-players] [H]

## State machine (server `Gas.update` / `advanceGasStage`)

- Each tick `gasT = clamp(ticker / duration, 0, 1)`. In Moving mode the centre and radius are lerped: `currentPos = lerp(gasT, posOld, posNew)`, `currentRad = lerp(gasT, radOld, radNew)`. When `gasT ≥ 1` the next stage starts [src:survev/server/src/game/objects/gas.ts:231-246] [H]
- On every stage change: `radOld = currentRad`, `radNew = stage.rad × mapSize`, and duration and damage are copied from the stage [src:survev/server/src/game/objects/gas.ts:257-272] [H]
- On a Waiting stage the new safe circle is chosen (next section), `currentPos/currentRad` are reset to the old circle and `circleIdx++` [src:survev/server/src/game/objects/gas.ts:276-294] [H]
- So the white safe circle appears at the start of each Waiting phase. The red zone stays still during the wait and then closes in linearly over the Moving phase [src:survev/server/src/game/objects/gas.ts:276-294] [src:fandom/Red_Zone] [H]
- A player is "in gas" when `distance(pos, currentPos) ≥ currentRad`, using the player centre with no radius margin [src:survev/server/src/game/objects/gas.ts:324-326] [M]
- `isOutSideSafeZone(pos)` tests against the next circle (`posNew`, `radNew`) [src:survev/server/src/game/objects/gas.ts:328-330] [M]

## Safe-circle centre selection

- `posNew = posNew_prev + randomPointInCircle(radOld − radNew)`, so the new circle always lies inside the previous one [src:survev/server/src/game/objects/gas.ts:277-282] [H]
- `randomPointInCircle` samples uniformly by area: sort two uniforms a ≤ b, then radius b·r and angle 2π·a/b [src:survev/shared/utils/util.ts:80-92] [M]
- The centre is then clamped to `[0.75·radNew, size − 0.75·radNew]` on each axis, so at least ~75 % of the circle radius stays inside the map [src:survev/server/src/game/objects/gas.ts:284-289] [M]
- The first circle uses the map centre as `posNew_prev`, with `radOld = 0.7425·mapSize`, `radNew = 0.45·mapSize` [src:survev/server/src/game/objects/gas.ts:220-226] [M]
- Original changelog 0.4.1: "Safe zone circles are now more likely to move towards the edges of the map." [src:changelog/0.4.1] [H]
- Fandom: the zone does not always close on the map centre; it can end near an edge [src:fandom/Red_Zone] [M]
- namu: the centre changes each time a new zone is set [src:namu/Surviv.io] [M]

## Damage

- A global ticker sets `doDamage` once every 2 s, so every player in gas takes damage on the same tick. The ticker runs from game creation, so the first tick after start lands on the global 2 s grid [src:survev/server/src/game/objects/gas.ts:248-254] [M]
- On a damage tick a player in gas takes `stage.damage` with `DamageType.Gas` [src:survev/server/src/game/objects/player.ts:1648-1663] [src:fandom/Red_Zone] [H]
- Gas (and bleeding) damage skips headshots, armor, Flak Jacket and Steelskin reduction [src:survev/server/src/game/objects/player.ts:2454-2457] [src:fandom/Flak_Jacket] [src:fandom/Perks] [H]
- Flak Jacket and Cast Ironskin reduced red-zone and air-drop damage as a bug in v0.8.8 (Dec 2, 2019). The December 4, 2019 fix only says they "no longer reduce damage from Red Zone", so the red-zone part is absent in 0.8.82; both pages' trivia still say the perks survive air-drop crushing (see `airdrop-airstrike.md`) [src:fandom/Flak_Jacket] [src:fandom/Cast_Ironskin] [M]
- Gas damage applies to downed players too, on top of bleeding. A downed player killed while bleeding is reported as "finally bled out" [src:survev/server/src/game/objects/player.ts:1648-1669] [src:l10n/en:game-finally-bled-out] [src:fandom/Red_Zone] [M]
- Kill feed text for gas deaths: "<player> died outside the safe zone" (`game-died-outside`), with "The red zone" (`game-the-red-zone`) as the killer name for knock-outs [src:l10n/en:game-died-outside] [src:l10n/en:game-the-red-zone] [src:fandom/Kill_Counter] [H]
- Building heal regions (e.g. steam rocks in the bathhouse sauna) do not heal a player who is in gas [src:survev/server/src/game/objects/player.ts:2144-2149] [src:fandom/Steam_Rock] [src:fandom/Crimson_Ring_Club] [H]
- Reference DPS: 0.7 HP/s in circle 0, 1.1, 1.75, 3.75, 5, 7 and then 11 HP/s from circle 6 onwards. Boost healing (0.5–1.75 HP/s) outheals only the first circles [src:derived/damage-per-tick-div-2] [src:fandom/Adrenaline] [M]

## Fork-only gas changes (do not port for 0.8.82)

- (fork) Escalation, added 2026-04-04 (survev commit `4e195a72`): while `circleIdx > 2` (from circle 3, t ≥ 4:30), `timeInsideGas` accumulates. Each tick deals `damage × (1 + 0.025 × timeInsideGas)`, and leaving the gas resets the timer. Example: 20 s inside gives ×1.5 [src:survev/server/src/game/objects/player.ts:1648-1669] [src:derived/survev-git-4e195a72] [src:wikigg/50v50_mode] [H]
- (fork) Disconnected players standing in gas take 22 per tick regardless of the stage (still multiplied by the escalation factor), added 2026-03-23 (`a39e9ea8`). wiki.gg describes it as intentional [src:survev/server/src/game/objects/player.ts:1653-1661] [src:derived/survev-git-a39e9ea8] [src:wikigg/Red_Zone] [H]
- (fork) A player downed while `currentRad ≤ 0.1` u (the zone has fully closed, i.e. at the very end of stage 16, not merely the last circle) is downed with 50 HP instead of 100, added 2025-04-20 (`042e29c7`, "down players with 50 health on last gas stage … fixes revivify infinite revive") [src:survev/server/src/game/objects/player.ts:2590-2592] [src:derived/survev-git-042e29c7] [M]
- Fandom (documenting the original) says that after several revives "some other feature kicks in and being knocked by red zone makes you have less health", so the original had some anti-Revivify rule whose exact form is unknown [src:fandom/Revivify] [L]

## Per-mode overrides

- survev has no per-mode gas configuration. No map def sets gas fields; every mode uses `GasStages` scaled by its own `mapSize` [src:survev/server/src/game/objects/gas.ts:14-117] [src:survev/shared/defs/mapDefs.ts] [M]
- Fandom map pages (Normal, Desert, Halloween, Snow, Cobalt, 50v50, Cinco de Mayo) all describe the same 8-step schedule, so there is no wiki evidence of per-mode timings in the original either [src:fandom/Normal_Map] [src:fandom/50v50_Map] [src:fandom/Snow_Map] [src:fandom/Cobalt_Map] [M]
- What does vary per mode is what is scheduled on `circleIdx` changes: plane timings (`mapDef.gameConfig.planes.timings`), role promotions (`gameConfig.roles`) and timed door unlocks (`gameConfig.unlocks`) [src:survev/server/src/game/objects/gas.ts:296-310] [M]
- Bleed damage (2/s, ×1.25 per extra down in 50v50) is a separate per-mode setting, not a gas setting [src:survev/shared/defs/maps/baseDefs.ts:86-88] [src:survev/shared/defs/maps/factionDefs.ts:245-246] [src:wikigg/50v50_mode] [H]
- Rebirth: a game whose player cap grows its map (rebirth-deviations.md "Maps follow the player cap") stretches every stage's duration, and the plane, role and unlock waits counted from a circle's start, by the map's width over the design map's (at most 1.37), so the gas keeps its speed in units per second (sim `match/gasScale.ts`) [src:user/2026-10-08-map-player-cap] [H]

## Client presentation

- World overlay: red `0xff0000` at alpha 0.6 everywhere outside the circle, drawn as a full-screen quad with a 512-segment circular hole [src:survev/client/src/gas.ts:13-50] [src:survev/client/src/gas.ts:187] [src:fandom/Red_Zone] [H]
- Fandom trivia gives the same colour, `rgba(255, 0, 0, 0.6)` [src:fandom/Red_Zone] [M]
- Minimap and big map: the gas is drawn in black (`0x000000`, alpha 0.6) [src:survev/client/src/ui/ui.ts:401] [src:survev/client/src/ui/ui.ts:1996-2005] [src:wikigg/Red_Zone] [H]
- The next safe circle is a white 1.5 px outline on the map. A green (`0x00ff00`) line runs from the player to the safe centre on the minimap (not the big map), at alpha 0.5 inside the safe zone and 1.0 outside [src:survev/client/src/gas.ts:93-157] [src:survev/client/src/ui/ui.ts:2007-2023] [M]
- The client interpolates the circle between server progress updates using `circleT` [src:survev/client/src/gas.ts:202-216] [src:survev/client/src/gas.ts:238-248] [M]
- HUD timer: `m:ss` of `floor(duration × (1 − circleT))`. The icon is `gas-icon` while waiting and `danger-icon` with an `icon-pulse` class while moving [src:survev/client/src/ui/ui.ts:657-679] [src:fandom/HUD] [H]
- Announcements on mode change: Waiting shows "Red zone advances in N minutes S seconds" (`game-red-zone-advances`, `game-minutes`/`game-minute`, `game-seconds`). Moving shows "Red zone advancing! Move to the safe zone" (`game-red-zone-advancing`) [src:survev/client/src/ui/ui.ts:1962-1989] [src:l10n/en:game-red-zone-advances] [src:l10n/en:game-red-zone-advancing] [H]
- Korean strings: 레드존 전진 / 레드존 접근 중! 세이프 존으로 이동하세요! [src:l10n/ko:game-red-zone-advances] [src:l10n/ko:game-red-zone-advancing] [H]
- Changelog 0.1.1: "Fixed issue on canvas renderer where red zone covered entire map". The canvas renderer path still exists (fill rect plus counter-clockwise arc) [src:changelog/0.1.1] [src:survev/client/src/gas.ts:66-75] [H]
- Fandom: with a high scope at a map corner the red zone is visible beyond the map edge at the very start [src:fandom/Red_Zone] [M]

## Vestigial gas parameters in the earliest survev import

- survev's first commit (Dec 2023, built from the original client) carries a parametric gas config: `initWaitTime 90`, `waitTimeDecay 15`, `waitTimeMin 10`, `initGasTime 30`, `gasTimeDecay 5`, `gasTimeMin 5`, `initWidth 0.75`, `widthDecay 0.5`, `widthMin 0`, `damageTickRate 2`, `damagePerTick [0.012, 0.02, 0.035, 0.075, 0.1, 0.14, 0.22, 0.22]` [src:derived/survev@9f64948d:src/gameConfig.ts:87-101] [L]
- The 0.8.82 relaunch bundle has no such block, so it is probably left over from an older client build. Its damage ×100 (1.2, 2, 3.5, …) differs from the stage table only in the first two circles [src:kong/relaunch-client-bundle] [src:derived/compare-9f64948d-gas-vs-GasStages] [L]
- survev used this parametric model until 2024-09-13, when commit `6e3d1d46` replaced it with the explicit `GasStages` table [src:derived/survev-git-6e3d1d46] [M]
- Changelog 0.0.5: "Decreased initial circle timer." [src:changelog/0.0.5] [H]

## Conflicts

- CONFLICT gas-first-wait: first wait is 80 s (survev stage 1, fandom step 0) [src:survev/server/src/game/objects/gas.ts:21-26] [src:fandom/Red_Zone] vs "after 1 minute and 15 seconds the safe zone will start shrinking" [src:wikigg/Red_Zone]; proposed: keep 80 s; wiki.gg is loose prose [L]
- CONFLICT gas-final-damage: final-circle damage 22 per 2 s [src:survev/server/src/game/objects/gas.ts:93-116] [src:fandom/Red_Zone] vs "24 damage every 2 seconds" in the late stages [src:fandom/Med_Kit]; proposed: 22 (two sources agree), configurable [L]
- CONFLICT gas-vestigial-damage: early-circle damage 1.4 / 2.2 per tick [src:survev/server/src/game/objects/gas.ts:21-44] [src:fandom/Red_Zone] vs `damagePerTick` 0.012 / 0.02 (×100 = 1.2 / 2.0) in survev's first import [src:derived/survev@9f64948d:src/gameConfig.ts:87-101]; proposed: use the stage table; treat the old block as an earlier balance [L]
- CONFLICT gas-revivify-final-circle: survev downs players at 50 HP once `currentRad ≤ 0.1` u, i.e. after the zone has fully closed (fork fix) [src:survev/server/src/game/objects/player.ts:2590-2592] vs the original having some health penalty after multiple revives [src:fandom/Revivify] vs namu saying gas damage never exceeds 100 while reviving, allowing endless survival [src:namu/Surviv.io]; proposed: ship without the penalty for 0.8.82 fidelity but keep the 50 HP rule behind a flag [L]
- CONFLICT gas-escalation: time-in-gas escalation and flat 22 for disconnected players exist in survev [src:survev/server/src/game/objects/player.ts:1648-1669] [src:wikigg/Red_Zone] vs both added in 2026 fork commits, with no trace in original sources [src:derived/survev-git-4e195a72] [src:derived/survev-git-a39e9ea8]; proposed: disable both for 0.8.82, keep as fork options [M]

## Open questions

- The real 0.8.82 server stage table is unknown. survev's table matches fandom but may itself be derived from the wiki; there are no packet captures in the sources [src:fandom/Red_Zone] [src:survev/server/src/game/objects/gas.ts:14-117] [L]
- Did the original apply the 0.75-radius edge clamp, and what distribution produced "more likely to move towards the edges" (0.4.1)? [src:changelog/0.4.1] [src:survev/server/src/game/objects/gas.ts:284-289] [L]
- Did 50v50 (880-unit map) use different gas durations? No source says so [src:fandom/50v50_Map] [L]
- How did the original treat disconnected players' bodies in gas (normal stage damage or a special rule)? [src:wikigg/Red_Zone] [L]
