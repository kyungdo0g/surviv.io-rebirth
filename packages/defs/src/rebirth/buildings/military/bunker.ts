// military_bunker_01, the military base's basement (rebirth/buildings/military/; the owner: "지하실도 좀 규모가 크게"):
// 72 x 50, a 3 x 2 grid of rooms on one straight east-west corridor (the Spine). The north band lies under the north
// row (Barracks under the infirmary, Command under the HQ, the Magazine under the armory); the south band holds the
// Depot, the vault complex under the parade ground (a checkpoint hall, the vault in a ring corridor) and the motor pool
// at the foot of the garage ramp. Five stairs come down into it (structure.ts), one of them through the sapper tunnel.
// The Spine's bulkheads are automatic sliding doors (lab_door_01), never locked: they are the basement's own children.
import { fromWorld, hRun, type MilitaryPart, op, type PartImage, p, room, vRun } from "./part.ts";

/** The dark roofs over underground rooms: drawn at 8 px per unit, tinted like survev's bunker ceilings. */
export const MILITARY_DARK_ROOF = { ppu: 8, tint: 0x5f5f5f } as const;

const dark = (sprite: string, x: number, y: number, w: number, h: number): PartImage => ({
    sprite,
    kind: "ceiling",
    centre: { x, y },
    size: [w, h],
    ...MILITARY_DARK_ROOF,
});

/** One "stairs seen from below" image (6 x 7.5, going down south) turned for each doored stairwell. */
const STAIRS_BELOW = "map-building-milbase-stairs-below-01.img";

