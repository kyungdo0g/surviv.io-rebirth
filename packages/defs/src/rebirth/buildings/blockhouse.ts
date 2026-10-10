// blockhouse_01r / blockhouse_01b, rebirth buildings of 50v50 only (the owner, 2026-10-08; docs/research/
// rebirth-deviations.md "More rebirth buildings"): a fieldstone blockhouse per faction, two per side, in its own two
// tenths beside the river (rebirth front-line placement in sim mapgen placement.ts; `teamId` gives the side). Two
// chambers split by the magazine, a strongroom that is the traverse, with 3.5-unit passages at its ends; eight
// loopholes on all four sides (brick_wall_ext_3_0_low: bullets and grenades pass, players do not, survev's bridge
// railings) so any orientation covers the river; steel doors (house_door_02); the whole keep gives a 4x view (zoom 48,
// the bathhouse's) and its roof stops air strike bombs. Anyone can use it. The magazine (the owner, 2026-10-10: "expand
// the hidden rooms") opens on a two-switch code, one switch per chamber, the code chalked outside its door.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    circle,
    LOOKOUT_ZOOM,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "./layout.ts";

// 21 x 21 inside (x, y -10.5..10.5): north and south chambers (6 deep) either side of the magazine (11 x 6 inside),
// which stands where the traverse stood, with 3.5-unit passages at its ends.
export const BLOCKHOUSE_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -10.5, y: -10.5 }, max: { x: 10.5, y: 10.5 } },
    material: "brick",
    walls: [
        // north and south: loopholes -8..-5 and 5..8, the steel door -2..2
        [-11, 10.5, -8, 10.5],
        [-5, 10.5, -2, 10.5],
        [2, 10.5, 5, 10.5],
        [8, 10.5, 11, 10.5],
        [-11, -10.5, -8, -10.5],
        [-5, -10.5, -2, -10.5],
        [2, -10.5, 5, -10.5],
        [8, -10.5, 11, -10.5],
        // west and east: loopholes -7..-4 and 4..7
        [-10.5, -10, -10.5, -7],
        [-10.5, -4, -10.5, 4],
        [-10.5, 7, -10.5, 10],
        [10.5, -10, 10.5, -7],
        [10.5, -4, 10.5, 4],
        [10.5, 7, 10.5, 10],
        // the magazine: its door 1.5..5.5 in the north wall, whose west run takes the door when it slides open
        // (y +-3.5: a steel door swung in leaves 2.75 to the magazine, not a squeeze)
        [-6, -4, -6, 4],
        [6, -4, 6, 4],
        [-5.5, 3.5, 1.5, 3.5],
        [-5.5, -3.5, 5.5, -3.5],
    ],
    openings: [
        { type: "house_door_02", pos: { x: -2, y: 10.75 }, ori: 3 },
        { type: "house_door_02", pos: { x: -2, y: -10.75 }, ori: 3 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -6.5, y: 10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 6.5, y: 10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -6.5, y: -10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 6.5, y: -10.5 }, ori: 1 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -10.5, y: 5.5 }, ori: 0 },
        { type: "brick_wall_ext_3_0_low", pos: { x: -10.5, y: -5.5 }, ori: 0 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 10.5, y: 5.5 }, ori: 0 },
        { type: "brick_wall_ext_3_0_low", pos: { x: 10.5, y: -5.5 }, ori: 0 },
    ],
    rooms: [
        { min: { x: -10.5, y: -10.5 }, max: { x: 10.5, y: 10.5 }, floor: "chamber" },
        { min: { x: -6, y: -3.5 }, max: { x: 6, y: 3.5 }, floor: "magazine" },
    ],
};

