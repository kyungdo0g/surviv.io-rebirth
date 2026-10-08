// Floor and roof art of the rebirth buildings (packages/defs rebirth/buildings.ts): flat SVGs in the original
// buildings' style (filled rooms, thick walls with a dark outline, roofs with a parapet), drawn from the same layouts
// the defs build their wall obstacles from, so every drawn wall is a wall that collides. This is rebirth art (no
// original or survev file is used), committed under apps/client/public/rebirth/map/ and served from /rebirth/map/.
// Run: node tools/assets/rebirthBuildingArt.ts (rebirthBuildingArt.test.ts checks the committed files are current).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    CLINIC_ART,
    CLINIC_LAYOUT,
    OUTPOST_FACTIONS,
    OUTPOST_LAYOUT,
    outpostArt,
    REBIRTH_ART_PX_PER_UNIT as PX,
    type RebirthBuildingLayout,
} from "../../packages/defs/src/rebirth/buildings.ts";

export const REBIRTH_ART_DIR = "apps/client/public/rebirth/map";

/** The served path of a sprite id's file (map-building-clinic-floor-01.img -> /rebirth/map/...svg). */
export function rebirthArtFile(sprite: string): string {
    return `${sprite.replace(/\.img$/, "")}.svg`;
}

interface Frame {
    /** world x of the image's left edge, world y of its top edge */
    ox: number;
    oy: number;
    w: number;
    h: number;
}

function frameOf(layout: RebirthBuildingLayout): Frame {
    const { min, max } = layout.bounds;
    return { ox: min.x - 0.5, oy: max.y + 0.5, w: (max.x - min.x + 1) * PX, h: (max.y - min.y + 1) * PX };
}

const f2 = (v: number) => Number(v.toFixed(2));

/** An SVG rect of the world box (x0, y0)-(x1, y1) (world y up, image y down), grown by `grow` pixels. */
function rect(fr: Frame, x0: number, y0: number, x1: number, y1: number, attrs: string, grow = 0): string {
    const x = (Math.min(x0, x1) - fr.ox) * PX - grow;
    const y = (fr.oy - Math.max(y0, y1)) * PX - grow;
    const w = Math.abs(x1 - x0) * PX + 2 * grow;
    const h = Math.abs(y1 - y0) * PX + 2 * grow;
    return `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" ${attrs}/>`;
}

const px = (fr: Frame, x: number) => f2((x - fr.ox) * PX);
const py = (fr: Frame, y: number) => f2((fr.oy - y) * PX);

/** Floor styles: base colour, grid colour, grid step in world units. */
const FLOORS: Readonly<Record<string, { base: string; grid: string; step: number }>> = {
    lobby: { base: "#d8d4cc", grid: "#c2bdb3", step: 2 },
    ward: { base: "#cde2da", grid: "#b3cec4", step: 2 },
    pharmacy: { base: "#d2dce8", grid: "#b9c7d7", step: 2 },
    hall: { base: "#8a8c85", grid: "#7a7c75", step: 4 },
    armory: { base: "#6d7166", grid: "#62665b", step: 1 },
    command: { base: "#5b6a4e", grid: "#536147", step: 4 },
};

