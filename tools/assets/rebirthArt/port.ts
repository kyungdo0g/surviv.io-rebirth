// Floor and roof art of the container port's additions (packages/defs rebirth/buildings/portCheckpoint.ts,
// cargoShip.ts). The checkpoint: the asphalt road with lane arrows, stop lines and a zebra crossing, the booth's
// kerbed island, the barriers' red and white arms; the terminal's pale tiled screening hall with the scanner gates'
// grey frames (a green light on each post) and the x-ray scanner (belts, a lead-curtained tunnel, a monitor), the
// grey locker room, the evidence vault's steel plate with a hazard strip inside its sliding door; a blue roof with a
// skylight over the hall, a white customs shield with a gold star and AC units; the booth's yellow roof with an amber
// beacon. The ship: a red-brown hull with a stepped-in bow (anchor hawses), a green deck with yellow walkway lines and
// grey hatch covers under the containers, the gangway's treads and handrails, the bridge house's rooms with the chart
// on the wheelhouse floor; a white bridge roof with the wheelhouse windows, the funnel in the line's colours, the radar
// mast and two orange lifeboats.
import {
    CARGO_SHIP_BOW_TIP,
    CARGO_SHIP_CODE,
    CARGO_SHIP_GANGWAY,
    CARGO_SHIP_HULL,
    CARGO_SHIP_LAYOUT,
    CARGO_SHIP_NOTE,
    CARGO_SHIP_SWITCHES,
    PORT_BOOTH_BOUNDS,
    PORT_BOOTH_LAYOUT,
    PORT_BOOTH_SWITCH,
    PORT_CHECKPOINT_LAYOUT,
    PORT_CHECKPOINT_PLAZA,
    PORT_VAULT_DOOR,
    type RebirthBuildingLayout,
    type WallSeg,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
    codeNote,
    type FloorPalette,
    type Frame,
    floorFrameOf,
    frameOf,
    gridLines,
    hazardBand,
    polygon,
    px,
    py,
    rect,
    roof,
    SWITCH_PLATE_COLORS,
    star,
    svg,
    switchPlate,
    thresholds,
    walls,
} from "./svg.ts";

const OUTLINE = "#1f2326";

/** The rooms of a layout drawn with their grids (no outdoor rooms). */
function rooms(fr: Frame, layout: RebirthBuildingLayout, palette: FloorPalette): string {
    return layout.rooms
        .map(
            (r) =>
                rect(fr, r.min.x, r.min.y, r.max.x, r.max.y, `fill="${palette[r.floor]?.base}"`) +
                gridLines(fr, r, palette),
        )
        .join("");
}

/** A world-space polyline with `attrs`. */
function line(fr: Frame, pts: ReadonlyArray<readonly [number, number]>, attrs: string): string {
    return `<path d="M${pts.map(([x, y]) => `${px(fr, x)} ${py(fr, y)}`).join("L")}" ${attrs}/>`;
}

/** Alternating stripes filling the world box along its long side, `step` units each, from `colors`. */
function stripes(fr: Frame, x0: number, y0: number, x1: number, y1: number, colors: readonly string[], step: number) {
    const out: string[] = [];
    const alongX = x1 - x0 >= y1 - y0;
    const [a0, a1] = alongX ? [x0, x1] : [y0, y1];
    for (let a = a0, i = 0; a < a1 - 1e-6; a += step, i++) {
        const b = Math.min(a + step, a1);
        const box = alongX ? ([a, y0, b, y1] as const) : ([x0, a, x1, b] as const);
        out.push(rect(fr, ...box, `fill="${colors[i % colors.length]}"`));
    }
    return out.join("");
}

