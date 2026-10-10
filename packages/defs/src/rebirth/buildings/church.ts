// church_01, a rebirth building of the normal map and 50v50 (the owner's wave 3, 2026-10-10: "the gas station and the
// church: their exterior walls can be broken; when a certain amount collapses the whole building caves in";
// docs/research/rebirth-deviations.md "The church"): a stone church, 34 x 52 inside. The bell tower at the south front
// is the entrance and a lookout (LOOKOUT_ZOOM); beside it the baptistry and the bell-ringer's store; the nave holds four
// rows of pews each side of a 7-unit centre aisle, 4-unit side aisles along the stained-glass windows and side doors; the
// chancel to the north with the altar under the apse, the vestry east of it, and the reliquary west of it behind a
// sliding stone panel (vault_door_bathhouse) that opens on the bell code: three switches (the baptistry's, the tower's,
// the chancel's) pressed in the order of the hymn sheet on the vestry floor (survev bathhouse_01's code room).
// The shell is brittle brick (rebirth_wall_brk_*): with 40 % of its pieces broken the church caves in on everyone
// inside (ceiling.destroy.collapse). The bell tower, the reliquary's walls and the walls the switches stand on are
// unbreakable brick; the partitions between the ordinary rooms are breakable wood.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    LOOKOUT_ZOOM,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    roofFrame,
    wallChildren,
    wallMaterial,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

// 34 x 52 inside (x -17..17, y -26..26), the front (south) at y -26. South strip (y -26..-16): baptistry | bell tower
// (x -6.5..6.5) | store; the nave (y -16..14); north strip (y 14..26): reliquary (x -17..-8) | chancel | vestry (x 8..17).
// Brick and brittle walls come in whole and half units: outer runs start half a unit outside the floor.
export const CHURCH_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -17, y: -26 }, max: { x: 17, y: 26 } },
    material: "brittle",
    walls: [
        // south: the baptistry window, the tower's brick front with the main door, the store window
        ...hRun(-26, -17.5, -7, [[-13.5, -9.5]], "brittle"),
        ...hRun(-26, -7, 7, [[-2, 2]], "brick"),
        ...hRun(-26, 7, 17.5, [[9.5, 13.5]], "brittle"),
        // west: three nave windows round the side door; the reliquary's stretch (y 13.5..25.5) is brick
        ...vRun(
            -17,
            -25.5,
            13.5,
            [
                [-10, -6],
                [-2, 2],
                [6, 10],
            ],
            "brittle",
        ),
        ...vRun(-17, 13.5, 25.5, [], "brick"),
        // east: the store window, the nave windows round the side door, the vestry's back door
        ...vRun(
            17,
            -25.5,
            25.5,
            [
                [-23, -19],
                [-10, -6],
                [-2, 2],
                [6, 10],
                [18, 22],
            ],
            "brittle",
        ),
        // north: the reliquary's brick stretch, the apse's two stained-glass windows
        ...hRun(26, -17.5, -7.5, [], "brick"),
        ...hRun(
            26,
            -7.5,
            17.5,
            [
                [-6.5, -2.5],
                [2.5, 6.5],
            ],
            "brittle",
        ),
        // the bell tower (brick: two switches stand on it), open to the nave through a 4-unit arch
        ...vRun(-6.5, -25.5, -15.5, [], "brick"),
        ...vRun(6.5, -25.5, -15.5, [], "brick"),
        ...hRun(-16, -6, -2, [], "brick"),
        ...hRun(-16, 2, 6, [], "brick"),
        // baptistry | nave and store | nave (breakable wood), a door each
        ...hRun(-16, -16.5, -7, [[-14, -10]], "wood"),
        ...hRun(-16, 7, 16.5, [[10, 14]], "wood"),
        // the reliquary (brick): its stone panel slides north into the chancel wall
        ...hRun(14, -16.5, -7.5, [], "brick"),
        ...vRun(-8, 14.5, 25.5, [[17.5, 21.5]], "brick"),
        // the vestry (breakable wood): a door from the nave, one from the chancel
        ...hRun(14, 7.5, 16.5, [[10.5, 14.5]], "wood"),
        ...vRun(8, 14.5, 25.5, [[18, 22]], "wood"),
    ],
    openings: [
        op("house_window_01", -11.5, -26.25, 3),
        op("house_door_01", -2, -26.25, 3),
        op("house_window_01", 11.5, -26.25, 3),
        op("house_window_01", -17.25, -8, 0),
        op("house_door_01", -17.25, -2, 0),
        op("house_window_01", -17.25, 8, 0),
        op("house_window_01", 17.25, -21, 0),
        op("house_window_01", 17.25, -8, 0),
        op("house_door_01", 17.25, -2, 0),
        op("house_window_01", 17.25, 8, 0),
        op("house_door_01", 17.25, 18, 0),
        op("house_window_01", -4.5, 26.25, 1),
        op("house_window_01", 4.5, 26.25, 1),
        op("house_door_01", -14, -16, 3),
        op("house_door_01", 10, -16, 3),
        op("house_door_01", 10.5, 14, 3),
        op("house_door_01", 8, 18, 0),
    ],
    rooms: [
        room(-17, -16, 17, 14, "nave"),
        room(-17, -26, -6.5, -16, "baptistry"),
        room(-6.5, -26, 6.5, -16, "tower"),
        room(6.5, -26, 17, -16, "store"),
        room(-8, 14, 8, 26, "chancel"),
        room(-17, 14, -8, 26, "reliquary"),
        room(8, 14, 17, 26, "vestry"),
    ],
};

