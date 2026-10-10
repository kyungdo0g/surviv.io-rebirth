// apartment_01, a wave-3 rebirth building of the normal map (the owner, 2026-10-10: "an apartment block";
// docs/research/rebirth-deviations.md "Apartment block"): a brick block of six flats on a central corridor, a lobby
// with the mailboxes and the stairwell, the caretaker's office and, behind a sliding steel door, the caretaker's
// storeroom. Each flat has a living room, a kitchen (a fridge and an oven: survev's oven_01 explodes like a barrel when
// destroyed, furnitureDefs.ts createOven), a bedroom and a bathroom, split by breakable wood partitions (the owner,
// 2026-10-10); a chest of drawers, a nightstand, the toilet and the basin are its loot. The switch above the
// caretaker's desk opens the storeroom (a one-switch puzzle like survev bathhouse_01's): a chest (tier_chest), the
// caretaker's pump shotgun on its wall mount, a police locker, a sledgehammer and loot. The shell, the corridor and
// party walls and the storeroom stay brick.
import type { BuildingChildDef, BuildingDef, MapObjectDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    layoutArt,
    type Opening,
    openingChildren,
    piece,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    type Room,
    rebirthPuzzle,
    type WallSeg,
    wallChildren,
} from "./layout.ts";
import { hRun, op, room, vRun } from "./military/part.ts";

// ---------------------------------------------------------------------------------------------------------------------
// 62 x 32 inside (x -31..31, y -16..16). The corridor (4 clear) runs east-west at y -2.5..2.5 from the fire exit in
// the west wall to the lobby; three flats north of it and three south (16 x 13.5 each, x0 = -31, -15, 1), the service
// wing east of x 17: the lobby (south, the front door), its arm with the stairwell, the caretaker's office (x 23..31,
// y -3..7) and the storeroom along the north wall (y 7..16). Brick comes in whole units, the outer runs start half a
// unit outside the floor. Doorways 4 units, passages 3 or more, furniture flush against the walls or 2.6+ clear.

/** The flats' west walls (x0) and sides: three north of the corridor, three south (mirrored). */
export const APARTMENT_FLATS: ReadonlyArray<{ readonly x0: number; readonly north: boolean }> = [
    { x0: -31, north: true },
    { x0: -15, north: true },
    { x0: 1, north: true },
    { x0: -31, north: false },
    { x0: -15, north: false },
    { x0: 1, north: false },
];
/** A flat's depth from the corridor wall line to the outer wall line, and its width. */
const FLAT_D = 13.5;
const FLAT_W = 16;
/** In a flat's frame (x from its west wall, y from the corridor wall line outwards): the living-room | kitchen and
 * bedroom | bathroom partition, and the front | back partition. */
const PART_X = 8;
const PART_Y = 6.5;

/** A flat's frame -> the building's: y grows away from the corridor (north or south). */
const flatY = (north: boolean, l: number) => (north ? 2.5 + l : -2.5 - l);
const span = (north: boolean, a: number, b: number): [number, number] => {
    const [p, q] = [flatY(north, a), flatY(north, b)];
    return p < q ? [p, q] : [q, p];
};

function flatWalls(x0: number, north: boolean): WallSeg[] {
    const [y0, y1] = span(north, 0, FLAT_D);
    const yB = flatY(north, PART_Y);
    return [
        // the living room | kitchen and bedroom | bathroom partition: the kitchen's doorway at its corridor end
        ...vRun(x0 + PART_X, y0, y1, [span(north, 3, PART_Y)], "wood"),
        // the front | back partition: the bedroom's doorway, the bathroom's door
        ...hRun(
            yB,
            x0,
            x0 + FLAT_W,
            [
                [x0 + 4, x0 + 8],
                [x0 + 9, x0 + 13],
            ],
            "wood",
        ),
    ];
}

function flatOpenings(x0: number, north: boolean): Opening[] {
    const out = flatY(north, FLAT_D) + (north ? 0.25 : -0.25);
    const ori = north ? 1 : 3;
    return [
        // the front door off the corridor, the bathroom door
        op("house_door_01", x0 + 3, flatY(north, 0), 3),
        op("house_door_01", x0 + 9, flatY(north, PART_Y), 3),
        // a window over the bed and one over the basin
        op("house_window_01", x0 + 3.5, out, ori),
        op("house_window_01", x0 + 11.5, out, ori),
    ];
}

