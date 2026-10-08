// The military base's basement images (packages/defs rebirth/buildings/military/bunker.ts). The basement is drawn as one
// floor in the compound frame (its layout with the nested rooms' floors, the vault's steel walls and Command's lab
// doors folded in) and every floor image is a window of it: the two halves, the tunnel, the ramp's doorway and each
// nested room's floor, which therefore redraws the basement walls under its half-wall border and meets the halves
// pixel for pixel; a nested floor only adds its own markings inside its walls. Barracks boards, the Spine's yellow guide
// line, the Depot's painted pallet bays, the checkpoint's riveted plate with the vault door's swing, hazard pads under
// the gallery's power boxes, the motor pool's yellow bays and lane toward the ramp, steel ribs along the tunnel;
// Command's map-table outline, the Magazine's riveted plate, the vault's hazard border and door frame (the stone breach
// stays plain floor: stone_wall_int_4 draws itself). One stairs-from-below sprite serves the four doored stairwells; the
// dark roofs are flat grey (the game tints them 0x5f5f5f) with seams on the compound's 4-unit grid.
import {
    MILITARY_BUNKER,
    MILITARY_COMMAND,
    MILITARY_MAGAZINE,
    MILITARY_STAIRS,
    MILITARY_VAULT,
    MILITARY_VAULT_DOOR,
    type MilitaryPart,
    type Opening,
    type PartImage,
    REBIRTH_ART_PX_PER_UNIT as PX,
    type RebirthBuildingLayout,
    type Room,
    type WallSeg,
} from "../../../../packages/defs/src/rebirth/buildings.ts";
import { circleAt, type FloorPalette, type Frame, f2, floor, hazardBand, px, py, rect, svg } from "../svg.ts";
import type { MilitaryArtContext, MilitaryDrawer } from "./index.ts";

export const BUNKER_FLOORS: FloorPalette = {
    // the grid in the base colour: planks() draws the boards
    barracks: { base: "#a8865a", grid: "#a8865a", step: 4 },
    spine: { base: "#8c8e88", grid: "#81837d", step: 2 },
    depot: { base: "#9a9488", grid: "#8e887c", step: 4 },
    checkpoint: { base: "#6e7478", grid: "#62686c", step: 2 },
    ring: { base: "#80827c", grid: "#757771", step: 2 },
    motorpool: { base: "#5f6264", grid: "#57595b", step: 4 },
    tunnel: { base: "#6c6a62", grid: "#625f58", step: 2 },
    command: { base: "#4f6a56", grid: "#47614e", step: 1 },
    magazine: { base: "#6a6e72", grid: "#5f6367", step: 2 },
    vault: { base: "#56606a", grid: "#4d565f", step: 1 },
};

/** Bunker concrete, darker than the surface buildings'; the vault's steel as the arsenal's. */
const WALLS = { concrete: "#4a4c47", metal: "#5d6a73" } as const;
const INK = "#161816";
const YELLOW = "#d8b02c";
const PAINT = "#d6d1c1";
/** The concrete strip at each stair's foot (the doorway between the wall line and the flight). */
const LANDING = "#7a7c76";
/** Painted line width in units. */
const LINE = 0.18;

type Seg = readonly [x0: number, y0: number, x1: number, y1: number];

const NESTED: readonly MilitaryPart[] = [MILITARY_COMMAND, MILITARY_MAGAZINE, MILITARY_VAULT];
const at = (part: MilitaryPart) => part.placements[0].pos;
/** The stairs sprite is drawn at its first place, S1's; the vehicle ramp is the stair without a door. */
const S1 = MILITARY_STAIRS[0];
const RAMP = MILITARY_STAIRS.find((q) => q.bottomDoor === null) ?? S1;

/** The basement whole in the compound frame (the basement sits at its origin): its layout plus the nested rooms'. */
const BASEMENT: RebirthBuildingLayout = (() => {
    const host = MILITARY_BUNKER.layout;
    const walls: WallSeg[] = [...host.walls];
    const openings: Opening[] = [...host.openings];
    const rooms: Room[] = [...host.rooms];
    for (const part of NESTED) {
        const { x, y } = at(part);
        const L = part.layout;
        walls.push(...L.walls.map((s): WallSeg => [s[0] + x, s[1] + y, s[2] + x, s[3] + y, s[4] ?? L.material]));
        openings.push(...L.openings.map((o) => ({ ...o, pos: { x: o.pos.x + x, y: o.pos.y + y } })));
        rooms.push(
            ...L.rooms.map((r) => ({
                ...r,
                min: { x: r.min.x + x, y: r.min.y + y },
                max: { x: r.max.x + x, y: r.max.y + y },
            })),
        );
    }
    return { ...host, walls, openings, rooms };
})();

