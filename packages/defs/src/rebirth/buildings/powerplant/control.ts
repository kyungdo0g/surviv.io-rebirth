// power_plant_control_01, the power plant's control building (power_plant_01; the owner's wave 3, 2026-10-10;
// docs/research/rebirth-deviations.md "The power plant"): a concrete block 35 x 27 inside south of the plant's road.
// North: the control room (consoles that explode) and, behind its east wall, the strongroom, the plant's armoury: its
// sliding steel door (vault_door_bathhouse) opens on the dispatch code, three switches on the control room's walls over
// a green, a red and a yellow plate, pressed in the order of the note on the shift manager's desk in the middle office
// (green, red, yellow; survev bathhouse_01's code room). The strongroom (12 x 11 inside) holds a weapons crate
// (mil_crate_05), a police locker, an M870 mount, a Deagle case, level 3 armour and floor loot. South: a corridor
// with a door at each end and three offices off it; the corridor and office partitions are breakable wood (the
// owner, 2026-10-10), the strongroom's walls concrete. Authored in the plant's frame (origin the compound centre).
import { type Box, fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "../military/part.ts";

/** The building's floor box (plant frame). */
export const PLANT_CONTROL_BOX: Box = [-18, -35, 17, -8];
/** The strongroom (plant frame): its box and its door (only the puzzle opens it; slides south into the wall). */
export const PLANT_STRONGROOM: Box = [4, -20, 17, -8];
export const PLANT_STRONGROOM_DOOR = { type: "vault_door_bathhouse", hinge: { x: 4, y: -16 }, ori: 0 } as const;
export const PLANT_PUZZLE = "rebirth_power_plant";
/** The dispatch switches (their floor plates' colours, plant frame) and the code. */
export const PLANT_SWITCHES = [
    { label: "green", x: -16.95, y: -10, ori: 1 },
    { label: "yellow", x: 2, y: -9.05, ori: 0 },
    { label: "red", x: 2.95, y: -18, ori: 3 },
] as const;
export const PLANT_CODE: readonly string[] = ["green", "red", "yellow"];
/** Where the code note lies on the shift manager's floor (plant frame). */
export const PLANT_CODE_NOTE = { x: -1, y: -28 } as const;

const [X0, Y0, X1, Y1] = PLANT_CONTROL_BOX;
const CX = (X0 + X1) / 2;
const CY = (Y0 + Y1) / 2;

export const PLANT_CONTROL: MilitaryPart = fromWorld({
    id: "power_plant_control_01",
    layer: 0,
    parent: "power_plant_01",
    centre: { x: CX, y: CY },
    zIdx: 1,
    layout: {
        bounds: { min: { x: X0, y: Y0 }, max: { x: X1, y: Y1 } },
        material: "concrete",
        walls: [
            // north: the control room's window and its yard door
            ...hRun(Y1, X0 - 0.5, X1 + 0.5, [
                [-15.5, -11.5],
                [-4, 0],
            ]),
            // south: the west and middle offices' windows (the east office's shelf stands on its south wall)
            ...hRun(Y0, X0 - 0.5, X1 + 0.5, [
                [-11.5, -7.5],
                [0, 4],
            ]),
            // west: the west office's window, the corridor door, the control room's window
            ...vRun(X0, Y0 + 0.5, Y1 - 0.5, [
                [-32.5, -28.5],
                [-24.5, -20.5],
                [-16, -12],
            ]),
            // east: the east office's window, the corridor door
            ...vRun(X1, Y0 + 0.5, Y1 - 0.5, [
                [-32.5, -28.5],
                [-24.5, -20.5],
            ]),
            // control room | corridor (wood), strongroom | corridor (concrete)
            ...hRun(-20, X0 + 0.5, 3.5, [[-12, -8]], "wood"),
            ...hRun(-20, 3.5, X1 - 0.5),
            // control room | strongroom (concrete): the door slides south into the wall below its gap
            ...vRun(4, -19.5, Y1 - 0.5, [[-16, -12]]),
            // corridor | offices, and the offices' partitions (wood)
            ...hRun(
                -25,
                X0 + 0.5,
                X1 - 0.5,
                [
                    [-15, -11],
                    [-3, 1],
                    [8, 12],
                ],
                "wood",
            ),
            ...vRun(-6.5, Y0 + 0.5, -25.5, [], "wood"),
            ...vRun(5, Y0 + 0.5, -25.5, [], "wood"),
        ],
        openings: [
            op("house_window_01", -13.5, Y1 + 0.25, 1),
            op("house_door_01", -4, Y1 + 0.25, 3),
            op("house_window_01", -9.5, Y0 - 0.25, 3),
            op("house_window_01", 2, Y0 - 0.25, 3),
            op("house_window_01", X0 - 0.25, -30.5, 0),
            op("house_door_01", X0 - 0.25, -24.5, 0),
            op("house_window_01", X0 - 0.25, -14, 0),
            op("house_window_01", X1 + 0.25, -30.5, 0),
            op("house_door_01", X1 + 0.25, -24.5, 0),
            op("house_door_01", -12, -20, 3),
            op("house_door_01", -15, -25, 3),
            op("house_door_01", -3, -25, 3),
            op("house_door_01", 8, -25, 3),
        ],
        rooms: [
            room(X0, -20, 4, Y1, "control"),
            room(4, -20, X1, Y1, "strongroom"),
            room(X0, -25, X1, -20, "corridor"),
            room(X0, Y0, -6.5, -25, "office"),
            room(-6.5, Y0, 5, -25, "manager"),
            room(5, Y0, X1, -25, "office"),
        ],
    },
    props: [
        { ...p("vault_door_bathhouse", 4, -16, 0), wallLike: true },
        ...PLANT_SWITCHES.map((s) => p("switch_03", s.x, s.y, s.ori, { piece: s.label })),
        // the control room: the main console on the north wall, the grid console in the south-west corner (both
        // explode), floor loot (furniture flush or 2.6+ clear; nothing in the doors' swings)
        p("control_panel_01", -8.25, -10.2),
        p("control_panel_04", -15.25, -17.8),
        // the shift's two security lockers against the corridor wall, clear of its door's swing
        p("locker_02", -5, -18.75, 2),
        p("locker_02", -2, -18.75, 2),
        p("loot_tier_2", -6, -15),
        p("loot_tier_1", -1, -17),
        // the strongroom: a weapons crate and a police locker along the north wall, an M870 mount and a Deagle case
        // along the south wall, level 3 armour and floor loot between them
        p("mil_crate_05", 7.2, -9.75),
        p("locker_02", 11.4, -9.25),
        p("gun_mount_01", 6.75, -18.6, 2),
        p("case_01", 11.25, -17.9),
        p("loot_tier_airdrop_armor", 10.5, -13.5),
        p("loot_tier_2", 14.5, -13),
        // the west office: a bookshelf along the south wall, a locker in the north-east corner
        p("bookshelf_01", -14, -33.5),
        p("locker_01", -8.5, -25.95, 2),
        p("loot_tier_1", -12, -29.5),
        // the shift manager's office: drawers in the south-west corner, the code note on the floor
        p("drawers_01", -3.5, -33.4),
        p("loot_tier_2", 1.5, -30),
        // the east office: a bookshelf along the south wall, a locker in the north-east corner
        p("bookshelf_01", 13, -33.5),
        p("locker_01", 15, -25.95, 2),
        p("loot_tier_1", 9, -30),
    ],
    surfaces: [
        { type: "stone", boxes: [PLANT_CONTROL_BOX] },
        { type: "carpet", boxes: [[X0, Y0, X1, -25]] },
        { type: "bunker", boxes: [PLANT_STRONGROOM] },
    ],
    zoom: [fullZoom(PLANT_CONTROL_BOX)],
    puzzle: { name: PLANT_PUZZLE, door: PLANT_STRONGROOM_DOOR.type },
    images: [
        {
            sprite: "map-building-powerplant-control-floor-01.img",
            kind: "floor",
            centre: { x: CX, y: CY },
            size: [X1 - X0 + 1, Y1 - Y0 + 1],
        },
        {
            sprite: "map-building-powerplant-control-ceiling-01.img",
            kind: "ceiling",
            centre: { x: CX, y: CY },
            size: [X1 - X0 + 1, Y1 - Y0 + 1],
        },
    ],
    mapShapes: [
        { box: [X0 - 0.5, Y0 - 0.5, X1 + 0.5, Y1 + 0.5], color: 0xa58a62 },
        { box: [PLANT_STRONGROOM[0] + 2, PLANT_STRONGROOM[1] + 2, X1 - 2, Y1 - 2], color: 0x5c4a35 },
    ],
});
