// Floor and roof art of clinic_01 (packages/defs rebirth/buildings/clinic.ts): pale tiled rooms (mint treatment rooms,
// a blue pharmacy) with a faded cross in the lobby; a white roof with the red cross in a circle and AC units.
import { CLINIC_LAYOUT, REBIRTH_ART_PX_PER_UNIT as PX } from "../../../packages/defs/src/rebirth/buildings.ts";
import { acUnit, cross, type FloorPalette, floor, frameOf, px, py, roof } from "./svg.ts";

export const CLINIC_FLOORS: FloorPalette = {
    lobby: { base: "#d8d4cc", grid: "#c2bdb3", step: 2 },
    ward: { base: "#cde2da", grid: "#b3cec4", step: 2 },
    pharmacy: { base: "#d2dce8", grid: "#b9c7d7", step: 2 },
};

/** The clinic's red cross: on the roof (and the map shapes, buildings.ts). */
export const CLINIC_CROSS = { x: -9, y: 6.5, len: 5, width: 1.75 } as const;

export function clinicFloor(): string {
    const fr = frameOf(CLINIC_LAYOUT);
    // a faded cross on the lobby floor
    const extra = cross(fr, 0, -4.5, 4, 1.25, `fill="#c8312e" fill-opacity="0.18"`);
    return floor(CLINIC_LAYOUT, CLINIC_FLOORS, "#c7ccd0", "#25292c", extra);
}

export function clinicCeiling(): string {
    const fr = frameOf(CLINIC_LAYOUT);
    const c = CLINIC_CROSS;
    const top =
        `<circle cx="${px(fr, c.x)}" cy="${py(fr, c.y)}" r="${PX * 3.4}" fill="#ffffff" stroke="#2c3135" stroke-width="4"/>` +
        cross(fr, c.x, c.y, c.len, c.width, `fill="#c8312e"`) +
        acUnit(fr, 9, 7) +
        acUnit(fr, 12.5, 7) +
        acUnit(fr, 10.75, -6.5) +
        `<circle cx="${px(fr, 2)}" cy="${py(fr, -3)}" r="${PX * 0.6}" fill="#7d868c" stroke="#2c3135" stroke-width="3"/>` +
        `<circle cx="${px(fr, -3)}" cy="${py(fr, -7)}" r="${PX * 0.6}" fill="#7d868c" stroke="#2c3135" stroke-width="3"/>`;
    return roof(CLINIC_LAYOUT, "#e6e9eb", "#aab3b9", "#d3d8dc", top);
}
