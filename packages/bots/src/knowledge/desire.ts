// Gun desire for loot decisions (bot overhaul LOOT-8, user reports 8 and 12): how much a bot wants a gun, from the
// shared tier list (knowledge/gunTiers.ts) weighed by its persona and skill (persona.ts baseDesire: tier x class
// affinity x mobility x skill fit + favourite, the S-rule for the M249 and the PKP), and what that gun is worth to it
// given what it already carries (the corrected population spec, docs/design/bot-population.md "Desire"):
// - no gun: any gun (95, a little more for the guns it likes);
// - weak-only (its best gun with ammo is C+ or lower, gunTiers isWeakGun: the pistols people want to replace): any
//   better gun that is not weak is worth at least 88;
// - one gun: 30 + desire / 2, plus 12 when the new gun covers the band the held one misses (close: SMGs and
//   shotguns; long: rifles, LMGs, DMRs, snipers; pistols cover neither), times the persona's complement weight;
// - both slots full: the gain over the held gun it would replace (the lowest desire, minus 15 when redundant: a
//   pistol, or the weaker of two guns of one band), worth it from the persona's upgrade threshold (10 for NEUTRAL);
//   a gun of a higher tier is never dropped for a lower one unless it is out of ammo with none in the bag.
// Desire only reads the defs and the bot's own inventory (fair: what the player's HUD shows).
import { WeaponSlot } from "@rebirth/defs";
import type { SelfState } from "../perception/world.ts";
import { baseDesire, fireRateBonus, LIKED_FAST_BONUS, NEUTRAL, type PersonaParams } from "../persona.ts";
import { gunRank, isWeakGun, POTATO_GUNS, S_RULE_GUNS, tierRank } from "./gunTiers.ts";
import { type GunInfo, gunInfo, type WeaponClass } from "./weapons.ts";

/** Whose taste a desire is: the bot's persona and mechanics skill s (BrainCtx.persona, BrainCtx.skill.s). */
export interface Taste {
    persona: Readonly<PersonaParams>;
    s: number;
    /** round 6 (BrainFeatures.potatoGuns, report 42): the Spud Gun and the Potato Cannon are worth having */
    potatoGuns?: boolean;
    /** round 6 (BrainFeatures.dmrFit, report 43): DMRs for average aim */
    dmrFit?: boolean;
}

/** A bot without a persona at the normal preset's skill (skill.ts PRESET_SKILL.normal). */
export const DEFAULT_TASTE: Readonly<Taste> = Object.freeze({ persona: NEUTRAL, s: 0.75 });

/** Desire of an empty-handed bot for its first gun (knowledge/loot.ts: weapons first, namu.md /팁). */
const FIRST_GUN = 93;
/** A weak-only bot values any better gun that is not weak at least this much. */
const WEAK_UPGRADE = 88;
/** Desire lost by a held gun that is redundant (a pistol, or the weaker one of two guns of the same band). */
const REDUNDANT = 15;
/** A held gun out of ammo, with none of its ammo in the bag, keeps this share of its desire. */
const DEAD_SHARE = 0.35;

/**
 * Round 6 (report 43): average aim (the owner's level, the intermediate tier, s around 0.5) takes a DMR as its long gun:
 * up to this much desire, fading out by DMR_AVERAGE_BAND of skill either way. Snipers rarely drop; a semi-auto DMR is
 * the long gun such players carry next to a close gun.
 */
export const DMR_AVERAGE_BONUS = 12;
const DMR_AVERAGE_S = 0.5;
const DMR_AVERAGE_BAND = 0.3;

/** Desire (0..~100) of a gun for this taste; 0 for useless guns and non-guns. */
export function gunDesire(id: string, taste: Readonly<Taste> = DEFAULT_TASTE): number {
    if (!taste.potatoGuns && POTATO_GUNS.has(id)) return 0;
    const base = baseDesire(id, taste.persona, taste.s, taste.dmrFit === true);
    if (!taste.dmrFit || base <= 0 || gunInfo(id)?.cls !== "dmr") return base;
    return base + DMR_AVERAGE_BONUS * Math.max(0, 1 - Math.abs(taste.s - DMR_AVERAGE_S) / DMR_AVERAGE_BAND);
}

export type Band = "close" | "long" | "none";

/** The fighting band a class covers (pistols cover neither: they are everybody's backup). */
export function bandOf(cls: WeaponClass): Band {
    if (cls === "smg" || cls === "shotgun") return "close";
    if (cls === "rifle" || cls === "lmg" || cls === "dmr" || cls === "sniper") return "long";
    return "none";
}

