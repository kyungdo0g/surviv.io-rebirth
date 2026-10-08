// blockhouse_01r / blockhouse_01b, rebirth buildings of 50v50 only (the owner, 2026-10-08; docs/research/
// rebirth-deviations.md "More rebirth buildings"): a fieldstone blockhouse per faction, two per side, in its own two
// tenths beside the river (rebirth front-line placement in sim mapgen placement.ts; `teamId` gives the side). Two
// chambers split by a traverse wall; eight loopholes on all four sides (brick_wall_ext_3_0_low: bullets and grenades
// pass, players do not, survev's bridge railings) so any orientation covers the river; steel doors (house_door_02); the
// whole keep gives a 4x view (zoom 48, the bathhouse's) and its roof stops air strike bombs. Anyone can use it.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    circle,
    LOOKOUT_ZOOM,
    layoutArt,
    openingChildren,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    wallChildren,
} from "./layout.ts";

// 21 x 21 inside (x, y -10.5..10.5): north and south chambers, the traverse at y 0 with 3.5-unit passages at its ends.
export const BLOCKHOUSE_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -10.5, y: -10.5 }, max: { x: 10.5, y: 10.5 } },
    material: "brick",
    walls: [
        // north and south: loopholes -8..-5 and 5..8, the steel door -2..2
        [-11, 10.5, -8, 10.5],
        [-5, 10.5, -2, 10.5],
        [2, 10.5, 5, 10.5],
        [8, 10.5, 11, 10.5],
        [-11, -10.5, -8, -10.5],
        [-5, -10.5, -2, -10.5],
        [2, -10.5, 5, -10.5],
        [8, -10.5, 11, -10.5],
        // west and east: loopholes -7..-4 and 4..7
        [-10.5, -10, -10.5, -7],
        [-10.5, -4, -10.5, 4],
        [-10.5, 7, -10.5, 10],
        [10.5, -10, 10.5, -7],
        [10.5, -4, 10.5, 4],
        [10.5, 7, 10.5, 10],
        // the traverse
        [-6.5, 0, 6.5, 0],
    ],
    openings: [
        { type: "house_door_02", pos: { x: -2, y: 10.75 }, ori: 3 },
        { type: "house_door_02", pos: { x: -2, y: -10.75 }, ori: 3 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -6.5, y: 10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 6.5, y: 10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -6.5, y: -10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 6.5, y: -10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -10.5, y: 5.5 }, ori: 0 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -10.5, y: -5.5 }, ori: 0 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 10.5, y: 5.5 }, ori: 0 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 10.5, y: -5.5 }, ori: 0 },
    ],
    rooms: [
        { min: { x: -10.5, y: 0 }, max: { x: 10.5, y: 10.5 }, floor: "chamber" },
        { min: { x: -10.5, y: -10.5 }, max: { x: 10.5, y: 0 }, floor: "chamber" },
    ],
};

/** The blockhouses: Red (1) and Blue (2), each with its faction's roof colour. */
export const BLOCKHOUSE_FACTIONS = [
    { id: "blockhouse_01r", teamId: 1, color: 0xb3261e },
    { id: "blockhouse_01b", teamId: 2, color: 0x1f5fbf },
] as const;

export function blockhouseArt(teamId: number): RoofedBuildingArt {
    const side = teamId === 1 ? "red" : "blue";
    return layoutArt(
        BLOCKHOUSE_LAYOUT,
        "map-building-blockhouse-floor-01.img",
        `map-building-blockhouse-ceiling-${side}.img`,
    );
}

export function blockhouse(faction: (typeof BLOCKHOUSE_FACTIONS)[number], known: (id: string) => boolean): BuildingDef {
    const L = BLOCKHOUSE_LAYOUT;
    const art = blockhouseArt(faction.teamId);
    return {
        type: "building",
        map: {
            display: true,
            // light stone with a ring in the faction's colour
            shapes: [
                { collider: box(-11, -11, 11, 11), color: 0xa8a296 },
                { collider: circle(0, 0, 4), color: faction.color },
                { collider: circle(0, 0, 2.25), color: 0xa8a296 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        teamId: faction.teamId,
        floor: {
            surfaces: [{ type: "stone", collision: [box(-10.5, -10.5, 10.5, 10.5)] }],
            imgs: [{ sprite: art.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [
                { zoomIn: box(-10.5, -10.5, 10.5, 10.5), zoomOut: box(-11, -11, 11, 11), zoom: LOOKOUT_ZOOM },
            ],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: art.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            // the north chamber: central sandbags against a door breach, ammo, throwables
            child("sandbags_02", 0, 4),
            child("crate_06", -3.75, 1.6),
            child("crate_03", 4, 2.1),
            child("loot_tier_2", 7, 8),
            child("loot_tier_1", -7, 7.5),
            // the south chamber (turned round): no faction crates (survevFaction.test.ts spaces them)
            child("sandbags_02", 0, -4),
            child("crate_06", 3.75, -1.6),
            child("crate_14", -4, -2.75),
            child("loot_tier_1", -7, -7.5),
            child("loot_tier_1", 7, -8),
            // outside: sandbags beside the doors, hedgehogs and bushes at the corners, clear of the loopholes' lines
            child("sandbags_02", -3.6, 12.4),
            child("sandbags_02", 3.6, -12.4),
            child("hedgehog_01", -14.5, 14.5),
            child("hedgehog_01", 14.5, -14.5),
            child("bush_01f", 15, 14.5),
            child("bush_01f", -15, -14.5),
        ],
    };
}
