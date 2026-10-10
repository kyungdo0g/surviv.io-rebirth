// Floor and roof art of the radar base's buildings (packages/defs rebirth/buildings/radar/): the dome tower's dark
// operators' floor with the turntable ring painted round the pedestal and a hazard ring at its foot, under the white
// radome (geodesic panels, a soft highlight, the red aviation light on its crown) on a dark concrete roof; the
// operations building's terrazzo lobby, blue tile operations room with the plotting grid, green briefing carpet and the
// crypto vault's steel floor (the duty code's coloured plates under the switches, the note on the briefing floor) under
// a slate roof with a satellite dish, an antenna rack and AC units; the barracks' plank dormitories, tiled common room
// and washroom under an olive roof with vents; the guard post's tiles under a white roof with a red band and an amber
// beacon; the generator shed's diamond plate under a corrugated steel roof with two exhaust stacks. Every building's
// walls are its layout's (svg.ts floor()), so every drawn wall collides.
import {
    type MilitaryPart,
    RADAR_BARRACKS,
    RADAR_CODE,
    RADAR_DOME,
    RADAR_DOME_RADIUS,
    RADAR_GENERATOR,
    RADAR_GUARD,
    RADAR_NOTE,
    RADAR_OPS,
    RADAR_SWITCHES,
} from "../../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
    codeNote,
    type FloorPalette,
    type Frame,
    floor,
    floorFrameOf,
    frameOf,
    hazardBand,
    polygon,
    px,
    py,
    rect,
    roof,
    SWITCH_PLATE_COLORS,
    switchPlate,
} from "../svg.ts";

/** A floor style without a grid: the grid in the base colour. */
const plain = (base: string) => ({ base, grid: base, step: 64 });

export const RADAR_FLOORS: FloorPalette = {
    dome: { base: "#4a5560", grid: "#424c56", step: 2 },
    ops_lobby: { base: "#cbc6bb", grid: "#b9b4a8", step: 2 },
    ops_room: { base: "#5d7085", grid: "#536579", step: 1 },
    ops_briefing: plain("#55704f"),
    ops_vault: { base: "#737a80", grid: "#646b71", step: 1 },
    dorm: plain("#9b7a52"),
    common: { base: "#b9b3a2", grid: "#a8a291", step: 2 },
    washroom: { base: "#d9dcd8", grid: "#c2c6c2", step: 1 },
    guard: { base: "#bfc3c4", grid: "#acb1b2", step: 1 },
    generator: { base: "#7b8287", grid: "#6c7378", step: 1 },
};

const INK = "#1f2326";
const CONCRETE = "#6a6e6a";
const STEEL = "#6b767e";
const WHITE = "#f1f2ec";
const RED = "#c8312e";

/** A point given in the compound frame, in the part's frame. */
function local(part: MilitaryPart, x: number, y: number): readonly [number, number] {
    const at = part.placements[0].pos;
    return [x - at.x, y - at.y];
}

/** Planks along x, `w` wide, with staggered butt joints (deterministic), one path. */
function planks(fr: Frame, x0: number, y0: number, x1: number, y1: number, w: number, line: string): string {
    const stagger = [0, 0.55, 0.2, 0.8, 0.4];
    const d: string[] = [];
    for (let y = y0, row = 0; y < y1 - 1e-6; y += w, row++) {
        if (y > y0) d.push(`M${px(fr, x0)} ${py(fr, y)}H${px(fr, x1)}`);
        for (let x = x0 + 3 * stagger[row % 5]; x < x1 - 0.3; x += 3) {
            if (x > x0 + 0.3) d.push(`M${px(fr, x)} ${py(fr, y)}V${py(fr, Math.min(y + w, y1))}`);
        }
    }
    return `<path d="${d.join("")}" stroke="${line}" stroke-width="2" fill="none"/>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// dome tower

function domeFloor(): string {
    const L = RADAR_DOME.layout;
    const fr = floorFrameOf(L);
    const extra =
        // the turntable ring and its tick marks round the pedestal, the hazard ring at its foot, the steel mount
        circleAt(fr, 0, 0, 7.2, `fill="none" stroke="#6d7a86" stroke-width="10"`) +
        circleAt(fr, 0, 0, 7.2, `fill="none" stroke="#2f363d" stroke-width="2" stroke-dasharray="6 18"`) +
        circleAt(fr, 0, 0, 3.4, `fill="#3b434b" stroke="#2a3036" stroke-width="3"`) +
        hazardRing(fr, 2.6) +
        rect(fr, -1, -1, 1, 1, `fill="${STEEL}" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, 0, 0, 0.55, `fill="#9aa4ac" stroke="${INK}" stroke-width="2"`) +
        // the operators' strip along the north wall: an anti-static mat under the consoles
        rect(fr, -10.5, 7.3, 10.5, 10.5, `fill="#3d4650"`);
    return floor(L, RADAR_FLOORS, CONCRETE, INK, extra);
}

