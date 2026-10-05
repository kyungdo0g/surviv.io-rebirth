// Framing and message dispatch. A WebSocket frame is a sequence of messages, each `u8 type` + payload padded to a
// byte boundary; the reader stops at the end of the frame or at a None (0) type byte (survev net.ts MsgStream,
// docs/research/engine/netcode.md "Message framing").
import { BitReader, BitWriter } from "@rebirth/core";
import {
    damageSourceOf,
    type GameOverEvent,
    type KillEvent,
    type MapData,
    type PlayerStatsView,
    type RoleAnnouncementEvent,
} from "@rebirth/sim";
import { MsgType } from "./constants.ts";
import { type MapMsg, readMap, writeMap } from "./map.ts";
import {
    type AliveCountsMsg,
    type DisconnectMsg,
    type EmoteMsg,
    type GameOverMsg,
    type InputMsg,
    type JoinedMsg,
    type JoinMsg,
    type KillMsg,
    type PingMsg,
    type PlayerStatsMsg,
    type PongMsg,
    type RoleAnnouncementMsg,
    readAliveCounts,
    readDisconnect,
    readGameOver,
    readInput,
    readJoin,
    readJoined,
    readKill,
    readPlayerStats,
    readRoleAnnouncement,
    type SpectateMsg,
    writeAliveCounts,
    writeDisconnect,
    writeGameOver,
    writeInput,
    writeJoin,
    writeJoined,
    writeKill,
    writePlayerStats,
    writeRoleAnnouncement,
} from "./messages.ts";
import { readGameType, writeGameType } from "./quant.ts";
import { readEmoteRequest, writeEmoteRequest } from "./teams.ts";
import { UpdateDecoder, type UpdateMsg } from "./update.ts";

/** Client -> server Cobalt class choice (the original PerkModeRoleSelect: role game type, 6 pad bits) (M7a). */
export interface PerkModeRoleSelectMsg {
    type: typeof MsgType.PerkModeRoleSelect;
    role: string;
}

/** Messages a client sends. */
export type ClientMsg = JoinMsg | InputMsg | PingMsg | SpectateMsg | EmoteMsg | PerkModeRoleSelectMsg;

/** Stateless server messages (Update is written by a ClientEncoder, Map by `writeMapMsg`). */
export type ServerSimpleMsg =
    | JoinedMsg
    | DisconnectMsg
    | PongMsg
    | KillMsg
    | GameOverMsg
    | PlayerStatsMsg
    | AliveCountsMsg
    | RoleAnnouncementMsg;

/** Every message a client can receive. */
export type ServerMsg = ServerSimpleMsg | MapMsg | UpdateMsg;

/** Thrown for malformed frames (servers answer with `invalid_packet`). */
export class ProtocolError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "ProtocolError";
    }
}

/** Appends one client message to `w`. */
export function writeClientMsg(w: BitWriter, msg: ClientMsg): void {
    w.alignToNextByte();
    w.writeUint8(msg.type);
    switch (msg.type) {
        case MsgType.Join:
            writeJoin(w, msg);
            break;
        case MsgType.Input:
            writeInput(w, msg.input);
            break;
        case MsgType.Ping:
            w.writeUint32(msg.nonce >>> 0);
            break;
        case MsgType.Spectate:
            w.writeUint8(msg.action);
            break;
        case MsgType.Emote:
            writeEmoteRequest(w, msg.emote);
            break;
        case MsgType.PerkModeRoleSelect:
            writeGameType(w, msg.role);
            break;
    }
    w.alignToNextByte();
}

export function encodeClientMsg(msg: ClientMsg): Uint8Array<ArrayBuffer> {
    const w = new BitWriter(32);
    writeClientMsg(w, msg);
    return w.getBuffer();
}

