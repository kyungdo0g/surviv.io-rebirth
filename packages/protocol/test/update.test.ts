// Update message property tests: random snapshot sequences (objects appearing, changing and leaving, local state
// and bullets) go through a ClientEncoder and an UpdateDecoder; every decoded snapshot must equal the input within
// quantization tolerance.
import { BitWriter, createRng, type Rng } from "@rebirth/core";
import type { ObjectView, Snapshot } from "@rebirth/sim";
import { TICK_HZ } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { ClientEncoder, encodeMapMsg, MsgType, ObjectCache, ServerMsgDecoder, UpdateDecoder } from "../src/index.ts";
import { assertClose } from "./close.ts";
import { mutateLocal, mutateView, randBullets, randCtx, randLocal, randView, snapshotTolerances } from "./gen.ts";

/** Next snapshot of a random world: some objects leave, some change, some appear. */
function evolve(rng: Rng, ctx: { width: number; height: number }, prev: Snapshot, nextId: { v: number }): Snapshot {
    const objects: ObjectView[] = [];
    const deletedIds: number[] = [];
    for (const o of prev.objects) {
        if (o.id !== prev.localPlayerId && rng.bool(0.15)) {
            deletedIds.push(o.id);
            continue;
        }
        objects.push(rng.bool(0.4) ? mutateView(rng, ctx, o) : o);
    }
    for (let n = rng.int(0, 6); n > 0; n--) objects.push(randView(rng, ctx, nextId.v++));
    objects.sort((a, b) => a.id - b.id);
    return {
        tick: prev.tick + rng.int(1, 6),
        time: 0,
        localPlayerId: prev.localPlayerId,
        local: rng.bool(0.5) ? mutateLocal(rng, prev.local) : prev.local,
        objects,
        deletedIds,
        bullets: randBullets(rng, ctx),
    };
}

function firstSnapshot(rng: Rng, ctx: { width: number; height: number }, nextId: { v: number }): Snapshot {
    const localPlayerId = nextId.v++;
    const objects: ObjectView[] = [randView(rng, ctx, localPlayerId, "player")];
    for (let n = rng.int(0, 20); n > 0; n--) objects.push(randView(rng, ctx, nextId.v++));
    return {
        tick: rng.int(0, 1000),
        time: 0,
        localPlayerId,
        local: randLocal(rng),
        objects,
        deletedIds: [],
        bullets: randBullets(rng, ctx),
    };
}

describe("Update message", () => {
    it("round-trips random snapshot sequences (2000 cases)", () => {
        const rng = createRng(77);
        let updates = 0;
        let partials = 0;
        for (let c = 0; c < 2000; c++) {
            const ctx = randCtx(rng);
            const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
            const encoder = new ClientEncoder(new ObjectCache(ctx));
            const decoder = new UpdateDecoder(ctx);
            const nextId = { v: rng.int(1, 60000) };
            let snap = firstSnapshot(rng, ctx, nextId);
            for (let step = rng.int(1, 5); step > 0; step--) {
                const ack = rng.int(0, 255);
                const msg = decoder.decode(encoder.encode(snap, ack));
                const expected = { ...snap, time: snap.tick / TICK_HZ };
                assertClose(msg.snapshot, expected, tol, `case ${c}`);
                expect(msg.ack).toBe(ack);
                updates++;
                partials += encoder.last.part;
                snap = evolve(rng, ctx, snap, nextId);
            }
        }
        expect(updates).toBeGreaterThan(5000);
        expect(partials).toBeGreaterThan(1000);
    }, 60_000);

    it("refuses object ids that do not fit the u16 wire id", () => {
        const rng = createRng(8);
        const ctx = { width: 720, height: 720 };
        const snap = firstSnapshot(rng, ctx, { v: 70_000 });
        expect(() => new ClientEncoder(new ObjectCache(ctx)).encode(snap, 0)).toThrow(/u16/);
    });

    it("sends unchanged objects and local state as nothing", () => {
        const rng = createRng(5);
        const ctx = { width: 720, height: 720 };
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new UpdateDecoder(ctx);
        const snap = { ...firstSnapshot(rng, ctx, { v: 10 }), bullets: [] };
        const first = encoder.encode(snap, 0);
        decoder.decode(first);
        const again = encoder.encode({ ...snap, tick: snap.tick + 3 }, 0);
        // type, tick, flags, ack
        expect(again.length).toBe(8);
        const decoded = decoder.decode(again).snapshot;
        expect(decoded.objects.length).toBe(snap.objects.length);
        expect(decoded.deletedIds).toEqual([]);
    });

    it("works after a Map message in one frame and survives skipped updates with full records", () => {
        const rng = createRng(6);
        const ctx = { width: 768, height: 768 };
        const tol = snapshotTolerances(768);
        const cache = new ObjectCache(ctx);
        const a = new ClientEncoder(cache);
        const b = new ClientEncoder(cache);
        const decA = new ServerMsgDecoder();
        const decB = new ServerMsgDecoder();
        const map = {
            mapName: "main",
            seed: 1,
            width: 768,
            height: 768,
            shoreInset: 48,
            grassInset: 18,
            rivers: [],
            places: [],
            groundPatches: [],
            objects: [],
        };
        const nextId = { v: 100 };
        let snap = firstSnapshot(rng, ctx, nextId);
        for (let i = 0; i < 60; i++) {
            const w = new BitWriter();
            if (i === 0) w.writeBytes(encodeMapMsg(map));
            a.write(w, snap, i);
            const msgs = decA.decode(w.getBuffer());
            const upd = msgs[msgs.length - 1];
            if (upd.type !== MsgType.Update) throw new Error("expected an update");
            assertClose(upd.snapshot, { ...snap, time: snap.tick / TICK_HZ }, tol, `A ${i}`);
            // client B only receives every third update (as if the server skipped a congested socket)
            if (i % 3 === 0) {
                const wb = new BitWriter();
                if (i === 0) wb.writeBytes(encodeMapMsg(map));
                b.write(wb, snap, i);
                const mb = decB.decode(wb.getBuffer());
                const ub = mb[mb.length - 1];
                if (ub.type !== MsgType.Update) throw new Error("expected an update");
                // deletions accumulate over the skipped updates, so compare the object state only
                assertClose(ub.snapshot.objects, snap.objects, tol, `B ${i}`);
            }
            snap = evolve(rng, ctx, snap, nextId);
        }
    });
});
