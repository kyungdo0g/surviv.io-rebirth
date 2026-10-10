// bunker_blast_01, the blast bunker (방폭 벙커; the owner's wave 3, 2026-10-10: "an underground bunker only strong
// firepower like the M202 can open; what is inside is up to you"; docs/research/rebirth-deviations.md "The blast
// bunker"): a structure on the normal map and on 50v50. On the surface a 16 x 14 concrete entrance block: the stairs
// down behind blast_door_01 (blastDoors.ts: only an M202-class hit opens it) in its south wall, a guard post round the
// stairwell with a door either side and two north windows. Underground (layer 1) a 36 x 28 vault complex north of the
// stairs' foot: the entry hall, the medical store and the ammunition store (the launchers' rounds, so the bunker refills
// heavy weapons), the armoury (survev's three rarest gun mounts, a gold drop's crate, an air drop's crate, a sniper crate,
// a spare M202) and the commander's room (level 3 / 4 gear, a safe, a chest, a deposit box). The whole basement lies
// behind the blast door: it is the bunker's hidden room. Built like survev's bunker_structure_* (one building per
// layer, the stairs between them, the mask over the basement) and our military base (military/structure.ts).
import type { BuildingDef, LootSpawnerDef, MapObjectDef, StructureDef } from "../../types/index.ts";
import { BLAST_DOOR } from "./blastDoors.ts";
import {
    ART_SCALE,
    box,
    child,
    floorArtPos,
    layoutArt,
    openingChildren,
    REBIRTH_ART_PX_PER_UNIT,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    roofArtPos,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

export const BLAST_BUNKER = "bunker_blast_01";
export const BLAST_BUNKER_ENTRANCE = "bunker_blast_entrance_01";
export const BLAST_BUNKER_VAULT = "bunker_blast_vault_01";
/** A spare M202 on the armoury's launcher rack: the rocket that opened the door comes back. */
export const BLAST_BUNKER_LAUNCHER_LOOT = "loot_tier_bunker_launcher";
/** The launchers' rounds in the ammunition store (40 mm grenades and RPG rockets: rebirth/newGuns.ts NEW_AMMO_IDS). */
export const BLAST_BUNKER_ROCKET_LOOT = "loot_tier_bunker_rockets";
/** The commander's gear: the level 4 pack (backpack04) and level 3 helmet and vest. */
export const BLAST_BUNKER_GEAR_LOOT = "loot_tier_bunker_gear";

/** The stairs (structure frame): 4 wide, 6 long, going down north from the landing behind the blast door. */
export const BLAST_BUNKER_STAIRS = { collision: [-2, -4, 2, 2], downDir: { x: 0, y: 1 } } as const;
/** The blast door in the entrance's south doorway (ori 1: the 1.5 x 4 slab across the 4-unit gap). */
export const BLAST_BUNKER_DOOR = { type: BLAST_DOOR, pos: { x: 0, y: -7 }, ori: 1 } as const;

// ---------------------------------------------------------------------------------------------------------------------
// the surface: the entrance block (x -8..8, y -7..7)

export const BLAST_BUNKER_ENTRANCE_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -8, y: -7 }, max: { x: 8, y: 7 } },
    material: "concrete",
    walls: [
        // south: the blast doorway; north: two windows; west and east: the guard post's doors
        ...hRun(-7, -8.5, 8.5, [[-2, 2]]),
        ...hRun(7, -8.5, 8.5, [
            [-6.5, -2.5],
            [2.5, 6.5],
        ]),
        ...vRun(-8, -6.5, 6.5, [[-5, -1]]),
        ...vRun(8, -6.5, 6.5, [[-5, -1]]),
        // the stairwell: its sides from the south wall to the closer across the stairs' foot (0.5 past their bottom
        // edge, as the military base's armory stairwell)
        ...vRun(-2.5, -6.5, 2),
        ...vRun(2.5, -6.5, 2),
        ...hRun(2.5, -3, 3),
    ],
    openings: [
        op("house_window_01", -4.5, 7.25, 1),
        op("house_window_01", 4.5, 7.25, 1),
        op("house_door_02", -8.25, -5, 0),
        op("house_door_02", 8.25, -5, 0),
    ],
    rooms: [room(-8, -7, 8, 7, "guard"), room(-2, -7, 2, -4, "landing"), room(-2, -4, 2, 2, "stairs")],
};

