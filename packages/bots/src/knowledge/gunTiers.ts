// The shared gun tier list of the v0.8.82 roster (bot overhaul POPULATION-1): one class and one tier per gun, the skill
// a gun demands, and a few exact helpers (whole-hit kill counts). Bots of every persona agree on the tiers ("M249 / PKP
// on top, AWM-S and Mosin need aim, pistols low", user report 12); personas only weigh classes differently
// (persona.ts). LOOT turns tiers into a loot desire (knowledge/desire.ts), MOVE into fight confidence.
//
// Sources:
// - classes: docs/research/items/guns.md "Stat tables by class", the same grouping as @rebirth/defs gunClass()
//   (assault rifles are the bots' "rifle" class, the potato guns, the bugle and the flare guns are useless);
// - the Peacemaker (colt45) reaches the main map through the Hardstone (stone_04), so its dual does too;
// - tiers and F: docs/design/gun-tiers.md (tools/research/gun-tiers), rebuilt from every gun's final stats. A stat
//   composite over the kill rate at the class's fighting distances (shotguns 5-10 u, SMGs and pistols 5-20, rifles and
//   LMGs 10-35, DMRs and snipers 20-50, launchers 15-40), the kill rate across 5-80 u, damage per shot, sustain,
//   handling and ammo, cut to the previous list's shape. F = expert TTK / beginner TTK at level 1 armour, aim errors
//   1.6 and 5.4 degrees, shooter moving half the time, magazine and reloads included; lower F = more skill-sensitive.
//   Explosive guns score by their explosions (the PMG-134 and the potato guns too), single-use guns per pickup;
// - kept against the stats (gun-tiers.md sections 1a and 5): the owner's rulings "M249 / PKP on top" (report 12),
//   "pistols low" (report 12: single pistols B at most, duals A-), the Mosin A and the MK12 / M39 B+ (report 33), then
//   those of 2026-10-08: every DMR and sniper one tier up from the reviewed list (MK12 / M39 A-, Mosin A+; S-aim
//   stays), the RPG-7 A-, the Panzerfaust B+, the M202 A+; and two behaviour pins, the AK-47 at B (owner item 43) and
//   the M9 at D. Tiers are shared; a bot's own taste (fire-rate lover, class bias) sits on top (persona.ts);
// - "everyone wants these": namu.md:319 ("USAS, PKP, M249 같은 OP 무기") and namu.md:253 (golden air drops); AWM-S hard
//   to aim (bullet speed 136): namu.md:141; the M1911 "worst gun": namu.md:138;
// - the PMG-134 (potato_lmg), a potato gun ("special" in the KB), is an LMG to the bots since round 5 (report 34), the
//   Spud Gun an SMG and the Potato Cannon a launcher since round 6 (report 42); the beta launchers are their own class
//   since bot round 6 (knowledge/launchers.ts). Post-0.8.82 guns that are still not ported (PKM, M134) are not in the
//   defs and not in this table.
import { GameConfig, GameObjectDefs, type GunDef, gunClass, hasDef } from "@rebirth/defs";
import type { WeaponClass } from "./weapons.ts";

/** Tiers, best first: S (everyone wants it), S-aim (top, but needs aim), A+ .. D. */
export type GunTier = "S" | "S-aim" | "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D";

/** Tiers from worst to best: `tierRank` is the index (D 0 .. S 10). */
export const TIER_ORDER: readonly GunTier[] = ["D", "C", "C+", "B-", "B", "B+", "A-", "A", "A+", "S-aim", "S"];

/** Base desire of a tier on the 0..100 loot scale (critique section D). */
export const TIER_BASE: Readonly<Record<GunTier, number>> = {
    S: 92,
    "S-aim": 90,
    "A+": 80,
    A: 74,
    "A-": 68,
    "B+": 62,
    B: 56,
    "B-": 50,
    "C+": 44,
    C: 38,
    D: 22,
};

/**
 * Guns whose desire is lifted above every non-S gun of the bot (the S-rule): only the M249 and the PKP. The AWM-S is
 * S-aim with no S-rule (the user: "AWP and Mosin need aim"; it is the most skill-sensitive gun).
 */
export const S_RULE_GUNS: ReadonlySet<string> = new Set(["m249", "pkp"]);

/** "Weak" guns: this tier or lower (the C family and D). A bot whose best gun with ammo is weak is under-armed. */
export const WEAK_TIER: GunTier = "C+";

/** Skill penalty slope of `skillFit` for aim guns (snipers and DMRs) and for every other gun (critique section B). */
export const AIM_FIT_SLOPE = 0.6;
export const FIT_SLOPE = 0.25;
/**
 * Bot round 6 (user report 43, BrainFeatures.dmrFit): a semi-auto DMR forgives a missed click (the next round is a
 * fraction of a second away; the owner, an average aim, plays them), so its slope is half the bolt snipers', which
 * keep AIM_FIT_SLOPE (awc, barrett, m200, hecate, lynx, sv98, mosin and the other "sniper" class guns).
 */
