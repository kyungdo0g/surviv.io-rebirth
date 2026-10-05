// URLs of item images for the DOM HUD: the item's loot sprite, resolved through the sprite manifest (the original
// HUD uses img/loot/<lootImg.sprite>.svg, survev client/src/helpers.ts getSvgFromGameType).
import { GameObjectDefs } from "@rebirth/defs";
import manifestJson from "../generated/sprite-manifest.json";

const MANIFEST = manifestJson as Readonly<Record<string, string>>;
const ASSET_ROOT = "/assets/";

/** URL of the image for sprite id `sprite` ("loot-weapon-ak.img"), or "" when the manifest has none. */
export function spriteUrl(sprite: string | undefined): string {
    const file = sprite ? MANIFEST[sprite] : undefined;
    return file ? ASSET_ROOT + file : "";
}

/** URL of item `id`'s loot image. */
export function lootImageUrl(id: string): string {
    const def = GameObjectDefs[id] as { lootImg?: { sprite: string } } | undefined;
    return spriteUrl(def?.lootImg?.sprite);
}
