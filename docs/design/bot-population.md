# Bot population: gun tiers, personas, skill tiers

Status: implemented in the bot overhaul (POPULATION package). This is the corrected version of the population spec
(the round-2 design plus its critique). Tier and persona values are design choices; gun facts cite the KB
(`docs/research/items/guns.md`, `docs/research/namu.md`).

## 1. Three axes plus the brain

| axis | symbol | what it controls | where |
|---|---|---|---|
| skill (mechanics, 손) | `s ∈ [0, 1]` | reaction, aim error, lead, bursts and clicks, strafing, the whole human cursor motor, human latencies | `packages/bots/src/skill.ts` `skillParams` |
| sense (decisions, 판단) | `g ∈ [0, 1]` | memory, cover, grenades, standing still, engage range, heal and boost thresholds, aggression, decision cadence | same, interpolated in `g` |
| persona (taste, 취향) | `PersonaName` | weapon taste, fighting range, fight starting, chase patience, looting, risk, scopes, camping, roaming, bursts | `packages/bots/src/persona.ts` |
| brain features | `BrainName` | which behaviours exist (baseline or smart) | `brain/features.ts`, unchanged |

`DifficultyParams` stays the single struct behaviours read (`ctx.params`); `skillParams(s, g)` composes it. Persona and
skill are on `BrainCtx` (`ctx.persona`, `ctx.skill`, plus `ctx.personaRng` for persona-gated draws).

Determinism: persona, tier, `s` and `g` draws use their own rng stream, `createRng(seed ^ PERSONA_SALT)`, never the
brain's (`bot.rng`) or the motor's. The neutral persona with a legacy preset replays seed for seed
(`test/persona.test.ts`).

## 2. Gun knowledge (`knowledge/gunTiers.ts`)

Classes come from the KB grouping (`@rebirth/defs` `gunClass`): smg, rifle (assault rifles), lmg, dmr, sniper,
shotgun, pistol; the flare guns, potato guns, bugle and cursed M9 are useless. `weapons.ts` `classify` reads it, so
LMGs are their own class (fought in the rifle band), the VSS is a DMR and the M1014 a shotgun.

### Tiers (main-map roster, corrected)

`TIER_BASE = {S 92, S-aim 90, A+ 80, A 74, A− 68, B+ 62, B 56, B− 50, C+ 44, C 38, D 22}`

| tier | guns |
|---|---|
| S (S-rule) | m249, pkp |
| S-aim (no S-rule) | awc |
| A+ | sv98, qbb97 |
| A | mk12, m39, garand, scar, m4a1, saiga, spas12, p30l_dual |
| A− | famas, grozas, dp28, vector, m870, mp220, scorpion, ots38_dual |
| B+ | p30l, deagle_dual |
| B | ak47, hk416, groza, mosin, scout_elite, vss, ump9, mp5, deagle |
| B− | ot38_dual |
| C+ | mac10, m9_dual, m93r_dual, colt45_dual |
| C | m93r, m1100, colt45, glock_dual |
| D | ot38, m9, glock |

Off-map guns (usas, m1014, an94, bar, svd, scarssr, l86, mkg45, blr, model94, vector45, m1a1, ots38, m1911,
m1911_dual) carry estimated tiers for events. Fork guns (barrett, ash12, sw500, imbel, spas16, potato_lmg) and
post-0.8.82 guns (PKM, M134, M79) are not in the defs.

- **Skill demand**: `skillDemand = clamp((0.75 − F) / 0.5, 0, 1)`, F = expert TTK / beginner TTK from an analytic
  discrete-TTK model (critique section B). The AWM-S demands the most (1.0), the M870 and Saiga nothing.
- **Fit**: `skillFit = 1 − λ · max(0, skillDemand − s)`, λ 0.6 for aim guns (snipers and DMRs), 0.25 otherwise.
- **Weak guns**: C+ and lower (`isWeakGun`). A bot whose best gun with ammo is weak is under-armed (LOOT: upgrade value
  ≥ 88; MOVE: fight confidence 0.55).
