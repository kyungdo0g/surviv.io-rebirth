// Obstacle sprite: definition image scaled by the obstacle's current scale, rotated by its orientation, tinted,
// and swapped for the residue image once dead. Ordering follows survev client/src/objects/obstacle.ts.
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import { MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import type { ObstacleView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { adjustValue, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

/** zOrd of dead obstacles (residues lie on the ground) */
const DEAD_Z_ORD = 5;
/** obstacles at or above this zOrd (bushes, trees) are drawn over stairs when viewing the ground */
const TALL_Z_ORD = 50;

export class ObstacleRender implements ObjectRender<ObstacleView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly sprite: Sprite;
    private casing: Sprite | null = null;
    private def!: ObstacleDef;
    private data!: ObstacleView;
    private img = "";
    private imgRot = 0;
    private imgAlpha = 1;
    private zOrd = 0;
    private zIdx = 0;
    /** door casings stay where the closed door was (survev obstacle.ts door.closedPos) */
    private casingPos: Vec2 = { x: 0, y: 0 };

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
            const casingImg = this.def.door?.casingImg;
            if (casingImg && !this.casing) {
                this.casing = this.deps.renderer.pool.acquire();
                this.deps.textures.apply(this.casing, casingImg.sprite, casingImg.scale);
                this.casing.tint = casingImg.tint;
                this.casing.alpha = casingImg.alpha;
                const offset = v2.rotate(casingImg.pos, math.oriToRad(view.ori) + Math.PI * 0.5);
                this.casingPos = v2.add(view.pos, offset);
            }
        }
        const img = this.def.img;
        const current = (view.dead ? img.residue : img.sprite) ?? "";
        if (current !== this.img || isNew) {
            this.img = current;
            this.deps.textures.apply(this.sprite, current, img.scale ?? 1);
            const anchor = this.def.door?.spriteAnchor ?? { x: 0.5, y: 0.5 };
            this.sprite.anchor.set(anchor.x, anchor.y);
            this.sprite.tint = adjustValue(img.tint ?? 0xffffff, this.deps.mapDef.biome.valueAdjust);
            this.imgAlpha = view.dead ? 0.75 : (img.alpha ?? 1);
            this.zOrd = img.zIdx ?? 0;
            this.zIdx = Math.floor(view.scale * 1000) * 65535 + view.id;
        }
        this.sprite.visible = current !== "";
    }

    update(ctx: FrameContext, pos: Vec2): void {
        const view = this.data;
        const img = this.def.img;
        const rot = math.oriToRad(view.ori);
        const local = toLocal(pos);
        const s = view.scale * (img.scale ?? 1);
        this.sprite.position.set(local.x, local.y);
        this.sprite.scale.set(img.mirrorX ? -s : s, img.mirrorY ? -s : s);
        this.sprite.rotation = -rot + this.imgRot;
        this.sprite.alpha = this.imgAlpha;

        let zOrd = view.dead ? DEAD_Z_ORD : this.zOrd;
        let layer = view.layer;
        if (!view.dead && zOrd >= TALL_Z_ORD && view.layer === 0 && ctx.localLayer === 0) {
            zOrd += 100;
            layer |= 2;
        }
        const renderer = this.deps.renderer;
        renderer.add(this.sprite, layer, zOrd, this.zIdx);

        const casingImg = this.def.door?.casingImg;
        if (this.casing && casingImg) {
            const casingPos = toLocal(this.casingPos);
            this.casing.position.set(casingPos.x, casingPos.y);
            this.casing.scale.set(view.scale * casingImg.scale);
            this.casing.rotation = -rot;
            this.casing.visible = !view.dead;
            renderer.add(this.casing, layer, zOrd + 1, this.zIdx);
        }
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
    }

    destroy(): void {
        this.deps.renderer.pool.release(this.sprite);
        if (this.casing) this.deps.renderer.pool.release(this.casing);
        this.casing = null;
    }
}
