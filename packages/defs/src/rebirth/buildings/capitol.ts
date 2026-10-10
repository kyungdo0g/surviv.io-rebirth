// capitol_01, a rebirth building of the normal map (the owner's wave 3, 2026-10-10: "a provincial government building";
// docs/research/rebirth-deviations.md "The provincial government building"): a grand symmetric civic hall. A columned
// portico and steps lead to the lobby; behind it the domed rotunda (a round marble floor under a round copper dome, a
// statue in the middle) opens west and east into the wings' corridors and north into the council chamber (two rows of
// seats either side of a central aisle facing the presiding bench). Each wing has two offices south of its corridor
// and a clerks' office north of it; behind those lie the records room (west) and the governor's office (east), whose
// vault slides open on the seal code: three switches (the chamber's, the records room's, the rotunda's over a red, a
// green and a blue plate) pressed in the order of the brass plaque on the lobby floor (a code puzzle like survev
// bathhouse_01's). The vault (7 x 13 inside) holds a safe, a SPAS-16 mount, two deposit boxes and floor loot. The
// central block and the shell are masonry (unbreakable); the wings' partitions are breakable wood, except the vault's.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    circle,
    floorArtPos,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

type Gaps = ReadonlyArray<readonly [number, number]>;
/** Masonry runs: the layout's own brick (no 5th element). */
const bH = (y: number, x0: number, x1: number, gaps: Gaps = []) => hRun(y, x0, x1, gaps, undefined, "brick");
const bV = (x: number, y0: number, y1: number, gaps: Gaps = []) => vRun(x, y0, y1, gaps, undefined, "brick");

// 64 x 46 inside (x -32..32, y -23..23), the front (south) the portico. Columns of rooms: west wing x -32..-12, the
// central block x -12..12, east wing x 12..32. Central block: lobby (y -23..-12), rotunda (-12..8), chamber (8..23).
// Wings: offices (y -23..-5), corridor (-5..1), clerks' office (1..9), records room / governor's office (9..23); the
// vault is x 24..32, y 9..23. The horizontal shell runs from -32 to 32, the vertical one from -23.5 to 23.5 (corners).
export const CAPITOL_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -32, y: -23 }, max: { x: 32, y: 23 } },
    material: "brick",
    walls: [
        // south: an office window each, the double front door; north: two chamber windows behind the presiding bench
        ...bH(-23, -32, 32, [
            [-29, -25],
            [-17, -13],
            [-4, 4],
            [13, 17],
            [25, 29],
        ]),
        ...bH(23, -32, 32, [
            [-10, -6],
            [6, 10],
        ]),
        // west and east: an office window, the corridor door, the clerks' office window
        ...bV(-32, -23.5, 23.5, [
            [-19.5, -15.5],
            [-4, 0],
            [3, 7],
        ]),
        ...bV(32, -23.5, 23.5, [
            [-19.5, -15.5],
            [-4, 0],
            [3, 7],
        ]),
        // the central block's masonry: lobby side doors, the corridors' archways, the chamber's side doors
        ...bV(-12, -23, 23, [
            [-17, -13],
            [-5, 1],
            [18, 22],
        ]),
        ...bV(12, -23, 23, [
            [-17, -13],
            [-5, 1],
            [18, 22],
        ]),
        // lobby | rotunda: the 8-wide archway; rotunda | chamber: a 5-wide archway onto the chamber's aisle (concrete
        // comes in 9.5)
        ...bH(-12, -12, 12, [[-4, 4]]),
        ...hRun(8, -12, 12, [[-2.5, 2.5]], "concrete"),
        // the wings (breakable wood): offices | corridor, corridor | clerks' office, the office partition, clerks'
        // office | records room or governor's office
        ...hRun(
            -5,
            -32,
            -12,
            [
                [-30, -26],
                [-20, -16],
            ],
            "wood",
        ),
        ...hRun(1, -32, -12, [[-30, -26]], "wood"),
        ...vRun(-22, -23, -5, [], "wood"),
        ...hRun(9, -32, -12, [[-20, -16]], "wood"),
        ...hRun(
            -5,
            12,
            32,
            [
                [16, 20],
                [26, 30],
            ],
            "wood",
        ),
        ...hRun(1, 12, 32, [[26, 30]], "wood"),
        ...vRun(22, -23, -5, [], "wood"),
        ...hRun(9, 12, 24, [[16, 20]], "wood"),
        // the vault (masonry): its floor-side wall and the wall with the sliding door (its pocket south of the door)
        ...bH(9, 24, 32),
        ...bV(24, 9, 23, [[15, 19]]),
    ],
    openings: [
        // the front: the double door, the windows
        op("house_door_01", -4, -23.25, 3),
        op("house_door_01", 4, -23.25, 1),
        op("house_window_01", -27, -23.25, 3),
        op("house_window_01", -15, -23.25, 3),
        op("house_window_01", 15, -23.25, 3),
        op("house_window_01", 27, -23.25, 3),
        op("house_window_01", -8, 23.25, 1),
        op("house_window_01", 8, 23.25, 1),
        // the sides: the corridor doors, the windows
        op("house_window_01", -32.25, -17.5, 0),
        op("house_door_01", -32.25, -4, 0),
        op("house_window_01", -32.25, 5, 0),
        op("house_window_01", 32.25, -17.5, 0),
        op("house_door_01", 32.25, -4, 0),
        op("house_window_01", 32.25, 5, 0),
        // the central block: lobby side doors, the chamber's side doors
        op("house_door_01", -12, -17, 0),
        op("house_door_01", 12, -17, 0),
        op("house_door_01", -12, 18, 0),
        op("house_door_01", 12, 18, 0),
        // the wings' doors
        op("house_door_01", -30, -5, 3),
        op("house_door_01", -20, -5, 3),
        op("house_door_01", -30, 1, 3),
        op("house_door_01", -20, 9, 3),
        op("house_door_01", 16, -5, 3),
        op("house_door_01", 26, -5, 3),
        op("house_door_01", 26, 1, 3),
        op("house_door_01", 16, 9, 3),
    ],
    rooms: [
        room(-32, -23, -22, -5, "office"),
        room(-22, -23, -12, -5, "office"),
        room(12, -23, 22, -5, "office"),
        room(22, -23, 32, -5, "office"),
        room(-32, -5, -12, 1, "corridor"),
        room(12, -5, 32, 1, "corridor"),
        room(-32, 1, -12, 9, "clerks"),
        room(12, 1, 32, 9, "clerks"),
        room(-32, 9, -12, 23, "records"),
        room(12, 9, 24, 23, "governor"),
        room(24, 9, 32, 23, "vault"),
        room(-12, -23, 12, -12, "lobby"),
        room(-12, -12, 12, 8, "rotunda"),
        room(-12, 8, 12, 23, "chamber"),
    ],
    // the portico before the front door: its floor and the steps down to the ground
    outdoor: [room(-17, -31, 17, -23.5, "portico")],
};

