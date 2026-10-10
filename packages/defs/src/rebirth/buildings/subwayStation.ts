// subway_platform_01, the abandoned subway station's underground floor (the owner's wave 3, 2026-10-10: "an abandoned
// subway station entrance: no way in until strong firepower blasts its door, pitch dark inside"; the structure and the
// street kiosk are in subway.ts; docs/research/rebirth-deviations.md "The abandoned subway station"). Authored in the
// structure's frame (+y north; the kiosk's stairs come down through the north wall at x -2..2), 64 x 32:
// - the north band: the ticket hall under the stairs, its fare line of turnstiles (low rails, 3.5-unit lanes) open onto
//   the platform; west of it the maintenance rooms (workshop, pump room) behind breakable wood partitions; east the
//   ticket office (its window onto the hall) and the station master's office;
// - the platform along the track bed (a lower floor drawn as ballast, sleepers and rails), with a derelict train car
//   standing on the track (steel walls, its three doors jammed open, seats inside); both tunnel mouths are caved in
//   (rubble against the end walls);
// - the station master's safe (the hidden room) east of the platform, 10 x 9 inside, behind a sliding steel door in the
//   office's south wall that only the line code opens: a switch in the workshop, the ticket office and the office (a
//   yellow, a red and a blue plate under them, the subway lines' colours) pressed in the order of the note on the
//   station master's floor (survev bathhouse_01's code room, as the radio station's vault).
// The building is unlit (StructureLayerDef.dark: the client's darkness overlay, shots and blasts give brief light).
import type { BuildingChildDef, BuildingDef } from "../../types/index.ts";
import {
    box,
    child,
    floorArtPos,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    roofArtPos,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

/** The underground stairwell's foot (structure frame): the stair box the kiosk's flight comes down (subway.ts). */
export const SUBWAY_STAIR = { box: [-2, 17, 2, 23], downDir: { x: 0, y: -1 } } as const;

/** The derelict car's box (its steel walls' lines) and its door gaps in the north side. */
export const SUBWAY_CAR = {
    min: { x: -18, y: -15 },
    max: { x: 12, y: -8 },
    doors: [
        [-14.5, -10.5],
        [-4.5, -0.5],
        [5.5, 9.5],
    ],
} as const;

/** The platform's edge (the track bed lies south of it) and the track bed's two rails (y). */
export const SUBWAY_PLATFORM_EDGE = -6;
export const SUBWAY_RAILS: readonly number[] = [-13.25, -9.75];

/** The fare line's turnstile cabinets (rail_4, 0.8 x 5, low: bullets pass) across the hall's south edge, x centres. */
export const SUBWAY_TURNSTILES: readonly number[] = [-12.9, -8.6, -4.3, 0, 4.3, 8.6, 12.9];
export const SUBWAY_FARE_LINE_Y = 4;

// 64 x 32 (x -32..32, y -16..16). Doorways 4 units; furniture flush against the walls or 2.6+ clear.
export const SUBWAY_PLATFORM_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -32, y: -16 }, max: { x: 32, y: 16 } },
    material: "concrete",
    walls: [
        // the shell: the stairs' foot in the north wall; the tunnels at both ends of the track bed are caved in
        ...hRun(16, -32.5, 32.5, [[-2, 2]]),
        ...hRun(-16, -32.5, 32.5),
        ...vRun(-32, -15.5, 15.5),
        ...vRun(32, -15.5, 15.5),
        // the maintenance block's platform wall (the workshop door) and the east block's (the safe's sliding door)
        ...hRun(4, -31.5, -13.5, [[-27.5, -23.5]]),
        ...hRun(4, 13.5, 31.5, [[23.5, 27.5]]),
        // workshop | pump room | hall: breakable wood partitions (the owner, 2026-10-10: "a pity: the walls can't be
        // broken"), each with a door
        ...vRun(-23, 4.5, 15.5, [[9.5, 13.5]], "wood"),
        ...vRun(-14, 4.5, 15.5, [[9.5, 13.5]], "wood"),
        // hall | ticket office (its door and the ticket window), ticket office | station master's office (concrete: a
        // code switch stands on it)
        ...vRun(14, 4.5, 15.5, [
            [6, 10],
            [11.5, 15.5],
        ]),
        // (the window low, the door high: the door's swing stays clear of the counter and the cash drawers)
        ...vRun(22, 4.5, 15.5, [[9.5, 13.5]]),
        // the safe: its platform wall and its track-bed wall (the office wall above holds its door)
        ...vRun(21, -5.5, 3.5),
        ...hRun(-6, 20.5, 31.5),
        // the derelict car: steel, its south side against the station wall, three doors jammed open on the platform side
        ...hRun(SUBWAY_CAR.min.y, -18.5, 12.5, [], "metal"),
        ...hRun(SUBWAY_CAR.max.y, -18.5, 12.5, SUBWAY_CAR.doors, "metal"),
        ...vRun(SUBWAY_CAR.min.x, -14.5, -8.5, [], "metal"),
        ...vRun(SUBWAY_CAR.max.x, -14.5, -8.5, [], "metal"),
        // the stairwell below the kiosk: its long sides from the wall line to the top end, a closer across that end
        ...vRun(-2.5, 16, 23),
        ...vRun(2.5, 16, 23),
        ...hRun(23.5, -3, 3),
    ],
    openings: [
        op("house_door_01", -27.5, 3.75, 3),
        op("house_door_01", -23.25, 9.5, 0),
        op("house_door_01", -14.25, 9.5, 0),
        op("house_door_01", 14.25, 11.5, 0),
        // the ticket window onto the hall, on the wall line
        op("house_window_01", 14, 8, 0),
        op("house_door_01", 22.25, 13.5, 2),
    ],
    rooms: [
        room(-32, -16, 32, SUBWAY_PLATFORM_EDGE, "trackbed"),
        room(SUBWAY_CAR.min.x, SUBWAY_CAR.min.y, SUBWAY_CAR.max.x, SUBWAY_CAR.max.y, "car"),
        room(-32, SUBWAY_PLATFORM_EDGE, 21, 4, "platform"),
        room(-14, 4, 14, 16, "hall"),
        room(-32, 4, -23, 16, "workshop"),
        room(-23, 4, -14, 16, "pump"),
        room(14, 4, 22, 16, "ticket"),
        room(22, 4, 32, 16, "office"),
        room(21, -6, 32, 4, "safe"),
    ],
    // the stairwell's foot, outside the shell (its flight drawn from below)
    outdoor: [room(-3, 16, 3, 24, "stairwell")],
};