function flatRooms(x0: number, north: boolean): Room[] {
    const r = (a: number, b: number, c: number, d: number, floor: string) => {
        const [y0, y1] = span(north, b, d);
        return room(x0 + a, y0, x0 + c, y1, floor);
    };
    return [
        r(0, 0, PART_X, PART_Y, "living"),
        r(PART_X, 0, FLAT_W, PART_Y, "kitchen"),
        r(0, PART_Y, PART_X, FLAT_D, "bedroom"),
        r(PART_X, PART_Y, FLAT_W, FLAT_D, "bath"),
    ];
}

/** A furniture type's collider box about its centre at ori 0 (circles as their box). */
type Colliders = (type: string) => { min: { x: number; y: number }; max: { x: number; y: number } };

/** The collider box at `ori` (rotated like the sim's transformOri: ori 1 turns +y to -x). */
function rotatedBounds(cols: Colliders, type: string, ori: number) {
    const { min, max } = cols(type);
    const rot = (x: number, y: number): readonly [number, number] => {
        const o = ori & 3;
        return o === 1 ? [-y, x] : o === 2 ? [-x, -y] : o === 3 ? [y, -x] : [x, y];
    };
    const [ax, ay] = rot(min.x, min.y);
    const [bx, by] = rot(max.x, max.y);
    return { min: { x: Math.min(ax, bx), y: Math.min(ay, by) }, max: { x: Math.max(ax, bx), y: Math.max(ay, by) } };
}

const firstType = (type: BuildingChildDef["type"]) => (typeof type === "string" ? type : Object.keys(type)[0]);

/** A child whose collider box at `ori` has its min corner at (x0, y0): furniture colliders sit off their centre. */
function fit(cols: Colliders, type: BuildingChildDef["type"], ori: number, x0: number, y0: number): BuildingChildDef {
    const b = rotatedBounds(cols, firstType(type), ori);
    return child(type, x0 - b.min.x, y0 - b.min.y, ori);
}

/**
 * A flat's furniture in its frame (x from its west wall, y away from the corridor): each box's min corner and its ori,
 * the back against the wall. Living room: the chest of drawers against the party wall; bedroom: the nightstand by the
 * doorway and the bed under the window (0.7 apart, a gap nobody walks); kitchen: the fridge and the oven along the far
 * party wall, a 3.6 lane beside them; bathroom: the basin under the window, the toilet in the corner.
 */
const FLAT_PROPS: ReadonlyArray<readonly [type: BuildingChildDef["type"], ori: number, x: number, y: number]> = [
    [{ drawers_01: 3, drawers_02: 1 }, 1, 0.5, 0.5],
    ["stand_01", 1, 0.5, 7],
    ["bed_sm_01", 1, 0.5, 10.2],
    ["refrigerator_01", 2, 12.1, 0.5],
    ["oven_01", 0, 12.1, 3.4],
    ["sink_01", 0, 8.5, 10],
    ["toilet_01", 0, 13.14, 10.64],
];

function flatProps(cols: Colliders, x0: number, north: boolean, i: number): BuildingChildDef[] {
    const out = FLAT_PROPS.map(([type, ori, x, y]) => {
        // the south flats mirror the north ones: an ori facing along y turns round
        const o = north || ori % 2 === 1 ? ori : (ori + 2) % 4;
        const b = rotatedBounds(cols, firstType(type), o);
        const y0 = north ? flatY(true, y) : flatY(false, y) - (b.max.y - b.min.y);
        return fit(cols, type, o, x0 + x, y0);
    });
    // floor loot in every other kitchen lane (the containers already give each flat four loot sources)
    if (i % 2 === 0) out.push(child("loot_tier_1", x0 + 10.3, flatY(north, 3)));
    return out;
}

