// Floor and roof art of the abandoned subway station (packages/defs rebirth/buildings/subway.ts, subwayStation.ts).
// The kiosk: grimy cream tiles, the flight going down south (lightest at its top, where the shutter stands) with a
// yellow nosing, a hazard strip before the shutter, a route map on the wall, litter; its roof a flat concrete slab with
// rust streaks, a vent and the metro sign (a blue disc with a white M) over the stairs.
// The station: the ticket hall's terrazzo with the three line colours painted from the stairs' foot to the fare line,
// the turnstile cabinets (rail_4 has no sprite: the floor draws them), the platform's paving with its yellow edge line
// and tactile strip, the track bed's ballast, sleepers and rails (under the car only its floor), puddles, the caved-in
// tunnel mouths (rubble dust before the end walls, the mouth bricked dark on the wall), the derelict car's ribbed floor
// and seat bays, the maintenance rooms' concrete and pipes, the ticket office's lino, the station master's carpet with
// the line code's note, the safe's riveted steel with a hazard border and a coloured plate under each code switch; the
// stairwell's flight seen from below. The dark roof is flat grey (the game tints it) with seams on a 4-unit grid.
import {
    REBIRTH_ART_PX_PER_UNIT as PX,
    SUBWAY_CAR,
    SUBWAY_CODE,
    SUBWAY_ENTRANCE_LAYOUT,
    SUBWAY_FARE_LINE_Y,
    SUBWAY_GATE_AT,
    SUBWAY_NOTE,
    SUBWAY_PLATFORM_EDGE,
    SUBWAY_PLATFORM_LAYOUT,
    SUBWAY_RAILS,
    SUBWAY_SAFE_DOOR,
    SUBWAY_SIGN,
    SUBWAY_STAIR,
    SUBWAY_SWITCHES,
    SUBWAY_TURNSTILES,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    circleAt,
    codeNote,
    type FloorPalette,
    type Frame,
    f2,
    floor,
    floorFrameOf,
    frameOf,
    hazardBand,
    hex,
    polygon,
    px,
    py,
    rect,
    roof,
    SWITCH_PLATE_COLORS,
    svg,
    switchPlate,
} from "./svg.ts";

const INK = "#1b1d1f";
const YELLOW = "#d9b12c";

type Seg = readonly [x0: number, y0: number, x1: number, y1: number];

/** Line segments as one stroked path, `w` units wide. */
function strokes(fr: Frame, segs: readonly Seg[], color: string, w: number, extra = ""): string {
    const d = segs.map(([x0, y0, x1, y1]) => `M${px(fr, x0)} ${py(fr, y0)}L${px(fr, x1)} ${py(fr, y1)}`).join("");
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f2(w * PX)}" ${extra}/>`;
}

