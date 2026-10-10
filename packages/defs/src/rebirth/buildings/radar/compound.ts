// radar_base_01 (레이더 기지; the owner's wave 3, 2026-10-10: "a radar base of some size, not the radio station";
// docs/research/rebirth-deviations.md "The radar base"): a roofless fenced compound about the military base's size
// (100 x 90 outside the fence) holding the base's buildings as children (rebirth/buildings/radar/*.ts). The fence is
// chain-link on low steel rails (metal_wall_ext_short_6 / _7: players cannot pass, bullets can), with the main gate's
// two steel leaves south, the open service gate east by the fuel depot and a postern north; the guard post stands on
// the fence beside the main gate. The main road runs from the gate to the dome tower; the antenna masts (indestructible
// steel feet, their lattice drawn over the players) stand in the antenna field west of the dome and north of the
// operations building; the helipad lies in the south-west yard, the fuel depot's drums (explosion_barrel) by the
// service gate.
import { type Box, fromWorld, type MilitaryPart, op, out, type PartImage, type Prop, p } from "../military/part.ts";

/** The fence's centre lines (outer faces x ±50, y ±45). */
export const RADAR_FENCE = { x: 49.5, y: 44.5 } as const;

/** The gates: the main gate's leaves (x), the postern (x, north), the service gate (y, east). */
export const RADAR_GATES = { main: [-4, 4], postern: [26, 30], service: [-32, -24] } as const;

/** The guard post's stretch of the south fence line (its own wall). */
const GUARD_SPAN = [10, 20] as const;

/** One fence run: [horizontal, line, a0, a1] (a0..a1 along the run, gate and guard post gaps already left out). */
export type FenceRun = readonly [horizontal: boolean, line: number, a0: number, a1: number];

/** The fence's runs: horizontal runs own the corners (outer faces), vertical runs stop at their inner faces. */
export const RADAR_FENCE_RUNS: readonly FenceRun[] = [
    [true, -RADAR_FENCE.y, -50, RADAR_GATES.main[0]],
    [true, -RADAR_FENCE.y, RADAR_GATES.main[1], GUARD_SPAN[0]],
    [true, -RADAR_FENCE.y, GUARD_SPAN[1], 50],
    [true, RADAR_FENCE.y, -50, RADAR_GATES.postern[0]],
    [true, RADAR_FENCE.y, RADAR_GATES.postern[1], 50],
    [false, -RADAR_FENCE.x, -44, 44],
    [false, RADAR_FENCE.x, -44, RADAR_GATES.service[0]],
    [false, RADAR_FENCE.x, RADAR_GATES.service[1], 44],
];

/** The pieces of a fence run: low steel rails 7 and 6 long (the fewest, 7s first); a length they cannot make throws. */
export function fencePieces(len: number): number[] {
    for (let sevens = Math.floor(len / 7); sevens >= 0; sevens--) {
        const rest = len - sevens * 7;
        if (rest % 6 === 0) return [...new Array(sevens).fill(7), ...new Array(rest / 6).fill(6)];
    }
    throw new Error(`radar base: no fence split for ${len}`);
}

/** The fence rails as props (each a low wall: it counts as a wall against the furniture). */
function fenceProps(): Prop[] {
    const outp: Prop[] = [];
    for (const [horizontal, line, a0, a1] of RADAR_FENCE_RUNS) {
        let a = a0;
        for (const len of fencePieces(a1 - a0)) {
            const mid = a + len / 2;
            const type = `metal_wall_ext_short_${len}`;
            outp.push(
                horizontal
                    ? p(type, mid, line, 1, { wallLike: true, outside: true })
                    : p(type, line, mid, 0, { wallLike: true, outside: true }),
            );
            a += len;
        }
    }
    return outp;
}

/** The antenna masts (compound frame): their steel feet (metal_wall_ext_2x2) and the lattice drawn on the roof layer. */
export const RADAR_MASTS: ReadonlyArray<{ readonly x: number; readonly y: number }> = [
    { x: -36, y: 33 },
    { x: -24, y: 21 },
    { x: -40, y: 11 },
    { x: 40, y: 37 },
];
/** A mast's guy anchors, relative to its foot. */
export const RADAR_MAST_GUYS: ReadonlyArray<readonly [number, number]> = [
    [-4.5, -4.5],
    [4.5, -4.5],
    [0, 5.5],
];

/** The helipad (its pad box) and the fuel depot's pad. */
export const RADAR_HELIPAD: Box = [-35, -43, -21, -29];
export const RADAR_DEPOT: Box = [41, -44, 49, -35];
/** The main road: from the gate to the dome's door, and its apron outside the gate. */
export const RADAR_ROAD: Box = [-4, -44, 4, 15.5];
export const RADAR_APRON: Box = [-6, -51, 6, -45];

/** The compound's ground patches (mapGroundPatches order 1, roughness 0; the minimap draws them too). */
export const RADAR_GROUND_PATCHES: ReadonlyArray<{ box: Box; color: number }> = [
    // the yard: pale gravel inside the fence
    { box: [-49, -44, 49, 44], color: 0x8e8a7c },
    // asphalt: the main road and the gate apron, the lane east to the operations building and the service gate
    { box: RADAR_ROAD, color: 0x5c5f61 },
    { box: RADAR_APRON, color: 0x5c5f61 },
    { box: [4, -27, 49, -21], color: 0x5c5f61 },
    // concrete pads: the helipad, the fuel depot
    { box: RADAR_HELIPAD, color: 0xa9a69b },
    { box: RADAR_DEPOT, color: 0xa9a69b },
];

