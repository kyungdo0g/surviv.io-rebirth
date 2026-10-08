// Building: floor images under everything and ceiling images over players, rotated with the building.
// The ceiling fades out (12/s) while the followed player can see into one of its zoomIn regions and fades back in
// `ceiling.vision.linger` seconds later at `vision.fadeRate` (survev client/src/objects/building.ts m_update, the same
// in the 0.8.82 client): "seeing into" is the original's ray scan (worldQuery.ts scanCollider: 5 rays over
// 2 x vision.width towards the region, reaching it within vision.dist before a wall), so the roof opens when peeking
// through a doorway or a window, not only once inside. Defaults: dist 5.5, width 2.75, linger 0, fadeRate 12.
// M5: a collapsed roof (`ceilingDead`) stays revealed and leaves its residue sprite on the floor; the collapse,
// puzzle sounds, occupied emitters and sound emitters are in buildingFx.ts.
import { type Aabb, collider, math, type Vec2, v2 } from "@rebirth/core";
import type { BuildingDef, FloorImage } from "@rebirth/defs";
import { MapObjectDefs } from "@rebirth/defs";
import type { BuildingView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import { roofsHidden } from "../globals.ts";
import type { ViewBounds } from "../render/camera.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { BuildingFx } from "./buildingFx.ts";
import { adjustValue, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";
import { type WorldQuery, worldQueriesOf } from "./worldQuery.ts";

/** zOrd base of ceilings: 750 - building zIdx (survev building.ts) */
const CEILING_Z_ORD = 750;
/** fade-out rate (1/s) when the ceiling is revealed */
const REVEAL_RATE = 12;
/** survev building.ts ceiling vision defaults */
const DEFAULT_VISION = { dist: 5.5, width: 2.75, linger: 0, fadeRate: 12 };
/** survev building.ts: scanCollider(zoomIn, ..., height 0.5, width x 2, dist, 5 rays) */
const SCAN_HEIGHT = 0.5;
const SCAN_RAYS = 5;

/** survev building.ts step(): moves by delta x rate, snapping once the step is tiny */
function step(cur: number, target: number, rate: number): number {
    const delta = target - cur;
    const s = delta * Math.min(1, rate);
    return Math.abs(s) < 0.001 ? delta : s;
}

interface BuildingImg {
    sprite: Sprite;
    def: FloorImage;
    isCeiling: boolean;
    /** world-space offset from the building position (already rotated) */
    offset: Vec2;
    rotOffset: number;
    /** scale factors to the image's logical size where the sprite manifest's is wrong */
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
    private zoomIn: Aabb[] = [];
    /** the local player stood under this roof last frame (planes fade out indoors) */
    localInside = false;
    private localBounds: ViewBounds | null = null;
    private visionTicker = 0;
    /** 1 = ceiling fully drawn, 0 = hidden */
    ceilingAlpha = 1;
    private fx: BuildingFx | null = null;
    /** collapsed-roof residue on the floor */
    private residue: Sprite | null = null;
    private readonly queries: WorldQuery | null;

    constructor(deps: ViewDeps, id: number) {
        this.deps = deps;
        this.id = id;
        this.queries = worldQueriesOf(deps);
    }

    setData(view: BuildingView, isNew: boolean): void {
        this.data = view;
        if (!isNew) {
            this.fx?.setData(view, false);
            this.updateResidue();
            return;
        }
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
        this.fx = new BuildingFx(this.deps, this.def, view);
        this.fx.setData(view, true);
        // a roof that was already gone when the building entered the view is not revealed gradually
        if (view.ceilingDead) this.ceilingAlpha = 0;
        this.updateResidue();
    }

    /** The collapsed roof's residue on the first floor image (survev building.ts: a child of imgs[0]). */
    private updateResidue(): void {
        const residue = this.def.ceiling.destroy?.residue;
        if (this.residue || !this.data.ceilingDead || !residue || residue === "none") return;
        const floor = this.imgs.find((img) => !img.isCeiling);
        if (!floor) return;
        const sprite = this.deps.renderer.pool.acquire();
        this.deps.textures.apply(sprite, residue, floor.def.scale);
        this.residue = sprite;
    }

    /** floor and ceiling sprites as drawn (tests) */
    get drawnImgs(): Array<{ sprite: Sprite; isCeiling: boolean }> {
        return this.imgs.map((img) => ({ sprite: img.sprite, isCeiling: img.isCeiling }));
    }

    /** roof collapses and puzzle sounds played in view (tests) */
    get fxCounts(): { collapses: number; puzzleFails: number; puzzleSolves: number } {
        const fx = this.fx;
        return {
            collapses: fx?.collapses ?? 0,
            puzzleFails: fx?.puzzleFails ?? 0,
            puzzleSolves: fx?.puzzleSolves ?? 0,
        };
    }

    /** Whether `pos` is inside one of the roof's zoom regions (survev isInsideCeiling). */
    insideCeiling(pos: Vec2): boolean {
        return this.zoomIn.some((b) => pos.x >= b.min.x && pos.x <= b.max.x && pos.y >= b.min.y && pos.y <= b.max.y);
    }

    /** Distance from `pos` to the ceiling regions, capped at `maxDist`; 0 inside (survev getDistanceToBuilding). */
    distanceToCeiling(pos: Vec2, maxDist: number): number {
        let dist = maxDist;
        for (const b of this.zoomIn) {
            const dx = Math.max(b.min.x - pos.x, 0, pos.x - b.max.x);
            const dy = Math.max(b.min.y - pos.y, 0, pos.y - b.max.y);
            dist = Math.min(dist, Math.hypot(dx, dy));
        }
        return dist;
    }

    /**
     * Whether the followed player sees into a zoomIn region from a layer that sees this building: the original's ray
     * scan, or (without world queries, e.g. the renderer fixture) standing inside the region.
     */
    private seesInside(ctx: FrameContext, vision: typeof DEFAULT_VISION): boolean {
        if (this.data.layer !== ctx.localLayer && !(ctx.localLayer & 2)) return false;
        const p = ctx.localPos;
        const q = this.queries;
        return this.zoomIn.some((b) =>
            q
                ? q.scanCollider(b, p, ctx.localLayer, SCAN_HEIGHT, vision.width * 2, vision.dist, SCAN_RAYS)
                : p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y,
        );
    }

    update(ctx: FrameContext, pos: Vec2): void {
        const vision = { ...DEFAULT_VISION, ...this.def.ceiling.vision };
        this.visionTicker -= ctx.dt;
        const seen = this.seesInside(ctx, vision);
        this.localInside = !this.data.ceilingDead && this.insideCeiling(ctx.localPos) && seen;
        const canSeeInside = seen || this.data.ceilingDead;
        if (canSeeInside) this.visionTicker = vision.linger + 0.0001;
        // next to cellar stairs nothing is revealed (survev building.ts noCeilingRevealTicker)
        const blocked = !!this.queries?.noCeilingReveal;
        if (blocked && !this.data.ceilingDead) this.visionTicker = 0;
        const revealed = this.visionTicker > 0;
        this.ceilingAlpha += step(
            this.ceilingAlpha,
            revealed ? 0 : 1,
            ctx.dt * (revealed ? REVEAL_RATE : vision.fadeRate),
        );
        // on stairs looking into the other floor the roof opens at once (survev building.ts m_update)
        if (canSeeInside && !blocked && ctx.localLayer & 2 && (this.data.layer & 1) !== (ctx.localLayer & 1)) {
            this.ceilingAlpha = 0;
        }
        if (roofsHidden()) this.ceilingAlpha = 0;

        const renderer = this.deps.renderer;
        let ceilingLayer = this.data.layer;
        let ceilingZOrd = CEILING_Z_ORD;
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
            if (img.isCeiling) {
                ceilingLayer = layer;
                ceilingZOrd = img.zOrd;
            }
        }
        const floor = this.imgs.find((img) => !img.isCeiling);
        if (this.residue && floor) {
            this.residue.position.copyFrom(floor.sprite.position);
            this.residue.scale.copyFrom(floor.sprite.scale);
            this.residue.rotation = floor.sprite.rotation;
            this.residue.visible = floor.sprite.visible;
            renderer.add(this.residue, this.data.layer, floor.zOrd, floor.zIdx + 50);
        }
        this.fx?.update({
            dt: ctx.dt,
            cameraPos: ctx.localPos,
            localPos: ctx.localPos,
            localLayer: ctx.localLayer,
            ceilingAlpha: this.ceilingAlpha,
            ceilingLayer,
            ceilingZOrd,
        });
    }

    bounds(pos: Vec2): ViewBounds {
        let rad = 0;
        for (const img of this.imgs) {
            const tex = img.sprite.texture;
            const size = Math.max(tex.width, tex.height);
            const r = v2.length(img.offset) + (size * 0.75 * img.def.scale) / PIXELS_PER_UNIT;
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
        if (this.residue) this.residue.visible = visible;
        if (!visible) this.fx?.silence();
    }

    destroy(): void {
        for (const img of this.imgs) this.deps.renderer.pool.release(img.sprite);
        this.imgs.length = 0;
        if (this.residue) this.deps.renderer.pool.release(this.residue);
        this.residue = null;
        this.fx?.destroy();
        this.fx = null;
    }
}
