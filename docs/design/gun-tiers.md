# Gun tiers from a full stat comparison

Status: **applied** (2026-10-08). Rebuilds the bot gun tiers of `packages/bots/src/knowledge/gunTiers.ts` from every
gun's final stats, at the owner's request ("총 티어 다시 짜라. 종류, 데미지, DPS, 탄창, 탄 퍼짐 등등 스탯을 다
대조해서"). The owner saw the list; section 7 holds the `ROWS` now in `gunTiers.ts`.

- **Scope.** All 102 guns of the current list: original, survev-only, the owner's beta guns, and since bot round 6 the
  six beta launchers and the three potato guns. The flare guns, bugle and cursed M9 deal no damage and are left out.
- **Baseline.** "Current" means `gunTiers.ts` as of bot round 6 (owner items 42-44), frozen in
  `tools/research/gun-tiers/baseline.json`. Launchers have their own class there, the potato guns score by explosion
  damage, the DMR fit is milder (`DMR_FIT_SLOPE`), and the USAS, SVD, SCAR-SSR and L86 carry the main-map flag. The
  stats are those of commit `edd3d24`, which includes the owner's speed pass and the M202 FLASH rework:
  - the M79, MGL and GL-06 lose their held-speed penalty;
  - the PMG-134 now costs 2 u/s just by being carried;
  - the M202 fires a fixed 52° fan of four 25 + 125 rockets (blast 4-11 u, below the bomb's).
- **Stats.** `@rebirth/defs` `getDefOfType("gun", id)` and its bullet, explosion, projectile and shrapnel defs, with
  the rebirth layer applied. Armour from `helmet01-02` / `chest01-02`, loot from the main map's tables.
- **Files.**
  - [gun-tiers-stats.md](gun-tiers-stats.md): the full stat table, one row per gun.
  - [gun-tiers-stats.csv](gun-tiers-stats.csv): every pulled and derived number.
  - The scripts are in `tools/research/gun-tiers/`, and their outputs go to `research-cache/gun-tiers/` (gitignored):
    - `compute.ts` (pull and derive) with `model.ts` (kill model) and `calc.ts`;
    - `score.ts` (composite, tiers, rulings, pins);
    - `sens.ts` (variants and sensitivity);
    - `report.ts` with `reasons.ts`, `ammo.ts` and `gun-tiers.template.md` (this doc; `--apply` writes the `ROWS`).
  - From the repository root: `node tools/research/gun-tiers/compute.ts && node tools/research/gun-tiers/score.ts &&
    node tools/research/gun-tiers/sens.ts && node tools/research/gun-tiers/report.ts`, about 1.5 minutes.
- **Reused.** `calc.ts` is the timing, falloff, range-jitter and armour part of the session's balance calculator. It
  mirrors `packages/sim` and was checked against the 444 survev TTK fixture cases.

## 1. Result in one table

| tier | guns (best composite first; <sub>old tier</sub> when it moved; \* = ruling or consistency, not the stat tier) |
|---|---|
| **S** | SCAR-SSR <sub>A</sub>, PKP Pecheneg, DP-12 <sub>A</sub>, M1014 <sub>A-</sub>, SPAS-16 <sub>A</sub>, M249\* |
| **S-aim** | Hécate II, AWM-S, AWM-S (winter), M200 Intervention, Barrett M107, Lynx, M1 Garand <sub>A</sub> |
| **A+** | AA-12, AN-94 <sub>A</sub>, Saiga-12 <sub>A</sub>, DShK <sub>S</sub> |
| **A** | Milkor MGL <sub>A-</sub>, L86A2 <sub>B+</sub>, M60, QBB-97 <sub>A+</sub>, FN FAL <sub>B+</sub>, SVD-63, SVD-63 (winter), PMG-134, GL-06 <sub>B-</sub>, SV-98 <sub>A+</sub>, SV-98 (winter) <sub>A+</sub>, Mosin-Nagant\* |
| **A-** | Dual P30L <sub>A</sub>\*, Dual DEagle 50 <sub>B+</sub>\*, SPAS-12 <sub>A</sub>, M16A4, Boys AT Rifle <sub>A</sub>, M4A1-S <sub>A</sub>, CZ-3A1, USAS-12 <sub>A+</sub>, DP-28, SIG SG 550 <sub>B+</sub>, FAMAS, MG 42 <sub>A+</sub>, ASh-12 <sub>A+</sub>, P90, Groza-S |
| **B+** | M39 EMR\*, Mk45G\*, VSS <sub>B</sub>\*, Mk 12 SPR\*, Mk 14 EBR <sub>A</sub>\*, Dual OTs-38 <sub>A-</sub>, MP220 <sub>A-</sub>, Honey Badger <sub>A-</sub>, IMD-2 <sub>A-</sub>, Thompson M1928 <sub>B</sub>, Dual TEC-9 <sub>B-</sub>, SCAR-H <sub>A</sub>, G3, BAR M1918 <sub>A-</sub>, M870 <sub>A-</sub>, AK-74 <sub>B</sub>, Scout Elite <sub>B</sub> |
| **B** | P30L <sub>B+</sub>\*, DEagle 50\*, S&W 500 <sub>B+</sub>\*, AK-47\*, UMP9, AS Val <sub>B+</sub>, Dual M9 <sub>C+</sub>, Spud Gun <sub>A-</sub>, Groza, PP-19 Bizon, G36C, MP5, M416, WA2000 <sub>A+</sub>, M1A1, Dual M93R <sub>C+</sub>, Vector <sub>A-</sub>, M1100 <sub>C</sub>, BLR 81 <sub>A-</sub>, M202 FLASH <sub>B-</sub> |
| **B-** | Model 94 <sub>B</sub>, Dual OT-38, Dual Peacemaker <sub>C+</sub>, TEC-9 <sub>C+</sub>, Vector .45 <sub>B+</sub> |
| **C+** | MAC-10, Dual Škorpion vz. 61 <sub>B-</sub>, RPG-7 <sub>B+</sub>, Panzerfaust, M93R <sub>C</sub>, OTs-38 |
| **C** | Peacemaker, Dual M1911, M79 <sub>B</sub>, Potato Cannon <sub>B</sub>, Škorpion vz. 61 <sub>C+</sub> |
| **D** | M9\*, OT-38, Dual G18C <sub>C</sub>, M1911, G18C |

59 of the 102 tiered guns move, 26 of them by two steps or more (25 up, 34 down). 47 of the 82 main-map guns move.
The Spearman correlation between the current tiers and the new composite is 0.77. Section 6 gives every change with
its reason.

## 2. Method

### 2.1 What is pulled per gun

| group | fields |
|---|---|
| class | `gunClass` (KB grouping), bot class as `kbClass` (assault → rifle; the PMG-134 an LMG) |
| damage | bullet `damage` x `bulletCount`, `headshotMult`, bullet `obstacleDamage`; explosion `damage` and shrapnel count x damage for `onHit` bullets and projectiles |
| rate | `fireDelay`, `fireMode`, `burstCount` / `burstDelay`, `pumpEvery` / `pumpDelay` (DP-12) → RPM |
| magazine | `maxClip` / `extendedClip`, `charges` (single-use guns), `ammoSpawnCount` |
| reload | `reloadTime`, `maxReload` (per-shell when below the magazine), `reloadTimeAlt` / `maxReloadAlt` (empty Mosin) |
| handling | `switchDelay`, `deployGroup`, `speed.equip` / `speed.attack` / `speed.carry` |
| accuracy | `shotSpread`, `moveSpread`, `recoilTime` (first-shot accuracy), `jitter`, `barrelLength`, `barrelOffset` / `dualOffset` |
| bullet | `speed`, `distance` (range), `falloff`; projectiles: `throwPhysics.speed`, flight range, `rad` |
| ammo | `ammo` and its availability on the main map (2.5) |
| duals | the `_dual` defs are separate guns with their own rate, magazine, reload and offset |

### 2.2 Derived numbers

- **Burst DPS.** Shot damage (pellets and explosion included) over the average shot interval: bursts and pumps
  averaged.
- **Sustained DPS.** Magazine damage over (time to empty + full reload). Shell-by-shell reloads are chained; a charge
  gun counts per pickup.
- **Damage per magazine.** Also in the CSV.
- **Perfect TTK.** Every bullet hits; time from the first shot to the kill.
- **Expected TTK.** The kill model below, averaged over the class band, against no armour, level 1 and level 2.
  - Bands (task and critique B): shotguns 5-10 u; SMGs and pistols 5-20; rifles and LMGs 10-35; DMRs and snipers
    20-50; launchers and the potato cannon 15-40 (outside self-damage). Four evenly spaced distances each.
- **Forgiveness F.** Expert band TTK over beginner band TTK at level 1 armour, with the critique's fixed aim error
  (1.6 / 5.4 degrees), the shooter moving half the time, magazines and reloads included. This is the F that
  `skillDemand` reads. The bots' own aim does not improve with slow guns (`test/fixtures/aim-tiers.json`: easy bots hit
  27.9 % with the Mosin and 35.8 % with the AK-47), so F leaves out the deliberate-aim factor below. The CSV also holds
  `Fdel`, the same ratio with that factor. Round 6 halves the skill-fit slope for DMRs (`DMR_FIT_SLOPE` 0.3); snipers
  keep 0.6.
- **Kills per magazine.** Magazine (or charges) over the expected shots per kill at average aim, level 1, home band.
- **Mobility.** Speed held, 12 + carry + equip. Speed firing, (held + attack) x 0.5 (`shotSlowdownTimer` runs for
  `fireDelay` after every shot).

### 2.3 Kill model

`model.ts` computes the exact distribution of the shot on which the target dies, by dynamic programming over the
damage taken. The expected TTK sums that distribution against the gun's real shot times (`calc/lib.ts` `shotTimes`:
bursts, pumps, magazine, reload actions, alt reload, charges) plus the killing bullet's flight time.