export const DMR_FIT_SLOPE = 0.3;
/** The potato guns the bots learned to use in round 6 (BrainFeatures.potatoGuns; the PMG-134 since round 5). */
export const POTATO_GUNS: ReadonlySet<string> = new Set(["potato_cannon", "potato_smg"]);

export interface GunTierInfo {
    id: string;
    cls: WeaponClass;
    tier: GunTier;
    /** forgiveness: expert TTK / beginner TTK (lower = needs more skill) */
    F: number;
    /** skill the gun demands, clamp((0.75 - F) / 0.5, 0, 1) */
    skillDemand: number;
    /** an aim gun (sniper or DMR): the stronger skill penalty applies */
    aim: boolean;
    /**
     * reachable on the main map with survev's loot tables (ground, containers, air drops, or as the dual of a reachable
     * pistol)
     */
    mainMap: boolean;
}

type Row = [id: string, tier: GunTier, F: number, mainMap: boolean];

// biome-ignore format: a few guns per line keep the table readable
const ROWS: readonly Row[] = [
    // tiers and F: docs/design/gun-tiers.md (a stat composite over class-band TTK, range, damage per shot, sustain,
    // handling and ammo; F = expert / beginner band TTK at level 1 armour, aim error 1.6 / 5.4 degrees). Owner rulings
    // kept where the stats differ: M249 S (stats A+), pistols low; 2026-10-08: every DMR and sniper one tier up (the
    // MK12 / M39 A-, the Mosin A+), the RPG-7 A-, the Panzerfaust B+, the M202 A+.
    // LMGs: the M249 and the PKP on top (S-rule); the DShK scores with the M249 but is the heaviest gun (9 / 2 u/s)
    ["m249", "S", 0.57, true], ["pkp", "S", 0.6, true], ["qbb97", "A", 0.56, true], ["dp28", "A-", 0.6, true],
    ["bar", "B+", 0.44, true], // survev's main tables drop it (tier_guns, tier_chest, tier_lmgs, air drops)
    // snipers: the AWM-S, Hecate, M200 and Lynx one-shot level 1 and the Barrett two-hits any armour (S-aim). Owner
    // 2026-10-08: every other sniper one tier up; the Mosin (stats C+: 3 hits through level 1) A+ with the SV-98
    ["awc", "S-aim", 0.26, true], ["sv98", "A+", 0.32, true], ["mosin", "A+", 0.33, true], ["scout_elite", "A-", 0.31, true],
    // (the military base's vault crate rolls tier_snipers: the BLR, the Model 94 and the Mk45G reach the classic map)
    ["blr", "B+", 0.36, true], ["model94", "B", 0.33, true],
    // DMRs: the MK12 and the M39 are the owner's low DMRs (A- after the 2026-10-08 bump of every DMR and sniper); the
    // VSS, Mk45G and Mk 14 score no better than the M39, so A- too; the Garand reaches the top band (S-aim)
    ["mk12", "A-", 0.36, true], ["m39", "A-", 0.39, true], ["garand", "S-aim", 0.32, true], ["vss", "A-", 0.4, true],
    // (round 6 loot handoff: the SVD and the SCAR-SSR reach the classic map in the gold drop, the L86 in tier 1 air drops)
    ["svd", "A+", 0.36, true], ["scarssr", "S", 0.41, true], ["l86", "A+", 0.4, true], ["mkg45", "A-", 0.37, true],
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
    ["svd_winter", "A+", 0.36, false], ["sv98_winter", "A+", 0.32, false], ["awc_winter", "S-aim", 0.26, false],
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
    ["fal", "A+", 0.4, true], ["mk14", "A-", 0.4, true], ["wa2000", "B+", 0.31, true],
    ["m200", "S-aim", 0.29, true], ["hecate", "S-aim", 0.23, true], ["lynx", "S-aim", 0.29, true], ["boys", "A", 0.41, true],
    ["m60", "A", 0.6, true], ["mg42", "A-", 0.5, true], ["dshk", "A+", 0.56, true],
    ["bizon", "B", 0.73, true], ["m1928", "B+", 0.74, false], ["asval", "B", 0.52, true], ["p90", "A-", 0.71, true],
    ["dp12", "S", 0.76, true], ["aa12", "A+", 0.92, true],
    ["tec9", "B-", 0.67, true], ["tec9_dual", "B+", 0.78, true], ["vz61", "C", 0.66, true], ["vz61_dual", "C+", 0.63, true],
    // bot round 6: the beta launchers at direct hits on a strafing target, the GL-06's cursor bursts splashing near
    // misses. Owner 2026-10-08: the M202 A+ (the endgame comeback gun), the RPG-7 A-, the Panzerfaust B+ (its
    // downgrade); by stats they are B-, C+ and C+ (A, B and A- against a stationary target)
    ["m79", "C", 0.72, true], ["mgl", "A", 0.7, true], ["gl06", "A", 0.85, true], ["rpg7", "A-", 0.38, true],
    ["panzerfaust", "B+", 0.55, true], ["m202", "A+", 0.46, true],
];

