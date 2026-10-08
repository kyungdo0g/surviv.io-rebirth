// Gun tier rebuild: hand-written texts for report.ts (the changes table falls back to a generated reason). Numbers
// come from the run the doc was built from: "TTK" = expected seconds at average aim (3.5°), level 1 armour, mean over
// the class band, unless marked expert or perfect. Update them when the stats move (report.ts prints the facts).
// usage: imported by report.ts
export const REASON: Record<string, string> = {
    // two or more steps
    m1014: "77-damage slugs kill level 1 in 2 hits 0.4 s apart and reach 60 u: TTK 0.43 s at 5-10 u; with the AA-12 the only shotguns that still score at 20-35 u; 8 shells, 4 kills each",
    wa2000: "72 damage misses the 2-hit kill through level 1 by 0.05 HP (72 x 0.75 x 0.925 = 49.95): 3 hits 1.1 s apart, perfect 1.9 s, TTK 6.2 s at 20-50 u; 5 rounds of scarce .50 AE, 11.5 / 4.75 u/s",
    scarssr:
        "81 damage every 0.3 s: 2 hits kill level 1 (perfect 0.3 s), 3 kill level 2; TTK 1.9 s at 20-50 u (expert 1.3) is the best non-sniper long-range figure; the top composite outside the snipers",
    spas16: "a full-auto SPAS-12: 8.75 x 9 every 0.35 s with 5.5° spread and 45 u range; TTK 0.39 s at 5-10 u and still useful at 20 u (borderline S: A+ under four of the six sensitivity variants)",
    dp12: "two 12.5 x 9 shells 0.2 s apart before the pump: level 1 dies in 0.2 s (perfect), TTK 0.36 s at 5-10 u, the fastest close kill at average aim; 14 shells = 6.5 kills per load",
    m1100: "the critique's 3.98 s at 10 u does not reproduce: pellets start at the muzzle (barrel 3.15 u), so about 10 of the 18 land at 10 u (34 damage a shell) and 16 at 5 u: TTK 0.87 s at 5-10 u; nothing past 20 u (range 25)",
    blr: "3-round magazine (0.5 kills per magazine) and 56 damage (3 hits through level 1, 1.38 s perfect): TTK 6.1 s at 20-50 u",
    vector45:
        "9.5 damage, 4.5 / 6.5° spread and a 45 u range: TTK 1.48 s at 5-20 u and almost nothing past 30 u; the 9 mm Vector is ahead on every term but damage",
    dshk: "kills fastest of the LMGs (TTK 1.18 s at 10-35 u, 34 damage) but is the heaviest gun: 9 u/s held, 2 u/s firing, switch 1 s, a 7.5 s reload for 30 rounds; composite level with the M249 (0.32 / 0.34), so not S",
    l86: "an MK12 with 25 damage and a 30-round magazine: TTK 3.17 s at 20-50 u (MK12 3.82), 1.9 kills per magazine",
    fal: "26 damage at 0.18 s: 4 hits on bare players, TTK 3.54 s at 20-50 u, ahead of the MK12 / M39 in role and range",
    usas: "frag rounds burst at the cursor, so nearly every round lands its 42 blast (full inside 4.5 u of the centre) plus shrapnel: about 48 damage a round through level 1, TTK 0.88 s at 5-10 u; but the 24 u range and 0.5 s cycle: nothing past 25 u",
    ash12: "31 damage at 0.1 s is a level 1 kill in 0.35 s (perfect), but 3.5° spread, a 70 u range, a 10-round magazine and scarce .50 AE: TTK 2.25 s at 10-35 u",
    mg42: "11 damage (14 hits through level 1) and a 50-round drum; 3.25 u/s while firing; TTK 1.84 s at 10-35 u against the M249's 1.55",
    scar: "the 20-round magazine (1.1 kills per magazine, sustained DPS 67) and 2 / 5° spread: TTK 2.57 s at 10-35 u against the M4A1's 2.08; 0.02 below the A- cut",
    mk14: "scores 0.13, below the M39 (0.17), so it sits with the owner's low DMRs: 25 damage and 7° moving spread give TTK 3.73 s at 20-50 u, level with the MK12",
    tec9_dual: "a 64-round magazine at 0.07 s: TTK 1.34 s at 5-20 u and 3.4 kills per magazine, SMG-like",
    vector: "7.5 damage (20 hits through level 1) and a 46 u range with 0.6 falloff: high burst DPS (197) but TTK 1.37 s at 5-20 u, little past 25 u",
    m9_dual: "13 damage every 0.08 s from 30 rounds: TTK 1.38 s at 5-20 u, level with the MP5 (1.51) and UMP9",
    m93r_dual: "two 3-round bursts at 0.18 s: TTK 1.60 s at 5-20 u, 2.2 kills per magazine; the same level as the MP5",
    // one step, main-map guns where the generated reason says little
    barrett:
        "two hits kill any armour (99 damage), but only the expert composite nears the top band; 11 / 3.5 u/s and a 3.75 s reload: TTK 2.95 s at 20-50 u against the AWM-S's 1.78",
    saiga: "kills level 1 in 0.4 s (two shells) with TTK 0.47 s at 5-10 u, but nothing past 20 u; the slug and SPAS shotguns reach further",
    garand: "44 damage at 0.23 s with first-shot accuracy: 4 hits through level 1, TTK 3.28 s at 20-50 u (expert 1.81), the best DMR after the SSR. Blended it is A+ (0.33); its expert composite clears the S cut by 0.0005 (0.384 against 0.383) and F 0.32 makes it an aim gun: S-aim, the closest call of the list",
    qbb97: "the M249's damage at 0.1 s from 75 rounds: TTK 1.92 s at 10-35 u against 1.55, 4 kills per magazine",
    sv98: "80 damage, 2 hits through level 1 (perfect 1.5 s); TTK 4.1 s at 20-50 u against 1.8 s for the AWM-S; never below the Mosin (it beats it on every stat)",
    m4a1: "the fastest automatic assault rifle (TTK 2.08 s at 10-35 u; M16A4 2.21) but 14 damage per shot and a 3.1 s reload keep it at A-",
    spas12: "8.75 x 9 with tight 4° spread and 45 u range, but the 0.75 s pump: TTK 0.82 s at 5-10 u against 0.39 for the SPAS-16",
    p30l_dual:
        "stats A (0.32, level with the M249): TTK 0.88 s at 5-20 u, 3.1 kills per magazine; capped at A- (pistols are low)",
    deagle_dual: "stats A (0.28): 35 damage at 0.12 s, TTK 0.84 s at 5-20 u; capped at A- (pistols are low)",
    m870: "a bare player dies to one shell, armour takes two 0.9 s apart: TTK 1.04 s at 5-10 u against 0.47 for the Saiga; 27 u range",
    mp220: "two shells in 0.2 s kill level 1 (perfect 0.2 s), then a 2.7 s reload: 0.9 kills per load and nothing past 20 u",
    ots38_dual: "32 damage but only 10 rounds and a 3.8 s reload: sustained DPS 57, TTK 1.31 s at 5-20 u",
    honeybadger:
        "13 damage at 0.08 s with a 120 u range and 0.75 falloff: TTK 2.37 s at 10-35 u, between the AK and the M4A1",
    sig550: "13 damage at 0.086 s with 1.5° standing spread: TTK 2.22 s at 10-35 u, close to the M4A1",
    ak47: "TTK 2.54 s at 10-35 u, level with the AK-74 and G3; 0.02 above the B+ cut",
    ak74: "TTK 2.50 s at 10-35 u with 2° standing spread; the AK-47 scores the same but is pinned at B (section 5)",
    bar: "17.5 damage but a 20-round magazine (1.3 kills each): TTK 2.60 s at 10-35 u, an assault rifle in LMG weight",
    vss: "scores 0.15, below the M39 (0.17), so it sits with the owner's low DMRs: 24 damage, 125 u range, TTK 3.74 s at 20-50 u",
    p30l: "stats A (0.13): 21 damage, 2 / 1° spread, +1 u/s: TTK 1.19 s at 5-20 u, it out-scores every SMG (CZ-3A1 0.07); capped at B (pistols are low)",
    asval: "13.5 damage at 0.08 s but 20 rounds, 90 u range and 0.65 falloff: TTK 1.38 s at 5-20 u, behind the P90 and Scorpion",
    glock_dual:
        "9 damage with 18 / 16° spread and a 44 u range: TTK 3.85 s at 5-20 u, the third lowest composite (G18C, M1911 below)",
    m9: "TTK 2.26 s at 5-20 u: weak, but ahead of the OT-38, M1911, G18C and vz. 61 (2.7-4.3 s)",
    an94: "two-round bursts of 20 damage from a 45-round magazine: TTK 1.70 s at 10-35 u and 3.4 kills per magazine, the best assault rifle",
    sv98_winter: "as the SV-98 (same stats)",
    imbel: "12 damage at 0.092 s from 40 rounds, 92 u/s bullets: TTK 2.27 s at 10-35 u, an assault rifle in LMG weight",
    m1928: "a 50-round drum (3.5 kills per magazine): TTK 1.26 s at 5-20 u, ahead of the UMP9 and MP5",
    sw500: "stats A- (0.02): 64 damage, 3 hits through level 1, TTK 1.48 s at 5-20 u; capped at B (pistols are low)",
    model94: "44 damage needs 4 hits through level 1 at 0.7 s: TTK 5.8 s at 20-50 u, 1 kill per 8-round tube",
    m93r: "3-round bursts of 12: TTK 2.05 s at 5-20 u, ahead of the M9 and vz. 61",
    ots38: "5 rounds and a 2 s reload: TTK 2.36 s at 5-20 u, 0.9 kills per magazine",
    vz61: "9 damage, 6 / 5° spread, 55 u range: TTK 2.72 s at 5-20 u",
    vz61_dual: "9 damage from 40 rounds with 9 / 8° spread: TTK 1.80 s at 5-20 u, little past 30 u",
    // round 6 classes: launchers and potato guns (direct hits on a strafing target unless the round bursts at the cursor)
    gl06: "the round bursts at the cursor, so a near miss within 5 u of the centre still takes the full 100 blast (rad.min 4) plus shrapnel: level 1 dies to one burst about 3 times in 4 (perfect 0.62 s), TTK 2.14 s at 15-40 u; one round per 2.3 s and 40 mm ammo keep sustain low",
    mgl: "six 125-damage grenades 0.7 s apart, a direct hit kills level 1, and no speed penalty since the owner's speed pass: TTK 2.2 s at 15-40 u, 2.1 kills per load; S against a stationary target",
    m202: "four 25 + 125 rockets in a fixed 60° fan (blast 5-16 u), one of them on target; a direct hit (150) kills level 1 but not level 2, so a pickup kills 42 % of the time at average aim over 15-40 u (66 % against a stationary target) before the backup gun takes over: stats B-",
    panzerfaust:
        "one 80 + 140 rocket at 35 u/s (scored before the owner's 70 u/s of 2026-10-08, not rescored), then the tube is gone: a strafing target steps out of it, so a pickup kills 32 % of the time at average aim over 15-40 u (59 % against a stationary target): stats C+",
    m79: "one 125-damage grenade per 2.6 s, lobbed at 40 u/s: a direct hit kills level 1, but a strafing target mostly steps out of the lob (a miss flies on to 52 u): TTK 5.6 s at 15-40 u; B against a stationary target",
    rpg7: "one-hit kill on any armour, but one 85 u/s rocket per 3.8 s, only the 4 that come with it, and a miss flies on to 120 u: TTK 5.3 s at 15-40 u against a strafing target (B against a stationary one): stats C+",
    potato_cannon:
        "a 95-damage blast every 1.2 s from a 65 u/s lob: 2 hits even on bare players, TTK 5.3 s at 15-40 u, and 9 u/s held",
    potato_smg:
        "13-damage blasts every 0.09 s from 30 rounds: TTK 1.42 s at 5-20 u, MP5 level (1.51); the growing target (report 42) and splash on cover are not modelled",
    boys: "96 damage, 2 hits through level 2, but 7 charges and 10.5 / 3.75 u/s held / firing: TTK 4.75 s at 20-50 u, 1.9 kills per pickup",
    scout_elite:
        "56 damage every 1 s (3 hits through level 1) and +5 u/s while firing: TTK 5.6 s at 20-50 u; the best plain bolt action after the SV-98",
    colt45_dual: "29 damage from two 6-round revolvers with first-shot accuracy: TTK 2.06 s at 5-20 u",
    tec9: "12 damage at 0.11 s from 32 rounds: TTK 1.82 s at 5-20 u, 2 kills per magazine",
    // conflicts with the owner's rulings
    "conflict:m249":
        "kills as fast as the PKP (TTK 1.55 vs 1.54 s at 10-35 u; expert 1.17 vs 1.19) but its 100-round box gives 5.4 kills per magazine against 13.4 (sustained DPS 95 vs 144) and it deals 14 damage per shot to the PKP's 18; composite 0.34 against the PKP's 0.50 and the S cut 0.383. Without the damage-per-shot term it is S by stats",
    "conflict:mosin":
        "the lowest sniper: 72 damage misses the 2-hit kill through level 1 by 0.05 HP (49.95 per hit), so level 1 and 2 take 3 body hits 1.75 s apart (perfect 3.0 / 3.5 s); TTK 7.8 s at 20-50 u (expert 5.4) against 4.1 for the SV-98 and 1.8 for the AWM-S; 5 rounds, 1 kill per magazine. The model has no term for quickswitch combos or the one-clean-shot appeal",
    "conflict:mk12":
        "the stats agree it is a low DMR (0.14: second lowest of 11; Garand 0.33, L86 0.27, FAL / SVD 0.20) but every DMR but the Mk 14 clears the A cut (0.132): TTK 3.82 s at 20-50 u against 3.75 for the M39 and 3.28 for the Garand",
    "conflict:m39":
        "a low DMR by the stats too (0.17; TTK 3.75 s at 20-50 u, 28 damage, 6 hits through level 1) but above the A cut (0.132)",
    "conflict:vss": "consistency with the MK12 / M39 ruling: 0.15 is below the M39's 0.17 (stats A)",
    "conflict:mkg45": "consistency with the MK12 / M39 ruling: 0.16 is below the M39's 0.17 (stats A)",
    "conflict:mk14": "consistency with the MK12 / M39 ruling: 0.13 is below the MK12's 0.14 (stats A-)",
    "conflict:ak47":
        "B+ by 0.02 over the cut (TTK 2.54 s at 10-35 u, level with the AK-74); pinned at B so owner item 43 holds: an average bot with an MP5 and an AK takes an MK12 for the AK only while the gain clears the upgrade threshold of 10 (about 69 - 55 = 14 at B, 7 at B+)",
    "conflict:m9":
        "C+ (TTK 2.26 s at 5-20 u); pinned at D so a bot holding an M9 and an MP5 still swaps the M9 for an AK lying without ammo (desire x 0.6): at C+ the gain falls under the upgrade threshold. The Peacemaker, dual M1911 and vz. 61 score lower and stay C",
    "conflict:p30l":
        "composite 0.13 out-scores every SMG (CZ-3A1 0.07): 21 damage, 2 / 1° spread, +1 u/s held, TTK 1.19 s at 5-20 u (MP5 1.51)",
    "conflict:p30l_dual": "TTK 0.88 s at 5-20 u, 3.1 kills per 30-round magazine; composite 0.32, level with the M249",
    "conflict:deagle": "35 damage (5 hits through level 1) with first-shot accuracy after 0.5 s: TTK 1.32 s at 5-20 u",
    "conflict:deagle_dual": "TTK 0.84 s at 5-20 u, 2.1 kills per magazine; composite 0.28",
    "conflict:sw500": "64 damage (3 hits through level 1), 150 u/s bullets: TTK 1.48 s at 5-20 u",
};

