// The shared gun tier list of the v0.8.82 roster (bot overhaul POPULATION-1): one class and one tier per gun, the skill
// a gun demands, and a few exact helpers (whole-hit kill counts). Bots of every persona agree on the tiers ("M249 / PKP
// on top, AWM-S and Mosin need aim, pistols low", user report 12); personas only weigh classes differently
// (persona.ts). LOOT turns tiers into a loot desire (knowledge/desire.ts), MOVE into fight confidence.
//
// Sources:
// - classes: docs/research/items/guns.md "Stat tables by class", the same grouping as @rebirth/defs gunClass()
//   (assault rifles are the bots' "rifle" class, the potato guns, the bugle and the flare guns are useless);
// - the Peacemaker (colt45) reaches the main map through the Hardstone (stone_04), so its dual does too;
// - "everyone wants these" (S): namu.md:319 ("USAS, PKP, M249 같은 OP 무기") and namu.md:253 (golden air drops);
//   SV-98 and AWM-S next to the M249 among the strongest guns: namu.md:120, namu.md:133; AWM-S hard to aim (bullet
//   speed 136): namu.md:141; the M1911 "worst gun": namu.md:138;
// - tiers and F: the corrected population spec (docs/design/bot-population.md, critique section B): F = expert TTK /
//   beginner TTK from an analytic discrete-TTK model at aim errors 1.6 and 5.4 degrees over each class's fighting
//   distances (shotguns 5-10 u, SMGs and pistols 5-20, rifles and LMGs 10-35, DMRs and snipers 20-50), shooter moving
//   half the time, level 1 armour, magazine and reloads included. Lower F = more skill-sensitive. Guns the critique did
//   not measure (marked "est.") carry an estimate from their class and stats.
// - survev-only guns (ADR 0003; barrett, ash12, sw500, imbel, spas16 at their survev.wiki.gg stats, the winter skins at
//   their base gun's tier) carry estimated F values from their class and stats; the PMG-134 (potato_lmg) is a potato
//   gun ("special", useless to bots like the other potato guns). Post-0.8.82 guns that are still not ported (PKM, M134,
//   M79) are not in the defs and not in this table.
import { GameObjectDefs, type GunDef, gunClass, hasDef } from "@rebirth/defs";
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
    /** reachable on the v0.8.82 main map (ground, containers, air drops, or as the dual of a reachable pistol) */
    mainMap: boolean;
}

type Row = [id: string, tier: GunTier, F: number, mainMap: boolean];

