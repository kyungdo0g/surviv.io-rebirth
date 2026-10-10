// The radar base's smaller buildings (the owner's wave 3, 2026-10-10; docs/research/rebirth-deviations.md "The radar
// base"): the barracks (막사) in the west yard, two dormitories with bunks, a common room with the shotgun rack and a
// washroom behind breakable wood partitions (the owner, 2026-10-10); the guard post (위병소) on the fence line beside
// the main gate, its window looking out of the base, a shotgun rack (MP220) inside; and the generator shed (발전기실), a
// steel shed whose power boxes, propane bottles and fuel drum blow up together (explosion_barrel each), by the fuel depot.
import { fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "../military/part.ts";

export const RADAR_BARRACKS: MilitaryPart = fromWorld({
    id: "radar_barracks_01",
    layer: 0,
    parent: "radar_base_01",
    centre: { x: -32.5, y: -13 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: -45, y: -26 }, max: { x: -20, y: 0 } },
        material: "concrete",
        walls: [
            // north: the back door; south: blank; west: a window per dormitory; east: the main door, the common room's
            // and the washroom's windows
            ...hRun(0, -45.5, -19.5, [[-31, -27]]),
            ...hRun(-26, -45.5, -19.5),
            ...vRun(-45, -25.5, -0.5, [
                [-21, -17],
                [-8, -4],
            ]),
            ...vRun(-20, -25.5, -0.5, [
                [-24, -20],
                [-15, -11],
                [-8, -4],
            ]),
            // dormitories | common room and washroom, dormitory | dormitory, common room | washroom (breakable wood)
            ...vRun(
                -32,
                -26,
                0,
                [
                    [-17, -13],
                    [-9, -5],
                ],
                "wood",
            ),
            ...hRun(-12, -45, -32, [], "wood"),
            ...hRun(-18, -32, -20, [[-25, -21]], "wood"),
        ],
        openings: [
            op("house_door_01", -19.75, -8, 0),
            op("house_door_01", -31, 0.25, 3),
            op("house_window_01", -45.25, -19, 0),
            op("house_window_01", -45.25, -6, 0),
            op("house_window_01", -19.75, -22, 0),
            op("house_window_01", -19.75, -13, 0),
            op("house_door_01", -32, -17, 0),
            op("house_door_01", -32, -9, 0),
            op("house_door_01", -25, -18, 3),
        ],
        rooms: [
            room(-45, -12, -32, 0, "dorm"),
            room(-45, -26, -32, -12, "dorm"),
            room(-32, -18, -20, 0, "common"),
            room(-32, -26, -20, -18, "washroom"),
        ],
    },
    props: [
        // the north dormitory: two bunks against the north wall, a footlocker by the partition
        p("bed_sm_01", -43.1, -3.9),
        p("bed_sm_01", -37, -3.9),
        p("locker_01", -43, -10.75, 2),
        p("loot_tier_2", -36, -9),
        // the south dormitory: two bunks against the south wall, a chest of drawers
        p("bed_sm_01", -43.1, -22.1),
        p("bed_sm_01", -37, -22.1),
        p("drawers_01", -42, -13.9),
        p("loot_tier_2", -36, -16),
        // the common room: the shotgun rack on the north wall, a soldier's locker (an AK) on the partition, floor loot
        p("gun_mount_01", -22.75, -1.4),
        p("locker_03", -30.75, -11, 1),
        p("loot_tier_2", -26, -9),
        p("loot_tier_2", -24, -4),
        // the washroom
        p("toilet_01", -30.32, -24.57),
        p("toilet_01", -25.3, -24.57),
    ],
    surfaces: [
        { type: "house", boxes: [[-45, -26, -20, 0]] },
        { type: "tile", boxes: [[-32, -26, -20, -18]] },
    ],
    zoom: [fullZoom([-45, -26, -20, 0])],
    images: [
        {
            sprite: "map-building-radar-barracks-floor-01.img",
            kind: "floor",
            centre: { x: -32.5, y: -13 },
            size: [26, 27],
        },
        {
            sprite: "map-building-radar-barracks-ceiling-01.img",
            kind: "ceiling",
            centre: { x: -32.5, y: -13 },
            size: [26, 27],
        },
    ],
    mapShapes: [{ box: [-45.5, -26.5, -19.5, 0.5], color: 0x6f7558 }],
});

