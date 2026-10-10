// Floor and roof art of library_01 (packages/defs rebirth/buildings/library.ts): a parquet stacks hall, a green-carpet
// reading room, a marble foyer with a red runner and a faded compass rose, a burgundy archive, pale limestone walls; a
// plum roof with two skylights over the stacks, the open-book emblem, a pediment over the front door and two vents.
import { LIBRARY_LAYOUT } from "../../../packages/defs/src/rebirth/buildings.ts";
import {
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
} from "./svg.ts";

export const LIBRARY_FLOORS: FloorPalette = {
    stacks: { base: "#b9895a", grid: "#a67a4e", step: 1 },
    reading: { base: "#5f7d5a", grid: "#56724f", step: 2 },
    foyer: { base: "#e0dccf", grid: "#c9c3b2", step: 2 },
    archive: { base: "#7a3a32", grid: "#6c322b", step: 2 },
    rare: { base: "#4a2f2a", grid: "#3f2824", step: 1 },
};

const INK = "#2a2233";

type Pt = readonly [number, number];

/** A world-space polyline (open path) with `attrs`. */
function line(fr: Frame, pts: readonly Pt[], attrs: string): string {
    return `<path d="${pts.map(([x, y], i) => `${i ? "L" : "M"}${px(fr, x)} ${py(fr, y)}`).join("")}" ${attrs}/>`;
}

/** A four-point star (compass rose) centred on (x, y): long points `r`, waist `w`, all in world units. */
function compassStar(fr: Frame, x: number, y: number, r: number, w: number, attrs: string): string {
    const pts: Pt[] = [];
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rr = i % 2 === 0 ? r : w;
        pts.push([x + Math.sin(a) * rr, y + Math.cos(a) * rr]);
    }
    return polygon(fr, pts, attrs);
}

export function libraryFloor(): string {
    const fr = floorFrameOf(LIBRARY_LAYOUT);
    // the red runner from the front door (its end under the threshold) to the archway, with flush darker edge trim; it
    // stops 0.3 short of the compass rose inlaid in the marble, which is drawn whole after it (the carpet never covers
    // the medallion, so the star keeps all four points and one colour)
    const rose = { x: -0.5, y: -7, r: 2 };
    const runner = (y0: number, y1: number) =>
        rect(fr, -1.5, y0, 0.5, y1, `fill="#9d2b2b" fill-opacity="0.55"`) +
        rect(fr, -1.5, y0, -1.28, y1, `fill="#9d2b2b" fill-opacity="0.6"`) +
        rect(fr, 0.28, y0, 0.5, y1, `fill="#9d2b2b" fill-opacity="0.6"`);
    const extra =
        runner(-13.5, rose.y - rose.r - 0.3) +
        runner(rose.y + rose.r + 0.3, -0.5) +
        circleAt(fr, rose.x, rose.y, rose.r, `fill="#b8ad94" fill-opacity="0.35"`) +
        circleAt(
            fr,
            rose.x,
            rose.y,
            rose.r - 0.35,
            `fill="none" stroke="#b8ad94" stroke-opacity="0.5" stroke-width="3"`,
        ) +
        compassStar(fr, rose.x, rose.y, 1.7, 0.45, `fill="#8f8466" fill-opacity="0.45"`);
    return floor(LIBRARY_LAYOUT, LIBRARY_FLOORS, "#cdbf9f", "#2b2520", extra);
}

/** A glass skylight over the world box: a frame, the glass, a white mullion cross. */
function skylight(fr: Frame, x0: number, y0: number, x1: number, y1: number): string {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return (
        rect(fr, x0, y0, x1, y1, `fill="#d9d2c0" stroke="${INK}" stroke-width="4"`) +
        rect(fr, x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, `fill="#a9c6d6" stroke="${INK}" stroke-width="2"`) +
        rect(fr, cx - 0.12, y0 + 0.35, cx + 0.12, y1 - 0.35, `fill="#f4f7f8"`) +
        rect(fr, x0 + 0.35, cy - 0.12, x1 - 0.35, cy + 0.12, `fill="#f4f7f8"`)
    );
}

/**
 * The open-book emblem centred on x = `cx`: two pages sloping down to the spine (the left page (cx, -1.5) (cx - 5.5,
 * -1) (cx - 5.5, 4.5) (cx, 4), the right one mirrored), a spine line and three text strokes per page.
 */
function openBook(fr: Frame, cx: number): string {
    const out: string[] = [];
    for (const s of [-1, 1]) {
        const cover: Pt[] = [
            [cx, -2.1],
            [cx + s * 6.1, -1.5],
            [cx + s * 6.1, 4.5],
            [cx, 3.8],
        ];
        out.push(polygon(fr, cover, `fill="#7b2f3a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"`));
    }
    for (const s of [-1, 1]) {
        const page: Pt[] = [
            [cx, -1.5],
            [cx + s * 5.5, -1],
            [cx + s * 5.5, 4.5],
            [cx, 4],
        ];
        out.push(polygon(fr, page, `fill="#f2ead3" stroke="${INK}" stroke-width="4" stroke-linejoin="round"`));
    }
    // text strokes parallel to the page edges (rising 0.5 over the page's 5.5 width), y given at the page's middle
    for (const s of [-1, 1]) {
        const xa = cx + s * 0.7;
        const xb = cx + s * 4.7;
        const yAt = (y: number, x: number) => y + (Math.abs(x - cx) - 2.75) / 11;
        for (const y of [0.5, 1.75, 3]) {
            out.push(
                line(
                    fr,
                    [
                        [xa, yAt(y, xa)],
                        [xb, yAt(y, xb)],
                    ],
                    `stroke="#8a7f9a" stroke-width="9" stroke-linecap="round"`,
                ),
            );
        }
    }
    out.push(
        line(
            fr,
            [
                [cx, -1.5],
                [cx, 4],
            ],
            `stroke="${INK}" stroke-width="4"`,
        ),
    );
    return out.join("");
}

/** A small roof vent: a round cap with a slot. */
function vent(fr: Frame, x: number, y: number): string {
    return (
        circleAt(fr, x, y, 0.65, `fill="#8d8698" stroke="${INK}" stroke-width="3"`) +
        rect(fr, x - 0.35, y - 0.08, x + 0.35, y + 0.08, `fill="${INK}"`)
    );
}

export function libraryCeiling(): string {
    const fr = frameOf(LIBRARY_LAYOUT);
    const top =
        skylight(fr, -16, 4, -11, 10) +
        skylight(fr, 11, 4, 16, 10) +
        openBook(fr, 1) +
        // the pediment over the front door: its base on the roof's outer edge, so its outline merges with the roof's and
        // the gable interrupts the parapet over the door; an inner tympanum, outlined thick enough to survive at 16 px/unit
        polygon(
            fr,
            [
                [-3, -12.875],
                [5, -12.875],
                [1, -10.6],
            ],
            `fill="#e6dcc0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"`,
        ) +
        polygon(
            fr,
            [
                [-1.2, -12.5],
                [3.2, -12.5],
                [1, -11.25],
            ],
            `fill="#cfc3a2" stroke="#8f8466" stroke-width="3" stroke-linejoin="round"`,
        ) +
        // the vents symmetric about the building and skylight axis (x 0)
        vent(fr, -11, -7) +
        vent(fr, 11, -7);
    return roof(LIBRARY_LAYOUT, "#5d4a7a", "#a69f8d", "#6a5788", top);
}
