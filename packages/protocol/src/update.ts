// Update message: per-client delta of a Snapshot.
//
// Layout (after the type byte):
//   tick u32, flags u16 (UpdateFlag), ack u8 (last input seq received)
//   [DeletedObjects] u16 count x u16 id
//   [FullObjects]    u16 count x full record     (records are byte aligned, objects.ts)
//   [PartObjects]    u16 count x partial record
//   [ActivePlayerId] u16
//   [LocalPlayer]    local.ts sections, then align
//   [Bullets]        bullets.ts records, then align
// `time` is not sent: it is tick / TICK_HZ like Game.time.
//
// Server side, an ObjectCache shared by every client of a game quantizes each object at most once per tick and
// builds its full/partial record bytes at most once per tick (lazily, when a client needs them). Its generation is
// the tick of the latest serialization: the partial record holds the changes since the previous serialization, so
// it is valid for exactly the clients whose copy dates from that tick (every client that saw the object in its
// previous update); any other client that knows the object gets the full record instead.
// Each client has a ClientEncoder: the ticks at which it last received every object it knows, its last sent local
// state and active player id.
import { BitReader, BitWriter } from "@rebirth/core";
import type { BulletEvent, LocalPlayerState, ObjectView, Snapshot } from "@rebirth/sim";
import { TICK_HZ } from "@rebirth/sim";
import { readBullets, writeBullets } from "./bullets.ts";
import { MsgType, OBJECT_TYPE_BITS, UpdateFlag } from "./constants.ts";
import {
    cloneLocal,
    emptyLocalState,
    type LocalQuant,
    localDirtyMask,
    quantizeLocal,
    readLocal,
    writeLocal,
} from "./local.ts";
import {
    codecByCode,
    codecOf,
    diffMask,
    type ObjectCodec,
    readFullFields,
    readPartFields,
    writeFullRecord,
    writePartRecord,
} from "./objects.ts";
import type { NetCtx } from "./quant.ts";

export interface UpdateMsg {
    type: typeof MsgType.Update;
    snapshot: Snapshot;
    /** last input seq the server received (u8) */
    ack: number;
}

interface CacheEntry {
    id: number;
    codec: ObjectCodec;
    /** generation: tick of the latest serialization */
    tick: number;
    /** tick of the serialization before it (-1: none) */
    prevTick: number;
    vals: number[];
    prevVals: number[];
    /** groups changed between prevTick and tick; -1 when a static field changed or there is no previous state */
    mask: number;
    full: Uint8Array | null;
    part: Uint8Array | null;
}

export interface CacheStats {
    /** views quantized (at most one per object per tick) */
    quantized: number;
    /** cache lookups answered without quantizing */
    hits: number;
    /** full / partial records built */
    fullBuilt: number;
    partBuilt: number;
}

/** Per-game serialization cache. Pass one instance to every ClientEncoder of a game. */
export class ObjectCache {
    readonly ctx: NetCtx;
    readonly stats: CacheStats = { quantized: 0, hits: 0, fullBuilt: 0, partBuilt: 0 };
    private readonly entries = new Map<number, CacheEntry>();
    private lastSweep = 0;

    constructor(ctx: NetCtx) {
        this.ctx = { width: ctx.width, height: ctx.height };
    }

    get size(): number {
        return this.entries.size;
    }

    /** The object's serialization for `tick` (quantized at most once per tick). */
    get(view: ObjectView, tick: number): CacheEntry {
        const codec = codecOf(view.kind);
        let e = this.entries.get(view.id);
        if (e && e.codec === codec) {
            if (e.tick === tick) {
                this.stats.hits++;
                return e;
            }
            const prev = e.vals;
            e.vals = e.prevVals;
            e.prevVals = prev;
            codec.quantize(view, this.ctx, e.vals);
            e.prevTick = e.tick;
            e.tick = tick;
            e.mask = diffMask(codec, e.prevVals, e.vals);
            e.full = null;
            e.part = null;
        } else {
            const vals: number[] = new Array(codec.fields.length).fill(0);
            codec.quantize(view, this.ctx, vals);
            e = {
                id: view.id,
                codec,
                tick,
                prevTick: -1,
                vals,
                prevVals: vals.slice(),
                mask: -1,
                full: null,
                part: null,
            };
            this.entries.set(view.id, e);
        }
        this.stats.quantized++;
        return e;
    }

