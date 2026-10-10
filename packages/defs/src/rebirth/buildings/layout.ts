// Shared pieces of the rebirth buildings (rebirth/buildings.ts): the layout a building's walls, doors, windows and floor
// art are built from, and the helpers that turn it into map object children. Walls are invisible wall obstacles
// (`<material>_wall_ext_<length>`, 1 unit thick, centred on the floor's edge like house_red_01's), doors and windows sit
// 0.25 outside the wall line (house_red_01's door oris: 0 +y, 1 -x, 2 -y, 3 +x from the hinge).
import type { AABB, BuildingChildDef, BuildingDef, CircleCollider } from "../../types/index.ts";
import { REBIRTH_WALL_INT_LENGTHS, rebirthWallInt } from "./walls.ts";

/** Floor and roof images are drawn at this many pixels per world unit and placed at scale 0.5 (16 px per unit). */
export const REBIRTH_ART_PX_PER_UNIT = 32;
export const ART_SCALE = 0.5;
/** A lookout's view (a zoom region's `zoom`): the 4x scope's, as survev's bathhouse_01 gives its balcony. */
export const LOOKOUT_ZOOM = 48;

/**
 * Wall obstacle families (`<material>_wall_ext_<length>`): brick and concrete walls, steel (metal, reflects bullets);
 * wood is a breakable partition (`rebirth_wall_int_<length>`, walls.ts), drawn by its own sprite, not the floor art.
 */
export type WallMaterial = "brick" | "concrete" | "metal" | "wood";

/**
 * An axis-aligned wall from (x0, y0) to (x1, y1), 1 unit thick, centred on that line; a fifth element overrides the
 * layout's material for this wall.
 */
export type WallSeg =
    | readonly [x0: number, y0: number, x1: number, y1: number]
    | readonly [x0: number, y0: number, x1: number, y1: number, material: WallMaterial];

/**
 * What fills a wall gap: hinged doors (house_door_01 wood, house_door_02 steel) and sliding lab doors (lab_door_01
 * automatic, lab_door_locked_01 locked until unlocked) at their hinge, 4 units long; windows at their centre, 4 long; a
 * loophole (brick_wall_ext_3_0_low: blocks players, not bullets) at its centre, 3 long.
 */
export type OpeningType =
    | "house_door_01"
    | "house_door_02"
    | "house_window_01"
    | "lab_door_01"
    | "lab_door_locked_01"
    | "brick_wall_ext_3_0_low";

/** A door or window: the hinge (doors) or centre (windows, loopholes), its ori (house_red_01's conventions). */
export interface Opening {
    readonly type: OpeningType;
    readonly pos: { readonly x: number; readonly y: number };
    readonly ori: number;
}

/** A room of the floor art: box and floor style (the art tool's palette key). */
export interface Room {
    readonly min: { readonly x: number; readonly y: number };
    readonly max: { readonly x: number; readonly y: number };
    readonly floor: string;
}

export interface RebirthBuildingLayout {
    /** floor surface box: the line the exterior walls are centred on */
    readonly bounds: { readonly min: { x: number; y: number }; readonly max: { x: number; y: number } };
    readonly material: WallMaterial;
    readonly walls: readonly WallSeg[];
    readonly openings: readonly Opening[];
    /** rooms (for the floor art), drawn in order */
    readonly rooms: readonly Room[];
    /** ground outside the walls drawn with the floor (an apron), no roof over it: it widens the floor image */
    readonly outdoor?: readonly Room[];
}

/** Floor and roof sprite ids of a rebirth building, with their image sizes in pixels and the floor image's offset. */
export interface RebirthBuildingArt {
    /** the floor image, or the one image of a record without a roof (the military base lists each image apart) */
    readonly floor: string;
    /** absent for a record without a roof */
    readonly ceiling?: string;
    /** the roof image (and the floor image unless `floorSize` is given) */
    readonly size: readonly [number, number];
    readonly floorSize?: readonly [number, number];
}

export const box = (x0: number, y0: number, x1: number, y1: number): AABB => ({
    type: 1 as const,
    min: { x: x0, y: y0 },
    max: { x: x1, y: y1 },
    height: 0,
});

export const circle = (x: number, y: number, rad: number): CircleCollider => ({ type: 0, pos: { x, y }, rad });

export const child = (type: BuildingChildDef["type"], x: number, y: number, ori = 0, scale = 1): BuildingChildDef => ({
    type,
    pos: { x, y },
    scale,
    ori,
});

/** The material of a wall segment (its own, else the layout's). */
export function wallMaterial(layout: RebirthBuildingLayout, seg: WallSeg): WallMaterial {
    return seg[4] ?? layout.material;
}