/** The parts of a0..a1 not covered by `cuts`. */
function uncovered(a0: number, a1: number, cuts: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    let s = a0;
    for (const [c0, c1] of [...cuts].sort((p, q) => p[0] - q[0])) {
        if (c0 > s) out.push([s, Math.min(c0, a1)]);
        s = Math.max(s, c1);
    }
    if (s < a1) out.push([s, a1]);
    return out.filter(([p, q]) => q - p > 1e-6);
}

/** The doorless gaps in the basement's walls along the line y between x0 and x1 (archways, the vault's breach). */
function openGaps(y: number, x0: number, x1: number): Array<[number, number]> {
    const along = BASEMENT.walls.filter((w) => w[1] === y && w[3] === y).map((w) => [w[0], w[2]] as const);
    return uncovered(x0, x1, along).filter(
        ([a, b]) => !BASEMENT.openings.some((o) => o.pos.y === y && o.pos.x >= a && o.pos.x <= b),
    );
}

const roomOf = (floorKey: string): Room => {
    const r = [...BASEMENT.rooms, ...(BASEMENT.outdoor ?? [])].find((q) => q.floor === floorKey);
    if (!r) throw new Error(`military bunker art: no ${floorKey} room`);
    return r;
};

/** The image's frame in the compound frame: the part's frame moved to where the basement places the part. */
function compoundFrame({ part, fr }: MilitaryArtContext): Frame {
    const { x, y } = at(part);
    return { ...fr, ox: fr.ox + x, oy: fr.oy + y };
}

/** Line segments as one stroked path (`w` units wide). */
function strokes(fr: Frame, segs: readonly Seg[], color: string, w = LINE, extra = ""): string {
    const d = segs.map(([x0, y0, x1, y1]) => `M${px(fr, x0)} ${py(fr, y0)}L${px(fr, x1)} ${py(fr, y1)}`).join("");
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f2(w * PX)}" ${extra}/>`;
}

/** `a` to `b` by t (hex colours). */
function mix(a: string, b: string, t: number): string {
    const ch = (c: string, i: number) => Number.parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
    const out = [0, 1, 2].map((i) =>
        Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t)
            .toString(16)
            .padStart(2, "0"),
    );
    return `#${out.join("")}`;
}

/** Small rivets at the corners of each `step`-unit plate of the room, `inset` in from its seams. */
function rivets(fr: Frame, r: Room, step: number, color: string, inset = 0.22): string {
    const out: string[] = [];
    for (let x = r.min.x; x < r.max.x - 1e-6; x += step) {
        for (let y = r.min.y; y < r.max.y - 1e-6; y += step) {
            for (const [cx, cy] of [
                [x + inset, y + inset],
                [x + step - inset, y + inset],
                [x + inset, y + step - inset],
                [x + step - inset, y + step - inset],
            ] as const) {
                out.push(circleAt(fr, cx, cy, 0.08, `fill="${color}"`));
            }
        }
    }
    return out.join("");
}

// ---------------------------------------------------------------------------------------------------------------------
// the basement's floor markings (compound frame; a window draws those of the rooms it reaches, its viewBox clips them)

/** The Barracks' boards: 0.5-unit rows running east-west, butt joints every 5 units, each row 2 on from the last. */
function planks(fr: Frame): string {
    const r = roomOf("barracks");
    const segs: Seg[] = [];
    for (let row = 0; r.min.y + row * 0.5 < r.max.y; row++) {
        const y = r.min.y + row * 0.5;
        if (row > 0) segs.push([r.min.x, y, r.max.x, y]);
        for (let x = r.min.x + ((row * 2) % 5) + 0.5; x < r.max.x; x += 5) segs.push([x, y, x, y + 0.5]);
    }
    return strokes(fr, segs, "#977750", 2 / PX);
}

/** The Spine's yellow centre guide line, wall face to wall face. */
function spineGuide(fr: Frame): string {
    const r = roomOf("spine");
    const y = (r.min.y + r.max.y) / 2;
    return strokes(fr, [[r.min.x + 0.5, y, r.max.x - 0.5, y]], YELLOW);
}

