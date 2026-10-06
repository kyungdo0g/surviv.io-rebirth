// Shared helpers for the server tests: a raw WebSocket probe and lookups into the running server.
import { MsgType, type ServerMsg, ServerMsgDecoder } from "@rebirth/protocol";
import type { GameRoom } from "../src/room.ts";
import type { RunningServer } from "../src/server.ts";

export interface RawSocket {
    ws: WebSocket;
    messages: ServerMsg[];
    opened: Promise<void>;
    /** the Disconnect reason, or the close reason / "closed:<code>" when none was sent */
    ended: Promise<string>;
}

/** A bare WebSocket to `url` that decodes what the server sends but sends nothing by itself. */
export function rawSocket(url: string): RawSocket {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const decoder = new ServerMsgDecoder();
    const messages: ServerMsg[] = [];
    let reason: string | null = null;
    const opened = new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("socket error"));
    });
    opened.catch(() => {});
    const ended = new Promise<string>((resolve) => {
        ws.onclose = (ev) => resolve(reason ?? (ev.reason || `closed:${ev.code}`));
    });
    ws.onmessage = (ev) => {
        for (const msg of decoder.decode(new Uint8Array(ev.data as ArrayBuffer))) {
            messages.push(msg);
            if (msg.type === MsgType.Disconnect) reason = msg.reason;
        }
    };
    return { ws, messages, opened, ended };
}

export async function findGame(base: string, body: object = {}): Promise<{ url: string; token: string }> {
    const res = await fetch(`${base}/api/find_game`, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`find_game ${res.status}`);
    return (await res.json()) as { url: string; token: string };
}

/** The room hosting `playerId`. */
/**
 * The room of a joined player. Player ids are per game, so two rooms can hold the same id: the player's session
 * decides (narrowed by `name` when given), and an id that is still ambiguous throws instead of guessing.
 */
export function roomOf(server: RunningServer, playerId: number, name?: string): GameRoom {
    const bySession = new Set<GameRoom>();
    for (const s of server.sessions) {
        if (s.playerId === playerId && s.room && (name === undefined || s.name === name)) bySession.add(s.room);
    }
    if (bySession.size === 1) return [...bySession][0];
    const rooms = [...server.host.rooms.values()].filter(
        (room) => room.game.getPlayer(playerId) && (name === undefined || room.game.getPlayer(playerId)?.name === name),
    );
    if (rooms.length === 1) return rooms[0];
    throw new Error(`player ${playerId} is in ${rooms.length === 0 ? "no room" : `${rooms.length} rooms`}`);
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Polls `cond` until true or the timeout elapses. */
export async function until(cond: () => boolean, timeoutMs = 3000, what = "condition"): Promise<void> {
    const end = Date.now() + timeoutMs;
    while (!cond()) {
        if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
        await sleep(10);
    }
}