export const RADAR_GUARD: MilitaryPart = fromWorld({
    id: "radar_guard_01",
    layer: 0,
    parent: "radar_base_01",
    centre: { x: 15, y: -40.5 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: 10.5, y: -44.5 }, max: { x: 19.5, y: -36.5 } },
        material: "concrete",
        walls: [
            // its south wall is the fence line (a window out of the base); the door faces the gate road
            ...hRun(-44.5, 10, 20, [[13, 17]]),
            ...hRun(-36.5, 10, 20, [[13, 17]]),
            ...vRun(10.5, -44, -37, [[-42.5, -38.5]]),
            ...vRun(19.5, -44, -37),
        ],
        openings: [
            op("house_door_01", 10.25, -42.5, 0),
            op("house_window_01", 15, -44.75, 3),
            op("house_window_01", 15, -36.25, 1),
        ],
        rooms: [room(10.5, -44.5, 19.5, -36.5, "guard")],
    },
    props: [p("gun_mount_02", 18.1, -40.5, 3), p("loot_tier_2", 14.5, -40.5), p("loot_tier_1", 14.5, -38)],
    surfaces: [{ type: "tile", boxes: [[10.5, -44.5, 19.5, -36.5]] }],
    zoom: [fullZoom([10.5, -44.5, 19.5, -36.5])],
    images: [
        { sprite: "map-building-radar-guard-floor-01.img", kind: "floor", centre: { x: 15, y: -40.5 }, size: [10, 9] },
        {
            sprite: "map-building-radar-guard-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 15, y: -40.5 },
            size: [10, 9],
        },
    ],
    mapShapes: [{ box: [10, -45, 20, -36], color: 0xe6e6e0 }],
});

export const RADAR_GENERATOR: MilitaryPart = fromWorld({
    id: "radar_generator_01",
    layer: 0,
    parent: "radar_base_01",
    centre: { x: 31, y: -35 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: 24, y: -40 }, max: { x: 38, y: -30 } },
        material: "metal",
        walls: [
            ...hRun(-40, 23.5, 38.5, [], undefined, "metal"),
            // the yard door north, the depot door east (both in the north-east corner, clear of the drums)
            ...hRun(-30, 23.5, 38.5, [[32.5, 36.5]], undefined, "metal"),
            ...vRun(24, -39.5, -30.5, [], undefined, "metal"),
            ...vRun(38, -39.5, -30.5, [[-34.5, -30.5]], undefined, "metal"),
        ],
        openings: [op("house_door_02", 32.5, -29.75, 3), op("house_door_02", 38.25, -34.5, 0)],
        rooms: [room(24, -40, 38, -30, "generator")],
    },
    props: [
        // the generator set (indestructible, ricochets) against the north wall; along the south wall the power boxes
        // with propane bottles between them and a fuel drum at the end, each exploding (explosion_barrel, 125 damage):
        // a power box (250 hp) survives one blast but not two, a bottle (50 hp) none, so one blast sets off the row
        // (packages/sim/test/rebirthRadar.test.ts)
        p("table_07", 27.8, -31.65),
        p("power_box_01", 25.5, -38.5),
        p("propane_01", 27.75, -38.25),
        p("power_box_01", 30, -38.5),
        p("propane_01", 32.25, -38.25),
        p("barrel_01", 35.75, -37.75),
        p("loot_tier_2", 30, -35),
    ],
    surfaces: [{ type: "container", boxes: [[24, -40, 38, -30]] }],
    zoom: [fullZoom([24, -40, 38, -30])],
    images: [
        {
            sprite: "map-building-radar-generator-floor-01.img",
            kind: "floor",
            centre: { x: 31, y: -35 },
            size: [15, 11],
        },
        {
            sprite: "map-building-radar-generator-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 31, y: -35 },
            size: [15, 11],
        },
    ],
    mapShapes: [{ box: [23.5, -40.5, 38.5, -29.5], color: 0x7d868c }],
});
