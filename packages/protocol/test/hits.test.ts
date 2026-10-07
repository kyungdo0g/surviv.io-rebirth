// Hits section (rebirth hit feedback, user/2026-10-07-hit-feedback; schema 11): dealt, taken with and without a
// direction and self damage round-trip through the section and through a whole Update; the record sizes and the
// refusal of the still reserved extended flags.
import { BitReader, BitWriter } from "@rebirth/core";
import { PROTOCOL_SCHEMA_VERSION } from "@rebirth/defs";
import type { HitEvent, Snapshot } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    ClientEncoder,
    emptyLocalState,
    ObjectCache,
    readHits,
    UpdateDecoder,
    UpdateExtFlag,
    writeHits,
} from "../src/index.ts";

const ACTIVE = 42;

function roundTrip(list: HitEvent[], activeId = ACTIVE): { out: HitEvent[]; bits: number } {
    const w = new BitWriter();
    writeHits(w, list, activeId);
    const bytes = w.getBuffer();
    const r = new BitReader(bytes);
    const out = readHits(r, activeId);
    expect(r.bitIndex).toBe(bytes.length * 8);
    return { out, bits: bytes.length * 8 };
}

const dealt: HitEvent = { targetId: 7, sourceId: ACTIVE, amount: 13.5, damageType: 0, headshot: true, armored: false };
const taken: HitEvent = {
    targetId: ACTIVE,
    sourceId: 9,
    amount: 99,
    damageType: 0,
    headshot: false,
    armored: true,
    dir: { x: Math.cos(2), y: Math.sin(2) },
};

describe("Hits section", () => {
    it("is schema 11", () => {
        expect(PROTOCOL_SCHEMA_VERSION).toBeGreaterThanOrEqual(11);
        expect(UpdateExtFlag.Hits).toBe(1 << 9);
        expect(UpdateExtFlag.Reserved & UpdateExtFlag.Hits).toBe(0);
    });

    it("round-trips dealt, taken (with and without a direction), environment and self hits", () => {
        const gas: HitEvent = {
            targetId: ACTIVE,
            sourceId: 0,
            amount: 2.2,
            damageType: 2,
            headshot: false,
            armored: false,
        };
        const self: HitEvent = { ...taken, sourceId: ACTIVE, damageType: 0, dir: { x: 0, y: -1 } };
        const noDir: HitEvent = {
            targetId: ACTIVE,
            sourceId: 3,
            amount: 50,
            damageType: 4,
            headshot: false,
            armored: false,
        };
        const list = [dealt, taken, gas, self, noDir];
        const { out } = roundTrip(list);
        expect(out).toHaveLength(list.length);
        for (let i = 0; i < list.length; i++) {
            const a = out[i];
            const e = list[i];
            expect(a.targetId).toBe(e.targetId);
            expect(a.sourceId).toBe(e.sourceId);
            expect(a.damageType).toBe(e.damageType);
            expect(a.headshot).toBe(e.headshot);
            expect(a.armored).toBe(e.armored);
            // 8-bit amount over 0..100: half a step is 0.196
            expect(Math.abs(a.amount - e.amount)).toBeLessThanOrEqual(100 / 255 / 2 + 1e-9);
            if (e.dir) {
                const err = Math.abs(Math.atan2(a.dir!.y, a.dir!.x) - Math.atan2(e.dir.y, e.dir.x));
                // 8-bit angle: half a step is pi / 256 rad (0.7 degrees)
                expect(Math.min(err, Math.PI * 2 - err)).toBeLessThanOrEqual(Math.PI / 256 + 1e-9);
            } else {
                expect(a.dir).toBeUndefined();
            }
        }
    });

    it("never sends a direction for a dealt hit", () => {
        const { out } = roundTrip([{ ...dealt, dir: { x: 1, y: 0 } }]);
        expect(out[0].dir).toBeUndefined();
    });

    it("takes 31 bits per dealt hit and 39 per taken hit with a direction", () => {
        // u8 count, then the records, aligned
        expect(roundTrip([dealt]).bits).toBe(Math.ceil((8 + 31) / 8) * 8);
        expect(roundTrip([taken]).bits).toBe(Math.ceil((8 + 39) / 8) * 8);
        // a fully landed 9-pellet blast
        expect(roundTrip(Array.from({ length: 9 }, () => dealt)).bits / 8).toBe(36);
        expect(roundTrip(Array.from({ length: 9 }, () => taken)).bits / 8).toBe(45);
    });

    it("rides in an Update after the other sections and is absent when empty", () => {
        const ctx = { width: 720, height: 720 };
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new UpdateDecoder(ctx);
        const base: Snapshot = {
            tick: 10,
            time: 0,
            localPlayerId: ACTIVE,
            local: emptyLocalState(),
            objects: [],
            deletedIds: [],
        };
        const withHits = decoder.decode(encoder.encode({ ...base, hits: [dealt, taken] }, 0)).snapshot;
        expect(withHits.hits?.map((h) => [h.targetId, h.sourceId])).toEqual([
            [7, ACTIVE],
            [ACTIVE, 9],
        ]);
        const none = decoder.decode(encoder.encode({ ...base, tick: 11 }, 0)).snapshot;
        expect(none.hits).toBeUndefined();
    });
});
