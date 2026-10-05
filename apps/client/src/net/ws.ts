// Network transport (M3): POST /api/find_game on the game server, open the /play WebSocket, Join, then hand the
// decoded Map and Update messages (exact MapData / Snapshot shapes) to the client through the Transport interface.
// Inputs are throttled to one message per 60 Hz frame, sent at once when they change and repeated every second
// otherwise (packages/protocol InputThrottle).
import {
    DisconnectReason,
    GameConnection,
    type GameConnectionOptions,
    InputThrottle,
    MsgType,
} from "@rebirth/protocol";
import type { PlayerInput } from "@rebirth/sim";
import { type Transport, TransportEvents } from "./transport.ts";

export interface WsTransportOptions extends GameConnectionOptions {
    /** called once when the connection ends, with the reason (see `describeDisconnect`) */
    onDisconnect?: (reason: string) => void;
    /** Ping period for the round-trip estimate in `rttMs` (ms; 0 disables; default 2000) */
    pingIntervalMs?: number;
}

/** Player-facing text for a disconnect reason. */
export function describeDisconnect(reason: string): string {
    switch (reason) {
        case DisconnectReason.InvalidProtocol:
            return "A new version of the game is available. Please refresh the page.";
        case DisconnectReason.InvalidToken:
        case DisconnectReason.JoinTimeout:
            return "Joining the game took too long. Please try again.";
        case DisconnectReason.Full:
            return "The game is full.";
        case DisconnectReason.RateLimited:
        case DisconnectReason.InvalidPacket:
            return "Disconnected by the server.";
        case DisconnectReason.GameClosed:
            return "The game has ended.";
        case DisconnectReason.ServerShutdown:
            return "The server is restarting.";
        case DisconnectReason.FindGameFailed:
            return "Could not reach the game server.";
        default:
            return "Connection lost.";
    }
}

export class WsTransport implements Transport {
    readonly connection: GameConnection;
    /** resolves once joined (Joined + Map received); rejects when joining failed */
    readonly ready: Promise<void>;
    private readonly events = new TransportEvents();
    private readonly throttle: InputThrottle;
    private readonly disconnectCbs: Array<(reason: string) => void> = [];
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private joined = false;
    private closed = false;

    constructor(opts: WsTransportOptions = {}) {
        this.connection = new GameConnection(opts);
        this.throttle = new InputThrottle((input) => this.connection.sendInput(input));
        if (opts.onDisconnect) this.disconnectCbs.push(opts.onDisconnect);
        // join is emitted synchronously when the Map arrives, so it always precedes the first snapshot
        this.connection.onMessage((msg) => {
            if (msg.type === MsgType.Map && !this.joined && this.connection.joined && !this.closed) {
                this.joined = true;
                this.events.emitJoin(msg.map, this.connection.joined.playerId);
            }
        });
        this.connection.onUpdate((msg) => {
            if (this.joined && !this.closed) this.events.emitSnapshot(msg.snapshot);
        });
        this.connection.onDisconnect((reason) => {
            this.stopTimers();
            if (reason !== "closed") console.warn(`disconnected: ${reason}`);
            for (const cb of this.disconnectCbs) cb(reason);
        });
        this.ready = this.connection.connect().then(() => {
            const period = opts.pingIntervalMs ?? 2000;
            if (period > 0 && !this.closed) {
                this.connection.ping();
                this.pingTimer = setInterval(() => this.connection.ping(), period);
            }
        });
        // failures are reported through onDisconnect; keep the rejection from going unhandled
        this.ready.catch(() => {});
    }

    /** latest measured round trip in ms (-1 before the first Pong) */
    get rttMs(): number {
        return this.connection.rttMs;
    }

    onJoin(cb: Parameters<Transport["onJoin"]>[0]): void {
        this.events.onJoin(cb);
    }

    onSnapshot(cb: Parameters<Transport["onSnapshot"]>[0]): void {
        this.events.onSnapshot(cb);
    }

    /** Called once when the connection ends (immediately if it already has). */
    onDisconnect(cb: (reason: string) => void): void {
        this.disconnectCbs.push(cb);
        if (this.connection.disconnectReason !== null) cb(this.connection.disconnectReason);
    }

    sendInput(input: PlayerInput): void {
        if (!this.closed && this.joined) this.throttle.push(input);
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.stopTimers();
        this.connection.close();
        this.events.clear();
    }

    private stopTimers(): void {
        this.throttle.dispose();
        if (this.pingTimer !== null) clearInterval(this.pingTimer);
        this.pingTimer = null;
    }
}
