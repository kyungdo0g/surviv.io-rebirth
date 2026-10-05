// Encoder/decoder against the simulation in 50v50 (M7a): ten players of both factions move and aim at random next to
// each other; roles are handed out (Commander, Lieutenant, Medic with perks), perks are picked up and fired (Splinter
// side bullets, One in the Chamber tracers), Windwalk hastes a holder, the Commander dies and its Lieutenant takes over
// (rules.roles.commanderSuccession), Blue is cut down to its Lone Survivrs, and Red wins. Every netsync frame goes
// through the shared-cache encoder and a decoder fed by the Map message; the decoded snapshot (roles, perks, haste,
// tracer flags, per-faction alive counts, faction minimap rows) must equal Game.getSnapshot within quantization tolerance.
import { createRng, type Rng, v2 } from "@rebirth/core";
import { DamageType, WeaponSlot } from "@rebirth/defs";
import { emptyInput, Game, type PlayerInput, pickupLoot, SNAPSHOT_EVERY_TICKS, type Snapshot } from "@rebirth/sim";
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

interface Bot {
    id: number;
    input: PlayerInput;
    encoder: ClientEncoder;
    decoder: ServerMsgDecoder;
}

function wander(rng: Rng, prev: PlayerInput, seq: number): PlayerInput {
    const input: PlayerInput = { ...prev, seq, shootStart: false, shootHold: false, actions: [] };
    if (rng.bool(0.05)) {
        input.moveLeft = rng.bool(0.25);
        input.moveRight = rng.bool(0.25);
        input.moveUp = rng.bool(0.25);
        input.moveDown = rng.bool(0.25);
    }
    const a = Math.atan2(prev.toMouseDir.y, prev.toMouseDir.x) + rng.range(-0.3, 0.3);
    input.toMouseDir = { x: Math.cos(a), y: Math.sin(a) };
    input.toMouseLen = rng.range(0, 64);
    return input;
}

function viaWire(input: PlayerInput): PlayerInput {
    const msg = decodeClientFrame(encodeClientMsg({ type: MsgType.Input, input }))[0];
    if (msg.type !== MsgType.Input) throw new Error("expected an input");
    return msg.input;
}

