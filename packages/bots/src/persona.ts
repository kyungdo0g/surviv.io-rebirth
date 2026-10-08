// Bot personas (bot overhaul POPULATION-2): a bot's taste, drawn independently of its skill (user report 12: "AR/SMG
// rushers who can't snipe, DMR/sniper players, ..."). A persona weighs weapon classes and favourite guns, the range it
// likes to fight at, how readily it starts fights and how long it chases, how thoroughly it loots, how much risk it
// takes, scopes, camping, roaming and outfits. Behaviours read it through BrainCtx.persona; the gun tiers themselves are
// shared by everyone (knowledge/gunTiers.ts).
//
// NEUTRAL is today's bot: every multiplier 1, every bias 0, patience unlimited, thoroughness and risk at the centre
// (0.5) that reproduces today's constants. Consumers re-centre their formulas on it (flee threshold 25 x (1.5 - risk),
// a thoroughness formula f(t) with f(0.5) = today's constant) and gate new code paths on a non-neutral field, so a
// neutral bot with a legacy difficulty replays seed for seed. Persona draws use the persona/skill rng stream
// (createRng(seed ^ PERSONA_SALT), bot.ts), never the brain's or the motor's.
//
// All values are design choices (docs/design/bot-population.md, with the critique's corrections: rusher affinities
// smg 1.3 / rifle 1.25 / shotgun 1.15 plus a mobility term, rangeScale only for home classes, a marksman complement
// weight of 0.3 so it carries a DMR plus a sniper, camping only with a B+ gun and armour).
import { createRng, type Rng } from "@rebirth/core";
import {
    carryPenalty,
    gunTier,
    mobilityPenalty,
    roundsPerSecond,
    S_RULE_GUNS,
    skillFit,
    TIER_BASE,
    tieredGuns,
} from "./knowledge/gunTiers.ts";
import type { WeaponClass } from "./knowledge/weapons.ts";

/** Salt of the persona/skill rng stream: createRng(seed ^ PERSONA_SALT) (bot.ts), apart from the brain and motor. */
export const PERSONA_SALT = 0x6c8e9cf5;

export type PersonaName = "neutral" | "rusher" | "rifleman" | "marksman" | "camper" | "looter" | "rat";

/** The six drawn personas (NEUTRAL is never drawn). */
export const PERSONA_NAMES: readonly PersonaName[] = ["rusher", "rifleman", "marksman", "camper", "looter", "rat"];

export interface PersonaParams {
    name: PersonaName;
    /** loot desire multiplier per weapon class (LOOT: desire.ts) */
    classAffinity: Readonly<Record<WeaponClass, number>>;
    /** extra desire for favourite guns (GameObjectDefs id -> +desire) */
    favourites: Readonly<Record<string, number>>;
    /** weight of a gun's movement handicap (gunTiers mobilityPenalty) in its desire: 0 off, 1 rushers */
    mobility: number;
    /** weight of the loadout complement (a close gun next to a long one) in loot values; 1 today, marksman 0.3 */
    complementWeight: number;
    /** classes `rangeScale` applies to (positioning only with a home-class gun in hand) */
    homeClasses: readonly WeaponClass[];
    /** scales the preferred fighting band (idealMin / idealMax) with a home-class gun (COMBAT) */
    rangeScale: number;
    /** scales maxEngage when STARTING an unprovoked fight (MOVE) */
    engageScale: number;
    /** added to DifficultyParams.aggression for unprovoked fights (MOVE) */
    aggressionBias: number;
    /** seconds of chasing without closing >= 3 u or dealing damage before giving up (MOVE; capped at 30 s) */
    chasePatience: number;
    /** 0..1 looting thoroughness; 0.5 reproduces today's constants (LOOT) */
    lootThoroughness: number;
    /** desire gain needed to swap a held gun for a found one (LOOT) */
    upgradeThreshold: number;
    /** added to DifficultyParams.healBelow (MOVE) */
    healBias: number;
    /** 0..1 risk tolerance; flee threshold 25 x (1.5 - riskTolerance) HP, 0.5 = today's 25 (MOVE) */
    riskTolerance: number;
    /** multiplier of scope loot values (LOOT) */
    scopeAffinity: number;
    /** 0..1 chance to hold a looted building in the late game; only with a B+ gun and armour (mayCamp; MOVE) */
    campiness: number;
    /** radius of buildings worth exploring (units; today 240) (LOOT) */
    roamRadius: number;
    /** multiplier of DifficultyParams.burstShots (style: rushers spray) (COMBAT) */
    burstScale: number;
    /**
     * outfits (LOOT2, user report 22): weights of the per-bot outfit habit drawn once from the persona stream, "any" (puts
     * on every new outfit it sees), "liked" (only outfits on its own ranked list), "never" (does not bother); NEUTRAL
     * never, today's bot (brain/outfits.ts)
     */
    outfitMix: Readonly<OutfitMix>;
    /**
     * Personal gun taste (owner 2026-10-08: "some players take a MAC-10 (Uzi) over an AK-47 because it fires faster";
     * tiers are not absolute): 1 for a fire-rate lover, whose desire for an automatic gun grows with its rounds per
     * second (fireRateBonus); 0 or absent for everyone else. Drawn per bot (drawGunTaste), never in a shared persona.
     */
    fireRateLove?: number;
}

