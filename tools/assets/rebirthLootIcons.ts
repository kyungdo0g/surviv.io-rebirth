// The launchers' own loot icons (rebirthArt/lootIcons.ts): committed SVGs under apps/client/public/rebirth/loot/,
// served from /rebirth/loot/ as the fallback of their loot icons (packages/defs rebirth/newGunAssets.ts
// DRAWN_LOOT_ICONS), and the same shapes as RGBA pixels for the asset installer (newGunInstall.ts), which writes them
// as the installed PNG while the owner's icon is missing.
// Run: node tools/assets/rebirthLootIcons.ts (rebirthLootIcons.test.ts checks the committed files are current).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DRAWN_LOOT_ICONS, drawnLootIconUrl } from "../../packages/defs/src/rebirth/index.ts";
import type { RgbaImage } from "./png.ts";
import { LAUNCHER_LOOT_ICON_NOTES, LAUNCHER_LOOT_ICONS } from "./rebirthArt/lootIcons.ts";
import { iconSvg, placeIcon, rasterizeIcon, type Shape } from "./vectorIcon.ts";

/** Where the committed SVGs live: the client's public folder, so /rebirth/loot/<file> serves them. */
export const REBIRTH_LOOT_DIR = "apps/client/public";

function placed(id: string): Shape[] {
    const draw = LAUNCHER_LOOT_ICONS[id];
    if (!draw) throw new Error(`no drawn loot icon for ${id}`);
    return placeIcon(draw());
}

/** The committed SVG of each drawn loot icon: file path under the repository -> SVG text. */
export function drawnLootIconSvgs(): Map<string, string> {
    const out = new Map<string, string>();
    for (const id of DRAWN_LOOT_ICONS) {
        out.set(join(REBIRTH_LOOT_DIR, drawnLootIconUrl(id)), iconSvg(placed(id), LAUNCHER_LOOT_ICON_NOTES[id] ?? id));
    }
    return out;
}

/** The drawn loot icon of new gun `id` as 128 x 128 RGBA pixels. */
export function drawnLootIconImage(id: string): RgbaImage {
    return rasterizeIcon(placed(id));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    for (const [file, text] of drawnLootIconSvgs()) {
        mkdirSync(join(file, ".."), { recursive: true });
        writeFileSync(file, text);
        console.log(`wrote ${file}`);
    }
}
