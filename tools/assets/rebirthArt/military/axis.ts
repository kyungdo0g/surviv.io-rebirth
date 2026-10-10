// Floor and roof art of the military base's axis and guard posts (packages/defs rebirth/buildings/military/hq.ts,
// guard.ts): the HQ's terrazzo hall round the S1 stairwell (grey treads darkening toward its bottom end) between a
// blue-grey comms room, the commander's red carpet, the green briefing carpet and the planked records room, in brick
// walls; its grey-brown roof with two AC units, an aerial and the emblem disc (main: a gold star on dark olive; red /
// blue: a white star on the faction's disc with a white keyline, and the faction's band along the front parapet, never
// a whole coloured roof). The reviewing stand's planked stage with its front rails and the dark green canopy with a
// white scalloped front and three flags. The gatehouse's tiled guard room and white roof with red and white checkpoint
// stripes and an amber beacon. The watchtower's concrete floor, each loophole a sill with a firing step inside it, and
// its roof ringed with sandbags (slots over the loopholes) round a searchlight.
import {
    MILITARY_GATEHOUSE,
    MILITARY_HQ,
    MILITARY_HQ_EMBLEM,
    MILITARY_STAND,
    MILITARY_TOWER,
    REBIRTH_ART_PX_PER_UNIT as PX,
    type RebirthBuildingLayout,
    type Room,
} from "../../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
    type FloorPalette,
    type Frame,
    f2,
    floor,
    frameOf,
    hazardBand,
    hex,
    polygon,
    px,
    py,
    rect,
    roof,
    star,
} from "../svg.ts";
import type { MilitaryArtContext, MilitaryDrawer } from "./index.ts";

/** A floor style without a grid (carpet, or planks and treads drawn apart): the grid in the base colour. */
const plain = (base: string) => ({ base, grid: base, step: 64 });

export const AXIS_FLOORS: FloorPalette = {
    hq_hall: { base: "#c9c2b0", grid: "#b7af9c", step: 2 },
    hq_comms: { base: "#9fb0b8", grid: "#8d9ea7", step: 1 },
    hq_office: plain("#7a3f3a"),
    hq_briefing: plain("#5f7a5a"),
    hq_records: plain("#b08a5a"),
    stairs_down_s: plain("#8e908a"),
    stage: plain("#a07848"),
    guard: { base: "#c0c4c6", grid: "#adb2b5", step: 1 },
    // the gatehouse's weapons cage: steel plate
    cage: { base: "#8f979c", grid: "#7c8489", step: 1 },
    tower: { base: "#9a9c96", grid: "#8b8d87", step: 2 },
};

const INK = "#1f2326";
const WHITE = "#f4f4f0";
/** Wall fills per material (svg.ts walls(), dark outline): the HQ, stand and gatehouse brick, the towers concrete. */
const BRICK = "#8e5444";
const BRICK_INK = "#241a17";
const CONCRETE = "#666963";

/** The colour a fraction `t` of the way from `a` to `b` (#rrggbb). */
function mix(a: string, b: string, t: number): string {
    const ch = (c: string, i: number) => Number.parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
    const [r, g, bl] = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
    return hex((r << 16) | (g << 8) | bl);
}

/** The room of a layout with that floor style. */
function roomOf(layout: RebirthBuildingLayout, style: string): Room {
    const r = layout.rooms.find((q) => q.floor === style);
    if (!r) throw new Error(`military axis art: no "${style}" room`);
    return r;
}

/** A box ring drawn as a stroke (a carpet border, an inlay) inset `inset` from the room's walls' inner faces. */
function border(fr: Frame, r: Room, inset: number, color: string, width: number): string {
    const d = 0.5 + inset;
    return rect(
        fr,
        r.min.x + d,
        r.min.y + d,
        r.max.x - d,
        r.max.y - d,
        `fill="none" stroke="${color}" stroke-width="${width}"`,
    );
}

/**
 * Planks along x across the box, `w` wide, butt joints every `len` shifted by an uneven fraction of a plank on each
 * of five rows in turn (a fixed pattern, deterministic; a regular half-bond reads as brickwork), in one path of `line`.
 */
