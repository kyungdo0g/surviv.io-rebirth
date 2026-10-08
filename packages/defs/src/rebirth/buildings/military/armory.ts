// military_armory_01 (병기고), the military base's north-east building (rebirth/buildings/military/): steel walls (they
// ricochet), the issue hall with the stairs down to the Magazine (S2), the gun cage and the ammo store; loopholes in
// its north and east walls. A rust-brown corrugated roof with crossed rifles on a sand disc (unlike the arsenal's
// charcoal roof and yellow padlock).
import { fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "./part.ts";

/** The armory roof's emblem disc (compound frame). */
export const MILITARY_ARMORY_EMBLEM = { x: 31, y: 29.5, r: 3.6 } as const;

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
            ...hRun(19.5, 21, 41, [[28, 32]], undefined, "metal"),
            ...hRun(37.5, 21, 41, [[28, 31]], undefined, "metal"),
            ...vRun(21.5, 20, 37, [[33, 37]], undefined, "metal"),
            ...vRun(40.5, 20, 37, [[27, 30]], undefined, "metal"),
            // the hall | the cage and the store
            ...vRun(
                33.5,
                20,
                37,
                [
                    [20, 24],
                    [31, 35],
                ],
                undefined,
                "metal",
            ),
            ...hRun(27.5, 34, 40, [], undefined, "metal"),
            // the S2 stairwell against the west wall (its west side): the closer at its bottom and its east side
            ...hRun(24.5, 22, 27, [], undefined, "metal"),
            ...vRun(26.5, 25, 31, [], undefined, "metal"),
        ],
        openings: [
            op("house_door_02", 28, 19.25, 3),
            op("brick_wall_ext_3_0_low", 29.5, 37.5, 1),
            op("house_door_02", 21.25, 33, 0),
            op("house_door_02", 33.5, 20, 0),
            op("house_door_02", 33.5, 31, 0),
            op("brick_wall_ext_3_0_low", 40.5, 28.5, 0),
        ],
        rooms: [
            room(21.5, 19.5, 33.5, 37.5, "issue"),
            room(33.5, 27.5, 40.5, 37.5, "cage"),
            room(33.5, 19.5, 40.5, 27.5, "ammo"),
            room(22, 25, 26, 31, "stairs_down_s"),
        ],
    },
    props: [
        // the issue hall: the issue desk, an ammo crate
        p("table_01", 30, 35),
        p("crate_06", 31.9, 28.5, 1),
        // the gun cage: shotgun mounts, the SCAR locker, container loot
        p("gun_mount_01", 37, 36),
        p("gun_mount_02", 39, 31.5, 3),
        p("locker_02", 35.5, 28.75),
        p("loot_tier_2", 36.5, 33),
        // the ammo store
        p("mil_crate_04", 38.7, 24, 1),
        p("loot_tier_2", 36, 25.5),
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
