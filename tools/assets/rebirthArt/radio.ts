// Floor and roof art of radio_station_01 (packages/defs rebirth/buildings/radio.ts).
import { RADIO_LAYOUT } from "../../../packages/defs/src/rebirth/buildings.ts";
import { type FloorPalette, floor, roof } from "./svg.ts";

export const RADIO_FLOORS: FloorPalette = {
    lobby: { base: "#cfcac0", grid: "#bcb7ad", step: 2 },
    studio: { base: "#4f5a6b", grid: "#465161", step: 1 },
    hall: { base: "#8fa39a", grid: "#7f948a", step: 2 },
    generator: { base: "#8a8c85", grid: "#7a7c75", step: 4 },
};

export function radioFloor(): string {
    return floor(RADIO_LAYOUT, RADIO_FLOORS, "#6b7178", "#1c1f22");
}

export function radioCeiling(): string {
    return roof(RADIO_LAYOUT, "#4f6072", "#3b4856", "#46576a", "");
}
