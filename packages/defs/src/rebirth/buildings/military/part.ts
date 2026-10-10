// The pieces the military base (military_base_01, rebirth/buildings/military/) is built from: a part is one building
// of the base (the compound, the HQ, ..., the basement and its nested rooms) with its layout (layout.ts), furniture,
// floor surfaces, zoom regions and images. Parts are authored in the compound frame (origin the compound centre, +y
// north, the main gate south; the structure's two layer buildings sit at that origin with ori 0) and re-expressed
// around their own centre by fromWorld(), where the parent places them. Long walls are written as runs (hRun / vRun)
// split into the existing `<material>_wall_ext_<length>` pieces (wood: the breakable `rebirth_wall_int_<length>`).
import type { Opening, RebirthBuildingLayout, Room, WallMaterial, WallSeg } from "../layout.ts";
import { REBIRTH_WALL_INT_LENGTHS } from "../walls.ts";

/** A world box [x0, y0, x1, y1]. */
export type Box = readonly [x0: number, y0: number, x1: number, y1: number];

/** A child of a part: a map object id (or a weighted pick), its position and ori. */
export interface Prop {
    readonly type: string | Readonly<Record<string, number>>;
    readonly x: number;
    readonly y: number;
    readonly ori: number;
    /** stands outside the part's floor box on purpose (yard props, the outside aprons) */
    readonly outside?: boolean;
    /** a low wall or rail, the vault door or the breach wall: it counts as a wall against the furniture */
    readonly wallLike?: boolean;
    /** a puzzle piece's label (the part's `puzzle`) */
    readonly piece?: string;
}

export interface Zoom {
    readonly zoomIn: Box;
    readonly zoomOut?: Box;
    readonly zoom?: number;
}

export interface Surface {
    readonly type: string;
    readonly boxes: readonly Box[];
}

/**
 * One image of a part, centred on `centre` (the part's frame), `size` world units. Drawn at `ppu` pixels per unit
 * (REBIRTH_ART_PX_PER_UNIT unless lower: flat markings and dark basement roofs need less) and placed at the scale that
 * shows it at 16 px per unit. A `faction` image has a red and a blue version for the 50v50 variants.
 */
export interface PartImage {
    readonly sprite: string;
    readonly kind: "floor" | "ceiling";
    readonly centre: { readonly x: number; readonly y: number };
    readonly size: readonly [number, number];
    readonly ppu?: number;
    readonly tint?: number;
    readonly rot?: number;
    readonly faction?: boolean;
}

/** A minimap shape (part frame): a box or a disc, in a colour or the side's emblem colours (`emblem`, `star`). */
export interface PartMapShape {
    readonly box?: Box;
    readonly disc?: readonly [x: number, y: number, r: number];
    readonly color: number | "emblem" | "star";
}

export interface MilitaryPart {
    readonly id: string;
    /** the 50v50 variants (`<id>r` teamId 1, `<id>b` teamId 2): the same data, their own faction images */
    readonly factionVariants?: boolean;
    readonly layer: 0 | 1;
    /** the parent part (null: one of the structure's two layer buildings) */
    readonly parent: string | null;
    /** where the parent places it (parent frame) */
    readonly placements: ReadonlyArray<{
        readonly pos: { readonly x: number; readonly y: number };
        readonly ori: number;
    }>;
    readonly zIdx: number;
    readonly layout: RebirthBuildingLayout;
    readonly props: readonly Prop[];
    /** floor surfaces; the first box of the first one is the floor box (no player spawns on floors) */
    readonly surfaces: readonly Surface[];
    readonly zoom: readonly Zoom[];
    readonly heal?: readonly Box[];
    /** a hidden room's puzzle: its pieces (props with `piece`) in the order of REBIRTH_PUZZLE_CODES[name] open `door` */
    readonly puzzle?: { readonly name: string; readonly door: string };
    readonly images: readonly PartImage[];
    readonly mapShapes: readonly PartMapShape[];
}

// ---------------------------------------------------------------------------------------------------------------------
// wall runs

/** The 1-unit wall lengths there are per material (generated mapObjects.json; wallChildren throws on any other). */
export const WALL_LENGTHS: Readonly<Record<WallMaterial, readonly number[]>> = {
    concrete: [1.5, 2, 3, 4, 5, 6, 7, 8, 9, 9.5, 10.5, 11, 11.5, 13, 14, 15, 16, 17, 23, 24, 25],
    brick: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 33, 41],
    metal: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 12.5, 13, 16, 18, 23, 43],
    wood: REBIRTH_WALL_INT_LENGTHS,
    brittle: REBIRTH_WALL_INT_LENGTHS,
};

/** The fewest wall lengths summing to `len` (half units; the longest piece first). */
export function splitLength(len: number, material: WallMaterial): number[] {
    const n = Math.round(len * 2);
    const lens = WALL_LENGTHS[material].map((l) => Math.round(l * 2)).sort((a, b) => b - a);
    const best: (number[] | null)[] = new Array(n + 1).fill(null);
    best[0] = [];
    for (let i = 1; i <= n; i++) {
        for (const l of lens) {
            const prev = l <= i ? best[i - l] : null;
            const cur = best[i];
            if (prev && (!cur || prev.length + 1 < cur.length)) best[i] = [l, ...prev];
        }
    }
    const out = best[n];
    if (!out) throw new Error(`military base: no ${material} wall split for ${len}`);
    return out.map((v) => v / 2);
}

/**
 * A straight wall run on `line` from a0 to a1 less the gaps, as wall pieces; `material` gives every piece that
 * material (the 5th element), `base` names the layout's own material (its pieces need no 5th element).
 */
