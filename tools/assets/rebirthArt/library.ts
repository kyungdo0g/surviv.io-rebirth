// Floor and roof art of library_01 (packages/defs rebirth/buildings/library.ts).
import { LIBRARY_LAYOUT } from "../../../packages/defs/src/rebirth/buildings.ts";
import { type FloorPalette, floor, roof } from "./svg.ts";

export const LIBRARY_FLOORS: FloorPalette = {
    stacks: { base: "#b9895a", grid: "#a67a4e", step: 1 },
    reading: { base: "#5f7d5a", grid: "#56724f", step: 2 },
    foyer: { base: "#e0dccf", grid: "#c9c3b2", step: 2 },
    archive: { base: "#7a3a32", grid: "#6c322b", step: 2 },
};

export function libraryFloor(): string {
    return floor(LIBRARY_LAYOUT, LIBRARY_FLOORS, "#cdbf9f", "#2b2520");
}

export function libraryCeiling(): string {
    return roof(LIBRARY_LAYOUT, "#5d4a7a", "#a69f8d", "#6a5788", "");
}