/** The Depot's painted bays round each column of pallets (crate_05, 4 x 4), a line between the pallets of a column. */
function depotBays(fr: Frame): string {
    const r = roomOf("depot");
    const pallets = MILITARY_BUNKER.props.filter(
        (q) => q.type === "crate_05" && q.x > r.min.x && q.x < r.max.x && q.y > r.min.y && q.y < r.max.y,
    );
    const out: string[] = [];
    for (const x of [...new Set(pallets.map((q) => q.x))]) {
        const ys = pallets
            .filter((q) => q.x === x)
            .map((q) => q.y)
            .sort((a, b) => a - b);
        const [x0, x1, y0, y1] = [x - 2.5, x + 2.5, ys[0] - 2.5, ys[ys.length - 1] + 2.5];
        const segs: Seg[] = [
            [x0, y0, x1, y0],
            [x1, y0, x1, y1],
            [x1, y1, x0, y1],
            [x0, y1, x0, y0],
        ];
        for (let i = 1; i < ys.length; i++) segs.push([x0, (ys[i - 1] + ys[i]) / 2, x1, (ys[i - 1] + ys[i]) / 2]);
        out.push(strokes(fr, segs, PAINT, 0.15, `stroke-linecap="square"`));
    }
    return out.join("");
}

/**
 * The checkpoint hall: riveted steel plate, a white stop line inside each archway, and the vault door's swing painted
 * as a dashed yellow arc from its closed to its open free end with the open door's footprint (kept clear: it becomes
 * cover there).
 */
function checkpoint(fr: Frame): string {
    const r = roomOf("checkpoint");
    const { hinge, open } = MILITARY_VAULT_DOOR;
    const len = open[3] - open[1];
    const R = f2(len * PX);
    const arc =
        `<path d="M${px(fr, hinge.x + len)} ${py(fr, hinge.y)}A${R} ${R} 0 0 0 ${px(fr, hinge.x)} ${py(fr, hinge.y + len)}" ` +
        `fill="none" stroke="${YELLOW}" stroke-width="${f2(0.14 * PX)}" stroke-dasharray="14 10"/>`;
    const stop = r.max.y - 0.75;
    const archways = openGaps(r.max.y, r.min.x, r.max.x);
    // the open door's footprint (the arc ends on its corner), clear of the vault wall's outline, hatched at 45 degrees
    const [x0, y0, x1, y1] = [open[0], open[1] + 0.1, open[2], open[3]];
    const hatch: Seg[] = [];
    for (let y = y0 + 0.4; y + (x1 - x0) <= y1 - 0.3; y += 1.2) hatch.push([x0, y, x1, y + (x1 - x0)]);
    return (
        rivets(fr, r, BUNKER_FLOORS.checkpoint.step, "#5a6064") +
        strokes(
            fr,
            archways.map(([a, b]) => [a, stop, b, stop] as const),
            PAINT,
            0.25,
        ) +
        arc +
        rect(fr, x0, y0, x1, y1, `fill="none" stroke="${YELLOW}" stroke-width="4"`) +
        strokes(fr, hatch, YELLOW, 0.08)
    );
}

/** Hazard pads under the generator gallery's power boxes (power_box_01, 2 x 2, explosive). */
function gallery(fr: Frame): string {
    return MILITARY_BUNKER.props
        .filter((q) => q.type === "power_box_01")
        .map((q, i) => hazardBand(fr, q.x - 1.4, q.y - 1.4, q.x + 1.4, q.y + 1.4, `bunker-pad-${i}`))
        .join("");
}

/**
 * The motor pool: a lane in line with the ramp (S4's width, edge lines 0.5 inside it, a dashed centre line, two
 * chevrons toward the ramp) and 4-wide bays either side, the columns (house_column_1 at x 21 / 29) on their lines.
 */
