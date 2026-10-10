// Floor, roof and rubble art of church_01 (packages/defs rebirth/buildings/church.ts): a nave of pale flagstones with a
// red runner up the centre aisle, the bell tower's worn brick floor with the bell's round trap, a baptistry in blue tile,
// a plain store, the chancel's carpet with a gold half-round mosaic under the apse, the vestry's boards with the hymn
// sheet, the reliquary's dark slabs, a coloured plate under each bell switch; a slate roof with a ridge down the nave,
// a gold cross, the apse's half-round over the chancel and the bell tower's spire seen from above (four slopes and the
// bell in its open belfry); the rubble the church leaves when it caves in (broken slates, stones and beams).
import {
    CHURCH_CODE,
    CHURCH_LAYOUT,
    CHURCH_NOTE,
    CHURCH_SWITCHES,
    REBIRTH_ART_PX_PER_UNIT as PX,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    circleAt,
    codeNote,
    type FloorPalette,
    type Frame,
    floor,
    floorFrameOf,
    frameOf,
    polygon,
    px,
    py,
    rect,
    SWITCH_PLATE_COLORS,
    svg,
    switchPlate,
} from "./svg.ts";

export const CHURCH_FLOORS: FloorPalette = {
    nave: { base: "#d3ccbc", grid: "#bfb7a5", step: 2 },
    baptistry: { base: "#9bb4bf", grid: "#88a2ad", step: 1 },
    tower: { base: "#9a7b63", grid: "#876a54", step: 1 },
    store: { base: "#a89a85", grid: "#978a76", step: 2 },
    chancel: { base: "#7c2f36", grid: "#702a30", step: 2 },
    reliquary: { base: "#4b4643", grid: "#3f3a37", step: 2 },
    vestry: { base: "#a9805a", grid: "#97714e", step: 1 },
};

const INK = "#24201d";

/** A world-space half disc centred on (x, y), radius r, bulging towards +y (`up`) or -y. */
function halfDisc(fr: Frame, x: number, y: number, r: number, up: boolean, attrs: string): string {
    const sweep = up ? 1 : 0;
    return (
        `<path d="M${px(fr, x - r)} ${py(fr, y)}A${r * PX} ${r * PX} 0 0 ${sweep} ${px(fr, x + r)} ${py(fr, y)}Z" ` +
        `${attrs}/>`
    );
}

/** A Latin cross centred on the crossing (x, y): `len` tall, the arms `arm` wide each side, bars `w` thick. */
function latinCross(fr: Frame, x: number, y: number, len: number, arm: number, w: number, attrs: string): string {
    return (
        rect(fr, x - w / 2, y - len * 0.65, x + w / 2, y + len * 0.35, attrs) +
        rect(fr, x - arm, y - w / 2, x + arm, y + w / 2, attrs)
    );
}

export function churchFloor(): string {
    const fr = floorFrameOf(CHURCH_LAYOUT);
    const runner =
        rect(fr, -2, -25.5, 2, 13.8, `fill="#8e2c33" fill-opacity="0.8"`) +
        rect(fr, -2, -25.5, -1.6, 13.8, `fill="#c9a24a" fill-opacity="0.7"`) +
        rect(fr, 1.6, -25.5, 2, 13.8, `fill="#c9a24a" fill-opacity="0.7"`);
    // the chancel step across the nave's north end and the gold half-round mosaic under the apse
    const step = rect(fr, -7.5, 13.2, 7.5, 14, `fill="#b8ae99"`);
    const mosaic =
        halfDisc(fr, 0, 14.6, 6.5, true, `fill="#c9a24a" fill-opacity="0.35"`) +
        halfDisc(fr, 0, 14.6, 5, true, `fill="none" stroke="#e2c26a" stroke-opacity="0.6" stroke-width="5"`) +
        halfDisc(fr, 0, 14.6, 3, true, `fill="none" stroke="#e2c26a" stroke-opacity="0.6" stroke-width="5"`);
    // the font's basin rim under the stone basin, the bell's round trap in the tower floor
    const font = circleAt(fr, -15, -21, 2, `fill="#6f93a3" stroke="#e8eef0" stroke-width="4"`);
    const trap =
        circleAt(fr, 0, -21, 2.6, `fill="#7a604c" stroke="${INK}" stroke-width="4"`) +
        circleAt(fr, 0, -21, 1.9, `fill="none" stroke="#5f4a3a" stroke-width="3"`);
    // the reliquary: a faded cross inlaid in its slabs
    const inlay = latinCross(fr, -11, 20.5, 6, 2, 0.6, `fill="#6b6460"`);
    const plates = CHURCH_SWITCHES.map((sw) => switchPlate(fr, sw.x, sw.y, SWITCH_PLATE_COLORS[sw.label])).join("");
    const note = codeNote(
        fr,
        CHURCH_NOTE.x,
        CHURCH_NOTE.y,
        CHURCH_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
    );
    return floor(
        CHURCH_LAYOUT,
        CHURCH_FLOORS,
        "#b5a58a",
        INK,
        runner + step + mosaic + font + trap + inlay + plates + note,
    );
}

