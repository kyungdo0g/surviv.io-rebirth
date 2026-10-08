// Rebirth buildings (the owner, 2026-10-08: "make a building yourself, one for the normal map and one only for
// 50v50"; docs/research/rebirth-deviations.md). Both are built like the original houses: invisible wall obstacles
// (brick_wall_ext_* / concrete_wall_ext_*, centred on the floor's edge), original doors, windows and furniture, and a
// floor and roof image of their own. Those images are rebirth art (apps/client/public/rebirth/map/*.svg, drawn from the
// layouts here by tools/assets/rebirthBuildingArt.ts, so the walls drawn on the floor are the walls that collide).
//
// - clinic_01 (main, 1 per map): lobby with a reception desk, two treatment rooms whose beds heal (heal regions like
//   survev's camp_01, 2 HP/s, not in the gas) and a pharmacy with medical loot (loot_tier_medical, tier_medical).
// - outpost_01r / outpost_01b (50v50 only, 1 per faction, on its own side by `teamId` like bank_01 / police_01): a
//   concrete command post with an armory (the faction's crate, crate_02f / crate_22, a shotgun mount and ammo), a
//   command room with the map table and bunks, sandbags at the door; the roof carries the faction's colour.
import type { BuildingChildDef, BuildingDef, LootSpawnerDef, MapDef, MapObjectDef } from "../types/index.ts";

/** Floor and roof images are drawn at this many pixels per world unit and placed at scale 0.5 (16 px per unit). */
export const REBIRTH_ART_PX_PER_UNIT = 32;
const ART_SCALE = 0.5;

/** An axis-aligned wall from (x0, y0) to (x1, y1), 1 unit thick, centred on that line. */
export type WallSeg = readonly [x0: number, y0: number, x1: number, y1: number];

/** A door or window: the hinge (doors) or centre (windows), its ori (house_red_01's conventions), its gap. */
export interface Opening {
    readonly type: "house_door_01" | "house_window_01";
    readonly pos: { readonly x: number; readonly y: number };
    readonly ori: number;
}

export interface RebirthBuildingLayout {
    /** floor surface box: the line the exterior walls are centred on */
    readonly bounds: { readonly min: { x: number; y: number }; readonly max: { x: number; y: number } };
    readonly material: "brick" | "concrete";
    readonly walls: readonly WallSeg[];
    readonly openings: readonly Opening[];
    /** rooms (for the floor art): box, floor colour, grid colour */
    readonly rooms: ReadonlyArray<{ min: { x: number; y: number }; max: { x: number; y: number }; floor: string }>;
}

/** Floor and roof sprite ids of a rebirth building, with their image size in pixels. */
export interface RebirthBuildingArt {
    readonly floor: string;
    readonly ceiling: string;
    readonly size: readonly [number, number];
}

const box = (x0: number, y0: number, x1: number, y1: number) => ({
    type: 1 as const,
    min: { x: x0, y: y0 },
    max: { x: x1, y: y1 },
    height: 0,
});

const child = (type: BuildingChildDef["type"], x: number, y: number, ori = 0, scale = 1): BuildingChildDef => ({
    type,
    pos: { x, y },
    scale,
    ori,
});

/** The wall obstacles of `segs`: horizontal walls turn by ori 1; a length without a wall type throws. */
function wallChildren(
    material: RebirthBuildingLayout["material"],
    segs: readonly WallSeg[],
    known: (id: string) => boolean,
): BuildingChildDef[] {
    return segs.map(([x0, y0, x1, y1]) => {
        const horizontal = y0 === y1;
        if (!horizontal && x0 !== x1) throw new Error(`rebirth wall ${segs} is not axis-aligned`);
        const len = Math.abs(horizontal ? x1 - x0 : y1 - y0);
        const type = `${material}_wall_ext_${String(len).replace(".", "_")}`;
        if (!known(type)) throw new Error(`rebirth building: no wall obstacle "${type}"`);
        return child(type, (x0 + x1) / 2, (y0 + y1) / 2, horizontal ? 1 : 0);
    });
}

