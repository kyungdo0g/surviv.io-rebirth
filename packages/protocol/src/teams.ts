// Update message sections of M6a (team modes, emotes and pings), announced by the extended flags word after the M5
// sections, and the client's Emote message. Layouts follow the original PlayerStatus, GroupStatus and Emotes sections
// and the Emote message (netcode.md "Update message", "Client → server messages"); differences are noted per
// section. Team status records carry the player id (the original relied on the client's own group list).
//
//   PlayerStatus: u8 count x {playerId u16, hasData bit (always 1), pos 11+11 bits over the map extent (the original
//                 used 0..1024), visible bit, dead bit, downed bit, hasRole bit [+ role game type]}, align
//   GroupStatus:  u8 count x {playerId u16, health float 0..100 7 bits, disconnected bit}, align
//   Emotes:       u8 count x {playerId u16, type game type, itemType game type, isPing bit [+ pos mapPos], align}
//                 (original record)
//   Emote (client -> server): pos vec 0..1024 16+16 bits, type game type, isPing bit (original layout)
//   FactionStatus (M7a, 50v50): u8 count x {playerId u16, pos 11+11 bits, dead bit, downed bit, hasRole bit [+ role game
//                 type]}, align: the original faction PlayerStatus records of the viewer's faction (the role rides in
//                 PlayerStatus records too since M7a)
import type { BitReader, BitWriter, Vec2 } from "@rebirth/core";
import type { EmoteEvent, EmoteRequest, FactionMemberView, TeamMemberView } from "@rebirth/sim";
import {
    clampUint,
    dequantize,
    gameTypeId,
    gameTypeOf,
    type NetCtx,
    quantize,
    readGameType,
    readMapPos,
    writeCount,
    writeGameType,
    writeMapPos,
} from "./quant.ts";

/** Team status positions: 11 bits per axis (original PlayerStatus). */
export const TEAM_POS_BITS = 11;
/** Team member health: 7 bits over 0..100 (original GroupStatus). */
export const TEAM_HEALTH_BITS = 7;
/** Emote message positions span 0..1024 (survev net.ts Constants.MaxPosition) with 16 bits per axis. */
const EMOTE_POS_MAX = 1024;
const EMOTE_POS_BITS = 16;

/** PlayerStatus wire values per member: playerId, x, y, dead, downed, role. */
export function quantizePlayerStatus(
    team: ReadonlyArray<Pick<TeamMemberView, "playerId" | "pos" | "dead" | "downed" | "role">>,
    ctx: NetCtx,
): number[][] {
    return team.map((m) => [
        clampUint(m.playerId, 16),
        quantize(m.pos.x, 0, ctx.width, TEAM_POS_BITS),
        quantize(m.pos.y, 0, ctx.height, TEAM_POS_BITS),
        m.dead ? 1 : 0,
        m.downed ? 1 : 0,
        gameTypeId(m.role ?? ""),
    ]);
}

/** GroupStatus wire values per member: playerId, health, disconnected. */
export function quantizeGroupStatus(team: readonly TeamMemberView[]): number[][] {
    return team.map((m) => [
        clampUint(m.playerId, 16),
        quantize(m.health, 0, 100, TEAM_HEALTH_BITS),
        m.disconnected ? 1 : 0,
    ]);
}

export function writePlayerStatus(w: BitWriter, records: readonly number[][]): void {
    writeCount(w, records.length, 8);
    for (const q of records) {
        w.writeUint16(q[0]);
        w.writeBoolean(true);
        w.writeBits(q[1], TEAM_POS_BITS);
        w.writeBits(q[2], TEAM_POS_BITS);
        w.writeBoolean(true);
        w.writeBoolean(q[3] === 1);
        w.writeBoolean(q[4] === 1);
        // the role (faction role icons on the minimap; M7a)
        w.writeBoolean(q[5] !== 0);
        if (q[5] !== 0) w.writeBits(q[5], 10);
    }
    w.alignToNextByte();
}

export interface PlayerStatusRecord {
    playerId: number;
    /** false: the record carries no data (the original sends hidden faction enemies that way) */
    hasData: boolean;
    pos: Vec2;
    dead: boolean;
    downed: boolean;
    /** role id, "" for none (M7a) */
    role: string;
}

export function readPlayerStatus(r: BitReader, ctx: NetCtx): PlayerStatusRecord[] {
    const out: PlayerStatusRecord[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const playerId = r.readUint16();
        const rec: PlayerStatusRecord = {
            playerId,
            hasData: r.readBoolean(),
            pos: { x: 0, y: 0 },
            dead: false,
            downed: false,
            role: "",
        };
        if (rec.hasData) {
            const x = dequantize(r.readBits(TEAM_POS_BITS), 0, ctx.width, TEAM_POS_BITS);
            const y = dequantize(r.readBits(TEAM_POS_BITS), 0, ctx.height, TEAM_POS_BITS);
            rec.pos = { x, y };
            r.readBoolean(); // visible (always for the own group)
            rec.dead = r.readBoolean();
            rec.downed = r.readBoolean();
            if (r.readBoolean()) rec.role = gameTypeOf(r.readBits(10));
        }
        out.push(rec);
    }
    r.alignToNextByte();
    return out;
}