/** The rotunda's centre and the radius of its round floor (and of the dome on the roof). */
export const CAPITOL_ROTUNDA = { x: 0, y: -2, r: 9.5 } as const;
/** The portico's steps: their south edge, and how deep they are (the art draws them; outside the walls). */
export const CAPITOL_STEPS = { y0: -31, y1: -29, x0: -17, x1: 17 } as const;

/** The governor's vault door (vault_door_bathhouse: only the puzzle opens it; slides 3.75 south into the wall). */
export const CAPITOL_VAULT_DOOR = { type: "vault_door_bathhouse", pos: { x: 24, y: 15 }, ori: 0 } as const;
export const CAPITOL_PUZZLE = "rebirth_capitol";
/** The seal switches, flush to a wall or a neighbour: the chamber's (by the bench), the records', the rotunda's. */
export const CAPITOL_SWITCHES = [
    { label: "red", x: -4.95, y: 21.95, ori: 0 },
    { label: "green", x: -13.05, y: 12, ori: 3 },
    { label: "blue", x: -8.05, y: -10.95, ori: 2 },
] as const;
export const CAPITOL_CODE: readonly string[] = ["red", "green", "blue"];
/** The brass plaque with the code on the lobby floor, before the rotunda's archway. */
export const CAPITOL_PLAQUE = { x: 0, y: -15 } as const;

export const CAPITOL_ART: RoofedBuildingArt = layoutArt(
    CAPITOL_LAYOUT,
    "map-building-capitol-floor-01.img",
    "map-building-capitol-ceiling-01.img",
);

/** The chamber's seats (chair_01 facing the bench): two rows of three either side of the 5-wide aisle. */
export const CAPITOL_SEATS: ReadonlyArray<readonly [number, number]> = [9.75, 15.25].flatMap((y) =>
    [-7.5, -5.5, -3.5, 3.5, 5.5, 7.5].map((x) => [x, y] as const),
);

