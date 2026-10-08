// Update message sections of the battle-royale loop (M4): gas, gas progress, planes, falling air drops, map
// indicators and the kill leader. Layouts follow the original UpdateMsg sections (netcode.md "Update message")
// where they exist; differences are noted per section. Each section is quantized into integers first so the
// per-client encoder sends it only when its wire values changed.
//
//   Gas:           mode u8, duration f32, posOld mapPos, posNew mapPos, radOld/radNew float 0..2048 16 bits
//                  (original), then rebirth additions: stage u8, circleIdx+1 u8, damage f32
//   GasT:          float 0..1 16 bits (original)
//   Planes:        u8 count x {id u8, pos vec 10+10 bits over -512..1536 (0.8.82 range), dir unit vec 8+8,
//                  actionComplete bit, action 3 bits} (original 0.8.82), align
//   Airdrops:      u8 count x {id u16, pos mapPos, fallT float 0..1 7 bits, landed bit}, align (rebirth: the
//                  original sends falling crates as Airdrop objects with the same fields)
//   MapIndicators: u8 count (0.8.82) x {id 4 bits, dead bit, equipped bit, type game type, pos mapPos}, align
//   KillLeader:    id u16, kills u8 (original)
//   PlayerInfos:   u8 count x {playerId u16, teamId u8, groupId u8, name string(16), heal type, boost type, align}
//                  (original layout; the heal/boost loadout cosmetics are not modelled and sent as "")
//   DeletePlayerIds: u8 count x u16 (original)
import type { BitReader, BitWriter } from "@rebirth/core";
import type {
    AirdropView,
    GasModeName,
    GasView,
    KillLeaderView,
    MapIndicatorView,
    PlaneView,
    PlayerInfoView,
} from "@rebirth/sim";
import { NetLimits } from "./constants.ts";
import {
    clampUint,
    dequantize,
    dequantizePos,
    gameTypeId,
    gameTypeOf,
    MAP_POS_BITS,
    type NetCtx,
    quantize,
    quantizeX,
    quantizeY,
    readGameType,
    readMapPos,
    readUnitVec,
    writeCount,
    writeGameType,
    writeMapPos,
    writeUnitVec,
} from "./quant.ts";

const GAS_MODES: readonly GasModeName[] = ["inactive", "waiting", "moving"];
const GAS_RAD_MAX = 2048;
const GAS_RAD_BITS = 16;
const GAS_T_BITS = 16;
const PLANE_POS_MIN = -512;
const PLANE_POS_MAX = 1536;
const PLANE_POS_BITS = 10;
const PLANE_DIR_BITS = 8;
const PLANE_TYPES = ["airdrop", "airstrike"] as const;
const FALL_T_BITS = 7;
const INDICATOR_ID_BITS = 4;

/** Gas wire values: mode, duration (f32), posOld x/y, posNew x/y, radOld, radNew, stage, circleIdx+1, damage (f32). */
export function quantizeGas(g: GasView, ctx: NetCtx): number[] {
    return [
        Math.max(0, GAS_MODES.indexOf(g.mode)),
        Math.fround(g.duration),
        quantizeX(ctx, g.posOld.x),
        quantizeY(ctx, g.posOld.y),
        quantizeX(ctx, g.posNew.x),
        quantizeY(ctx, g.posNew.y),
        quantize(g.radOld, 0, GAS_RAD_MAX, GAS_RAD_BITS),
        quantize(g.radNew, 0, GAS_RAD_MAX, GAS_RAD_BITS),
        clampUint(g.stage, 8),
        clampUint(g.circleIdx + 1, 8),
        Math.fround(g.damage),
    ];
}

export function quantizeGasT(t: number): number {
    return quantize(t, 0, 1, GAS_T_BITS);
}

export function writeGas(w: BitWriter, q: readonly number[]): void {
    w.writeUint8(q[0]);
    w.writeFloat32(q[1]);
    for (let i = 2; i < 6; i++) w.writeBits(q[i], MAP_POS_BITS);
    w.writeBits(q[6], GAS_RAD_BITS);
    w.writeBits(q[7], GAS_RAD_BITS);
    w.writeUint8(q[8]);
    w.writeUint8(q[9]);
    w.writeFloat32(q[10]);
}

/** Reads a gas section; `gasT` is filled in by the caller from the GasT section state. */
export function readGas(r: BitReader, ctx: NetCtx): Omit<GasView, "gasT"> {
    const code = r.readUint8();
    const mode = GAS_MODES[code];
    if (mode === undefined) throw new RangeError(`unknown gas mode ${code}`);
    const duration = r.readFloat32();
    const qx0 = r.readBits(MAP_POS_BITS);
    const posOld = dequantizePos(ctx, qx0, r.readBits(MAP_POS_BITS));
    const qx1 = r.readBits(MAP_POS_BITS);
    const posNew = dequantizePos(ctx, qx1, r.readBits(MAP_POS_BITS));
    const radOld = dequantize(r.readBits(GAS_RAD_BITS), 0, GAS_RAD_MAX, GAS_RAD_BITS);
    const radNew = dequantize(r.readBits(GAS_RAD_BITS), 0, GAS_RAD_MAX, GAS_RAD_BITS);
    const stage = r.readUint8();
    const circleIdx = r.readUint8() - 1;
    const damage = r.readFloat32();
    return { mode, stage, circleIdx, duration, posOld, posNew, radOld, radNew, damage };
}

export function writeGasT(w: BitWriter, q: number): void {
    w.writeBits(q, GAS_T_BITS);
}

export function readGasT(r: BitReader): number {
    return dequantize(r.readBits(GAS_T_BITS), 0, 1, GAS_T_BITS);
}