export function writeGroupStatus(w: BitWriter, records: readonly number[][]): void {
    writeCount(w, records.length, 8);
    for (const q of records) {
        w.writeUint16(q[0]);
        w.writeBits(q[1], TEAM_HEALTH_BITS);
        w.writeBoolean(q[2] === 1);
    }
    w.alignToNextByte();
}

export interface GroupStatusRecord {
    playerId: number;
    health: number;
    disconnected: boolean;
}

export function readGroupStatus(r: BitReader): GroupStatusRecord[] {
    const out: GroupStatusRecord[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const playerId = r.readUint16();
        const health = dequantize(r.readBits(TEAM_HEALTH_BITS), 0, 100, TEAM_HEALTH_BITS);
        out.push({ playerId, health, disconnected: r.readBoolean() });
    }
    r.alignToNextByte();
    return out;
}

export function writeEmotes(w: BitWriter, ctx: NetCtx, list: readonly EmoteEvent[]): void {
    writeCount(w, list.length, 8);
    for (const e of list) {
        w.writeUint16(clampUint(e.playerId, 16));
        writeGameType(w, e.type);
        writeGameType(w, e.itemType);
        const isPing = e.isPing && e.pos !== undefined;
        w.writeBoolean(isPing);
        if (isPing && e.pos) writeMapPos(w, ctx, e.pos);
        w.alignToNextByte();
    }
}

export function readEmotes(r: BitReader, ctx: NetCtx): EmoteEvent[] {
    const out: EmoteEvent[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const playerId = r.readUint16();
        const type = readGameType(r);
        const itemType = readGameType(r);
        const isPing = r.readBoolean();
        const e: EmoteEvent = { playerId, type, itemType, isPing };
        if (isPing) e.pos = readMapPos(r, ctx);
        r.alignToNextByte();
        out.push(e);
    }
    return out;
}

/** Client -> server emote or ping request (the original Emote message). */
export function writeEmoteRequest(w: BitWriter, req: EmoteRequest): void {
    const pos = req.pos ?? { x: 0, y: 0 };
    w.writeBits(quantize(pos.x, 0, EMOTE_POS_MAX, EMOTE_POS_BITS), EMOTE_POS_BITS);
    w.writeBits(quantize(pos.y, 0, EMOTE_POS_MAX, EMOTE_POS_BITS), EMOTE_POS_BITS);
    writeGameType(w, req.type);
    w.writeBoolean(req.isPing);
}

/** Decoded emote request; `pos` only for pings (servers still validate the type). */
export function readEmoteRequest(r: BitReader): EmoteRequest {
    const x = dequantize(r.readBits(EMOTE_POS_BITS), 0, EMOTE_POS_MAX, EMOTE_POS_BITS);
    const y = dequantize(r.readBits(EMOTE_POS_BITS), 0, EMOTE_POS_MAX, EMOTE_POS_BITS);
    const type = readGameType(r);
    const isPing = r.readBoolean();
    return isPing ? { type, isPing, pos: { x, y } } : { type, isPing };
}

/** Rebuilds the team HUD rows from the latest status sections and the player names seen so far. */
export function teamFromStatus(
    status: readonly PlayerStatusRecord[],
    group: ReadonlyMap<number, GroupStatusRecord>,
    names: ReadonlyMap<number, string>,
): TeamMemberView[] {
    return status.map((s) => {
        const g = group.get(s.playerId);
        return {
            playerId: s.playerId,
            name: names.get(s.playerId) ?? "",
            health: g?.health ?? 0,
            downed: s.downed,
            dead: s.dead,
            disconnected: g?.disconnected ?? false,
            pos: { x: s.pos.x, y: s.pos.y },
            role: s.role,
        };
    });
}

/** FactionStatus wire values (the PlayerStatus record layout): playerId, x, y, dead, downed, role. */
export function quantizeFactionStatus(rows: readonly FactionMemberView[], ctx: NetCtx): number[][] {
    return quantizePlayerStatus(rows, ctx);
}

export function writeFactionStatus(w: BitWriter, records: readonly number[][]): void {
    writePlayerStatus(w, records);
}

export function readFactionStatus(r: BitReader, ctx: NetCtx): FactionMemberView[] {
    return readPlayerStatus(r, ctx).map((s) => ({
        playerId: s.playerId,
        pos: s.pos,
        dead: s.dead,
        downed: s.downed,
        role: s.role,
    }));
}
