// Bigger maps (the owner, 2026-10-08, via the lead: "bigger maps to make room for the new buildings"; docs/research/
// rebirth-deviations.md "Map size"): the classic map family and 50v50 are REBIRTH_MAP_SCALE (1.2) times larger per
// side. The knob multiplies mapGen.map.scale small / large and leaves the extension, so the width is
// baseWidth x scale x knob + extension, the product rounded to a whole unit (main 720 / 768 -> 842 / 899, faction
// 880 -> 1034). Density spawns already follow the land area (sim mapgen generate.ts: count x shore area / 250000);
// the per-map counts (randomSpawns' choose, the numeric fixedSpawns counts of objects placed on the grass, each map
// scale's own for small / large) grow by the land area ratio, rounded, so buildings per area stay about the same and a
// one-off stays one; odds stay. Spawns on bridges, river banks and the coast keep their counts: those lines grow only
// with the side, and scaled up they no longer fit (the snow map's bridge shacks pass its warning budget).
// The rebirth buildings are added after this (rebirth/buildings.ts applyRebirthBuildingSpawns), so their counts are
// set for the bigger maps. Gas durations are unchanged (its radii are fractions of the map size).
import type { MapDef, SpawnCount } from "../types/index.ts";

/** Per-side size multiplier per map (1 or absent: unchanged). */
export const REBIRTH_MAP_SCALE: Readonly<Record<string, number>> = {
    main: 1.2,
    main_spring: 1.2,
    main_summer: 1.2,
    snow: 1.2,
    faction: 1.2,
    faction_potato: 1.2,
};

type Variant = "small" | "large";

/** mapGen.map.scale times `k`, rounded so baseWidth x scale is a whole number (512 x 1.28125 x 1.2 = 787.2 -> 787). */
function scaledScale(def: MapDef, variant: Variant, k: number): number {
    const { baseWidth, scale } = def.mapGen.map;
    return Math.round(baseWidth * scale[variant] * k) / baseWidth;
}

/** Map width for a scale variant (sim mapgen generator.ts: baseWidth x scale + extension). */
export function mapWidth(def: MapDef, variant: Variant): number {
    const m = def.mapGen.map;
    return m.baseWidth * m.scale[variant] + m.extension;
}

/** Land side (inside the shore inset, the area density spawns are measured on) of a scale variant. */
function landSide(def: MapDef, variant: Variant): number {
    return mapWidth(def, variant) - 2 * def.mapGen.map.shoreInset;
}

/**
 * `def` grown by `k` per side (a copy; k = 1 returns `def`). `onGrass(type)` tells the spawns whose count follows the
 * land area (rebirth/index.ts: grass terrain, not on a bridge, a river bank or the water's edge).
 */
export function scaleMapDef(def: MapDef, k: number, onGrass: (type: string) => boolean = () => true): MapDef {
    if (k === 1) return def;
    const map = {
        ...def.mapGen.map,
        scale: { small: scaledScale(def, "small", k), large: scaledScale(def, "large", k) },
    };
    const grown: MapDef = { ...def, mapGen: { ...def.mapGen, map } };
    const ratio = (variant: Variant) => (landSide(grown, variant) / landSide(def, variant)) ** 2;
    const small = ratio("small");
    const large = ratio("large");
    const count = (type: string, c: SpawnCount): SpawnCount => {
        if (!onGrass(type)) return c;
        if (typeof c === "number") return Math.round(c * large);
        if ("odds" in c) return c;
        return { small: Math.round(c.small * small), large: Math.round(c.large * large) };
    };
    return {
        ...grown,
        mapGen: {
            ...grown.mapGen,
            fixedSpawns: def.mapGen.fixedSpawns.map((spawns) =>
                Object.fromEntries(Object.entries(spawns).map(([type, c]) => [type, count(type, c)])),
            ),
            // a pick per map, not per scale variant: the squad map's ratio (the larger maps players see most)
            randomSpawns: def.mapGen.randomSpawns.map((r) => ({ ...r, choose: Math.round(r.choose * large) })),
        },
    };
}

/** The maps with REBIRTH_MAP_SCALE applied (copies; an unknown map name throws). */
export function applyRebirthMapScale(
    maps: Readonly<Record<string, MapDef>>,
    scales: Readonly<Record<string, number>> = REBIRTH_MAP_SCALE,
    onGrass?: (type: string) => boolean,
): Record<string, MapDef> {
    const out: Record<string, MapDef> = { ...maps };
    for (const [name, k] of Object.entries(scales)) {
        const def = maps[name];
        if (!def) throw new Error(`rebirth map scale: no map "${name}"`);
        out[name] = scaleMapDef(def, k, onGrass);
    }
    return out;
}
