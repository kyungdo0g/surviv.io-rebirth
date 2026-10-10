// radio_station_01, a rebirth building of the normal map (the owner, 2026-10-08; reworked 2026-10-10: roomier, and
// its interaction pays off; docs/research/rebirth-deviations.md "More rebirth buildings"): a concrete radio station.
// The lobby leads to the studio, the transmitter hall and the generator room; behind the hall lies the signals vault,
// whose sliding door opens on the frequency code: a switch in each north room (a yellow, a red and a blue plate on the
// floor), pressed in the order the note on the studio floor shows (yellow, red, blue; survev bathhouse_01's code room).
// The vault holds a sniper crate (mil_crate_05), level 3 armour and a sniper scope. The generator room's power boxes
// and propane tank explode. A slate-blue roof with the mast.
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

// 34 x 24 inside (x -17..17, y -12..12). South: the lobby; north: studio | transmitter hall (the vault behind it) |
// generator room. Doorways 4 units; furniture flush against the walls or 2.6+ clear.
export const RADIO_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -17, y: -12 }, max: { x: 17, y: 12 } },
    material: "concrete",
    walls: [
        // south: two windows and the main door; north: the studio window, the generator back door
        ...hRun(-12, -17.5, 17.5, [
            [-13.5, -9.5],
            [-2.5, 1.5],
            [9.5, 13.5],
        ]),
        ...hRun(12, -17.5, 17.5, [
            [-13.5, -9.5],
            [9.5, 13.5],
        ]),
        // west: the lobby side door; east: a lobby window, a generator window
        ...vRun(-17, -11.5, 11.5, [[-9.5, -5.5]]),
        ...vRun(17, -11.5, 11.5, [
            [-8, -4],
            [2, 6],
        ]),
        // the corridor wall with a door into each north room
        ...hRun(-2, -17, 17, [
            [-14, -10],
            [-2, 2],
            [9, 13],
        ]),
        // studio | hall with the studio glass, hall | generator
        ...vRun(-5, -2, 12, [[2, 6]]),
        ...vRun(6, -2, 12),
        // the signals vault behind the hall: its sliding door slides east into the wall
        ...hRun(6, -5, 6, [[-3.5, 0.5]]),
    ],
    openings: [
        op("house_window_01", -11.5, -12.25, 3),
        op("house_window_01", 11.5, -12.25, 3),
        op("house_door_01", -2.5, -12.25, 3),
        op("house_window_01", -11.5, 12.25, 1),
        op("house_door_01", 9.5, 12.25, 3),
        op("house_door_01", -17.25, -9.5, 0),
        op("house_window_01", 17.25, -6, 0),
        op("house_window_01", 17.25, 4, 0),
        op("house_door_01", -14, -2, 3),
        op("house_door_01", -2, -2, 3),
        op("house_door_01", 9, -2, 3),
        // the studio glass into the hall, on the wall line
        op("house_window_01", -5, 4, 0),
    ],
    rooms: [
        room(-17, -12, 17, -2, "lobby"),
        room(-17, -2, -5, 12, "studio"),
        room(-5, -2, 6, 6, "hall"),
        room(-5, 6, 6, 12, "vault"),
        room(6, -2, 17, 12, "generator"),
    ],
};

/** The signals vault's door (vault_door_bathhouse: only the puzzle opens it; slides east into the wall). */
export const RADIO_VAULT_DOOR = { type: "vault_door_bathhouse", pos: { x: 0.5, y: 6 }, ori: 1 } as const;
export const RADIO_PUZZLE = "rebirth_radio";
/** The frequency switches (their floor plates' colours) and the code: yellow (studio), red (hall), blue (generator). */
export const RADIO_SWITCHES = [
    { label: "yellow", x: -7, y: 10.95, ori: 0 },
    { label: "red", x: -3.95, y: -0.5, ori: 1 },
    { label: "blue", x: 15.95, y: 9, ori: 3 },
] as const;
export const RADIO_CODE: readonly string[] = ["yellow", "red", "blue"];

export const RADIO_ART: RoofedBuildingArt = layoutArt(
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
                { collider: box(-17.5, -12.5, 17.5, 12.5), color: 0x4f6072 },
                // the mast on the roof, white and orange
                { collider: box(-4, 0, 4, 8), color: 0xf4f4f0 },
                { collider: box(-2, 2, 2, 6), color: 0xe0661b },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "stone", collision: [box(-17, -12, 17, 12)] },
                { type: "carpet", collision: [box(-17, -2, -5, 12)] },
                { type: "bunker", collision: [box(-5, -2, 6, 12)] },
            ],
            imgs: [{ sprite: RADIO_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-17, -12, 17, 12), zoomOut: box(-17.5, -12.5, 17.5, 12.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: RADIO_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(RADIO_PUZZLE, RADIO_VAULT_DOOR.type),
        // the transmitters' hum in the hall (the clinic's sound)
        soundEmitters: [
            {
                sound: "ambient_lab_01",
                channel: "ambient",
                pos: { x: 0.5, y: 2 },
                range: { min: 3, max: 10 },
                falloff: 1,
                volume: 0.12,
            },
        ],
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(RADIO_VAULT_DOOR.type, RADIO_VAULT_DOOR.pos.x, RADIO_VAULT_DOOR.pos.y, RADIO_VAULT_DOOR.ori),
            ...RADIO_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            // the transmitter hall: the transmitter rack against the east wall (indestructible, ricochets), loot
            child("table_07", 4.15, 2.05, 1),
            child("loot_tier_2", -1.5, 3),
            child("loot_tier_1", -2, 0.5),
            // the signals vault: a sniper crate against the north wall, level 3 armour, a sniper scope
            child("mil_crate_05", 2.5, 10.25),
            child("loot_tier_airdrop_armor", -3, 9.5),
            child("loot_tier_scopes_sniper", -3, 7.5),
            // the studio: the mixing desk facing the glass, two chairs, the record shelf against the west wall
            child("table_04", -8.5, 4, 1),
            child("chair_02", -11.8, 2.5),
            child("chair_02", -11.8, 5.5),
            child("bookshelf_01", -15.5, 2, 1),
            child("loot_tier_2", -13, 9),
            // the generator room: two power boxes and a propane tank (all explode), an extinguisher, a crate
            child("power_box_01", 7.5, 10.5),
            child("power_box_01", 15.5, 10.5),
            child("propane_01", 15.25, -0.25),
            child("fire_ext_01", 7.5, -0.5),
            child("crate_01", 8.75, 3),
            child("decal_oil_01", 12, 8),
            child("loot_tier_1", 12.5, 4),
            // the lobby: the reception desk and chair, a couch, the soda machine
            child("table_01", 6, -7),
            child("chair_01", 6, -3.75),
            child("couch_02", -6.5, -10),
            child("vending_01", 15.1, -9.8, 3),
            child("loot_tier_1", -12, -6),
            child("loot_tier_1", 11, -7),
            // outside
            child("bush_01", -5, -14.1),
            child("bush_01", 4, -14.1),
        ],
    };
}
