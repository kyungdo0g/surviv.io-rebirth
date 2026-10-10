// Floor and roof art of the power plant's two buildings (packages/defs rebirth/buildings/powerplant/): the turbine
// hall's pale epoxy floor with yellow walkway lines round the two turbine-generator sets (each a steel casing whose
// high- and low-pressure sections, shaft and green generator are drawn exactly over its invisible colliders), and a
// corrugated steel roof with two skylights and four vents; the control building's dark tiled control room, the
// strongroom's steel plate behind a hazard strip at its sliding door, the corridor's terrazzo, the offices' carpets,
// the switches' colour plates and the code note on the shift manager's floor; a tan roof with AC units, a hatch and an
// antenna. The yard and the cooling towers are in powerPlantYard.ts.
import {
    PLANT_CODE,
    PLANT_CODE_NOTE,
    PLANT_CONTROL,
    PLANT_STRONGROOM_DOOR,
    PLANT_SWITCHES,
    PLANT_TURBINE,
    PLANT_TURBINE_HALF,
    PLANT_TURBINES,
} from "../../../packages/defs/src/rebirth/buildings.ts";
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
    px,
    py,
    rect,
    roof,
    SWITCH_PLATE_COLORS,
    switchPlate,
} from "./svg.ts";

const INK = "#1f2326";

/** A part's own frame: plant-frame point -> part-local point. */
function local(part: typeof PLANT_TURBINE, x: number, y: number): [number, number] {
    const c = part.placements[0].pos;
    return [x - c.x, y - c.y];
}

// ---------------------------------------------------------------------------------------------------------------------
// the turbine hall

export const TURBINE_FLOORS: FloorPalette = {
    hall: { base: "#a9aeaa", grid: "#9a9f9b", step: 2 },
};

/** One turbine-generator set over its casing box (part frame): HP and LP turbine sections, shaft, generator. */
function turbineSet(fr: Frame, x0: number, x1: number, y: number): string {
    const h = PLANT_TURBINE_HALF;
    const len = x1 - x0;
    const hp = x0 + len * 0.3;
    const lp = x0 + len * 0.66;
    const out: string[] = [];
    // the painted safety line round the set, half a unit out
    out.push(rect(fr, x0 - 0.5, y - h - 0.5, x1 + 0.5, y + h + 0.5, `fill="none" stroke="#e2b425" stroke-width="5"`));
    // the casing's footprint (exactly the collider), then the sections inside it
    out.push(rect(fr, x0, y - h, x1, y + h, `fill="#4c5a63" stroke="${INK}" stroke-width="4"`));
    // high-pressure turbine: a tapered steel shell
    const taper = (a: number, b: number, ha: number, hb: number) =>
        `<polygon points="${[
            [a, y - ha],
            [b, y - hb],
            [b, y + hb],
            [a, y + ha],
        ]
            .map(([px0, py0]) => `${px(fr, px0)},${py(fr, py0)}`)
            .join(" ")}" fill="#8aa1ae" stroke="${INK}" stroke-width="3"/>`;
    out.push(taper(x0 + 0.4, hp, h * 0.55, h * 0.8));
    // low-pressure turbine: a wider shell with ribs
    out.push(taper(hp + 0.3, lp, h * 0.85, h * 0.85));
    const ribs: string[] = [];
    for (let x = hp + 1.3; x < lp - 0.5; x += 1.2)
        ribs.push(`M${px(fr, x)} ${py(fr, y + h * 0.8)}V${py(fr, y - h * 0.8)}`);
    out.push(`<path d="${ribs.join("")}" stroke="#6b808c" stroke-width="3" fill="none"/>`);
    // the generator: a green drum with cooling fins, its end bells
    out.push(rect(fr, lp + 0.4, y - h * 0.9, x1 - 0.3, y + h * 0.9, `fill="#4d7d63" stroke="${INK}" stroke-width="3"`));
    const fins: string[] = [];
    for (let x = lp + 1.2; x < x1 - 0.8; x += 0.8)
        fins.push(`M${px(fr, x)} ${py(fr, y + h * 0.7)}V${py(fr, y - h * 0.7)}`);
    out.push(`<path d="${fins.join("")}" stroke="#3b6450" stroke-width="2" fill="none"/>`);
    // the shaft along the set's axis, bearings at the joints
    out.push(
        `<path d="M${px(fr, x0 + 0.2)} ${py(fr, y)}H${px(fr, x1 - 0.2)}" stroke="#2c3135" stroke-width="4" fill="none"/>`,
    );
    for (const x of [hp, lp]) out.push(circleAt(fr, x, y, 0.55, `fill="#c9ced1" stroke="${INK}" stroke-width="3"`));
    return out.join("");
}

