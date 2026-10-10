// The radar base's compound images (packages/defs rebirth/buildings/radar/compound.ts). The compound has no roof and its
// yard colours are its mapGroundPatches (gravel, asphalt, the concrete pads), so these images are transparent but for
// their own drawing: the four fence strips (a pale kerb under the chain-link mesh on the low steel rails, a post every
// 3.5 units and a heavier post at each run's end, so the gates read open), the yard's paint (the road's centre dashes
// and edge lines, the stop line inside the main gate, the helipad's ring and H, the fuel depot's hazard border, arrows
// on the lane to the service gate, the masts' guy wires and anchor blocks) and the antenna mast's lattice seen from
// above (a red and white triangular tower with its aviation light), drawn on the roof layer over the players.
import {
    REBIRTH_ART_PX_PER_UNIT as PX,
    RADAR_DEPOT,
    RADAR_FENCE_RUNS,
    RADAR_HELIPAD,
    RADAR_MAST_GUYS,
    RADAR_MASTS,
    RADAR_ROAD,
} from "../../../../packages/defs/src/rebirth/buildings.ts";
import { boxFrame, circleAt, type Frame, f2, hazardBand, polygon, px, py, rect, svg } from "../svg.ts";

const INK = "#1f2326";
const PAINT = "#ecebe4";
const YELLOW = "#e2b425";
const RED = "#c8312e";
const WHITE = "#f1f2ec";
const KERB = "#a5a296";
const MESH = "#5d666d";

type Pt = readonly [number, number];
const sw = (w: number) => `stroke-width="${f2(w * PX)}"`;

/** Stroked polylines, one path. */
function lines(fr: Frame, strokes: ReadonlyArray<readonly Pt[]>, w: number, color: string, extra = ""): string {
    const d = strokes.map((s) => s.map(([x, y], i) => `${i ? "L" : "M"}${px(fr, x)} ${py(fr, y)}`).join("")).join("");
    return `<path d="${d}" fill="none" stroke="${color}" ${sw(w)} ${extra}/>`;
}

/** Whether a world box reaches into the frame. */
function touches(fr: Frame, x0: number, y0: number, x1: number, y1: number): boolean {
    return x1 > fr.ox && x0 < fr.ox + fr.w / PX && y1 > fr.oy - fr.h / PX && y0 < fr.oy;
}

/** One fence strip: every run reaching into its frame, as a kerb with mesh, posts and end posts. */
function fenceStrip(fr: Frame, ppu: number): string {
    const out: string[] = [];
    for (const [horizontal, line, a0, a1] of RADAR_FENCE_RUNS) {
        const b = horizontal
            ? ([a0, line - 0.5, a1, line + 0.5] as const)
            : ([line - 0.5, a0, line + 0.5, a1] as const);
        if (!touches(fr, ...b)) continue;
        out.push(rect(fr, ...b, `fill="${INK}"`, 2));
        out.push(rect(fr, ...b, `fill="${KERB}"`));
        // the mesh: a cross-hatch along the run's centre band
        const mesh: Pt[][] = [];
        for (let a = a0; a < a1 - 1e-6; a += 0.5) {
            const e = Math.min(a + 0.5, a1);
            mesh.push(
                horizontal
                    ? [
                          [a, line - 0.22],
                          [e, line + 0.22],
                      ]
                    : [
                          [line - 0.22, a],
                          [line + 0.22, e],
                      ],
                horizontal
                    ? [
                          [a, line + 0.22],
                          [e, line - 0.22],
                      ]
                    : [
                          [line + 0.22, a],
                          [line - 0.22, e],
                      ],
            );
        }
        out.push(lines(fr, mesh, 0.06, MESH));
        out.push(
            lines(
                fr,
                horizontal
                    ? [
                          [
                              [a0, line - 0.24],
                              [a1, line - 0.24],
                          ],
                          [
                              [a0, line + 0.24],
                              [a1, line + 0.24],
                          ],
                      ]
                    : [
                          [
                              [line - 0.24, a0],
                              [line - 0.24, a1],
                          ],
                          [
                              [line + 0.24, a0],
                              [line + 0.24, a1],
                          ],
                      ],
                0.08,
                "#3e464c",
            ),
        );
        // posts every 3.5 and heavier end posts
        const n = Math.max(1, Math.round((a1 - a0) / 3.5));
        for (let i = 0; i <= n; i++) {
            const a = a0 + ((a1 - a0) * i) / n;
            const end = i === 0 || i === n;
            const s = end ? 0.42 : 0.26;
            const c = Math.min(Math.max(a, a0 + s), a1 - s);
            const [x, y] = horizontal ? [c, line] : [line, c];
            out.push(
                rect(
                    fr,
                    x - s,
                    y - s,
                    x + s,
                    y + s,
                    `fill="${end ? "#3a4248" : "#4d565d"}" stroke="${INK}" stroke-width="2"`,
                ),
            );
        }
    }
    return svg(fr, out.join(""), ppu);
}

