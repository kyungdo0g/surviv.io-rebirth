// Floor and roof art of the faction command posts (packages/defs rebirth/buildings/outpost.ts): concrete rooms with
// hazard stripes at the door and the command room's carpet border; a grey roof with the faction's colour band and star.
import { OUTPOST_LAYOUT, REBIRTH_ART_PX_PER_UNIT as PX } from "../../../packages/defs/src/rebirth/buildings.ts";
import { type FloorPalette, floor, frameOf, px, py, rect, roof, star } from "./svg.ts";

export const OUTPOST_FLOORS: FloorPalette = {
    hall: { base: "#8a8c85", grid: "#7a7c75", step: 4 },
    armory: { base: "#6d7166", grid: "#62665b", step: 1 },
    command: { base: "#5b6a4e", grid: "#536147", step: 4 },
};

export function outpostFloor(): string {
    const fr = frameOf(OUTPOST_LAYOUT);
    // hazard stripes inside the doors, the command room's carpet border
    const stripes: string[] = [];
    for (let x = -2; x < 2; x += 1) {
        stripes.push(
            rect(fr, x, -10.5, x + 0.5, -9.75, `fill="#d6a425"`),
            rect(fr, x + 0.5, -10.5, x + 1, -9.75, `fill="#2a2a2a"`),
        );
    }
    // the command room's carpet border, the armory's crate bay
    const extra =
        stripes.join("") +
        rect(fr, -0.75, 1.25, 12.75, 9.75, `fill="none" stroke="#45503b" stroke-width="6"`) +
        rect(fr, -13.5, 5.5, -9, 10.5, `fill="#000000" fill-opacity="0.12"`);
    return floor(OUTPOST_LAYOUT, OUTPOST_FLOORS, "#55584f", "#1b1d1a", extra);
}

export function outpostCeiling(color: string): string {
    const fr = frameOf(OUTPOST_LAYOUT);
    const top =
        rect(fr, -13.5, -10.5, 13.5, -8.75, `fill="${color}"`) +
        `<circle cx="${px(fr, 0)}" cy="${py(fr, 1.5)}" r="${PX * 4}" fill="${color}" stroke="#1f2326" stroke-width="4"/>` +
        star(fr, 0, 1.5, 3, "#f2f2ee") +
        // radio mast and hatch
        `<circle cx="${px(fr, 8.5)}" cy="${py(fr, 6.5)}" r="${PX * 1}" fill="#5a5d56" stroke="#1f2326" stroke-width="3"/>` +
        `<path d="M${px(fr, 8.5)} ${py(fr, 6.5)}L${px(fr, 10.25)} ${py(fr, 8.25)}" stroke="#1f2326" stroke-width="4"/>` +
        rect(fr, -9.5, 5, -6.5, 8, `fill="#6b6e67" stroke="#1f2326" stroke-width="3"`);
    return roof(OUTPOST_LAYOUT, "#8b8e87", "#6c6f68", "#7d8079", top);
}
