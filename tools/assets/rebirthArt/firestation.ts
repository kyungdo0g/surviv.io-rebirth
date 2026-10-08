// Floor and roof art of firestation_01 (packages/defs rebirth/buildings/firestation.ts).
import { FIRESTATION_LAYOUT } from "../../../packages/defs/src/rebirth/buildings.ts";
import { type FloorPalette, floor, roof } from "./svg.ts";

export const FIRESTATION_FLOORS: FloorPalette = {
    bay: { base: "#8f9294", grid: "#818487", step: 4 },
    office: { base: "#b9c3cc", grid: "#a7b2bc", step: 2 },
    crew: { base: "#b08a62", grid: "#9c7a55", step: 1 },
    tower: { base: "#7a7d80", grid: "#6c6f72", step: 1 },
    apron: { base: "#5f6366", grid: "#5f6366", step: 4 },
};

export function firestationFloor(): string {
    return floor(FIRESTATION_LAYOUT, FIRESTATION_FLOORS, "#9c4a3c", "#2a1c18");
}

export function firestationCeiling(): string {
    return roof(FIRESTATION_LAYOUT, "#cf2e28", "#9e2420", "#c02a24", "");
}
