// One game WebSocket: token check, Join (protocol hash first), Input validation, Ping/Pong, Spectate, Emote (M6a),
// per-socket message rate limit, and Disconnect + close for every failure (survev client.ts / gameProcess.ts).
// M8: Join checks the bans (address and name; DisconnectReason.Banned), passes the name through the name filter,
// registers the join token as the player's credential for reports, and hands the Join's isMobile flag to the game (touch
// clients: mobile zoom, loot reach, auto loot).
import { BitWriter } from "@rebirth/core";
import { PROTOCOL_HASH } from "@rebirth/defs";
import {
    CLOSE_CODE_DISCONNECT,
    type ClientMsg,
    DisconnectReason,
    decodeClientFrame,
    MsgType,
    NetLimits,
    peekJoinProtocol,
    type ServerSimpleMsg,
    spectateActionName,
    writeServerMsg,
} from "@rebirth/protocol";
import type { RawData, WebSocket } from "ws";
import type { ServerConfig } from "./config.ts";
import type { GameHost } from "./host.ts";
import { sanitizeInput } from "./input.ts";
import type { Moderation } from "./moderation/index.ts";
import type { GameRoom, RoomMember } from "./room.ts";
import type { JoinTicket } from "./tokens.ts";

/** Visible name: control characters removed, trimmed, "Player" when empty (the reader caps it at 16 bytes). */
export function sanitizeName(name: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
    const clean = name.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
    return clean || "Player";
}

type SessionState = "connecting" | "joined" | "closed";

export class ClientSession implements RoomMember {
    readonly ip: string;
    state: SessionState = "connecting";
    ack = 0;
    playerId = 0;
    /** the name the player chose (before the name filter; bans match it), "" before Join */
    name = "";
    room: GameRoom | null = null;
    bytesDown = 0;
    bytesUp = 0;
    /** answered the last WebSocket-level ping (heartbeat) */
    alive = true;
    private readonly ws: WebSocket;
    private readonly host: GameHost;
    private readonly config: ServerConfig;
    private readonly onClosed: (s: ClientSession) => void;
    private readonly moderation: Moderation;
    /** the join token this socket presented (the player's report credential, M8) */
    private readonly token: string | null;
    private ticket: JoinTicket | null;
    /** this socket keeps its token's room open until Join (GameHost.holdConnecting) */
    private holding = false;
    private joinTimer: ReturnType<typeof setTimeout> | null = null;
    private windowStart = 0;
    private windowCount = 0;
    private dir = { x: 1, y: 0 };

    constructor(
        ws: WebSocket,
        ip: string,
        token: string | null,
        deps: { host: GameHost; config: ServerConfig; moderation: Moderation; onClosed: (s: ClientSession) => void },
    ) {
        this.ws = ws;
        this.ip = ip;
        this.host = deps.host;
        this.config = deps.config;
        this.moderation = deps.moderation;
        this.onClosed = deps.onClosed;
        this.token = token;
        this.ticket = token ? this.host.tokens.consumeTicket(token) : null;
        if (this.ticket) {
            this.host.holdConnecting(this.ticket.gameId);
            this.holding = true;
        }
        ws.on("message", (data, isBinary) => this.onMessage(data, isBinary));
        ws.on("close", () => this.cleanup());
        ws.on("error", () => this.cleanup());
        ws.on("pong", () => {
            this.alive = true;
        });
        if (this.ticket === null) {
            this.disconnect(DisconnectReason.InvalidToken);
            return;
        }
        this.joinTimer = setTimeout(() => this.disconnect(DisconnectReason.JoinTimeout), this.config.joinTimeoutMs);
    }

    get bufferedAmount(): number {
        return this.ws.bufferedAmount;
    }

    get closed(): boolean {
        return this.state === "closed";
    }

    sendFrame(bytes: Uint8Array): void {
        if (this.state === "closed" || this.ws.readyState !== this.ws.OPEN) return;
        this.ws.send(bytes);
        this.bytesDown += bytes.length;
    }

    send(msg: ServerSimpleMsg): void {
        const w = new BitWriter(64);
        writeServerMsg(w, msg);
        this.sendFrame(w.getBuffer());
    }

    /** Sends a Disconnect message and closes the socket with the same reason. */
    disconnect(reason: string): void {
        if (this.state === "closed") return;
        this.send({ type: MsgType.Disconnect, reason });
        this.cleanup();
        this.ws.close(CLOSE_CODE_DISCONNECT, reason);
    }

    /** Heartbeat: terminates a socket that did not answer the previous ping. */
    heartbeat(): void {
        if (this.state === "closed") return;
        if (!this.alive) {
            this.cleanup();
            this.ws.terminate();
            return;
        }
        this.alive = false;
        this.ws.ping();
    }