/** The safe's door (vault_door_bathhouse: only the puzzle opens it; slides east into the office's south wall). */
export const SUBWAY_SAFE_DOOR = { type: "vault_door_bathhouse", pos: { x: 27.5, y: 4 }, ori: 1 } as const;
export const SUBWAY_PUZZLE = "rebirth_subway";
/** The line code's switches (their floor plates' colours): workshop yellow, ticket office red, office blue. */
export const SUBWAY_SWITCHES = [
    { label: "yellow", x: -26.8, y: 14.95, ori: 0 },
    { label: "red", x: 21.05, y: 14.95, ori: 0 },
    { label: "blue", x: 30.95, y: 8.05, ori: 3 },
] as const;
export const SUBWAY_CODE: readonly string[] = ["red", "yellow", "blue"];
/** Where the note with the code lies: on the station master's floor before the desk. */
export const SUBWAY_NOTE = { x: 25.5, y: 7 } as const;

export const SUBWAY_PLATFORM_ART: RoofedBuildingArt = layoutArt(
    SUBWAY_PLATFORM_LAYOUT,
    "map-building-subway-platform-floor-01.img",
    "map-building-subway-platform-ceiling-01.img",
);

/** The dark roof's tint (survev's bunker ceilings, as the military basement's). */
const DARK_ROOF_TINT = 0x5f5f5f;

const turnstiles = (): BuildingChildDef[] => SUBWAY_TURNSTILES.map((x) => child("rail_4", x, SUBWAY_FARE_LINE_Y));

