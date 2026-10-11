// The layout of mall_01 (rebirth/buildings/mall.ts), the owner's wave 3 shopping mall (2026-10-10): a concrete shell
// 92 x 68 (x -46..46, y -34..34; +y north, the main entrance south). Rows from south to north: a row of shops with the
// entrance hall in the middle, the south concourse (y -18..-11), the middle row (the clothing and sports shops, the
// atrium with its fountain, the food court, the electronics store), the north concourse (y 11..18) and a row of toilets,
// a café, the security office with its vault, a music shop and the loading dock. The supermarket fills the west end
// (x -46..-26) with its stockroom behind it. Shop fronts are glass (survev's glass_wall_<len>, breakable) and windows
// with 4-unit open doorways; the walls between shops are breakable wood; the shell, the supermarket's wall, the
// security office's keypad wall and the vault are concrete.
import type { BuildingChildDef } from "../../types/index.ts";
import { child, type Opening, type RebirthBuildingLayout, type WallMaterial, type WallSeg } from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

/**
 * One piece of a wall strip: a solid run (wood or concrete), a survev glass wall (lengths 9, 10, 12, 18), an open
 * doorway, a hinged door (house_door_01 / _02) or a window (house_window_01), each `len` long.
 */
export type StripPiece =
    | readonly ["w" | "c", number]
    | readonly ["g", 9 | 10 | 12 | 18]
    | readonly ["o", 4]
    | readonly ["door" | "steel" | "win", 4];

export interface Strip {
    walls: WallSeg[];
    glass: BuildingChildDef[];
    openings: Opening[];
}

/**
 * A wall strip on `line` (horizontal: along x at y = line; else along y at x = line) from `a0`, piece after piece; doors
 * hinge at the piece's start and swing along +x / +y (ori 3 / 0).
 */
export function strip(horizontal: boolean, line: number, a0: number, pieces: readonly StripPiece[]): Strip {
    const out: Strip = { walls: [], glass: [], openings: [] };
    let a = a0;
    const at = (s: number) => (horizontal ? { x: s, y: line } : { x: line, y: s });
    for (const [kind, len] of pieces) {
        const mid = at(a + len / 2);
        if (kind === "w" || kind === "c") {
            const material: WallMaterial = kind === "w" ? "wood" : "concrete";
            const run = horizontal ? hRun(line, a, a + len, [], material) : vRun(line, a, a + len, [], material);
            out.walls.push(...run);
        } else if (kind === "g") {
            out.glass.push(child(`glass_wall_${len}`, mid.x, mid.y, horizontal ? 1 : 0));
        } else if (kind === "win") {
            out.openings.push(op("house_window_01", mid.x, mid.y, horizontal ? 1 : 0));
        } else if (kind === "door" || kind === "steel") {
            const p = at(a);
            out.openings.push(op(kind === "door" ? "house_door_01" : "house_door_02", p.x, p.y, horizontal ? 3 : 0));
        }
        a += len;
    }
    return out;
}

const join = (...strips: Strip[]): Strip => ({
    walls: strips.flatMap((s) => s.walls),
    glass: strips.flatMap((s) => s.glass),
    openings: strips.flatMap((s) => s.openings),
});

// the shop fronts: a doorway and glass per shop, wood at every partition's end
const SOUTH_FRONT = strip(true, -18, -26, [
    // the jewellery shop (-26..-12)
    ["w", 1],
    ["o", 4],
    ["g", 9],
    // the phone shop (-12..-5)
    ["w", 1],
    ["o", 4],
    ["w", 2],
]);
const SOUTH_FRONT_EAST = strip(true, -18, 5, [
    // the pharmacy (5..19)
    ["w", 1],
    ["o", 4],
    ["g", 9],
    // the hardware store (19..34)
    ["w", 1],
    ["o", 4],
    ["g", 10],
    // the toy shop (34..46)
    ["w", 1],
    ["o", 4],
    ["w", 1],
    ["win", 4],
    ["w", 2],
]);
/** The middle row's fronts on y = -11 and y = 11 (the atrium x -11..11 stays open between them). */
const middleFront = (y: number) =>
    join(
        // the clothing shop (south) / the sports shop (north): -26..-11
        strip(true, y, -26, [
            ["w", 1],
            ["o", 4],
            ["g", 9],
            ["w", 1],
        ]),
        // the food court (11..30) and the electronics store (30..46)
        strip(true, y, 11, [
            ["w", 1],
            ["o", 4],
            ["w", 1],
            ["g", 12],
            ["w", 1],
            ["w", 1],
            ["o", 4],
            ["g", 10],
            ["w", 1],
        ]),
    );
