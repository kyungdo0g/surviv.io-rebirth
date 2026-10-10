// Art of gas_station_01 (packages/defs rebirth/buildings/gasStation.ts): the convenience store's tiled shop, concrete
// storeroom, blue-tiled toilet and wood-floored back office (its brick shell is drawn by the breakable walls' own
// sprites, so a broken piece leaves bare floor); a flat grey roof with a red and yellow fascia over the shop front, a
// fuel-drop sign and AC units; the rubble that covers the floor once it caves in; the site's asphalt with bay lines,
// the fuel islands' kerbed pads, the drum yard's gravel inside its steel fence and oil stains by the drums; the white
// canopy with its red fascia and lights; and the fuel pump. Rebirth art, no original or survev file is used.
import {
    GAS_PUMP_ART,
    GAS_STATION_CANOPY,
    GAS_STATION_ISLANDS,
    GAS_STATION_SITE_LAYOUT,
    GAS_STATION_STORE_LAYOUT,
    REBIRTH_ART_PX_PER_UNIT as PX,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    boxFrame,
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
    svg,
} from "./svg.ts";

export const GAS_STATION_FLOORS: FloorPalette = {
    shop: { base: "#e4e1d8", grid: "#cfcbc0", step: 2 },
    store: { base: "#9a9c98", grid: "#8b8d89", step: 4 },
    toilet: { base: "#b9d3df", grid: "#9fbfcd", step: 1 },
    office: { base: "#a9825a", grid: "#957250", step: 1 },
    asphalt: { base: "#55585a", grid: "#55585a", step: 8 },
    yard: { base: "#857d6c", grid: "#857d6c", step: 8 },
    slab: { base: "#8e908c", grid: "#8e908c", step: 8 },
};

const OUTLINE = "#1f2326";
const BRICK = "#8c4a36";
const FUEL_RED = "#c8312e";
const FUEL_YELLOW = "#f0bf2a";

