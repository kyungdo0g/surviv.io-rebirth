// Floor and roof art of the rebirth buildings (packages/defs rebirth/buildings.ts): flat SVGs in the original
// buildings' style (filled rooms, thick walls with a dark outline, roofs with a parapet), drawn from the same layouts
// the defs build their wall obstacles from, so every drawn wall is a wall that collides. This is rebirth art (no
// original or survev file is used), committed under apps/client/public/rebirth/map/ and served from /rebirth/map/.
// Run: node tools/assets/rebirthBuildingArt.ts (rebirthBuildingArt.test.ts checks the committed files are current).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    ARSENAL_ART,
    BLOCKHOUSE_FACTIONS,
    blockhouseArt,
    CLINIC_ART,
    FIRESTATION_ART,
    LIBRARY_ART,
    OUTPOST_FACTIONS,
    outpostArt,
    RADIO_ART,
} from "../../packages/defs/src/rebirth/buildings.ts";
import { arsenalCeiling, arsenalFloor } from "./rebirthArt/arsenal.ts";
import { blockhouseCeiling, blockhouseFloor } from "./rebirthArt/blockhouse.ts";
import { clinicCeiling, clinicFloor } from "./rebirthArt/clinic.ts";
import { firestationCeiling, firestationFloor } from "./rebirthArt/firestation.ts";
import { libraryCeiling, libraryFloor } from "./rebirthArt/library.ts";
import { militarySvgs } from "./rebirthArt/military/index.ts";
import { outpostCeiling, outpostFloor } from "./rebirthArt/outpost.ts";
import { radioCeiling, radioFloor } from "./rebirthArt/radio.ts";
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
    for (const [art, floor, ceiling] of [
        [FIRESTATION_ART, firestationFloor, firestationCeiling],
        [LIBRARY_ART, libraryFloor, libraryCeiling],
        [RADIO_ART, radioFloor, radioCeiling],
        [ARSENAL_ART, arsenalFloor, arsenalCeiling],
    ] as const) {
        out.set(art.floor, floor());
        out.set(art.ceiling, ceiling());
    }
    for (const f of BLOCKHOUSE_FACTIONS) {
        const art = blockhouseArt(f.teamId);
        out.set(art.floor, blockhouseFloor());
        out.set(art.ceiling, blockhouseCeiling(hex(f.color)));
    }
    for (const [sprite, text] of militarySvgs()) out.set(sprite, text);
    return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    mkdirSync(REBIRTH_ART_DIR, { recursive: true });
    for (const [sprite, text] of rebirthBuildingSvgs()) {
        writeFileSync(join(REBIRTH_ART_DIR, rebirthArtFile(sprite)), text);
        console.log(`wrote ${join(REBIRTH_ART_DIR, rebirthArtFile(sprite))}`);
    }
}
