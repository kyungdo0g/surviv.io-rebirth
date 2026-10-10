// power_plant_01, the power plant (발전소; the owner's wave 3, 2026-10-10: "a power plant"; docs/research/
// rebirth-deviations.md "The power plant"): a roofless walled compound 101 x 81 on 50v50, neutral, placed anywhere
// (the front-line tenths found no room for it on 11 of 100 seeds). A concrete perimeter with four open gates (the main
// gate south on the plant road, the west and east gates on the east-west road, a postern north by the transformer
// yard); inside, the turbine hall
// (turbine.ts) and the control building (control.ts) as child buildings, two cooling towers in the west (survev's
// indestructible silo_01 at 1.4 scale, radius 10.85, under a round roof image), the transformer yard in the north-east
// (rows of control panels and power boxes that explode, a chain reaction waiting to happen) and the fuel farm in the
// south-east (three indestructible tanks, vat_02 at 1.45 scale, and oil drums that explode). Plant frame: origin the
// compound centre, +y north.
import { type Box, hRun, type MilitaryPart, type PartImage, p, vRun } from "../military/part.ts";

/** The perimeter walls' centre lines (outer faces x ±50.5, y ±40.5). */
export const PLANT_PERIMETER = { x: 50, y: 40 } as const;
/** The gates (gaps in the perimeter): main (south, x), postern (north, x), west and east (y). */
export const PLANT_GATES = { main: [18, 26], postern: [26, 30], west: [-4, 4], east: [-4, 4] } as const;

/** The cooling towers: centre and radius (silo_01's 7.75 at `scale`). */
export const PLANT_TOWER_SCALE = 1.4;
export const PLANT_TOWERS = [
    { x: -34, y: 20 },
    { x: -34, y: -20 },
] as const;
export const PLANT_TOWER_RAD = 7.75 * PLANT_TOWER_SCALE;
/** The cooling tower's roof image (one image drawn at each tower): size in world units, pixels per unit. */
export const PLANT_TOWER_ROOF = { sprite: "map-building-powerplant-tower-01.img", size: 24, ppu: 16 } as const;

/** The transformer yard (gravel) and its rows: control panels in two columns, power boxes along the east wall. */
export const PLANT_TRANSFORMER_YARD: Box = [28.5, 6, 49.5, 39.5];
export const PLANT_TRANSFORMER_ROWS: readonly number[] = [11, 18.5, 26, 33.5];
export const PLANT_TRANSFORMER_COLS = [
    { x: 33, types: ["control_panel_01", "control_panel_04", "control_panel_01", "control_panel_04"] },
    { x: 41.5, types: ["control_panel_04", "control_panel_02", "control_panel_04", "control_panel_02"] },
    { x: 48.5, types: ["power_box_01", "power_box_01", "power_box_01", "power_box_01"] },
] as const;

/** The fuel farm's tanks (vat_02 at `scale`: radius 3.1 x 1.45) and its bund (the concrete pad drawn round them). */
export const PLANT_TANK_SCALE = 1.45;
export const PLANT_TANK_RAD = 3.1 * PLANT_TANK_SCALE;
/** The fuel tank roof image (over each vat_02, whose own sprite is a water vat): world units, pixels per unit. */
export const PLANT_TANK_ROOF = { sprite: "map-building-powerplant-tank-01.img", size: 11, ppu: 16 } as const;
export const PLANT_TANKS = [
    { x: 32, y: -31 },
    { x: 45, y: -31 },
    { x: 45, y: -17 },
] as const;
export const PLANT_FUEL_BUND: Box = [27, -39.5, 49.5, -10.5];
/** The oil drums (barrel_01, they explode): a cluster by the tanks and a pair by the east gate. */
export const PLANT_DRUMS: ReadonlyArray<readonly [number, number]> = [
    [31, -17],
    [31, -13.4],
    [34.5, -15.2],
    [47.75, -6.5],
];

/** The roads (asphalt): east-west between the gates, north-south from the main gate. */
export const PLANT_ROADS: readonly Box[] = [
    [-49.5, -4, 49.5, 4],
    [18, -39.5, 26, -4],
];

/** The perimeter's wall runs. */
export const PLANT_PERIMETER_WALLS = [
    ...hRun(-PLANT_PERIMETER.y, -PLANT_PERIMETER.x - 0.5, PLANT_PERIMETER.x + 0.5, [PLANT_GATES.main]),
    ...hRun(PLANT_PERIMETER.y, -PLANT_PERIMETER.x - 0.5, PLANT_PERIMETER.x + 0.5, [PLANT_GATES.postern]),
    ...vRun(-PLANT_PERIMETER.x, -PLANT_PERIMETER.y + 0.5, PLANT_PERIMETER.y - 0.5, [PLANT_GATES.west]),
    ...vRun(PLANT_PERIMETER.x, -PLANT_PERIMETER.y + 0.5, PLANT_PERIMETER.y - 0.5, [PLANT_GATES.east]),
];