/** An office's furniture, mirrored to the east wing by `s` = -1 (x -> -x). */
function wingOffices(s: 1 | -1): BuildingDef["mapObjects"] {
    const m = (x: number) => s * x;
    // ori of a piece against the wing's partition (the chamber side) flips with the side
    return [
        // the outer office: a desk in the corner under the window, a filing cabinet against the partition
        child("table_01", m(-29), -20.5),
        child("drawers_01", m(-23.6), -11, s === 1 ? 1 : 3),
        child("loot_tier_2", m(-28), -12),
        // the inner office: a desk in the corner, a riot locker (the guards' post) against the partition
        child("table_01", m(-19), -20.5),
        child("locker_02", m(-20.75), -12, s === 1 ? 1 : 3),
        child("loot_tier_2", m(-16), -9.5),
        // the corridor
        child("loot_tier_1", m(-22), -2),
        // the clerks' office: a filing cabinet against the north wall, a planter by the central block
        child("drawers_01", m(-24.5), 7.1),
        child("planter_07", m(-14), 7),
        child("loot_tier_2", m(-29), 4),
    ];
}

export function capitol(known: (id: string) => boolean): BuildingDef {
    const L = CAPITOL_LAYOUT;
    const R = CAPITOL_ROTUNDA;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-17, -29, 17, -23.5), color: 0xb9b09a },
                { collider: box(-32.5, -23.5, 32.5, 23.5), color: 0xd4cbb4 },
                // the copper dome and its lantern
                { collider: circle(R.x, R.y, R.r + 0.5), color: 0x4f8f80 },
                { collider: circle(R.x, R.y, 2.2), color: 0xe9e1c9 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "house", collision: [box(-32, -23, 32, 23)] },
                { type: "stone", collision: [box(-12, -23, 12, 8), box(-17, -31, 17, -23)] },
                { type: "carpet", collision: [box(-12, 8, 12, 23), box(12, 9, 24, 23)] },
            ],
            imgs: [{ sprite: CAPITOL_ART.floor, pos: floorArtPos(L), scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-32, -23, 32, 23), zoomOut: box(-32.5, -23.5, 32.5, 23.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: CAPITOL_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(CAPITOL_PUZZLE, CAPITOL_VAULT_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(CAPITOL_VAULT_DOOR.type, CAPITOL_VAULT_DOOR.pos.x, CAPITOL_VAULT_DOOR.pos.y, CAPITOL_VAULT_DOOR.ori),
            ...CAPITOL_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            // the lobby: a couch under each window, loot either side of the axis
            child("couch_02", -8.5, -21),
            child("couch_02", 8.5, -21),
            child("loot_tier_2", -7, -16),
            child("loot_tier_1", 7, -16),
            // the rotunda: the founder's statue (indestructible) in the middle, a planter in each south corner (the
            // blue switch beside the west one), a pistol case in each north corner (the founders' Desert Eagles), loot
            child("statue_01", R.x, R.y),
            child("planter_07", -10, -10),
            child("planter_07", 10, -10),
            child("case_01", -9.25, 5.9),
            child("case_01", 9.25, 5.9),
            child("loot_tier_2", -7, 4.5),
            child("loot_tier_1", 7, -8.5),
            // the council chamber: two rows of seats facing the presiding bench on the dais by the north wall,
            // loot either side of the bench
            ...CAPITOL_SEATS.map(([x, y]) => child("chair_01", x, y, 2)),
            child("couch_01", 0, 21),
            child("loot_tier_2", -8, 20),
            child("loot_tier_1", 8, 19.5),
            // the wings' offices and clerks' offices
            ...wingOffices(1),
            ...wingOffices(-1),
            // the records room: shelves along the north wall, a spur of shelf and cabinet from the west wall, lockers
            // on the south wall
            child("bookshelf_01", -28, 21.5),
            child("bookshelf_01", -21, 21.5),
            child("bookshelf_01", -28, 15.5),
            child("drawers_01", -22, 15.5),
            child("locker_01", -30, 10.25, 2),
            child("locker_01", -27, 10.25, 2),
            child("loot_tier_2", -16, 13),
            child("loot_tier_1", -24, 18.5),
            // the governor's office: the desk with its chair, the bookcase on the east end of the north wall
            child("table_01", 18, 15.5),
            child("bookshelf_01", 20, 21.5),
            child("loot_tier_2", 22, 11.5),
            // the governor's vault: a safe and a SPAS-16 mount along the north wall, two deposit boxes in the
            // south-east corner, floor loot
            child("safe_01", 25.75, 21.15),
            child("gun_mount_07", 29.25, 21.6),
            child("deposit_box_03", 27, 10.65, 2),
            child("deposit_box_02", 30.65, 12, 1),
            child("loot_tier_vault_floor", 27.5, 16),
            child("loot_tier_2", 27, 13.5),
            // the portico: six columns before the front, bushes at its ends
            ...[-15, -10, -5, 5, 10, 15].map((x) => child("house_column_1", x, -27.5)),
            child("bush_01", -20, -25.5),
            child("bush_01", 20, -25.5),
        ],
    };
}
