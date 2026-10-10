// subway_station_01, the abandoned subway station (the owner's wave 3, 2026-10-10: "an abandoned subway station
// entrance: no way in until strong firepower blasts its door, pitch dark inside, shots and explosions give brief light";
// docs/research/rebirth-deviations.md "The abandoned subway station"), on the normal map. A structure of two floors:
// the station entrance kiosk on the street (subway_entrance_01, 14 x 12, a flat roof with the metro sign) whose stairs
// down are shut by a rusted shutter (subway_gate_01: only launcher and rocket rounds and air strike bombs open it,
// rebirth/buildings/blastDoors.ts), and the station underground (subway_platform_01, subwayStation.ts), unlit
// (StructureLayerDef.dark). Both floors are authored in the structure's frame and sit at its origin with ori 0.
import type { BuildingDef, MapObjectDef, StructureDef } from "../../types/index.ts";
import { SUBWAY_GATE } from "./blastDoors.ts";
import {
    box,
    child,
    layoutArt,
    openingChildren,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    roofArtPos,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";
import { SUBWAY_PLATFORM_ART, SUBWAY_STAIR, subwayPlatform } from "./subwayStation.ts";

export const SUBWAY_STRUCTURE = "subway_station_01";
export const SUBWAY_ENTRANCE = "subway_entrance_01";
export const SUBWAY_PLATFORM = "subway_platform_01";

/** The shutter across the top of the stairs (ori 1: 4 wide across the flight, 1 deep), a layer-0 child of the kiosk. */
export const SUBWAY_GATE_AT = { x: 0, y: 23.5, ori: 1 } as const;

/** The metro sign on the kiosk's roof (its disc's centre and radius) and its colours (the map shapes, the art). */
export const SUBWAY_SIGN = { x: 0, y: 25, r: 2.2, disc: 0x2a64b8, letter: 0xf4f4f0 } as const;

// 14 x 12 inside (x -7..7, y 16.5..28.5): the open doorway north, a window east and west; the stairs (x -2..2,
// y 17..23, down south) walled on both sides, the shutter across their top end; 3.5-wide aisles either side.
export const SUBWAY_ENTRANCE_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -7, y: 16.5 }, max: { x: 7, y: 28.5 } },
    material: "concrete",
    walls: [
        // south: the closer at the stairs' foot; north: the open doorway (no door: a rocket flies in from the street)
        ...hRun(16.5, -7.5, 7.5),
        ...hRun(28.5, -7.5, 7.5, [[-2, 2]]),
        ...vRun(-7, 17, 28, [[21, 25]]),
        ...vRun(7, 17, 28, [[21, 25]]),
        // the stairwell's long sides, from the closer to the shutter's far edge
        ...vRun(-2.5, 17, 24),
        ...vRun(2.5, 17, 24),
    ],
    openings: [op("house_window_01", -7.25, 23, 0), op("house_window_01", 7.25, 23, 0)],
    rooms: [room(-7, 16.5, 7, 28.5, "kiosk"), room(-2, 17, 2, 23, "stairs")],
};

export const SUBWAY_ENTRANCE_ART: RoofedBuildingArt = layoutArt(
    SUBWAY_ENTRANCE_LAYOUT,
    "map-building-subway-entrance-floor-01.img",
    "map-building-subway-entrance-ceiling-01.img",
);

/** The station's images: the kiosk's floor and roof, the platform's floor and dark roof. */
export const SUBWAY_ART: readonly RebirthBuildingArt[] = [SUBWAY_ENTRANCE_ART, SUBWAY_PLATFORM_ART];

function subwayEntrance(known: (id: string) => boolean): BuildingDef {
    const L = SUBWAY_ENTRANCE_LAYOUT;
    const inside = box(-7, 16.5, 7, 28.5);
    const at = roofArtPos(L);
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-7.5, 16, 7.5, 29), color: 0x50565c },
                {
                    collider: { type: 0, pos: { x: SUBWAY_SIGN.x, y: SUBWAY_SIGN.y }, rad: 2.5 },
                    color: SUBWAY_SIGN.disc,
                },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [{ type: "tile", collision: [inside] }],
            imgs: [{ sprite: SUBWAY_ENTRANCE_ART.floor, pos: at, scale: 0.5, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: inside, zoomOut: box(-7.5, 16, 7.5, 29) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: SUBWAY_ENTRANCE_ART.ceiling, pos: at, scale: 0.5, alpha: 1, tint: 0xffffff }],
        },
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(SUBWAY_GATE, SUBWAY_GATE_AT.x, SUBWAY_GATE_AT.y, SUBWAY_GATE_AT.ori),
            // the aisles: a newspaper bin against the closer, loot by the windows
            child("barrel_02", 4.75, 18.75),
            child("loot_tier_1", -4.75, 21),
            // outside, either side of the doorway
            child("bush_01", -5, 30.6),
            child("bush_01", 5, 30.6),
        ],
    };
}

function subwayStructure(): StructureDef {
    const [x0, y0, x1, y1] = SUBWAY_STAIR.box;
    return {
        type: "structure",
        terrain: { grass: true, beach: false },
        // trees and random obstacles keep off the kiosk and its doorway (the station below may lie under them)
        mapObstacleBounds: [box(-11, 13, 11, 34)],
        layers: [
            { type: SUBWAY_ENTRANCE, pos: { x: 0, y: 0 }, ori: 0 },
            { type: SUBWAY_PLATFORM, pos: { x: 0, y: 0 }, ori: 0, dark: true },
        ],
        stairs: [{ collision: box(x0, y0, x1, y1), downDir: { ...SUBWAY_STAIR.downDir } }],
        // the station ending 0.01 short of the stair box (survev's bunker masks end on their stair's bottom edge)
        mask: [box(-32.5, -16.5, 32.5, y0 - 0.01)],
    };
}

/** The station's three map types in wire order: the kiosk, the platform, the structure. */
export function subwayDefs(known: (id: string) => boolean): Record<string, MapObjectDef> {
    return {
        [SUBWAY_ENTRANCE]: subwayEntrance(known),
        [SUBWAY_PLATFORM]: subwayPlatform(known),
        [SUBWAY_STRUCTURE]: subwayStructure(),
    };
}