/** `a` to `b` by t (hex colours). */
function mix(a: string, b: string, t: number): string {
    const ch = (c: string, i: number) => Number.parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
    return `#${[0, 1, 2]
        .map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
}

/** A small deterministic scatter (no Math.random: the committed files must be reproducible). */
function scatter(n: number, seed: number): Array<[number, number]> {
    let s = seed >>> 0;
    const next = () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
    return Array.from({ length: n }, () => [next(), next()] as [number, number]);
}

/**
 * Stair treads across the box (0.5 deep, down south: the top end at y1 lightest, the foot at y0 darkest), a dark nosing
 * shadow on each and a yellow safety edge on the top step.
 */
function treads(fr: Frame, [x0, y0, x1, y1]: Seg, light: string, dark: string): string {
    const n = Math.round((y1 - y0) / 0.5);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        const top = y1 - i * 0.5;
        out.push(rect(fr, x0, top - 0.5, x1, top, `fill="${mix(light, dark, i / (n - 1))}"`));
        out.push(rect(fr, x0, top - 0.5, x1, top - 0.42, `fill="#00000059"`));
    }
    out.push(rect(fr, x0, y1 - 0.16, x1, y1, `fill="${YELLOW}"`));
    return out.join("");
}

// ---------------------------------------------------------------------------------------------------------------------
// the kiosk

const KIOSK_FLOORS: FloorPalette = {
    kiosk: { base: "#c9c0ad", grid: "#b5ac99", step: 1 },
    stairs: { base: "#8d8f89", grid: "#8d8f89", step: 64 },
};

export function subwayEntranceFloor(): string {
    const fr = floorFrameOf(SUBWAY_ENTRANCE_LAYOUT);
    const [x0, y0, x1, y1] = SUBWAY_STAIR.box;
    const g = SUBWAY_GATE_AT;
    // grime: darker blotches and scattered litter in the aisles
    const blotches = scatter(9, 7).map(([u, v], i) =>
        circleAt(fr, -6.3 + u * 12.6, 17.5 + v * 10.5, 0.5 + (i % 3) * 0.35, `fill="#8a806c" opacity="0.35"`),
    );
    const litter = scatter(10, 21)
        .filter(([u]) => Math.abs(-6.2 + u * 12.4) > 3.4)
        .map(([u, v], i) => {
            const x = -6.2 + u * 12.4;
            const y = 17.6 + v * 10;
            return rect(fr, x - 0.3, y - 0.2, x + 0.3, y + 0.2, `fill="${i % 2 ? "#e9e4d6" : "#b9c4cc"}"`);
        });
    const extra =
        blotches.join("") +
        litter.join("") +
        treads(fr, [x0, y0, x1, y1], "#a6a8a1", "#3f413d") +
        // a hazard strip before the shutter and a doormat inside the doorway
        hazardBand(fr, g.x - 2, g.y + 0.5, g.x + 2, g.y + 1.1, "kiosk-gate-hazard") +
        rect(fr, -1.8, 26.9, 1.8, 27.9, `fill="#5f5a4f" stroke="#4a463d" stroke-width="3"`) +
        // the route map on the west aisle's wall: a pale board with the three lines
        rect(fr, -6.45, 18, -5.95, 21, `fill="#efe8d6" stroke="${INK}" stroke-width="2"`) +
        ["#c8312e", "#e2b425", "#2f6fd0"]
            .map((c, i) => rect(fr, -6.37, 18.4 + i * 0.9, -6.03, 18.9 + i * 0.9, `fill="${c}"`))
            .join("");
    return floor(SUBWAY_ENTRANCE_LAYOUT, KIOSK_FLOORS, "#6f7276", INK, extra);
}

/** The metro sign: a blue disc with a white rim and a block M. */
function metroSign(fr: Frame): string {
    const { x, y, r } = SUBWAY_SIGN;
    const w = r * 0.62;
    const h = r * 0.62;
    const m: ReadonlyArray<readonly [number, number]> = [
        [x - w, y - h],
        [x - w, y + h],
        [x - w * 0.55, y + h],
        [x, y + h * 0.15],
        [x + w * 0.55, y + h],
        [x + w, y + h],
        [x + w, y - h],
        [x + w * 0.6, y - h],
        [x + w * 0.6, y + h * 0.35],
        [x, y - h * 0.45],
        [x - w * 0.6, y + h * 0.35],
        [x - w * 0.6, y - h],
    ];
    return (
        circleAt(fr, x, y, r + 0.3, `fill="${hex(SUBWAY_SIGN.letter)}" stroke="${INK}" stroke-width="4"`) +
        circleAt(fr, x, y, r, `fill="${hex(SUBWAY_SIGN.disc)}"`) +
        polygon(fr, m, `fill="${hex(SUBWAY_SIGN.letter)}"`)
    );
}

