// Floor and roof art of the blockhouses (packages/defs rebirth/buildings/blockhouse.ts): two flagstone chambers in
// fieldstone walls, each loophole a light sill (thresholds()) with a darker firing step inside it so the invisible low
// walls read; the plank-floored magazine between them with a hazard strip before its sliding door, the switches'
// colour plates and the code chalked by the door; a light stone roof with the eight slits notched into its parapet,
// the magazine as a raised panel broken by the emblem, two hatches and a white shield on a disc in the faction's colour.
import {
    BLOCKHOUSE_CODE,
    BLOCKHOUSE_CODE_NOTE,
    BLOCKHOUSE_LAYOUT,
    BLOCKHOUSE_MAGAZINE_DOOR,
    BLOCKHOUSE_SWITCHES,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    circleAt,
    codeNote,
    type FloorPalette,
    type Frame,
    floor,
    floorFrameOf,
    frameOf,
    hazardBand,
    px,
    py,
    rect,
    roof,
    SWITCH_PLATE_COLORS,
    switchPlate,
} from "./svg.ts";

export const BLOCKHOUSE_FLOORS: FloorPalette = {
    chamber: { base: "#8a8478", grid: "#77726a", step: 2 },
    // the magazine: darker planking over the flagstones (a dry floor for the powder)
    magazine: { base: "#6e5f4b", grid: "#5e5140", step: 1 },
};

const INK = "#1f2326";
const LOOPHOLE = "brick_wall_ext_3_0_low";
/** Half the loophole gap (3 long) and the firing step's depth inside the wall face. */
const SLIT_HALF = 1.5;
const STEP_DEPTH = 0.75;
/** The magazine's walls' outer box (its room in the layout). */
const MAGAZINE = BLOCKHOUSE_LAYOUT.rooms.find((r) => r.floor === "magazine")!;

/** The loophole openings of the layout with their inward unit normal (the wall face points at the keep's centre). */
function loopholes(): { x: number; y: number; horizontal: boolean; nx: number; ny: number }[] {
    return BLOCKHOUSE_LAYOUT.openings
        .filter((o) => o.type === LOOPHOLE)
        .map(({ pos: { x, y }, ori }) => {
            // brick_wall_ext_3_0_low: ori 1 lies along x (north and south walls), ori 0 along y (west and east)
            const horizontal = (ori & 1) === 1;
            return { x, y, horizontal, nx: horizontal ? 0 : -Math.sign(x), ny: horizontal ? -Math.sign(y) : 0 };
        });
}

/**
 * A few flagstones a shade lighter or darker than the floor, picked by a fixed hash of the 2-unit cell so the image is
 * deterministic; inset by the grid's half stroke so the joints stay whole.
 */
function flagstones(fr: Frame): string {
    const { min, max } = BLOCKHOUSE_LAYOUT.bounds;
    const step = BLOCKHOUSE_FLOORS.chamber.step;
    const inset = 1 / 32;
    const out: string[] = [];
    for (let x = Math.ceil(min.x / step) * step; x + step <= max.x; x += step) {
        for (let y = Math.ceil(min.y / step) * step; y + step <= max.y; y += step) {
            // the magazine has its own planking
            if (x + step > MAGAZINE.min.x && x < MAGAZINE.max.x && y + step > MAGAZINE.min.y && y < MAGAZINE.max.y) {
                continue;
            }
            const h = (Math.imul(x + 37, 73856093) ^ Math.imul(y + 53, 19349663)) >>> 0;
            const shade = h % 7 === 0 ? "#847e72" : h % 7 === 3 ? "#8f897d" : "";
            if (shade) out.push(rect(fr, x + inset, y + inset, x + step - inset, y + step - inset, `fill="${shade}"`));
        }
    }
    return out.join("");
}

/** The darker firing step just inside each loophole: 3 along the gap, STEP_DEPTH deep from the wall's inner face. */
function firingSteps(fr: Frame): string {
    return loopholes()
        .map(({ x, y, horizontal, nx, ny }) => {
            // the wall's inner face is half a unit in from its centre line
            const fx = x + nx * 0.5;
            const fy = y + ny * 0.5;
            const box = horizontal
                ? [x - SLIT_HALF, fy, x + SLIT_HALF, fy + ny * STEP_DEPTH]
                : [fx, y - SLIT_HALF, fx + nx * STEP_DEPTH, y + SLIT_HALF];
            // the step's room-side edge in a darker line so it reads as a raised ledge (0.15 wide: 2.4 px in game)
            const ex = horizontal ? fx : fx + nx * STEP_DEPTH;
            const ey = horizontal ? fy + ny * STEP_DEPTH : fy;
            const e = 0.075;
            const edge = horizontal
                ? [x - SLIT_HALF, ey - e, x + SLIT_HALF, ey + e]
                : [ex - e, y - SLIT_HALF, ex + e, y + SLIT_HALF];
            return (
                rect(fr, box[0], box[1], box[2], box[3], `fill="#6f6a5f"`) +
                rect(fr, edge[0], edge[1], edge[2], edge[3], `fill="#534f47"`)
            );
        })
        .join("");
}

/**
 * The magazine's door: a hazard strip on the chamber side of its doorway (the sliding door's panel covers the gap),
 * the switches' plates under them and the code chalked on the flagstones before the door.
 */
