// The military base's wing images (packages/defs rebirth/buildings/military/ infirmary.ts, armory.ts, yard.ts), each in
// its part's own frame (centred on the part): the infirmary's mint wards, white triage hall, blue pharmacy and
// steel-blue narcotics store in brick under an olive roof with a white panel and a red cross; the armory's steel deck,
// mesh gun cage and the stairs down to S2 inside steel walls under a rust-brown corrugated roof with crossed rifles on
// a sand disc and hazard stripes over its two doors; the storehouse's concrete hall with yellow bay lines and the
// freight stairs down to S3 under a tan corrugated roof with skylight strips, a crate stencil and a canvas awning over
// the loading mouth; the garage's bay, workshop and the vehicle ramp down to S4 between its yellow and black rails
// under a grey steel roof with chevron bands over both mouths, a hatched panel with an arrow over the ramp and a wrench
// over the workshop (spec §6.3-6.6, §9.1-9.2).
import {
    MILITARY_ARMORY_EMBLEM,
    type MilitaryPart,
    REBIRTH_ART_PX_PER_UNIT as PX,
    type RebirthBuildingLayout,
} from "../../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
    cross,
    type FloorPalette,
    type Frame,
    f2,
    floor,
    hazardBand,
    hex,
    oriDir,
    polygon,
    px,
    py,
    rect,
    roof,
} from "../svg.ts";
import type { MilitaryDrawer } from "./index.ts";

/** A world box [x0, y0, x1, y1] (the part's frame). */
type Box = readonly [number, number, number, number];
type Pt = readonly [number, number];

const INK = "#1f2326";
const HAZARD = ["#e2b425", "#26282a"] as const;
/** Wall fills by material: red-brown brick, dark concrete, blue steel (the armory's ricocheting walls). */
const WALLS = { brick: "#9a5b46", concrete: "#64665f", metal: "#4f5d68" } as const;
/** The stair and ramp treads shade from TREAD_TOP at the top end to TREAD_BOTTOM at the bottom end. */
const TREAD_TOP = "#b9bcb7";
const TREAD_BOTTOM = "#4f5250";
/** The treads' own room style (drawn over by treads(); floor() needs every room's key). */
const STAIRS = { base: "#8e918d", grid: "#8e918d", step: 1 } as const;

// ---------------------------------------------------------------------------------------------------------------------
// shared helpers

/** The colour `t` of the way from `a` to `b` (#rrggbb). */
function mix(a: string, b: string, t: number): string {
    const ca = Number.parseInt(a.slice(1), 16);
    const cb = Number.parseInt(b.slice(1), 16);
    const ch = (s: number) => Math.round(((ca >> s) & 255) * (1 - t) + ((cb >> s) & 255) * t);
    return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
}

/** Parallel lines across the box every `step` units (at x or y = phase + k * step), as one path. */
function lines(fr: Frame, [x0, y0, x1, y1]: Box, step: number, vertical: boolean, attrs: string, phase = 0): string {
    const d: string[] = [];
    const [a0, a1] = vertical ? [x0, x1] : [y0, y1];
    for (let k = Math.floor((a0 - phase) / step) + 1; phase + k * step < a1 - 1e-6; k++) {
        const a = phase + k * step;
        d.push(vertical ? `M${px(fr, a)} ${py(fr, y1)}V${py(fr, y0)}` : `M${px(fr, x0)} ${py(fr, a)}H${px(fr, x1)}`);
    }
    return `<path d="${d.join("")}" ${attrs}/>`;
}

/** A world-space polyline with `attrs`. */
function polyline(fr: Frame, pts: readonly Pt[], attrs: string): string {
    return `<path d="${pts.map(([x, y], i) => `${i ? "L" : "M"}${px(fr, x)} ${py(fr, y)}`).join("")}" ${attrs}/>`;
}

/** A world-space line segment with `attrs`. */
function line(fr: Frame, x0: number, y0: number, x1: number, y1: number, attrs: string): string {
    return `<path d="M${px(fr, x0)} ${py(fr, y0)}L${px(fr, x1)} ${py(fr, y1)}" ${attrs}/>`;
}

