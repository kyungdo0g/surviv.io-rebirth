# New gun stats (final balance sheet)

Status: **decided** 2026-10-07 (final stage of the balance workflow; no open questions); the owner's 2026-10-08 change
of the M79, GL-06 and Milkor MGL Player speed (-1 / -1 / -1.5 -> 0) is applied here (section 6). Supersedes the
per-gun stat columns of `survev-content-and-new-guns.md` 4.1 and the loot weights of 4.1 / 4.2 where they differ.
Machine-readable twin: [`new-gun-stats.json`](new-gun-stats.json) (GunDef + bullet / explosion / projectile defs, new
ammo, loot).

- **Scope.** The owner's 30 guns plus `tec9_dual` and `vz61_dual`. The **SPAS-15 is dropped** (owner, 2026-10-07:
  "후속작에 SPAS16이 있네 SPAS15 빼자"): survev's SPAS-16, the full-auto SPAS-15, covers it and now gets a main-map
  tier 2 slot (section 5). The owner's FAL / SPAS-15 drawing is the FN FAL.
- **Baseline.** survev master (`c6185e31`) values for every existing gun (plan 1.2, option B). The survev-only guns
  (Barrett M107, ASh-12, S&W 500, IMD-2, SPAS-16) use their survev.wiki.gg values (owner: the wiki wins over the
  source). PMG-134, the winter skins, potato guns, bugle and flare guns are left out of the ladders.
- **How the numbers were made.** The balance calculator in the session scratchpad (`balance/calc`, a mirror of
  `packages/sim` damage, armour, falloff, spread, bullet travel, burst / pump timing and speed rules, validated against
  the 444 survev TTK fixture cases) on all 96 guns at 15 / 40 / 60 / 100 / 150 / 200 u (`node final/final.ts`).
  Launcher kill chances with shrapnel, splash and self-damage come from the launcher model of the design stage.
- **Reading the numbers.**
  - A0 = no armour; A1 / A2 / A3 = level 1 / 2 / 3 vest **and** helmet. A body hit takes (1 - chest) x (1 - 0.3 x
    helmet): x0.694 / 0.546 / 0.459. HP 100.
  - **TTK body**: every bullet hits as a body hit (perfect aim), first shot at t = 0 plus bullet travel.
  - **E stand / E move**: expected TTK against a stationary target with the gun's standing (or standing + moving)
    spread, 15 % random headshots. Our headshot rule: only `headshotMult > 1` rolls headshots (`rules.ts`
    `headshotNeedsMultAboveOne`); under survev's rule the AWM-S would kill A2 with a headshot, nothing else changes order.
  - **Max DPS** = damage x pellets / average shot interval (wiki convention); **Max obstacle DPS** uses the obstacle
    multiplier; **sustained DPS** includes the reload.
  - Infobox **Player speed** = `speed.equip`, **Recoil speed** = `speed.attack`, **Carry speed** = `speed.carry`
    (rebirth). Move speed 12; firing speed = (12 + carry + equip + attack) x 0.5.

## 1. Summary

| id | gun | class | ammo | damage | rpm | mag | reload | max DPS | TTK body 15 u A0/1/2/3 (s) | placement (main weights) |
|---|---|---|---|---|---|---|---|---|---|---|
| `ak74` | AK-74 | assault | 5.56mm | 12 | 667 | 30/40 | 2.3 | 133.3 | 0.82 / 1.18 / 1.45 / 1.72 | floor 1.5 |
| `g36c` | G36C | assault | 5.56mm | 11 | 750 | 30/40 | 2.1 | 137.5 | 0.83 / 1.15 / 1.39 / 1.71 | floor 1.2 |
| `m16a4` | M16A4 | assault | 5.56mm | 17 | 400 | 30/40 | 2.5 | 113.3 | 0.7 / 1.15 / 1.52 / 1.9 | floor 0.7, T1 1 |
| `sig550` | SIG SG 550 | assault | 5.56mm | 13 | 698 | 30/40 | 2.7 | 151.2 | 0.7 / 1.04 / 1.3 / 1.47 | floor 0.1, T1 1 |
| `g3` | G3 | assault | 7.62mm | 17 | 522 | 20/30 | 2.8 | 147.8 | 0.67 / 1.02 / 1.25 / 1.48 | floor 0.2, T1 1 |
| `honeybadger` | Honey Badger | assault | 5.56mm | 13 | 750 | 30/40 | 2.3 | 162.5 | 0.68 / 1 / 1.24 / 1.48 | floor 0.02, T2 0.75 |
| `fal` | FN FAL | dmr | 7.62mm | 26 | 333 | 20/30 | 2.6 | 144.4 | 0.63 / 0.99 / 1.35 / 1.53 | floor 0.1, T1 1 |
| `mk14` | Mk 14 EBR | dmr | 7.62mm | 25 | 375 | 20/30 | 2.9 | 156.3 | 0.73 / 0.89 / 1.21 / 1.37 | T2 0.75 |
| `wa2000` | WA2000 | sniper | .50 AE | 72 | 55 | 5/6 | 3.3 | 65.5 | 1.16 / 2.26 / 2.26 / 3.36 | T2 0.5 |
| `tec9` | TEC-9 | pistol | 9mm | 12 | 545 | 32/36 | 2.2 | 109.1 | 1.03 / 1.47 / 1.91 / 2.24 | floor 3 |
| `tec9_dual` | Dual TEC-9 | pistol | 9mm | 12 | 857 | 64/72 | 4.2 | 171.4 | 0.71 / 0.99 / 1.27 / 1.48 | second TEC-9 |
| `vz61` | Škorpion vz. 61 | pistol | 9mm | 9 | 800 | 20/30 | 1.6 | 120 | 1.06 / 1.44 / 3.41 / 3.71 | floor 2 |
| `vz61_dual` | Dual Škorpion vz. 61 | pistol | 9mm | 9 | 1500 | 40/60 | 3.3 | 225 | 0.64 / 0.84 / 1.04 / 1.2 | second vz. 61 |
| `bizon` | PP-19 Bizon | smg | 9mm | 10 | 667 | 64/80 | 3 | 111.1 | 1.05 / 1.41 / 1.77 / 2.13 | floor 3 |
| `m1928` | Thompson M1928 | smg | .45 ACP | 13 | 690 | 50/100 | 3.6 | 149.4 | 0.75 / 1.09 / 1.35 / 1.62 | desert tier_guns 0.5, T1 1 |
| `asval` | AS Val | smg | 9mm | 13.5 | 750 | 20/30 | 2.3 | 168.8 | 0.69 / 1.01 / 1.25 / 1.41 | floor 0.05, T1 1.5 |
| `p90` | P90 | smg | 5.7x28mm | 10 | 1000 | 50/60 | 2.9 | 166.7 | 0.72 / 0.96 / 1.2 / 1.44 | floor 0.02, T2 1.5 |
| `dp12` | DP-12 | shotgun | 12 gauge | 12.5 x 9 pellets | 133 | 14/16 | 1.2 per 2 | 250 | 0.37 / 0.37 / 1.07 / 1.07 | tier_shotguns 0.05, T2 1 |
| `aa12` | AA-12 | shotgun | 12 gauge | 64 | 200 | 8/10 | 3.2 | 213.3 | 0.39 / 0.69 / 0.69 / 0.99 | gold 0.5 |
| `m79` | M79 | launcher | 40mm | 0 + 125e+shr | 23.1 (1 per 2.6 s) | 1/1 | 2.3 | 416.7 | 0.3 / 2.9 / 2.9 / 2.9 | floor 0.02, T1 0.5, T2 1 |
| `mgl` | Milkor MGL | launcher | 40mm | 0 + 125e+shr | 86 | 6/6 | 1 per 1 | 178.6 | 0.3 / 1 / 1 / 1 | gold 0.5 |
| `gl06` | GL-06 | launcher | 40mm | 10 + 100e+shr | 26.1 (1 per 2.3 s) | 1/1 | 2 | 366.7 | 0.27 / 2.57 / 2.57 / 2.57 | floor 0.02, T1 0.5 |
| `rpg7` | RPG-7 | launcher | rocket | 60 + 150e+shr | 15.8 (1 per 3.8 s) | 1/1 | 3.5 | 700 | 0.14 / 0.14 / 0.14 / 3.94 | gold 0.5 |
| `panzerfaust` | Panzerfaust | launcher | none | 80 + 140e+shr | single use | 1 (single use) | none (discarded when empty) | 440 | 0.33 / 0.33 / 0.33 / 0.33 | floor 0.2 (owner), T1 0.5 |
| `m202` | M202 FLASH | launcher | none | 4 x (25 + 125e) | single use | 1 (single use) | none (discarded when empty) | 1200 | 0.22 / 0.22 / 0.22 / 0.22 | T1 0.05, T2 0.05, gold 0.25 + bonus 0.1 (owner) |
| `m200` | M200 Intervention | sniper | 7.62mm | 115 | 38 | 7/9 | 3.5 | 71.9 | 0.05 / 1.65 / 1.65 / 1.65 | T2 0.25, gold 0.5 |
| `hecate` | Hécate II | sniper | .50 AE | 160 | 34 | 7/9 | 4 | 91.4 | 0.05 / 0.05 / 1.8 / 1.8 | gold 0.5 |
| `lynx` | Lynx | sniper | .50 AE | 118 | 50 | 5/6 | 4.2 | 98.3 | 0.05 / 1.25 / 1.25 / 1.25 | gold 0.5 |
| `boys` | Boys AT Rifle | sniper | none | 96 | 40 | 7 (single use) | none (discarded when empty) | 64 | 1.56 / 1.56 / 1.56 / 3.06 | T2 0.75 |
| `m60` | M60 | lmg | 7.62mm | 16 | 545 | 100/150 | 6.5 | 145.5 | 0.74 / 1.07 / 1.29 / 1.51 | floor 0.02, T2 1 |
| `mg42` | MG 42 | lmg | 7.62mm | 11 | 968 | 50/75 | 4 | 177.4 | 0.65 / 0.9 / 1.09 / 1.27 | floor 0.005, T2 0.75 |
| `dshk` | DShK | lmg | 7.62mm | 34 | 500 | 30/30 | 7.5 | 283.3 | 0.32 / 0.56 / 0.68 / 0.8 | gold 0.08 |

Launcher TTK above is the calculator's direct hit without shrapnel, and their rate includes the reload; see 4.4 for the kill chances with shrapnel.
Placement keys: floor = main `tier_guns`; T1 = appended to `tier_airdrop_tier1` after the derivation; T2 = appended
to `tier_airdrop_uncommon` before it; gold = `tier_airdrop_rare` (plan 5.8).

## 2. Per gun

Each block: the owner's infobox (survev.wiki.gg field names), placement, reference guns, the real weapon, and why the
numbers are what they are. All TTK values are seconds at 15 u unless noted.

### 2.1 Assault rifles

#### AK-74 (`ak74`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Assault rifle | Damage | 12 |
| Ammo | 5.56mm (green; 5.45x39 has no ammo of its own) | Falloff | 0.9 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 200 |
| Carry speed (rebirth) | 0 | Speed | 107 |
| Magazine capacity | 30 (ext 40) | Max DPS | 133.3 |
| Ammo spawn | 90 | Max obstacle DPS | 133.3 |
| Reload time | 2.3 | Sustained DPS / magazine damage | 72 / 360 |
| Fire delay | 0.09 (667 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.82 / 1.18 / 1.45 / 1.72 |
| Standing / moving spread | 2 / 5.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.23 / 1.49 / 3.14, 4.64 |
| Barrel length | 3.25 |  |  |

- **Placement:** floor 1.5 (tier band floor). Floor of every map whose tier_guns hold assault rifles; banned on Woods and Savannah floors.
- **References:** `ak47`, `hk416`, `an94`.
- **Real weapon:** 5.45x39 mm, 650 rpm, 880-900 m/s, 415 mm barrel, 3.07 kg, 30 rounds (Wikipedia AK-74).
- **Why:** The floor's accurate rifle. Moving spread 5.5 (AK-47 7.5) gives the best moving TTK of the floor rifles (40 u A2 4.64 s against the AK-47's 6.32). It pays with the lowest floor-rifle DPS (133 against 135-160): 1.45 s at 15 u A2 against the AK-47's 1.41. More damage would make it a strictly better AK-47.

