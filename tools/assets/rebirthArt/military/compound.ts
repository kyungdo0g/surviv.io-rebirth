// The military base's compound images (packages/defs rebirth/buildings/military/compound.ts). The compound has no roof
// and its yard colours are the compound's mapGroundPatches (gravel, asphalt, the parade's kerb and the hatch pad), so
// every image here is transparent but for its own walls and markings: the eight perimeter strips (concrete walls and
// loophole sills from the compound layout, the gates left open), the parade ground's paint (inset border, four company
// blocks of T-marks, the yellow axis to the reviewing stand, the saluting ring), the emblem under the flagpole (gold
// star on dark olive; 50v50 a white star on the faction disc), the sapper hatch outside the south wall (stairs going
// down north between low steel rails), the checkpoint outside the main gate (STOP line, kerb stripes, the barrier arm
// swung open) and the motor apron's bays and chevrons toward the motor gate.
import {
    MILITARY_GATES,
    MILITARY_GROUND_PATCHES,
    MILITARY_PARADE,
    MILITARY_PARADE_CENTRE,
    MILITARY_PERIMETER,
    REBIRTH_ART_PX_PER_UNIT as PX,
    type WallSeg,
} from "../../../../packages/defs/src/rebirth/buildings.ts";
import { circleAt, type Frame, f2, hazardBand, hex, px, py, rect, star, svg, thresholds, walls } from "../svg.ts";
import type { MilitaryArtContext, MilitaryDrawer } from "./index.ts";

const INK = "#1f2326";
/** The perimeter's concrete: a shade lighter than the gravel yard (0x7d7a6e) so the dark outline frames a pale wall. */
const CONCRETE = "#9a9b93";
const PAINT = "#ecebe4";
const YELLOW = "#e2b425";
const RED = "#c8312e";
const STEEL = "#6b767e";
const HAZARD = [YELLOW, "#26282a"] as const;

type Pt = readonly [number, number];

/** Stroke width attribute of `w` world units. */
const sw = (w: number) => `stroke-width="${f2(w * PX)}"`;

/** A polyline through the world points x0, y0, x1, y1, ... */
const poly = (...v: number[]): Pt[] => v.flatMap((_, i) => (i % 2 ? [] : [[v[i], v[i + 1]] as const]));

/** Stroked polylines (paint lines, letters), one path. */
function lines(fr: Frame, strokes: ReadonlyArray<readonly Pt[]>, w: number, color: string, extra = ""): string {
    const d = strokes.map((s) => s.map(([x, y], i) => `${i ? "L" : "M"}${px(fr, x)} ${py(fr, y)}`).join("")).join("");
    return `<path d="${d}" fill="none" stroke="${color}" ${sw(w)} ${extra}/>`;
}

