// Ground decal (explosion scorch marks, residues spawned by the map): one sprite ordered by its image zIdx.
// survev client/src/objects/decal.ts.
import { math, type Vec2 } from "@rebirth/core";
import { type DecalDef, MapObjectDefs } from "@rebirth/defs";
import type { DecalView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { adjustValue, boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

export class DecalRender implements ObjectRender<DecalView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly sprite: Sprite;
    private def!: DecalDef;
    private data!: DecalView;

    constructor(deps: ViewDeps, id: number) {
        this.deps = deps;
        this.id = id;
        this.sprite = deps.renderer.pool.acquire();
    }

    setData(view: DecalView, isNew: boolean): void {
        this.data = view;
        if (!isNew) return;
        this.def = MapObjectDefs[view.type] as DecalDef;
        this.deps.textures.apply(this.sprite, this.def.img.sprite, this.def.img.scale);
        this.sprite.tint = adjustValue(this.def.img.tint, this.deps.mapDef.biome.valueAdjust);
        this.sprite.alpha = this.def.img.alpha;
    }

    update(_ctx: FrameContext, pos: Vec2): void {
        const local = toLocal(pos);
        this.sprite.position.set(local.x, local.y);
        this.sprite.scale.set(this.data.scale * this.def.img.scale);
        this.sprite.rotation = -math.oriToRad(this.data.ori);
        // decals sort by image zIdx, then id (survev decal.ts)
        this.deps.renderer.add(this.sprite, this.data.layer, this.def.img.zIdx, this.data.id);
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
        this.deps.renderer.pool.release(this.sprite);
    }
}
