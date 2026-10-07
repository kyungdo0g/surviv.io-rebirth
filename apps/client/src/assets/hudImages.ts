// URLs of item images for the DOM HUD: the item's loot sprite, resolved through the sprite manifest. The original HUD
// loaded img/loot/<lootImg.sprite>.svg files rather than atlas frames (survev client/src/helpers.ts
// getSvgFromGameType), so a sprite drawn in the world from an original atlas frame shows survev's SVG of it here,
// except where survev's SVG is different art (tools/assets/survev-redrawn.json): those keep the original frame.
// Rebirth: an item with a `lootImg.hudTint` (the variant strobes) shows its image multiplied by that colour, drawn once
// into a canvas (setLootImage shows the plain image until the tinted one is ready).
import { GameObjectDefs } from "@rebirth/defs";
import { SPRITES } from "./spriteManifest.ts";

const ASSET_ROOT = "/assets/";

/** URL of the image for sprite id `sprite` ("loot-weapon-ak.img"), or "" when the manifest has none. */
export function spriteUrl(sprite: string | undefined): string {
    const entry = sprite ? SPRITES[sprite] : undefined;
    const file = entry?.svg ?? entry?.path;
    return file ? ASSET_ROOT + file : "";
}

/** URL of item `id`'s loot image (untinted). */
export function lootImageUrl(id: string): string {
    const def = GameObjectDefs[id] as { lootImg?: { sprite: string } } | undefined;
    return spriteUrl(def?.lootImg?.sprite);
}

/** The HUD tint of item `id` (rebirth lootImg.hudTint), or undefined. */
export function lootHudTint(id: string): number | undefined {
    return (GameObjectDefs[id] as { lootImg?: { hudTint?: number } } | undefined)?.lootImg?.hudTint;
}

/** Tinted image data URLs by "<url>|<tint>" (made once per item image). */
const tinted = new Map<string, Promise<string>>();

/** Loads `url` into an image (onload rather than decode(), which can reject for SVGs under load). */
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`cannot load ${url}`));
        img.src = url;
    });
}

/**
 * `url`'s image multiplied by `tint`, keeping its alpha, as a PNG data URL ("" when it cannot be drawn; a failure is
 * not cached, the next call tries again).
 */
function tintImage(url: string, tint: number): Promise<string> {
    const key = `${url}|${tint}`;
    let promise = tinted.get(key);
    if (!promise) {
        promise = (async () => {
            const img = await loadImage(url);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, img.naturalWidth || img.width);
            canvas.height = Math.max(1, img.naturalHeight || img.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) return "";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = `#${tint.toString(16).padStart(6, "0")}`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // keep only the image's own pixels (multiply filled the transparent ones too)
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/png");
        })().catch(() => {
            tinted.delete(key);
            return "";
        });
        tinted.set(key, promise);
    }
    return promise;
}

/**
 * Shows item `id`'s loot image in `img`: at once the plain image, then, for an item with a HUD tint, the tinted one
 * as soon as it is drawn (unless `img` shows another item by then).
 */
export function setLootImage(img: HTMLImageElement, id: string): void {
    const url = lootImageUrl(id);
    img.src = url;
    img.dataset.lootId = id;
    const tint = lootHudTint(id);
    if (tint === undefined || !url) return;
    void tintImage(url, tint).then((data) => {
        if (data && img.dataset.lootId === id) img.src = data;
    });
}

/** Draws the tinted image of every item with a HUD tint now, so the weapon slot shows it at once later. */
export function preloadLootTints(): void {
    for (const id of Object.keys(GameObjectDefs)) {
        const tint = lootHudTint(id);
        const url = tint === undefined ? "" : lootImageUrl(id);
        if (url && tint !== undefined) void tintImage(url, tint);
    }
}