function run(
    horizontal: boolean,
    line: number,
    a0: number,
    a1: number,
    gaps: ReadonlyArray<readonly [number, number]>,
    material?: WallMaterial,
    base?: WallMaterial,
): WallSeg[] {
    const pts = [a0];
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
        if (!(a0 <= g0 && g0 < g1 && g1 <= a1)) throw new Error(`military base: gap ${g0}..${g1} outside ${a0}..${a1}`);
        pts.push(g0, g1);
    }
    pts.push(a1);
    const out: WallSeg[] = [];
    for (let i = 0; i < pts.length; i += 2) {
        let s = pts[i];
        const e = pts[i + 1];
        if (e - s < 1e-9) continue;
        for (const piece of splitLength(e - s, material ?? base ?? "concrete")) {
            const seg = horizontal ? ([s, line, s + piece, line] as const) : ([line, s, line, s + piece] as const);
            out.push(material ? [...seg, material] : seg);
            s += piece;
        }
    }
    return out;
}

/** A horizontal wall run along y from x0 to x1 less the gaps. */
export const hRun = (
    y: number,
    x0: number,
    x1: number,
    gaps: ReadonlyArray<readonly [number, number]> = [],
    material?: WallMaterial,
    base?: WallMaterial,
) => run(true, y, x0, x1, gaps, material, base);

/** A vertical wall run along x from y0 to y1 less the gaps. */
export const vRun = (
    x: number,
    y0: number,
    y1: number,
    gaps: ReadonlyArray<readonly [number, number]> = [],
    material?: WallMaterial,
    base?: WallMaterial,
) => run(false, x, y0, y1, gaps, material, base);

export const op = (type: Opening["type"], x: number, y: number, ori: number): Opening => ({ type, pos: { x, y }, ori });
export const room = (x0: number, y0: number, x1: number, y1: number, floor: string): Room => ({
    min: { x: x0, y: y0 },
    max: { x: x1, y: y1 },
    floor,
});
export const p = (type: Prop["type"], x: number, y: number, ori = 0, extra: Partial<Prop> = {}): Prop => ({
    type,
    x,
    y,
    ori,
    ...extra,
});
/** a prop outside the floor box on purpose */
export const out = (type: Prop["type"], x: number, y: number, ori = 0): Prop => p(type, x, y, ori, { outside: true });
/** a low steel rail (h 0.5: bullets pass, players do not) */
export const low = (type: string, x: number, y: number, ori = 0): Prop =>
    p(type, x, y, ori, { wallLike: true, outside: true });

const grow = (b: Box, d: number): Box => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
/** zoomIn over the floor box, zoomOut half a wall wider */
export const fullZoom = (b: Box, zoom?: number): Zoom => ({
    zoomIn: b,
    zoomOut: grow(b, 0.5),
    ...(zoom ? { zoom } : {}),
});

// ---------------------------------------------------------------------------------------------------------------------
// compound frame -> part frame

/** A part authored in the compound frame, with its centre (where its parent places it, ori 0). */
export interface WorldPart extends Omit<MilitaryPart, "placements"> {
    readonly centre: { readonly x: number; readonly y: number };
}

const shiftBox = (b: Box, c: { x: number; y: number }): Box => [b[0] - c.x, b[1] - c.y, b[2] - c.x, b[3] - c.y];
const shiftRoom = (r: Room, c: { x: number; y: number }): Room => ({
    ...r,
    min: { x: r.min.x - c.x, y: r.min.y - c.y },
    max: { x: r.max.x - c.x, y: r.max.y - c.y },
});

/** A part authored in the compound frame, re-expressed around its centre and placed there with ori 0. */
export function fromWorld(w: WorldPart): MilitaryPart {
    const c = w.centre;
    const L = w.layout;
    const layout: RebirthBuildingLayout = {
        bounds: {
            min: { x: L.bounds.min.x - c.x, y: L.bounds.min.y - c.y },
            max: { x: L.bounds.max.x - c.x, y: L.bounds.max.y - c.y },
        },
        material: L.material,
        walls: L.walls.map((s): WallSeg => {
            const q = [s[0] - c.x, s[1] - c.y, s[2] - c.x, s[3] - c.y] as const;
            return s[4] ? [...q, s[4]] : q;
        }),
        openings: L.openings.map((o) => ({ ...o, pos: { x: o.pos.x - c.x, y: o.pos.y - c.y } })),
        rooms: L.rooms.map((r) => shiftRoom(r, c)),
        ...(L.outdoor ? { outdoor: L.outdoor.map((r) => shiftRoom(r, c)) } : {}),
    };
    const { centre: _, ...rest } = w;
    return {
        ...rest,
        placements: [{ pos: { x: c.x, y: c.y }, ori: 0 }],
        layout,
        props: w.props.map((q) => ({ ...q, x: q.x - c.x, y: q.y - c.y })),
        surfaces: w.surfaces.map((s) => ({ type: s.type, boxes: s.boxes.map((b) => shiftBox(b, c)) })),
        zoom: w.zoom.map((z) => ({
            ...z,
            zoomIn: shiftBox(z.zoomIn, c),
            ...(z.zoomOut ? { zoomOut: shiftBox(z.zoomOut, c) } : {}),
        })),
        ...(w.heal ? { heal: w.heal.map((b) => shiftBox(b, c)) } : {}),
        images: w.images.map((a) => ({ ...a, centre: { x: a.centre.x - c.x, y: a.centre.y - c.y } })),
        mapShapes: w.mapShapes.map((s) => ({
            ...s,
            ...(s.box ? { box: shiftBox(s.box, c) } : {}),
            ...(s.disc ? { disc: [s.disc[0] - c.x, s.disc[1] - c.y, s.disc[2]] as const } : {}),
        })),
    };
}