export const MILITARY_BUNKER: MilitaryPart = fromWorld({
    id: "military_bunker_01",
    layer: 1,
    parent: null,
    centre: { x: 0, y: 0 },
    zIdx: 0,
    layout: {
        bounds: { min: { x: -36, y: -26 }, max: { x: 36, y: 24 } },
        material: "concrete",
        walls: [
            // the shell: the S1 and S2 bottoms in the north wall, the tunnel's mouth in the south wall, S3 at the
            // Spine's west end, the ramp (9 wide, no door) in the east wall
            ...hRun(24, -36.5, 36.5, [
                [-2, 2],
                [22, 26],
            ]),
            ...hRun(-26, -36.5, 36.5, [[-32, -28]]),
            ...vRun(-36, -25.5, 23.5, [[5, 9]]),
            ...vRun(36, -25.5, 23.5, [[-15, -6]]),
            // the north band | the Spine: the Barracks' doors, Command's lab doors, the Magazine's door
            ...hRun(10, -35.5, 35.5, [
                [-31, -27],
                [-21, -17],
                [-9, -5],
                [5, 9],
                [20, 24],
            ]),
            // the Spine | the south band: the Depot's door and 6-wide loading bay, the checkpoint's archways, the motor
            // pool's 14-wide mouth
            ...hRun(4, -35.5, 35.5, [
                [-32, -28],
                [-23, -17],
                [-11, -7],
                [7, 11],
                [17, 31],
            ]),
            // the column lines: Depot | ring and ring | motor pool doors, the Spine's bulkheads, Command's side doors
            ...vRun(-14, -25.5, 23.5, [
                [-17, -13],
                [5, 9],
                [15, 19],
            ]),
            ...vRun(14, -25.5, 23.5, [
                [-17, -13],
                [5, 9],
                [15, 19],
            ]),
            // the stairwells underground: the long sides from the wall line to the top end, a closer across that end
            ...vRun(-2.5, 24, 31),
            ...vRun(2.5, 24, 31),
            ...hRun(31.5, -3, 3),
            ...vRun(21.5, 24, 31),
            ...vRun(26.5, 24, 31),
            ...hRun(31.5, 21, 27),
            ...hRun(4.5, -43, -36),
            ...hRun(9.5, -43, -36),
            ...vRun(-43.5, 4, 10),
            ...hRun(-15.5, 36.5, 44.5),
            ...hRun(-5.5, 36.5, 44.5),
            ...vRun(44, -15, -6),
            // the sapper stair and the tunnel share their sides (x -32.5 / -27.5) from the stair's top to the shell
            ...vRun(-32.5, -48, -26.5),
            ...vRun(-27.5, -48, -26.5),
            ...hRun(-48.5, -33, -27),
        ],
        openings: [
            // the stair bottoms: steel doors 0.75 past each stair's bottom edge (inside the mask, so on the basement's
            // floor; a wooden door there would not switch layers)
            op("house_door_02", -2, 24.25, 3),
            op("house_door_02", 22, 24.25, 3),
            op("house_door_02", -36.25, 5, 0),
            op("house_door_02", -32, -41.25, 3),
            // the tunnel's mouth into the Depot: an automatic sliding door (it chimes when a sapper comes through)
            op("lab_door_01", -28, -26, 1),
            op("house_door_01", -31, 10, 3),
            op("house_door_01", -21, 10, 3),
            op("house_door_02", 20, 10, 3),
            op("house_door_01", -32, 4, 3),
            // the Spine's bulkheads
            op("lab_door_01", -14, 5, 0),
            op("lab_door_01", 14, 5, 0),
            op("house_door_02", -14, -17, 0),
            op("house_door_02", 14, -17, 0),
        ],
        rooms: [
            room(-36, 10, -14, 24, "barracks"),
            room(-36, 4, 36, 10, "spine"),
            room(-36, -26, -14, 4, "depot"),
            room(-14, -6, 14, 4, "checkpoint"),
            room(-14, -26, -8, -6, "ring"),
            room(8, -26, 14, -6, "ring"),
            room(-8, -26, 8, -20, "ring"),
            room(14, -26, 36, 4, "motorpool"),
        ],
        outdoor: [room(-32.5, -42, -27.5, -26, "tunnel")],
    },
    props: [
        // the Spine
        p("fire_ext_01", 0, 5.6),
        p("decal_light_01", -24, 7),
        p("decal_light_02", 0, 7),
        p("decal_light_03", 25, 7),
        // the Barracks: three bunks, two footlockers (a quarter of them the AK locker), a washroom corner, a table
        p("bed_sm_01", -24.6, 19.9),
        p("bed_sm_01", -21.4, 19.9),
        p("bed_sm_01", -18.2, 19.9),
        p({ locker_01: 3, locker_03: 1 }, -25.5, 11.4, 2),
        p({ locker_01: 3, locker_03: 1 }, -15.3, 12.4, 3),
        p("toilet_01", -34.3, 22),
        p("table_01", -29, 18.5),
        p("chair_01", -32.75, 18.5, 1),
        p("loot_tier_1", -21, 13.5),
        // the Depot: pallet rows (indestructible), crates, a cabinet (no rack_01: its tier_revolvers would bring
        // survev's desert-only SW500 to these maps)
        p("crate_05", -30, -5),
        p("crate_05", -30, -11),
        p("crate_05", -22, -8),
        p("crate_05", -22, -14),
        p("crate_06", -17.5, -1.5, 1),
        p("drawers_01", -33, -23.6),
        p("loot_tier_2", -26, -21.5),
        // the checkpoint hall: the guard desk; the open vault door lands at x -3.5..-1.5, y -5.5..1.5 (kept clear)
        p("table_01", -9, 0),
        p("chair_02", -9, -3.25),
        p("sandbags_01", 7, -2),
        p("decal_camera_01", -13, -5),
        // the vault ring: the generator gallery behind the vault (the power boxes explode); the breach is x -2.5..1.5
        p("power_box_01", -12.5, -24.5),
        p("power_box_01", 12.5, -24.5),
        p("fire_ext_01", 5, -24.4),
        p("decal_camera_01", 13, -25),
        // the motor pool: columns, cover facing the ramp, crates, a barrel
        p("house_column_1", 21, -2),
        p("house_column_1", 29, -2),
        p("house_column_1", 21, -18),
        p("house_column_1", 29, -18),
        p("sandbags_01", 25, -10.5, 1),
        p("crate_01", 17.5, -22.5),
        p("crate_05", 33, 1),
        p("barrel_01", 33.3, -21.5),
        p("decal_oil_01", 29, -8),
        p("decal_oil_03", 19, -12),
        p("decal_oil_05", 31, -23),
        // the tunnel
        p("loot_tier_1", -30, -34, 0, { outside: true }),
        p("decal_light_04", -30, -33, 0, { outside: true }),
    ],
    surfaces: [
        { type: "bunker", boxes: [[-36, -26, 36, 24]] },
        { type: "house", boxes: [[-36, 10, -14, 24]] },
        { type: "warehouse", boxes: [[-36, -26, -14, 4]] },
        { type: "asphalt", boxes: [[14, -26, 36, 4]] },
        { type: "bunker", boxes: [[-32, -42, -28, -26]] },
        // the doorway strips between the wall line and each stair box
        {
            type: "bunker",
            boxes: [
                [-2, 24, 2, 25],
                [22, 24, 26, 25],
                [-37, 5, -36, 9],
            ],
        },
        { type: "asphalt", boxes: [[36, -15, 36.5, -6]] },
    ],
    zoom: [
        { zoomIn: [-36, -26, 36, 24] },
        { zoomIn: [-36, -26, -14, 4], zoom: 36 },
        { zoomIn: [14, -26, 36, 4], zoom: 36 },
        { zoomIn: [-32, -42, -28, -26] },
        // the stairwells, so the doorway strip between the wall and the stair box is indoors too
        { zoomIn: [-2, 24, 2, 31] },
        { zoomIn: [22, 24, 26, 31] },
        { zoomIn: [-43, 5, -36, 9] },
        { zoomIn: [36, -15, 43.5, -6] },
    ],
    images: [
        // the floor in two halves (each image at most 72 units a side) and the tunnel
        {
            sprite: "map-building-milbase-bunker-floor-01.img",
            kind: "floor",
            centre: { x: -18.25, y: -1 },
            size: [36.5, 51],
        },
        {
            sprite: "map-building-milbase-bunker-floor-02.img",
            kind: "floor",
            centre: { x: 18.25, y: -1 },
            size: [36.5, 51],
        },
        {
            sprite: "map-building-milbase-bunker-tunnel-01.img",
            kind: "floor",
            centre: { x: -30, y: -34.25 },
            size: [6, 15.5],
        },
        // the stairs seen from below (the flight, its side walls, the closer at its top, the doorway strip), turned so
        // its bottom faces the basement: S1 and S2 (bottom south), S3 (rot 3, a quarter turn anticlockwise: bottom
        // east), S5 (rot 2: bottom north)
        { sprite: STAIRS_BELOW, kind: "floor", centre: { x: 0, y: 28.25 }, size: [6, 7.5] },
        { sprite: STAIRS_BELOW, kind: "floor", centre: { x: 24, y: 28.25 }, size: [6, 7.5] },
        { sprite: STAIRS_BELOW, kind: "floor", centre: { x: -40.25, y: 7 }, size: [6, 7.5], rot: 3 },
        { sprite: STAIRS_BELOW, kind: "floor", centre: { x: -30, y: -45.25 }, size: [6, 7.5], rot: 2 },
        // the vehicle ramp seen from below (bottom west), its rails and closer
        {
            sprite: "map-building-milbase-ramp-below-01.img",
            kind: "floor",
            centre: { x: 40.25, y: -10.5 },
            size: [8.5, 11],
        },
        dark("map-building-milbase-bunker-ceiling-01.img", -18.25, -1, 36.5, 51),
        dark("map-building-milbase-bunker-ceiling-02.img", 18.25, -1, 36.5, 51),
        dark("map-building-milbase-bunker-ceiling-03.img", -30, -34.25, 6, 15.5),
    ],
    mapShapes: [],
});