#### G36C (`g36c`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Assault rifle (compact carbine) | Damage | 11 |
| Ammo | 5.56mm (green) | Falloff | 0.8 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 150 |
| Carry speed (rebirth) | 0 | Speed | 100 |
| Magazine capacity | 30 (ext 40) | Max DPS | 137.5 |
| Ammo spawn | 90 | Max obstacle DPS | 137.5 |
| Reload time | 2.1 | Sustained DPS / magazine damage | 73.3 / 330 |
| Fire delay | 0.08 (750 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.83 / 1.15 / 1.39 / 1.71 |
| Standing / moving spread | 3 / 5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.23 / 1.52 / 6.3, 5.38 |
| Barrel length | 2.6 |  |  |

- **Placement:** floor 1.2 (tier band floor). As the AK-74.
- **References:** `hk416`, `famas`.
- **Real weapon:** 5.56x45 mm, 750 rpm, 228 mm barrel, about 2.8 kg, 30 rounds (Wikipedia G36).
- **Why:** A light short-barrel carbine: tighter than the M416 (3 / 5 against 4 / 8) and the fastest rifle reload (2.1 s), with less DPS (137.5 against 146.7) and reach (150 u, falloff 0.8). 1.39 s at 15 u A2; standing at 40 u it beats the M416 (1.52 against 1.76).

#### M16A4 (`m16a4`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Assault rifle (3-round burst) | Damage | 17 |
| Ammo | 5.56mm (green) | Falloff | 0.92 |
| Fire mode | Burst (3) | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 250 |
| Carry speed (rebirth) | 0 | Speed | 112 |
| Magazine capacity | 30 (ext 40) | Max DPS | 113.3 |
| Ammo spawn | 90 | Max obstacle DPS | 113.3 |
| Reload time | 2.5 | Sustained DPS / magazine damage | 72.9 / 510 |
| Fire delay | 0.3 + burst delay 0.075 (800 rpm in a burst, 400 average) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.7 / 1.15 / 1.52 / 1.9 |
| Standing / moving spread | 1.1 / 2.4 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.33 / 1.55 / 2.1, 1.72 |
| Barrel length | 3.4 |  |  |

- **Placement:** floor 0.7, T1 1 (tier band floor + T1). As the AK-74 (assault).
- **References:** `famas`, `an94`.
- **Real weapon:** 5.56x45 mm, 3-round burst, 800 rpm cyclic, 960 m/s, 508 mm barrel, 3.4 kg, 30-round STANAG (Wikipedia M16 rifle).
- **Why:** The long-range burst rifle of tier 1: the FAMAS's damage and DPS (113.3) with 30 rounds and 250 u of reach. The FAMAS wins inside 40 u (1.50 against 1.52 at 15 u A2); the M16A4 wins from about 60 u (100 u standing A2 2.10 against 2.27) and is the most accurate automatic on the move (40 u moving A2 1.72).

#### SIG SG 550 (`sig550`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Assault rifle | Damage | 13 |
| Ammo | 5.56mm (green) | Falloff | 0.9 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | -0.5 | Distance | 220 |
| Carry speed (rebirth) | 0 | Speed | 108 |
| Magazine capacity | 30 (ext 40) | Max DPS | 151.2 |
| Ammo spawn | 90 | Max obstacle DPS | 151.2 |
| Reload time | 2.7 | Sustained DPS / magazine damage | 73.9 / 390 |
| Fire delay | 0.086 (698 rpm) | Speed carried / held / firing | 12 / 12 / 5.75 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.7 / 1.04 / 1.3 / 1.47 |
| Standing / moving spread | 1.5 / 6 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.08 / 1.33 / 2.23, 4.09 |
| Barrel length | 3.4 |  |  |

- **Placement:** floor 0.1, T1 1 (tier band floor + T1). As the AK-74 (assault).
- **References:** `grozas`, `m4a1`, `ak47`.
- **Real weapon:** 5.56x45 mm GP 90, about 700 rpm, 911 m/s, 528 mm barrel, 4.1 kg, 30 rounds (Wikipedia SIG SG 550).
- **Why:** The precision automatic of tier 1. The tightest standing spread of any automatic rifle (1.5) makes it the best standing automatic at 40-100 u (A2 1.33 / 2.23). It pays with recoil speed -0.5, a 2.7 s reload and less DPS than the Groza-S, and stays under the SCAR-H up close (1.30 against 1.18).

#### G3 (`g3`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Battle rifle (assault class) | Damage | 17 |
| Ammo | 7.62mm (blue) | Falloff | 0.9 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | -1 | Distance | 225 |
| Carry speed (rebirth) | 0 | Speed | 110 |
| Magazine capacity | 20 (ext 30) | Max DPS | 147.8 |
| Ammo spawn | 80 | Max obstacle DPS | 147.8 |
| Reload time | 2.8 | Sustained DPS / magazine damage | 66.7 / 340 |
| Fire delay | 0.115 (522 rpm) | Speed carried / held / firing | 12 / 12 / 5.5 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.67 / 1.02 / 1.25 / 1.48 |
| Standing / moving spread | 2 / 7 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.09 / 1.32 / 3.29, 5.9 |
| Barrel length | 3.45 |  |  |

- **Placement:** floor 0.2, T1 1 (tier band floor + T1). As the AK-74 (assault).
- **References:** `scar`, `bar`, `imbel`.
- **Real weapon:** 7.62x51 mm, 500-600 rpm, 800 m/s, 450 mm barrel, 4.38 kg, 20 rounds (Wikipedia Heckler & Koch G3).
- **Why:** The hard-hitting slow automatic of tier 1: 17 damage (6 hits kill an unarmoured target) at 520 rpm. Just under the tier 2 SCAR-H (1.25 against 1.18 at 15 u A2) with a 20-round magazine, recoil speed -1 and a 9 total moving spread; it reaches further (100 u A2 3.29 against 3.75).

#### Honey Badger (`honeybadger`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Assault rifle (integrally suppressed) | Damage | 13 |
| Ammo | 5.56mm (green; .300 BLK has no ammo of its own) | Falloff | 0.75 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 120 |
| Carry speed (rebirth) | 0 | Speed | 92 |
| Magazine capacity | 30 (ext 40) | Max DPS | 162.5 |
| Ammo spawn | 90 | Max obstacle DPS | 162.5 |
| Reload time | 2.3 | Sustained DPS / magazine damage | 83 / 390 |
| Fire delay | 0.08 (750 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.68 / 1 / 1.24 / 1.48 |
| Standing / moving spread | 2.5 / 4.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.08 / 1.39 / 5.08, 3.86 |
| Barrel length | 2.8 |  |  |

- **Placement:** floor 0.02, T2 0.75 (tier band T2). Suppressed (tracer and sound fallOff 3, client only). Assault bans as the AK-74.
- **References:** `m4a1`, `scar`, `vector`, `p90`.
- **Real weapon:** .300 AAC Blackout, about 800 rpm, 152 mm barrel with an integral suppressor, 2.9 kg, STANAG magazine (Wikipedia AAC Honey Badger).
- **Why:** The suppressed close-quarters rifle of tier 2, at 750 rpm after the review (0.075 -> 0.08). The P90 and Vector now win inside 25 u (15 u A2 1.20 / 1.16 against 1.24); the Honey Badger wins from 40 u (standing A2 1.39 against 1.69 / 1.74) and on moving accuracy, and runs out of range at 120 u. The gold M4A1-S keeps 165 u and tighter spread.

### 2.2 DMRs

#### FN FAL (`fal`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Battle rifle, semi-auto (DMR class) | Damage | 26 |
| Ammo | 7.62mm (blue) | Falloff | 0.9 |
| Fire mode | Single | Headshot multiplier | 1.5 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 280 |
| Carry speed (rebirth) | 0 | Speed | 118 |
| Magazine capacity | 20 (ext 30) | Max DPS | 144.4 |
| Ammo spawn | 60 | Max obstacle DPS | 144.4 |
| Reload time | 2.6 | Sustained DPS / magazine damage | 83.9 / 520 |
| Fire delay | 0.18 (333 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.63 / 0.99 / 1.35 / 1.53 |
| Standing / moving spread | 1.5 / 5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.19 / 1.4 / 2.24, 3.01 |
| Barrel length | 3.55 |  |  |

- **Placement:** floor 0.1, T1 1 (tier band floor + T1). DMR class: legal on Savannah. The owner's drawing for the dropped SPAS-15 is this gun.
- **References:** `m39`, `mk12`, `scar`.
- **Real weapon:** 7.62x51 mm, 840 m/s, 533 mm barrel, 4.25 kg, 20 rounds; the L1A1 and most service FALs were semi only (Wikipedia FN FAL).
- **Why:** Semi-auto battle rifle: 26 damage kills an unarmoured target in 4 hits (0.63 s, the fastest of tier 1). Level with the tier 1 DMRs to 40 u (15 u A2 1.35; Mk 12 1.34, M39 1.46) and behind them from 100 u (2.24 against 1.98 / 2.09), so the Mk 12 and M39 stay the long-range picks.

#### Mk 14 EBR (`mk14`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | DMR, full auto | Damage | 25 |
| Ammo | 7.62mm (blue) | Falloff | 0.9 |
| Fire mode | Auto | Headshot multiplier | 1.5 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | -1.5 | Distance | 350 |
| Carry speed (rebirth) | 0 | Speed | 120 |
| Magazine capacity | 20 (ext 30) | Max DPS | 156.3 |
| Ammo spawn | 60 | Max obstacle DPS | 156.3 |
| Reload time | 2.9 | Sustained DPS / magazine damage | 82 / 500 |
| Fire delay | 0.16 (375 rpm) | Speed carried / held / firing | 12 / 12 / 5.25 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.73 / 0.89 / 1.21 / 1.37 |
| Standing / moving spread | 1.5 / 7 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.09 / 1.3 / 2.11, 4.48 |
| Barrel length | 3.35 |  |  |

- **Placement:** T2 0.75 (tier band T2). DMR class: legal on Savannah. Not in tier_snipers (it would sit beside the SCAR-SSR).
- **References:** `m39`, `scar`, `garand`, `bar`.
- **Real weapon:** 7.62x51 mm, select fire, 700-750 rpm cyclic, 853 m/s, 457 mm barrel, 5.1 kg, 20 rounds (Wikipedia Mk 14 EBR).
- **Why:** The full-auto DMR of tier 2, at a controllable 375 rpm after the review (0.15 -> 0.16). The SCAR-H now wins at 15-40 u (15 u A2 1.18 against 1.21, standing 40 u 1.27 against 1.30); the Mk 14 wins from 60 u (100 u A2 2.11 against 3.75), on magazine damage and sustained DPS (82), and stays under the gold Garand everywhere. Poor on the move (40 u moving A2 4.48).

### 2.3 SMGs

#### PP-19 Bizon (`bizon`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | SMG (64-round helical magazine) | Damage | 10 |
| Ammo | 9mm (yellow) | Falloff | 0.75 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 90 |
| Carry speed (rebirth) | 0 | Speed | 78 |
| Magazine capacity | 64 (ext 80) | Max DPS | 111.1 |
| Ammo spawn | 128 | Max obstacle DPS | 111.1 |
| Reload time | 3 | Sustained DPS / magazine damage | 73.1 / 640 |
| Fire delay | 0.09 (667 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 1.05 / 1.41 / 1.77 / 2.13 |
| Standing / moving spread | 3.5 / 4.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.55 / 2.22 / ∞, 4.72 |
| Barrel length | 2.65 |  |  |

- **Placement:** floor 3 (tier band floor). SMG floor of maps with 9mm; not on Desert or Woods floors.
- **References:** `mp5`, `m1a1`.
- **Real weapon:** PP-19 Bizon: 9x18 Makarov, 680 rpm, 320 m/s, 64-round helical magazine, 2.1 kg (Wikipedia).
- **Why:** The magazine SMG of the floor: a slightly weaker MP5 (10 damage; 15 u A2 1.77 s against 1.66) with 64 rounds (3 A2 kills per magazine against 1) and more sustained DPS (73.1 against 70.2). Pays with a 3.0 s reload, 90 u of reach and a slow bullet.

#### Thompson M1928 (`m1928`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | SMG (50-round drum) | Damage | 13 |
| Ammo | .45 ACP (purple) | Falloff | 0.8 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | -0.5 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 95 |
| Carry speed (rebirth) | 0 | Speed | 82 |
| Magazine capacity | 50 (ext 100) | Max DPS | 149.4 |
| Ammo spawn | 150 | Max obstacle DPS | 149.4 |
| Reload time | 3.6 | Sustained DPS / magazine damage | 81.8 / 650 |
| Fire delay | 0.087 (690 rpm) | Speed carried / held / firing | 12 / 11.5 / 5.75 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.75 / 1.09 / 1.35 / 1.62 |
| Standing / moving spread | 4.5 / 5.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.18 / 2.07 / ∞, 5.07 |
| Barrel length | 2.85 |  |  |

- **Placement:** desert tier_guns 0.5, T1 1 (tier band floor + T1). Floor only on Desert (0.5): classic and faction maps carry no .45.
- **References:** `m1a1`, `ak47`, `fal`, `vss`.
- **Real weapon:** Thompson M1928A1: .45 ACP, 600-725 rpm, 285 m/s, 50-round L drum (100-round C drum), 4.9 kg (Wikipedia).
- **Why:** The M1A1's drum-fed parent, at 690 rpm after the review (0.095 -> 0.087, inside the real 600-725). 15 u A2 1.35 s: now above the floor AK-47 (1.41) and level with the FAL, as a tier 1 close-range gun must be. Past 25 u it trails the tier 1 rifles (40 u standing A2 2.07). 50-round drum (Firepower: 100), 11.5 / 5.75 u/s, 3.6 s reload.

#### AS Val (`asval`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Suppressed 9x39 automatic (SMG class) | Damage | 13.5 |
| Ammo | 9mm (yellow; the VSS's slot) | Falloff | 0.65 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 90 |
| Carry speed (rebirth) | 0 | Speed | 85 |
| Magazine capacity | 20 (ext 30) | Max DPS | 168.8 |
| Ammo spawn | 80 | Max obstacle DPS | 168.8 |
| Reload time | 2.3 | Sustained DPS / magazine damage | 69.2 / 270 |
| Fire delay | 0.08 (750 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.69 / 1.01 / 1.25 / 1.41 |
| Standing / moving spread | 3 / 5.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.07 / 1.47 / ∞, 6.64 |
| Barrel length | 2.85 |  |  |

- **Placement:** floor 0.05, T1 1.5 (tier band floor + T1). SMG class (9mm, SMG reach). Banned on Savannah (quality 1 SMG) and Woods; not on the Desert floor.
- **References:** `vss`, `grozas`, `ump9`, `scorpion`.
- **Real weapon:** AS Val: 9x39 mm subsonic, 800-900 rpm, 280-310 m/s, 20-round magazine, 2.5 kg; the VSS's automatic sibling (Wikipedia).
- **Why:** Review: 750 rpm (0.08 s) and 13.5 damage instead of 667 rpm and 15, so it fires faster than the MP5 as the real gun does and the heavy 9x39 still out-hits every 9x19 gun. 15 u A2 1.25 s body, 1.07 s with spread: between the Groza-S and the VSS. Steep falloff and 90 u reach make it a close-range gun; 20 rounds are one A2 kill.

#### P90 (`p90`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | SMG / PDW (bullpup, 50-round magazine) | Damage | 10 |
| Ammo | 5.7x28mm (pink, new `57mm`) | Falloff | 0.75 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 110 |
| Carry speed (rebirth) | 0 | Speed | 100 |
| Magazine capacity | 50 (ext 60) | Max DPS | 166.7 |
| Ammo spawn | 150 | Max obstacle DPS | 166.7 |
| Reload time | 2.9 | Sustained DPS / magazine damage | 84.7 / 500 |
| Fire delay | 0.06 (1000 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.72 / 0.96 / 1.2 / 1.44 |
| Standing / moving spread | 4 / 4 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.05 / 1.69 / 7.84, 3.92 |
| Barrel length | 2.4 |  |  |

- **Placement:** floor 0.02, T2 1.5 (tier band T2). Banned on Savannah (quality 1 SMG); not on the Desert floor.
- **References:** `vector`, `scorpion`, `honeybadger`.
- **Real weapon:** FN P90: 5.7x28 mm, 850-1,100 rpm, 715 m/s, 50-round magazine, 2.6 kg (Wikipedia).
- **Why:** The tier 2 PDW. Up close it sits just behind the Vector (15 u A2 1.20 s against 1.16) and ahead of the Honey Badger (1.24), with 50 rounds (2 A2 kills per magazine) and a fast bullet that still works at 40 u (body TTK 1.57 against the Vector's 3.38). Its ammo is its own and scarce.

### 2.4 Pistols

#### TEC-9 (`tec9`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Pistol (semi-auto, 32-round magazine) | Damage | 12 |
| Ammo | 9mm (yellow) | Falloff | 0.65 |
| Fire mode | Single | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 90 |
| Carry speed (rebirth) | 0 | Speed | 80 |
| Magazine capacity | 32 (ext 36) | Max DPS | 109.1 |
| Ammo spawn | 96 | Max obstacle DPS | 109.1 |
| Reload time | 2.2 | Sustained DPS / magazine damage | 67.1 / 384 |
| Fire delay | 0.11 (545 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.3 | TTK body A0 / A1 / A2 / A3 | 1.03 / 1.47 / 1.91 / 2.24 |
| Standing / moving spread | 5 / 6 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.59 / 3.38 / ∞, 9.37 |
| Barrel length | 2.3 |  |  |

- **Placement:** floor 3 (tier band floor). Pistol floor of every map that has 9mm; not on the Desert floor (no 9mm) or Woods.
- **References:** `m9`, `m93r`, `glock`.
- **Real weapon:** Intratec TEC-9: 9x19 mm, semi only, 360 m/s, 32-round magazine, 1.23-1.4 kg (Wikipedia).
- **Why:** The floor's magazine pistol: the M9's round (12 against 13 damage) at a similar rate, but 32 rounds (three unarmoured kills per magazine; it can kill A3 without reloading). Pays with spread 5 / 6 (M9 3 / 5), a slower bullet and a 2.2 s reload.

#### Dual TEC-9 (`tec9_dual`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Pistol, dual | Damage | 12 |
| Ammo | 9mm (yellow) | Falloff | 0.65 |
| Fire mode | Single | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 90 |
| Carry speed (rebirth) | 0 | Speed | 80 |
| Magazine capacity | 64 (ext 72) | Max DPS | 171.4 |
| Ammo spawn | 192 | Max obstacle DPS | 171.4 |
| Reload time | 4.2 | Sustained DPS / magazine damage | 88.5 / 768 |
| Fire delay | 0.07 (857 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.3 | TTK body A0 / A1 / A2 / A3 | 0.71 / 0.99 / 1.27 / 1.48 |
| Standing / moving spread | 7 / 5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.38 / 2.93 / ∞, 6.44 |
| Barrel length | 2.3 |  |  |

- **Placement:** second TEC-9 (tier band floor). No weight of its own: a second TEC-9 makes it.
- **References:** `m9_dual`, `m93r_dual`, `glock_dual`.
- **Real weapon:** Two TEC-9s.
- **Why:** 64 rounds at 0.07 s. It kills like the Dual M9 (15 u A2 1.27 s against 1.26) with twice the rounds. Sustained DPS 88.5 is above the floor pistols (Dual M93R 71.4) but under the MAC-10's 91.4; paid with the longest pistol reload (4.2 s, the survev dual ratio of 1.9x) and spread 7 / 5.

#### Škorpion vz. 61 (`vz61`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Machine pistol (folding stock) | Damage | 9 |
| Ammo | 9mm (yellow; .32 ACP has no ammo of its own) | Falloff | 0.55 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 55 |
| Carry speed (rebirth) | 0 | Speed | 72 |
| Magazine capacity | 20 (ext 30) | Max DPS | 120 |
| Ammo spawn | 60 | Max obstacle DPS | 120 |
| Reload time | 1.6 | Sustained DPS / magazine damage | 58.1 / 180 |
| Fire delay | 0.075 (800 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.25 | TTK body A0 / A1 / A2 / A3 | 1.06 / 1.44 / 3.41 / 3.71 |
| Standing / moving spread | 6 / 5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 2.23 / 7.4 / ∞, 13.86 |
| Barrel length | 2.2 |  |  |

- **Placement:** floor 2 (tier band floor). As the TEC-9.
- **References:** `glock`, `mac10`.
- **Real weapon:** Škorpion vz. 61: .32 ACP, about 850 rpm, 20-round magazine, 1.3 kg, folding stock (Wikipedia).
- **Why:** The accurate machine pistol, the G18C's opposite: spread 6 / 5 against 12 / 10, reach 55 against 44, 20 rounds, but 800 rpm (A0 1.06 s against 0.89). Against A1 it is far better (1.44 s against 3.2) because its kill fits in one magazine; against A2 neither does. Quickest reload of the new guns (1.6 s).

#### Dual Škorpion vz. 61 (`vz61_dual`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Machine pistol, dual | Damage | 9 |
| Ammo | 9mm (yellow) | Falloff | 0.55 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 55 |
| Carry speed (rebirth) | 0 | Speed | 72 |
| Magazine capacity | 40 (ext 60) | Max DPS | 225 |
| Ammo spawn | 120 | Max obstacle DPS | 225 |
| Reload time | 3.3 | Sustained DPS / magazine damage | 73.5 / 360 |
| Fire delay | 0.04 (1500 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.25 | TTK body A0 / A1 / A2 / A3 | 0.64 / 0.84 / 1.04 / 1.2 |
| Standing / moving spread | 9 / 8 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.28 / 7.87 / ∞, 16.2 |
| Barrel length | 2.2 |  |  |

- **Placement:** second vz. 61 (tier band floor). No weight of its own: a second vz. 61 makes it.
- **References:** `glock_dual`.
- **Real weapon:** Two vz. 61s.
- **Why:** 40 rounds at 0.04 s (225 max DPS against the Dual G18C's 300), but far tighter: E[TTK] standing at 15 u A2 1.28 s against 4.47. Sustained DPS 73.5 is 2 above the floor pistol top; accepted because it needs two copies and reloads in 3.3 s.

### 2.5 Shotguns

#### DP-12 (`dp12`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Shotgun (double-barrel pump, 2 shots per pump) | Damage | 12.5 x 9 pellets |
| Ammo | 12 gauge (red), buckshot | Falloff | 0.3 |
| Fire mode | Pump (2 shots per pump) | Headshot multiplier | 1.5 |
| Player speed | 0 | Obstacle multiplier | 1 |
| Recoil speed | 0 | Distance | 27 |
| Carry speed (rebirth) | 0 | Speed | 66 |
| Magazine capacity | 14 (ext 16) | Max DPS | 250 |
| Ammo spawn | 28 | Max obstacle DPS | 250 |
| Reload time | 1.2 per 2 (full 8.4) | Sustained DPS / magazine damage | 107.1 / 1575 |
| Fire delay | 0.2 between barrels, pump 0.7 (133 rpm average) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.9 | TTK body A0 / A1 / A2 / A3 | 0.37 / 0.37 / 1.07 / 1.07 |
| Standing / moving spread | 10 / 3 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.14 / ∞ / ∞, ∞ |
| Barrel length | 2.8 |  |  |

- **Placement:** tier_shotguns 0.05, T2 1 (tier band T2). Shotgun bans (Savannah). Floor via tier_shotguns 0.05 (Woods floor allows shotguns).
- **References:** `m870`, `mp220`, `saiga`, `spas16`.
- **Real weapon:** Standard Manufacturing DP-12: 12 gauge, two barrels fired by two trigger pulls, one pump cycles both, 14-16 shells in two tubes, 4.2 kg (Wikipedia).
- **Why:** Two shots 0.2 s apart, then a 0.7 s pump. The fastest opener against light armour (A0 0.37 s), but against A2 the third shot waits for the pump (1.07 s; Saiga-12 0.96, SPAS-16 0.82). 14 shells give 4 A2 kills per load; the full reload is 8.4 s (2 shells per 1.2 s).

#### AA-12 (`aa12`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Shotgun (full auto, slugs only) | Damage | 64 |
| Ammo | 12 gauge (red), slugs | Falloff | 0.8 |
| Fire mode | Auto | Headshot multiplier | 1.25 |
| Player speed | -0.5 | Obstacle multiplier | 1 |
| Recoil speed | -0.5 | Distance | 60 |
| Carry speed (rebirth) | 0 | Speed | 115 |
| Magazine capacity | 8 (ext 10) | Max DPS | 213.3 |
| Ammo spawn | 24 | Max obstacle DPS | 213.3 |
| Reload time | 3.2 | Sustained DPS / magazine damage | 91.4 / 512 |
| Fire delay | 0.3 (200 rpm) | Speed carried / held / firing | 12 / 11.5 / 5.5 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.39 / 0.69 / 0.69 / 0.99 |
| Standing / moving spread | 5 / 5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 0.69 / 2.04 / ∞, 6.22 |
| Barrel length | 3.5 |  |  |

- **Placement:** gold 0.5 (tier band gold). Gold only in practice (not goldOnly-flagged); not on Savannah (shotgun ban).
- **References:** `m1014`, `spas16`, `saiga`, `ash12`.
- **Real weapon:** MPS AA-12: 12 gauge full auto, 300 rpm, 8-round box, 5.2 kg; very low felt recoil (Wikipedia).
- **Why:** The gold slug shotgun: 64-damage slugs at 300 rpm kill A0 in 2 hits and A2 in 3 (0.69 s, the fastest 15 u body kill of any gun; the ASh-12 needs 0.73). It is the weakest gold gun past 30 u (40 u standing A2 2.04), with an 8-round box and 11.5 / 5.5 u/s.

### 2.6 Sniper rifles

#### WA2000 (`wa2000`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Sniper rifle, semi-auto bullpup | Damage | 72 |
| Ammo | .50 AE (black; shared with the DEagle, S&W 500, ASh-12, Barrett, Hecate, Lynx) | Falloff | 0.95 |
| Fire mode | Single | Headshot multiplier | 1.25 |
| Player speed | -0.5 | Obstacle multiplier | 1.5 |
| Recoil speed | -2 | Distance | 450 |
| Carry speed (rebirth) | 0 | Speed | 185 |
| Magazine capacity | 5 (ext 6) | Max DPS | 65.5 |
| Ammo spawn | 25 | Max obstacle DPS | 98.2 |
| Reload time | 3.3 | Sustained DPS / magazine damage | 40.9 / 360 |
| Fire delay | 1.1 (55 rpm) | Speed carried / held / firing | 12 / 11.5 / 4.75 |
| Switch delay | 1 | TTK body A0 / A1 / A2 / A3 | 1.16 / 2.26 / 2.26 / 3.36 |
| Standing / moving spread | 0.75 / 3 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 2.23 / 2.37 / 2.69, 3.1 |
| Barrel length | 3.6 |  |  |

- **Placement:** T2 0.5 (tier band T2). Sniper class (legal on Savannah). Tier 2 only.
- **References:** `sv98`, `mosin`, `mk14`, `barrett`.
- **Real weapon:** Semi-auto bullpup; .300 Win Mag (5 rounds), 7.62x51 or 7.5x55 (6 rounds); 650 mm barrel, 6.95 kg (Wikipedia Walther WA 2000).
- **Why:** A tier 2 semi-auto magnum. Review: damage 72 (the Mosin's 2 / 3 / 3 / 4 shots), 1.1 s per shot and the .300 Win Mag's 5 rounds. E[TTK] at 15 u against A0-A3 is 1.16 / 1.95 / 2.23 / 2.93; the SV-98 has 1.56 / 1.56 / 2.64 / 3.06, so each wins somewhere. The Mk 14 wins to 100 u, the WA2000 from 150 u (A2 2.96 against 3.64). Out of gold, where it was the weakest gun.

#### M200 Intervention (`m200`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Sniper rifle (bolt action) | Damage | 115 |
| Ammo | 7.62mm (blue) | Falloff | 0.97 |
| Fire mode | Single | Headshot multiplier | 1.25 |
| Player speed | -1 | Obstacle multiplier | 2 |
| Recoil speed | -2 | Distance | 550 |
| Carry speed (rebirth) | 0 | Speed | 214 |
| Magazine capacity | 7 (ext 9) | Max DPS | 71.9 |
| Ammo spawn | 21 | Max obstacle DPS | 143.8 |
| Reload time | 3.5 | Sustained DPS / magazine damage | 54.8 / 805 |
| Fire delay | 1.6 (38 rpm) | Speed carried / held / firing | 12 / 11 / 4.5 |
| Switch delay | 1 | TTK body A0 / A1 / A2 / A3 | 0.05 / 1.65 / 1.65 / 1.65 |
| Standing / moving spread | 0.5 / 4 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.65 / 1.76 / 2.04, 3.1 |
| Barrel length | 4 |  |  |

- **Placement:** T2 0.25, gold 0.5 (tier band T2 + gold). Sniper class. Gold 0.5 plus rare tier 2 0.25.
- **References:** `sv98`, `awc`, `barrett`.
- **Real weapon:** CheyTac M200: .408 CheyTac, bolt action, 7-round box, 914 m/s, 14.1 kg (Wikipedia).
- **Why:** One hit kills an unarmoured target at any range (115 x 0.97); two hits kill every armour level (15 u A2 1.65 s, level with the AWM-S's 1.58). Review: bullet speed 214 (the .408's real velocity, the Barrett's value). Common 7.62 and 7 rounds make it the best sniper outside gold; it pays with 11 / 4.5 u/s and a 3.5 s reload.

#### Hécate II (`hecate`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Sniper rifle (bolt action, .50) | Damage | 160 |
| Ammo | .50 AE (black) | Falloff | 0.975 |
| Fire mode | Single | Headshot multiplier | 1 |
| Player speed | -1 | Obstacle multiplier | 2.5 |
| Recoil speed | -3 | Distance | 500 |
| Carry speed (rebirth) | 0 | Speed | 207 |
| Magazine capacity | 7 (ext 9) | Max DPS | 91.4 |
| Ammo spawn | 21 | Max obstacle DPS | 228.6 |
| Reload time | 4 | Sustained DPS / magazine damage | 68.9 / 1120 |
| Fire delay | 1.75 (34 rpm) | Speed carried / held / firing | 12 / 11 / 4 |
| Switch delay | 1 | TTK body A0 / A1 / A2 / A3 | 0.05 / 0.05 / 1.8 / 1.8 |
| Standing / moving spread | 0.75 / 4.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.8 / 1.92 / 2.21, 4.24 |
| Barrel length | 4.1 |  |  |

- **Placement:** gold 0.5 (tier band gold). goldOnly. Presentation donor is the Barrett once the survev port lands (AWM-S until then).
- **References:** `awc`, `barrett`.
- **Real weapon:** PGM Hécate II: .50 BMG, bolt action, 7-round box, 825 m/s, 13.8 kg (Wikipedia).
- **Why:** One hit kills A0 and A1 (the M200 and Lynx cannot), two hits on A2 / A3 (1.80 s). Review: headshot multiplier 1.0 like the AWM-S, so a headshot no longer one-shots A2 and it stops beating the AWM-S everywhere: the AWM-S is now faster against A2 at 15-100 u (1.58 against 1.80 s at 15 u). The Hécate keeps the A1 one-shot, 7 rounds, 500 u and obstacle x2.5.

#### Lynx (`lynx`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Anti-materiel rifle (semi-auto bullpup, .50) | Damage | 118 |
| Ammo | .50 AE (black) | Falloff | 0.975 |
| Fire mode | Single | Headshot multiplier | 1.25 |
| Player speed | -0.5 | Obstacle multiplier | 4 |
| Recoil speed | -4 | Distance | 400 |
| Carry speed (rebirth) | 0 | Speed | 214 |
| Magazine capacity | 5 (ext 6) | Max DPS | 98.3 |
| Ammo spawn | 20 | Max obstacle DPS | 393.3 |
| Reload time | 4.2 | Sustained DPS / magazine damage | 57.8 / 590 |
| Fire delay | 1.2 (50 rpm) | Speed carried / held / firing | 12 / 11.5 / 3.75 |
| Switch delay | 1 | TTK body A0 / A1 / A2 / A3 | 0.05 / 1.25 / 1.25 / 1.25 |
| Standing / moving spread | 1.25 / 4.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.25 / 1.37 / 1.77, 3.93 |
| Barrel length | 3.6 |  |  |

- **Placement:** gold 0.5 (tier band gold). goldOnly. Presentation donor is the Barrett once the survev port lands (AWM-S until then).
- **References:** `barrett`, `awc`, `m200`.
- **Real weapon:** Gepárd GM6 Lynx (PUBG's Lynx AMR): .50 BMG long-recoil semi-auto bullpup, 5 rounds, about 11.5 kg (maker).
- **Why:** PUBG's 118 damage: one hit kills A0, two hits kill any armour in 1.25 s (the best A3 time of any sniper), and obstacle x4 (472) clears almost any cover. Pays with 5 rounds, a 4.2 s reload, 3.75 u/s while firing and the widest gold-sniper spread.

#### Boys AT Rifle (`boys`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Anti-tank rifle (bolt action, single use: 7 shots) | Damage | 96 |
| Ammo | none (7 charges) | Falloff | 0.95 |
| Fire mode | Single | Headshot multiplier | 1.25 |
| Player speed | -1.5 | Obstacle multiplier | 4 |
| Recoil speed | -3 | Distance | 350 |
| Carry speed (rebirth) | 0 | Speed | 165 |
| Magazine capacity | 7 charges, no extension | Max DPS | 64 (single use) |
| Ammo spawn | 0 | Max obstacle DPS | 256 |
| Reload time | none (discarded when empty) | Sustained DPS / magazine damage | 64 / 672 |
| Fire delay | 1.5 (40 rpm) | Speed carried / held / firing | 12 / 10.5 / 3.75 |
| Switch delay | 1 | TTK body A0 / A1 / A2 / A3 | 1.56 / 1.56 / 1.56 / 3.06 |
| Standing / moving spread | 1.5 / 5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.56 / 1.71 / ∞, ∞ |
| Barrel length | 4.2 |  |  |

- **Placement:** T2 0.75 (tier band T2). Sniper class. Tier 2 only.
- **References:** `barrett`, `sv98`, `mosin`.
- **Real weapon:** Boys anti-tank rifle: .55 Boys, bolt action, 5-round box, 747 m/s, 16 kg (Wikipedia); owner: 7 shots, then discarded.
- **Why:** 96 damage puts it on the Barrett's thresholds (2 / 2 / 2 / 3 hits): 1.56 s against A2, twice as fast as the SV-98. Seven shots with no reload, then the rifle is discarded (at most 3 armoured kills). Review: out of tier 1 and the floor; tier 2 only.

### 2.7 LMGs

#### M60 (`m60`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Light machine gun (belt-fed) | Damage | 16 |
| Ammo | 7.62mm (blue) | Falloff | 0.9 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | 0 | Obstacle multiplier | 1.75 |
| Recoil speed | -4 | Distance | 225 |
| Carry speed (rebirth) | 0 | Speed | 124 |
| Magazine capacity | 100 (ext 150) | Max DPS | 145.5 |
| Ammo spawn | 200 | Max obstacle DPS | 254.5 |
| Reload time | 6.5 | Sustained DPS / magazine damage | 91.4 / 1600 |
| Fire delay | 0.11 (545 rpm) | Speed carried / held / firing | 12 / 12 / 4 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.74 / 1.07 / 1.29 / 1.51 |
| Standing / moving spread | 2.5 / 8 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 1.12 / 1.33 / 3.09, 4.02 |
| Barrel length | 3.8 |  |  |

- **Placement:** floor 0.02, T2 1 (tier band T2). LMG class (Woods floor allows it).
- **References:** `pkp`, `m249`, `bar`, `qbb97`.
- **Real weapon:** M60: 7.62x51 mm, 550-650 rpm, 100-round belts, 853 m/s, 10.5 kg (Wikipedia).
- **Why:** The tier 2 belt gun: 16 damage at 545 rpm, 100 rounds. It kills A2 as fast as the BAR (1.29 s) with 8 kills per belt, but fires at 4 u/s and reloads in 6.5 s. Stays under the gold PKP / M249 (1.09 / 1.12) as the owner wants.

#### MG 42 (`mg42`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Light machine gun (50-round drum) | Damage | 11 |
| Ammo | 7.62mm (blue) | Falloff | 0.9 |
| Fire mode | Auto | Headshot multiplier | 2 |
| Player speed | -0.5 | Obstacle multiplier | 1.5 |
| Recoil speed | -5 | Distance | 200 |
| Carry speed (rebirth) | 0 | Speed | 108 |
| Magazine capacity | 50 (ext 75) | Max DPS | 177.4 |
| Ammo spawn | 150 | Max obstacle DPS | 266.1 |
| Reload time | 4 | Sustained DPS / magazine damage | 77.5 / 550 |
| Fire delay | 0.062 (968 rpm) | Speed carried / held / firing | 12 / 11.5 / 3.25 |
| Switch delay | 0.75 | TTK body A0 / A1 / A2 / A3 | 0.65 / 0.9 / 1.09 / 1.27 |
| Standing / moving spread | 3.5 / 9 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 0.95 / 1.28 / 4.8, 6.72 |
| Barrel length | 3.9 |  |  |

- **Placement:** floor 0.005, T2 0.75 (tier band T2). LMG class. Not in gold.
- **References:** `pkp`, `m249`, `bar`, `scar`.
- **Real weapon:** MG 42: 7.92x57 Mauser, 900-1,500 rpm depending on the bolt, 50-round drum, 740 m/s, 11.6 kg (Wikipedia).
- **Why:** Review: 11 damage at 0.062 s (968 rpm) instead of 9 at 0.05, so the full-power 7.92 round hits like the other rifle rounds and DPS stays put (177 against 180). Up close it matches the PKP (15 u A2 1.09); the 50-round drum, sustained DPS 77.5 and the worst moving accuracy of any LMG (40 u moving A2 6.72) keep it in tier 2.

#### DShK (`dshk`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Heavy machine gun (carried, hip-fired) | Damage | 34 |
| Ammo | 7.62mm (blue; damage set as a 12.7 mm gun) | Falloff | 0.92 |
| Fire mode | Auto | Headshot multiplier | 1.5 |
| Player speed | -1 | Obstacle multiplier | 2.5 |
| Recoil speed | -5 | Distance | 300 |
| Carry speed (rebirth) | -2 | Speed | 125 |
| Magazine capacity | 30 (ext 30) | Max DPS | 283.3 |
| Ammo spawn | 60 | Max obstacle DPS | 708.3 |
| Reload time | 7.5 | Sustained DPS / magazine damage | 91.9 / 1020 |
| Fire delay | 0.12 (500 rpm) | Speed carried / held / firing | 10 / 9 / 2 |
| Switch delay | 1 | TTK body A0 / A1 / A2 / A3 | 0.32 / 0.56 / 0.68 / 0.8 |
| Standing / moving spread | 3.5 / 10.5 | E[TTK] A2: stand 15 / 40 / 100 u, move 40 u | 0.61 / 0.87 / 2.67, 4.55 |
| Barrel length | 4.4 |  |  |

- **Placement:** gold 0.08 (tier band gold). goldOnly.
- **References:** `pkp`, `m249`, `ash12`.
- **Real weapon:** DShK: 12.7x108 mm, 600 rpm, 850 m/s, 34 kg gun alone (Wikipedia); owner: 30-round box.
- **Why:** The fastest-killing automatic: 34 damage (3 hits kill A0), 15 u A2 0.68 s, out to 300 u. The owner's 'very heavy' is now real: carry -2, equip -1, attack -5 (10 u/s with it in a slot, 9 held, 2 firing, 11 with fists out), a 7.5 s reload, a 1 s switch and a 30-round box that Firepower does not extend. Gold only at the PKP's weight (0.08).

### 2.8 Launchers

#### M79 (`m79`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Grenade launcher (break action, lobbed 40 mm frag) | Damage | 0 + 125 explosion (rad 5-12) + 12 x 20 shrapnel |
| Ammo | 40mm (teal, new) | Falloff | none (explosion) |
| Fire mode | Single | Headshot multiplier | 1 |
| Player speed | 0 | Obstacle multiplier | explosion x1.1 |
| Recoil speed | 0 | Distance | 52 |
| Carry speed (rebirth) | 0 | Speed | 40 |
| Magazine capacity | 1 (ext 1) | Max DPS | 416.7 (per reload cycle 48.1) |
| Ammo spawn | 10 | Max obstacle DPS | 458.3 |
| Reload time | 2.3 | Sustained DPS / magazine damage | 48.1 / 125 |
| Fire delay | 0.3 (one round, then the reload: 1 shot per 2.6 s) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.9 | Direct-hit kill chance A0/1/2/3 (shrapnel) | 100 % / 99 % / 87 % / 53 % |
| Standing / moving spread | 1 / 2 | Self-damage free from | 14.1 u (shooter to target centre) |
| Barrel length | 2 |  |  |

- **Placement:** floor 0.02, T1 0.5, T2 1 (tier band T1 + T2). Launchers: airdrops on every map, floor only on Main and Desert.
- **References:** `potato_cannon`, `explosion_frag`.
- **Real weapon:** M79: 40x46 mm, 2.93 kg loaded, 76 m/s, M406 HE lethal radius 5 m (Wikipedia); game values from the original surviv v0.9.1 M79 (fandom).
- **Why:** The launcher reference: the original M79's reload 2.3, switch 0.9, 10 rounds and 125-damage frag (x1.0, not the rebirth frag x1.3). A direct hit kills A2 87 % of the time with shrapnel; the lob flies over crates and stones. Review: ignoreEndlessAmmo, so Endless Ammo cannot give unlimited grenades.

#### Milkor MGL (`mgl`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Grenade launcher (6-round revolver) | Damage | 0 + 125 explosion (rad 5-12) + 12 x 20 shrapnel |
| Ammo | 40mm (teal, new) | Falloff | none (explosion) |
| Fire mode | Single | Headshot multiplier | 1 |
| Player speed | 0 | Obstacle multiplier | explosion x1.1 |
| Recoil speed | 0 | Distance | 52 |
| Carry speed (rebirth) | 0 | Speed | 40 |
| Magazine capacity | 6 (ext 6) | Max DPS | 178.6 (per reload cycle 73.5) |
| Ammo spawn | 12 | Max obstacle DPS | 196.4 |
| Reload time | 1 per 1 (full 6) | Sustained DPS / magazine damage | 73.5 / 750 |
| Fire delay | 0.7 (86 rpm) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 1 | Direct-hit kill chance A0/1/2/3 (shrapnel) | 100 % / 99 % / 87 % / 53 % |
| Standing / moving spread | 1.5 / 2.5 | Self-damage free from | 14.1 u (shooter to target centre) |
| Barrel length | 2.1 |  |  |

- **Placement:** gold 0.5 (tier band gold). goldOnly.
- **References:** `m79`.
- **Real weapon:** Milkor MGL: 40x46 mm, 6-round cylinder loaded one by one, 5.3 kg empty, 75 m/s (Wikipedia).
- **Why:** The gold area weapon: the M79's grenade every 0.7 s from a 6-round cylinder (1 s per chamber). Six direct hits are three A2 kills; 0.39 s per A2 kill with shrapnel when the grenades hit. Gold only, no Endless Ammo; its 40 mm also comes from M79 / GL-06 drops.

#### GL-06 (`gl06`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Grenade launcher (single shot, 40 mm airburst at the cursor) | Damage | 10 + 100 explosion (rad 4-10) + 6 x 20 shrapnel |
| Ammo | 40mm (teal, new) | Falloff | 1 |
| Fire mode | Single | Headshot multiplier | 1 |
| Player speed | 0 | Obstacle multiplier | bullet x1, explosion x1.1 |
| Recoil speed | 0 | Distance | 60 |
| Carry speed (rebirth) | 0 | Speed | 45 |
| Magazine capacity | 1 (ext 1) | Max DPS | 366.7 (per reload cycle 47.8) |
| Ammo spawn | 10 | Max obstacle DPS | 400 |
| Reload time | 2 | Sustained DPS / magazine damage | 47.8 / 110 |
| Fire delay | 0.3 (one round, then the reload: 1 shot per 2.3 s) | Speed carried / held / firing | 12 / 12 / 6 |
| Switch delay | 0.6 | Direct-hit kill chance A0/1/2/3 (shrapnel) | 100 % / 73 % / 15 % / 0 % |
| Standing / moving spread | 1 / 2.5 | Self-damage free from | 12.1 u (shooter to target centre) |
| Barrel length | 1.9 |  |  |

- **Placement:** floor 0.02, T1 0.5 (tier band T1). As the M79.
- **References:** `usas`, `m79`.
- **Real weapon:** B&T GL06: 40x46 mm single shot, 2.05 kg, 85 m/s (Wikipedia).
- **Why:** The tier 1 cover-buster: the round bursts at the cursor (or on the first thing it hits), with the smallest blast (100, rad 4-10, 6 shrapnel). It kills A0 with one burst but A2 only 15 % of the time; it is for flushing players out from behind crates and corners. Review: ignoreEndlessAmmo.

#### RPG-7 (`rpg7`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Rocket launcher (reusable) | Damage | 60 + 150 explosion (rad 6-14) + 12 x 20 shrapnel |
| Ammo | rocket (brown, new; only with the gun) | Falloff | 1 |
| Fire mode | Single | Headshot multiplier | 1 |
| Player speed | -2 | Obstacle multiplier | bullet x4, explosion x0.9 |
| Recoil speed | 0 | Distance | 120 |
| Carry speed (rebirth) | 0 | Speed | 85 |
| Magazine capacity | 1 (ext 1) | Max DPS | 700 (per reload cycle 55.3) |
| Ammo spawn | 4 | Max obstacle DPS | 1250 |
| Reload time | 3.5 | Sustained DPS / magazine damage | 55.3 / 210 |
| Fire delay | 0.3 (one round, then the reload: 1 shot per 3.8 s) | Speed carried / held / firing | 12 / 10 / 5 |
| Switch delay | 1 | Direct-hit kill chance A0/1/2/3 (shrapnel) | 100 % / 100 % / 100 % / 100 % |
| Standing / moving spread | 1 / 3 | Self-damage free from | 16.1 u (shooter to target centre) |
| Barrel length | 2.3 |  |  |

- **Placement:** gold 0.5 (tier band gold). goldOnly; rocket ammo in no loot table.
- **References:** `m79`, `barrett`.
- **Real weapon:** RPG-7: 40 mm launcher, 6.3-7 kg, PG-7 rockets at 115-295 m/s, OG-7V frag lethal radius 7 m (Wikipedia).
- **Why:** The gold rocket launcher: 60 direct + 150 blast + 12 shrapnel kills any armour with one direct hit (A3 with shrapnel) and breaches the wall, tree or stone it hits (375). Limited to its own 4 rockets (rocket ammo exists nowhere else), 85 u/s, 120 u; the 5 u arming distance stops point-blank suicides. Gold weight cut 1.5 -> 0.5.

#### Panzerfaust (`panzerfaust`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Recoilless launcher (single use) | Damage | 80 + 140 explosion (rad 4-9) + 4 x 20 shrapnel |
| Ammo | none (1 charge) | Falloff | 1 |
| Fire mode | Single | Headshot multiplier | 1 |
| Player speed | -1.5 | Obstacle multiplier | bullet x5, explosion x0.9 |
| Recoil speed | 0 | Distance | 40 |
| Carry speed (rebirth) | 0 | Speed | 35 |
| Magazine capacity | 1 charge, no extension | Max DPS | 440 (single use) |
| Ammo spawn | 0 | Max obstacle DPS | 1052 |
| Reload time | none (discarded when empty) | Sustained DPS / magazine damage | 440 / 220 |
| Fire delay | 0.5 (single use) | Speed carried / held / firing | 12 / 10.5 / 5.25 |
| Switch delay | 1 | Direct-hit kill chance A0/1/2/3 (shrapnel) | 100 % / 100 % / 100 % / 100 % |
| Standing / moving spread | 2 / 4 | Self-damage free from | 11.1 u (shooter to target centre) |
| Barrel length | 2.4 |  |  |

- **Placement:** floor 0.2 on every map but the potato modes whose floor has the flare gun (owner, 2026-10-08: "a downgraded M202 from ordinary loot", a little above the flare gun's 0.145; it was 0.02 on main and Desert only), T1 0.5 (tier band T1).
- **References:** `rpg7`.
- **Real weapon:** Panzerfaust 60: single-shot disposable launcher, 6.8 kg, 45 m/s, effective 60 m (Wikipedia).
- **Why:** One sure kill for tier 1: an 80 + 140 rocket at 35 u/s and 40 u kills any armour on a direct hit and breaks any obstacle (526), then the tube is discarded. Slow enough to dodge at range (7.4 u of strafe over 25 u). Tier 1 weight cut 1.0 -> 0.5.

#### M202 FLASH (`m202`)

| Field | Value | Bullet | Value |
|---|---|---|---|
| Gun type | Rocket launcher (4 tubes, one volley in a fixed 60° fan bursting at the cursor, single use) | Damage | 4 x (25 + 125 explosion (rad 5-16)) |
| Ammo | none (1 charge = 4 rockets) | Falloff | 1 |
| Fire mode | Single | Headshot multiplier | 1 |
| Player speed | -2.5 | Obstacle multiplier | bullet x2, explosion x42 (5250 at the centre) |
| Recoil speed | 0 | Distance | 75 (or the cursor, nearer) |
| Carry speed (rebirth) | 0 | Speed | 55 |
| Magazine capacity | 1 charge (4 rockets), no extension | Max DPS | 1200 (single use) |
| Ammo spawn | 0 | Max obstacle DPS | 42400 |
| Reload time | none (discarded when empty) | Sustained DPS / magazine damage | 1200 / 600 |
| Fire delay | 0.5 (single use) | Speed carried / held / firing | 12 / 9.5 / 4.75 |
| Switch delay | 1.1 | Volley kill, A2 at full health, anywhere across the strip at 15 / 20 / 25 u | yes / yes / yes |
| Standing / moving spread | 0 / 0 (fixed fan: -30 / -10 / 10 / 30°) | Self-damage free from | 17 u cursor distance (15 u: about 24 HP unarmoured; 12 u and nearer kills the shooter) |
| Barrel length | 2.2 | Recoil slide | 2 u back, against the aim |

- **Placement (owner, 2026-10-08):** T1 0.05, T2 0.05 ("barely ever"), gold main gun 0.25 ("occasionally", 1 gold crate in 112) and the gold crates' bonus roll 0.1 against nothing 0.9 ("sometimes", 1 gold crate in 10; `OWNER_LOOT_WEIGHTS` in `packages/defs/src/rebirth/ownerLootWeights.ts`). No floor.
- **References:** `rpg7`, `usas` (rounds that stop at the cursor).
- **Real weapon:** M202A1 FLASH: four 66 mm rockets, 12 kg loaded, 114 m/s (Wikipedia). Incendiary effect deferred.
- **Why (owner, 2026-10-08):** the endgame comeback weapon, a near-certain kill. One trigger pull fires all four rockets together in a fixed, evenly spaced 60° fan (no random spread, no pellet jitter; the beta fired the four at once with a random ±3° deviation each, ±5° moving, and random start offsets) that bursts at the cursor (`toMouseHit`, as the USAS-12 and GL-06). Neighbouring rockets are 20° apart, so their blast centres sit 2 d sin 10° apart: 5.2 u at 15 u, 6.9 u at 20 u, 8.7 u at 25 u, never more than the 10 u at which the full-damage discs (rad.min 5) would part, so the strip tiles with no gap from 15 to 25 u. Each blast deals 125 (two full ones kill a full-health A2 player: 2 x 125 x 0.546 = 136.5) with a 16 u reach (the rebirth frag's 15.6 is the next biggest player weapon; a normal air strike bomb's 17.5 stays bigger, as the owner asked on 2026-10-08: the bombs grew x1.25 rather than the M202 shrinking); a level 2 armoured player anywhere across the strip at 15-25 u dies (`packages/sim/test/m202.test.ts`). Explosion obstacle multiplier x42: one blast's full 5250 breaks every destructible obstacle (the toughest: the bunker glass wall `glass_wall_12_2` 5000, the potato silo 2500, the tyre 1500), plated ones included (`armorPiercing` / `stonePiercing`: the ammo crates `crate_04` / `crate_06`, the plated stones, statues, safes and `stone_wall_int_4`); indestructible obstacles (`destructible: false`: building exterior walls) stay whole. Destructible walls are the interior walls (house, cabin, barn, bank, police, mansion, hut, Reserve), shack and grassy walls, glass walls and archway columns. The shooter slides 2 u back (`recoilKnockback`, a damped slide pushed out of obstacles every tick). Its explosion has its own client effect, `m202`: a 1.6 u camera shake for 1.6 s, felt to 120 u (full within 30 u), off with the Screen shake setting.

## 3. Class ladders (survev baseline + new guns, TTK against armour)

New guns in **bold**. Sorted by tier (event, floor, T1, T2, gold), then TTK body 15 u A2. `rpm` is the average rate
(bursts and pumps included; one-round launchers include the reload). Speed = held / firing u/s. Launchers: calculator
direct hit, no shrapnel (section 4.4 has the shrapnel model).

### pistol

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| p30l_dual | event | 21 | 667 | 30 | 2.65 | 233.3 / 117.8 | 0.48 / 0.75 / 0.93 / 1.02 | 0.77 | 1.43 | 1.61 | 4.08 | 12 / 6 |
| m1911_dual | event | 16 | 706 | 14 | 3.6 | 188.2 / 46.8 | 0.66 / 0.91 / 1.08 / 4.94 | 1.05 | 4.83 | 8.22 | ∞ | 12 / 6 |
| p30l | event | 21 | 429 | 15 | 1.2 | 150 / 95.5 | 0.68 / 1.1 / 1.38 / 1.52 | 1.13 | 1.48 | 1.48 | 4.23 | 13 / 7 |
| m1911 | event | 16 | 462 | 7 | 2.1 | 123.1 / 37.2 | 0.93 / 3.42 / 3.68 / 6.17 | 3.49 | 3.93 | 7.34 | ∞ | 12 / 6 |
| ots38 | event | 32 | 167 | 5 | 2 | 88.9 / 42.1 | 1.18 / 1.54 / 3.9 / 4.26 | 2.55 | 2.9 | 3.91 | 4.48 | 12 / 6 |
| glock_dual | floor | 9 | 2000 | 34 | 3.8 | 300 / 63.5 | 0.53 / 0.71 / 0.86 / 0.98 | 4.47 | 24.2 | ∞ | ∞ | 12 / 6 |
| colt45_dual | floor | 29 | 462 | 12 | 5.1 | 223.1 / 52.3 | 0.5 / 0.76 / 0.89 / 1.02 | 3.02 | 18.2 | 22.09 | 60.12 | 12 / 6 |
| **vz61_dual** | floor | 9 | 1500 | 40 | 3.3 | 225 / 73.5 | 0.64 / 0.84 / 1.04 / 1.2 | 1.28 | 7.87 | 16.2 | ∞ | 12 / 6 |
| m9_dual | floor | 13 | 750 | 30 | 3.1 | 162.5 / 70.9 | 0.7 / 1.02 / 1.26 / 1.5 | 1.17 | 2.13 | 5.26 | 10.34 | 12 / 6 |
| **tec9_dual** | floor | 12 | 857 | 64 | 4.2 | 171.4 / 88.5 | 0.71 / 0.99 / 1.27 / 1.48 | 1.38 | 2.93 | 6.44 | ∞ | 12 / 6 |
| m93r_dual | floor | 12 | 692 | 40 | 3.3 | 138.5 / 71.4 | 0.74 / 1.18 / 1.44 / 1.7 | 1.61 | 4.07 | 9.59 | 18.2 | 12 / 6 |
| ot38_dual | floor | 26 | 300 | 10 | 3.8 | 130 / 44.8 | 0.71 / 1.11 / 1.51 / 1.71 | 1.29 | 2.15 | 5.95 | 6.01 | 12 / 6 |
| m9 | floor | 13 | 500 | 15 | 1.6 | 108.3 / 57.4 | 0.98 / 1.46 / 1.82 / 3.78 | 1.59 | 2.13 | 7.85 | 10.3 | 12 / 6 |
| **tec9** | floor | 12 | 545 | 32 | 2.2 | 109.1 / 67.1 | 1.03 / 1.47 / 1.91 / 2.24 | 1.59 | 3.38 | 9.37 | ∞ | 12 / 6 |
| m93r | floor | 12 | 500 | 20 | 1.8 | 100 / 59.4 | 0.94 / 1.58 / 1.94 / 2.3 | 1.62 | 3.3 | 7.42 | 13.02 | 12 / 6 |
| **vz61** | floor | 9 | 800 | 20 | 1.6 | 120 / 58.1 | 1.06 / 1.44 / 3.41 / 3.71 | 2.23 | 7.4 | 13.86 | ∞ | 12 / 6 |
| glock | floor | 9 | 1000 | 17 | 1.95 | 150 / 51.5 | 0.89 / 3.2 / 3.5 / 3.74 | 3.78 | 20.52 | 38.08 | ∞ | 12 / 6 |
| colt45 | floor | 29 | 500 | 6 | 3 | 241.7 / 46.8 | 0.47 / 0.71 / 3.83 / 3.95 | 5.27 | 21.65 | 26 | 68.41 | 12 / 6 |
| ot38 | floor | 26 | 150 | 5 | 2 | 65 / 32.5 | 1.31 / 4.11 / 4.91 / 5.31 | 4.14 | 4.71 | 6.66 | 5.95 | 12 / 6 |
| deagle_dual | T1 | 35 | 500 | 14 | 4 | 291.7 / 86.3 | 0.34 / 0.58 / 0.7 / 0.82 | 0.61 | 1.18 | 5.84 | 6.07 | 12 / 6 |
| deagle | T1 | 35 | 375 | 7 | 2.3 | 218.8 / 71.6 | 0.43 / 0.75 / 0.91 / 1.07 | 0.79 | 1.02 | 6.22 | 5.87 | 12 / 6 |
| ots38_dual | gold | 32 | 333 | 10 | 3.8 | 177.8 / 57.1 | 0.64 / 0.82 / 1 / 1.18 | 0.88 | 1.25 | 2.72 | 3.38 | 12 / 6 |
| sw500 | gold | 64 | 92 | 5 | 2.7 | 98.5 / 53.8 | 0.73 / 1.38 / 1.38 / 2.03 | 1.36 | 1.53 | 2.93 | 2.33 | 12.5 / 6.25 |

### smg

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| m1a1 | event | 13 | 632 | 30 | 2.8 | 136.8 / 69 | 0.81 / 1.19 / 1.47 / 1.76 | 1.28 | 3.47 | 8.82 | ∞ | 12 / 6 |
| vector45 | floor | 9.5 | 1364 | 25 | 1.6 | 215.9 / 88 | 0.62 / 0.89 / 1.06 / 2.84 | 0.93 | 3.62 | 9.25 | ∞ | 12 / 6 |
| mac10 | floor | 9.25 | 1333 | 32 | 1.8 | 205.6 / 91.4 | 0.65 / 0.92 / 1.1 / 1.32 | 1.05 | 7.62 | 16.51 | ∞ | 12 / 6 |
| mp5 | floor | 11 | 667 | 30 | 2 | 122.2 / 70.2 | 0.94 / 1.3 / 1.66 / 1.93 | 1.39 | 1.76 | 5.1 | 7.3 | 12 / 6 |
| **bizon** | floor | 10 | 667 | 64 | 3 | 111.1 / 73.1 | 1.05 / 1.41 / 1.77 / 2.13 | 1.55 | 2.22 | 4.72 | ∞ | 12 / 6 |
| ump9 | floor | 14.5 | 429 | 30 | 1.9 | 103.6 / 71.3 | 1.01 / 1.43 / 1.85 / 2.21 | 1.49 | 1.87 | 2.66 | 3.39 | 12 / 6 |
| **asval** | T1 (floor) | 13.5 | 750 | 20 | 2.3 | 168.8 / 69.2 | 0.69 / 1.01 / 1.25 / 1.41 | 1.07 | 1.47 | 6.64 | ∞ | 12 / 6 |
| **m1928** | T1 (floor) | 13 | 690 | 50 | 3.6 | 149.4 / 81.8 | 0.75 / 1.09 / 1.35 / 1.62 | 1.18 | 2.07 | 5.07 | ∞ | 11.5 / 5.75 |
| vector | T2 | 7.5 | 1579 | 33 | 1.6 | 197.4 / 86.7 | 0.66 / 0.93 / 1.16 / 1.35 | 0.99 | 1.74 | 5.77 | ∞ | 12 / 6 |
| **p90** | T2 | 10 | 1000 | 50 | 2.9 | 166.7 / 84.7 | 0.72 / 0.96 / 1.2 / 1.44 | 1.05 | 1.69 | 3.92 | 7.84 | 12 / 6 |
| scorpion | gold | 10.75 | 1091 | 30 | 2.2 | 195.5 / 83.8 | 0.61 / 0.83 / 1.05 / 1.22 | 0.91 | 1.46 | 5.13 | 7.76 | 12 / 6 |

### assault

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| an94 | event | 20 | 453 | 45 | 2.35 | 150.9 / 109.7 | 0.65 / 0.91 / 1.18 / 1.42 | 0.96 | 1.26 | 2.11 | 2.05 | 12 / 6 |
| groza | floor | 12.5 | 769 | 30 | 2.8 | 160.3 / 73 | 0.73 / 0.97 / 1.2 / 1.44 | 1.06 | 2.04 | 9.18 | 9.59 | 12 / 6 |
| hk416 | floor | 11 | 800 | 30 | 2.3 | 146.7 / 72.5 | 0.78 / 1.08 / 1.31 / 1.53 | 1.15 | 1.76 | 8.05 | 7.77 | 12 / 6 |
| **g36c** | floor | 11 | 750 | 30 | 2.1 | 137.5 / 73.3 | 0.83 / 1.15 / 1.39 / 1.71 | 1.23 | 1.52 | 5.38 | 6.3 | 12 / 6 |
| ak47 | floor | 13.5 | 600 | 30 | 2.5 | 135 / 73.6 | 0.81 / 1.11 / 1.41 / 1.71 | 1.23 | 1.49 | 6.32 | 4.18 | 12 / 6 |
| **ak74** | floor | 12 | 667 | 30 | 2.3 | 133.3 / 72 | 0.82 / 1.18 / 1.45 / 1.72 | 1.23 | 1.49 | 4.64 | 3.14 | 12 / 6 |
| grozas | T1 | 13 | 769 | 30 | 2.8 | 166.7 / 75.9 | 0.65 / 0.96 / 1.19 / 1.35 | 1.01 | 1.39 | 6.69 | 6.23 | 12 / 6 |
| **g3** | T1 (floor) | 17 | 522 | 20 | 2.8 | 147.8 / 66.7 | 0.67 / 1.02 / 1.25 / 1.48 | 1.09 | 1.32 | 5.9 | 3.29 | 12 / 5.5 |
| **sig550** | T1 (floor) | 13 | 698 | 30 | 2.7 | 151.2 / 73.9 | 0.7 / 1.04 / 1.3 / 1.47 | 1.08 | 1.33 | 4.09 | 2.23 | 12 / 5.75 |
| famas | T1 | 17 | 400 | 25 | 2.3 | 113.3 / 71.4 | 0.65 / 1.1 / 1.5 / 1.9 | 1.31 | 1.57 | 1.57 | 2.27 | 12 / 6 |
| **m16a4** | T1 (floor) | 17 | 400 | 30 | 2.5 | 113.3 / 72.9 | 0.7 / 1.15 / 1.52 / 1.9 | 1.33 | 1.55 | 1.72 | 2.1 | 12 / 6 |
| scar | T2 | 15 | 667 | 20 | 2.7 | 166.7 / 66.7 | 0.64 / 0.91 / 1.18 / 1.36 | 1 | 1.27 | 4.74 | 3.75 | 12 / 6 |
| **honeybadger** | T2 | 13 | 750 | 30 | 2.3 | 162.5 / 83 | 0.68 / 1 / 1.24 / 1.48 | 1.08 | 1.39 | 3.86 | 5.08 | 12 / 6 |
| ash12 | gold | 31 | 600 | 10 | 3.1 | 310 / 75.6 | 0.43 / 0.53 / 0.73 / 0.83 | 0.6 | 1.05 | 4.32 | ∞ | 11 / 5.5 |
| m4a1 | gold | 14 | 732 | 30 | 3.1 | 170.7 / 75.5 | 0.68 / 0.93 / 1.17 / 1.34 | 1 | 1.29 | 2.48 | 2.82 | 12 / 6 |

### shotgun

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| m1014 | event | 77 | 150 | 8 | 4.16 | 192.5 / 83.7 | 0.49 / 0.49 / 0.89 / 0.89 | 0.88 | 1.44 | 3.59 | ∞ | 12 / 6 |
| m1100 | floor | 4 x18 | 200 | 4 | 2.8 | 240 / 72 | 0.76 / 1.06 / 1.06 / 2.06 | 6.62 | ∞ | ∞ | ∞ | 12 / 6 |
| usas | floor | 12+42e | 120 | 10 | 2.9 | 108 / 68.4 | 0.64 / 1.14 / 1.64 / 2.14 | 1.64 | ∞ | ∞ | ∞ | 12 / 5.5 |
| mp220 | floor | 12.5 x9 | 300 | 2 | 2.7 | 562.5 / 72.6 | 0.37 / 0.37 / 3.27 / 3.27 | 3.36 | ∞ | ∞ | ∞ | 12 / 6 |
| spas12 | T1 | 8.75 x9 | 80 | 9 | 4.95 | 105 / 60.6 | 0.88 / 0.88 / 1.63 / 1.63 | 1.6 | 2.4 | 4.2 | ∞ | 12 / 6 |
| m870 | T1 | 12.5 x9 | 67 | 5 | 3.75 | 125 / 68.2 | 1.06 / 1.06 / 1.96 / 1.96 | 2.23 | ∞ | ∞ | ∞ | 12 / 6 |
| spas16 | T2 | 8.75 x9 | 171 | 6 | 2.9 | 225 / 94.5 | 0.47 / 0.47 / 0.82 / 0.82 | 0.8 | 1.73 | 2.83 | ∞ | 12 / 5.5 |
| saiga | T2 | 12.5 x9 | 150 | 5 | 2.5 | 281.3 / 125 | 0.56 / 0.56 / 0.96 / 0.96 | 1.02 | ∞ | ∞ | ∞ | 12 / 6 |
| **dp12** | T2 | 12.5 x9 | 133 | 14 | 8.4 | 250 / 107.1 | 0.37 / 0.37 / 1.07 / 1.07 | 1.14 | ∞ | ∞ | ∞ | 12 / 6 |
| **aa12** | gold | 64 | 200 | 8 | 3.2 | 213.3 / 91.4 | 0.39 / 0.69 / 0.69 / 0.99 | 0.69 | 2.04 | 6.22 | ∞ | 11.5 / 5.5 |

### dmr

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| scarssr | floor | 81 | 200 | 10 | 2.7 | 270 / 142.1 | 0.39 / 0.39 / 0.69 / 0.69 | 0.61 | 0.84 | 2.03 | 1.7 | 12 / 6 |
| svd | floor | 37 | 240 | 10 | 2.5 | 148 / 74 | 0.58 / 0.83 / 1.08 / 1.33 | 1.05 | 1.25 | 2.61 | 1.83 | 12 / 6 |
| mkg45 | floor | 29 | 353 | 13 | 2.1 | 170.6 / 87.5 | 0.6 / 0.94 / 1.11 / 1.27 | 0.97 | 1.3 | 6.23 | 6.4 | 12 / 6 |
| l86 | floor | 25 | 316 | 30 | 2.9 | 131.6 / 87.2 | 0.84 / 1.03 / 1.41 / 1.6 | 1.27 | 1.46 | 2.07 | 1.91 | 12 / 6 |
| vss | T1 | 24 | 375 | 20 | 2.3 | 150 / 87.3 | 0.73 / 1.05 / 1.21 / 1.53 | 1.16 | 1.4 | 2.13 | 2.99 | 12 / 6 |
| mk12 | T1 | 23 | 333 | 20 | 2.4 | 127.8 / 76.7 | 0.8 / 1.16 / 1.34 / 1.7 | 1.29 | 1.53 | 1.92 | 1.98 | 12 / 6 |
| **fal** | T1 (floor) | 26 | 333 | 20 | 2.6 | 144.4 / 83.9 | 0.63 / 0.99 / 1.35 / 1.53 | 1.19 | 1.4 | 3.01 | 2.24 | 12 / 6 |
| m39 | T1 | 28 | 261 | 20 | 2.5 | 121.7 / 78.9 | 0.77 / 1.23 / 1.46 / 1.69 | 1.32 | 1.52 | 2.51 | 2.09 | 12 / 6 |
| **mk14** | T2 | 25 | 375 | 20 | 2.9 | 156.3 / 82 | 0.73 / 0.89 / 1.21 / 1.37 | 1.09 | 1.3 | 4.48 | 2.11 | 12 / 5.25 |
| garand | gold | 44 | 261 | 8 | 2.1 | 191.3 / 89.3 | 0.53 / 0.76 / 0.99 / 0.99 | 0.88 | 1.06 | 1.7 | 1.47 | 12 / 6 |

### sniper

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| model94 | floor | 44 | 86 | 8 | 4 | 62.9 / 36.7 | 1.47 / 2.17 / 2.87 / 3.57 | 2.49 | 2.69 | 4.16 | 4.27 | 12 / 6 |
| blr | floor | 56 | 75 | 3 | 1.7 | 70 / 41 | 0.86 / 1.66 / 4.16 / 4.16 | 3.18 | 3.36 | 5.34 | 4.93 | 12 / 6 |
| scout_elite | T1 | 56 | 60 | 5 | 2.6 | 56 / 36.8 | 1.06 / 2.06 / 3.06 / 3.06 | 2.66 | 2.81 | 2.81 | 3.2 | 12 / 8.5 |
| **boys** | T2 | 96 | 40 | 7 | - | 64 / - | 1.56 / 1.56 / 1.56 / 3.06 | 1.56 | 1.71 | ∞ | ∞ | 10.5 / 3.75 |
| **wa2000** | T2 | 72 | 55 | 5 | 3.3 | 65.5 / 40.9 | 1.16 / 2.26 / 2.26 / 3.36 | 2.23 | 2.37 | 3.1 | 2.69 | 11.5 / 4.75 |
| sv98 | T2 | 80 | 40 | 10 | 2.7 | 53.3 / 45.2 | 1.56 / 1.56 / 3.06 / 3.06 | 2.64 | 2.78 | 3.25 | 3.11 | 12 / 6 |
| mosin | T2 | 72 | 34 | 5 | 3 | 41.1 / 30.6 | 1.81 / 3.56 / 3.56 / 5.31 | 3.52 | 3.66 | 5.23 | 4 | 12 / 6 |
| barrett | gold | 99 | 65 | 10 | 3.75 | 107 / 76.2 | 0.97 / 0.97 / 0.97 / 1.9 | 0.97 | 1.09 | 2.13 | 1.37 | 11 / 3.5 |
| **lynx** | gold | 118 | 50 | 5 | 4.2 | 98.3 / 57.8 | 0.05 / 1.25 / 1.25 / 1.25 | 1.25 | 1.37 | 3.93 | 1.77 | 11.5 / 3.75 |
| awc | gold | 180 | 40 | 5 | 3.6 | 120 / 81.1 | 0.08 / 0.08 / 1.58 / 1.58 | 1.58 | 1.76 | 3.13 | 2.2 | 12 / 6 |
| **m200** | gold (T2) | 115 | 38 | 7 | 3.5 | 71.9 / 54.8 | 0.05 / 1.65 / 1.65 / 1.65 | 1.65 | 1.76 | 3.1 | 2.04 | 11 / 4.5 |
| **hecate** | gold | 160 | 34 | 7 | 4 | 91.4 / 68.9 | 0.05 / 0.05 / 1.8 / 1.8 | 1.8 | 1.92 | 4.24 | 2.21 | 11 / 4 |

### lmg

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| imbel | floor | 12 | 652 | 40 | 2.1 | 130.4 / 83 | 0.85 / 1.21 / 1.49 / 1.77 | 1.26 | 1.56 | 3.97 | 4.72 | 12 / 5.5 |
| dp28 | T1 | 14 | 522 | 60 | 3.3 | 121.7 / 82.4 | 0.9 / 1.24 / 1.59 / 1.82 | 1.31 | 1.57 | 5.13 | 3.12 | 12 / 5 |
| **mg42** | T2 | 11 | 968 | 50 | 4 | 177.4 / 77.5 | 0.65 / 0.9 / 1.09 / 1.27 | 0.95 | 1.28 | 6.72 | 4.8 | 11.5 / 3.25 |
| bar | T2 | 17.5 | 500 | 20 | 2.7 | 145.8 / 68.6 | 0.69 / 1.05 / 1.29 / 1.53 | 1.12 | 1.35 | 6.64 | 3.01 | 12 / 5.25 |
| **m60** | T2 | 16 | 545 | 100 | 6.5 | 145.5 / 91.4 | 0.74 / 1.07 / 1.29 / 1.51 | 1.12 | 1.33 | 4.02 | 3.09 | 12 / 4 |
| qbb97 | T2 | 14 | 600 | 75 | 3.9 | 140 / 92.1 | 0.79 / 1.09 / 1.39 / 1.59 | 1.15 | 1.73 | 1.92 | 4.87 | 12 / 5 |
| **dshk** | gold | 34 | 500 | 30 | 7.5 | 283.3 / 91.9 | 0.32 / 0.56 / 0.68 / 0.8 | 0.61 | 0.87 | 4.55 | 2.67 | 9 / 2 |
| pkp | gold | 18 | 600 | 200 | 5 | 180 / 144 | 0.59 / 0.89 / 1.09 / 1.29 | 0.92 | 1.13 | 3.17 | 2.73 | 12 / 3.5 |
| m249 | gold | 14 | 750 | 100 | 6.7 | 175 / 95.2 | 0.64 / 0.88 / 1.12 / 1.28 | 0.93 | 1.15 | 2.45 | 1.92 | 12 / 4 |

### launcher

| gun | tier | dmg | rpm | mag | reload | max / sust DPS | TTK body 15u A0/1/2/3 | E stand 15u A2 | E stand 40u A2 | E move 40u A2 | E stand 100u A2 | speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **panzerfaust** | T1 | 80+140e | single | 1 | - | 440 / - | 0.33 / 0.33 / 0.33 / 0.33 | 0.33 | 1.05 | ∞ | ∞ | 10.5 / 5.25 |
| **gl06** | T1 | 10+100e | 26.1 | 1 | 2 | 366.7 / 47.8 | 0.27 / 2.57 / 2.57 / 2.57 | 2.57 | 3.12 | 3.88 | ∞ | 12 / 6 |
| **m79** | T2 (T1) | 0+125e | 23.1 | 1 | 2.3 | 416.7 / 48.1 | 0.3 / 2.9 / 2.9 / 2.9 | 2.9 | 4.25 | 6.64 | ∞ | 12 / 6 |
| **rpg7** | gold | 60+150e | 15.8 | 1 | 3.5 | 700 / 55.3 | 0.14 / 0.14 / 0.14 / 3.94 | 0.14 | 0.43 | 1.63 | 1.14 | 10 / 5 |
| **m202** | gold (T1, T2) | 25+125e x4 | single | 1 | - | 1200 / - | 0.22 / 0.22 / 0.22 / 0.22 | ∞ | ∞ | ∞ | ∞ | 9.5 / 4.75 |
| **mgl** | gold | 0+125e | 86 | 6 | 6 | 178.6 / 73.5 | 0.3 / 1 / 1 / 1 | 1 | 2.09 | 2.66 | ∞ | 12 / 6 |

### Long range: DMRs and snipers (E stand against A2 at 100 / 150 / 200 u)

| gun | tier | A0 100/150/200 | A2 100/150/200 | A2 move 100 |
|---|---|---|---|---|
| mk12 | T1 | 1.36 / 2.05 / 2.81 | 1.98 / 2.76 / 3.93 | 7.38 |
| m39 | T1 | 1.44 / 2.09 / 2.89 | 2.09 / 2.92 / 4.02 | 9.83 |
| **fal** | T1 | 1.52 / 2.62 / 3.68 | 2.24 / 3.71 / 5.71 | 11.31 |
| **mk14** | T2 | 1.55 / 2.45 / 3.46 | 2.11 / 3.64 / 5.8 | 15.01 |
| garand | gold | 1.06 / 1.41 / 1.75 | 1.47 / 1.82 / 2.17 | 7.49 |
| sv98 | T2 | 2.03 / 3.14 / 4.72 | 3.11 / 4.52 / 6.61 | 11.72 |
| mosin | T2 | 2.29 / 3.56 / 5.65 | 4 / 5.93 / 9.34 | 20.48 |
| **wa2000** | T2 | 1.62 / 1.89 / 2.82 | 2.69 / 2.96 / 4.41 | 13.94 |
| **boys** | T2 | ∞ / ∞ / ∞ | ∞ / ∞ / ∞ | ∞ |
| **m200** | gold | 0.44 / 0.68 / 0.91 | 2.04 / 2.28 / 2.51 | 12.67 |
| awc | gold | 0.7 / 1.07 / 1.44 | 2.2 / 2.57 / 2.94 | 13.78 |
| **hecate** | gold | 0.46 / 0.7 / 1.44 | 2.21 / 2.45 / 3.68 | 16.81 |
| **lynx** | gold | 0.51 / 1.43 / 2.47 | 1.77 / 3.6 / 5.91 | 16.43 |
| barrett | gold | 1.23 / 1.93 / 2.92 | 1.37 / 2.11 / 3.16 | 8.39 |
| **m16a4** | T1 | 1.55 / 2.38 / 3.28 | 2.1 / 3.23 / 4.53 | 5.97 |
| **sig550** | T1 | 1.66 / 2.58 / 3.65 | 2.23 / 3.9 / 6.71 | 13.99 |

### Tier order (owner: tier 1 < tier 2 < gold)

| tier | baseline guns | median TTK body 15u / E stand 15u / E stand 40u (A2) | with new guns | median (same) |
|---|---|---|---|---|
| floor | 27 | 1.44 / 1.49 / 2.15 | 43 | 1.39 / 1.29 / 2.07 |
| T1 | 11 | 1.46 / 1.31 / 1.53 | 17 | 1.35 / 1.19 / 1.52 |
| T2 | 8 | 1.29 / 1.12 / 1.73 | 17 | 1.24 / 1.12 / 1.71 |
| gold | 10 | 1.09 / 0.93 / 1.25 | 16 | 1.12 / 0.97 / 1.37 |

Medians fall from tier 1 to tier 2 to gold with the new guns in. Outside the all-class baseline band of their tier,
on purpose: AA-12 (gold, 0.69 s body: the gold shotgun, worst gold gun at 40 u), DShK (gold, 0.68 s: the heavy gun, paid
for with 10 / 9 / 2 u/s and a 7.5 s reload), M200 and Hécate (gold, 1.65 / 1.80 s against A2: A0 / A1 one-shots instead),
DP-12 (no reach at 40 u, as every buckshot gun). Within class, no new gun is dominated by a gun of the same or a
lower tier, apart from survev's own outliers (event P30L over the vz. 61, event AN-94 over the G3, the `tier_snipers`
SCAR-SSR over the Mk 14); the AN-94 therefore stays out of tier 1. Higher-tier wins remain where allowed (tier 2
Honey Badger over the floor M416, gold CZ-3A1 over the tier 1 AS Val).

## 4. New mechanics, by the numbers

### 4.1 Carry slowdown (DShK; plan 5.5)

`speed: { carry: -2, equip: -1, attack: -5 }`. `carry` applies while the gun sits in either gun slot and is summed
over both slots (two DShKs: carry -4). Small Arms replaces only the equip term (+1), never carry.

| state | speed (u/s) | PKP for comparison |
|---|---|---|
| in a slot, fists / melee out (melee equip +1) | 11 | 13 |
| in a slot, other gun held | 10 | 12 |
| held | 9 | 12 |
| firing | 2 | 3.5 |
| held / firing with Small Arms | 11 / 3 | 13 / 4 |

### 4.2 Charges and single use (Boys, Panzerfaust, M202; plan 5.3)

| gun | charges | shots per charge | ammo id (no bag row) | maxClip = extendedClip | reload | after the last shot | other flags |
|---|---|---|---|---|---|---|---|
| Boys | 7 | 1 | `boys_ammo` | 7 | none | discarded after its fire delay (1.5 s) | ignoreEndlessAmmo, noPotatoSwap |
| Panzerfaust | 1 | 1 rocket | `panzerfaust_ammo` | 1 | none | discarded after 0.5 s | ignoreEndlessAmmo, launcher flags |
| M202 FLASH | 1 | 4 rockets (bulletCount 4 in a fixed 60° fan, no jitter) | `m202_ammo` | 1 | none | discarded after 0.5 s | ignoreEndlessAmmo, launcher flags, recoil slide 2 u |

A dropped single-use gun keeps its remaining charges server-side; Firepower cannot add shots (integrity test
`extendedClip === maxClip === charges`); bots scale desire by `clip / charges`.

### 4.3 Pump every 2 (DP-12; plan 5.6)

- `fireDelay` 0.2 between the two barrels, `pumpDelay` 0.7 after the second shot (`sound.cycle`), so the cycle is
  0.2 + 0.7 = 0.9 s for two shots (average 0.45 s, 133 rpm). `pullDelay` 0.7 is kept for presentation only.
- Reload: 2 shells per action (`maxReload` 2) in 1.2 s; 14 shells = 7 actions = 8.4 s. Firepower: 16.
- Counter rule: a reload action leaves the gun ready for a fresh pair; switching away and back keeps the counter.
- Effect: A0 dies to the first pair (0.37 s); A2 needs the third shot after the pump (1.07 s).

### 4.4 Launchers and explosions (plan 5.4)

| gun | round | direct / explosion | rad min-max | shrapnel | obstacle (impact) | speed / range | arm distance | direct-hit kill chance A0/1/2/3 | self-damage free from | bot min range |
|---|---|---|---|---|---|---|---|---|---|---|
| m79 | lob (m79_grenade) | 0 / 125 | 5-12 | 12 x 20 | 139 | 40 / 52 | none (as the original) | 100 % / 99 % / 87 % / 53 % | 14.1 u | 15 u |
| mgl | lob (m79_grenade) | 0 / 125 | 5-12 | 12 x 20 | 139 | 40 / 52 | none (as the original) | 100 % / 99 % / 87 % / 53 % | 14.1 u | 15 u |
| gl06 | airburst at cursor | 10 / 100 | 4-10 | 6 x 20 | 120 | 45 / 60 | 4 u | 100 % / 73 % / 15 % / 0 % | 12.1 u | 13 u |
| rpg7 | rocket (bullet) | 60 / 150 | 6-14 | 12 x 20 | 375 | 85 / 120 | 5 u | 100 % / 100 % / 100 % / 100 % | 16.1 u | 17 u |
| panzerfaust | rocket (bullet) | 80 / 140 | 4-9 | 4 x 20 | 526 | 35 / 40 | 4 u | 100 % / 100 % / 100 % / 100 % | 11.1 u | 12 u |
| m202 | 4 rockets in a fixed 60° fan, bursting at the cursor | 25 / 125 (x4) | 5-16 | none | 5300 | 55 / 75 (or the cursor) | 5 u | volley: A2 dead anywhere across the strip at 15-25 u | 17 u | 18 u |

- Explosions use the sim's step falloff (full damage inside `rad.min`, then x (1 - s / rad.max)); armour reduces
  explosions as body hits (A2 takes 54.6 %); teammates are immune, the shooter is not.
- M202 volley (owner, 2026-10-08): the four blasts tile a strip across the cursor at 15-25 u and kill a full-health A2 player anywhere on it (2.8 above).
- Rockets and the GL-06 round get `noReflect` (they explode on metal) and `armDistance` (dud before it: no point-blank
  suicide). The 40 mm lob keeps the original rule (no arming; it explodes on any impact).
- Obstacles: RPG-7 (375) and Panzerfaust (526) breach the wall / tree / stone they hit; each M202 blast breaks every
  destructible obstacle it reaches at full damage (5250, plated ones too; owner, 2026-10-08); 40 mm takes 2 hits for a
  wall (as the frag). Indestructible obstacles (building exterior walls, plated vault doors) stay whole.
- `ignoreEndlessAmmo` on all six launchers (M79 and GL-06 added in review); `noDistAdj` on the four exploding
  bullets (the sim reads `rules.noDistAdjBullets`, so add the ids there or read the def field).

### 4.5 New ammo

| id | name | used by | bagSizes (5 levels) | loot tint / dark | tracer | spawn | other sources |
|---|---|---|---|---|---|---|---|
| `40mm` | 40mm Grenade | m79, gl06, mgl | 10 / 20 / 30 / 40 / 50 | 0x0CDDAB / 0x08997A (teal) | `40mm` (GL-06 round only) | M79 / GL-06 10, MGL 12 | none (not in ammo crates or `tier_airdrop_ammo`) |
| `rocket` | Rocket | rpg7 | 4 / 6 / 8 / 10 / 12 | 0x8B4513 / 0x5C2E0B (brown) | `rocket` (thick, brown) | RPG-7 4 (two stacks of 2) | none: in no loot table (integrity test) |
| `57mm` | 5.7×28mm | p90 | 100 / 200 / 300 / 400 / 500 | 0xFF5FB4 / 0xC23A86 (pink) | `57mm` (pink) | P90 150 (two stacks of 75) | `tier_ammo_crate` 0.5 x 50 where the P90 can appear (not Savannah) |

All three are `special: true` (shown in the HUD only when held), get a ping emote (`emote_ammo40mm`, `emote_ammorocket`,
`emote_ammo57mm`) and l10n ("40mm 유탄", "로켓", "5.7×28mm 탄"). The bag order on the wire changes: **bump
`PROTOCOL_SCHEMA_VERSION`** once for all three. With survev's 4-column `bagSizes` config, use the first four values.
Ammo per spawn in A2 kills (body hits): P90 7.9 (on a par with the tier 2 automatics), RPG-7 at most 4, M79 / GL-06
about 5 to 9 depending on shrapnel.

## 5. Loot placement (main) and shares

Weights on main; the other 20 maps get the same rows through `applyRebirthMapDefs` with the map rules of each block
(plan 4.1 map rules, 5.8). Every new id must be in `packages/defs/src/gunClasses.ts` **before** step 1 runs, or the
tier 2 rows silently land in tier 1 (classes as in section 2; launchers in the new `launcher` class).

| table | rows added |
|---|---|
| main `tier_guns` (floor) | ak74 1.5, g36c 1.2, m16a4 0.7, sig550 0.1, g3 0.2, honeybadger 0.02, fal 0.1, tec9 3, vz61 2, bizon 3, asval 0.05, p90 0.02, m79 0.02, gl06 0.02, panzerfaust 0.2 (owner, 2026-10-08: every flare gun floor, `ownerLoot.ts`), m60 0.02, mg42 0.005 |
| `tier_shotguns` | dp12 0.05 |
| desert `tier_guns` | m1928 0.5 (and the 9mm-free subset of the floor rows: no tec9, vz61, bizon, asval, p90) |
| `tier_airdrop_tier1` (appended after the derivation) | m16a4 1, sig550 1, g3 1, fal 1, m1928 1, asval 1.5, m79 0.5, gl06 0.5, panzerfaust 0.5, m202 0.05 (owner, 2026-10-08) |
| `tier_airdrop_uncommon` (-> tier 2, before the derivation) | honeybadger 0.75, mk14 0.75, wa2000 0.5, p90 1.5, dp12 1, m79 1, m202 0.05 (owner, 2026-10-08; was 0.2), m200 0.25, boys 0.75, m60 1, mg42 0.75, **spas16 1.0** (survev gun, see below) |
| `tier_airdrop_rare` (gold) | aa12 0.5, mgl 0.5, rpg7 0.5, m202 0.25, m200 0.5, hecate 0.5, lynx 0.5, dshk 0.08 |
| `tier_airdrop_gold_bonus` (rebirth, owner 2026-10-08: one more roll of every gold crate) | m202 0.1, nothing 0.9 |

- **Tier 1's tier 2 roll is recomputed after appending:** weight = (core + appended) x 0.1 / 0.9 = 20.76 / 9 = 2.307, so
  it stays 10 % on every map (test). Without that, plan 5.8 step 3 would dilute it to 5.7 %.
- **SPAS-16** (survev, wiki values): survev keeps it out of normal mode; the rebirth adds it to main / seasonal / desert
  `tier_airdrop_uncommon` at 1.0 (the slot of the dropped SPAS-15) with a `gunTiers` row `mainMap: true`.
- Gold-only (`goldOnly: true`, never potato-swapped or role-rolled): rpg7, mgl, hecate, lynx, dshk.

| table (main) | total | share |
|---|---|---|
| tier 1 | 23.07 (20.76 + roll 2.307) | new guns 34.7 %; launchers + single use 6.5 % (7.6 % with the roll) |
| tier 2 | 17.20 | new guns 54.9 % (incl. SPAS-16); launchers + single use 11.3 % |
| tier 1 (with the owner's 2026-10-08 rows: L86A2 1.25, M202 0.05) | 24.51 (22.06 + roll 2.451) | M202 0.2 % |
| tier 2 (owner: M202 0.2 -> 0.05) | 17.05 | M202 0.3 % |
| gold | 27.01 (22.68 + Barrett overlay 1 + 3.33) | survev's seven gold guns 84.0 %; snipers 20.4 %; launchers 4.6 %; PKP + M249 0.7 %; DShK 0.3 % |

## 6. Changelog of review decisions

Every problem and correction raised by the cross-class balance stage and the two reviews, with the decision.

| item | decision | change | reason |
|---|---|---|---|
| DShK placement | applied | tier 2 0.1 -> 0, gold 0.3 -> 0.08, `goldOnly` | It out-kills the PKP / M249 (0.68 s against 1.09 / 1.12 at 15 u A2); the owner's top LMGs must not be rarer than it. |
| DShK speed split | applied | carry -1 / equip -2 -> carry -2 / equip -1 | Makes 'slow while merely carried' real (11 u/s with melee out instead of 12; Small Arms no longer erases the held penalty); held 9 and firing 2 unchanged. |
| DShK fire delay | kept 0.12 | real 600 rpm would be 0.11 | 0.11 beats the gold ASh-12 by a clear margin; the gun is already the fastest automatic kill. |
| Mk 14 fire delay | applied | 0.15 -> 0.16 (375 rpm) | A tier 2 DMR out-killed the tier 2 SCAR-H at 15-40 u; now the SCAR-H wins there and the Mk 14 wins from 60 u. |
| Honey Badger fire delay | applied | 0.075 -> 0.08 (750 rpm) | It out-killed both tier 2 SMGs at their own range; now the P90 and Vector win inside 25 u. |
| Gold pool weights | applied (+ snipers) | rpg7 1.5 -> 0.5, mgl 1.0 -> 0.5, m202 0.75 -> 0.25, wa2000 0.75 -> 0, m200 1.0 -> 0.5, hecate / lynx 0.75 -> 0.5 | Launchers 10.5 % -> 4.6 % and snipers 23.4 % -> 20.4 % of gold rolls; survev's seven gold guns keep 84 %. The Barrett overlay (1) belongs to the survev port and is unchanged. |
| Tier 1 launcher share + tier 2 roll | applied | m79 / gl06 / panzerfaust 1.0 -> 0.5; roll recomputed after appending | One tier 1 crate in six held a launcher or single-use gun; now about one in thirteen (7.6 %). The roll stays 10 %. |
| WA2000 out of gold | applied | gold 0.75 -> 0 | Weakest gold gun (no one-shot, beaten by the Garand at every range). |
| WA2000 strength in tier 2 | applied | damage 75 -> 72, fire delay 0.9 -> 1.1 | It beat both tier 2 bolt rifles at every armour level and range; now the SV-98 wins on A1 and is close on A3. |
| WA2000 magazine | applied | 6 / 8 / 30 -> 5 / 6 / 25 | The .300 Win Mag WA2000 the stats model holds 5 rounds; no TTK change. |
| Boys placement | applied | tier 1 1.0 -> 0, floor 0.01 -> 0; tier 2 0.75 kept; damage 96 kept | Barrett thresholds (2 / 2 / 2 / 3) from a tier 1 crate were too strong; the realistic per-shot damage stays. |
| Boys: 7 shots from one magazine | decided | no reload pause | Owner: 7 shots, then discarded. |
| New ids in gunClasses.ts | applied (implementation rule) | all 30 ids + 2 duals before `applyRebirthMapDefs` step 1; test that main tier 2 holds the tier 2 rows | Otherwise tier 2 rows land in tier 1. |
| M1928 fire delay | applied | 0.095 -> 0.087 (690 rpm) | A tier 1 SMG was slower than the floor AK-47 up close; now 1.35 s against 1.41. |
| 40 mm and Endless Ammo | applied | `ignoreEndlessAmmo` on m79 and gl06 | The perk gave unlimited grenades. The MGL refilling from M79 / GL-06 40 mm is accepted (shared ammo); bots count 40 mm as MGL ammo. |
| AN-94 in tier 1 (plan row 28 option) | rejected | stays event-only | It would dominate the G3 and near-dominate three new tier 1 rifles. |
| SPAS-16 on main | applied | main / seasonal / desert `tier_airdrop_uncommon` 1.0 | The SPAS-15 was dropped for it, but survev keeps the SPAS-16 out of normal mode. |
| Hécate headshot multiplier | applied | 1.25 -> 1.0 | At 1.25 it was a strictly better AWM-S (A2 headshot one-shot, more rounds, more range). |
| MG 42 damage / rate | applied | 9 / 0.05 -> 11 / 0.062 (968 rpm) | A full-power 7.92 round dealt pistol damage; DPS stays about the same (177 against 180) and it is still the fastest-firing LMG. |
| MG 42 in gold | rejected | tier 2 0.75 only | Up close it already matches the PKP; it beats the PKP only on reload time. |
| AS Val rate / damage | applied | 0.09 / 15 -> 0.08 / 13.5 (750 rpm) | Real rate order AS Val > MP5 = Bizon restored; DPS unchanged (168.8). |
| M200 bullet speed | applied | 200 -> 214 | Bullet speed follows the real cartridge (.408 at 914 m/s is faster than the .50s); only travel time changes. |
| Rocket colour | applied | olive 0x556B2F -> brown 0x8B4513 (dark 0x5C2E0B); RPG fallback icon brown | Owner's colour list: brown rocket; olive is .308 Subsonic. |
| SPAS-15 rows in the plan doc | follow-up | remove from 4.1 row 5, 4.3, 4.4 and the section 8 table; Boys 10 -> 7 in 5.3; rocket colour in 5.7 | This sheet supersedes them; the plan doc edit is a separate commit (this stage writes only these two files). |
| FAL fire mode / class | decided | semi-auto, DMR class | Most service FALs were semi only; a full-auto FAL at real rate would beat every tier 1 and tier 2 rifle. |
| WA2000 class | decided | sniper | Semi-auto precision rifle like survev's Barrett; Savannah-legal either way. |
| Honey Badger tier | decided | tier 2 0.75 (+ floor 0.02) | Its numbers sit in the tier 2 band. |
| Mk 14 in gold | decided | no | A tier 2-strength DMR under the Garand. |
| AK-74 trade (DPS for accuracy) | decided | kept 12 / 0.09 | 12.5 damage would make it a strictly better AK-47. |
| G36C switch delay | decided | 0.6 -> 0.75 | Every survev rifle and SMG uses 0.75; its identity is spread and a 2.1 s reload. |
| Tier 1 rifle weights | decided | SIG 550, G3, FAL 1.0 each | The FAMAS / Groza-S weight. |
| Honey Badger suppression for bots | decided | no bot sound model in this pass | Client-only today (tracer fade, sound fallOff 3). |
| Muzzle-velocity estimates | accepted | G36C, Honey Badger, WA2000 | They only pick the bullet speed. |
| Lynx damage | decided | 118 (PUBG) | The owner's '링스' is PUBG's Lynx AMR; 99 would make it a half-magazine Barrett. |
| Headshot rule | decided | ours (`headshotMult > 1`) | The sim's current rule. Under survev's rule the AWM-S gains an A2 headshot kill and the Hécate (1.0) does not, so the AWM-S stays ahead either way. |
| Two DShKs | decided | carry summed (8 u/s with two) | Weight is weight; plan 5.5 as written. |
| Ammo stand-ins | accepted | M200 and DShK on 7.62, Hécate / Lynx / WA2000 on .50 AE | Owner decisions; drop weights keep the M200 and DShK rare. |
| barrelLength | accepted | from real overall length | Retune when held sprites arrive. |
| AS Val class | decided | SMG | 9mm and SMG reach; Savannah / Woods bans follow. |
| AA-12 placement | decided | gold 0.5 only | 0.69 s against A2 is gold strength; tier 2 already has three shotguns plus the SPAS-16. |
| 5.7×28 supply | decided | P90 150 + `tier_ammo_crate` 0.5 x 50 | Half the weight of .50 AE in crates keeps it scarce. |
| DP-12 capacity | decided | 14 (Firepower 16) | The 3-inch load; 16 would give 5 A2 kills per load. |
| Dual pistol sustained DPS | decided | kept (no reload trim) | Dual reloads already follow survev's 1.75-2x of the single; duals need two copies. |
| M1928 Firepower drum | decided | 100 (real C drum) | Firepower is a role perk. |
| DP-12 pump counter | decided | reload leaves a fresh pair; switching keeps the counter | Simple and readable. |
| Launcher `armDistance` | decided | yes: 5 u RPG-7 / M202, 4 u Panzerfaust / GL-06 | No point-blank rocket suicides; the 40 mm lob keeps the original no-arming rule. |
| M79 Player speed | superseded (2026-10-08) | -1 -> 0 | Realistic weight rule plus the launcher pose; the owner's change below replaces it. |
| Launcher Player speed (owner, 2026-10-08) | applied | m79 -1 -> 0, gl06 -1 -> 0, mgl -1.5 -> 0; rpg7 -2, panzerfaust -1.5, m202 -2.5 kept | Owner: every launcher slows its holder except the M79, GL-06 and Milkor (`user/2026-10-08-loot-speed`); held 12 u/s, firing 6. |
| M202 incendiary | decided | deferred | Needs a burning-area mechanic; explosion only for v1. |
| M202 volley (owner, 2026-10-08) | applied | random spread 6 / 4 and jitter 0.5 -> fixed 60° fan bursting at the cursor; explosion 50 rad 3.5-9 x1.1 -> 125 rad 5-16 x42 (plated obstacles too); 2 u recoil slide; own `m202` effect with the strongest shake | The endgame comeback weapon: a near-certain kill on anyone caught in the salvo, one-shotting trees, stones, crates and destructible walls. |
| M202 blast vs the air strike bomb (owner, 2026-10-08) | applied | M202 kept at 125 rad 5-16 in the 60° fan (a same-day shrink to rad 4-11 in a 52° fan, below the bomb's 5-14, was reverted); the air strike bombs grow x1.25 instead: `explosion_bomb_iron` rad 5-14 -> 6.25-17.5, the heavy shell 14-38 -> 17.5-47.5 | The owner: keep the M202 big and make the bombs bigger, so a normal bomb clearly outsizes a rocket (rebirth-deviations.md "Air strike bomb size"). |
| M202 / Panzerfaust loot (owner, 2026-10-08) | applied | M202 T1 0 -> 0.05, T2 0.2 -> 0.05, gold 0.25 kept + gold bonus roll 0.1; Panzerfaust floor 0.02 (main, Desert) -> 0.2 on every flare gun floor | The M202 barely ever in normal drops, sometimes a gold bonus; the Panzerfaust, a downgraded M202, from ordinary loot. |
| 40 mm in ammo crates | decided | no | Launchers stay scarce; their ammo comes with them. |
| MGL fire delay | decided | 0.7 (real 0.33) | A readable volley for a gold area weapon. |
| Bot tiers | deferred | bot workflows own `gunTiers.ts` | One tier row per new id travels with each merge (plan 5.9). |

## 7. Reproduce

From the session scratchpad's `balance` directory: `node final/final.ts` (all 96 guns, final values and placements;
`final/tables.md` holds the dominance and tier-envelope checks), `python3 final/loot.py` (shares), `node final/gen.ts
<dir>` (this file, the JSON and the Korean summary). Earlier stages: `cross/`, `review/`, and the four design reports
`design-{rifles,close,heavy,launchers}.md`.
