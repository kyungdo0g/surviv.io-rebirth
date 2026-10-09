# Gun tiers from a full stat comparison

Status: **applied** (2026-10-08). Rebuilds the bot gun tiers of `packages/bots/src/knowledge/gunTiers.ts` from every
gun's final stats, at the owner's request ("총 티어 다시 짜라. 종류, 데미지, DPS, 탄창, 탄 퍼짐 등등 스탯을 다
대조해서"). The owner reviewed the rebuilt list the same day and ruled on the DMRs, snipers and launchers (section 1a).
Section 7 holds the `ROWS` now in `gunTiers.ts`.

- **Scope.** All 102 guns of the current list: original, survev-only, the owner's beta guns, and since bot round 6 the
  six beta launchers and the three potato guns. The flare guns, bugle and cursed M9 deal no damage and are left out.
- **Baseline.** "Current" means `gunTiers.ts` as of bot round 6 (owner items 42-44), frozen in
  `tools/research/gun-tiers/baseline.json`. Launchers have their own class there, the potato guns score by explosion
  damage, the DMR fit is milder (`DMR_FIT_SLOPE`), and the USAS, SVD, SCAR-SSR and L86 carry the main-map flag. The
  stats are those of commit `d96246a`, which includes the owner's speed pass and the M202 FLASH rework, plus the
  M202's later revert to a 60° fan and a 5-16 u blast:
  - the M79, MGL and GL-06 lose their held-speed penalty;
  - the PMG-134 now costs 2 u/s just by being carried;
  - the M202 fires a fixed 60° fan of four 25 + 125 rockets.
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

{{TIERLIST}}

{{COUNTS}} Section 6 gives every change with its reason.

## 1a. Owner rulings, 2026-10-08

The owner reviewed the rebuilt list the same day. The rulings come last in `score.ts` and override the earlier ones
(the MK12 / M39 B+ and the Mosin A of report 33):

- **"Every DMR and every sniper moves up one tier."** By the bots' classes `dmr` and `sniper`, winter skins included.
  S-aim has no higher aim tier and stays, and an S gun stays. So the MK12 and M39 go B+ → A- and the Mosin A → A+.
  The step counts from the list the owner reviewed (d96246a, frozen in `tools/research/gun-tiers/reviewed-d96246a.json`),
  so a later stat shift cannot make it two. The Model 94 was B- there and ends at B. Bumping its recomputed tier
  instead would give B+, two steps: the M202's revert moved the B cut, and its stats alone now read B.
- **The RPG-7 and the Panzerfaust are "far too low":** RPG-7 A-, Panzerfaust B+.
- **The M202 FLASH is "overpowered, a near-certain kill, the endgame comeback gun", and the Panzerfaust is its
  downgrade:** A+, above the Panzerfaust.
- **"Tiers are not absolute":** some players take a MAC-10 (Uzi) over an AK-47 because it fires faster. This is no tier
  change but a personal taste on top of the shared tiers (section 1b).

{{OWNER_1008}}

By stats the three launchers sit at B-, C+ and C+ against a strafing target. Against a stationary one they are A, B
and A- (section 3), the shot bots fire them for.

## 1b. Personal gun taste

The tiers are what everyone agrees on; a bot's own taste sits on top (`packages/bots/src/persona.ts`, `drawGunTaste`).
Every bot with a drawn (non-neutral) persona draws it once, from its own seeded stream (`seed ^ GUN_TASTE_SALT`), so
it never shifts the skill, camping or outfit draws.

- **Fire-rate lover**, 22 % of those bots across every skill tier. Desire +2 per round per second above the AK-47's
  10, at most +24, for SMGs, assault rifles and LMGs; pistols stay backups.
  - The MAC-10 (22 rps) gets +24, so it outranks the AK-47 for five of the seven personas. The rifleman's rifle love
    and the rusher's mobility weighing keep the AK unless the class bias tips it.
  - The Vector (+24) outranks the M4A1 (+4.4) the same way.
  - A lover may give up a held gun up to two tiers above the one it loves (an AK-47 for a MAC-10). It never gives up
    an S-rule, S or S-aim gun, and it does not count a loved MAC-10 as "weak".
- **Class bias** for every such bot: each class affinity x (1 ± up to 4 %). Loadouts vary between bots, but the bias
  never lifts a gun over one two tiers above it.
- The S-rule keeps the M249 and the PKP on top for every taste.
- A bot with the neutral persona or with explicit persona parameters draws no taste. `taste: false` (Bot) and
  `population.tastes: false` (runner) turn it off.

Measured on 12 seeded population matches (60 bots each, one minute, every bot armed sampled every 5 s), taste off
against taste on with the same seeds:

| | taste off | taste on |
|---|---|---|
| fire-rate lovers | 0 of 720 | 171 of 720 (23.8 %) |
| SMG in the primary slot | 23.7 % | 25.4 % |
| an SMG in either slot | 37.4 % | 40.4 % |
| holding a MAC-10 | 7.6 % | 9.7 % |

The shift is small because only the lovers move and only when a fast gun lies near them; the Vector does not spawn on
the main map, so it shows up in neither run.

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
  `skill.ts` `SKILL_SIGMA` band midpoints (s 0.825 / 0.5 / 0.15 → 1.8 / 3.2 / 6.2°) move a few guns one step (2.7).
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

{{AMMO}}

Factor: 1 for ammo with a `tier_ammo` box row, 0.85 for ammo without one, 0.7 for rockets (only the 4 that come with
the RPG-7). Charge guns have no ammo to find: 1, with the per-pickup limit in sustain.

### 2.6 Composite score and tiers

Every component is a log2 ratio against the median tiered gun at the same distance and skill, clamped to ±3. The
composite is their weighted sum, so it is the log2 of a weighted geometric mean of "how many times better than the
median gun". Weights: {{WEIGHTS}}.

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
  every cut is the midpoint between the last gun in and the first gun out. Cuts: {{THRESHOLDS}}
- **S-aim.** A top-band gun that needs aim, F ≤ 0.35 (skill demand ≥ 0.8). S stays for top guns that do not.
- **Rulings** (kept even where the stats differ; section 5):
  - M249 and PKP S (S-rule); Mosin A; MK12 and M39 B+ (report 33);
  - "pistols are low": single pistols at most B, duals at most A-. The current list's highest pistol is the dual P30L
    at A;
  - last, the owner rulings of 2026-10-08 (section 1a): every DMR and sniper one tier up (so MK12 / M39 A-, Mosin
    A+), RPG-7 A-, Panzerfaust B+, M202 A+.
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

{{SENS}}

The model is stable in σ. Damage per shot is the term that decides most: it separates the alpha guns (snipers,
shotguns, DMRs, heavy pistols) from the bullet hoses. The closest calls are the Garand's S-aim (0.0005 over the cut),
the Model 94's stat B (0.0006 over; the M202's revert moved the B cut past it; its final tier counts from the
reviewed B-, section 1a), and the SPAS-16's S.

