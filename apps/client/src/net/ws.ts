// Network transport (M3): POST /api/find_game on the game server, open the /play WebSocket, Join, then hand the
// decoded Map and Update messages (exact MapData / Snapshot shapes) to the client through the Transport interface.
// Inputs are throttled to one message per 60 Hz frame, sent at once when they change and repeated every second
// otherwise (packages/protocol InputThrottle). A dead player's spectate requests go out as Spectate messages. The
// server closes a finished game 1.8 s after its winner was decided with a `game_closed` disconnect; after this
// client saw its GameOver result that is the normal end of the game, not an error (`endedNormally`).
// M6: find_game carries the team mode and auto fill; a party game connects straight to the /play URL (with its join
// token) the lobby's joinGame message gave (`joinUrl`); emotes and pings go out as Emote messages.
// M7: Cobalt class choices go out as PerkModeRoleSelect and HUD drops as DropItem messages.
// M8: disconnect texts are localized; a find_game refused with 403 {error: "banned"} ends with DisconnectReason.Banned
// (packages/protocol connection.ts); touch clients join with useTouch / isMobile.
import {
    DisconnectReason,
    GameConnection,
    type GameConnectionOptions,
    InputThrottle,
    MsgType,
    SpectateAction,
} from "@rebirth/protocol";
import type { EmoteRequest, PlayerInput, SpectateActionName } from "@rebirth/sim";
import { getLang } from "../l10n/lang.ts";
import { enSettings, koSettings } from "../l10n/settings.ts";
import { type Transport, TransportEvents } from "./transport.ts";

export interface WsTransportOptions extends GameConnectionOptions {
    /** called once when the connection ends, with the reason (see `describeDisconnect`) */
    onDisconnect?: (reason: string) => void;
    /** Ping period for the round-trip estimate in `rttMs` (ms; 0 disables; default 2000) */
    pingIntervalMs?: number;
    /** connect to this /play URL (carrying a join token, e.g. a party's joinGame) instead of calling find_game */
    joinUrl?: string;
}

/** A disconnect string in the current language (only the M8 table: this module stays free of the HUD tables). */
function text(key: string): string {
    return (getLang() === "ko" ? koSettings[key] : undefined) ?? enSettings[key] ?? key;
}

/** Player-facing text for a disconnect reason, in the current language (M8: Banned for a banned address). */
export function describeDisconnect(reason: string): string {
    switch (reason) {
        case DisconnectReason.InvalidProtocol:
            return text("disconnect-invalid-protocol");
        case DisconnectReason.InvalidToken:
        case DisconnectReason.JoinTimeout:
            return text("disconnect-join-timeout");
        case DisconnectReason.Full:
            return text("disconnect-full");
        case DisconnectReason.RateLimited:
        case DisconnectReason.InvalidPacket:
            return text("disconnect-kicked");
        case DisconnectReason.GameClosed:
            return text("disconnect-game-closed");
        case DisconnectReason.ServerShutdown:
            return text("disconnect-server-shutdown");
        case DisconnectReason.FindGameFailed:
            return text("disconnect-find-game-failed");
        case DisconnectReason.Banned:
            return text("disconnect-banned");
        default:
            return text("disconnect-connection-lost");
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
    /** a GameOver result arrived (the game_closed disconnect that follows is expected) */
    private sawGameOver = false;

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
            if (msg.snapshot.gameOver) this.sawGameOver = true;
            if (this.joined && !this.closed) this.events.emitSnapshot(msg.snapshot);
        });
        this.connection.onDisconnect((reason) => {
            this.stopTimers();
            if (reason !== "closed" && !this.endedNormally) console.warn(`disconnected: ${reason}`);
            for (const cb of this.disconnectCbs) cb(reason);
        });
        const joining = opts.joinUrl ? this.connection.connectTo(opts.joinUrl) : this.connection.connect();
        this.ready = joining.then(() => {
            const period = opts.pingIntervalMs ?? 2000;
            if (period > 0 && !this.closed) {
                this.connection.ping();
                this.pingTimer = setInterval(() => this.connection.ping(), period);
            }
        });
        // failures are reported through onDisconnect; keep the rejection from going unhandled
        this.ready.catch(() => {});
    }

    /** The connection ended the normal way: closed by us, or the server closed the game after our GameOver. */
    get endedNormally(): boolean {
        const reason = this.connection.disconnectReason;
        return reason === "closed" || (reason === DisconnectReason.GameClosed && this.sawGameOver);
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

    spectate(action: SpectateActionName): void {
        if (this.closed || !this.joined) return;
        const value =
            action === "begin" ? SpectateAction.Begin : action === "next" ? SpectateAction.Next : SpectateAction.Prev;
        this.connection.send({ type: MsgType.Spectate, action: value });
    }

    /** the game's team mode from the Joined message (1 before it arrived) */
    get teamMode(): number {
        return this.connection.joined?.teamMode ?? 1;
    }

    /** the emote loadout from the Joined message */
    get emoteLoadout(): readonly string[] | undefined {
        return this.connection.joined?.emotes;
    }

    emote(req: EmoteRequest): void {
        if (this.closed || !this.joined) return;
        this.connection.sendEmote(req);
    }

    selectRole(role: string): void {
        if (this.closed || !this.joined) return;
        this.connection.sendRoleSelect(role);
    }

    dropItem(item: string, weapIdx: number): void {
        if (this.closed || !this.joined) return;
        this.connection.sendDropItem(item, weapIdx);
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