/** The fence strips (floor images at 16 px per unit) and the yard's markings (8 px per unit). */
const strip = (name: string, cx: number, cy: number, w: number, h: number): PartImage => ({
    sprite: `map-building-radar-fence-${name}.img`,
    kind: "floor",
    centre: { x: cx, y: cy },
    size: [w, h],
    ppu: 16,
});
export const RADAR_FENCE_STRIPS: readonly PartImage[] = [
    strip("s-01", 0, -RADAR_FENCE.y, 101, 2),
    strip("n-01", 0, RADAR_FENCE.y, 101, 2),
    strip("w-01", -RADAR_FENCE.x, 0, 2, 89),
    strip("e-01", RADAR_FENCE.x, 0, 2, 89),
];
/** The yard markings' image box (centre, size). */
export const RADAR_YARD_IMAGE = { centre: { x: 0, y: -3.5 }, size: [100, 97] as const } as const;

export const RADAR_COMPOUND: MilitaryPart = fromWorld({
    id: "radar_base_01",
    layer: 0,
    parent: null,
    centre: { x: 0, y: 0 },
    zIdx: 0,
    layout: {
        bounds: { min: { x: -RADAR_FENCE.x, y: -RADAR_FENCE.y }, max: { x: RADAR_FENCE.x, y: RADAR_FENCE.y } },
        material: "metal",
        walls: [],
        openings: [op("house_door_02", -4, -44.75, 3), op("house_door_02", 4, -44.75, 1)],
        rooms: [],
    },
    props: [
        ...fenceProps(),
        // the antenna masts' feet
        ...RADAR_MASTS.map((m) => p("metal_wall_ext_2x2", m.x, m.y, 0, { wallLike: true })),
        // the main gate: a sandbag wall on the road's axis breaks the gate-to-dome sight line, one by the west leaf
        out("sandbags_01", 0, -31),
        out("sandbags_02", -8, -38),
        // the yard's cover: an open container with loot west of the road, a closed one east of it, crates
        out("container_01", -12, -12),
        out("container_05", 22, -18),
        out("container_01", 24, 36.5, 1),
        p("crate_01", -13, 7),
        p("crate_01", 9.5, 9),
        p("crate_02", -20, 41.75),
        // the fuel depot by the service gate: four drums flush in the fence corner (each explodes), oil stains
        p("barrel_01", 43.75, -42.25),
        p("barrel_01", 47.25, -42.25),
        p("barrel_01", 43.75, -38.75),
        p("barrel_01", 47.25, -38.75),
        p("decal_oil_01", 44, -33.5),
        p("decal_oil_04", 30, -24),
        // the antenna field: a sandbag nest under the masts, floor loot by the helipad
        out("sandbags_02", -30, 27),
        p("loot_tier_2", -28, -24),
        p("loot_tier_1", 36, 32),
        p("loot_tier_1", -30, 30),
        // the helipad: a supply pallet (a military crate: a gun and throwables) on its edge
        p("mil_crate_04", -28, -37.5),
        p("crate_01", -46.75, 24),
        // outside: hedgehogs on the gate apron, bushes along the fence
        out("hedgehog_01", -10, -51),
        out("hedgehog_01", 10, -51),
        out("bush_01", -30, -47.5),
        out("bush_01", 34, -47.5),
        out("bush_01", 52.5, 10),
        out("bush_01", -52.5, -20),
    ],
    surfaces: [
        // the whole compound first, gravel (stone footsteps): no player spawns inside the fence
        { type: "stone", boxes: [[-RADAR_FENCE.x, -RADAR_FENCE.y, RADAR_FENCE.x, RADAR_FENCE.y]] },
        { type: "asphalt", boxes: [RADAR_ROAD, RADAR_APRON, [4, -27, 49, -21]] },
    ],
    zoom: [],
    images: [
        ...RADAR_FENCE_STRIPS,
        {
            sprite: "map-building-radar-yard-01.img",
            kind: "floor",
            centre: RADAR_YARD_IMAGE.centre,
            size: RADAR_YARD_IMAGE.size,
            ppu: 8,
        },
        // the masts' lattice over the players (a roofless compound's ceiling images always show)
        ...RADAR_MASTS.map(
            (m): PartImage => ({
                sprite: "map-building-radar-mast-01.img",
                kind: "ceiling",
                centre: { x: m.x, y: m.y },
                size: [6, 6],
            }),
        ),
    ],
    mapShapes: [
        // the fence (gaps at the gates) and the masts
        ...RADAR_FENCE_RUNS.map(([horizontal, line, a0, a1]) => ({
            box: (horizontal ? [a0, line - 0.5, a1, line + 0.5] : [line - 0.5, a0, line + 0.5, a1]) as Box,
            color: 0x3c4145,
        })),
        ...RADAR_MASTS.map((m) => ({ disc: [m.x, m.y, 1.6] as const, color: 0xd2402a })),
    ],
});