- **Hit chance of a pellet.**
  - The shot's angular error is the aim error (normal, sd σ) combined with the dodge error.
    - Dodge error: atan(3.5 / bullet speed), from bots `duel.ts` `DODGE_SPEED`. A target strafing at 3.5 u/s moves
      while the bullet flies, so slow bullets miss more.
  - The pellet adds the gun's uniform spread: `shotSpread`, plus `moveSpread` on the half of the shots fired while
    moving.
  - Pellets after the first also get the start jitter (±`jitter` x 1.11, sim `weapons/gun.ts`).
  - The target (radius 1) is seen from the muzzle: the barrel length, and `dualOffset` for the alternating hands of
    a dual (or `barrelOffset`), shift the window.
  - Pellets of one shell share the aim error.
  - The range jitter share (sim `bullets.ts` distAdj) cuts pellets at the end of their range.
- **Aim error σ.** Expert 1.6°, average 3.5°, beginner 5.4°: the critique's 1.6 / 5.4, with average in between. The
  `skill.ts` `SKILL_SIGMA` band midpoints (s 0.825 / 0.5 / 0.15 → 1.8 / 3.2 / 6.2°) move five guns one step (2.7).
- **Deliberate aim.** A shooter re-aims between shots, so slow guns land more of them. σ x sqrt((0.5 + 0.1) / (0.5 +
  cycle)), clamped to 0.5-1.1:
  - 1.0 at an assault rifle's 0.1 s (`SKILL_SIGMA` was fitted on 0.1-0.2 s guns);
  - 0.94 for the MK12, 0.65 for the M870, 0.55 for the AWM-S, 0.52 for the Mosin;
  - 1.06 for the Vector's 0.038 s.

  This is a modelling assumption: it is what lets a player feel that a bolt-action rewards aim. Without it the
  snipers fall one or two tiers (2.7). F does not use it (2.2).
- **Damage.**
  - Falloff: `damage x lerp(t, 1, falloff)` at the tick the bullet crosses the body.
  - Headshots: 15 % of hits, only when `headshotMult > 1` (sim `rules.ts` `headshotNeedsMultAboveOne`).
  - Armour (sim `combat/damage.ts`):
    - the vest reduces body hits, `d -= d x chest`;
    - the helmet takes x1 on head hits and x0.3 on body hits;
    - level 1 = helmet01 + chest01 (0.25 / 0.25), level 2 = helmet02 + chest02 (0.40 / 0.38).
- **Engagement time.** For kill rates only (2.6), 0.25 / 0.35 / 0.45 s (expert / average / beginner) are added before
  the first shot. These are the `bot-population.md` reaction floors plus about 0.08 s on target. TTK starts at the first
  shot, so without them a one-shot kill reads 0.03 s and its kill rate explodes.

### 2.4 Special mechanics

| mechanic | guns | how it is modelled |
|---|---|---|
| explosive rounds | RPG-7, Panzerfaust, M202 (and the two below) | a direct hit adds the full explosion: the target touches the rad.min circle (sim `combat/explosions.ts`). It also adds Binomial(n, p) shrapnel. p averages the contact geometry: the bullet stops on the body and explodes 0.1 behind. A miss flies on to its range (120 / 40 / 75 u), so it splashes nothing. Inside the bullet's `armDistance` a hit is a dud. |
| cursor bursts | USAS-12, GL-06 | `toMouseHit`: the round stops at the cursor and explodes there (sim `bullets.ts` explodes at the end of the range). With the cursor on the target, a miss bursts at the target's range, off by the aim and spread error. The splash follows the sim's "step" falloff: full while the body touches the rad.min circle (centre within 4.5 / 5 u), then linear to 0 at rad.max. Shrapnel from there; damages in 0.5 HP steps, rounded down. |
| projectiles | M79, MGL, potato cannon / SMG, PMG-134 | hit radius 1 + rad / 4 (sim `projectiles.ts`); projectile speed and flight range (fuse or landing); damage = explosion only, so the PMG-134 and the potato guns score by their explosion damage (8.5 x 2 per PMG-134 shot) |
| fixed fan | M202 | 4 rockets in a fixed 52° fan, no random spread or jitter (sim `gun.ts` `fanDeviation`). The shooter aims the rocket line nearest the centre (8.7° off the aim) at the target, so one rocket hits (two inside about 3 u); the others fly on. The 2 u recoil slide is not modelled. |
| single use | Boys (7 charges), Panzerfaust (1), M202 (1 fan of 4) | no shots past the charges. If the charges do not kill (1 − P), the fight goes on with a typical backup gun, the AK-47: TTK = P · E[t \| kill] + (1 − P) · (last charge + 0.75 s switch + AK-47 TTK). Sustain uses expected kills per pickup. |
| pump | DP-12 | 2 shots 0.2 s apart, then 0.7 s; reload 2 shells per 1.2 s |
| burst | FAMAS, M16A4, M93R, UMP9, AN-94 | shot times inside and between bursts; aim error per shot |
| slugs | M1014, AA-12 | single 77 / 64 damage pellet, slug range (60 u) |
| first-shot accuracy | Garand, M1014, Mk45G, Colt 45, DEagle (and the two duals), ASh-12 | the better of spamming and pacing at `recoilTime` (no spread at all when paced) |
| shell reloads | M870, SPAS-12, M1100, M1014, Model 94, Mosin, MGL | chained reload actions; the empty Mosin loads 5 in 3 s |