/** Weights of the outfit habits (PersonaParams.outfitMix). */
export interface OutfitMix {
    any: number;
    liked: number;
    never: number;
}

const ALL_CLASSES: readonly WeaponClass[] = [
    "smg",
    "rifle",
    "lmg",
    "dmr",
    "sniper",
    "shotgun",
    "pistol",
    "launcher",
    "useless",
];

function affinity(a: Partial<Record<WeaponClass, number>>): Readonly<Record<WeaponClass, number>> {
    const out = {} as Record<WeaponClass, number>;
    for (const c of ALL_CLASSES) out[c] = c === "useless" ? 0 : (a[c] ?? 1);
    return Object.freeze(out);
}

/** Today's bot: no taste. */
export const NEUTRAL: Readonly<PersonaParams> = Object.freeze({
    name: "neutral",
    classAffinity: affinity({}),
    favourites: Object.freeze({}),
    mobility: 0,
    complementWeight: 1,
    homeClasses: Object.freeze([]),
    rangeScale: 1,
    engageScale: 1,
    aggressionBias: 0,
    chasePatience: Number.POSITIVE_INFINITY,
    lootThoroughness: 0.5,
    upgradeThreshold: 10,
    healBias: 0,
    riskTolerance: 0.5,
    scopeAffinity: 1,
    campiness: 0,
    roamRadius: 240,
    burstScale: 1,
    outfitMix: Object.freeze({ any: 0, liked: 0, never: 1 }),
} satisfies PersonaParams);

function persona(p: Omit<PersonaParams, "classAffinity"> & { classAffinity: Partial<Record<WeaponClass, number>> }) {
    return Object.freeze({
        ...p,
        classAffinity: affinity(p.classAffinity),
        favourites: Object.freeze({ ...p.favourites }),
        homeClasses: Object.freeze([...p.homeClasses]),
        outfitMix: Object.freeze({ ...p.outfitMix }),
    }) as Readonly<PersonaParams>;
}