function magazineMarks(fr: Frame): string {
    const d = BLOCKHOUSE_MAGAZINE_DOOR.pos;
    const strip = hazardBand(fr, d.x, d.y + 0.5, d.x + 4, d.y + 1.1, "blockhouse-magazine-hazard");
    const plates = BLOCKHOUSE_SWITCHES.map((sw) => switchPlate(fr, sw.x, sw.y, SWITCH_PLATE_COLORS[sw.label]));
    const note = codeNote(
        fr,
        BLOCKHOUSE_CODE_NOTE.x,
        BLOCKHOUSE_CODE_NOTE.y,
        BLOCKHOUSE_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
    );
    return strip + plates.join("") + note;
}

export function blockhouseFloor(): string {
    const fr = floorFrameOf(BLOCKHOUSE_LAYOUT);
    const extra = flagstones(fr) + firingSteps(fr) + magazineMarks(fr);
    return floor(BLOCKHOUSE_LAYOUT, BLOCKHOUSE_FLOORS, "#7d776b", "#1f2224", extra);
}

/**
 * A heater shield centred on (x, y) through the spec's five points (-2,2.2) (2,2.2) (2,-0.3) (0,-2.6) (-2,-0.3), but
 * with the two lower edges curved (quadratics bowing out from the shoulders to the foot): the spec's straight-edged
 * polygon has home-plate proportions and reads as a down arrow at 16 px per unit.
 */
function shield(fr: Frame, x: number, y: number, fill: string): string {
    const X = (dx: number) => px(fr, x + dx);
    const Y = (dy: number) => py(fr, y + dy);
    const d =
        `M${X(-2)} ${Y(2.2)}H${X(2)}V${Y(-0.3)}` +
        `Q${X(2)} ${Y(-1.7)} ${X(0)} ${Y(-2.6)}Q${X(-2)} ${Y(-1.7)} ${X(-2)} ${Y(-0.3)}Z`;
    return `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
}

/**
 * A roof hatch: a `size`-square stone coaming with a dark rim around the lid (the inner frame), a grab bar near one
 * edge of the lid and a hinge strip on the coaming along the opposite edge, so it reads as a lid that opens. (Two hinge
 * tabs over a bar read as a face at 16 px per unit.) `hinge` is +1 for the hinge on the north edge, -1 for the south.
 */
function hatch(fr: Frame, x: number, y: number, hinge: 1 | -1, size = 1.6): string {
    const h = size / 2;
    const lid = h - 0.3;
    // the grab bar's centre sits 0.22 in from the lid's free edge, clear of the inner frame's 2 px line
    const by = y - hinge * (lid - 0.22);
    // the hinge strip as wide as the lid, just outside the inner frame (wider than the bar so the two never read as =)
    const ty = y + hinge * (lid + 0.05);
    return (
        rect(fr, x - h, y - h, x + h, y + h, `fill="#8f897b" stroke="${INK}" stroke-width="3"`) +
        rect(
            fr,
            x - h + 0.3,
            y - h + 0.3,
            x + h - 0.3,
            y + h - 0.3,
            `fill="#9d9789" stroke="#6f6a5f" stroke-width="2"`,
        ) +
        rect(fr, x - 0.4, by - 0.09, x + 0.4, by + 0.09, `fill="${INK}"`) +
        rect(fr, x - lid, ty, x + lid, ty + hinge * 0.14, `fill="${INK}"`)
    );
}

/** The eight loophole slots notched into the parapet, centred on its visible band, from the layout's openings. */
function parapetSlots(fr: Frame): string {
    // roof(): the dark rim is 4 px, the parapet then runs to 1 unit in from the image edge
    const shift = 4 / 32 / 2;
    return loopholes()
        .map(({ x, y, horizontal, nx, ny }) => {
            // the opening sits on the wall's centre line, half a unit in from the edge: move it in to the band's middle
            const cx = horizontal ? x : x + nx * shift;
            const cy = horizontal ? y + ny * shift : y;
            const box = horizontal
                ? [cx - SLIT_HALF, cy - 0.35, cx + SLIT_HALF, cy + 0.35]
                : [cx - 0.35, cy - SLIT_HALF, cx + 0.35, cy + SLIT_HALF];
            return rect(fr, box[0], box[1], box[2], box[3], `fill="${INK}"`);
        })
        .join("");
}

export function blockhouseCeiling(color: string): string {
    const fr = frameOf(BLOCKHOUSE_LAYOUT);
    const top =
        parapetSlots(fr) +
        // the magazine below as a raised panel under the emblem
        rect(
            fr,
            MAGAZINE.min.x,
            MAGAZINE.min.y,
            MAGAZINE.max.x,
            MAGAZINE.max.y,
            `fill="#a29c8d" stroke="#6f6a5f" stroke-width="3"`,
        ) +
        // spec (-7,7)/(7,-7) moved to x = -6/6, the middle of their 4-unit seam panels (roof() seams at 0, +-4, +-8);
        // hinges toward the outer walls, keeping the roof's half-turn symmetry
        hatch(fr, -6, 7, 1) +
        hatch(fr, 6, -7, -1) +
        circleAt(fr, 0, 0, 4.25, `fill="${color}" stroke="${INK}" stroke-width="4"`) +
        shield(fr, 0, 0, "#f2f2ee");
    return roof(BLOCKHOUSE_LAYOUT, "#aca696", "#8f897b", "#a29c8d", top);
}