    /** Full record bytes of an entry (built once per generation). */
    full(e: CacheEntry): Uint8Array {
        if (!e.full) {
            const w = new BitWriter(32);
            writeFullRecord(w, e.codec, e.id, e.vals);
            e.full = w.getBuffer();
            this.stats.fullBuilt++;
        }
        return e.full;
    }

    /** Partial record bytes (changes since `e.prevTick`); null when nothing changed. */
    part(e: CacheEntry): Uint8Array | null {
        if (e.mask <= 0) return null;
        if (!e.part) {
            const w = new BitWriter(16);
            writePartRecord(w, e.codec, e.id, e.vals, e.mask);
            e.part = w.getBuffer();
            this.stats.partBuilt++;
        }
        return e.part;
    }

    /** Drops entries not serialized since `minTick` (objects gone or out of every view). */
    sweep(minTick: number): void {
        for (const [id, e] of this.entries) if (e.tick < minTick) this.entries.delete(id);
    }

    /** Sweeps at most once per `interval` ticks, keeping `keepTicks` of history. */
    maybeSweep(tick: number, interval = 300, keepTicks = 300): void {
        if (tick - this.lastSweep < interval) return;
        this.lastSweep = tick;
        this.sweep(tick - keepTicks);
    }
}

export interface EncodeStats {
    full: number;
    part: number;
    deleted: number;
    bullets: number;
    bytes: number;
}

/** Per-client update encoder (one per connection). */
export class ClientEncoder {
    readonly cache: ObjectCache;
    /** tick at which this client last received each object it knows */
    private readonly known = new Map<number, number>();
    private activePlayerId = -1;
    private local: LocalQuant | null = null;
    private readonly present = new Set<number>();
    readonly last: EncodeStats = { full: 0, part: 0, deleted: 0, bullets: 0, bytes: 0 };

    constructor(cache: ObjectCache) {
        this.cache = cache;
    }

    /** number of objects the client currently knows */
    get knownCount(): number {
        return this.known.size;
    }

    /** Appends one Update message (type byte, payload, alignment) for `snap` to `w`. */
    write(w: BitWriter, snap: Snapshot, ack: number): void {
        const start = w.byteLength;
        const tick = snap.tick;
        const cache = this.cache;
        const fulls: Uint8Array[] = [];
        const parts: Uint8Array[] = [];
        const present = this.present;
        present.clear();
        for (const view of snap.objects) {
            present.add(view.id);
            const e = cache.get(view, tick);
            const knownAt = this.known.get(view.id);
            if (knownAt !== e.tick) {
                if (knownAt !== undefined && knownAt === e.prevTick && e.mask >= 0) {
                    const part = cache.part(e);
                    if (part) parts.push(part);
                } else {
                    fulls.push(cache.full(e));
                }
            }
            this.known.set(view.id, tick);
        }
        const deleted: number[] = [];
        for (const id of this.known.keys()) {
            if (present.has(id)) continue;
            deleted.push(id);
            this.known.delete(id);
        }
        deleted.sort((a, b) => a - b);
        const localQ = quantizeLocal(snap.local);
        const localMask = localDirtyMask(this.local, localQ);
        this.local = localQ;
        const bullets: readonly BulletEvent[] = snap.bullets ?? [];

        let flags = 0;
        if (deleted.length) flags |= UpdateFlag.DeletedObjects;
        if (fulls.length) flags |= UpdateFlag.FullObjects;
        if (parts.length) flags |= UpdateFlag.PartObjects;
        if (snap.localPlayerId !== this.activePlayerId) flags |= UpdateFlag.ActivePlayerId;
        if (localMask) flags |= UpdateFlag.LocalPlayer;
        if (bullets.length) flags |= UpdateFlag.Bullets;

        w.alignToNextByte();
        w.writeUint8(MsgType.Update);
        w.writeUint32(tick >>> 0);
        w.writeUint16(flags);
        w.writeUint8(ack & 0xff);
        if (deleted.length) {
            w.writeUint16(deleted.length);
            for (const id of deleted) w.writeUint16(id);
        }
        if (fulls.length) {
            w.writeUint16(fulls.length);
            for (const rec of fulls) w.writeBytes(rec);
        }
        if (parts.length) {
            w.writeUint16(parts.length);
            for (const rec of parts) w.writeBytes(rec);
        }
        if (flags & UpdateFlag.ActivePlayerId) {
            w.writeUint16(snap.localPlayerId);
            this.activePlayerId = snap.localPlayerId;
        }
        if (localMask) {
            writeLocal(w, localQ, localMask);
            w.alignToNextByte();
        }
        if (bullets.length) {
            writeBullets(w, cache.ctx, bullets);
            w.alignToNextByte();
        }
        w.alignToNextByte();
        const last = this.last;
        last.full = fulls.length;
        last.part = parts.length;
        last.deleted = deleted.length;
        last.bullets = bullets.length;
        last.bytes = w.byteLength - start;
    }