/** The personas (돌격형, 소총수, 저격수, 존버, 파밍러, 쥐/생존형) and NEUTRAL. */
export const PERSONAS: Readonly<Record<PersonaName, Readonly<PersonaParams>>> = {
    neutral: NEUTRAL,
    rusher: persona({
        name: "rusher",
        classAffinity: { smg: 1.3, rifle: 1.25, lmg: 1.1, dmr: 0.7, sniper: 0.55, shotgun: 1.15, pistol: 0.8 },
        favourites: { saiga: 8, spas12: 6, vector: 6, mp220: 4 },
        mobility: 1,
        complementWeight: 1,
        homeClasses: ["smg", "shotgun", "rifle"],
        rangeScale: 0.75,
        engageScale: 0.8,
        aggressionBias: 0.15,
        chasePatience: 18,
        lootThoroughness: 0.35,
        upgradeThreshold: 8,
        healBias: -10,
        riskTolerance: 0.8,
        scopeAffinity: 0.6,
        campiness: 0,
        roamRadius: 260,
        burstScale: 1.3,
        outfitMix: { any: 0.35, liked: 0.25, never: 0.4 },
    }),
    rifleman: persona({
        name: "rifleman",
        classAffinity: { smg: 0.95, rifle: 1.3, lmg: 1.3, dmr: 1.05, sniper: 0.8, shotgun: 1.0, pistol: 0.75 },
        favourites: {},
        mobility: 0,
        complementWeight: 1,
        homeClasses: ["rifle", "lmg"],
        rangeScale: 1,
        engageScale: 1,
        aggressionBias: 0,
        chasePatience: 10,
        lootThoroughness: 0.6,
        upgradeThreshold: 10,
        healBias: 0,
        riskTolerance: 0.5,
        scopeAffinity: 1,
        campiness: 0.1,
        roamRadius: 240,
        burstScale: 1,
        outfitMix: { any: 0.2, liked: 0.4, never: 0.4 },
    }),
    marksman: persona({
        name: "marksman",
        classAffinity: { smg: 0.8, rifle: 1.0, lmg: 1.0, dmr: 1.35, sniper: 1.4, shotgun: 0.95, pistol: 0.6 },
        favourites: { sv98: 8, mosin: 6, scout_elite: 4, mk12: 4, m39: 4 },
        mobility: 0,
        complementWeight: 0.3,
        homeClasses: ["dmr", "sniper"],
        rangeScale: 1.3,
        engageScale: 1.3,
        aggressionBias: -0.05,
        chasePatience: 6,
        lootThoroughness: 0.7,
        upgradeThreshold: 10,
        healBias: 5,
        riskTolerance: 0.4,
        scopeAffinity: 1.8,
        campiness: 0.3,
        roamRadius: 200,
        burstScale: 0.8,
        outfitMix: { any: 0.1, liked: 0.6, never: 0.3 },
    }),
    camper: persona({
        name: "camper",
        classAffinity: { smg: 0.95, rifle: 1.05, lmg: 1.15, dmr: 1.15, sniper: 0.95, shotgun: 1.3, pistol: 0.7 },
        favourites: { spas12: 6, saiga: 6, m870: 4 },
        mobility: 0,
        complementWeight: 1,
        homeClasses: ["shotgun", "lmg", "dmr"],
        rangeScale: 0.9,
        engageScale: 0.9,
        aggressionBias: -0.2,
        chasePatience: 3,
        lootThoroughness: 0.8,
        upgradeThreshold: 12,
        healBias: 10,
        riskTolerance: 0.25,
        scopeAffinity: 1,
        campiness: 0.8,
        roamRadius: 120,
        burstScale: 1,
        outfitMix: { any: 0.15, liked: 0.55, never: 0.3 },
    }),
    looter: persona({
        name: "looter",
        classAffinity: { smg: 1.0, rifle: 1.1, lmg: 1.15, dmr: 1.05, sniper: 0.95, shotgun: 1.05, pistol: 0.75 },
        favourites: {},
        mobility: 0,
        complementWeight: 1,
        homeClasses: [],
        rangeScale: 1,
        engageScale: 0.9,
        aggressionBias: -0.1,
        chasePatience: 6,
        lootThoroughness: 0.95,
        upgradeThreshold: 5,
        healBias: 5,
        riskTolerance: 0.45,
        scopeAffinity: 1.3,
        campiness: 0.1,
        roamRadius: 300,
        burstScale: 1,
        outfitMix: { any: 0.6, liked: 0.3, never: 0.1 },
    }),
    rat: persona({
        name: "rat",
        classAffinity: { smg: 1.15, rifle: 1.0, lmg: 0.95, dmr: 1.15, sniper: 0.9, shotgun: 1.05, pistol: 0.85 },
        // suppressed guns (guns.md: m4a1 and awc sound falloff 3; vss and grozas suppressed)
        favourites: { vss: 6, grozas: 4, m4a1: 4 },
        mobility: 0,
        complementWeight: 1,
        homeClasses: ["dmr", "smg"],
        rangeScale: 1.2,
        engageScale: 0.7,
        aggressionBias: -0.3,
        chasePatience: 0,
        lootThoroughness: 0.6,
        upgradeThreshold: 10,
        healBias: 15,
        riskTolerance: 0.15,
        scopeAffinity: 1.1,
        campiness: 0.5,
        roamRadius: 150,
        burstScale: 0.9,
        outfitMix: { any: 0.1, liked: 0.45, never: 0.45 },
    }),
};

