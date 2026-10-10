// Floor and roof art of the rebirth buildings (packages/defs rebirth/buildings.ts): flat SVGs in the original
// buildings' style (filled rooms, thick walls with a dark outline, roofs with a parapet), drawn from the same layouts
// the defs build their wall obstacles from, so every drawn wall is a wall that collides. This is rebirth art (no
// original or survev file is used), committed under apps/client/public/rebirth/map/ and served from /rebirth/map/.
// Run: node tools/assets/rebirthBuildingArt.ts (rebirthBuildingArt.test.ts checks the committed files are current).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    APARTMENT_ART,
    ARSENAL_ART,
    BLAST_BUNKER_ENTRANCE_ART,
    BLAST_BUNKER_VAULT_CEILING,
    BLAST_BUNKER_VAULT_FLOOR,
    BLOCKHOUSE_FACTIONS,
    blockhouseArt,
    CAPITOL_ART,
    CARGO_SHIP_ART,
    CHURCH_ART,
    CHURCH_RESIDUE_ART,
    CLINIC_ART,
    FIRESTATION_ART,
    GAS_PUMP_ART,
    GAS_STATION_RUBBLE,
    GAS_STATION_SITE_ART,
    GAS_STATION_STORE_ART,
    LIBRARY_ART,
    MALL_ART,
    OUTPOST_FACTIONS,
    outpostArt,
    PORT_BOOTH_ART,
    PORT_CHECKPOINT_ART,
    powerPlantArt,
    RADIO_ART,
    SUBWAY_ENTRANCE_ART,
    SUBWAY_PLATFORM_ART,
} from "../../packages/defs/src/rebirth/buildings.ts";
import { apartmentCeiling, apartmentFloor } from "./rebirthArt/apartment.ts";
import { arsenalCeiling, arsenalFloor } from "./rebirthArt/arsenal.ts";
import {
    blastEntranceCeiling,
    blastEntranceFloor,
    blastVaultCeiling,
    blastVaultFloor,
} from "./rebirthArt/blastBunker.ts";
import { blastDoorSvgs } from "./rebirthArt/blastDoors.ts";
import { blockhouseCeiling, blockhouseFloor } from "./rebirthArt/blockhouse.ts";
import { capitolCeiling, capitolFloor } from "./rebirthArt/capitol.ts";
import { churchCeiling, churchFloor, churchResidue } from "./rebirthArt/church.ts";
import { clinicCeiling, clinicFloor } from "./rebirthArt/clinic.ts";
import { firestationCeiling, firestationFloor } from "./rebirthArt/firestation.ts";
import {
    gasPumpSvg,
    gasStationCanopy,
    gasStationRubble,
    gasStationSiteFloor,
    gasStationStoreCeiling,
    gasStationStoreFloor,
} from "./rebirthArt/gasStation.ts";
import { libraryCeiling, libraryFloor } from "./rebirthArt/library.ts";
import { mallCeiling, mallFloor } from "./rebirthArt/mall.ts";
import { militarySvgs } from "./rebirthArt/military/index.ts";
import { outpostCeiling, outpostFloor } from "./rebirthArt/outpost.ts";
import { boothCeiling, checkpointCeiling, checkpointFloor, shipCeiling, shipFloor } from "./rebirthArt/port.ts";
import { controlCeiling, controlFloor, turbineCeiling, turbineFloor } from "./rebirthArt/powerPlant.ts";
import { plantTankRoof, plantTowerRoof, plantYard } from "./rebirthArt/powerPlantYard.ts";
import { radarSvgs } from "./rebirthArt/radar/index.ts";
import { radioCeiling, radioFloor } from "./rebirthArt/radio.ts";
import {
    subwayEntranceCeiling,
    subwayEntranceFloor,
    subwayPlatformCeiling,
    subwayPlatformFloor,
} from "./rebirthArt/subway.ts";
import { hex } from "./rebirthArt/svg.ts";

