// The generated sprite manifest (tools/assets/import.ts): sprite id ("map-tree-01.img") -> file, source and the size the
// definitions' sprite scales are relative to; plus the beta new guns' loot icons (rebirthSprites.ts) and the owner's
// 2026-10-10 throwables, rounds and launcher decals (decalThrowableSprites.ts).
import manifestJson from "../generated/sprite-manifest.json";
import { decalThrowableSpriteEntries } from "./decalThrowableSprites.ts";
import { rebirthSpriteEntries } from "./rebirthSprites.ts";

/**
 * "original-0.8.82": a frame of the original client's atlases; "none": the original names it but ships no image;
 * "rebirth": art of a rebirth-only item: the owner's (tools/assets/newGuns.ts, with an original `fallback`) or the
 * rebirth buildings' committed SVGs (tools/assets/rebirthBuildingArt.ts)
 */
export type SpriteSource = "original-0.8.82" | "survev" | "fandom" | "none" | "rebirth";

export interface SpriteEntry {
    readonly source: SpriteSource;
    /** file under /assets/, or an absolute URL for committed rebirth art (absent for "none"; see assetUrl) */
    readonly path?: string;
    /**
     * Logical size: the original atlas frame's size at scale 1 (sourceSize / atlas scale), which the definitions'
     * scales are relative to; a survev vector whose proportions differ from the original frame keeps its own size.
     */
    readonly size?: readonly [number, number];
    /** survev's vector file of the same sprite, for DOM images (the original HUD loaded img/loot/*.svg files) */
    readonly svg?: string;
    /** sprite drawn instead when this one's file fails to load (rebirth art not installed) */
    readonly fallback?: string;
}

export const SPRITES: Readonly<Record<string, SpriteEntry>> = {
    ...(manifestJson as unknown as Record<string, SpriteEntry>),
    ...rebirthSpriteEntries(),
    ...decalThrowableSpriteEntries(),
};

/** File of sprite `id` under /assets/, or undefined when the manifest has no image for it. */
export function spritePath(id: string): string | undefined {
    return SPRITES[id]?.path;
}

const ASSET_ROOT = "/assets/";

/**
 * URL of a manifest file: paths are under /assets/ (art installed by `pnpm assets`), but for committed rebirth art,
 * which the entry names by its absolute URL (the rebirth buildings, /rebirth/map/).
 */
export function assetUrl(path: string): string {
    return path.startsWith("/") ? path : ASSET_ROOT + path;
}
