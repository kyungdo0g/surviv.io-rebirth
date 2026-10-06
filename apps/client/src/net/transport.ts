// How the client talks to a game: the in-browser loopback simulation (M1) or a WebSocket to a game server (M3).
import type { EmoteRequest, MapData, PlayerInput, Snapshot, SpectateActionName } from "@rebirth/sim";

export interface Transport {
    /** Called once with the static map and the local player's object id (immediately if already joined). */
    onJoin(cb: (map: MapData, playerId: number) => void): void;
    onSnapshot(cb: (s: Snapshot) => void): void;
    sendInput(input: PlayerInput): void;
    /** Spectate request of the dead local player: begin, next or prev (the original Spectate message) (M4). */
    spectate(action: SpectateActionName): void;
    /** Emote or team ping of the local player (the original Emote message; the server throttles them) (M6). */
    emote(req: EmoteRequest): void;
    /** Cobalt class choice of the local player (the original PerkModeRoleSelect message) (M7). */
    selectRole(role: string): void;
    /**
     * Drops an item from the HUD (the original DropItem message): worn armour, the gun of slot `weapIdx`, the melee
     * weapon, the droppable perk or part of a bag stack (M7).
     */
    dropItem(item: string, weapIdx: number): void;
    /** 1 solo, 2 duo, 4 squad, once known (the original Joined teamMode) (M6) */
    readonly teamMode?: number;
    /** the local player's emote loadout, once known (the original Joined emotes; wheel slots 0-3) (M6) */
    readonly emoteLoadout?: readonly string[];
    close(): void;
}

/** Shared join/snapshot callback plumbing for transports. */
export class TransportEvents {
    private joined: { map: MapData; playerId: number } | null = null;
    private readonly joinCbs: Array<(map: MapData, playerId: number) => void> = [];
    private readonly snapshotCbs: Array<(s: Snapshot) => void> = [];

    onJoin(cb: (map: MapData, playerId: number) => void): void {
        this.joinCbs.push(cb);
        if (this.joined) cb(this.joined.map, this.joined.playerId);
    }

    onSnapshot(cb: (s: Snapshot) => void): void {
        this.snapshotCbs.push(cb);
    }

    emitJoin(map: MapData, playerId: number): void {
        this.joined = { map, playerId };
        for (const cb of this.joinCbs) cb(map, playerId);
    }

    emitSnapshot(s: Snapshot): void {
        for (const cb of this.snapshotCbs) cb(s);
    }

    clear(): void {
        this.joinCbs.length = 0;
        this.snapshotCbs.length = 0;
    }
}
