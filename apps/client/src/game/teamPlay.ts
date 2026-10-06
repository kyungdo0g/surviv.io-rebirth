// Team play in the client (M6): the team HUD rows and edge indicators, teammates' names in the world, teammate dots on
// the minimap, the emote / ping wheels and what the snapshots' emotes and pings show (bubbles over players, world pings
// with edge arrows, minimap markers). Teams come from LocalPlayerState.team (duo / squad only); colours are group
// colour slots by join order. Solo players still emote and ping (their pings reach only themselves, like the original).
// M7: ping colours and sounds and the role icons of the minimap dots come from the mode hooks (a faction Commander's
// pings are green with the leader sound; teammates' role map icons in the team colour on faction maps).
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, type GunDef } from "@rebirth/defs";
import type { EmoteEvent, LocalPlayerState, PlayerView, Snapshot, TeamMemberView } from "@rebirth/sim";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import { EmoteFx } from "../fx/emotes.ts";
import type { InputManager } from "../input/input.ts";
import type { Transport } from "../net/transport.ts";
import { TeamNames } from "../objects/teamNames.ts";
import type { ObjectWorld } from "../objects/world.ts";
import type { Camera } from "../render/camera.ts";
import type { Renderer } from "../render/renderer.ts";
import { EmoteWheel } from "../ui/emoteWheel.ts";
import type { Minimap } from "../ui/minimap.ts";
import { TeamHud } from "../ui/teamHud.ts";

export interface TeamPlayDeps {
    renderer: Renderer;
    textures: TextureStore;
    audio: AudioEngine;
    camera: Camera;
    /** #ui-game */
    hudRoot: HTMLElement;
    transport: Transport;
    minimap(): Minimap | null;
    map(): { width: number; height: number } | null;
    /** minimap tint of a player's ping (M7: group colour, team colour, a Commander's green) */
    pingTint?(playerId: number, groupIdx: number): number;
    /** sound of a player's ping (M7: the leader sound for Commanders) */
    pingSound?(playerId: number, def: { sound?: string; soundLeader?: string }): string | undefined;
    /** faction of a player on faction maps (1 Red, 2 Blue), else 0 (M7) */
    factionOf?(playerId: number): number;
    /** touch devices: the wheels open from the emote button and big map taps (M8) */
    touch?: boolean;
    /** closes the big map (an emote sent from the ping wheel, M8) */
    closeBigMap?(): void;
}

export interface TeamPlayFrame {
    dt: number;
    now: number;
    world: ObjectWorld;
    local: LocalPlayerState;
    localId: number;
    activeId: number;
    spectating: boolean;
    /** the small layout: half-size edge indicators 16 px in (M8) */
    small?: boolean;
}

export class TeamPlay {
    readonly hud: TeamHud;
    readonly names: TeamNames;
    readonly emotes: EmoteFx;
    readonly wheel: EmoteWheel;
    private readonly deps: TeamPlayDeps;
    /** the followed player's group as last received (undefined in solo) */
    team: TeamMemberView[] | undefined;
    /** emote / ping events received (tests) */
    readonly received: EmoteEvent[] = [];
    private activeId = -1;
    private localId = -1;
    private world: ObjectWorld | null = null;

    constructor(deps: TeamPlayDeps) {
        this.deps = deps;
        this.hud = new TeamHud(deps.hudRoot);
        this.names = new TeamNames(deps.renderer);
        this.emotes = new EmoteFx(deps.textures, deps.audio);
        deps.renderer.screen.addChild(this.emotes.container);
        this.wheel = new EmoteWheel({
            root: deps.hudRoot,
            send: (req) => deps.transport.emote(req),
            pingWorldPos: (screen) => this.pingWorldPos(screen),
            touch: deps.touch,
            closeBigMap: () => deps.closeBigMap?.(),
        });
    }

    /** team mode of the game: the transport's (the Joined message), else as far as the team list tells */
    get teamMode(): number {
        const known = this.deps.transport.teamMode;
        if (known) return known;
        const n = this.team?.length ?? 0;
        return n > 2 ? 4 : n > 0 ? 2 : 1;
    }

    /** Index of `playerId` in the followed player's group (its colour slot), -1 when not in it. */
    groupIndex(playerId: number): number {
        if (!this.team) return playerId === this.activeId ? 0 : -1;
        return this.team.findIndex((m) => m.playerId === playerId);
    }

    applySnapshot(s: Snapshot, localId: number, world: ObjectWorld): void {
        this.activeId = s.localPlayerId;
        this.localId = localId;
        this.world = world;
        this.team = s.local.team;
        const loadout = this.deps.transport.emoteLoadout;
        if (loadout) this.wheel.setLoadout(loadout);
        for (const e of s.emotes ?? []) {
            this.received.push(e);
            if (this.received.length > 64) this.received.shift();
            if (e.isPing) this.onPing(e);
            else this.emotes.addEmote(e);
        }
        this.updateLocalDot(s.local);
    }