## 3. Tier list

| tier | guns |
|---|---|
| S (S-rule) | M249, PKP |
| S | SCAR-SSR, DP-12, M1014, SPAS-16 |
| S-aim | Hécate II, AWM-S (+ winter), M200, Barrett, Lynx, M1 Garand (by 0.0005 on its expert composite) |

The full grouped list is table 1. Every gun's numbers are in [gun-tiers-stats.md](gun-tiers-stats.md).

**Launchers against a stationary target.** The composite scores every gun against a target strafing at 3.5 u/s. That
target steps out of slow rounds: Panzerfaust 35 u/s (70 since 2026-10-08), M79 40, M202 55, RPG-7 85. Bots fire launchers at groups,
campers and busy targets (`brain/launch.ts`), which hold still. The same composite with no dodge (`DODGE=0`, every
gun rescored on its own cuts) gives the right-hand columns:

{{LAUNCHERS}}

The stat tiers use the strafing column, like every other gun. The owner's rulings for the M202 (A+), RPG-7 (A-) and
Panzerfaust (B+) sit at or above the stationary column (section 1a).

## 4. Reading the big moves

- **Shotguns rise.**
  - At 5-10 u they kill level 1 in under half a second at average aim: DP-12 0.36 s, SPAS-16 0.39, M1014 0.43,
    Saiga 0.47. That is the strongest role score of any class but the one-shot snipers.
  - Their range term costs them only a seventh of the weight. The M870 and MP220 fall: the pump (0.9 s) and the
    two-shell load cost them against the automatics.
- **Bolt actions without a one-shot fall by stats.** 72 damage (Mosin, WA2000) misses the 2-hit kill through
  level 1 by 0.05 HP, so both need 3 hits. The SV-98's 80 damage makes it 2. The BLR has 3 rounds. The owner's
  one-tier bump for every sniper (section 1a) softens it: the WA2000 ends at B+, three tiers under its old A+.
- **The DShK leaves S.** It kills fastest of the LMGs, but at 9 u/s held and 2 u/s firing its composite equals the
  M249's (0.32 / 0.34).
- **Launchers split.** The round bursts at the cursor for the GL-06 (B- → A) and the USAS, so their near misses still
  splash. The MGL's six grenades 0.7 s apart keep it on top (A). Single-shot, slow rounds that fly past a strafing
  target sink: M79 B → C and Potato Cannon B → C. By stats, the RPG-7 (C+), Panzerfaust (C+) and single-use M202
  (B-: its fan lands one rocket, 150 on a direct hit) would sink too. The owner ruled them up instead: A-, B+, A+
  (section 1a).