/** A yellow and black ring of radius `r` (0.5 wide) round the frame's origin. */
function hazardRing(fr: Frame, r: number): string {
    const out: string[] = [circleAt(fr, 0, 0, r, `fill="none" stroke="#26282a" stroke-width="16"`)];
    out.push(
        circleAt(
            fr,
            0,
            0,
            r,
            `fill="none" stroke="#e2b425" stroke-width="16" stroke-dasharray="${(r * 32 * Math.PI) / 12} ${(r * 32 * Math.PI) / 12}"`,
        ),
    );
    return out.join("");
}

function domeCeiling(): string {
    const L = RADAR_DOME.layout;
    const fr = frameOf(L);
    const R = RADAR_DOME_RADIUS;
    const panels: string[] = [];
    // geodesic panels: two rings of facets (12 and 6 sides) joined by spokes
    const ring = (r: number, n: number, rot: number) =>
        Array.from({ length: n }, (_, i) => {
            const a = rot + (i * 2 * Math.PI) / n;
            return [Math.cos(a) * r, Math.sin(a) * r] as const;
        });
    const outer = ring(R * 0.97, 12, 0);
    const mid = ring(R * 0.62, 12, Math.PI / 12);
    const inner = ring(R * 0.3, 6, 0);
    const seg = (a: readonly [number, number], b: readonly [number, number]) =>
        `M${px(fr, a[0])} ${py(fr, a[1])}L${px(fr, b[0])} ${py(fr, b[1])}`;
    for (let i = 0; i < 12; i++) {
        panels.push(seg(mid[i], mid[(i + 1) % 12]), seg(mid[i], outer[i]), seg(mid[i], outer[(i + 1) % 12]));
        panels.push(seg(mid[i], inner[Math.floor(i / 2)]));
    }
    for (let i = 0; i < 6; i++) panels.push(seg(inner[i], inner[(i + 1) % 6]));
    const highlight =
        `<defs><radialGradient id="radome-shade" cx="0.38" cy="0.34" r="0.7">` +
        `<stop offset="0" stop-color="#ffffff"/><stop offset="0.65" stop-color="${WHITE}"/>` +
        `<stop offset="1" stop-color="#c9ccc6"/></radialGradient></defs>`;
    const top =
        highlight +
        // vents in the four roof corners outside the radome
        [
            [-9.6, -9.6],
            [9.6, -9.6],
            [-9.6, 9.6],
            [9.6, 9.6],
        ]
            .map(([x, y]) => circleAt(fr, x, y, 0.6, `fill="#3a3f43" stroke="${INK}" stroke-width="3"`))
            .join("") +
        circleAt(fr, 0, 0, R, `fill="url(#radome-shade)" stroke="${INK}" stroke-width="5"`) +
        `<path d="${panels.join("")}" stroke="#b9bdb6" stroke-width="2.5" fill="none"/>` +
        circleAt(fr, 0, 0, 1.1, `fill="${WHITE}" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, 0, 0, 0.7, `fill="#ff3b30"`);
    return roof(L, "#555b60", "#43484d", "#4d5358", top);
}

// ---------------------------------------------------------------------------------------------------------------------
// operations building

function opsFloor(): string {
    const part = RADAR_OPS;
    const L = part.layout;
    const fr = floorFrameOf(L);
    const plates = RADAR_SWITCHES.map((sw) => {
        const [x, y] = local(part, sw.x, sw.y);
        return switchPlate(fr, x, y, SWITCH_PLATE_COLORS[sw.label]);
    });
    const [nx, ny] = local(part, RADAR_NOTE.x, RADAR_NOTE.y);
    const note = codeNote(
        fr,
        nx,
        ny,
        RADAR_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
    );
    // the vault door's hazard strip on the operations room side (x 31.5..32, y 20..24 in the compound frame)
    const [hx0, hy0] = local(part, 30.75, 20);
    const [hx1, hy1] = local(part, 31.5, 24);
    // the plotting grid on the operations room floor round the table, a yellow keyline in the vault
    const [gx0, gy0] = local(part, 18, 10.5);
    const [gx1, gy1] = local(part, 30, 19.5);
    const [vx0, vy0] = local(part, 32.85, 17.85);
    const [vx1, vy1] = local(part, 44.15, 27.15);
    const [mx0, my0] = local(part, 26.5, -1.5);
    const [mx1, my1] = local(part, 33.5, 0.2);
    const extra =
        rect(fr, gx0, gy0, gx1, gy1, `fill="none" stroke="#8fb0cf" stroke-width="3" stroke-dasharray="10 6"`) +
        rect(fr, vx0, vy0, vx1, vy1, `fill="none" stroke="#c9a227" stroke-width="4"`) +
        // the entry mat inside the main door
        rect(fr, mx0 + 1.5, my0, mx1 - 1.5, my1, `fill="#6f6858" stroke="#5a5447" stroke-width="3"`) +
        hazardBand(fr, hx0, hy0, hx1, hy1, "radar-vault-strip") +
        plates.join("") +
        note;
    return floor(L, RADAR_FLOORS, CONCRETE, INK, extra);
}

/** A satellite dish seen from above: the bowl, its rim, the feed arm and the feed. */
function dish(fr: Frame, x: number, y: number, r: number): string {
    return (
        circleAt(fr, x, y, r + 0.35, `fill="#596168" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y, r, `fill="#e6e8e2" stroke="#9aa0a0" stroke-width="3"`) +
        circleAt(fr, x, y, r * 0.55, `fill="none" stroke="#c6cac4" stroke-width="2"`) +
        `<path d="M${px(fr, x - r * 0.7)} ${py(fr, y - r * 0.7)}L${px(fr, x)} ${py(fr, y)}" stroke="${INK}" stroke-width="3"/>` +
        circleAt(fr, x, y, 0.35, `fill="#3a3f43"`)
    );
}