/** `#rrggbb` between a and b at t (0 a, 1 b). */
function mix(a: string, b: string, t: number): string {
    const ch = (c: string, i: number) => Number.parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
    const v = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
    return `#${v.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** A chevron centred on (x, y) pointing along the unit (dx, dy): `half` wide each side, `depth` from wings to tip. */
function chevron(x: number, y: number, dx: number, dy: number, half: number, depth: number): Pt[] {
    const bx = x - (dx * depth) / 2;
    const by = y - (dy * depth) / 2;
    return poly(
        bx - dy * half,
        by + dx * half,
        x + (dx * depth) / 2,
        y + (dy * depth) / 2,
        bx + dy * half,
        by - dx * half,
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// perimeter strips

/** Whether the world box (x0, y0)-(x1, y1) reaches into the frame (grown by a quarter unit for the outlines). */
function touches(fr: Frame, x0: number, y0: number, x1: number, y1: number): boolean {
    const m = 0.25;
    return x1 > fr.ox - m && x0 < fr.ox + fr.w / PX + m && y1 > fr.oy - fr.h / PX - m && y0 < fr.oy + m;
}

/** The wall pieces joined into straight runs (one rect per run: no seams between pieces when the image is scaled). */
function runs(segs: readonly WallSeg[]): WallSeg[] {
    const out: [number, number, number, number][] = [];
    const sorted = segs.map((s) => [s[0], s[1], s[2], s[3]] as const).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x0, y0, x1, y1] of sorted) {
        const last = out.find((r) =>
            y0 === y1 ? r[1] === y0 && r[3] === y0 && r[2] === x0 : r[0] === x0 && r[2] === x0 && r[3] === y0,
        );
        if (last) [last[2], last[3]] = [x1, y1];
        else out.push([x0, y0, x1, y1]);
    }
    return out;
}

/**
 * The gate gaps' ground, which no ground patch covers (the yard stops at the walls' inner faces, the aprons at their
 * outer faces): asphalt with a steel track line through the main and motor gates, gravel through the postern and the
 * wicket, so every gate reads as an open passage.
 */
function gateSills(fr: Frame): string {
    const gravel = hex(MILITARY_GROUND_PATCHES[0].color);
    const asphalt = hex(MILITARY_GROUND_PATCHES[1].color);
    const { x: X, y: Y } = MILITARY_PERIMETER;
    const gaps = [
        { a: MILITARY_GATES.main, line: -Y, horizontal: true, ground: asphalt, track: true },
        { a: MILITARY_GATES.postern, line: Y, horizontal: true, ground: gravel, track: false },
        { a: MILITARY_GATES.wicket, line: -X, horizontal: false, ground: gravel, track: false },
        { a: MILITARY_GATES.motor, line: X, horizontal: false, ground: asphalt, track: true },
    ];
    return gaps
        .map(({ a: [a0, a1], line, horizontal, ground, track }) => {
            const box = (d: number): readonly [number, number, number, number] =>
                horizontal ? [a0, line - d, a1, line + d] : [line - d, a0, line + d, a1];
            if (!touches(fr, ...box(0.5))) return "";
            return rect(fr, ...box(0.5), `fill="${ground}"`) + (track ? rect(fr, ...box(0.08), `fill="#3a3d40"`) : "");
        })
        .join("");
}

/**
 * One perimeter strip: the compound layout (its walls are exactly the perimeter runs, its openings the ten loopholes)
 * as far as it reaches into the strip's frame, which clips the rest. The gate gaps have no wall, so they read open; the
 * corner towers and the gatehouse draw their own walls. Horizontal runs own the corners and each strip draws whatever
 * wall reaches into it, so the strips agree where their frames overlap.
 */
function wallStrip({ part, fr, ppu }: MilitaryArtContext): string {
    const layout = {
        ...part.layout,
        walls: runs(part.layout.walls).filter(([x0, y0, x1, y1]) =>
            touches(fr, x0 - 0.5, y0 - 0.5, x1 + 0.5, y1 + 0.5),
        ),
        openings: part.layout.openings.filter(({ pos: { x, y } }) => touches(fr, x - 1.5, y - 1.5, x + 1.5, y + 1.5)),
    };
    return svg(fr, gateSills(fr) + thresholds(fr, layout, "#00000033") + walls(fr, layout, CONCRETE, INK), ppu);
}

// ---------------------------------------------------------------------------------------------------------------------
// parade ground

/** Clear radius round the parade centre: the emblem disc (r 4.5) and its outline, under the flagpole. */
const EMBLEM_CLEAR = 5.25;

/** One company block: 3 x 3 T-marks (bar north, stem south: a soldier's spot facing the stand), 2 units apart. */
function company(cx: number, cy: number): Pt[][] {
    const out: Pt[][] = [];
    for (const x of [cx - 2, cx, cx + 2]) {
        for (const y of [cy - 2, cy, cy + 2]) out.push(poly(x - 0.5, y, x + 0.5, y), poly(x, y, x, y - 0.75));
    }
    return out;
}

/** Dashes 1 long with 0.75 gaps along x = `x` from y0 up to y1, centred in the run. */
function dashes(x: number, y0: number, y1: number): Pt[][] {
    const n = Math.floor((y1 - y0 + 0.75) / 1.75);
    const start = y0 + (y1 - y0 - (n * 1.75 - 0.75)) / 2;
    return Array.from({ length: n }, (_, i) => poly(x, start + i * 1.75, x, start + i * 1.75 + 1));
}

function parade({ fr, ppu }: MilitaryArtContext): string {
    const [x0, y0, x1, y1] = MILITARY_PARADE;
    const { x: cx, y: cy } = MILITARY_PARADE_CENTRE;
    // the inset border 0.5 inside the 1-unit kerb
    const inset = 1.5;
    const border = rect(fr, x0 + inset, y0 + inset, x1 - inset, y1 - inset, `fill="none" stroke="${PAINT}" ${sw(0.2)}`);
    // four companies in the south half, two each side of the axis: clear of the emblem, the vault vents at (±11, -15)
    // and the corner sandbags at (±21.5, -21.5)
    const marks = [-17, -6, 6, 17].flatMap((x) => company(x, -19));
    // the saluting ring in front of the reviewing stand (north of the parade), on the axis, with its base line
    const ring = { y: 1.2, r: 1.4 };
    const base = ring.y + ring.r + 0.6;
    const axis = [
        ...dashes(cx, y0 + inset + 0.6, cy - EMBLEM_CLEAR),
        ...dashes(cx, cy + EMBLEM_CLEAR, ring.y - ring.r - 0.5),
    ];
    const body =
        border +
        lines(fr, [...marks, poly(cx - 2.2, base, cx + 2.2, base)], 0.2, PAINT) +
        lines(fr, axis, 0.22, YELLOW) +
        circleAt(fr, cx, ring.y, ring.r, `fill="none" stroke="${PAINT}" ${sw(0.22)}`) +
        circleAt(fr, cx, ring.y, 0.3, `fill="${PAINT}"`);
    return svg(fr, body, ppu);
}

// ---------------------------------------------------------------------------------------------------------------------
// emblem

/** The disc under the flagpole (the minimap's r 4.5 disc): main a gold star on dark olive with a pale keyline, 50v50 a
 * white star on the faction colour with a white keyline (the base's emblem and star colours). */
function emblem({ base, fr, ppu }: MilitaryArtContext): string {
    const { x, y } = MILITARY_PARADE_CENTRE;
    const keyline = base.side === "" ? "#d9cfa4" : "#f4f4f0";
    const body =
        circleAt(fr, x, y, 4.5, `fill="${hex(base.emblem)}" stroke="${INK}" stroke-width="4"`) +
        circleAt(fr, x, y, 3.85, `fill="none" stroke="${keyline}" ${sw(0.18)}`) +
        star(fr, x, y + 0.15, 3, hex(base.star));
    return svg(fr, body, ppu);
}

// ---------------------------------------------------------------------------------------------------------------------
// sapper hatch

/** The hatch's pad and stair box (S5: down north; the perimeter wall closes its bottom end at y -42). */
const PAD = { x0: -34, y0: -50, x1: -26, y1: -42 } as const;
const STAIR = { x0: -32, y0: -48, x1: -28, y1: -42 } as const;
/** The low steel rails' centre lines (metal_wall_ext_short_7, 1 x 7: y -49..-42). */
const RAILS = [-32.5, -27.5] as const;

function hatch({ fr, ppu }: MilitaryArtContext): string {
    const out: string[] = [];
    // the concrete pad: the ground patch's colour with a worn edge and a joint across its south apron
    out.push(rect(fr, PAD.x0, PAD.y0, PAD.x1, PAD.y1, `fill="#b3ad9e" stroke="#8f897b" stroke-width="4"`, -2));
    out.push(lines(fr, [poly(PAD.x0 + 0.2, -49.5, PAD.x1 - 0.2, -49.5)], 0.08, "#9d9789"));
    // the flight: 12 treads of 0.5, pale at the top (south), darkening toward the bottom under the wall, each with a
    // dark nosing on its north (lower) edge
    for (let i = 0; i < 12; i++) {
        const ty = STAIR.y0 + i * 0.5;
        out.push(rect(fr, STAIR.x0, ty, STAIR.x1, ty + 0.5, `fill="${mix("#a3a6a8", "#2e3134", i / 11)}"`));
        out.push(rect(fr, STAIR.x0, ty + 0.42, STAIR.x1, ty + 0.5, `fill="${INK}" fill-opacity="0.45"`));
    }
    // the steel landing plate across the top between the rails' ends, a hazard nosing on the first step
    const scuffs = [0, 1, 2, 3, 4].map((k) => poly(-31.6 + k * 0.8, -48.75, -31.2 + k * 0.8, -48.25));
    out.push(rect(fr, -33, -49, -27, STAIR.y0, `fill="${STEEL}" stroke="${INK}" stroke-width="3"`));
    out.push(lines(fr, scuffs, 0.07, "#56606a"));
    out.push(hazardBand(fr, STAIR.x0, STAIR.y0, STAIR.x1, STAIR.y0 + 0.35, "hatch-nose", HAZARD, 0.25));
    // the rails: steel with hazard-striped tops (bullets and grenades pass over them)
    RAILS.forEach((x, i) => {
        out.push(rect(fr, x - 0.5, -49, x + 0.5, PAD.y1, `fill="${STEEL}" stroke="${INK}" stroke-width="3"`));
        out.push(hazardBand(fr, x - 0.3, -48.8, x + 0.3, PAD.y1, `hatch-rail-${i}`, HAZARD, 0.35));
    });
    return svg(fr, out.join(""), ppu);
}

