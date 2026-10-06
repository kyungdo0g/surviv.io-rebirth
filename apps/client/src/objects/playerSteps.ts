// What a player's feet do to the world (survev client/src/objects/player.ts update + updateSubmersion, the same in the
// 0.8.82 client), for every player view drawn:
// - footsteps: `footstep_<surface>` every 4 units walked on dry ground; in water `footstep_water` and a ripple every 5
//   units and on stepping in (positional, fall-off 3, muffled from another floor); the surface comes from the
//   building floor, decal or terrain under the player (worldQuery.ts groundSurface);
// - wading: the body is overlaid with the water-tinted `player-wading-01` ring, clipped to the body circle, growing
//   with the depth (0.6 at the shore to 1 at 12 units into a river / 16 into the sea); a downed player's hands and feet
//   are tinted too;
// - bushes: entering or leaving a bush (a circle of a quarter of the player radius touching it) plays its
//   `sound.enter` and throws 3-4 of its `hitParticle` leaves back along the movement (in) or ahead of it (out), at
//   most every 0.2 s.
import { math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, type ObstacleDef } from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import { type Container, Graphics, type Sprite } from "pixi.js";
import type { ViewDeps } from "./types.ts";
import { type GroundSurface, type QueryObstacle, type WorldQuery, worldQueriesOf } from "./worldQuery.ts";

/** survev player.ts: a step sound every 4 units on land, a splash every 5 in water */
export const STEP_DIST = 4;
export const WATER_STEP_DIST = 5;
/** survev player.ts: no second bush effect within 0.2 s */
const BUSH_COOLDOWN = 0.2;
/** the body texture's radius in pixels the wading ring is clipped to (survev initSubmergeSprites: 38 x 2) */
const SUBMERGE_MASK_RAD = 76;
const BODY_SCALE = 0.25;

export type StepEvent = "water" | "step" | null;

/** Footstep cadence (survev player.ts update "Play a footstep if we've moved enough"). */
export class StepCounter {
    distance = 0;
    wasInWater = false;

    /** Adds `dist` walked this frame; returns the step to play, if any. */
    advance(dist: number, inWater: boolean): StepEvent {
        this.distance += dist;
        let event: StepEvent = null;
        if ((this.distance > WATER_STEP_DIST && inWater) || (inWater && !this.wasInWater)) {
            this.distance = 0;
            event = "water";
        } else if (this.distance > STEP_DIST && !inWater) {
            this.distance = 0;
            event = "step";
        }
        this.wasInWater = inWater;
        return event;
    }
}

/** limbs a downed player shows submerged: the limb container, its sprite and the texture of its overlay */
export interface SubmergeLimb {
    parent: Container;
    sprite: Sprite;
    image: string;
}

export class PlayerSteps {
    private readonly deps: ViewDeps;
    private readonly queries: WorldQuery | null;
    readonly steps = new StepCounter();
    private lastPos: Vec2 | null = null;
    /** where the player was drawn last frame (reused every frame) */
    private readonly prevPos: Vec2 = { x: 0, y: 0 };
    private resumed = false;
    /** last query results and what they were computed for */
    private bush: QueryObstacle | null = null;
    private ground: GroundSurface | null = null;
    private queryGen = -1;
    private queryLayer = -1;
    private wasInBush = false;
    private bushDef: ObstacleDef | null = null;
    private bushTicker = 0;
    private submersion = 0;
    private readonly wading: Sprite;
    private readonly mask = new Graphics();
    private readonly limbs: Array<{ limb: SubmergeLimb; overlay: Sprite }> = [];
    /** footsteps, water steps and bush effects played (tests) */
    counts = { steps: 0, waterSteps: 0, bush: 0 };
    surface = "";

    /** `acquire` hands out pooled sprites the player releases; `body` holds the body sprite. */
    constructor(deps: ViewDeps, acquire: () => Sprite, body: Container, bodySprite: Sprite, limbs: SubmergeLimb[]) {
        this.deps = deps;
        this.queries = worldQueriesOf(deps);
        this.wading = acquire();
        this.wading.visible = false;
        body.addChildAt(this.wading, body.getChildIndex(bodySprite) + 1);
        this.mask.circle(0, 0, SUBMERGE_MASK_RAD * BODY_SCALE).fill(0xff0000);
        body.addChild(this.mask);
        this.mask.visible = false;
        for (const limb of limbs) {
            const overlay = acquire();
            overlay.visible = false;
            limb.parent.addChildAt(overlay, limb.parent.getChildIndex(limb.sprite) + 1);
            this.limbs.push({ limb, overlay });
        }
    }

    /**
     * The view was culled: no frames for a while. The next frame starts afresh (no step for the distance moved off
     * screen and no bush effect), like a player just seen.
     */
    suspend(): void {
        this.lastPos = null;
        this.resumed = true;
    }

