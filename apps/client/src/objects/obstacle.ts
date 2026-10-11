// Obstacle sprite: definition image scaled by the obstacle's current scale, rotated by its orientation, tinted,
// and swapped for the residue image once dead; a used button shows its `useImg` (an opened air drop crate). A
// button use and a destruction seen in view trigger their particles and sounds through the fx hooks. Ordering and
// effects follow survev client/src/objects/obstacle.ts. M5: doors animate towards their new position/orientation and
// play their sounds (door.ts); the casing stays at the closed door. M9: an explosive obstacle (barrel) below half health
// smokes (survev obstacle.ts smoke_barrel emitter, drifting up-right) until it blows up. Rebirth: an air drop tier
// inner crate carries its tier's star marking (crateTierMark.ts). An obstacle disguise (`skinPlayerId`) is drawn over its
// wearer, at the wearer's interpolated position (world.ts), and smokes below 30 % health. A hit-counted blast door
// darkens and smokes as it takes launcher hits (gateDamage.ts).
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import { MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import type { ObstacleView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { Emitter } from "../fx/particles.ts";
import type { ViewBounds } from "../render/camera.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { CrateTierMark, crateTierMarkStyle } from "./crateTierMark.ts";
import { DoorAnim } from "./door.ts";
import { gateScorch, gateSmokes, isHitCountedGate } from "./gateDamage.ts";
import { adjustValue, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

/** zOrd of dead obstacles (residues lie on the ground) */
const DEAD_Z_ORD = 5;
/** obstacles at or above this zOrd (bushes, trees) are drawn over stairs when viewing the ground */
const TALL_Z_ORD = 50;
/** survev obstacle.ts: explosive obstacles smoke below half health */
const SMOKE_HEALTH = 0.5;
const SMOKE_DIR = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
/** survev obstacle.ts: a disguise smokes below 30 % of its wearer's health */
const SKIN_SMOKE_HEALTH = 0.3;
/** survev obstacle.ts: a disguise draws at least at this zOrd, over its wearer (players draw at 18) */
const SKIN_MIN_Z_ORD = 21;
/** player zOrd (objects/player.ts), +100 on stairs seen from the same level (survev player.ts updateRenderLayer) */
const PLAYER_Z_ORD = 18;
/** a disguise's zIdx is its wearer's id plus this: above every player at the same zOrd (survev renderZIdx + 262144) */
const SKIN_Z_IDX = 1 << 20;

export class ObstacleRender implements ObjectRender<ObstacleView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly sprite: Sprite;
    private casing: Sprite | null = null;
    /** rebirth air drop tier crates: the tier's stars */
    private mark: CrateTierMark | null = null;
    private def!: ObstacleDef;
    private data!: ObstacleView;
    private img = "";
    private imgRot = 0;
    private imgAlpha = 1;
    private zOrd = 0;
    private zIdx = 0;
    /** casing offset from the closed door (survev obstacle.ts casingSprite.posOffset) */
    private casingOffset: Vec2 = { x: 0, y: 0 };
    /** panel animation of a door */
    door: DoorAnim | null = null;
    private buttonSeq = -1;
    private wasDead = false;
    private smoke: Emitter | null = null;
    /** the scorch factor drawn on a hit-counted blast door (gateDamage.ts), -1 before the first */
    private scorch = -1;

    constructor(deps: ViewDeps, id: number) {
        this.deps = deps;
        this.id = id;
        this.sprite = deps.renderer.pool.acquire();
    }

    setData(view: ObstacleView, isNew: boolean): void {
        this.data = view;
        if (isNew) {
            this.def = MapObjectDefs[view.type] as ObstacleDef;
            // survev: "random" rotation keyed on the id so it stays stable when the obstacle re-enters the view
            this.imgRot = this.def.img.randomRotation ? math.deg2rad(view.id % 360) : 0;
            if (this.def.door) this.door = new DoorAnim(this.def.door, view);
            const markStyle = crateTierMarkStyle(view.type);
            if (markStyle && !this.mark) this.mark = new CrateTierMark(this.deps, markStyle);
            const casingImg = this.def.door?.casingImg;
            if (casingImg && !this.casing) {
                this.casing = this.deps.renderer.pool.acquire();
                this.deps.textures.apply(this.casing, casingImg.sprite, casingImg.scale);
                this.casing.tint = casingImg.tint;
                this.casing.alpha = casingImg.alpha;
                this.casingOffset = v2.rotate(casingImg.pos, math.oriToRad(view.ori) + Math.PI * 0.5);
            }
        }
        this.door?.setData(view, this.deps.audio, isNew);
        const img = this.def.img;
        let current = (view.dead ? img.residue : img.sprite) ?? "";
        const buttonDef = this.def.button;
        if (buttonDef && view.button) {
            if (view.button.onOff && !view.dead && buttonDef.useImg) current = buttonDef.useImg;
            else if (!view.button.canUse && buttonDef.offImg) current = buttonDef.offImg;
        }
        this.effects(view, isNew);
        this.updateSmoke(view);
        if (current !== this.img || isNew) {
            this.img = current;
            this.deps.textures.apply(this.sprite, current, img.scale ?? 1);
            const anchor = this.def.door?.spriteAnchor ?? { x: 0.5, y: 0.5 };
            this.sprite.anchor.set(anchor.x, anchor.y);
            this.sprite.tint = adjustValue(img.tint ?? 0xffffff, this.deps.mapDef.biome.valueAdjust);
            this.scorch = -1;
            this.imgAlpha = view.dead ? 0.75 : (img.alpha ?? 1);
            this.zOrd = img.zIdx ?? 0;
            this.zIdx = Math.floor(view.scale * 1000) * 65535 + view.id;
        }
        this.updateScorch(view);
        this.sprite.visible = current !== "";
    }

    /** A hit-counted blast door darkens with the hits it took (gateDamage.ts). */
    private updateScorch(view: ObstacleView): void {
        if (!isHitCountedGate(this.def) || view.dead) return;
        const scorch = gateScorch(view.healthT);
        if (scorch === this.scorch) return;
        this.scorch = scorch;
        const base = adjustValue(this.def.img.tint ?? 0xffffff, this.deps.mapDef.biome.valueAdjust);
        this.sprite.tint = adjustValue(base, scorch);
    }

    private updateSmoke(view: ObstacleView): void {
        const particles = this.deps.particles;
        const gate = isHitCountedGate(this.def);
        if (!particles || (!this.def.explosion && !gate)) return;
        const limit = view.skinPlayerId === undefined ? SMOKE_HEALTH : SKIN_SMOKE_HEALTH;
        const smokes = gate ? gateSmokes(view.healthT, view.dead) : view.healthT < limit && !view.dead;
        if (!this.smoke?.active && smokes) {
            this.smoke = particles.addEmitter("smoke_barrel", { pos: view.pos, dir: SMOKE_DIR, layer: view.layer });
        }
        if (this.smoke && view.dead) {
            this.smoke.stop();
            this.smoke = null;
        }
        if (this.smoke) {
            this.smoke.pos = { x: view.pos.x, y: view.pos.y };
            this.smoke.enabled = gate ? smokes : view.healthT < limit;
        }
    }

    /** Button and destruction effects for state changes seen while the obstacle is in view. */
    private effects(view: ObstacleView, isNew: boolean): void {
        const fx = this.deps.fx;
        const seq = view.button?.seq ?? -1;
        const used = !isNew && seq !== this.buttonSeq;
        const destroyed = !isNew && view.dead && !this.wasDead;
        this.buttonSeq = seq;
        this.wasDead = view.dead;
        if (!fx || (!used && !destroyed)) return;
        const box = collider.toAabb(
            collider.transform(this.def.collision, view.pos, math.oriToRad(view.ori), view.scale),
        );
        const center = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 };
        if (used) fx.obstacleButton?.(view, center);
        if (destroyed) fx.obstacleDestroyed?.(view, center);
    }

    update(ctx: FrameContext, pos: Vec2): void {
        const view = this.data;
        const img = this.def.img;
        const door = this.door;
        if (door) door.update(ctx.dt);
        const rot = door ? door.rot : math.oriToRad(view.ori);
        const local = toLocal(door ? door.pos : pos);
        const s = view.scale * (img.scale ?? 1);
        this.sprite.position.set(local.x, local.y);
        this.sprite.scale.set(img.mirrorX ? -s : s, img.mirrorY ? -s : s);
        this.sprite.rotation = -rot + this.imgRot;
        this.sprite.alpha = this.imgAlpha;

        let zOrd = view.dead ? DEAD_Z_ORD : this.zOrd;
        let layer = view.layer;
        let zIdx = this.zIdx;
        if (!view.dead && zOrd >= TALL_Z_ORD && view.layer === 0 && ctx.localLayer === 0) {
            zOrd += 100;
            layer |= 2;
        }
        if (!view.dead && view.skinPlayerId !== undefined) {
            // over the wearer; on stairs with the wearer (survev obstacle.ts updateRender: isSkin)
            zOrd = Math.max(zOrd, SKIN_MIN_Z_ORD);
            if (view.layer & 2) {
                layer = view.layer;
                zOrd = PLAYER_Z_ORD + ((view.layer & 1) === (ctx.localLayer & 1) ? 100 : 0);
            }
            zIdx = view.skinPlayerId + SKIN_Z_IDX;
        }
        const renderer = this.deps.renderer;
        renderer.add(this.sprite, layer, zOrd, zIdx);

        const casingImg = this.def.door?.casingImg;
        if (this.casing && casingImg) {
            const casingPos = toLocal(v2.add(door?.closedPos ?? view.pos, this.casingOffset));
            this.casing.position.set(casingPos.x, casingPos.y);
            this.casing.scale.set(view.scale * casingImg.scale);
            this.casing.rotation = -rot;
            this.casing.visible = !view.dead;
            renderer.add(this.casing, layer, zOrd + 1, zIdx);
        }
        this.mark?.update(pos, rot - this.imgRot, view.scale, this.sprite.visible && !view.dead, layer, zOrd, zIdx);
    }

    /** the obstacle (door panel) sprite, a door's slot casing and a tier crate's stars, as drawn (tests) */
    get drawn(): { sprite: Sprite; casing: Sprite | null; mark: readonly Sprite[] } {
        return { sprite: this.sprite, casing: this.casing, mark: this.mark?.sprites ?? [] };
    }

    bounds(pos: Vec2): ViewBounds {
        const box = collider.toAabb(
            collider.transform(this.def.collision, pos, math.oriToRad(this.data.ori), this.data.scale),
        );
        // the image can be much larger than the collider (tree crowns)
        const tex = this.sprite.texture;
        const rad =
            (Math.max(tex.width, tex.height) * 0.75 * (this.def.img.scale ?? 1) * this.data.scale) / PIXELS_PER_UNIT;
        return {
            min: { x: Math.min(box.min.x, pos.x - rad), y: Math.min(box.min.y, pos.y - rad) },
            max: { x: Math.max(box.max.x, pos.x + rad), y: Math.max(box.max.y, pos.y + rad) },
        };
    }

    setVisible(visible: boolean): void {
        this.sprite.visible = visible && this.img !== "";
        if (this.casing) this.casing.visible = visible && !this.data.dead;
        this.mark?.setVisible(visible && this.img !== "" && !this.data.dead);
    }

    destroy(): void {
        this.smoke?.stop();
        this.smoke = null;
        this.deps.renderer.pool.release(this.sprite);
        if (this.casing) this.deps.renderer.pool.release(this.casing);
        this.casing = null;
        this.mark?.destroy();
        this.mark = null;
    }
}
