// Floor and roof art of capitol_01 (packages/defs rebirth/buildings/capitol.ts): a pale marble lobby with a red runner
// and the brass seal plaque (the code), the rotunda's round inlaid floor (a ring of alternating marble wedges round a
// compass star), the council chamber's blue carpet with a red aisle runner and the speaker's dais, parquet offices,
// a stone corridor in each wing, the records room's linoleum, the governor's burgundy carpet, the vault's steel plate,
// the seal switches' coloured plates, pale limestone walls, and the portico's flagstones and steps; a limestone roof
// over the central block between slate wing roofs, the copper dome with its ribs, drum and lantern over the rotunda,
// the pediment over the front, a skylight over the chamber, the flag and the wings' AC units.
import {
    CAPITOL_CODE,
    CAPITOL_LAYOUT,
    CAPITOL_PLAQUE,
    CAPITOL_ROTUNDA,
    CAPITOL_STEPS,
    CAPITOL_SWITCHES,
    CAPITOL_VAULT_DOOR,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
    type FloorPalette,
    type Frame,
    floor,
    floorFrameOf,
    frameOf,
    polygon,
    px,
    py,
    rect,
    roof,
    SWITCH_PLATE_COLORS,
    switchPlate,
} from "./svg.ts";

export const CAPITOL_FLOORS: FloorPalette = {
    office: { base: "#b58b5c", grid: "#a57d51", step: 1 },
    corridor: { base: "#d3cab7", grid: "#c1b8a4", step: 2 },
    clerks: { base: "#9c8866", grid: "#8e7b5b", step: 1 },
    records: { base: "#857b69", grid: "#776e5d", step: 2 },
    governor: { base: "#7b2b2f", grid: "#6e262a", step: 2 },
    vault: { base: "#5f6b73", grid: "#545f67", step: 1 },
    lobby: { base: "#e6e0d2", grid: "#d2cbba", step: 2 },
    rotunda: { base: "#ddd6c6", grid: "#cbc3b1", step: 2 },
    chamber: { base: "#2f4d78", grid: "#2a456c", step: 2 },
    portico: { base: "#c9c0ab", grid: "#b5ac97", step: 2 },
};

const INK = "#2b2520";
const BRASS = "#c9a640";

type Pt = readonly [number, number];

/** The point at angle `a` (radians, 0 east, counter-clockwise) and radius `r` round (x, y). */
const at = (x: number, y: number, a: number, r: number): Pt => [x + Math.cos(a) * r, y + Math.sin(a) * r];

/**
 * The rotunda's round floor: a dark rim, a ring of 16 alternating marble wedges, a pale field with an inner ring and
 * an eight-point compass star, all round the statue in the middle.
 */
function rotundaFloor(fr: Frame): string {
    const { x, y, r } = CAPITOL_ROTUNDA;
    const out: string[] = [circleAt(fr, x, y, r, `fill="#5d5448"`)];
    const n = 16;
    for (let i = 0; i < n; i++) {
        const a0 = (i * 2 * Math.PI) / n;
        const a1 = ((i + 1) * 2 * Math.PI) / n;
        const pts: Pt[] = [at(x, y, a0, r - 0.35), at(x, y, a1, r - 0.35), at(x, y, a1, r - 2), at(x, y, a0, r - 2)];
        out.push(polygon(fr, pts, `fill="${i % 2 ? "#b9ad95" : "#efe9dc"}"`));
    }
    out.push(
        circleAt(fr, x, y, r - 2, `fill="#e9e3d6" stroke="#5d5448" stroke-width="4"`),
        circleAt(fr, x, y, r - 3.4, `fill="none" stroke="#b9ad95" stroke-width="5"`),
    );
    // the compass star: long points north, south, east and west, short ones between
    const star: Pt[] = [];
    for (let i = 0; i < 16; i++) {
        const a = Math.PI / 2 - (i * Math.PI) / 8;
        const rr = i % 4 === 0 ? r - 3.6 : i % 2 === 0 ? r - 5.5 : 1.6;
        star.push(at(x, y, a, rr));
    }
    out.push(polygon(fr, star, `fill="#8f8066" fill-opacity="0.75" stroke="#5d5448" stroke-width="3"`));
    return out.join("");
}

