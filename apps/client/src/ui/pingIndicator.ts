// Screen-edge indicator of a map-event ping (survev client/src/emote.ts pingIndicators, the air drop slot): for
// 4.25 s after an air drop is released, an arrow (`ping-indicator.img`) with the ping icon (`ping-team-airdrop.img`)
// sits at the screen edge 64 px in, pointing at the drop, both tinted with the ping colour; the icon pulses. It
// fades in over 0.5 s and out over 0.1 s, and hides while the drop point itself is on screen.
import type { Vec2 } from "@rebirth/core";
import { Container, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { Camera } from "../render/camera.ts";

/** survev emote.ts pingFadeIn / pingLife / pingFadeOut */
const FADE_IN = 0.5;
const LIFE = 4.25;
const FADE_OUT = 0.1;
/** distance of the indicator from the screen edge (px) */
const EDGE_OFFSET = 64;
const SPRITE_SCALE = 0.5;
/** the drop point counts as on screen while a player-sized circle around it is in view */
const ONSCREEN_RAD = 1;

export interface PingIndicatorDef {
    texture?: string;
    tint?: number;
}

export class PingIndicator {
    readonly container = new Container({ label: "ping-indicator" });
    private readonly outer = new Sprite();
    private readonly inner = new Sprite();
    private readonly textures: TextureStore;
    private pos: Vec2 = { x: 0, y: 0 };
    private fadeIn = 0;
    private life = 0;
    private fadeOut = 0;
    private pulse = 0;

    constructor(textures: TextureStore) {
        this.textures = textures;
        this.outer.anchor.set(0.5, 0);
        this.inner.anchor.set(0.5, 0.5);
        textures.apply(this.outer, "ping-indicator.img", SPRITE_SCALE);
        for (const s of [this.outer, this.inner]) s.scale.set(SPRITE_SCALE);
        this.container.addChild(this.inner, this.outer);
        this.container.visible = false;
    }

    /** tint of the last ping shown (tests: rebirth air strike variant colours) */
    get tint(): number {
        return this.inner.tint;
    }

    /** whether the indicator is showing (tests) */
    get active(): boolean {
        return this.fadeOut > 0;
    }

    /** A new map-event ping at `pos` (survev emote.ts addPing). */
    show(def: PingIndicatorDef, pos: Vec2): void {
        this.pos = { x: pos.x, y: pos.y };
        if (def.texture) this.textures.apply(this.inner, def.texture, SPRITE_SCALE);
        const tint = def.tint ?? 0xffffff;
        this.inner.tint = tint;
        this.outer.tint = tint;
        this.fadeIn = FADE_IN;
        this.life = LIFE;
        this.fadeOut = FADE_OUT;
    }

    update(dt: number, camera: Camera): void {
        this.fadeIn -= dt;
        this.life -= dt;
        if (this.life <= 0) this.fadeOut -= dt;
        if (this.fadeOut <= 0) {
            this.container.visible = false;
            return;
        }
        const view = camera.viewBounds();
        const cam = camera.pos;
        const dx = this.pos.x - cam.x;
        const dy = this.pos.y - cam.y;
        const len = Math.hypot(dx, dy);
        const dir = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
        // where the ray from the camera towards the drop leaves the view
        const hx = (view.max.x - view.min.x) / 2;
        const hy = (view.max.y - view.min.y) / 2;
        const t = Math.min(
            Math.abs(dir.x) > 1e-6 ? hx / Math.abs(dir.x) : Number.POSITIVE_INFINITY,
            Math.abs(dir.y) > 1e-6 ? hy / Math.abs(dir.y) : Number.POSITIVE_INFINITY,
        );
        const edge = camera.worldToScreen({ x: cam.x + dir.x * t, y: cam.y + dir.y * t });
        const onscreen =
            this.pos.x + ONSCREEN_RAD >= view.min.x &&
            this.pos.x - ONSCREEN_RAD <= view.max.x &&
            this.pos.y + ONSCREEN_RAD >= view.min.y &&
            this.pos.y - ONSCREEN_RAD <= view.max.y;
        const w = camera.screenWidth;
        const h = camera.screenHeight;
        const x = Math.min(Math.max(edge.x, EDGE_OFFSET), w - EDGE_OFFSET);
        const y = Math.min(Math.max(edge.y, EDGE_OFFSET), h - EDGE_OFFSET);
        this.outer.position.set(x, y);
        this.outer.rotation = Math.atan2(dir.y, -dir.x) + Math.PI * 0.5;
        this.inner.position.set(x, y);
        this.pulse = this.pulse <= 0 ? 1 : this.pulse - dt;
        this.inner.alpha = onscreen ? 0 : this.pulse;
        this.outer.alpha = onscreen ? 0 : this.fadeIn > 0 ? 1 - this.fadeIn / FADE_IN : 1;
        this.container.alpha = this.life < 0 ? Math.max(0, this.fadeOut / FADE_OUT) : 1;
        this.container.visible = true;
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }
}