/** The vault door's hinge, ori, closed and open boxes (vault_door_main: 2 x 7 from the hinge, opens to ori + 1). */
export const MILITARY_VAULT_DOOR = {
    hinge: { x: -3.5, y: -5.5 },
    ori: 3,
    closed: [-3.5, -7.5, 3.5, -5.5],
    open: [-3.5, -5.5, -1.5, 1.5],
} as const;

// the nested rooms: child buildings of the basement (zIdx 1), each with its own floor, dark roof and zoomIn

export const MILITARY_COMMAND: MilitaryPart = fromWorld({
    id: "military_bunker_command_01",
    layer: 1,
    parent: "military_bunker_01",
    centre: { x: 0, y: 17 },
    zIdx: 1,
    // Command (under the HQ): its lockdown panel (control_panel_07sv, indestructible) closes and locks its four lab
    // doors for 10 s (40 s cooldown); the HQ stairs' steel door is the basement's, so it never locks
    layout: {
        bounds: { min: { x: -14, y: 10 }, max: { x: 14, y: 24 } },
        material: "concrete",
        walls: [],
        openings: [
            op("lab_door_01", -9, 10, 3),
            op("lab_door_01", 5, 10, 3),
            op("lab_door_01", -14, 15, 0),
            op("lab_door_01", 14, 15, 0),
        ],
        rooms: [room(-14, 10, 14, 24, "command")],
    },
    props: [
        p("table_05", 0, 16),
        p("chair_02", -4, 12),
        p("chair_02", 4, 12),
        p("chair_02", -10.6, 16),
        p("chair_02", 10.6, 16),
        p("screen_01", -8, 23.15),
        p("control_panel_07sv", 6, 21.6),
        p("locker_02", -12.75, 21, 1),
        p({ deposit_box_01: 1, deposit_box_02: 1 }, 10.75, 22.3),
        p("loot_tier_2", -5, 20.5),
        p("decal_camera_01", -13, 23),
    ],
    surfaces: [{ type: "tile", boxes: [[-14, 10, 14, 24]] }],
    zoom: [{ zoomIn: [-13.5, 10.5, 13.5, 23.5] }],
    images: [
        { sprite: "map-building-milbase-command-floor-01.img", kind: "floor", centre: { x: 0, y: 17 }, size: [29, 15] },
        dark("map-building-milbase-command-ceiling-01.img", 0, 17, 29, 15),
    ],
    mapShapes: [],
});

