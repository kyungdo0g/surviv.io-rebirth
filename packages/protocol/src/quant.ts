// Quantization helpers shared by every codec. Values are turned into unsigned integers first (so encoders can
// compare wire values to detect changes) and written with BitWriter.writeBits; the formulas are the ones of
// BitWriter.writeFloat / BitReader.readFloat (survev net.ts writeFloat): round(clamp(v) mapped to 0..2^bits-1).
import type { BitReader, BitWriter, Vec2 } from "@rebirth/core";
import { GameObjectRegistry, MapObjectRegistry } from "@rebirth/defs";

/** Map extent positions are quantized over: [0, width] x [0, height] (both sides learn it from the Map message). */
export interface NetCtx {
    width: number;
    height: number;
}

/** Map positions use 16 bits per axis over the map extent (720 units: 0.011 unit steps). */
export const MAP_POS_BITS = 16;
/** Unit vectors are quantized over +-1.0001 so +-1 survive rounding (survev net.ts writeUnitVec). */
export const UNIT_VEC_RANGE = 1.0001;

/** Integer wire value of `value` in [min, max] with `bits` bits; NaN maps to `min`, out-of-range values clamp. */
export function quantize(value: number, min: number, max: number, bits: number): number {
    const clamped = value > min ? (value < max ? value : max) : min;
    return Math.round(((clamped - min) / (max - min)) * (2 ** bits - 1));
}

export function dequantize(n: number, min: number, max: number, bits: number): number {
    return min + (n / (2 ** bits - 1)) * (max - min);
}

/** Clamps a non-negative integer to `bits` bits (counts, ids). */
export function clampUint(value: number, bits: number): number {
    const max = 2 ** bits - 1;
    if (!(value > 0)) return 0;
    return value >= max ? max : Math.floor(value);
}

export function quantizeX(ctx: NetCtx, x: number): number {
    return quantize(x, 0, ctx.width, MAP_POS_BITS);
}

export function quantizeY(ctx: NetCtx, y: number): number {
    return quantize(y, 0, ctx.height, MAP_POS_BITS);
}

export function dequantizePos(ctx: NetCtx, qx: number, qy: number): Vec2 {
    return { x: dequantize(qx, 0, ctx.width, MAP_POS_BITS), y: dequantize(qy, 0, ctx.height, MAP_POS_BITS) };
}

export function quantizeUnit(v: number, bits: number): number {
    return quantize(v, -UNIT_VEC_RANGE, UNIT_VEC_RANGE, bits);
}

/** Unit vector from two quantized components, renormalized (falls back to +x for a zero vector). */
export function dequantizeUnitVec(qx: number, qy: number, bits: number): Vec2 {
    const x = dequantize(qx, -UNIT_VEC_RANGE, UNIT_VEC_RANGE, bits);
    const y = dequantize(qy, -UNIT_VEC_RANGE, UNIT_VEC_RANGE, bits);
    const len = Math.hypot(x, y);
    return len > 1e-6 ? { x: x / len, y: y / len } : { x: 1, y: 0 };
}

export function writeMapPos(w: BitWriter, ctx: NetCtx, pos: Vec2): void {
    w.writeBits(quantizeX(ctx, pos.x), MAP_POS_BITS);
    w.writeBits(quantizeY(ctx, pos.y), MAP_POS_BITS);
}

export function readMapPos(r: BitReader, ctx: NetCtx): Vec2 {
    const qx = r.readBits(MAP_POS_BITS);
    return dequantizePos(ctx, qx, r.readBits(MAP_POS_BITS));
}

export function writeUnitVec(w: BitWriter, v: Vec2, bits: number): void {
    w.writeBits(quantizeUnit(v.x, bits), bits);
    w.writeBits(quantizeUnit(v.y, bits), bits);
}

export function readUnitVec(r: BitReader, bits: number): Vec2 {
    const qx = r.readBits(bits);
    return dequantizeUnitVec(qx, r.readBits(bits), bits);
}

/** 10-bit GameObjectDefs id ("" is 0); throws for ids missing from the registry. */
export function gameTypeId(type: string): number {
    return GameObjectRegistry.typeToId(type);
}

export function gameTypeOf(id: number): string {
    return GameObjectRegistry.idToType(id);
}

/** 12-bit MapObjectDefs id ("" is 0). */
export function mapTypeId(type: string): number {
    return MapObjectRegistry.typeToId(type);
}

export function mapTypeOf(id: number): string {
    return MapObjectRegistry.idToType(id);
}

export function writeGameType(w: BitWriter, type: string): void {
    w.writeBits(gameTypeId(type), GameObjectRegistry.bits);
}

export function readGameType(r: BitReader): string {
    return gameTypeOf(r.readBits(GameObjectRegistry.bits));
}

export function writeMapType(w: BitWriter, type: string): void {
    w.writeBits(mapTypeId(type), MapObjectRegistry.bits);
}

export function readMapType(r: BitReader): string {
    return mapTypeOf(r.readBits(MapObjectRegistry.bits));
}

/** Array length prefix of `bits` bits; throws when the array does not fit (a programming error). */
export function writeCount(w: BitWriter, n: number, bits: number): void {
    if (n > 2 ** bits - 1) throw new RangeError(`array of ${n} items does not fit a ${bits}-bit length`);
    w.writeBits(n, bits);
}