const NORTH_FRONT = strip(true, 18, -26, [
    // the toilets (-26..-14)
    ["w", 1],
    ["o", 4],
    ["w", 7],
    // the café (-14..-2)
    ["w", 1],
    ["o", 4],
    ["w", 1],
    ["win", 4],
    ["w", 2],
    // the security office (-2..14): its door, then the keypad's concrete wall (since the keypad, 2026-10-11: the door
    // a unit west, no window)
    ["w", 1],
    ["door", 4],
    ["c", 11],
    // the music shop (14..26)
    ["w", 1],
    ["o", 4],
    ["w", 1],
    ["win", 4],
    ["w", 2],
    // the loading dock (26..46): its steel service door
    ["w", 4],
    ["steel", 4],
    ["w", 12],
]);
/** The atrium's west wall (the clothing and sports shops' glass) and east wall (the food court's two doorways). */
const ATRIUM_WEST = strip(false, -11, -11.5, [
    ["w", 2],
    ["g", 9],
    ["w", 1],
    ["g", 9],
    ["w", 2],
]);
const ATRIUM_EAST = strip(false, 11, -11.5, [
    ["w", 2],
    ["o", 4],
    ["w", 1],
    ["g", 9],
    ["w", 1],
    ["o", 4],
    ["w", 2],
]);

export const MALL_STRIPS: Strip = join(
    SOUTH_FRONT,
    SOUTH_FRONT_EAST,
    middleFront(-11),
    middleFront(11),
    NORTH_FRONT,
    ATRIUM_WEST,
    ATRIUM_EAST,
);

/**
 * The security office's keypad (the owner's design, 2026-10-11): five number buttons (switch_03, 0.9 wide, 1.1 deep) on
 * the office's south wall (inner face y 18.5), facing north, 2.2 units apart from x 3.6 (by the office door's jamb) to
 * x 12.4 (a body still stands square before it by the east wall), digits 1 2 7 8 9 west to east. Use presses every
 * button whose collider lies within 0.2 of the body (sim world/interact.ts), so a concrete fin 1 wide stands between
 * neighbours, 1.15 out from the face (y 18.15..19.65): no spot a body fits reaches two buttons (above a fin's middle,
 * the nearest spot to both, they are 1.235 away, past the 1.2 reach), each button's front reaches it (0.85), and 2.85
 * units stay free between the fins and the vault's wall (the probe's comfortable 2.6). The digits are painted on the
 * floor in front (tools/assets/rebirthArt/mall.ts).
 */
export const MALL_KEYPAD = [
    { label: "1", x: 3.6 },
    { label: "2", x: 5.8 },
    { label: "7", x: 8 },
    { label: "8", x: 10.2 },
    { label: "9", x: 12.4 },
].map((k) => ({ ...k, y: 19.05, ori: 2 }));
export const MALL_KEYPAD_FINS = [4.7, 6.9, 9.1, 11.3] as const;
export const MALL_KEYPAD_FIN_Y0 = 18.15;

/** The vault's sliding door (vault_door_bathhouse: only the puzzle opens it; slides east into the vault's wall). */
export const MALL_VAULT_DOOR = { type: "vault_door_bathhouse", pos: { x: 9, y: 23 }, ori: 1 } as const;