/** The bell tower's floor (its lookout zoom region). */
export const CHURCH_TOWER = box(-6, -25.5, 6, -16.5);

/** The reliquary's stone panel (vault_door_bathhouse: only the puzzle opens it; slides north into the wall). */
export const CHURCH_RELIQUARY_DOOR = { type: "vault_door_bathhouse", pos: { x: -8, y: 21.5 }, ori: 2 } as const;
export const CHURCH_PUZZLE = "rebirth_church";
/** The bell switches, flush to a brick wall each: the baptistry's, the tower's, the chancel's (by the altar). */
export const CHURCH_SWITCHES = [
    { label: "yellow", x: -7.55, y: -21, ori: 3 },
    { label: "red", x: 5.45, y: -21, ori: 3 },
    { label: "blue", x: -6.95, y: 24.5, ori: 1 },
] as const;
export const CHURCH_CODE: readonly string[] = ["blue", "yellow", "red"];
/** The hymn sheet with the code on the vestry floor. */
export const CHURCH_NOTE = { x: 14.5, y: 21 } as const;

/** The pews: couch_01 (9 x 3) in four rows each side of the centre aisle, 3 units between rows. */
export const CHURCH_PEW_ROWS: readonly number[] = [-9, -3, 3, 9];
export const CHURCH_PEW_X = 8;

/** The brittle shell's pieces; the church caves in when 40 % of them (rounded) are broken (wallCount counts any wall). */
export const CHURCH_BRITTLE_PIECES = CHURCH_LAYOUT.walls.filter(
    (s) => wallMaterial(CHURCH_LAYOUT, s) === "brittle",
).length;
export const CHURCH_COLLAPSE_WALLS = Math.round(CHURCH_BRITTLE_PIECES * 0.4);

export const CHURCH_ART: RoofedBuildingArt = layoutArt(
    CHURCH_LAYOUT,
    "map-building-church-floor-01.img",
    "map-building-church-ceiling-01.img",
);

/** The rubble left on the floor once the church caves in (the roof's residue), the roof image's size. */
export const CHURCH_RESIDUE_ART: RebirthBuildingArt = {
    floor: "map-building-church-res-01.img",
    size: CHURCH_ART.size,
};

