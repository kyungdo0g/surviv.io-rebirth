// Bullet records of the Update message (BulletEvent). Compared with the original record (netcode.md "Update
// message"), the client gets the drawn distance directly instead of varianceT/distAdjIdx, the direction has 10 bits
// per axis instead of 8 (tracers up to 1024 units long stay within ~0.4 units of the real path), and bullets carry an
// id so a later hit report can stop the tracer.
//
// Record: id (bit 1 + 4 bits = previous id + 1..16, else bit 0 + 24-bit id), shooterId u16, bulletType 10,
// sourceType 10, pos mapPos, dir 10+10, layer 2, maxDist float 0..1024 16 bits, reflectCount 2, hitPlayer bit,
// hasEnd bit [+ endDist float 0..1024 16 bits], shotFx bit, offHand bit, then (M7a) the original special-fx flags
// trailSaturated, trailThick and splinter (trailSmall is implied by splinter) as 3 bits, then (M9) hasSpeedMult bit
// [+ speedMult float 0..4 10 bits]: the tracer speed factor (the original sent speedMult and varianceT instead).
import type { BitReader, BitWriter } from "@rebirth/core";
import type { BulletEvent } from "@rebirth/sim";
import { NetLimits } from "./constants.ts";
import {
    clampUint,
    dequantize,
    type NetCtx,
    quantize,
    readGameType,
    readMapPos,
    readUnitVec,
    writeGameType,
    writeMapPos,
    writeUnitVec,
} from "./quant.ts";

const DIR_BITS = 10;
const DIST_BITS = 16;
const ID_BITS = 24;
const ID_MASK = 2 ** ID_BITS - 1;
const ID_DELTA_BITS = 4;
const SPEED_MULT_BITS = 10;
/** tracer speed factors above this are clamped (shrapnel variance reaches 2.5, perks 1.25) */
const MAX_SPEED_MULT = 4;

function writeDist(w: BitWriter, d: number): void {
    w.writeBits(quantize(d, 0, NetLimits.MaxBulletDist, DIST_BITS), DIST_BITS);
}

function readDist(r: BitReader): number {
    return dequantize(r.readBits(DIST_BITS), 0, NetLimits.MaxBulletDist, DIST_BITS);
}

/** Writes a bullet list (u16 count + records); ids are sent mod 2^24. */
export function writeBullets(w: BitWriter, ctx: NetCtx, bullets: readonly BulletEvent[]): void {
    w.writeUint16(bullets.length);
    let prevId = -1;
    for (const bl of bullets) {
        const id = bl.id & ID_MASK;
        const delta = id - prevId;
        if (prevId >= 0 && delta >= 1 && delta <= 2 ** ID_DELTA_BITS) {
            w.writeBoolean(true);
            w.writeBits(delta - 1, ID_DELTA_BITS);
        } else {
            w.writeBoolean(false);
            w.writeBits(id, ID_BITS);
        }
        prevId = id;
        w.writeUint16(bl.shooterId);
        writeGameType(w, bl.bulletType);
        writeGameType(w, bl.sourceType);
        writeMapPos(w, ctx, bl.pos);
        writeUnitVec(w, bl.dir, DIR_BITS);
        w.writeBits(bl.layer & 3, 2);
        writeDist(w, bl.maxDist);
        w.writeBits(clampUint(bl.reflectCount, 2), 2);
        w.writeBoolean(bl.hitPlayer);
        w.writeBoolean(bl.endDist !== undefined);
        if (bl.endDist !== undefined) writeDist(w, bl.endDist);
        w.writeBoolean(bl.shotFx);
        w.writeBoolean(bl.offHand);
        w.writeBoolean(!!bl.saturated);
        w.writeBoolean(!!bl.thick);
        w.writeBoolean(!!bl.splinter);
        const speedMult = bl.speedMult ?? 1;
        const hasSpeedMult = Math.abs(speedMult - 1) > 1e-9;
        w.writeBoolean(hasSpeedMult);
        if (hasSpeedMult) w.writeBits(quantize(speedMult, 0, MAX_SPEED_MULT, SPEED_MULT_BITS), SPEED_MULT_BITS);
    }
}

export function readBullets(r: BitReader, ctx: NetCtx): BulletEvent[] {
    const out: BulletEvent[] = [];
    let prevId = -1;
    for (let n = r.readUint16(); n > 0; n--) {
        const id = r.readBoolean() ? prevId + 1 + r.readBits(ID_DELTA_BITS) : r.readBits(ID_BITS);
        prevId = id;
        const shooterId = r.readUint16();
        const bulletType = readGameType(r);
        const sourceType = readGameType(r);
        const pos = readMapPos(r, ctx);
        const dir = readUnitVec(r, DIR_BITS);
        const layer = r.readBits(2);
        const maxDist = readDist(r);
        const reflectCount = r.readBits(2);
        const hitPlayer = r.readBoolean();
        const endDist = r.readBoolean() ? readDist(r) : undefined;
        const event: BulletEvent = {
            id,
            shooterId,
            bulletType,
            sourceType,
            pos,
            dir,
            layer,
            maxDist,
            reflectCount,
            hitPlayer,
            shotFx: r.readBoolean(),
            offHand: r.readBoolean(),
            saturated: r.readBoolean(),
            thick: r.readBoolean(),
            splinter: r.readBoolean(),
            speedMult: r.readBoolean()
                ? dequantize(r.readBits(SPEED_MULT_BITS), 0, MAX_SPEED_MULT, SPEED_MULT_BITS)
                : 1,
        };
        if (endDist !== undefined) event.endDist = endDist;
        out.push(event);
    }
    return out;
}
