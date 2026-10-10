// port_checkpoint_01, the container port's security checkpoint (the owner's wave 3, 2026-10-10: "the container port
// gets port things like a security checkpoint"; docs/research/rebirth-deviations.md "Container port additions"). It
// stands in the port's land-side corner (warehouse_complex_01's free north-east notch, rebirth/buildings/port.ts): the
// road from inland runs through it, past a guard booth on a traffic island, with a vehicle barrier in each lane (a
// yellow bollard and a low striped arm that leaves a 3-unit walkway). North of the road the screening terminal: the
// screening hall with three walk-through scanner gates (low frames, 3- and 4-unit lanes) and the x-ray baggage
// scanner along its north wall, the confiscation locker room, and behind it the evidence vault, whose sliding door
// opens on the switch in the guard booth (a one-switch puzzle like the clinic's): confiscated weapons (a gun rack, a
// sniper crate, a pistol case, a safe deposit box) and level 3 armour.
import type { BuildingDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    floorArtPos,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    roofArtPos,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

// The checkpoint's plaza is 35 x 36 (x -17.5..17.5, y -18..18; the notch of the complex it fills). The terminal is
// 34 x 15 (x -17..17, y 2..17): hall (x 3..17) | locker room (x -6..3) | evidence vault (x -17..-6). The road below it
// (y -18..1.5): the north lane 6 wide, the booth island (x -4..4, y -13..-5), the south lane 4.5 wide.
export const PORT_CHECKPOINT_PLAZA = { min: { x: -17.5, y: -18 }, max: { x: 17.5, y: 18 } } as const;

/** The guard booth's walls (its own roof image: PORT_BOOTH_LAYOUT). */
export const PORT_BOOTH_BOUNDS = { min: { x: -4, y: -13 }, max: { x: 4, y: -5 } } as const;

export const PORT_CHECKPOINT_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -17, y: 2 }, max: { x: 17, y: 17 } },
    material: "concrete",
    walls: [
        // the terminal's south wall: the locker room's window, the hall's exit door onto the road
        ...hRun(2, -17.5, 17.5, [
            [-3, 1],
            [4, 8],
        ]),
        ...hRun(17, -17.5, 17.5),
        ...vRun(-17, 2.5, 16.5),
        // the east wall: the entrance from inland
        ...vRun(17, 2.5, 16.5, [[4, 8]]),
        // hall | locker room: breakable wood with the door; locker room | vault: concrete with the vault's sliding door
        // (the owner, 2026-10-10: partitions break, a hidden room's walls do not)
        // (two wooden panels south of the door, the one beside the hall's exit and the one beside the gates)
        ...vRun(3, 2.5, 7.5, [], "wood"),
        ...vRun(3, 7.5, 16.5, [[11.5, 15.5]], "wood"),
        ...vRun(-6, 2.5, 16.5, [[4, 8]]),
        // the x-ray baggage scanner: a 10 x 2 steel body flush against the hall's north wall (drawn on the floor)
        ...hRun(15, 6.5, 16.5, [], "metal"),
        ...hRun(16, 6.5, 16.5, [], "metal"),
        // the guard booth on the traffic island: windows north, south and east, the door west (towards the port)
        ...hRun(-5, -4.5, 4.5, [[-1.5, 2.5]]),
        ...hRun(-13, -4.5, 4.5, [[-1.5, 2.5]]),
        ...vRun(-4, -12.5, -5.5, [[-11, -7]]),
        ...vRun(4, -12.5, -5.5, [[-11, -7]]),
    ],
    openings: [
        op("house_window_01", -1, 1.75, 3),
        op("house_door_01", 4, 1.75, 3),
        op("house_door_01", 17.25, 4, 0),
        op("house_door_01", 3, 11.5, 0),
        op("house_window_01", 0.5, -4.75, 1),
        op("house_window_01", 0.5, -13.25, 3),
        op("house_door_01", -4.25, -11, 0),
        op("house_window_01", 4.25, -9, 0),
        // the walk-through scanner gates' low frames (players pass the lanes, bullets pass over the frames)
        op("brick_wall_ext_3_0_low", 9.5, 7, 1),
        op("brick_wall_ext_3_0_low", 9.5, 11, 1),
        // the vehicle barriers' arms (low: bullets pass), each from its bollard across part of its lane
        op("brick_wall_ext_3_0_low", 10, -3, 0),
        op("brick_wall_ext_3_0_low", -10, -15, 0),
    ],
    rooms: [
        room(3, 2, 17, 17, "hall"),
        room(-6, 2, 3, 17, "lockers"),
        room(-17, 2, -6, 17, "vault"),
        room(-4, -13, 4, -5, "booth"),
    ],
    outdoor: [room(-17.5, -18, 17.5, 18, "road")],
};

/** The booth's roof (an image of its own: the terminal's roof covers the terminal only). */
export const PORT_BOOTH_LAYOUT: RebirthBuildingLayout = {
    bounds: PORT_BOOTH_BOUNDS,
    material: "concrete",
    walls: [],
    openings: [],
    rooms: [],
};