export function writePlanes(w: BitWriter, planes: readonly PlaneView[]): void {
    writeCount(w, planes.length, 8);
    for (const p of planes) {
        w.writeUint8(clampUint(p.id, 8));
        w.writeBits(quantize(p.pos.x, PLANE_POS_MIN, PLANE_POS_MAX, PLANE_POS_BITS), PLANE_POS_BITS);
        w.writeBits(quantize(p.pos.y, PLANE_POS_MIN, PLANE_POS_MAX, PLANE_POS_BITS), PLANE_POS_BITS);
        writeUnitVec(w, p.dir, PLANE_DIR_BITS);
        w.writeBoolean(p.actionComplete);
        w.writeBits(p.planeType === "airstrike" ? 1 : 0, 3);
    }
}

export function readPlanes(r: BitReader): PlaneView[] {
    const out: PlaneView[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const id = r.readUint8();
        const x = dequantize(r.readBits(PLANE_POS_BITS), PLANE_POS_MIN, PLANE_POS_MAX, PLANE_POS_BITS);
        const y = dequantize(r.readBits(PLANE_POS_BITS), PLANE_POS_MIN, PLANE_POS_MAX, PLANE_POS_BITS);
        const dir = readUnitVec(r, PLANE_DIR_BITS);
        const actionComplete = r.readBoolean();
        const code = r.readBits(3);
        const planeType = PLANE_TYPES[code];
        if (planeType === undefined) throw new RangeError(`unknown plane type ${code}`);
        out.push({ id, pos: { x, y }, dir, planeType, actionComplete });
    }
    return out;
}

export function writeAirdrops(w: BitWriter, ctx: NetCtx, drops: readonly AirdropView[]): void {
    writeCount(w, drops.length, 8);
    for (const d of drops) {
        w.writeUint16(d.id);
        writeMapPos(w, ctx, d.pos);
        w.writeBits(quantize(d.fallT, 0, 1, FALL_T_BITS), FALL_T_BITS);
        w.writeBoolean(d.landed);
    }
}

export function readAirdrops(r: BitReader, ctx: NetCtx): AirdropView[] {
    const out: AirdropView[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const id = r.readUint16();
        const pos = readMapPos(r, ctx);
        const fallT = dequantize(r.readBits(FALL_T_BITS), 0, 1, FALL_T_BITS);
        out.push({ id, pos, fallT, landed: r.readBoolean() });
    }
    return out;
}

/** Indicator wire values: id, dead, equipped, type, x, y. */
export function quantizeIndicator(m: MapIndicatorView, ctx: NetCtx): number[] {
    return [
        clampUint(m.id, INDICATOR_ID_BITS),
        m.dead ? 1 : 0,
        m.equipped ? 1 : 0,
        gameTypeId(m.type),
        quantizeX(ctx, m.pos.x),
        quantizeY(ctx, m.pos.y),
    ];
}

export function writeIndicators(w: BitWriter, records: readonly number[][]): void {
    writeCount(w, records.length, 8);
    for (const q of records) {
        w.writeBits(q[0], INDICATOR_ID_BITS);
        w.writeBoolean(q[1] === 1);
        w.writeBoolean(q[2] === 1);
        w.writeBits(q[3], 10);
        w.writeBits(q[4], MAP_POS_BITS);
        w.writeBits(q[5], MAP_POS_BITS);
    }
}

export function readIndicators(r: BitReader, ctx: NetCtx): MapIndicatorView[] {
    const out: MapIndicatorView[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const id = r.readBits(INDICATOR_ID_BITS);
        const dead = r.readBoolean();
        const equipped = r.readBoolean();
        const type = gameTypeOf(r.readBits(10));
        const qx = r.readBits(MAP_POS_BITS);
        out.push({ id, type, pos: dequantizePos(ctx, qx, r.readBits(MAP_POS_BITS)), dead, equipped });
    }
    return out;
}

export function quantizeKillLeader(k: KillLeaderView): [number, number] {
    return [clampUint(k.id, 16), clampUint(k.kills, 8)];
}

export function writeKillLeader(w: BitWriter, q: readonly number[]): void {
    w.writeUint16(q[0]);
    w.writeUint8(q[1]);
}

export function readKillLeader(r: BitReader): KillLeaderView {
    return { id: r.readUint16(), kills: r.readUint8() };
}

export function writePlayerInfos(w: BitWriter, infos: readonly PlayerInfoView[]): void {
    writeCount(w, infos.length, 8);
    for (const p of infos) {
        w.writeUint16(p.playerId);
        w.writeUint8(clampUint(p.teamId, 8));
        w.writeUint8(clampUint(p.groupId, 8));
        w.writeString(p.name, NetLimits.PlayerNameMaxBytes);
        writeGameType(w, p.heal ?? "");
        writeGameType(w, p.boost ?? "");
        w.alignToNextByte();
    }
}

export function readPlayerInfos(r: BitReader): PlayerInfoView[] {
    const out: PlayerInfoView[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const playerId = r.readUint16();
        const teamId = r.readUint8();
        const groupId = r.readUint8();
        const name = r.readString(NetLimits.PlayerNameMaxBytes);
        // the loadout's heal / boost particles (survev content wave stage 4b)
        const heal = readGameType(r);
        const boost = readGameType(r);
        r.alignToNextByte();
        const info: PlayerInfoView = { playerId, teamId, groupId, name };
        if (heal) info.heal = heal;
        if (boost) info.boost = boost;
        out.push(info);
    }
    return out;
}

export function writeDeletedPlayers(w: BitWriter, ids: readonly number[]): void {
    writeCount(w, ids.length, 8);
    for (const id of ids) w.writeUint16(id);
}

export function readDeletedPlayers(r: BitReader): number[] {
    const out: number[] = [];
    for (let n = r.readUint8(); n > 0; n--) out.push(r.readUint16());
    return out;
}
