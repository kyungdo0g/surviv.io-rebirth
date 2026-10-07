// Emotes and team pings in the world (survev client/src/emote.ts addEmote / addPing / m_update / m_render;
// docs/research/ui/hud.md "Pings and emote wheel"):
// - an emote pops over its player (the emote image in a black emote circle, 4 units above it): it grows in with an
//   elastic ease over 0.75 s, holds 1 s and shrinks away in 0.1 s, a new emote of the same player replacing it; its
//   sound plays at the player when it appears; it follows the player and dies with it;
// - a team ping draws the ping icon at the pinged spot with a pulsing border ring, both in the pinger's group colour,
//   and, while the spot is off screen, an arrow at the screen edge (64 px in) with the icon; it fades in over 0.5 s,
//   lasts 4.25 s and fades out in 0.1 s; one ping per group member at a time; the pinger sees no edge arrow for its own
//   ping; its sound plays at full volume. The minimap marker is added by the caller (MapIndicators.addPlayerPing).
// Everything is drawn in screen space over the world (survev draws emotes on the top layer, pings in the UI layer).
// An emote of a player on another floor shows only as much as that floor does (survev emote.ts:1088-1092 draws it on
// the player's layer then): none from the surface while the viewer is underground, none from a bunker on the surface.
import { GameConfig, GameObjectDefs } from "@rebirth/defs";
import type { EmoteEvent } from "@rebirth/sim";
import { type Container, Container as PixiContainer, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import type { Camera } from "../render/camera.ts";

/** survev emote.ts emoteLifeIn / emoteLife / emoteLifeOut, pingFadeIn / pingLife / pingFadeOut */
const EMOTE_IN = 0.75;
const EMOTE_LIFE = 1;
const EMOTE_OUT = 0.1;
const PING_FADE_IN = 0.5;
const PING_LIFE = 4.25;
const PING_FADE_OUT = 0.1;
const EMOTE_BASE_SCALE = 0.55;
/** emote bubble offset above the player (world units, survev posOffset) */
const EMOTE_OFFSET_Y = 4;
const PING_BASE_SCALE = 0.4;
const IND_BASE_SCALE = 0.5;
const EDGE_OFFSET = 64;

interface EmoteDefLike {
    texture?: string;
    sound?: string;
    channel?: string;
}

interface PingDefLike {
    texture?: string;
    sound?: string;
    worldDisplay?: boolean;
    mapEvent?: boolean;
}

/** survev math.easeOutElastic */
function easeOutElastic(e: number, t = 0.3): number {
    return 2 ** (e * -10) * Math.sin(((e - t / 4) * (Math.PI * 2)) / t) + 1;
}

interface Bubble {
    container: Container;
    sprite: Sprite;
    playerId: number;
    type: string;
    lifeIn: number;
    life: number;
    lifeOut: number;
    isNew: boolean;
    alive: boolean;
}

interface PingSlot {
    ping: Container;
    pingSprite: Sprite;
    border: Sprite;
    ind: Container;
    indInner: Sprite;
    indOuter: Sprite;
    pos: { x: number; y: number };
    fadeIn: number;
    life: number;
    fadeOut: number;
    own: boolean;
    type: string;
}

export interface EmotePlayer {
    pos: { x: number; y: number };
    layer: number;
}

export interface EmoteFxFrame {
    dt: number;
    camera: Camera;
    /** drawn position of a living player in view, else null */
    player(id: number): EmotePlayer | null;
    /** how visible (0-1) something on a map layer is to the viewer (renderer.visibility); fully when omitted */
    visibility?(layer: number): number;
}

export class EmoteFx {
    /** screen-space root: world pings under the emote bubbles, edge arrows on top */
    readonly container = new PixiContainer({ label: "emotes" });
    private readonly pingLayer = new PixiContainer({ label: "pings" });
    private readonly bubbleLayer = new PixiContainer({ label: "emote-bubbles", sortableChildren: true });
    private readonly indLayer = new PixiContainer({ label: "ping-indicators" });
    private readonly textures: TextureStore;
    private readonly audio: AudioEngine;
    private readonly bubbles: Bubble[] = [];
    private readonly slots: PingSlot[] = [];
    private zIdx = 0;
    /** emotes shown since the start (tests) */
    emotesShown = 0;
    pingsShown = 0;

    constructor(textures: TextureStore, audio: AudioEngine) {
        this.textures = textures;
        this.audio = audio;
        this.container.addChild(this.pingLayer, this.bubbleLayer, this.indLayer);
        for (let i = 0; i < 4; i++) this.slots.push(this.createSlot(i));
    }

    private createSlot(idx: number): PingSlot {
        const tint = GameConfig.groupColors[idx] ?? 0xffffff;
        const sprite = (id: string, anchorY = 0.5) => {
            const s = new Sprite();
            s.anchor.set(0.5, anchorY);
            if (id) this.textures.apply(s, id, 1);
            return s;
        };
        const border = sprite("ping-border.img");
        border.tint = tint;
        const pingSprite = sprite("");
        pingSprite.tint = tint;
        const ping = new PixiContainer();
        ping.addChild(border, pingSprite);
        ping.visible = false;
        const indInner = sprite("");
        indInner.tint = tint;
        const indOuter = sprite("ping-indicator.img", 0);
        const ind = new PixiContainer();
        ind.addChild(indInner, indOuter);
        ind.visible = false;
        this.pingLayer.addChild(ping);
        this.indLayer.addChild(ind);
        return {
            ping,
            pingSprite,
            border,
            ind,
            indInner,
            indOuter,
            pos: { x: 0, y: 0 },
            fadeIn: 0,
            life: 0,
            fadeOut: 0,
            own: false,
            type: "",
        };
    }

    /** the containers of the live emote bubbles (tests) */
    get bubbleContainers(): Container[] {
        return this.bubbles.filter((b) => b.alive).map((b) => b.container);
    }

    /** bubbles on screen (tests) */
    get bubbleCount(): number {
        return this.bubbles.filter((b) => b.alive && b.container.visible).length;
    }

    /** world pings showing (tests) */
    get activePings(): Array<{ type: string; pos: { x: number; y: number }; indicator: boolean }> {
        return this.slots
            .filter((s) => s.fadeOut > 0)
            .map((s) => ({ type: s.type, pos: { ...s.pos }, indicator: s.ind.visible && s.indOuter.alpha > 0 }));
    }

    /** An emote over `playerId` (survev addEmote): replaces that player's current one. */
    addEmote(e: EmoteEvent): void {
        const def = GameObjectDefs[e.type] as EmoteDefLike | undefined;
        if (!def) return;
        let bubble: Bubble | undefined;
        for (const b of this.bubbles) {
            if (b.alive && b.playerId === e.playerId) b.alive = false;
        }
        bubble = this.bubbles.find((b) => !b.alive);
        if (!bubble) {
            const container = new PixiContainer();
            const circle = new Sprite();
            circle.anchor.set(0.5);
            this.textures.apply(circle, "emote-circle-outer.img", EMOTE_BASE_SCALE);
            circle.scale.set(EMOTE_BASE_SCALE * 0.8);
            circle.tint = 0x000000;
            const sprite = new Sprite();
            sprite.anchor.set(0.5);
            sprite.scale.set(EMOTE_BASE_SCALE);
            container.addChild(circle, sprite);
            this.bubbleLayer.addChild(container);
            bubble = {
                container,
                sprite,
                playerId: 0,
                type: "",
                lifeIn: 0,
                life: 0,
                lifeOut: 0,
                isNew: true,
                alive: false,
            };
            this.bubbles.push(bubble);
        }
        let image = def.texture;
        if (e.type === "emote_loot" && e.itemType) {
            image = (GameObjectDefs[e.itemType] as { lootImg?: { sprite: string } } | undefined)?.lootImg?.sprite;
        }
        this.textures.apply(bubble.sprite, image, EMOTE_BASE_SCALE);
        bubble.playerId = e.playerId;
        bubble.type = e.type;
        bubble.lifeIn = EMOTE_IN;
        bubble.life = EMOTE_LIFE;
        bubble.lifeOut = EMOTE_OUT;
        bubble.isNew = true;
        bubble.alive = true;
        bubble.container.visible = false;
        bubble.container.zIndex = this.zIdx++;
    }

    /**
     * A team ping (survev addPing): the world icon and edge arrow in slot `groupIdx` (the pinger's index in the
     * viewer's group; -1 shows nothing but the sound), `own` hides the edge arrow; `sound` overrides the ping's sound
     * (M7: a Commander's leader ping sound).
     */
    addPing(e: EmoteEvent, groupIdx: number, own: boolean, sound?: string): void {
        const def = GameObjectDefs[e.type] as PingDefLike | undefined;
        if (!def || !e.pos) return;
        this.audio.playSound(sound ?? def.sound, { channel: "ui" });
        const slot = this.slots[groupIdx];
        if (!slot) return;
        slot.pos = { x: e.pos.x, y: e.pos.y };
        slot.type = e.type;
        this.textures.apply(slot.pingSprite, def.texture, PING_BASE_SCALE * 2);
        this.textures.apply(slot.indInner, def.texture, IND_BASE_SCALE * 2);
        slot.fadeIn = PING_FADE_IN;
        slot.life = PING_LIFE;
        slot.fadeOut = PING_FADE_OUT;
        slot.own = own;
        slot.ping.visible = def.worldDisplay !== false;
        slot.ind.visible = !own;
        slot.border.alpha = 0;
        this.pingsShown++;
    }

    update(frame: EmoteFxFrame): void {
        const cam = frame.camera;
        const zoom = cam.zoom;
        for (const b of this.bubbles) {
            if (!b.alive) {
                b.container.visible = false;
                continue;
            }
            const target = frame.player(b.playerId);
            if (!target) {
                b.alive = false;
                b.container.visible = false;
                continue;
            }
            if (b.isNew) {
                b.isNew = false;
                this.emotesShown++;
                const def = GameObjectDefs[b.type] as EmoteDefLike | undefined;
                this.audio.playSound(def?.sound, {
                    channel: def?.channel ?? "ui",
                    pos: target.pos,
                    layer: target.layer,
                });
            }
            if (b.lifeIn > 0) b.lifeIn -= frame.dt;
            else if (b.life > 0) b.life -= frame.dt;
            else if (b.lifeOut > 0) b.lifeOut -= frame.dt;
            b.alive = b.lifeOut > 0;
            let scale = 0;
            if (b.lifeIn > 0) scale = easeOutElastic(1 - b.lifeIn / EMOTE_IN);
            else if (b.life > 0) scale = 1;
            else if (b.lifeOut > 0) scale = b.lifeOut / EMOTE_OUT;
            const offset = EMOTE_OFFSET_Y / Math.min(Math.max(zoom, 0.75), 1);
            const screen = cam.worldToScreen({ x: target.pos.x, y: target.pos.y + offset });
            const s = scale * EMOTE_BASE_SCALE * Math.min(Math.max(zoom, 0.9), 1.75);
            b.container.position.set(screen.x, screen.y);
            b.container.scale.set(s);
            b.container.alpha = frame.visibility ? frame.visibility(target.layer) : 1;
            b.container.visible = b.alive && b.container.alpha > 0;
        }
        this.updatePings(frame.dt, cam);
    }

    private updatePings(dt: number, cam: Camera): void {
        const view = cam.viewBounds();
        const rad = GameConfig.player.radius;
        for (const slot of this.slots) {
            if (slot.fadeOut <= 0) {
                slot.ping.visible = false;
                slot.ind.visible = false;
                continue;
            }
            slot.fadeIn -= dt;
            slot.life -= dt;
            if (slot.life <= 0) slot.fadeOut -= dt;
            if (slot.fadeOut <= 0) {
                slot.ping.visible = false;
                slot.ind.visible = false;
                continue;
            }
            const p = slot.pos;
            const onscreen =
                p.x + rad >= view.min.x &&
                p.x - rad <= view.max.x &&
                p.y + rad >= view.min.y &&
                p.y - rad <= view.max.y;
            const screen = cam.worldToScreen(p);
            const pingScale = PING_BASE_SCALE * cam.zoom;
            slot.pingSprite.position.set(screen.x, screen.y);
            slot.pingSprite.scale.set(pingScale);
            // the border ring pulses: alpha falls by 1 per second while it grows to twice its size, then restarts
            const pulse = slot.border.alpha <= 0 ? 1 : slot.border.alpha - dt;
            slot.border.alpha = pulse;
            slot.border.position.set(screen.x, screen.y);
            slot.border.scale.set(PING_BASE_SCALE * (2 - pulse) * cam.zoom);
            // edge arrow where the ray from the camera to the ping leaves the view
            const dx = p.x - cam.pos.x;
            const dy = p.y - cam.pos.y;
            const len = Math.hypot(dx, dy);
            const dir = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
            const hx = (view.max.x - view.min.x) / 2;
            const hy = (view.max.y - view.min.y) / 2;
            const t = Math.min(
                Math.abs(dir.x) > 1e-6 ? hx / Math.abs(dir.x) : Number.POSITIVE_INFINITY,
                Math.abs(dir.y) > 1e-6 ? hy / Math.abs(dir.y) : Number.POSITIVE_INFINITY,
            );
            const edge = cam.worldToScreen({ x: cam.pos.x + dir.x * t, y: cam.pos.y + dir.y * t });
            const x = onscreen ? screen.x : Math.min(Math.max(edge.x, EDGE_OFFSET), cam.screenWidth - EDGE_OFFSET);
            const y = onscreen ? screen.y : Math.min(Math.max(edge.y, EDGE_OFFSET), cam.screenHeight - EDGE_OFFSET);
            slot.indOuter.position.set(x, y);
            slot.indOuter.rotation = Math.atan2(dir.y, -dir.x) + Math.PI * 0.5;
            slot.indOuter.scale.set(IND_BASE_SCALE);
            slot.indInner.position.set(x, y);
            slot.indInner.scale.set(IND_BASE_SCALE);
            slot.indInner.alpha = onscreen ? 0 : pulse;
            slot.indOuter.alpha = onscreen ? 0 : slot.fadeIn > 0 ? 1 - slot.fadeIn / PING_FADE_IN : 1;
            const alpha = slot.life < 0 ? Math.max(0, slot.fadeOut / PING_FADE_OUT) : 1;
            slot.ping.alpha = alpha;
            slot.ind.alpha = alpha;
            slot.ind.visible = !slot.own;
        }
    }

    clear(): void {
        for (const b of this.bubbles) {
            b.alive = false;
            b.container.visible = false;
        }
        for (const s of this.slots) {
            s.fadeOut = 0;
            s.ping.visible = false;
            s.ind.visible = false;
        }
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }
}
