// power_plant_turbine_01, the power plant's turbine hall (power_plant_01; the owner's wave 3, 2026-10-10: "a power
// plant"; docs/research/rebirth-deviations.md "The power plant"): a concrete hall 42 x 28 inside on one floor (no
// catwalks) north of the plant's road. Two turbine-generator sets run east-west, each a 24-long steel casing (two
// invisible container_05_collider blocks, indestructible, drawn by the floor art) ending in its exciter cabinet
// (control_panel_02b, indestructible): the south set stands free between a 5.25 south aisle and a 10.75 centre aisle,
// the north set against the north wall. The west bay holds crates, the east bay two power boxes that explode; doors
// south (two), west and east. Authored in the plant's frame (origin the compound centre, +y north).
import { type Box, fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "../military/part.ts";

/** The hall's floor box (plant frame). */
export const PLANT_TURBINE_BOX: Box = [-18, 8, 24, 36];
/** The turbine sets' casings: centre y, x from..to (two 12-long colliders each), the exciter's centre. */
export const PLANT_TURBINES = [
    { y: 16.5, x0: -10, x1: 14, exciter: { x: 16.25, y: 16.5 } },
    { y: 32.75, x0: -10, x1: 14, exciter: { x: 16.25, y: 33.8 } },
] as const;
/** Half the casing's depth (container_05_collider turned: 12 x 5.5). */
export const PLANT_TURBINE_HALF = 2.75;

const [X0, Y0, X1, Y1] = PLANT_TURBINE_BOX;

export const PLANT_TURBINE: MilitaryPart = fromWorld({
    id: "power_plant_turbine_01",
    layer: 0,
    parent: "power_plant_01",
    centre: { x: (X0 + X1) / 2, y: (Y0 + Y1) / 2 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: X0, y: Y0 }, max: { x: X1, y: Y1 } },
        material: "concrete",
        walls: [
            // south: windows at -13 and 6, the doors at -6..-2 and 12..16 onto the road
            ...hRun(Y0, X0 - 0.5, X1 + 0.5, [
                [-15, -11],
                [-6, -2],
                [4, 8],
                [12, 16],
            ]),
            // north: a window over each bay
            ...hRun(Y1, X0 - 0.5, X1 + 0.5, [
                [-15, -11],
                [17.5, 21.5],
            ]),
            // west: a door into the west bay; east: a door into the east bay, toward the transformer yard
            ...vRun(X0, Y0 + 0.5, Y1 - 0.5, [[20, 24]]),
            ...vRun(X1, Y0 + 0.5, Y1 - 0.5, [[22, 26]]),
        ],
        openings: [
            op("house_window_01", -13, Y0 - 0.25, 3),
            op("house_door_01", -6, Y0 - 0.25, 3),
            op("house_window_01", 6, Y0 - 0.25, 3),
            op("house_door_01", 12, Y0 - 0.25, 3),
            op("house_window_01", -13, Y1 + 0.25, 1),
            op("house_window_01", 19.5, Y1 + 0.25, 1),
            op("house_door_01", X0 - 0.25, 20, 0),
            op("house_door_01", X1 + 0.25, 22, 0),
        ],
        rooms: [room(X0, Y0, X1, Y1, "hall")],
    },
    props: [
        // the turbine sets: two casing blocks end to end, the exciter cabinet flush at the east end
        ...PLANT_TURBINES.flatMap((t) => [
            p("container_05_collider", t.x0 + 6, t.y, 1),
            p("container_05_collider", t.x1 - 6, t.y, 1),
            p("control_panel_02b", t.exciter.x, t.exciter.y),
        ]),
        // the west bay: weapons crates in the south-west and north-west corners, floor loot
        p("mil_crate_04", -14.8, 9.75),
        p("mil_crate_04", -16.25, 32.8, 1),
        p("loot_tier_2", -13.5, 25),
        // the centre aisle: a crate between the sets (3.1 clear on either side), floor loot at both ends
        p("crate_01", 2, 24.6),
        p("loot_tier_1", -6, 24.5),
        p("loot_tier_1", 11, 24.5),
        // the south aisle
        p("loot_tier_1", 2, 11),
        // the east bay: two power boxes in the north-east corner (they explode), a weapons crate in the south-east
        // corner, floor loot
        p("power_box_01", 22.5, 34.5),
        p("power_box_01", 22.5, 32.5),
        p("mil_crate_04", 22.25, 11.2, 1),
        p("loot_tier_1", 20.5, 28),
    ],
    surfaces: [{ type: "stone", boxes: [PLANT_TURBINE_BOX] }],
    zoom: [fullZoom(PLANT_TURBINE_BOX)],
    images: [
        {
            sprite: "map-building-powerplant-turbine-floor-01.img",
            kind: "floor",
            centre: { x: (X0 + X1) / 2, y: (Y0 + Y1) / 2 },
            size: [X1 - X0 + 1, Y1 - Y0 + 1],
        },
        {
            sprite: "map-building-powerplant-turbine-ceiling-01.img",
            kind: "ceiling",
            centre: { x: (X0 + X1) / 2, y: (Y0 + Y1) / 2 },
            size: [X1 - X0 + 1, Y1 - Y0 + 1],
        },
    ],
    mapShapes: [
        { box: [X0 - 0.5, Y0 - 0.5, X1 + 0.5, Y1 + 0.5], color: 0x6c7f8c },
        { box: [X0 + 3, (Y0 + Y1) / 2 - 1, X1 - 3, (Y0 + Y1) / 2 + 1], color: 0x9fb4c0 },
    ],
});
