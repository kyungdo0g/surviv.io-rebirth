// radio_station_01, a rebirth building of the normal map (the owner, 2026-10-08; docs/research/rebirth-deviations.md
// "More rebirth buildings"): a concrete radio station. The transmitter hall is a panic room: survev's lockdown panel
// (control_panel_07sv: closes and locks the building's lab_door_01 doors for 10 s, 40 s cooldown; survev's Cloud
// bunker) seals its two sliding doors, but the studio looks in through a window and the radio set inside explodes when
// shot (control_panel_03), so a sealed room is safe only until someone breaks the glass. The generator room's power
// boxes and propane tank explode too; the lobby is the way in. A slate-blue roof with the mast.
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

// 31 x 21 inside (x -15.5..15.5, y -10.5..10.5). South: the lobby; north: studio | transmitter hall | generator room.
export const RADIO_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -15.5, y: -10.5 }, max: { x: 15.5, y: 10.5 } },
    material: "concrete",
    walls: [
        // south: windows -12..-8 and 8..12, the main door -2..2
        [-16, -10.5, -12, -10.5],
        [-8, -10.5, -2, -10.5],
        [2, -10.5, 8, -10.5],
        [12, -10.5, 16, -10.5],
        // north: studio window -13..-9, generator back door 9..13 (concrete has no 18: 4 + 14)
        [-16, 10.5, -13, 10.5],
        [-9, 10.5, -5, 10.5],
        [-5, 10.5, 9, 10.5],
        [13, 10.5, 16, 10.5],
        // west: lobby door -10..-6, studio window 2..6
        [-15.5, -6, -15.5, 2],
        [-15.5, 6, -15.5, 10],
        // east: lobby window -8..-4, generator window 2..6
        [15.5, -10, 15.5, -8],
        [15.5, -4, 15.5, 2],
        [15.5, 6, 15.5, 10],
        // the lobby wall: studio door -12..-8, the hall's lab door -2..2 (slides west into the wall), generator door 8..12
        [-15, -3.5, -12, -3.5],
        [-8, -3.5, -2, -3.5],
        [2, -3.5, 8, -3.5],
        [12, -3.5, 15, -3.5],
        // studio | hall: the studio glass 3..7
        [-5.5, -3, -5.5, 3],
        [-5.5, 7, -5.5, 10],
        // hall | generator room: the lab door 3..7 (slides south into the wall)
        [5.5, -3, 5.5, 3],
        [5.5, 7, 5.5, 10],
    ],
    openings: [
        { type: "house_window_01", pos: { x: -10, y: -10.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: 10, y: -10.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -2, y: -10.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: -11, y: 10.75 }, ori: 1 },
        { type: "house_door_01", pos: { x: 9, y: 10.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -15.75, y: -10 }, ori: 0 },
        { type: "house_window_01", pos: { x: -15.75, y: 4 }, ori: 0 },
        { type: "house_window_01", pos: { x: 15.75, y: -6 }, ori: 0 },
        { type: "house_window_01", pos: { x: 15.75, y: 4 }, ori: 0 },
        { type: "house_door_01", pos: { x: -12, y: -3.5 }, ori: 3 },
        { type: "lab_door_01", pos: { x: -2, y: -3.5 }, ori: 3 },
        { type: "house_door_01", pos: { x: 8, y: -3.5 }, ori: 3 },
        // the studio glass into the hall, on the wall line
        { type: "house_window_01", pos: { x: -5.5, y: 5 }, ori: 0 },
        { type: "lab_door_01", pos: { x: 5.5, y: 3 }, ori: 0 },
    ],
    rooms: [
        { min: { x: -15.5, y: -10.5 }, max: { x: 15.5, y: -3.5 }, floor: "lobby" },
        { min: { x: -15.5, y: -3.5 }, max: { x: -5.5, y: 10.5 }, floor: "studio" },
        { min: { x: -5.5, y: -3.5 }, max: { x: 5.5, y: 10.5 }, floor: "hall" },
        { min: { x: 5.5, y: -3.5 }, max: { x: 15.5, y: 10.5 }, floor: "generator" },
    ],
};

export const RADIO_ART: RebirthBuildingArt = layoutArt(
    RADIO_LAYOUT,
    "map-building-radio-floor-01.img",
    "map-building-radio-ceiling-01.img",
);

export function radioStation(known: (id: string) => boolean): BuildingDef {
    const L = RADIO_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-16, -11, 16, 11), color: 0x4f6072 },
                // the mast on the roof, white and orange
                { collider: box(-4, 0, 4, 8), color: 0xf4f4f0 },
                { collider: box(-2, 2, 2, 6), color: 0xe0661b },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "stone", collision: [box(-15.5, -10.5, 15.5, 10.5)] },
                { type: "carpet", collision: [box(-15.5, -3.5, -5.5, 10.5)] },
                { type: "bunker", collision: [box(-5.5, -3.5, 5.5, 10.5)] },
            ],
            imgs: [{ sprite: RADIO_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-15.5, -10.5, 15.5, 10.5), zoomOut: box(-16, -11, 16, 11) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: RADIO_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        // the transmitters' hum in the hall (the clinic's sound)
        soundEmitters: [
            {
                sound: "ambient_lab_01",
                channel: "ambient",
                pos: { x: 0, y: 3.5 },
                range: { min: 3, max: 10 },
                falloff: 1,
                volume: 0.12,
            },
        ],
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            // the transmitter hall: the lockdown panel, the transmitter rack (indestructible, ricochets), a radio set
            // that explodes, the hall's loot
            child("control_panel_07sv", 0.5, 8.3),
            child("table_07", 0, 1.5, 1),
            child("control_panel_03", -3.75, 8.8),
            child("loot_tier_2", 3.5, 8.5),
            child("loot_tier_1", -3, -1.5),
            // the studio: the mixing desk facing the glass, two chairs, the record shelf
            child("table_04", -8.5, 5, 1),
            child("chair_02", -11.75, 3.5),
            child("chair_02", -11.75, 6.5),
            child("bookshelf_01", -14, 0.5, 1),
            child("loot_tier_2", -13, 8),
            // the generator room: two power boxes and a propane tank (all explode), an extinguisher, a crate
            child("power_box_01", 7, 9),
            child("power_box_01", 14, 9),
            child("propane_01", 13.6, -0.9),
            child("fire_ext_01", 6.65, -1.5),
            child("crate_01", 11, 4),
            child("decal_oil_01", 10.5, 8.5),
            child("loot_tier_1", 8, 1.5),
            // the lobby: the reception desk and chair, a couch, the soda machine
            child("table_01", 5, -6),
            child("chair_01", 5, -9, 1),
            child("couch_02", -5, -8.5),
            child("vending_01", 13.6, -6, 3),
            child("loot_tier_1", -10, -7),
            child("loot_tier_1", 10.5, -6.5),
            // outside
            child("bush_01", -4.25, -12.6),
            child("bush_01", 4.25, -12.6),
        ],
    };
}