export function church(known: (id: string) => boolean): BuildingDef {
    const L = CHURCH_LAYOUT;
    const f = roofFrame(L);
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(f.min.x, f.min.y, f.max.x, f.max.y), color: 0x5d6670 },
                // the bell tower and the cross over the nave
                { collider: box(-7, -26.5, 7, -15.5), color: 0x7d6a58 },
                { collider: box(-1, -8, 1, 8), color: 0xe9e2cf },
                { collider: box(-5, 1, 5, 3), color: 0xe9e2cf },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "stone", collision: [box(-17, -26, 17, 26)] },
                { type: "carpet", collision: [box(-8, 14, 8, 26)] },
                { type: "house", collision: [box(8, 14, 17, 26)] },
            ],
            imgs: [{ sprite: CHURCH_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [
                { zoomIn: box(-17, -26, 17, 26), zoomOut: box(f.min.x, f.min.y, f.max.x, f.max.y) },
                { zoomIn: CHURCH_TOWER, zoom: LOOKOUT_ZOOM },
            ],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: CHURCH_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
            // the slate roof falls with 40 % of the brittle shell, burying everyone inside (sim world/collapse.ts)
            destroy: {
                wallCount: CHURCH_COLLAPSE_WALLS,
                particle: "teahouseBreak",
                particleCount: 90,
                residue: CHURCH_RESIDUE_ART.floor,
                collapse: true,
            },
        },
        puzzle: rebirthPuzzle(CHURCH_PUZZLE, CHURCH_RELIQUARY_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(
                CHURCH_RELIQUARY_DOOR.type,
                CHURCH_RELIQUARY_DOOR.pos.x,
                CHURCH_RELIQUARY_DOOR.pos.y,
                CHURCH_RELIQUARY_DOOR.ori,
            ),
            ...CHURCH_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            // the nave: the pews facing the altar (bullets pass over them), loot between the rows and in the aisles
            ...CHURCH_PEW_ROWS.flatMap((y) => [
                child("couch_01", -CHURCH_PEW_X, y, 2),
                child("couch_01", CHURCH_PEW_X, y, 2),
            ]),
            child("loot_tier_1", -8, -6),
            child("loot_tier_1", 8, 6),
            child("loot_tier_1", -14.5, 12),
            child("loot_tier_2", 0, -13),
            child("loot_tier_2", 14.5, -13),
            // the chancel: the altar (a wooden table, not solid) under the apse with two candles, the pulpit (a lectern) flush to the reliquary wall
            child("table_02", 0, 23),
            child("candle_lit_01", -5.6, 24.5),
            child("candle_lit_01", 5.6, 24.5),
            child("stand_01", -6.25, 15.6),
            child("loot_tier_2", 3, 18),
            // the bell tower: loot under the bell
            child("loot_tier_2", -2.5, -21),
            child("loot_tier_1", 2, -19),
            // the baptistry: the font (a stone basin) flush to the west wall, a candle, loot
            child("pot_04", -15, -21),
            child("candle_lit_01", -15, -18),
            child("loot_tier_1", -11, -23),
            // the store: the bell-ringer's locker against the tower, a chest of drawers in the corner, loot
            child("locker_01", 7.75, -24, 1),
            child("drawers_01", 14, -24.4),
            child("loot_tier_1", 11.5, -20),
            // the vestry: the vestment shelf along the north wall, loot
            child("bookshelf_01", 12.5, 24.5),
            child("loot_tier_2", 12.5, 18.5),
            // the reliquary: a chest and a pistol case flush to the west wall, a shotgun on its mount between them, level
            // 3 armour and loot on the floor by the panel
            child("chest_02", -14.25, 23.9),
            child("gun_mount_05", -15.6, 20.05, 1),
            child("case_01", -14.25, 16.1),
            child("loot_tier_airdrop_armor", -10.5, 23.5),
            child("loot_tier_2", -10.5, 16.5),
            // outside: bushes by the tower
            child("bush_01", -9, -28.1),
            child("bush_01", 9, -28.1),
        ],
    };
}
