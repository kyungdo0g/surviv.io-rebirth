// arsenal_01, a rebirth building of 50v50 only (the owner, 2026-10-08; docs/research/rebirth-deviations.md "More
// rebirth buildings"): a neutral concrete arsenal on the front line (a tenth touching the river, rebirth front-line
// placement in sim mapgen placement.ts). Its steel magazine is sealed by two locked sliding doors
// (lab_door_locked_01) until a scheduled unlock opens them 90 s into the first circle and pings the map for everyone
// (MapDef gameConfig.unlocks, survev's Cobalt bunker doors; REBIRTH_BUILDING_UNLOCKS): a siege both factions see
// coming: the magazine holds two weapons crates, an LMG mount, ammo and level 3 armour. The roof needs no
// ceiling.destroy, so air strike bombs fizzle inside.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    layoutArt,
    openingChildren,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    wallChildren,
} from "./layout.ts";

// 31 x 23 inside (x -15.5..15.5, y -11.5..11.5): a ring corridor round the steel magazine (x -7.5..7.5, y -6..6).
export const ARSENAL_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -15.5, y: -11.5 }, max: { x: 15.5, y: 11.5 } },
    material: "concrete",
    walls: [
        // north and south: a door each at -2..2, facing a solid magazine wall 4.5 units in
        [-16, 11.5, -2, 11.5],
        [2, 11.5, 16, 11.5],
        [-16, -11.5, -2, -11.5],
        [2, -11.5, 16, -11.5],
        // west and east: windows -7..-3 and 3..7
        [-15.5, -11, -15.5, -7],
        [-15.5, -3, -15.5, 3],
        [-15.5, 7, -15.5, 11],
        [15.5, -11, 15.5, -7],
        [15.5, -3, 15.5, 3],
        [15.5, 7, 15.5, 11],
        // the magazine, steel (ricochets): its doors at -1.5..2.5 on both sides slide south into the walls below them
        [-8, 6, 8, 6, "metal"],
        [-8, -6, 8, -6, "metal"],
        [-7.5, -5.5, -7.5, -1.5, "metal"],
        [-7.5, 2.5, -7.5, 5.5, "metal"],
        [7.5, -5.5, 7.5, -1.5, "metal"],
        [7.5, 2.5, 7.5, 5.5, "metal"],
    ],
    openings: [
        { type: "house_door_01", pos: { x: -2, y: 11.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -2, y: -11.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: -15.75, y: 5 }, ori: 0 },
        { type: "house_window_01", pos: { x: -15.75, y: -5 }, ori: 0 },
        { type: "house_window_01", pos: { x: 15.75, y: 5 }, ori: 0 },
        { type: "house_window_01", pos: { x: 15.75, y: -5 }, ori: 0 },
        { type: "lab_door_locked_01", pos: { x: -7.5, y: -1.5 }, ori: 0 },
        { type: "lab_door_locked_01", pos: { x: 7.5, y: -1.5 }, ori: 0 },
    ],
    rooms: [
        { min: { x: -15.5, y: -11.5 }, max: { x: 15.5, y: 11.5 }, floor: "corridor" },
        { min: { x: -7.5, y: -6 }, max: { x: 7.5, y: 6 }, floor: "magazine" },
    ],
};

export const ARSENAL_ART: RoofedBuildingArt = layoutArt(
    ARSENAL_LAYOUT,
    "map-building-arsenal-floor-01.img",
    "map-building-arsenal-ceiling-01.img",
);

/** The magazine's unlock: when the gas enters circle 0, 90 s later its doors open one per second (unlocks.ts). */
export const ARSENAL_UNLOCK = { type: "arsenal_01", stagger: 1, circleIdx: 0, wait: 90 } as const;

export function arsenal(known: (id: string) => boolean): BuildingDef {
    const L = ARSENAL_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-16, -12, 16, 12), color: 0x4f524c },
                { collider: box(-7.5, -6, 7.5, 6), color: 0xf0c419 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "stone", collision: [box(-15.5, -11.5, 15.5, 11.5)] },
                { type: "bunker", collision: [box(-7.5, -6, 7.5, 6)] },
            ],
            imgs: [{ sprite: ARSENAL_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-15.5, -11.5, 15.5, 11.5), zoomOut: box(-16, -12, 16, 12) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: ARSENAL_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            // the ring corridor: ammo crates against the outer walls in two corners, lockers, loot by the vault doors
            // (everything flush against a wall or 2.6+ clear: reworked 2026-10-10)
            child("crate_06", -13.9, 8.75, 1),
            child("crate_06", 13.9, -8.75, 1),
            child("locker_01", -14.25, -9.5, 1),
            child("locker_01", 14.25, 9.5, 3),
            child("loot_tier_1", -11.5, 0.5),
            child("loot_tier_1", 11.5, 0.5),
            // the magazine: guns and a sniper, guns and throwables, an LMG on the wall, an ammo crate, a level 3 armour
            // piece
            child("mil_crate_05", -4.3, 4.25),
            child("mil_crate_04", 4.3, 4.25),
            child("gun_mount_03", -4.75, -4.6, 2),
            child("crate_04", 3.5, -3.25),
            child("loot_tier_airdrop_armor", 0, 0.5),
            // outside: sandbags flanking both doors, bushes
            child("sandbags_01", -5.5, 13.6),
            child("sandbags_01", 5.5, 13.6),
            child("sandbags_01", -5.5, -13.6),
            child("sandbags_01", 5.5, -13.6),
            child("bush_01", -17.5, 0),
            child("bush_01", 17.5, 0),
        ],
    };
}