    private onPing(e: EmoteEvent): void {
        if (!e.pos) return;
        const idx = this.groupIndex(e.playerId);
        const def = GameObjectDefs[e.type] as { sound?: string; soundLeader?: string } | undefined;
        const sound = def ? this.deps.pingSound?.(e.playerId, def) : undefined;
        this.emotes.addPing(e, idx, e.playerId === this.localId, sound);
        const tint = this.deps.pingTint?.(e.playerId, idx) ?? GameConfig.groupColors[idx] ?? 0xffffff;
        this.deps.minimap()?.indicators.addPlayerPing(e.playerId, e.type, e.pos, tint);
    }

    /** The followed player's own minimap dot: its group colour, downed / dead state and role icon (M7). */
    private updateLocalDot(local: LocalPlayerState): void {
        const idx = Math.max(0, this.groupIndex(this.activeId));
        const me = this.team?.find((m) => m.playerId === this.activeId);
        const state = { dead: !!me?.dead || !!local.dead, downed: !!me?.downed, role: local.role ?? me?.role ?? "" };
        this.deps.minimap()?.setLocalDot(idx, state, this.deps.factionOf?.(this.activeId) ?? 0);
    }

    /** The ping wheel's world position: the map position under a minimap point, else the world under the cursor. */
    private pingWorldPos(screen: Vec2): Vec2 {
        const p = this.deps.minimap()?.screenToWorld(screen) ?? this.deps.camera.screenToWorld(screen);
        const map = this.deps.map();
        if (!map) return p;
        return { x: Math.min(Math.max(p.x, 0), map.width), y: Math.min(Math.max(p.y, 0), map.height) };
    }

    /** Drawn position and layer of a living player in view. */
    playerPos(id: number, now: number): { pos: Vec2; layer: number } | null {
        const view = this.world?.get(id) as PlayerView | undefined;
        if (view?.kind !== "player" || view.dead) return null;
        return { pos: this.world?.visualPos(id, now) ?? view.pos, layer: view.layer };
    }

    /**
     * Runs the wheels before the frame's input is sampled (they read the right button and C, and freeze the aim);
     * `enabled` is false while dead or spectating.
     */
    updateWheel(dt: number, input: InputManager, local: LocalPlayerState | null, enabled: boolean): void {
        const cur = local?.weapons[local.curWeapIdx]?.type ?? "";
        const def = cur ? GameObjectDefs[cur] : undefined;
        const ammo = def?.type === "gun" ? (def as GunDef).ammo : "";
        this.wheel.update({ dt, input, enabled: enabled && !!local && !local.dead, teamMode: this.teamMode, ammo });
        input.aimOverride = this.wheel.open ? this.wheel.center : null;
    }

    update(frame: TeamPlayFrame): void {
        const { world, now } = frame;
        const cam = this.deps.camera;
        this.hud.update({
            team: this.team,
            activeId: frame.activeId,
            camera: cam,
            visualPos: (id) => this.playerPos(id, now)?.pos ?? null,
            factionMode: (this.deps.factionOf?.(frame.activeId) ?? 0) > 0,
            small: frame.small,
        });
        const names = [];
        for (const m of this.team ?? []) {
            if (m.playerId === frame.activeId) continue;
            const p = this.playerPos(m.playerId, now);
            if (p) names.push({ playerId: m.playerId, name: m.name, pos: p.pos, layer: p.layer });
        }
        this.names.update(names);
        this.emotes.update({
            dt: frame.dt,
            camera: cam,
            player: (id) => {
                const p = this.playerPos(id, now);
                return p ? { pos: p.pos, layer: p.layer } : null;
            },
        });
        this.world = world;
    }

    /** The minimap's teammate dots for this frame. */
    minimapFrame(now: number): {
        members: readonly TeamMemberView[];
        activeId: number;
        faction: number;
        visualPos(id: number): Vec2 | null;
    } | null {
        if (!this.team) return null;
        return {
            members: this.team,
            activeId: this.activeId,
            faction: this.deps.factionOf?.(this.activeId) ?? 0,
            visualPos: (id) => this.playerPos(id, now)?.pos ?? null,
        };
    }

    /** A new local player or game: drop everything shown. */
    clear(): void {
        this.team = undefined;
        this.hud.clear();
        this.names.clear();
        this.emotes.clear();
        this.wheel.reset();
    }

    destroy(): void {
        this.names.clear();
        this.emotes.destroy();
        this.wheel.destroy();
        this.hud.destroy();
    }
}
