// Small fixed-layout messages: Join, Joined, Disconnect, Input, Ping/Pong and the later-milestone messages (Kill,
// GameOver, PlayerStats, AliveCounts, Spectate, RoleAnnouncement). Each `write*` writes the payload only (the
// frame helpers in codec.ts add the type byte and the byte alignment); each `read*` reads it back.
// Layouts follow the original 0.8.82 messages (docs/research/engine/netcode.md "Client → server messages" and
// "Server → client messages"); differences are noted per message.
import type { BitReader, BitWriter } from "@rebirth/core";
import type { EmoteRequest, PlayerInput } from "@rebirth/sim";
import { MsgType, NetLimits } from "./constants.ts";
import {
    clampUint,
    dequantize,
    quantize,
    readGameType,
    readMapType,
    readUnitVec,
    writeCount,
    writeGameType,
    writeMapType,
    writeUnitVec,
} from "./quant.ts";

/** Client -> server, first message on a connection. survev layout minus the token (it is in the /play URL). */
export interface JoinMsg {
    type: typeof MsgType.Join;
    /** must equal PROTOCOL_HASH; read before anything else so a stale client gets `invalid_protocol` */
    protocol: number;
    /** at most 16 UTF-8 bytes (longer names are truncated by the writer and rejected by the reader) */
    name: string;
    useTouch: boolean;
    isMobile: boolean;
    bot: boolean;
}

export function writeJoin(w: BitWriter, m: JoinMsg): void {
    w.writeUint32(m.protocol >>> 0);
    w.writeString(m.name, NetLimits.PlayerNameMaxBytes);
    w.writeBoolean(m.useTouch);
    w.writeBoolean(m.isMobile);
    w.writeBoolean(m.bot);
}

export function readJoin(r: BitReader): JoinMsg {
    const protocol = r.readUint32();
    const name = r.readString(NetLimits.PlayerNameMaxBytes);
    return {
        type: MsgType.Join,
        protocol,
        name,
        useTouch: r.readBoolean(),
        isMobile: r.readBoolean(),
        bot: r.readBoolean(),
    };
}

/** Server -> client after a successful join (original layout: teamMode u8, playerId u16, started, emotes). */
export interface JoinedMsg {
    type: typeof MsgType.Joined;
    teamMode: number;
    playerId: number;
    started: boolean;
    /** emote loadout (GameObjectDefs ids) */
    emotes: string[];
}

export function writeJoined(w: BitWriter, m: JoinedMsg): void {
    w.writeUint8(m.teamMode);
    w.writeUint16(m.playerId);
    w.writeBoolean(m.started);
    writeCount(w, m.emotes.length, 8);
    for (const e of m.emotes) writeGameType(w, e);
}

export function readJoined(r: BitReader): JoinedMsg {
    const teamMode = r.readUint8();
    const playerId = r.readUint16();
    const started = r.readBoolean();
    const emotes: string[] = [];
    for (let n = r.readBits(8); n > 0; n--) emotes.push(readGameType(r));
    return { type: MsgType.Joined, teamMode, playerId, started, emotes };
}

/** Server -> client before the server closes the socket (0.8.82 layout: reason string). */
export interface DisconnectMsg {
    type: typeof MsgType.Disconnect;
    reason: string;
}

export function writeDisconnect(w: BitWriter, m: DisconnectMsg): void {
    w.writeString(m.reason, NetLimits.DisconnectReasonMaxBytes);
}

export function readDisconnect(r: BitReader): DisconnectMsg {
    return { type: MsgType.Disconnect, reason: r.readString(NetLimits.DisconnectReasonMaxBytes) };
}

/** Rebirth Ping/Pong: the server echoes `nonce` (the client's clock in ms, mod 2^32) at once. */
export interface PingMsg {
    type: typeof MsgType.Ping;
    nonce: number;
}

export interface PongMsg {
    type: typeof MsgType.Pong;
    nonce: number;
}

/**
 * Client -> server input (original layout minus the touch fields): seq u8, 4 move flags, shootStart, shootHold,
 * toMouseDir unit vec 10+10, toMouseLen 0..64 in 8 bits, actions (4-bit count of u8), then (M5) a useItem bit and,
 * when set, the item as a game type (the original always sends the game type, "" for none).
 */