### 2.5 Ammo

| ammo | tier_ammo (box) | tier_ammo_crate | rounds per floor gun roll | bag (no pack) |
|---|---|---|---|---|
| 9mm | 25 % x 60 | 19 % x 60 | 41.48 | 120 |
| 762mm | 25 % x 60 | 19 % x 60 | 5.87 | 90 |
| 556mm | 25 % x 60 | 19 % x 60 | 7.71 | 90 |
| 12gauge | 25 % x 10 | 19 % x 10 | 2.06 | 15 |
| 45acp | - | - | 0.00 | 90 |
| 50AE | - | 6 % x 21 | 0.03 | 50 |
| 308sub | - | 6 % x 5 | 0.00 | 20 |
| 57mm | - | 3 % x 50 | 0.03 | 100 |
| 40mm | - | - | 0.00 | 10 |
| rocket | - | - | 0.00 | 4 |

Factor: 1 for ammo with a `tier_ammo` box row, 0.85 for ammo without one, 0.7 for rockets (only the 4 that come with
the RPG-7). Charge guns have no ammo to find: 1, with the per-pickup limit in sustain.

### 2.6 Composite score and tiers

Every component is a log2 ratio against the median tiered gun at the same distance and skill, clamped to ±3. The
composite is their weighted sum, so it is the log2 of a weighted geometric mean of "how many times better than the
median gun". Weights: role 0.32, range 0.14, damage/shot 0.08, sustain 0.18, handling 0.18, ammo 0.1.

| component | what it measures | why this weight |
|---|---|---|
| role | kill rate (1 / (engagement + E[TTK]), mixed over armour 25 % none / 45 % level 1 / 30 % level 2) at the class band | the main reason to want a gun: does it win fights where it is used |
| range | the same kill rate over 5 / 10 / 20 / 35 / 50 / 80 u, weighted 0.12 / 0.20 / 0.25 / 0.20 / 0.13 / 0.10 | two gun slots cover each other, so versatility counts less than role. The 1x view's half-height is 28 u and 4x's is 48 u (`items/gear.md`), so most fights sit inside 35 u. |
| damage per shot | expected damage of the opening shot (standing, first-shot accuracy, level 1) at the class band | the owner's first stat. It covers what a duel TTK misses: poke damage, finishing, quickswitch openers. |
| sustain | half kills per magazine, half sustained DPS | squads and third parties; reloading mid-fight |
| handling | log2(held / 12) + 0.5 x log2(firing / 6) − 0.5 per second of switch delay above 0.75 | rotation, dodging, swapping (the DShK loses 1.33, the M249 0.29) |
| ammo | 2 x log2(factor) | keeping the gun fed |

- **Skill blend.** Role, range and damage per shot use expert and average aim, half each. Wanting a gun follows what a
  decent player gets from it, and people overrate their aim. Beginners only enter F.
- **Thresholds.** The new list keeps the current list's shape. With the 102 tiered guns sorted by composite, each cut
  sits where the current list has as many guns at or above that tier. S and S-aim count together as the top band, and
  every cut is the midpoint between the last gun in and the first gun out. Cuts: S ≥ 0.383, A+ ≥ 0.321, A ≥ 0.132, A- ≥ 0.005, B+ ≥ -0.080, B ≥ -0.246, B- ≥ -0.305, C+ ≥ -0.446, C ≥ -0.671, D below (S-aim: an aim gun, F ≤ 0.35, whose blended or expert-only composite reaches the S cut).
- **S-aim.** A top-band gun that needs aim, F ≤ 0.35 (skill demand ≥ 0.8). S stays for top guns that do not.
- **Rulings** (kept even where the stats differ; section 5):
  - M249 and PKP S (S-rule); Mosin A; MK12 and M39 B+;
  - "pistols are low": single pistols at most B, duals at most A-. The current list's highest pistol is the dual P30L
    at A.
- **Behaviour pins** (coordinator, after the owner saw the list): the AK-47 stays B and the M9 D against their stats
  (B+, C+). At B+ the AK breaks owner item 43: an average bot with an SMG and an AK must take an MK12 for the AK. At C+
  the M9 stops a bot from swapping it for an AK lying without ammo. Unlike a ruling, a pin sets no scale for its
  class.
- **Consistency with the rulings.**
  - (a) A gun that stat-dominates a ruled gun of its class is never tiered below it, and one the ruled gun dominates
    never above it. Dominance means at least as good on shot damage, damage, cycle, magazine, reload per round,
    both spreads, bullet speed, range, falloff, headshot multiplier, both speeds, switch delay and ammo. Only the
    SV-98 / Mosin pair exists; the SV-98 is A by stats anyway.
  - (b) A ruling that demotes a gun sets the owner's scale for its class. Guns of the class that score no better than
    the ruled gun are not tiered above its ruling: this caps the VSS, Mk45G and Mk 14 at B+.
  - A promoting ruling (the Mosin) speaks for that gun only. Applying the scale rule to it would lift every sniper
    with a higher composite (Scout Elite, WA2000, BLR, Model 94) to A.
- **Dominance check.** Across all classes, seven stat-dominance pairs exist. After the rulings none is inverted: the
  SV-98 and the Mosin share A.

### 2.7 Validation and sensitivity

- **F against the critique.** For the 94 guns tiered before round 6, the new F values correlate 0.89 with the current
  ones and run 0.07 higher on average (0.536 against 0.469). Across all 102 (the round 6 launchers and potato guns are
  estimates at 0.55-0.6) the correlation is 0.86. The gaps have three causes, all on the side of the sim:
  - the target is measured from the muzzle, not the player's centre (most shotguns: F 0.83-0.92 against 0.6-0.75);
  - the uniform spread is exact instead of a normal approximation;
  - the dodge term raises the error floor of both skills alike (one-shot snipers: 0.23-0.29 against 0.13-0.16).
- **Sensitivity** (tier changes among the 102, from `sens.ts`):