function planks(
    fr: Frame,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w: number,
    len: number,
    line: string,
): string {
    const stagger = [0, 0.55, 0.2, 0.8, 0.4];
    const d: string[] = [];
    for (let y = y0, row = 0; y < y1 - 1e-6; y += w, row++) {
        if (y > y0) d.push(`M${px(fr, x0)} ${py(fr, y)}H${px(fr, x1)}`);
        for (let x = x0 + len * stagger[row % 5]; x < x1 - 0.3; x += len) {
            if (x > x0 + 0.3) d.push(`M${px(fr, x)} ${py(fr, y)}V${py(fr, Math.min(y + w, y1))}`);
        }
    }
    return `<path d="${d.join("")}" stroke="${line}" stroke-width="2" fill="none"/>`;
}

/** A five-pointed star of outer radius `r` with a `w` px outline (svg.ts star() has a 3 px one, heavy on a flag). */
function smallStar(fr: Frame, x: number, y: number, r: number, fill: string, w: number): string {
    const pts = Array.from({ length: 10 }, (_, i) => {
        const a = Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.42;
        return [x + Math.cos(a) * rr, y + Math.sin(a) * rr] as const;
    });
    return polygon(fr, pts, `fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`);
}

// ---------------------------------------------------------------------------------------------------------------------
// HQ

const HQ = MILITARY_HQ.layout;
const HQ_AT = MILITARY_HQ.placements[0].pos;
/** The emblem disc in the HQ's frame (MILITARY_HQ_EMBLEM is in the compound frame). */
const EMBLEM = { x: MILITARY_HQ_EMBLEM.x - HQ_AT.x, y: MILITARY_HQ_EMBLEM.y - HQ_AT.y, r: MILITARY_HQ_EMBLEM.r };

/**
 * The S1 stairs (going down south: MILITARY_STAIRS): treads every 0.5 from the top (north) end, each a shade darker
 * than the one above it, with a dark nosing shadow along its lower (south) edge and a yellow safety edge across the top
 * step.
 */
function stairTreads(fr: Frame, r: Room): string {
    const n = Math.round((r.max.y - r.min.y) / 0.5);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        const top = r.max.y - i * 0.5;
        out.push(rect(fr, r.min.x, top - 0.5, r.max.x, top, `fill="${mix("#b1b3ac", "#4e504c", i / (n - 1))}"`));
        out.push(rect(fr, r.min.x, top - 0.5, r.max.x, top - 0.42, `fill="#00000059"`));
    }
    out.push(rect(fr, r.min.x, r.max.y - 0.16, r.max.x, r.max.y, `fill="#d6a425"`));
    return out.join("");
}

function hqFloor(): string {
    const fr = frameOf(HQ);
    const hall = roomOf(HQ, "hq_hall");
    const records = roomOf(HQ, "hq_records");
    const extra =
        // the hall: a darker inlay band round the terrazzo, an entry mat inside the main door (gap x -2..2)
        border(fr, hall, 0.6, "#ada48f", 5) +
        rect(fr, -1.75, hall.min.y + 0.5, 1.75, hall.min.y + 1.6, `fill="#6f6858" stroke="#5a5447" stroke-width="3"`) +
        // the commander's office and the briefing room: carpet borders a shade darker
        border(fr, roomOf(HQ, "hq_office"), 0.6, "#5f2f2b", 6) +
        border(fr, roomOf(HQ, "hq_briefing"), 0.6, "#4b6347", 6) +
        // records: planks along x from the walls' inner faces
        planks(
            fr,
            records.min.x + 0.5,
            records.min.y + 0.5,
            records.max.x - 0.5,
            records.max.y - 0.5,
            0.5,
            4,
            "#93714a",
        ) +
        stairTreads(fr, roomOf(HQ, "stairs_down_s"));
    return floor(HQ, AXIS_FLOORS, BRICK, BRICK_INK, extra);
}

