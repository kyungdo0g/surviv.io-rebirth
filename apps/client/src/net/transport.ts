// How the client talks to a game: the in-browser loopback simulation (M1) or a WebSocket to a game server (M3).
import type { MapData, PlayerInput, Snapshot, SpectateActionName } from "@rebirth/sim";

export interface Transport {
    /** Called once with the static map and the local player's object id (immediately if already joined). */
    onJoin(cb: (map: MapData, playerId: number) => void): void;
    onSnapshot(cb: (s: Snapshot) => void): void;
    sendInput(input: PlayerInput): void;
    /** Spectate request of the dead local player: begin, next or prev (the original Spectate message) (M4). */
    spectate(action: SpectateActionName): void;
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
