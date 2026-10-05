# Boost (adrenaline)

> Boost is the 0–100 "adrenaline" bar filled by Soda (`soda`) and Pills (`painkiller`). It decays over time, heals by tier and gives a speed bonus at 50 or more.
> The tier edges come from `GameConfig.player.boostBreakpoints`, which is client-visible and identical in the original client (survev first commit `9f64948d`, cited `derived/survev@9f64948d:<path>:<lines>`) and the 2026 relaunch bundle (`kong/relaunch-client-bundle`). `boostDecay`, `boostHealAmounts` and `boostMoveSpeed` are server-only survev values. The per-tier heal amounts were hard-coded in survev commit `ac8ac068` (2024-06-28) and moved to `GameConfig` in `f35a7380` (2026-03-18).

## Constants

| constant | value | client-visible? | sources |
|---|---|---|---|
| `boostBreakpoints` | [1, 1, 1.5, 0.5] (sum 4), giving tier edges at 25 / 50 / 87.5 / 100 | yes | [src:survev/shared/gameConfig.ts:196] [src:derived/survev@9f64948d:src/gameConfig.ts:123] [src:kong/relaunch-client-defs] [H] |
| `boostHealAmounts` (HP/s per tier) | [0.5, 1.25, 1.5, 1.75] | no | [src:survev/shared/gameConfig.ts:195] [src:wikigg/Adrenaline] [M] |
| `boostDecay` | 0.375 boost/s | no | [src:survev/shared/gameConfig.ts:193] [src:fandom/Adrenaline] [src:wikigg/Adrenaline] [H] |
| `boostMoveSpeed` | +1.85 u/s at boost ≥ 50 | no | [src:survev/shared/gameConfig.ts:194] [src:fandom/Adrenaline] [src:fandom/Player] [src:wikigg/Adrenaline] [H] |
| max boost | 100 (setter clamps to [0, 100]) | n/a | [src:survev/server/src/game/objects/player.ts:671-673] [src:wikigg/Adrenaline] [H] |
| Soda (`soda`) | +25 boost, 3 s | yes (item def) | [src:survev/shared/defs/gameObjects/gearDefs.ts:325-329] [src:derived/survev@9f64948d:src/defs/gearDefs.js:185-189] [src:fandom/Soda] [src:namu/Surviv.io/의료품] [H] |
| Pills (`painkiller`) | +50 boost, 5 s | yes (item def) | [src:survev/shared/defs/gameObjects/gearDefs.ts:347-351] [src:derived/survev@9f64948d:src/defs/gearDefs.js:207-211] [src:fandom/Pills] [src:namu/Surviv.io/의료품] [H] |

- survev history: commit `2047140c` (2024-03-04) hard-coded decay 0.375/s and heal tiers 1 / 3.75 / 4.75 / 5 HP/s, the same numbers as fandom. Commits `ac8ac068` / `97029e58` (2024-06-28/29, "fixed healing/boost drop") changed the tiers to 0.5 / 1.25 / 1.5 / 1.75. So survev's current tiers are a survev correction and not independent of fandom's [src:derived/survev-git-2047140c] [src:derived/survev-git-ac8ac068] [src:derived/survev-git-97029e58] [H]
- The unused `GameConfig` placeholders `boostDecay 0.33` and a flat `boostHealAmount 0.33` (commit `f96f88cd`, 2024-03-29) were replaced by the current config entries in `f35a7380` (2026-03-18) [src:derived/survev-git-f96f88cd] [src:derived/survev-git-f35a7380] [M]

## Formula in code (survev, every tick, `Player.update`)