export function subwayEntranceCeiling(): string {
    const fr = frameOf(SUBWAY_ENTRANCE_LAYOUT);
    // rust streaks running down from the parapet, a roof vent, the sign over the stairs
    const streaks = [
        [-5.5, 28, -5.2, 24.5],
        [-3.5, 17, -3.3, 19.5],
        [4.5, 28, 4.8, 25.5],
        [5.8, 17, 5.6, 20.5],
    ].map(([a, b, c, d]) =>
        polygon(
            fr,
            [
                [a, b],
                [a + 0.6, b],
                [c + 0.3, d],
                [c, d],
            ],
            `fill="#7a5a3c" opacity="0.45"`,
        ),
    );
    const vent =
        rect(fr, -5.6, 17.6, -3.6, 19.6, `fill="#8e969c" stroke="#2c3135" stroke-width="3"`) +
        strokes(
            fr,
            [0.2, 0.6, 1, 1.4, 1.8].map((t) => [-5.4, 17.6 + t, -3.8, 17.6 + t] as Seg),
            "#555d63",
            0.08,
        );
    return roof(SUBWAY_ENTRANCE_LAYOUT, "#6a7178", "#4f565c", "#60676e", streaks.join("") + vent + metroSign(fr));
}

// ---------------------------------------------------------------------------------------------------------------------
// the station

const STATION_FLOORS: FloorPalette = {
    trackbed: { base: "#4b463f", grid: "#4b463f", step: 64 },
    car: { base: "#5f666b", grid: "#565c61", step: 0.5 },
    platform: { base: "#8f8c84", grid: "#84817a", step: 2 },
    hall: { base: "#b4ad9f", grid: "#a59e90", step: 1 },
    workshop: { base: "#7c7970", grid: "#716e66", step: 4 },
    pump: { base: "#6c7774", grid: "#626c69", step: 2 },
    ticket: { base: "#9a8d77", grid: "#8e826d", step: 1 },
    office: { base: "#6b4a3c", grid: "#6b4a3c", step: 64 },
    safe: { base: "#56606a", grid: "#4d565f", step: 1 },
    stairwell: { base: "#7a7c76", grid: "#70726c", step: 2 },
};

/** Station concrete, a little darker than the street's; the car's steel. */
const WALLS = { concrete: "#4c4e49", metal: "#6a757d" } as const;

const CAR = SUBWAY_CAR;
const outsideCar = (x0: number, x1: number): Array<[number, number]> =>
    [
        [x0, CAR.min.x - 0.5],
        [CAR.max.x + 0.5, x1],
    ].filter(([a, b]) => b - a > 0.01) as Array<[number, number]>;

/** The track bed: ballast speckle, sleepers every 1.5 and the two rails, not under the car; puddles. */
function trackbed(fr: Frame): string {
    const out: string[] = [];
    const [r0, r1] = SUBWAY_RAILS;
    for (const [a, b] of outsideCar(-31.5, 31.5)) {
        for (const [u, v] of scatter(Math.round((b - a) * 6), Math.round(a * 10) + 99)) {
            const x = a + u * (b - a);
            const y = -15.5 + v * 9.4;
            out.push(rect(fr, x - 0.08, y - 0.08, x + 0.08, y + 0.08, `fill="#6a645b"`));
        }
        for (let x = Math.ceil(a / 1.5) * 1.5; x < b - 0.4; x += 1.5) {
            out.push(rect(fr, x, r0 - 1.1, x + 0.55, r1 + 1.1, `fill="#5d4a36" stroke="#3a2f24" stroke-width="2"`));
        }
        out.push(
            strokes(
                fr,
                [
                    [a, r0, b, r0],
                    [a, r1, b, r1],
                ],
                "#2a2c2e",
                0.36,
            ),
        );
        out.push(
            strokes(
                fr,
                [
                    [a, r0, b, r0],
                    [a, r1, b, r1],
                ],
                "#9aa3a8",
                0.14,
            ),
        );
    }
    // standing water from the leaks
    for (const [x, y, rx] of [
        [-21, -14.2, 1.6],
        [19.5, -12.5, 1.2],
        [26, -8, 1.4],
    ] as const) {
        out.push(
            `<ellipse cx="${px(fr, x)}" cy="${py(fr, y)}" rx="${f2(rx * PX)}" ry="${f2(rx * 0.55 * PX)}" fill="#33454f" opacity="0.7"/>`,
        );
    }
    return out.join("");
}

