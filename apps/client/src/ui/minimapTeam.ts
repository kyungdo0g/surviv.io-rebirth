// Teammates on the minimap (survev client/src/ui/ui.ts updatePlayerMapSprites; docs/research/ui/hud.md "Minimap and
// full map"): every group member other than the followed player is a dot in its group colour (yellow, magenta, cyan,
// orange) inside a white ring, the downed icon while knocked out and an outlined skull (1.5x) once dead. Positions
// come from the team status (refreshed every 0.25 s) and glide to each new one; a member drawn in the world uses its
// drawn position. The followed player's own centre dot takes its group colour and state too (Minimap.setLocalDot).
// M7: a member holding a role with a map icon (Commander star, Medic cross) shows that icon 1.25x without the ring, and
// its dead icon once dead; on faction maps role icons take the team colour (survev updatePlayerMapSprites).
import { GameConfig, GameObjectDefs, type RoleDef } from "@rebirth/defs";
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
    /** the group's faction on faction maps (1 Red, 2 Blue), else 0 (M7) */
    faction?: number;
    /** drawn world position of a member in view, else null */
    visualPos(id: number): { x: number; y: number } | null;
}

/** The role's minimap icons (RoleDef.mapIcon), if it has any. */
export function roleMapIcon(role: string | undefined): { alive: string; dead: string } | undefined {
    return role ? (GameObjectDefs[role] as RoleDef | undefined)?.mapIcon : undefined;
}

/**
 * Inner dot sprite of a member of the followed player's group (survev updatePlayerMapSprites, same group): `icon` is
 * true for a role map icon (drawn without the ring, in the team colour on faction maps).
 */
export function memberDot(m: { dead: boolean; downed: boolean; role?: string }): {
    sprite: string;
    scale: number;
    icon: boolean;
} {
    const mapIcon = roleMapIcon(m.role);
    if (m.dead) return { sprite: mapIcon?.dead ?? "skull-outlined.img", scale: DOT_SCALE * 1.5, icon: !!mapIcon };
    if (m.downed) return { sprite: "player-group-downed.img", scale: DOT_SCALE, icon: false };
    if (mapIcon) return { sprite: mapIcon.alive, scale: DOT_SCALE * 1.25, icon: true };
    return { sprite: "player-map-inner.img", scale: DOT_SCALE, icon: false };
}

/** Tint of a group member's dot: its group colour, the team colour for a faction role icon. */
export function memberTint(idx: number, icon: boolean, faction: number): number {
    if (icon && faction) return GameConfig.teamColors[faction - 1] ?? 0xffffff;
    return GameConfig.groupColors[idx] ?? 0xffffff;
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
            dot.inner.visible = show;
            dot.ring.visible = show;
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
            dot.inner.tint = memberTint(i, look.icon, frame.faction ?? 0);
            dot.ring.visible = !look.icon;
            const p = proj.toMap(dot.pos);
            dot.inner.position.set(p.x, p.y);
            dot.inner.scale.set(look.scale * proj.uiScale);
            dot.ring.position.set(p.x, p.y);
            dot.ring.scale.set(proj.ringScale ?? RING_SCALE * proj.uiScale);
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
