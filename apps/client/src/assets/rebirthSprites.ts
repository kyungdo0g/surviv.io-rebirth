// Sprite manifest entries of the rebirth's beta new guns (2026-10-07): each gun's loot icon (its def's lootImg.sprite,
// loot-weapon-<id>.img) is the owner's line art cut from the sheets by tools/assets/newGuns.ts into
// img/rebirth/ (gitignored, like all art). Where it has no drawing the tool writes the gun's fallback icon instead
// (packages/defs rebirth/newGunAssets.ts: an original gun's of the same class, or for the six launchers our own drawn
// icon, committed under /rebirth/loot/ as `loot-weapon-<id>-drawn.img`), and the texture store and the HUD
// (hudImages.ts) load that fallback themselves if the file is not installed at all, so a new gun never shows the
// missing-sprite placeholder or a broken image. The new ammo's ping emotes
// (ammo-<id>.img) are drawn by the same tool in the original ammo emotes' style, with the generic ammo emote as fallback.
// The rebirth buildings' floors and roofs (rebirth/buildings.ts) are committed SVGs served from /rebirth/map/
// (tools/assets/rebirthBuildingArt.ts draws them), so they need no install step. The drawn top-down held sprites
// (packages/defs rebirth/heldGunArt.ts: the AK-47, four beta rifles, six beta snipers and DMRs, four beta SMGs and
// machine pistols, two beta shotguns and three machine guns and the six beta launchers, the RPG-7 also empty, our own
// art; the dual TEC-9 shares the TEC-9's) and the launcher rounds drawn in flight (rebirth/launcherRoundArt.ts) are
// committed SVGs too, served from /rebirth/guns/, each at its own logical size; they have no fallback, since the file
// always ships. The owner's held sprites (heldGunArt.ts OWNER_HELD_GUN_ART) are installed under img/rebirth/ like the
// loot icons, but drawn only once found installed (ownerHeldArt.ts).
import {
    DRAWN_LOOT_ICONS,
    drawnLootIconSprite,
    drawnLootIconUrl,
    GameObjectDefs,
    heldGunArt,
    heldGunArtEmpty,
    LAUNCHER_ROUND_ART,
    type LauncherRoundSprite,
    NEW_AMMO_IDS,
    NEW_GUN_IDS,
    NEW_GUN_LOOT_FALLBACKS,
    newAmmoEmoteTexture,
    newGunIconPath,
    ownerHeldGunArt,
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

/** Served URL of a drawn top-down held sprite (packages/defs rebirth/heldGunArt.ts). */
export function rebirthHeldGunUrl(sprite: string): string {
    return `/rebirth/guns/${sprite.replace(/\.img$/, "")}.svg`;
}

/**
 * The new guns' loot icon and new ammo emote entries, the rebirth buildings' images, the drawn held sprites and the
 * launcher rounds, by sprite id.
 */
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
    for (const id of DRAWN_LOOT_ICONS) {
        out[drawnLootIconSprite(id)] = { source: "rebirth", path: drawnLootIconUrl(id), size: LOOT_ICON_SIZE };
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
        // a roofless part (the military base's yard markings) has no roof image
        if (art.ceiling)
            out[art.ceiling] = { source: "rebirth", path: rebirthBuildingUrl(art.ceiling), size: art.size };
    }
    for (const art of [...heldGunArt(), ...heldGunArtEmpty()]) {
        out[art.sprite] = { source: "rebirth", path: rebirthHeldGunUrl(art.sprite), size: art.size };
    }
    // the owner's held sprites, installed from assets-user/ (no fallback: assets/ownerHeldArt.ts checks them first)
    for (const art of ownerHeldGunArt()) out[art.sprite] = { source: "rebirth", path: art.path, size: art.size };
    for (const sprite of Object.keys(LAUNCHER_ROUND_ART) as LauncherRoundSprite[]) {
        out[sprite] = { source: "rebirth", path: rebirthHeldGunUrl(sprite), size: LAUNCHER_ROUND_ART[sprite] };
    }
    return out;
}
