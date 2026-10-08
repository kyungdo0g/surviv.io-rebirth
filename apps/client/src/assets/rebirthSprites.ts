// Sprite manifest entries of the rebirth's beta new guns (2026-10-07): each gun's loot icon (its def's lootImg.sprite,
// loot-weapon-<id>.img) is the owner's line art cut from the sheets by tools/assets/newGuns.ts into
// img/rebirth/ (gitignored, like all art). The tool writes a copy of the sheet's fallback icon (an original gun's,
// packages/defs rebirth/newGunAssets.ts) where it has no drawing, and the texture store loads that fallback itself if
// the file is not installed at all, so a new gun never shows the missing-sprite placeholder. The new ammo's ping emotes
// (ammo-<id>.img) are drawn by the same tool in the original ammo emotes' style, with the generic ammo emote as fallback.
// The rebirth buildings' floors and roofs (rebirth/buildings.ts) are committed SVGs served from /rebirth/map/
// (tools/assets/rebirthBuildingArt.ts draws them), so they need no install step.
import {
    GameObjectDefs,
    NEW_AMMO_IDS,
    NEW_GUN_IDS,
    NEW_GUN_LOOT_FALLBACKS,
    newAmmoEmoteTexture,
    newGunIconPath,
    rebirthBuildingArt,
} from "@rebirth/defs";
import type { SpriteEntry } from "./spriteManifest.ts";

/** Logical size of a loot icon (the original loot-weapon-*.img frames are 128 x 128, like the ammo emotes). */
const LOOT_ICON_SIZE = [128, 128] as const;
/** The original generic ammo emote (emote_ammo), shown while a new ammo's own is not installed. */
const AMMO_EMOTE_FALLBACK = "ammo-box.img";

/** Served URL of a rebirth building image (tools/assets/rebirthBuildingArt.ts rebirthArtFile). */
export function rebirthBuildingUrl(sprite: string): string {
    return `/rebirth/map/${sprite.replace(/\.img$/, "")}.svg`;
}

/** The new guns' loot icon and new ammo emote entries and the rebirth buildings' images, by sprite id. */
export function rebirthSpriteEntries(): Record<string, SpriteEntry> {
    const out: Record<string, SpriteEntry> = {};
    for (const id of NEW_GUN_IDS) {
        const sprite = (GameObjectDefs[id] as { lootImg?: { sprite?: string } } | undefined)?.lootImg?.sprite;
        if (!sprite) continue;
        out[sprite] = {
            source: "rebirth",
            path: newGunIconPath(sprite),
            size: LOOT_ICON_SIZE,
            fallback: NEW_GUN_LOOT_FALLBACKS[id],
        };
    }
    for (const ammo of NEW_AMMO_IDS) {
        const sprite = newAmmoEmoteTexture(ammo);
        out[sprite] = {
            source: "rebirth",
            path: newGunIconPath(sprite),
            size: LOOT_ICON_SIZE,
            fallback: AMMO_EMOTE_FALLBACK,
        };
    }
    for (const art of rebirthBuildingArt()) {
        // the floor image is larger than the roof's where an outdoor apron widens it
        out[art.floor] = { source: "rebirth", path: rebirthBuildingUrl(art.floor), size: art.floorSize ?? art.size };
        out[art.ceiling] = { source: "rebirth", path: rebirthBuildingUrl(art.ceiling), size: art.size };
    }
    return out;
}
