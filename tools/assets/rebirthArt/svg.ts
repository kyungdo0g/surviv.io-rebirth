// SVG drawing helpers of the rebirth building art (tools/assets/rebirthBuildingArt.ts): world-unit layouts drawn at
// REBIRTH_ART_PX_PER_UNIT in the original buildings' flat style (filled rooms with a floor grid, thick walls with a dark
// outline, door thresholds, roofs with a parapet and panel seams).
import {
    REBIRTH_ART_PX_PER_UNIT as PX,
    type RebirthBuildingLayout,
} from "../../../packages/defs/src/rebirth/buildings.ts";

/** Floor styles of a building's rooms by name: base colour, grid colour, grid step in world units. */
export type FloorPalette = Readonly<Record<string, { base: string; grid: string; step: number }>>;

export interface Frame {
    /** world x of the image's left edge, world y of its top edge */
    ox: number;
    oy: number;
    w: number;
    h: number;
}

export function frameOf(layout: RebirthBuildingLayout): Frame {
    const { min, max } = layout.bounds;
    return { ox: min.x - 0.5, oy: max.y + 0.5, w: (max.x - min.x + 1) * PX, h: (max.y - min.y + 1) * PX };
}

export const f2 = (v: number) => Number(v.toFixed(2));

/** An SVG rect of the world box (x0, y0)-(x1, y1) (world y up, image y down), grown by `grow` pixels. */
export function rect(fr: Frame, x0: number, y0: number, x1: number, y1: number, attrs: string, grow = 0): string {
    const x = (Math.min(x0, x1) - fr.ox) * PX - grow;
    const y = (fr.oy - Math.max(y0, y1)) * PX - grow;
    const w = Math.abs(x1 - x0) * PX + 2 * grow;
    const h = Math.abs(y1 - y0) * PX + 2 * grow;
    return `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" ${attrs}/>`;
}

export const px = (fr: Frame, x: number) => f2((x - fr.ox) * PX);
export const py = (fr: Frame, y: number) => f2((fr.oy - y) * PX);

export function gridLines(fr: Frame, room: RebirthBuildingLayout["rooms"][number], palette: FloorPalette): string {
    const s = palette[room.floor];
    if (!s) throw new Error(`rebirth art: no floor style "${room.floor}"`);
    const out: string[] = [];
    for (let x = Math.ceil(room.min.x / s.step) * s.step; x < room.max.x; x += s.step) {
        out.push(`M${px(fr, x)} ${py(fr, room.max.y)}V${py(fr, room.min.y)}`);
    }
    for (let y = Math.ceil(room.min.y / s.step) * s.step; y < room.max.y; y += s.step) {
        out.push(`M${px(fr, room.min.x)} ${py(fr, y)}H${px(fr, room.max.x)}`);
    }
    return `<path d="${out.join("")}" stroke="${s.grid}" stroke-width="2" fill="none"/>`;
}

/** The wall rects (1 unit thick around each segment) of a layout, as one outline pass and one fill pass. */
export function walls(fr: Frame, layout: RebirthBuildingLayout, fill: string, outline: string): string {
    const boxes = layout.walls.map(([x0, y0, x1, y1]) =>
        y0 === y1 ? ([x0, y0 - 0.5, x1, y0 + 0.5] as const) : ([x0 - 0.5, y0, x0 + 0.5, y1] as const),
    );
    const out = boxes.map((b) => rect(fr, ...b, `fill="${outline}"`, 3));
    out.push(...boxes.map((b) => rect(fr, ...b, `fill="${fill}"`)));
    return out.join("");
}

