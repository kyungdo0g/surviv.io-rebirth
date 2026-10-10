// clinic_01, the rebirth building of the normal map (the owner, 2026-10-08: "make a building yourself, one for the
// normal map and one only for 50v50"; reworked 2026-10-10: roomier, with a payoff; docs/research/rebirth-deviations.md):
// a brick clinic with a lobby, two treatment rooms that heal (heal regions like survev's camp_01, 2 HP/s, not in the
// gas), a pharmacy with medical loot (loot_tier_medical, tier_medical) and its drug safe: the switch behind the
// reception desk opens it (a one-switch puzzle like survev bathhouse_01's) onto a chest (tier_chest), a locker, level 3
// armour, medicine and a weapon drop. Its partitions are breakable wood (the owner, 2026-10-10). The client draws the
// heal regions (REBIRTH_HEAL_FX_BUILDINGS, apps/client objects/healRegionFx.ts).
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

// ---------------------------------------------------------------------------------------------------------------------
// clinic_01: 34 x 24 inside its walls (the owner's rework, 2026-10-10: room to move, a payoff behind the interaction).
// South: the lobby; north: treatment 1 | treatment 2 | the pharmacy | the drug safe (a 7 x 12 strongroom, the owner's
// "expand the content", 2026-10-10), which opens off the pharmacy when the switch behind the reception desk is
// pressed. Doorways 4 units, furniture flush against the walls or 2.6+ clear.

export const CLINIC_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -17, y: -12 }, max: { x: 17, y: 12 } },
    material: "brick",
    walls: [
        // south: the main door between two windows; north: a window over each treatment room
        ...hRun(
            -12,
            -17.5,
            17.5,
            [
                [-12.5, -8.5],
                [-2.5, 1.5],
                [8.5, 12.5],
            ],
            undefined,
            "brick",
        ),
        ...hRun(
            12,
            -17.5,
            17.5,
            [
                [-13.5, -9.5],
                [-2.5, 1.5],
            ],
            undefined,
            "brick",
        ),
        // west and east: a side door into the lobby
        ...vRun(-17, -11.5, 11.5, [[-5.5, -1.5]], undefined, "brick"),
        ...vRun(17, -11.5, 11.5, [[-5.5, -1.5]], undefined, "brick"),
        // the corridor wall with the three room doors, the two partitions (interior runs start on the outer walls'
        // centre lines: brick comes in whole units); the corridor sits a unit south of the middle so the north rooms
        // are 12 deep (the lobby keeps 10, flush with the side doors). The partitions are breakable wood (the owner,
        // 2026-10-10: "a pity: the walls can't be broken"); the drug safe's walls (its south side, x 9..17) stay brick
        ...hRun(
            -1,
            -17,
            9,
            [
                [-13, -9],
                [-5, -1],
                [3, 7],
            ],
            "wood",
            "brick",
        ),
        ...hRun(-1, 9, 17, [], undefined, "brick"),
        ...vRun(-6, -1, 12, [], "wood", "brick"),
        ...vRun(2, -1, 12, [], "wood", "brick"),
        // the drug safe, the pharmacy's east half (7 x 12 inside): its sliding door, in the middle of the wall it shares
        // with the pharmacy, slides north into that wall
        ...vRun(9, -1, 12, [[3, 7]], undefined, "brick"),
    ],
    openings: [
        op("house_window_01", -10.5, -12.25, 3),
        op("house_window_01", 10.5, -12.25, 3),
        op("house_door_01", -2.5, -12.25, 3),
        op("house_window_01", -11.5, 12.25, 1),
        op("house_window_01", -0.5, 12.25, 1),
        op("house_door_01", -17.25, -5.5, 0),
        op("house_door_01", 17.25, -5.5, 0),
        op("house_door_01", -13, -1, 3),
        op("house_door_01", -5, -1, 3),
        op("house_door_01", 3, -1, 3),
    ],
    rooms: [
        room(-17, -12, 17, -1, "lobby"),
        room(-17, -1, -6, 12, "ward"),
        room(-6, -1, 2, 12, "ward"),
        room(2, -1, 9, 12, "pharmacy"),
        room(9, -1, 17, 12, "store"),
    ],
};

/** The drug safe's door (vault_door_bathhouse: only the puzzle opens it; slides north into the wall). */
export const CLINIC_SAFE_DOOR = { type: "vault_door_bathhouse", pos: { x: 9, y: 7 }, ori: 2 } as const;
/** The clinic's puzzle: the one switch behind the reception desk. */
export const CLINIC_PUZZLE = "rebirth_clinic";
export const CLINIC_SWITCH = { x: 12, y: -2.05 } as const;