describe("Update encoder/decoder against the simulation (M7a 50v50)", () => {
    it("decoded snapshots equal getSnapshot through promotions, perks, a succession, Lone Survivrs and the win", () => {
        const rng = createRng(707);
        const game = new Game({ mapName: "faction", seed: 99, teamMode: 4 });
        game.rules.minActiveTime = 0;
        game.rules.roles.commanderSuccession = true;
        const mapFrame = encodeMapMsg(game.mapData);
        const ctx = { width: game.mapData.width, height: game.mapData.height };
        const cache = new ObjectCache(ctx);
        const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
        const bots = new Map<number, Bot>();
        for (let i = 0; i < 10; i++) {
            const id = game.addPlayer(`f${i}`);
            const decoder = new ServerMsgDecoder();
            decoder.decode(mapFrame);
            bots.set(id, { id, input: emptyInput(0), encoder: new ClientEncoder(cache), decoder });
        }
        const player = (id: number) => game.getPlayer(id)!;
        const ids = [...bots.keys()];
        const red = ids.filter((id) => player(id).teamId === 1);
        const blue = ids.filter((id) => player(id).teamId === 2);
        expect([red.length, blue.length]).toEqual([5, 5]);
        // everyone near the map centre, factions 6 u apart, so they see each other
        let spot = { x: ctx.width / 2, y: ctx.height / 2 };
        for (let tries = 0; tries < 200 && !game.canPlayerSpawn(spot); tries++) spot = v2.add(spot, { x: 7, y: 3 });
        ids.forEach((id, i) => {
            game.teleportPlayer(id, v2.add(spot, { x: (i % 5) * 2, y: player(id).teamId === 1 ? 0 : 6 }));
        });
        const hitBy = (target: number, source: number) =>
            game.damagePlayer(player(target), {
                amount: 500,
                damageType: DamageType.Player,
                gameSourceType: "mp5",
                sourceId: source,
                dir: { x: 0, y: 1 },
            });
        const totals = { snapshots: 0, roles: 0, perks: 0, haste: 0, splinter: 0, saturated: 0, factionRows: 0 };
        const counts = new Set<string>();
        let seq = 0;
        for (let tick = 1; tick <= 900; tick++) {
            for (const bot of bots.values()) {
                if (player(bot.id).dead) continue;
                bot.input = wander(rng, bot.input, ++seq & 0xff);
                game.setInput(bot.id, viaWire(bot.input));
            }
            if (tick === 30) {
                game.roles.promote(player(red[0]), "leader");
                game.roles.promote(player(blue[0]), "leader");
                game.roles.promote(player(red[1]), "lieutenant");
                game.roles.promote(player(blue[1]), "medic");
            }
            if (tick === 60) {
                // Splinter and One in the Chamber on Red's third player, Windwalk on Blue's third
                const shooter = player(red[2]);
                // a loot perk swaps the previous one: Splinter is picked up, then One in the Chamber is a role-free extra
                const loot = game.loot.addLoot("splinter", shooter.pos, shooter.layer, 1, { pushSpeed: 0 })!;
                pickupLoot(game, shooter, loot);
                shooter.perks.push("chambered");
                shooter.weaponManager.setWeapon(WeaponSlot.Primary, "ak47", 30);
                shooter.weaponManager.setCurWeapIndex(WeaponSlot.Primary, true);
                const ww = game.loot.addLoot("windwalk", player(blue[2]).pos, 0, 1, { pushSpeed: 0 })!;
                pickupLoot(game, player(blue[2]), ww);
            }
            if (tick >= 80 && tick < 200 && tick % 20 === 0) {
                const b = bots.get(red[2])!;
                b.input = { ...b.input, shootStart: true, shootHold: true, toMouseDir: { x: 0, y: 1 } };
                game.setInput(b.id, viaWire(b.input));
            }
            if (tick === 300) game.rules.joinWindowSeconds = 0;
            // the Red Commander is killed for good: its Lieutenant takes over
            if (tick === 320) hitBy(red[0], blue[3]);
            if (tick === 340) hitBy(red[0], blue[3]);
            // Blue falls to its last two standing players, who become Lone Survivrs
            if (tick === 400) hitBy(blue[4], red[3]);
            if (tick === 420) hitBy(blue[4], red[3]);
            if (tick === 440) hitBy(blue[3], red[3]);
            if (tick === 460) hitBy(blue[3], red[3]);
            if (tick === 500) hitBy(blue[2], red[3]);
            if (tick === 520) hitBy(blue[2], red[3]);
            // then the rest of Blue
            if (tick === 700) for (const id of blue) if (!player(id).dead) hitBy(id, red[4]);
            if (tick === 720) for (const id of blue) if (!player(id).dead) hitBy(id, red[4]);
            game.step();
            if (game.tick % SNAPSHOT_EVERY_TICKS !== 0) continue;
            for (const bot of bots.values()) {
                const snap: Snapshot = game.getSnapshot(bot.id);
                const bytes = bot.encoder.encodeFrame(snap, bot.input.seq);
                const msg = bot.decoder.decode(bytes).find((m) => m.type === MsgType.Update);
                if (msg?.type !== MsgType.Update) throw new Error("expected an update");
                assertClose(msg.snapshot, snap, tol, `tick ${game.tick} player ${bot.id}`);
                totals.snapshots++;
                const players = snap.objects.filter((o) => o.kind === "player");
                totals.roles += players.filter((o) => o.kind === "player" && o.role).length;
                totals.perks += players.filter((o) => o.kind === "player" && (o.perks?.length ?? 0) > 0).length;
                totals.haste += players.filter((o) => o.kind === "player" && o.haste?.type !== "none").length;
                totals.splinter += snap.bullets?.filter((b) => b.splinter).length ?? 0;
                totals.saturated += snap.bullets?.filter((b) => b.saturated).length ?? 0;
                totals.factionRows += snap.factionStatus?.length ?? 0;
                if (snap.teamAliveCounts) counts.add(snap.teamAliveCounts.join(":"));
            }
        }
        expect(player(red[1]).role).toBe("leader");
        expect(player(red[1]).weaponManager.weapons[WeaponSlot.Secondary].type).toBe("m4a1");
        expect([player(blue[0]).role, player(blue[1]).role]).toEqual(["last_man", "last_man"]);
        expect(game.over).toBe(true);
        expect(game.match.winningTeamId).toBe(1);
        expect(totals.snapshots).toBeGreaterThan(2500);
        expect(totals.roles).toBeGreaterThan(1000);
        expect(totals.perks).toBeGreaterThan(1000);
        expect(totals.haste).toBeGreaterThan(0);
        expect(totals.splinter).toBeGreaterThan(0);
        expect(totals.saturated).toBeGreaterThan(0);
        expect(totals.factionRows).toBeGreaterThan(totals.snapshots * 4);
        expect(counts.has("5:5") && counts.has("4:0")).toBe(true);
    }, 90_000);
});