/** A fuel drop pictogram centred on (x, y), `h` world units tall. */
function fuelDrop(fr: Frame, x: number, y: number, h: number, fill: string): string {
    const r = h * 0.32;
    const tip = y + h / 2;
    const cy = y - h / 2 + r;
    const d =
        `M${px(fr, x)} ${py(fr, tip)}` +
        `C${px(fr, x + r * 0.35)} ${py(fr, tip - h * 0.3)} ${px(fr, x + r)} ${py(fr, cy + r * 0.6)} ${px(fr, x + r)} ${py(fr, cy)}` +
        `A${f2(r * PX)} ${f2(r * PX)} 0 0 1 ${px(fr, x - r)} ${py(fr, cy)}` +
        `C${px(fr, x - r)} ${py(fr, cy + r * 0.6)} ${px(fr, x - r * 0.35)} ${py(fr, tip - h * 0.3)} ${px(fr, x)} ${py(fr, tip)}Z`;
    return `<path d="${d}" fill="${fill}" stroke="${OUTLINE}" stroke-width="4"/>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// the store

export function gasStationStoreFloor(): string {
    const fr = floorFrameOf(GAS_STATION_STORE_LAYOUT);
    const extra =
        // the doormat inside the front door, the cashier's mat behind the counter
        rect(fr, -12.5, 0.6, -9.5, 2.2, `fill="#4f5a63" stroke="${OUTLINE}" stroke-width="2"`) +
        rect(fr, -9.2, 4.5, -6.7, 8.5, `fill="#3f6b4f" fill-opacity="0.55"`) +
        // the office's rug
        rect(fr, 2.5, 9.5, 8.5, 12.5, `fill="#7a2e2a" stroke="#5a1f1c" stroke-width="3"`);
    return floor(GAS_STATION_STORE_LAYOUT, GAS_STATION_FLOORS, { brick: BRICK, wood: BRICK }, OUTLINE, extra);
}

export function gasStationStoreCeiling(): string {
    const fr = frameOf(GAS_STATION_STORE_LAYOUT);
    const { min, max } = GAS_STATION_STORE_LAYOUT.bounds;
    // the fascia over the shop front (a red band with a yellow pinstripe) and the sign: a fuel drop in a white disc
    const top =
        rect(
            fr,
            min.x - 0.5,
            min.y - 0.5,
            max.x + 0.5,
            min.y + 1.5,
            `fill="${FUEL_RED}" stroke="${OUTLINE}" stroke-width="4"`,
        ) +
        rect(fr, min.x - 0.5, min.y + 1.1, max.x + 0.5, min.y + 1.4, `fill="${FUEL_YELLOW}"`) +
        circleAt(fr, -13, 9, 3.2, `fill="#f4f2ec" stroke="${OUTLINE}" stroke-width="5"`) +
        fuelDrop(fr, -13, 9, 4.2, FUEL_RED) +
        acUnit(fr, 4, 12.5) +
        acUnit(fr, 7.5, 12.5) +
        acUnit(fr, -2, 5) +
        circleAt(fr, -18, 14, 0.6, `fill="#7d868c" stroke="#2c3135" stroke-width="3"`) +
        circleAt(fr, 7, 4.5, 0.6, `fill="#7d868c" stroke="#2c3135" stroke-width="3"`);
    return roof(GAS_STATION_STORE_LAYOUT, "#a5a8a6", "#6f7471", "#959896", top);
}

/** A small deterministic generator (the committed SVGs must not change between runs). */
function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

/** The caved-in store: dust over the whole floor, broken roof slabs, brick chunks and a few planks. */
export function gasStationRubble(): string {
    const fr = frameOf(GAS_STATION_STORE_LAYOUT);
    const { min, max } = GAS_STATION_STORE_LAYOUT.bounds;
    const rnd = lcg(0x6a5);
    const out: string[] = [
        rect(fr, min.x - 0.5, min.y - 0.5, max.x + 0.5, max.y + 0.5, `fill="#6b625a" fill-opacity="0.92"`),
    ];
    const shard = (cx: number, cy: number, r: number, fill: string) => {
        const n = 4 + Math.floor(rnd() * 3);
        const pts: Array<readonly [number, number]> = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
            const rr = r * (0.6 + rnd() * 0.5);
            pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        return polygon(fr, pts, `fill="${fill}" stroke="${OUTLINE}" stroke-width="3"`);
    };
    const span = (lo: number, hi: number) => lo + rnd() * (hi - lo);
    // roof slabs, then brick and plaster chunks over them, then planks
    for (let i = 0; i < 18; i++) {
        out.push(
            shard(
                span(min.x + 1, max.x - 1),
                span(min.y + 1, max.y - 1),
                span(1.6, 2.8),
                i % 2 ? "#8d918f" : "#a5a8a6",
            ),
        );
    }
    const chunks = ["#8c4a36", "#a35a42", "#76402f", "#c9c2b4"];
    for (let i = 0; i < 70; i++) {
        out.push(shard(span(min.x, max.x), span(min.y, max.y), span(0.35, 0.9), chunks[i % chunks.length]));
    }
    for (let i = 0; i < 8; i++) {
        const x = span(min.x + 2, max.x - 2);
        const y = span(min.y + 2, max.y - 2);
        const a = rnd() * Math.PI;
        const dx = Math.cos(a) * 1.6;
        const dy = Math.sin(a) * 1.6;
        out.push(
            `<path d="M${px(fr, x - dx)} ${py(fr, y - dy)}L${px(fr, x + dx)} ${py(fr, y + dy)}" stroke="#5a3d25" stroke-width="12" stroke-linecap="round"/>`,
        );
    }
    return svg(fr, out.join(""));
}

// ---------------------------------------------------------------------------------------------------------------------
// the site

/** The concrete pad under an island (the pump in the middle, a tank west and a drum east), yellow-and-black ends. */
function islandPad(fr: Frame, x: number, y: number, i: number): string {
    const x0 = x - 5.2;
    const x1 = x + 5.2;
    return (
        rect(fr, x0, y - 1.3, x1, y + 1.3, `fill="#b4b2aa" stroke="${OUTLINE}" stroke-width="4"`) +
        hazardBand(fr, x0, y - 1.3, x0 + 0.9, y + 1.3, `gs-pad-w-${i}`, [FUEL_YELLOW, "#26282a"], 0.35) +
        hazardBand(fr, x1 - 0.9, y - 1.3, x1, y + 1.3, `gs-pad-e-${i}`, [FUEL_YELLOW, "#26282a"], 0.35)
    );
}

export function gasStationSiteFloor(): string {
    const fr = floorFrameOf(GAS_STATION_SITE_LAYOUT);
    const c = GAS_STATION_CANOPY;
    const out: string[] = [];
    // the forecourt under the canopy: paler concrete with a painted border
    out.push(rect(fr, c.min.x, c.min.y, c.max.x, c.max.y, `fill="#6d7072" stroke="#e9e9e3" stroke-width="5"`));
    // the lanes between the islands: white arrows driving east
    for (const y of [-12, -18.2, -5.7]) {
        if (y < c.min.y + 0.5 || y > c.max.y - 0.5) continue;
        out.push(
            polygon(
                fr,
                [
                    [-2, y + 0.35],
                    [1, y + 0.35],
                    [1, y + 0.9],
                    [2.6, y],
                    [1, y - 0.9],
                    [1, y - 0.35],
                    [-2, y - 0.35],
                ],
                `fill="#e9e9e3"`,
            ),
        );
    }
    GAS_STATION_ISLANDS.forEach((p, i) => {
        out.push(islandPad(fr, p.x, p.y, i));
    });
    // parking bays along the west of the forecourt
    const bays: string[] = [];
    for (let x = -25.5; x <= -17.5; x += 4) bays.push(`M${px(fr, x)} ${py(fr, -18.5)}V${py(fr, -12.5)}`);
    out.push(`<path d="${bays.join("")}" stroke="#e9e9e3" stroke-width="5" fill="none"/>`);
    // a kerb strip along the store front and oil stains by the drums
    out.push(rect(fr, -21.5, -0.9, 11.5, -0.5, `fill="#a7a59c"`));
    for (const [x, y, r] of [
        [-23.5, 3, 1.6],
        [-24, -3.5, 1.3],
        [20.5, -6, 1.8],
        [22, -12, 1.2],
        [19, 8, 1.4],
        [-9, -10.5, 1.0],
        [9, -14, 1.1],
    ] as const) {
        out.push(circleAt(fr, x, y, r, `fill="#2c2b28" fill-opacity="0.45"`));
    }
    // the drum yard: gravel speckle and a hazard strip at its gate
    const rnd = lcg(0x9a7d);
    for (let i = 0; i < 90; i++) {
        out.push(circleAt(fr, 15.6 + rnd() * 9.8, 3.6 + rnd() * 12.8, 0.08 + rnd() * 0.1, `fill="#6a6355"`));
    }
    out.push(hazardBand(fr, 15.6, 8.5, 16.3, 12.5, "gs-yard-gate", [FUEL_YELLOW, "#26282a"], 0.35));
    return floor(GAS_STATION_SITE_LAYOUT, GAS_STATION_FLOORS, { metal: "#8d949a" }, OUTLINE, out.join(""));
}

/** The canopy over the forecourt: white panels, a red fascia with a yellow pinstripe, rows of lights, the fuel sign. */
export function gasStationCanopy(): string {
    const c = GAS_STATION_CANOPY;
    const w = c.max.x - c.min.x;
    const h = c.max.y - c.min.y;
    const fr = boxFrame((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, w, h);
    const out: string[] = [
        rect(fr, c.min.x, c.min.y, c.max.x, c.max.y, `fill="${OUTLINE}"`),
        rect(fr, c.min.x, c.min.y, c.max.x, c.max.y, `fill="${FUEL_RED}"`, -4),
        rect(fr, c.min.x + 0.9, c.min.y + 0.9, c.max.x - 0.9, c.max.y - 0.9, `fill="${FUEL_YELLOW}"`),
        rect(fr, c.min.x + 1.2, c.min.y + 1.2, c.max.x - 1.2, c.max.y - 1.2, `fill="#ecebe6"`),
    ];
    const seams: string[] = [];
    for (let x = c.min.x + 4; x < c.max.x - 1; x += 4)
        seams.push(`M${px(fr, x)} ${py(fr, c.max.y - 1.2)}V${py(fr, c.min.y + 1.2)}`);
    out.push(`<path d="${seams.join("")}" stroke="#d3d2cc" stroke-width="3" fill="none"/>`);
    // a light over each island end
    for (const p of GAS_STATION_ISLANDS) {
        for (const dx of [-3.5, 3.5]) {
            out.push(
                rect(
                    fr,
                    p.x + dx - 0.9,
                    p.y - 0.35,
                    p.x + dx + 0.9,
                    p.y + 0.35,
                    `fill="#fff8d6" stroke="#9a978c" stroke-width="2"`,
                ),
            );
        }
    }
    const cx = (c.min.x + c.max.x) / 2;
    const cy = (c.min.y + c.max.y) / 2;
    out.push(circleAt(fr, cx, cy, 3, `fill="${FUEL_RED}" stroke="${OUTLINE}" stroke-width="5"`));
    out.push(fuelDrop(fr, cx, cy, 3.8, FUEL_YELLOW));
    return svg(fr, out.join(""));
}

/** The fuel pump, seen from above (64 px per unit): a red cabinet, its display and a nozzle holstered each side. */
export function gasPumpSvg(): string {
    const [w, h] = GAS_PUMP_ART.size;
    const body =
        `<rect x="10" y="4" width="${w - 20}" height="${h - 8}" rx="8" fill="${FUEL_RED}" stroke="${OUTLINE}" stroke-width="5"/>` +
        `<rect x="34" y="18" width="${w - 68}" height="${h - 36}" rx="4" fill="#f4f2ec" stroke="${OUTLINE}" stroke-width="3"/>` +
        `<rect x="44" y="28" width="${w - 88}" height="${h - 56}" fill="#1e2a2e"/>` +
        `<rect x="48" y="32" width="${(w - 96) * 0.6}" height="6" fill="#69d18a"/>` +
        `<rect x="2" y="${h / 2 - 14}" width="14" height="28" rx="4" fill="#26282a" stroke="${OUTLINE}" stroke-width="2"/>` +
        `<rect x="${w - 16}" y="${h / 2 - 14}" width="14" height="28" rx="4" fill="#26282a" stroke="${OUTLINE}" stroke-width="2"/>` +
        `<rect x="10" y="${h - 14}" width="${w - 20}" height="6" fill="${FUEL_YELLOW}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
}
