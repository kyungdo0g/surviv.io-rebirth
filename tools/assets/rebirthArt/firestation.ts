// Floor and roof art of firestation_01 (packages/defs rebirth/buildings/firestation.ts): a concrete apparatus bay with
// yellow engine lanes and red and white hatching inside its open mouths, an asphalt apron with white lane lines, a pale
// tiled watch office, a wooden crew room and the hose tower's steel floor; a fire-engine red roof with chevron bands over
// the mouths, a flame badge, the grey hose tower with its beacon, and AC units.
import { FIRESTATION_LAYOUT, REBIRTH_ART_PX_PER_UNIT as PX } from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
    type FloorPalette,
    type Frame,
    f2,
    floor,
    floorFrameOf,
    frameOf,
    hazardBand,
    px,
    py,
    rect,
    roof,
} from "./svg.ts";

export const FIRESTATION_FLOORS: FloorPalette = {
    bay: { base: "#8f9294", grid: "#818487", step: 4 },
    office: { base: "#b9c3cc", grid: "#a7b2bc", step: 2 },
    crew: { base: "#b08a62", grid: "#9c7a55", step: 1 },
    tower: { base: "#7a7d80", grid: "#6c6f72", step: 1 },
    apron: { base: "#5f6366", grid: "#5f6366", step: 4 },
};

const OUTLINE = "#1f2326";
/** The bay mouths (x ranges of the south wall's open gaps) and the engine lanes behind them. */
const MOUTHS = [
    [-17, -9],
    [-6, 2],
] as const;
const LANES = [
    [-16.5, -9.5],
    [-5.5, 1.5],
] as const;

/** A path given in world units relative to (cx, cy), scaled by `k`: commands with x, y pairs ("Z" takes none). */
type Seg = readonly [string, ...number[]];
function localPath(fr: Frame, cx: number, cy: number, k: number, segs: readonly Seg[], attrs: string): string {
    const d = segs
        .map(([c, ...n]) => c + n.map((v, i) => (i % 2 === 0 ? px(fr, cx + v * k) : py(fr, cy + v * k))).join(" "))
        .join("");
    return `<path d="${d}" ${attrs}/>`;
}

export function firestationFloor(): string {
    const fr = floorFrameOf(FIRESTATION_LAYOUT);
    const out: string[] = [];
    // the apron: a darker kerb along its three open edges (none across the mouths), the lane lines carried out of them
    const k = 3 / PX;
    const kerb = [
        [-20 + k, -12.5],
        [-20 + k, -17.5 + k],
        [3.5 - k, -17.5 + k],
        [3.5 - k, -12.5],
    ] as const;
    out.push(
        `<path d="M${kerb.map(([x, y]) => `${px(fr, x)} ${py(fr, y)}`).join("L")}" ` +
            `stroke="#4b4f52" stroke-width="6" fill="none"/>`,
    );
    const laneLines = LANES.flat()
        .map((x) => `M${px(fr, x)} ${py(fr, -13)}V${py(fr, -16.75)}`)
        .join("");
    out.push(`<path d="${laneLines}" stroke="#e9e9e3" stroke-width="5" fill="none"/>`);
    // the engine lanes (x a..b, y -12..9; their open end runs under the hatch), then the red and white hatch just
    // inside each mouth; the lane outlines are 6 px, not the spec's 4 px, so they read over the bay grid in game
    const lanes = LANES.map(([a, b]) => `M${px(fr, a)} ${py(fr, -11.25)}V${py(fr, 9)}H${px(fr, b)}V${py(fr, -11.25)}`);
    out.push(`<path d="${lanes.join("")}" stroke="#e2b425" stroke-width="6" fill="none" stroke-linejoin="miter"/>`);
    MOUTHS.forEach(([a, b], i) => {
        out.push(hazardBand(fr, a, -12, b, -11.25, `firestation-hatch-${i}`, ["#d8402f", "#f2f2ee"]));
    });
    // floor() clips the walls to the roof frame where the apron widens the image
    return floor(FIRESTATION_LAYOUT, FIRESTATION_FLOORS, "#9c4a3c", "#2a1c18", out.join(""));
}

/**
 * A chevron band over a bay mouth: 1-unit #f2b705 / #26282a stripes slanting up to the band's centre from both sides (two
 * mirrored patterns anchored on the centre line, so the stripes meet in points), outlined.
 */