const TIERS = new Map<string, GunTierInfo>();
const CLASS_OF = new Map<string, WeaponClass>();

/** Bot weapon class of a gun id from the KB classes (defs gunClass): assault -> rifle, special -> useless. */
function kbClass(id: string): WeaponClass | undefined {
    if (id === "flare_gun" || id === "flare_gun_dual") return "useless";
    // the PMG-134 sprays exploding potatoes like an LMG (round 5, report 34; knowledge/weapons.ts PROJECTILE_GUNS);
    // round 6 (report 42): the Spud Gun like an SMG, the Potato Cannon like a launcher (knowledge/launchers.ts)
    if (id === "potato_lmg") return "lmg";
    if (id === "potato_smg") return "smg";
    if (id === "potato_cannon") return "launcher";
    const c = gunClass(id);
    if (c === undefined) return undefined;
    if (c === "assault") return "rifle";
    if (c === "special") return "useless";
    // the rebirth beta launchers (M79, MGL, GL-06, RPG-7, Panzerfaust, M202): their own class since bot round 6
    // (knowledge/launchers.ts; fired at groups, campers and busy targets, never at point blank: brain/launch.ts)
    return c;
}

for (const [id, tier, F, mainMap] of ROWS) {
    const cls = kbClass(id) ?? "useless";
    TIERS.set(id, {
        id,
        cls,
        tier,
        F,
        skillDemand: Math.min(1, Math.max(0, (0.75 - F) / 0.5)),
        aim: cls === "sniper" || cls === "dmr",
        mainMap,
    });
}

/** Class of every gun id the bots know (GUN_CLASS[id]); weapons.ts classify() reads it before its heuristic. */
export function gunClassOf(id: string): WeaponClass | undefined {
    let c = CLASS_OF.get(id);
    if (c === undefined) {
        c = kbClass(id);
        if (c !== undefined) CLASS_OF.set(id, c);
    }
    return c;
}

/** Tier data of a gun, or undefined for useless guns and non-guns. */
export function gunTier(id: string): GunTierInfo | undefined {
    return TIERS.get(id);
}

/** Every tiered gun (main map and off-map). */
export function tieredGuns(): readonly GunTierInfo[] {
    return [...TIERS.values()];
}

/** D 0 .. S 10; -1 for no tier (useless or not a gun). */
export function tierRank(tier: GunTier | undefined): number {
    return tier === undefined ? -1 : TIER_ORDER.indexOf(tier);
}

/** Tier rank of a gun id (-1 for useless guns and non-guns). */
export function gunRank(id: string): number {
    return tierRank(TIERS.get(id)?.tier);
}

/** Whether a gun's tier is `tier` or better. */
export function tierAtLeast(id: string, tier: GunTier): boolean {
    return gunRank(id) >= tierRank(tier);
}

/** Whether a gun is weak (WEAK_TIER or lower, or no tier at all): under-armed when it is the best one with ammo. */
export function isWeakGun(id: string): boolean {
    return gunRank(id) <= tierRank(WEAK_TIER);
}

/**
 * How well a bot of mechanics skill `s` (0..1) gets on with a gun: 1 - slope * max(0, skillDemand - s), slope
 * AIM_FIT_SLOPE for aim guns, FIT_SLOPE otherwise (people overrate their aim, so the penalty stays mild); with `dmrFit`
 * (round 6, report 43) DMR_FIT_SLOPE for DMRs. 0 without a tier.
 */
export function skillFit(id: string, s: number, dmrFit = false): number {
    const t = TIERS.get(id);
    if (!t) return 0;
    const slope = dmrFit && t.cls === "dmr" ? DMR_FIT_SLOPE : t.aim ? AIM_FIT_SLOPE : FIT_SLOPE;
    return 1 - slope * Math.max(0, t.skillDemand - s);
}

/** Upper bound of mobilityPenalty. */
export const MOBILITY_MAX = 0.35;
const MOVE_SPEED = GameConfig.player.moveSpeed;

function speedOf(id: string): { equip: number; attack: number; carry: number } | null {
    if (!hasDef(id) || GameObjectDefs[id].type !== "gun") return null;
    const sp = (GameObjectDefs[id] as GunDef & { speed?: { equip?: number; attack?: number; carry?: number } }).speed;
    return { equip: sp?.equip ?? 0, attack: sp?.attack ?? 0, carry: sp?.carry ?? 0 };
}

