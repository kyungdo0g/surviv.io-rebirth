// The military base's guard posts (rebirth/buildings/military/): the gatehouse (위병소) by the main gate, which owns
// the gate's two steel leaves (its direct children) and a weapons cage behind a barred door (cell_door_01, survev
// police_01's cells) that the guard room's switch opens (a one-switch puzzle; reworked 2026-10-10: it replaces the panel
// that only locked the gate), and the corner watchtower (초소) placed twice: a 4x lookout (zoom 48) with loopholes on its
// two outer faces and the yard face, and a fire extinguisher in the corner beside the outer slits (shot through one, its
// smoke forces 1x).
// Expanded 2026-10-10 (the owner: "the hidden rooms are too small"): the gatehouse cannot grow, so the guard room
// shrinks to a 3.25-wide lobby with its door facing the gate and the cage takes the other 6.75 x 6 (was 4.5 x 6).
import { LOOKOUT_ZOOM } from "../layout.ts";

/** The gatehouse's weapons cage: its barred door (only the puzzle opens it; swings east into the cage). */
export const MILITARY_GATEHOUSE_CAGE_DOOR = { type: "cell_door_01", hinge: { x: 10.75, y: -35 }, ori: 2 } as const;
export const MILITARY_GATEHOUSE_PUZZLE = "rebirth_milbase_gatehouse";

import { fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "./part.ts";

export const MILITARY_GATEHOUSE: MilitaryPart = fromWorld({
    id: "military_gatehouse_01",
    layer: 0,
    parent: "military_compound_01",
    centre: { x: 12.5, y: -37 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: 6.5, y: -40.5 }, max: { x: 18.5, y: -33.5 } },
        material: "brick",
        walls: [
            ...hRun(-40.5, 6, 19, [], undefined, "brick"),
            ...hRun(-33.5, 6, 19, [], undefined, "brick"),
            // the lobby's door faces the gate
            ...vRun(6.5, -40, -34, [[-39, -35]], undefined, "brick"),
            ...vRun(18.5, -40, -34, [], undefined, "brick"),
            // lobby | weapons cage: the barred door -39..-35 swings east into the cage; the lobby door's leaf, open,
            // reaches the partition's face
            ...vRun(10.75, -40, -34, [[-39, -35]], undefined, "brick"),
        ],
        openings: [
            op("house_door_01", 6.25, -35, 2),
            // the main gate's leaves in the perimeter gap x -4..4, 0.25 outside its wall line
            op("house_door_02", -4, -41.75, 3),
            op("house_door_02", 4, -41.75, 1),
        ],
        rooms: [room(6.5, -40.5, 10.75, -33.5, "guard"), room(10.75, -40.5, 18.5, -33.5, "cage")],
    },
    puzzle: { name: MILITARY_GATEHOUSE_PUZZLE, door: MILITARY_GATEHOUSE_CAGE_DOOR.type },
    props: [
        p(
            MILITARY_GATEHOUSE_CAGE_DOOR.type,
            MILITARY_GATEHOUSE_CAGE_DOOR.hinge.x,
            MILITARY_GATEHOUSE_CAGE_DOOR.hinge.y,
            MILITARY_GATEHOUSE_CAGE_DOOR.ori,
            { wallLike: true },
        ),
        // the lobby: the switch on the south wall, clear of the door's swing
        p("switch_03", 8.6, -39.45, 0, { piece: "1" }),
        // the cage: a soldier's locker (an AK) and a shotgun rack in its south-east corner, the guards' floor loot and
        // level 3 armour (the jackpot) in the middle
        p("locker_03", 16.5, -39.25, 2),
        p("gun_mount_02", 17.1, -36.25, 3),
        p("loot_tier_police_floor", 13, -38),
        p("loot_tier_2", 13, -36),
        p("loot_tier_airdrop_armor", 15.25, -37),
    ],
    surfaces: [{ type: "tile", boxes: [[6.5, -40.5, 18.5, -33.5]] }],
    zoom: [fullZoom([6.5, -40.5, 18.5, -33.5])],
    images: [
        {
            sprite: "map-building-milbase-gatehouse-floor-01.img",
            kind: "floor",
            centre: { x: 12.5, y: -37 },
            size: [13, 8],
        },
        {
            sprite: "map-building-milbase-gatehouse-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 12.5, y: -37 },
            size: [13, 8],
        },
    ],
    mapShapes: [
        { box: [6, -41, 19, -33], color: 0xe6e6e0 },
        { box: [6, -34.2, 19, -33], color: 0xc8312e },
    ],
});

/** The corner watchtower, authored in its own frame: SW corner as is, NE corner turned ori 2. */
export const MILITARY_TOWER: MilitaryPart = {
    id: "military_tower_01",
    layer: 0,
    parent: "military_compound_01",
    placements: [
        { pos: { x: -48.5, y: -37.5 }, ori: 0 },
        { pos: { x: 48.5, y: 37.5 }, ori: 2 },
    ],
    zIdx: 1,
    layout: {
        bounds: { min: { x: -4, y: -4 }, max: { x: 4, y: 4 } },
        material: "concrete",
        walls: [
            ...hRun(-4, -4.5, 4.5, [[-1.5, 1.5]]),
            ...hRun(4, -4.5, 4.5, [[-1.5, 2.5]]),
            ...vRun(-4, -3.5, 3.5, [[-1.5, 1.5]]),
            ...vRun(4, -3.5, 3.5, [[-1.5, 1.5]]),
        ],
        openings: [
            // the outer faces (on the perimeter lines): south and west; the yard face: east
            op("brick_wall_ext_3_0_low", 0, -4, 1),
            op("brick_wall_ext_3_0_low", -4, 0, 0),
            op("brick_wall_ext_3_0_low", 4, 0, 0),
            op("house_door_01", -1.5, 4.25, 3),
        ],
        rooms: [room(-4, -4, 4, 4, "tower")],
    },
    props: [p("fire_ext_01", -2.5, -2.5), p("loot_tier_1", 1.5, 1)],
    surfaces: [{ type: "stone", boxes: [[-4, -4, 4, 4]] }],
    zoom: [{ zoomIn: [-3.5, -3.5, 3.5, 3.5], zoomOut: [-4.5, -4.5, 4.5, 4.5], zoom: LOOKOUT_ZOOM }],
    images: [
        { sprite: "map-building-milbase-tower-floor-01.img", kind: "floor", centre: { x: 0, y: 0 }, size: [9, 9] },
        { sprite: "map-building-milbase-tower-ceiling-01.img", kind: "ceiling", centre: { x: 0, y: 0 }, size: [9, 9] },
    ],
    mapShapes: [{ box: [-4.5, -4.5, 4.5, 4.5], color: 0x8a8c85 }],
};
