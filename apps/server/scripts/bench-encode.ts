// Measures what the per-game serialization cache saves: 80 players in one game, every netsync encoded twice from
// the same snapshots, once with one ObjectCache shared by all encoders and once with a private cache per client
// (each client quantizing and serializing every object it sees itself). Two layouts: players spread over the map
// (random spawns) and clustered in a 60 x 34 area (late game / hot drop). Also checks both produce identical bytes.
//   node apps/server/scripts/bench-encode.ts
import { createRng, v2 } from "@rebirth/core";
import { getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import { ClientEncoder, ObjectCache } from "@rebirth/protocol";
import { emptyInput, Game, type PlayerInput, SNAPSHOT_EVERY_TICKS, type Snapshot } from "@rebirth/sim";

const PLAYERS = Number(process.env.PLAYERS ?? 80);
const TICKS = Number(process.env.TICKS ?? 900);
const GUNS = ["ak47", "mp5", "m870", "dp28", "famas", "mac10"];

interface Result {
    layout: string;
    netsyncs: number;
    snapshotMs: number;
    sharedMs: number;
    privateMs: number;
    sharedQuantized: number;
    privateQuantized: number;
    sharedRecords: number;
    privateRecords: number;
    bytesPerUpdate: number;
}

function run(layout: "spread" | "clustered"): Result {
    const rng = createRng(99);
    const game = new Game({ mapName: "main", seed: 777 });
    const ctx = { width: game.mapData.width, height: game.mapData.height };
    const center = { x: ctx.width / 2, y: ctx.height / 2 };
    const ids: number[] = [];
    for (let i = 0; i < PLAYERS; i++) {
        const id = game.addPlayer(`p${i}`);
        if (layout === "clustered")
            game.teleportPlayer(id, v2.add(center, { x: rng.range(-30, 30), y: rng.range(-17, 17) }));
        const p = game.getPlayer(id)!;
        const gun = GUNS[i % GUNS.length];
        const def = getDefOfType("gun", gun);
        p.backpack = "backpack03";
        p.inv.set(def.ammo, p.inv.capacity(def.ammo));
        p.weaponManager.setWeapon(WeaponSlot.Primary, gun, def.maxClip);
        p.weaponManager.setCurWeapIndex(WeaponSlot.Primary);
        ids.push(id);
    }
    const shared = new ObjectCache(ctx);
    const sharedEnc = new Map(ids.map((id) => [id, new ClientEncoder(shared)]));
    const privEnc = new Map(ids.map((id) => [id, new ClientEncoder(new ObjectCache(ctx))]));
    const inputs = new Map<number, PlayerInput>(ids.map((id) => [id, { ...emptyInput(0), toMouseLen: 10 }]));
    let snapshotMs = 0;
    let sharedMs = 0;
    let privateMs = 0;
    let netsyncs = 0;
    let bytes = 0;
    let updates = 0;
    let sharedRecords = 0;
    let privateRecords = 0;
    for (let t = 0; t < TICKS; t++) {
        for (const id of ids) {
            const prev = inputs.get(id)!;
            const a = Math.atan2(prev.toMouseDir.y, prev.toMouseDir.x) + rng.range(-0.2, 0.2);
            const input: PlayerInput = {
                ...prev,
                toMouseDir: { x: Math.cos(a), y: Math.sin(a) },
                shootStart: rng.bool(0.05),
                actions: rng.bool(0.01) ? [Input.Reload] : [],
            };
            if (rng.bool(0.02)) {
                input.moveLeft = rng.bool(0.3);
                input.moveRight = rng.bool(0.3);
                input.moveUp = rng.bool(0.3);
                input.moveDown = rng.bool(0.3);
                input.shootHold = rng.bool(0.3);
            }
            inputs.set(id, input);
            game.setInput(id, input);
        }
        game.step();
        if (game.tick % SNAPSHOT_EVERY_TICKS !== 0) continue;
        netsyncs++;
        const t0 = performance.now();
        const snaps: Snapshot[] = ids.map((id) => game.getSnapshot(id));
        const t1 = performance.now();
        const outShared: Uint8Array[] = [];
        for (let i = 0; i < ids.length; i++) outShared.push(sharedEnc.get(ids[i])!.encode(snaps[i], 0));
        const t2 = performance.now();
        const outPriv: Uint8Array[] = [];
        for (let i = 0; i < ids.length; i++) outPriv.push(privEnc.get(ids[i])!.encode(snaps[i], 0));
        const t3 = performance.now();
        snapshotMs += t1 - t0;
        sharedMs += t2 - t1;
        privateMs += t3 - t2;
        for (let i = 0; i < ids.length; i++) {
            if (!Buffer.from(outShared[i]).equals(Buffer.from(outPriv[i])))
                throw new Error("shared/private bytes differ");
            bytes += outShared[i].length;
            updates++;
        }
    }
    for (const e of privEnc.values()) {
        privateRecords += e.cache.stats.fullBuilt + e.cache.stats.partBuilt;
    }
    sharedRecords = shared.stats.fullBuilt + shared.stats.partBuilt;
    let privateQuantized = 0;
    for (const e of privEnc.values()) privateQuantized += e.cache.stats.quantized;
    return {
        layout,
        netsyncs,
        snapshotMs: snapshotMs / netsyncs,
        sharedMs: sharedMs / netsyncs,
        privateMs: privateMs / netsyncs,
        sharedQuantized: shared.stats.quantized / netsyncs,
        privateQuantized: privateQuantized / netsyncs,
        sharedRecords: sharedRecords / netsyncs,
        privateRecords: privateRecords / netsyncs,
        bytesPerUpdate: bytes / updates,
    };
}

const f = (v: number, d = 3) => v.toFixed(d);
for (const layout of ["spread", "clustered"] as const) {
    // first pass warms the JIT, the second is reported
    run(layout);
    const r = run(layout);
    console.log(
        `${r.layout.padEnd(9)} ${PLAYERS} players, ${r.netsyncs} netsyncs | getSnapshot x${PLAYERS}: ${f(r.snapshotMs)} ms` +
            ` | encode shared cache: ${f(r.sharedMs)} ms (${f(r.sharedQuantized, 0)} quantized, ${f(r.sharedRecords, 0)} records built)` +
            ` | private caches: ${f(r.privateMs)} ms (${f(r.privateQuantized, 0)} quantized, ${f(r.privateRecords, 0)} records built)` +
            ` | speedup x${f(r.privateMs / r.sharedMs, 2)} | ${f(r.bytesPerUpdate, 0)} B/update`,
    );
}
