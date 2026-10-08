// clinic_01, the rebirth building of the normal map (the owner, 2026-10-08: "make a building yourself, one for the
// normal map and one only for 50v50"; docs/research/rebirth-deviations.md): a brick clinic with a lobby, two treatment
// rooms whose beds heal (heal regions like survev's camp_01, 2 HP/s, not in the gas) and a pharmacy with medical loot
// (loot_tier_medical, tier_medical). The client draws its heal regions (REBIRTH_HEAL_FX_BUILDINGS, apps/client
// objects/healRegionFx.ts).
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    artSize,
    box,
    child,
    openingChildren,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    wallChildren,
} from "./layout.ts";

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

/** The treatment rooms' heal regions (inside the rooms, clear of the walls). */
const CLINIC_WARDS = [box(-15, 3, -5.5, 10), box(-4.5, 3, 4.5, 10)];

/** Medical loot (tier_medical) for the clinic's pharmacy and treatment rooms. */
export const MEDICAL_LOOT_SPAWNER = "loot_tier_medical";

export function clinic(known: (id: string) => boolean): BuildingDef {
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
            // lobby: reception desk and cabinet, waiting chairs and couch, plants, the soda machine (no control panel:
            // survev's explode when destroyed; no planter_04: it is the chrysanthemum puzzle's button)
            child("table_01", 8.5, -2.5),
            child("stand_01", 4.75, -2.5),
            child("chair_02", 8.5, 0.75),
            child("chair_01", -13, -0.75, 2),
            child("chair_01", -10.75, -0.75, 2),
            child("chair_01", -8.5, -0.75, 2),
            child("couch_02", -5, -8.35),
            child("planter_07", -13.5, -8.5),
            child("planter_07", 13.5, -8.5),
            child("vending_01", 13.6, 0.1, 3),
            child("loot_tier_1", -4, -4),
            child("loot_tier_1", 4, -5),
            // outside: bushes by the entrance
            child("bush_01", -6, -13.25, 0, 0.9),
            child("bush_01", 6, -13.25, 0, 0.9),
        ],
    };
}