function motorBays(fr: Frame): string {
    const r = roomOf("motorpool");
    const [s, n] = [RAMP.collision[1] + 0.5, RAMP.collision[3] - 0.5];
    const c = (s + n) / 2;
    const segs: Seg[] = [
        [r.min.x + 1, s, r.max.x - 0.5, s],
        [r.min.x + 1, n, r.max.x - 0.5, n],
    ];
    for (let x = r.min.x + 3; x < r.max.x - 2; x += 4) segs.push([x, n, x, n + 5.5], [x, s, x, s - 5.5]);
    const chevrons = [r.max.x - 4.5, r.max.x - 2.5]
        .map(
            (x) =>
                `M${px(fr, x - 0.7)} ${py(fr, c + 1)}L${px(fr, x + 0.3)} ${py(fr, c)}L${px(fr, x - 0.7)} ${py(fr, c - 1)}`,
        )
        .join("");
    return (
        strokes(fr, segs, YELLOW, LINE, `stroke-linecap="square"`) +
        strokes(fr, [[r.min.x + 1.5, c, r.max.x - 6.5, c]], YELLOW, LINE, `stroke-dasharray="32 24"`) +
        `<path d="${chevrons}" fill="none" stroke="${YELLOW}" stroke-width="${f2(0.22 * PX)}"/>`
    );
}

/** Steel ribs across the sapper tunnel every 4 units, clear of the landing at its foot. */
function tunnelRibs(fr: Frame): string {
    const r = roomOf("tunnel");
    const out: string[] = [];
    for (let y = r.max.y - 3; y > r.min.y + 3; y -= 4)
        out.push(rect(fr, r.min.x, y - 0.15, r.max.x, y + 0.15, `fill="#55534c"`));
    return out.join("");
}

/**
 * The doorway at each stair's foot: 1 unit of landing concrete past the flight's bottom edge under each steel door
 * (half in the basement's images, half in the stairs sprite), the ramp's asphalt from the east wall line to its foot.
 */
function landings(fr: Frame): string {
    return MILITARY_STAIRS.map(({ collision: [x0, y0, x1, y1], downDir: d, bottomDoor }) => {
        const depth = bottomDoor ? 1 : 0.5;
        const fill = `fill="${bottomDoor ? LANDING : BUNKER_FLOORS.motorpool.base}"`;
        if (d.y < 0) return rect(fr, x0, y0 - depth, x1, y0, fill);
        if (d.y > 0) return rect(fr, x0, y1, x1, y1 + depth, fill);
        if (d.x > 0) return rect(fr, x1, y0, x1 + depth, y1, fill);
        return rect(fr, x0 - depth, y0, x0, y1, fill);
    }).join("");
}

/** Whether the world box (x0, y0)-(x1, y1) reaches into the frame. */
const reaches = (fr: Frame, x0: number, y0: number, x1: number, y1: number) =>
    x1 > fr.ox && x0 < fr.ox + fr.w / PX && y1 > fr.oy - fr.h / PX && y0 < fr.oy;
const roomReaches = (fr: Frame, r: Room) => reaches(fr, r.min.x - 0.1, r.min.y - 0.1, r.max.x + 0.1, r.max.y + 0.1);

function markings(fr: Frame): string {
    const inRoom = (key: string, draw: (f: Frame) => string) => (roomReaches(fr, roomOf(key)) ? draw(fr) : "");
    return (
        inRoom("barracks", planks) +
        inRoom("spine", spineGuide) +
        inRoom("depot", depotBays) +
        inRoom("checkpoint", checkpoint) +
        gallery(fr) +
        inRoom("motorpool", motorBays) +
        inRoom("tunnel", tunnelRibs) +
        landings(fr)
    );
}

/**
 * The window `fr` (compound frame) of the basement floor, `extra` drawn over the markings, under doors and walls; what
 * cannot reach the window is left out (a wall's half thickness and outline, a door's 4-unit threshold).
 */
function basement(fr: Frame, extra = ""): string {
    const g = 0.75;
    const layout: RebirthBuildingLayout = {
        ...BASEMENT,
        walls: BASEMENT.walls.filter(([x0, y0, x1, y1]) => reaches(fr, x0 - g, y0 - g, x1 + g, y1 + g)),
        openings: BASEMENT.openings.filter(({ pos: { x, y } }) => reaches(fr, x - 4.5, y - 4.5, x + 4.5, y + 4.5)),
        rooms: BASEMENT.rooms.filter((r) => roomReaches(fr, r)),
        outdoor: BASEMENT.outdoor?.filter((r) => roomReaches(fr, r)),
    };
    return floor(layout, BUNKER_FLOORS, WALLS, INK, markings(fr) + extra, fr);
}

/** A drawer of the image's window of the basement, with `detail` (compound frame) over the markings. */
const windowed =
    (detail?: (fr: Frame) => string): MilitaryDrawer =>
    (ctx) => {
        const fr = compoundFrame(ctx);
        return basement(fr, detail?.(fr));
    };

