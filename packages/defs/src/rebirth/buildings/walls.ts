// The rebirth buildings' breakable partitions (the owner, 2026-10-10: "a pity: the walls can't be broken"): wooden
// interior walls like survev's house_wall_int_* (150 health, wood sounds and planks, the original rounded wall sprites),
// one type per length so every rebirth partition can be built from them. Shells, the walls round a hidden room and the
// basements stay unbreakable, as survev's exterior walls are (docs/research/rebirth-deviations.md).
import type { MapObjectDef, ObstacleDef } from "../../types/index.ts";

/** The lengths there are: one per original rounded wall sprite (map-wall-<NN>-rounded.img). */
export const REBIRTH_WALL_INT_LENGTHS: readonly number[] = [1, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** The breakable partition type of a length (`rebirth_wall_int_<len>`, 2.5 as `2_5`). */
export const rebirthWallInt = (len: number): string => `rebirth_wall_int_${String(len).replace(".", "_")}`;

/** survev house_wall_int_4's def, re-cut to each length (its tan tint for every rebirth building). */
export function rebirthWallDefs(generated: Readonly<Record<string, MapObjectDef>>): Record<string, MapObjectDef> {
    const base = generated.house_wall_int_4;
    if (base?.type !== "obstacle") throw new Error("rebirth walls: no house_wall_int_4 to copy");
    const out: Record<string, MapObjectDef> = {};
    for (const len of REBIRTH_WALL_INT_LENGTHS) {
        const half = len / 2;
        const nn = String(Math.floor(len)).padStart(2, "0") + (len % 1 ? "-5" : "");
        const def: ObstacleDef = {
            ...base,
            collision: { type: 1, min: { x: -0.5, y: -half }, max: { x: 0.5, y: half }, height: 0 },
            extents: { x: 0.5, y: half },
            img: { ...base.img, sprite: `map-wall-${nn}-rounded.img` },
        };
        out[rebirthWallInt(len)] = def;
    }
    return out;
}

/** The breakable exterior wall type of a length (`rebirth_wall_brk_<len>`, 2.5 as `2_5`). */
export const rebirthWallBrk = (len: number): string => `rebirth_wall_brk_${String(len).replace(".", "_")}`;

/** The breakable exterior walls' brick tint. */
export const REBIRTH_WALL_BRK_TINT = 0x8c4a36;
/** A breakable exterior wall's health: twice a partition's (the owner's wave 3 collapsing buildings, 2026-10-10). */
export const REBIRTH_WALL_BRK_HEALTH = 300;

/**
 * The collapsing buildings' breakable exterior walls (the owner, 2026-10-10: "the gas station and the church: their
 * exterior walls can be broken; when a certain amount collapses the whole building caves in"): the partitions' shapes
 * and rounded sprites tinted brick, brick_wall_ext_4's hit particles, sounds and material, 300 health.
 */
export function rebirthBrittleWallDefs(
    generated: Readonly<Record<string, MapObjectDef>>,
): Record<string, MapObjectDef> {
    const brick = generated.brick_wall_ext_4;
    if (brick?.type !== "obstacle") throw new Error("rebirth walls: no brick_wall_ext_4 to copy");
    const parts = rebirthWallDefs(generated);
    const out: Record<string, MapObjectDef> = {};
    for (const len of REBIRTH_WALL_INT_LENGTHS) {
        const part = parts[rebirthWallInt(len)];
        if (part?.type !== "obstacle") continue;
        const def: ObstacleDef = {
            ...part,
            destructible: true,
            health: REBIRTH_WALL_BRK_HEALTH,
            hitParticle: brick.hitParticle,
            explodeParticle: "rockBreak",
            sound: { ...brick.sound },
            material: brick.material,
            img: { ...part.img, tint: REBIRTH_WALL_BRK_TINT },
        };
        out[rebirthWallBrk(len)] = def;
    }
    return out;
}