/** Thin 45° hatch lines (`color`, `width` px, every `period` units) on `bg` over the box. */
function hatch(fr: Frame, b: Box, id: string, color: string, bg: string, period: number, width: number): string {
    const w = f2(period * PX);
    return (
        `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${w}" patternTransform="rotate(45)">` +
        `<rect width="${w}" height="${w}" fill="${bg}"/><rect width="${width}" height="${w}" fill="${color}"/></pattern></defs>` +
        rect(fr, ...b, `fill="url(#${id})"`)
    );
}

/**
 * Stair (or ramp) treads every 0.5 over the box, going down toward `down` (s: to y0, e: to x1, w: to x0): each tread a
 * shade darker than the one above it, a dark nosing line on each tread's upper edge and a yellow safety strip along the
 * top end, where the drop starts.
 */
function treads(fr: Frame, [x0, y0, x1, y1]: Box, down: "s" | "e" | "w"): string {
    const step = 0.5;
    const n = Math.round((down === "s" ? y1 - y0 : x1 - x0) / step);
    const out: string[] = [];
    const nosing: string[] = [];
    for (let i = 0; i < n; i++) {
        // the upper edge of tread i (i = 0 at the top end)
        const a = down === "s" ? y1 - i * step : down === "e" ? x0 + i * step : x1 - i * step;
        const b: Box =
            down === "s" ? [x0, a - step, x1, a] : down === "e" ? [a, y0, a + step, y1] : [a - step, y0, a, y1];
        out.push(rect(fr, ...b, `fill="${mix(TREAD_TOP, TREAD_BOTTOM, i / (n - 1))}"`));
        if (i > 0)
            nosing.push(
                down === "s"
                    ? `M${px(fr, x0)} ${py(fr, a)}H${px(fr, x1)}`
                    : `M${px(fr, a)} ${py(fr, y1)}V${py(fr, y0)}`,
            );
    }
    out.push(`<path d="${nosing.join("")}" stroke="#25282a" stroke-opacity="0.45" stroke-width="3" fill="none"/>`);
    const s = 0.18;
    const top: Box = down === "s" ? [x0, y1 - s, x1, y1] : down === "e" ? [x0, y0, x0 + s, y1] : [x1 - s, y0, x1, y1];
    out.push(rect(fr, ...top, `fill="${HAZARD[0]}"`));
    return out.join("");
}

/** The roof's base box: the image box less the 1-unit parapet (svg.ts roof()). */
function roofInner(layout: RebirthBuildingLayout): Box {
    const { min, max } = layout.bounds;
    return [min.x + 0.5, min.y + 0.5, max.x - 0.5, max.y - 0.5];
}

/** The box of a layout's room with floor key `floor` (the stair and ramp boxes). */
function roomBox(layout: RebirthBuildingLayout, floor: string): Box {
    const r = layout.rooms.find((q) => q.floor === floor);
    if (!r) throw new Error(`military wings art: no ${floor} room`);
    return [r.min.x, r.min.y, r.max.x, r.max.y];
}

/**
 * The parapet strip over each outside door of a layout (a hinged door on the bounds' edge, the 4 units from its hinge,
 * as thresholds() marks it), inside the roof's 4 px outline.
 */
function doorParapets(layout: RebirthBuildingLayout): Box[] {
    const { min, max } = layout.bounds;
    const k = 4 / PX;
    const out: Box[] = [];
    for (const o of layout.openings) {
        if (!o.type.startsWith("house_door")) continue;
        const [dx, dy] = oriDir(o.ori);
        const { x, y } = o.pos;
        const [a, b] =
            dx === 0
                ? [Math.min(y, y + 4 * dy), Math.max(y, y + 4 * dy)]
                : [Math.min(x, x + 4 * dx), Math.max(x, x + 4 * dx)];
        const edge = dx === 0 ? x : y;
        const [lo, hi] = dx === 0 ? [min.x, max.x] : [min.y, max.y];
        let band: readonly [number, number] | null = null;
        if (Math.abs(edge - lo) <= 0.5) band = [lo - 0.5 + k, lo + 0.5];
        else if (Math.abs(edge - hi) <= 0.5) band = [hi - 0.5, hi + 0.5 - k];
        if (band) out.push(dx === 0 ? [band[0], a, band[1], b] : [a, band[0], b, band[1]]);
    }
    return out;
}

