// The radar base's operations building (작전동; the owner's wave 3, 2026-10-10; docs/research/rebirth-deviations.md
// "The radar base"): east of the dome. A lobby along the south front leads to the operations room (the plotting table,
// two consoles under the north window) and the briefing room (table and screen); behind the briefing room lies the
// crypto vault, whose sliding door in the operations room's east wall opens on the duty code: a switch in the lobby, the
// operations room and the briefing room (a coloured plate under each), pressed in the order of the note on the briefing
// room's floor (survev bathhouse_01's code room, as the radio station's vault). Inside: an AK locker, the QBB-97 on its
// mount, a sniper crate, the cipher deposit boxes, level 3 armour and vault-grade floor loot. The lobby's and the
// briefing room's partitions are breakable wood (the owner, 2026-10-10); the vault's walls are concrete.
import { type Box, fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "../military/part.ts";

/** The operations building's floor box (compound frame). */
export const RADAR_OPS_BOX: Box = [16, -2, 45, 28];

/** The crypto vault's door (vault_door_bathhouse: only the puzzle opens it; slides 3.75 north into the wall). */
export const RADAR_VAULT_DOOR = { type: "vault_door_bathhouse", hinge: { x: 32, y: 24 }, ori: 2 } as const;
export const RADAR_PUZZLE = "rebirth_radar_ops";
/** The duty code's switches (compound frame; their floor plates' colours) and the code: blue, yellow, red. */
export const RADAR_SWITCHES = [
    { label: "yellow", x: 26, y: -0.95, ori: 0 },
    { label: "red", x: 17.05, y: 9, ori: 1 },
    { label: "blue", x: 43.95, y: 7.05, ori: 3 },
] as const;
export const RADAR_CODE: readonly string[] = ["blue", "yellow", "red"];
/** Where the note with the code lies (compound frame): on the briefing room's floor by the door. */
export const RADAR_NOTE = { x: 35, y: 8 } as const;

export const RADAR_OPS: MilitaryPart = fromWorld({
    id: "radar_ops_01",
    layer: 0,
    parent: "radar_base_01",
    centre: { x: 30.5, y: 13 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: 16, y: -2 }, max: { x: 45, y: 28 } },
        material: "concrete",
        walls: [
            // south: a window, the main door, a window; north: the operations room's window between its consoles
            ...hRun(-2, 15.5, 45.5, [
                [19, 23],
                [28, 32],
                [37, 41],
            ]),
            ...hRun(28, 15.5, 45.5, [[22, 26]]),
            // west: the lobby's side door toward the dome, the operations room's window; east: a lobby window
            ...vRun(16, -1.5, 27.5, [
                [0, 4],
                [12, 16],
            ]),
            ...vRun(45, -1.5, 27.5, [[0, 4]]),
            // lobby | operations room and briefing room, operations | briefing (breakable wood)
            ...hRun(
                6,
                16,
                45,
                [
                    [20, 24],
                    [33, 37],
                ],
                "wood",
            ),
            ...vRun(32, 6.5, 16.5, [], "wood"),
            // the crypto vault (12 x 10 inside): concrete; its door slides north into the wall y 24..27.75
            ...hRun(17, 32, 45),
            ...vRun(32, 17, 27.5, [[20, 24]]),
        ],
        openings: [
            op("house_door_01", 28, -2.25, 3),
            op("house_window_01", 21, -2.25, 3),
            op("house_window_01", 39, -2.25, 3),
            op("house_window_01", 24, 28.25, 1),
            op("house_door_01", 15.75, 0, 0),
            op("house_window_01", 15.75, 14, 0),
            op("house_window_01", 45.25, 2, 0),
            op("house_door_01", 20, 6, 3),
            op("house_door_01", 33, 6, 3),
        ],
        rooms: [
            room(16, -2, 45, 6, "ops_lobby"),
            room(16, 6, 32, 28, "ops_room"),
            room(32, 6, 45, 17, "ops_briefing"),
            room(32, 17, 45, 28, "ops_vault"),
        ],
    },
    puzzle: { name: RADAR_PUZZLE, door: RADAR_VAULT_DOOR.type },
    props: [
        p(RADAR_VAULT_DOOR.type, RADAR_VAULT_DOOR.hinge.x, RADAR_VAULT_DOOR.hinge.y, RADAR_VAULT_DOOR.ori, {
            wallLike: true,
        }),
        ...RADAR_SWITCHES.map((sw) => p("switch_03", sw.x, sw.y, sw.ori, { piece: sw.label })),
        // the lobby: a cabinet between the two inner doors, the soda machine in the south-east corner, floor loot
        p("drawers_01", 27, 4.1),
        p("vending_01", 42.8, -0.1, 2),
        p("loot_tier_2", 22, 2),
        p("loot_tier_2", 37.5, 2),
        // the operations room: the plotting table in the middle, two consoles flush in the north corners
        p("table_02", 24, 15),
        p("control_panel_02", 18.75, 25.8),
        p("control_panel_02", 29.25, 25.8),
        p("loot_tier_2", 24, 21),
        p("loot_tier_1", 29, 9.5),
        p("loot_tier_2", 19.5, 9.5),
        // the briefing room: the table facing the screen on the vault wall, floor loot
        p("table_01", 37.7, 11.4),
        p("screen_01", 37.7, 16.25),
        p("loot_tier_2", 42.5, 13),
        p("loot_tier_2", 35, 14.5),
        // the crypto vault: the AK locker and the QBB-97 mount along the north wall, the sniper crate against the east
        // wall, the cipher deposit boxes on the south wall, level 3 armour and vault-grade floor loot
        p("locker_03", 34, 26.75),
        p("gun_mount_03", 37.75, 26.6),
        p("mil_crate_05", 43.25, 20.2, 1),
        p("deposit_box_02", 35, 18.65, 2),
        p("loot_tier_vault_floor", 38, 22),
        p("loot_tier_airdrop_armor", 35.5, 22.5),
    ],
    surfaces: [
        { type: "tile", boxes: [RADAR_OPS_BOX] },
        { type: "carpet", boxes: [[32, 6, 45, 17]] },
        { type: "bunker", boxes: [[32, 17, 45, 28]] },
    ],
    zoom: [fullZoom(RADAR_OPS_BOX)],
    images: [
        { sprite: "map-building-radar-ops-floor-01.img", kind: "floor", centre: { x: 30.5, y: 13 }, size: [30, 31] },
        {
            sprite: "map-building-radar-ops-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 30.5, y: 13 },
            size: [30, 31],
        },
    ],
    mapShapes: [{ box: [15.5, -2.5, 45.5, 28.5], color: 0x56626a }],
});
