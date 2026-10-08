// Rebirth balance deviations from v0.8.82: values the generated (original) defs hold that the rebirth deliberately
// changes at the user's request. Applied to a copy of the generated game objects when the registry loads
// (rebirth/index.ts), so the simulation, the client and the bots all read the changed values; the generated JSON
// stays the original. Every entry is listed with its original value in docs/research/rebirth-deviations.md.
import type { DecalDef, ExplosionDef, GameObjectDef, MapObjectDef } from "../types/index.ts";
import { AIRSTRIKE_BOMB_RADIUS_MULT } from "./airstrikeVariants.ts";

/**
 * Frag grenade blast radius multiplier. Deliberate rebirth deviation requested by the user (2026-10-07: "the grenade
 * radius is too small, even in the original"): explosion_frag rad 5-12 (v0.8.82, explosions.md) becomes 6.5-15.6.
 * Damage, shrapnel (12 x shrapnel_frag, range 8, shared with the MIRV's main charge) and the MIRV, Martyrdom and
 * barrel explosions keep their original values: only the frag grenade was asked for.
 */
export const FRAG_RADIUS_MULT = 1.3;
/**
 * Scorch decal of the resized frag blast (rebirth-only map object, rebirth/defs.ts): decal_frag_explosion with its
 * sprite x FRAG_RADIUS_MULT. A new decal rather than a resized one, because the MIRV's main charge (still 5-12) leaves
 * decal_frag_explosion too.
 */
export const FRAG_DECAL_TYPE = "decal_frag_large_explosion";
/**
 * Scorch decal of the air strike iron bomb, grown in place x AIRSTRIKE_BOMB_RADIUS_MULT with its blast (the owner,
 * 2026-10-08; rebirth/airstrikeVariants.ts): only explosion_bomb_iron leaves it, so unlike the frag's no new decal
 * (and no new map type id on the wire) is needed. The heavy shell's decal is built from the resized one (defs.ts).
 */
export const IRON_BOMB_DECAL_TYPE = "decal_bomb_iron_explosion";

/** One deviation: which def changes, the original and rebirth values (tests and docs read this list). */
export interface DefDeviation {
    id: string;
    field: string;
    original: unknown;
    rebirth: unknown;
    reason: string;
}

/** `v` x `mult`, rounded to 1e-6 so 12 x 1.3 is 15.6 and not 15.600000000000001. */
export function scaleDefValue(v: number, mult: number): number {
    return Math.round(v * mult * 1e6) / 1e6;
}

/** `rad` with both ends x `mult`. */
function scaledRad(rad: ExplosionDef["rad"], mult: number): ExplosionDef["rad"] {
    return { min: scaleDefValue(rad.min, mult), max: scaleDefValue(rad.max, mult) };
}

/**
 * Applies the balance deviations to `defs` (a mutable copy of the generated record; the defs it replaces are new
 * objects, the generated ones are never mutated). Returns what changed.
 */
export function applyBalanceDeviations(defs: Record<string, GameObjectDef>): DefDeviation[] {
    const out: DefDeviation[] = [];
    const frag = defs.explosion_frag as ExplosionDef;
    const rad = scaledRad(frag.rad, FRAG_RADIUS_MULT);
    defs.explosion_frag = { ...frag, rad, decalType: FRAG_DECAL_TYPE };
    out.push(
        {
            id: "explosion_frag",
            field: "rad",
            original: frag.rad,
            rebirth: rad,
            reason: `frag grenade blast radius x${FRAG_RADIUS_MULT} (user request: the original radius is too small)`,
        },
        {
            id: "explosion_frag",
            field: "decalType",
            original: frag.decalType,
            rebirth: FRAG_DECAL_TYPE,
            reason: `the frag scorch mark grows x${FRAG_RADIUS_MULT} with its blast (the MIRV keeps its decal)`,
        },
    );
    // the air strike iron bomb (normal and carpet strikes, the strobe), keeping its decal type: the decal itself grows
    // (applyMapObjectDeviations); the heavy shell is rebirth-only and built at its own size (rebirth/defs.ts)
    const iron = defs.explosion_bomb_iron as ExplosionDef;
    const ironRad = scaledRad(iron.rad, AIRSTRIKE_BOMB_RADIUS_MULT);
    defs.explosion_bomb_iron = { ...iron, rad: ironRad };
    out.push({
        id: "explosion_bomb_iron",
        field: "rad",
        original: iron.rad,
        rebirth: ironRad,
        reason:
            `air strike bomb blast radius x${AIRSTRIKE_BOMB_RADIUS_MULT} (owner: a normal bomb clearly bigger than ` +
            "the M202 FLASH rocket's 16 u blast)",
    });
    return out;
}

/**
 * Applies the map object deviations to `mapObjects` (a mutable copy of the generated record, as above): the iron
 * bomb's scorch decal grows with its blast. Returns what changed.
 */
export function applyMapObjectDeviations(mapObjects: Record<string, MapObjectDef>): DefDeviation[] {
    const decal = mapObjects[IRON_BOMB_DECAL_TYPE] as DecalDef;
    const scale = scaleDefValue(decal.img.scale, AIRSTRIKE_BOMB_RADIUS_MULT);
    mapObjects[IRON_BOMB_DECAL_TYPE] = { ...decal, img: { ...decal.img, scale } };
    return [
        {
            id: IRON_BOMB_DECAL_TYPE,
            field: "img.scale",
            original: decal.img.scale,
            rebirth: scale,
            reason: `the iron bomb's scorch mark grows x${AIRSTRIKE_BOMB_RADIUS_MULT} with its blast`,
        },
    ];
}
