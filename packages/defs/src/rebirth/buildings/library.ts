// library_01, a rebirth building of the normal map (the owner, 2026-10-08; reworked 2026-10-10: wider aisles, and a
// hidden room; docs/research/rebirth-deviations.md "More rebirth buildings"): a limestone town library. The stacks hall
// is a serpentine of five bookshelves against alternate walls with 4-unit aisles (no straight line crosses it); south
// of it the reading room with the piano, the foyer and the archive, whose bookcase door (saloon_door_secret) slides
// open when the switch at the end of the middle aisle is pressed (a one-switch puzzle like survev bathhouse_01's): the
// rare-books room holds a rare-books shelf (tier_soviet), a pistol case and an SV-98. A purple roof with an open book.
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

// 38 x 28 inside (x -19..19, y -14..14). North: the stacks hall; south: reading room | foyer | archive, the rare-books
// room in the archive's south-east corner. Brick comes in whole units: outer runs start half a unit outside the floor.
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
        // the stacks wall: the reading-room door, the open archway from the foyer, the archive door
        ...hRun(
            0,
            -19,
            19,
            [
                [-15, -11],
                [-5, 1],
                [6, 10],
            ],
            undefined,
            "brick",
        ),
        // reading room | foyer and foyer | archive, a door each
        ...vRun(-7, -14, 0, [[-6, -2]], undefined, "brick"),
        ...vRun(5, -14, 0, [[-6, -2]], undefined, "brick"),
        // the rare-books room: the bookcase door slides east into its north wall
        ...hRun(-7, 10, 19, [[10, 14]], undefined, "brick"),
        ...vRun(10, -14, -7, [], undefined, "brick"),
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
        room(5, -14, 19, 0, "archive"),
        room(10, -14, 19, -7, "rare"),
    ],
};

/** The rare-books room's bookcase door (saloon_door_secret: only the puzzle opens it; slides 4.5 east). */
export const LIBRARY_SECRET_DOOR = { type: "saloon_door_secret", pos: { x: 14, y: -7 }, ori: 1 } as const;
export const LIBRARY_PUZZLE = "rebirth_library";
/** The switch at the north end of the middle aisle. */
export const LIBRARY_SWITCH = { x: -3, y: 12.95 } as const;

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
            // the stacks: shelves against the north wall and the stacks wall, alternating; the switch at the end of the
            // middle aisle
            ...LIBRARY_SHELVES.map(([x, y]) => child("bookshelf_01", x, y, 1)),
            piece("switch_03", LIBRARY_SWITCH.x, LIBRARY_SWITCH.y, 0, "1"),
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
            // the archive: a shelf against the stacks wall, a stand, loot
            child("bookshelf_01", 15, -1.5),
            child("stand_01", 6.75, -12.4),
            child("loot_tier_2", 7.5, -4),
            // the rare-books room: the rare-books shelf (tier_soviet), a pistol case (case_01: a Desert Eagle), an SV-98
            child("bookshelf_02", 15, -12.5),
            child("case_01", 16.25, -9.9),
            child("loot_tier_sv98", 12, -9),
            child("loot_tier_2", 12, -10.75),
            // outside: the portico's columns, bushes
            child("house_column_1", -4.5, -15.5),
            child("house_column_1", 3.5, -15.5),
            child("bush_01", -17, -16.1),
            child("bush_01", 17, -16.1),
        ],
    };
}
