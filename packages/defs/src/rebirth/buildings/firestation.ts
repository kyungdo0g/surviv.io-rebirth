// firestation_01, a rebirth building of the normal map (the owner, 2026-10-08: "more buildings, the map gets bigger";
// docs/research/rebirth-deviations.md "More rebirth buildings"): a red brick fire station. The apparatus bay opens to
// the south through two 8-unit mouths with no doors (an open-front brawl around two indestructible columns), the watch
// office looks into it through a window, the crew room has bunks, and the hose tower in the north-east corner gives a
// 4x view (a zoom region of 48 like the bathhouse's, on the tower's inner faces only). Fire extinguishers on the walls
// burst into smoke when shot (fire_ext_01 createSmoke). The gear cage in the bay's north-east corner (reworked
// 2026-10-10: every interaction opens something; widened the same day, the owner: "expand the content", from about 8 to
// over 25 u² a player can walk) has a barred door like survev police_01's cells; the switch beside the watch window opens
// it (a one-switch puzzle) onto the turnout gear and the station's long guns: a rack of two gun mounts (m870, mp220), a
// chest (tier_chest), a riot locker (tier_police), a fire axe and level 3 armour.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    floorArtPos,
    LOOKOUT_ZOOM,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "./layout.ts";
import { hRun, vRun } from "./military/part.ts";

// 39 x 25 inside (x -19.5..19.5, y -12.5..12.5). West: the apparatus bay; east: the watch office (south), the crew room
// (north) and the hose tower (north-east corner). An asphalt apron in front of the bay mouths. The gear cage fills the
// bay's north-east corner (x -6.5..3.5, y 1.5..12.5 wall lines, 9 x 10 inside) between the bay's north window and the
// crew room; the office | crew wall sits at y -3 so the crew door (y -3..1) clears the cage's south wall.
export const FIRESTATION_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -19.5, y: -12.5 }, max: { x: 19.5, y: 12.5 } },
    material: "brick",
    walls: [
        // south: bay mouths -17..-9 and -6..2 stay open; office door 8..12, office window 14..18
        [-20, -12.5, -17, -12.5],
        [-9, -12.5, -6, -12.5],
        [2, -12.5, 8, -12.5],
        [12, -12.5, 14, -12.5],
        [18, -12.5, 20, -12.5],
        // north: bay window -10..-6, crew window 7..11, tower window 14..18
        [-20, 12.5, -10, 12.5],
        [-6, 12.5, 7, 12.5],
        [11, 12.5, 14, 12.5],
        [18, 12.5, 20, 12.5],
        // west: bay window 0..4
        [-19.5, -12, -19.5, 0],
        [-19.5, 4, -19.5, 12],
        // east: office window -8..-4, crew door 1..5, tower window 7..11
        [19.5, -12, 19.5, -8],
        [19.5, -4, 19.5, 1],
        [19.5, 5, 19.5, 7],
        [19.5, 11, 19.5, 12],
        // bay | wing: the watch window -9..-5 (office), crew door -3..1; the cage's east wall above it
        [3.5, -12, 3.5, -9],
        [3.5, -5, 3.5, -3],
        ...vRun(3.5, 1, 12, [], undefined, "brick"),
        // office | crew room: door 13..17
        [4, -3, 13, -3],
        [17, -3, 19, -3],
        // the hose tower: west wall, south wall with its door 14..18
        [13.5, 7, 13.5, 12],
        [13, 6.5, 14, 6.5],
        [18, 6.5, 19, 6.5],
        // the gear cage: its barred door -6..-2 swings out into the bay; the west wall meets the north wall at the window's
        // east jamb (x -6), so the cage stays sealed behind the window
        ...hRun(1.5, -7, 3, [[-6, -2]], undefined, "brick"),
        ...vRun(-6.5, 1, 12, [], undefined, "brick"),
    ],
    openings: [
        { type: "house_door_01", pos: { x: 8, y: -12.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: 16, y: -12.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: -8, y: 12.75 }, ori: 1 },
        { type: "house_window_01", pos: { x: 9, y: 12.75 }, ori: 1 },
        { type: "house_window_01", pos: { x: 16, y: 12.75 }, ori: 1 },
        { type: "house_window_01", pos: { x: -19.75, y: 2 }, ori: 0 },
        { type: "house_window_01", pos: { x: 19.75, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: 19.75, y: 1 }, ori: 0 },
        { type: "house_window_01", pos: { x: 19.75, y: 9 }, ori: 0 },
        // the watch window between the office and the bay, on the wall line
        { type: "house_window_01", pos: { x: 3.5, y: -7 }, ori: 0 },
        { type: "house_door_01", pos: { x: 3.5, y: -3 }, ori: 0 },
        { type: "house_door_01", pos: { x: 13, y: -3 }, ori: 3 },
        { type: "house_door_01", pos: { x: 14, y: 6.5 }, ori: 3 },
    ],
    rooms: [
        { min: { x: -19.5, y: -12.5 }, max: { x: 3.5, y: 12.5 }, floor: "bay" },
        { min: { x: 3.5, y: -12.5 }, max: { x: 19.5, y: -3 }, floor: "office" },
        { min: { x: 3.5, y: -3 }, max: { x: 19.5, y: 12.5 }, floor: "crew" },
        { min: { x: 13.5, y: 6.5 }, max: { x: 19.5, y: 12.5 }, floor: "tower" },
        { min: { x: -6.5, y: 1.5 }, max: { x: 3.5, y: 12.5 }, floor: "cage" },
    ],
    outdoor: [{ min: { x: -20, y: -17.5 }, max: { x: 3.5, y: -12.5 }, floor: "apron" }],
};