/** The compound's ground patches (mapGroundPatches order 1; the minimap draws them, the floor image covers them). */
export const PLANT_GROUND_PATCHES: ReadonlyArray<{ box: Box; color: number }> = [
    { box: [-49.5, -39.5, 49.5, 39.5], color: 0x8e8c84 },
    ...PLANT_ROADS.map((box) => ({ box, color: 0x5f6264 })),
    { box: PLANT_TRANSFORMER_YARD, color: 0x7d7a6e },
];

const X = PLANT_PERIMETER.x;
const Y = PLANT_PERIMETER.y;

/** The minimap's perimeter: 1-wide runs with gaps at the gates. */
const PERIMETER_MAP: readonly Box[] = [
    [-X - 0.5, -Y - 0.5, PLANT_GATES.main[0], -Y + 0.5],
    [PLANT_GATES.main[1], -Y - 0.5, X + 0.5, -Y + 0.5],
    [-X - 0.5, Y - 0.5, PLANT_GATES.postern[0], Y + 0.5],
    [PLANT_GATES.postern[1], Y - 0.5, X + 0.5, Y + 0.5],
    [-X - 0.5, -Y, -X + 0.5, PLANT_GATES.west[0]],
    [-X - 0.5, PLANT_GATES.west[1], -X + 0.5, Y],
    [X - 0.5, -Y, X + 0.5, PLANT_GATES.east[0]],
    [X - 0.5, PLANT_GATES.east[1], X + 0.5, Y],
];

/** The compound's one floor image (the yard, its markings and the perimeter; 16 px per unit) and the towers' roofs. */
export const PLANT_YARD_IMAGE: PartImage = {
    sprite: "map-building-powerplant-yard-01.img",
    kind: "floor",
    centre: { x: 0, y: 0 },
    size: [2 * X + 1, 2 * Y + 1],
    ppu: 16,
};

const tankRoofs: PartImage[] = PLANT_TANKS.map((t) => ({
    sprite: PLANT_TANK_ROOF.sprite,
    kind: "ceiling",
    centre: { x: t.x, y: t.y },
    size: [PLANT_TANK_ROOF.size, PLANT_TANK_ROOF.size],
    ppu: PLANT_TANK_ROOF.ppu,
}));

const towerRoofs: PartImage[] = PLANT_TOWERS.map((t) => ({
    sprite: PLANT_TOWER_ROOF.sprite,
    kind: "ceiling",
    centre: { x: t.x, y: t.y },
    size: [PLANT_TOWER_ROOF.size, PLANT_TOWER_ROOF.size],
    ppu: PLANT_TOWER_ROOF.ppu,
}));

export const PLANT_COMPOUND: MilitaryPart = {
    id: "power_plant_01",
    layer: 0,
    parent: null,
    placements: [{ pos: { x: 0, y: 0 }, ori: 0 }],
    zIdx: 0,
    layout: {
        bounds: { min: { x: -X, y: -Y }, max: { x: X, y: Y } },
        material: "concrete",
        walls: PLANT_PERIMETER_WALLS,
        openings: [],
        rooms: [],
    },
    props: [
        // the cooling towers (indestructible; their roofs are ceiling images, no zoom region, so always drawn)
        ...PLANT_TOWERS.map((t) => ({ ...p("silo_01", t.x, t.y), scale: PLANT_TOWER_SCALE })),
        // the transformer yard: 4 x 3 explosive boxes, 4 to 6 units apart
        ...PLANT_TRANSFORMER_COLS.flatMap((c) => PLANT_TRANSFORMER_ROWS.map((y, i) => p(c.types[i], c.x, y))),
        // the fuel farm: three tanks (indestructible; their roofs are ceiling images like the towers'), oil drums
        ...PLANT_TANKS.map((t) => ({ ...p("vat_02", t.x, t.y), scale: PLANT_TANK_SCALE })),
        ...PLANT_DRUMS.map(([x, y]) => p("barrel_01", x, y)),
        // the yard: a weapons crate in the north-west corner behind the towers, a weapons crate as cover on the road
        // between the towers, ammunition by the west gate, floor loot between the towers, by the control building's
        // yard door and by the fuel farm
        p("mil_crate_04", -46.8, 38.25),
        p("mil_crate_04", -41, 0, 1),
        p("crate_06", -47.25, -9.5),
        p("loot_tier_1", -34, 0),
        p("loot_tier_1", -2, -2),
        p("loot_tier_2", 38, -6),
        p("loot_tier_1", 29, 0),
    ],
    surfaces: [
        // the whole compound first: no player spawns inside the walls
        { type: "stone", boxes: [[-X, -Y, X, Y]] },
        { type: "asphalt", boxes: PLANT_ROADS },
    ],
    zoom: [],
    images: [PLANT_YARD_IMAGE, ...towerRoofs, ...tankRoofs],
    mapShapes: [
        ...PERIMETER_MAP.map((box) => ({ box, color: 0x3c3f41 })),
        ...PLANT_TOWERS.flatMap((t) => [
            { disc: [t.x, t.y, PLANT_TOWER_RAD + 0.75] as const, color: 0xc9c5b9 },
            { disc: [t.x, t.y, PLANT_TOWER_RAD - 2] as const, color: 0x55595d },
        ]),
        ...PLANT_TANKS.map((t) => ({ disc: [t.x, t.y, PLANT_TANK_RAD] as const, color: 0xd9d6cc })),
    ],
};