- no deliberate aim (critique's fixed sigma): 34 change 1+ step, 10 change 2+ steps: `m249` A+ → S, `scout_elite` B+ → B-, `blr` B → C+, `sv98` A → B, `barrett` S-aim → A, `sv98_winter` A → B, `wa2000` B → C+, `m200` S-aim → A, `lynx` S-aim → A-, `boys` A- → B
- SKILL_SIGMA band midpoints 1.8 / 3.2 / 6.2: 5 change 1+ step, 0 change 2+ steps
- role 0.26 / range 0.20: 15 change 1+ step, 2 change 2+ steps: `m1100` B → C+, `spas16` S → A+
- no damage-per-shot term (alpha 0, role 0.40): 57 change 1+ step, 18 change 2+ steps: `mac10` C+ → B, `m249` A+ → S, `an94` A+ → S, `blr` B → C+, `sv98` A → B+, `garand` S-aim → A, `m1014` S → A+, `p30l_dual` A → S, `spas16` S → A+, `barrett` S-aim → A, `sw500` A- → B, `sv98_winter` A → B+, `wa2000` B → C+, `vz61_dual` C+ → B, `gl06` A → B+, `m202` B → C+, `lynx` S-aim → A, `boys` A- → B
- sustain 0.12, role 0.38: 11 change 1+ step, 1 change 2+ steps: `spas16` S → A+
- handling 0.10, role 0.40: 12 change 1+ step, 2 change 2+ steps: `spas16` S → A+, `dshk` A+ → S

The model is stable in σ. Damage per shot is the term that decides most: it separates the alpha guns (snipers,
shotguns, DMRs, heavy pistols) from the bullet hoses. The closest calls are the Garand's S-aim (0.0005 over the cut),
the M202's B (0.001 over) and the Model 94's B- (0.001 under), and the SPAS-16's S.

## 3. Tier list

| tier | guns |
|---|---|
| S (S-rule) | M249, PKP |
| S | SCAR-SSR, DP-12, M1014, SPAS-16 |
| S-aim | Hécate II, AWM-S (+ winter), M200, Barrett, Lynx, M1 Garand (by 0.0005 on its expert composite) |

The full grouped list is table 1. Every gun's numbers are in [gun-tiers-stats.md](gun-tiers-stats.md).

**Launchers against a stationary target.** The composite scores every gun against a target strafing at 3.5 u/s. That
target steps out of slow rounds: Panzerfaust 35 u/s, M79 40, M202 55, RPG-7 85. Bots fire launchers at groups,
campers and busy targets (`brain/launch.ts`), which hold still. The same composite with no dodge (`DODGE=0`, every
gun rescored on its own cuts) gives the right-hand columns:

| gun | strafing target: stat tier (composite) | TTK avg A1 | stationary target: stat tier (composite) | TTK avg A1 | current | proposed |
|---|---|---|---|---|---|---|
| Milkor MGL (`mgl`) | A (0.29) | 2.20 | S (0.58) | 1.21 | A- | A |
| GL-06 (`gl06`) | A (0.18) | 2.14 | A (0.17) | 1.74 | B- | A |
| M202 FLASH (`m202`) | B (-0.24) | 3.02 (kill per pickup 43 %) | A (0.11) | 1.89 (kill per pickup 66 %) | B- | B |
| RPG-7 (`rpg7`) | C+ (-0.35) | 5.25 | B (-0.07) | 3.75 | B+ | C+ |
| Panzerfaust (`panzerfaust`) | C+ (-0.36) | 3.64 (kill per pickup 32 %) | A- (0.06) | 2.39 (kill per pickup 59 %) | C+ | C+ |
| M79 (`m79`) | C (-0.53) | 5.58 | B (-0.15) | 3.10 | B | C |
| Potato Cannon (`potato_cannon`) | C (-0.59) | 5.31 | C (-0.41) | 3.55 | B | C |
| USAS-12 (`usas`) | A- (0.05) | 0.88 | A- (0.03) | 0.88 | A+ | A- |

The proposal uses the strafing column, like every other gun. If the owner wants launchers valued for the shot they are
used for, take the stationary column for them: MGL S, M202 A, Panzerfaust A-, RPG-7 / M79 B.

## 4. Reading the big moves

- **Shotguns rise.**
  - At 5-10 u they kill level 1 in under half a second at average aim: DP-12 0.36 s, SPAS-16 0.39, M1014 0.43,
    Saiga 0.47. That is the strongest role score of any class but the one-shot snipers.
  - Their range term costs them only a seventh of the weight. The M870 and MP220 fall: the pump (0.9 s) and the
    two-shell load cost them against the automatics.
- **Bolt actions without a one-shot fall.** 72 damage (Mosin, WA2000) misses the 2-hit kill through level 1 by
  0.05 HP, so both need 3 hits. The SV-98's 80 damage makes it 2. The BLR has 3 rounds.
- **The DShK leaves S.** It kills fastest of the LMGs, but at 9 u/s held and 2 u/s firing its composite equals the
  M249's (0.32 / 0.34).
- **Launchers split.** The round bursts at the cursor for the GL-06 (B- → A) and the USAS, so their near misses still
  splash. The MGL's six grenades 0.7 s apart keep it on top (A). Single-shot, slow rounds that fly past a strafing
  target sink: M79 B → C, RPG-7 B+ → C+, Potato Cannon B → C. The single-use M202 (its fan lands one rocket, 150 on a
  direct hit) rises to B, 0.001 over the cut; the Panzerfaust stays C+. Section 3 shows them against a stationary
  target.
- **DMRs cluster.** All 11 score 0.13-0.33, except the SSR at 0.67: the Garand leads, and the MK12 and M39 sit near
  the bottom, as the owner says. The cut between A and B+ runs through the middle of the cluster, so the MK12 / M39
  ruling also takes the three DMRs that score no better.
- **Assault rifles are flat** (−0.18 to 0.09, AN-94 0.35 apart). Small stat edges move them one step: the SCAR-H's
  20-round magazine, the SIG 550's 1.5° spread.
- **SMGs.** The Vector's 46 u range and 7.5 damage drop it to B. The Vector (.45) falls to C+.
- **Pistols.** By stats the dual DEagle and dual P30L are A (TTK under 0.9 s at 5-20 u), the single P30L and DEagle A
  / A-. The dual M9 and M93R reach the MP5's level. The ruling caps them (section 5).

## 5. Conflicts with the owner's rulings

| gun | ruling / pin | stat tier | composite | what the numbers say |
|---|---|---|---|---|
| VSS (`vss`) | B+ | A | 0.15 | consistency with the MK12 / M39 ruling: 0.15 is below the M39's 0.17 (stats A) |
| Mk 12 SPR (`mk12`) | B+ | A | 0.14 | the stats agree it is a low DMR (0.14: second lowest of 11; Garand 0.33, L86 0.27, FAL / SVD 0.20) but every DMR but the Mk 14 clears the A cut (0.132): TTK 3.82 s at 20-50 u against 3.75 for the M39 and 3.28 for the Garand |
| M249 (`m249`) | S | A+ | 0.34 | kills as fast as the PKP (TTK 1.55 vs 1.54 s at 10-35 u; expert 1.17 vs 1.19) but its 100-round box gives 5.4 kills per magazine against 13.4 (sustained DPS 95 vs 144) and it deals 14 damage per shot to the PKP's 18; composite 0.34 against the PKP's 0.50 and the S cut 0.383. Without the damage-per-shot term it is S by stats |
| AK-47 (`ak47`) | B | B+ | -0.06 | B+ by 0.02 over the cut (TTK 2.54 s at 10-35 u, level with the AK-74); pinned at B so owner item 43 holds: an average bot with an MP5 and an AK takes an MK12 for the AK only while the gain clears the upgrade threshold of 10 (about 69 - 55 = 14 at B, 7 at B+) |
| Mk45G (`mkg45`) | B+ | A | 0.16 | consistency with the MK12 / M39 ruling: 0.16 is below the M39's 0.17 (stats A) |
| Mosin-Nagant (`mosin`) | A | C+ | -0.32 | the lowest sniper: 72 damage misses the 2-hit kill through level 1 by 0.05 HP (49.95 per hit), so level 1 and 2 take 3 body hits 1.75 s apart (perfect 3.0 / 3.5 s); TTK 7.8 s at 20-50 u (expert 5.4) against 4.1 for the SV-98 and 1.8 for the AWM-S; 5 rounds, 1 kill per magazine. The model has no term for quickswitch combos or the one-clean-shot appeal |
| M39 EMR (`m39`) | B+ | A | 0.17 | a low DMR by the stats too (0.17; TTK 3.75 s at 20-50 u, 28 damage, 6 hits through level 1) but above the A cut (0.132) |
| M9 (`m9`) | D | C+ | -0.42 | C+ (TTK 2.26 s at 5-20 u); pinned at D so a bot holding an M9 and an MP5 still swaps the M9 for an AK lying without ammo (desire x 0.6): at C+ the gain falls under the upgrade threshold. The Peacemaker, dual M1911 and vz. 61 score lower and stay C |
| P30L (`p30l`) | B | A | 0.13 | composite 0.13 out-scores every SMG (CZ-3A1 0.07): 21 damage, 2 / 1° spread, +1 u/s held, TTK 1.19 s at 5-20 u (MP5 1.51) |
| Dual P30L (`p30l_dual`) | A- | A | 0.32 | TTK 0.88 s at 5-20 u, 3.1 kills per 30-round magazine; composite 0.32, level with the M249 |
| DEagle 50 (`deagle`) | B | A- | 0.06 | 35 damage (5 hits through level 1) with first-shot accuracy after 0.5 s: TTK 1.32 s at 5-20 u |
| Dual DEagle 50 (`deagle_dual`) | A- | A | 0.28 | TTK 0.84 s at 5-20 u, 2.1 kills per magazine; composite 0.28 |
| S&W 500 (`sw500`) | B | A- | 0.02 | 64 damage (3 hits through level 1), 150 u/s bullets: TTK 1.48 s at 5-20 u |
| Mk 14 EBR (`mk14`) | B+ | A- | 0.13 | consistency with the MK12 / M39 ruling: 0.13 is below the MK12's 0.14 (stats A-) |

Kept as ruled or pinned. Where a ruling is far from the stats (the Mosin: C+ by stats, A by ruling), the bots value
the gun above what it does for them in a fight. The M249 sits one step under its ruling only because of the
damage-per-shot term.

## 6. Changes against the current `gunTiers.ts`

Sorted by size of the move. The reason quotes TTK at average aim, level 1, over the class band unless it says
otherwise. The composite is the stat score: S cut 0.383, A+ 0.321, A 0.132.

| gun | old | new | steps | composite | reason |
|---|---|---|---|---|---|
| M1014 (`m1014`) (off-map) | A- | S | +4 | 0.44 | 77-damage slugs kill level 1 in 2 hits 0.4 s apart and reach 60 u: TTK 0.43 s at 5-10 u; with the AA-12 the only shotguns that still score at 20-35 u; 8 shells, 4 kills each |
| GL-06 (`gl06`) | B- | A | +4 | 0.18 | the round bursts at the cursor, so a near miss within 5 u of the centre still takes the full 100 blast (rad.min 4) plus shrapnel: level 1 dies to one burst about 3 times in 4 (perfect 0.62 s), TTK 2.14 s at 15-40 u; one round per 2.3 s and 40 mm ammo keep sustain low |
| WA2000 (`wa2000`) | A+ | B | -4 | -0.18 | 72 damage misses the 2-hit kill through level 1 by 0.05 HP (72 x 0.75 x 0.925 = 49.95): 3 hits 1.1 s apart, perfect 1.9 s, TTK 6.2 s at 20-50 u; 5 rounds of scarce .50 AE, 11.5 / 4.75 u/s |
| SCAR-SSR (`scarssr`) | A | S | +3 | 0.68 | 81 damage every 0.3 s: 2 hits kill level 1 (perfect 0.3 s), 3 kill level 2; TTK 1.9 s at 20-50 u (expert 1.3) is the best non-sniper long-range figure; the top composite outside the snipers |
| SPAS-16 (`spas16`) | A | S | +3 | 0.39 | a full-auto SPAS-12: 8.75 x 9 every 0.35 s with 5.5° spread and 45 u range; TTK 0.39 s at 5-10 u and still useful at 20 u (borderline S: A+ under four of the six sensitivity variants) |
| DP-12 (`dp12`) | A | S | +3 | 0.49 | two 12.5 x 9 shells 0.2 s apart before the pump: level 1 dies in 0.2 s (perfect), TTK 0.36 s at 5-10 u, the fastest close kill at average aim; 14 shells = 6.5 kills per load |
| M1100 (`m1100`) | C | B | +3 | -0.23 | the critique's 3.98 s at 10 u does not reproduce: pellets start at the muzzle (barrel 3.15 u), so about 10 of the 18 land at 10 u (34 damage a shell) and 16 at 5 u: TTK 0.87 s at 5-10 u; nothing past 20 u (range 25) |
| RPG-7 (`rpg7`) | B+ | C+ | -3 | -0.35 | one-hit kill on any armour, but one 85 u/s rocket per 3.8 s, only the 4 that come with it, and a miss flies on to 120 u: TTK 5.3 s at 15-40 u against a strafing target; B against a stationary one |
| Potato Cannon (`potato_cannon`) (off-map) | B | C | -3 | -0.59 | a 95-damage blast every 1.2 s from a 65 u/s lob: 2 hits even on bare players, TTK 5.3 s at 15-40 u, and 9 u/s held |
| M79 (`m79`) | B | C | -3 | -0.53 | one 125-damage grenade per 2.6 s, lobbed at 40 u/s: a direct hit kills level 1, but a strafing target mostly steps out of the lob (a miss flies on to 52 u): TTK 5.6 s at 15-40 u; B against a stationary target |
| M1 Garand (`garand`) | A | S-aim | +2 | 0.33 | 44 damage at 0.23 s with first-shot accuracy: 4 hits through level 1, TTK 3.28 s at 20-50 u (expert 1.81), the best DMR after the SSR. Blended it is A+ (0.33); its expert composite clears the S cut by 0.0005 (0.384 against 0.383) and F 0.32 makes it an aim gun: S-aim, the closest call of the list |
| DShK (`dshk`) | S | A+ | -2 | 0.32 | kills fastest of the LMGs (TTK 1.18 s at 10-35 u, 34 damage) but is the heaviest gun: 9 u/s held, 2 u/s firing, switch 1 s, a 7.5 s reload for 30 rounds; composite level with the M249 (0.32 / 0.34), so not S |
| L86A2 (`l86`) | B+ | A | +2 | 0.28 | an MK12 with 25 damage and a 30-round magazine: TTK 3.17 s at 20-50 u (MK12 3.82), 1.9 kills per magazine |
| FN FAL (`fal`) | B+ | A | +2 | 0.21 | 26 damage at 0.18 s: 4 hits on bare players, TTK 3.54 s at 20-50 u, ahead of the MK12 / M39 in role and range |
| USAS-12 (`usas`) | A+ | A- | -2 | 0.05 | frag rounds burst at the cursor, so nearly every round lands its 42 blast (full inside 4.5 u of the centre) plus shrapnel: about 48 damage a round through level 1, TTK 0.88 s at 5-10 u; but the 24 u range and 0.5 s cycle: nothing past 25 u |
| ASh-12 (`ash12`) (off-map) | A+ | A- | -2 | 0.02 | 31 damage at 0.1 s is a level 1 kill in 0.35 s (perfect), but 3.5° spread, a 70 u range, a 10-round magazine and scarce .50 AE: TTK 2.25 s at 10-35 u |
| MG 42 (`mg42`) | A+ | A- | -2 | 0.02 | 11 damage (14 hits through level 1) and a 50-round drum; 3.25 u/s while firing; TTK 1.84 s at 10-35 u against the M249's 1.55 |
| SCAR-H (`scar`) | A | B+ | -2 | -0.02 | the 20-round magazine (1.1 kills per magazine, sustained DPS 67) and 2 / 5° spread: TTK 2.57 s at 10-35 u against the M4A1's 2.08; 0.02 below the A- cut |
| Mk 14 EBR (`mk14`) | A | B+ | -2 | 0.13 | scores 0.13, below the M39 (0.17) the owner rules B+: 25 damage and 7° moving spread give TTK 3.73 s at 20-50 u, level with the MK12 *(consistency)* |
| Dual TEC-9 (`tec9_dual`) | B- | B+ | +2 | -0.02 | a 64-round magazine at 0.07 s: TTK 1.34 s at 5-20 u and 3.4 kills per magazine, SMG-like |
| Vector (`vector`) | A- | B | -2 | -0.21 | 7.5 damage (20 hits through level 1) and a 46 u range with 0.6 falloff: high burst DPS (197) but TTK 1.37 s at 5-20 u, little past 25 u |
| BLR 81 (`blr`) (off-map) | A- | B | -2 | -0.24 | 3-round magazine (0.5 kills per magazine) and 56 damage (3 hits through level 1, 1.38 s perfect): TTK 6.1 s at 20-50 u |
| Dual M9 (`m9_dual`) | C+ | B | +2 | -0.12 | 13 damage every 0.08 s from 30 rounds: TTK 1.38 s at 5-20 u, level with the MP5 (1.51) and UMP9 |
| Dual M93R (`m93r_dual`) | C+ | B | +2 | -0.21 | two 3-round bursts at 0.18 s: TTK 1.60 s at 5-20 u, 2.2 kills per magazine; the same level as the MP5 |
| Spud Gun (`potato_smg`) (off-map) | A- | B | -2 | -0.14 | 13-damage blasts every 0.09 s from 30 rounds: TTK 1.42 s at 5-20 u, MP5 level (1.51); the growing target (report 42) and splash on cover are not modelled |
| Vector .45 (`vector45`) (off-map) | B+ | B- | -2 | -0.29 | 9.5 damage, 4.5 / 6.5° spread and a 45 u range: TTK 1.48 s at 5-20 u and almost nothing past 30 u; the 9 mm Vector is ahead on every term but damage |
| AN-94 (`an94`) (off-map) | A | A+ | +1 | 0.35 | two-round bursts of 20 damage from a 45-round magazine: TTK 1.70 s at 10-35 u and 3.4 kills per magazine, the best assault rifle |
| Saiga-12 (`saiga`) | A | A+ | +1 | 0.35 | kills level 1 in 0.4 s (two shells) with TTK 0.47 s at 5-10 u, but nothing past 20 u; the slug and SPAS shotguns reach further |
| QBB-97 (`qbb97`) | A+ | A | -1 | 0.21 | the M249's damage at 0.1 s from 75 rounds: TTK 1.92 s at 10-35 u against 1.55, 4 kills per magazine |
| SV-98 (`sv98`) | A+ | A | -1 | 0.13 | 80 damage, 2 hits through level 1 (perfect 1.5 s); TTK 4.1 s at 20-50 u against 1.8 s for the AWM-S; never below the Mosin (it beats it on every stat) |
| SV-98 (winter) (`sv98_winter`) (off-map) | A+ | A | -1 | 0.13 | as the SV-98 (same stats) |
| Milkor MGL (`mgl`) | A- | A | +1 | 0.29 | six 125-damage grenades 0.7 s apart, a direct hit kills level 1, and no speed penalty since the owner's speed pass: TTK 2.2 s at 15-40 u, 2.1 kills per load; S against a stationary target |
| M4A1-S (`m4a1`) | A | A- | -1 | 0.09 | the fastest automatic assault rifle (TTK 2.08 s at 10-35 u; M16A4 2.21) but 14 damage per shot and a 3.1 s reload keep it at A- |
| SPAS-12 (`spas12`) | A | A- | -1 | 0.10 | 8.75 x 9 with tight 4° spread and 45 u range, but the 0.75 s pump: TTK 0.82 s at 5-10 u against 0.39 for the SPAS-16 |
| Dual P30L (`p30l_dual`) | A | A- | -1 | 0.32 | stats A (0.32, level with the M249): TTK 0.88 s at 5-20 u, 3.1 kills per magazine; capped at A- (pistols are low) *(ruling "pistols are low")* |
| Dual DEagle 50 (`deagle_dual`) | B+ | A- | +1 | 0.28 | stats A (0.28): 35 damage at 0.12 s, TTK 0.84 s at 5-20 u; capped at A- (pistols are low) *(ruling "pistols are low")* |
| SIG SG 550 (`sig550`) | B+ | A- | +1 | 0.04 | 13 damage at 0.086 s with 1.5° standing spread: TTK 2.22 s at 10-35 u, close to the M4A1 |
| Boys AT Rifle (`boys`) | A | A- | -1 | 0.09 | 96 damage, 2 hits through level 2, but 7 charges and 10.5 / 3.75 u/s held / firing: TTK 4.75 s at 20-50 u, 1.9 kills per pickup |
| VSS (`vss`) | B | B+ | +1 | 0.15 | scores 0.15, below the M39 (0.17, ruled B+): 24 damage, 125 u range, TTK 3.74 s at 20-50 u *(consistency)* |
| Scout Elite (`scout_elite`) | B | B+ | +1 | -0.08 | 56 damage every 1 s (3 hits through level 1) and +5 u/s while firing: TTK 5.6 s at 20-50 u; the best plain bolt action after the SV-98 |
| BAR M1918 (`bar`) | A- | B+ | -1 | -0.02 | 17.5 damage but a 20-round magazine (1.3 kills each): TTK 2.60 s at 10-35 u, an assault rifle in LMG weight |
| M870 (`m870`) | A- | B+ | -1 | -0.06 | a bare player dies to one shell, armour takes two 0.9 s apart: TTK 1.04 s at 5-10 u against 0.47 for the Saiga; 27 u range |
| MP220 (`mp220`) | A- | B+ | -1 | -0.00 | two shells in 0.2 s kill level 1 (perfect 0.2 s), then a 2.7 s reload: 0.9 kills per load and nothing past 20 u |
| Dual OTs-38 (`ots38_dual`) | A- | B+ | -1 | 0.00 | 32 damage but only 10 rounds and a 3.8 s reload: sustained DPS 57, TTK 1.31 s at 5-20 u |
| IMD-2 (`imbel`) (off-map) | A- | B+ | -1 | -0.01 | 12 damage at 0.092 s from 40 rounds, 92 u/s bullets: TTK 2.27 s at 10-35 u, an assault rifle in LMG weight |
| AK-74 (`ak74`) | B | B+ | +1 | -0.06 | TTK 2.50 s at 10-35 u with 2° standing spread; the AK-47 scores the same but is pinned at B (section 5) |
| Honey Badger (`honeybadger`) | A- | B+ | -1 | -0.00 | 13 damage at 0.08 s with a 120 u range and 0.75 falloff: TTK 2.37 s at 10-35 u, between the AK and the M4A1 |
| Thompson M1928 (`m1928`) (off-map) | B | B+ | +1 | -0.01 | a 50-round drum (3.5 kills per magazine): TTK 1.26 s at 5-20 u, ahead of the UMP9 and MP5 |
| P30L (`p30l`) | B+ | B | -1 | 0.13 | stats A (0.13): 21 damage, 2 / 1° spread, +1 u/s: TTK 1.19 s at 5-20 u, it out-scores every SMG (CZ-3A1 0.07); capped at B (pistols are low) *(ruling "pistols are low")* |
| S&W 500 (`sw500`) (off-map) | B+ | B | -1 | 0.02 | stats A- (0.02): 64 damage, 3 hits through level 1, TTK 1.48 s at 5-20 u; capped at B (pistols are low) *(ruling "pistols are low")* |
| AS Val (`asval`) | B+ | B | -1 | -0.10 | 13.5 damage at 0.08 s but 20 rounds, 90 u range and 0.65 falloff: TTK 1.38 s at 5-20 u, behind the P90 and Scorpion |
| M202 FLASH (`m202`) | B- | B | +1 | -0.24 | the owner's rework: four 25 + 125 rockets in a fixed 52° fan, one of them on target; a direct hit (150) kills level 1 but not level 2, so a pickup kills 43 % of the time at average aim over 15-40 u (66 % against a stationary target) before the backup gun takes over; B by 0.001 over the cut |
| Model 94 (`model94`) (off-map) | B | B- | -1 | -0.25 | 44 damage needs 4 hits through level 1 at 0.7 s: TTK 5.8 s at 20-50 u, 1 kill per 8-round tube |
| Dual Peacemaker (`colt45_dual`) | C+ | B- | +1 | -0.28 | 29 damage from two 6-round revolvers with first-shot accuracy: TTK 2.06 s at 5-20 u |
| TEC-9 (`tec9`) | C+ | B- | +1 | -0.28 | 12 damage at 0.11 s from 32 rounds: TTK 1.82 s at 5-20 u, 2 kills per magazine |
| M93R (`m93r`) | C | C+ | +1 | -0.36 | 3-round bursts of 12: TTK 2.05 s at 5-20 u, ahead of the M9 and vz. 61 |
| Dual Škorpion vz. 61 (`vz61_dual`) | B- | C+ | -1 | -0.34 | 9 damage from 40 rounds with 9 / 8° spread: TTK 1.80 s at 5-20 u, little past 30 u |
| Škorpion vz. 61 (`vz61`) | C+ | C | -1 | -0.65 | 9 damage, 6 / 5° spread, 55 u range: TTK 2.72 s at 5-20 u |
| Dual G18C (`glock_dual`) | C | D | -1 | -0.82 | 9 damage with 18 / 16° spread and a 44 u range: TTK 3.85 s at 5-20 u, the third lowest composite (G18C, M1911 below) |

## 7. `ROWS` (applied)

Written into `gunTiers.ts` by `report.ts --apply`. It keeps the round 6 format, order and line layout, and the
`mainMap` flags unchanged. F is the new forgiveness (2.2). Every value is now measured, so the "est." markers are gone;
the two round 6 loot notes behind the main-map flags stay word for word.

```ts
// biome-ignore format: a few guns per line keep the table readable
const ROWS: readonly Row[] = [
    // tiers and F: docs/design/gun-tiers.md (a stat composite over class-band TTK, range, damage per shot, sustain,
    // handling and ammo; F = expert / beginner band TTK at level 1 armour, aim error 1.6 / 5.4 degrees). Owner rulings
    // kept where the stats differ: M249 S (stats A+), Mosin A (C+), MK12 and M39 B+ (A), pistols low.
    // LMGs: the M249 and the PKP on top (S-rule); the DShK scores with the M249 but is the heaviest gun (9 / 2 u/s)
    ["m249", "S", 0.57, true], ["pkp", "S", 0.6, true], ["qbb97", "A", 0.56, true], ["dp28", "A-", 0.6, true],
    ["bar", "B+", 0.44, true], // survev's main tables drop it (tier_guns, tier_chest, tier_lmgs, air drops)
    // snipers: the AWM-S, Hecate, M200 and Lynx one-shot level 1 and the Barrett two-hits any armour (S-aim). The
    // Mosin is A by ruling (3 hits through level 1); the SV-98 beats it on every stat, so never below it
    ["awc", "S-aim", 0.26, true], ["sv98", "A", 0.32, true], ["mosin", "A", 0.33, true], ["scout_elite", "B+", 0.31, true],
    ["blr", "B", 0.36, false], ["model94", "B-", 0.33, false],
    // DMRs: the MK12 and the M39 are B+ by ruling; the VSS, Mk45G and Mk 14 score no better than the M39, so B+ too;
    // the Garand's expert composite just reaches the top band (S-aim)
    ["mk12", "B+", 0.36, true], ["m39", "B+", 0.39, true], ["garand", "S-aim", 0.32, true], ["vss", "B+", 0.4, true],
    // (round 6 loot handoff: the SVD and the SCAR-SSR reach the classic map in the gold drop, the L86 in tier 1 air drops)
    ["svd", "A", 0.36, true], ["scarssr", "S", 0.41, true], ["l86", "A", 0.4, true], ["mkg45", "B+", 0.37, false],
    // assault rifles: the AN-94 leads; the SCAR-H's 20-round magazine drops it to B+; the AK-47 is pinned at B (item 43)
    ["scar", "B+", 0.4, true], ["m4a1", "A-", 0.42, true], ["famas", "A-", 0.44, true], ["grozas", "A-", 0.46, true],
    ["ak47", "B", 0.48, true], ["hk416", "B", 0.51, true], ["groza", "B", 0.51, true],
    ["an94", "A+", 0.53, false],
    // shotguns: the fastest kills at 5-10 u (two shells in 0.2-0.4 s); the slugs and the SPAS guns reach 20-35 u; the
    // M870's 0.9 s pump and the MP220's two shells cost them
    ["saiga", "A+", 0.91, true], ["spas12", "A-", 0.83, true], ["m870", "B+", 0.88, true], ["mp220", "B+", 0.58, true],
    ["m1100", "B", 0.87, true],
    // (round 6 loot handoff: the USAS-12 on the classic map at a very low rate)
    ["usas", "A-", 0.99, true], ["m1014", "S", 0.9, false],
    // SMGs: the Vector's 46 u range and 7.5 damage drop it to B
    ["vector", "B", 0.5, true], ["scorpion", "A-", 0.63, true], ["ump9", "B", 0.65, true], ["mp5", "B", 0.63, true],
    ["mac10", "C+", 0.72, true],
    ["vector45", "B-", 0.57, false], ["m1a1", "B", 0.67, false],
    // pistols: low by ruling, single pistols at most B and dual pistols at most A- (the dual DEagle and P30L score A);
    // the M9 is pinned at D (stats C+) so bots still swap it for any real gun
    ["p30l_dual", "A-", 0.71, true], ["ots38_dual", "B+", 0.45, true], ["p30l", "B", 0.59, true],
    ["deagle_dual", "A-", 0.56, true], ["deagle", "B", 0.42, true], ["ot38_dual", "B-", 0.46, true],
    ["m9_dual", "B", 0.63, true], ["m93r_dual", "B", 0.72, true], ["m93r", "C+", 0.57, true],
    ["glock_dual", "D", 0.86, true], ["colt45", "C", 0.45, true], ["colt45_dual", "B-", 0.48, true],
    ["ot38", "D", 0.59, true], ["m9", "D", 0.58, true], ["glock", "D", 0.8, true],
    ["ots38", "C+", 0.48, false], ["m1911_dual", "C", 0.53, false], ["m1911", "D", 0.63, false],
    // survev-only guns: the Barrett two-hits any armour (S-aim); the ASh-12's 10-round magazine and 70 u range hold it
    // at A-; the IMD-2 is a light LMG (B+); the S&W 500 is capped with the pistols; the winter skins as their base gun
    ["barrett", "S-aim", 0.31, true], ["ash12", "A-", 0.41, false], ["spas16", "S", 0.88, true],
    ["imbel", "B+", 0.53, false], ["sw500", "B", 0.47, false],
    ["svd_winter", "A", 0.36, false], ["sv98_winter", "A", 0.32, false], ["awc_winter", "S-aim", 0.26, false],
    // the PMG-134 (potato maps and potato drops) at its explosion damage, 8.5 x 2 every 0.07 s from a 150-round
    // magazine (report 34)
    ["potato_lmg", "A", 0.71, false],
    // round 6 (report 42, potato maps only): the Spud Gun at its 13-damage blasts, MP5 level (B); the Potato Cannon, a
    // 95-damage blast every 1.2 s from a 65 u/s lob, 2 hits even on bare players (C)
    ["potato_smg", "B", 0.68, false], ["potato_cannon", "C", 0.58, false],
    // the owner's beta guns (docs/design/new-gun-stats.md): the DP-12 is S (two shells in 0.2 s), the WA2000 B (72
    // damage: 3 hits through level 1)
    ["ak74", "B+", 0.45, true], ["g36c", "B", 0.47, true], ["m16a4", "A-", 0.47, true], ["sig550", "A-", 0.42, true],
    ["g3", "B+", 0.43, true], ["honeybadger", "B+", 0.46, true],
    ["fal", "A", 0.4, true], ["mk14", "B+", 0.4, true], ["wa2000", "B", 0.31, true],
    ["m200", "S-aim", 0.29, true], ["hecate", "S-aim", 0.23, true], ["lynx", "S-aim", 0.29, true], ["boys", "A-", 0.41, true],
    ["m60", "A", 0.6, true], ["mg42", "A-", 0.5, true], ["dshk", "A+", 0.56, true],
    ["bizon", "B", 0.73, true], ["m1928", "B+", 0.74, false], ["asval", "B", 0.52, true], ["p90", "A-", 0.71, true],
    ["dp12", "S", 0.76, true], ["aa12", "A+", 0.92, true],
    ["tec9", "B-", 0.67, true], ["tec9_dual", "B+", 0.78, true], ["vz61", "C", 0.66, true], ["vz61_dual", "C+", 0.63, true],
    // bot round 6: the beta launchers at direct hits on a strafing target, the GL-06's cursor bursts splashing near
    // misses; the M202's 52-degree fan lands one rocket. The MGL leads (A); against a stationary target the RPG-7 and
    // M79 score B, the Panzerfaust A-, the M202 A
    ["m79", "C", 0.72, true], ["mgl", "A", 0.7, true], ["gl06", "A", 0.85, true], ["rpg7", "C+", 0.38, true],
    ["panzerfaust", "C+", 0.55, true], ["m202", "B", 0.46, true],
];
```

The header's sources now cite this doc for the tiers and F.

## 8. Bot tests

Applying the `ROWS` failed seven bot tests, all pins of old tiers or F; all 487 pass again. The pins (AK-47 B, M9 D)
keep the behaviour tests as they were:
- `behaviour.test.ts`: a bot with an M9 and an MP5 swaps the M9 for an AK;
- `metrics.test.ts`: the weapon collector reads an M9 loadout as D;
- `gun-use.test.ts` item 43: an average bot with an MP5 and an AK takes an MK12 for the AK.

The rest now pin the rebuilt values:

- `gunTiers.test.ts`:
  - **Tiers.** The rulings and pins stay. The stat tiers that moved are updated: QBB-97 and SV-98 A, M1100 B, P30L B,
    duals A-, and so on. The MK12 is now compared with the Garand instead of the SCAR-H (both B+). The Mosin is at or
    below the SV-98 (both A).
  - **Weak guns.** The M1100 and the dual M9 left the weak tiers; the vz. 61 and the Peacemaker were added as weak.
  - **Skill demand.** The Hécate (F 0.23) now needs the most aim; the AWM-S (0.26) stays above every gun outside the
    snipers. The MP220 is the most demanding shotgun (F 0.58, no longer > 0.5 demand). A beginner's fit is 0.412 for the
    AWM-S and 0.91 for the M249.
- `gun-use.test.ts`:
  - item 42: the Spud Gun is B (was A-) and the Potato Cannon C (was B);
  - item 43: the MK12's desire pins use F 0.36 (skill demand 0.78).
- `loot-weapons.test.ts`: the ammo-awareness check uses the Saiga. The M870 with shells close by is no longer worth
  swapping in over an MP5 + HK416 loadout. It is B+, one step over the MP5, so the assertion is now 0, with a comment.
- `persona.test.ts`: the camping example gun is the MK12 (B+), not the P30L (now B).

## 9. Limits

- **Duels only.** One shooter against one target in the open. There is no cover, no peeking, no third parties and no
  quickswitch combos: snipers and the M870 benefit from those, and the damage-per-shot term stands in for them only
  in part.
- **Splash damage.** Only the cursor bursts (USAS, GL-06) splash a target on a miss. Rockets, lobs and potatoes that
  burst on cover near a target are not credited, so those launchers sit on the conservative side; section 3 gives
  them against a stationary target.
- **Deliberate aim** (2.3) is the one assumption not taken from the code or the bot calibration. AIM_TAU=inf turns it
  off.
- **Off-map guns** (SCAR-SSR, M1014, USAS, BLR, events) are tiered on the same scale. Their high or low tiers matter
  only when an event spawns them.