export function subwayPlatform(known: (id: string) => boolean): BuildingDef {
    const L = SUBWAY_PLATFORM_LAYOUT;
    const station = box(-32, -16, 32, 16);
    return {
        type: "building",
        map: { display: false, shapes: [] },
        terrain: { grass: true, beach: false },
        zIdx: 0,
        floor: {
            surfaces: [
                { type: "tile", collision: [station] },
                { type: "stone", collision: [box(-32, -16, 32, SUBWAY_PLATFORM_EDGE)] },
                { type: "container", collision: [box(-18, -15, 12, -8), box(21, -6, 32, 4)] },
                { type: "warehouse", collision: [box(-32, 4, -14, 16)] },
                { type: "carpet", collision: [box(22, 4, 32, 16)] },
                // the stairwell's foot: the doorway strip between the wall line and the stair box
                { type: "bunker", collision: [box(-2, 16, 2, 17)] },
            ],
            imgs: [{ sprite: SUBWAY_PLATFORM_ART.floor, pos: floorArtPos(L), scale: 0.5, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [
                { zoomIn: station },
                // the stairwell, so the doorway strip and the flight's foot are under the roof (and dark) too
                { zoomIn: box(-2, 16, 2, 23) },
            ],
            vision: { dist: 7, width: 3, linger: 0.5, fadeRate: 6 },
            imgs: [
                {
                    sprite: SUBWAY_PLATFORM_ART.ceiling,
                    pos: roofArtPos(L),
                    scale: 0.5,
                    alpha: 1,
                    tint: DARK_ROOF_TINT,
                },
            ],
        },
        puzzle: rebirthPuzzle(SUBWAY_PUZZLE, SUBWAY_SAFE_DOOR.type),
        // the pump room's low hum in the dark (the clinic's and the radio station's ambient_lab_01)
        soundEmitters: [
            {
                sound: "ambient_lab_01",
                channel: "ambient",
                pos: { x: -18.5, y: 10 },
                range: { min: 3, max: 10 },
                falloff: 1,
                volume: 0.1,
            },
        ],
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(SUBWAY_SAFE_DOOR.type, SUBWAY_SAFE_DOOR.pos.x, SUBWAY_SAFE_DOOR.pos.y, SUBWAY_SAFE_DOOR.ori),
            ...SUBWAY_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            ...turnstiles(),
            // the ticket hall: two ticket machines either side of the stairs' foot, loot
            child("vending_01", -8, 14.1),
            child("vending_01", 8, 14.1),
            child("loot_tier_1", -8, 9),
            child("loot_tier_2", 8, 9),
            // the platform: a row of columns clear of the fare line and the edge, bins against two of them, loot
            child("house_column_1", -26, -2.5),
            child("house_column_1", -16, -2.5),
            child("house_column_1", -6, -2.5),
            child("house_column_1", 4, -2.5),
            child("house_column_1", 14, -2.5),
            child("barrel_02", -23.25, -3),
            child("barrel_02", 6.75, -3),
            child("vending_01", 19.1, 1.8, 3),
            child("loot_tier_1", -21, 0.5),
            child("loot_tier_2", -1, 0.5),
            child("loot_tier_1", 17, -3),
            // the derelict car: seats along its south wall between the doors, loot in the aisle
            child("couch_01", -13, -13),
            child("couch_02", -2.5, -13),
            child("couch_02", 8.5, -13),
            child("loot_tier_2", -8, -10),
            child("loot_tier_1", 2.5, -10),
            // the track bed: rubble heaped where the tunnels caved in, a crate fallen off a work train, loot
            // (stone_01 only: survev's big stone_03 lies in water)
            child("stone_01", -29.9, -13.9),
            child("stone_01", -29.9, -10.7),
            child("stone_01", -29.9, -7.5),
            child("stone_01", -27.13, -12.3),
            child("stone_01", -27.13, -9.1),
            child("stone_01", -24.36, -13.9),
            child("stone_01", 29.9, -13.9),
            child("stone_01", 27.13, -12.3),
            child("stone_01", 24.36, -13.9),
            child("crate_01", 15, -13.25),
            child("loot_tier_1", -21.5, -10),
            child("loot_tier_2", 20, -9),
            // the workshop: two lockers against the west wall, the workbench (walk-under), an oil drum in the corner
            child("locker_01", -30.75, 14, 1),
            child("locker_03", -30.75, 11, 1),
            child("table_01", -26.5, 11),
            child("barrel_01", -29.75, 6.25),
            child("loot_tier_1", -26, 7.5),
            // the pump room: a bank of power boxes along the north wall (they explode), the ammunition crate
            child("power_box_01", -21.5, 14.5),
            child("power_box_01", -19.5, 14.5),
            child("power_box_01", -17.5, 14.5),
            child("power_box_01", -15.5, 14.5),
            child("crate_06", -20.25, 5.6),
            child("decal_oil_01", -18.5, 10),
            child("loot_tier_1", -18.5, 10.5),
            // the ticket office: the counter (walk-under) at the window, the cash drawers against the east wall
            child("table_01", 16.5, 8, 1),
            child("drawers_01", 20.1, 7, 3),
            child("loot_tier_1", 18, 12.5),
            // the station master's office: the desk (walk-under), the records shelf against the east wall
            child("table_01", 26.5, 11),
            child("bookshelf_01", 30.5, 12, 1),
            child("loot_tier_2", 25, 13.5),
            // the safe: a safe in the corner, a sniper crate against the west wall, a deposit box against the east wall,
            // the M870 mount, level 3 armour and a weapon on the floor
            child("safe_01", 30.25, -4.15, 2),
            child("mil_crate_05", 22.75, -2.8, 1),
            child("deposit_box_02", 30.35, -0.5, 3),
            child("gun_mount_01", 29.25, 2.6),
            child("loot_tier_airdrop_armor", 27, -1.5),
            child("loot_tier_2", 27, 1),
        ],
    };
}
