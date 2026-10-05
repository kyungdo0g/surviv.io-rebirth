// Building: floor images under everything and ceiling images over players, rotated with the building.
// The ceiling fades out while the local player stands inside one of its zoom regions and fades back in after
// `ceiling.vision.linger` seconds at `vision.fadeRate` (survev client/src/objects/building.ts; the original
// reveals through a vision ray-scan, approximated here by the zoomIn region test).
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import type { BuildingDef, FloorImage } from "@rebirth/defs";
import { MapObjectDefs } from "@rebirth/defs";
import type { BuildingView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { adjustValue, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

/** zOrd base of ceilings: 750 - building zIdx (survev building.ts) */
const CEILING_Z_ORD = 750;
/** fade-out rate (1/s) when the ceiling is revealed */
const REVEAL_RATE = 12;
const DEFAULT_VISION = { linger: 0, fadeRate: 12 };

interface BuildingImg {
    sprite: Sprite;
    def: FloorImage;
    isCeiling: boolean;
    /** world-space offset from the building position (already rotated) */
    offset: Vec2;
    rotOffset: number;
    zOrd: number;
    zIdx: number;
}

/** Bounding box of a building definition around its origin (unrotated, unscaled). */
export function buildingLocalBounds(def: BuildingDef): ViewBounds | null {
    const boxes: ViewBounds[] = [];
    for (const surface of def.floor.surfaces) boxes.push(...surface.collision);
    for (const region of def.ceiling.zoomRegions) {
        if (region.zoomIn) boxes.push(region.zoomIn);
        if (region.zoomOut) boxes.push(region.zoomOut);
    }
    if (!boxes.length) return null;
    const min = { x: Infinity, y: Infinity };
    const max = { x: -Infinity, y: -Infinity };
    for (const b of boxes) {
        min.x = Math.min(min.x, b.min.x);
        min.y = Math.min(min.y, b.min.y);
        max.x = Math.max(max.x, b.max.x);
        max.y = Math.max(max.y, b.max.y);
    }
    return { min, max };
}

export class BuildingRender implements ObjectRender<BuildingView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly imgs: BuildingImg[] = [];
    private def!: BuildingDef;
    private data!: BuildingView;
    private rot = 0;
    private scale = 1;
    /** zoomIn regions in world space */
    private zoomIn: ViewBounds[] = [];
    private localBounds: ViewBounds | null = null;
    private visionTicker = 0;
    /** 1 = ceiling fully drawn, 0 = hidden */
    ceilingAlpha = 1;

    constructor(deps: ViewDeps, id: number) {
        this.deps = deps;
        this.id = id;
    }

    setData(view: BuildingView, isNew: boolean): void {
        this.data = view;
        if (!isNew) return;
        this.def = MapObjectDefs[view.type] as BuildingDef;
        this.rot = math.oriToRad(view.ori);
        // building views carry no scale; buildings spawn at scale 1 (MapObjectSpawn.scale is 1 for them)
        this.scale = 1;
        const zIdx = this.def.zIdx ?? 0;
        const add = (imgDef: FloorImage, i: number, isCeiling: boolean) => {
            const sprite = this.deps.renderer.pool.acquire();
            this.deps.textures.apply(sprite, imgDef.sprite, imgDef.scale);
            sprite.tint = adjustValue(imgDef.tint, this.deps.mapDef.biome.valueAdjust);
            this.imgs.push({
                sprite,
                def: imgDef,
                isCeiling,
                offset: v2.rotate(imgDef.pos ?? { x: 0, y: 0 }, this.rot),
                rotOffset: math.oriToRad(imgDef.rot ?? 0),
                zOrd: isCeiling ? CEILING_Z_ORD - zIdx : zIdx,
                zIdx: view.id * 100 + i,
            });
        };
        this.def.floor.imgs.forEach((img, i) => {
            add(img, i, false);
        });
        this.def.ceiling.imgs.forEach((img, i) => {
            add(img, i, true);
        });
        this.zoomIn = this.def.ceiling.zoomRegions
            .filter((r) => r.zoomIn)
            .map((r) => collider.transform(r.zoomIn!, view.pos, this.rot, this.scale));
        const local = buildingLocalBounds(this.def);
        this.localBounds =
            local && collider.transform(collider.createAabb(local.min, local.max), v2.create(0), this.rot, this.scale);
    }

    /** true while the local player stands inside a ceiling zoom region on a layer that sees this building */
    private canSeeInside(ctx: FrameContext): boolean {
        if (this.data.ceilingDead) return true;
        if (this.data.layer !== ctx.localLayer && !(ctx.localLayer & 2)) return false;
        const p = ctx.localPos;
        return this.zoomIn.some((b) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y);
    }

    update(ctx: FrameContext, pos: Vec2): void {
        const vision = { ...DEFAULT_VISION, ...this.def.ceiling.vision };
        this.visionTicker -= ctx.dt;
        if (this.canSeeInside(ctx)) this.visionTicker = vision.linger + 0.0001;
        const revealed = this.visionTicker > 0;
        const target = revealed ? 0 : 1;
        const rate = ctx.dt * (revealed ? REVEAL_RATE : vision.fadeRate);
        const step = (target - this.ceilingAlpha) * Math.min(1, rate);
        this.ceilingAlpha = Math.abs(step) < 0.01 ? target : this.ceilingAlpha + step;

        const renderer = this.deps.renderer;
        for (const img of this.imgs) {
            const local = toLocal(v2.add(pos, img.offset));
            const s = this.scale * img.def.scale;
            img.sprite.position.set(local.x, local.y);
            img.sprite.scale.set(img.def.mirrorX ? -s : s, img.def.mirrorY ? -s : s);
            img.sprite.rotation = -this.rot + img.rotOffset;
            img.sprite.alpha = img.def.alpha * (img.isCeiling ? this.ceilingAlpha : 1);
            img.sprite.visible = !(img.def.removeOnDamaged && this.data.ceilingDamaged);
            let layer = this.data.layer;
            // ceilings go over players standing on stairs (survev building.ts)
            if (img.isCeiling && (layer === ctx.localLayer || (ctx.localLayer & 2 && layer === 1))) layer |= 2;
            renderer.add(img.sprite, layer, img.zOrd, img.zIdx);
        }
    }

    bounds(pos: Vec2): ViewBounds {
        let rad = 0;
        for (const img of this.imgs) {
            const tex = img.sprite.texture;
            const r =
                v2.length(img.offset) + (Math.max(tex.width, tex.height) * 0.75 * img.def.scale) / PIXELS_PER_UNIT;
            rad = Math.max(rad, r);
        }
        const lb = this.localBounds;
        return {
            min: {
                x: Math.min(pos.x - rad, pos.x + (lb?.min.x ?? 0)),
                y: Math.min(pos.y - rad, pos.y + (lb?.min.y ?? 0)),
            },
            max: {
                x: Math.max(pos.x + rad, pos.x + (lb?.max.x ?? 0)),
                y: Math.max(pos.y + rad, pos.y + (lb?.max.y ?? 0)),
            },
        };
    }

    setVisible(visible: boolean): void {
        for (const img of this.imgs) img.sprite.visible = visible;
    }

    destroy(): void {
        for (const img of this.imgs) this.deps.renderer.pool.release(img.sprite);
        this.imgs.length = 0;
    }
}