function opsCeiling(): string {
    const part = RADAR_OPS;
    const L = part.layout;
    const fr = frameOf(L);
    // an antenna rack: a steel frame with four whips, over the operations room
    const [ax, ay] = local(part, 23, 21);
    const rack =
        rect(fr, ax - 3.5, ay - 0.6, ax + 3.5, ay + 0.6, `fill="#4a5056" stroke="${INK}" stroke-width="3"`) +
        [-2.6, -0.9, 0.9, 2.6]
            .map((dx) => circleAt(fr, ax + dx, ay, 0.35, `fill="#c9ccc6" stroke="${INK}" stroke-width="2"`))
            .join("");
    const [dx, dy] = local(part, 38.5, 22);
    const [c1x, c1y] = local(part, 21, 2);
    const [c2x, c2y] = local(part, 40, 2);
    const [c3x, c3y] = local(part, 26, 10);
    const top = rack + dish(fr, dx, dy, 3.2) + acUnit(fr, c1x, c1y) + acUnit(fr, c2x, c2y) + acUnit(fr, c3x, c3y);
    return roof(L, "#56626a", "#434d54", "#4e5961", top);
}

// ---------------------------------------------------------------------------------------------------------------------
// barracks

function barracksFloor(): string {
    const part = RADAR_BARRACKS;
    const L = part.layout;
    const fr = floorFrameOf(L);
    const dorms = L.rooms.filter((r) => r.floor === "dorm");
    const wood = dorms.map((r) => planks(fr, r.min.x, r.min.y, r.max.x, r.max.y, 0.75, "#83653f")).join("");
    // a dark green runner down the common room
    const [rx0, ry0] = local(part, -28.5, -16.5);
    const [rx1, ry1] = local(part, -23.5, -1.5);
    const runner = rect(fr, rx0, ry0, rx1, ry1, `fill="#4f6247" stroke="#3f4f39" stroke-width="4"`);
    return floor(L, RADAR_FLOORS, CONCRETE, INK, wood + runner);
}

