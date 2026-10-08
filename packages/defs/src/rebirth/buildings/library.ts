// library_01, a rebirth building of the normal map (the owner, 2026-10-08; docs/research/rebirth-deviations.md "More
// rebirth buildings"): a limestone town library. The stacks hall is a destructible serpentine of six bookshelves
// against alternate walls with 3-unit aisles (no straight line crosses it) and four indestructible columns that stay
// once the shelves are shot out; south of it a reading room with the piano, the foyer with the circulation desk and
// the archive with the rare-books shelf. A purple roof with an open book.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    layoutArt,
    openingChildren,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    wallChildren,
} from "./layout.ts";

// 35 x 25 inside (x -17.5..17.5, y -12.5..12.5). North: the stacks hall; south: reading room | foyer | archive.
export const LIBRARY_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -17.5, y: -12.5 }, max: { x: 17.5, y: 12.5 } },
    material: "brick",
    walls: [
        // north: windows over two aisles (-15..-11, -5..-1), the north door 5..9
        [-18, 12.5, -15, 12.5],
        [-11, 12.5, -5, 12.5],
        [-1, 12.5, 5, 12.5],
        [9, 12.5, 18, 12.5],
        // south: reading-room window -14..-10, the front door -1..3, archive window 10..14
        [-18, -12.5, -14, -12.5],
        [-10, -12.5, -1, -12.5],
        [3, -12.5, 10, -12.5],
        [14, -12.5, 18, -12.5],
        // west: reading-room window -9..-5, stacks door 7..11
        [-17.5, -12, -17.5, -9],
        [-17.5, -5, -17.5, 7],
        [-17.5, 11, -17.5, 12],
        // east: archive window -9..-5, stacks door 1..5
        [17.5, -12, 17.5, -9],
        [17.5, -5, 17.5, 1],
        [17.5, 5, 17.5, 12],
        // the stacks wall with the open archway -1..5
        [-17, -1.5, -1, -1.5],
        [5, -1.5, 17, -1.5],
        // reading room | foyer (door -6..-2), foyer | archive (door -6..-2)
        [-5.5, -12, -5.5, -6],
        [6.5, -12, 6.5, -6],
    ],
    openings: [
        { type: "house_window_01", pos: { x: -13, y: 12.75 }, ori: 1 },
        { type: "house_window_01", pos: { x: -3, y: 12.75 }, ori: 1 },
        { type: "house_door_01", pos: { x: 5, y: 12.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: -12, y: -12.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -1, y: -12.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: 12, y: -12.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: -17.75, y: -7 }, ori: 0 },
        { type: "house_door_01", pos: { x: -17.75, y: 7 }, ori: 0 },
        { type: "house_window_01", pos: { x: 17.75, y: -7 }, ori: 0 },
        { type: "house_door_01", pos: { x: 17.75, y: 1 }, ori: 0 },
        { type: "house_door_01", pos: { x: -5.5, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: 6.5, y: -6 }, ori: 0 },
    ],
    rooms: [
        { min: { x: -17.5, y: -1.5 }, max: { x: 17.5, y: 12.5 }, floor: "stacks" },
        { min: { x: -17.5, y: -12.5 }, max: { x: -5.5, y: -1.5 }, floor: "reading" },
        { min: { x: -5.5, y: -12.5 }, max: { x: 6.5, y: -1.5 }, floor: "foyer" },
        { min: { x: 6.5, y: -12.5 }, max: { x: 17.5, y: -1.5 }, floor: "archive" },
    ],
};

export const LIBRARY_ART: RebirthBuildingArt = layoutArt(
    LIBRARY_LAYOUT,
    "map-building-library-floor-01.img",
    "map-building-library-ceiling-01.img",
);

/** The stacks: six bookshelf_01 (ori 1: 2 x 7, north-south) against alternate walls, with 3-unit aisles. */
export const LIBRARY_SHELVES: ReadonlyArray<readonly [number, number]> = [
    [-13, 2.5],
    [-3, 2.5],
    [7, 2.5],
    [-8, 8.5],
    [2, 8.5],
    [12, 8.5],
];

export function library(known: (id: string) => boolean): BuildingDef {
    const L = LIBRARY_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-18, -13, 18, 13), color: 0x5c4877 },
                // the open book on the roof
                { collider: box(-4, -1.5, 0.6, 4.5), color: 0xf2ead3 },
                { collider: box(1.4, -1.5, 6, 4.5), color: 0xf2ead3 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "house", collision: [box(-17.5, -12.5, 17.5, 12.5)] },
                { type: "carpet", collision: [box(-17.5, -12.5, -5.5, -1.5)] },
                { type: "stone", collision: [box(-5.5, -12.5, 6.5, -1.5)] },
                { type: "carpet", collision: [box(6.5, -12.5, 17.5, -1.5)] },
            ],
            imgs: [
                { sprite: LIBRARY_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff },
                // the porch at the front door (the clinic's)
                {
                    sprite: "map-building-porch-01.img",
                    pos: { x: 1, y: -14 },
                    scale: 0.5,
                    alpha: 1,
                    tint: 0xffffff,
                    rot: 2,
                },
            ],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-17.5, -12.5, 17.5, 12.5), zoomOut: box(-18, -13, 18, 13) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: LIBRARY_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            // the stacks: shelves against the stacks wall (row 1) and the north wall (row 2), alternating, with columns
            // at the free ends of the four inner shelves
            ...LIBRARY_SHELVES.map(([x, y]) => child("bookshelf_01", x, y, 1)),
            child("house_column_1", -3, 7),
            child("house_column_1", 7, 7),
            child("house_column_1", -8, 4),
            child("house_column_1", 2, 4),
            child("loot_tier_1", -15.5, 2),
            child("loot_tier_1", 9.5, 2),
            // the reading room: the piano (indestructible), a reading table with two chairs, a planter
            child("piano_01", -12.75, -11),
            child("table_01", -13, -6.5),
            child("chair_02", -14.5, -3.25),
            child("chair_02", -11.5, -3.25),
            child("planter_07", -7.5, -10.5),
            child("loot_tier_1", -8, -7),
            // the foyer: the circulation desk, a planter
            child("table_01", -3, -9, 1),
            child("planter_07", 4.5, -10.5),
            child("loot_tier_1", 1, -5),
            // the archive: one rare-books shelf (tier_soviet), a reading desk and chair
            child("bookshelf_02", 16, -5.5, 1),
            child("table_01", 11, -9.5),
            child("chair_02", 12, -6.25),
            child("loot_tier_2", 8.5, -11),
            // outside: the portico's columns, bushes
            child("house_column_1", -2.5, -14.25),
            child("house_column_1", 4.5, -14.25),
            child("bush_01", -16, -14.6),
            child("bush_01", 16, -14.6),
        ],
    };
}