- **DMRs cluster.** All 11 score 0.13-0.33, except the SSR at 0.67: the Garand leads, and the MK12 and M39 sit near
  the bottom, as the owner says. The cut between A and B+ runs through the middle of the cluster, so the MK12 / M39
  ruling also takes the three DMRs that score no better. The owner's 2026-10-08 bump then lifts every DMR one tier:
  the low five to A-, the L86, FAL and SVD to A+.
- **Assault rifles are flat** (−0.18 to 0.09, AN-94 0.35 apart). Small stat edges move them one step: the SCAR-H's
  20-round magazine, the SIG 550's 1.5° spread.
- **SMGs.** The Vector's 46 u range and 7.5 damage drop it to B, and the Vector (.45) falls to B-. A fire-rate lover
  still prefers the Vector to an M4A1 (section 1b).
- **Pistols.** By stats the dual DEagle and dual P30L are A (TTK under 0.9 s at 5-20 u), the single P30L and DEagle A
  / A-. The dual M9 and M93R reach the MP5's level. The ruling caps them (section 5).

## 5. Conflicts with the owner's rulings

{{CONFLICTS}}

Kept as ruled or pinned; the tier column is the final one, after the owner's 2026-10-08 bump of every DMR and sniper
(section 1a). Where a ruling is far from the stats (the Mosin: C+ by stats, A+ now), the bots value the gun above what
it does for them in a fight. The M249 sits one step under its ruling only because of the damage-per-shot term.

## 6. Changes against the current `gunTiers.ts`

Sorted by size of the move. The reason quotes TTK at average aim, level 1, over the class band unless it says
otherwise. The composite is the stat score: S cut 0.383, A+ 0.321, A 0.132.

{{CHANGES}}

## 7. `ROWS` (applied)

Written into `gunTiers.ts` by `report.ts --apply`. It keeps the round 6 format, order and line layout, and the
`mainMap` flags unchanged. F is the new forgiveness (2.2). Every value is now measured, so the "est." markers are gone;
the two round 6 loot notes behind the main-map flags stay word for word.

```ts
{{ROWS}}
```

The header's sources now cite this doc for the tiers and F.

## 8. Bot tests

**The rebuild (d96246a).** Applying the rebuilt `ROWS` failed seven bot tests, all pins of old tiers or F values. The
pins (AK-47 B, M9 D) keep the behaviour tests as they were:
- `behaviour.test.ts`: a bot with an M9 and an MP5 swaps the M9 for an AK;
- `metrics.test.ts`: the weapon collector reads an M9 loadout as D;
- `gun-use.test.ts` item 43: an average bot with an MP5 and an AK takes an MK12 for the AK.

The pins that moved:
- `gunTiers.test.ts`: the new stat tiers, the weak-gun lists, and the skill demand (the Hécate now needs the most aim).
- `gun-use.test.ts`: the Spud Gun B and the Potato Cannon C; the MK12's F 0.36.
- `loot-weapons.test.ts`: the M870 (B+) is no longer worth swapping in over an MP5 + HK416. The ammo-awareness check
  moved to the Saiga.
- `persona.test.ts`: the camping example gun is the MK12.

**The owner rulings and the gun taste (2026-10-08).**
- `gunTiers.test.ts` pins the rulings:
  - the Mosin and SV-98 at A+, the MK12 and M39 at A-, the WA2000 at B+, the Garand at S-aim;
  - the RPG-7 at A-, the Panzerfaust at B+ and the M202 at A+, above the Panzerfaust.
- `gun-use.test.ts` item 43:
  - The MK12's desire base is now 68 (A-), and the average bot's AK-for-MK12 swap still passes.
  - Since the MK12 is a tier over the AK, an expert takes it too, but values it less than the average bot. The test
    asserts that order instead of the old "an expert keeps its AK".
- `persona.test.ts`: a named persona now carries the bot's own taste (`botPersona`); the brain's stream is unchanged.
- New `gun-taste.test.ts`:
  - A fire-rate lover takes a MAC-10 over an AK-47 and a Vector over an M4A1, empty-handed, with only an M9, and as a
    swap next to a Mosin. A default bot takes the AK-47 every time.
  - The taste never reaches past two tiers.
  - Nobody, of any persona, taste or skill, drops an S-rule gun for a pistol or a fast gun.
  - About a fifth of the drawn bots love fire rate. The class bias stays within ±4 % and never lifts a gun over one two
    tiers above it.
  - The taste is drawn from the bot's own seeded stream: named personas only, deterministic, with an opt-out.

All 749 tests of `packages/bots` and `packages/defs` pass.

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
