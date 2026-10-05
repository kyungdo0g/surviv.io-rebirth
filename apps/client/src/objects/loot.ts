// Loot on the ground: item image inside its rarity border, as in survev client/src/objects/loot.ts.
// Border and item are sibling sprites because Pixi v8 multiplies tints down the hierarchy.
import type { Vec2 } from "@rebirth/core";
import { type AmmoDef, GameObjectDefs, type LootDef } from "@rebirth/defs";
import type { LootView } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

const LOOT_Z_ORD = 13;

export class LootRender implements ObjectRender<LootView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly container = new Container();
    private readonly border: Sprite;
    private readonly item: Sprite;
    private imgScale = 0.3;
    private data!: LootView;

    constructor(deps: ViewDeps, id: number) {
        this.deps = deps;
        this.id = id;
        this.border = deps.renderer.pool.acquire();
        this.item = deps.renderer.pool.acquire();
        this.container.addChild(this.border, this.item);
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

    update(_ctx: FrameContext, pos: Vec2): void {
        const local = toLocal(pos);
        this.container.position.set(local.x, local.y);
        this.container.scale.set(this.imgScale);
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