```ts
// tier table built once from boostBreakpoints (player.ts:72-84)
// edges: 25, 50, 87.5, 100 ; heal: 0.5, 1.25, 1.5, 1.75
if (!downed) {
    boost = clamp(boost, minBoost, 100);
    if (boost > 0) {
        // last tier whose [prevEdge, edge] contains boost (so exactly 25 -> tier 2)
        tier = boostHeals.findLast((b, i) => boost >= (boostHeals[i-1]?.maxBoost ?? 0) && boost <= b.maxBoost);
        health += tier.heal * dt;
        if (boost > minBoost)
            boost -= boostDecay * (hasPerk("lifeline") ? 0.75 : 1) * dt;   // lifeline is fork-only
    }
} else {
    boost = 0;
}
// recalculateSpeed: if (boost >= 50) speed += boostMoveSpeed (1.85)
```

- Heal tier table construction [src:survev/server/src/game/objects/player.ts:72-84] [H]
- Per-tick heal, decay and the downed reset [src:survev/server/src/game/objects/player.ts:1520-1546] [H]
- Speed bonus [src:survev/server/src/game/objects/player.ts:4734-4737] [H]
- survev's own unit test checks one second at `edge − 1` for each tier, including Leadership (tier 4) and Assume Leadership (tier 3) [src:survev/tests/src/boost.test.ts:13-49] [H]
- Edge handling: exactly 25 heals 1.25, exactly 50 heals 1.5, exactly 87.5 heals 1.75. Before commit `f35a7380` exactly 25 healed 0.5 [src:survev/server/src/game/objects/player.ts:1527-1530] [src:derived/survev-git-f35a7380] [H]

## Tier table: code vs wikis

| tier | boost range | survev heal HP/s | wiki.gg | fandom | speed bonus (all three) | sources |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 | [src:survev/server/src/game/objects/player.ts:1526] [src:wikigg/Adrenaline] [src:fandom/Adrenaline] [H] |
| 1 | (0, 25) | 0.5 | 0.5 | 1 | 0 | [src:survev/shared/gameConfig.ts:195] [src:wikigg/Adrenaline] [src:fandom/Adrenaline] [L] |
| 2 | [25, 50) | 1.25 | 1.25 | 3.75 | 0 | [src:survev/shared/gameConfig.ts:195] [src:wikigg/Adrenaline] [src:fandom/Adrenaline] [L] |
| 3 | [50, 87.5) | 1.5 | 1.5 | 4.75 | +1.85 | [src:survev/shared/gameConfig.ts:194-195] [src:wikigg/Adrenaline] [src:fandom/Adrenaline] [L] |
| 4 | [87.5, 100] | 1.75 | 1.75 | 5 | +1.85 | [src:survev/shared/gameConfig.ts:194-195] [src:wikigg/Adrenaline] [src:fandom/Adrenaline] [L] |

- wiki.gg documents the survev fork, so its matching numbers are not independent of the code [src:wikigg/Adrenaline] [src:derived/wikigg-documents-fork] [M]
- Fandom's prose also says "a 40 speed boost is added" (apparently a typo) and that the bonus is applied before other changes such as the +1 for melee [src:fandom/Adrenaline] [M]
- Fandom's Consumables page claims a second speed increase at 90 % and says a full bar heals "at a similar rate to using bandages" (15 HP / 3 s = 5 HP/s, matching fandom's tier 4 value of 5) [src:fandom/Consumables] [src:fandom/Bandage] [L]
- namu: the speed bonus starts at 50 % [src:namu/Surviv.io] [M]
- namu's tips page says speed increases with 3/4 of the bar or more [src:namu/Surviv.io/팁] [L]
- The original changelog lowered the adrenaline duration and move speed bonus twice ("Slightly lowered adrenaline duration and move speed bonus", 0.4.1 and 0.4.3). The wiki numbers may come from different eras [src:changelog/0.4.1] [src:changelog/0.4.3] [H]

## Derived durations and totals (survev values)