/** The boxes of a part's low steel rails (wall-like metal_wall_ext_short_<n> props, ori 1 lying along x). */
function lowRails(part: MilitaryPart): Box[] {
    return part.props.flatMap((q) => {
        const m = typeof q.type === "string" && q.wallLike ? /^metal_wall_ext_short_(\d+)$/.exec(q.type) : null;
        if (!m) return [];
        const h = Number(m[1]) / 2;
        return [
            (q.ori & 1 ? [q.x - h, q.y - 0.5, q.x + h, q.y + 0.5] : [q.x - 0.5, q.y - h, q.x + 0.5, q.y + h]) as Box,
        ];
    });
}

/**
 * A chevron band over a mouth (the fire station's): 1-unit yellow and dark stripes slanting to the band's middle from
 * both ends (two patterns mirrored about its middle line, so the stripes meet in points), outlined. The band runs along
 * its long side, so one over a west or east wall gap stands upright.
 */
function chevronBand(fr: Frame, [x0, y0, x1, y1]: Box, id: string): string {
    const vertical = y1 - y0 > x1 - x0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const w = f2(2 * PX);
    const [ax, ay] = vertical ? [x0, cy] : [cx, y1];
    const half = (sid: string, mirror: boolean) =>
        `<pattern id="${sid}" patternUnits="userSpaceOnUse" width="${w}" height="${w}" ` +
        `patternTransform="translate(${px(fr, ax)} ${py(fr, ay)}) ${mirror ? (vertical ? "scale(1 -1) " : "scale(-1 1) ") : ""}rotate(45)">` +
        `<rect width="${w}" height="${w}" fill="${HAZARD[1]}"/><rect width="${f2(w / 2)}" height="${w}" fill="#f2b705"/>` +
        "</pattern>";
    const a: Box = vertical ? [x0, cy, x1, y1] : [x0, y0, cx, y1];
    const b: Box = vertical ? [x0, y0, x1, cy] : [cx, y0, x1, y1];
    return (
        `<defs>${half(`${id}-a`, false)}${half(`${id}-b`, true)}</defs>` +
        rect(fr, ...a, `fill="url(#${id}-a)"`) +
        rect(fr, ...b, `fill="url(#${id}-b)"`) +
        rect(fr, x0, y0, x1, y1, `fill="none" stroke="${INK}" stroke-width="4"`)
    );
}

/** A shape given in world units around (0, 0) (image y down), placed at (x, y) and turned `deg` degrees clockwise. */
function placed(fr: Frame, x: number, y: number, deg: number, body: string, mirror = false): string {
    return `<g transform="translate(${px(fr, x)} ${py(fr, y)}) ${mirror ? "scale(-1 1) " : ""}rotate(${deg})">${body}</g>`;
}

/** A closed outline of world-unit points around (0, 0) (image y down) as a path's d, in pixels. */
function unitPath(pts: readonly Pt[]): string {
    return `M${pts.map(([x, y]) => `${f2(x * PX)} ${f2(y * PX)}`).join("L")}Z`;
}

// ---------------------------------------------------------------------------------------------------------------------
// infirmary

export const INFIRMARY_FLOORS: FloorPalette = {
    ward: { base: "#bfe0c6", grid: "#a9cfb2", step: 1 },
    triage: { base: "#eef0ee", grid: "#d8dcd8", step: 2 },
    pharmacy: { base: "#cfe0ee", grid: "#b8cbdd", step: 2 },
    // the narcotics store behind the pharmacy: a darker steel-blue strongroom floor
    narcotics: { base: "#8d9aa6", grid: "#7d8a96", step: 1 },
};

/** The infirmary's white panel and red cross map shapes (infirmary.ts: a 9 x 9 panel, a 7 x 2.2 cross). */
const PANEL_WHITE = 0xf4f4f0;
const PANEL_RED = 0xc8312e;