/** The bell tower's spire from above: four slopes to the apex, the open belfry's bell, edges outlined. */
function spire(fr: Frame): string {
    const [x0, y0, x1, y1] = [-7, -26.5, 7, -15.5];
    const cx = 0;
    const cy = (y0 + y1) / 2;
    const slope = (pts: ReadonlyArray<readonly [number, number]>, fill: string) =>
        polygon(fr, pts, `fill="${fill}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"`);
    return (
        rect(fr, x0, y0, x1, y1, `fill="#6e5a49" stroke="${INK}" stroke-width="5"`) +
        slope(
            [
                [x0 + 0.6, y1 - 0.6],
                [x1 - 0.6, y1 - 0.6],
                [cx, cy],
            ],
            "#5a6672",
        ) +
        slope(
            [
                [x1 - 0.6, y1 - 0.6],
                [x1 - 0.6, y0 + 0.6],
                [cx, cy],
            ],
            "#47525d",
        ) +
        slope(
            [
                [x1 - 0.6, y0 + 0.6],
                [x0 + 0.6, y0 + 0.6],
                [cx, cy],
            ],
            "#3c4650",
        ) +
        slope(
            [
                [x0 + 0.6, y0 + 0.6],
                [x0 + 0.6, y1 - 0.6],
                [cx, cy],
            ],
            "#505c68",
        ) +
        // the bell at the apex and the weathervane's gold cross
        circleAt(fr, cx, cy, 1.6, `fill="#c9a24a" stroke="${INK}" stroke-width="4"`) +
        circleAt(fr, cx, cy, 0.6, `fill="#8a6a2a"`) +
        latinCross(fr, cx, cy - 3.2, 2.6, 0.8, 0.3, `fill="#e2c26a" stroke="${INK}" stroke-width="2"`)
    );
}

export function churchCeiling(): string {
    const fr = frameOf(CHURCH_LAYOUT);
    const { min, max } = CHURCH_LAYOUT.bounds;
    const [x0, y0, x1, y1] = [min.x - 0.5, min.y - 0.5, max.x + 0.5, max.y + 0.5];
    // slate courses across the two roof slopes (west and east of the ridge)
    const courses: string[] = [];
    for (let x = x0 + 2; x < x1 - 1; x += 2) {
        if (Math.abs(x) < 1.5) continue;
        courses.push(`M${px(fr, x)} ${py(fr, y1 - 1)}V${py(fr, y0 + 1)}`);
    }
    const body =
        rect(fr, x0, y0, x1, y1, `fill="${INK}"`) +
        rect(fr, x0, y0, x1, y1, `fill="#a99e8a"`, -4) +
        rect(fr, x0 + 1, y0 + 1, 0, y1 - 1, `fill="#56616c"`) +
        rect(fr, 0, y0 + 1, x1 - 1, y1 - 1, `fill="#4a545e"`) +
        `<path d="${courses.join("")}" stroke="#3e4750" stroke-width="3" fill="none"/>` +
        // the ridge down the nave, the apse's half-round over the chancel
        rect(fr, -0.6, y0 + 1, 0.6, y1 - 1, `fill="#7b858f" stroke="${INK}" stroke-width="3"`) +
        halfDisc(fr, 0, 14, 8, true, `fill="#5e6873" stroke="${INK}" stroke-width="4"`) +
        halfDisc(fr, 0, 14, 5.5, true, `fill="none" stroke="#3e4750" stroke-width="3"`) +
        // the gold cross over the nave (the map's white cross)
        latinCross(fr, 0, 2, 16, 5, 2, `fill="#e2c26a" stroke="${INK}" stroke-width="5"`) +
        spire(fr);
    return svg(fr, body);
}

/** Deterministic pseudo-random numbers for the rubble (a fixed LCG: the committed file must not change per run). */
function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

/** The rubble the church leaves when it caves in: broken slates, stones and charred beams over the footprint. */
export function churchResidue(): string {
    const fr = frameOf(CHURCH_LAYOUT);
    const { min, max } = CHURCH_LAYOUT.bounds;
    const rnd = lcg(0x0c4c);
    const out: string[] = [];
    // a dusty heap under everything, ragged at the edges
    out.push(rect(fr, min.x + 0.5, min.y + 0.5, max.x - 0.5, max.y - 0.5, `fill="#7d766b" fill-opacity="0.75"`));
    const colors = ["#56616c", "#4a545e", "#8c8270", "#a99e8a", "#6e5a49", "#3c4650"];
    for (let i = 0; i < 260; i++) {
        const x = min.x + 0.5 + rnd() * (max.x - min.x - 1);
        const y = min.y + 0.5 + rnd() * (max.y - min.y - 1);
        const r = 0.35 + rnd() * 0.9;
        const n = 4 + Math.floor(rnd() * 3);
        const pts: Array<readonly [number, number]> = [];
        const a0 = rnd() * Math.PI;
        for (let k = 0; k < n; k++) {
            const a = a0 + (k / n) * Math.PI * 2;
            const rr = r * (0.6 + rnd() * 0.4);
            pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
        }
        const c = colors[Math.floor(rnd() * colors.length)];
        out.push(polygon(fr, pts, `fill="${c}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"`));
    }
    // charred roof beams lying across the heap
    for (let i = 0; i < 9; i++) {
        const x = min.x + 3 + rnd() * (max.x - min.x - 6);
        const y = min.y + 4 + rnd() * (max.y - min.y - 8);
        const a = (rnd() - 0.5) * 1.6;
        const l = 4 + rnd() * 5;
        const dx = (Math.cos(a) * l) / 2;
        const dy = (Math.sin(a) * l) / 2;
        out.push(
            `<path d="M${px(fr, x - dx)} ${py(fr, y - dy)}L${px(fr, x + dx)} ${py(fr, y + dy)}" stroke="${INK}" ` +
                `stroke-width="16" stroke-linecap="round"/>` +
                `<path d="M${px(fr, x - dx)} ${py(fr, y - dy)}L${px(fr, x + dx)} ${py(fr, y + dy)}" stroke="#4a3a2c" ` +
                `stroke-width="10" stroke-linecap="round"/>`,
        );
    }
    // the fallen bell on the tower's heap
    out.push(circleAt(fr, 1.5, -20, 1.6, `fill="#b08a3c" stroke="${INK}" stroke-width="4"`));
    return svg(fr, out.join(""));
}
