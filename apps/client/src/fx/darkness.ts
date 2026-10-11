// Rebirth pitch-dark interiors (owner wave 3, 2026-10-10: "the subway station inside is pitch dark, so shooting a gun
// gives a very short flash of light, and grenades can give light too"; docs/research/rebirth-deviations.md). A
// structure floor marked `layers[i].dark` (or a building marked `dark`, packages/defs types/mapObjects.ts) is unlit:
// while the followed player stands under its ceiling on its layer (ObjectWorld.inDarkness) the screen fades over
// 0.3 s to near black (alpha 0.96), except
// - a dim, soft circle (2.5 u) round the player, so they see their own body;
// - a muzzle flash (9 u, 0.08 s, quick falloff) at every gun shot fired in the dark (BulletSystem.shotListener), anyone's;
// - a burst of light (1.5 x the blast radius, fading over 0.5 s) at every fiery explosion in the dark (WorldFx.apply;
//   smoke grenades and fruit splats give none).
// Presentation only: the simulation knows nothing of it, and the minimap keeps working (the overlay sits in the
// screen-space `weather` container, under the red zone, the emotes and the HUD). What is drawn over it for one player
// is hidden while that player stands in the dark out of every light (`shrouded`, the wave-3 leftovers, 2026-10-11): an
// emote bubble (game/teamPlay.ts) and the damage arc pointing at an attacker (the arc falls back to the hit's
// direction) or a touch marker following a hit target (fx/hitFeedback.ts). Pings stay: they mark a spot a teammate
// chose, not where anyone stands, and only the team sees them; teammates' names are drawn in the world, under the
// overlay; sounds are not darkened.
// Drawing: one screen-sized render texture at half resolution, cleared each frame to the dark shade, with one reused
// radial-gradient sprite per light drawn over it in the "erase" blend mode; the texture is shown by one sprite.
import type { Vec2 } from "@rebirth/core";
import {
    DARK_ALPHA,
    EXPLOSION_LIGHT,
    type ExplosionDef,
    GameObjectDefs,
    PLAYER_LIGHT,
    SHOT_LIGHT,
} from "@rebirth/defs";
import { Container, RenderTexture, Sprite, Texture } from "pixi.js";
import type { Renderer } from "../render/renderer.ts";
import { explosionVisual } from "./explosions.ts";

/** seconds the overlay takes to fade in or out when the player enters or leaves the dark */
export const DARK_FADE_TIME = 0.3;
// the light sizes are shared with the bots' vision in the dark (defs rebirth/darkness.ts; packages/bots
// perception/darkness.ts), so a bot never sees more in the dark than this overlay shows a player
export { DARK_ALPHA, EXPLOSION_LIGHT, PLAYER_LIGHT, SHOT_LIGHT } from "@rebirth/defs";
/** at most this many lights alive (the oldest go first) */
export const MAX_LIGHTS = 48;
/** render texture resolution: the soft lights need no detail */
const RT_RESOLUTION = 0.5;
/** a light that takes at least this much of the shade away shows what stands in it (and what is drawn over it) */
export const LIT_MIN = 0.25;
/** the glow sprite's falloff (glowTexture): how much of a light's strength is left at a fraction of its radius */
const GLOW_STOPS: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [0.35, 0.9],
    [0.7, 0.35],
    [1, 0],
];

/** The glow's strength (0-1) at `t` (distance over radius) from its centre: GLOW_STOPS, linear between them. */
export function glowFalloff(t: number): number {
    if (t <= 0) return 1;
    for (let i = 1; i < GLOW_STOPS.length; i++) {
        const [t1, v1] = GLOW_STOPS[i];
        if (t <= t1) {
            const [t0, v0] = GLOW_STOPS[i - 1];
            return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
        }
    }
    return 0;
}

export interface DarkLight {
    kind: "shot" | "explosion";
    pos: Vec2;
    /** world units */
    radius: number;
    /** seconds */
    duration: number;
    age: number;
}

/** How much of the shade a light takes away at its centre (0-1): a flash drops off fast, a fireball fades evenly. */
export function lightIntensity(l: DarkLight): number {
    const left = Math.max(0, 1 - l.age / l.duration);
    return l.kind === "shot" ? left * left : left;
}