export const BLAST_BUNKER_ENTRANCE_ART: RoofedBuildingArt = layoutArt(
    BLAST_BUNKER_ENTRANCE_LAYOUT,
    "map-building-blast-bunker-entrance-floor-01.img",
    "map-building-blast-bunker-entrance-ceiling-01.img",
);

function entrance(known: (id: string) => boolean): BuildingDef {
    const L = BLAST_BUNKER_ENTRANCE_LAYOUT;
    const roofPos = roofArtPos(L);
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-8.5, -7.5, 8.5, 7.5), color: 0x5c5f55 },
                // the hatch: the yellow and black blast door's frame
                { collider: box(-3, -7, 3, -3), color: 0xd8b02c },
                { collider: box(-2, -6, 2, -4), color: 0x2a2c28 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "stone", collision: [box(-8, -7, 8, 7)] },
                { type: "container", collision: [box(-2, -7, 2, 2)] },
            ],
            imgs: [{ sprite: BLAST_BUNKER_ENTRANCE_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-8, -7, 8, 7), zoomOut: box(-8.5, -7.5, 8.5, 7.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [
                {
                    sprite: BLAST_BUNKER_ENTRANCE_ART.ceiling,
                    pos: roofPos,
                    scale: ART_SCALE,
                    alpha: 1,
                    tint: 0xffffff,
                },
            ],
        },
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(BLAST_BUNKER_DOOR.type, BLAST_BUNKER_DOOR.pos.x, BLAST_BUNKER_DOOR.pos.y, BLAST_BUNKER_DOOR.ori),
            // the guard post: a locker either side, the duty desk in the west wing, floor loot
            child("locker_01", -6.75, 5, 1),
            child("locker_02", 6.75, 5, 3),
            child("table_01", -5.25, 0.5, 1),
            child("loot_tier_1", -5.25, 0.5),
            child("loot_tier_1", 5.25, 1),
            child("loot_tier_2", 0, 4.75),
            // cover facing the door's approach (an M202 needs 16 units of room: explosion_m202 rad.max)
            child("sandbags_01", -8, -12),
            child("sandbags_01", 8, -12),
        ],
    };
}

// ---------------------------------------------------------------------------------------------------------------------
// underground: the vault complex (x -18..18, y 3..31)

/** The dark roof over the vault complex: drawn at 8 px per unit, tinted like survev's bunker ceilings. */
const DARK_ROOF = { ppu: 8, tint: 0x5f5f5f } as const;

export const BLAST_BUNKER_VAULT_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -18, y: 3 }, max: { x: 18, y: 31 } },
    material: "concrete",
    walls: [
        // the shell, the stairs' foot in the south wall
        ...hRun(3, -18.5, 18.5, [[-2, 2]]),
        ...hRun(31, -18.5, 18.5),
        ...vRun(-18, 3.5, 30.5),
        ...vRun(18, 3.5, 30.5),
        // the south band | the north band: medical store -> armoury, hall -> armoury, hall -> commander, ammo ->
        // commander
        ...hRun(13, -17.5, 17.5, [
            [-14, -10],
            [-5, -1],
            [1, 5],
            [10, 14],
        ]),
        // the entry hall's sides (doors into the stores), the armoury | the commander's room
        ...vRun(-6, 3.5, 12.5, [[6.5, 10.5]]),
        ...vRun(6, 3.5, 12.5, [[6.5, 10.5]]),
        ...vRun(0, 13.5, 30.5),
        // the stairwell underground: its sides from the wall line to the top end, a closer across that end
        ...vRun(-2.5, -4, 3),
        ...vRun(2.5, -4, 3),
        ...hRun(-4.5, -3, 3),
    ],
    openings: [
        // the stairs' foot: a steel door 0.75 past their bottom edge (inside the mask, so on the basement's floor)
        op("house_door_02", -2, 2.75, 3),
        op("house_door_02", -6, 6.5, 0),
        op("house_door_02", 6, 6.5, 0),
        op("house_door_02", -14, 13, 3),
        op("house_door_02", -5, 13, 3),
        op("house_door_02", 1, 13, 3),
        op("house_door_02", 10, 13, 3),
    ],
    rooms: [
        room(-6, 3, 6, 13, "hall"),
        room(-18, 3, -6, 13, "medical"),
        room(6, 3, 18, 13, "ammo"),
        room(-18, 13, 0, 31, "armoury"),
        room(0, 13, 18, 31, "command"),
    ],
    // the stairwell seen from below (the floor image takes it in: the walls and the flight)
    outdoor: [room(-3, -5, 3, 3, "stairs")],
};

