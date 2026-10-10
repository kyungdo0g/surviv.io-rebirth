// library_01, a rebirth building of the normal map (the owner, 2026-10-08; reworked 2026-10-10: wider aisles, and a
// hidden room; docs/research/rebirth-deviations.md "More rebirth buildings"): a limestone town library. The stacks hall
// is a serpentine of five bookshelves against alternate walls with 4-unit aisles (no straight line crosses it); south
// of it the reading room with the piano, the foyer, the archive and the rare-books vault behind a bookcase door
// (saloon_door_secret) that slides open on the reading-lamp code: three switches (the reading room's, the foyer's, the
// stacks' middle aisle's) pressed in the order of the coloured note on the archive floor (a code puzzle like survev
// bathhouse_01's; the owner, 2026-10-10: "expand the hidden rooms"). The vault (7 x 13) holds a rare-books shelf and a
// card catalogue (tier_soviet), a pistol case, a reading stand, an SV-98 and loot. A purple roof with an open book. The
// partitions between the ordinary rooms are breakable wood (the owner, 2026-10-10); the shell and the vault stay brick.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

// 38 x 28 inside (x -19..19, y -14..14). North: the stacks hall; south: reading room | foyer | archive | rare-books
// vault (x 11.5..18.5 inside). Brick comes in whole units: outer runs start half a unit outside the floor.
export const LIBRARY_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -19, y: -14 }, max: { x: 19, y: 14 } },
    material: "brick",
    walls: [
        // south: the reading-room window, the front door; north: windows over two aisles
        ...hRun(
            -14,
            -19.5,
            19.5,
            [
                [-16.5, -12.5],
                [-2.5, 1.5],
            ],
            undefined,
            "brick",
        ),
        ...hRun(
            14,
            -19.5,
            19.5,
            [
                [-11.5, -7.5],
                [6.5, 10.5],
            ],
            undefined,
            "brick",
        ),
        // west and east: the stacks doors
        ...vRun(-19, -13.5, 13.5, [[3.5, 7.5]], undefined, "brick"),
        ...vRun(19, -13.5, 13.5, [[3.5, 7.5]], undefined, "brick"),
        // the stacks wall (breakable wood): the reading-room door, the open archway from the foyer, the archive door;
        // its stretch over the rare-books vault (x 10..19) stays brick
        ...hRun(
            0,
            -19,
            10,
            [
                [-15, -11],
                [-5, 1],
                [6, 10],
            ],
            "wood",
        ),
        ...hRun(0, 10, 19, [], undefined, "brick"),
        // reading room | foyer and foyer | archive (breakable wood), a door each
        ...vRun(-7, -14, 0, [[-6, -2]], "wood"),
        ...vRun(5, -14, 0, [[-6, -2]], "wood"),
        // archive | rare-books vault: the bookcase door (1.5 thick) slides south into the wall, doubled to x 10..11.5
        ...vRun(10.5, -14, 0, [[-7, -3]], undefined, "brick"),
        ...vRun(11, -14, 0, [[-7, -3]], undefined, "brick"),
    ],
    openings: [
        op("house_window_01", -14.5, -14.25, 3),
        op("house_door_01", -2.5, -14.25, 3),
        op("house_window_01", -9.5, 14.25, 1),
        op("house_window_01", 8.5, 14.25, 1),
        op("house_door_01", -19.25, 3.5, 0),
        op("house_door_01", 19.25, 3.5, 0),
        op("house_door_01", -15, 0, 3),
        op("house_door_01", 6, 0, 3),
        op("house_door_01", -7, -6, 0),
        op("house_door_01", 5, -6, 0),
    ],
    rooms: [
        room(-19, 0, 19, 14, "stacks"),
        room(-19, -14, -7, 0, "reading"),
        room(-7, -14, 5, 0, "foyer"),
        room(5, -14, 10.75, 0, "archive"),
        room(10.75, -14, 19, 0, "rare"),
    ],
};

/** The rare-books vault's bookcase door (saloon_door_secret: only the puzzle opens it; slides 4.5 south). */
export const LIBRARY_SECRET_DOOR = { type: "saloon_door_secret", pos: { x: 10.75, y: -7 }, ori: 0 } as const;
export const LIBRARY_PUZZLE = "rebirth_library";
/** The reading-lamp switches, flush to a wall each: the reading room's, the foyer's, the stacks' middle aisle's. */
export const LIBRARY_SWITCHES = [
    { label: "red", x: -9, y: -1.05, ori: 2 },
    { label: "yellow", x: -5.95, y: -10, ori: 1 },
    { label: "green", x: -3, y: 12.95, ori: 0 },
] as const;
export const LIBRARY_CODE: readonly string[] = ["red", "yellow", "green"];
/** The note with the code on the archive floor, south of the bookcase door. */
export const LIBRARY_NOTE = { x: 8.35, y: -12.5 } as const;

