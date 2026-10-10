// military_compound_01 (_01r / _01b on 50v50): the military base's surface layer, a roofless walled compound (concrete
// perimeter 106 x 84 outside, four gates: main S, motor E, wicket W, postern N; loopholes on every side), its gravel
// yard, the parade ground with the flagpole on the emblem, the sapper hatch outside the south wall (stairs S5 down to
// the basement's tunnel) and the yard's cover. Its children are the base's buildings (military/*.ts).
import { type Box, fromWorld, hRun, low, type MilitaryPart, op, out, type PartImage, vRun } from "./part.ts";

/** The perimeter walls' centre lines (outer faces x ±53, y ±42). */
export const MILITARY_PERIMETER = { x: 52.5, y: 41.5 } as const;

/** The parade ground (48 x 30 with its 1-unit light kerb) and its centre, where the emblem and flagpole stand. */
export const MILITARY_PARADE: Box = [-24, -24, 24, 6];
export const MILITARY_PARADE_CENTRE = { x: 0, y: -9 } as const;

/** The perimeter's wall runs; the towers and the gatehouse wall off the corners and the gate leaves. */
export const MILITARY_PERIMETER_WALLS = [
    // south: loopholes at x -24 (it watches the hatch), -10 and 24; the main gate -4..4 (the gatehouse's two leaves)
    ...hRun(-41.5, -44, 53, [
        [-25.5, -22.5],
        [-11.5, -8.5],
        [-4, 4],
        [22.5, 25.5],
    ]),
    // north: loopholes at x -35 and 0, the postern 16.5..20.5 (lined up with the alley between the HQ and the armory)
    ...hRun(41.5, -53, 44, [
        [-36.5, -33.5],
        [-1.5, 1.5],
        [16.5, 20.5],
    ]),
    // west: a loophole at y -5 (the storehouse's window line), the wicket 12..16, a loophole at y 33 lined up with the
    // north ward's window (outsiders can shoot into the heal ward)
    ...vRun(-52.5, -33, 41, [
        [-6.5, -3.5],
        [12, 16],
        [31.5, 34.5],
    ]),
    // east: loopholes at y -19.5, -1.5 and 15; the motor gate -15..-6, lined up with the garage ramp
    ...vRun(52.5, -41, 33, [
        [-21, -18],
        [-15, -6],
        [-3, 0],
        [13.5, 16.5],
    ]),
];

/** The gates (minimap gaps): main, postern, wicket, motor gate. */
export const MILITARY_GATES = { main: [-4, 4], postern: [16.5, 20.5], wicket: [12, 16], motor: [-15, -6] } as const;

const strip = (name: string, cx: number, cy: number, w: number, h: number): PartImage => ({
    sprite: `map-building-milbase-wall-${name}.img`,
    kind: "floor",
    centre: { x: cx, y: cy },
    size: [w, h],
});

/** The perimeter's wall strips (floor images of MILITARY_PERIMETER_WALLS: walls, loophole sills, open gates). */
export const MILITARY_WALL_STRIPS: readonly PartImage[] = [
    strip("s-01", -23.25, -41.5, 61.5, 1.5),
    strip("s-02", 30.75, -41.5, 45.5, 1.5),
    strip("n-01", -26.75, 41.5, 53.5, 1.5),
    strip("n-02", 22, 41.5, 44, 1.5),
    strip("w-01", -52.5, -14.5, 1.5, 37),
    strip("w-02", -52.5, 22.5, 1.5, 37),
    strip("e-01", 52.5, -22.5, 1.5, 37),
    strip("e-02", 52.5, 14.5, 1.5, 37),
];

/** The minimap's perimeter: 1.5-wide runs with gaps at the gates. */
const PERIMETER_MAP: readonly Box[] = [
    [-53.25, -42.25, MILITARY_GATES.main[0], -40.75],
    [MILITARY_GATES.main[1], -42.25, 53.25, -40.75],
    [-53.25, 40.75, MILITARY_GATES.postern[0], 42.25],
    [MILITARY_GATES.postern[1], 40.75, 53.25, 42.25],
    [-53.25, -42.25, -51.75, MILITARY_GATES.wicket[0]],
    [-53.25, MILITARY_GATES.wicket[1], -51.75, 42.25],
    [51.75, -42.25, 53.25, MILITARY_GATES.motor[0]],
    [51.75, MILITARY_GATES.motor[1], 53.25, 42.25],
];

/** The compound's ground patches (mapGroundPatches order 1, roughness 0; the minimap draws them too). */
export const MILITARY_GROUND_PATCHES: ReadonlyArray<{ box: Box; color: number }> = [
    // the gravel yard
    { box: [-52, -41, 52, 41], color: 0x7d7a6e },
    // asphalt: the gate road, the motor apron, the east lane to the motor gate, the gate aprons outside
    { box: [-4, -41, 4, -24], color: 0x5f6264 },
    { box: [16, -41, 52, -21], color: 0x5f6264 },
    { box: [48, -21, 52, -4], color: 0x5f6264 },
    { box: [-6, -48, 6, -42], color: 0x5f6264 },
    { box: [53, -16, 56, -5], color: 0x5f6264 },
    // the parade ground: a light kerb round its asphalt
    { box: MILITARY_PARADE, color: 0xb3ad9e },
    { box: [-23, -23, 23, 5], color: 0x505355 },
    // the hatch pad
    { box: [-34, -50, -26, -42], color: 0xb3ad9e },
];