// ---------------------------------------------------------------------------------------------------------------------
// the stairs and the ramp seen from below

/**
 * The stairs from below, in S1's place (the sprite is drawn at its first place and turned for S2, S3 and S5): the
 * 4-wide flight in 0.5 treads, darkest at its foot (south, the deepest) and lightest at its top, a dark nosing on each
 * tread's foot-side edge and a yellow one on the first; the walls, landing and door threshold are the basement's.
 */
function flight(fr: Frame): string {
    const [x0, y0, x1, y1] = S1.collision;
    const n = Math.round((y1 - y0) / 0.5);
    const out: string[] = [];
    const nosings: Seg[] = [];
    for (let i = 0; i < n; i++) {
        const y = y0 + i * 0.5;
        out.push(rect(fr, x0, y, x1, y + 0.5, `fill="${mix("#555752", "#8f918b", i / (n - 1))}"`));
        if (i > 0) nosings.push([x0, y + 0.04, x1, y + 0.04]);
    }
    return out.join("") + strokes(fr, nosings, "#34363280", 0.08) + rect(fr, x0, y0, x1, y0 + 0.12, `fill="${YELLOW}"`);
}

/**
 * The vehicle ramp from below (S4, foot west): ribbed concrete in 0.5 bands, darkest at its foot, a groove between the
 * bands, yellow and black edges along both rails and a yellow line across its foot.
 */
