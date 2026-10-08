// The military base's yard buildings (rebirth/buildings/military/): the storehouse (창고) west of the parade ground with
// the freight stairs down to the Spine (S3), and the garage (차고) east of it with the doorless vehicle ramp down to the
// motor pool (S4, its mouth lined up with the motor gate for a drive-in raid) and the workshop holding the sledgehammer
// (the vault's breach wall needs it).
import { fromWorld, fullZoom, hRun, low, type MilitaryPart, op, p, room, vRun } from "./part.ts";

export const MILITARY_STOREHOUSE: MilitaryPart = fromWorld({
    id: "military_storehouse_01",
    layer: 0,
    parent: "military_compound_01",
    centre: { x: -38.5, y: -2.5 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: -48.5, y: -14.5 }, max: { x: -28.5, y: 9.5 } },
        material: "concrete",
        walls: [
            ...hRun(9.5, -49, -28, [[-34, -30]]),
            ...hRun(-14.5, -49, -28, [[-34, -30]]),
            ...vRun(-48.5, -14, 9, [[-6, -2]]),
            // the 8-wide loading mouth toward the parade ground
            ...vRun(-28.5, -14, 9, [[-8, 0]]),
            // the S3 stairwell (down east): the north wall is its north side; its south side, the closer at x -36.5
            ...hRun(4.5, -43, -37),
            ...vRun(-36.5, 4, 9),
        ],
        openings: [
            op("house_door_01", -34, 9.75, 3),
            op("house_door_01", -34, -14.75, 3),
            op("house_window_01", -48.75, -4, 0),
        ],
        rooms: [room(-48.5, -14.5, -28.5, 9.5, "store"), room(-43, 5, -37, 9, "stairs_down_e")],
    },
    props: [
        // pallet stacks (indestructible cover), crates of throwables and ammunition, a cabinet
        p("crate_05", -43.5, -4),
        p("crate_05", -38.5, -4),
        p("crate_01", -44, -11.5),
        p("drawers_01", -39, -12.9),
        p("crate_03", -34.5, -6.5),
        p("crate_04", -31.3, 2.8),
        p("loot_tier_2", -45, 1),
    ],
    surfaces: [
        { type: "warehouse", boxes: [[-48.5, -14.5, -28.5, 9.5]] },
        { type: "container", boxes: [[-43, 5, -37, 9]] },
    ],
    zoom: [fullZoom([-48.5, -14.5, -28.5, 9.5])],
    images: [
        {
            sprite: "map-building-milbase-storehouse-floor-01.img",
            kind: "floor",
            centre: { x: -38.5, y: -2.5 },
            size: [21, 25],
        },
        {
            sprite: "map-building-milbase-storehouse-ceiling-01.img",
            kind: "ceiling",
            centre: { x: -38.5, y: -2.5 },
            size: [21, 25],
        },
    ],
    mapShapes: [{ box: [-49, -15, -28, 10], color: 0xb59e6e }],
});

export const MILITARY_GARAGE: MilitaryPart = fromWorld({
    id: "military_garage_01",
    layer: 0,
    parent: "military_compound_01",
    centre: { x: 38, y: -7.5 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: 28.5, y: -20.5 }, max: { x: 47.5, y: 5.5 } },
        material: "concrete",
        walls: [
            ...hRun(5.5, 28, 48, [[35, 39]]),
            ...hRun(-20.5, 28, 48, [
                [37, 41],
                [42.5, 46.5],
            ]),
            // west: the 9-wide bay mouth y -4..5 toward the parade ground
            ...vRun(28.5, -20, -4),
            // east: the ramp's mouth y -15..-6 facing the motor gate
            ...vRun(47.5, -20, 5, [[-15, -6]]),
            // the S4 ramp's closer at its bottom (full height); its sides are low steel rails
            ...vRun(36, -16, -5),
            // the workshop in the north-east corner (brick partitions)
            ...hRun(-1.5, 40, 47, [], "brick"),
            ...vRun(40.5, -1, 5, [[0, 4]], "brick"),
        ],
        openings: [
            op("house_door_01", 35, 5.75, 3),
            op("house_door_01", 42.5, -20.75, 3),
            op("house_window_01", 39, -20.75, 3),
            op("house_door_01", 40.5, 0, 0),
        ],
        rooms: [
            room(28.5, -20.5, 47.5, 5.5, "bay"),
            room(40.5, -1.5, 47.5, 5.5, "workshop"),
            room(36.5, -15, 43.5, -6, "ramp_down_w"),
        ],
    },
    props: [
        low("metal_wall_ext_short_7", 40, -15.5, 1),
        low("metal_wall_ext_short_7", 40, -5.5, 1),
        // the workshop: the sledgehammer (the key to the vault's breach wall), a power box (explodes), an extinguisher
        p("loot_tier_sledgehammer", 43.5, 3),
        p("power_box_01", 46, 0),
        p("fire_ext_01", 46, 2.6, 2),
        // the north bay: a locker, a barrel by the ramp's upper half (its blast reaches players on the ramp), propane
        p("locker_01", 32, 4.4, 2),
        p("barrel_01", 38, -3.2),
        p("propane_01", 30.5, -2),
        p("loot_tier_1", 33, 1),
        // the south bay and the west lane
        p("barrel_01", 31.5, -18),
        p("crate_06", 38.5, -18.5),
        p("crate_06", 30.2, -10, 1),
        p("loot_tier_2", 33, -13),
        p("decal_oil_01", 34, -1),
        p("decal_oil_03", 42, -18),
        p("decal_oil_05", 32, -16),
    ],
    surfaces: [
        { type: "asphalt", boxes: [[28.5, -20.5, 47.5, 5.5]] },
        { type: "house", boxes: [[40.5, -1.5, 47.5, 5.5]] },
        { type: "container", boxes: [[36.5, -15, 43.5, -6]] },
    ],
    zoom: [fullZoom([28.5, -20.5, 47.5, 5.5])],
    images: [
        {
            sprite: "map-building-milbase-garage-floor-01.img",
            kind: "floor",
            centre: { x: 38, y: -7.5 },
            size: [20, 27],
        },
        {
            sprite: "map-building-milbase-garage-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 38, y: -7.5 },
            size: [20, 27],
        },
    ],
    mapShapes: [
        { box: [28, -21, 48, 6], color: 0x8b8e87 },
        { box: [46, -15, 48, -6], color: 0xe2b425 },
    ],
});