    private onMessage(data: RawData, isBinary: boolean): void {
        if (this.state === "closed") return;
        const now = Date.now();
        if (now - this.windowStart >= 1000) {
            this.windowStart = now;
            this.windowCount = 0;
        }
        if (++this.windowCount > this.config.maxMsgsPerSecond) {
            this.disconnect(DisconnectReason.RateLimited);
            return;
        }
        const bytes = toBytes(data);
        this.bytesUp += bytes.length;
        if (!isBinary || bytes.length > NetLimits.MaxClientMsgBytes) {
            this.disconnect(DisconnectReason.InvalidPacket);
            return;
        }
        if (this.state === "connecting") {
            const protocol = peekJoinProtocol(bytes);
            if (protocol !== null && protocol !== PROTOCOL_HASH) {
                this.disconnect(DisconnectReason.InvalidProtocol);
                return;
            }
        }
        let msgs: ClientMsg[];
        try {
            msgs = decodeClientFrame(bytes);
        } catch {
            this.disconnect(DisconnectReason.InvalidPacket);
            return;
        }
        for (const msg of msgs) {
            // a message may have closed the session (e.g. an Input before Join)
            if (this.closed) return;
            this.handle(msg);
        }
    }

    private handle(msg: ClientMsg): void {
        switch (msg.type) {
            case MsgType.Join:
                this.join(msg.name, msg.isMobile);
                break;
            case MsgType.Input: {
                if (this.state !== "joined" || !this.room) {
                    this.disconnect(DisconnectReason.InvalidPacket);
                    return;
                }
                const input = sanitizeInput(msg.input, this.dir);
                this.dir = input.toMouseDir;
                this.ack = input.seq;
                this.room.setInput(this.playerId, input);
                break;
            }
            case MsgType.Ping:
                this.send({ type: MsgType.Pong, nonce: msg.nonce });
                break;
            case MsgType.Spectate: {
                if (this.state !== "joined" || !this.room) {
                    this.disconnect(DisconnectReason.InvalidPacket);
                    return;
                }
                const action = spectateActionName(msg.action);
                if (action) this.room.spectate(this.playerId, action);
                break;
            }
            case MsgType.Emote:
                if (this.state !== "joined" || !this.room) {
                    this.disconnect(DisconnectReason.InvalidPacket);
                    return;
                }
                this.room.emote(this.playerId, msg.emote);
                break;
            case MsgType.PerkModeRoleSelect:
                if (this.state !== "joined" || !this.room) {
                    this.disconnect(DisconnectReason.InvalidPacket);
                    return;
                }
                this.room.selectRole(this.playerId, msg.role);
                break;
            case MsgType.DropItem:
                if (this.state !== "joined" || !this.room) {
                    this.disconnect(DisconnectReason.InvalidPacket);
                    return;
                }
                this.room.dropItem(this.playerId, msg.item, msg.weapIdx);
                break;
        }
    }

    private join(name: string, isMobile: boolean): void {
        if (this.state !== "connecting" || this.ticket === null) {
            this.disconnect(DisconnectReason.InvalidPacket);
            return;
        }
        this.releaseHold();
        const chosen = sanitizeName(name);
        const ban = this.moderation.bans.check(this.ip, chosen);
        if (ban) {
            if (this.config.log) console.log(`refused banned ${ban.type} ${ban.value} (${this.ip}, "${chosen}")`);
            this.disconnect(DisconnectReason.Banned);
            return;
        }
        const room = this.host.getRoom(this.ticket.gameId);
        if (!room) {
            this.disconnect(DisconnectReason.GameClosed);
            return;
        }
        if (room.isFull) {
            this.disconnect(DisconnectReason.Full);
            return;
        }
        if (room.game.over) {
            this.disconnect(DisconnectReason.GameClosed);
            return;
        }
        if (this.joinTimer) clearTimeout(this.joinTimer);
        this.joinTimer = null;
        this.name = chosen;
        const shown = this.moderation.names.filter(chosen);
        const { playerId, frame } = room.join(this, shown, { ...this.ticket.group, isMobile: isMobile === true });
        this.room = room;
        this.playerId = playerId;
        this.state = "joined";
        if (this.token)
            this.moderation.sessions.register(this.token, { gameId: room.id, playerId, name: shown, ip: this.ip });
        this.sendFrame(frame);
        if (this.config.log) console.log(`player ${playerId} joined game ${room.id} from ${this.ip}`);
    }

    /** Drops this socket's hold on its token's room (once: at Join or when the socket closes before it). */
    private releaseHold(): void {
        if (this.holding && this.ticket) this.host.releaseConnecting(this.ticket.gameId);
        this.holding = false;
    }

    private cleanup(): void {
        if (this.state === "closed") return;
        this.releaseHold();
        const wasJoined = this.state === "joined";
        this.state = "closed";
        if (this.joinTimer) clearTimeout(this.joinTimer);
        this.joinTimer = null;
        if (wasJoined && this.room) {
            this.room.leave(this.playerId, Date.now());
            if (this.config.log) console.log(`player ${this.playerId} left game ${this.room.id}`);
        }
        this.onClosed(this);
    }
}

function toBytes(data: RawData): Uint8Array {
    if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