/** A chevron at (x, y) pointing along (dx, dy). */
function chevron(x: number, y: number, dx: number, dy: number, half: number, depth: number): Pt[] {
    const bx = x - (dx * depth) / 2;
    const by = y - (dy * depth) / 2;
    return [
        [bx - dy * half, by + dx * half],
        [x + (dx * depth) / 2, y + (dy * depth) / 2],
        [bx + dy * half, by - dx * half],
    ];
}

function yard(fr: Frame, ppu: number): string {
    const out: string[] = [];
    const [rx0, ry0, rx1, ry1] = RADAR_ROAD;
    // the road: edge lines and centre dashes from the gate to the dome, the stop line inside the gate
    const dashes: Pt[][] = [];
    for (let y = ry0 + 4; y < ry1 - 1.5; y += 3)
        dashes.push([
            [0, y],
            [0, Math.min(y + 1.5, ry1 - 1)],
        ]);
    out.push(
        lines(
            fr,
            [
                [
                    [rx0 + 0.35, ry0 + 0.5],
                    [rx0 + 0.35, ry1],
                ],
                [
                    [rx1 - 0.35, ry0 + 0.5],
                    [rx1 - 0.35, ry1],
                ],
            ],
            0.18,
            PAINT,
        ),
        lines(fr, dashes, 0.2, YELLOW),
        rect(fr, rx0 + 0.35, ry0 + 2.2, rx1 - 0.35, ry0 + 2.7, `fill="${PAINT}"`),
    );
    // the lane east to the service gate: chevrons pointing east
    out.push(
        lines(
            fr,
            [12, 18, 41, 46].map((x) => chevron(x, -24, 1, 0, 1.2, 1.2)),
            0.3,
            YELLOW,
            `stroke-linejoin="miter"`,
        ),
    );
    // the helipad: an inset border, the touchdown ring and the H
    const [hx0, hy0, hx1, hy1] = RADAR_HELIPAD;
    const hc = { x: (hx0 + hx1) / 2, y: (hy0 + hy1) / 2 };
    out.push(
        rect(fr, hx0 + 0.6, hy0 + 0.6, hx1 - 0.6, hy1 - 0.6, `fill="none" stroke="${PAINT}" ${sw(0.2)}`),
        circleAt(fr, hc.x, hc.y, 5, `fill="none" stroke="${YELLOW}" ${sw(0.45)}`),
        lines(
            fr,
            [
                [
                    [hc.x - 1.6, hc.y - 2.2],
                    [hc.x - 1.6, hc.y + 2.2],
                ],
                [
                    [hc.x + 1.6, hc.y - 2.2],
                    [hc.x + 1.6, hc.y + 2.2],
                ],
                [
                    [hc.x - 1.6, hc.y],
                    [hc.x + 1.6, hc.y],
                ],
            ],
            0.6,
            PAINT,
            `stroke-linecap="square"`,
        ),
    );
    // the fuel depot: a hazard border round its pad, a NO FIRE red bar
    const [dx0, dy0, dx1, dy1] = RADAR_DEPOT;
    out.push(
        hazardBand(fr, dx0, dy1 - 0.5, dx1, dy1, "radar-depot-n", [YELLOW, "#26282a"], 0.4),
        hazardBand(fr, dx0, dy0, dx0 + 0.5, dy1, "radar-depot-w", [YELLOW, "#26282a"], 0.4),
        rect(fr, dx0 + 1.2, dy1 - 1.6, dx1 - 1.2, dy1 - 1, `fill="${RED}"`),
    );
    // the masts' guy wires and anchor blocks
    const guys: Pt[][] = [];
    for (const m of RADAR_MASTS)
        for (const [gx, gy] of RADAR_MAST_GUYS)
            guys.push([
                [m.x, m.y],
                [m.x + gx, m.y + gy],
            ]);
    out.push(lines(fr, guys, 0.1, "#2c3135"));
    for (const m of RADAR_MASTS) {
        for (const [gx, gy] of RADAR_MAST_GUYS) {
            const [x, y] = [m.x + gx, m.y + gy];
            out.push(
                rect(fr, x - 0.45, y - 0.45, x + 0.45, y + 0.45, `fill="#9a978c" stroke="${INK}" stroke-width="3"`),
            );
        }
        // the mast's concrete footing
        out.push(
            rect(fr, m.x - 1.6, m.y - 1.6, m.x + 1.6, m.y + 1.6, `fill="#a9a69b" stroke="#77746a" stroke-width="3"`),
        );
    }
    return svg(fr, out.join(""), ppu);
}