export const CLINIC_ART: RoofedBuildingArt = layoutArt(
    CLINIC_LAYOUT,
    "map-building-clinic-floor-01.img",
    "map-building-clinic-ceiling-01.img",
);

/** HP per second in the treatment rooms (survev camp_01 heals 2, the bathhouse side room 3). */
export const CLINIC_HEAL_RATE = 2;

/** The treatment rooms' heal regions (inside the rooms, clear of the walls). */
export const CLINIC_WARDS = [box(-16.5, -0.5, -6.5, 11.5), box(-5.5, -0.5, 1.5, 11.5)];

/** Medical loot (tier_medical) for the clinic's pharmacy and treatment rooms. */
export const MEDICAL_LOOT_SPAWNER = "loot_tier_medical";

export function clinic(known: (id: string) => boolean): BuildingDef {
    const L = CLINIC_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-17.5, -12.5, 17.5, 12.5), color: 0xc4ccd2 },
                // the red cross on the roof (tools/assets/rebirthBuildingArt.ts CLINIC_CROSS), on the map too
                { collider: box(-12.375, 3.5, -10.625, 8.5), color: 0xc8312e },
                { collider: box(-14, 5.125, -9, 6.875), color: 0xc8312e },
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
                    pos: { x: 0, y: -13.5 },
                    scale: 0.5,
                    alpha: 1,
                    tint: 0xffffff,
                    rot: 2,
                },
            ],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-17, -12, 17, 12), zoomOut: box(-17.5, -12.5, 17.5, 12.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: CLINIC_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(CLINIC_PUZZLE, CLINIC_SAFE_DOOR.type),
        healRegions: CLINIC_WARDS.map((collision) => ({ collision, healRate: CLINIC_HEAL_RATE })),
        // a low medical-equipment hum in each treatment room (the original's lab ambience; the bathhouse side room, the
        // original heal room, plays its steam the same way)
        soundEmitters: CLINIC_WARDS.map((w) => ({
            sound: "ambient_lab_01",
            channel: "ambient",
            pos: { x: (w.min.x + w.max.x) / 2, y: (w.min.y + w.max.y) / 2 },
            range: { min: 3, max: 10 },
            falloff: 1,
            volume: 0.15,
        })),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(CLINIC_SAFE_DOOR.type, CLINIC_SAFE_DOOR.pos.x, CLINIC_SAFE_DOOR.pos.y, CLINIC_SAFE_DOOR.ori),
            // treatment 1: a bed against the west wall, a cabinet against the partition, medicine
            child("bed_sm_01", -15.1, 8.1),
            child({ drawers_01: 3, drawers_02: 1 }, -7.6, 9, 1),
            child(MEDICAL_LOOT_SPAWNER, -11, 5),
            // treatment 2: a bed against the partition, a stand in the corner by the door (clear of its swing)
            child("bed_sm_01", -4.1, 8.1),
            child("stand_01", 0.25, 0.6),
            child(MEDICAL_LOOT_SPAWNER, -0.5, 7),
            // the pharmacy: the shelf against the partition, a locker by the safe, medicine
            child("bookshelf_01", 3.5, 8, 1),
            child("locker_01", 7.75, 10, 3),
            child(MEDICAL_LOOT_SPAWNER, 6, 5),
            child(MEDICAL_LOOT_SPAWNER, 5.5, 1.5),
            // the drug safe (the strongroom): the chest (tier_chest) in the north-east corner, a locker (locker_02) in the
            // south-east one, level 3 armour, medicine and a weapon drop
            child("chest_02", 14.9, 9.25, 1),
            child("locker_02", 15.75, 1, 3),
            child("loot_tier_airdrop_armor", 11.5, 9.5),
            child(MEDICAL_LOOT_SPAWNER, 11.5, 5),
            child(MEDICAL_LOOT_SPAWNER, 14, 5),
            child("loot_tier_2", 12, 1.5),
            // the lobby: the reception desk with the safe's switch behind it, the waiting couch, plants
            // and the soda machine (no control panel: survev's explode when destroyed; no planter_04: it is the
            // chrysanthemum puzzle's button)
            child("table_01", 11, -5),
            piece("switch_03", CLINIC_SWITCH.x, CLINIC_SWITCH.y, 2, "1"),
            child("couch_02", -15, -8.5, 1),
            child("planter_07", -7, -10),
            child("planter_07", 7, -10),
            child("vending_01", 15.1, -9.8, 3),
            child("loot_tier_1", -9, -5),
            child("loot_tier_1", 3, -6),
            // outside: bushes by the entrance
            child("bush_01", -6, -14.75, 0, 0.9),
            child("bush_01", 6, -14.75, 0, 0.9),
        ],
    };
}
