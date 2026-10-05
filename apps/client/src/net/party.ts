// Party lobby client (M6): the original team menu protocol, JSON `{type, data}` text messages over the /team_v2
// WebSocket (apps/server/src/party.ts, partySocket.ts; docs/research/ui/menus.md "Team lobby"). The socket opens, the
// first message creates or joins a room (the server closes sockets that do neither within 5 s), then the client follows
// the room `state`, sends the leader's settings and start, and keeps the connection alive every 45 s like the original.
// A `joinGame` carries the game server's /play URL with this member's join token (find_game's answer shape).
// Errors arrive as an `error` message followed by the server closing the socket; a socket that closes on its own while
// in a room is "lost_conn".

/** Original team error codes (survev shared/types/team.ts TeamMenuErrorType, as sent by apps/server). */
export type PartyErrorType =
    | "join_full"
    | "join_not_found"
    | "join_failed"
    | "create_failed"
    | "lost_conn"
    | "find_game_error"
    | "find_game_full"
    | "kicked"
    | "rate_limited";

export interface PartyRoomState {
    /** "#" + code */
    roomUrl: string;
    findingGame: boolean;
    lastError?: PartyErrorType;
    region: string;
    autoFill: boolean;
    enabledGameModeIdxs: number[];
    /** 1 duo, 2 squad */
    gameModeIdx: number;
    maxPlayers: number;
    captchaEnabled: boolean;
}

export interface PartyMemberState {
    name: string;
    /** index in the room; 0 is the leader */
    playerId: number;
    isLeader: boolean;
    inGame: boolean;
}

export interface PartyState {
    localPlayerId: number;
    room: PartyRoomState;
    players: PartyMemberState[];
}

export interface PartyRoomProps {
    region: string;
    autoFill: boolean;
    /** 1 duo, 2 squad */
    gameModeIdx: number;
}

export interface PartyCallbacks {
    state?(state: PartyState): void;
    /** the leader started: connect the game WebSocket to `url` (it carries this member's token) */
    joinGame?(join: { url: string; token: string }): void;
    kicked?(): void;
    error?(type: PartyErrorType): void;
    /** the socket closed (after `error` / `kicked` when one of those caused it) */
    closed?(): void;
}

/** survev teamMenu.ts: keepAlive every 45 s (the server drops members silent for 8 minutes) */
const KEEP_ALIVE_MS = 45_000;

/** ws(s)://host/team_v2 for a server origin ("" = this page's origin, proxied by the dev server). */
export function partySocketUrl(baseUrl: string): string {
    const origin = baseUrl || `${location.protocol}//${location.host}`;
    const url = new URL("/team_v2", origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
}

/** A room code from user input: "#CODE", "CODE", or an invite link (`/?team=CODE` or `/#CODE`); "" when none. */
export function parseRoomCode(input: string): string {
    const text = input.trim();
    if (!text) return "";
    try {
        if (/^[a-z]+:\/\//i.test(text)) {
            const url = new URL(text);
            return (url.searchParams.get("team") ?? url.hash.replace(/^#/, "")).trim();
        }
    } catch {
        return "";
    }
    const query = /[?&]team=([^&#]+)/.exec(text);
    if (query) return decodeURIComponent(query[1]);
    return text.replace(/^#/, "");
}

export class PartyClient {
    state: PartyState | null = null;
    /** the last error the server sent (or lost_conn) */
    lastError: PartyErrorType | null = null;
    private readonly ws: WebSocket;
    private readonly cb: PartyCallbacks;
    private keepAlive: ReturnType<typeof setInterval> | null = null;
    private closed = false;
    private gotError = false;

    /** Opens the socket and creates a room (`create`) or joins room `code` (`join`). */
    constructor(
        baseUrl: string,
        first: { create: PartyRoomProps; name: string } | { join: string; name: string },
        cb: PartyCallbacks,
    ) {
        this.cb = cb;
        this.ws = new WebSocket(partySocketUrl(baseUrl));
        this.ws.onopen = () => {
            if ("create" in first) {
                this.send("create", { roomData: first.create, playerData: { name: first.name } });
            } else {
                this.send("join", { roomUrl: `#${first.join}`, playerData: { name: first.name } });
            }
            this.keepAlive = setInterval(() => this.send("keepAlive", {}), KEEP_ALIVE_MS);
        };
        this.ws.onmessage = (ev) => this.receive(ev.data);
        this.ws.onclose = () => this.onClose();
        this.ws.onerror = () => {
            // a close event follows
        };
    }

    get connected(): boolean {
        return !this.closed && this.ws.readyState === WebSocket.OPEN;
    }

    get isLeader(): boolean {
        const s = this.state;
        return !!s && s.players.some((p) => p.playerId === s.localPlayerId && p.isLeader);
    }

    /** The room code without "#" ("" before the first state). */
    get code(): string {
        return this.state?.room.roomUrl.replace(/^#/, "") ?? "";
    }

    changeName(name: string): void {
        this.send("changeName", { name });
    }

    setRoomProps(props: PartyRoomProps): void {
        this.send("setRoomProps", props);
    }

    kick(playerId: number): void {
        this.send("kick", { playerId });
    }

    playGame(region?: string): void {
        this.send("playGame", region !== undefined ? { region } : {});
    }

    /** Back from a party game: the member is in the lobby again. */
    gameComplete(): void {
        this.send("gameComplete", {});
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.stopTimer();
        if (this.ws.readyState <= WebSocket.OPEN) this.ws.close(1000);
    }

    private send(type: string, data: unknown): void {
        if (this.closed || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({ type, data }));
    }

    private receive(raw: unknown): void {
        if (typeof raw !== "string") return;
        let msg: { type?: string; data?: unknown };
        try {
            msg = JSON.parse(raw) as { type?: string; data?: unknown };
        } catch {
            return;
        }
        switch (msg.type) {
            case "state":
                this.state = msg.data as PartyState;
                this.cb.state?.(this.state);
                break;
            case "joinGame": {
                const data = msg.data as { url?: string; token?: string };
                if (typeof data?.url === "string") this.cb.joinGame?.({ url: data.url, token: data.token ?? "" });
                break;
            }
            case "kicked":
                this.gotError = true;
                this.lastError = "kicked";
                this.cb.kicked?.();
                break;
            case "error": {
                const type = (msg.data as { type?: PartyErrorType })?.type ?? "join_failed";
                this.gotError = true;
                this.lastError = type;
                this.cb.error?.(type);
                break;
            }
            default:
                break;
        }
    }

    private onClose(): void {
        this.stopTimer();
        const wasClosed = this.closed;
        this.closed = true;
        if (wasClosed) return;
        if (!this.gotError) {
            // closed without a reason: never got in, or the connection dropped
            const type: PartyErrorType = this.state ? "lost_conn" : "join_failed";
            this.lastError = type;
            this.cb.error?.(type);
        }
        this.cb.closed?.();
    }

    private stopTimer(): void {
        if (this.keepAlive !== null) clearInterval(this.keepAlive);
        this.keepAlive = null;
    }
}
