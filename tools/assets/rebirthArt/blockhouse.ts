// Floor and roof art of the blockhouses (packages/defs rebirth/buildings/blockhouse.ts).
import { BLOCKHOUSE_LAYOUT } from "../../../packages/defs/src/rebirth/buildings.ts";
import { type FloorPalette, floor, roof } from "./svg.ts";

export const BLOCKHOUSE_FLOORS: FloorPalette = {
    chamber: { base: "#8a8478", grid: "#77726a", step: 2 },
};

export function blockhouseFloor(): string {
    return floor(BLOCKHOUSE_LAYOUT, BLOCKHOUSE_FLOORS, "#7d776b", "#1f2224");
}

export function blockhouseCeiling(_color: string): string {
    return roof(BLOCKHOUSE_LAYOUT, "#aca696", "#8f897b", "#a29c8d", "");
}
