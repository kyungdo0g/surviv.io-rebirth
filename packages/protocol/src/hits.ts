// Update message section of the rebirth hit feedback (user/2026-10-07-hit-feedback; schema 11), announced by the
// extended flag UpdateExtFlag.Hits after the FactionStatus section. Not in the original protocol: v0.8.82 clients
// never learnt whether or how hard a hit landed. One side of every hit is the active player, so a record carries only
// the other player's id:
//
//   Hits: u8 count x {taken bit (the active player is the target), otherId u16 (the source when taken, else the
//         target; 0 = environment or not in view), amount float 0..100 8 bits (the health bar's steps), damageType 3
//         bits, headshot bit, armored bit, hasDir bit [+ dir angle 8 bits, 1.4 degree steps]}, align
//
// A dealt hit takes 31 bits, a taken one with its direction 39; self damage is a taken record naming the active player.
import type { BitReader, BitWriter } from "@rebirth/core";
import type { HitEvent } from "@rebirth/sim";
import { clampUint, dequantize, quantize, writeCount } from "./quant.ts";

export const HIT_AMOUNT_BITS = 8;
export const HIT_DIR_BITS = 8;
const DAMAGE_TYPE_BITS = 3;
const TAU = Math.PI * 2;

/** Wire angle of a direction: atan2 over [-pi, pi) in 2^bits steps (wraps). */
function quantizeAngle(x: number, y: number): number {
    const steps = 2 ** HIT_DIR_BITS;
    return Math.round(((Math.atan2(y, x) + Math.PI) / TAU) * steps) % steps;
}

function dequantizeAngle(q: number): { x: number; y: number } {
    const a = (q / 2 ** HIT_DIR_BITS) * TAU - Math.PI;
    return { x: Math.cos(a), y: Math.sin(a) };
}

/** Writes the Hits section for active player `activeId` (byte aligned after it). */
export function writeHits(w: BitWriter, list: readonly HitEvent[], activeId: number): void {
    writeCount(w, list.length, 8);
    for (const h of list) {
        const taken = h.targetId === activeId;
        w.writeBoolean(taken);
        w.writeUint16(clampUint(taken ? h.sourceId : h.targetId, 16));
        w.writeBits(quantize(h.amount, 0, 100, HIT_AMOUNT_BITS), HIT_AMOUNT_BITS);
        w.writeBits(clampUint(h.damageType, DAMAGE_TYPE_BITS), DAMAGE_TYPE_BITS);
        w.writeBoolean(h.headshot);
        w.writeBoolean(h.armored);
        const dir = taken ? h.dir : undefined;
        w.writeBoolean(!!dir);
        if (dir) w.writeBits(quantizeAngle(dir.x, dir.y), HIT_DIR_BITS);
    }
    w.alignToNextByte();
}

/** Reads the Hits section; `activeId` is the active player of this update (ActivePlayerId). */
export function readHits(r: BitReader, activeId: number): HitEvent[] {
    const out: HitEvent[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const taken = r.readBoolean();
        const otherId = r.readUint16();
        const amount = dequantize(r.readBits(HIT_AMOUNT_BITS), 0, 100, HIT_AMOUNT_BITS);
        const damageType = r.readBits(DAMAGE_TYPE_BITS);
        const headshot = r.readBoolean();
        const armored = r.readBoolean();
        const hit: HitEvent = {
            targetId: taken ? activeId : otherId,
            sourceId: taken ? otherId : activeId,
            amount,
            damageType,
            headshot,
            armored,
        };
        if (r.readBoolean()) hit.dir = dequantizeAngle(r.readBits(HIT_DIR_BITS));
        out.push(hit);
    }
    r.alignToNextByte();
    return out;
}