const infirmaryFloor: MilitaryDrawer = ({ part, fr }) => {
    // a faded green pharmacy cross in the pharmacy's free middle, south of its fridge
    const extra = cross(fr, 2.25, 3.25, 3, 1, `fill="#3f9a5a" fill-opacity="0.22"`);
    return floor(part.layout, INFIRMARY_FLOORS, WALLS, INK, extra);
};

const infirmaryCeiling: MilitaryDrawer = ({ part, fr }) => {
    // the panel and the cross drawn from the map shapes' own boxes, so the roof and the minimap show one drawing
    const shape = (color: number, attrs: string) =>
        part.mapShapes
            .filter((m) => m.box && m.color === color)
            .map((m) => rect(fr, ...(m.box as Box), attrs))
            .join("");
    const top =
        lines(fr, roofInner(part.layout), 4, true, `stroke="#526134" stroke-width="3" fill="none"`) +
        shape(PANEL_WHITE, `fill="${hex(PANEL_WHITE)}" stroke="${INK}" stroke-width="4"`) +
        shape(PANEL_RED, `fill="${hex(PANEL_RED)}"`) +
        acUnit(fr, 8.5, 5) +
        circleAt(fr, 8.5, -5.5, 0.6, `fill="#7d868c" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, -8.5, -5.5, 0.6, `fill="#7d868c" stroke="${INK}" stroke-width="3"`);
    return roof(part.layout, "#5b6b3a", "#72824e", "none", top);
};

// ---------------------------------------------------------------------------------------------------------------------
// armory

export const ARMORY_FLOORS: FloorPalette = {
    issue: { base: "#8d8f88", grid: "#7f817a", step: 2 },
    cage: { base: "#6f7378", grid: "#62666b", step: 0.5 },
    ammo: { base: "#7a7c76", grid: "#6d6f69", step: 1 },
    stairs_down_s: STAIRS,
};

// the S2 stairs (armory.ts) go down south
const armoryFloor: MilitaryDrawer = ({ part, fr }) =>
    floor(part.layout, ARMORY_FLOORS, WALLS, INK, treads(fr, roomBox(part.layout, "stairs_down_s"), "s"));

/**
 * One rifle's outline along +x, image y down (its underside +y): the butt at -x, the receiver, the curved magazine, the
 * handguard, the barrel with its front sight at +x. Crossed at x 0.6 (the handguard's back).
 */
const RIFLE: readonly Pt[] = [
    [-3.2, -0.4],
    [-1.6, -0.36],
    [-1.3, -0.45],
    [0.5, -0.45],
    [0.5, -0.36],
    [1.9, -0.36],
    [1.9, -0.24],
    [2.75, -0.24],
    [2.75, -0.5],
    [2.92, -0.5],
    [2.92, -0.24],
    [3.25, -0.24],
    [3.25, -0.04],
    [1.9, -0.04],
    [1.9, 0.14],
    [0.3, 0.2],
    [0.45, 0.95],
    [0, 1.02],
    [-0.25, 0.22],
    [-1.75, 0.28],
    [-3.2, 0.75],
];
const RIFLE_CROSS = 0.6;

/** The armory emblem: a sand disc with a keyline and two crossed rifles, muzzles up (the upper one rimmed in sand). */
function crossedRifles(fr: Frame, x: number, y: number, r: number): string {
    // 0.88x long (the butts stay inside the disc) and a little thicker; the crossing a little above the centre, which
    // centres the X (its butt legs are the longer ones)
    const k = 0.88;
    const d = unitPath(RIFLE.map(([u, v]) => [(u - RIFLE_CROSS) * k, v * k * 1.15] as const));
    const cy = y + 0.36;
    const sand = "#d8cfb8";
    return (
        circleAt(fr, x, y, r, `fill="${sand}" stroke="${INK}" stroke-width="4"`) +
        circleAt(fr, x, y, r - 0.45, `fill="none" stroke="#b5a885" stroke-width="3"`) +
        placed(fr, x, cy, -45, `<path d="${d}" fill="#3a2a1a"/>`, true) +
        placed(
            fr,
            x,
            cy,
            -45,
            `<path d="${d}" fill="${sand}" stroke="${sand}" stroke-width="7" stroke-linejoin="round"/>`,
        ) +
        placed(fr, x, cy, -45, `<path d="${d}" fill="#3a2a1a"/>`)
    );
}

const armoryCeiling: MilitaryDrawer = ({ part, fr }) => {
    const inner = roofInner(part.layout);
    // the emblem is given in the compound frame
    const e = MILITARY_ARMORY_EMBLEM;
    const at = part.placements[0].pos;
    const top =
        // corrugation: a dark trough and a light crest every 0.5 (even ribs read as sheet metal, not planks), and the
        // sheets' end lap across them clear of the emblem
        lines(fr, inner, 0.5, true, `stroke="#654930" stroke-width="3" fill="none"`, 0.25) +
        lines(fr, inner, 0.5, true, `stroke="#8b6a47" stroke-width="2" fill="none"`) +
        line(fr, inner[0], -5, inner[2], -5, `stroke="#5a4029" stroke-width="4"`) +
        line(fr, inner[0], -5.14, inner[2], -5.14, `stroke="#9a7852" stroke-width="2"`) +
        // hazard stripes on the parapet over its two doors only (south and west)
        doorParapets(part.layout)
            .map(
                (b, i) =>
                    hazardBand(fr, ...b, `armory-door-${i}`, HAZARD) +
                    rect(fr, ...b, `fill="none" stroke="${INK}" stroke-width="3"`),
            )
            .join("") +
        crossedRifles(fr, e.x - at.x, e.y - at.y, e.r);
    return roof(part.layout, "#7a5a3a", "#93714c", "none", top);
};

// ---------------------------------------------------------------------------------------------------------------------
// storehouse

export const STOREHOUSE_FLOORS: FloorPalette = {
    store: { base: "#a8a294", grid: "#9a9486", step: 4 },
    stairs_down_e: STAIRS,
};

const storehouseFloor: MilitaryDrawer = ({ part, fr }) => {
    const paint = `stroke="${HAZARD[0]}" stroke-width="5" fill="none" stroke-linejoin="miter"`;
    // yellow bay lines half a unit round the stacks (yard.ts props): the pallet row, the south bay against the wall
    // (crate and cabinet), the east bay by the loading mouth (ammo crate); a hatched keep-clear box on the aisle in front
    // of the stair top
    const extra =
        rect(fr, -7.5, -4, 2.5, 1, paint) +
        polyline(
            fr,
            [
                [-8.25, -11.5],
                [-8.25, -6.25],
                [2.5, -6.25],
                [2.5, -11.5],
            ],
            paint,
        ) +
        polyline(
            fr,
            [
                [9.5, 2.5],
                [4.5, 2.5],
                [4.5, 8],
                [9.5, 8],
            ],
            paint,
        ) +
        hatch(fr, [-9.25, 7.75, -5.25, 11.25], "store-keep-clear", HAZARD[0], "#a8a294", 0.75, 5) +
        rect(fr, -9.25, 7.75, -5.25, 11.25, paint) +
        // the S3 freight stairs (yard.ts) go down east
        treads(fr, roomBox(part.layout, "stairs_down_e"), "e");
    return floor(part.layout, STOREHOUSE_FLOORS, WALLS, INK, extra);
};

/** A brown crate stencil centred on (x, y), `s` units square: the crate, its frame and an X brace. */
function crateStencil(fr: Frame, x: number, y: number, s: number): string {
    const h = s / 2;
    const i = h - 0.4;
    return (
        rect(fr, x - h, y - h, x + h, y + h, `fill="#8a6234" stroke="${INK}" stroke-width="4"`) +
        rect(fr, x - i, y - i, x + i, y + i, `fill="none" stroke="#4a3018" stroke-width="4"`) +
        line(fr, x - i, y - i, x + i, y + i, `stroke="#4a3018" stroke-width="5"`) +
        line(fr, x - i, y + i, x + i, y - i, `stroke="#4a3018" stroke-width="5"`)
    );
}

/**
 * The canvas awning over the loading mouth (the east wall gap y -5.5..2.5), a unit wider on each side: olive canvas
 * panels running out from the wall to the image edge, a scalloped inner edge, outlined.
 */
function awning(fr: Frame, x0: number, x1: number, y0: number, y1: number): string {
    const r = 0.5;
    const out: string[] = [];
    let d = `M${px(fr, x1)} ${py(fr, y1)}H${px(fr, x0)}`;
    for (let y = y1, i = 0; y > y0 + 1e-6; y -= 2 * r, i++) {
        const c = i % 2 === 0 ? "#7d7a4f" : "#949163";
        out.push(rect(fr, x0, y - 2 * r, x1, y, `fill="${c}"`));
        out.push(circleAt(fr, x0, y - r, r, `fill="${c}"`));
        d += `A${f2(r * PX)} ${f2(r * PX)} 0 0 0 ${px(fr, x0)} ${py(fr, y - 2 * r)}`;
    }
    d += `H${px(fr, x1)}Z`;
    out.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
    return out.join("");
}

const storehouseCeiling: MilitaryDrawer = ({ part, fr }) => {
    const inner = roofInner(part.layout);
    const [ix0, , ix1] = inner;
    // skylight strips every 4 (y ±2, ±6, ±10) running the width; the middle pair stops short of the crate stencil
    const strip = (a: number, b: number, y: number) =>
        rect(fr, a, y - 0.35, b, y + 0.35, `fill="#d8e4e8" stroke="${INK}" stroke-width="3"`) +
        lines(fr, [a, y - 0.35, b, y + 0.35], 1, true, `stroke="#a9bcc4" stroke-width="2" fill="none"`);
    const strips = [-10, -6, -2, 2, 6, 10].map((y) =>
        Math.abs(y) === 2 ? strip(ix0 + 0.75, -2.75, y) + strip(2.75, ix1 - 0.75, y) : strip(ix0 + 0.75, ix1 - 0.75, y),
    );
    const top =
        lines(fr, inner, 0.5, false, `stroke="#a48d5e" stroke-width="2" fill="none"`, 0.25) +
        strips.join("") +
        crateStencil(fr, 0, 0, 3.6) +
        awning(fr, 7.75, 10.5, -6.5, 3.5);
    return roof(part.layout, "#b59e6e", "#c8b283", "none", top);
};

// ---------------------------------------------------------------------------------------------------------------------
// garage

export const GARAGE_FLOORS: FloorPalette = {
    bay: { base: "#8a8d88", grid: "#7d807b", step: 4 },
    workshop: { base: "#9a8a70", grid: "#8b7b62", step: 1 },
    ramp_down_w: STAIRS,
};

const garageFloor: MilitaryDrawer = ({ part, fr }) => {
    // the S4 ramp (yard.ts) goes down west between its low rails, which have no image of their own: drawn in yellow
    // and black, outlined like the walls; yellow lane lines carry their inner edges from the ramp's top out to the
    // ramp mouth in the east wall
    const ramp = roomBox(part.layout, "ramp_down_w");
    const mouth = part.layout.bounds.max.x;
    const rails = lowRails(part);
    const lane = `stroke="${HAZARD[0]}" stroke-width="5" fill="none"`;
    const e = 2.5 / PX;
    const extra =
        treads(fr, ramp, "w") +
        rails.map((b) => rect(fr, ...b, `fill="${INK}"`, 3)).join("") +
        rails.map((b, i) => hazardBand(fr, ...b, `garage-rail-${i}`, HAZARD, 0.35)).join("") +
        line(fr, ramp[2], ramp[1] + e, mouth, ramp[1] + e, lane) +
        line(fr, ramp[2], ramp[3] - e, mouth, ramp[3] - e, lane);
    return floor(part.layout, GARAGE_FLOORS, WALLS, INK, extra);
};

/** An open-end wrench along +x around (0, 0), world units: a box-end ring at -x, the open jaw at +x. */
function wrenchPath(): string {
    const s = (v: number) => f2(v * PX);
    const R = 1;
    const r = 0.75;
    const hw = 0.42;
    const jaw = 0.38;
    const hx = 2.6;
    const bx = -2.6;
    const xa = bx + Math.sqrt(r * r - hw * hw);
    const xb = hx - Math.sqrt(R * R - hw * hw);
    const xc = hx + Math.sqrt(R * R - jaw * jaw);
    const hole = 0.33;
    return (
        `M${s(xa)} ${s(-hw)}H${s(xb)}A${s(R)} ${s(R)} 0 0 1 ${s(xc)} ${s(-jaw)}H${s(hx - 0.1)}V${s(jaw)}H${s(xc)}` +
        `A${s(R)} ${s(R)} 0 0 1 ${s(xb)} ${s(hw)}H${s(xa)}A${s(r)} ${s(r)} 0 1 1 ${s(xa)} ${s(-hw)}Z` +
        `M${s(bx + hole)} 0A${s(hole)} ${s(hole)} 0 1 0 ${s(bx - hole)} 0A${s(hole)} ${s(hole)} 0 1 0 ${s(bx + hole)} 0Z`
    );
}

/** The ramp's roof panel: a dark hatched slab over the ramp box with a white arrow pointing down the ramp (west). */
function rampPanel(fr: Frame, ramp: Box): string {
    const [x0, y0, x1, y1] = ramp;
    const cy = (y0 + y1) / 2;
    // the tip 0.9 in from the bottom end, the head 2.5 long and 4 wide, the shaft 1.5 wide to 0.8 short of the top end
    const tip = x0 + 0.9;
    const head = tip + 2.5;
    const tail = x1 - 0.8;
    return (
        hatch(fr, ramp, "garage-ramp-hatch", "#5d605b", "#70736d", 0.6, 6) +
        rect(fr, x0, y0, x1, y1, `fill="none" stroke="${INK}" stroke-width="4"`) +
        polygon(
            fr,
            [
                [tip, cy],
                [head, cy + 2],
                [head, cy + 0.75],
                [tail, cy + 0.75],
                [tail, cy - 0.75],
                [head, cy - 0.75],
                [head, cy - 2],
            ],
            `fill="#f4f4f0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"`,
        )
    );
}

const garageCeiling: MilitaryDrawer = ({ part, fr }) => {
    const inner = roofInner(part.layout);
    const { min, max } = part.layout.bounds;
    const ramp = roomBox(part.layout, "ramp_down_w");
    // standing seams every 2; chevron bands 2 wide from the wall line inward over the west bay mouth (yard.ts: open from
    // y 3.5, compound -4, to the north wall) and the ramp mouth in the east wall (the ramp box's own y range)
    const top =
        lines(fr, inner, 2, true, `stroke="#7c7f78" stroke-width="3" fill="none"`) +
        chevronBand(fr, [min.x, 3.5, min.x + 2, max.y - 0.5], "garage-chevron-w") +
        chevronBand(fr, [max.x - 2, ramp[1], max.x, ramp[3]], "garage-chevron-e") +
        rampPanel(fr, ramp) +
        placed(
            fr,
            5.75,
            9.25,
            -45,
            `<path d="${wrenchPath()}" fill="#f4f4f0" fill-rule="evenodd" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
        );
    return roof(part.layout, "#8b8e87", "#a2a59e", "none", top);
};

export const WINGS_ART: Readonly<Record<string, MilitaryDrawer>> = {
    "map-building-milbase-infirmary-floor-01.img": infirmaryFloor,
    "map-building-milbase-infirmary-ceiling-01.img": infirmaryCeiling,
    "map-building-milbase-armory-floor-01.img": armoryFloor,
    "map-building-milbase-armory-ceiling-01.img": armoryCeiling,
    "map-building-milbase-storehouse-floor-01.img": storehouseFloor,
    "map-building-milbase-storehouse-ceiling-01.img": storehouseCeiling,
    "map-building-milbase-garage-floor-01.img": garageFloor,
    "map-building-milbase-garage-ceiling-01.img": garageCeiling,
};