/** The antenna mast from above (its own 6 x 6 frame, centred on the foot): a triangular lattice tower. */
function mast(): string {
    const fr = boxFrame(0, 0, 6, 6);
    const r = 1.7;
    const tri: Pt[] = [0, 1, 2].map((i) => {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
        return [Math.cos(a) * r, Math.sin(a) * r] as const;
    });
    const inner: Pt[] = tri.map(([x, y]) => [x * 0.5, y * 0.5] as const);
    const body =
        polygon(fr, tri, `fill="${RED}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"`) +
        polygon(fr, inner, `fill="${WHITE}" stroke="${INK}" stroke-width="3"`) +
        lines(
            fr,
            tri.map((p, i) => [p, inner[(i + 1) % 3]]),
            0.08,
            INK,
        ) +
        // the dish and the whips at the top, the aviation light
        `<path d="M${px(fr, 0)} ${py(fr, 0)}L${px(fr, 2.4)} ${py(fr, -0.6)}M${px(fr, 0)} ${py(fr, 0)}L${px(fr, -2.3)} ${py(fr, -1)}" stroke="${INK}" stroke-width="4"/>` +
        circleAt(fr, 2.4, -0.6, 0.55, `fill="#d6d8d2" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, -2.3, -1, 0.3, `fill="#d6d8d2" stroke="${INK}" stroke-width="2"`) +
        circleAt(fr, 0, 0, 0.5, `fill="#ff3b30" stroke="${WHITE}" stroke-width="3"`);
    return svg(fr, body);
}

/** The compound's images by sprite id: (frame in the compound frame, pixels per unit) -> SVG. */
export const RADAR_YARD_ART: Readonly<Record<string, (fr: Frame, ppu: number) => string>> = {
    "map-building-radar-fence-s-01.img": fenceStrip,
    "map-building-radar-fence-n-01.img": fenceStrip,
    "map-building-radar-fence-w-01.img": fenceStrip,
    "map-building-radar-fence-e-01.img": fenceStrip,
    "map-building-radar-yard-01.img": yard,
    "map-building-radar-mast-01.img": () => mast(),
};