export const APARTMENT_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -31, y: -16 }, max: { x: 31, y: 16 } },
    material: "brick",
    walls: [
        // north and south: a window over each flat's bed and basin; the front door into the lobby (south)
        ...hRun(
            16,
            -31.5,
            31.5,
            [-31, -15, 1].flatMap((x0) => [[x0 + 1.5, x0 + 5.5] as const, [x0 + 9.5, x0 + 13.5] as const]),
            undefined,
            "brick",
        ),
        ...hRun(
            -16,
            -31.5,
            31.5,
            [
                ...[-31, -15, 1].flatMap((x0) => [[x0 + 1.5, x0 + 5.5] as const, [x0 + 9.5, x0 + 13.5] as const]),
                [22.5, 26.5],
            ],
            undefined,
            "brick",
        ),
        // west: the corridor's fire exit; east: a lobby window
        ...vRun(-31, -15.5, 15.5, [[-2, 2]], undefined, "brick"),
        ...vRun(31, -15.5, 15.5, [[-12.5, -8.5]], undefined, "brick"),
        // the corridor walls with the flats' front doors (brick: each flat its own unit)
        ...hRun(
            2.5,
            -31,
            17,
            [-31, -15, 1].map((x0) => [x0 + 3, x0 + 7] as const),
            undefined,
            "brick",
        ),
        ...hRun(
            -2.5,
            -31,
            17,
            [-31, -15, 1].map((x0) => [x0 + 3, x0 + 7] as const),
            undefined,
            "brick",
        ),
        // the party walls; the service wing's west wall (the corridor runs on into the lobby's arm)
        ...vRun(-15, 2.5, 16, [], undefined, "brick"),
        ...vRun(1, 2.5, 16, [], undefined, "brick"),
        ...vRun(17, 2.5, 16, [], undefined, "brick"),
        ...vRun(-15, -16, -2.5, [], undefined, "brick"),
        ...vRun(1, -16, -2.5, [], undefined, "brick"),
        ...vRun(17, -16, -2.5, [], undefined, "brick"),
        // the flats' wood partitions
        ...APARTMENT_FLATS.flatMap((f) => flatWalls(f.x0, f.north)),
        // the storeroom's wall (its sliding door at the east end slides west into it), the caretaker's office walls
        ...hRun(7, 17, 31, [[26, 30]], undefined, "brick"),
        ...vRun(23, -3, 7, [[-2, 2]], undefined, "brick"),
        ...hRun(-3, 23, 31, [], undefined, "brick"),
    ],
    openings: [
        ...APARTMENT_FLATS.flatMap((f) => flatOpenings(f.x0, f.north)),
        op("house_door_01", -31.25, -2, 0),
        op("house_door_01", 22.5, -16.25, 3),
        op("house_window_01", 31.25, -10.5, 0),
        op("house_door_01", 23, -2, 0),
    ],
    rooms: [
        room(-31, -2.5, 17, 2.5, "corridor"),
        ...APARTMENT_FLATS.flatMap((f) => flatRooms(f.x0, f.north)),
        room(17, -16, 31, -3, "lobby"),
        room(17, -3, 23, 7, "lobby"),
        room(23, -3, 31, 7, "office"),
        room(17, 7, 31, 16, "store"),
    ],
};

/** The stairwell drawn at the north end of the lobby's arm (art only: the upper floors are not shown). */
export const APARTMENT_STAIRS = { min: { x: 17.5, y: 2.5 }, max: { x: 22.5, y: 6.5 } } as const;

/** The storeroom's door (vault_door_bathhouse: only the puzzle opens it; slides 3.75 west into the wall). */
export const APARTMENT_STORE_DOOR = { type: "vault_door_bathhouse", pos: { x: 26, y: 7 }, ori: 3 } as const;
/** The apartment's puzzle: the one switch on the office's east wall, above the caretaker's desk. */
export const APARTMENT_PUZZLE = "rebirth_apartment";
export const APARTMENT_SWITCH = { x: 29.95, y: 4.25, ori: 3 } as const;

export const APARTMENT_ART: RoofedBuildingArt = layoutArt(
    APARTMENT_LAYOUT,
    "map-building-apartment-floor-01.img",
    "map-building-apartment-ceiling-01.img",
);