    /** Per frame with the drawn position; `isNew`: the player's first frame (no bush effect). */
    update(view: PlayerView, pos: Vec2, dt: number, isNew: boolean): void {
        const q = this.queries;
        const lastX = this.lastPos?.x ?? pos.x;
        const lastY = this.lastPos?.y ?? pos.y;
        const last = this.prevPos;
        last.x = lastX;
        last.y = lastY;
        if (this.lastPos) {
            this.lastPos.x = pos.x;
            this.lastPos.y = pos.y;
        } else {
            this.lastPos = { x: pos.x, y: pos.y };
        }
        const fresh = isNew || this.resumed;
        this.resumed = false;
        if (!q) return;
        const layer = view.layer;
        // a player standing still keeps its surface and bush (re-checked once the world changed)
        const moved = pos.x !== last.x || pos.y !== last.y || layer !== this.queryLayer || fresh;
        if (moved || q.generation !== this.queryGen) {
            this.bush = q.bushAt(pos, GameConfig.player.radius * (view.scale || 1) * 0.25, layer);
            this.queryGen = q.generation;
        }
        if (moved || !this.ground) this.ground = q.groundSurface(pos, layer);
        this.queryLayer = layer;
        this.updateBush(view, pos, last, dt, fresh);
        const surface = this.ground;
        this.surface = surface.type;
        const inWater = surface.type === "water";
        this.updateSubmersion(q, view, pos, surface, dt);
        if (view.dead) return;
        const event = this.steps.advance(Math.hypot(pos.x - last.x, pos.y - last.y), inWater);
        if (!event) return;
        const audio = this.deps.audio;
        const opts = { pos, fallOff: 3, layer, filter: "muffled" };
        if (event === "water") {
            this.counts.waterSteps++;
            this.deps.particles?.add("waterRipple", layer, pos, { x: 0, y: 0 }, { rot: 0, color: surface.rippleColor });
            audio?.playGroup("footstep_water", opts);
        } else {
            this.counts.steps++;
            audio?.playGroup(`footstep_${surface.type}`, opts);
        }
    }

    private updateBush(view: PlayerView, pos: Vec2, last: Vec2, dt: number, isNew: boolean): void {
        const bush = this.bush;
        if (bush) this.bushDef = bush.def;
        const inside = !!bush;
        this.bushTicker -= dt;
        if (inside !== this.wasInBush && this.bushTicker < 0 && !isNew && this.bushDef) {
            this.bushTicker = BUSH_COOLDOWN;
            this.counts.bush++;
            const def = this.bushDef;
            // the 0.8.82 client passes `falloff: 1`, a key its audio manager ignores: the default fall-off 0 applies
            this.deps.audio?.playSound(def.sound.enter, { channel: "sfx", pos, layer: view.layer, filter: "muffled" });
            const moveDir = v2.normalizeSafe(v2.sub(last, pos), { x: 1, y: 0 });
            const dir = v2.mul(moveDir, inside ? 1 : -1);
            const count = Math.floor(3 + Math.random() * 2);
            for (let i = 0; i < count; i++) {
                const vel = v2.mul(v2.rotate(dir, ((Math.random() - 0.5) * Math.PI) / 1.5), 6 + Math.random() * 2);
                this.deps.particles?.add(def.hitParticle, view.layer, pos, vel);
            }
        }
        this.wasInBush = inside;
    }

    private updateSubmersion(q: WorldQuery, view: PlayerView, pos: Vec2, surface: GroundSurface, dt: number): void {
        const inWater = surface.type === "water";
        this.submersion = math.lerp(Math.min(1, dt * 4), this.submersion, q.submersion(pos, surface));
        const alpha = this.submersion * 0.8;
        const visible = alpha > 0.001;
        const wading = this.wading;
        if (visible && !wading.visible) {
            this.deps.textures.apply(wading, "player-wading-01.img", BODY_SCALE * 1.32 * (view.scale || 1));
            wading.mask = this.mask;
        }
        wading.visible = visible;
        this.mask.visible = visible;
        if (visible) {
            wading.scale.set(BODY_SCALE * (0.9 - this.submersion * 0.4) * 2);
            wading.alpha = alpha;
            if (inWater) wading.tint = surface.waterColor;
        } else if (wading.mask) {
            wading.mask = null;
        }
        for (const { limb, overlay } of this.limbs) {
            const limbAlpha = view.downed ? alpha : 0;
            const show = limbAlpha > 0.001;
            if (show && !overlay.visible) {
                this.deps.textures.apply(overlay, limb.image, limb.sprite.scale.x);
                // weapon changes reorder the hand containers: keep the overlay right over its limb
                const parent = limb.parent;
                parent.setChildIndex(
                    overlay,
                    Math.min(parent.getChildIndex(limb.sprite) + 1, parent.children.length - 1),
                );
            }
            overlay.visible = show;
            if (!show) continue;
            overlay.position.copyFrom(limb.sprite.position);
            overlay.scale.copyFrom(limb.sprite.scale);
            overlay.rotation = limb.sprite.rotation;
            overlay.alpha = limbAlpha;
            if (inWater) overlay.tint = surface.waterColor;
        }
    }

    /** current submersion 0..1 (tests) */
    get depth(): number {
        return this.submersion;
    }

    /** Detaches the mask before the player releases its pooled sprites. */
    destroy(): void {
        this.wading.mask = null;
        this.mask.destroy();
    }
}
