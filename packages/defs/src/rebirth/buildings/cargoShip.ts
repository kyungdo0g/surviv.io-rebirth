// cargo_ship_01, the container port's moored cargo ship (the owner's wave 3, 2026-10-10: "the container port gets port
// things like a security checkpoint and a ship"; docs/research/rebirth-deviations.md "Container port additions"). It
// lies on the water along warehouse_complex_01's quay (rebirth/buildings/port.ts), its floor the deck: a steel hull
// (metal walls) with a stepped bow, six deck containers in two columns forming lanes (3.5 along the rails, 3 between
// the columns, 4 across), three of them open with loot inside; the forecastle with mooring bitts, crates and oil
// drums; at the stern the bridge house: the wheelhouse, the crew mess, and the captain's cabin behind a sliding steel
// door that opens on the navigation-light code: the red (port) switch in the wheelhouse, then the green (starboard)
// switch in the mess, as the chart on the wheelhouse floor shows. The gangway crosses from the quay to the starboard
// rail. The cabin holds the captain's sea chest, a shotgun on its rack, a safe deposit box and floor loot.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    floorArtPos,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    roofArtPos,
    type WallSeg,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

// The hull is 23 x 76.5 between its walls' outer faces (x -11.5..11.5, y -42.5..34) and the bow runs on to y 45; inside
// the deck is 21 wide (x -10.5..10.5). The bridge house fills the stern (y -42..-26: the wheelhouse forward, the cabin
// and the mess aft), the deck runs from it to the forward bulkhead (y 34), the gangway leaves the starboard (+x) rail
// at y 1..5.
export const CARGO_SHIP_HULL = { min: { x: -11.5, y: -42.5 }, max: { x: 11.5, y: 34 } } as const;
/** The bow's tip: the hull narrows from the forward bulkhead (y 34) to here. */
export const CARGO_SHIP_BOW_TIP = 45;
/** The gangway's box (ship frame): from the starboard rail's gap to the quay. */
export const CARGO_SHIP_GANGWAY = { min: { x: 11.5, y: 1 }, max: { x: 15, y: 5 } } as const;

/**
 * The bow: the forward bulkhead (y 34..35) and steel rows stepping in towards the tip, each inside the drawn bow's
 * outline at its top edge (half widths from the outline 11.5 * (45 - y) / 11 at y = 35 + k, rounded down).
 */
function bowRows(): WallSeg[] {
    const out: WallSeg[] = [...hRun(34.5, -11.5, 11.5, [], undefined, "metal")];
    for (let k = 1; k <= 9; k++) {
        const half = Math.floor((11.5 * (CARGO_SHIP_BOW_TIP - 35 - k)) / 11);
        out.push(...hRun(34.5 + k, -half, half, [], undefined, "metal"));
    }
    return out;
}

export const CARGO_SHIP_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -11, y: -42 }, max: { x: 11, y: -26 } },
    material: "metal",
    walls: [
        // the hull: the stern, the port rail, the starboard rail with the gangway gap, the bow
        ...hRun(-42, -11.5, 11.5, [], undefined, "metal"),
        ...vRun(-11, -41.5, 34, [], undefined, "metal"),
        ...vRun(11, -41.5, 34, [[CARGO_SHIP_GANGWAY.min.y, CARGO_SHIP_GANGWAY.max.y]], undefined, "metal"),
        ...bowRows(),
        // the bridge house's front: a door on each side of the deck, the wheelhouse window in the middle
        ...hRun(
            -26,
            -10.5,
            10.5,
            [
                [-8.5, -4.5],
                [-2.5, 1.5],
                [4.5, 8.5],
            ],
            undefined,
            "metal",
        ),
        // wheelhouse | aft (y -33): the cabin's sliding door (slides east into the wall), the mess door by the starboard rail
        ...hRun(
            -33,
            -10.5,
            10.5,
            [
                [-6.5, -2.5],
                [6.5, 10.5],
            ],
            undefined,
            "metal",
        ),
        // cabin | mess
        ...vRun(1, -41.5, -33.5, [], undefined, "metal"),
    ],
    openings: [
        op("house_door_01", -8.5, -25.75, 3),
        op("house_window_01", -0.5, -25.75, 1),
        op("house_door_01", 4.5, -25.75, 3),
        op("house_door_01", 6.5, -33, 3),
    ],
    rooms: [
        // inside the hull's walls (the hull is drawn as the hull, not as walls)
        room(-10.5, -33, 10.5, -26, "wheelhouse"),
        room(-10.5, -41.5, 1, -33, "cabin"),
        room(1, -41.5, 10.5, -33, "mess"),
    ],
    outdoor: [
        room(CARGO_SHIP_HULL.min.x, CARGO_SHIP_HULL.min.y, CARGO_SHIP_HULL.max.x, CARGO_SHIP_BOW_TIP, "deck"),
        room(
            CARGO_SHIP_GANGWAY.min.x,
            CARGO_SHIP_GANGWAY.min.y,
            CARGO_SHIP_GANGWAY.max.x,
            CARGO_SHIP_GANGWAY.max.y,
            "gangway",
        ),
    ],
};