/** The block; `generated` checks the wall types and gives the furniture's colliders. */
export function apartment(generated: Readonly<Record<string, MapObjectDef>>): BuildingDef {
    const L = APARTMENT_LAYOUT;
    const known = (id: string) => Object.hasOwn(generated, id);
    const cols: Colliders = (id) => {
        const d = generated[id];
        if (d?.type !== "obstacle") throw new Error(`apartment_01: no obstacle "${id}"`);
        const c = d.collision;
        return c.type === 1
            ? c
            : { min: { x: c.pos.x - c.rad, y: c.pos.y - c.rad }, max: { x: c.pos.x + c.rad, y: c.pos.y + c.rad } };
    };
    const tile = APARTMENT_FLATS.flatMap((f) => {
        const [y0, y1] = span(f.north, 0, FLAT_D);
        return [box(f.x0 + PART_X, y0, f.x0 + FLAT_W, y1)];
    });
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-31.5, -16.5, 31.5, 16.5), color: 0x8c6f5e },
                // the roof's stair housing and water tank (tools/assets/rebirthArt/apartment.ts)
                { collider: box(17.5, -3, 23, 7), color: 0xb7aa9a },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "house", collision: [box(L.bounds.min.x, L.bounds.min.y, L.bounds.max.x, L.bounds.max.y)] },
                { type: "tile", collision: tile },
                { type: "stone", collision: [box(17, -16, 31, 7)] },
            ],
            imgs: [
                { sprite: APARTMENT_ART.floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff },
                // the porch at the front door (the clinic's)
                {
                    sprite: "map-building-porch-01.img",
                    pos: { x: 24.5, y: -17.5 },
                    scale: 0.5,
                    alpha: 1,
                    tint: 0xffffff,
                    rot: 2,
                },
            ],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-31, -16, 31, 16), zoomOut: box(-31.5, -16.5, 31.5, 16.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: APARTMENT_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(APARTMENT_PUZZLE, APARTMENT_STORE_DOOR.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(
                APARTMENT_STORE_DOOR.type,
                APARTMENT_STORE_DOOR.pos.x,
                APARTMENT_STORE_DOOR.pos.y,
                APARTMENT_STORE_DOOR.ori,
            ),
            ...APARTMENT_FLATS.flatMap((f, i) => flatProps(cols, f.x0, f.north, i)),
            // the lobby: the mailboxes (three lockers) against the west wall, the soda machine, a seat by the office,
            // a planter by the front door (boxes by their min corner, backs to the wall)
            fit(cols, "locker_01", 1, 17.5, -15.5),
            fit(cols, "locker_01", 1, 17.5, -12.5),
            fit(cols, "locker_01", 1, 17.5, -9.5),
            fit(cols, "vending_01", 3, 28, -6.9),
            fit(cols, "couch_03", 0, 23.5, -6.5),
            fit(cols, "planter_07", 0, 27.5, -15.5),
            child("loot_tier_1", 22, -9),
            // the caretaker's office: the desk against the east wall with the storeroom's switch above it, a locker
            piece("switch_03", APARTMENT_SWITCH.x, APARTMENT_SWITCH.y, APARTMENT_SWITCH.ori, "1"),
            fit(cols, "table_01", 1, 26.5, -2.5),
            fit(cols, "locker_01", 0, 23.5, 5.3),
            child("loot_tier_1", 25, -0.5),
            // the storeroom: the chest in the north-west corner, the shotgun's wall mount beside it, a police locker on
            // the east wall, a sledgehammer and loot on the floor
            fit(cols, "chest_02", 0, 17.5, 12.3),
            fit(cols, "gun_mount_01", 0, 22, 14.1),
            fit(cols, "locker_02", 3, 29.3, 12.5),
            child("loot_tier_2", 21, 9.5),
            child("loot_tier_sledgehammer", 25, 11),
            child("loot_tier_2", 28, 10),
            // outside: bushes by the front door
            child("bush_01", 19, -18, 0, 0.9),
            child("bush_01", 30, -18, 0, 0.9),
        ],
    };
}