| quantity | value | sources |
|---|---|---|
| time to drain 100 → 0 | 266.7 s (25 boost = 66.7 s) | [src:derived/boost-formula] [M] |
| time in each tier from full | tier 4: 33.3 s, tier 3: 100 s, tier 2: 66.7 s, tier 1: 66.7 s | [src:derived/boost-formula] [src:wikigg/Adrenaline] [M] |
| speed bonus duration from full | 133.3 s (100 → 50) | [src:derived/boost-formula] [M] |
| HP healed by one Soda from 0 | 0.5 × 66.7 = 33.3 HP over 66.7 s | [src:derived/boost-formula] [M] |
| HP healed by one Pills from 0 | 1.25 × 66.7 + 0.5 × 66.7 = 116.7 HP over 133.3 s | [src:derived/boost-formula] [M] |
| HP healed by a full bar | 1.75 × 33.3 + 1.5 × 100 + 1.25 × 66.7 + 0.5 × 66.7 = 325 HP | [src:derived/boost-formula] [M] |
| Pills vs 2 Sodas | same +50 boost; Pills take 5 s, two Sodas 6 s | [src:wikigg/Adrenaline] [src:fandom/Pills] [H] |

## Sources of boost

- Soda +25 and Pills +50 on completing the 3 s / 5 s use action; added through `applyActionFunc`, so a Mass Medicate medic gives it to every non-downed teammate within 8 u [src:survev/server/src/game/objects/player.ts:1698-1706] [src:survev/server/src/game/objects/player.ts:3279-3300] [src:survev/shared/gameConfig.ts:223] [src:fandom/Mass_Medicate] [H]
- Boost items can be used at any boost level, including 100 (no cap check, unlike heals) [src:survev/server/src/game/objects/player.ts:3302-3328] [H]
- Leadership (`leadership`, Commander / `leader` role in 50v50): `minBoost` 100, so boost never drops and heals at 1.75 HP/s permanently [src:survev/shared/defs/gameObjects/perkDefs.ts:5-8] [src:survev/shared/defs/gameObjects/roleDefs.ts:124] [src:fandom/Leadership] [src:fandom/Adrenaline] [H]
- Assume Leadership (`assume_leadership`, Captain role): `minBoost` 50 (fork) [src:survev/shared/defs/gameObjects/perkDefs.ts:9-12] [src:survev/shared/defs/gameObjects/roleDefs.ts:170] [src:wikigg/Adrenaline] [H]
- `minBoost` is the highest `minBoost` among the player's perks, recomputed when perks change. Boost is clamped up to it every tick and does not decay below it [src:survev/server/src/game/objects/player.ts:4679-4688] [src:survev/server/src/game/objects/player.ts:1524] [src:survev/server/src/game/objects/player.ts:1534] [H]
- Takedown (`takedown`): +25 boost on a credited kill [src:survev/server/src/game/objects/player.ts:2721-2725] [src:survev/shared/defs/gameObjects/perkDefs.ts:85-89] [src:fandom/Takedown] [src:wikigg/Takedown] [H]
- Lone Survivr promotion: boost set to 100 (decays normally) [src:survev/server/src/game/objects/player.ts:924-929] [src:fandom/Lone_Survivr] [src:wikigg/Adrenaline] [H]

## Losing boost

- Being downed sets boost to 0 and keeps it at 0 while downed; revived players start at 0 [src:survev/server/src/game/objects/player.ts:2585] [src:survev/server/src/game/objects/player.ts:1544-1546] [src:fandom/Knocked_Out] [H]
- Death sets boost to 0 [src:survev/server/src/game/objects/player.ts:2645] [H]
- Fork Indomitable Spirit (`lifeline`): decay × 0.75 (0.28125/s) and boost spent at 2 per HP to survive fatal damage at 1 HP (fork) [src:survev/server/src/game/objects/player.ts:1535-1541] [src:survev/server/src/game/objects/player.ts:2493-2503] [src:survev/shared/defs/gameObjects/perkDefs.ts:90-93] [H]

## Interactions

