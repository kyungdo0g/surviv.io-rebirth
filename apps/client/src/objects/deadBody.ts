// Dead body (M9): a grey skull with the dead player's name under it, where the player died. survev
// client/src/objects/deadBody.ts: skull.img at scale 0.4 tinted 0x5a5a5a, the name in bold Arial 24 px (30 px on high-DPI
// screens) drawn at half scale with a 1 px black drop shadow, tinted grey (HSV value 0.5) and anchored (0.5, -1) so it
// sits below the skull; zOrd 12, on the stairs layer (zOrd 112) when the body and the viewer are on the ground floor and
// the body lies on stairs. The name is looked up once, when the body appears.
import type { Vec2 } from "@rebirth/core";
import type { DeadBodyView } from "@rebirth/sim";
import { Container, type Sprite, Text } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

const SKULL_SPRITE = "skull.img";
const SKULL_SCALE = 0.4;
/** survev deadBody.ts sprite.tint = 5921370 */
const SKULL_TINT = 0x5a5a5a;
/** util.rgbToInt(util.hsvToRgb(0, 0, 0.5)) */
const NAME_TINT = 0x7f7f7f;
const Z_ORD = 12;
/** the body's stairs probe (survev: collider.createCircle(pos, 1)) */
const STAIRS_RAD = 1;

/** Whether a circle on `pos` touches the stairs of a structure in view (ObjectWorld.insideStructureStairs). */
export type StairsProbe = (pos: Vec2, rad: number) => boolean;

export class DeadBodyRender implements ObjectRender<DeadBodyView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    private readonly onStairs: StairsProbe;
    readonly container = new Container({ label: "dead-body" });
    private readonly sprite: Sprite;
    readonly nameText: Text;
    private data!: DeadBodyView;
    private nameSet = false;

    constructor(deps: ViewDeps, id: number, onStairs: StairsProbe) {
        this.deps = deps;
        this.id = id;
        this.onStairs = onStairs;
        this.sprite = deps.renderer.pool.acquire();
        deps.textures.apply(this.sprite, SKULL_SPRITE, SKULL_SCALE);
        this.sprite.scale.set(SKULL_SCALE);
        this.sprite.tint = SKULL_TINT;
        const hiDpi = typeof window !== "undefined" && window.devicePixelRatio > 1;
        this.nameText = new Text({
            text: "",
            resolution: 2,
            style: {
                fontFamily: "Arial",
                fontWeight: "bold",
                fontSize: hiDpi ? 30 : 24,
                align: "center",
                fill: 0xffffff,
                dropShadow: { color: 0x000000, blur: 1, angle: Math.PI / 3, distance: 1, alpha: 1 },
            },
        });
        this.nameText.anchor.set(0.5, -1);
        this.nameText.scale.set(0.5);
        this.nameText.tint = NAME_TINT;
        this.container.addChild(this.sprite, this.nameText);
    }

    /** the skull drew and the name the body shows (tests) */
    get shown(): { name: string; skull: boolean } {
        return { name: this.nameText.text, skull: this.sprite.visible && this.container.visible };
    }

    setData(view: DeadBodyView, isNew: boolean): void {
        this.data = view;
        if (isNew) this.nameSet = false;
    }

    update(ctx: FrameContext, pos: Vec2): void {
        if (!this.nameSet) {
            const name = this.deps.nameOf?.(this.data.playerId) ?? "";
            this.nameText.text = name;
            // names arrive with the snapshot's PlayerInfos: retry until known
            this.nameSet = name !== "";
        }
        let layer = this.data.layer;
        let zOrd = Z_ORD;
        if (layer === 0 && ctx.localLayer === 0 && this.onStairs(pos, STAIRS_RAD)) {
            layer |= 2;
            zOrd += 100;
        }
        const local = toLocal(pos);
        this.container.position.set(local.x, local.y);
        this.deps.renderer.add(this.container, layer, zOrd, this.data.id);
    }

    bounds(pos: Vec2): ViewBounds {
        // the name can be wider than the skull
        return boxAround(pos, 4);
    }

    setVisible(visible: boolean): void {
        this.container.visible = visible;
    }

    destroy(): void {
        this.container.removeFromParent();
        this.deps.renderer.pool.release(this.sprite);
        this.container.destroy({ children: true });
    }
}