/** Appends one stateless server message to `w`. */
export function writeServerMsg(w: BitWriter, msg: ServerSimpleMsg): void {
    w.alignToNextByte();
    w.writeUint8(msg.type);
    switch (msg.type) {
        case MsgType.Joined:
            writeJoined(w, msg);
            break;
        case MsgType.Disconnect:
            writeDisconnect(w, msg);
            break;
        case MsgType.Pong:
            w.writeUint32(msg.nonce >>> 0);
            break;
        case MsgType.Kill:
            writeKill(w, msg);
            break;
        case MsgType.GameOver:
            writeGameOver(w, msg);
            break;
        case MsgType.PlayerStats:
            writePlayerStats(w, msg);
            break;
        case MsgType.AliveCounts:
            writeAliveCounts(w, msg);
            break;
        case MsgType.RoleAnnouncement:
            writeRoleAnnouncement(w, msg);
            break;
    }
    w.alignToNextByte();
}

export function encodeServerMsg(msg: ServerSimpleMsg): Uint8Array<ArrayBuffer> {
    const w = new BitWriter(64);
    writeServerMsg(w, msg);
    return w.getBuffer();
}

/** Appends a Map message to `w`. */
export function writeMapMsg(w: BitWriter, map: MapData): void {
    w.alignToNextByte();
    w.writeUint8(MsgType.Map);
    writeMap(w, map);
    w.alignToNextByte();
}

/** A Map message as bytes (servers build it once per game and copy it into every join frame). */
export function encodeMapMsg(map: MapData): Uint8Array<ArrayBuffer> {
    const w = new BitWriter(32 * 1024);
    writeMapMsg(w, map);
    return w.getBuffer();
}

function readFrame<T>(bytes: Uint8Array, readOne: (type: number, r: BitReader) => T): T[] {
    const r = new BitReader(bytes);
    const out: T[] = [];
    try {
        while (r.bitsLeft >= 8) {
            const type = r.readUint8();
            if (type === MsgType.None) break;
            out.push(readOne(type, r));
            r.alignToNextByte();
        }
    } catch (err) {
        if (err instanceof ProtocolError) throw err;
        throw new ProtocolError(`malformed frame: ${(err as Error).message}`, { cause: err });
    }
    return out;
}

/**
 * The protocol field of a frame that starts with a Join message, or null. Servers check it before decoding the
 * rest, so a client built for another protocol gets `invalid_protocol` instead of a decode error.
 */
