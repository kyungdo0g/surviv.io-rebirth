// Encoder/decoder against the simulation on event maps (M7b). Cobalt: six players wait in the Twins bunker, five pick
// a class through PerkModeRoleSelect frames (the sixth gets one after 20 s), all move to the surface, open a class pod
// (smartLoot: the opener's class crate) and break it. Potato: players break potatoes and kill each other (weapon swaps
// with their loot emotes), emote (always the potato), and get hit by potatoes (frozen pose + random drop). Every frame
// goes through the shared-cache encoder and a decoder fed by the Map message; the decoded snapshot must equal
// Game.getSnapshot within quantization tolerance, including the new PlayerView `frozen` / `frozenOri` fields.
import { createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { DamageType, WeaponSlot } from "@rebirth/defs";
import {
    emptyInput,
    Game,
    interactObstacle,
    type Obstacle,
    type PlayerInput,
    SNAPSHOT_EVERY_TICKS,
    type Snapshot,
} from "@rebirth/sim";
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

interface Client {
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
    return input;
}

/** A game with `n` clients sharing one object cache; `check` runs every netsync frame of every client. */
function harness(game: Game, n: number) {
    const mapFrame = encodeMapMsg(game.mapData);
    const ctx = { width: game.mapData.width, height: game.mapData.height };
    const cache = new ObjectCache(ctx);
    const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
    const clients: Client[] = [];
    for (let i = 0; i < n; i++) {
        const id = game.addPlayer(`c${i}`);
        const decoder = new ServerMsgDecoder();
        decoder.decode(mapFrame);
        clients.push({ id, input: emptyInput(0), encoder: new ClientEncoder(cache), decoder });
    }
    let frames = 0;
    const step = (onSnap?: (snap: Snapshot, c: Client) => void) => {
        game.step();
        if (game.tick % SNAPSHOT_EVERY_TICKS !== 0) return;
        for (const c of clients) {
            const snap = game.getSnapshot(c.id);
            const bytes = c.encoder.encodeFrame(snap, c.input.seq);
            const msg = c.decoder.decode(bytes).find((m) => m.type === MsgType.Update);
            if (msg?.type !== MsgType.Update) throw new Error("expected an update");
            assertClose(msg.snapshot, snap, tol, `tick ${game.tick} player ${c.id}`);
            frames++;
            onSnap?.(msg.snapshot, c);
        }
    };
    return { clients, step, frames: () => frames };
}

/** A dry spawnable spot near `from`. */
function spotNear(game: Game, from: Vec2): Vec2 {
    let spot = v2.copy(from);
    for (let k = 0; k < 400 && !game.canPlayerSpawn(spot); k++)
        spot = v2.add(from, { x: (k % 20) * 2, y: Math.floor(k / 20) * 2 });
    return spot;
}

describe("Update encoder/decoder against the simulation (M7b event maps)", () => {
    it("Cobalt: waiting room, class choice by message, timeout class, class pod; decoded == getSnapshot", () => {
        const rng = createRng(77);
        const game = new Game({ mapName: "cobalt", seed: 5 });
        game.rules.minActiveTime = 0;
        const h = harness(game, 6);
        const player = (id: number) => game.getPlayer(id)!;
        const room = game.world.buildings.find((b) => b.type === "bunker_twins_sublevel_01")!;
        const shell = [...game.world.objects.values()].find(
            (o): o is Obstacle => o.kind === "obstacle" && o.type === "class_shell_01",
        )!;
        expect(shell).toBeDefined();
        const classes = ["scout", "sniper", "healer", "demo", "assault"];
        let waitingSeen = 0;
        let classSeen = 0;
        let pods = 0;
        let seq = 0;
        for (let tick = 1; tick <= 2400; tick++) {
            if (tick === 40) {
                // the class choices arrive as PerkModeRoleSelect frames
                h.clients.slice(0, 5).forEach((c, i) => {
                    const msg = decodeClientFrame(
                        encodeClientMsg({ type: MsgType.PerkModeRoleSelect, role: classes[i] }),
                    )[0];
                    if (msg.type !== MsgType.PerkModeRoleSelect) throw new Error("expected a role select");
                    game.selectRole(c.id, msg.role);
                });
            }
            if (tick === 60) {
                // everyone with a class next to the pod, the scout opens it
                const at = spotNear(game, v2.add(shell.pos, { x: 0, y: -5 }));
                h.clients.slice(0, 5).forEach((c, i) => {
                    game.teleportPlayer(c.id, v2.add(at, { x: i * 1.5, y: 0 }), 0);
                });
                interactObstacle(game, shell, player(h.clients[0].id));
            }
            if (tick === 400) {
                const pod = [...game.world.objects.values()].find(
                    (o): o is Obstacle => o.kind === "obstacle" && o.type === "class_crate_common_scout",
                );
                expect(pod).toBeDefined();
                if (pod) {
                    game.damageObstacle(pod, {
                        amount: 10_000,
                        damageType: DamageType.Player,
                        sourceId: h.clients[1].id,
                    });
                }
            }
            for (const c of h.clients) {
                if (player(c.id).dead) continue;
                c.input = wander(rng, c.input, ++seq & 0xff);
                game.setInput(c.id, c.input);
            }
            h.step((snap, c) => {
                const self = snap.objects.find((o) => o.id === c.id);
                if (self?.kind !== "player") return;
                if (!self.role && self.layer === room.layer) waitingSeen++;
                if (self.role) classSeen++;
                pods += snap.objects.filter(
                    (o) => o.kind === "obstacle" && o.type.startsWith("class_crate_common_"),
                ).length;
            });
        }
        expect(h.clients.map((c) => player(c.id).role)).toEqual([...classes, player(h.clients[5].id).role]);
        expect(["scout", "sniper", "healer", "demo", "assault", "tank"]).toContain(player(h.clients[5].id).role);
        for (const c of h.clients) expect([player(c.id).layer, player(c.id).awaitingClass]).toEqual([0, false]);
        expect(waitingSeen).toBeGreaterThan(6 * 10);
        expect(classSeen).toBeGreaterThan(1000);
        expect(pods).toBeGreaterThan(0);
        expect(h.frames()).toBeGreaterThan(4000);
    }, 120_000);

    it("Potato: weapon swaps, potato emotes and frozen potato hits; decoded == getSnapshot", () => {
        const rng = createRng(78);
        const game = new Game({ mapName: "potato", seed: 6 });
        game.rules.minActiveTime = 0;
        const h = harness(game, 6);
        const player = (id: number) => game.getPlayer(id)!;
        const potatoes = [...game.world.objects.values()].filter(
            (o): o is Obstacle => o.kind === "obstacle" && o.type.startsWith("potato_0"),
        );
        expect(potatoes.length).toBeGreaterThan(10);
        const at = spotNear(game, v2.add(potatoes[0].pos, { x: 4, y: 0 }));
        h.clients.forEach((c, i) => {
            game.teleportPlayer(c.id, v2.add(at, { x: (i % 3) * 2, y: Math.floor(i / 3) * 2 }), 0);
            const p = player(c.id);
            p.weaponManager.setWeapon(WeaponSlot.Primary, "ak47", 30);
            p.inv.set("bandage", 5);
        });
        let frozenSeen = 0;
        let potatoEmotes = 0;
        let swaps = 0;
        let seq = 0;
        for (let tick = 1; tick <= 900; tick++) {
            if (tick === 30) {
                // a potato broken with the AK swaps the AK for another gun (with a loot emote)
                game.damageObstacle(potatoes[0], {
                    amount: 1000,
                    damageType: DamageType.Player,
                    gameSourceType: "ak47",
                    sourceId: h.clients[0].id,
                });
                swaps += player(h.clients[0].id).weaponManager.weapons[WeaponSlot.Primary].type !== "ak47" ? 1 : 0;
            }
            if (tick % 50 === 0) {
                const c = h.clients[(tick / 50) % 6];
                game.emote(c.id, { type: player(c.id).emoteLoadout[0], isPing: false });
            }
            if (tick === 100 || tick === 300) {
                const target = player(h.clients[2].id);
                game.explosions.add("explosion_potato", v2.add(target.pos, { x: -0.5, y: 0 }), 0, {
                    damageType: DamageType.Player,
                    gameSourceType: "potato",
                    sourceId: h.clients[3].id,
                });
            }
            if (tick === 500) {
                // a kill with the AK rotates the killer's AK too
                game.damagePlayer(player(h.clients[5].id), {
                    amount: 500,
                    damageType: DamageType.Player,
                    gameSourceType: "ak47",
                    sourceId: h.clients[4].id,
                });
                swaps += player(h.clients[4].id).weaponManager.weapons[WeaponSlot.Primary].type !== "ak47" ? 1 : 0;
            }
            for (const c of h.clients) {
                if (player(c.id).dead) continue;
                c.input = wander(rng, c.input, ++seq & 0xff);
                game.setInput(c.id, c.input);
            }
            h.step((snap) => {
                for (const o of snap.objects) if (o.kind === "player" && o.frozen) frozenSeen++;
                potatoEmotes += (snap.emotes ?? []).filter((e) => e.type === "emote_potato").length;
            });
        }
        expect(swaps).toBe(2);
        expect(frozenSeen).toBeGreaterThan(0);
        expect(potatoEmotes).toBeGreaterThan(0);
        expect(h.frames()).toBeGreaterThan(1500);
    }, 120_000);
});
