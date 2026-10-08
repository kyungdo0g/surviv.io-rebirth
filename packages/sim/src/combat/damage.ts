// Player damage pipeline: headshot roll, perk and armour reductions (survev server/src/game/objects/player.ts
// damage(), ~line 2410; docs/research/mechanics/damage-armor.md "Pipeline order").
import type { Rng, Vec2 } from "@rebirth/core";
import { DamageType, GameObjectDefs, hasDef } from "@rebirth/defs";
import type { SimRules } from "../rules.ts";

export interface DamageParams {
    amount: number;
    /** defs DamageType value */
    damageType: number;
    /** weapon (gun, melee, throwable) that dealt the hit; its headshotMult applies */
    gameSourceType?: string;
    /**
     * the weapon the hit started from when that is not `gameSourceType`: the throwable in hand for a heavy potato or a
     * MIRV's bomblets, the gun that shot an exploding barrel (survev weaponSourceType; potato swaps prefer it)
     */
    weaponSourceType?: string;
    /** map object that dealt the hit (exploding barrel, ...) */
    mapSourceType?: string;
    /** explosions and shrapnel never headshot and use the Flak Jacket explosion reduction */
    isExplosion?: boolean;
    /** id of the player who dealt the hit (0 / undefined for the environment) */
    sourceId?: number;
    /** direction of the hit */
    dir?: Vec2;
    /** every reduction is multiplied by this (AP Rounds 0.8: armour is 80 % as effective; survev player.ts:2447-2452) */
    armorPenetration?: number;
}

/** What a target wears, for the reductions. */
export interface ArmorState {
    helmet: string;
    chest: string;
    hasPerk(perk: string): boolean;
}

function reductionOf(id: string): number {
    if (!id || !hasDef(id)) return 0;
    const def = GameObjectDefs[id] as { damageReduction?: number };
    return def.damageReduction ?? 0;
}

/** `headshotMult` of a damage source, or undefined when the source cannot headshot at all. */
export function headshotMultOf(gameSourceType: string | undefined): number | undefined {
    if (!gameSourceType || !hasDef(gameSourceType)) return undefined;
    const def = GameObjectDefs[gameSourceType] as { headshotMult?: number };
    return def.headshotMult;
}

/** Whether a hit may roll a headshot at all (gas, bleeding and explosions never do). */
export function canHeadshot(params: DamageParams, rules: SimRules): boolean {
    if (params.damageType === DamageType.Gas || params.damageType === DamageType.Bleeding) return false;
    if (params.isExplosion) return false;
    const mult = headshotMultOf(params.gameSourceType);
    if (mult === undefined) return false;
    return rules.headshotNeedsMultAboveOne ? mult > 1 : true;
}

/** Rolls the headshot chance with the combat rng (one draw per hit, only for hits that can headshot). */
export function rollHeadshot(params: DamageParams, rules: SimRules, rng: Rng): boolean {
    if (!canHeadshot(params, rules)) return false;
    return rng.next() < rules.headshotChance;
}

/**
 * Whether the target's armour reduced this hit (rebirth hit feedback, user/2026-10-07-hit-feedback): the helmet on a
 * headshot, the chest armour on a body hit, as `computeDamage` applies them; gas, bleeding and (unless the knob says
 * otherwise) air drop crushes skip armour. The helmet's 30 % share on body hits does not count.
 */
export function armorCovers(params: DamageParams, headshot: boolean, target: ArmorState, rules: SimRules): boolean {
    if (params.damageType === DamageType.Gas || params.damageType === DamageType.Bleeding) return false;
    if (params.damageType === DamageType.Airdrop && !rules.airdropCrushArmor) return false;
    return reductionOf(headshot ? target.helmet : target.chest) > 0;
}

/**
 * Damage after headshot multiplier and reductions, before clamping to the remaining health. Each reduction is
 * `damage -= damage * mult`, in the order flak_jacket, steelskin, chest (body hits only), helmet (x1 on the head,
 * x0.3 on the body). Gas and bleeding skip all of it.
 */
export function computeDamage(params: DamageParams, headshot: boolean, target: ArmorState, rules: SimRules): number {
    let damage = params.amount;
    if (params.damageType === DamageType.Gas || params.damageType === DamageType.Bleeding) return damage;
    const reduce = (mult: number) => {
        damage -= damage * mult * (params.armorPenetration ?? 1);
    };
    if (headshot) damage *= headshotMultOf(params.gameSourceType) ?? 1;
    if (target.hasPerk("flak_jacket")) {
        reduce(params.isExplosion ? rules.flakJacketExplosionReduction : rules.flakJacketReduction);
        // fandom's 91 % against explosions (conflicts.md flak-explosion-reduction; off by default like survev)
        if (params.isExplosion && rules.flakJacketStacksOnExplosions) reduce(rules.flakJacketReduction);
    }
    if (target.hasPerk("steelskin")) reduce(rules.steelskinReduction);
    // air drop crushing goes through the perks only unless the knob says otherwise (conflicts.md
    // airdrop-crush-damage)
    if (params.damageType === DamageType.Airdrop && !rules.airdropCrushArmor) return damage;
    if (!headshot) reduce(reductionOf(target.chest));
    reduce(reductionOf(target.helmet) * (headshot ? 1 : 0.3));
    return damage;
}
