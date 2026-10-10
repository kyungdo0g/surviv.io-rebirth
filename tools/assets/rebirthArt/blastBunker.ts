// Floor and roof art of the blast bunker (packages/defs rebirth/buildings/blastBunker.ts). The entrance block: a worn
// concrete guard post round the stairwell, the landing behind the blast door in yellow and black, the flight going down
// north in darkening treads; its roof is dark olive concrete with a hazard band over the blast door, a yellow warning
// triangle and two ventilation hoods, so it reads as "keep out, heavy door" at a glance. The vault complex underground:
// the entry hall's grey plate with a yellow guide line from the stairs, the medical store's white tiles with a red cross,
// the ammunition store's striped bays, the armoury's riveted steel plate with a red-lined launcher rack, the
// commander's dark red carpet with a gold border, the flight seen from below in the stairwell; a flat dark roof (the
// game tints it 0x5f5f5f) with seams on a 4-unit grid.
import {
    BLAST_BUNKER_AMMO_CRATES,
    BLAST_BUNKER_ENTRANCE_LAYOUT,
    BLAST_BUNKER_RACK,
    BLAST_BUNKER_STAIRS,
    BLAST_BUNKER_VAULT_LAYOUT,
    BLAST_BUNKER_VAULT_ROOF,
    REBIRTH_ART_PX_PER_UNIT as PX,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import {
    boxFrame,
    circleAt,
    cross,
    type FloorPalette,
    type Frame,
    f2,
    floor,
    floorFrameOf,
    frameOf,
    hazardBand,
    polygon,
    px,
    py,
    rect,
    roof,
    svg,
} from "./svg.ts";

const INK = "#1b1d1a";
const YELLOW = "#d8b02c";
const TREAD_TOP = "#b4b7b0";
const TREAD_BOTTOM = "#3f423f";

export const BLAST_ENTRANCE_FLOORS: FloorPalette = {
    guard: { base: "#9a998f", grid: "#8c8b82", step: 2 },
    landing: { base: "#6f7169", grid: "#6f7169", step: 1 },
    stairs: { base: "#8e918b", grid: "#8e918b", step: 1 },
};

export const BLAST_VAULT_FLOORS: FloorPalette = {
    hall: { base: "#7b807b", grid: "#6f746f", step: 2 },
    medical: { base: "#d8dbd5", grid: "#c3c7c0", step: 1 },
    ammo: { base: "#6d695c", grid: "#625e52", step: 2 },
    armoury: { base: "#5b646a", grid: "#515a60", step: 2 },
    command: { base: "#6a3b33", grid: "#61352e", step: 4 },
    stairs: { base: "#55574f", grid: "#55574f", step: 1 },
};

/** Bunker concrete, darker than the surface's. */
const WALLS = { concrete: "#4a4c47", metal: "#5d6a73" } as const;

type Box = readonly [number, number, number, number];

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

/**
 * The flight going down north (the stairs' downDir): 0.5 treads from TREAD_TOP at its top (south) end to TREAD_BOTTOM
 * at its foot, a dark nosing on each tread and a yellow strip where the drop starts.
 */
function flight(fr: Frame): string {
    const [x0, y0, x1, y1] = BLAST_BUNKER_STAIRS.collision;
    const n = Math.round((y1 - y0) / 0.5);
    const out: string[] = [];
    const nosing: string[] = [];
    for (let i = 0; i < n; i++) {
        const y = y0 + i * 0.5;
        out.push(rect(fr, x0, y, x1, y + 0.5, `fill="${mix(TREAD_TOP, TREAD_BOTTOM, i / (n - 1))}"`));
        if (i > 0) nosing.push(`M${px(fr, x0)} ${py(fr, y)}H${px(fr, x1)}`);
    }
    out.push(`<path d="${nosing.join("")}" stroke="#202220" stroke-opacity="0.5" stroke-width="3" fill="none"/>`);
    out.push(rect(fr, x0, y0, x1, y0 + 0.18, `fill="${YELLOW}"`));
    return out.join("");
}

/** A rect outline (world box) `w` units wide. */
function outline(fr: Frame, [x0, y0, x1, y1]: Box, color: string, w: number, extra = ""): string {
    return rect(fr, x0, y0, x1, y1, `fill="none" stroke="${color}" stroke-width="${f2(w * PX)}" ${extra}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// the entrance block

export function blastEntranceFloor(): string {
    const fr = floorFrameOf(BLAST_BUNKER_ENTRANCE_LAYOUT);
    // the landing behind the blast door: a yellow and black border round dark plate
    const landing =
        hazardBand(fr, -2, -6.5, 2, -4, "blast-landing") + rect(fr, -1.4, -6.1, 1.4, -4.4, `fill="#5b5d56"`);
    // a floor drain in the east wing
    const drain = circleAt(fr, 5.25, -4, 0.45, `fill="#5d5c55" stroke="${INK}" stroke-width="2"`);
    return floor(BLAST_BUNKER_ENTRANCE_LAYOUT, BLAST_ENTRANCE_FLOORS, "#5f625a", INK, landing + flight(fr) + drain);
}

/** A ventilation hood on the roof: a steel box with a dark slatted grille. */
function hood(fr: Frame, x: number, y: number): string {
    const slats: string[] = [];
    for (let i = -2; i <= 2; i++) slats.push(`M${px(fr, x - 1.1)} ${py(fr, y + i * 0.35)}H${px(fr, x + 1.1)}`);
    return (
        rect(fr, x - 1.5, y - 1.2, x + 1.5, y + 1.2, `fill="#8d938f" stroke="${INK}" stroke-width="3"`) +
        rect(fr, x - 1.15, y - 0.9, x + 1.15, y + 0.9, `fill="#3d413f"`) +
        `<path d="${slats.join("")}" stroke="#7a807c" stroke-width="3" fill="none"/>`
    );
}

export function blastEntranceCeiling(): string {
    const fr = frameOf(BLAST_BUNKER_ENTRANCE_LAYOUT);
    // the hazard band along the south edge over the blast door, a warning triangle with an exclamation mark
    const band = hazardBand(fr, -7.5, -6.5, 7.5, -4.75, "blast-roof-band");
    const tri = polygon(
        fr,
        [
            [0, 4.6],
            [-3.6, -1.6],
            [3.6, -1.6],
        ],
        `fill="${YELLOW}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"`,
    );
    const mark = rect(fr, -0.35, 0.2, 0.35, 3, `fill="${INK}"`) + circleAt(fr, 0, -0.55, 0.42, `fill="${INK}"`);
    const top = band + tri + mark + hood(fr, -5.25, 3.5) + hood(fr, 5.25, 3.5);
    return roof(BLAST_BUNKER_ENTRANCE_LAYOUT, "#646a5a", "#4f5447", "#5a604f", top);
}

// ---------------------------------------------------------------------------------------------------------------------
// the vault complex

/** Small rivets at the corners of each `step`-unit plate of the box. */
function rivets(fr: Frame, [x0, y0, x1, y1]: Box, step: number, color: string): string {
    const out: string[] = [];
    for (let x = x0; x < x1 - 1e-6; x += step) {
        for (let y = y0; y < y1 - 1e-6; y += step) {
            for (const [cx, cy] of [
                [x + 0.22, y + 0.22],
                [x + step - 0.22, y + 0.22],
                [x + 0.22, y + step - 0.22],
                [x + step - 0.22, y + step - 0.22],
            ] as const) {
                out.push(circleAt(fr, cx, cy, 0.08, `fill="${color}"`));
            }
        }
    }
    return out.join("");
}

function vaultMarkings(fr: Frame): string {
    const out: string[] = [];
    // the stairwell from below and the landing strip at its foot
    out.push(flight(fr), rect(fr, -2, 2, 2, 2.5, `fill="#7a7c76"`));
    // the hall: a yellow guide line from the stairs' door to the two north doors, a stop line inside the door
    const guide = `M${px(fr, 0)} ${py(fr, 4)}V${py(fr, 10.5)}M${px(fr, -3)} ${py(fr, 10.5)}H${px(fr, 3)}`;
    out.push(`<path d="${guide}" stroke="${YELLOW}" stroke-width="${f2(0.2 * PX)}" fill="none"/>`);
    out.push(rect(fr, -2, 4.6, 2, 4.85, `fill="#d6d1c1"`));
    // the medical store: a red cross in the middle of its free floor
    out.push(cross(fr, -11, 9, 3, 1, `fill="#c8312e" stroke="#7d1d1b" stroke-width="2"`));
    // the ammunition store: yellow and black bay lines round its crates, a red-bordered launcher-round spot
    BLAST_BUNKER_AMMO_CRATES.forEach((c, i) => {
        const [hw, hh] = [c.w / 2 + 0.35, c.h / 2 + 0.35];
        out.push(hazardBand(fr, c.x - hw, c.y - hh, c.x + hw, c.y + hh, `blast-ammo-pad-${i}`));
    });
    out.push(outline(fr, [8.1, 8.1, 10.9, 10.9], "#b3302b", 0.15));
    // the armoury: riveted steel plate, a red-lined rack spot for the spare launcher
    out.push(rivets(fr, [-18, 13, 0, 31], 2, "#4b5358"));
    const { x, y } = BLAST_BUNKER_RACK;
    out.push(rect(fr, x - 1.6, y - 0.9, x + 1.6, y + 0.9, `fill="#3f474c"`));
    out.push(outline(fr, [x - 1.6, y - 0.9, x + 1.6, y + 0.9], "#c8312e", 0.15));
    // the commander's room: a gold border inside the carpet's edge, a darker panel under the desk
    out.push(outline(fr, [1.4, 14.4, 16.6, 29.6], "#c69a3a", 0.15));
    out.push(rect(fr, 3.5, 16.25, 14.5, 22.75, `fill="#57302a"`));
    out.push(outline(fr, [3.5, 16.25, 14.5, 22.75], "#8a5a3a", 0.1));
    return out.join("");
}

export function blastVaultFloor(): string {
    const L = BLAST_BUNKER_VAULT_LAYOUT;
    const fr = floorFrameOf(L);
    // drawn through a view of the whole floor frame, so the stairwell's walls (outside the roof frame) are not clipped
    return floor(L, BLAST_VAULT_FLOORS, WALLS, INK, vaultMarkings(fr), fr);
}

/** The dark roof: flat mid grey with seams on the 4-unit grid and a darker band inside its edges. */
export function blastVaultCeiling(): string {
    const { centre, size } = BLAST_BUNKER_VAULT_ROOF;
    const fr = boxFrame(centre.x, centre.y, size[0], size[1]);
    const [x0, y0] = [centre.x - size[0] / 2, centre.y - size[1] / 2];
    const [x1, y1] = [centre.x + size[0] / 2, centre.y + size[1] / 2];
    const seams: string[] = [];
    for (let x = Math.ceil(x0 / 4) * 4; x <= x1; x += 4) seams.push(`M${px(fr, x)} ${py(fr, y1)}V${py(fr, y0)}`);
    for (let y = Math.ceil(y0 / 4) * 4; y <= y1; y += 4) seams.push(`M${px(fr, x0)} ${py(fr, y)}H${px(fr, x1)}`);
    // only the vault and the stairwell are roofed: the corners beside the stairwell stay clear
    const vault = rect(fr, -18.5, 2.5, 18.5, 31.5, `fill="#6b6e6a"`);
    const well = rect(fr, -3, -5, 3, 2.5, `fill="#6b6e6a"`);
    const clip =
        `<defs><clipPath id="blast-roof"><path d="M${px(fr, -18.5)} ${py(fr, 31.5)}H${px(fr, 18.5)}V${py(fr, 2.5)}` +
        `H${px(fr, 3)}V${py(fr, -5)}H${px(fr, -3)}V${py(fr, 2.5)}H${px(fr, -18.5)}Z"/></clipPath></defs>`;
    const band =
        outline(fr, [-18.25, 2.75, 18.25, 31.25], "#5d605c", 0.5) +
        outline(fr, [-2.75, -4.75, 2.75, 2.5], "#5d605c", 0.5);
    const body =
        clip +
        `<g clip-path="url(#blast-roof)">${vault}${well}` +
        `<path d="${seams.join("")}" stroke="#616460" stroke-width="4" fill="none"/>${band}</g>`;
    return svg(fr, body, 8);
}