// biome-ignore format: a few guns per line keep the table readable
const ROWS: readonly Row[] = [
    // LMGs: the M249 and the PKP are the hype guns; the QBB-97 is 20-25% slower at every range (A+, no S-rule)
    ["m249", "S", 0.5, true], ["pkp", "S", 0.53, true], ["qbb97", "A+", 0.49, true], ["dp28", "A-", 0.54, true],
    ["bar", "A-", 0.45, false], // est.
    // snipers: AWM-S one-shots chest02 + helmet01 or less (180 x 0.62 x 0.925 = 103); SV-98 always 2 body hits vs lvl 1
    ["awc", "S-aim", 0.14, true], ["sv98", "A+", 0.28, true], ["mosin", "B", 0.34, true], ["scout_elite", "B", 0.26, true],
    ["blr", "A-", 0.3, false], ["model94", "B", 0.32, false], // est.
    // DMRs
    ["mk12", "A", 0.28, true], ["m39", "A", 0.3, true], ["garand", "A", 0.26, true], ["vss", "B", 0.29, true],
    ["svd", "A", 0.3, false], ["scarssr", "A", 0.28, false], ["l86", "B+", 0.35, false], ["mkg45", "B+", 0.35, false], // est.
    // assault rifles
    ["scar", "A", 0.35, true], ["m4a1", "A", 0.37, true], ["famas", "A-", 0.38, true], ["grozas", "A-", 0.45, true],
    ["ak47", "B", 0.45, true], ["hk416", "B", 0.47, true], ["groza", "B", 0.49, true],
    ["an94", "A", 0.36, false], // est.
    // shotguns: the MP220 needs both shells to land (F 0.44); the M1100 is usable only within ~6 u (3.98 s at 10 u)
    ["saiga", "A", 0.75, true], ["spas12", "A", 0.68, true], ["m870", "A-", 0.75, true], ["mp220", "A-", 0.44, true],
    ["m1100", "C", 0.92, true],
    ["usas", "A+", 0.6, false], ["m1014", "A-", 0.6, false], // est.
    // SMGs
    ["vector", "A-", 0.54, true], ["scorpion", "A-", 0.57, true], ["ump9", "B", 0.62, true], ["mp5", "B", 0.6, true],
    ["mac10", "C+", 0.7, true],
    ["vector45", "B+", 0.55, false], ["m1a1", "B", 0.62, false], // est.
    // pistols: the dual P30L beats the AK at every range up to 35 u; .50 AE ammo is scarce
    ["p30l_dual", "A", 0.55, true], ["ots38_dual", "A-", 0.47, true], ["p30l", "B+", 0.58, true],
    ["deagle_dual", "B+", 0.47, true], ["deagle", "B", 0.47, true], ["ot38_dual", "B-", 0.46, true],
    ["m9_dual", "C+", 0.62, true], ["m93r_dual", "C+", 0.56, true], ["m93r", "C", 0.56, true],
    ["glock_dual", "C", 0.72, true], ["colt45", "C", 0.55, true], ["colt45_dual", "C+", 0.5, true], // dual est.
    ["ot38", "D", 0.58, true], ["m9", "D", 0.66, true], ["glock", "D", 0.7, true],
    ["ots38", "C+", 0.5, false], ["m1911_dual", "C", 0.6, false], ["m1911", "D", 0.65, false], // est.
    // survev-only guns (est.): the Barrett one-shots like the AWM-S family and drops from the classic map's gold drop;
    // the ASh-12 (31 dmg auto .50) out-trades the SCAR-H up close; the SPAS-16 is a full-auto SPAS-12; the IMD-2 a
    // light LMG; the S&W 500 a slow .50 revolver
    ["barrett", "S-aim", 0.16, true], ["ash12", "A+", 0.42, false], ["spas16", "A", 0.66, false],
    ["imbel", "A-", 0.5, false], ["sw500", "B+", 0.45, false],
    ["svd_winter", "A", 0.3, false], ["sv98_winter", "A+", 0.28, false], ["awc_winter", "S-aim", 0.14, false],
];

const TIERS = new Map<string, GunTierInfo>();
const CLASS_OF = new Map<string, WeaponClass>();

/** Bot weapon class of a gun id from the KB classes (defs gunClass): assault -> rifle, special -> useless. */
function kbClass(id: string): WeaponClass | undefined {
    if (id === "flare_gun" || id === "flare_gun_dual") return "useless";
    const c = gunClass(id);
    if (c === undefined) return undefined;
    if (c === "assault") return "rifle";
    if (c === "special") return "useless";
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
 * AIM_FIT_SLOPE for aim guns, FIT_SLOPE otherwise (people overrate their aim, so the penalty stays mild). 0 without a
 * tier.
 */
export function skillFit(id: string, s: number): number {
    const t = TIERS.get(id);
    if (!t) return 0;
    const slope = t.aim ? AIM_FIT_SLOPE : FIT_SLOPE;
    return 1 - slope * Math.max(0, t.skillDemand - s);
}

/**
 * Movement handicap of a gun, 0 (none) .. 0.25: its moving spread above 7 degrees (it must stop to hit: DP-28 9,
 * Groza 9, MAC-10 11) plus its slowdown while firing (speed.attack: PKP -5, M249 -4). Rushers weigh it (persona
 * `mobility`).
 */
export function mobilityPenalty(id: string): number {
    if (!hasDef(id) || GameObjectDefs[id].type !== "gun") return 0;
    const def = GameObjectDefs[id] as GunDef;
    const attack = (def as GunDef & { speed?: { attack?: number } }).speed?.attack ?? 0;
    return Math.min(0.25, Math.max(0, def.moveSpread - 7) / 10 + Math.max(0, -attack) / 40);
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