/** A lane arrow on the road at (x, y) pointing `dir` (+1 east, -1 west), 4 units long. */
function laneArrow(fr: Frame, x: number, y: number, dir: 1 | -1): string {
    const d = dir;
    return polygon(
        fr,
        [
            [x - 2 * d, y - 0.3],
            [x + 0.6 * d, y - 0.3],
            [x + 0.6 * d, y - 0.9],
            [x + 2 * d, y],
            [x + 0.6 * d, y + 0.9],
            [x + 0.6 * d, y + 0.3],
            [x - 2 * d, y + 0.3],
        ],
        `fill="#e9e9e3"`,
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// port_checkpoint_01

export const PORT_CHECKPOINT_FLOORS: FloorPalette = {
    road: { base: "#55595c", grid: "#55595c", step: 8 },
    hall: { base: "#d3d6d2", grid: "#c2c6c1", step: 2 },
    lockers: { base: "#9aa4ad", grid: "#8b959e", step: 2 },
    vault: { base: "#5f6b73", grid: "#545f67", step: 1 },
    booth: { base: "#c9c2b2", grid: "#b8b1a1", step: 1 },
};

/** The x-ray scanner's body (the two steel wall pieces it is built from, packages/defs portCheckpoint.ts). */
const XRAY = { x0: 6.5, y0: 14.5, x1: 16.5, y1: 16.5 } as const;
/** The scanner gates' frames: centre x and the lanes' y ranges they span (the low posts at y 6.5..7.5, 10.5..11.5). */
const GATE_X = 9.5;
const GATES: ReadonlyArray<readonly [number, number]> = [
    [2.5, 7.5],
    [6.5, 11.5],
    [10.5, 14.5],
];
/** The barrier arms (the low wall pieces) and which way their stripes run. */
const ARMS: ReadonlyArray<readonly [number, number, number, number]> = [
    [9.5, -4.5, 10.5, -1.5],
    [-10.5, -16.5, -9.5, -13.5],
];

function checkpointRoad(fr: Frame): string {
    const P = PORT_CHECKPOINT_PLAZA;
    const B = PORT_BOOTH_BOUNDS;
    const out: string[] = [rect(fr, P.min.x, P.min.y, P.max.x, P.max.y, `fill="${PORT_CHECKPOINT_FLOORS.road.base}"`)];
    // the kerb along the terminal's front (a pavement strip) and the booth's island, kerbed, with hazard noses
    out.push(rect(fr, -17.5, 1.5, 17.5, 2, `fill="#8f9396"`));
    out.push(
        rect(
            fr,
            B.min.x - 1.5,
            B.min.y - 0.5,
            B.max.x + 1.5,
            B.max.y + 0.5,
            `fill="#a3a7a9" stroke="#3b3f42" stroke-width="5"`,
        ),
    );
    out.push(hazardBand(fr, B.min.x - 1.5, B.min.y - 0.5, B.min.x - 0.5, B.max.y + 0.5, "port-island-w"));
    out.push(hazardBand(fr, B.max.x + 0.5, B.min.y - 0.5, B.max.x + 1.5, B.max.y + 0.5, "port-island-e"));
    // lane edge lines, the stop lines before each barrier, the arrows (inbound west on the north lane, outbound east)
    out.push(
        line(
            fr,
            [
                [-17.5, -17.5],
                [17.5, -17.5],
            ],
            `stroke="#e9e9e3" stroke-width="4"`,
        ),
    );
    out.push(
        line(
            fr,
            [
                [11.75, -4.5],
                [11.75, 1.25],
            ],
            `stroke="#e9e9e3" stroke-width="10"`,
        ),
    );
    out.push(
        line(
            fr,
            [
                [-11.75, -17.25],
                [-11.75, -13.5],
            ],
            `stroke="#e9e9e3" stroke-width="10"`,
        ),
    );
    out.push(laneArrow(fr, 14.5, -1.5, -1), laneArrow(fr, -3, -1.5, -1), laneArrow(fr, -14.5, -15.5, 1));
    out.push(laneArrow(fr, 9, -15.5, 1));
    // the zebra crossing from the hall's exit door to the island
    for (let x = 4.25; x < 8; x += 1) out.push(rect(fr, x, -4.25, x + 0.5, 1.25, `fill="#e9e9e3"`));
    // the barriers' arms: red and white bands, outlined, a counterweight by the bollard
    for (const [x0, y0, x1, y1] of ARMS) {
        out.push(rect(fr, x0, y0, x1, y1, `fill="${OUTLINE}"`, 3));
        out.push(stripes(fr, x0 + 0.15, y0, x1 - 0.15, y1, ["#d8402f", "#f2f2ee"], 0.5));
    }
    return out.join("");
}

/** The scanner gates: a grey frame across each lane, its posts dark with a green light. */
function scannerGates(fr: Frame): string {
    const out: string[] = [];
    for (const [y0, y1] of GATES) {
        out.push(rect(fr, GATE_X - 0.5, y0, GATE_X + 0.5, y1, `fill="none" stroke="#6d7479" stroke-width="10"`));
    }
    for (const y of [7, 11]) {
        out.push(rect(fr, 8, y - 0.5, 11, y + 0.5, `fill="#3d4247" stroke="${OUTLINE}" stroke-width="3"`));
        out.push(circleAt(fr, GATE_X, y, 0.22, `fill="#4cd964"`));
    }
    return out.join("");
}

/** The x-ray scanner: two belts with rollers, the tunnel with its lead curtain, the operator's monitor. */
function xray(fr: Frame): string {
    const { x0, y0, x1, y1 } = XRAY;
    const out: string[] = [rect(fr, x0, y0, x1, y1, `fill="#2f3438" stroke="${OUTLINE}" stroke-width="4"`)];
    const rollers: string[] = [];
    for (let x = x0 + 0.5; x < x1; x += 0.5) {
        if (x > 10.5 && x < 14) continue;
        rollers.push(`M${px(fr, x)} ${py(fr, y1 - 0.3)}V${py(fr, y0 + 0.3)}`);
    }
    out.push(`<path d="${rollers.join("")}" stroke="#555c62" stroke-width="3"/>`);
    out.push(rect(fr, 10.5, y0 - 0.1, 14, y1 + 0.1, `fill="#b9c0c6" stroke="${OUTLINE}" stroke-width="4"`));
    out.push(stripes(fr, 10.7, y0 + 0.25, 11.1, y1 - 0.25, ["#4a5056", "#2f3438"], 0.25));
    out.push(stripes(fr, 13.4, y0 + 0.25, 13.8, y1 - 0.25, ["#4a5056", "#2f3438"], 0.25));
    out.push(rect(fr, 11.6, y0 + 0.45, 12.9, y1 - 0.45, `fill="#5ac8fa" stroke="${OUTLINE}" stroke-width="3"`));
    return out.join("");
}

export function checkpointFloor(): string {
    const L = PORT_CHECKPOINT_LAYOUT;
    const fr = floorFrameOf(L);
    const d = PORT_VAULT_DOOR.pos;
    const steel = (s: WallSeg) => s[4] === "metal";
    const body =
        checkpointRoad(fr) +
        rooms(fr, L, PORT_CHECKPOINT_FLOORS) +
        // a hazard strip on the locker room's side of the vault door, the plate under the booth's switch
        hazardBand(fr, d.x + 0.5, d.y - 4, d.x + 1.25, d.y, "port-vault-hazard") +
        switchPlate(fr, PORT_BOOTH_SWITCH.x, PORT_BOOTH_SWITCH.y - 0.2, SWITCH_PLATE_COLORS.red) +
        // the gates' frames and the barriers' arms are drawn above, not as loophole sills
        thresholds(fr, { ...L, openings: L.openings.filter((o) => o.type !== "brick_wall_ext_3_0_low") }, "#00000033") +
        scannerGates(fr) +
        walls(fr, { ...L, walls: L.walls.filter((s) => !steel(s)) }, "#7b8087", OUTLINE) +
        xray(fr);
    return svg(fr, body);
}

/** A white shield with a gold star (the customs badge). */
function customsShield(fr: Frame, x: number, y: number): string {
    return (
        polygon(
            fr,
            [
                [x - 2.6, y + 2.6],
                [x + 2.6, y + 2.6],
                [x + 2.6, y - 0.4],
                [x, y - 3],
                [x - 2.6, y - 0.4],
            ],
            `fill="#f4f4f0" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"`,
        ) + star(fr, x, y + 0.2, 1.7, "#e2b425")
    );
}

/** A skylight: pale glass with mullions, framed. */
function skylight(fr: Frame, x0: number, y0: number, x1: number, y1: number): string {
    const out = [rect(fr, x0, y0, x1, y1, `fill="#a9d4e8" stroke="${OUTLINE}" stroke-width="4"`)];
    const m: string[] = [];
    for (let x = x0 + 2; x < x1 - 0.5; x += 2) m.push(`M${px(fr, x)} ${py(fr, y1)}V${py(fr, y0)}`);
    m.push(`M${px(fr, x0)} ${py(fr, (y0 + y1) / 2)}H${px(fr, x1)}`);
    out.push(`<path d="${m.join("")}" stroke="#4f6f80" stroke-width="3"/>`);
    return out.join("");
}

export function checkpointCeiling(): string {
    const fr = frameOf(PORT_CHECKPOINT_LAYOUT);
    const top =
        skylight(fr, 6, 6, 14, 12) +
        customsShield(fr, -11.5, 9.5) +
        acUnit(fr, -3, 13.5) +
        acUnit(fr, -3, 5.5) +
        circleAt(fr, 15, 14.5, 0.6, `fill="#7d868c" stroke="#2c3135" stroke-width="3"`);
    return roof(PORT_CHECKPOINT_LAYOUT, "#3f5f7a", "#2e4659", "#395670", top);
}

export function boothCeiling(): string {
    const fr = frameOf(PORT_BOOTH_LAYOUT);
    const c = {
        x: (PORT_BOOTH_BOUNDS.min.x + PORT_BOOTH_BOUNDS.max.x) / 2,
        y: (PORT_BOOTH_BOUNDS.min.y + PORT_BOOTH_BOUNDS.max.y) / 2,
    };
    const top =
        circleAt(fr, c.x, c.y, 1.3, `fill="${OUTLINE}"`) +
        circleAt(fr, c.x, c.y, 1.05, `fill="#ff9f0a" stroke="#ffffff" stroke-width="5"`) +
        circleAt(fr, c.x - 0.3, c.y + 0.3, 0.3, `fill="#ffd9a0"`);
    return roof(PORT_BOOTH_LAYOUT, "#d9a21b", "#a87c12", "#c48f16", top);
}

// ---------------------------------------------------------------------------------------------------------------------
// cargo_ship_01

export const CARGO_SHIP_FLOORS: FloorPalette = {
    deck: { base: "#5f7b6a", grid: "#5f7b6a", step: 8 },
    gangway: { base: "#9aa1a6", grid: "#9aa1a6", step: 8 },
    wheelhouse: { base: "#c7cbc6", grid: "#b6bab5", step: 2 },
    mess: { base: "#b9a17c", grid: "#a68f6c", step: 1 },
    cabin: { base: "#7d3b3b", grid: "#6f3333", step: 1 },
};

const HULL = "#7a2e2a";
const RAIL = "#9a3c33";

/** Whether a wall is part of the hull (the rails, the stern, the bow), drawn as the hull rather than as a wall. */
function hullWall(s: WallSeg): boolean {
    const H = CARGO_SHIP_HULL;
    const vertical = s[0] === s[2];
    if (vertical) return Math.abs(Math.abs(s[0]) - (H.max.x - 0.5)) < 1e-6;
    return s[1] === H.min.y + 0.5 || s[1] > H.max.y;
}

/** The hull outline: the stern with chamfered corners, the rails, the bow. */
function hullPoints(inset: number): Array<[number, number]> {
    const H = CARGO_SHIP_HULL;
    const x0 = H.min.x + inset;
    const x1 = H.max.x - inset;
    const y0 = H.min.y + inset;
    const tip = CARGO_SHIP_BOW_TIP - inset * 1.9;
    return [
        [x0 + 1, y0],
        [x1 - 1, y0],
        [x1, y0 + 1],
        [x1, H.max.y],
        [0, tip],
        [x0, H.max.y],
        [x0, y0 + 1],
    ];
}

function shipDeck(fr: Frame): string {
    const H = CARGO_SHIP_HULL;
    const G = CARGO_SHIP_GANGWAY;
    const out: string[] = [];
    // the hull: a dark outline, the red-brown hull, the rail band, the deck inside it
    out.push(polygon(fr, hullPoints(0), `fill="${HULL}" stroke="${OUTLINE}" stroke-width="6" stroke-linejoin="round"`));
    out.push(polygon(fr, hullPoints(0.3), `fill="${RAIL}"`));
    out.push(rect(fr, H.min.x + 1, H.min.y + 1, H.max.x - 1, H.max.y, `fill="${CARGO_SHIP_FLOORS.deck.base}"`));
    // the bow plating: seams, two anchor hawses and their chains towards the windlass behind the bulkhead
    const bow: string[] = [];
    for (let y = H.max.y + 2; y < CARGO_SHIP_BOW_TIP - 2; y += 2)
        bow.push(`M${px(fr, -11)} ${py(fr, y)}H${px(fr, 11)}`);
    out.push(
        `<defs><clipPath id="ship-bow">${polygon(fr, hullPoints(0.3), "")}</clipPath></defs>`,
        `<path d="${bow.join("")}" stroke="#6a2824" stroke-width="3" clip-path="url(#ship-bow)"/>`,
        circleAt(fr, -3, H.max.y + 3.5, 0.9, `fill="#2a1c18" stroke="#c9c6bd" stroke-width="4"`),
        circleAt(fr, 3, H.max.y + 3.5, 0.9, `fill="#2a1c18" stroke="#c9c6bd" stroke-width="4"`),
    );
    // hatch covers under the container rows (x -7.5..7.5), seams across them
    for (const [y0, y1] of [
        [-22, -9],
        [-6, 7],
        [10, 23],
    ] as const) {
        out.push(rect(fr, -7.5, y0, 7.5, y1, `fill="#7f8f86" stroke="#3e4a44" stroke-width="4"`));
        const seams: string[] = [];
        for (let y = y0 + 3.25; y < y1 - 1; y += 3.25) seams.push(`M${px(fr, -7.5)} ${py(fr, y)}H${px(fr, 7.5)}`);
        out.push(`<path d="${seams.join("")}" stroke="#56645c" stroke-width="3"/>`);
    }
    // yellow walkway lines along both rails, the forecastle's hatched windlass plate before the bulkhead
    for (const x of [-8.25, 8.25]) {
        out.push(
            line(
                fr,
                [
                    [x, -25.5],
                    [x, 23],
                ],
                `stroke="#e2b425" stroke-width="5" stroke-dasharray="24 12"`,
            ),
        );
    }
    out.push(hazardBand(fr, -2.5, 23.5, 2.5, 24.5, "ship-forecastle"));
    // the gangway: across the rail's gap to the quay, aluminium treads, handrails on both sides
    out.push(
        rect(
            fr,
            H.max.x - 1,
            G.min.y,
            G.max.x,
            G.max.y,
            `fill="${CARGO_SHIP_FLOORS.gangway.base}" stroke="${OUTLINE}" stroke-width="4"`,
        ),
    );
    const treads: string[] = [];
    for (let x = H.max.x - 0.5; x < G.max.x; x += 0.5)
        treads.push(`M${px(fr, x)} ${py(fr, G.max.y - 0.3)}V${py(fr, G.min.y + 0.3)}`);
    out.push(`<path d="${treads.join("")}" stroke="#7b8287" stroke-width="3"/>`);
    out.push(
        line(
            fr,
            [
                [H.max.x, G.min.y + 0.15],
                [G.max.x, G.min.y + 0.15],
            ],
            `stroke="#e8e6df" stroke-width="5"`,
        ),
    );
    out.push(
        line(
            fr,
            [
                [H.max.x, G.max.y - 0.15],
                [G.max.x, G.max.y - 0.15],
            ],
            `stroke="#e8e6df" stroke-width="5"`,
        ),
    );
    return out.join("");
}

export function shipFloor(): string {
    const L = CARGO_SHIP_LAYOUT;
    const fr = floorFrameOf(L);
    const note = codeNote(
        fr,
        CARGO_SHIP_NOTE.x,
        CARGO_SHIP_NOTE.y,
        CARGO_SHIP_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
    );
    const plates = CARGO_SHIP_SWITCHES.map((sw) => {
        const dx = sw.ori === 1 ? 0.2 : -0.2;
        return switchPlate(fr, sw.x + dx, sw.y, SWITCH_PLATE_COLORS[sw.label]);
    });
    const d = { x: -2.5, y: -33 };
    const body =
        shipDeck(fr) +
        rooms(fr, L, CARGO_SHIP_FLOORS) +
        hazardBand(fr, d.x - 4, d.y + 0.5, d.x, d.y + 1.25, "ship-cabin-hazard") +
        plates.join("") +
        note +
        thresholds(fr, L, "#00000033") +
        walls(fr, { ...L, walls: L.walls.filter((s) => !hullWall(s)) }, "#d8d6cf", OUTLINE);
    return svg(fr, body);
}

/** An orange lifeboat on its davits: a capsule with a white canopy band. */
function lifeboat(fr: Frame, x: number, y0: number, y1: number): string {
    const w = 1.2;
    return (
        rect(fr, x - w, y0, x + w, y1, `fill="#f28c1e" stroke="${OUTLINE}" stroke-width="4" rx="${w * 28}"`) +
        rect(fr, x - w * 0.55, y0 + 1, x + w * 0.55, y1 - 1, `fill="#f4f4f0" stroke="#b8651a" stroke-width="2" rx="10"`)
    );
}

export function shipCeiling(): string {
    const fr = frameOf(CARGO_SHIP_LAYOUT);
    const funnel =
        rect(fr, -3, -41, 3, -35.5, `fill="#2f3438" stroke="${OUTLINE}" stroke-width="4" rx="20"`) +
        rect(fr, -2.4, -40.4, 2.4, -36.1, `fill="#2a6fb0" rx="14"`) +
        rect(fr, -1.6, -39.6, 1.6, -36.9, `fill="#1a1d20" rx="10"`);
    const mast =
        line(
            fr,
            [
                [-5, -31],
                [5, -31],
            ],
            `stroke="${OUTLINE}" stroke-width="6"`,
        ) +
        circleAt(fr, 0, -31, 0.8, `fill="#e8e6df" stroke="${OUTLINE}" stroke-width="4"`) +
        circleAt(fr, -5, -31, 0.35, `fill="#d8402f"`) +
        circleAt(fr, 5, -31, 0.35, `fill="#3f9b4b"`);
    // the wheelhouse windows along the front edge
    const windows = rect(fr, -9.5, -27.3, 9.5, -26.4, `fill="#2b4a5e" stroke="${OUTLINE}" stroke-width="3"`);
    const top =
        windows +
        funnel +
        mast +
        lifeboat(fr, -8.75, -40.5, -33.5) +
        lifeboat(fr, 8.75, -40.5, -33.5) +
        acUnit(fr, 4.5, -38.5);
    return roof(CARGO_SHIP_LAYOUT, "#e8e6df", "#c9c6bd", "#d6d3ca", top);
}