- **Whole hits**: `bodyHitsToKill` / `perfectTtk` (body damage `dmg × (1 − chest) × (1 − 0.3 × helmet)`). Mosin vs
  helmet01 + chest01: 3 hits; AWM-S one-shots chest02 + helmet01 only.
- **Mobility**: `mobilityPenalty` (moving spread above 7°, slowdown while firing), 0 .. 0.25; rushers weigh it.

### Desire

`baseDesire(id, persona, s) = TIER_BASE × classAffinity × (1 − mobility × mobilityPenalty) × skillFit(s) + favourite`,
with the S-rule (M249, PKP: 1 above the best non-S gun of that persona and skill). LOOT's `desire.ts` adds what depends
on the moment: ammo (no ammo and none seen → × 0.6, except S), the loadout (one gun: complement × `complementWeight`;
both slots full: gain over the weaker gun ≥ `upgradeThreshold`; never drop a higher tier for a lower one unless it is
out of ammo with none carried).

## 3. Personas (`persona.ts`)

| persona | mix | smg | rifle | lmg | dmr | sniper | shotgun | pistol | favourites | range / engage | aggr | chase s | loot | risk | camp | roam |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rusher 돌격형 | 22% | 1.3 | 1.25 | 1.1 | 0.7 | 0.55 | 1.15 | 0.8 | saiga +8, spas12 +6, vector +6, mp220 +4 | 0.75 / 0.8 | +0.15 | 18 | 0.35 | 0.8 | 0 | 260 |
| rifleman 소총수 | 30% | 0.95 | 1.3 | 1.3 | 1.05 | 0.8 | 1.0 | 0.75 | – | 1.0 / 1.0 | 0 | 10 | 0.6 | 0.5 | 0.1 | 240 |
| marksman 저격수 | 14% | 0.8 | 1.0 | 1.0 | 1.35 | 1.4 | 0.95 | 0.6 | sv98 +8, mosin +6, scout_elite / mk12 / m39 +4 | 1.3 / 1.3 | −0.05 | 6 | 0.7 | 0.4 | 0.3 | 200 |
| camper 존버 | 10% | 0.95 | 1.05 | 1.15 | 1.15 | 0.95 | 1.3 | 0.7 | spas12 +6, saiga +6, m870 +4 | 0.9 / 0.9 | −0.2 | 3 | 0.8 | 0.25 | 0.8 | 120 |
| looter 파밍러 | 14% | 1.0 | 1.1 | 1.15 | 1.05 | 0.95 | 1.05 | 0.75 | – | 1.0 / 0.9 | −0.1 | 6 | 0.95 | 0.45 | 0.1 | 300 |
| rat 쥐/생존형 | 10% | 1.15 | 1.0 | 0.95 | 1.15 | 0.9 | 1.05 | 0.85 | vss +6, grozas +4, m4a1 +4 | 1.2 / 0.7 | −0.3 | 0 | 0.6 | 0.15 | 0.5 | 150 |

Other fields: rusher mobility 1 (others 0); marksman complement weight 0.3 (others 1); upgrade threshold rusher 8,
camper 12, looter 5, others 10; heal bias rusher −10, marksman +5, camper +10, looter +5, rat +15; scope affinity
rusher 0.6, marksman 1.8, looter 1.3, rat 1.1; burst scale rusher 1.3, marksman 0.8, rat 0.9. `rangeScale` applies only
with a home-class gun (rusher smg/shotgun/rifle, rifleman rifle/lmg, marksman dmr/sniper, camper shotgun/lmg/dmr, rat
dmr/smg).

Outfit habit (`outfitMix`, LOOT2, user report 22; weights any / liked / never, drawn once per bot on the persona stream
when it first sees an outfit, `brain/outfits.ts`): rusher 0.35 / 0.25 / 0.4, rifleman 0.2 / 0.4 / 0.4, marksman 0.1 /
0.6 / 0.3, camper 0.15 / 0.55 / 0.3, looter 0.6 / 0.3 / 0.1, rat 0.1 / 0.45 / 0.45, NEUTRAL never. "liked" bots rank
4-8 lootable outfits, camouflage weighted `1 + 2 × (0.6 − risk)` (at least 0.3). An outfit is a detour of at most 15
units, only when quiet (no threat for 5 s, nobody in view, health 60+, no zone hurry), loot score capped at 0.26.

