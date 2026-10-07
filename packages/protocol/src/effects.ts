// Update message sections of M5a (explosions, projectiles, smoke, air strike zones) and M5b (recorders), announced by
// the extended flags word (UpdateExtFlag). Layouts follow the original UpdateMsg explosion / air strike zone records
// and the Projectile / Smoke object serializations (netcode.md "Update message", survev objectSerializeFns.ts) where
// they exist; differences are noted per section. Projectiles and smokes are sent as complete lists every update while any
// is in view (like planes), not as delta-encoded objects.
//
//   Explosions:     u8 count x {pos mapPos, type game type, layer 2, align} (original record)
//   Projectiles:    u8 count x {id u16, type game type, layer 2, pos mapPos, posZ float 0..5 10 bits,
//                   dir unit vec 7+7} (original Projectile full + partial fields, plus the id), align
//   Smokes:         u8 count x {id u16, layer 2, interior bit, pos mapPos, rad float 0..10 8 bits} (original Smoke
//                   fields, interior as one bit instead of 6, plus the id), align
//   AirstrikeZones: u8 count x {id u8, pos mapPos, rad float 0..256 8 bits, duration float 0..60 8 bits, zoneT float
//                   0..1 8 bits, variant 2 bits} (original record with 16-bit positions, plus id, progress and the
//                   rebirth air strike variant: index into AIRSTRIKE_VARIANT_IDS, schema 9), align
//   Recorders (M5b): u8 count x {id u16, type map type, pos mapPos, layer 2}, align; the recording's sound id is the
//                   def's button.sound.on (the original client played it from the button seq of the obstacle)
import type { BitReader, BitWriter } from "@rebirth/core";
import { AIRSTRIKE_VARIANT_IDS, GameConfig, getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import type {
    AirstrikeZoneView,
    ExplosionEvent,
    ProjectileView,
    RecorderEvent,
    SmokeView,
    Snapshot,
} from "@rebirth/sim";
import { UpdateExtFlag } from "./constants.ts";
import {
    clampUint,
    dequantize,
    type NetCtx,
    quantize,
    readGameType,
    readMapPos,
    readMapType,
    readUnitVec,
    writeCount,
    writeGameType,
    writeMapPos,
    writeMapType,
    writeUnitVec,
} from "./quant.ts";

/** Value ranges of the M5 sections (survev net.ts Constants, same in 0.8.82). */
export const EffectLimits = {
    ProjectileMaxHeight: GameConfig.projectile.maxHeight,
    SmokeMaxRad: 10,
    AirstrikeZoneMaxRad: 256,
    AirstrikeZoneMaxDuration: 60,
} as const;

const POS_Z_BITS = 10;
const PROJ_DIR_BITS = 7;
const SMOKE_RAD_BITS = 8;
const ZONE_BITS = 8;
/** rebirth air strike variant index (AIRSTRIKE_VARIANT_IDS, 3 of 4 values used) */
const ZONE_VARIANT_BITS = 2;

export function writeExplosions(w: BitWriter, ctx: NetCtx, list: readonly ExplosionEvent[]): void {
    writeCount(w, list.length, 8);
    for (const e of list) {
        writeMapPos(w, ctx, e.pos);
        writeGameType(w, e.type);
        w.writeBits(e.layer & 3, 2);
        w.alignToNextByte();
    }
}

export function readExplosions(r: BitReader, ctx: NetCtx): ExplosionEvent[] {
    const out: ExplosionEvent[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const pos = readMapPos(r, ctx);
        const type = readGameType(r);
        const layer = r.readBits(2);
        r.alignToNextByte();
        out.push({ type, pos, layer });
    }
    return out;
}

export function writeProjectiles(w: BitWriter, ctx: NetCtx, list: readonly ProjectileView[]): void {
    writeCount(w, list.length, 8);
    for (const p of list) {
        w.writeUint16(clampUint(p.id, 16));
        writeGameType(w, p.type);
        w.writeBits(p.layer & 3, 2);
        writeMapPos(w, ctx, p.pos);
        w.writeBits(quantize(p.posZ, 0, EffectLimits.ProjectileMaxHeight, POS_Z_BITS), POS_Z_BITS);
        writeUnitVec(w, p.dir, PROJ_DIR_BITS);
    }
    w.alignToNextByte();
}

export function readProjectiles(r: BitReader, ctx: NetCtx): ProjectileView[] {
    const out: ProjectileView[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const id = r.readUint16();
        const type = readGameType(r);
        const layer = r.readBits(2);
        const pos = readMapPos(r, ctx);
        const posZ = dequantize(r.readBits(POS_Z_BITS), 0, EffectLimits.ProjectileMaxHeight, POS_Z_BITS);
        const dir = readUnitVec(r, PROJ_DIR_BITS);
        out.push({ id, type, pos, posZ, dir, layer });
    }
    r.alignToNextByte();
    return out;
}

export function writeSmokes(w: BitWriter, ctx: NetCtx, list: readonly SmokeView[]): void {
    writeCount(w, list.length, 8);
    for (const s of list) {
        w.writeUint16(clampUint(s.id, 16));
        w.writeBits(s.layer & 3, 2);
        w.writeBoolean(s.interior);
        writeMapPos(w, ctx, s.pos);
        w.writeBits(quantize(s.rad, 0, EffectLimits.SmokeMaxRad, SMOKE_RAD_BITS), SMOKE_RAD_BITS);
    }
    w.alignToNextByte();
}

export function readSmokes(r: BitReader, ctx: NetCtx): SmokeView[] {
    const out: SmokeView[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const id = r.readUint16();
        const layer = r.readBits(2);
        const interior = r.readBoolean();
        const pos = readMapPos(r, ctx);
        const rad = dequantize(r.readBits(SMOKE_RAD_BITS), 0, EffectLimits.SmokeMaxRad, SMOKE_RAD_BITS);
        out.push({ id, pos, rad, layer, interior });
    }
    r.alignToNextByte();
    return out;
}

export function writeAirstrikeZones(w: BitWriter, ctx: NetCtx, list: readonly AirstrikeZoneView[]): void {
    writeCount(w, list.length, 8);
    for (const z of list) {
        w.writeUint8(clampUint(z.id, 8));
        writeMapPos(w, ctx, z.pos);
        w.writeBits(quantize(z.rad, 0, EffectLimits.AirstrikeZoneMaxRad, ZONE_BITS), ZONE_BITS);
        w.writeBits(quantize(z.duration, 0, EffectLimits.AirstrikeZoneMaxDuration, ZONE_BITS), ZONE_BITS);
        w.writeBits(quantize(z.zoneT, 0, 1, ZONE_BITS), ZONE_BITS);
        w.writeBits(Math.max(0, AIRSTRIKE_VARIANT_IDS.indexOf(z.variant ?? "normal")), ZONE_VARIANT_BITS);
    }
    w.alignToNextByte();
}

export function readAirstrikeZones(r: BitReader, ctx: NetCtx): AirstrikeZoneView[] {
    const out: AirstrikeZoneView[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const id = r.readUint8();
        const pos = readMapPos(r, ctx);
        const rad = dequantize(r.readBits(ZONE_BITS), 0, EffectLimits.AirstrikeZoneMaxRad, ZONE_BITS);
        const duration = dequantize(r.readBits(ZONE_BITS), 0, EffectLimits.AirstrikeZoneMaxDuration, ZONE_BITS);
        const zoneT = dequantize(r.readBits(ZONE_BITS), 0, 1, ZONE_BITS);
        const variantIdx = r.readBits(ZONE_VARIANT_BITS);
        const variant = AIRSTRIKE_VARIANT_IDS[variantIdx];
        if (variant === undefined) throw new RangeError(`AirstrikeZones: unknown variant ${variantIdx}`);
        out.push({ id, variant, pos, rad, duration, zoneT });
    }
    r.alignToNextByte();
    return out;
}

/** Sound of a recorder obstacle's recording (its def's button.sound.on; "" for unknown types). */
export function recorderSound(type: string): string {
    if (!hasMapObjectDef(type)) return "";
    const def = getMapObjectDef(type);
    return def.type === "obstacle" ? (def.button?.sound.on ?? "") : "";
}

export function writeRecorders(w: BitWriter, ctx: NetCtx, list: readonly RecorderEvent[]): void {
    writeCount(w, list.length, 8);
    for (const e of list) {
        w.writeUint16(clampUint(e.id, 16));
        writeMapType(w, e.type);
        writeMapPos(w, ctx, e.pos);
        w.writeBits(e.layer & 3, 2);
    }
    w.alignToNextByte();
}

export function readRecorders(r: BitReader, ctx: NetCtx): RecorderEvent[] {
    const out: RecorderEvent[] = [];
    for (let n = r.readUint8(); n > 0; n--) {
        const id = r.readUint16();
        const type = readMapType(r);
        const pos = readMapPos(r, ctx);
        const layer = r.readBits(2);
        out.push({ id, type, sound: recorderSound(type), pos, layer });
    }
    r.alignToNextByte();
    return out;
}

/** The M5 sections of a snapshot, as the decoder fills them (empty lists when absent). */
export type EffectSections = Required<
    Pick<Snapshot, "explosions" | "projectiles" | "smokes" | "airstrikeZones" | "recorders">
>;

/** Extended flags announcing the non-empty M5 sections of `snap` (0: no extended flags word). */
export function effectFlags(snap: Snapshot): number {
    let ext = 0;
    if (snap.explosions?.length) ext |= UpdateExtFlag.Explosions;
    if (snap.projectiles?.length) ext |= UpdateExtFlag.Projectiles;
    if (snap.smokes?.length) ext |= UpdateExtFlag.Smokes;
    if (snap.airstrikeZones?.length) ext |= UpdateExtFlag.AirstrikeZones;
    if (snap.recorders?.length) ext |= UpdateExtFlag.Recorders;
    return ext;
}

/** Writes the M5 sections announced by `ext` (byte aligned before and after). */
export function writeEffects(w: BitWriter, ctx: NetCtx, snap: Snapshot, ext: number): void {
    if (ext & UpdateExtFlag.Explosions) writeExplosions(w, ctx, snap.explosions ?? []);
    if (ext & UpdateExtFlag.Projectiles) writeProjectiles(w, ctx, snap.projectiles ?? []);
    if (ext & UpdateExtFlag.Smokes) writeSmokes(w, ctx, snap.smokes ?? []);
    if (ext & UpdateExtFlag.AirstrikeZones) writeAirstrikeZones(w, ctx, snap.airstrikeZones ?? []);
    if (ext & UpdateExtFlag.Recorders) writeRecorders(w, ctx, snap.recorders ?? []);
}

/** Reads the M5 sections announced by `ext` (the M6a sections follow, update.ts); throws on undefined flags. */
export function readEffects(r: BitReader, ctx: NetCtx, ext: number): EffectSections {
    if (ext & UpdateExtFlag.Reserved) throw new RangeError(`Update: unsupported section flags 0x${ext.toString(16)}`);
    return {
        explosions: ext & UpdateExtFlag.Explosions ? readExplosions(r, ctx) : [],
        projectiles: ext & UpdateExtFlag.Projectiles ? readProjectiles(r, ctx) : [],
        smokes: ext & UpdateExtFlag.Smokes ? readSmokes(r, ctx) : [],
        airstrikeZones: ext & UpdateExtFlag.AirstrikeZones ? readAirstrikeZones(r, ctx) : [],
        recorders: ext & UpdateExtFlag.Recorders ? readRecorders(r, ctx) : [],
    };
}