export interface InputMsg {
    type: typeof MsgType.Input;
    input: PlayerInput;
}

const MOUSE_DIR_BITS = 10;
const MOUSE_LEN_BITS = 8;

export function writeInput(w: BitWriter, input: PlayerInput): void {
    w.writeUint8(input.seq & 0xff);
    w.writeBoolean(input.moveLeft);
    w.writeBoolean(input.moveRight);
    w.writeBoolean(input.moveUp);
    w.writeBoolean(input.moveDown);
    w.writeBoolean(input.shootStart);
    w.writeBoolean(input.shootHold);
    writeUnitVec(w, input.toMouseDir, MOUSE_DIR_BITS);
    w.writeBits(quantize(input.toMouseLen, 0, NetLimits.MouseMaxDist, MOUSE_LEN_BITS), MOUSE_LEN_BITS);
    const n = Math.min(input.actions.length, NetLimits.MaxInputActions);
    w.writeBits(n, 4);
    for (let i = 0; i < n; i++) w.writeUint8(clampUint(input.actions[i], 8));
    const useItem = input.useItem ?? "";
    w.writeBoolean(useItem !== "");
    if (useItem !== "") writeGameType(w, useItem);
}

/** Decoded input; `toMouseDir` is renormalized but values are otherwise raw (servers still validate). */
export function readInput(r: BitReader): PlayerInput {
    const seq = r.readUint8();
    const moveLeft = r.readBoolean();
    const moveRight = r.readBoolean();
    const moveUp = r.readBoolean();
    const moveDown = r.readBoolean();
    const shootStart = r.readBoolean();
    const shootHold = r.readBoolean();
    const toMouseDir = readUnitVec(r, MOUSE_DIR_BITS);
    const toMouseLen = dequantize(r.readBits(MOUSE_LEN_BITS), 0, NetLimits.MouseMaxDist, MOUSE_LEN_BITS);
    const actions: number[] = [];
    for (let n = r.readBits(4); n > 0; n--) actions.push(r.readUint8());
    const input: PlayerInput = {
        seq,
        moveLeft,
        moveRight,
        moveUp,
        moveDown,
        toMouseDir,
        toMouseLen,
        shootStart,
        shootHold,
        actions,
    };
    if (r.readBoolean()) input.useItem = readGameType(r);
    return input;
}

/**
 * Client -> server emote or ping request (M6a; original layout: pos vec 0..1024 16+16 bits, type game type, isPing
 * bit; teams.ts writeEmoteRequest). The position matters for pings only.
 */
export interface EmoteMsg {
    type: typeof MsgType.Emote;
    emote: EmoteRequest;
}

/** Client -> server spectate request (survev layout: action u8, see SpectateAction). */
export interface SpectateMsg {
    type: typeof MsgType.Spectate;
    action: number;
}

/** Server -> client alive player/team counts (array(8) of u8; 2 entries in 50v50). */
export interface AliveCountsMsg {
    type: typeof MsgType.AliveCounts;
    teamAliveCounts: number[];
}

export function writeAliveCounts(w: BitWriter, m: AliveCountsMsg): void {
    writeCount(w, m.teamAliveCounts.length, 8);
    for (const c of m.teamAliveCounts) w.writeUint8(clampUint(c, 8));
}

export function readAliveCounts(r: BitReader): AliveCountsMsg {
    const teamAliveCounts: number[] = [];
    for (let n = r.readBits(8); n > 0; n--) teamAliveCounts.push(r.readUint8());
    return { type: MsgType.AliveCounts, teamAliveCounts };
}

/** Server -> every client: a player was downed or killed (original layout). */
export interface KillMsg {
    type: typeof MsgType.Kill;
    /** DamageType (defs constants) */
    damageType: number;
    /** GameObjectDefs id of the weapon (or "") */
    itemSourceType: string;
    /** MapObjectDefs id of the obstacle (e.g. a barrel) or "" */
    mapSourceType: string;
    targetId: number;
    killerId: number;
    killCreditId: number;
    killerKills: number;
    downed: boolean;
    killed: boolean;
}