Rules for consumers (critique C4, C5, C8):
- NEUTRAL (every multiplier 1, biases 0, patience ∞, thoroughness and risk 0.5, roam 240) is today's bot. Re-centre
  formulas on it: flee threshold `25 × (1.5 − risk)` (`fleeHealth`), thoroughness `value × (1 + k(t − 0.5))`
  (`byThoroughness`). Gate new code paths on a non-neutral field (`isNeutral`).
- Camping only with campiness, a B+ gun and armour (`mayCamp`), zone first; draw the chance from `ctx.personaRng`.
- Futile chases: patience from the persona, universal cap 30 s (MOVE).
- Faction roles map to personas as a wave-3 starting point (`ROLE_PERSONA`).

## 4. Skill tiers (`skill.ts`)

Bands: beginner `s ∈ [0, 0.30]`, intermediate `[0.35, 0.65]`, expert `[0.75, 0.90]` (capped at 0.9 until COMBAT-4
adds the ~80 ms perception delay). Each bot draws `s` uniformly in its band and `g = clamp(s + N(0, 0.2))`.

Mechanics fields interpolate in `s` between NOVICE (s 0), AVERAGE (s 0.5) and the hard preset (s 1, exactly). Decision
fields interpolate in `g` between the easy (0), normal (0.5) and hard (1) presets, except `boostAbove` 15 / 35 / 50 so
every tier keeps its boost up when safe (user report 16; the easy preset never boosts); `thinkEvery` 3 below g 0.35, 2
up to 0.85, 1 above; smart reload and grenade dodging from g 0.35.

The legacy presets `easy`, `normal`, `hard` keep their fixed values (replays, tests, the tournament, the aim-bench
fixture) and stand for the tier labels beginner, intermediate and expert (`LEGACY_TIER`; `PRESET_SKILL` gives their
s / g equivalents: easy ≈ s 0.4, normal ≈ s 0.75, hard = s 1).

### Grenade craft and judgement (round 4, user reports 29 and 30)

Same two axes, no per-tier branches: `DifficultyParams.frag` and the judgement fields are composed by `skillParams`.