export const FIRESTATION_ART: RoofedBuildingArt = layoutArt(
    FIRESTATION_LAYOUT,
    "map-building-firestation-floor-01.img",
    "map-building-firestation-ceiling-01.img",
);

/** The gear cage's barred door (cell_door_01: only the puzzle opens it) and the switch beside the watch window. */
export const FIRESTATION_CAGE_DOOR = { type: "cell_door_01", pos: { x: -2, y: 1.5 }, ori: 1 } as const;
export const FIRESTATION_PUZZLE = "rebirth_firestation";
export const FIRESTATION_SWITCH = { x: 4.55, y: -4.4 } as const;

/** The hose tower's zoom region (its inner faces: no zoomOut, which would hand the 4x view to the crew room). */
export const FIRESTATION_TOWER = box(14, 7, 19, 12);

export function firestation(known: (id: string) => boolean): BuildingDef {
    const L = FIRESTATION_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-20, -17.5, 3.5, -13), color: 0x5f6366 },
                { collider: box(-20, -13, 20, 13), color: 0xcf2e28 },
                { collider: box(-17, -13, -9, -11), color: 0xf2b705 },
                { collider: box(-6, -13, 2, -11), color: 0xf2b705 },
                { collider: box(13, 6, 20, 13), color: 0x8d9094 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            // the whole box first (the layout test reads surfaces[0]); later surfaces win where they overlap
            surfaces: [
                { type: "stone", collision: [box(-19.5, -12.5, 19.5, 12.5)] },
                { type: "tile", collision: [box(3.5, -12.5, 19.5, -3)] },
                { type: "house", collision: [box(3.5, -3, 19.5, 12.5)] },
                { type: "container", collision: [box(13.5, 6.5, 19.5, 12.5)] },
                { type: "asphalt", collision: [box(-20, -17.5, 3.5, -12.5)] },
            ],
            imgs: [
                {
                    sprite: FIRESTATION_ART.floor,
                    pos: floorArtPos(L),
                    scale: ART_SCALE,
                    alpha: 1,
                    tint: 0xffffff,
                },
            ],
        },
        ceiling: {
            zoomRegions: [
                { zoomIn: box(-19.5, -12.5, 19.5, 12.5), zoomOut: box(-20, -13, 20, 13) },
                { zoomIn: FIRESTATION_TOWER, zoom: LOOKOUT_ZOOM },
            ],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: FIRESTATION_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(FIRESTATION_PUZZLE, FIRESTATION_CAGE_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(
                FIRESTATION_CAGE_DOOR.type,
                FIRESTATION_CAGE_DOOR.pos.x,
                FIRESTATION_CAGE_DOOR.pos.y,
                FIRESTATION_CAGE_DOOR.ori,
            ),
            // the apparatus bay: two structural columns between the engine lanes (the bay's hard cover, the north one flush
            // with the cage), two crew lockers in the north-west corner, extinguishers, a throwables crate, loot in the
            // open lanes
            child("house_column_1", -8, -4),
            child("house_column_1", -8, 4),
            child("locker_01", -17.5, 11.25),
            child("locker_01", -14.5, 11.25),
            child("fire_ext_01", -18.3, -6, 0),
            child("fire_ext_01", 2.2, -10.75, 2),
            child("crate_14", -16.75, -2.75),
            child("loot_tier_1", -13, -6),
            child("loot_tier_1", -2, -6),
            child("loot_tier_2", -12, 7),
            // the gear cage: the gun rack along the north wall, a chest in the south-east corner, the riot locker above
            // it, the fire axe and level 3 armour on the floor
            child("gun_mount_01", -3.75, 11.1),
            child("gun_mount_02", 0.75, 11.1),
            child("chest_02", 0.75, 3.6),
            child("locker_02", 2.25, 6.7, 3),
            child("loot_tier_fireaxe", -4, 5),
            child("loot_tier_airdrop_armor", -2, 8.5),
            // the watch office: the dispatch desk facing the watch window, its chair and board, the cage switch, lockers,
            // an extinguisher
            piece("switch_03", FIRESTATION_SWITCH.x, FIRESTATION_SWITCH.y, 1, "1"),
            child("table_01", 8, -7.8),
            child("chair_02", 11.75, -7.8),
            child("screen_01", 8, -3.75),
            child("locker_01", 18.25, -10.5, 3),
            child("locker_01", 18.25, -5, 3),
            child("fire_ext_01", 5, -10.9, 0),
            child("loot_tier_2", 14.5, -8.5),
            // the crew room: bunks, a fridge between them and the tower, a sink (no oven: no surprise blast); the crew
            // door's swing (x 3.5..7.5, y -3..1) stays clear
            child("bed_sm_01", 5.4, 8.6),
            child("bed_sm_01", 8.2, 8.6),
            child("refrigerator_01", 11.3, 10.6),
            child("loot_tier_1", 11.3, 7.5),
            child("sink_01", 10, -1, 2),
            child("loot_tier_1", 10, 4.25),
            // the hose tower
            child("loot_tier_1", 16.5, 10),
            // outside: bollards at the bay mouths, bushes by the office
            child("bollard_01", -18.5, -14.5),
            child("bollard_01", -7.5, -14.5),
            child("bollard_01", 3, -14.5),
            child("bush_01", 6, -14.6),
            child("bush_01", 19.5, -14.6),
        ],
    };
}