// ---------------------------------------------------------------------------------------------------------------------
// main gate checkpoint

/** Block stencil letters of the word STOP, `h` tall, from their bottom-left corner (x, y). */
function stopWord(x: number, y: number, h: number): Pt[][] {
    const w = h * 0.62;
    const [s, t, o, p] = [0, 1, 2, 3].map((i) => x + i * (w + h * 0.3));
    const m = y + h / 2;
    const top = y + h;
    return [
        poly(s + w, top, s, top, s, m, s + w, m, s + w, y, s, y),
        poly(t, top, t + w, top),
        poly(t + w / 2, top, t + w / 2, y),
        poly(o, y, o, top, o + w, top, o + w, y, o, y),
        poly(p, y, p, top, p + w, top, p + w, m, p, m),
    ];
}

/** Alternating red and white blocks `len` long along a kerb strip (x0..x1, from y0 up to y1), outlined. */
function kerb(fr: Frame, x0: number, y0: number, x1: number, y1: number, len: number): string {
    const out = [rect(fr, x0, y0, x1, y1, `fill="${INK}"`, 2)];
    for (let y = y0, i = 0; y < y1 - 1e-9; y += len, i++) {
        out.push(rect(fr, x0, y, x1, Math.min(y + len, y1), `fill="${i % 2 ? PAINT : RED}"`));
    }
    return out.join("");
}

