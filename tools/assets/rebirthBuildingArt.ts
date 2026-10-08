// Floor and roof art of the rebirth buildings (packages/defs rebirth/buildings.ts): flat SVGs in the original
// buildings' style (filled rooms, thick walls with a dark outline, roofs with a parapet), drawn from the same layouts
// the defs build their wall obstacles from, so every drawn wall is a wall that collides. This is rebirth art (no
// original or survev file is used), committed under apps/client/public/rebirth/map/ and served from /rebirth/map/.
// Run: node tools/assets/rebirthBuildingArt.ts (rebirthBuildingArt.test.ts checks the committed files are current).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLINIC_ART, OUTPOST_FACTIONS, outpostArt } from "../../packages/defs/src/rebirth/buildings.ts";
import { clinicCeiling, clinicFloor } from "./rebirthArt/clinic.ts";
import { outpostCeiling, outpostFloor } from "./rebirthArt/outpost.ts";
import { hex } from "./rebirthArt/svg.ts";

export const REBIRTH_ART_DIR = "apps/client/public/rebirth/map";

/** The served path of a sprite id's file (map-building-clinic-floor-01.img -> /rebirth/map/...svg). */
export function rebirthArtFile(sprite: string): string {
    return `${sprite.replace(/\.img$/, "")}.svg`;
}

/** Every rebirth building image: sprite id -> SVG text. */
export function rebirthBuildingSvgs(): Map<string, string> {
    const out = new Map<string, string>([
        [CLINIC_ART.floor, clinicFloor()],
        [CLINIC_ART.ceiling, clinicCeiling()],
    ]);
    for (const f of OUTPOST_FACTIONS) {
        const art = outpostArt(f.teamId);
        out.set(art.floor, outpostFloor());
        out.set(art.ceiling, outpostCeiling(hex(f.color)));
    }
    return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    mkdirSync(REBIRTH_ART_DIR, { recursive: true });
    for (const [sprite, text] of rebirthBuildingSvgs()) {
        writeFileSync(join(REBIRTH_ART_DIR, rebirthArtFile(sprite)), text);
        console.log(`wrote ${join(REBIRTH_ART_DIR, rebirthArtFile(sprite))}`);
    }
}
