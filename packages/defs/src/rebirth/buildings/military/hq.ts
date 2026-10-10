// The military base's axis (rebirth/buildings/military/): the headquarters (본부) at the far end of the parade ground,
// over Command, and the reviewing stand (사열대) in front of it. Both have 50v50 variants (`_01r`, `_01b`) that differ
// only in their roofs: the faction's disc and band on the HQ, the faction's flags on the stand.
// The commander's archive (added 2026-10-10, the owner: "more hidden rooms"): the records room becomes a strongroom
// behind a steel panel in the hall's east wall (secret_door_club: only the puzzle opens it; it slides south into the
// wall), opened by the staff code: a switch in the comms room, the office and the briefing room (a coloured plate under
// each) pressed in the order of the note in the commander's office (survev bathhouse_01's code room, as Command's war
// chest below it); inside, the deposit boxes, a riot locker, a sniper's scopes and vault-grade floor loot.
import { fromWorld, fullZoom, hRun, low, type MilitaryPart, op, p, room, vRun } from "./part.ts";

/** The HQ roof's emblem disc (compound frame): its roof art and minimap disc. */
export const MILITARY_HQ_EMBLEM = { x: 0, y: 31, r: 4.2 } as const;

/** The archive's panel (secret_door_club: only the puzzle opens it; slides 3.75 south into the hall's east wall). */
export const MILITARY_HQ_ARCHIVE_DOOR = { type: "secret_door_club", hinge: { x: 6.5, y: 32 }, ori: 0 } as const;
export const MILITARY_HQ_PUZZLE = "rebirth_milbase_hq";
/** The staff code's switches (compound frame; their floor plates' colours) and the code: blue, red, green. */
export const MILITARY_HQ_SWITCHES = [
    { label: "red", x: -14.45, y: 25.6, ori: 1 },
    { label: "green", x: -14.45, y: 29.45, ori: 1 },
    { label: "blue", x: 14.45, y: 26, ori: 3 },
] as const;
export const MILITARY_HQ_CODE: readonly string[] = ["blue", "red", "green"];
/** Where the note with the code lies (compound frame): on the office floor in front of the desk. */
export const MILITARY_HQ_NOTE = { x: -10, y: 30 } as const;

