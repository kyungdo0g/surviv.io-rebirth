// Sprite manifest entries of the owner's 2026-10-10 sheet (defs rebirth/throwables.ts, rebirth/discardDecals.ts,
// rebirth/launcherRoundArt.ts OWNER_ROUND_ART): the Molotov, the flashbang, the NLAW, Bazooka and Pvg m/42 rounds and
// the discarded launchers' bodies are the owner's art, cut from the sheet into img/rebirth/ by `pnpm assets`
// (tools/assets/decalSheet.ts; gitignored like all installed art). Each names a fallback the texture store draws
// while its file is missing: our own committed drawings of the two throwables (/rebirth/throwables/), the closest
// committed round, the gun's held sprite. The Molotov's burning ground is our own committed drawing (/rebirth/fx/).
import {
    DISCARD_DECALS,
    drawnThrowableSprite,
    drawnThrowableUrl,
    FIRE_DECAL_SPRITE,
    FIRE_DECAL_SPRITE_SIZE,
    FIRE_DECAL_URL,
    newGunIconPath,
    OWNER_ROUND_ART,
    REBIRTH_THROWABLE_SPRITE_SIZE,
    REBIRTH_THROWABLE_SPRITES,
} from "@rebirth/defs";
import type { SpriteEntry } from "./spriteManifest.ts";

export function decalThrowableSpriteEntries(): Record<string, SpriteEntry> {
    const out: Record<string, SpriteEntry> = {};
    const size = REBIRTH_THROWABLE_SPRITE_SIZE;
    for (const sprite of Object.values(REBIRTH_THROWABLE_SPRITES)) {
        const drawn = drawnThrowableSprite(sprite);
        out[sprite] = { source: "rebirth", path: newGunIconPath(sprite), size, fallback: drawn };
        out[drawn] = { source: "rebirth", path: drawnThrowableUrl(sprite), size };
    }
    for (const [sprite, art] of Object.entries(OWNER_ROUND_ART)) {
        out[sprite] = { source: "rebirth", path: newGunIconPath(sprite), size: art.size, fallback: art.fallback };
    }
    for (const art of Object.values(DISCARD_DECALS)) {
        if (!art.fallback) continue;
        out[art.sprite] = {
            source: "rebirth",
            path: newGunIconPath(art.sprite),
            size: art.size,
            fallback: art.fallback,
        };
    }
    out[FIRE_DECAL_SPRITE] = { source: "rebirth", path: FIRE_DECAL_URL, size: FIRE_DECAL_SPRITE_SIZE };
    return out;
}