/**
 * Outside the main gate (x -4..4) on its apron: the stop line across the road with the word between it and the gate
 * (the leaves swing over it; the attackers' sandbags at (0, -48) stay clear of it), red and white kerbs along both
 * edges of the apron, and the barrier on the east side at the stop line, its arm swung up along the road side.
 */
function gate({ fr, ppu }: MilitaryArtContext): string {
    const lineY = -46.2;
    const post = { x: 5, y: lineY };
    const arm = { x0: post.x - 0.2, y0: post.y + 0.35, x1: post.x + 0.2, y1: -42.4 };
    const stripes: string[] = [];
    for (let y = arm.y0, i = 0; y < arm.y1 - 1e-9; y += 0.6, i++) {
        stripes.push(rect(fr, arm.x0, y, arm.x1, Math.min(y + 0.6, arm.y1), `fill="${i % 2 ? PAINT : RED}"`));
    }
    const outlined = (fill: string) => `fill="${fill}" stroke="${INK}" stroke-width="3"`;
    const body =
        rect(fr, -4, lineY - 0.25, 4.2, lineY + 0.25, `fill="${PAINT}"`) +
        lines(fr, stopWord(-1.95, -45.35, 1.15), 0.17, PAINT, `stroke-linejoin="miter" stroke-linecap="square"`) +
        kerb(fr, -6.6, -46.85, -6, -42.15, 0.8) +
        kerb(fr, 6, -46.85, 6.6, -42.15, 0.8) +
        // the arm, its counterweight south of the pivot, the post with its red pivot cap
        rect(fr, arm.x0, arm.y0, arm.x1, arm.y1, `fill="${INK}"`, 3) +
        stripes.join("") +
        rect(fr, post.x - 0.35, -46.9, post.x + 0.35, post.y - 0.2, outlined("#3a3d40")) +
        rect(fr, post.x - 0.45, post.y - 0.45, post.x + 0.45, post.y + 0.45, outlined("#d8d6cf")) +
        circleAt(fr, post.x, post.y, 0.2, `fill="${RED}"`);
    return svg(fr, body, ppu);
}