function ramp(fr: Frame): string {
    const [x0, y0, x1, y1] = RAMP.collision;
    const n = Math.round((x1 - x0) / 0.5);
    const out: string[] = [];
    const grooves: Seg[] = [];
    for (let i = 0; i < n; i++) {
        const x = x0 + i * 0.5;
        out.push(rect(fr, x, y0, x + 0.5, y1, `fill="${mix("#4d5052", "#7f8284", i / (n - 1))}"`));
        if (i > 0) grooves.push([x, y0, x, y1]);
    }
    return (
        out.join("") +
        strokes(fr, grooves, "#2e3133", 0.07) +
        hazardBand(fr, x0, y0, x1, y0 + 0.4, "ramp-edge-s") +
        hazardBand(fr, x0, y1 - 0.4, x1, y1, "ramp-edge-n") +
        rect(fr, x0, y0, x0 + 0.15, y1, `fill="${YELLOW}"`)
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// the nested rooms' floors: windows of the basement with their own markings inside their walls

/** Command's map table (table_05, 18 x 5.5, walk-under): a darker inset with a pale keyline half a unit round it. */
function mapTable(fr: Frame): string {
    const t = MILITARY_COMMAND.props.find((q) => q.type === "table_05");
    if (!t) throw new Error("military bunker art: no map table");
    const { x, y } = at(MILITARY_COMMAND);
    const [cx, cy] = [t.x + x, t.y + y];
    const box = (g: number, attrs: string) => rect(fr, cx - 9 - g, cy - 2.75 - g, cx + 9 + g, cy + 2.75 + g, attrs);
    return (
        box(0.5, `fill="#43594a"`) +
        box(0.5, `fill="none" stroke="#9cbca4" stroke-width="3"`) +
        box(0.2, `fill="none" stroke="#5f7d67" stroke-width="2"`)
    );
}

function magazinePlate(fr: Frame): string {
    return rivets(fr, roomOf("magazine"), BUNKER_FLOORS.magazine.step, "#575b5f");
}

/**
 * The vault: a 0.75 hazard border inside its steel walls (the patterns are in image space, so the legs run on as one),
 * broken at the stone breach (left plain) and at the door; the door frame is a dark steel sill under the closed door's
 * footprint with a seal groove, and two jamb blocks inside the wall ends with bolt sockets.
 */
function vaultFrame(fr: Frame): string {
    const r = roomOf("vault");
    const [x0, y0, x1, y1] = [r.min.x + 0.5, r.min.y + 0.5, r.max.x - 0.5, r.max.y - 0.5];
    const w = 0.75;
    const { closed } = MILITARY_VAULT_DOOR;
    const jamb = 0.75;
    const [breach] = openGaps(r.min.y, r.min.x, r.max.x);
    const legs: Seg[] = [
        [x0, y1 - w, closed[0] - jamb, y1],
        [closed[2] + jamb, y1 - w, x1, y1],
        [x0, y0, breach[0], y0 + w],
        [breach[1], y0, x1, y0 + w],
        [x0, y0 + w, x0 + w, y1 - w],
        [x1 - w, y0 + w, x1, y1 - w],
    ];
    const jambs = [closed[0] - jamb, closed[2]].map(
        (x) =>
            rect(fr, x, closed[1], x + jamb, closed[1] + 1, `fill="#47515a" stroke="${INK}" stroke-width="3"`) +
            [0.3, 0.7].map((t) => circleAt(fr, x + jamb / 2, closed[1] + t, 0.12, `fill="${INK}"`)).join(""),
    );
    return (
        legs.map((b, i) => hazardBand(fr, b[0], b[1], b[2], b[3], `vault-hazard-${i}`)).join("") +
        rect(fr, closed[0], closed[1], closed[2], closed[3], `fill="#3b4248"`) +
        strokes(fr, [[closed[0], closed[1] + 1, closed[2], closed[1] + 1]], "#262b30", 0.1) +
        jambs.join("")
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// the dark roofs

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * A dark roof: flat mid grey, panel seams on the compound's 4-unit grid (so the roofs of a part line up) and a darker
 * band inside its edges, left off where another dark roof of the part continues it (the basement's two halves, the
 * tunnel's mouth).
 */
function darkRoof(ctx: MilitaryArtContext): string {
    const fr = compoundFrame(ctx);
    const { x: dx, y: dy } = at(ctx.part);
    const boxOf = (a: PartImage): Seg => {
        const [w, h] = a.size;
        return [a.centre.x - w / 2 + dx, a.centre.y - h / 2 + dy, a.centre.x + w / 2 + dx, a.centre.y + h / 2 + dy];
    };
    const [x0, y0, x1, y1] = boxOf(ctx.img);
    const others = ctx.part.images.filter((a) => a.kind === "ceiling" && a !== ctx.img).map(boxOf);
    const seams: Seg[] = [];
    for (let x = Math.ceil(x0 / 4) * 4; x <= x1; x += 4) seams.push([x, y0, x, y1]);
    for (let y = Math.ceil(y0 / 4) * 4; y <= y1; y += 4) seams.push([x0, y, x1, y]);
    const B = 0.5;
    const band = `fill="#5d605c"`;
    // each edge: the axis it runs along (0 x, 1 y), its line, the side of an abutting roof's box on that line and the
    // band's inward direction; the band leaves out the spans of the roofs that abut it
    const sides = [
        [0, y1, 1, -1],
        [0, y0, 3, 1],
        [1, x0, 2, 1],
        [1, x1, 0, -1],
    ] as const;
    const edges = sides.flatMap(([axis, line, side, dir]) => {
        const spans = others.filter((o) => near(o[side], line)).map((o) => [o[axis], o[axis + 2]] as const);
        return uncovered(axis ? y0 : x0, axis ? y1 : x1, spans).map(([a, b]) =>
            axis ? rect(fr, line, a, line + dir * B, b, band) : rect(fr, a, line, b, line + dir * B, band),
        );
    });
    const body = rect(fr, x0, y0, x1, y1, `fill="#6b6e6a"`) + strokes(fr, seams, "#616460", 4 / PX) + edges.join("");
    return svg(ctx.fr, body, ctx.ppu);
}

export const BUNKER_ART: Readonly<Record<string, MilitaryDrawer>> = {
    "map-building-milbase-bunker-floor-01.img": windowed(),
    "map-building-milbase-bunker-floor-02.img": windowed(),
    "map-building-milbase-bunker-tunnel-01.img": windowed(),
    "map-building-milbase-stairs-below-01.img": windowed(flight),
    "map-building-milbase-ramp-below-01.img": windowed(ramp),
    "map-building-milbase-bunker-ceiling-01.img": darkRoof,
    "map-building-milbase-bunker-ceiling-02.img": darkRoof,
    "map-building-milbase-bunker-ceiling-03.img": darkRoof,
    "map-building-milbase-command-floor-01.img": windowed(mapTable),
    "map-building-milbase-command-ceiling-01.img": darkRoof,
    "map-building-milbase-magazine-floor-01.img": windowed(magazinePlate),
    "map-building-milbase-magazine-ceiling-01.img": darkRoof,
    "map-building-milbase-vault-floor-01.img": windowed(vaultFrame),
    "map-building-milbase-vault-ceiling-01.img": darkRoof,
};