/** Population mix of the drawn personas, in percent (design section 3). */
export const PERSONA_MIX: Readonly<Record<Exclude<PersonaName, "neutral">, number>> = {
    rusher: 22,
    rifleman: 30,
    marksman: 14,
    camper: 10,
    looter: 14,
    rat: 10,
};

/**
 * Faction (50v50) role -> persona, a starting point for wave 3 (role behaviours): marksmen and snipers play the
 * marksman, assault, scout and tank roles rush, medics and healers loot and heal, the rest are riflemen.
 */
export const ROLE_PERSONA: Readonly<Record<string, PersonaName>> = {
    marksman: "marksman",
    sniper: "marksman",
    recon: "rat",
    assault: "rusher",
    scout: "rusher",
    tank: "rusher",
    medic: "looter",
    healer: "looter",
    grenadier: "rifleman",
    demo: "rifleman",
    leader: "rifleman",
    lieutenant: "rifleman",
    bugler: "rifleman",
};

export function isPersonaName(s: string): s is PersonaName {
    return Object.hasOwn(PERSONAS, s);
}

/** The persona of a name or custom parameters (NEUTRAL when undefined). */
export function personaParams(p: PersonaName | PersonaParams | undefined): Readonly<PersonaParams> {
    if (p === undefined) return NEUTRAL;
    return typeof p === "string" ? PERSONAS[p] : p;
}

/** `base` with some fields replaced (role overrides, tests), frozen. */
export function withPersona(base: Readonly<PersonaParams>, over: Partial<PersonaParams>): Readonly<PersonaParams> {
    return Object.freeze({ ...base, ...over });
}

/** Whether a persona is today's bot (every field neutral): consumers skip their persona code paths then. */
export function isNeutral(p: Readonly<PersonaParams>): boolean {
    return p === NEUTRAL || p.name === "neutral";
}

/** One persona drawn by weight from `mix` (default PERSONA_MIX). Draws exactly one number from `rng`. */
export function pickPersona(rng: Rng, mix: Readonly<Partial<Record<PersonaName, number>>> = PERSONA_MIX): PersonaName {
    const entries = (Object.entries(mix) as Array<[PersonaName, number]>).filter(([, w]) => w > 0);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let r = rng.next() * total;
    for (const [name, w] of entries) {
        if (r < w) return name;
        r -= w;
    }
    return entries[entries.length - 1]?.[0] ?? "neutral";
}

/**
 * A shuffle bag of `size` personas in the mix's proportions (largest remainders), shuffled with `rng`: small lobbies
 * still get the mix. The server's BotFill draws from one bag of 50 (apps/server/src/bots.ts).
 */
export function personaBag(rng: Rng, size = 50, mix: Readonly<Partial<Record<PersonaName, number>>> = PERSONA_MIX) {
    return shuffleBag(rng, size, mix);
}

