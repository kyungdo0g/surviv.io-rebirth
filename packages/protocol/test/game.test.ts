// Encoder/decoder delta consistency against the real simulation: 8 players move, aim, shoot and use actions at
// random for 300 ticks; every snapshot goes through the Update encoder (shared per-game cache) and a decoder fed by
// the Map message, and must equal Game.getSnapshot within quantization tolerance (deletions, loot and bullets
// included). Inputs go through the Input codec, as on the server.
import { createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import { emptyInput, Game, type PlayerInput, SNAPSHOT_EVERY_TICKS, type Snapshot, TICK_HZ } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    ClientEncoder,
    decodeClientFrame,
    encodeClientMsg,
    encodeMapMsg,
    MsgType,
    ObjectCache,
    ServerMsgDecoder,
} from "../src/index.ts";
import { assertClose } from "./close.ts";
import { snapshotTolerances } from "./gen.ts";

const GUNS = ["mp5", "ak47", "m870", "dp28", "spas12", "m249", "mac10", "famas"];
const ACTIONS = [Input.Reload, Input.Loot, Input.Interact, Input.EquipPrimary, Input.EquipMelee, Input.EquipNextWeap];

interface Bot {
    id: number;
    input: PlayerInput;
    shared: ClientEncoder;
    solo: ClientEncoder;
    decoder: ServerMsgDecoder;
}

function giveGun(game: Game, id: number, gun: string): void {
    const p = game.getPlayer(id)!;
    const def = getDefOfType("gun", gun);
    p.backpack = "backpack03";
    p.inv.set(def.ammo, p.inv.capacity(def.ammo));
    p.weaponManager.setWeapon(WeaponSlot.Primary, gun, def.maxClip);
    p.weaponManager.setCurWeapIndex(WeaponSlot.Primary);
    p.weaponManager.weapons[WeaponSlot.Primary].cooldown = 0;
    p.weaponManager.freeSwitchTimer = 0;
}

function nextInput(rng: Rng, prev: PlayerInput, seq: number): PlayerInput {
    const input: PlayerInput = { ...prev, seq, shootStart: false, actions: [] };
    if (rng.bool(0.05)) {
        input.moveLeft = rng.bool(0.3);
        input.moveRight = rng.bool(0.3);
        input.moveUp = rng.bool(0.3);
        input.moveDown = rng.bool(0.3);
    }
    const a = Math.atan2(prev.toMouseDir.y, prev.toMouseDir.x) + rng.range(-0.3, 0.3);
    input.toMouseDir = { x: Math.cos(a), y: Math.sin(a) };
    input.toMouseLen = rng.range(0, 64);
    if (rng.bool(0.05)) input.shootHold = rng.bool(0.5);
    input.shootStart = rng.bool(0.1);
    if (rng.bool(0.03)) input.actions = [rng.pick(ACTIONS)];
    return input;
}

/** The input as the server sees it after the Input codec. */
function viaWire(input: PlayerInput): PlayerInput {
    const msg = decodeClientFrame(encodeClientMsg({ type: MsgType.Input, input }))[0];
    if (msg.type !== MsgType.Input) throw new Error("expected an input");
    return msg.input;
}

describe("Update encoder/decoder against the simulation", () => {
    it("decoded snapshots equal getSnapshot over 300 ticks with 8 players", () => {
        const rng = createRng(2024);
        const game = new Game({ mapName: "main", seed: 4242 });
        const mapFrame = encodeMapMsg(game.mapData);
        const ctx = { width: game.mapData.width, height: game.mapData.height };
        const shared = new ObjectCache(ctx);
        const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
        const house = game.mapData.objects.find((o) => o.type === "house_red_01")!;
        const center: Vec2 = { x: house.pos.x, y: house.pos.y - 18 };
        const bots = new Map<number, Bot>();
        let seq = 0;

        const addBot = (i: number) => {
            const id = game.addPlayer(`bot${i}`);
            game.teleportPlayer(id, v2.add(center, { x: rng.range(-12, 12), y: rng.range(-6, 6) }));
            if (i % 4 !== 3) giveGun(game, id, GUNS[i % GUNS.length]);
            const decoder = new ServerMsgDecoder();
            decoder.decode(mapFrame);
            bots.set(id, {
                id,
                input: { ...emptyInput(0), toMouseLen: 10, shootHold: true },
                shared: new ClientEncoder(shared),
                solo: new ClientEncoder(new ObjectCache(ctx)),
                decoder,
            });
        };
        for (let i = 0; i < 8; i++) addBot(i);

        const totals = { snapshots: 0, bullets: 0, hits: 0, deleted: 0, loot: 0, part: 0, full: 0, others: 0 };
        let lastBytes = 0;
        for (let tick = 1; tick <= 300; tick++) {
            for (const bot of bots.values()) {
                bot.input = nextInput(rng, bot.input, ++seq & 0xff);
                game.setInput(bot.id, viaWire(bot.input));
            }
            const ids = [...bots.keys()];
            if (tick === 90) game.teleportPlayer(ids[0], { x: ctx.width - center.x, y: ctx.height - center.y });
            if (tick === 180) game.teleportPlayer(ids[0], center);
            if (tick === 150) {
                game.removePlayer(ids[7]);
                bots.delete(ids[7]);
            }
            if (tick === 200) addBot(8);
            game.step();
            if (game.tick % SNAPSHOT_EVERY_TICKS !== 0) continue;
            for (const bot of bots.values()) {
                const snap: Snapshot = game.getSnapshot(bot.id);
                const ack = bot.input.seq;
                const bytes = bot.shared.encode(snap, ack);
                // a private cache produces the same bytes: sharing the cache never changes what a client gets
                expect(bot.solo.encode(snap, ack)).toEqual(bytes);
                const msgs = bot.decoder.decode(bytes);
                expect(msgs.length).toBe(1);
                const msg = msgs[0];
                if (msg.type !== MsgType.Update) throw new Error("expected an update");
                assertClose(msg.snapshot, snap, tol, `tick ${game.tick} player ${bot.id}`);
                expect(msg.snapshot.time).toBeCloseTo(game.tick / TICK_HZ, 9);
                expect(msg.ack).toBe(ack);
                totals.snapshots++;
                totals.bullets += snap.bullets?.length ?? 0;
                totals.hits += snap.bullets?.filter((b) => b.endDist !== undefined).length ?? 0;
                totals.deleted += snap.deletedIds.length;
                totals.loot += snap.objects.filter((o) => o.kind === "loot").length;
                totals.others += snap.objects.filter((o) => o.kind === "player" && o.id !== bot.id).length;
                totals.part += bot.shared.last.part;
                totals.full += bot.shared.last.full;
                lastBytes = bytes.length;
            }
        }
        expect(totals.snapshots).toBeGreaterThan(700);
        expect(totals.bullets).toBeGreaterThan(50);
        expect(totals.hits).toBeGreaterThan(0);
        expect(totals.deleted).toBeGreaterThan(20);
        expect(totals.loot).toBeGreaterThan(0);
        expect(totals.others).toBeGreaterThan(totals.snapshots);
        expect(totals.part).toBeGreaterThan(totals.full);
        expect(lastBytes).toBeGreaterThan(0);
        // the shared cache quantized each object once per tick and served the other clients from the cache
        expect(shared.stats.hits).toBeGreaterThan(shared.stats.quantized);
    }, 60_000);
});
