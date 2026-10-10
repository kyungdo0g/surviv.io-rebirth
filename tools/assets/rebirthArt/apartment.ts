// Floor and roof art of apartment_01 (packages/defs rebirth/buildings/apartment.ts): a grey linoleum corridor, each
// flat with a parquet living room, a chequered kitchen, a blue-carpet bedroom and a white-tiled bathroom, a terrazzo
// lobby with the stair flight in its arm, the caretaker's wooden office and the concrete storeroom (a hazard strip at
// its sliding door, a plate under the switch); a clay-red roof with a skylight strip over the corridor, the stair
// housing and the water tank over the service wing, a vent and an AC unit per flat.
import {
    APARTMENT_FLATS,
    APARTMENT_LAYOUT,
    APARTMENT_STAIRS,
    APARTMENT_STORE_DOOR,
    APARTMENT_SWITCH,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    acUnit,
    circleAt,
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
    switchPlate,
} from "./svg.ts";

export const APARTMENT_FLOORS: FloorPalette = {
    corridor: { base: "#a7aca4", grid: "#979c94", step: 2 },
    living: { base: "#b98f62", grid: "#a77d52", step: 1 },
    kitchen: { base: "#e4e0d6", grid: "#bdb7aa", step: 1 },
    bedroom: { base: "#7f93ad", grid: "#74879f", step: 2 },
    bath: { base: "#e8eef0", grid: "#c9d4d8", step: 1 },
    lobby: { base: "#cfc8bb", grid: "#bdb5a7", step: 2 },
    office: { base: "#a5835d", grid: "#93724e", step: 1 },
    store: { base: "#8e8f88", grid: "#7e7f78", step: 4 },
};

const INK = "#2a2420";

/** Dark squares on every other cell of the flats' kitchens (a chequered tile floor). */
function kitchenChecks(fr: Frame): string {
    const out: string[] = [];
    for (const r of APARTMENT_LAYOUT.rooms.filter((q) => q.floor === "kitchen")) {
        for (let x = r.min.x; x < r.max.x - 1e-6; x++) {
            for (let y = r.min.y; y < r.max.y - 1e-6; y++) {
                if ((Math.floor(x) + Math.floor(y)) % 2 === 0) continue;
                out.push(rect(fr, x, y, Math.min(x + 1, r.max.x), Math.min(y + 1, r.max.y), `fill="#bfb8a9"`));
            }
        }
    }
    return out.join("");
}

/** The stair flight going up at the north end of the lobby's arm: treads, a handrail, an arrow. */
function stairs(fr: Frame): string {
    const { min, max } = APARTMENT_STAIRS;
    const out = [rect(fr, min.x, min.y, max.x, max.y, `fill="#b3ab9d"`)];
    for (let y = min.y + 0.5; y < max.y - 1e-6; y += 0.5) {
        out.push(`<path d="M${px(fr, min.x)} ${py(fr, y)}H${px(fr, max.x)}" stroke="#8b8476" stroke-width="3"/>`);
    }
    const mx = (min.x + max.x) / 2;
    out.push(
        `<path d="M${px(fr, mx)} ${py(fr, min.y + 0.6)}V${py(fr, max.y - 0.9)}" stroke="${INK}" stroke-width="4"/>`,
        `<path d="M${px(fr, mx - 0.6)} ${py(fr, max.y - 1.4)}L${px(fr, mx)} ${py(fr, max.y - 0.7)}L${px(fr, mx + 0.6)} ${py(fr, max.y - 1.4)}" stroke="${INK}" stroke-width="4" fill="none"/>`,
    );
    return out.join("");
}

/** A doormat inside each flat's front door, and the lobby's entrance mat. */
function mats(fr: Frame): string {
    const out = APARTMENT_FLATS.map((f) => {
        const [y0, y1] = f.north ? [3, 4.2] : [-4.2, -3];
        return rect(fr, f.x0 + 3.6, y0, f.x0 + 6.4, y1, `fill="#6e4b3a" stroke="${INK}" stroke-width="2"`);
    });
    out.push(rect(fr, 22.9, -15.5, 26.1, -13.9, `fill="#5b3f32" stroke="${INK}" stroke-width="2"`));
    return out.join("");
}

export function apartmentFloor(): string {
    const fr = floorFrameOf(APARTMENT_LAYOUT);
    const d = APARTMENT_STORE_DOOR.pos;
    const extra =
        kitchenChecks(fr) +
        stairs(fr) +
        mats(fr) +
        // the storeroom's sliding door: a hazard strip on the office side
        hazardBand(fr, d.x, d.y - 1.25, d.x + 4, d.y - 0.5, "apartment-store-hazard") +
        switchPlate(fr, APARTMENT_SWITCH.x - 0.3, APARTMENT_SWITCH.y, "#e2b425");
    return floor(APARTMENT_LAYOUT, APARTMENT_FLOORS, "#8a5a44", INK, extra);
}

/** The roof's water tank: a steel drum on the stair housing's east side. */
function waterTank(fr: Frame, x: number, y: number): string {
    return (
        circleAt(fr, x, y, 2.2, `fill="#9fa7ad" stroke="${INK}" stroke-width="4"`) +
        circleAt(fr, x, y, 1.5, `fill="none" stroke="#7d868c" stroke-width="3"`) +
        circleAt(fr, x, y, 0.4, `fill="#5d666c"`)
    );
}

/** A round roof vent. */
function vent(fr: Frame, x: number, y: number): string {
    return (
        circleAt(fr, x, y, 0.7, `fill="#6d757b" stroke="${INK}" stroke-width="3"`) +
        circleAt(fr, x, y, 0.35, `fill="#3f464b"`)
    );
}

export function apartmentCeiling(): string {
    const fr = frameOf(APARTMENT_LAYOUT);
    const out: string[] = [];
    // the skylight strip over the corridor: glass panes between steel ribs
    out.push(rect(fr, -30, -1.5, 16, 1.5, `fill="#8fb4c9" stroke="${INK}" stroke-width="4"`));
    for (let x = -26; x < 16; x += 4) {
        out.push(`<path d="M${px(fr, x)} ${py(fr, 1.5)}V${py(fr, -1.5)}" stroke="#55707f" stroke-width="3"/>`);
    }
    // the stair housing over the lobby's arm (a raised box with its door) and the water tank beside it
    out.push(
        rect(fr, 17.5, -3, 23, 7, `fill="#c9bcab" stroke="${INK}" stroke-width="4"`),
        rect(fr, 18.5, -2, 22, 6, `fill="none" stroke="#a89a88" stroke-width="3"`),
        rect(fr, 19, -3.4, 21.5, -2.6, `fill="#6e5848" stroke="${INK}" stroke-width="2"`),
        waterTank(fr, 27, 10.5),
    );
    // a vent and an AC unit over each flat
    for (const f of APARTMENT_FLATS) {
        const s = f.north ? 1 : -1;
        out.push(vent(fr, f.x0 + 11.5, s * 11.5), acUnit(fr, f.x0 + 4, s * 9.5));
    }
    out.push(acUnit(fr, 27, -9), acUnit(fr, 27, 1.5));
    return roof(APARTMENT_LAYOUT, "#a2624b", "#7a4636", "#8f5541", out.join(""));
}
