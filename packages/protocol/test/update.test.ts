// Update message property tests: random snapshot sequences (objects appearing, changing and leaving, local state,
// bullets, the M4 match state: gas, planes, air drops, map indicators, kill leader, spectating, and the events
// carried by separate messages: kills, role announcements, alive count, GameOver, PlayerStats) go through a
// ClientEncoder frame and a ServerMsgDecoder; every decoded snapshot must equal the input within quantization
// tolerance.
import { BitWriter, createRng, type Rng } from "@rebirth/core";
import type { MapIndicatorView, ObjectView, Snapshot } from "@rebirth/sim";
import { TICK_HZ } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    ClientEncoder,
    encodeMapMsg,
    MsgType,
    ObjectCache,
    ServerMsgDecoder,
    UpdateDecoder,
    UpdateExtFlag,
    UpdateFlag,
} from "../src/index.ts";
import { assertClose } from "./close.ts";
import {
    evolveIndicators,
    mutateLocal,
    mutateView,
    randAirdrops,
    randBullets,
    randCtx,
    randExplosions,
    randGameOver,
    randGas,
    randKills,
    randLocal,
    randPlanes,
    randPlayerInfos,
    randProjectiles,
    randRoles,
    randSmokes,
    randStats,
    randView,
    randZones,
    snapshotTolerances,
} from "./gen.ts";

interface Seq {
    nextId: { v: number };
    airdropIds: { v: number };
    indicators: Map<number, MapIndicatorView>;
}

function newSeq(rng: Rng): Seq {
    return { nextId: { v: rng.int(1, 60000) }, airdropIds: { v: rng.int(1, 60000) }, indicators: new Map() };
}

/** Match state and events of a random snapshot (indicators evolve consistently with `seq`). */
function matchFields(
    rng: Rng,
    ctx: { width: number; height: number },
    seq: Seq,
    prev: Snapshot | null,
    localPlayerId: number,
) {
    const gas =
        !prev?.gas || rng.bool(0.3)
            ? randGas(rng, ctx)
            : { ...prev.gas, gasT: rng.bool(0.5) ? rng.next() : prev.gas.gasT };
    const fields: Partial<Snapshot> = {
        gas,
        planes: randPlanes(rng),
        airdrops: randAirdrops(rng, ctx, seq.airdropIds),
        mapIndicators: evolveIndicators(rng, ctx, seq.indicators),
        kills: randKills(rng),
        roleAnnouncements: randRoles(rng),
        aliveCount: !prev || rng.bool(0.3) ? rng.int(0, 80) : prev.aliveCount,
        killLeader:
            !prev?.killLeader || rng.bool(0.2) ? { id: rng.int(0, 65535), kills: rng.int(0, 255) } : prev.killLeader,
        spectatingId: rng.bool(0.2) ? localPlayerId : 0,
        playerInfos: randPlayerInfos(rng),
        deletedPlayerIds: rng.bool(0.8) ? [] : Array.from({ length: rng.int(1, 4) }, () => rng.int(1, 65535)),
        explosions: randExplosions(rng, ctx),
        projectiles: randProjectiles(rng, ctx),
        smokes: randSmokes(rng, ctx),
        airstrikeZones: randZones(rng, ctx),
    };
    if (rng.bool(0.1)) fields.gameOver = randGameOver(rng);
    if (rng.bool(0.1)) fields.playerStats = randStats(rng);
    return fields;
}

/** Next snapshot of a random world: some objects leave, some change, some appear. */
function evolve(rng: Rng, ctx: { width: number; height: number }, prev: Snapshot, seq: Seq): Snapshot {
    const objects: ObjectView[] = [];
    const deletedIds: number[] = [];
    for (const o of prev.objects) {
        if (o.id !== prev.localPlayerId && rng.bool(0.15)) {
            deletedIds.push(o.id);
            continue;
        }
        objects.push(rng.bool(0.4) ? mutateView(rng, ctx, o) : o);
    }
    for (let n = rng.int(0, 6); n > 0; n--) objects.push(randView(rng, ctx, seq.nextId.v++));
    objects.sort((a, b) => a.id - b.id);
    return {
        tick: prev.tick + rng.int(1, 6),
        time: 0,
        localPlayerId: prev.localPlayerId,
        local: rng.bool(0.5) ? mutateLocal(rng, prev.local) : prev.local,
        objects,
        deletedIds,
        bullets: randBullets(rng, ctx),
        ...matchFields(rng, ctx, seq, prev, prev.localPlayerId),
    };
}

