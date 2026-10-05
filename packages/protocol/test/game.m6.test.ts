// Encoder/decoder against the simulation in squad mode (M6a): three groups move and aim at random next to each other;
// scripted knocks, a revive, a bleed-out, two team wipes, emotes, team-only emotes and pings (sent through the Emote
// message), dead players spectating their teammates, a disconnect, and the game over. Every netsync frame goes through
// the shared-cache encoder and a decoder fed by the Map message; the decoded snapshot (team HUD rows and emotes
// included) must equal Game.getSnapshot within quantization tolerance.
import { createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { DamageType, Input } from "@rebirth/defs";
import {
    type EmoteRequest,
    emptyInput,
    Game,
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

/** The input as the server sees it after the Input codec. */
function viaWire(input: PlayerInput): PlayerInput {
    const msg = decodeClientFrame(encodeClientMsg({ type: MsgType.Input, input }))[0];
    if (msg.type !== MsgType.Input) throw new Error("expected an input");
    return msg.input;
}

/** An emote request as the server sees it after the Emote codec. */
function emoteViaWire(emote: EmoteRequest): EmoteRequest {
    const msg = decodeClientFrame(encodeClientMsg({ type: MsgType.Emote, emote }))[0];
    if (msg.type !== MsgType.Emote) throw new Error("expected an emote");
    return msg.emote;
}

describe("Update encoder/decoder against the simulation (M6a squads)", () => {
    it("decoded snapshots equal getSnapshot through knocks, a revive, a bleed-out, team wipes, emotes and pings", () => {
        const rng = createRng(606);
        const game = new Game({ mapName: "main", seed: 4243, teamMode: 4 });
        game.rules.minActiveTime = 0;
        const mapFrame = encodeMapMsg(game.mapData);
        const ctx = { width: game.mapData.width, height: game.mapData.height };
        const cache = new ObjectCache(ctx);
        const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
        const house = game.mapData.objects.find((o) => o.type === "house_red_01")!;
        const center: Vec2 = { x: house.pos.x, y: house.pos.y - 18 };
        const bots = new Map<number, Bot>();
        let seq = 0;
        const addGroup = (key: string, n: number, dy: number) => {
            const ids: number[] = [];
            for (let i = 0; i < n; i++) {
                const id = game.addPlayer(`${key}${i}`, { group: key, partySize: n, autoFill: false });
                game.teleportPlayer(id, v2.add(center, { x: -6 + i * 3, y: dy }));
                const decoder = new ServerMsgDecoder();
                decoder.decode(mapFrame);
                bots.set(id, { id, input: emptyInput(0), encoder: new ClientEncoder(cache), decoder });
                ids.push(id);
            }
            return ids;
        };
        const A = addGroup("A", 4, -4);
        const B = addGroup("B", 3, 0);
        const C = addGroup("C", 2, 4);
        const player = (id: number) => game.getPlayer(id)!;
        const hitBy = (target: number, source: number, amount = 500) =>
            game.damagePlayer(player(target), {
                amount,
                damageType: DamageType.Player,
                gameSourceType: "mp5",
                sourceId: source,
                dir: { x: 0, y: 1 },
            });
        const emote = (id: number, req: EmoteRequest) => game.emote(id, emoteViaWire(req));

        const totals = {
            snapshots: 0,
            teamRows: 0,
            downedRows: 0,
            deadRows: 0,
            disconnectedRows: 0,
            emotes: 0,
            pings: 0,
            knocks: 0,
            kills: 0,
            stats: 0,
            gameOvers: 0,
            revives: 0,
            spectating: 0,
        };
        for (let tick = 1; tick <= 1100; tick++) {
            for (const bot of bots.values()) {
                if (player(bot.id).disconnected) continue;
                bot.input = wander(rng, bot.input, ++seq & 0xff);
                if (tick === 140 && bot.id === A[1]) bot.input = { ...bot.input, actions: [Input.Interact] };
                game.setInput(bot.id, viaWire(bot.input));
            }
            if (tick === 40) {
                emote(A[1], { type: "emote_thumbsup", isPing: false });
                emote(A[2], { type: "emote_medical", isPing: false });
                emote(B[0], { type: "ping_danger", isPing: true, pos: v2.add(center, { x: 20, y: 30 }) });
                emote(C[0], { type: "ping_coming", isPing: true, pos: { x: 3, y: 5 } });
            }
            // A0 knocked by B0, revived by A1 (standing next to it, Interact at tick 140)
            if (tick === 100) hitBy(A[0], B[0]);
            if (tick === 139) game.teleportPlayer(A[1], v2.add(player(A[0]).pos, { x: 1.5, y: 0 }));
            // C1 knocked by A3, nearly bled out: it bleeds out (tick 400) credited to A3, PlayerStats while C0 plays on
            if (tick === 200) hitBy(C[1], A[3]);
            if (tick === 220) player(C[1]).health = 3;
            // C0 dies, its group is out; it starts spectating
            if (tick === 500) hitBy(C[0], B[1]);
            if (tick === 520) game.spectate(C[0], "begin");
            // B1 and B2 knocked by A2, then B0 killed: team wipe, A wins
            if (tick === 600) {
                hitBy(B[1], A[2]);
                hitBy(B[2], A[2]);
            }
            if (tick === 650) game.spectate(B[1], "begin");
            if (tick === 700) emote(A[3], { type: "ping_help", isPing: true, pos: center });
            if (tick === 750) hitBy(B[0], A[2]);
            if (tick === 800) game.disconnectPlayer(A[3]);
            game.step();
            if (game.tick % SNAPSHOT_EVERY_TICKS !== 0) continue;
            for (const bot of bots.values()) {
                if (player(bot.id).disconnected) continue;
                const snap: Snapshot = game.getSnapshot(bot.id);
                const bytes = bot.encoder.encodeFrame(snap, bot.input.seq);
                const msgs = bot.decoder.decode(bytes);
                const msg = msgs.find((m) => m.type === MsgType.Update);
                if (msg?.type !== MsgType.Update) throw new Error("expected an update");
                assertClose(msg.snapshot, snap, tol, `tick ${game.tick} player ${bot.id}`);
                totals.snapshots++;
                const team = snap.local.team ?? [];
                totals.teamRows += team.length;
                totals.downedRows += team.filter((m) => m.downed).length;
                totals.deadRows += team.filter((m) => m.dead).length;
                totals.disconnectedRows += team.filter((m) => m.disconnected).length;
                totals.emotes += snap.emotes?.filter((e) => !e.isPing).length ?? 0;
                totals.pings += snap.emotes?.filter((e) => e.isPing).length ?? 0;
                totals.knocks += snap.kills?.filter((k) => k.downed).length ?? 0;
                totals.kills += snap.kills?.filter((k) => k.killed).length ?? 0;
                totals.stats += snap.playerStats ? 1 : 0;
                totals.gameOvers += snap.gameOver ? 1 : 0;
                totals.revives += snap.objects.filter((o) => o.kind === "player" && o.anim?.type === "revive").length;
                totals.spectating += snap.spectatingId ? 1 : 0;
            }
        }
        expect(player(A[0]).downed).toBe(false);
        expect(player(A[0]).health).toBeGreaterThan(0);
        expect(player(C[1]).dead && player(C[0]).dead).toBe(true);
        expect([B[0], B[1], B[2]].every((id) => player(id).dead)).toBe(true);
        expect(game.over).toBe(true);
        expect(game.match.winningTeamId).toBe(player(A[0]).groupId);
        expect(player(A[3]).kills).toBe(1);
        expect(player(A[2]).kills).toBe(3);
        expect(totals.snapshots).toBeGreaterThan(2500);
        expect(totals.teamRows).toBeGreaterThan(totals.snapshots);
        expect(totals.downedRows).toBeGreaterThan(0);
        expect(totals.deadRows).toBeGreaterThan(0);
        expect(totals.disconnectedRows).toBeGreaterThan(0);
        expect(totals.emotes).toBeGreaterThan(3);
        expect(totals.pings).toBeGreaterThan(3);
        // 4 knocks (A0, C1, B1, B2) seen by 9 players
        expect(totals.knocks).toBe(4 * 9);
        expect(totals.kills).toBeGreaterThan(20);
        expect(totals.stats).toBeGreaterThan(0);
        // groups C (2) and B (3) out, A (4) wins
        expect(totals.gameOvers).toBe(2 + 3 + 4);
        expect(totals.revives).toBeGreaterThan(0);
        expect(totals.spectating).toBeGreaterThan(10);
    }, 60_000);
});