/** The captain's cabin's door (vault_door_bathhouse: only the puzzle opens it; slides east into the wall). */
export const CARGO_SHIP_CABIN_DOOR = { type: "vault_door_bathhouse", pos: { x: -2.5, y: -33 }, ori: 1 } as const;
export const CARGO_SHIP_PUZZLE = "rebirth_cargo_ship";
/** The navigation-light switches: red (port side, the wheelhouse), green (starboard side, the mess). */
export const CARGO_SHIP_SWITCHES = [
    { label: "red", x: -9.95, y: -30, ori: 1 },
    { label: "green", x: 9.95, y: -37.5, ori: 3 },
] as const;
export const CARGO_SHIP_CODE: readonly string[] = ["red", "green"];
/** Where the chart with the code lies (the wheelhouse floor, behind the helm). */
export const CARGO_SHIP_NOTE = { x: 4, y: -32 } as const;

/**
 * The deck containers (survev's container buildings): the closed ones (container_05) and the open ones (an end open
 * onto a cross lane, loot inside), centre x and the child's y (ship frame); columns at x -4.25 and 4.25.
 */
export const CARGO_SHIP_CONTAINERS = [
    { type: "container_05", x: -4.25, y: -17.9, ori: 0 },
    { type: "container_03", x: 4.25, y: -18.1, ori: 0 },
    { type: "container_01", x: -4.25, y: -2.1, ori: 0 },
    { type: "container_05", x: 4.25, y: -1.9, ori: 0 },
    { type: "container_05", x: -4.25, y: 14.1, ori: 0 },
    { type: "container_02", x: 4.25, y: 19.1, ori: 2 },
] as const;

export const CARGO_SHIP_ART: RoofedBuildingArt = layoutArt(
    CARGO_SHIP_LAYOUT,
    "map-building-cargo-ship-floor-01.img",
    "map-building-cargo-ship-ceiling-01.img",
);

const H = CARGO_SHIP_HULL;
const G = CARGO_SHIP_GANGWAY;

export function cargoShip(known: (id: string) => boolean): BuildingDef {
    const L = CARGO_SHIP_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(H.min.x, H.min.y, H.max.x, H.max.y), color: 0x7a2e2a },
                { collider: box(-6, H.max.y, 6, 41), color: 0x7a2e2a },
                { collider: box(-11.5, -42.5, 11.5, -25.5), color: 0xe8e6df },
                { collider: box(G.min.x, G.min.y, G.max.x, G.max.y), color: 0x8a8f94 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            // the deck first (the layout test reads surfaces[0]), then the bridge house and the gangway
            surfaces: [
                { type: "container", collision: [box(H.min.x, H.min.y, H.max.x, H.max.y)] },
                { type: "house", collision: [box(-10.5, -41.5, 10.5, -26.5)] },
                { type: "container", collision: [box(G.min.x - 1, G.min.y, G.max.x, G.max.y)] },
            ],
            imgs: [
                {
                    sprite: CARGO_SHIP_ART.floor,
                    pos: floorArtPos(L),
                    scale: ART_SCALE,
                    alpha: 1,
                    tint: 0xffffff,
                },
            ],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-10.5, -41.5, 10.5, -26.5), zoomOut: box(-11.5, -42.5, 11.5, -25.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [
                {
                    sprite: CARGO_SHIP_ART.ceiling,
                    pos: roofArtPos(L),
                    scale: ART_SCALE,
                    alpha: 1,
                    tint: 0xffffff,
                },
            ],
        },
        puzzle: rebirthPuzzle(CARGO_SHIP_PUZZLE, CARGO_SHIP_CABIN_DOOR.type),
        // the engine's idle under the deck (the clinic's hum)
        soundEmitters: [
            {
                sound: "ambient_lab_01",
                channel: "ambient",
                pos: { x: 0, y: -30 },
                range: { min: 3, max: 10 },
                falloff: 1,
                volume: 0.1,
            },
        ],
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(
                CARGO_SHIP_CABIN_DOOR.type,
                CARGO_SHIP_CABIN_DOOR.pos.x,
                CARGO_SHIP_CABIN_DOOR.pos.y,
                CARGO_SHIP_CABIN_DOOR.ori,
            ),
            ...CARGO_SHIP_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            // the wheelhouse: the helm console (steel, indestructible) under the forward window, a drop behind it
            child("table_07", -0.5, -27.85, 2),
            child("loot_tier_2", -5.5, -31.5),
            // the mess: the table against the cabin wall, the fridge by the stern, a drop
            child("table_01", 3.5, -37.5, 1),
            child("refrigerator_01", 8, -40.1, 2),
            child("loot_tier_1", 7, -36.5),
            // the captain's cabin: the sea chest against the port side, the shotgun rack on the stern wall, the safe
            // deposit box against the mess wall, floor loot
            child("chest_01", -8.9, -39.25, 1),
            child("gun_mount_01", -4.5, -40.6, 2),
            child("deposit_box_03", -0.65, -38, 3),
            child("loot_tier_2", -5, -37),
            // the deck containers
            ...CARGO_SHIP_CONTAINERS.map((c) => child(c.type, c.x, c.y, c.ori)),
            // drops in the lanes
            child("loot_tier_1", -8.75, -7.5),
            child("loot_tier_1", 8.75, 8.5),
            child("loot_tier_1", 0, -23.5),
            // the forecastle: crates against the rails and the bulkhead, a mooring bitt, two oil drums
            child("crate_01", -8.25, 31.75),
            child("crate_02", 8.25, 31.75),
            child("bollard_01", 0, 32),
            child("barrel_01", -4, 27.5),
            child("barrel_01", 4, 27.5),
            child("loot_tier_2", 0, 26),
        ],
    };
}