/**
 * Movement handicap of a gun, 0 (none) .. MOBILITY_MAX, all read from the defs: its moving spread above 7 degrees (it
 * must stop to hit: DP-28 9, Groza 9, MAC-10 11), its slowdown while firing (speed.attack: PKP -5, M249 -4), while held
 * (speed.equip, the launchers' -1 .. -2.5: three quarters of the time) and while merely carried in either gun slot
 * (speed.carry, the DShK's -2: all the time; sim world/player.ts carrySpeed), the last two as shares of the base move
 * speed. Rushers weigh it (persona `mobility`); every persona weighs the carry share (carryPenalty).
 */
export function mobilityPenalty(id: string): number {
    const sp = speedOf(id);
    if (!sp) return 0;
    const def = GameObjectDefs[id] as GunDef;
    const spread = Math.max(0, def.moveSpread - 7) / 10;
    const held = Math.max(0, -sp.attack) / 40 + (0.75 * Math.max(0, -sp.equip)) / MOVE_SPEED;
    return Math.min(MOBILITY_MAX, spread + held + carryPenalty(id));
}

/**
 * Share of the base move speed a gun costs just by being carried (speed.carry: the DShK's -2 is 1/6; 0 for most guns).
 * The coordinator's loot handoff (bot round 6): carry penalties count wherever the bots weigh move speed.
 */
export function carryPenalty(id: string): number {
    const sp = speedOf(id);
    return sp ? Math.max(0, -sp.carry) / MOVE_SPEED : 0;
}

function damageReductionOf(id: string): number {
    if (!id || !hasDef(id)) return 0;
    return (GameObjectDefs[id] as { damageReduction?: number }).damageReduction ?? 0;
}

/**
 * Body hits (whole bullets; all pellets of a shotgun shell count as one hit landing `bulletCount` pellets) a gun needs
 * to take `health` from a player with this armour: body damage = dmg x (1 - chest) x (1 - 0.3 x helmet) (sim
 * combat/damage.ts, docs/research/mechanics/damage-armor.md). Mosin vs helmet01 + chest01: 72 x 0.694 = 49.95, so 3
 * hits, not 2. Infinity for guns without bullet damage.
 */
export function bodyHitsToKill(id: string, helmet = "", chest = "", health = 100): number {
    if (!hasDef(id) || GameObjectDefs[id].type !== "gun") return Number.POSITIVE_INFINITY;
    const def = GameObjectDefs[id] as GunDef;
    const bullet = hasDef(def.bulletType) ? (GameObjectDefs[def.bulletType] as { damage?: number }) : {};
    const perHit =
        (bullet.damage ?? 0) * def.bulletCount * (1 - damageReductionOf(chest)) * (1 - 0.3 * damageReductionOf(helmet));
    if (perHit <= 0) return Number.POSITIVE_INFINITY;
    return Math.ceil(health / perHit - 1e-9);
}

/**
 * Seconds a perfect shooter needs for those body hits: (hits - 1) shot cycles, plus a reload for every full magazine
 * emptied before the last hit (burst guns: the burst cadence). The discrete model the tier table is checked against;
 * LOOT's duel.expectedTtk adds aim error, falloff and pellets for fights.
 */
export function perfectTtk(id: string, helmet = "", chest = ""): number {
    const hits = bodyHitsToKill(id, helmet, chest);
    if (!Number.isFinite(hits)) return Number.POSITIVE_INFINITY;
    const def = GameObjectDefs[id] as GunDef;
    const burst = def.fireMode === "burst" ? Math.max(1, def.burstCount ?? 1) : 1;
    const cycle =
        def.fireMode === "burst" ? (def.fireDelay + (burst - 1) * (def.burstDelay ?? 0)) / burst : def.fireDelay;
    const clip = Math.max(1, def.maxClip);
    const reloads = Math.floor((hits - 1) / clip);
    return (hits - 1 - reloads) * cycle + reloads * def.reloadTime;
}

/**
 * Rounds a gun fires per second at its cyclic rate (1 / fireDelay; burst guns average the burst cadence: FAMAS, UMP9,
 * M16A4). 0 for anything that is not a gun. The fire-rate taste (persona.ts fireRateBonus) reads it.
 */
export function roundsPerSecond(id: string): number {
    if (!hasDef(id) || GameObjectDefs[id].type !== "gun") return 0;
    const def = GameObjectDefs[id] as GunDef;
    const burst = def.fireMode === "burst" ? Math.max(1, def.burstCount ?? 1) : 1;
    const cycle =
        def.fireMode === "burst" ? (def.fireDelay + (burst - 1) * (def.burstDelay ?? 0)) / burst : def.fireDelay;
    return cycle > 0 ? 1 / cycle : 0;
}