/** The vault complex's images: the floor (stairwell included) at 32 px per unit and the dark roof at 8. */
export const BLAST_BUNKER_VAULT_FLOOR = "map-building-blast-bunker-vault-floor-01.img";
export const BLAST_BUNKER_VAULT_CEILING = "map-building-blast-bunker-vault-ceiling-01.img";
/** The dark roof's box: the floor image's (the vault and its walls, and the stairwell). */
export const BLAST_BUNKER_VAULT_ROOF = { centre: { x: 0, y: 13.25 }, size: [37, 36.5] } as const;

export const BLAST_BUNKER_VAULT_ART: readonly RebirthBuildingArt[] = [
    {
        floor: BLAST_BUNKER_VAULT_FLOOR,
        size: layoutArt(BLAST_BUNKER_VAULT_LAYOUT, BLAST_BUNKER_VAULT_FLOOR).floorSize ?? [0, 0],
    },
    {
        floor: BLAST_BUNKER_VAULT_CEILING,
        size: [BLAST_BUNKER_VAULT_ROOF.size[0] * DARK_ROOF.ppu, BLAST_BUNKER_VAULT_ROOF.size[1] * DARK_ROOF.ppu],
    },
];

/**
 * The ammunition store's crates (the floor art paints a hazard pad under each): the ammo crate in the south-east
 * corner, a crate of rounds above it, grenades beside it; `w` x `h` their footprint at their ori.
 */
export const BLAST_BUNKER_AMMO_CRATES = [
    { type: "crate_04", x: 15.25, y: 5.75, ori: 0, w: 4.5, h: 4.5 },
    { type: "crate_06", x: 16.4, y: 10.25, ori: 1, w: 2.2, h: 4.5 },
    { type: "crate_03", x: 11.425, y: 5.075, ori: 0, w: 3.15, h: 3.15 },
] as const;

/** The armoury's launcher rack: where the spare M202 lies (the floor art draws the rack). */
export const BLAST_BUNKER_RACK = { x: -10, y: 16.5 } as const;

/** The armoury's gun mounts: survev's three rarest (SPAS-16, M1100, QBB-97), west to east. */
export const BLAST_BUNKER_MOUNTS = ["gun_mount_07", "gun_mount_05", "gun_mount_03"] as const;