/** The wall obstacles of a layout: horizontal walls turn by ori 1; a length without a wall type throws. */
export function wallChildren(layout: RebirthBuildingLayout, known: (id: string) => boolean): BuildingChildDef[] {
    return layout.walls.map((seg) => {
        const [x0, y0, x1, y1] = seg;
        const horizontal = y0 === y1;
        if (!horizontal && x0 !== x1) throw new Error(`rebirth wall ${seg} is not axis-aligned`);
        const len = Math.abs(horizontal ? x1 - x0 : y1 - y0);
        const material = wallMaterial(layout, seg);
        if (material === "wood" && !REBIRTH_WALL_INT_LENGTHS.includes(len))
            throw new Error(`rebirth building: no breakable wall of length ${len}`);
        const type =
            material === "wood" ? rebirthWallInt(len) : `${material}_wall_ext_${String(len).replace(".", "_")}`;
        if (material !== "wood" && !known(type)) throw new Error(`rebirth building: no wall obstacle "${type}"`);
        return child(type, (x0 + x1) / 2, (y0 + y1) / 2, horizontal ? 1 : 0);
    });
}

/** The doors, windows and loopholes of a layout as children. */
export function openingChildren(layout: RebirthBuildingLayout): BuildingChildDef[] {
    return layout.openings.map((o) => child(o.type, o.pos.x, o.pos.y, o.ori));
}

/** The roof image's frame: the floor box plus the half wall outside it. */
export function roofFrame(layout: RebirthBuildingLayout): {
    min: { x: number; y: number };
    max: { x: number; y: number };
} {
    const { min, max } = layout.bounds;
    return { min: { x: min.x - 0.5, y: min.y - 0.5 }, max: { x: max.x + 0.5, y: max.y + 0.5 } };
}

/** The floor image's frame: the roof's, grown to take in the outdoor rooms. */
export function floorFrame(layout: RebirthBuildingLayout): {
    min: { x: number; y: number };
    max: { x: number; y: number };
} {
    const f = roofFrame(layout);
    for (const r of layout.outdoor ?? []) {
        f.min.x = Math.min(f.min.x, r.min.x);
        f.min.y = Math.min(f.min.y, r.min.y);
        f.max.x = Math.max(f.max.x, r.max.x);
        f.max.y = Math.max(f.max.y, r.max.y);
    }
    return f;
}

const sizeOf = (f: { min: { x: number; y: number }; max: { x: number; y: number } }): [number, number] => [
    (f.max.x - f.min.x) * REBIRTH_ART_PX_PER_UNIT,
    (f.max.y - f.min.y) * REBIRTH_ART_PX_PER_UNIT,
];

/** The roof image's size: the floor box plus the half wall outside it, at REBIRTH_ART_PX_PER_UNIT. */
export function artSize(layout: RebirthBuildingLayout): [number, number] {
    return sizeOf(roofFrame(layout));
}

/** The floor image's size (artSize unless outdoor rooms widen it). */
export function floorArtSize(layout: RebirthBuildingLayout): [number, number] {
    return sizeOf(floorFrame(layout));
}

/** Where the floor image's centre sits relative to the building's origin. */
export function floorArtPos(layout: RebirthBuildingLayout): { x: number; y: number } {
    const f = floorFrame(layout);
    return { x: (f.min.x + f.max.x) / 2, y: (f.min.y + f.max.y) / 2 };
}

/** Where the roof image's centre sits relative to the building's origin. */
export function roofArtPos(layout: RebirthBuildingLayout): { x: number; y: number } {
    const f = roofFrame(layout);
    return { x: (f.min.x + f.max.x) / 2, y: (f.min.y + f.max.y) / 2 };
}

/** A building's art with its roof image. */
export type RoofedBuildingArt = RebirthBuildingArt & { readonly ceiling: string };

/** The art record of a layout: floor and roof sprite ids (a roofless part has none), sizes. */
export function layoutArt(layout: RebirthBuildingLayout, floor: string, ceiling: string): RoofedBuildingArt;
export function layoutArt(layout: RebirthBuildingLayout, floor: string): RebirthBuildingArt;
export function layoutArt(layout: RebirthBuildingLayout, floor: string, ceiling?: string): RebirthBuildingArt {
    const size = artSize(layout);
    const floorSize = floorArtSize(layout);
    const same = floorSize[0] === size[0] && floorSize[1] === size[1];
    const art = ceiling ? { floor, ceiling, size } : { floor, size };
    return same ? art : { ...art, floorSize };
}

/**
 * A rebirth building's hidden-room puzzle (the owner's rework, 2026-10-10: every interaction opens something): the
 * building's `piece` switches, pressed in the order of its code (REBIRTH_PUZZLE_CODES), open every `door` child (doors
 * only puzzles move: vault_door_bathhouse, secret_door_club, saloon_door_secret); survev bathhouse_01's timings.
 */
export function rebirthPuzzle(name: string, door: string): NonNullable<BuildingDef["puzzle"]> {
    return {
        name,
        completeUseType: door,
        completeOffDelay: 1,
        completeUseDelay: 2,
        errorResetDelay: 1,
        pieceResetDelay: 10,
        sound: { fail: "door_error_01", complete: "none" },
    };
}

/** A puzzle piece child (a switch labelled `label`). */
export const piece = (type: string, x: number, y: number, ori: number, label: string): BuildingChildDef => ({
    ...child(type, x, y, ori),
    puzzlePiece: label,
});