export function turbineFloor(): string {
    const L = PLANT_TURBINE.layout;
    const fr = floorFrameOf(L);
    const extra: string[] = [];
    for (const t of PLANT_TURBINES) {
        const [a, y] = local(PLANT_TURBINE, t.x0, t.y);
        const [b] = local(PLANT_TURBINE, t.x1, t.y);
        extra.push(turbineSet(fr, a, b, y));
        // the exciter's pad under its cabinet
        const [ex, ey] = local(PLANT_TURBINE, t.exciter.x, t.exciter.y);
        extra.push(rect(fr, ex - 2.5, ey - 1.9, ex + 2.5, ey + 1.9, `fill="#7c8286"`));
    }
    // walkway arrows down the centre aisle (between the sets), drain grates in the bays
    const [, midY] = local(
        PLANT_TURBINE,
        0,
        (PLANT_TURBINES[0].y + PLANT_TURBINE_HALF + PLANT_TURBINES[1].y - 2.75) / 2,
    );
    const { min, max } = L.bounds;
    extra.push(
        `<path d="M${px(fr, min.x + 1)} ${py(fr, midY)}H${px(fr, max.x - 1)}" stroke="#e2b425" stroke-width="3" ` +
            `stroke-dasharray="24 16" fill="none"/>`,
    );
    for (const gx of [min.x + 3.75, max.x - 2.5]) {
        extra.push(
            rect(fr, gx - 0.6, midY - 0.6, gx + 0.6, midY + 0.6, `fill="#5d6366" stroke="${INK}" stroke-width="2"`),
        );
    }
    return floor(L, TURBINE_FLOORS, "#8d9396", INK, extra.join(""));
}

export function turbineCeiling(): string {
    const L = PLANT_TURBINE.layout;
    const fr = frameOf(L);
    const { min, max } = L.bounds;
    const cy = (min.y + max.y) / 2;
    const top: string[] = [];
    // two long skylights along the hall, framed in steel
    for (const y of [cy - 5.5, cy + 5.5]) {
        top.push(rect(fr, min.x + 4, y - 1.2, max.x - 4, y + 1.2, `fill="#bcd7e3" stroke="#34404a" stroke-width="4"`));
        const mullions: string[] = [];
        for (let x = min.x + 7; x < max.x - 4; x += 3)
            mullions.push(`M${px(fr, x)} ${py(fr, y + 1.2)}V${py(fr, y - 1.2)}`);
        top.push(`<path d="${mullions.join("")}" stroke="#34404a" stroke-width="3" fill="none"/>`);
    }
    // the ridge vents along the centre line, a red and white exhaust stack in the north-east corner
    for (const x of [min.x + 8, min.x + 17, max.x - 17, max.x - 8]) {
        top.push(circleAt(fr, x, cy, 1.1, `fill="#5b6873" stroke="${INK}" stroke-width="3"`));
        top.push(circleAt(fr, x, cy, 0.6, `fill="#3a444c"`));
    }
    top.push(circleAt(fr, max.x - 3, max.y - 3, 1.6, `fill="#f2f2ee" stroke="${INK}" stroke-width="4"`));
    top.push(circleAt(fr, max.x - 3, max.y - 3, 1.0, `fill="#d8402f"`));
    top.push(circleAt(fr, max.x - 3, max.y - 3, 0.5, `fill="#2a2f35"`));
    return roof(L, "#7f95a3", "#5c6f7c", "#71879a", top.join(""));
}