| field | axis | easy (g 0) / NOVICE (s 0) | normal (g 0.5) / AVERAGE (s 0.5) | hard (1) |
|---|---|---|---|---|
| `recall` (thinks of its frags in an engagement) | g | 0.4 | 1 | 1 |
| `coverWait` (s behind cover before a frag) | g | 2.2 | 1 | 0.7 |
| `craft` (deliberate throws: push and revive denial, escapes, buildings, air bursts) | g | 0.1 | 0.5 | 1 |
| `waste` (frags/s at enemies in the open or out of reach) | g | 0.05 | 0 | 0 |
| `pathCheck` (looks for walls and trees in the frag's path) | g | 0.15 | 0.6 | 1 |
| `shortBias` / `rangeSd` / `lateralDeg` (the throwing hand) | s | 0.18 / 0.16 / 7° | 0.06 / 0.08 / 3° | 0 / 0.035 / 1.2° |
| `motionComp` (own run allowed for in a throw on the run) | s | 0.1 | 0.55 | 0.95 |
| `misjudge` / `overconfidence` (belief error on a fight, ln TTK ratio) | g | 0.6 / 0.3 | 0 / 0 | 0 / 0 |

The legacy presets carry their own values (easy's hand fields 0.1 / 0.12 / 5° / 0.35, normal's 0.03 / 0.05 / 2° /
0.75). Smart brain only (`BrainFeatures.grenades`; the judgement wherever the assessment is read): `brain/fragSkill.ts`,
`grenades.ts`, `escapeFrag.ts` (frags thrown back uncooked at a chaser's path while running, freer with more frags),
`judgement.ts`. The persona's `riskTolerance` scales escape and push-denial frags (1.5 - risk) and cover flushing
(0.5 + risk).

### Reaction floors (median, from on-screen exposure)

beginner ≥ 0.35 s, intermediate ≥ 0.25 s, expert ≥ 0.18 s (`REACTION_FLOOR`). `skillParams` keeps both
`reactionTime` and `exposureReaction` at `lo ≥ 0.8 floor`, `hi ≥ 1.2 floor`. COMBAT implements the mechanisms
(exposure reaction, onset floor, perception delay, melee lag, dodge reaction: the new `DifficultyParams` fields).

### Calibration (aim bench, `node packages/bots/scripts/aimbench.ts --skill tiers --difficulty all --trials 24`)

Grid: ot38, m9, glock, mp5, ak47, m870, mosin, mk12, m249 × 10 / 20 / 35 u (4x scope at 35) × standing / ADAD strafe,
targets inside the human 16:9 screen, timed from on-screen exposure; 24 trials per cell.

| shooter | hit | first shot (s) | kill ≤ 8 s | OT-38 strafe 10 u (hit / kill) |
|---|---|---|---|---|
| easy (legacy) | 0.328 | 0.96 | 0.64 | 0.27 / 0.25 |
| normal (legacy, old server default) | 0.441 | 0.59 | 0.88 | 0.52 / 0.88 |
| hard (legacy) | 0.450 | 0.35 | 0.89 | 0.76 / 1.00 |
| **beginner** (s 0.15) | **0.267** | **1.24** | **0.49** | 0.19 / 0.04 |
| **intermediate** (s 0.5) | **0.346** | **0.73** | **0.74** | 0.39 / 0.63 |
| **expert** (s 0.825) | **0.436** | **0.47** | **0.90** | 0.70 / 1.00 |

Target bands (`scripts/aimbenchTiers.ts` `TIER_BANDS`): beginner hit 0.22–0.28, first shot 1.05–1.45 s, kill 0.38–0.52;
intermediate 0.31–0.36, 0.66–0.86 s, 0.65–0.77; expert 0.39–0.45, 0.42–0.62 s, 0.82–0.92. Monotonicity: per pattern
and distance group the hit rate never falls from tier to tier (0.02, strafe at 35 u 0.04), per gun the kill rate
(0.05). `test/fixtures/aim-tiers.json` holds the recorded run and `test/aimbench.test.ts` checks it.

With the server mix the mean kill-within-8 s is 0.35 × 0.49 + 0.45 × 0.74 + 0.2 × 0.90 ≈ 0.69, against 0.88 when
every bot was normal; the mean hit rate 0.34 against 0.44.

Re-run in wave 2: COMBAT-1/3/4 remove the off-screen head start and add exposure reactions, so these numbers move.

`SKILL_SIGMA` (effective aim error for the fight arithmetic, fitted to this grid): s 0 / 0.15 / 0.3 / 0.5 / 0.65 /
0.825 / 1 → standing 7.7 / 6.2 / 5.4 / 3.2 / 2.7 / 1.8 / 0.8°, strafe 13.8 / 13.3 / 13.1 / 10.3 / 7.6 / 6.3 / 6.0°.

## 5. Server population

- `BOT_DIFFICULTY=mixed` (default): tiers from shuffle bags of 20 in the `BOT_SKILL_MIX` proportions (default
  `35,45,20` = 7 / 9 / 4), personas from bags of 50 (`BOT_PERSONAS`, default on), on a dedicated rng in `BotFill`. Bot
  names and seeds are unchanged.
- `beginner`, `intermediate`, `expert`: every bot in that tier. `easy`, `normal`, `hard`: the legacy presets.
- The match runner keeps `"mixed"` as equal thirds of the legacy presets; `difficulty: "population"` draws the server
  mix, and `population.personas` turns personas on (off by default, so runMatch and the tournament stay neutral).

## 6. Fairness

Desire uses only the defs plus the bot's own inventory; loot and enemies come from perception. Tiers and personas exist
only on the server and change nothing a client receives.
