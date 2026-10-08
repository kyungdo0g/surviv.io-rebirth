// outpost_01r / outpost_01b, the rebirth faction command posts (50v50 only; the owner, 2026-10-08): a concrete command
// post per faction, on its own side by `teamId` like bank_01 / police_01, with an armory (the faction's crate, crate_02f
// / crate_22, a shotgun mount and ammo), a command room with the map table and bunks, sandbags at the door; the roof
// carries the faction's colour.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    artSize,
    box,
    child,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    wallChildren,
} from "./layout.ts";

// ---------------------------------------------------------------------------------------------------------------------
// outpost_01r / outpost_01b: 23 x 19 inside its walls. North: armory | command room; south: bunks and lockers.

export const OUTPOST_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -11.5, y: -9.5 }, max: { x: 11.5, y: 9.5 } },
    material: "concrete",
    walls: [
        [-12, 9.5, 12, 9.5],
        [-12, -9.5, -1.5, -9.5],
        [2.5, -9.5, 12, -9.5],
        [-11.5, -9, -11.5, -6],
        [-11.5, -2, -11.5, 9],
        [11.5, -9, 11.5, -6],
        [11.5, -2, 11.5, 9],
        [-11, 1, -8, 1],
        [-4, 1, 3, 1],
        [7, 1, 11, 1],
        [-1, 1, -1, 9],
    ],
    openings: [
        { type: "house_door_01", pos: { x: -1.5, y: -9.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -11.75, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: 11.75, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: -8, y: 1 }, ori: 3 },
        { type: "house_door_01", pos: { x: 3, y: 1 }, ori: 3 },
    ],
    rooms: [
        { min: { x: -11.5, y: -9.5 }, max: { x: 11.5, y: 1 }, floor: "hall" },
        { min: { x: -11.5, y: 1 }, max: { x: -1, y: 9.5 }, floor: "armory" },
        { min: { x: -1, y: 1 }, max: { x: 11.5, y: 9.5 }, floor: "command" },
    ],
};

/** The faction outposts: Red (1) and Blue (2), each with its faction crate and roof colour. */
export const OUTPOST_FACTIONS = [
    { id: "outpost_01r", teamId: 1, crate: "crate_02f", color: 0xb3261e },
    { id: "outpost_01b", teamId: 2, crate: "crate_22", color: 0x1f5fbf },
] as const;

export function outpostArt(teamId: number): RebirthBuildingArt {
    const side = teamId === 1 ? "red" : "blue";
    return {
        floor: "map-building-outpost-floor-01.img",
        ceiling: `map-building-outpost-ceiling-${side}.img`,
        size: artSize(OUTPOST_LAYOUT),
    };
}

export function outpost(faction: (typeof OUTPOST_FACTIONS)[number], known: (id: string) => boolean): BuildingDef {
    const L = OUTPOST_LAYOUT;
    const art = outpostArt(faction.teamId);
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-12, -10, 12, 10), color: 0x5d6152 },
                { collider: box(-3, -2.5, 3, 2.5), color: faction.color },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        teamId: faction.teamId,
        floor: {
            surfaces: [
                { type: "bunker", collision: [box(L.bounds.min.x, L.bounds.min.y, L.bounds.max.x, L.bounds.max.y)] },
            ],
            imgs: [{ sprite: art.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-11.5, -9.5, 11.5, 9.5), zoomOut: box(-12, -10, 12, 10) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: art.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        mapObjects: [
            ...wallChildren(L.material, L.walls, known),
            ...L.openings.map((o) => child(o.type, o.pos.x, o.pos.y, o.ori)),
            // armory: the faction's crate, a shotgun on the wall, an ammo crate
            child(faction.crate, -8.5, 6.5),
            child("gun_mount_01", -4, 8.1),
            child("crate_06", -4, 3),
            // command room: the map table (survev's blueprint table), a control panel
            child("table_04", 5, 3.6),
            child("control_panel_02", 8.7, 7.3),
            child("loot_tier_2", 2.5, 7.3),
            // bunks and lockers
            child("bed_sm_01", -7.5, -7.4, 1),
            child("bed_sm_01", 7.5, -7.4, 1),
            child("locker_01", -9.3, -0.25),
            child("locker_01", -2.5, -0.25),
            child("locker_01", 0.5, -0.25),
            child("loot_tier_1", -4, -4),
            child("loot_tier_1", 5, -3.5),
            // sandbags by the door
            child("sandbags_01", -6.5, -11.8),
            child("sandbags_01", 7, -11.8),
            child("sandbags_02", -13.6, -8),
            child("sandbags_02", 13.6, -8),
        ],
    };
}
