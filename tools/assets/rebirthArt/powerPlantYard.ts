// The power plant's yard image and its cooling towers' roof (packages/defs rebirth/buildings/powerplant/compound.ts).
// The yard (one floor image, 16 px per unit): concrete slabs, the asphalt roads with their centre dashes and a zebra
// crossing at the main gate, the transformer yard's gravel inside a yellow and black kerb with the high-voltage bus
// lines between its rows, the fuel farm's bund (a raised concrete pad) with a dark ring under each tank, a paved ring
// round each cooling tower, the perimeter walls and the gate sills. The tower roof: the shell's pale rim, its dark throat
// with a drift of steam.
import {
    PLANT_COMPOUND,
    PLANT_FUEL_BUND,
    PLANT_GATES,
    PLANT_PERIMETER,
    PLANT_ROADS,
    PLANT_TANK_RAD,
    PLANT_TANK_ROOF,
    PLANT_TANKS,
    PLANT_TOWER_RAD,
    PLANT_TOWER_ROOF,
    PLANT_TOWERS,
    PLANT_TRANSFORMER_COLS,
    PLANT_TRANSFORMER_ROWS,
    PLANT_TRANSFORMER_YARD,
    PLANT_YARD_IMAGE,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import { boxFrame, circleAt, type Frame, f2, hazardBand, px, py, rect, svg, walls } from "./svg.ts";

const INK = "#1f2326";
const CONCRETE = "#8e8c84";
const ASPHALT = "#5f6264";
const GRAVEL = "#7d7a6e";
const PAINT = "#ecebe4";
const YELLOW = "#e2b425";

/** A path of world-space line segments. */
function path(fr: Frame, segs: ReadonlyArray<readonly [number, number, number, number]>, attrs: string): string {
    const d = segs.map(([x0, y0, x1, y1]) => `M${px(fr, x0)} ${py(fr, y0)}L${px(fr, x1)} ${py(fr, y1)}`).join("");
    return `<path d="${d}" ${attrs}/>`;
}

function slabs(fr: Frame): string {
    const { x: X, y: Y } = PLANT_PERIMETER;
    const segs: [number, number, number, number][] = [];
    for (let x = -X + 6; x < X; x += 6) segs.push([x, -Y, x, Y]);
    for (let y = -Y + 6; y < Y; y += 6) segs.push([-X, y, X, y]);
    return rect(fr, -X, -Y, X, Y, `fill="${CONCRETE}"`) + path(fr, segs, `stroke="#83817a" stroke-width="3"`);
}

function roads(fr: Frame): string {
    const [ew, ns] = PLANT_ROADS;
    const out = PLANT_ROADS.map((b) => rect(fr, b[0], b[1], b[2], b[3], `fill="${ASPHALT}"`));
    // centre dashes
    out.push(
        path(
            fr,
            [
                [ew[0] + 1, 0, ew[2] - 1, 0],
                [(ns[0] + ns[2]) / 2, ns[1] + 5, (ns[0] + ns[2]) / 2, ns[3] - 1],
            ],
            `stroke="${PAINT}" stroke-width="5" stroke-dasharray="32 24"`,
        ),
    );
    // the zebra crossing inside the main gate
    for (let x = ns[0] + 0.5; x < ns[2]; x += 1.5)
        out.push(rect(fr, x, ns[1] + 1, x + 0.8, ns[1] + 3.5, `fill="${PAINT}"`));
    return out.join("");
}

function transformerYard(fr: Frame): string {
    const [x0, y0, x1, y1] = PLANT_TRANSFORMER_YARD;
    const out: string[] = [rect(fr, x0, y0, x1, y1, `fill="${GRAVEL}"`)];
    // gravel speckle on a fixed lattice
    const dots: string[] = [];
    for (let x = x0 + 0.7; x < x1; x += 1.3) {
        for (let y = y0 + 0.5; y < y1; y += 1.1) {
            const k = (Math.round(x * 7) * 31 + Math.round(y * 5) * 17) % 5;
            if (k < 2) dots.push(circleAt(fr, x + k * 0.2, y, 0.12, `fill="${k ? "#6c6a60" : "#929083"}"`));
        }
    }
    out.push(dots.join(""));
    // the high-voltage bus lines: each row's boxes joined, every row tied to the trunk by the east wall
    const xs = PLANT_TRANSFORMER_COLS.map((c) => c.x);
    const bus: [number, number, number, number][] = PLANT_TRANSFORMER_ROWS.map((y) => [xs[0], y, xs[xs.length - 1], y]);
    bus.push([xs[0], PLANT_TRANSFORMER_ROWS[0], xs[0], PLANT_TRANSFORMER_ROWS[PLANT_TRANSFORMER_ROWS.length - 1]]);
    out.push(path(fr, bus, `stroke="#3a3d40" stroke-width="5"`));
    out.push(path(fr, bus, `stroke="#b9852f" stroke-width="2"`));
    for (const y of PLANT_TRANSFORMER_ROWS) {
        for (let x = xs[0] + 3.25; x < xs[xs.length - 1] - 1.5; x += 4.25) {
            out.push(circleAt(fr, x, y, 0.3, `fill="#d9d6cc" stroke="${INK}" stroke-width="2"`));
        }
    }
    // the yellow and black kerb round the yard (inside its box), open on the road side
    const k = 0.4;
    out.push(hazardBand(fr, x0, y0, x0 + k, y1, "plant-kerb-w"));
    out.push(hazardBand(fr, x0, y0, x1, y0 + k, "plant-kerb-s"));
    // the warning sign by the road: a yellow triangle with a bolt
    const sx = x0 + 2;
    const sy = y0 + 1.6;
    out.push(
        `<polygon points="${px(fr, sx - 1)},${py(fr, sy - 0.8)} ${px(fr, sx + 1)},${py(fr, sy - 0.8)} ${px(fr, sx)},${py(fr, sy + 0.95)}" ` +
            `fill="${YELLOW}" stroke="${INK}" stroke-width="3"/>`,
        `<polygon points="${px(fr, sx + 0.1)},${py(fr, sy + 0.55)} ${px(fr, sx - 0.3)},${py(fr, sy - 0.1)} ${px(fr, sx + 0.05)},${py(fr, sy - 0.1)} ` +
            `${px(fr, sx - 0.15)},${py(fr, sy - 0.65)} ${px(fr, sx + 0.35)},${py(fr, sy + 0.05)} ${px(fr, sx)},${py(fr, sy + 0.05)}" fill="${INK}"/>`,
    );
    return out.join("");
}

function fuelFarm(fr: Frame): string {
    const [x0, y0, x1, y1] = PLANT_FUEL_BUND;
    const out: string[] = [
        rect(fr, x0, y0, x1, y1, `fill="#a3a097"`),
        rect(fr, x0, y0, x1, y1, `fill="none" stroke="#6f6c64" stroke-width="10"`),
    ];
    for (const t of PLANT_TANKS) {
        out.push(circleAt(fr, t.x, t.y, PLANT_TANK_RAD + 0.6, `fill="#55585a"`));
        out.push(
            circleAt(
                fr,
                t.x,
                t.y,
                PLANT_TANK_RAD + 0.6,
                `fill="none" stroke="${YELLOW}" stroke-width="3" stroke-dasharray="10 8"`,
            ),
        );
    }
    // oil stains by the drums
    out.push(circleAt(fr, 32.5, -15.5, 2.6, `fill="#3d3a35" fill-opacity="0.35"`));
    return out.join("");
}

function towerRings(fr: Frame): string {
    return PLANT_TOWERS.map(
        (t) =>
            circleAt(fr, t.x, t.y, PLANT_TOWER_RAD + 2, `fill="#a7a49b" stroke="#74716a" stroke-width="4"`) +
            circleAt(fr, t.x, t.y, PLANT_TOWER_RAD + 0.2, `fill="#55595d"`),
    ).join("");
}

/** The gate gaps' ground: asphalt across the road gates, concrete through the postern. */
function gateSills(fr: Frame): string {
    const { x: X, y: Y } = PLANT_PERIMETER;
    const [m0, m1] = PLANT_GATES.main;
    const [p0, p1] = PLANT_GATES.postern;
    const [w0, w1] = PLANT_GATES.west;
    const [e0, e1] = PLANT_GATES.east;
    return (
        rect(fr, m0, -Y - 0.5, m1, -Y + 0.5, `fill="${ASPHALT}"`) +
        rect(fr, p0, Y - 0.5, p1, Y + 0.5, `fill="${CONCRETE}"`) +
        rect(fr, -X - 0.5, w0, -X + 0.5, w1, `fill="${ASPHALT}"`) +
        rect(fr, X - 0.5, e0, X + 0.5, e1, `fill="${ASPHALT}"`)
    );
}

export function plantYard(): string {
    const img = PLANT_YARD_IMAGE;
    const fr = boxFrame(img.centre.x, img.centre.y, img.size[0], img.size[1]);
    const body =
        slabs(fr) +
        roads(fr) +
        transformerYard(fr) +
        fuelFarm(fr) +
        towerRings(fr) +
        gateSills(fr) +
        walls(fr, PLANT_COMPOUND.layout, "#a19f97", INK);
    return svg(fr, body, img.ppu);
}

export function plantTowerRoof(): string {
    const s = PLANT_TOWER_ROOF.size;
    const fr = boxFrame(0, 0, s, s);
    const r = PLANT_TOWER_RAD;
    const steam = [
        [-2.2, 1.6, 2.6],
        [1.8, 2.4, 2.2],
        [0.6, -1.4, 3],
        [-1.6, -2.6, 1.8],
    ]
        .map(([x, y, rr]) => circleAt(fr, x, y, rr, `fill="#f4f6f7" fill-opacity="0.55"`))
        .join("");
    const body =
        `<defs><radialGradient id="plant-throat"><stop offset="0" stop-color="#5a6268"/>` +
        `<stop offset="1" stop-color="#262b2f"/></radialGradient></defs>` +
        circleAt(fr, 0, 0, r + 0.75, `fill="#d3cfc4" stroke="${INK}" stroke-width="5"`) +
        circleAt(fr, 0, 0, r - 0.4, `fill="none" stroke="#b7b2a6" stroke-width="4"`) +
        circleAt(fr, 0, 0, r - 1.3, `fill="url(#plant-throat)" stroke="#8f8a7f" stroke-width="4"`) +
        steam +
        // a red aviation light on the rim
        circleAt(fr, 0, r + 0.1, 0.45, `fill="#d8402f" stroke="${INK}" stroke-width="${f2(2)}"`);
    return svg(fr, body, PLANT_TOWER_ROOF.ppu);
}

/** The fuel tank's roof: a pale steel dome with weld rings, the vent hatch, the ladder's head and a flammable diamond. */
export function plantTankRoof(): string {
    const s = PLANT_TANK_ROOF.size;
    const fr = boxFrame(0, 0, s, s);
    const r = PLANT_TANK_RAD + 0.35;
    const body =
        circleAt(fr, 0, 0, r, `fill="#e3e1da" stroke="${INK}" stroke-width="5"`) +
        circleAt(fr, 0, 0, r * 0.68, `fill="none" stroke="#c4c1b8" stroke-width="3"`) +
        circleAt(fr, 0, 0, r * 0.34, `fill="none" stroke="#c4c1b8" stroke-width="3"`) +
        circleAt(fr, 0, 0, 0.7, `fill="#8d9296" stroke="${INK}" stroke-width="3"`) +
        rect(fr, r - 1.6, -0.5, r - 0.2, 0.5, `fill="#6b7074" stroke="${INK}" stroke-width="2"`) +
        `<polygon points="${px(fr, -2.2)},${py(fr, 1.6)} ${px(fr, -1.2)},${py(fr, 2.6)} ${px(fr, -0.2)},${py(fr, 1.6)} ` +
        `${px(fr, -1.2)},${py(fr, 0.6)}" fill="#d8402f" stroke="${INK}" stroke-width="2"/>`;
    return svg(fr, body, PLANT_TANK_ROOF.ppu);
}
