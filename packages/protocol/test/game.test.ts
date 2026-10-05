// Encoder/decoder delta consistency against the real simulation: 8 players move, aim, shoot and use actions at
// random for 1200 ticks of a started match (a fast gas table so every gas mode shows, a forced air drop with its
// plane, falling crate, minimap marker and opening, scripted kills for a kill leader, dead players spectating);
// every netsync frame goes through the encoder (shared per-game cache) and a decoder fed by the Map message, and
// the decoded snapshot must equal Game.getSnapshot within quantization tolerance (deletions, loot, bullets, gas,
// planes, air drops, indicators, kills, role announcements, alive count, GameOver, spectating included). Inputs go
// through the Input codec, as on the server.
import { createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, type GasStage, getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
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

/** The gas stage table at 1/100 of the real durations (at least 0.3 s per stage). */
const FAST_GAS: GasStage[] = GameConfig.gas.stages.map((st, i) =>
    i === 0 ? st : { ...st, duration: Math.max(0.3, Math.round(st.duration) / 100) },
);

describe("Update encoder/decoder against the simulation", () => {
    it("decoded snapshots equal getSnapshot over 1200 ticks with 8 players", () => {
        const rng = createRng(2024);
        const game = new Game({ mapName: "main", seed: 4242 }, { gasStages: FAST_GAS });
        game.rules.minActiveTime = 0;
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

        const totals = {
            snapshots: 0,
            bullets: 0,
            hits: 0,
            deleted: 0,
            loot: 0,
            part: 0,
            full: 0,
            others: 0,
            gasModes: new Set<string>(),
            planes: 0,
            airdrops: 0,
            indicators: 0,
            deadIndicators: 0,
            kills: 0,
            roles: 0,
            gameOvers: 0,
            spectating: 0,
            buttons: 0,
            infos: 0,
            leavers: 0,
        };
        let lastBytes = 0;
        for (let tick = 1; tick <= 1200; tick++) {
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
            if (tick === 50) {
                // an air drop next to the bots; the plane starts 20 units before the drop point
                game.planes.addAirdrop(v2.add(center, { x: 0, y: -12 }));
                const plane = game.planes.planes.at(-1)!;
                plane.pos = v2.sub(plane.target, v2.mul(plane.dir, 20));
            }
            if (tick === 300) {
                // scripted kills make ids[1] the kill leader; the victims start spectating
                for (const victim of ids.slice(4, 7)) {
                    game.damagePlayer(game.getPlayer(victim)!, {
                        amount: 500,
                        damageType: DamageType.Player,
                        gameSourceType: "mp5",
                        sourceId: ids[1],
                    });
                }
            }
            if (tick === 310) for (const id of ids.slice(4, 7)) game.spectate(id, "begin");
            if (tick === 420) game.spectate(ids[4], "next");
            if (tick === 900) {
                // a living bot opens the landed crate
                const crate = [...game.world.objects.values()].find((o) => o.type.startsWith("airdrop_crate_"));
                const opener = ids.map((id) => game.getPlayer(id)).find((p) => p && !p.dead);
                if (crate && opener) {
                    game.teleportPlayer(opener.id, v2.add(crate.pos, { x: 0, y: -4 }));
                    game.setInput(opener.id, { ...emptyInput(++seq & 0xff), actions: [Input.Interact] });
                }
            }
            game.step();
            if (game.tick % SNAPSHOT_EVERY_TICKS !== 0) continue;
            for (const bot of bots.values()) {
                const snap: Snapshot = game.getSnapshot(bot.id);
                const ack = bot.input.seq;
                const bytes = bot.shared.encodeFrame(snap, ack);
                // a private cache produces the same bytes: sharing the cache never changes what a client gets
                expect(bot.solo.encodeFrame(snap, ack)).toEqual(bytes);
                const msgs = bot.decoder.decode(bytes);
                const msg = msgs.find((m) => m.type === MsgType.Update);
                if (msg?.type !== MsgType.Update) throw new Error("expected an update");
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
                if (snap.gas) totals.gasModes.add(snap.gas.mode);
                totals.planes += snap.planes?.length ?? 0;
                totals.airdrops += snap.airdrops?.length ?? 0;
                totals.indicators += snap.mapIndicators?.length ?? 0;
                totals.deadIndicators += snap.mapIndicators?.filter((m) => m.dead).length ?? 0;
                totals.kills += snap.kills?.length ?? 0;
                totals.roles += snap.roleAnnouncements?.length ?? 0;
                totals.gameOvers += snap.gameOver ? 1 : 0;
                totals.spectating += snap.spectatingId ? 1 : 0;
                totals.buttons += snap.objects.filter((o) => o.kind === "obstacle" && o.button?.onOff).length;
                totals.infos += snap.playerInfos?.length ?? 0;
                totals.leavers += snap.deletedPlayerIds?.length ?? 0;
                lastBytes = bytes.length;
            }
        }
        expect(totals.snapshots).toBeGreaterThan(2500);
        expect(totals.bullets).toBeGreaterThan(50);
        expect(totals.hits).toBeGreaterThan(0);
        expect(totals.deleted).toBeGreaterThan(20);
        expect(totals.loot).toBeGreaterThan(0);
        expect(totals.others).toBeGreaterThan(totals.snapshots);
        expect(totals.part).toBeGreaterThan(totals.full);
        expect(lastBytes).toBeGreaterThan(0);
        expect([...totals.gasModes].sort()).toEqual(["moving", "waiting"]);
        expect(totals.planes).toBeGreaterThan(0);
        expect(totals.airdrops).toBeGreaterThan(0);
        expect(totals.indicators).toBeGreaterThan(0);
        expect(totals.deadIndicators).toBeGreaterThan(0);
        expect(totals.kills).toBeGreaterThan(8);
        expect(totals.roles).toBeGreaterThan(0);
        expect(totals.gameOvers).toBeGreaterThan(3);
        expect(totals.spectating).toBeGreaterThan(10);
        expect(totals.buttons).toBeGreaterThan(0);
        // 8 first snapshots listing 8 players, bot 8 joining (and its own first snapshot), bot 7 leaving
        expect(totals.infos).toBe(8 * 8 + 7 + 8);
        expect(totals.leavers).toBe(7);
        // the shared cache quantized each object once per tick and served the other clients from the cache
        expect(shared.stats.hits).toBeGreaterThan(shared.stats.quantized);
    }, 60_000);
});