export function writeKill(w: BitWriter, m: KillMsg): void {
    w.writeUint8(m.damageType);
    writeGameType(w, m.itemSourceType);
    writeMapType(w, m.mapSourceType);
    w.writeUint16(m.targetId);
    w.writeUint16(m.killerId);
    w.writeUint16(m.killCreditId);
    w.writeUint8(clampUint(m.killerKills, 8));
    w.writeBoolean(m.downed);
    w.writeBoolean(m.killed);
}

export function readKill(r: BitReader): KillMsg {
    return {
        type: MsgType.Kill,
        damageType: r.readUint8(),
        itemSourceType: readGameType(r),
        mapSourceType: readMapType(r),
        targetId: r.readUint16(),
        killerId: r.readUint16(),
        killCreditId: r.readUint16(),
        killerKills: r.readUint8(),
        downed: r.readBoolean(),
        killed: r.readBoolean(),
    };
}

/** End-of-life stats of one player (integers; survev rounds damage before writing). */
export interface PlayerStatsData {
    playerId: number;
    /** seconds */
    timeAlive: number;
    kills: number;
    dead: boolean;
    damageDealt: number;
    damageTaken: number;
}

export interface PlayerStatsMsg {
    type: typeof MsgType.PlayerStats;
    stats: PlayerStatsData;
}

function writeStats(w: BitWriter, s: PlayerStatsData): void {
    w.writeUint16(s.playerId);
    w.writeUint16(clampUint(Math.round(s.timeAlive), 16));
    w.writeUint8(clampUint(s.kills, 8));
    w.writeUint8(s.dead ? 1 : 0);
    w.writeUint16(clampUint(Math.round(s.damageDealt), 16));
    w.writeUint16(clampUint(Math.round(s.damageTaken), 16));
}

function readStats(r: BitReader): PlayerStatsData {
    return {
        playerId: r.readUint16(),
        timeAlive: r.readUint16(),
        kills: r.readUint8(),
        dead: r.readUint8() !== 0,
        damageDealt: r.readUint16(),
        damageTaken: r.readUint16(),
    };
}

export function writePlayerStats(w: BitWriter, m: PlayerStatsMsg): void {
    writeStats(w, m.stats);
}

export function readPlayerStats(r: BitReader): PlayerStatsMsg {
    return { type: MsgType.PlayerStats, stats: readStats(r) };
}

/** Server -> dying player (and spectators): final result (original layout). */
export interface GameOverMsg {
    type: typeof MsgType.GameOver;
    teamId: number;
    teamRank: number;
    gameOver: boolean;
    winningTeamId: number;
    playerStats: PlayerStatsData[];
}

export function writeGameOver(w: BitWriter, m: GameOverMsg): void {
    w.writeUint8(m.teamId);
    w.writeUint8(m.teamRank);
    w.writeUint8(m.gameOver ? 1 : 0);
    w.writeUint8(m.winningTeamId);
    writeCount(w, m.playerStats.length, 8);
    for (const s of m.playerStats) writeStats(w, s);
}

export function readGameOver(r: BitReader): GameOverMsg {
    const teamId = r.readUint8();
    const teamRank = r.readUint8();
    const gameOver = r.readUint8() !== 0;
    const winningTeamId = r.readUint8();
    const playerStats: PlayerStatsData[] = [];
    for (let n = r.readBits(8); n > 0; n--) playerStats.push(readStats(r));
    return { type: MsgType.GameOver, teamId, teamRank, gameOver, winningTeamId, playerStats };
}

/** Server -> every client: a role was assigned or its holder killed (original layout). */
export interface RoleAnnouncementMsg {
    type: typeof MsgType.RoleAnnouncement;
    playerId: number;
    killerId: number;
    /** GameObjectDefs role id */
    role: string;
    assigned: boolean;
    killed: boolean;
}

export function writeRoleAnnouncement(w: BitWriter, m: RoleAnnouncementMsg): void {
    w.writeUint16(m.playerId);
    w.writeUint16(m.killerId);
    writeGameType(w, m.role);
    w.writeBoolean(m.assigned);
    w.writeBoolean(m.killed);
}

export function readRoleAnnouncement(r: BitReader): RoleAnnouncementMsg {
    return {
        type: MsgType.RoleAnnouncement,
        playerId: r.readUint16(),
        killerId: r.readUint16(),
        role: readGameType(r),
        assigned: r.readBoolean(),
        killed: r.readBoolean(),
    };
}
