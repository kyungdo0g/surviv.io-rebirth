// Floor and roof art of radio_station_01 (packages/defs rebirth/buildings/radio.ts): a terrazzo lobby, a dark
// acoustic-tile studio with the frequency note on its floor, the transmitter hall's green anti-static floor with a hazard
// strip before the signals vault's sliding door, the vault's steel plate, a concrete generator room, a coloured plate
// under each frequency switch; a slate-blue roof with the mast base (an orange and white checker with a lattice X and
// the red aviation light), its four guy wires, two exhausts and two AC units.
import {
    RADIO_CODE,
    RADIO_LAYOUT,
    RADIO_SWITCHES,
    RADIO_VAULT_DOOR,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
    codeNote,
    type FloorPalette,
    type Frame,
    floor,
    floorFrameOf,
    frameOf,
    px,
    py,
    rect,
    roof,
    SWITCH_PLATE_COLORS,
    switchPlate,
} from "./svg.ts";

export const RADIO_FLOORS: FloorPalette = {
    lobby: { base: "#cfcac0", grid: "#bcb7ad", step: 2 },
    studio: { base: "#4f5a6b", grid: "#465161", step: 1 },
    hall: { base: "#8fa39a", grid: "#7f948a", step: 2 },
    generator: { base: "#8a8c85", grid: "#7a7c75", step: 4 },
    vault: { base: "#5f6b73", grid: "#545f67", step: 1 },
};

const INK = "#1c1f22";
// the colours of the door-gap band (svg.ts hazardBand defaults), so the hall-side blocks and the band read as one strip
const HAZARD = ["#e2b425", "#26282a"] as const;

type Pt = readonly [number, number];

/** A world-space line segment with `attrs`. */
function line(fr: Frame, [x0, y0]: Pt, [x1, y1]: Pt, attrs: string): string {
    return `<path d="M${px(fr, x0)} ${py(fr, y0)}L${px(fr, x1)} ${py(fr, y1)}" ${attrs}/>`;
}

/** Yellow and black blocks (the outpost's door stripes) filling the world box, `step` units along its long side. */
function hazardBlocks(fr: Frame, x0: number, y0: number, x1: number, y1: number, step = 0.5): string {
    const out: string[] = [];
    const alongX = x1 - x0 >= y1 - y0;
    const [a0, a1] = alongX ? [x0, x1] : [y0, y1];
    for (let a = a0, i = 0; a < a1 - 1e-6; a += step, i++) {
        const b = Math.min(a + step, a1);
        const box = alongX ? ([a, y0, b, y1] as const) : ([x0, a, x1, b] as const);
        out.push(rect(fr, ...box, `fill="${HAZARD[i % 2]}"`));
    }
    return out.join("");
}

export function radioFloor(): string {
    const fr = floorFrameOf(RADIO_LAYOUT);
    // a hazard strip on the hall side of the vault's sliding door (thresholds() stripes the door gap itself), the
    // switches' plates (drawn under them, a little into the room) and the note with the code by the studio window
    const d = RADIO_VAULT_DOOR.pos;
    const plates = RADIO_SWITCHES.map((sw) => switchPlate(fr, sw.x, sw.y, SWITCH_PLATE_COLORS[sw.label]));
    const note = codeNote(
        fr,
        -14,
        9.5,
        RADIO_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
    );
    const extra = hazardBlocks(fr, d.x - 4, d.y - 1.25, d.x, d.y - 0.5) + plates.join("") + note;
    return floor(RADIO_LAYOUT, RADIO_FLOORS, "#6b7178", INK, extra);
}

/** The mast base and its guy wires: centre (0, 4), 6 x 6 (the map shapes' white and orange marker, radio.ts). */
const MAST = { x: 0, y: 4, half: 3, cells: 4 } as const;
const ANCHORS: readonly Pt[] = [
    [-13, -8],
    [13, -8],
    [-13, 9],
    [13, 9],
];

function mast(fr: Frame): string {
    const { x, y, half, cells } = MAST;
    const x0 = x - half;
    const y0 = y - half;
    const cell = (2 * half) / cells;
    const corners: readonly Pt[] = [
        [x0, y0],
        [x + half, y0],
        [x0, y + half],
        [x + half, y + half],
    ];
    const out: string[] = [];
    // guy wires from the corners to their anchors (3 px: the spec's 2 px vanish at the in-game half scale)
    corners.forEach((c, i) => {
        out.push(line(fr, c, ANCHORS[i], `stroke="${INK}" stroke-width="3"`));
        out.push(circleAt(fr, ANCHORS[i][0], ANCHORS[i][1], 0.4, `fill="#9aa2a8" stroke="${INK}" stroke-width="3"`));
    });
    // the 4 x 4 checker, orange in the top left corner
    for (let i = 0; i < cells; i++) {
        for (let j = 0; j < cells; j++) {
            const cx = x0 + i * cell;
            const cy = y + half - (j + 1) * cell;
            const color = (i + j) % 2 === 0 ? "#e0661b" : "#f4f4f0";
            out.push(rect(fr, cx, cy, cx + cell, cy + cell, `fill="${color}"`));
        }
    }
    // the lattice X, the outline, the red aviation light with a white rim
    out.push(
        line(fr, corners[0], corners[3], `stroke="${INK}" stroke-width="4"`),
        line(fr, corners[1], corners[2], `stroke="${INK}" stroke-width="4"`),
        rect(fr, x0, y0, x + half, y + half, `fill="none" stroke="${INK}" stroke-width="4"`),
        circleAt(fr, x, y, 0.95, `fill="#ffffff" stroke="${INK}" stroke-width="3"`),
        circleAt(fr, x, y, 0.7, `fill="#ff3b30"`),
    );
    return out.join("");
}

/** A generator exhaust stack: the spec's dark disc with a lighter inner rim, so it reads as a stack, not a hole. */
function exhaust(fr: Frame, x: number, y: number): string {
    return (
        circleAt(fr, x, y, 0.8, `fill="#2a2f35" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y, 0.45, `fill="none" stroke="#5b6673" stroke-width="2"`)
    );
}

export function radioCeiling(): string {
    const fr = frameOf(RADIO_LAYOUT);
    // the generator exhausts and the AC units sit clear of the guy wires: the spec's (8, 8) and (12, 8) lie on the
    // north-east wire, and AC units at x = -9 and 9 touch the southern wires with a corner
    const top = exhaust(fr, 8, 5) + exhaust(fr, 12, 5) + acUnit(fr, -8, -7) + acUnit(fr, 8, -7) + mast(fr);
    return roof(RADIO_LAYOUT, "#4f6072", "#3b4856", "#46576a", top);
}