function firstSnapshot(rng: Rng, ctx: { width: number; height: number }, seq: Seq): Snapshot {
    const localPlayerId = seq.nextId.v++;
    const objects: ObjectView[] = [randView(rng, ctx, localPlayerId, "player")];
    for (let n = rng.int(0, 20); n > 0; n--) objects.push(randView(rng, ctx, seq.nextId.v++));
    return {
        tick: rng.int(0, 1000),
        time: 0,
        localPlayerId,
        local: randLocal(rng),
        objects,
        deletedIds: [],
        bullets: randBullets(rng, ctx),
        ...matchFields(rng, ctx, seq, null, localPlayerId),
    };
}

describe("Update message", () => {
    it("round-trips random snapshot sequences (2000 cases)", () => {
        const rng = createRng(77);
        let updates = 0;
        let partials = 0;
        let events = 0;
        for (let c = 0; c < 2000; c++) {
            const ctx = randCtx(rng);
            const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
            const encoder = new ClientEncoder(new ObjectCache(ctx));
            const decoder = new ServerMsgDecoder(ctx);
            const seq = newSeq(rng);
            let snap = firstSnapshot(rng, ctx, seq);
            for (let step = rng.int(1, 5); step > 0; step--) {
                const ack = rng.int(0, 255);
                const msgs = decoder.decode(encoder.encodeFrame(snap, ack));
                const msg = msgs.find((m) => m.type === MsgType.Update);
                if (msg?.type !== MsgType.Update) throw new Error("expected an update");
                const expected = { ...snap, time: snap.tick / TICK_HZ };
                assertClose(msg.snapshot, expected, tol, `case ${c}`);
                expect(msg.ack).toBe(ack);
                updates++;
                partials += encoder.last.part;
                events += (snap.kills?.length ?? 0) + (snap.gameOver ? 1 : 0);
                snap = evolve(rng, ctx, snap, seq);
            }
        }
        expect(updates).toBeGreaterThan(5000);
        expect(partials).toBeGreaterThan(1000);
        expect(events).toBeGreaterThan(1000);
    }, 60_000);

    it("refuses object ids that do not fit the u16 wire id", () => {
        const rng = createRng(8);
        const ctx = { width: 720, height: 720 };
        const seq = newSeq(rng);
        seq.nextId.v = 70_000;
        const snap = firstSnapshot(rng, ctx, seq);
        expect(() => new ClientEncoder(new ObjectCache(ctx)).encode(snap, 0)).toThrow(/u16/);
    });

    it("sends unchanged objects and local state as nothing", () => {
        const rng = createRng(5);
        const ctx = { width: 720, height: 720 };
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new UpdateDecoder(ctx);
        const seq = newSeq(rng);
        seq.nextId.v = 10;
        const snap = {
            ...firstSnapshot(rng, ctx, seq),
            bullets: [],
            planes: [],
            airdrops: [],
            spectatingId: 0,
            playerInfos: [],
            deletedPlayerIds: [],
            explosions: [],
            projectiles: [],
            smokes: [],
            airstrikeZones: [],
        };
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
        const seq = newSeq(rng);
        seq.nextId.v = 100;
        let snap = firstSnapshot(rng, ctx, seq);
        for (let i = 0; i < 60; i++) {
            const w = new BitWriter();
            if (i === 0) w.writeBytes(encodeMapMsg(map));
            a.writeFrame(w, snap, i);
            const msgs = decA.decode(w.getBuffer());
            const upd = msgs.find((m) => m.type === MsgType.Update);
            if (upd?.type !== MsgType.Update) throw new Error("expected an update");
            assertClose(upd.snapshot, { ...snap, time: snap.tick / TICK_HZ }, tol, `A ${i}`);
            // client B only receives every third update (as if the server skipped a congested socket)
            if (i % 3 === 0) {
                const wb = new BitWriter();
                if (i === 0) wb.writeBytes(encodeMapMsg(map));
                b.writeFrame(wb, snap, i);
                const mb = decB.decode(wb.getBuffer());
                const ub = mb.find((m) => m.type === MsgType.Update);
                if (ub?.type !== MsgType.Update) throw new Error("expected an update");
                // deletions and events accumulate over the skipped updates, so compare the state only
                assertClose(ub.snapshot.objects, snap.objects, tol, `B ${i}`);
                assertClose({ gas: ub.snapshot.gas }, { gas: snap.gas }, tol, `B gas ${i}`);
                assertClose(ub.snapshot.killLeader, snap.killLeader, tol, `B leader ${i}`);
                expect(ub.snapshot.aliveCount).toBe(snap.aliveCount);
                assertClose(
                    ub.snapshot.mapIndicators?.filter((m) => !m.dead),
                    snap.mapIndicators?.filter((m) => !m.dead),
                    tol,
                    `B indicators ${i}`,
                );
            }
            snap = evolve(rng, ctx, snap, seq);
        }
    });

    it("sends the match sections only when they change", () => {
        const rng = createRng(9);
        const ctx = { width: 720, height: 720 };
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new ServerMsgDecoder(ctx);
        const seq = newSeq(rng);
        const base = {
            ...firstSnapshot(rng, ctx, seq),
            bullets: [],
            planes: [],
            airdrops: [],
            mapIndicators: [{ id: 3, type: "ping_airdrop", pos: { x: 100, y: 200 }, dead: false, equipped: false }],
            kills: [],
            roleAnnouncements: [],
            spectatingId: 0,
            playerInfos: [],
            deletedPlayerIds: [],
            explosions: [],
            projectiles: [],
            smokes: [],
            airstrikeZones: [],
        };
        delete base.gameOver;
        delete base.playerStats;
        const flagsOf = (bytes: Uint8Array) =>
            bytes[bytes.indexOf(MsgType.Update) + 5] | (bytes[bytes.indexOf(MsgType.Update) + 6] << 8);
        const first = encoder.encodeFrame(base, 0);
        expect(first[0]).toBe(MsgType.AliveCounts);
        decoder.decode(first);
        // nothing changed: a bare update, no AliveCounts
        const same = encoder.encodeFrame({ ...base, tick: base.tick + 3 }, 0);
        expect(same[0]).toBe(MsgType.Update);
        expect(same.length).toBe(8);
        // gas progress only
        const gas = { ...base.gas!, gasT: (base.gas!.gasT + 0.5) % 1 };
        const t = encoder.encodeFrame({ ...base, tick: base.tick + 6, gas }, 0);
        const tf = (t[5] | (t[6] << 8)) & ~UpdateFlag.LocalPlayer;
        expect(tf).toBe(UpdateFlag.GasT);
        let snap = decoder.decode(t)[0];
        if (snap.type !== MsgType.Update) throw new Error("expected an update");
        expect(snap.snapshot.gas?.gasT).toBeCloseTo(gas.gasT, 4);
        expect(snap.snapshot.mapIndicators).toHaveLength(1);
        // the indicator dies: sent once dead, then forgotten
        const dead = encoder.encodeFrame(
            { ...base, tick: base.tick + 9, gas, mapIndicators: [{ ...base.mapIndicators[0], dead: true }] },
            0,
        );
        snap = decoder.decode(dead)[0];
        if (snap.type !== MsgType.Update) throw new Error("expected an update");
        expect(snap.snapshot.mapIndicators?.map((m) => m.dead)).toEqual([true]);
        const after = encoder.encodeFrame({ ...base, tick: base.tick + 12, gas, mapIndicators: [] }, 0);
        expect(flagsOf(after) & UpdateFlag.MapIndicators).toBe(0);
        snap = decoder.decode(after)[0];
        if (snap.type !== MsgType.Update) throw new Error("expected an update");
        expect(snap.snapshot.mapIndicators).toEqual([]);
        // a new alive count, a kill and a GameOver ride in the same frame as separate messages
        const k = randKills(createRng(3)).concat(randKills(createRng(4)));
        const frame = encoder.encodeFrame(
            {
                ...base,
                tick: base.tick + 15,
                gas,
                mapIndicators: [],
                aliveCount: 7,
                kills: k,
                gameOver: randGameOver(rng),
            },
            0,
        );
        const msgs = decoder.decode(frame);
        expect(msgs.map((m) => m.type)).toEqual([
            MsgType.AliveCounts,
            MsgType.Update,
            MsgType.GameOver,
            ...k.map(() => MsgType.Kill),
        ]);
        const upd = msgs[1];
        if (upd.type !== MsgType.Update) throw new Error("expected an update");
        expect(upd.snapshot.aliveCount).toBe(7);
        expect(upd.snapshot.kills).toEqual(k);
        expect(upd.snapshot.gameOver).toBeDefined();
        expect(new UpdateDecoder(ctx)).toBeDefined();
    });

    it("announces the M5 sections with the extended flags word and rejects undefined extended flags", () => {
        const rng = createRng(10);
        const ctx = { width: 720, height: 720 };
        const tol = snapshotTolerances(720);
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new UpdateDecoder(ctx);
        const seq = newSeq(rng);
        const base = {
            ...firstSnapshot(rng, ctx, seq),
            bullets: [],
            planes: [],
            airdrops: [],
            spectatingId: 0,
            playerInfos: [],
            deletedPlayerIds: [],
            explosions: [],
            projectiles: [],
            smokes: [],
            airstrikeZones: [],
        };
        decoder.decode(encoder.encode(base, 0));
        const effects = {
            ...base,
            tick: base.tick + 3,
            explosions: [{ type: "explosion_frag", pos: { x: 100, y: 200 }, layer: 0 }],
            projectiles: [{ id: 7, type: "frag", pos: { x: 101, y: 201 }, posZ: 1.5, dir: { x: 0, y: 1 }, layer: 0 }],
            smokes: [{ id: 3, pos: { x: 90, y: 210 }, rad: 6.2, layer: 0, interior: true }],
            airstrikeZones: [{ id: 1, pos: { x: 300, y: 300 }, rad: 60, duration: 10.5, zoneT: 0.25 }],
        };
        const bytes = encoder.encode(effects, 0);
        // type, tick, flags, ack, ext flags
        const flags = bytes[5] | (bytes[6] << 8);
        expect(flags).toBe(UpdateFlag.Extended);
        expect(bytes[8] | (bytes[9] << 8)).toBe(
            UpdateExtFlag.Explosions | UpdateExtFlag.Projectiles | UpdateExtFlag.Smokes | UpdateExtFlag.AirstrikeZones,
        );
        const decoded = decoder.decode(bytes).snapshot;
        assertClose(
            {
                explosions: decoded.explosions,
                projectiles: decoded.projectiles,
                smokes: decoded.smokes,
                airstrikeZones: decoded.airstrikeZones,
            },
            {
                explosions: effects.explosions,
                projectiles: effects.projectiles,
                smokes: effects.smokes,
                airstrikeZones: effects.airstrikeZones,
            },
            tol,
        );
        // nothing new: the lists come back empty and no extended word is sent
        const again = encoder.encode({ ...base, tick: base.tick + 6 }, 0);
        expect(again.length).toBe(8);
        expect(decoder.decode(again).snapshot.projectiles).toEqual([]);
        // an undefined extended section is refused
        const bad = Uint8Array.from(bytes);
        bad[9] |= 0x80;
        expect(() => new UpdateDecoder(ctx).decode(bad)).toThrow(/unsupported section flags/);
    });
});