/** The magazine's door (vault_door_bathhouse: only the puzzle opens it; slides west into the wall). */
export const BLOCKHOUSE_MAGAZINE_DOOR = { type: "vault_door_bathhouse", pos: { x: 1.5, y: 3.5 }, ori: 3 } as const;
export const BLOCKHOUSE_PUZZLE = "rebirth_blockhouse";
/** The switches (their floor plates' colours): red on the north chamber's wall, blue on the south chamber's. */
export const BLOCKHOUSE_SWITCHES = [
    { label: "red", x: 3.5, y: 9.45, ori: 0 },
    { label: "blue", x: -3.5, y: -9.45, ori: 2 },
] as const;
/** The code, chalked on the floor before the magazine's door (BLOCKHOUSE_CODE_NOTE): blue, then red. */
export const BLOCKHOUSE_CODE: readonly string[] = ["blue", "red"];
export const BLOCKHOUSE_CODE_NOTE = { x: 3.5, y: 7.25 } as const;

/** The blockhouses: Red (1) and Blue (2), each with its faction's roof colour. */
export const BLOCKHOUSE_FACTIONS = [
    { id: "blockhouse_01r", teamId: 1, color: 0xb3261e },
    { id: "blockhouse_01b", teamId: 2, color: 0x1f5fbf },
] as const;

export function blockhouseArt(teamId: number): RoofedBuildingArt {
    const side = teamId === 1 ? "red" : "blue";
    return layoutArt(
        BLOCKHOUSE_LAYOUT,
        "map-building-blockhouse-floor-01.img",
        `map-building-blockhouse-ceiling-${side}.img`,
    );
}

export function blockhouse(faction: (typeof BLOCKHOUSE_FACTIONS)[number], known: (id: string) => boolean): BuildingDef {
    const L = BLOCKHOUSE_LAYOUT;
    const art = blockhouseArt(faction.teamId);
    return {
        type: "building",
        map: {
            display: true,
            // light stone with a ring in the faction's colour
            shapes: [
                { collider: box(-11, -11, 11, 11), color: 0xa8a296 },
                { collider: circle(0, 0, 4), color: faction.color },
                { collider: circle(0, 0, 2.25), color: 0xa8a296 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        teamId: faction.teamId,
        floor: {
            surfaces: [{ type: "stone", collision: [box(-10.5, -10.5, 10.5, 10.5)] }],
            imgs: [{ sprite: art.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [
                { zoomIn: box(-10.5, -10.5, 10.5, 10.5), zoomOut: box(-11, -11, 11, 11), zoom: LOOKOUT_ZOOM },
            ],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: art.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(BLOCKHOUSE_PUZZLE, BLOCKHOUSE_MAGAZINE_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(
                BLOCKHOUSE_MAGAZINE_DOOR.type,
                BLOCKHOUSE_MAGAZINE_DOOR.pos.x,
                BLOCKHOUSE_MAGAZINE_DOOR.pos.y,
                BLOCKHOUSE_MAGAZINE_DOOR.ori,
            ),
            ...BLOCKHOUSE_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            // the magazine: a sniper crate (the payoff) below the door, two police lockers side by side along the
            // west wall, level 3 armour and a loose spawn on the floor; flush against the walls or 2.6+ clear
            child("mil_crate_05", 2.8, -1.75),
            child("locker_02", -4.75, -1.5, 1),
            child("locker_02", -4.75, 1.5, 1),
            child("loot_tier_2", -1, 1.5),
            child("loot_tier_airdrop_armor", -1.5, -1),
            // the chambers: loot (no faction crates: survevFaction.test.ts spaces them); the south one's ammo crate
            // against the magazine, east of the steel door's swing (the north chamber keeps that wall clear for the
            // magazine's door and the steel door's swing)
            child("loot_tier_2", 7, 8),
            child("loot_tier_1", -8.5, 8.5),
            child("crate_06", 4.75, -5.1),
            child("loot_tier_2", -7, -8),
            child("loot_tier_1", 8.5, -8.5),
            // outside: sandbags beside the doors, hedgehogs and bushes at the corners, clear of the loopholes' lines
            child("sandbags_02", -3.6, 12.4),
            child("sandbags_02", 3.6, -12.4),
            child("hedgehog_01", -14.5, 14.5),
            child("hedgehog_01", 14.5, -14.5),
            child("bush_01f", 15, 14.5),
            child("bush_01f", -15, -14.5),
        ],
    };
}
