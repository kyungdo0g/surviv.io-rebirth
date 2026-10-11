// More rivers (docs/research/rebirth-deviations.md "Bigger maps"; the owner, 2026-10-11: "go, make the maps bigger
// and add more rivers"). The classic family and 50v50 roll their river widths from the rebirth's weights instead of
// survev's (survev shared/defs/maps/baseDefs.ts, factionDefs.ts mapGen.map.rivers.weights):
// - a classic map always has 2 to 4 rivers, with survev's width mix (one 16 main river or two 8s, then 8 and 4 side
//   rivers; survev rolled a single river on 46 % of maps and its five-river roll 1 in 10,000);
// - 50v50 keeps its splitting river first (width 20: sim mapgen rivers.ts runs the first width along the centre line,
//   and the front-line placement and the faction sides depend on it) and always gets at least one tributary.
// The sim generates the widths in order; each later river ends where it first meets an earlier one (sim mapgen
// rivers.ts joinExistingRivers), so the side rivers are tributaries. Lakes, smoothness and masks stay survev's.
import type { MapDef } from "../types/index.ts";
import type { DefDeviation } from "./deviations.ts";

type RiverWeights = MapDef["mapGen"]["map"]["rivers"]["weights"];

/** The classic family's river widths: 2 to 4 rivers. */
const CLASSIC_RIVERS: RiverWeights = [
    { weight: 0.25, widths: [16, 8] },
    { weight: 0.25, widths: [8, 8, 4] },
    { weight: 0.3, widths: [16, 8, 4] },
    { weight: 0.2, widths: [16, 8, 8, 4] },
];

/** 50v50's river widths: the splitting river (20) and 1 to 3 tributaries. */
const FACTION_RIVERS: RiverWeights = [
    { weight: 1, widths: [20, 4] },
    { weight: 1, widths: [20, 8, 4] },
    { weight: 1, widths: [20, 8, 4, 4] },
];

/** Rebirth river weights per map (absent: survev's). */
export const REBIRTH_MAP_RIVERS: Readonly<Record<string, RiverWeights>> = {
    main: CLASSIC_RIVERS,
    main_spring: CLASSIC_RIVERS,
    main_summer: CLASSIC_RIVERS,
    snow: CLASSIC_RIVERS,
    faction: FACTION_RIVERS,
    faction_potato: FACTION_RIVERS,
};

/**
 * The maps with REBIRTH_MAP_RIVERS applied (copies of the changed maps; an unknown map name throws) and what changed
 * (id: the map, field: mapGen.map.rivers.weights).
 */
export function applyRebirthMapRivers(
    maps: Readonly<Record<string, MapDef>>,
    rivers: Readonly<Record<string, RiverWeights>> = REBIRTH_MAP_RIVERS,
): { maps: Record<string, MapDef>; deviations: DefDeviation[] } {
    const out: Record<string, MapDef> = { ...maps };
    const deviations: DefDeviation[] = [];
    for (const [name, weights] of Object.entries(rivers)) {
        const def = maps[name];
        if (!def) throw new Error(`rebirth map rivers: no map "${name}"`);
        const map = def.mapGen.map;
        out[name] = {
            ...def,
            mapGen: { ...def.mapGen, map: { ...map, rivers: { ...map.rivers, weights: structuredClone(weights) } } },
        };
        deviations.push({
            id: name,
            field: "mapGen.map.rivers.weights",
            original: map.rivers.weights,
            rebirth: weights,
            reason: "more rivers (the owner, 2026-10-11)",
        });
    }
    return { maps: out, deviations };
}