/** The power plant's images (wave 3, 2026-10-10) by sprite id. */
function powerPlantSvgs(): Map<string, string> {
    const draw: Readonly<Record<string, () => string>> = {
        "map-building-powerplant-turbine-floor-01.img": turbineFloor,
        "map-building-powerplant-turbine-ceiling-01.img": turbineCeiling,
        "map-building-powerplant-control-floor-01.img": controlFloor,
        "map-building-powerplant-control-ceiling-01.img": controlCeiling,
        "map-building-powerplant-yard-01.img": plantYard,
        "map-building-powerplant-tower-01.img": plantTowerRoof,
        "map-building-powerplant-tank-01.img": plantTankRoof,
    };
    const out = new Map<string, string>();
    for (const art of powerPlantArt()) {
        const fn = draw[art.floor];
        if (!fn) throw new Error(`power plant art: no drawer for ${art.floor}`);
        out.set(art.floor, fn());
    }
    return out;
}

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
        // the wave 3 buildings (2026-10-10)
        [MALL_ART, mallFloor, mallCeiling],
        // the wave-3 buildings
        [SUBWAY_ENTRANCE_ART, subwayEntranceFloor, subwayEntranceCeiling],
        [SUBWAY_PLATFORM_ART, subwayPlatformFloor, subwayPlatformCeiling],
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
    for (const [sprite, text] of blastDoorSvgs()) out.set(sprite, text);
    // the gas station (wave 3)
    out.set(GAS_STATION_STORE_ART.floor, gasStationStoreFloor());
    out.set(GAS_STATION_STORE_ART.ceiling, gasStationStoreCeiling());
    out.set(GAS_STATION_RUBBLE.floor, gasStationRubble());
    out.set(GAS_STATION_SITE_ART[0].floor, gasStationSiteFloor());
    out.set(GAS_STATION_SITE_ART[1].floor, gasStationCanopy());
    out.set(GAS_PUMP_ART.floor, gasPumpSvg());
    // the wave-3 buildings (2026-10-10)
    out.set(CHURCH_ART.floor, churchFloor());
    out.set(CHURCH_ART.ceiling, churchCeiling());
    out.set(CHURCH_RESIDUE_ART.floor, churchResidue());
    for (const [sprite, text] of powerPlantSvgs()) out.set(sprite, text);
    for (const [sprite, text] of radarSvgs()) out.set(sprite, text);
    // the wave-3 buildings
    out.set(CAPITOL_ART.floor, capitolFloor());
    out.set(CAPITOL_ART.ceiling, capitolCeiling());
    // wave 3 (2026-10-10)
    out.set(APARTMENT_ART.floor, apartmentFloor());
    out.set(APARTMENT_ART.ceiling, apartmentCeiling());
    // the container port's checkpoint (its booth's roof apart) and cargo ship (wave 3, 2026-10-10)
    out.set(PORT_CHECKPOINT_ART.floor, checkpointFloor());
    out.set(PORT_CHECKPOINT_ART.ceiling, checkpointCeiling());
    out.set(PORT_BOOTH_ART.floor, boothCeiling());
    out.set(CARGO_SHIP_ART.floor, shipFloor());
    out.set(CARGO_SHIP_ART.ceiling, shipCeiling());
    // the wave-3 buildings
    out.set(BLAST_BUNKER_ENTRANCE_ART.floor, blastEntranceFloor());
    out.set(BLAST_BUNKER_ENTRANCE_ART.ceiling, blastEntranceCeiling());
    out.set(BLAST_BUNKER_VAULT_FLOOR, blastVaultFloor());
    out.set(BLAST_BUNKER_VAULT_CEILING, blastVaultCeiling());
    return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    mkdirSync(REBIRTH_ART_DIR, { recursive: true });
    for (const [sprite, text] of rebirthBuildingSvgs()) {
        writeFileSync(join(REBIRTH_ART_DIR, rebirthArtFile(sprite)), text);
        console.log(`wrote ${join(REBIRTH_ART_DIR, rebirthArtFile(sprite))}`);
    }
}