export const MILITARY_MAGAZINE: MilitaryPart = fromWorld({
    id: "military_bunker_magazine_01",
    layer: 1,
    parent: "military_bunker_01",
    centre: { x: 25, y: 17 },
    zIdx: 1,
    // the Magazine (under the armory): crates of throwables and ammunition
    layout: {
        bounds: { min: { x: 14, y: 10 }, max: { x: 36, y: 24 } },
        material: "concrete",
        walls: [],
        openings: [],
        rooms: [room(14, 10, 36, 24, "magazine")],
    },
    props: [
        p("mil_crate_04", 18, 22.1),
        p("mil_crate_04", 34, 19.5, 1),
        p("crate_04", 32.5, 13),
        p("crate_06", 16.2, 15, 1),
        p("sandbags_02", 24, 18.5),
    ],
    surfaces: [{ type: "container", boxes: [[14, 10, 36, 24]] }],
    zoom: [{ zoomIn: [14.5, 10.5, 35.5, 23.5] }],
    images: [
        {
            sprite: "map-building-milbase-magazine-floor-01.img",
            kind: "floor",
            centre: { x: 25, y: 17 },
            size: [23, 15],
        },
        dark("map-building-milbase-magazine-ceiling-01.img", 25, 17, 23, 15),
    ],
    mapShapes: [],
});

export const MILITARY_VAULT: MilitaryPart = fromWorld({
    id: "military_bunker_vault_01",
    layer: 1,
    parent: "military_bunker_01",
    centre: { x: 0, y: -13 },
    zIdx: 1,
    // the vault (under the parade ground): its bank door (vault_door_main: Interact, 4.1 s, loud, opens once and swings
    // north into the checkpoint as cover) or the stone breach in its south wall (stone_wall_int_4: only a melee weapon
    // that breaks stone, the garage's sledgehammer)
    layout: {
        bounds: { min: { x: -8, y: -20 }, max: { x: 8, y: -6 } },
        material: "metal",
        walls: [
            ...hRun(-6, -8.5, 8.5, [[-3.5, 3.5]], undefined, "metal"),
            ...hRun(-20, -8.5, 8.5, [[-2.5, 1.5]], undefined, "metal"),
            ...vRun(-8, -19.5, -6.5, [], undefined, "metal"),
            ...vRun(8, -19.5, -6.5, [], undefined, "metal"),
        ],
        openings: [],
        rooms: [room(-8, -20, 8, -6, "vault")],
    },
    props: [
        p("vault_door_main", MILITARY_VAULT_DOOR.hinge.x, MILITARY_VAULT_DOOR.hinge.y, MILITARY_VAULT_DOOR.ori, {
            wallLike: true,
            outside: true,
        }),
        p("stone_wall_int_4", -0.5, -20, 1, { wallLike: true, outside: true }),
        p("mil_crate_05", -6, -15.5, 1),
        p("locker_03", 6.6, -9.5, 3),
        p("gun_mount_03", 6.5, -15, 3),
        p("loot_tier_airdrop_armor", 0, -13),
        p("crate_04", -5.2, -10),
    ],
    surfaces: [{ type: "container", boxes: [[-8, -20, 8, -6]] }],
    zoom: [{ zoomIn: [-7.5, -19.5, 7.5, -6.5] }],
    images: [
        { sprite: "map-building-milbase-vault-floor-01.img", kind: "floor", centre: { x: 0, y: -13 }, size: [17, 15] },
        dark("map-building-milbase-vault-ceiling-01.img", 0, -13, 17, 15),
    ],
    mapShapes: [],
});
