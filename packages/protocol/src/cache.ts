// Per-game serialization cache of the Update encoder: an ObjectCache shared by every client of a game quantizes each
// object at most once per tick and builds its full/partial record bytes at most once per tick (lazily, when a client
// needs them). See update.ts for how ClientEncoder uses the generations.
import { BitWriter } from "@rebirth/core";
import type { ObjectView } from "@rebirth/sim";
import { codecOf, diffMask, type ObjectCodec, writeFullRecord, writePartRecord } from "./objects.ts";
import type { NetCtx } from "./quant.ts";

export interface CacheEntry {
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