/** The brass plaque with the seal code: a brass sheet, a dark inset, one coloured disc per step, left to right. */
function plaque(fr: Frame, x: number, y: number, colors: readonly string[]): string {
    const w = 1.3 * colors.length + 0.9;
    const out = [
        rect(fr, x - w / 2, y - 1, x + w / 2, y + 1, `fill="${BRASS}" stroke="${INK}" stroke-width="4"`),
        rect(fr, x - w / 2 + 0.3, y - 0.7, x + w / 2 - 0.3, y + 0.7, `fill="#3b3226"`),
    ];
    colors.forEach((c, i) => {
        out.push(circleAt(fr, x - w / 2 + 1.1 + i * 1.3, y, 0.42, `fill="${c}" stroke="${BRASS}" stroke-width="3"`));
    });
    return out.join("");
}

/** A carpet runner over the world box, with darker edge trim. */
function runner(fr: Frame, x0: number, y0: number, x1: number, y1: number, color: string): string {
    const vertical = y1 - y0 > x1 - x0;
    const trim = vertical
        ? rect(fr, x0, y0, x0 + 0.25, y1, `fill="${color}" fill-opacity="0.6"`) +
          rect(fr, x1 - 0.25, y0, x1, y1, `fill="${color}" fill-opacity="0.6"`)
        : rect(fr, x0, y0, x1, y0 + 0.25, `fill="${color}" fill-opacity="0.6"`) +
          rect(fr, x0, y1 - 0.25, x1, y1, `fill="${color}" fill-opacity="0.6"`);
    return rect(fr, x0, y0, x1, y1, `fill="${color}" fill-opacity="0.6"`) + trim;
}

/** The portico's steps: alternating light and shadowed treads across its south edge. */
function steps(fr: Frame): string {
    const { x0, x1, y0, y1 } = CAPITOL_STEPS;
    const out: string[] = [];
    const n = 4;
    const d = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
        const ya = y0 + i * d;
        out.push(rect(fr, x0, ya, x1, ya + d, `fill="${i % 2 ? "#d9d1bf" : "#b3aa95"}"`));
        out.push(rect(fr, x0, ya + d - 0.08, x1, ya + d, `fill="#7f7663"`));
    }
    return out.join("");
}

export function capitolFloor(): string {
    const fr = floorFrameOf(CAPITOL_LAYOUT);
    const d = CAPITOL_VAULT_DOOR.pos;
    const extra =
        steps(fr) +
        // the lobby's runner from the front door to the archway, stopping short of the plaque
        runner(fr, -2, -22.5, 2, CAPITOL_PLAQUE.y - 1.3, "#9d2b2b") +
        plaque(
            fr,
            CAPITOL_PLAQUE.x,
            CAPITOL_PLAQUE.y,
            CAPITOL_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
        ) +
        rotundaFloor(fr) +
        // the chamber: the red aisle runner up to the dais, the dais's pale boards behind the speaker's bench
        rect(fr, -6, 18.75, 6, 22.5, `fill="#a88a5e"`) +
        rect(fr, -6, 18.75, 6, 19, `fill="#6e5a3c"`) +
        runner(fr, -1.75, 8.5, 1.75, 18.75, "#b33a3a") +
        // the vault's steel threshold strip before its door, on the governor's side
        rect(fr, d.x - 1.25, d.y, d.x - 0.5, d.y + 4, `fill="#3a3f44"`) +
        CAPITOL_SWITCHES.map((sw) => switchPlate(fr, sw.x, sw.y, SWITCH_PLATE_COLORS[sw.label])).join("");
    return floor(CAPITOL_LAYOUT, CAPITOL_FLOORS, { brick: "#d9cfb6", concrete: "#d9cfb6" }, INK, extra);
}