    /** One Update message as its own frame. */
    encode(snap: Snapshot, ack: number): Uint8Array<ArrayBuffer> {
        const w = new BitWriter(1024);
        this.write(w, snap, ack);
        return w.getBuffer();
    }
}

interface DecodedObject {
    codec: ObjectCodec;
    vals: number[];
}

/** Client-side Update decoder: applies deltas to its object cache and emits complete Snapshots. */
export class UpdateDecoder {
    readonly ctx: NetCtx;
    private readonly objects = new Map<number, DecodedObject>();
    private readonly local: LocalPlayerState = emptyLocalState();
    private localPlayerId = 0;

    constructor(ctx: NetCtx) {
        this.ctx = { width: ctx.width, height: ctx.height };
    }

    /** Reads an Update payload (after the type byte) and returns the full snapshot it describes. */
    read(r: BitReader): UpdateMsg {
        const tick = r.readUint32();
        const flags = r.readUint16();
        const ack = r.readUint8();
        if (flags & UpdateFlag.Reserved)
            throw new RangeError(`Update: unsupported section flags 0x${flags.toString(16)}`);
        const deletedIds: number[] = [];
        if (flags & UpdateFlag.DeletedObjects) {
            for (let n = r.readUint16(); n > 0; n--) {
                const id = r.readUint16();
                if (!this.objects.delete(id)) throw new RangeError(`Update: deleting unknown object ${id}`);
                deletedIds.push(id);
            }
        }
        if (flags & UpdateFlag.FullObjects) {
            for (let n = r.readUint16(); n > 0; n--) {
                const codec = codecByCode(r.readBits(OBJECT_TYPE_BITS));
                const id = r.readUint16();
                const vals = readFullFields(r, codec);
                r.alignToNextByte();
                this.objects.set(id, { codec, vals });
            }
        }
        if (flags & UpdateFlag.PartObjects) {
            for (let n = r.readUint16(); n > 0; n--) {
                const id = r.readUint16();
                const obj = this.objects.get(id);
                if (!obj) throw new RangeError(`Update: partial record for unknown object ${id}`);
                readPartFields(r, obj.codec, obj.vals);
                r.alignToNextByte();
            }
        }
        if (flags & UpdateFlag.ActivePlayerId) this.localPlayerId = r.readUint16();
        if (flags & UpdateFlag.LocalPlayer) {
            readLocal(r, this.local);
            r.alignToNextByte();
        }
        let bullets: BulletEvent[] = [];
        if (flags & UpdateFlag.Bullets) {
            bullets = readBullets(r, this.ctx);
            r.alignToNextByte();
        }
        const ids = [...this.objects.keys()].sort((a, b) => a - b);
        const objects: ObjectView[] = [];
        for (const id of ids) {
            const obj = this.objects.get(id)!;
            // fresh copies: callers may keep or mutate snapshots without touching the decoder state
            objects.push(obj.codec.build(id, obj.vals, this.ctx));
        }
        const snapshot: Snapshot = {
            tick,
            time: tick / TICK_HZ,
            localPlayerId: this.localPlayerId,
            local: cloneLocal(this.local),
            objects,
            deletedIds,
            bullets,
        };
        return { type: MsgType.Update, snapshot, ack };
    }

    /** number of objects currently known */
    get size(): number {
        return this.objects.size;
    }

    /** Decodes one Update message from `bytes` (type byte included). */
    decode(bytes: Uint8Array): UpdateMsg {
        const r = new BitReader(bytes);
        const type = r.readUint8();
        if (type !== MsgType.Update) throw new RangeError(`expected an Update message, got type ${type}`);
        return this.read(r);
    }
}