/** Radius of the light an explosion of `type` gives (0: none, e.g. smoke grenades and fruit splats). */
export function explosionLightRadius(type: string): number {
    const visual = explosionVisual(type);
    if (!visual?.effect.burst.particle || visual.burstScale <= 0) return 0;
    const def = GameObjectDefs[type] as ExplosionDef;
    return def.rad.max * EXPLOSION_LIGHT.radiusMult;
}

/** Light bookkeeping, apart from Pixi: which lights are alive and how far the overlay has faded in. */
export class DarknessState {
    readonly lights: DarkLight[] = [];
    /** the followed player stands in the dark (this frame) */
    active = false;
    /** overlay fade (0 hidden - 1 full) */
    fade = 0;
    /** lights added since boot (tests) */
    added = 0;
    private readonly isDark: (pos: Vec2, layer: number) => boolean;

    /** `force` (dev ?dark=1) makes every place dark. */
    constructor(isDark: (pos: Vec2, layer: number) => boolean, force = false) {
        this.isDark = force ? () => true : isDark;
    }

    /** opacity of the dark shade now */
    get alpha(): number {
        return DARK_ALPHA * this.fade;
    }

    /**
     * How lit `pos` is (0-1): the strongest light over it, the glow round the viewer (at `viewerPos`) included, by the
     * glow's falloff.
     */
    lightAt(pos: Vec2, viewerPos?: Vec2): number {
        let best = 0;
        const add = (at: Vec2, radius: number, intensity: number) => {
            const d = Math.hypot(pos.x - at.x, pos.y - at.y);
            if (d < radius) best = Math.max(best, intensity * glowFalloff(d / radius));
        };
        if (viewerPos) add(viewerPos, PLAYER_LIGHT.radius, PLAYER_LIGHT.intensity);
        for (const l of this.lights) add(l.pos, l.radius, lightIntensity(l));
        return best;
    }

    /** Whether something at `pos` on `layer` is hidden by the dark: in an unlit place, and no light shows it. */
    shrouded(pos: Vec2, layer: number, viewerPos?: Vec2): boolean {
        return this.isDark(pos, layer) && this.lightAt(pos, viewerPos) < LIT_MIN;
    }

    /** A gun shot at `pos`: a muzzle flash when it is in the dark. */
    addShot(pos: Vec2, layer: number): boolean {
        if (!this.isDark(pos, layer)) return false;
        this.push({ kind: "shot", pos: { x: pos.x, y: pos.y }, ...SHOT_LIGHT, age: 0 });
        return true;
    }

    /** An explosion of `type` at `pos`: a burst of light when it is fiery and in the dark. */
    addExplosion(type: string, pos: Vec2, layer: number): boolean {
        const radius = explosionLightRadius(type);
        if (radius <= 0 || !this.isDark(pos, layer)) return false;
        this.push({
            kind: "explosion",
            pos: { x: pos.x, y: pos.y },
            radius,
            duration: EXPLOSION_LIGHT.duration,
            age: 0,
        });
        return true;
    }

    private push(l: DarkLight): void {
        if (this.lights.length >= MAX_LIGHTS) this.lights.shift();
        this.lights.push(l);
        this.added++;
    }

    /** Ages the lights (dropping the spent ones) and fades the overlay towards whether the viewer is in the dark. */
    update(dt: number, viewerPos: Vec2, viewerLayer: number): void {
        this.active = this.isDark(viewerPos, viewerLayer);
        const step = dt / DARK_FADE_TIME;
        this.fade = this.active ? Math.min(1, this.fade + step) : Math.max(0, this.fade - step);
        for (let i = this.lights.length - 1; i >= 0; i--) {
            const l = this.lights[i];
            l.age += dt;
            if (l.age >= l.duration) this.lights.splice(i, 1);
        }
    }

    clear(): void {
        this.lights.length = 0;
    }
}

/** A white disc fading to transparent at its rim (the light shape, drawn with "erase"). */
function glowTexture(): Texture {
    const size = 128;
    const half = size / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
        const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.35, "rgba(255,255,255,0.9)");
        grad.addColorStop(0.7, "rgba(255,255,255,0.35)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
    }
    return Texture.from(canvas);
}

export interface DarknessDeps {
    renderer: Renderer;
    /** whether `pos` on `layer` is in an unlit building (ObjectWorld.inDarkness) */
    isDark: (pos: Vec2, layer: number) => boolean;
    /** dev: every place is dark (?dark=1) */
    force?: boolean;
}