/** New comments for the comment blocks of gunTiers.ts ROWS, in order (the row lines keep their order and layout). */
export const ROW_COMMENTS: Array<string[] | null> = [
    [
        "tiers and F: docs/design/gun-tiers.md (a stat composite over class-band TTK, range, damage per shot, sustain,",
        "handling and ammo; F = expert / beginner band TTK at level 1 armour, aim error 1.6 / 5.4 degrees). Owner rulings",
        "kept where the stats differ: M249 S (stats A+), pistols low; 2026-10-08: every DMR and sniper one tier up (the",
        "MK12 / M39 A-, the Mosin A+), the RPG-7 A-, the Panzerfaust B+, the M202 A+.",
        "LMGs: the M249 and the PKP on top (S-rule); the DShK scores with the M249 but is the heaviest gun (9 / 2 u/s)",
    ],
    [
        "snipers: the AWM-S, Hecate, M200 and Lynx one-shot level 1 and the Barrett two-hits any armour (S-aim). Owner",
        "2026-10-08: every other sniper one tier up; the Mosin (stats C+: 3 hits through level 1) A+ with the SV-98",
    ],
    [
        "DMRs: the MK12 and the M39 are the owner's low DMRs (A- after the 2026-10-08 bump of every DMR and sniper); the",
        "VSS, Mk45G and Mk 14 score no better than the M39, so A- too; the Garand reaches the top band (S-aim)",
    ],
    null,
    [
        "assault rifles: the AN-94 leads; the SCAR-H's 20-round magazine drops it to B+; the AK-47 is pinned at B (item 43)",
    ],
    [
        "shotguns: the fastest kills at 5-10 u (two shells in 0.2-0.4 s); the slugs and the SPAS guns reach 20-35 u; the",
        "M870's 0.9 s pump and the MP220's two shells cost them",
    ],
    null,
    ["SMGs: the Vector's 46 u range and 7.5 damage drop it to B"],
    [
        "pistols: low by ruling, single pistols at most B and dual pistols at most A- (the dual DEagle and P30L score A);",
        "the M9 is pinned at D (stats C+) so bots still swap it for any real gun",
    ],
    [
        "survev-only guns: the Barrett two-hits any armour (S-aim); the ASh-12's 10-round magazine and 70 u range hold it",
        "at A-; the IMD-2 is a light LMG (B+); the S&W 500 is capped with the pistols; the winter skins as their base gun",
    ],
    [
        "the PMG-134 (potato maps and potato drops) at its explosion damage, 8.5 x 2 every 0.07 s from a 150-round",
        "magazine (report 34)",
    ],
    [
        "round 6 (report 42, potato maps only): the Spud Gun at its 13-damage blasts, MP5 level (B); the Potato Cannon, a",
        "95-damage blast every 1.2 s from a 65 u/s lob, 2 hits even on bare players (C)",
    ],
    [
        "the owner's beta guns (docs/design/new-gun-stats.md): the DP-12 is S (two shells in 0.2 s), the WA2000 B (72",
        "damage: 3 hits through level 1)",
    ],
    [
        "bot round 6: the beta launchers at direct hits on a strafing target, the GL-06's cursor bursts splashing near",
        "misses. Owner 2026-10-08: the M202 A+ (the endgame comeback gun), the RPG-7 A-, the Panzerfaust B+ (its",
        "downgrade); by stats they are B-, C+ and C+ (A, B and A- against a stationary target)",
    ],
];