export function peekJoinProtocol(bytes: Uint8Array): number | null {
    if (bytes.length < 5 || bytes[0] !== MsgType.Join) return null;
    return (bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0;
}

/** Decodes a client frame (server side); throws ProtocolError on anything malformed or unexpected. */
export function decodeClientFrame(bytes: Uint8Array): ClientMsg[] {
    return readFrame<ClientMsg>(bytes, (type, r) => {
        switch (type) {
            case MsgType.Join:
                return readJoin(r);
            case MsgType.Input:
                return { type: MsgType.Input, input: readInput(r) };
            case MsgType.Ping:
                return { type: MsgType.Ping, nonce: r.readUint32() };
            case MsgType.Spectate:
                return { type: MsgType.Spectate, action: r.readUint8() };
            case MsgType.Emote:
                return { type: MsgType.Emote, emote: readEmoteRequest(r) };
            case MsgType.PerkModeRoleSelect:
                return { type: MsgType.PerkModeRoleSelect, role: readGameType(r) };
            default:
                throw new ProtocolError(`unexpected client message type ${type}`);
        }
    });
}

/** A Kill message as the simulation's KillEvent (the damage source is derived from the defs). */
export function killEventOf(m: KillMsg): KillEvent {
    return {
        targetId: m.targetId,
        killerId: m.killerId,
        killCreditId: m.killCreditId,
        killerKills: m.killerKills,
        damageType: m.damageType,
        source: damageSourceOf(m.damageType, m.itemSourceType, m.mapSourceType),
        itemSourceType: m.itemSourceType,
        mapSourceType: m.mapSourceType,
        downed: m.downed,
        killed: m.killed,
    };
}

/**
 * Client-side decoder: Map messages set up the map extent and a fresh UpdateDecoder, Updates are applied to its
 * object cache. The event messages of a frame (Kill, RoleAnnouncement, GameOver, PlayerStats) and the latest
 * AliveCounts are attached to the frame's Update snapshot (`kills`, `roleAnnouncements`, `gameOver`,
 * `playerStats`, `aliveCount`), so decoded snapshots equal Game.getSnapshot. One instance per connection.
 */
export class ServerMsgDecoder {
    private updates: UpdateDecoder | null = null;
    private aliveCount = 0;
    /** 50v50: living players per faction (AliveCounts with two entries, M7a) */
    private teamAliveCounts: number[] | null = null;
    private kills: KillEvent[] = [];
    private roles: RoleAnnouncementEvent[] = [];
    private gameOver: GameOverEvent | null = null;
    private playerStats: PlayerStatsView | null = null;

    /** `ctx`: start with this map extent instead of waiting for a Map message (tests). */
    constructor(ctx?: { width: number; height: number }) {
        if (ctx) this.updates = new UpdateDecoder(ctx);
    }

    /** Decodes a server frame; throws ProtocolError on anything malformed. */
    decode(bytes: Uint8Array): ServerMsg[] {
        const msgs = readFrame<ServerMsg>(bytes, (type, r) => this.readOne(type, r));
        let last: UpdateMsg | null = null;
        for (const msg of msgs) {
            switch (msg.type) {
                case MsgType.AliveCounts:
                    this.aliveCount = msg.teamAliveCounts.reduce((a, b) => a + b, 0);
                    this.teamAliveCounts = msg.teamAliveCounts.length > 1 ? [...msg.teamAliveCounts] : null;
                    break;
                case MsgType.Kill:
                    this.kills.push(killEventOf(msg));
                    break;
                case MsgType.RoleAnnouncement:
                    this.roles.push({
                        playerId: msg.playerId,
                        killerId: msg.killerId,
                        role: msg.role,
                        assigned: msg.assigned,
                        killed: msg.killed,
                    });
                    break;
                case MsgType.GameOver:
                    this.gameOver = {
                        teamId: msg.teamId,
                        teamRank: msg.teamRank,
                        gameOver: msg.gameOver,
                        winningTeamId: msg.winningTeamId,
                        playerStats: msg.playerStats.map((p) => ({ ...p })),
                    };
                    break;
                case MsgType.PlayerStats:
                    this.playerStats = { ...msg.stats };
                    break;
                case MsgType.Update:
                    msg.snapshot.kills = [];
                    msg.snapshot.roleAnnouncements = [];
                    last = msg;
                    break;
            }
        }
        for (const msg of msgs) {
            if (msg.type !== MsgType.Update) continue;
            msg.snapshot.aliveCount = this.aliveCount;
            if (this.teamAliveCounts) msg.snapshot.teamAliveCounts = [...this.teamAliveCounts];
        }
        if (last) {
            // events of a frame belong to its update (they may follow it, as in the original frame order)
            const snap = last.snapshot;
            snap.kills = this.kills;
            snap.roleAnnouncements = this.roles;
            if (this.gameOver) snap.gameOver = this.gameOver;
            if (this.playerStats) snap.playerStats = this.playerStats;
            this.kills = [];
            this.roles = [];
            this.gameOver = null;
            this.playerStats = null;
        }
        return msgs;
    }

    private readOne(type: number, r: BitReader): ServerMsg {
        switch (type) {
            case MsgType.Joined:
                return readJoined(r);
            case MsgType.Map: {
                const map = readMap(r);
                this.updates = new UpdateDecoder({ width: map.width, height: map.height });
                return { type: MsgType.Map, map };
            }
            case MsgType.Update:
                if (!this.updates) throw new ProtocolError("Update before Map");
                return this.updates.read(r);
            case MsgType.Disconnect:
                return readDisconnect(r);
            case MsgType.Pong:
                return { type: MsgType.Pong, nonce: r.readUint32() };
            case MsgType.Kill:
                return readKill(r);
            case MsgType.GameOver:
                return readGameOver(r);
            case MsgType.PlayerStats:
                return readPlayerStats(r);
            case MsgType.AliveCounts:
                return readAliveCounts(r);
            case MsgType.RoleAnnouncement:
                return readRoleAnnouncement(r);
            default:
                throw new ProtocolError(`unexpected server message type ${type}`);
        }
    }
}
