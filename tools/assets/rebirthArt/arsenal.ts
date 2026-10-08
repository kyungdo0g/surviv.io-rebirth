// Floor and roof art of arsenal_01 (packages/defs rebirth/buildings/arsenal.ts).
import { ARSENAL_LAYOUT } from "../../../packages/defs/src/rebirth/buildings.ts";
import { type FloorPalette, floor, roof } from "./svg.ts";

export const ARSENAL_FLOORS: FloorPalette = {
    corridor: { base: "#7f827b", grid: "#73766f", step: 4 },
    magazine: { base: "#5f625c", grid: "#565953", step: 1 },
};

export function arsenalFloor(): string {
    return floor(ARSENAL_LAYOUT, ARSENAL_FLOORS, { concrete: "#4f524c", metal: "#5d6a73" }, "#161816");
}

export function arsenalCeiling(): string {
    return roof(ARSENAL_LAYOUT, "#4f524c", "#3e403b", "#474a44", "");
}
