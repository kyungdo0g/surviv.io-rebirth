// The party lobby WebSocket (/team_v2, alias /team): JSON text messages, validated and rate limited, fed to the
// PartyLobby (party.ts). A socket that does not create or join a room within `joinTimeoutMs` is closed (survev 5 s).
import type { RawData, WebSocket } from "ws";
import {
    type PartyClientMsg as ClientMsg,
    PartyClientMsg,
    type PartyLobby,
    PartyMember,
    type PartyServerMsg,
} from "./party.ts";

/** Largest lobby message accepted, in bytes (survev teamMenu.ts: data.length < 1024). */
export const PARTY_MAX_MSG_BYTES = 1024;

export interface PartySocketLimits {
    /** messages per second before the socket is closed (survev 50) */
    maxMsgsPerSecond: number;
    /** time to create or join a room (survev 5 s) */
    joinTimeoutMs: number;
}

export class PartySocket {
    readonly member: PartyMember;
    closed = false;
    private readonly ws: WebSocket;
    private readonly lobby: PartyLobby;
    private readonly limits: PartySocketLimits;
    private readonly onClosed: (s: PartySocket) => void;
    private joinTimer: ReturnType<typeof setTimeout> | null;
    private windowStart = 0;
    private windowCount = 0;

    constructor(
        ws: WebSocket,
        lobby: PartyLobby,
        playBase: string,
        limits: PartySocketLimits,
        onClosed: (s: PartySocket) => void,
    ) {
        this.ws = ws;
        this.lobby = lobby;
        this.limits = limits;
        this.onClosed = onClosed;
        const peer = { send: (m: PartyServerMsg) => this.send(m), close: () => this.close() };
        this.member = new PartyMember(peer, Date.now(), playBase);
        ws.on("message", (data, isBinary) => this.onMessage(data, isBinary));
        ws.on("close", () => this.cleanup());
        ws.on("error", () => this.cleanup());
        this.joinTimer = setTimeout(() => {
            if (!this.member.room) this.close();
        }, limits.joinTimeoutMs);
    }

    send(msg: PartyServerMsg): void {
        if (this.closed || this.ws.readyState !== this.ws.OPEN) return;
        this.ws.send(JSON.stringify(msg));
    }

    /** Sends an error and closes (rate limits, malformed messages). */
    fail(type: "rate_limited" | "join_failed"): void {
        this.send({ type: "error", data: { type } });
        this.close();
    }

    close(): void {
        if (this.closed) return;
        this.cleanup();
        this.ws.close(1000);
    }

    private onMessage(data: RawData, isBinary: boolean): void {
        if (this.closed) return;
        const now = Date.now();
        if (now - this.windowStart >= 1000) {
            this.windowStart = now;
            this.windowCount = 0;
        }
        if (++this.windowCount > this.limits.maxMsgsPerSecond) {
            this.fail("rate_limited");
            return;
        }
        const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (isBinary || buf.byteLength >= PARTY_MAX_MSG_BYTES) {
            this.close();
            return;
        }
        const text = buf.toString("utf8");
        let msg: ClientMsg;
        try {
            msg = PartyClientMsg.parse(JSON.parse(text));
        } catch {
            // malformed messages close the socket (survev TeamMenu.onMsg)
            this.close();
            return;
        }
        this.lobby.handle(this.member, msg);
        if (this.member.room && this.joinTimer) {
            clearTimeout(this.joinTimer);
            this.joinTimer = null;
        }
    }

    private cleanup(): void {
        if (this.closed) return;
        this.closed = true;
        if (this.joinTimer) clearTimeout(this.joinTimer);
        this.joinTimer = null;
        this.lobby.remove(this.member);
        this.onClosed(this);
    }
}
