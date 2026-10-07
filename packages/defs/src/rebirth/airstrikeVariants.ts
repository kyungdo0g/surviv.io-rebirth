// Rebirth-only air strike variants (deliberate rebirth deviation requested by the user, 2026-10-07; not in v0.8.82):
// the 50v50 scheduled air strike zones roll one of these from `rules.roles.factionAirstrikeVariants` (server env
// AIRSTRIKE_VARIANTS); strobe-called strikes and survev's comeback strike stay normal. This is the one table the sim,
// the client and the bots read. docs/research/rebirth-deviations.md lists it with the original values.
import gameConfigJson from "../generated/gameConfig.json" with { type: "json" };

/** Variant ids in wire order (protocol AirstrikeZones: 2-bit index into this list). */
export const AIRSTRIKE_VARIANT_IDS = ["normal", "heavy", "carpet"] as const;
export type AirstrikeVariant = (typeof AIRSTRIKE_VARIANT_IDS)[number];

/** How one variant's zone and planes behave. */
export interface AirstrikeVariantDef {
    /** throwable every plane drops (a GameObjectDefs throwable with `explodeOnImpact`) */
    bombType: string;
    /** bombs per plane, their spacing along the flight line and their random jitter (survev PlaneBarn.addAirStrike) */
    bombCount: number;
    bombOffset: number;
    bombJitter: number;
    /** planes per zone instead of the map's numPlanes roll (null: the roll, 3-5 planes on the 50v50 map) */
    planeCount: number | null;
    /**
     * The zone (marker and AirstrikeZoneView rad) is the map's airstrikeZoneRad plus this; planes still aim inside the
     * map's radius, so the extra ring only covers the larger blast.
     */
    zoneRadAdd: number;
}

const STRIKE = gameConfigJson.airstrike;
/** explosion_bomb_iron rad.max (test/rebirth.test.ts checks it against the def) */
export const IRON_BOMB_RAD_MAX = 14;

/**
 * Heavy shell explosion (`explosion_bomb_heavy`, rebirth-only), derived from explosion_bomb_iron (40 damage, x2 vs
 * obstacles, radius 5-14, 2 shrapnel; docs/research/mechanics/explosions.md):
 * - rad 14-38: about 2.75x the iron bomb's 5-14 ("very large blast" asked by the user; 2.5-3x was the brief). The
 *   min/max ratio stays the iron bomb's ~0.37 so the falloff has the same shape, just wider.
 * - damage 50 (iron 40): a heavy plane drops 5 shells instead of 20 bombs, so a shell hits harder but the strip is far
 *   less dense. Per plane, summed over the 5 shells 8 u apart at the worst point along the strip, by the distance from
 *   the strip line to the player's centre (the sim's default "step" falloff, damage x (1 - d / rad.max) past rad.min,
 *   measured to the body surface 1 u closer): ~230 on the line, ~200 at 10 u, ~150 at 15 u, ~105 at 20 u, ~75 at
 *   25 u, ~45 at 30 u, ~15 at 35 u, nothing past 39 u. A plane is lethal (100) about 20 u to each side of its line;
 *   the iron strip deals ~360 on its line, ~100 at 10 u, ~50 at 12 u and nothing past 15 u.
 * - obstacleDamage 2: the iron bomb's (plated obstacles yield to air strikes either way).
 * - shrapnel 4 x shrapnel_bomb_iron: twice the iron bomb's, for a bigger shell; shrapnel range (12 u) is unchanged.
 */
export const HEAVY_BOMB_EXPLOSION = {
    damage: 50,
    obstacleDamage: 2,
    rad: { min: 14, max: 38 },
    shrapnelCount: 4,
} as const;

/**
 * Sprite scale of the falling heavy shell: 1.5x bomb_iron's worldImg 0.12, so it reads as a bigger bomb; the
 * projectile radius (collisions, roof check) stays the iron bomb's.
 */
export const HEAVY_BOMB_SPRITE_SCALE = 0.18;

/** Client explosion effect of the heavy shell (explosionEffectType; the client defines it, sized from the radius). */
export const HEAVY_BOMB_EFFECT_TYPE = "bomb_heavy";

/**
 * Scorch decal of the heavy shell (rebirth-only map object, rebirth/defs.ts): decal_bomb_iron_explosion with its sprite
 * grown by the blast radius ratio 38 / 14, so a heavy blast leaves a mark that matches its size.
 */
export const HEAVY_BOMB_DECAL_TYPE = "decal_bomb_heavy_explosion";

export const AIRSTRIKE_VARIANTS: Readonly<Record<AirstrikeVariant, AirstrikeVariantDef>> = {
    /** v0.8.82 behaviour: GameConfig.airstrike (20 iron bombs 2 u apart, jitter 4), the map's numPlanes roll */
    normal: {
        bombType: "bomb_iron",
        bombCount: STRIKE.bombCount,
        bombOffset: STRIKE.bombOffset,
        bombJitter: STRIKE.bombJitter,
        planeCount: null,
        zoneRadAdd: 0,
    },
    /**
     * High-explosive heavy shells ("고폭탄/중폭탄"): 5 shells 8 u apart per plane (a 32 u strip, close to the normal
     * 38 u, so the bomb run takes the same path; fewer, wider spaced shells keep a strike survivable outside the
     * blast instead of a map wipe), same jitter. The zone grows by 24 u = 38 - 14, the heavy shell's extra reach over
     * an iron bomb, so the marker covers its danger the way a normal marker covers normal bombs.
     */
    heavy: {
        bombType: "bomb_heavy",
        bombCount: 5,
        bombOffset: 8,
        bombJitter: STRIKE.bombJitter,
        planeCount: null,
        zoneRadAdd: HEAVY_BOMB_EXPLOSION.rad.max - IRON_BOMB_RAD_MAX,
    },
    /** Carpet bombing ("대공습"): 6 plane passes (the user: a normal strike has 3), normal iron bombs and zone */
    carpet: {
        bombType: "bomb_iron",
        bombCount: STRIKE.bombCount,
        bombOffset: STRIKE.bombOffset,
        bombJitter: STRIKE.bombJitter,
        planeCount: 6,
        zoneRadAdd: 0,
    },
};

/** Default roll weights of the 50v50 scheduled zones (the user's brief: normal 60 / heavy 25 / carpet 15). */
export const DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS: Readonly<Record<AirstrikeVariant, number>> = {
    normal: 60,
    heavy: 25,
    carpet: 15,
};

export function isAirstrikeVariant(id: string): id is AirstrikeVariant {
    return (AIRSTRIKE_VARIANT_IDS as readonly string[]).includes(id);
}

/** Throwables dropped by air strike planes (none explodes under an indestructible roof, survev canBombIronExplode). */
const AIRSTRIKE_BOMBS: ReadonlySet<string> = new Set(Object.values(AIRSTRIKE_VARIANTS).map((v) => v.bombType));

export function isAirstrikeBomb(type: string): boolean {
    return AIRSTRIKE_BOMBS.has(type);
}