/** A whip aerial on the roof: a dark base plate with the mast's foot, its guy lines, a lean line for the whip. */
function aerial(fr: Frame, x: number, y: number): string {
    const guys = [
        [-1, -1],
        [1, -1],
        [0, 1.3],
    ]
        .map(([dx, dy]) => `M${px(fr, x)} ${py(fr, y)}L${px(fr, x + dx)} ${py(fr, y + dy)}`)
        .join("");
    return (
        `<path d="${guys}" stroke="#3f4448" stroke-width="2"/>` +
        circleAt(fr, x, y, 0.55, `fill="#5a5d56" stroke="${INK}" stroke-width="3"`) +
        `<path d="M${px(fr, x)} ${py(fr, y)}L${px(fr, x + 1.6)} ${py(fr, y + 1.1)}" stroke="${INK}" stroke-width="4"/>`
    );
}

function hqCeiling({ base }: MilitaryArtContext): string {
    const fr = frameOf(HQ);
    const { min, max } = HQ.bounds;
    const disc = hex(base.emblem);
    const faction = base.side !== "";
    // the band just inside the front (south) parapet: roof() starts the roof's base 1 unit in from the image edge
    const band = faction
        ? rect(
              fr,
              min.x + 0.5,
              min.y + 0.5,
              max.x - 0.5,
              min.y + 1.7,
              `fill="${disc}" stroke="${INK}" stroke-width="3"`,
          )
        : "";
    const keyline = faction
        ? circleAt(fr, EMBLEM.x, EMBLEM.y, EMBLEM.r - 0.42, `fill="none" stroke="${WHITE}" stroke-width="6"`)
        : "";
    const top =
        band +
        // AC units mid-panel between roof()'s seams (x = 4k) over the office and briefing room, the aerial over comms
        acUnit(fr, -10, 4.5) +
        acUnit(fr, 10, -3.5) +
        aerial(fr, -10.5, -4) +
        circleAt(fr, 6, 6.5, 0.6, `fill="#7d7a6e" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, -6, -6, 0.6, `fill="#7d7a6e" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, EMBLEM.x, EMBLEM.y, EMBLEM.r, `fill="${disc}" stroke="${INK}" stroke-width="4"`) +
        keyline +
        star(fr, EMBLEM.x, EMBLEM.y, faction ? 2.85 : 3, hex(base.star));
    return roof(HQ, "#6e6a5c", "#8a8676", "#646052", top);
}

// ---------------------------------------------------------------------------------------------------------------------
// reviewing stand

const STAND = MILITARY_STAND.layout;
/** The front rails either side of the axis gap (low steel walls with no sprite of their own: drawn here). */
const RAILS = MILITARY_STAND.props.filter((q) => q.wallLike);

function standFloor(): string {
    const fr = frameOf(STAND);
    const { min, max } = STAND.bounds;
    const out: string[] = [];
    // the stage's fascia in the half unit outside the floor box at the front and back: a darker wood edge
    out.push(rect(fr, min.x, min.y - 0.5, max.x, min.y, `fill="#7a5a34"`));
    out.push(rect(fr, min.x, max.y, max.x, max.y + 0.5, `fill="#7a5a34"`));
    out.push(planks(fr, min.x + 0.5, min.y, max.x - 0.5, max.y, 0.625, 4.5, "#8a6538"));
    const edges = [min.y, max.y].map((y) => `M${px(fr, min.x)} ${py(fr, y)}H${px(fr, max.x)}`).join("");
    out.push(`<path d="${edges}" stroke="#5e4427" stroke-width="3"/>`);
    // the rails: a 1-deep steel rail (metal_wall_ext_short_6 turned ori 1) with posts every 1.5 along it
    for (const r of RAILS) {
        out.push(rect(fr, r.x - 3, r.y - 0.5, r.x + 3, r.y + 0.5, `fill="${INK}"`, 3));
        out.push(rect(fr, r.x - 3, r.y - 0.5, r.x + 3, r.y + 0.5, `fill="#7c868c"`));
        out.push(rect(fr, r.x - 3, r.y - 0.12, r.x + 3, r.y + 0.12, `fill="#5d666c"`));
        for (let x = r.x - 2.25; x < r.x + 3; x += 1.5) {
            out.push(
                rect(fr, x - 0.2, r.y - 0.3, x + 0.2, r.y + 0.3, `fill="#4a5257" stroke="${INK}" stroke-width="2"`),
            );
        }
    }
    return floor(STAND, AXIS_FLOORS, BRICK, BRICK_INK, out.join(""));
}