export interface DarknessFrame {
    dt: number;
    /** position and layer of the followed player as drawn */
    viewerPos: Vec2;
    viewerLayer: number;
}

export class DarknessFx {
    readonly state: DarknessState;
    private readonly renderer: Renderer;
    /** the followed player's position at the last update (its glow lights what stands near it) */
    private viewerPos: Vec2 | null = null;
    private view: {
        overlay: Sprite;
        rt: RenderTexture;
        scene: Container;
        shade: Sprite;
        glows: Sprite[];
        glow: Texture;
    } | null = null;

    constructor(deps: DarknessDeps) {
        this.renderer = deps.renderer;
        this.state = new DarknessState(deps.isDark, deps.force);
    }

    addShot(pos: Vec2, layer: number): void {
        this.state.addShot(pos, layer);
    }

    addExplosion(type: string, pos: Vec2, layer: number): void {
        this.state.addExplosion(type, pos, layer);
    }

    /**
     * Whether what is drawn over the overlay for something at `pos` on `layer` (an emote, an arc at an attacker) must
     * be hidden: it stands in the dark out of every light, the glow round the viewer as last drawn included.
     */
    shrouded(pos: Vec2, layer: number): boolean {
        return this.state.shrouded(pos, layer, this.viewerPos ?? undefined);
    }

    update(f: DarknessFrame): void {
        this.viewerPos = { x: f.viewerPos.x, y: f.viewerPos.y };
        this.state.update(f.dt, f.viewerPos, f.viewerLayer);
        if (this.state.fade <= 0) {
            if (this.view) this.view.overlay.visible = false;
            return;
        }
        this.draw(f.viewerPos);
    }

    /** Renders the shade with its lights cut out into the render texture and shows it at the overlay's fade. */
    private draw(viewerPos: Vec2): void {
        const app = this.renderer.app;
        if (!app?.renderer) return;
        const camera = this.renderer.camera;
        const w = Math.max(1, Math.ceil(camera.screenWidth));
        const h = Math.max(1, Math.ceil(camera.screenHeight));
        const v = this.ensureView(w, h);
        if (v.rt.width !== w || v.rt.height !== h) v.rt.resize(w, h, RT_RESOLUTION);
        v.shade.width = w;
        v.shade.height = h;
        const z = camera.z();
        let n = 0;
        const place = (pos: Vec2, radius: number, intensity: number) => {
            let sp = v.glows[n];
            if (!sp) {
                sp = new Sprite({ texture: v.glow, anchor: 0.5, blendMode: "erase" });
                v.glows.push(sp);
                v.scene.addChild(sp);
            }
            const s = camera.worldToScreen(pos);
            sp.position.set(s.x, s.y);
            sp.width = sp.height = radius * 2 * z;
            sp.alpha = intensity;
            sp.visible = true;
            n++;
        };
        place(viewerPos, PLAYER_LIGHT.radius, PLAYER_LIGHT.intensity);
        for (const l of this.state.lights) place(l.pos, l.radius, lightIntensity(l));
        for (let i = n; i < v.glows.length; i++) v.glows[i].visible = false;
        app.renderer.render({ container: v.scene, target: v.rt, clear: true });
        v.overlay.alpha = this.state.fade;
        v.overlay.visible = true;
    }

    private ensureView(w: number, h: number): NonNullable<DarknessFx["view"]> {
        if (this.view) return this.view;
        const rt = RenderTexture.create({ width: w, height: h, resolution: RT_RESOLUTION });
        const shade = new Sprite({ texture: Texture.WHITE, tint: 0x000000, alpha: DARK_ALPHA });
        const scene = new Container({ label: "darkness-scene" });
        scene.addChild(shade);
        const overlay = new Sprite({ texture: rt, label: "darkness" });
        this.renderer.weather.addChild(overlay);
        this.view = { overlay, rt, scene, shade, glows: [], glow: glowTexture() };
        return this.view;
    }

    clear(): void {
        this.state.clear();
    }

    destroy(): void {
        const v = this.view;
        this.view = null;
        if (!v) return;
        v.overlay.destroy();
        v.scene.destroy({ children: true });
        v.rt.destroy(true);
        v.glow.destroy(true);
    }
}
