// The tier marking of the rebirth air drop inner crates (deliberate rebirth addition requested by the user,
// docs/research/rebirth-deviations.md "Air drop tiers"; defs rebirth/airdropTiers.ts): once an air drop is opened, its
// inner crate shows its tier with stars stamped over crate_10's lid, drawn from the original client's own star images
// (no new art): tier 1 one silver star, tier 2 two blue stars, each over a black silhouette of itself so it stands out
// from the crate's wood, stripe and emblem at any zoom. The count reads at a glance, the colour follows the usual
// silver / blue / gold ladder up to the gold drop, whose crate_11 keeps its gold corners and no mark. Tier 1 and tier 2
// shells are the same object, so nothing shows before a drop is opened.
import { type Vec2, v2 } from "@rebirth/core";
import { AIRDROP_TIER_IDS, type AirdropTier, airdropCrateTier, airdropTierCrate } from "@rebirth/defs";
import type { Sprite } from "pixi.js";
import { mapObjectSprites } from "../assets/spriteSets.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import type { ViewDeps } from "./types.ts";

export interface CrateTierMarkStyle {
    /** star sprite (an original v0.8.82 image) and its tint */
    sprite: string;
    tint: number;
    /** stars side by side */
    count: number;
    /** star width in world units (crate_10 is drawn 4.6 u wide; the star fills ~85 % of its frame) */
    size: number;
    /** centre-to-centre distance of neighbouring stars, world units */
    spacing: number;
}

/** Logical size of the star images (148 px frames in the original atlas). */
const STAR_FRAME_PX = 148;
/** The black silhouette behind each star: this much larger, at this alpha. */
const BACKING_SCALE = 1.22;
const BACKING_ALPHA = 0.9;
const BACKING_TINT = 0x000000;

export const CRATE_TIER_MARKS: Readonly<Record<AirdropTier, CrateTierMarkStyle>> = {
    /** star.img (white and light grey with a black outline), untinted: one plain silver star across the lid */
    tier1: { sprite: "star.img", tint: 0xffffff, count: 1, size: 3, spacing: 0 },
    /** star-blue.img: two blue stars side by side, nearly as large, so the count reads at normal zoom */
    tier2: { sprite: "star-blue.img", tint: 0xffffff, count: 2, size: 2.5, spacing: 2.15 },
};

/** Mark style of a map object type: the rebirth tier inner crates only. */
export function crateTierMarkStyle(type: string): CrateTierMarkStyle | undefined {
    const tier = airdropCrateTier(type);
    return tier ? CRATE_TIER_MARKS[tier] : undefined;
}

/**
 * Adds to `out` (sprite -> scale, as assets/spriteSets.ts) what a tiered air drop `shell` needs once it opens: its tier
 * crates and their stars. The client preloads them with the map's crates, so the first crate a match opens shows its
 * mark at once (a texture not loaded yet draws as Texture.EMPTY until its fetch finishes). Adds nothing for a shell
 * that does not split (gold drops, 50v50 crates).
 */
export function crateTierMarkSprites(shell: string, out: Map<string, number>): void {
    for (const tier of AIRDROP_TIER_IDS) {
        const crate = airdropTierCrate(shell, tier);
        if (!crate) continue;
        mapObjectSprites(crate, out);
        const star = CRATE_TIER_MARKS[tier].sprite;
        out.set(star, Math.max(out.get(star) ?? 0, 1));
    }
}

/**
 * Star centres of a mark on a crate at `pos` rotated by `rot` (radians) and grown by `scale` (the obstacle's scale):
 * side by side across the crate's centre.
 */
export function crateTierMarkLayout(style: CrateTierMarkStyle, pos: Vec2, rot: number, scale: number): Vec2[] {
    const out: Vec2[] = [];
    for (let i = 0; i < style.count; i++) {
        const x = (i - (style.count - 1) / 2) * style.spacing * scale;
        out.push(v2.add(pos, v2.rotate({ x, y: 0 }, rot)));
    }
    return out;
}

/** The star sprites (and their silhouettes) of one marked crate, drawn just above it. */
export class CrateTierMark {
    readonly style: CrateTierMarkStyle;
    /** the stars, in layout order */
    readonly sprites: Sprite[] = [];
    private readonly backings: Sprite[] = [];
    private readonly deps: ViewDeps;

    constructor(deps: ViewDeps, style: CrateTierMarkStyle) {
        this.deps = deps;
        this.style = style;
        for (let i = 0; i < style.count; i++) {
            const backing = deps.renderer.pool.acquire();
            deps.textures.apply(backing, style.sprite, 1);
            backing.tint = BACKING_TINT;
            backing.alpha = BACKING_ALPHA;
            this.backings.push(backing);
            const star = deps.renderer.pool.acquire();
            deps.textures.apply(star, style.sprite, 1);
            star.tint = style.tint;
            this.sprites.push(star);
        }
    }

    /** Places the stars over a crate at `pos` (world), `rot` radians, obstacle `scale`, z order of the crate. */
    update(pos: Vec2, rot: number, scale: number, visible: boolean, layer: number, zOrd: number, zIdx: number): void {
        const centres = crateTierMarkLayout(this.style, pos, rot, scale);
        const s = (this.style.size * scale * PIXELS_PER_UNIT) / STAR_FRAME_PX;
        const renderer = this.deps.renderer;
        for (let i = 0; i < this.sprites.length; i++) {
            const local = toLocal(centres[i]);
            const star = this.sprites[i];
            const backing = this.backings[i];
            for (const sprite of [backing, star]) {
                sprite.position.set(local.x, local.y);
                sprite.rotation = -rot;
                sprite.visible = visible;
            }
            star.scale.set(s);
            backing.scale.set(s * BACKING_SCALE);
            renderer.add(backing, layer, zOrd + 1, zIdx);
            renderer.add(star, layer, zOrd + 2, zIdx);
        }
    }

    setVisible(visible: boolean): void {
        for (const sprite of [...this.backings, ...this.sprites]) sprite.visible = visible;
    }

    destroy(): void {
        for (const sprite of [...this.backings.splice(0), ...this.sprites.splice(0)]) {
            this.deps.renderer.pool.release(sprite);
        }
    }
}