- Boost healing stacks with Gift of the Woods (`gotw`; survev's +1 HP/s is a fork value, it was 0.5 before fork v0.2.2, see heal-actions.md), building heal regions and Mass Medicate; it is not blocked by the red zone [src:survev/server/src/game/objects/player.ts:1555-1557] [src:survev/server/src/game/objects/player.ts:2141-2164] [src:wikigg/Adrenaline] [src:fandom/Gift_of_the_Woods] [H]
- Boost healing is clamped by the 100 HP cap; boost keeps decaying at full health [src:survev/server/src/game/objects/player.ts:647-648] [src:survev/server/src/game/objects/player.ts:1532-1542] [H]
- That Sucks (`trick_drain`, Halloween 0.8.7) drain can be offset by boost (fandom) [src:fandom/That_Sucks] [src:wikigg/Adrenaline] [M]

## Network and HUD

- Boost is sent as an 8-bit float over 0–100, and only when it changed by 0.1 or more since the last send [src:survev/shared/net/updateMsg.ts:15-16] [src:survev/server/src/game/objects/player.ts:1548-1553] [H]
- The HUD bar has 4 segments sized by `boostBreakpoints` (25 % / 25 % / 37.5 % / 12.5 % of the bar). Each fills in turn and the bar is hidden at 0. The same code is in the relaunch bundle [src:survev/client/src/ui/ui2.ts:1153-1165] [src:kong/relaunch-client-bundle] [src:wikigg/Adrenaline] [H]
- Tooltips: "Left-click to boost adrenaline by 25." (Soda), "... by 50." (Pills), "Adrenaline restores health over time." [src:survev/client/src/en.json:379-382] [src:l10n/ko:game-soda-tooltip] [src:l10n/ko:game-painkiller-tooltip] [src:l10n/ko:game-adrenaline-tooltip] [H]
- Boost use emits the `boost` particle (green aura 0x199500 for the medic); boost particle skins are loadout items (`boost_basic`, `boost_star`, `boost_naturalize`, `boost_shuriken`; fork `boost_club`, `boost_hermes`, `boost_lightning`, `boost_gearshift`) [src:survev/shared/defs/gameObjects/gearDefs.ts:341-346] [src:survev/shared/defs/gameObjects/healEffectDefs.ts:63-122] [src:derived/survev@9f64948d:src/defs/healEffectDefs.js:30-56] [src:changelog/0.8.6] [H]

## Conflicts

- CONFLICT boost-heal-tiers: 0.5 / 1.25 / 1.5 / 1.75 HP/s [src:survev/shared/gameConfig.ts:195] [src:wikigg/Adrenaline] vs 1 / 3.75 / 4.75 / 5 HP/s [src:fandom/Adrenaline] [src:fandom/Consumables]; survev itself used fandom's numbers until June 2024 and switched in a commit titled "fixed healing/boost drop" [src:derived/survev-git-97029e58]; proposed: keep survev's values as `boostHealAmounts` knobs (wiki.gg copies survev; fandom's values give a single Soda 66 HP, which seems implausible), and flag them for measurement on the relaunch [L]
- CONFLICT boost-speed-threshold: one +1.85 step at ≥ 50 [src:survev/server/src/game/objects/player.ts:4735] [src:fandom/Adrenaline] [src:namu/Surviv.io] vs a second step at 90 % [src:fandom/Consumables] vs from 3/4 [src:namu/Surviv.io/팁]; proposed: single step at 50 [M]
- CONFLICT lifeline-decay: decay × 0.75 = 0.28125/s [src:survev/shared/defs/gameObjects/perkDefs.ts:91] vs "20 % slower (0.3/s)" [src:wikigg/Indomitable_Spirit]; proposed: fork-only perk, out of scope for 0.8.82 [L]

## Open questions

- The original per-tier heal amounts were never published. Measure them on the 2026 relaunch (it runs v0.8.82): heal over 10 s at 30, 60 and 95 boost [src:kong/relaunch-client-bundle] [src:derived/boost-formula] [L]
- Did the original decay also stop at `minBoost`, or did Leadership simply refill to 100 each tick? Same result either way, except for the edge-case tier at exactly 100 [src:survev/server/src/game/objects/player.ts:1534] [L]
