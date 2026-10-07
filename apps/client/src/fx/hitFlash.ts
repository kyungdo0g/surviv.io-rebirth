// Rebirth body flash (user/2026-10-07-hit-feedback): a hit player's body flashes white for 40 ms, then red, fading out
// within 0.14-0.26 s depending on the damage (fx/hitFeedbackMath.ts flashParams). The flash is one sprite of the plain
// player body circle (the outfitBase base sprite, a white circle, so every outfit flashes the same) added on top of the
// player's root container, the parent of the original blood splats: it moves with the player and hides with it under
// roofs, bushes and smoke. Sprites come from the renderer's pool and go back when the flash ends; a player view
// destroyed mid-flash takes its sprite with it, which is then dropped instead of pooled (like particles.ts).
// At most MAX_FLASHES run at once (a big fight would otherwise add a sprite per hit player): the viewer's own hits
// replace other flashes, other hits are skipped while every flash is busy.
import { GameObjectDefs, type OutfitDef } from "@rebirth/defs";
import type { Container, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { SpritePool } from "../render/pool.ts";
import { type FlashParams, flashAlpha, flashTint, MAX_FLASHES } from "./hitFeedbackMath.ts";

/** the plain body circle (white; survev player.ts bodySprite of outfitBase) */
const BODY_SPRITE = (GameObjectDefs.outfitBase as OutfitDef | undefined)?.skinImg.baseSprite ?? "player-base-01.img";
/** body sprite scale in pixel space (survev player.ts: 0.25 x the player's scale) */
const BODY_SCALE = 0.25;

interface Flash {
    playerId: number;
    sprite: Sprite;
    parent: Container;
    /** peak alpha and duration (FlashParams, copied: callers reuse theirs) */
    alpha: number;
    duration: number;
    age: number;
    /** a hit the viewer's player dealt or took */
    own: boolean;
}

export class HitFlashes {
    private readonly pool: SpritePool;
    private readonly textures: TextureStore;
    private readonly active: Flash[] = [];
    /** finished flash records, reused */
    private readonly spare: Flash[] = [];
    /** flashes started since boot, and skipped because MAX_FLASHES were running (tests, debug) */
    started = 0;
    skipped = 0;

    constructor(pool: SpritePool, textures: TextureStore) {
        this.pool = pool;
        this.textures = textures;
    }

    get count(): number {
        return this.active.length;
    }

    /**
     * Flashes `playerId`'s body inside `parent`; a running flash restarts at the higher of the two alphas. With
     * MAX_FLASHES running, an `own` flash (a hit the viewer's player dealt or took) replaces the oldest other flash, or
     * the oldest own one, and any other flash is skipped. Returns whether the body flashes.
     */
    flash(playerId: number, parent: Container, scale: number, params: FlashParams, own = true): boolean {
        if (parent.destroyed) return false;
        for (const f of this.active) {
            if (f.playerId !== playerId) continue;
            if (f.parent !== parent) {
                this.free(f);
                break;
            }
            f.alpha = Math.max(flashAlpha(f.alpha, f.duration, f.age), params.alpha);
            f.duration = Math.max(params.duration, f.duration);
            f.age = 0;
            f.own ||= own;
            f.sprite.scale.set(BODY_SCALE * scale);
            // left where it is: moving a child rebuilds the scene's render instructions (a Pixi structure change)
            if (f.sprite.parent !== parent) parent.addChild(f.sprite);
            return true;
        }
        if (this.active.length >= MAX_FLASHES) {
            const replaced = own ? this.replaceable() : -1;
            if (replaced < 0) {
                this.skipped++;
                return false;
            }
            this.drop(replaced, true);
        }
        const sprite = this.pool.acquire();
        this.textures.apply(sprite, BODY_SPRITE, BODY_SCALE * scale);
        sprite.scale.set(BODY_SCALE * scale);
        sprite.alpha = 0;
        parent.addChild(sprite);
        const f = this.spare.pop() ?? ({} as Flash);
        f.playerId = playerId;
        f.sprite = sprite;
        f.parent = parent;
        f.alpha = params.alpha;
        f.duration = params.duration;
        f.age = 0;
        f.own = own;
        this.active.push(f);
        this.started++;
        return true;
    }

    /** Index of the flash an own flash replaces when all are busy: the oldest other flash, else the oldest own one. */
    private replaceable(): number {
        let best = -1;
        for (let i = 0; i < this.active.length; i++) {
            const f = this.active[i];
            const b = best < 0 ? null : this.active[best];
            if (!b || (b.own && !f.own) || (b.own === f.own && f.age > b.age)) best = i;
        }
        return best;
    }

    update(dt: number): void {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const f = this.active[i];
            if (f.sprite.destroyed || f.parent.destroyed) {
                this.drop(i, false);
                continue;
            }
            // drawn at its age before this frame's step, so even a frame longer than the flash (a stall, a slow
            // software renderer) shows it once
            const alpha = flashAlpha(f.alpha, f.duration, f.age);
            if (alpha <= 0 || f.age > f.duration + 0.05) {
                this.drop(i, true);
                continue;
            }
            const tint = flashTint(f.age);
            f.age += dt;
            if (f.sprite.tint !== tint) f.sprite.tint = tint;
            f.sprite.alpha = alpha;
            f.sprite.visible = true;
        }
    }

    private free(f: Flash): void {
        const i = this.active.indexOf(f);
        if (i >= 0) this.drop(i, !f.sprite.destroyed);
    }

    private drop(index: number, release: boolean): void {
        const f = this.active[index];
        this.active.splice(index, 1);
        if (release && !f.sprite.destroyed) this.pool.release(f.sprite);
        f.parent = null as unknown as Container;
        f.sprite = null as unknown as Sprite;
        this.spare.push(f);
    }

    /** Ends every flash (the setting turned off, the world was reset). */
    clear(): void {
        for (let i = this.active.length - 1; i >= 0; i--) this.drop(i, true);
    }
}