/** The copper dome over the rotunda: its limestone drum, the green copper with 12 ribs, the lantern and finial. */
function dome(fr: Frame): string {
    const { x, y, r } = CAPITOL_ROTUNDA;
    const out = [
        circleAt(fr, x, y, r + 1, `fill="#e3dbc4" stroke="${INK}" stroke-width="5"`),
        circleAt(fr, x, y, r + 0.2, `fill="#4f8f80" stroke="${INK}" stroke-width="4"`),
        circleAt(fr, x, y, r - 3, `fill="#5c9c8c"`),
    ];
    const ribs: string[] = [];
    for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const [ax, ay] = at(x, y, a, 2.4);
        const [bx, by] = at(x, y, a, r + 0.1);
        ribs.push(`M${px(fr, ax)} ${py(fr, ay)}L${px(fr, bx)} ${py(fr, by)}`);
    }
    out.push(
        `<path d="${ribs.join("")}" stroke="#3a6e62" stroke-width="5" fill="none"/>`,
        circleAt(fr, x, y, 2.4, `fill="#e9e1c9" stroke="${INK}" stroke-width="4"`),
        circleAt(fr, x, y, 1.4, `fill="#4f8f80" stroke="${INK}" stroke-width="3"`),
        circleAt(fr, x, y, 0.55, `fill="${BRASS}" stroke="${INK}" stroke-width="2"`),
    );
    return out.join("");
}

/** A glass skylight over the world box: a frame, the glass, mullions every 2 units. */
function skylight(fr: Frame, x0: number, y0: number, x1: number, y1: number): string {
    const bars: string[] = [];
    for (let x = x0 + 2; x < x1 - 0.5; x += 2) bars.push(`M${px(fr, x)} ${py(fr, y1 - 0.35)}V${py(fr, y0 + 0.35)}`);
    return (
        rect(fr, x0, y0, x1, y1, `fill="#cfc6ae" stroke="${INK}" stroke-width="4"`) +
        rect(fr, x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, `fill="#a9c6d6" stroke="${INK}" stroke-width="2"`) +
        `<path d="${bars.join("")}" stroke="#f4f7f8" stroke-width="5" fill="none"/>`
    );
}

/** The flag on its pole at (x, y): a pole cap and the province's flag (blue, a white band, a gold disc). */
function flag(fr: Frame, x: number, y: number): string {
    return (
        rect(fr, x + 0.3, y - 0.9, x + 3.9, y + 0.9, `fill="#2f5d9c" stroke="${INK}" stroke-width="3"`) +
        rect(fr, x + 0.3, y - 0.2, x + 3.9, y + 0.2, `fill="#f4f1e8"`) +
        circleAt(fr, x + 2.1, y, 0.45, `fill="${BRASS}"`) +
        circleAt(fr, x, y, 0.45, `fill="#9aa2a8" stroke="${INK}" stroke-width="3"`)
    );
}

export function capitolCeiling(): string {
    const fr = frameOf(CAPITOL_LAYOUT);
    // the wings' slate roofs (inside the parapet), their ridge lines along the corridors
    const wing = (x0: number, x1: number) =>
        rect(fr, x0, -22.5, x1, 22.5, `fill="#77858b"`) +
        rect(fr, x0, -2.3, x1, -1.7, `fill="#5d6a70"`) +
        rect(fr, x0, -22.5, x1, 22.5, `fill="none" stroke="#4d585d" stroke-width="3"`);
    const top =
        wing(-31.5, -12) +
        wing(12, 31.5) +
        // the central block's cornice lines along the wings
        rect(fr, -12.5, -22.5, -11.5, 22.5, `fill="#a99f88"`) +
        rect(fr, 11.5, -22.5, 12.5, 22.5, `fill="#a99f88"`) +
        // the pediment over the front: its base on the roof's edge
        polygon(
            fr,
            [
                [-11, -23.5],
                [11, -23.5],
                [0, -17.5],
            ],
            `fill="#e6dcc0" stroke="${INK}" stroke-width="5" stroke-linejoin="round"`,
        ) +
        polygon(
            fr,
            [
                [-7.5, -22.6],
                [7.5, -22.6],
                [0, -19],
            ],
            `fill="#cfc3a2" stroke="#8f8466" stroke-width="3" stroke-linejoin="round"`,
        ) +
        skylight(fr, -6, 12, 6, 17) +
        flag(fr, -2, 20.5) +
        acUnit(fr, -22, -14) +
        acUnit(fr, 22, -14) +
        acUnit(fr, -22, 14) +
        acUnit(fr, 22, 14) +
        dome(fr);
    return roof(CAPITOL_LAYOUT, "#cfc6ae", "#a99f88", "#bdb39b", top);
}
