// military_armory_01 (병기고), the military base's north-east building (rebirth/buildings/military/): steel walls (they
// ricochet), the issue hall with the stairs down to the Magazine (S2), the gun cage and the ammo store; loopholes in
// its north and east walls. A rust-brown corrugated roof with crossed rifles on a sand disc (unlike the arsenal's
// charcoal roof and yellow padlock).
// The gun cage locked (2026-10-10, the owner: "more hidden rooms"): its door is a barred one (cell_door_01, survev
// police_01's cells: only the puzzle opens it; it swings east into the cage) that the armourer's switch in the ammo
// store opens (a one-switch puzzle); the cage grows to 8 x 9 inside (the hall gives up 2 units east of the stairs).
// The hall | store partition is breakable wood (the owner, 2026-10-10: "a pity: the walls can't be broken"); the cage's
// walls and the stairwell's stay steel.
import { fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "./part.ts";

/** The armory roof's emblem disc (compound frame). */
export const MILITARY_ARMORY_EMBLEM = { x: 31, y: 29.5, r: 3.6 } as const;

/** The gun cage's barred door (only the puzzle opens it; swings east into the cage) and its puzzle. */
export const MILITARY_ARMORY_CAGE_DOOR = { type: "cell_door_01", hinge: { x: 31.5, y: 35 }, ori: 2 } as const;
export const MILITARY_ARMORY_PUZZLE = "rebirth_milbase_armory";

export const MILITARY_ARMORY: MilitaryPart = fromWorld({
    id: "military_armory_01",
    layer: 0,
    parent: "military_compound_01",
    centre: { x: 31, y: 28.5 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: 21.5, y: 19.5 }, max: { x: 40.5, y: 37.5 } },
        material: "metal",
        walls: [
            ...hRun(19.5, 21, 41, [[27, 31]], undefined, "metal"),
            ...hRun(37.5, 21, 41, [[28, 31]], undefined, "metal"),
            ...vRun(21.5, 20, 37, [[33, 37]], undefined, "metal"),
            ...vRun(40.5, 20, 37, [[27, 30]], undefined, "metal"),
            // the hall | the cage and the store (4 wide beside the stairwell): the store's door, the cage's barred door
            // (wood beside the store; steel along the cage)
            ...vRun(31.5, 24, 27, [], "wood"),
            ...vRun(31.5, 27, 37, [[31, 35]], undefined, "metal"),
            ...hRun(27.5, 32, 40, [], undefined, "metal"),
            // the S2 stairwell against the west wall (its west side): the closer at its bottom and its east side
            ...hRun(24.5, 22, 27, [], undefined, "metal"),
            ...vRun(26.5, 25, 31, [], undefined, "metal"),
        ],
        openings: [
            op("house_door_02", 27, 19.25, 3),
            op("brick_wall_ext_3_0_low", 29.5, 37.5, 1),
            op("house_door_02", 21.25, 33, 0),
            op("house_door_02", 31.5, 20, 0),
            op("brick_wall_ext_3_0_low", 40.5, 28.5, 0),
        ],
        rooms: [
            room(21.5, 19.5, 31.5, 37.5, "issue"),
            room(31.5, 27.5, 40.5, 37.5, "cage"),
            room(31.5, 19.5, 40.5, 27.5, "ammo"),
            room(22, 25, 26, 31, "stairs_down_s"),
        ],
    },
    puzzle: { name: MILITARY_ARMORY_PUZZLE, door: MILITARY_ARMORY_CAGE_DOOR.type },
    props: [
        p(
            MILITARY_ARMORY_CAGE_DOOR.type,
            MILITARY_ARMORY_CAGE_DOOR.hinge.x,
            MILITARY_ARMORY_CAGE_DOOR.hinge.y,
            MILITARY_ARMORY_CAGE_DOOR.ori,
            { wallLike: true },
        ),
        // the issue hall: the issue desk, an ammo crate against the stairwell's closer
        p("table_01", 28, 35),
        p("crate_06", 24.25, 22.9),
        // the gun cage: racks of shotguns on the north and south walls, the QBB-97 on the east wall (the jackpot), the
        // SCAR locker in the south-east corner, floor loot
        p("gun_mount_01", 35.75, 36.1),
        p("gun_mount_02", 34.5, 28.95, 2),
        p("gun_mount_03", 39.1, 33.45, 3),
        p("locker_02", 39.25, 29.6, 3),
        p("loot_tier_police_floor", 35, 33),
        p("loot_tier_2", 35, 31),
        // the ammo store: the armourer's switch, a crate of grenades
        p("switch_03", 37, 20.55, 0, { piece: "1" }),
        p("mil_crate_04", 38.7, 24, 1),
        p("loot_tier_2", 34.5, 22.5),
    ],
    surfaces: [
        { type: "warehouse", boxes: [[21.5, 19.5, 40.5, 37.5]] },
        { type: "container", boxes: [[22, 25, 26, 31]] },
    ],
    zoom: [fullZoom([21.5, 19.5, 40.5, 37.5])],
    images: [
        {
            sprite: "map-building-milbase-armory-floor-01.img",
            kind: "floor",
            centre: { x: 31, y: 28.5 },
            size: [20, 19],
        },
        {
            sprite: "map-building-milbase-armory-ceiling-01.img",
            kind: "ceiling",
            centre: { x: 31, y: 28.5 },
            size: [20, 19],
        },
    ],
    mapShapes: [
        { box: [21, 19, 41, 38], color: 0x7a5a3a },
        { disc: [MILITARY_ARMORY_EMBLEM.x, MILITARY_ARMORY_EMBLEM.y, MILITARY_ARMORY_EMBLEM.r], color: 0xd8cfb8 },
    ],
});