/** The platform's edge: a yellow safety line with a tactile strip of studs behind it. */
function platformEdge(fr: Frame): string {
    const y = SUBWAY_PLATFORM_EDGE;
    const studs: string[] = [];
    for (let x = -31.25; x < 20.8; x += 0.5) studs.push(circleAt(fr, x, y + 0.85, 0.1, `fill="#c9a62a"`));
    return (
        rect(fr, -31.5, y, 20.5, y + 0.4, `fill="${YELLOW}"`) +
        rect(fr, -31.5, y + 0.55, 20.5, y + 1.15, `fill="#e2c35a"`) +
        studs.join("") +
        rect(fr, -31.5, y - 0.12, 20.5, y, `fill="#2b2d2f"`)
    );
}

/** The caved-in tunnels: rubble dust spread before each end wall. */
function rubbleDust(fr: Frame): string {
    const dust = (sx: number) =>
        polygon(
            fr,
            [
                [sx * 31.5, -15.5],
                [sx * 23, -15.5],
                [sx * 21.5, -13.5],
                [sx * 24, -11],
                [sx * 26.5, -8.5],
                [sx * 29, -6.2],
                [sx * 31.5, -6.2],
            ],
            `fill="#6e6458" opacity="0.8"`,
        );
    const chips = (sx: number) =>
        scatter(26, sx > 0 ? 5 : 11)
            .map(([u, v]) => [sx * (22.5 + u * 8.5), -15.2 + v * 8.6] as const)
            .map(([x, y]) => rect(fr, x - 0.14, y - 0.12, x + 0.14, y + 0.12, `fill="#8b8072"`))
            .join("");
    return dust(-1) + dust(1) + chips(-1) + chips(1);
}

/** The ticket hall: the three line colours from the stairs' foot to the fare line, the turnstile cabinets. */
function hall(fr: Frame): string {
    const lines = [
        ["#c8312e", -1.2],
        ["#e2b425", 0],
        ["#2f6fd0", 1.2],
    ] as const;
    const out: string[] = lines.map(([c, dx]) => strokes(fr, [[dx, 15.4, dx, 7.2]], c, 0.4));
    // the fare line: a dark strip under the cabinets, each cabinet with its card reader and arm
    out.push(rect(fr, -13.5, SUBWAY_FARE_LINE_Y - 0.15, 13.5, SUBWAY_FARE_LINE_Y + 0.15, `fill="#3a3c3e"`));
    for (const x of SUBWAY_TURNSTILES) {
        const y = SUBWAY_FARE_LINE_Y;
        out.push(rect(fr, x - 0.4, y - 2.5, x + 0.4, y + 2.5, `fill="#8d969c" stroke="${INK}" stroke-width="3"`));
        out.push(rect(fr, x - 0.25, y + 0.6, x + 0.25, y + 1.2, `fill="#3c8f4a"`));
        out.push(strokes(fr, [[x + 0.4, y, x + 1.4, y]], "#c3c9cc", 0.14));
    }
    return out.join("");
}

/** The car: a dark aisle runner, the seat bays' outlines are the couches' own sprites; door sills at each gap. */
function car(fr: Frame): string {
    const sills = CAR.doors.map(([a, b]) => rect(fr, a, CAR.max.y - 0.5, b, CAR.max.y + 0.5, `fill="#8d969c"`));
    return rect(fr, CAR.min.x + 0.5, -11.4, CAR.max.x - 0.5, -8.6, `fill="#50565a"`) + sills.join("");
}

/** Pipes along the pump room's walls and the workshop's oil stains. */
function maintenance(fr: Frame): string {
    const pipes = strokes(
        fr,
        [
            [-22.2, 4.8, -22.2, 12.8],
            [-14.8, 4.8, -14.8, 9.2],
        ],
        "#4f6f86",
        0.32,
    );
    const stains = [
        [-27.8, 9.8, 1.1],
        [-25, 5.8, 0.7],
    ].map(([x, y, r]) => circleAt(fr, x, y, r, `fill="#3d3a33" opacity="0.4"`));
    return pipes + stains.join("");
}