/** The art's size: the floor box plus the half wall outside it, at REBIRTH_ART_PX_PER_UNIT. */
function artSize(layout: RebirthBuildingLayout): [number, number] {
    const { min, max } = layout.bounds;
    return [(max.x - min.x + 1) * REBIRTH_ART_PX_PER_UNIT, (max.y - min.y + 1) * REBIRTH_ART_PX_PER_UNIT];
}

// ---------------------------------------------------------------------------------------------------------------------
// clinic_01: 31 x 21 inside its walls. North: treatment 1 | treatment 2 | pharmacy; south: the lobby.

export const CLINIC_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -15.5, y: -10.5 }, max: { x: 15.5, y: 10.5 } },
    material: "brick",
    walls: [
        // north (windows over the treatment rooms), south (main door between two windows)
        [-16, 10.5, -12, 10.5],
        [-8, 10.5, -2, 10.5],
        [2, 10.5, 16, 10.5],
        [-16, -10.5, -12, -10.5],
        [-8, -10.5, -2, -10.5],
        [2, -10.5, 8, -10.5],
        [12, -10.5, 16, -10.5],
        // west and east (a side door into the lobby each)
        [-15.5, -10, -15.5, -6],
        [-15.5, -2, -15.5, 10],
        [15.5, -10, 15.5, -6],
        [15.5, -2, 15.5, 10],
        // the corridor wall with the three room doors, the two partitions
        [-15, 2.5, -12, 2.5],
        [-8, 2.5, -2, 2.5],
        [2, 2.5, 8, 2.5],
        [12, 2.5, 15, 2.5],
        [-5, 3, -5, 10],
        [5, 3, 5, 10],
    ],
    openings: [
        { type: "house_window_01", pos: { x: -10, y: 10.75 }, ori: 1 },
        { type: "house_window_01", pos: { x: 0, y: 10.75 }, ori: 1 },
        { type: "house_window_01", pos: { x: -10, y: -10.75 }, ori: 3 },
        { type: "house_window_01", pos: { x: 10, y: -10.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -2, y: -10.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -15.75, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: 15.75, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: -12, y: 2.5 }, ori: 3 },
        { type: "house_door_01", pos: { x: -2, y: 2.5 }, ori: 3 },
        { type: "house_door_01", pos: { x: 8, y: 2.5 }, ori: 3 },
    ],
    rooms: [
        { min: { x: -15.5, y: -10.5 }, max: { x: 15.5, y: 2.5 }, floor: "lobby" },
        { min: { x: -15.5, y: 2.5 }, max: { x: -5, y: 10.5 }, floor: "ward" },
        { min: { x: -5, y: 2.5 }, max: { x: 5, y: 10.5 }, floor: "ward" },
        { min: { x: 5, y: 2.5 }, max: { x: 15.5, y: 10.5 }, floor: "pharmacy" },
    ],
};

export const CLINIC_ART: RebirthBuildingArt = {
    floor: "map-building-clinic-floor-01.img",
    ceiling: "map-building-clinic-ceiling-01.img",
    size: artSize(CLINIC_LAYOUT),
};

/** HP per second in the treatment rooms (survev camp_01 heals 2, the bathhouse side room 3). */
export const CLINIC_HEAL_RATE = 2;

/** Medical loot (tier_medical) for the clinic's pharmacy and treatment rooms. */
export const MEDICAL_LOOT_SPAWNER = "loot_tier_medical";