export const LIBRARY_ART: RoofedBuildingArt = layoutArt(
    LIBRARY_LAYOUT,
    "map-building-library-floor-01.img",
    "map-building-library-ceiling-01.img",
);

/** The stacks: five bookshelf_01 (ori 1: 2 x 7, north-south) against alternate walls, with 4-unit aisles. */
export const LIBRARY_SHELVES: ReadonlyArray<readonly [number, number]> = [
    [-12, 10],
    [-6, 4],
    [0, 10],
    [6, 4],
    [12, 10],
];

export function library(known: (id: string) => boolean): BuildingDef {
    const L = LIBRARY_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-19.5, -14.5, 19.5, 14.5), color: 0x5c4877 },
                // the open book on the roof
                { collider: box(-4, -1.5, 0.6, 4.5), color: 0xf2ead3 },
                { collider: box(1.4, -1.5, 6, 4.5), color: 0xf2ead3 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "house", collision: [box(-19, -14, 19, 14)] },
                { type: "carpet", collision: [box(-19, -14, -7, 0)] },
                { type: "stone", collision: [box(-7, -14, 5, 0)] },
                { type: "carpet", collision: [box(5, -14, 19, 0)] },
            ],
            imgs: [
                { sprite: LIBRARY_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff },
                // the porch at the front door (the clinic's)
                {
                    sprite: "map-building-porch-01.img",
                    pos: { x: -0.5, y: -15.5 },
                    scale: 0.5,
                    alpha: 1,
                    tint: 0xffffff,
                    rot: 2,
                },
            ],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-19, -14, 19, 14), zoomOut: box(-19.5, -14.5, 19.5, 14.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: LIBRARY_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(LIBRARY_PUZZLE, LIBRARY_SECRET_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(
                LIBRARY_SECRET_DOOR.type,
                LIBRARY_SECRET_DOOR.pos.x,
                LIBRARY_SECRET_DOOR.pos.y,
                LIBRARY_SECRET_DOOR.ori,
            ),
            // the stacks: shelves against the north wall and the stacks wall, alternating; the reading-lamp switches
            ...LIBRARY_SHELVES.map(([x, y]) => child("bookshelf_01", x, y, 1)),
            ...LIBRARY_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            child("loot_tier_1", -16, 10),
            child("loot_tier_1", 9, 4),
            // the reading room: the piano against the west wall (indestructible), a reading table with two chairs, a
            // planter
            child("piano_01", -17.5, -4.25, 1),
            child("table_01", -12, -8),
            child("chair_02", -12, -4.7),
            child("chair_02", -12, -11.75),
            child("planter_07", -9, -12),
            child("loot_tier_1", -13, -11.5),
            // the foyer: the circulation desk, a planter by the door
            child("table_01", 1.5, -7.5, 1),
            child("planter_07", 3, -12),
            child("loot_tier_1", -3.5, -4),
            // the archive (4.5 wide): two filing lockers against the west wall leave a 3.3 aisle, loot
            child("locker_01", 6.25, -12, 1),
            child("locker_01", 6.25, -9, 1),
            child("loot_tier_2", 8.25, -9.5),
            // the rare-books vault: the rare-books shelf on the north wall, the card catalogue (drawers_02) on the east
            // one under it, a pistol case (case_01: a Desert Eagle) and a reading stand along the south wall (4.5 + 2.5
            // fill its 7), the SV-98 and loot on the 4.5-wide floor between
            child("bookshelf_02", 15, -1.5),
            child("drawers_02", 17.4, -5, 1),
            child("case_01", 13.75, -11.9),
            child("stand_01", 17.25, -12.4),
            child("loot_tier_sv98", 14, -6),
            child("loot_tier_2", 13.5, -8.5),
            // outside: the portico's columns, bushes
            child("house_column_1", -4.5, -15.5),
            child("house_column_1", 3.5, -15.5),
            child("bush_01", -17, -16.1),
            child("bush_01", 17, -16.1),
        ],
    };
}
