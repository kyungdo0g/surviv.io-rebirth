// Event-mode glue of the in-game client (M7): the Cobalt class menu (opened while the followed local player has no
// class on a perkMode map, closed when it confirms or its role arrives), the big map toggle (Toggle Map, M by default, or G while unbound; Escape closes it, client.ts),
// the faction members for the minimap (Snapshot.factionStatus) and role lookups for map dots and ping colours, and the
// HUD drop sound. Survev references: game.ts (role menu on map load, RoleAnnouncement, DropItem sound, ToggleMap),
// ui/ui.ts (displayMapLarge, createPing colours).
import { GameConfig, getMapDef, Input, type MapDef } from "@rebirth/defs";
import type { FactionMemberView, Snapshot } from "@rebirth/sim";
import type { AudioEngine } from "../audio/audio.ts";
import type { InputManager } from "../input/input.ts";
import { MAP_FALLBACK } from "../input/keybinds.ts";
import type { Transport } from "../net/transport.ts";
import type { Minimap } from "../ui/minimap.ts";
import type { MinimapFactionFrame } from "../ui/minimapFaction.ts";
import { RoleMenu } from "../ui/roleMenu.ts";

/** survev game.ts: the DropItem sound, played unless fists were "dropped" */
const DROP_SOUND = "loot_drop_01";
/** survev ui.ts createPing: a faction Commander's pings are green */
const LEADER_PING_TINT = 0x00ff00;

export interface ModeUiDeps {
    /** parent of the full-screen class menu (next to #ui-game) */
    parent: HTMLElement;
    /** #ui-game (the big map hides most of it) */
    hudRoot: HTMLElement;
    audio: AudioEngine;
    transport: Transport;
    minimap(): Minimap | null;
    /** team of a player (PlayerInfoView.teamId) */
    teamOf(playerId: number): number;
}

export class ModeUi {
    readonly roleMenu: RoleMenu;
    private readonly deps: ModeUiDeps;
    private mapName = "";
    private mapDef: MapDef | null = null;
    /** the big map is open */
    bigMap = false;
    /** the followed player's faction as last received (faction maps) */
    factionStatus: readonly FactionMemberView[] = [];
    /** the local player confirmed a class or got one (the menu stays closed) */
    private classDone = false;

    constructor(deps: ModeUiDeps) {
        this.deps = deps;
        this.roleMenu = new RoleMenu({
            parent: deps.parent,
            audio: deps.audio,
            select: (role) => deps.transport.selectRole(role),
        });
    }

    get factionMode(): boolean {
        return !!this.mapDef?.gameMode.factionMode;
    }

    setMap(mapName: string): void {
        this.mapName = mapName;
        this.mapDef = getMapDef(mapName);
        this.factionStatus = [];
        this.reset();
    }

    /** A new local player (join, sandbox respawn): it chooses again; the big map closes. */
    reset(): void {
        this.classDone = false;
        this.roleMenu.close();
        this.setBigMap(false);
    }

    /** Faction of a player (1 Red, 2 Blue) on faction maps, else 0. */
    factionOf(playerId: number): number {
        if (!this.factionMode) return 0;
        const team = this.deps.teamOf(playerId);
        return team === 1 || team === 2 ? team : 0;
    }

    /**
     * The followed player waits for its Cobalt class: it cannot interact (survev player.ts canInteract), so no
     * interaction prompt shows.
     */
    awaitingClass(local: { role?: string; dead?: boolean }): boolean {
        return !!this.mapDef?.gameMode.perkMode && !local.role && !local.dead;
    }

    /** Role of a member of the followed player's faction or group ("" when unknown). */
    roleOf(playerId: number): string {
        return this.factionStatus.find((m) => m.playerId === playerId)?.role ?? "";
    }

    applySnapshot(s: Snapshot, localId: number, spectating: boolean): void {
        if (s.factionStatus) this.factionStatus = s.factionStatus;
        const mode = this.mapDef?.gameMode;
        if (!mode?.perkMode) return;
        const own = !spectating && s.localPlayerId === localId;
        const role = s.local.role ?? "";
        if (role || s.local.dead || !own) {
            if (role && own) this.classDone = true;
            this.roleMenu.close();
            return;
        }
        // the original opens the menu on map load while the active player has no role (survev game.ts)
        if (!this.classDone && !this.roleMenu.active) this.roleMenu.open(mode.perkModeRoles ?? [], this.mapName);
    }

    /** The local player's role was announced (survev game.ts RoleAnnouncement: setRoleMenuActive(false)). */
    onLocalRole(): void {
        if (!this.mapDef?.gameMode.perkMode) return;
        this.classDone = true;
        this.roleMenu.close();
    }

    /** Per frame: the map keys and the class menu countdown. */
    update(dt: number, input: InputManager, screenWidth: number, screenHeight: number): void {
        // Toggle Map, or G while unbound (survev game.ts); Escape is handled with the in-game menu (client.ts)
        if (input.wasBindPressed(Input.ToggleMap) || input.wasFreeKeyPressed(MAP_FALLBACK))
            this.setBigMap(!this.bigMap);
        if (this.roleMenu.confirmed) this.classDone = true;
        this.roleMenu.update(dt, screenWidth, screenHeight);
    }

    setBigMap(on: boolean): void {
        this.bigMap = on;
        this.deps.minimap()?.setBig(on);
        this.deps.hudRoot.classList.toggle("ui-bigmap", on);
    }

    /** A HUD drop went out: the drop sound (survev game.ts, not for fists). */
    dropped(item: string): void {
        if (item !== "fists") this.deps.audio.playSound(DROP_SOUND, { channel: "ui" });
    }

    /**
     * Minimap tint of a player's ping (survev ui.ts createPing): a faction Commander's is green, a group member's its
     * group colour (`groupIdx`), anybody else's its team colour.
     */
    pingTint(playerId: number, groupIdx: number): number {
        if (this.factionMode && this.roleOf(playerId) === "leader") return LEADER_PING_TINT;
        if (groupIdx >= 0) return GameConfig.groupColors[groupIdx] ?? 0xffffff;
        return GameConfig.teamColors[this.deps.teamOf(playerId) - 1] ?? 0xffffff;
    }

    /** Ping sound of a player: Commanders and Lone Survivrs use the ping's leader sound (survev emote.ts addPing). */
    pingSound(playerId: number, def: { sound?: string; soundLeader?: string }): string | undefined {
        const role = this.roleOf(playerId);
        // survev's Captain too (survev client emote.ts:633-640)
        const leads = role === "leader" || role === "captain" || role === "last_man";
        return leads && def.soundLeader ? def.soundLeader : def.sound;
    }

    /**
     * The followed player's faction outside its group and the enemies revealed by firing, for the minimap (faction
     * maps only).
     */
    minimapFrame(
        activeId: number,
        group: readonly number[],
        visualPos: (id: number) => { x: number; y: number } | null,
    ): MinimapFactionFrame | null {
        const faction = this.factionOf(activeId);
        if (!faction || this.factionStatus.length === 0) return null;
        return {
            members: this.factionStatus,
            faction,
            skip: new Set([activeId, ...group]),
            visualPos,
            factionOf: (id) => this.factionOf(id),
        };
    }

    destroy(): void {
        this.roleMenu.destroy();
        this.deps.hudRoot.classList.remove("ui-bigmap");
    }
}