function clinic(known: (id: string) => boolean): BuildingDef {
    const L = CLINIC_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-16, -11, 16, 11), color: 0xc4ccd2 },
                // the red cross on the roof (tools/assets/rebirthBuildingArt.ts CLINIC_CROSS), on the map too
                { collider: box(-9.875, 4, -8.125, 9), color: 0xc8312e },
                { collider: box(-11.5, 5.625, -6.5, 7.375), color: 0xc8312e },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "tile", collision: [box(L.bounds.min.x, L.bounds.min.y, L.bounds.max.x, L.bounds.max.y)] },
            ],
            imgs: [
                { sprite: CLINIC_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff },
                {
                    sprite: "map-building-porch-01.img",
                    pos: { x: 0, y: -12 },
                    scale: 0.5,
                    alpha: 1,
                    tint: 0xffffff,
                    rot: 2,
                },
            ],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-15.5, -10.5, 15.5, 10.5), zoomOut: box(-16, -11, 16, 11) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: CLINIC_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        healRegions: [
            { collision: box(-15, 3, -5.5, 10), healRate: CLINIC_HEAL_RATE },
            { collision: box(-4.5, 3, 4.5, 10), healRate: CLINIC_HEAL_RATE },
        ],
        mapObjects: [
            ...wallChildren(L.material, L.walls, known),
            ...L.openings.map((o) => child(o.type, o.pos.x, o.pos.y, o.ori)),
            // treatment rooms: a bed, a cabinet or a stand, medical loot
            child("bed_sm_01", -13.4, 6.5),
            child({ drawers_01: 3, drawers_02: 1 }, -8.25, 8.6),
            child(MEDICAL_LOOT_SPAWNER, -10, 5.25),
            child("bed_sm_01", -3, 6.5),
            child("stand_01", 3, 8.5),
            child(MEDICAL_LOOT_SPAWNER, 1.5, 5),
            // pharmacy: shelves, two medical loot spots and a container one
            child("bookshelf_01", 11, 8.9),
            child(MEDICAL_LOOT_SPAWNER, 8, 5),
            child(MEDICAL_LOOT_SPAWNER, 11.5, 5.5),
            child("loot_tier_2", 14, 4.25),
            // lobby: reception desk, waiting chairs and couch, plants, the soda machine
            child("table_01", 8.5, -2.5),
            child("control_panel_03", 4.75, -2.5),
            child("chair_02", 8.5, 0.75),
            child("chair_01", -13, -0.75, 2),
            child("chair_01", -10.75, -0.75, 2),
            child("chair_01", -8.5, -0.75, 2),
            child("couch_02", -5, -8.35),
            child("planter_04", -13.5, -8.5),
            child("planter_04", 13.5, -8.5),
            child("vending_01", 13.6, 0.1, 3),
            child("loot_tier_1", -4, -4),
            child("loot_tier_1", 4, -5),
            // outside: bushes by the entrance
            child("bush_01", -6, -13.25, 0, 0.9),
            child("bush_01", 6, -13.25, 0, 0.9),
        ],
    };
}

// ---------------------------------------------------------------------------------------------------------------------
// outpost_01r / outpost_01b: 23 x 19 inside its walls. North: armory | command room; south: bunks and lockers.

export const OUTPOST_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -11.5, y: -9.5 }, max: { x: 11.5, y: 9.5 } },
    material: "concrete",
    walls: [
        [-12, 9.5, 12, 9.5],
        [-12, -9.5, -1.5, -9.5],
        [2.5, -9.5, 12, -9.5],
        [-11.5, -9, -11.5, -6],
        [-11.5, -2, -11.5, 9],
        [11.5, -9, 11.5, -6],
        [11.5, -2, 11.5, 9],
        [-11, 1, -8, 1],
        [-4, 1, 3, 1],
        [7, 1, 11, 1],
        [-1, 1, -1, 9],
    ],
    openings: [
        { type: "house_door_01", pos: { x: -1.5, y: -9.75 }, ori: 3 },
        { type: "house_door_01", pos: { x: -11.75, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: 11.75, y: -6 }, ori: 0 },
        { type: "house_door_01", pos: { x: -8, y: 1 }, ori: 3 },
        { type: "house_door_01", pos: { x: 3, y: 1 }, ori: 3 },
    ],
    rooms: [
        { min: { x: -11.5, y: -9.5 }, max: { x: 11.5, y: 1 }, floor: "hall" },
        { min: { x: -11.5, y: 1 }, max: { x: -1, y: 9.5 }, floor: "armory" },
        { min: { x: -1, y: 1 }, max: { x: 11.5, y: 9.5 }, floor: "command" },
    ],
};

/** The faction outposts: Red (1) and Blue (2), each with its faction crate and roof colour. */
export const OUTPOST_FACTIONS = [
    { id: "outpost_01r", teamId: 1, crate: "crate_02f", color: 0xb3261e },
    { id: "outpost_01b", teamId: 2, crate: "crate_22", color: 0x1f5fbf },
] as const;

export function outpostArt(teamId: number): RebirthBuildingArt {
    const side = teamId === 1 ? "red" : "blue";
    return {
        floor: "map-building-outpost-floor-01.img",
        ceiling: `map-building-outpost-ceiling-${side}.img`,
        size: artSize(OUTPOST_LAYOUT),
    };
}

