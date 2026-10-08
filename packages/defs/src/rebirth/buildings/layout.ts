// Shared pieces of the rebirth buildings (rebirth/buildings.ts): the layout a building's walls, doors, windows and floor
// art are built from, and the helpers that turn it into map object children. Walls are invisible wall obstacles
// (`<material>_wall_ext_<length>`, 1 unit thick, centred on the floor's edge like house_red_01's), doors and windows sit
// 0.25 outside the wall line (house_red_01's door oris: 0 +y, 1 -x, 2 -y, 3 +x from the hinge).
import type { AABB, BuildingChildDef } from "../../types/index.ts";

/** Floor and roof images are drawn at this many pixels per world unit and placed at scale 0.5 (16 px per unit). */
export const REBIRTH_ART_PX_PER_UNIT = 32;
export const ART_SCALE = 0.5;

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

export const box = (x0: number, y0: number, x1: number, y1: number): AABB => ({
    type: 1 as const,
    min: { x: x0, y: y0 },
    max: { x: x1, y: y1 },
    height: 0,
});

export const child = (type: BuildingChildDef["type"], x: number, y: number, ori = 0, scale = 1): BuildingChildDef => ({
    type,
    pos: { x, y },
    scale,
    ori,
});

/** The wall obstacles of `segs`: horizontal walls turn by ori 1; a length without a wall type throws. */
export function wallChildren(
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
export function artSize(layout: RebirthBuildingLayout): [number, number] {
    const { min, max } = layout.bounds;
    return [(max.x - min.x + 1) * REBIRTH_ART_PX_PER_UNIT, (max.y - min.y + 1) * REBIRTH_ART_PX_PER_UNIT];
}
