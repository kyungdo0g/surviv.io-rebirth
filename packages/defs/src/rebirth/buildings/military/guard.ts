// The military base's guard posts (rebirth/buildings/military/): the gatehouse (위병소) by the main gate, which owns
// the gate's two steel leaves (its direct children) and an indestructible panel that closes and locks them for 12 s
// (control_panel_07de, survev's: 27 s cooldown), and the corner watchtower (초소) placed twice: a 4x lookout (zoom 48)
// with loopholes on its two outer faces and the yard face, and a fire extinguisher behind the outer slit (shot through
// it, its smoke forces 1x).
import { LOOKOUT_ZOOM } from "../layout.ts";
import { fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "./part.ts";

export const MILITARY_GATEHOUSE: MilitaryPart = fromWorld({
    id: "military_gatehouse_01",
    layer: 0,
    parent: "military_compound_01",
    centre: { x: 11, y: -37 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: 6.5, y: -40.5 }, max: { x: 15.5, y: -33.5 } },
        material: "brick",
        walls: [
            ...hRun(-40.5, 6, 16, [], undefined, "brick"),
            ...hRun(-33.5, 6, 16, [[7, 11]], undefined, "brick"),
            ...vRun(6.5, -40, -34, [[-39, -35]], undefined, "brick"),
            ...vRun(15.5, -40, -34, [], undefined, "brick"),
        ],
        openings: [
            op("house_door_01", 7, -33.25, 3),
            op("house_window_01", 6.25, -37, 0),
            // the main gate's leaves in the perimeter gap x -4..4, 0.25 outside its wall line
            op("house_door_02", -4, -41.75, 3),
            op("house_door_02", 4, -41.75, 1),
        ],
        rooms: [room(6.5, -40.5, 15.5, -33.5, "guard")],
    },
    props: [p("control_panel_07de", 13.2, -37.5, 1), p("loot_tier_1", 9, -38.5)],
    surfaces: [{ type: "tile", boxes: [[6.5, -40.5, 15.5, -33.5]] }],
    zoom: [fullZoom([6.5, -40.5, 15.5, -33.5])],
    images: [
        {
            sprite: "map-building-milbase-gatehouse-floor-01.img",
            kind: "floor",
            centre: { x: 11, y: -37 },
            size: [10, 8],
        },
        {
            sprite: "map-building-milbase-gatehouse-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 11, y: -37 },
            size: [10, 8],
        },
    ],
    mapShapes: [
        { box: [6, -41, 16, -33], color: 0xe6e6e0 },
        { box: [6, -34.2, 16, -33], color: 0xc8312e },
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
    props: [p("fire_ext_01", 0, -2.4), p("loot_tier_1", -2, 1.5)],
    surfaces: [{ type: "stone", boxes: [[-4, -4, 4, 4]] }],
    zoom: [{ zoomIn: [-3.5, -3.5, 3.5, 3.5], zoomOut: [-4.5, -4.5, 4.5, 4.5], zoom: LOOKOUT_ZOOM }],
    images: [
        { sprite: "map-building-milbase-tower-floor-01.img", kind: "floor", centre: { x: 0, y: 0 }, size: [9, 9] },
        { sprite: "map-building-milbase-tower-ceiling-01.img", kind: "ceiling", centre: { x: 0, y: 0 }, size: [9, 9] },
    ],
    mapShapes: [{ box: [-4.5, -4.5, 4.5, 4.5], color: 0x8a8c85 }],
};
