// Mass Medicate aura (M7; survev client/src/objects/player.ts updateVisuals "Role specific visuals" and updateAura):
// while a holder of the aoe_heal perk (the 50v50 Medic) uses a heal or boost, or revives, a circle under it shows the
// reach of the effect: the item's `aura` sprite and tint (part-aura-circle-01; magenta 0xff00ff for a revive) at
// GameConfig.player.medicHealRange (8) or medicReviveRange (6) x 0.125, its alpha pulsing between 0.25 and 1
// (easeOutExpo, 1.5 per second). Hidden while downed unless the holder can revive itself, and on another floor.
import { GameConfig, GameObjectDefs } from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { Renderer } from "../render/renderer.ts";

const AURA_SCALE = 0.125;
const REVIVE_SPRITE = "part-aura-circle-01.img";
const REVIVE_TINT = 0xff00ff;

function easeOutExpo(t: number): number {
    return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

export class MedicAura {
    readonly container = new Container({ label: "aura" });
    private readonly sprite: Sprite;
    private readonly textures: TextureStore;
    private ticker = 0;
    private dir = 1;
    private key = "";

    constructor(textures: TextureStore, sprite: Sprite) {
        this.textures = textures;
        this.sprite = sprite;
        this.container.addChild(sprite);
        this.container.visible = false;
    }

    /** the aura is drawn (tests) */
    get shown(): boolean {
        return this.container.visible;
    }

    /**
     * Per frame at the player's local position: `viewerLayer` is the active player's layer (the original only shows
     * the aura on the viewer's floor or from stairs).
     */
    update(
        view: PlayerView,
        local: { x: number; y: number },
        renderer: Renderer,
        layer: number,
        zOrd: number,
        zIdx: number,
        viewerLayer: number,
        dt: number,
    ): void {
        const perks = view.perks ?? [];
        const has = (p: string) => perks.some((x) => x.type === p);
        const action = view.action?.type ?? "none";
        const active =
            (action === "use" || action === "revive") &&
            !view.dead &&
            (!view.downed || has("self_revive")) &&
            has("aoe_heal") &&
            (viewerLayer & 2 || (viewerLayer & 1) === 1 || (view.layer & 1) === 0);
        if (!active) {
            this.ticker = 0;
            this.dir = 1;
            this.container.visible = false;
            this.container.removeFromParent();
            return;
        }
        const item = action === "use" ? view.action?.item : "";
        const aura = item
            ? (GameObjectDefs[item] as { aura?: { sprite: string; tint: number } } | undefined)?.aura
            : undefined;
        const rad = (item ? GameConfig.player.medicHealRange : GameConfig.player.medicReviveRange) * AURA_SCALE;
        const sprite = aura?.sprite ?? REVIVE_SPRITE;
        const key = `${sprite}|${rad}`;
        if (key !== this.key) {
            this.key = key;
            this.textures.apply(this.sprite, sprite, rad);
            this.sprite.scale.set(rad);
        }
        this.sprite.tint = aura?.tint ?? REVIVE_TINT;
        this.ticker = Math.min(1, Math.max(0, this.ticker + dt * this.dir * 1.5));
        if (this.ticker >= 1 || this.ticker <= 0) this.dir *= -1;
        this.container.alpha = easeOutExpo(this.ticker) * 0.75 + 0.25;
        this.container.position.set(local.x, local.y);
        this.container.visible = true;
        renderer.add(this.container, layer, zOrd - 1, zIdx);
    }

    destroy(): void {
        this.container.removeFromParent();
        this.container.destroy({ children: false });
    }
}