/** The evidence vault's sliding door (only the puzzle opens it; slides north into the wall). */
export const PORT_VAULT_DOOR = { type: "vault_door_bathhouse", pos: { x: -6, y: 8 }, ori: 2 } as const;
export const PORT_CHECKPOINT_PUZZLE = "rebirth_port_checkpoint";
/** The release switch on the booth's north wall, beside its window. */
export const PORT_BOOTH_SWITCH = { x: -2.75, y: -6.05, ori: 0 } as const;
/** The scanner gate lanes (y ranges) between the hall's south wall, the two frames and the x-ray scanner. */
export const PORT_SCANNER_LANES: ReadonlyArray<readonly [number, number]> = [
    [2.5, 6.5],
    [7.5, 10.5],
    [11.5, 14.5],
];

export const PORT_CHECKPOINT_ART: RoofedBuildingArt = layoutArt(
    PORT_CHECKPOINT_LAYOUT,
    "map-building-port-checkpoint-floor-01.img",
    "map-building-port-checkpoint-ceiling-01.img",
);
/** The booth's roof image (listed apart: a record without a floor of its own). */
export const PORT_BOOTH_ART: RebirthBuildingArt = {
    floor: "map-building-port-booth-ceiling-01.img",
    size: layoutArt(PORT_BOOTH_LAYOUT, "").size,
};

const P = PORT_CHECKPOINT_PLAZA;
const B = PORT_BOOTH_BOUNDS;

export function portCheckpoint(known: (id: string) => boolean): BuildingDef {
    const L = PORT_CHECKPOINT_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-17.5, 1.5, 17.5, 17.5), color: 0x3f5f7a },
                { collider: box(-4.5, -13.5, 4.5, -4.5), color: 0xd9a21b },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            // the whole plaza first (the layout test reads surfaces[0]); later surfaces win where they overlap
            surfaces: [
                { type: "asphalt", collision: [box(P.min.x, P.min.y, P.max.x, P.max.y)] },
                { type: "tile", collision: [box(-17, 2, 17, 17)] },
                { type: "bunker", collision: [box(-17, 2, -6, 17)] },
                { type: "house", collision: [box(B.min.x, B.min.y, B.max.x, B.max.y)] },
            ],
            imgs: [
                {
                    sprite: PORT_CHECKPOINT_ART.floor,
                    pos: floorArtPos(L),
                    scale: ART_SCALE,
                    alpha: 1,
                    tint: 0xffffff,
                },
            ],
        },
        ceiling: {
            zoomRegions: [
                { zoomIn: box(-17, 2, 17, 17), zoomOut: box(-17.5, 1.5, 17.5, 17.5) },
                { zoomIn: box(B.min.x, B.min.y, B.max.x, B.max.y), zoomOut: box(-4.5, -13.5, 4.5, -4.5) },
            ],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [
                {
                    sprite: PORT_CHECKPOINT_ART.ceiling,
                    pos: roofArtPos(L),
                    scale: ART_SCALE,
                    alpha: 1,
                    tint: 0xffffff,
                },
                {
                    sprite: PORT_BOOTH_ART.floor,
                    pos: roofArtPos(PORT_BOOTH_LAYOUT),
                    scale: ART_SCALE,
                    alpha: 1,
                    tint: 0xffffff,
                },
            ],
        },
        puzzle: rebirthPuzzle(PORT_CHECKPOINT_PUZZLE, PORT_VAULT_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(PORT_VAULT_DOOR.type, PORT_VAULT_DOOR.pos.x, PORT_VAULT_DOOR.pos.y, PORT_VAULT_DOOR.ori),
            piece("switch_03", PORT_BOOTH_SWITCH.x, PORT_BOOTH_SWITCH.y, PORT_BOOTH_SWITCH.ori, "1"),
            // the guard booth: the console with its drawers against the east window, a drop on the floor
            child("drawers_01", 2.1, -9, 3),
            child("loot_tier_1", -1.25, -10.75),
            // the vehicle barriers' posts
            child("bollard_01", 10, -5.75),
            child("bollard_01", -10, -12.25),
            // the screening hall: loot in the open west end and by the entrance
            child("loot_tier_2", 5.5, 9),
            child("loot_tier_1", 14, 9),
            child("loot_tier_1", 13.5, 4.5),
            // the confiscation locker room: lockers along the north and west walls, a crate of seized goods under the
            // south window (the way to the vault door stays 3.5 wide)
            child("locker_01", -4, 15.75),
            child("locker_01", -1, 15.75),
            child("locker_01", -4.75, 12.5, 1),
            child("crate_01", 0.25, 4.75),
            child("loot_tier_1", -1, 10),
            // the evidence vault: a safe deposit box by the south wall, a pistol case and a sniper crate against the west
            // wall, a shotgun rack on the east wall, level 3 armour and a drop on the floor
            child("deposit_box_02", -13.5, 3.65, 2),
            child("case_01", -14.9, 7.25, 1),
            child("mil_crate_05", -15.25, 12.5, 1),
            child("gun_mount_01", -7.4, 13.5, 3),
            child("loot_tier_airdrop_armor", -10.5, 9),
            child("loot_tier_2", -9, 6),
        ],
    };
}
