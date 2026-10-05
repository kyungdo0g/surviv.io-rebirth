// Loot on the ground: item image inside its border circle, as in survev client/src/objects/loot.ts. The border is
// tinted with the gun's ammo colour (tintDark) or the def's borderTint. (Preloaded guns' special border needs an
// `isPreloadedGun` flag the LootView does not carry yet.)
// Freshly dropped loot pops in with an elastic scale (loot already lying there when it enters the view does not).
// Border and item are sibling sprites because Pixi v8 multiplies tints down the hierarchy.
import type { Vec2 } from "@rebirth/core";
import { type AmmoDef, GameObjectDefs, type LootDef } from "@rebirth/defs";
import type { LootView } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

const LOOT_Z_ORD = 13;
/** new loot farther than this from the viewer was already lying there and entered the view (no pop-in) */
const FRESH_DIST = 24;

/** survev math.easeOutElastic */
function easeOutElastic(e: number, t = 0.3): number {
    return 2 ** (e * -10) * Math.sin(((e - t / 4) * (Math.PI * 2)) / t) + 1;
}

export class LootRender implements ObjectRender<LootView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly container = new Container();
    private readonly border: Sprite;
    private readonly item: Sprite;
    private imgScale = 0.3;
    private data!: LootView;
    /** seconds since it appeared; starts past the pop-in for loot that was already there */
    private ticker = 10;
    private firstUpdate = true;
    private readonly maybeFresh: boolean;

    /** `maybeFresh`: created after the first snapshot, so it may have just been dropped */
    constructor(deps: ViewDeps, id: number, maybeFresh = false) {
        this.deps = deps;
        this.id = id;
        this.maybeFresh = maybeFresh;
        this.border = deps.renderer.pool.acquire();
        this.item = deps.renderer.pool.acquire();
        this.container.addChild(this.border, this.item);
    }

    get type(): string {
        return this.data.type;
    }

    setData(view: LootView, isNew: boolean): void {
        this.data = view;
        if (!isNew) return;
        const def = GameObjectDefs[view.type] as LootDef | undefined;
        if (!def?.lootImg) return;
        const img = def.lootImg;
        this.imgScale = img.scale * 1.25;
        const inner = img.innerScale ?? 0.8;
        this.deps.textures.apply(this.item, img.sprite, this.imgScale * inner);
        this.item.tint = img.tint;
        this.item.rotation = img.rot ?? 0;
        this.item.scale.set(img.mirror ? -inner : inner, inner);
        this.deps.textures.apply(this.border, img.border, this.imgScale);
        const ammo = "ammo" in def ? (GameObjectDefs[def.ammo] as AmmoDef | undefined) : undefined;
        this.border.tint = ammo?.lootImg.tintDark ?? img.borderTint ?? 0;
    }

    update(ctx: FrameContext, pos: Vec2): void {
        if (this.firstUpdate) {
            this.firstUpdate = false;
            const near = Math.hypot(pos.x - ctx.localPos.x, pos.y - ctx.localPos.y) < FRESH_DIST;
            if (this.maybeFresh && near) this.ticker = 0;
        }
        this.ticker += ctx.dt;
        const pop = easeOutElastic(Math.min(1, Math.max(0, this.ticker)), 0.75);
        const local = toLocal(pos);
        this.container.position.set(local.x, local.y);
        this.container.scale.set(this.imgScale * pop);
        this.deps.renderer.add(this.container, this.data.layer, LOOT_Z_ORD, this.data.id);
    }

    bounds(pos: Vec2): ViewBounds {
        return boxAround(pos, 3);
    }

    setVisible(visible: boolean): void {
        this.container.visible = visible;
    }

    destroy(): void {
        this.container.removeFromParent();
        this.deps.renderer.pool.release(this.border);
        this.deps.renderer.pool.release(this.item);
        this.container.destroy();
    }
}
