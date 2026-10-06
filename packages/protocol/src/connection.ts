// Client side of a game connection, shared by the browser transport (apps/client/src/net/ws.ts) and headless
// clients: POST /api/find_game, open the WebSocket, send Join, decode every server frame. Uses only the
// WebSocket/fetch globals that browsers and Node 22 both provide.
import { PROTOCOL_HASH } from "@rebirth/defs";
import type { EmoteRequest, MapData, PlayerInput } from "@rebirth/sim";
import { type ClientMsg, encodeClientMsg, ProtocolError, type ServerMsg, ServerMsgDecoder } from "./codec.ts";
import { DisconnectReason, MsgType } from "./constants.ts";
import type { JoinedMsg } from "./messages.ts";
import type { UpdateMsg } from "./update.ts";

export interface FindGameRequest {
    mapName?: string;
    region?: string;
    /** 1 solo (default), 2 duo, 4 squad (M6a) */
    teamMode?: 1 | 2 | 4;
    /** team modes: may be grouped with strangers (default true) (M6a) */
    autoFill?: boolean;
}

export interface FindGameResponse {
    /** absolute ws(s):// URL including the join token */
    url: string;
    token: string;
}

export interface GameConnectionOptions {
    /** HTTP origin of the game server, e.g. "http://127.0.0.1:8001"; "" (default) is the page's own origin */
    baseUrl?: string;
    name?: string;
    mapName?: string;
    region?: string;
    /** find_game team mode (M6a) */
    teamMode?: 1 | 2 | 4;
    /** find_game auto fill (M6a) */
    autoFill?: boolean;
    useTouch?: boolean;
    isMobile?: boolean;
    bot?: boolean;
    /** protocol hash sent in Join (default PROTOCOL_HASH; tests override it) */
    protocol?: number;
    /** time allowed for find_game + connect + join (default 10 s) */
    timeoutMs?: number;
    /** WebSocket constructor (default globalThis.WebSocket) */
    WebSocketImpl?: typeof WebSocket;
}

export interface JoinResult {
    joined: JoinedMsg;
    map: MapData;
}

/** POST {baseUrl}/api/find_game; throws with the server's error code on failure. */
export async function findGame(baseUrl: string, req: FindGameRequest): Promise<FindGameResponse> {
    const res = await fetch(`${baseUrl}/api/find_game`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
    });
    const body = (await res.json().catch(() => ({}))) as Partial<FindGameResponse> & { error?: string };
    if (!res.ok || typeof body.url !== "string" || typeof body.token !== "string") {
        throw new Error(`find_game failed: ${body.error ?? res.status}`);
    }
    return { url: body.url, token: body.token };
}

type Listener<T> = (value: T) => void;

export class GameConnection {
    readonly options: GameConnectionOptions;
    joined: JoinedMsg | null = null;
    map: MapData | null = null;
    /** set once the connection ended */
    disconnectReason: string | null = null;
    /**
     * Join token of the game connection (the `token` query parameter of the /play URL): it authenticates player
     * reports for this game (report.ts submitReport), also after the socket closed (M8)
     */
    joinToken: string | null = null;
    /** last measured round trip (ms), -1 before the first Pong */
    rttMs = -1;
    bytesDown = 0;
    bytesUp = 0;
    framesDown = 0;
    framesUp = 0;
    private ws: WebSocket | null = null;
    private readonly decoder = new ServerMsgDecoder();
    private readonly updateListeners: Array<Listener<UpdateMsg>> = [];
    private readonly messageListeners: Array<Listener<ServerMsg>> = [];
    private readonly disconnectListeners: Array<Listener<string>> = [];
    private joinWaiter: { resolve: (r: JoinResult) => void; reject: (e: Error) => void } | null = null;

    constructor(options: GameConnectionOptions = {}) {
        this.options = options;
    }

    get connected(): boolean {
        return this.ws !== null && this.disconnectReason === null;
    }

    /** Socket send buffer (bytes queued but not yet sent). */
    get bufferedAmount(): number {
        return this.ws?.bufferedAmount ?? 0;
    }

    onUpdate(cb: Listener<UpdateMsg>): void {
        this.updateListeners.push(cb);
    }

    /** Every decoded server message (Updates included). */
    onMessage(cb: Listener<ServerMsg>): void {
        this.messageListeners.push(cb);
    }

    /** Called once when the connection ends, with the server's reason or a client-side one. */
    onDisconnect(cb: Listener<string>): void {
        this.disconnectListeners.push(cb);
        if (this.disconnectReason !== null) cb(this.disconnectReason);
    }

    /** find_game, then connect and join. Resolves once Joined and Map arrived. */
    async connect(): Promise<JoinResult> {
        let res: FindGameResponse;
        try {
            res = await findGame(this.options.baseUrl ?? "", {
                mapName: this.options.mapName,
                region: this.options.region,
                teamMode: this.options.teamMode,
                autoFill: this.options.autoFill,
            });
        } catch (err) {
            const banned = err instanceof Error && err.message === "find_game failed: banned";
            this.end(banned ? DisconnectReason.Banned : DisconnectReason.FindGameFailed);
            throw err;
        }
        return this.connectTo(res.url);
    }

