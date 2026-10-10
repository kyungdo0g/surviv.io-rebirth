// outpost_01r / outpost_01b, the rebirth faction command posts (50v50 only; the owner, 2026-10-08; reworked
// 2026-10-10: roomier, and the armory is the payoff): a concrete command post per faction, on its own side by `teamId`
// like bank_01 / police_01. The armory behind barred doors (cell_door_01, survev police_01's cells) holds the
// faction's crate (crate_02f / crate_22), a sniper crate (mil_crate_05, the jackpot), a shotgun mount, ammo and floor
// loot; the switch in the command room opens it (a one-switch puzzle). Widened 2026-10-10 (the owner: "expand the
// hidden rooms"): 13 x 10 inside, everything along the walls round an open floor. The command room has the map table,
// the hall bunks and lockers, sandbags at the door; the roof carries the faction's colour.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

// ---------------------------------------------------------------------------------------------------------------------
// outpost_01r / outpost_01b: 28 x 22 inside its walls. North: armory (13 x 10) | command room (13 x 10); south: the
// hall with bunks and lockers. Doorways 4 units; furniture flush against the walls or 2.6+ clear.

export const OUTPOST_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -14, y: -11 }, max: { x: 14, y: 11 } },
    material: "concrete",
    walls: [
        ...hRun(11, -14.5, 14.5),
        ...hRun(-11, -14.5, 14.5, [[-2, 2]]),
        ...vRun(-14, -10.5, 10.5, [[-8.5, -4.5]]),
        ...vRun(14, -10.5, 10.5, [
            [-8.5, -4.5],
            [2, 6],
        ]),
        // the hall wall: the armory's barred door, the command room door
        ...hRun(0, -14, 14, [
            [-10, -6],
            [4, 8],
        ]),
        ...vRun(0, 0, 11),
    ],
    openings: [
        op("house_door_01", -2, -11.25, 3),
        op("house_door_01", -14.25, -8.5, 0),
        op("house_door_01", 14.25, -8.5, 0),
        op("house_window_01", 14.25, 4, 0),
        op("house_door_01", 4, 0, 3),
    ],
    rooms: [room(-14, -11, 14, 0, "hall"), room(-14, 0, 0, 11, "armory"), room(0, 0, 14, 11, "command")],
};

/** The armory's barred door (cell_door_01: only the puzzle opens it; it swings out into the hall). */
export const OUTPOST_ARMORY_DOOR = { type: "cell_door_01", pos: { x: -6, y: 0 }, ori: 1 } as const;
export const OUTPOST_PUZZLE = "rebirth_outpost";
/** The switch on the command room's north wall. */
export const OUTPOST_SWITCH = { x: 3.5, y: 9.95 } as const;

/** The faction outposts: Red (1) and Blue (2), each with its faction crate and roof colour. */
export const OUTPOST_FACTIONS = [
    { id: "outpost_01r", teamId: 1, crate: "crate_02f", color: 0xb3261e },
    { id: "outpost_01b", teamId: 2, crate: "crate_22", color: 0x1f5fbf },
] as const;

export function outpostArt(teamId: number): RoofedBuildingArt {
    const side = teamId === 1 ? "red" : "blue";
    return layoutArt(OUTPOST_LAYOUT, "map-building-outpost-floor-01.img", `map-building-outpost-ceiling-${side}.img`);
}

export function outpost(faction: (typeof OUTPOST_FACTIONS)[number], known: (id: string) => boolean): BuildingDef {
    const L = OUTPOST_LAYOUT;
    const art = outpostArt(faction.teamId);
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-14.5, -11.5, 14.5, 11.5), color: 0x5d6152 },
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
            zoomRegions: [{ zoomIn: box(-14, -11, 14, 11), zoomOut: box(-14.5, -11.5, 14.5, 11.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: art.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(OUTPOST_PUZZLE, OUTPOST_ARMORY_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(
                OUTPOST_ARMORY_DOOR.type,
                OUTPOST_ARMORY_DOOR.pos.x,
                OUTPOST_ARMORY_DOOR.pos.y,
                OUTPOST_ARMORY_DOOR.ori,
            ),
            // the armory (x -13.5..-0.5, y 0.5..10.5): the faction's crate in the north-west corner over an ammo crate,
            // a shotgun on the north wall, a sniper crate against the east wall, floor loot in the north-east nook;
            // the floor between them stays open (the barred door swings out into the hall)
            child(faction.crate, -11.25, 8.25),
            child("crate_06", -11.25, 4.9),
            child("gun_mount_01", -6.75, 9.6),
            child("mil_crate_05", -1.75, 3.2, 1),
            child("loot_tier_2", -2.5, 8.25),
            // the command room: the map table (survev's blueprint table), the armory switch, a control panel
            child("table_04", 6, 5),
            piece("switch_03", OUTPOST_SWITCH.x, OUTPOST_SWITCH.y, 0, "1"),
            child("control_panel_02", 11.25, 8.8),
            child("loot_tier_2", 3, 3),
            // the hall: bunks in the south corners, lockers against the hall wall, loot
            child("bed_sm_01", -10.1, -9.1, 1),
            child("bed_sm_01", 10.1, -9.1, 1),
            child("locker_01", 0, -1.25),
            child("locker_01", 12, -1.25),
            child("loot_tier_1", -6, -6),
            child("loot_tier_1", 6, -5),
            // sandbags by the door
            child("sandbags_01", -6, -12.9),
            child("sandbags_01", 6, -12.9),
            child("sandbags_02", -15.6, -10),
            child("sandbags_02", 15.6, -10),
        ],
    };
}
