// Teammates on the minimap (survev client/src/ui/ui.ts updatePlayerMapSprites; docs/research/ui/hud.md "Minimap and
// full map"): every group member other than the followed player is a dot in its group colour (yellow, magenta, cyan,
// orange) inside a white ring, the downed icon while knocked out and an outlined skull (1.5x) once dead. Positions
// come from the team status (refreshed every 0.25 s) and glide to each new one; a member drawn in the world uses its
// drawn position. The followed player's own centre dot takes its group colour and state too (Minimap.setLocalDot).
import { GameConfig } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import { Container, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { MapProjection } from "./mapMarkers.ts";

const DOT_SCALE = 0.2;
const RING_SCALE = 0.3;
/** status positions arrive every 0.25 s; dots ease towards them at this rate (1/s) */
const GLIDE_RATE = 8;

export interface MinimapTeamFrame {
    members: readonly TeamMemberView[];
    activeId: number;
    /** drawn world position of a member in view, else null */
    visualPos(id: number): { x: number; y: number } | null;
}

/** Inner dot sprite of a member (survev updatePlayerMapSprites). */
export function memberDot(m: { dead: boolean; downed: boolean }): { sprite: string; scale: number } {
    if (m.dead) return { sprite: "skull-outlined.img", scale: DOT_SCALE * 1.5 };
    if (m.downed) return { sprite: "player-group-downed.img", scale: DOT_SCALE };
    return { sprite: "player-map-inner.img", scale: DOT_SCALE };
}

interface Dot {
    ring: Sprite;
    inner: Sprite;
    sprite: string;
    pos: { x: number; y: number } | null;
    playerId: number;
}

export class MinimapTeam {
    readonly container = new Container({ label: "minimap-team" });
    private readonly textures: TextureStore;
    private readonly dots: Dot[] = [];

    constructor(textures: TextureStore) {
        this.textures = textures;
        for (let i = 0; i < 4; i++) {
            const ring = new Sprite();
            const inner = new Sprite();
            for (const s of [ring, inner]) {
                s.anchor.set(0.5);
                s.visible = false;
            }
            textures.apply(ring, "player-map-outer.img", RING_SCALE);
            this.container.addChild(ring, inner);
            this.dots.push({ ring, inner, sprite: "", pos: null, playerId: -1 });
        }
    }

    /** teammate dots drawn (tests) */
    get count(): number {
        return this.dots.filter((d) => d.inner.visible).length;
    }

    update(dt: number, proj: MapProjection, frame: MinimapTeamFrame | null): void {
        const members = frame?.members ?? [];
        for (let i = 0; i < this.dots.length; i++) {
            const dot = this.dots[i];
            const m = members[i];
            const show = !!frame && !!m && m.playerId !== frame.activeId;
            dot.ring.visible = show;
            dot.inner.visible = show;
            if (!show || !m || !frame) {
                dot.pos = null;
                continue;
            }
            const target = frame.visualPos(m.playerId) ?? m.pos;
            if (!dot.pos || dot.playerId !== m.playerId) dot.pos = { x: target.x, y: target.y };
            else {
                const t = Math.min(1, dt * GLIDE_RATE);
                dot.pos.x += (target.x - dot.pos.x) * t;
                dot.pos.y += (target.y - dot.pos.y) * t;
            }
            dot.playerId = m.playerId;
            const look = memberDot(m);
            if (look.sprite !== dot.sprite) {
                dot.sprite = look.sprite;
                this.textures.apply(dot.inner, look.sprite, look.scale);
            }
            dot.inner.tint = GameConfig.groupColors[i] ?? 0xffffff;
            const p = proj.toMap(dot.pos);
            dot.inner.position.set(p.x, p.y);
            dot.inner.scale.set(look.scale * proj.uiScale);
            dot.ring.position.set(p.x, p.y);
            dot.ring.scale.set(RING_SCALE * proj.uiScale);
        }
    }

    clear(): void {
        for (const d of this.dots) {
            d.ring.visible = false;
            d.inner.visible = false;
            d.pos = null;
        }
    }
}
