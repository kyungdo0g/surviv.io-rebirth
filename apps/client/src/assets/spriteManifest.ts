// The generated sprite manifest (tools/assets/import.ts): sprite id ("map-tree-01.img") -> file, source and the size the
// definitions' sprite scales are relative to.
import manifestJson from "../generated/sprite-manifest.json";

/** "original-0.8.82": a frame of the original client's atlases; "none": the original names it but ships no image */
export type SpriteSource = "original-0.8.82" | "survev" | "fandom" | "none";

export interface SpriteEntry {
    readonly source: SpriteSource;
    /** file under /assets/ (absent for "none") */
    readonly path?: string;
    /**
     * Logical size: the original atlas frame's size at scale 1 (sourceSize / atlas scale), which the definitions'
     * scales are relative to; a survev vector whose proportions differ from the original frame keeps its own size.
     */
    readonly size?: readonly [number, number];
    /** survev's vector file of the same sprite, for DOM images (the original HUD loaded img/loot/*.svg files) */
    readonly svg?: string;
}

export const SPRITES = manifestJson as unknown as Readonly<Record<string, SpriteEntry>>;

/** File of sprite `id` under /assets/, or undefined when the manifest has no image for it. */
export function spritePath(id: string): string | undefined {
    return SPRITES[id]?.path;
}