    /** Connects to a /play URL (with its token) and joins. */
    connectTo(url: string): Promise<JoinResult> {
        const Impl = this.options.WebSocketImpl ?? WebSocket;
        let ws: WebSocket;
        try {
            ws = new Impl(url);
        } catch (err) {
            this.end(DisconnectReason.ConnectionLost);
            return Promise.reject(err);
        }
        ws.binaryType = "arraybuffer";
        this.ws = ws;
        try {
            this.joinToken = new URL(url).searchParams.get("token");
        } catch {
            this.joinToken = null;
        }
        const timeoutMs = this.options.timeoutMs ?? 10_000;
        const result = new Promise<JoinResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                // rejects the waiter with the reason, then drops the socket
                this.end(DisconnectReason.JoinTimeout);
                if (ws.readyState <= 1) ws.close(1000);
            }, timeoutMs);
            this.joinWaiter = {
                resolve: (r) => {
                    clearTimeout(timer);
                    resolve(r);
                },
                reject: (e) => {
                    clearTimeout(timer);
                    reject(e);
                },
            };
        });
        ws.onopen = () => {
            this.send({
                type: MsgType.Join,
                protocol: this.options.protocol ?? PROTOCOL_HASH,
                name: this.options.name ?? "Player",
                useTouch: this.options.useTouch ?? false,
                isMobile: this.options.isMobile ?? false,
                bot: this.options.bot ?? false,
            });
        };
        ws.onmessage = (ev) => this.receive(ev.data);
        ws.onclose = (ev) => this.end(ev.reason || DisconnectReason.ConnectionLost);
        ws.onerror = () => {
            // a close event always follows
        };
        return result;
    }

    send(msg: ClientMsg): void {
        this.sendRaw(encodeClientMsg(msg));
    }

    /** Sends raw bytes (tests use it for malformed packets). */
    sendRaw(bytes: Uint8Array<ArrayBuffer>): void {
        const ws = this.ws;
        if (ws?.readyState !== 1 || this.disconnectReason !== null) return;
        ws.send(bytes);
        this.bytesUp += bytes.byteLength;
        this.framesUp++;
    }

    sendInput(input: PlayerInput): void {
        this.send({ type: MsgType.Input, input });
    }

    /** Sends an emote or ping request (M6a; the server throttles them). */
    sendEmote(emote: EmoteRequest): void {
        this.send({ type: MsgType.Emote, emote });
    }

    /** Sends a Cobalt class choice (M7a; the original PerkModeRoleSelect, ignored outside perk modes). */
    sendRoleSelect(role: string): void {
        this.send({ type: MsgType.PerkModeRoleSelect, role });
    }

    /** Drops an item: armour, a gun of slot `weapIdx`, the melee, the loot perk or bag items (M7b; DropItem). */
    sendDropItem(item: string, weapIdx = 0): void {
        this.send({ type: MsgType.DropItem, item, weapIdx });
    }

    /** Sends a Ping; `rttMs` updates when the Pong arrives. */
    ping(): void {
        this.send({ type: MsgType.Ping, nonce: Math.floor(performance.now()) >>> 0 });
    }

    close(): void {
        const ws = this.ws;
        this.end("closed");
        if (ws && ws.readyState <= 1) ws.close(1000);
    }

    private receive(data: unknown): void {
        if (this.disconnectReason !== null) return;
        if (!(data instanceof ArrayBuffer)) {
            this.fail("unexpected text frame");
            return;
        }
        this.bytesDown += data.byteLength;
        this.framesDown++;
        let msgs: ServerMsg[];
        try {
            msgs = this.decoder.decode(new Uint8Array(data));
        } catch (err) {
            this.fail(err instanceof ProtocolError ? err.message : String(err));
            return;
        }
        for (const msg of msgs) this.dispatch(msg);
    }

    private dispatch(msg: ServerMsg): void {
        switch (msg.type) {
            case MsgType.Joined:
                this.joined = msg;
                break;
            case MsgType.Map:
                this.map = msg.map;
                break;
            case MsgType.Pong:
                this.rttMs = ((Math.floor(performance.now()) >>> 0) - msg.nonce) >>> 0;
                break;
            case MsgType.Disconnect:
                this.end(msg.reason);
                break;
        }
        if (this.joinWaiter && this.joined && this.map) {
            const waiter = this.joinWaiter;
            this.joinWaiter = null;
            waiter.resolve({ joined: this.joined, map: this.map });
        }
        for (const cb of this.messageListeners) cb(msg);
        if (msg.type === MsgType.Update) for (const cb of this.updateListeners) cb(msg);
    }

    private fail(detail: string): void {
        console.warn(`game connection: invalid server packet (${detail})`);
        const ws = this.ws;
        this.end(DisconnectReason.InvalidPacket);
        ws?.close(1000);
    }

    private end(reason: string): void {
        if (this.disconnectReason !== null) return;
        this.disconnectReason = reason;
        if (this.joinWaiter) {
            const waiter = this.joinWaiter;
            this.joinWaiter = null;
            waiter.reject(new Error(`disconnected: ${reason}`));
        }
        for (const cb of this.disconnectListeners) cb(reason);
    }
}