function outpost(faction: (typeof OUTPOST_FACTIONS)[number], known: (id: string) => boolean): BuildingDef {
    const L = OUTPOST_LAYOUT;
    const art = outpostArt(faction.teamId);
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-12, -10, 12, 10), color: 0x5d6152 },
                { collider: box(-3, -2.5, 3, 2.5), color: faction.color },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        teamId: faction.teamId,
        floor: {
            surfaces: [
                { type: "bunker", collision: [box(L.bounds.min.x, L.bounds.min.y, L.bounds.max.x, L.bounds.max.y)] },
            ],
            imgs: [{ sprite: art.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-11.5, -9.5, 11.5, 9.5), zoomOut: box(-12, -10, 12, 10) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: art.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        mapObjects: [
            ...wallChildren(L.material, L.walls, known),
            ...L.openings.map((o) => child(o.type, o.pos.x, o.pos.y, o.ori)),
            // armory: the faction's crate, a shotgun on the wall, an ammo crate
            child(faction.crate, -8.5, 6.5),
            child("gun_mount_01", -4, 8.1),
            child("crate_06", -4, 3),
            // command room: the map table (survev's blueprint table), a control panel
            child("table_04", 5, 3.6),
            child("control_panel_02", 8.7, 7.3),
            child("loot_tier_2", 2.5, 7.3),
            // bunks and lockers
            child("bed_sm_01", -7.5, -7.4, 1),
            child("bed_sm_01", 7.5, -7.4, 1),
            child("locker_01", -9.3, -0.25),
            child("locker_01", -2.5, -0.25),
            child("locker_01", 0.5, -0.25),
            child("loot_tier_1", -4, -4),
            child("loot_tier_1", 5, -3.5),
            // sandbags by the door
            child("sandbags_01", -6.5, -11.8),
            child("sandbags_01", 7, -11.8),
            child("sandbags_02", -13.6, -8),
            child("sandbags_02", 13.6, -8),
        ],
    };
}

/** Sprite ids of every rebirth building image, with their size (the client's sprite manifest entries). */
export function rebirthBuildingArt(): RebirthBuildingArt[] {
    return [CLINIC_ART, ...OUTPOST_FACTIONS.map((f) => outpostArt(f.teamId))];
}

/** The rebirth buildings and the medical loot spawner; `generated` checks that every wall type exists. */
export function rebirthBuildings(generated: Readonly<Record<string, MapObjectDef>>): Record<string, MapObjectDef> {
    const known = (id: string) => Object.hasOwn(generated, id);
    const medical: LootSpawnerDef = {
        type: "loot_spawner",
        loot: [{ tier: "tier_medical", min: 1, max: 1, props: {} }],
    };
    return {
        [MEDICAL_LOOT_SPAWNER]: medical,
        clinic_01: clinic(known),
        ...Object.fromEntries(OUTPOST_FACTIONS.map((f) => [f.id, outpost(f, known)])),
    };
}

/** Where the rebirth buildings spawn: map -> fixedSpawns entries added (rebirth/index.ts applyRebirthMaps). */
export const REBIRTH_BUILDING_SPAWNS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    main: { clinic_01: 1 },
    faction: { outpost_01r: 1, outpost_01b: 1 },
};

/** The maps with the rebirth buildings in their fixed spawns (copies; a type already listed throws). */
export function applyRebirthBuildingSpawns(maps: Readonly<Record<string, MapDef>>): Record<string, MapDef> {
    const out: Record<string, MapDef> = { ...maps };
    for (const [name, spawns] of Object.entries(REBIRTH_BUILDING_SPAWNS)) {
        const def = maps[name];
        if (!def) throw new Error(`rebirth buildings: no map "${name}"`);
        const [fixed = {}, ...rest] = def.mapGen.fixedSpawns;
        for (const type of Object.keys(spawns))
            if (Object.hasOwn(fixed, type)) throw new Error(`rebirth buildings: ${name} already spawns ${type}`);
        out[name] = { ...def, mapGen: { ...def.mapGen, fixedSpawns: [{ ...fixed, ...spawns }, ...rest] } };
    }
    return out;
}