/** A held gun as the loot decisions see it. */
export interface HeldDesire {
    slot: number;
    info: GunInfo;
    /** desire for the gun itself */
    desire: number;
    /** desire as a gun to keep: x0.35 when out of ammo with none in the bag, minus 15 when redundant */
    keep: number;
    /** tier rank (gunTiers gunRank: D 0 .. S 10) */
    rank: number;
    /** rounds in the magazine or the bag */
    alive: boolean;
    band: Band;
}

/**
 * The bot's guns (primary and secondary, useless ones left out) with their desire and keep value. `ammoKnown`: ammo
 * types the bot knows lie on the ground close by (an empty gun whose ammo is right there is not out of ammo).
 */
export function heldDesires(
    self: SelfState,
    taste: Readonly<Taste> = DEFAULT_TASTE,
    ammoKnown?: ReadonlySet<string>,
): HeldDesire[] {
    const out: HeldDesire[] = [];
    for (const slot of [WeaponSlot.Primary, WeaponSlot.Secondary]) {
        const w = self.weapons[slot];
        const info = w ? gunInfo(w.type) : undefined;
        if (!w || !info || info.score <= 0) continue;
        const desire = gunDesire(info.id, taste);
        const alive = w.ammo > 0 || (self.inventory[info.ammo] ?? 0) > 0 || !!ammoKnown?.has(info.ammo);
        out.push({
            slot,
            info,
            desire,
            keep: alive ? desire : desire * DEAD_SHARE,
            rank: gunRank(info.id),
            alive,
            band: bandOf(info.cls),
        });
    }
    // redundancy: pistols always, and the weaker of two guns covering the same band
    for (const h of out) if (h.band === "none") h.keep -= REDUNDANT;
    if (out.length === 2 && out[0].band === out[1].band && out[0].band !== "none") {
        const weaker = out[0].keep <= out[1].keep ? out[0] : out[1];
        weaker.keep -= REDUNDANT;
    }
    return out;
}

/**
 * Whether a gun is weak to this persona: C+ or lower (gunTiers isWeakGun), unless the bot's own taste loves it (a
 * fire-rate lover's MAC-10: persona.ts LIKED_FAST_BONUS), so an under-armed lover takes it as a real gun.
 */
export function isWeakFor(id: string, persona?: Readonly<PersonaParams>): boolean {
    return isWeakGun(id) && !(persona && fireRateBonus(id, persona) >= LIKED_FAST_BONUS);
}

/** Whether every held gun with ammo is weak (C+ or lower) and there is at least one: the bot is under-armed. */
export function weakOnly(held: readonly HeldDesire[], persona?: Readonly<PersonaParams>): boolean {
    const alive = held.filter((h) => h.alive);
    return alive.length > 0 && alive.every((h) => isWeakFor(h.info.id, persona));
}

/**
 * Tier steps a gun the bot's taste loves may sit under the held gun it replaces (owner 2026-10-08: a fire-rate lover
 * takes a MAC-10 for an AK-47, B to C+); never an S-rule gun, nor an S or S-aim one.
 */
const TASTE_TIER_SLACK = 2;

function tasteMayReplace(out: HeldDesire, id: string, taste: Readonly<Taste>): boolean {
    if (fireRateBonus(id, taste.persona) <= 0 || S_RULE_GUNS.has(out.info.id)) return false;
    if (out.rank >= tierRank("S-aim")) return false;
    return out.rank - gunRank(id) <= TASTE_TIER_SLACK;
}

/**
 * Worth of a loadout as the sum of its guns' keep values (desire; x0.35 out of ammo with none in the bag; minus 15 for a
 * pistol and for the weaker of two guns of one band). Comparing loadouts before and after a swap, not a new gun
 * against the held gun's keep value, matters: the new gun would be just as redundant in its place, and comparing it
 * unpenalised swapped an MP5 for a UMP9 and back forever (both B, both next to a shotgun).
 */
export function loadoutValue(guns: ReadonlyArray<{ desire: number; alive: boolean; band: Band }>): number {
    const v = guns.map((g) => (g.alive ? g.desire : g.desire * DEAD_SHARE) - (g.band === "none" ? REDUNDANT : 0));
    if (guns.length === 2 && guns[0].band === guns[1].band && guns[0].band !== "none") {
        v[v[0] <= v[1] ? 0 : 1] -= REDUNDANT;
    }
    return v.reduce((a, b) => a + b, 0);
}

/** The held gun a pickup should replace when both gun slots are full (the lowest keep value), or null. */
export function replaceCandidate(held: readonly HeldDesire[]): HeldDesire | null {
    if (held.length < 2) return null;
    return held[0].keep <= held[1].keep ? held[0] : held[1];
}