/**
 * The canopy's white valance across the front (south) edge from x0 to x1: a band from yTop down to the hem, `n`
 * scallops below it reaching the image's dark rim.
 */
function valance(fr: Frame, x0: number, x1: number, yTop: number, yLow: number, n: number): string {
    const w = (x1 - x0) / n;
    const depth = 0.42;
    const hem = yLow + depth;
    let d = `M${px(fr, x0)} ${py(fr, yTop)}H${px(fr, x1)}V${py(fr, hem)}`;
    // right to left with the sweep flag set: each arc bows down (south)
    for (let i = n - 1; i >= 0; i--)
        d += `A${f2((w / 2) * PX)} ${f2(depth * PX)} 0 0 1 ${px(fr, x0 + i * w)} ${py(fr, hem)}`;
    return `<path d="${d}Z" fill="${WHITE}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
}

/** A flag `w` x `h` flying east from its pole at x, its lower edge on y: the pole with a gold finial, the star. */
function flag(fr: Frame, x: number, y: number, w: number, h: number, fill: string, starFill: string): string {
    return (
        rect(fr, x - 0.09, y - 0.45, x + 0.09, y + h + 0.2, `fill="${INK}"`) +
        rect(fr, x, y, x + w, y + h, `fill="${fill}" stroke="${INK}" stroke-width="3"`) +
        smallStar(fr, x + w / 2, y + h / 2, h * 0.34, starFill, 2) +
        circleAt(fr, x, y + h + 0.2, 0.2, `fill="#e0b030" stroke="${INK}" stroke-width="2"`)
    );
}

function standCeiling({ base }: MilitaryArtContext): string {
    const fr = frameOf(STAND);
    const { min, max } = STAND.bounds;
    // the canvas's panel seams every 3 (roof()'s 4-unit seams would land on the west parapet's edge: drawn here)
    const seams = [-6, -3, 0, 3, 6].map((x) => `M${px(fr, x)} ${py(fr, max.y - 0.5)}V${py(fr, min.y + 0.5)}`).join("");
    const rim = 4 / PX;
    const yFront = min.y - 0.5 + rim;
    // main: olive flags with a gold star; red / blue: the faction's colour with a white star (MILITARY_BASES' colours)
    const fill = base.side ? hex(base.emblem) : "#5b6b3a";
    const starFill = hex(base.star);
    const yFlag = yFront + 1.15;
    const top =
        `<path d="${seams}" stroke="#36502f" stroke-width="3" fill="none"/>` +
        valance(fr, min.x - 0.5 + rim, max.x + 0.5 - rim, yFront + 0.95, yFront, 16) +
        flag(fr, -6.6, yFlag, 2.3, 1.5, fill, starFill) +
        flag(fr, 4.3, yFlag, 2.3, 1.5, fill, starFill) +
        flag(fr, -1.6, yFlag, 3.2, 2.1, fill, starFill);
    return roof(STAND, "#3d5a36", "#30482b", "#3d5a36", top);
}

// ---------------------------------------------------------------------------------------------------------------------
// gatehouse

const GATEHOUSE = MILITARY_GATEHOUSE.layout;

function gatehouseFloor(): string {
    const fr = frameOf(GATEHOUSE);
    // a rubber mat inside the yard door (house_door_01's gap: 4 east of its hinge)
    const door = GATEHOUSE.openings.find((o) => o.type === "house_door_01");
    const mat = door
        ? rect(
              fr,
              door.pos.x + 0.35,
              door.pos.y - 1.85,
              door.pos.x + 3.65,
              door.pos.y - 0.75,
              `fill="#5d6366" stroke="#484d50" stroke-width="3"`,
          )
        : "";
    return floor(GATEHOUSE, AXIS_FLOORS, BRICK, BRICK_INK, mat);
}

/** The amber beacon on a grey plinth: the lens, a paler core and a highlight. */
function beacon(fr: Frame, x: number, y: number): string {
    return (
        rect(fr, x - 1.25, y - 1.25, x + 1.25, y + 1.25, `fill="#b9b9b1" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y, 0.95, `fill="#f0b030" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y, 0.45, `fill="#f8d77a"`) +
        circleAt(fr, x - 0.3, y + 0.3, 0.16, `fill="#fff6d6"`)
    );
}

function gatehouseCeiling(): string {
    const fr = frameOf(GATEHOUSE);
    const { min, max } = GATEHOUSE.bounds;
    const rim = 4 / PX;
    const x0 = min.x - 0.5 + rim;
    const x1 = max.x + 0.5 - rim;
    // red and white checkpoint stripes over the north parapet, a little deeper than it (the minimap's red strip)
    const y0 = max.y - 0.7;
    const y1 = max.y + 0.5 - rim;
    // roof()'s seams fall on x = -4 (the west parapet's edge): seams drawn here, symmetric
    const seams = [-2, 2].map((x) => `M${px(fr, x)} ${py(fr, y0)}V${py(fr, min.y + 0.5)}`).join("");
    const top =
        `<path d="${seams}" stroke="#d2d2ca" stroke-width="3" fill="none"/>` +
        hazardBand(fr, x0, y0, x1, y1, "gatehouse-checkpoint", ["#c8312e", WHITE], 0.5) +
        `<path d="M${px(fr, x0)} ${py(fr, y0)}H${px(fr, x1)}" stroke="${INK}" stroke-width="3"/>` +
        beacon(fr, -1.6, -0.6) +
        circleAt(fr, 2.6, -1.9, 0.55, `fill="#a3a49c" stroke="${INK}" stroke-width="3"`);
    return roof(GATEHOUSE, "#e6e6e0", "#c4c4bc", "#e6e6e0", top);
}

// ---------------------------------------------------------------------------------------------------------------------
// watchtower

const TOWER = MILITARY_TOWER.layout;
const LOOPHOLE = "brick_wall_ext_3_0_low";
/** Half the loophole gap (3 long) and the firing step's depth inside the wall face (as blockhouse.ts draws them). */
const SLIT_HALF = 1.5;
const STEP_DEPTH = 0.75;

/** The loophole openings with their inward unit normal (the wall face points at the tower's centre). */
function loopholes(): { x: number; y: number; horizontal: boolean; nx: number; ny: number }[] {
    return TOWER.openings
        .filter((o) => o.type === LOOPHOLE)
        .map(({ pos: { x, y }, ori }) => {
            // brick_wall_ext_3_0_low: ori 1 lies along x (the south wall), ori 0 along y (west and east)
            const horizontal = (ori & 1) === 1;
            return { x, y, horizontal, nx: horizontal ? 0 : -Math.sign(x), ny: horizontal ? -Math.sign(y) : 0 };
        });
}

/** The darker firing step just inside each loophole, its room-side edge a darker line so it reads as a ledge. */
function firingSteps(fr: Frame): string {
    return loopholes()
        .map(({ x, y, horizontal, nx, ny }) => {
            const fx = x + nx * 0.5;
            const fy = y + ny * 0.5;
            const ex = fx + nx * STEP_DEPTH;
            const ey = fy + ny * STEP_DEPTH;
            const e = 0.075;
            const [box, edge] = horizontal
                ? [
                      [x - SLIT_HALF, fy, x + SLIT_HALF, ey],
                      [x - SLIT_HALF, ey - e, x + SLIT_HALF, ey + e],
                  ]
                : [
                      [fx, y - SLIT_HALF, ex, y + SLIT_HALF],
                      [ex - e, y - SLIT_HALF, ex + e, y + SLIT_HALF],
                  ];
            return (
                rect(fr, box[0], box[1], box[2], box[3], `fill="#7a7c76"`) +
                rect(fr, edge[0], edge[1], edge[2], edge[3], `fill="#5a5c57"`)
            );
        })
        .join("");
}

function towerFloor(): string {
    return floor(TOWER, AXIS_FLOORS, CONCRETE, INK, firingSteps(frameOf(TOWER)));
}

/**
 * The sandbag rim centred on the walls' line, 0.9 deep: full rows on the north and south, the west and east rows
 * between them; a dark slot 1 long over each loophole (the bags part round it), alternate bags a shade darker.
 */
function sandbags(fr: Frame): string {
    const { max } = TOWER.bounds;
    const o = max.x + 0.5 - 4 / PX;
    const i = o - 0.9;
    const slots = loopholes();
    const out: string[] = [];
    let k = 0;
    const bag = (x0: number, y0: number, x1: number, y1: number) =>
        out.push(
            rect(
                fr,
                x0,
                y0,
                x1,
                y1,
                `rx="9" fill="${k++ % 2 ? "#a99b70" : "#bcae82"}" stroke="${INK}" stroke-width="3"`,
            ),
        );
    // one side's row along `a0..a1` at the cross-axis band c0..c1, `along` x for the north and south rows
    const row = (along: boolean, a0: number, a1: number, c0: number, c1: number, slot: boolean) => {
        const spans = slot
            ? [
                  [a0, -0.5],
                  [0.5, a1],
              ]
            : [[a0, a1]];
        for (const [s, e] of spans) {
            const n = Math.max(1, Math.round((e - s) / 1.45));
            const len = (e - s) / n;
            for (let j = 0; j < n; j++) {
                const p0 = s + j * len + 0.03;
                const p1 = s + (j + 1) * len - 0.03;
                if (along) bag(p0, c0, p1, c1);
                else bag(c0, p0, c1, p1);
            }
        }
        if (slot)
            out.push(
                along
                    ? rect(fr, -0.5, c0 + 0.1, 0.5, c1 - 0.1, `fill="${INK}"`)
                    : rect(fr, c0 + 0.1, -0.5, c1 - 0.1, 0.5, `fill="${INK}"`),
            );
    };
    const has = (pred: (s: (typeof slots)[number]) => boolean) => slots.some(pred);
    row(
        true,
        -o,
        o,
        -o,
        -i,
        has((s) => s.horizontal && s.y < 0),
    );
    row(
        true,
        -o,
        o,
        i,
        o,
        has((s) => s.horizontal && s.y > 0),
    );
    row(
        false,
        -i,
        i,
        -o,
        -i,
        has((s) => !s.horizontal && s.x < 0),
    );
    row(
        false,
        -i,
        i,
        i,
        o,
        has((s) => !s.horizontal && s.x > 0),
    );
    return out.join("");
}