/** The station master's carpet border, the code's note; the safe's hazard border and its door's hall strip. */
function officeAndSafe(fr: Frame): string {
    const plates = SUBWAY_SWITCHES.map((sw) => switchPlate(fr, sw.x, sw.y, SWITCH_PLATE_COLORS[sw.label]));
    const note = codeNote(
        fr,
        SUBWAY_NOTE.x,
        SUBWAY_NOTE.y,
        SUBWAY_CODE.map((c) => SWITCH_PLATE_COLORS[c]),
    );
    const carpet = rect(fr, 23.2, 5.2, 30.8, 14.8, `fill="none" stroke="#8a5f3f" stroke-width="6"`);
    const d = SUBWAY_SAFE_DOOR.pos;
    const strip = hazardBand(fr, d.x - 4, d.y + 0.5, d.x, d.y + 1.1, "safe-door-strip");
    const rivets: string[] = [];
    for (let x = 22; x <= 31; x += 1) {
        for (let y = -5; y <= 3; y += 1) rivets.push(circleAt(fr, x, y, 0.07, `fill="#41494f"`));
    }
    const border = [
        [21.5, -5.5, 31.5, -4.9],
        [21.5, 2.9, 23.5, 3.5],
        [21.5, -4.9, 22.1, 2.9],
    ].map(([a, b, c, e], i) => hazardBand(fr, a, b, c, e, `safe-border-${i}`));
    return carpet + note + plates.join("") + strip + rivets.join("") + border.join("");
}

/** The stairwell's flight seen from below (the foot, south, darkest). */
function flightBelow(fr: Frame): string {
    const [x0, y0, x1, y1] = SUBWAY_STAIR.box;
    return treads(fr, [x0, y0, x1, y1], "#8f918b", "#4c4e4a") + rect(fr, x0, y0 - 1, x1, y0, `fill="#7a7c76"`);
}

/** The tunnel mouths, over the end walls: dark bricked arches the rubble lies against. */
function tunnelMouths(fr: Frame): string {
    return [-1, 1]
        .map((sx) => {
            const x = sx * 32;
            return (
                rect(fr, x - 0.5, -15.5, x + 0.5, -6.5, `fill="#26231f"`) +
                strokes(
                    fr,
                    [-14, -12, -10, -8].map((y) => [x - 0.5, y, x + 0.5, y] as Seg),
                    "#4a443c",
                    0.1,
                )
            );
        })
        .join("");
}

export function subwayPlatformFloor(): string {
    const fr = floorFrameOf(SUBWAY_PLATFORM_LAYOUT);
    const extra =
        trackbed(fr) +
        rubbleDust(fr) +
        car(fr) +
        platformEdge(fr) +
        hall(fr) +
        maintenance(fr) +
        officeAndSafe(fr) +
        flightBelow(fr);
    // `view` given: the stairwell's walls are not clipped to the roof's frame
    const out = floor(SUBWAY_PLATFORM_LAYOUT, STATION_FLOORS, WALLS, INK, extra, fr);
    return out.replace("</svg>", `${tunnelMouths(fr)}</svg>`);
}

export function subwayPlatformCeiling(): string {
    const fr = frameOf(SUBWAY_PLATFORM_LAYOUT);
    const { min, max } = SUBWAY_PLATFORM_LAYOUT.bounds;
    const [x0, y0, x1, y1] = [min.x - 0.5, min.y - 0.5, max.x + 0.5, max.y + 0.5];
    const seams: Seg[] = [];
    for (let x = Math.ceil(x0 / 4) * 4; x <= x1; x += 4) seams.push([x, y0, x, y1]);
    for (let y = Math.ceil(y0 / 4) * 4; y <= y1; y += 4) seams.push([x0, y, x1, y]);
    const body =
        rect(fr, x0, y0, x1, y1, `fill="#6b6e6a"`) +
        strokes(fr, seams, "#616460", 4 / PX) +
        rect(fr, x0, y0, x1, y1, `fill="none" stroke="#5d605c" stroke-width="${PX}"`);
    return svg(fr, body);
}
