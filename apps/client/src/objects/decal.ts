// Ground decal (explosion scorch marks, residues spawned by the map): one sprite ordered by its image zIdx.
// survev client/src/objects/decal.ts. M5: decals with a def `lifetime` (scorch marks) fade out once the simulation
// removes them; flickering decals (fire) jitter their scale; low decals in water are drawn at 30 % alpha; the club
// pool's gore decal turns red with `goreKills` along its def's `gore.fade`.
import { math, type Vec2 } from "@rebirth/core";
import { type DecalDef, MapObjectDefs } from "@rebirth/defs";
import type { DecalView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { adjustValue, boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

function lerpColor(t: number, a: number, b: number): number {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const ch = (c: number, s: number) => (c >> s) & 0xff;
    const mix = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

export class DecalRender implements ObjectRender<DecalView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly sprite: Sprite;
    private def!: DecalDef;
    private data!: DecalView;
    private imgScale = 1;
    private alpha = 1;
    private valueAdjust = 1;
    private inWater = false;
    private flickerTarget = 1;
    private flickerCooldown = 0;
    private goreT = 0;
    private isNew = true;

    constructor(deps: ViewDeps, id: number) {
        this.deps = deps;
        this.id = id;
        this.sprite = deps.renderer.pool.acquire();
    }

    setData(view: DecalView, isNew: boolean): void {
        this.data = view;
        if (!isNew) return;
        this.def = MapObjectDefs[view.type] as DecalDef;
        const img = this.def.img;
        this.deps.textures.apply(this.sprite, img.sprite, img.scale);
        this.valueAdjust = img.ignoreAdjust ? 1 : this.deps.mapDef.biome.valueAdjust;
        this.sprite.tint = adjustValue(img.tint, this.valueAdjust);
        this.imgScale = img.scale;
        this.flickerTarget = img.scale;
        this.alpha = img.alpha;
        this.inWater = this.def.height < 0.25 && this.deps.surfaceAt?.(view.pos, view.layer) === "water";
    }

    update(ctx: FrameContext, pos: Vec2): void {
        const img = this.def.img;
        if (img.flicker) {
            const min = img.flickerMin ?? img.scale;
            const max = img.flickerMax ?? img.scale;
            const rate = img.flickerRate ?? 0.1;
            if (this.flickerCooldown < 0) {
                this.flickerTarget = min + Math.random() * (max - min);
                this.flickerCooldown = 0.05 + Math.random() * (rate - 0.05);
            } else {
                this.imgScale = math.lerp(Math.min(1, rate - this.flickerCooldown), this.imgScale, this.flickerTarget);
                this.flickerCooldown -= ctx.dt;
            }
        }
        const gore = this.def.gore;
        if (gore) {
            const target = math.delerp(this.data.goreKills ?? 0, gore.fade.start, gore.fade.end) ** gore.fade.pow;
            this.goreT = this.isNew ? target : math.lerp(Math.min(1, ctx.dt * gore.fade.speed), this.goreT, target);
            if (gore.tint !== undefined) {
                this.sprite.tint = adjustValue(lerpColor(this.goreT, img.tint, gore.tint), this.valueAdjust);
            }
            this.alpha = math.lerp(this.goreT, img.alpha, gore.alpha);
        }
        this.isNew = false;
        const local = toLocal(pos);
        this.sprite.position.set(local.x, local.y);
        this.sprite.scale.set(this.data.scale * this.imgScale);
        this.sprite.rotation = -math.oriToRad(this.data.ori);
        this.sprite.alpha = this.alpha * (this.inWater ? 0.3 : 1);
        // decals sort by image zIdx, then id (survev decal.ts)
        this.deps.renderer.add(this.sprite, this.data.layer, img.zIdx, this.data.id);
    }

    bounds(pos: Vec2): ViewBounds {
        const tex = this.sprite.texture;
        return boxAround(
            pos,
            (Math.max(tex.width, tex.height) * 0.75 * this.def.img.scale * this.data.scale) / PIXELS_PER_UNIT,
        );
    }

    setVisible(visible: boolean): void {
        this.sprite.visible = visible;
    }

    destroy(): void {
        // decals with a lifetime fade out instead of vanishing (survev DecalRender.fadeout)
        const fading = this.deps.fading;
        if (fading && this.def?.lifetime !== undefined && this.sprite.visible && this.sprite.parent) {
            fading.add(this.sprite, this.data.layer, this.def.img.zIdx, this.data.id);
            return;
        }
        this.deps.renderer.pool.release(this.sprite);
    }
}