export const MILITARY_HQ: MilitaryPart = fromWorld({
    id: "military_hq_01",
    factionVariants: true,
    layer: 0,
    parent: "military_compound_01",
    centre: { x: 0, y: 28.5 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: -15.5, y: 19.5 }, max: { x: 15.5, y: 37.5 } },
        material: "brick",
        walls: [
            // south: the main door on the axis between two windows; north: two windows over the 3-wide lane (none
            // into the archive)
            ...hRun(
                19.5,
                -16,
                16,
                [
                    [-13, -9],
                    [-2, 2],
                    [9, 13],
                ],
                undefined,
                "brick",
            ),
            ...hRun(
                37.5,
                -16,
                16,
                [
                    [-13, -9],
                    [-2, 2],
                ],
                undefined,
                "brick",
            ),
            // west and east: a side door into each 5-wide alley; a window on the west only
            ...vRun(
                -15.5,
                20,
                37,
                [
                    [21, 25],
                    [31, 35],
                ],
                undefined,
                "brick",
            ),
            ...vRun(15.5, 20, 37, [[21, 25]], undefined, "brick"),
            // the hall's partitions: two doors west; east the briefing room's door and the archive's panel, which
            // slides south into the wall y 28..32
            ...vRun(
                -6.5,
                20,
                37,
                [
                    [20, 24],
                    [32, 36],
                ],
                undefined,
                "brick",
            ),
            ...vRun(
                6.5,
                20,
                37,
                [
                    [20, 24],
                    [32, 36],
                ],
                undefined,
                "brick",
            ),
            // comms | office, briefing | archive (8 x 8 inside)
            ...hRun(28.5, -15, -7, [], undefined, "brick"),
            ...hRun(28.5, 7, 15, [], undefined, "brick"),
            // the S1 stairwell: the closer at its bottom and both long sides (down south; its top end at y 31 is open)
            ...hRun(24.5, -3, 3, [], undefined, "brick"),
            ...vRun(-2.5, 25, 31, [], undefined, "brick"),
            ...vRun(2.5, 25, 31, [], undefined, "brick"),
        ],
        openings: [
            op("house_door_01", -2, 19.25, 3),
            op("house_window_01", -11, 19.25, 3),
            op("house_window_01", 11, 19.25, 3),
            op("house_window_01", -11, 37.75, 1),
            op("house_window_01", 0, 37.75, 1),
            op("house_door_01", -15.75, 21, 0),
            op("house_window_01", -15.75, 33, 0),
            op("house_door_01", 15.75, 21, 0),
            op("house_door_01", -6.5, 20, 0),
            op("house_door_01", -6.5, 32, 0),
            op("house_door_01", 6.5, 20, 0),
        ],
        rooms: [
            room(-6.5, 19.5, 6.5, 37.5, "hq_hall"),
            room(-15.5, 19.5, -6.5, 28.5, "hq_comms"),
            room(-15.5, 28.5, -6.5, 37.5, "hq_office"),
            room(6.5, 19.5, 15.5, 28.5, "hq_briefing"),
            room(6.5, 28.5, 15.5, 37.5, "hq_archive"),
            room(-2, 25, 2, 31, "stairs_down_s"),
        ],
    },
    puzzle: { name: MILITARY_HQ_PUZZLE, door: MILITARY_HQ_ARCHIVE_DOOR.type },
    props: [
        p(
            MILITARY_HQ_ARCHIVE_DOOR.type,
            MILITARY_HQ_ARCHIVE_DOOR.hinge.x,
            MILITARY_HQ_ARCHIVE_DOOR.hinge.y,
            MILITARY_HQ_ARCHIVE_DOOR.ori,
            { wallLike: true },
        ),
        ...MILITARY_HQ_SWITCHES.map((sw) => p("switch_03", sw.x, sw.y, sw.ori, { piece: sw.label })),
        // the hall: an extinguisher at the top of the stairs, clear of both hall doors' swings
        p("fire_ext_01", -1, 35.9),
        // the comms room: the radio rack (indestructible, ricochets) against its north wall, container loot
        p("table_07", -10.45, 26.75),
        p("loot_tier_2", -11, 23),
        // the commander's office: the Deagle case in the north-west corner, the desk (turned)
        p("case_01", -13.4, 34.75, 1),
        p("table_01", -9.2, 34.05, 1),
        // the briefing room: the table under the screen, container loot
        p("table_01", 11, 24.5),
        p("screen_01", 11, 27.75),
        p("loot_tier_1", 9, 22.5),
        // the archive: the deposit boxes (the jackpot) and a riot locker along the east wall, a sniper's scopes, the
        // vault-grade floor loot and container loot, clear of the panel
        p("deposit_box_02", 13.85, 34.5, 3),
        p("locker_02", 14.25, 30.5, 3),
        p("loot_tier_scopes_sniper", 10, 31.5),
        p("loot_tier_vault_floor", 10, 34.5),
        p("loot_tier_2", 8.75, 35),
    ],
    surfaces: [
        { type: "tile", boxes: [[-15.5, 19.5, 15.5, 37.5]] },
        {
            type: "carpet",
            boxes: [
                [-15.5, 28.5, -6.5, 37.5],
                [6.5, 19.5, 15.5, 28.5],
            ],
        },
        { type: "container", boxes: [[-2, 25, 2, 31]] },
    ],
    zoom: [fullZoom([-15.5, 19.5, 15.5, 37.5])],
    images: [
        { sprite: "map-building-milbase-hq-floor-01.img", kind: "floor", centre: { x: 0, y: 28.5 }, size: [32, 19] },
        {
            sprite: "map-building-milbase-hq-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 0, y: 28.5 },
            size: [32, 19],
            faction: true,
        },
    ],
    mapShapes: [
        { box: [-16, 19, 16, 38], color: 0x6e6a5c },
        { disc: [MILITARY_HQ_EMBLEM.x, MILITARY_HQ_EMBLEM.y, MILITARY_HQ_EMBLEM.r], color: "emblem" },
        { disc: [MILITARY_HQ_EMBLEM.x, MILITARY_HQ_EMBLEM.y, 1.8], color: "star" },
    ],
});

export const MILITARY_STAND: MilitaryPart = fromWorld({
    id: "military_stand_01",
    factionVariants: true,
    layer: 0,
    parent: "military_compound_01",
    centre: { x: 0, y: 13 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: -8.5, y: 10.5 }, max: { x: 8.5, y: 15.5 } },
        material: "brick",
        // only the end walls: an open front (rails) and an open back toward the HQ
        walls: [...vRun(-8.5, 10, 16, [], undefined, "brick"), ...vRun(8.5, 10, 16, [], undefined, "brick")],
        openings: [],
        rooms: [room(-8.5, 10.5, 8.5, 15.5, "stage")],
    },
    props: [
        low("metal_wall_ext_short_6", -5, 10.5, 1),
        low("metal_wall_ext_short_6", 5, 10.5, 1),
        p("table_01", 0, 13.4),
        p("chair_01", -6.3, 13.9),
        p("chair_01", -3.9, 13.9),
        p("chair_01", 3.9, 13.9),
        p("chair_01", 6.3, 13.9),
    ],
    surfaces: [{ type: "house", boxes: [[-8.5, 10.5, 8.5, 15.5]] }],
    zoom: [{ zoomIn: [-8, 10.5, 8, 15.5], zoomOut: [-9, 10, 9, 16] }],
    images: [
        { sprite: "map-building-milbase-stand-floor-01.img", kind: "floor", centre: { x: 0, y: 13 }, size: [18, 6] },
        {
            sprite: "map-building-milbase-stand-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 0, y: 13 },
            size: [18, 6],
            faction: true,
        },
    ],
    mapShapes: [{ box: [-9, 10, 9, 16], color: 0x3d5a36 }],
});
