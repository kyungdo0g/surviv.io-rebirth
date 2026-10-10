// The radar base's images (packages/defs rebirth/buildings/radar/): the buildings' floors and roofs (buildings.ts) and
// the compound's fence strips, yard paint and antenna masts (yard.ts), each drawn once (a mast is placed four times).
import { RADAR_COMPOUND, RADAR_PARTS } from "../../../../packages/defs/src/rebirth/buildings.ts";
import { boxFrame } from "../svg.ts";
import { RADAR_BUILDING_ART } from "./buildings.ts";
import { RADAR_YARD_ART } from "./yard.ts";

/** Every radar base image: sprite id -> SVG text. */
export function radarSvgs(): Map<string, string> {
    const out = new Map<string, string>();
    for (const part of RADAR_PARTS) {
        for (const img of part.images) {
            if (out.has(img.sprite)) continue;
            if (part === RADAR_COMPOUND) {
                const draw = RADAR_YARD_ART[img.sprite];
                if (!draw) throw new Error(`radar base art: no drawer for ${img.sprite}`);
                const fr = boxFrame(img.centre.x, img.centre.y, img.size[0], img.size[1]);
                out.set(img.sprite, draw(fr, img.ppu ?? 32));
            } else {
                const draw = RADAR_BUILDING_ART[img.sprite];
                if (!draw) throw new Error(`radar base art: no drawer for ${img.sprite}`);
                out.set(img.sprite, draw());
            }
        }
    }
    return out;
}
