// Minimap overlays (survev client/src/ui/ui.ts m_render + client/src/gas.ts GasSafeZoneRenderer, ui.ts createPing,
// objects/mapSprite.ts, objects/mapIndicator.ts; docs/research/ui/hud.md "Minimap and full map"):
// - the red zone in black at 60 % outside the current circle, the next safe zone as a 1.5 px white ring and a 2 px
//   green line from the player to the safe-zone centre (alpha 0.5 while already inside it);
// - map indicators: map-event pings (air drop: `ping-map-airdrop.img` tinted 0xff6600 at scale 0.3 for the ping's
//   mapLife, plus a growing `ping-map-pulse.img` ring for its pingLife) and item/role indicators with a pulse;
// - team pings (M6, survev ui.ts createPing "Player pings"): the ping's map icon at scale 0.2 in the pinger's group
//   colour for its mapLife and a pulse ring for its pingLife; a player's new ping replaces its previous one.
import type { Vec2 } from "@rebirth/core";
import { GameObjectDefs, type MapIndicatorDef } from "@rebirth/defs";
import type { MapIndicatorView } from "@rebirth/sim";
import { Container, Graphics, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import { type CoverRect, GasShape, type GasTracker, MAP_GAS_COLOR } from "../fx/gas.ts";

/** world -> minimap pixel mapping for this frame */
export interface MapProjection {
    toMap(p: Vec2): Vec2;
    /** minimap pixels per world unit */
    pxPerUnit: number;
    /** HUD scale factor (survev screenScaleFactor) */
    uiScale: number;
    /** the minimap square on screen (what the red zone has to cover) */
    rect: CoverRect;
}

export interface PingFields {
    texture?: string;
    mapTexture?: string;
    mapLife?: number;
    pingLife?: number;
    mapEvent?: boolean;
    tint?: number;
    sound?: string;
}

/** A sprite on the minimap with the original MapSprite fade: in over 0.1 s, out over the last 0.5 s. */
interface MapSprite {
    sprite: Sprite;
    pos: Vec2;
    scale: number;
    ticker: number;
    lifetime: number;
    /** grows by dt / 2.5 per second (ping pulse rings) */
    pulse: boolean;
}

interface Indicator {
    id: number;
    type: string;
    sprites: MapSprite[];
    /** item/role indicator pulse (survev MapIndicatorBarn.updateIndicatorPulses) */
    indicator?: { def: MapIndicatorDef; pulseTicker: number; pulseDir: number; equipped: boolean };
}

function smoothstep(v: number, a: number, b: number): number {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

export class MinimapGas {
    readonly container = new Container({ label: "minimap-gas" });
    private readonly shape = new GasShape(MAP_GAS_COLOR);
    private readonly ring = new Graphics();
    private readonly line = new Graphics();
    private ringKey = "";
    private lineKey = "";

    constructor() {
        this.container.addChild(this.shape.display, this.ring, this.line);
    }

    /** what is drawn (tests) */
    get state(): { zone: boolean; ring: boolean; line: boolean } {
        return { zone: this.shape.display.visible, ring: this.ring.visible, line: this.line.visible };
    }

    update(proj: MapProjection, gas: GasTracker, playerPos: Vec2, alpha: number): void {
        const active = gas.active;
        const circle = gas.circle(alpha);
        const safe = gas.safeZone();
        if (!active || !circle || !safe) {
            this.shape.render({ x: 0, y: 0 }, 1, false, proj.rect);
            this.ring.visible = false;
            this.line.visible = false;
            return;
        }
        this.shape.render(proj.toMap(circle.pos), circle.rad * proj.pxPerUnit, true, proj.rect);
        const safePos = proj.toMap(safe.pos);
        const safeRad = safe.rad * proj.pxPerUnit;
        const ringKey = `${safePos.x.toFixed(2)},${safePos.y.toFixed(2)},${safeRad.toFixed(2)}`;
        if (ringKey !== this.ringKey) {
            this.ringKey = ringKey;
            this.ring.clear().circle(safePos.x, safePos.y, safeRad).stroke({ width: 1.5, color: 0xffffff });
        }
        const player = proj.toMap(playerPos);
        const inside = Math.hypot(playerPos.x - safe.pos.x, playerPos.y - safe.pos.y) < safe.rad;
        const lineKey = `${ringKey},${player.x.toFixed(1)},${player.y.toFixed(1)},${inside}`;
        if (lineKey !== this.lineKey) {
            this.lineKey = lineKey;
            this.line
                .clear()
                .moveTo(player.x, player.y)
                .lineTo(safePos.x, safePos.y)
                .stroke({ width: 2, color: 0x00ff00, alpha: inside ? 0.5 : 1 });
        }
        this.ring.visible = true;
        this.line.visible = true;
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }
}

export class MapIndicators {
    readonly container = new Container({ label: "minimap-indicators", sortableChildren: true });
    private readonly textures: TextureStore;
    private readonly indicators = new Map<number, Indicator>();
    /** released ping sprites that outlive their indicator until their lifetime ends */
    private readonly loose: MapSprite[] = [];
    /** each player's current team ping sprites */
    private readonly playerPings = new Map<number, MapSprite[]>();

    constructor(textures: TextureStore) {
        this.textures = textures;
    }

    get count(): number {
        return this.indicators.size;
    }

    /** team pings on the map (tests) */
    get playerPingCount(): number {
        return this.playerPings.size;
    }

    /** A team ping of `playerId` at `pos` in `tint`, replacing that player's previous one (survev createPing). */
    addPlayerPing(playerId: number, type: string, pos: Vec2, tint: number): void {
        const def = GameObjectDefs[type] as PingFields | undefined;
        if (!def?.mapTexture) return;
        for (const s of this.playerPings.get(playerId) ?? []) s.sprite.destroy();
        const icon = this.addSprite(def.mapTexture, pos, 0.2, def.mapLife ?? 4, tint, 100);
        const pulse = this.addSprite("ping-map-pulse.img", pos, 0, def.pingLife ?? 4, tint, 99);
        pulse.pulse = true;
        this.playerPings.set(playerId, [icon, pulse]);
    }

    /** Applies a snapshot's markers; returns the pings that just appeared (their sound and edge indicator). */
    apply(list: readonly MapIndicatorView[]): Array<{ def: PingFields; pos: Vec2 }> {
        const appeared: Array<{ def: PingFields; pos: Vec2 }> = [];
        for (const data of list) {
            if (data.dead) {
                this.remove(data.id);
                continue;
            }
            let ind = this.indicators.get(data.id);
            if (ind && ind.type !== data.type) {
                this.remove(data.id);
                ind = undefined;
            }
            if (!ind) {
                ind = this.create(data);
                this.indicators.set(data.id, ind);
                const def = GameObjectDefs[data.type] as { type?: string } | undefined;
                if (def?.type === "ping")
                    appeared.push({ def: def as PingFields, pos: { x: data.pos.x, y: data.pos.y } });
            }
            for (const s of ind.sprites) if (!s.pulse) s.pos = { x: data.pos.x, y: data.pos.y };
            if (ind.indicator) ind.indicator.equipped = data.equipped;
        }
        return appeared;
    }

    private addSprite(id: string, pos: Vec2, scale: number, lifetime: number, tint: number, z: number): MapSprite {
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        this.textures.apply(sprite, id, 1);
        sprite.tint = tint;
        sprite.zIndex = z;
        sprite.alpha = 0;
        this.container.addChild(sprite);
        return { sprite, pos: { x: pos.x, y: pos.y }, scale, ticker: 0, lifetime, pulse: false };
    }

    private create(data: MapIndicatorView): Indicator {
        const def = GameObjectDefs[data.type] as
            | ({ type?: string; mapIndicator?: MapIndicatorDef } & PingFields)
            | undefined;
        const ind: Indicator = { id: data.id, type: data.type, sprites: [] };
        if (def?.type === "ping" && def.mapTexture) {
            // map-event pings: icon for mapLife and a pulse ring for pingLife (survev ui.ts createPing)
            const tint = def.tint ?? 0xffffff;
            const icon = this.addSprite(def.mapTexture, data.pos, 0.2 * 1.5, def.mapLife ?? 4, tint, 100);
            const pulse = this.addSprite("ping-map-pulse.img", data.pos, 0, def.pingLife ?? 4, tint, 99);
            pulse.pulse = true;
            ind.sprites.push(icon, pulse);
        } else if (def?.mapIndicator) {
            // item and role indicators (survev mapIndicator.ts): icon plus a ping-pong pulse while equipped
            const z = data.equipped ? 655350 : 1;
            const mi = def.mapIndicator;
            const icon = this.addSprite(mi.sprite, data.pos, 0.2 * 1.25, Number.POSITIVE_INFINITY, mi.tint, z);
            ind.sprites.push(icon);
            if (mi.pulse) {
                const pulse = this.addSprite(
                    "part-pulse-01.img",
                    data.pos,
                    0.5,
                    Number.POSITIVE_INFINITY,
                    mi.pulseTint,
                    z - 1,
                );
                ind.sprites.push(pulse);
            }
            ind.indicator = { def: mi, pulseTicker: 0.5, pulseDir: 1, equipped: data.equipped };
        }
        return ind;
    }

    private remove(id: number): void {
        const ind = this.indicators.get(id);
        if (!ind) return;
        this.indicators.delete(id);
        for (const s of ind.sprites) {
            // a ping's pulse ring finishes on its own; everything else goes with the indicator
            if (s.pulse && s.ticker < s.lifetime) this.loose.push(s);
            else s.sprite.destroy();
        }
    }

    update(dt: number, proj: MapProjection): void {
        for (const ind of this.indicators.values()) {
            if (ind.indicator) this.pulseIndicator(ind, dt);
            for (let i = ind.sprites.length - 1; i >= 0; i--) {
                const s = ind.sprites[i];
                if (this.step(s, dt, proj) && s.pulse) {
                    s.sprite.destroy();
                    ind.sprites.splice(i, 1);
                }
            }
            const pulse = ind.indicator ? ind.sprites[1] : undefined;
            if (pulse && !ind.indicator?.equipped) pulse.sprite.visible = false;
        }
        for (let i = this.loose.length - 1; i >= 0; i--) {
            if (this.step(this.loose[i], dt, proj)) {
                this.loose[i].sprite.destroy();
                this.loose.splice(i, 1);
            }
        }
        for (const [id, sprites] of this.playerPings) {
            for (let i = sprites.length - 1; i >= 0; i--) {
                if (this.step(sprites[i], dt, proj)) {
                    sprites[i].sprite.destroy();
                    sprites.splice(i, 1);
                }
            }
            if (sprites.length === 0) this.playerPings.delete(id);
        }
    }

    /** Advances one sprite; returns true once its lifetime is over. */
    private step(s: MapSprite, dt: number, proj: MapProjection): boolean {
        s.ticker += dt;
        if (s.pulse) s.scale += dt / 2.5;
        const p = proj.toMap(s.pos);
        const fade = smoothstep(s.ticker, 0, 0.1) * (1 - smoothstep(s.ticker, s.lifetime - 0.5, s.lifetime));
        s.sprite.position.set(p.x, p.y);
        s.sprite.scale.set(s.scale * proj.uiScale);
        s.sprite.alpha = Number.isFinite(s.lifetime) ? fade : smoothstep(s.ticker, 0, 0.1);
        s.sprite.visible = s.sprite.alpha > 0.0001;
        return s.ticker >= s.lifetime;
    }

    private pulseIndicator(ind: Indicator, dt: number): void {
        const st = ind.indicator;
        if (!st) return;
        // ease the pulse between 0.5 and 1 at 0.3 per second (survev updateIndicatorPulses)
        st.pulseTicker = Math.min(1, Math.max(0.5, st.pulseTicker + dt * st.pulseDir * 0.3));
        if (st.pulseTicker >= 1 || st.pulseTicker <= 0.5) st.pulseDir *= -1;
        const pulse = ind.sprites[1];
        if (pulse) pulse.scale = st.pulseTicker;
    }

    clear(): void {
        for (const id of [...this.indicators.keys()]) this.remove(id);
        for (const s of this.loose.splice(0)) s.sprite.destroy();
        for (const sprites of this.playerPings.values()) for (const s of sprites) s.sprite.destroy();
        this.playerPings.clear();
    }

    destroy(): void {
        this.clear();
        this.container.destroy({ children: true });
    }
}
