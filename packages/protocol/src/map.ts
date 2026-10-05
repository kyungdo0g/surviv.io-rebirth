// Map message: the static world (MapData), sent once per client right after Joined. Servers encode it once per
// game and copy the bytes into each new client's first frame (survev map.ts / client.ts).
//
// Layout (original MapMsg order, docs/research/engine/netcode.md "Server → client messages"):
//   mapName string(24), seed u32, width f64, height f64, shoreInset f64, grassInset f64
//     (f64 instead of the original u16s: insets can be negative, e.g. birthday's -1, and every later position
//     is quantized over the exact width/height read here)
//   rivers   u8 count  x { width f32, looped bit, points u16 count x mapPos }
//   places   u8 count  x { name string(64), pos 16+16 bits over 0..1 }
//     Places are kept as normalized 0..1 positions (survev mapMsg.ts and our MapData), not the 0..1024 world
//     positions the 0.8.82 client read (netcode.md open question): MapData already stores them normalized.
//   objects  u16 count x { id: bit 1 = previous id + 1, else bit 0 + u16 id; type 12 bits; pos 16+16 bits;
//                          ori 2 bits; scale 8 bits over 0.125..2.5; layer 2 bits } (not byte aligned)
//   groundPatches u8 count x { min mapPos, max mapPos, color u32, roughness f32, offsetDist f32, order 7 bits,
//                              useAsMapShape bit } (0.8.82 AABB form)
// mapPos = 16 bits per axis over [0, width] x [0, height] (quant.ts).
import type { BitReader, BitWriter } from "@rebirth/core";
import type { GroundPatchData, MapData, MapObjectSpawn, PlaceData, RiverData } from "@rebirth/sim";
import { type MsgType, NetLimits } from "./constants.ts";
import {
    clampUint,
    dequantize,
    type NetCtx,
    quantize,
    readMapPos,
    readMapType,
    writeCount,
    writeMapPos,
    writeMapType,
} from "./quant.ts";

export interface MapMsg {
    type: typeof MsgType.Map;
    map: MapData;
}

const SCALE_BITS = 8;
const PLACE_BITS = 16;
const ORDER_BITS = 7;

export function writeMap(w: BitWriter, map: MapData): void {
    const ctx: NetCtx = { width: map.width, height: map.height };
    w.writeString(map.mapName, NetLimits.MapNameMaxBytes);
    w.writeUint32(map.seed >>> 0);
    w.writeFloat64(map.width);
    w.writeFloat64(map.height);
    w.writeFloat64(map.shoreInset);
    w.writeFloat64(map.grassInset);
    writeCount(w, map.rivers.length, 8);
    for (const river of map.rivers) {
        w.writeFloat32(river.width);
        w.writeBoolean(river.looped);
        writeCount(w, river.points.length, 16);
        for (const p of river.points) writeMapPos(w, ctx, p);
    }
    writeCount(w, map.places.length, 8);
    for (const place of map.places) {
        w.writeString(place.name, NetLimits.PlaceNameMaxBytes);
        w.writeBits(quantize(place.pos.x, 0, 1, PLACE_BITS), PLACE_BITS);
        w.writeBits(quantize(place.pos.y, 0, 1, PLACE_BITS), PLACE_BITS);
    }
    writeCount(w, map.objects.length, 16);
    let prevId = 0;
    for (const o of map.objects) {
        const sequential = o.id === prevId + 1;
        w.writeBoolean(sequential);
        if (!sequential) w.writeUint16(o.id);
        prevId = o.id;
        writeMapType(w, o.type);
        writeMapPos(w, ctx, o.pos);
        w.writeBits(o.ori & 3, 2);
        w.writeBits(
            quantize(o.scale, NetLimits.MapObjectMinScale, NetLimits.MapObjectMaxScale, SCALE_BITS),
            SCALE_BITS,
        );
        w.writeBits(o.layer & 3, 2);
    }
    writeCount(w, map.groundPatches.length, 8);
    for (const g of map.groundPatches) {
        writeMapPos(w, ctx, g.min);
        writeMapPos(w, ctx, g.max);
        w.writeUint32(g.color >>> 0);
        w.writeFloat32(g.roughness);
        w.writeFloat32(g.offsetDist);
        w.writeBits(clampUint(g.order, ORDER_BITS), ORDER_BITS);
        w.writeBoolean(g.useAsMapShape);
    }
}

export function readMap(r: BitReader): MapData {
    const mapName = r.readString(NetLimits.MapNameMaxBytes);
    const seed = r.readUint32();
    const width = r.readFloat64();
    const height = r.readFloat64();
    const shoreInset = r.readFloat64();
    const grassInset = r.readFloat64();
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) {
        throw new RangeError(`Map: invalid extent ${width} x ${height}`);
    }
    const ctx: NetCtx = { width, height };
    const rivers: RiverData[] = [];
    for (let n = r.readBits(8); n > 0; n--) {
        const riverWidth = r.readFloat32();
        const looped = r.readBoolean();
        const points = [];
        for (let k = r.readBits(16); k > 0; k--) points.push(readMapPos(r, ctx));
        rivers.push({ width: riverWidth, looped, points });
    }
    const places: PlaceData[] = [];
    for (let n = r.readBits(8); n > 0; n--) {
        const name = r.readString(NetLimits.PlaceNameMaxBytes);
        const x = dequantize(r.readBits(PLACE_BITS), 0, 1, PLACE_BITS);
        const y = dequantize(r.readBits(PLACE_BITS), 0, 1, PLACE_BITS);
        places.push({ name, pos: { x, y } });
    }
    const objects: MapObjectSpawn[] = [];
    let prevId = 0;
    for (let n = r.readBits(16); n > 0; n--) {
        const id = r.readBoolean() ? prevId + 1 : r.readUint16();
        prevId = id;
        const type = readMapType(r);
        const pos = readMapPos(r, ctx);
        const ori = r.readBits(2);
        const scale = dequantize(
            r.readBits(SCALE_BITS),
            NetLimits.MapObjectMinScale,
            NetLimits.MapObjectMaxScale,
            SCALE_BITS,
        );
        objects.push({ id, type, pos, ori, scale, layer: r.readBits(2) });
    }
    const groundPatches: GroundPatchData[] = [];
    for (let n = r.readBits(8); n > 0; n--) {
        const min = readMapPos(r, ctx);
        const max = readMapPos(r, ctx);
        groundPatches.push({
            min,
            max,
            color: r.readUint32(),
            roughness: r.readFloat32(),
            offsetDist: r.readFloat32(),
            order: r.readBits(ORDER_BITS),
            useAsMapShape: r.readBoolean(),
        });
    }
    return { mapName, seed, width, height, shoreInset, grassInset, rivers, places, groundPatches, objects };
}