function chevronBand(fr: Frame, x0: number, y0: number, x1: number, y1: number, id: string): string {
    const cx = (x0 + x1) / 2;
    const w = f2(2 * PX);
    const half = (sid: string, mirror: boolean) =>
        `<pattern id="${sid}" patternUnits="userSpaceOnUse" width="${w}" height="${w}" ` +
        `patternTransform="translate(${px(fr, cx)} ${py(fr, y1)}) ${mirror ? "scale(-1 1) " : ""}rotate(45)">` +
        `<rect width="${w}" height="${w}" fill="#26282a"/><rect width="${f2(w / 2)}" height="${w}" fill="#f2b705"/>` +
        "</pattern>";
    return (
        `<defs>${half(`${id}-l`, false)}${half(`${id}-r`, true)}</defs>` +
        rect(fr, x0, y0, cx, y1, `fill="url(#${id}-l)"`) +
        rect(fr, cx, y0, x1, y1, `fill="url(#${id}-r)"`) +
        rect(fr, x0, y0, x1, y1, `fill="none" stroke="${OUTLINE}" stroke-width="4"`)
    );
}

/**
 * The flame badge: a white disc with an orange flame and a yellow inner tongue. The flame is drawn 1.2x its path (about
 * 6.2 units tall, not the spec's 5) so it fills the r4 disc like the clinic cross and the outpost star.
 */
function flameBadge(fr: Frame, cx: number, cy: number): string {
    const k = 1.2;
    const outer: Seg[] = [
        ["M", 0, -2.45],
        ["C", -1.4, -2.45, -2.1, -1.5, -2.05, -0.35],
        ["C", -2.0, 0.7, -1.45, 1.3, -1.35, 1.95],
        ["C", -0.95, 1.55, -0.75, 1.3, -0.55, 0.95],
        ["C", -0.45, 1.75, -0.15, 2.25, 0.25, 2.7],
        ["C", 0.45, 2.05, 0.75, 1.65, 1.15, 1.35],
        ["C", 1.25, 1.65, 1.35, 1.85, 1.35, 2.05],
        ["C", 1.95, 1.4, 2.15, 0.55, 2.05, -0.35],
        ["C", 2.0, -1.5, 1.35, -2.45, 0, -2.45],
        ["Z"],
    ];
    const inner: Seg[] = [
        ["M", 0, -2.05],
        ["C", -0.85, -2.05, -1.25, -1.4, -1.15, -0.7],
        ["C", -1.05, 0.0, -0.55, 0.45, -0.25, 1.15],
        ["C", -0.05, 0.6, 0.3, 0.35, 0.55, 0.05],
        ["C", 0.6, 0.35, 0.65, 0.5, 0.7, 0.6],
        ["C", 1.15, 0.05, 1.25, -0.75, 1.05, -1.3],
        ["C", 0.85, -1.8, 0.45, -2.05, 0, -2.05],
        ["Z"],
    ];
    return (
        circleAt(fr, cx, cy, 4, `fill="#ffffff" stroke="#2c3135" stroke-width="4"`) +
        localPath(
            fr,
            cx,
            cy - 0.15,
            k,
            outer,
            `fill="#f28c1e" stroke="#2c3135" stroke-width="3" stroke-linejoin="round"`,
        ) +
        localPath(fr, cx, cy - 0.15, k, inner, `fill="#f7c948"`)
    );
}

/**
 * The hose tower rising through the roof over its walls (x 13..20, y 6..13, the minimap's grey box): a concrete block
 * with its own rim, a red beacon with a white rim in the middle and a roof hatch.
 */
function hoseTower(fr: Frame): string {
    return (
        rect(fr, 13, 6, 20, 13, `fill="#8d9094" stroke="${OUTLINE}" stroke-width="4"`, -2) +
        rect(fr, 13.75, 6.75, 19.25, 12.25, `fill="none" stroke="#6f7276" stroke-width="4"`) +
        rect(fr, 14.3, 7.3, 15.5, 8.5, `fill="#6f7276" stroke="${OUTLINE}" stroke-width="3"`) +
        `<path d="M${px(fr, 14.6)} ${py(fr, 7.9)}H${px(fr, 15.2)}" stroke="${OUTLINE}" stroke-width="3"/>` +
        circleAt(fr, 16.5, 9.5, 1.2, `fill="${OUTLINE}"`) +
        circleAt(fr, 16.5, 9.5, 1, `fill="#d8402f" stroke="#ffffff" stroke-width="5"`) +
        circleAt(fr, 16.3, 9.7, 0.25, `fill="#f7a08f"`)
    );
}

export function firestationCeiling(): string {
    const fr = frameOf(FIRESTATION_LAYOUT);
    const top =
        MOUTHS.map(([a, b], i) => chevronBand(fr, a, -12, b, -10, `firestation-chevron-${i}`)).join("") +
        flameBadge(fr, -7.5, 2) +
        hoseTower(fr) +
        acUnit(fr, 8, 4) +
        acUnit(fr, 10.5, -7) +
        circleAt(fr, -15, 9, 0.6, `fill="#7d868c" stroke="#2c3135" stroke-width="3"`);
    return roof(FIRESTATION_LAYOUT, "#cf2e28", "#9e2420", "#c02a24", top);
}