export const MALL_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -46, y: -34 }, max: { x: 46, y: 34 } },
    material: "concrete",
    walls: [
        // south: the main entrance's sliding doors (-4..4), shop windows
        ...hRun(-34, -46.5, 46.5, [
            [-4, 4],
            [-21, -17],
            [25, 29],
            [39, 43],
        ]),
        // north: the stockroom's steel door, the loading dock's open truck bay (31..41)
        ...hRun(34, -46.5, 46.5, [
            [-40, -36],
            [31, 41],
        ]),
        // west: the supermarket's side door on its cross aisle; east: the concourses' sliding doors
        ...vRun(-46, -33.5, 33.5, [[-6, -2]]),
        ...vRun(46, -33.5, 33.5, [
            [-16.5, -12.5],
            [12.5, 16.5],
        ]),
        // the supermarket's wall (a doorway onto each concourse) and the stockroom's, concrete
        ...vRun(-26, -33.5, 33.5, [
            [-16.5, -12.5],
            [12.5, 16.5],
        ]),
        // supermarket | stockroom, its door
        ...hRun(18, -46, -26, [[-38, -34]]),
        // the south row's partitions (breakable wood) and the entrance hall's walls
        ...vRun(-12, -33.5, -18.5, [], "wood"),
        ...vRun(-5, -33.5, -17.5, [], "wood"),
        ...vRun(5, -33.5, -17.5, [], "wood"),
        ...vRun(19, -33.5, -18.5, [], "wood"),
        ...vRun(34, -33.5, -18.5, [], "wood"),
        // clothing | sports, food court | electronics
        ...hRun(0, -25.5, -11.5, [], "wood"),
        ...vRun(30, -10.5, 10.5, [], "wood"),
        // the north row's partitions; the security office | music shop wall turns concrete along the vault
        ...vRun(-14, 18.5, 33.5, [], "wood"),
        ...vRun(-2, 18.5, 33.5, [], "wood"),
        ...vRun(14, 18.5, 22.5, [], "wood"),
        ...vRun(14, 22.5, 34),
        ...vRun(26, 18.5, 33.5, [], "wood"),
        // the security vault (x 2..14, y 23..34 wall lines), concrete; its sliding door 5..9
        ...hRun(23, 2, 14, [[5, 9]]),
        ...vRun(2, 22.5, 34),
        // the keypad's fins between its buttons (mall.ts MALL_KEYPAD)
        ...MALL_KEYPAD_FINS.map((x) => [x, MALL_KEYPAD_FIN_Y0, x, MALL_KEYPAD_FIN_Y0 + 1.5] as const),
        ...MALL_STRIPS.walls,
    ],
    openings: [
        // the main entrance: two automatic doors meeting in the middle (sliding doors sit on the wall line)
        op("lab_door_01", -4, -34, 3),
        op("lab_door_01", 4, -34, 1),
        op("house_window_01", -19, -34.25, 3),
        op("house_window_01", 27, -34.25, 3),
        op("house_window_01", 41, -34.25, 3),
        op("house_door_02", -40, 34.25, 3),
        op("house_door_01", -46.25, -6, 0),
        op("lab_door_01", 46, -12.5, 2),
        op("lab_door_01", 46, 12.5, 0),
        op("house_door_01", -38, 18, 3),
        ...MALL_STRIPS.openings,
    ],
    rooms: [
        room(-46, -34, 46, 34, "concourse"),
        room(-46, -34, -26, 18, "market"),
        room(-46, 18, -26, 34, "stock"),
        room(-26, -34, -12, -18, "jewel"),
        room(-12, -34, -5, -18, "phone"),
        room(-5, -34, 5, -18, "hall"),
        room(5, -34, 19, -18, "pharmacy"),
        room(19, -34, 34, -18, "hardware"),
        room(34, -34, 46, -18, "toys"),
        room(-26, -11, -11, 0, "clothing"),
        room(-26, 0, -11, 11, "sports"),
        room(-11, -11, 11, 11, "atrium"),
        room(11, -11, 30, 11, "food"),
        room(30, -11, 46, 11, "electronics"),
        room(-26, 18, -14, 34, "toilets"),
        room(-14, 18, -2, 34, "cafe"),
        room(-2, 18, 14, 34, "security"),
        room(2, 23, 14, 34, "vault"),
        room(14, 18, 26, 34, "music"),
        room(26, 18, 46, 34, "dock"),
    ],
    outdoor: [
        // the truck apron behind the loading dock and the entrance plaza
        room(26, 34, 46.5, 42, "apron"),
        room(-12, -40, 12, -34, "plaza"),
    ],
};