// ---------------------------------------------------------------------------------------------------------------------
// motor apron

/**
 * The motor apron (x 16..52, y -41..-21): a row of five bays along the south wall, a lane under the garage with
 * chevrons east to the east lane (x 48..52), chevrons north up that lane toward the motor gate (east wall, y -15..-6).
 * Kept off the closed container at (21.5, -35.5), the loot container across the middle (x 28..44, y -33.5..-28.5) and
 * the barrels at x 47.5.
 */
function motor({ fr, ppu }: MilitaryArtContext): string {
    // bays: a back line along the south wall and dividers 4 apart, 5 deep
    const bay = { x0: 25.5, x1: 45.5, back: -40.4, front: -35.4 };
    const paint = [poly(bay.x0, bay.back, bay.x1, bay.back)];
    for (let x = bay.x0; x <= bay.x1 + 1e-9; x += 4) paint.push(poly(x, bay.back, x, bay.front));
    // the lane's south edge, dashed, north of the loot container
    for (let x = 26; x < 46; x += 2) paint.push(poly(x, -27.6, x + 1, -27.6));
    const chevrons = [
        ...[29, 34, 39, 44].map((x) => chevron(x, -24.3, 1, 0, 1.1, 1.1)),
        ...[-31, -27.5, -24].map((y) => chevron(50.2, y, 0, 1, 1.1, 1.1)),
    ];
    const body =
        lines(fr, paint, 0.2, YELLOW, `stroke-linecap="square"`) +
        lines(fr, chevrons, 0.32, YELLOW, `stroke-linejoin="miter"`);
    return svg(fr, body, ppu);
}

export const COMPOUND_ART: Readonly<Record<string, MilitaryDrawer>> = {
    "map-building-milbase-wall-s-01.img": wallStrip,
    "map-building-milbase-wall-s-02.img": wallStrip,
    "map-building-milbase-wall-n-01.img": wallStrip,
    "map-building-milbase-wall-n-02.img": wallStrip,
    "map-building-milbase-wall-w-01.img": wallStrip,
    "map-building-milbase-wall-w-02.img": wallStrip,
    "map-building-milbase-wall-e-01.img": wallStrip,
    "map-building-milbase-wall-e-02.img": wallStrip,
    "map-building-milbase-parade-01.img": parade,
    "map-building-milbase-emblem-01.img": emblem,
    "map-building-milbase-hatch-01.img": hatch,
    "map-building-milbase-gate-01.img": gate,
    "map-building-milbase-motor-01.img": motor,
};