/** Door thresholds: a darker strip across each door's gap (doors are 4 units from the hinge, house_door_01). */
export function thresholds(fr: Frame, layout: RebirthBuildingLayout, color: string): string {
    const out: string[] = [];
    for (const o of layout.openings) {
        if (o.type !== "house_door_01") continue;
        const { x, y } = o.pos;
        // ori 0: +y, 1: -x, 2: -y, 3: +x (house_red_01's door oris)
        const dir = [
            [0, 1],
            [-1, 0],
            [0, -1],
            [1, 0],
        ][o.ori & 3];
        const ex = x + dir[0] * 4;
        const ey = y + dir[1] * 4;
        const vertical = dir[0] === 0;
        const b = vertical ? [x - 0.5, y, x + 0.5, ey] : [x, y - 0.5, ex, y + 0.5];
        out.push(rect(fr, b[0], b[1], b[2], b[3], `fill="${color}"`));
    }
    return out.join("");
}

export function svg(fr: Frame, body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${fr.w}" height="${fr.h}" viewBox="0 0 ${fr.w} ${fr.h}">${body}</svg>\n`;
}

export function floor(
    layout: RebirthBuildingLayout,
    palette: FloorPalette,
    wallFill: string,
    wallOutline: string,
    extra = "",
): string {
    const fr = frameOf(layout);
    const rooms = layout.rooms.map(
        (r) =>
            rect(fr, r.min.x, r.min.y, r.max.x, r.max.y, `fill="${palette[r.floor]?.base}"`) +
            gridLines(fr, r, palette),
    );
    return svg(
        fr,
        rooms.join("") + extra + thresholds(fr, layout, "#00000033") + walls(fr, layout, wallFill, wallOutline),
    );
}

/** A plus sign centred on (x, y): arms `len` long and `width` wide. */
export function cross(fr: Frame, x: number, y: number, len: number, width: number, attrs: string): string {
    return (
        rect(fr, x - width / 2, y - len / 2, x + width / 2, y + len / 2, attrs) +
        rect(fr, x - len / 2, y - width / 2, x + len / 2, y + width / 2, attrs)
    );
}

/** A roof: the image box in `base`, a parapet band, panel seams, `top` details, all outlined. */
export function roof(layout: RebirthBuildingLayout, base: string, parapet: string, seam: string, top: string): string {
    const fr = frameOf(layout);
    const { min, max } = layout.bounds;
    const x0 = min.x - 0.5;
    const x1 = max.x + 0.5;
    const y0 = min.y - 0.5;
    const y1 = max.y + 0.5;
    const seams: string[] = [];
    for (let x = Math.floor(x0 / 4) * 4 + 4; x < x1 - 1; x += 4)
        seams.push(`M${px(fr, x)} ${py(fr, y1 - 1)}V${py(fr, y0 + 1)}`);
    const body =
        rect(fr, x0, y0, x1, y1, `fill="#1f2326"`) +
        rect(fr, x0, y0, x1, y1, `fill="${parapet}"`, -4) +
        rect(fr, x0 + 1, y0 + 1, x1 - 1, y1 - 1, `fill="${base}"`) +
        `<path d="${seams.join("")}" stroke="${seam}" stroke-width="3" fill="none"/>` +
        top;
    return svg(fr, body);
}

/** An air conditioning unit on a roof: a box with a fan. */
export function acUnit(fr: Frame, x: number, y: number): string {
    return (
        rect(fr, x - 1.5, y - 1.25, x + 1.5, y + 1.25, `fill="#9aa2a8" stroke="#2c3135" stroke-width="3"`) +
        `<circle cx="${px(fr, x)}" cy="${py(fr, y)}" r="${PX * 0.9}" fill="#6d757b" stroke="#2c3135" stroke-width="2"/>` +
        `<path d="M${px(fr, x - 0.8)} ${py(fr, y)}H${px(fr, x + 0.8)}M${px(fr, x)} ${py(fr, y - 0.8)}V${py(fr, y + 0.8)}" stroke="#3f464b" stroke-width="3"/>`
    );
}

/** A five-pointed star centred on (x, y) with outer radius `r` (world units). */
export function star(fr: Frame, x: number, y: number, r: number, fill: string): string {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.42;
        pts.push(`${f2((x - fr.ox) * PX + Math.cos(a) * rr * PX)},${f2((fr.oy - y) * PX + Math.sin(a) * rr * PX)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="#1f2326" stroke-width="3"/>`;
}

export const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