function barracksCeiling(): string {
    const part = RADAR_BARRACKS;
    const L = part.layout;
    const fr = frameOf(L);
    const vents = [
        [-38.5, -6],
        [-38.5, -19],
        [-26, -9],
    ]
        .map(([x, y]) => {
            const [lx, ly] = local(part, x, y);
            return (
                rect(fr, lx - 1.2, ly - 0.8, lx + 1.2, ly + 0.8, `fill="#4b4f3c" stroke="${INK}" stroke-width="3"`) +
                `<path d="M${px(fr, lx - 0.8)} ${py(fr, ly)}H${px(fr, lx + 0.8)}" stroke="#2c2f24" stroke-width="3"/>`
            );
        })
        .join("");
    const [ux, uy] = local(part, -26, -22);
    return roof(L, "#6f7558", "#585d45", "#646a4f", vents + acUnit(fr, ux, uy));
}

// ---------------------------------------------------------------------------------------------------------------------
// guard post and generator shed

function guardFloor(): string {
    return floor(RADAR_GUARD.layout, RADAR_FLOORS, CONCRETE, INK);
}

function guardCeiling(): string {
    const L = RADAR_GUARD.layout;
    const fr = frameOf(L);
    const { min, max } = L.bounds;
    const top =
        rect(fr, min.x + 0.5, min.y + 0.5, max.x - 0.5, min.y + 1.6, `fill="${RED}"`) +
        circleAt(fr, 0, 0.6, 0.8, `fill="#e8a317" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, 0, 0.6, 0.4, `fill="#ffd34d"`);
    return roof(L, WHITE, "#c9cbc5", "#dcdeda", top);
}

function generatorFloor(): string {
    const L = RADAR_GENERATOR.layout;
    const fr = floorFrameOf(L);
    // diamond plate: short diagonal ticks on a 1-unit grid
    const d: string[] = [];
    for (let x = L.bounds.min.x + 0.75; x < L.bounds.max.x; x += 1) {
        for (let y = L.bounds.min.y + 0.75; y < L.bounds.max.y; y += 1) {
            d.push(`M${px(fr, x - 0.2)} ${py(fr, y - 0.2)}L${px(fr, x + 0.2)} ${py(fr, y + 0.2)}`);
        }
    }
    const plate = `<path d="${d.join("")}" stroke="#8d949a" stroke-width="2"/>`;
    return floor(L, RADAR_FLOORS, { metal: "#5f6a72" }, INK, plate);
}

function generatorCeiling(): string {
    const part = RADAR_GENERATOR;
    const L = part.layout;
    const fr = frameOf(L);
    const { min, max } = L.bounds;
    const ribs: string[] = [];
    for (let x = min.x + 1; x < max.x - 0.5; x += 1) ribs.push(`M${px(fr, x)} ${py(fr, max.y)}V${py(fr, min.y)}`);
    const stack = (x: number, y: number) => {
        const [lx, ly] = local(part, x, y);
        return (
            circleAt(fr, lx, ly, 0.8, `fill="#2a2f35" stroke="${INK}" stroke-width="3"`) +
            circleAt(fr, lx, ly, 0.45, `fill="none" stroke="#5b6673" stroke-width="2"`)
        );
    };
    const soot = polygon(
        fr,
        [
            [local(part, 26, -32)[0], local(part, 26, -32)[1]],
            [local(part, 30, -31)[0], local(part, 30, -31)[1]],
            [local(part, 29, -33.5)[0], local(part, 29, -33.5)[1]],
        ],
        `fill="#00000022"`,
    );
    const top =
        `<path d="${ribs.join("")}" stroke="#7c868d" stroke-width="3" fill="none"/>` +
        soot +
        stack(26.5, -32) +
        stack(29, -32);
    return roof(L, "#8c969c", "#6f797f", "#808a90", top);
}

/** The radar base's buildings' images by sprite id. */
export const RADAR_BUILDING_ART: Readonly<Record<string, () => string>> = {
    "map-building-radar-dome-floor-01.img": domeFloor,
    "map-building-radar-dome-ceiling-01.img": domeCeiling,
    "map-building-radar-ops-floor-01.img": opsFloor,
    "map-building-radar-ops-ceiling-01.img": opsCeiling,
    "map-building-radar-barracks-floor-01.img": barracksFloor,
    "map-building-radar-barracks-ceiling-01.img": barracksCeiling,
    "map-building-radar-guard-floor-01.img": guardFloor,
    "map-building-radar-guard-ceiling-01.img": guardCeiling,
    "map-building-radar-generator-floor-01.img": generatorFloor,
    "map-building-radar-generator-ceiling-01.img": generatorCeiling,
};