function gridLines(fr: Frame, room: RebirthBuildingLayout["rooms"][number]): string {
    const s = FLOORS[room.floor];
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
function walls(fr: Frame, layout: RebirthBuildingLayout, fill: string, outline: string): string {
    const boxes = layout.walls.map(([x0, y0, x1, y1]) =>
        y0 === y1 ? ([x0, y0 - 0.5, x1, y0 + 0.5] as const) : ([x0 - 0.5, y0, x0 + 0.5, y1] as const),
    );
    const out = boxes.map((b) => rect(fr, ...b, `fill="${outline}"`, 3));
    out.push(...boxes.map((b) => rect(fr, ...b, `fill="${fill}"`)));
    return out.join("");
}

/** Door thresholds: a darker strip across each door's gap (doors are 4 units from the hinge, house_door_01). */
function thresholds(fr: Frame, layout: RebirthBuildingLayout, color: string): string {
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

function svg(fr: Frame, body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${fr.w}" height="${fr.h}" viewBox="0 0 ${fr.w} ${fr.h}">${body}</svg>\n`;
}

function floor(layout: RebirthBuildingLayout, wallFill: string, wallOutline: string, extra = ""): string {
    const fr = frameOf(layout);
    const rooms = layout.rooms.map(
        (r) => rect(fr, r.min.x, r.min.y, r.max.x, r.max.y, `fill="${FLOORS[r.floor].base}"`) + gridLines(fr, r),
    );
    return svg(
        fr,
        rooms.join("") + extra + thresholds(fr, layout, "#00000033") + walls(fr, layout, wallFill, wallOutline),
    );
}

/** A plus sign centred on (x, y): arms `len` long and `width` wide. */
function cross(fr: Frame, x: number, y: number, len: number, width: number, attrs: string): string {
    return (
        rect(fr, x - width / 2, y - len / 2, x + width / 2, y + len / 2, attrs) +
        rect(fr, x - len / 2, y - width / 2, x + len / 2, y + width / 2, attrs)
    );
}

/** The clinic's red cross: on the roof (and the map shapes, buildings.ts). */
export const CLINIC_CROSS = { x: -9, y: 6.5, len: 5, width: 1.75 } as const;

function clinicFloor(): string {
    const fr = frameOf(CLINIC_LAYOUT);
    // a faded cross on the lobby floor
    const extra = cross(fr, 0, -4.5, 4, 1.25, `fill="#c8312e" fill-opacity="0.18"`);
    return floor(CLINIC_LAYOUT, "#c7ccd0", "#25292c", extra);
}

/** A roof: the image box in `base`, a parapet band, panel seams, `top` details, all outlined. */
function roof(layout: RebirthBuildingLayout, base: string, parapet: string, seam: string, top: string): string {
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
function acUnit(fr: Frame, x: number, y: number): string {
    return (
        rect(fr, x - 1.5, y - 1.25, x + 1.5, y + 1.25, `fill="#9aa2a8" stroke="#2c3135" stroke-width="3"`) +
        `<circle cx="${px(fr, x)}" cy="${py(fr, y)}" r="${PX * 0.9}" fill="#6d757b" stroke="#2c3135" stroke-width="2"/>` +
        `<path d="M${px(fr, x - 0.8)} ${py(fr, y)}H${px(fr, x + 0.8)}M${px(fr, x)} ${py(fr, y - 0.8)}V${py(fr, y + 0.8)}" stroke="#3f464b" stroke-width="3"/>`
    );
}

function clinicCeiling(): string {
    const fr = frameOf(CLINIC_LAYOUT);
    const c = CLINIC_CROSS;
    const top =
        `<circle cx="${px(fr, c.x)}" cy="${py(fr, c.y)}" r="${PX * 3.4}" fill="#ffffff" stroke="#2c3135" stroke-width="4"/>` +
        cross(fr, c.x, c.y, c.len, c.width, `fill="#c8312e"`) +
        acUnit(fr, 9, 7) +
        acUnit(fr, 12.5, 7) +
        acUnit(fr, 10.75, -6.5) +
        `<circle cx="${px(fr, 2)}" cy="${py(fr, -3)}" r="${PX * 0.6}" fill="#7d868c" stroke="#2c3135" stroke-width="3"/>` +
        `<circle cx="${px(fr, -3)}" cy="${py(fr, -7)}" r="${PX * 0.6}" fill="#7d868c" stroke="#2c3135" stroke-width="3"/>`;
    return roof(CLINIC_LAYOUT, "#e6e9eb", "#aab3b9", "#d3d8dc", top);
}

function outpostFloor(): string {
    const fr = frameOf(OUTPOST_LAYOUT);
    // hazard stripes inside the doors, the command room's carpet border
    const stripes: string[] = [];
    for (let x = -1.5; x < 2.5; x += 1) {
        stripes.push(
            rect(fr, x, -9, x + 0.5, -8.25, `fill="#d6a425"`),
            rect(fr, x + 0.5, -9, x + 1, -8.25, `fill="#2a2a2a"`),
        );
    }
    const extra =
        stripes.join("") +
        rect(fr, 0.25, 2.25, 10.25, 8.25, `fill="none" stroke="#45503b" stroke-width="6"`) +
        rect(fr, -10.5, 1.75, -5, 4.75, `fill="#000000" fill-opacity="0.12"`);
    return floor(OUTPOST_LAYOUT, "#55584f", "#1b1d1a", extra);
}

/** A five-pointed star centred on (x, y) with outer radius `r` (world units). */
function star(fr: Frame, x: number, y: number, r: number, fill: string): string {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.42;
        pts.push(`${f2((x - fr.ox) * PX + Math.cos(a) * rr * PX)},${f2((fr.oy - y) * PX + Math.sin(a) * rr * PX)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="#1f2326" stroke-width="3"/>`;
}

function outpostCeiling(color: string): string {
    const fr = frameOf(OUTPOST_LAYOUT);
    const top =
        rect(fr, -11, -9, 11, -7.25, `fill="${color}"`) +
        `<circle cx="${px(fr, 0)}" cy="${py(fr, 1.5)}" r="${PX * 4}" fill="${color}" stroke="#1f2326" stroke-width="4"/>` +
        star(fr, 0, 1.5, 3, "#f2f2ee") +
        // radio mast and hatch
        `<circle cx="${px(fr, 8.5)}" cy="${py(fr, 6.5)}" r="${PX * 1}" fill="#5a5d56" stroke="#1f2326" stroke-width="3"/>` +
        `<path d="M${px(fr, 8.5)} ${py(fr, 6.5)}L${px(fr, 10.25)} ${py(fr, 8.25)}" stroke="#1f2326" stroke-width="4"/>` +
        rect(fr, -9.5, 5, -6.5, 8, `fill="#6b6e67" stroke="#1f2326" stroke-width="3"`);
    return roof(OUTPOST_LAYOUT, "#8b8e87", "#6c6f68", "#7d8079", top);
}

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Every rebirth building image: sprite id -> SVG text. */
export function rebirthBuildingSvgs(): Map<string, string> {
    const out = new Map<string, string>([
        [CLINIC_ART.floor, clinicFloor()],
        [CLINIC_ART.ceiling, clinicCeiling()],
    ]);
    for (const f of OUTPOST_FACTIONS) {
        const art = outpostArt(f.teamId);
        out.set(art.floor, outpostFloor());
        out.set(art.ceiling, outpostCeiling(hex(f.color)));
    }
    return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    mkdirSync(REBIRTH_ART_DIR, { recursive: true });
    for (const [sprite, text] of rebirthBuildingSvgs()) {
        writeFileSync(join(REBIRTH_ART_DIR, rebirthArtFile(sprite)), text);
        console.log(`wrote ${join(REBIRTH_ART_DIR, rebirthArtFile(sprite))}`);
    }
}