// ---------------------------------------------------------------------------------------------------------------------
// the control building

export const CONTROL_FLOORS: FloorPalette = {
    control: { base: "#46525e", grid: "#3d4853", step: 1 },
    strongroom: { base: "#5f6b73", grid: "#545f67", step: 1 },
    corridor: { base: "#cfcac0", grid: "#bcb7ad", step: 2 },
    office: { base: "#6f7f66", grid: "#65745c", step: 1 },
    manager: { base: "#7e5f52", grid: "#735649", step: 1 },
};

export function controlFloor(): string {
    const L = PLANT_CONTROL.layout;
    const fr = floorFrameOf(L);
    const extra: string[] = [];
    // the strongroom door: a hazard strip on the control room's side of the sliding door's gap
    const [dx, dy] = local(PLANT_CONTROL, PLANT_STRONGROOM_DOOR.hinge.x, PLANT_STRONGROOM_DOOR.hinge.y);
    extra.push(hazardBand(fr, dx - 1.25, dy, dx - 0.5, dy + 4, "plant-strongroom-hazard"));
    // the switches' plates and the code note on the shift manager's floor
    for (const s of PLANT_SWITCHES) {
        const [x, y] = local(PLANT_CONTROL, s.x, s.y);
        extra.push(switchPlate(fr, x, y, SWITCH_PLATE_COLORS[s.label]));
    }
    const [nx, ny] = local(PLANT_CONTROL, PLANT_CODE_NOTE.x, PLANT_CODE_NOTE.y);
    extra.push(
        codeNote(
            fr,
            nx,
            ny,
            PLANT_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
        ),
    );
    // the control room's mimic board strip along its north wall: the grid in green and red lights
    const [mx0, my] = local(PLANT_CONTROL, -17, -8.75);
    const [mx1] = local(PLANT_CONTROL, -11.5, -8.75);
    extra.push(rect(fr, mx0, my - 0.15, mx1, my + 0.15, `fill="#79c37f"`));
    return floor(L, CONTROL_FLOORS, "#8f877a", INK, extra.join(""));
}

export function controlCeiling(): string {
    const L = PLANT_CONTROL.layout;
    const fr = frameOf(L);
    const { min, max } = L.bounds;
    const top: string[] = [];
    top.push(acUnit(fr, min.x + 5, min.y + 4), acUnit(fr, min.x + 12, min.y + 4), acUnit(fr, max.x - 6, min.y + 4));
    // the roof hatch over the corridor, the comms antenna over the control room
    const [hx, hy] = local(PLANT_CONTROL, -8, -22.5);
    top.push(rect(fr, hx - 1, hy - 1, hx + 1, hy + 1, `fill="#6d6a62" stroke="${INK}" stroke-width="3"`));
    const [ax, ay] = local(PLANT_CONTROL, -8, -13);
    top.push(circleAt(fr, ax, ay, 1.4, `fill="none" stroke="${INK}" stroke-width="3"`));
    top.push(circleAt(fr, ax, ay, 0.45, `fill="#d8402f" stroke="${INK}" stroke-width="2"`));
    // the strongroom: a raised concrete slab
    const [sx0, sy0] = local(PLANT_CONTROL, 5, -19);
    const [sx1, sy1] = local(PLANT_CONTROL, 16, -9);
    top.push(rect(fr, sx0, sy0, sx1, sy1, `fill="#9c8562" stroke="#7c6849" stroke-width="4"`));
    return roof(L, "#b49a74", "#8d7656", "#a58b66", top.join(""));
}
