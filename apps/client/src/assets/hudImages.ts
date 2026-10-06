// URLs of item images for the DOM HUD: the item's loot sprite, resolved through the sprite manifest. The original HUD
// loaded img/loot/<lootImg.sprite>.svg files rather than atlas frames (survev client/src/helpers.ts
// getSvgFromGameType), so a sprite drawn in the world from an original atlas frame shows survev's SVG of it here,
// except where survev's SVG is different art (tools/assets/survev-redrawn.json): those keep the original frame.
import { GameObjectDefs } from "@rebirth/defs";
import { SPRITES } from "./spriteManifest.ts";

const ASSET_ROOT = "/assets/";

/** URL of the image for sprite id `sprite` ("loot-weapon-ak.img"), or "" when the manifest has none. */
export function spriteUrl(sprite: string | undefined): string {
    const entry = sprite ? SPRITES[sprite] : undefined;
    const file = entry?.svg ?? entry?.path;
    return file ? ASSET_ROOT + file : "";
}

/** URL of item `id`'s loot image. */
export function lootImageUrl(id: string): string {
    const def = GameObjectDefs[id] as { lootImg?: { sprite: string } } | undefined;
    return spriteUrl(def?.lootImg?.sprite);
}
