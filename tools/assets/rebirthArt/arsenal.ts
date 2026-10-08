// Floor and roof art of arsenal_01 (packages/defs rebirth/buildings/arsenal.ts): a grey concrete ring corridor round a
// steel-plate magazine framed by a yellow and black hazard border (thresholds() stripes its two vault doorways); a
// charcoal roof with a hazard band inside the parapet, the magazine as a raised slab carrying a yellow padlock disc
// ("locked now, opens later": the scheduled unlock, ARSENAL_UNLOCK) and four vents in the corridor's corners.
import { ARSENAL_LAYOUT, REBIRTH_ART_PX_PER_UNIT as PX } from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    circleAt,
    type FloorPalette,
    type Frame,
    f2,
    floor,
    floorFrameOf,
    frameOf,
    hazardBand,
    polygon,
    px,
    py,
    rect,
    roof,
} from "./svg.ts";

export const ARSENAL_FLOORS: FloorPalette = {
    corridor: { base: "#7f827b", grid: "#73766f", step: 4 },
    magazine: { base: "#5f625c", grid: "#565953", step: 1 },
};

const INK = "#161816";
const ROOF_HAZARD = ["#f0c419", "#1d1f1c"] as const;

/** The magazine's inside faces: its room box (x -7.5..7.5, y -6..6) less the half wall. */
const MAG = { x0: -7, y0: -5.5, x1: 7, y1: 5.5 } as const;

/**
 * A hazard-striped ring: the world box (x0, y0)-(x1, y1) less its inset by `w`, as four svg.ts hazardBand() legs (ids
 * `${id}-n/s/w/e`). The patterns are in image space, so the legs and thresholds()' lab door stripes run on as one; with
 * `colors` left out they are thresholds()' own colours, so the floor border cannot drift from the vault doorways.
 */
function hazardRing(
    fr: Frame,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w: number,
    id: string,
    colors?: readonly [string, string],
): string {
    return (
        hazardBand(fr, x0, y1 - w, x1, y1, `${id}-n`, colors) +
        hazardBand(fr, x0, y0, x1, y0 + w, `${id}-s`, colors) +
        hazardBand(fr, x0, y0 + w, x0 + w, y1 - w, `${id}-w`, colors) +
        hazardBand(fr, x1 - w, y0 + w, x1, y1 - w, `${id}-e`, colors)
    );
}

/** A rectangular ring path: the world box (x0, y0)-(x1, y1) less its inset by `w` (fill-rule evenodd). */
function ringPath(fr: Frame, x0: number, y0: number, x1: number, y1: number, w: number, attrs: string): string {
    const box = (a: number, b: number, c: number, d: number) =>
        `M${px(fr, a)} ${py(fr, d)}H${px(fr, c)}V${py(fr, b)}H${px(fr, a)}Z`;
    return `<path d="${box(x0, y0, x1, y1)}${box(x0 + w, y0 + w, x1 - w, y1 - w)}" fill-rule="evenodd" ${attrs}/>`;
}

export function arsenalFloor(): string {
    const fr = floorFrameOf(ARSENAL_LAYOUT);
    // the 0.75-wide hazard border inside the magazine walls; no ink edge on the plate side, which would run 0.25 beside
    // the plate's x = ±6 grid lines (a cramped double line on the east and west legs)
    const { x0, y0, x1, y1 } = MAG;
    const extra = hazardRing(fr, x0, y0, x1, y1, 0.75, "arsenal-floor-hazard");
    return floor(ARSENAL_LAYOUT, ARSENAL_FLOORS, { concrete: "#4f524c", metal: "#5d6a73" }, INK, extra);
}

/** The padlock emblem centred on (x, y): a yellow disc, a white shackle and body, a dark keyhole. */
function padlock(fr: Frame, x: number, y: number): string {
    const r = 1.6;
    const cy = y + 0.8;
    // legs run down into the body, which hides their ends
    const shackle =
        `M${px(fr, x - r)} ${py(fr, cy - 0.6)}V${py(fr, cy)}` +
        `A${f2(r * PX)} ${f2(r * PX)} 0 0 1 ${px(fr, x + r)} ${py(fr, cy)}V${py(fr, cy - 0.6)}`;
    return (
        circleAt(fr, x, y, 4.5, `fill="${ROOF_HAZARD[0]}" stroke="${INK}" stroke-width="4"`) +
        `<path d="${shackle}" fill="none" stroke="${INK}" stroke-width="13"/>` +
        `<path d="${shackle}" fill="none" stroke="#f4f4f0" stroke-width="7"/>` +
        rect(fr, x - 2, y - 2.4, x + 2, y + 0.8, `rx="6" fill="#f4f4f0" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y - 0.5, 0.45, `fill="${INK}"`) +
        polygon(
            fr,
            [
                [x - 0.2, y - 0.6],
                [x + 0.2, y - 0.6],
                [x + 0.3, y - 1.6],
                [x - 0.3, y - 1.6],
            ],
            `fill="${INK}"`,
        )
    );
}

/** A round roof vent: a grey cap with a dark throat. */
function vent(fr: Frame, x: number, y: number): string {
    return (
        circleAt(fr, x, y, 0.6, `fill="#6b6e67" stroke="#1f2326" stroke-width="3"`) +
        circleAt(fr, x, y, 0.25, `fill="#2c2e2a"`)
    );
}

export function arsenalCeiling(): string {
    const fr = frameOf(ARSENAL_LAYOUT);
    const { min, max } = ARSENAL_LAYOUT.bounds;
    // roof() fills the base 1 unit in from the image edge: the band runs just inside that
    const bx0 = min.x + 0.5;
    const by0 = min.y + 0.5;
    const bx1 = max.x - 0.5;
    const by1 = max.y - 0.5;
    // mid-panel between roof()'s seams at x ±8 and ±12, clear of the slab (x 7.5) and the band (x 14)
    const vents = [
        [-10, 8],
        [10, 8],
        [-10, -8],
        [10, -8],
    ] as const;
    // the band's 1 x 1 corners are solid dark blocks (hazard tape corners): no stray yellow slivers at the mitres
    const corners = [
        [bx0, by0],
        [bx1 - 1, by0],
        [bx0, by1 - 1],
        [bx1 - 1, by1 - 1],
    ] as const;
    const top =
        hazardRing(fr, bx0, by0, bx1, by1, 1, "arsenal-roof-hazard", ROOF_HAZARD) +
        corners.map(([x, y]) => rect(fr, x, y, x + 1, y + 1, `fill="${ROOF_HAZARD[1]}"`)).join("") +
        ringPath(fr, bx0, by0, bx1, by1, 1, `fill="none" stroke="${ROOF_HAZARD[1]}" stroke-width="3"`) +
        // the magazine as a raised slab: a lighter top and a dark rim, flat like the other roofs' details (no shadow)
        rect(fr, -7.5, -6, 7.5, 6, `fill="#585b55" stroke="#3a3c37" stroke-width="4"`) +
        padlock(fr, 0, 0) +
        vents.map(([x, y]) => vent(fr, x, y)).join("");
    return roof(ARSENAL_LAYOUT, "#4f524c", "#3e403b", "#474a44", top);
}