/** `size` entries in the proportions of `weights` (largest remainders, ties by order), shuffled with `rng`. */
export function shuffleBag<K extends string>(
    rng: Rng,
    size: number,
    weights: Readonly<Partial<Record<K, number>>>,
): K[] {
    const entries = (Object.entries(weights) as Array<[K, number]>).filter(([, w]) => w > 0);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    if (!(total > 0) || size <= 0) return [];
    const exact = entries.map(([k, w]) => ({ k, n: (w / total) * size }));
    const counts = exact.map((e) => Math.floor(e.n));
    let left = size - counts.reduce((a, b) => a + b, 0);
    const order = exact.map((e, i) => ({ i, rem: e.n - Math.floor(e.n) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
    for (const o of order) {
        if (left <= 0) break;
        counts[o.i]++;
        left--;
    }
    const bag: K[] = [];
    exact.forEach((e, i) => {
        for (let n = 0; n < counts[i]; n++) bag.push(e.k);
    });
    // Fisher-Yates with the caller's stream
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

/**
 * Salt of the per-bot gun-taste stream (bot.ts: createRng(seed ^ GUN_TASTE_SALT)), apart from the persona/skill stream,
 * so the taste draws never shift the skill, camping or outfit draws.
 */
export const GUN_TASTE_SALT = 0x3b9f1c27;
/** Share of the drawn bots (every tier) that love fire rate. */
export const FIRE_RATE_LOVER_SHARE = 0.22;
/**
 * Per-bot class bias: every class affinity x (1 + U(-CLASS_BIAS, CLASS_BIAS)), so loadouts vary between bots. 4 % at
 * most: it swaps neighbouring tiers across classes, never two (the rat's SMG love leaves its AK-47 5 points over a
 * MAC-10, which a +-6 % bias could tip).
 */
export const CLASS_BIAS = 0.04;
/**
 * The fire-rate bonus: FIRE_RATE_K desire per round per second above the AK-47's 10 (fireDelay 0.1), at most
 * FIRE_RATE_CAP, for SMGs, assault rifles and LMGs (pistols stay backups: "pistols are low"). For a lover a MAC-10 (22.2
 * rps, +24) outranks an AK-47 and a Vector (26.3 rps, +24) an M4A1 (12.2 rps, +4.4) in five of the seven personas; the
 * rifleman's rifle affinity and the rusher's mobility weighing (the MAC-10's 11 degrees moving spread) keep the AK
 * unless the class bias tips it. A MAC-10 stays under an A- rifle except for the SMG-loving rat.
 */
const FIRE_RATE_REF = 10;
const FIRE_RATE_K = 2;
const FIRE_RATE_CAP = 24;
const FIRE_RATE_CLASSES: ReadonlySet<WeaponClass> = new Set(["smg", "rifle", "lmg"]);
/** A fast gun the bot loves this much (bonus) is no weak gun to it (desire.ts: an under-armed bot takes it). */
export const LIKED_FAST_BONUS = 10;

/**
 * A bot's own gun taste over its persona (bot.ts, for a drawn non-neutral persona): fire-rate lover with
 * FIRE_RATE_LOVER_SHARE, and a class bias of up to +-CLASS_BIAS on every class affinity. Draws 1 + 8 numbers from
 * `rng` (the bot's seeded GUN_TASTE_SALT stream). The S-rule still lifts the M249 and the PKP above every other gun of
 * this taste (bestNonS reads the same params).
 */
export function drawGunTaste(base: Readonly<PersonaParams>, rng: Rng): Readonly<PersonaParams> {
    const fireRateLove = rng.next() < FIRE_RATE_LOVER_SHARE ? 1 : 0;
    const aff = {} as Record<WeaponClass, number>;
    for (const c of ALL_CLASSES) {
        if (c === "useless") {
            aff[c] = 0;
            continue;
        }
        aff[c] = base.classAffinity[c] * (1 + CLASS_BIAS * (2 * rng.next() - 1));
    }
    return Object.freeze({ ...base, classAffinity: Object.freeze(aff), fireRateLove });
}

/**
 * A bot's persona (bot.ts): the named or given one, with the bot's own gun taste drawn over a named, non-neutral
 * persona from its seeded GUN_TASTE_SALT stream (owner 2026-10-08: tiers are not absolute) unless `taste` is false.
 * NEUTRAL and explicit parameters never draw one.
 */
export function botPersona(
    p: PersonaName | PersonaParams | undefined,
    seed: number,
    taste = true,
): Readonly<PersonaParams> {
    const base = personaParams(p);
    if (typeof p !== "string" || p === "neutral" || !taste) return base;
    return drawGunTaste(base, createRng(seed ^ GUN_TASTE_SALT));
}

/** Extra desire a fire-rate lover has for a gun: FIRE_RATE_K per round per second above 10, capped; 0 otherwise. */
export function fireRateBonus(id: string, p: Readonly<PersonaParams>): number {
    if (!p.fireRateLove) return 0;
    const t = gunTier(id);
    if (!t || !FIRE_RATE_CLASSES.has(t.cls)) return 0;
    return p.fireRateLove * Math.min(FIRE_RATE_CAP, FIRE_RATE_K * Math.max(0, roundsPerSecond(id) - FIRE_RATE_REF));
}

/**
 * The persona-and-skill part of a gun's loot desire (0..~100): TIER_BASE x class affinity x (1 - mobility x handicap,
 * at least half the carry share for every persona) x skillFit(s) + favourite + fire-rate taste, with the S-rule (M249, PKP: 1 above the best non-S gun of this persona and skill). LOOT's
 * desire.ts adds what depends on the moment (ammo, the loadout). 0 for useless guns and non-guns. `dmrFit` (round 6,
 * report 43): DMRs take the milder DMR_FIT_SLOPE.
 */
export function baseDesire(id: string, p: Readonly<PersonaParams>, s: number, dmrFit = false): number {
    const raw = rawDesire(id, p, s, dmrFit);
    if (raw <= 0 || !S_RULE_GUNS.has(id)) return raw;
    return Math.max(raw, 1 + bestNonS(p, s, dmrFit));
}

/** Weight of the carry share (gunTiers carryPenalty) in every persona's desire (bot round 6 loot handoff). */
const CARRY_WEIGHT = 0.5;

function rawDesire(id: string, p: Readonly<PersonaParams>, s: number, dmrFit = false): number {
    const t = gunTier(id);
    if (!t) return 0;
    // every persona minds a gun that slows it just by being carried (the DShK), rushers every handicap
    const mobility = 1 - Math.max(p.mobility * mobilityPenalty(id), CARRY_WEIGHT * carryPenalty(id));
    return (
        TIER_BASE[t.tier] * p.classAffinity[t.cls] * mobility * skillFit(id, s, dmrFit) +
        (p.favourites[id] ?? 0) +
        fireRateBonus(id, p)
    );
}

const bestCache = new WeakMap<Readonly<PersonaParams>, Map<number, number>>();

function bestNonS(p: Readonly<PersonaParams>, s: number, dmrFit: boolean): number {
    let byS = bestCache.get(p);
    if (!byS) bestCache.set(p, (byS = new Map()));
    const key = Math.round(s * 1000) * 2 + (dmrFit ? 1 : 0);
    let best = byS.get(key);
    if (best === undefined) {
        best = 0;
        for (const g of tieredGuns()) if (!S_RULE_GUNS.has(g.id)) best = Math.max(best, rawDesire(g.id, p, s, dmrFit));
        byS.set(key, best);
    }
    return best;
}

/**
 * Camping gate (critique C8): only a persona with campiness, holding a gun of B+ or better with armour on, may hold a
 * building; the zone still comes first (MOVE's endgame.ts). Draw the chance itself from the persona rng.
 */
export function mayCamp(p: Readonly<PersonaParams>, bestGunId: string, armoured: boolean): boolean {
    const t = gunTier(bestGunId);
    if (p.campiness <= 0 || !t || !armoured) return false;
    return ["B+", "A-", "A", "A+", "S-aim", "S"].includes(t.tier);
}

/** Flee threshold of a persona: 25 x (1.5 - riskTolerance) HP (25 for NEUTRAL, today's value; critique C4). */
export function fleeHealth(p: Readonly<PersonaParams>, base = 25): number {
    return base * (1.5 - p.riskTolerance);
}

/**
 * A thoroughness-scaled constant re-centred on t0 = 0.5 (critique C4): today's `value` at t = 0.5, (1 + k(t - 0.5))
 * times it otherwise, e.g. MAX_LOOT_DIST 70 x (1 + 0.8(t - 0.5)).
 */
export function byThoroughness(p: Readonly<PersonaParams>, value: number, k: number): number {
    return value * (1 + k * (p.lootThoroughness - 0.5));
}