/**
 * The best swap of a held gun for gun `id` when both slots are full: the slot whose replacement raises the loadout's
 * worth most, and that gain. A gun of a higher tier with ammo is never given up for a lower one (user report 12),
 * unless the bot's taste loves the lower one (tasteMayReplace, at most two steps).
 */
export function bestSwap(
    held: readonly HeldDesire[],
    id: string,
    taste: Readonly<Taste>,
    alive = true,
): { slot: number; gain: number } | null {
    const info = gunInfo(id);
    if (!info || held.length < 2) return null;
    const incoming = { desire: gunDesire(id, taste), alive, band: bandOf(info.cls) };
    const before = loadoutValue(held);
    let best: { slot: number; gain: number } | null = null;
    for (const out of held) {
        if (out.alive && out.rank > gunRank(id) && !tasteMayReplace(out, id, taste)) continue;
        const after = loadoutValue(held.map((h) => (h === out ? incoming : h)));
        const gain = after - before;
        if (!best || gain > best.gain) best = { slot: out.slot, gain };
    }
    return best;
}

/**
 * What picking up gun `id` is worth to the bot now (0..100 on the knowledge/loot.ts scale; 0: leave it). `ammoKnown`:
 * ammo types known on the ground close by (default: unknown, the gun counts as loaded). Guns lie empty: with none of
 * its ammo in the bag or close by it counts as a gun out of ammo, the same for the held guns, or a bot swapped a
 * loaded gun for an empty one and back forever.
 */
export function gunPickupValue(
    self: SelfState,
    id: string,
    taste: Readonly<Taste> = DEFAULT_TASTE,
    ammoKnown?: ReadonlySet<string>,
): number {
    const info = gunInfo(id);
    if (!info || info.score <= 0) return 0;
    const want = gunDesire(id, taste);
    if (want <= 0) return 0;
    const ammoBonus = (self.inventory[info.ammo] ?? 0) > 0 ? 8 : 0;
    const alive = ammoBonus > 0 || !ammoKnown || ammoKnown.has(info.ammo);
    const held = heldDesires(self, taste, ammoKnown);
    if (held.length === 0) return Math.min(99, FIRST_GUN + want / 25 + ammoBonus * 0.5);
    const best = Math.max(0, ...held.filter((h) => h.alive).map((h) => h.desire));
    const weak = weakOnly(held, taste.persona);
    if (held.some((h) => h.info.id === id)) {
        // the same pistol again becomes its dual version; any other duplicate is worthless
        const dual = info.def.dualWieldType ? gunInfo(info.def.dualWieldType) : undefined;
        if (!dual) return 0;
        const gain = gunDesire(dual.id, taste) - want;
        if (weak && !isWeakFor(dual.id, taste.persona) && gain > 0) return weakUpgrade(gain);
        return gain >= 5 ? Math.min(70, 25 + gain * 0.8) : 0;
    }
    // under-armed: a real gun first (critique C3: "weak" is the tier, not the pistol class)
    if (weak && alive && !isWeakFor(id, taste.persona) && want > best) return weakUpgrade(want - best);
    if (held.length === 1) {
        const band = bandOf(info.cls);
        const complement = band !== "none" && band !== held[0].band ? 12 * taste.persona.complementWeight : 0;
        return Math.max(0, Math.min(85, 30 + (alive ? want : want * DEAD_SHARE) * 0.5 + complement + ammoBonus));
    }
    // never a higher tier for a lower one, unless the held gun is out of ammo with none in the bag (user report 12)
    const swap = bestSwap(held, id, taste, alive);
    if (!swap || swap.gain < taste.persona.upgradeThreshold) return 0;
    return Math.min(80, 25 + swap.gain * 0.8 + ammoBonus);
}

function weakUpgrade(gain: number): number {
    return Math.min(94, WEAK_UPGRADE + gain / 10);
}

/**
 * Slot a picked-up gun `id` would replace when both gun slots are full (bestSwap; without an id the lowest keep value),
 * else null.
 */
export function slotToReplaceByDesire(
    self: SelfState,
    taste: Readonly<Taste> = DEFAULT_TASTE,
    id = "",
    ammoKnown?: ReadonlySet<string>,
): number | null {
    const held = heldDesires(self, taste, ammoKnown);
    if (held.length < 2) return null;
    if (id) {
        const info = gunInfo(id);
        const alive = !ammoKnown || (!!info && ((self.inventory[info.ammo] ?? 0) > 0 || ammoKnown.has(info.ammo)));
        const swap = bestSwap(held, id, taste, alive);
        if (swap) return swap.slot;
    }
    return replaceCandidate(held)?.slot ?? null;
}
