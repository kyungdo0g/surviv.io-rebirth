// Faction members on the minimap (M7; survev client/src/ui/ui.ts updatePlayerMapSprites with the faction PlayerStatus,
// docs/research/ui/hud.md "Minimap and full map"): every member of the followed player's faction outside its own group
// (Snapshot.factionStatus, refreshed every 0.5 s) is a small dot in the team colour (red 0xcc0000, blue 0x007eff) at
// 0.75x; role holders show their role's map icon (Commander star, Medic cross) at 1.25x on top; downed members the
// downed icon and dead ones a skull (a dead Commander its leader skull) at 1.25x and 60 % alpha. The group's own members
// are minimapTeam.ts's dots. 50v50 enemies revealed by firing (survev timeUntilHidden; the server's
// rules.roles.factionRevealTime, off by default since the owner's 2026-10-08 feedback) come in the same rows: they show
// in their own faction's colour, fade in over 0.1 s and, once no longer listed, stay 2 s and fade out by 2.5 s (survev
// client/src/objects/player.ts:2740-2759 timeSinceVisible / timeSinceUpdate).
import { GameConfig } from "@rebirth/defs";
import type { FactionMemberView } from "@rebirth/sim";
import { Container, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { MapProjection } from "./mapMarkers.ts";
import { roleMapIcon } from "./minimapTeam.ts";

const DOT_SCALE = 0.2;
/** status positions arrive every 0.5 s; dots ease towards them at this rate (1/s) */
const GLIDE_RATE = 6;
const DEAD_ALPHA = 0.6;
/** a revealed enemy's dot fades in over this long (s) */
const ENEMY_FADE_IN = 0.1;
/** an enemy no longer revealed stays this long, then fades out until ENEMY_HIDE (s) */
const ENEMY_STAY = 2;
const ENEMY_HIDE = 2.5;

function smoothstep(v: number, a: number, b: number): number {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

export interface MinimapFactionFrame {
    members: readonly FactionMemberView[];
    /** the followed player's faction (1 Red, 2 Blue) */
    faction: number;
    /** players drawn elsewhere: the followed player and its group */
    skip: ReadonlySet<number>;
    /** drawn world position of a member in view, else null */
    visualPos(id: number): { x: number; y: number } | null;
    /** faction of any player (1 Red, 2 Blue; 0 unknown) */
    factionOf(id: number): number;
}

interface Dot {
    sprite: Sprite;
    texture: string;
    pos: { x: number; y: number };
    seen: boolean;
    /** a member of another faction (revealed by firing) */
    enemy: boolean;
    /** seconds since it was first listed, and since it was last listed */
    sinceVisible: number;
    sinceUpdate: number;
}

/** Look of a faction member's dot that is not in the followed player's group (survev updatePlayerMapSprites). */
export function factionDot(m: Pick<FactionMemberView, "dead" | "downed" | "role">): {
    sprite: string;
    scale: number;
    alpha: number;
    icon: boolean;
} {
    const mapIcon = roleMapIcon(m.role);
    if (m.dead)
        return { sprite: mapIcon?.dead ?? "skull-outlined.img", scale: 1.25, alpha: DEAD_ALPHA, icon: !!mapIcon };
    if (m.downed) return { sprite: "player-map-downed.img", scale: 1.25, alpha: 1, icon: false };
    if (mapIcon) return { sprite: mapIcon.alive, scale: 1.25, alpha: 1, icon: true };
    return { sprite: "player-map-inner.img", scale: 0.75, alpha: 1, icon: false };
}

export class MinimapFaction {
    readonly container = new Container({ label: "minimap-faction", sortableChildren: true });
    private readonly textures: TextureStore;
    private readonly dots = new Map<number, Dot>();

    constructor(textures: TextureStore) {
        this.textures = textures;
    }

    /** faction dots drawn (tests) */
    get count(): number {
        let n = 0;
        for (const d of this.dots.values()) if (d.sprite.visible) n++;
        return n;
    }

    /** role icons drawn (tests) */
    get roleIcons(): string[] {
        return [...this.dots.values()].filter((d) => d.sprite.visible && d.sprite.zIndex > 1).map((d) => d.texture);
    }

    update(dt: number, proj: MapProjection, frame: MinimapFactionFrame | null): void {
        for (const d of this.dots.values()) d.seen = false;
        for (const m of frame?.members ?? []) {
            if (!frame || frame.skip.has(m.playerId)) continue;
            const faction = frame.factionOf(m.playerId) || frame.faction;
            const tint = GameConfig.teamColors[faction - 1] ?? 0xffffff;
            const target = (!m.dead && frame.visualPos(m.playerId)) || m.pos;
            let dot = this.dots.get(m.playerId);
            if (!dot) {
                const sprite = new Sprite();
                sprite.anchor.set(0.5);
                this.container.addChild(sprite);
                dot = {
                    sprite,
                    texture: "",
                    pos: { x: target.x, y: target.y },
                    seen: true,
                    enemy: false,
                    sinceVisible: 0,
                    sinceUpdate: 0,
                };
                this.dots.set(m.playerId, dot);
            }
            dot.seen = true;
            dot.enemy = faction !== frame.faction;
            dot.sinceVisible += dt;
            dot.sinceUpdate = 0;
            const t = Math.min(1, dt * GLIDE_RATE);
            dot.pos.x += (target.x - dot.pos.x) * t;
            dot.pos.y += (target.y - dot.pos.y) * t;
            const look = factionDot(m);
            if (look.sprite !== dot.texture) {
                dot.texture = look.sprite;
                this.textures.apply(dot.sprite, look.sprite, DOT_SCALE * look.scale);
            }
            const p = proj.toMap(dot.pos);
            dot.sprite.position.set(p.x, p.y);
            dot.sprite.scale.set(DOT_SCALE * look.scale * proj.uiScale);
            dot.sprite.tint = tint;
            dot.sprite.alpha = look.alpha * (dot.enemy ? smoothstep(dot.sinceVisible, 0, ENEMY_FADE_IN) : 1);
            // role icons over plain dots, the living over the dead (survev zOrder)
            dot.sprite.zIndex = (look.icon ? 2 : 0) + (m.dead ? 0 : 1);
            dot.sprite.visible = true;
        }
        for (const [id, d] of this.dots) {
            if (d.seen) continue;
            // an enemy no longer revealed lingers where it was last seen, then fades out
            d.sinceUpdate += dt;
            if (d.enemy && frame && d.sinceUpdate < ENEMY_HIDE) {
                const p = proj.toMap(d.pos);
                d.sprite.position.set(p.x, p.y);
                d.sprite.alpha = Math.min(d.sprite.alpha, 1 - smoothstep(d.sinceUpdate, ENEMY_STAY, ENEMY_HIDE));
                continue;
            }
            d.sprite.destroy();
            this.dots.delete(id);
        }
    }

    clear(): void {
        for (const d of this.dots.values()) d.sprite.destroy();
        this.dots.clear();
    }
}