export const MILITARY_COMPOUND: MilitaryPart = fromWorld({
    id: "military_compound_01",
    factionVariants: true,
    layer: 0,
    parent: null,
    centre: { x: 0, y: 0 },
    zIdx: 0,
    layout: {
        bounds: {
            min: { x: -MILITARY_PERIMETER.x, y: -MILITARY_PERIMETER.y },
            max: { x: MILITARY_PERIMETER.x, y: MILITARY_PERIMETER.y },
        },
        material: "concrete",
        walls: MILITARY_PERIMETER_WALLS,
        openings: [
            op("brick_wall_ext_3_0_low", -24, -41.5, 1),
            op("brick_wall_ext_3_0_low", -10, -41.5, 1),
            op("brick_wall_ext_3_0_low", 24, -41.5, 1),
            op("brick_wall_ext_3_0_low", -35, 41.5, 1),
            op("brick_wall_ext_3_0_low", 0, 41.5, 1),
            op("brick_wall_ext_3_0_low", -52.5, -5, 0),
            op("brick_wall_ext_3_0_low", -52.5, 33, 0),
            op("brick_wall_ext_3_0_low", 52.5, -19.5, 0),
            op("brick_wall_ext_3_0_low", 52.5, -1.5, 0),
            op("brick_wall_ext_3_0_low", 52.5, 15, 0),
        ],
        rooms: [],
    },
    props: [
        // the sapper hatch outside the south wall (S5): low steel rails along it; the perimeter wall closes its far end
        low("metal_wall_ext_short_7", -32.5, -45.5, 0),
        low("metal_wall_ext_short_7", -27.5, -45.5, 0),
        // the parade ground: the flagpole on the emblem (the only hard cover in the middle), corner sandbags, vents
        // over the vault below
        out("bollard_01", MILITARY_PARADE_CENTRE.x, MILITARY_PARADE_CENTRE.y),
        out("sandbags_02", -21.5, -21.5),
        out("sandbags_02", 21.5, -21.5),
        out("sandbags_02", -21.5, 3.5),
        out("sandbags_02", 21.5, 3.5),
        out("decal_vent_01", -11, -15),
        out("decal_vent_02", 11, -15),
        // the main gate's checkpoint: a sandbag on the axis breaks the gate-to-HQ sight line, a hedgehog west of the
        // road, a barrel by the west leaf (it blows on whoever holds the gate)
        out("sandbags_02", 0, -30),
        out("hedgehog_01", -8, -32),
        // the south-west yard: a closed container as hard cover on the way to the SW tower, sandbags
        out("container_05", -18, -33, 1),
        out("sandbags_01", -38, -27),
        // the south-east vehicle park on the motor apron: a container with loot (open end west), a closed one, fuel
        out("container_01", 36, -31, 3),
        out("container_05", 25.5, -34.5),
        out("barrel_01", 50, -39),
        out("barrel_01", 50, -35.5),
        out("decal_oil_01", 30, -36),
        out("decal_oil_04", 42, -25),
        out("decal_oil_06", 27, -27),
        // the fuel point between the garage and the armory
        out("container_05", 36, 12.5, 1),
        out("barrel_01", 47, 10.75),
        out("barrel_01", 47, 14.25),
        // the west yard by the wicket
        out("sandbags_02", -47.5, 18),
        out("crate_01", -40, 16),
        // outside: the attackers' cover facing the main gate, hedgehogs on its apron, sandbags outside the motor gate,
        // bushes screening the hatch
        out("sandbags_01", 0, -48),
        out("hedgehog_01", -12, -46.5),
        out("hedgehog_01", 12, -46.5),
        out("sandbags_02", 54.9, -18),
        out("sandbags_02", 54.9, -3),
        out("bush_01", -36.5, -46),
        out("bush_01", -23.5, -46),
    ],
    surfaces: [
        // the whole compound first, gravel (stone footsteps): no player spawns inside the walls
        {
            type: "stone",
            boxes: [[-MILITARY_PERIMETER.x, -MILITARY_PERIMETER.y, MILITARY_PERIMETER.x, MILITARY_PERIMETER.y]],
        },
        {
            type: "asphalt",
            boxes: [
                MILITARY_PARADE,
                [-4, -41, 4, -24],
                [16, -41, 52, -21],
                [48, -21, 52, -4],
                [-6, -48, 6, -42],
                [53, -16, 56, -5],
            ],
        },
        // the hatch pad and the hatch itself (steel over the stair box)
        { type: "stone", boxes: [[-34, -50, -26, -42]] },
        { type: "container", boxes: [[-32, -48, -28, -42]] },
    ],
    zoom: [],
    images: [
        ...MILITARY_WALL_STRIPS,
        // the parade ground's markings and the emblem under the flagpole (gold star on dark olive; 50v50: a white star
        // on the faction disc)
        {
            sprite: "map-building-milbase-parade-01.img",
            kind: "floor",
            centre: MILITARY_PARADE_CENTRE,
            size: [48, 30],
            ppu: 16,
        },
        {
            sprite: "map-building-milbase-emblem-01.img",
            kind: "floor",
            centre: MILITARY_PARADE_CENTRE,
            size: [10, 10],
            faction: true,
        },
        { sprite: "map-building-milbase-hatch-01.img", kind: "floor", centre: { x: -30, y: -46 }, size: [8, 8] },
        { sprite: "map-building-milbase-gate-01.img", kind: "floor", centre: { x: 0, y: -44.5 }, size: [14, 5] },
        {
            sprite: "map-building-milbase-motor-01.img",
            kind: "floor",
            centre: { x: 34, y: -31 },
            size: [36, 20],
            ppu: 16,
        },
    ],
    mapShapes: [
        ...PERIMETER_MAP.map((box) => ({ box, color: 0x3c3f41 })),
        { disc: [MILITARY_PARADE_CENTRE.x, MILITARY_PARADE_CENTRE.y, 4.5], color: "emblem" },
        { disc: [MILITARY_PARADE_CENTRE.x, MILITARY_PARADE_CENTRE.y, 2], color: "star" },
    ],
});