function vault(known: (id: string) => boolean): BuildingDef {
    const L = BLAST_BUNKER_VAULT_LAYOUT;
    const floorPos = floorArtPos(L);
    return {
        type: "building",
        map: { display: false, shapes: [] },
        terrain: { grass: true, beach: false },
        zIdx: 0,
        floor: {
            surfaces: [
                { type: "bunker", collision: [box(-18, 3, 18, 31)] },
                { type: "container", collision: [box(-18, 13, 0, 31)] },
                // the doorway strip between the wall line and the stairs' bottom edge
                { type: "bunker", collision: [box(-2, 2, 2, 3)] },
            ],
            imgs: [{ sprite: BLAST_BUNKER_VAULT_FLOOR, pos: floorPos, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [
                { zoomIn: box(-18, 3, 18, 31) },
                // the stairwell, so the doorway strip between the wall and the stair box is indoors too
                { zoomIn: box(-2, -4, 2, 3) },
            ],
            vision: { dist: 7, width: 3, linger: 0.5, fadeRate: 6 },
            imgs: [
                {
                    sprite: BLAST_BUNKER_VAULT_CEILING,
                    pos: { ...BLAST_BUNKER_VAULT_ROOF.centre },
                    scale: (ART_SCALE * REBIRTH_ART_PX_PER_UNIT) / DARK_ROOF.ppu,
                    alpha: 1,
                    tint: DARK_ROOF.tint,
                },
            ],
        },
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            // the entry hall: the guard's lockers either side of the stairs' door, the checkpoint desk
            child("locker_01", -4, 4.25, 2),
            child("locker_02", 4, 4.25, 2),
            child("table_01", 0, 9.5),
            child("loot_tier_2", 0, 9.5),
            // the medical store: a shelf and drawers along the west and south walls, the medicine on the floor
            child("bookshelf_01", -16.5, 9, 1),
            child("drawers_01", -13, 4.9, 2),
            child("loot_tier_medical", -11.5, 9),
            child("loot_tier_medical", -9, 7.5),
            child("loot_tier_medical", -13, 7.5),
            // the ammunition store: the ammo crate in the south-east corner, a crate of rounds above it, grenades beside
            // it, the launchers' rounds on the floor
            ...BLAST_BUNKER_AMMO_CRATES.map((c) => child(c.type, c.x, c.y, c.ori)),
            child(BLAST_BUNKER_ROCKET_LOOT, 9.5, 9.5),
            child("loot_tier_2", 12, 8.5),
            // the armoury: the mounts along the north wall, the gold crate in the middle, the air drop's crate on the
            // partition, the sniper crate on the west wall by the door, the AK locker on the partition, the spare M202
            // on its rack
            ...BLAST_BUNKER_MOUNTS.map((m, i) => child(m, -15.25 + i * 4.5, 29.6)),
            child("crate_11", -10.25, 22),
            child("crate_10", -2.75, 24),
            child("mil_crate_05", -16.25, 16.2, 1),
            child("locker_03", -1.25, 17, 3),
            child(BLAST_BUNKER_LAUNCHER_LOOT, BLAST_BUNKER_RACK.x, BLAST_BUNKER_RACK.y),
            child("loot_tier_airdrop_armor", -12.5, 27),
            // the commander's room: the shelf and the chest along the north wall, the desk with the gear on it, the
            // safe and the deposit box along the east wall
            child("bookshelf_01", 4, 29.5),
            child("chest_02", 9.75, 28.9),
            child("table_02", 9, 19.5),
            child("chair_01", 9, 23.25),
            child(BLAST_BUNKER_GEAR_LOOT, 9, 19.5),
            child("safe_01", 16.25, 29.15),
            child("deposit_box_03", 16.35, 20, 3),
            child("loot_tier_2", 4, 17),
        ],
    };
}

// ---------------------------------------------------------------------------------------------------------------------
// the structure

/** The mask over the basement, ending 0.01 short of the stair box (survev bunker_structure_01's ends on its edge). */
export const BLAST_BUNKER_MASK = [-18.5, 2.01, 18.5, 31.5] as const;

function structure(): StructureDef {
    const [x0, y0, x1, y1] = BLAST_BUNKER_STAIRS.collision;
    const [m0, m1, m2, m3] = BLAST_BUNKER_MASK;
    return {
        type: "structure",
        terrain: { grass: true, beach: false },
        // trees and random obstacles stay off the entrance and its approach
        mapObstacleBounds: [box(-12, -18, 12, 10)],
        layers: [
            { type: BLAST_BUNKER_ENTRANCE, pos: { x: 0, y: 0 }, ori: 0 },
            { type: BLAST_BUNKER_VAULT, pos: { x: 0, y: 0 }, ori: 0 },
        ],
        stairs: [{ collision: box(x0, y0, x1, y1), downDir: { ...BLAST_BUNKER_STAIRS.downDir } }],
        mask: [box(m0, m1, m2, m3)],
    };
}

function lootSpawner(loot: LootSpawnerDef["loot"]): LootSpawnerDef {
    return { type: "loot_spawner", loot };
}

/** The blast bunker's six map types in wire order: its loot spawners, its two buildings, the structure. */
export function blastBunkerDefs(known: (id: string) => boolean): Record<string, MapObjectDef> {
    return {
        [BLAST_BUNKER_LAUNCHER_LOOT]: lootSpawner([{ type: "m202", count: 1, props: {} }]),
        [BLAST_BUNKER_ROCKET_LOOT]: lootSpawner([
            { type: "40mm", count: 10, props: {} },
            { type: "rocket", count: 4, props: {} },
        ]),
        [BLAST_BUNKER_GEAR_LOOT]: lootSpawner([
            { type: "backpack04", count: 1, props: {} },
            { type: "helmet03", count: 1, props: {} },
            { type: "chest03", count: 1, props: {} },
        ]),
        [BLAST_BUNKER_ENTRANCE]: entrance(known),
        [BLAST_BUNKER_VAULT]: vault(known),
        [BLAST_BUNKER]: structure(),
    };
}

/** The blast bunker's images: the entrance's floor and roof, the vault's floor and dark roof. */
export const BLAST_BUNKER_ART: readonly RebirthBuildingArt[] = [BLAST_BUNKER_ENTRANCE_ART, ...BLAST_BUNKER_VAULT_ART];
