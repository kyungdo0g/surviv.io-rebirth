// Building ceilings drawn from survev's art (tools/assets/keep-survev.json and sprites without an original frame) reach
// over the rooms they roof: the image as drawn (manifest logical size x def scale / 16 px per unit) covers every
// zoomIn region. The Hydra vat lab's ceiling is drawn at survev's own 816x720 (51 x 45 u; keep-survev.json ownCanvas):
// at the relaunch frame's 736x656 it stopped short of the walls and doorways and left the lab doors uncovered.
import { type BuildingDef, MapObjectDefs } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../src/assets/spriteManifest.ts";

const PIXELS_PER_UNIT = 16;
/** an image's edge may sit this far inside a zoomIn region's edge (the original's own ceilings do by up to 0.5) */
const TOLERANCE = 0.5;
/**
 * zoomIn regions survev leaves open to the sky on purpose: the Reserve's south-east palm garden (x 33..59, y 22.5..30.5)
 * has no ceiling image in survev either (modeBuildingDefs.ts reserve_01; wikigg The_Reserve roof tab).
 */
const OPEN_ZOOM_REGIONS: Readonly<Record<string, ReadonlyArray<{ x: number; y: number }>>> = {
    reserve_01: [{ x: 59, y: 30.5 }],
};

interface Rect {
    min: { x: number; y: number };
    max: { x: number; y: number };
}

/** The building's ceiling images as drawn, in building space (null when one has no logical size). */
function ceilingRect(def: BuildingDef): Rect | null {
    const out: Rect = { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } };
    for (const img of def.ceiling.imgs) {
        const size = SPRITES[img.sprite]?.size;
        if (!size) return null;
        let w = (size[0] * img.scale) / PIXELS_PER_UNIT;
        let h = (size[1] * img.scale) / PIXELS_PER_UNIT;
        if ((img.rot ?? 0) % 2) [w, h] = [h, w];
        const pos = img.pos ?? { x: 0, y: 0 };
        out.min.x = Math.min(out.min.x, pos.x - w / 2);
        out.min.y = Math.min(out.min.y, pos.y - h / 2);
        out.max.x = Math.max(out.max.x, pos.x + w / 2);
        out.max.y = Math.max(out.max.y, pos.y + h / 2);
    }
    return out;
}

/** How far the zoomIn regions reach past the ceiling images (0 when covered). */
function uncovered(def: BuildingDef, open?: ReadonlyArray<{ x: number; y: number }>): number {
    const rect = ceilingRect(def);
    if (!rect) return 0;
    let gap = 0;
    for (const region of def.ceiling.zoomRegions) {
        const z = region.zoomIn;
        if (!z) continue;
        if (open?.some((m) => m.x === z.max.x && m.y === z.max.y)) continue;
        gap = Math.max(gap, rect.min.x - z.min.x, z.max.x - rect.max.x, rect.min.y - z.min.y, z.max.y - rect.max.y);
    }
    return gap;
}

describe("ceiling sprite sizes", () => {
    it("draws the Hydra vat lab's ceiling at survev's 816x720 over its walls and doorways", () => {
        const id = "map-bunker-hydra-compartment-ceiling-02.img";
        expect(SPRITES[id]!.size).toEqual([816, 720]);
        const def = MapObjectDefs.bunker_hydra_compartment_02 as BuildingDef;
        const rect = ceilingRect(def)!;
        // the walls run from y -21.5 (north) to 23.25 (south); the zoomIn region from x -24.5 to 20.5
        expect(rect.min.y).toBeLessThanOrEqual(-21.5);
        expect(rect.max.y).toBeGreaterThanOrEqual(23.25);
        expect(rect.min.x).toBeLessThanOrEqual(-24.5);
        expect(rect.max.x).toBeGreaterThanOrEqual(20.5);
    });

    it("covers the zoomIn regions of every building roofed with survev's art", () => {
        const short: string[] = [];
        let checked = 0;
        for (const [type, d] of Object.entries(MapObjectDefs)) {
            if (d.type !== "building") continue;
            const def = d as BuildingDef;
            if (!def.ceiling.imgs.some((img) => SPRITES[img.sprite]?.source === "survev")) continue;
            if (!def.ceiling.zoomRegions.some((r) => r.zoomIn)) continue;
            checked++;
            const gap = uncovered(def, OPEN_ZOOM_REGIONS[type]);
            if (gap > TOLERANCE) short.push(`${type}: ${gap.toFixed(2)} u`);
        }
        expect(checked).toBeGreaterThan(5);
        expect(short).toEqual([]);
    });
});