/** The searchlight: a dark housing on a yoke, the pale lens and its paler centre. */
function searchlight(fr: Frame, x: number, y: number): string {
    return (
        rect(fr, x - 2.05, y - 0.35, x + 2.05, y + 0.35, `fill="#5a5d56" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y, 1.65, `fill="#3f4448" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y, 1.25, `fill="#efe6b0" stroke="${INK}" stroke-width="2"`) +
        circleAt(fr, x, y, 0.55, `fill="#fffbe6"`)
    );
}

function towerCeiling(): string {
    const fr = frameOf(TOWER);
    // roof()'s seams would cross the west parapet (x = -4): none; the sandbags cover the parapet
    return roof(TOWER, "#8a8c85", "#7a7c75", "#8a8c85", sandbags(fr) + searchlight(fr, 0, 0));
}

export const AXIS_ART: Readonly<Record<string, MilitaryDrawer>> = {
    "map-building-milbase-hq-floor-01.img": hqFloor,
    "map-building-milbase-hq-ceiling-01.img": hqCeiling,
    "map-building-milbase-stand-floor-01.img": standFloor,
    "map-building-milbase-stand-ceiling-01.img": standCeiling,
    "map-building-milbase-gatehouse-floor-01.img": gatehouseFloor,
    "map-building-milbase-gatehouse-ceiling-01.img": gatehouseCeiling,
    "map-building-milbase-tower-floor-01.img": towerFloor,
    "map-building-milbase-tower-ceiling-01.img": towerCeiling,
};
