// Bot fill (M6b): with BOT_FILL a game fills up with in-process bots while it is joinable, bots look like ordinary
// players to clients, a human joining a game at its target takes a bot's seat, bots stay out of the human player
// counts, a game whose humans all left still closes, and a network bot can play through the real protocol.
import { Bot, DIFFICULTY_PRESETS, NavGrid, NEUTRAL, NetworkBot, SKILL_TIERS } from "@rebirth/bots";
import { HeadlessClient } from "@rebirth/protocol";
import { Game } from "@rebirth/sim";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BotFill, type BotFillOptions } from "../src/bots.ts";
import { loadConfig, makeConfig } from "../src/config.ts";
import { GameRoom, type RoomMember } from "../src/room.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, until } from "./helpers.ts";

const FILL = 12;
let server: RunningServer;
const clients: Array<{ close(): void }> = [];

function playersIn(room: GameRoom): number {
    return [...room.game.players()].length;
}

async function join(name: string): Promise<HeadlessClient> {
    const c = await HeadlessClient.join({ baseUrl: server.url, name, keepHistory: true });
    clients.push(c);
    return c;
}

beforeAll(async () => {
    server = await startServer(
        makeConfig({ port: 0, log: false, botFill: FILL, botFillIntervalMs: 20, emptyGameGraceMs: 200 }),
    );
});

afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await until(() => server.sessions.size === 0, 3000, "sessions to close");
    for (const room of [...server.host.rooms.values()]) server.host.closeRoom(room);
});

afterAll(async () => {
    await server.close();
});

describe("config", () => {
    it("reads BOT_FILL and BOT_DIFFICULTY (bots off by default)", () => {
        expect(loadConfig({})).toMatchObject({ botFill: 0, botDifficulty: "mixed" });
        expect(loadConfig({ BOT_FILL: "40", BOT_DIFFICULTY: "normal" })).toMatchObject({
            botFill: 40,
            botDifficulty: "normal",
        });
        expect(loadConfig({ BOT_DIFFICULTY: "beginner" }).botDifficulty).toBe("beginner");
        expect(() => loadConfig({ BOT_DIFFICULTY: "insane" })).toThrow(/BOT_DIFFICULTY/);
        expect(() => loadConfig({ BOT_FILL: "-1" })).toThrow(/BOT_FILL/);
    });

    it("reads the population mix: BOT_SKILL_MIX (35/45/20 by default) and BOT_PERSONAS (on by default)", () => {
        expect(loadConfig({})).toMatchObject({
            botSkillMix: { beginner: 35, intermediate: 45, expert: 20 },
            botPersonas: true,
        });
        expect(loadConfig({ BOT_SKILL_MIX: "1, 1, 0", BOT_PERSONAS: "off" })).toMatchObject({
            botSkillMix: { beginner: 1, intermediate: 1, expert: 0 },
            botPersonas: false,
        });
        expect(() => loadConfig({ BOT_SKILL_MIX: "50,50" })).toThrow(/BOT_SKILL_MIX/);
        expect(() => loadConfig({ BOT_SKILL_MIX: "0,0,0" })).toThrow(/BOT_SKILL_MIX/);
        expect(() => loadConfig({ BOT_PERSONAS: "maybe" })).toThrow(/BOT_PERSONAS/);
    });
});

/** A main-map game filled by a BotFill with `n` bots (joined one per update, no game ticks). */
function filled(n: number, options: Partial<BotFillOptions> = {}): BotFill {
    const game = new Game({ mapName: "main", seed: 5, teamMode: 1 });
    const fill = new BotFill(game, { target: n, difficulty: "mixed", joinIntervalTicks: 0, seed: 99, ...options });
    for (let i = 0; i < n; i++) fill.update();
    return fill;
}

function botsOf(fill: BotFill) {
    return [...fill.game.players()].map((p) => ({ name: p.name, bot: fill.controller(p.id)?.bot }));
}

describe("bot fill population", () => {
    it("mixed: tiers come from shuffle bags of 20 (7/9/4), each bot's skill inside its band, with personas", () => {
        const fill = filled(40);
        const bots = botsOf(fill);
        expect(bots).toHaveLength(40);
        const tiers = { beginner: 0, intermediate: 0, expert: 0 };
        const personas = new Set<string>();
        for (const { bot } of bots) {
            if (!bot) throw new Error("bot not controlled");
            tiers[bot.skill.tier]++;
            const [lo, hi] = SKILL_TIERS[bot.skill.tier].band;
            expect(bot.skill.s).toBeGreaterThanOrEqual(lo);
            expect(bot.skill.s).toBeLessThanOrEqual(hi);
            expect(bot.persona).not.toBe(NEUTRAL);
            personas.add(bot.persona.name);
        }
        expect(tiers).toEqual({ beginner: 14, intermediate: 18, expert: 8 });
        expect(personas.size).toBeGreaterThanOrEqual(5);
    }, 30_000);

    it("names and seeds do not depend on the population settings; legacy presets keep their parameters", () => {
        const mixed = botsOf(filled(12));
        const legacy = botsOf(filled(12, { difficulty: "hard", personas: false }));
        expect(legacy.map((b) => b.name)).toEqual(mixed.map((b) => b.name));
        for (const { bot } of legacy) {
            expect(bot?.params).toBe(DIFFICULTY_PRESETS.hard);
            expect(bot?.persona).toBe(NEUTRAL);
        }
        // the brain's own stream is the same bot for bot: the same seed (personas and tiers draw from their own
        // streams). (Comparing the streams' state after the fill compared how far each brain had thought: BotFill
        // drives the bots already in while it adds the next, and a tier or persona thinks differently.)
        expect(mixed.map((b) => b.bot?.seed)).toEqual(legacy.map((x) => x.bot?.seed));
        expect(new Set(mixed.map((b) => b.bot?.seed)).size).toBe(mixed.length);
        // and a seed starts the same brain stream whatever the tier and persona drawn at construction
        const map = mixed[0].bot?.model.map;
        if (!map) throw new Error("no map");
        const first = (o: ConstructorParameters<typeof Bot>[1]) => new Bot(map, o).rng.next();
        expect(first({ seed: 4242, skill: "beginner", persona: "rusher" })).toBe(
            first({ seed: 4242, difficulty: "hard" }),
        );
        expect(first({ seed: 4242, skill: "expert", persona: "rat" })).toBe(first({ seed: 4242, difficulty: "hard" }));
        const experts = botsOf(filled(6, { difficulty: "expert" }));
        expect(experts.every((x) => x.bot?.skill.tier === "expert")).toBe(true);
        const mix = botsOf(filled(10, { skillMix: { beginner: 1, intermediate: 0, expert: 0 } }));
        expect(mix.every((x) => x.bot?.skill.tier === "beginner")).toBe(true);
    }, 30_000);
});

describe("bot fill over sockets", () => {
    it("fills the game to BOT_FILL, then a joining human takes a bot's seat", async () => {
        const alice = await join("alice");
        const room = roomOf(server, alice.joined!.playerId);
        await until(() => playersIn(room) === FILL, 5000, "the game to fill with bots");
        expect(room.bots?.count).toBe(FILL - 1);
        // bots look like players: the human's snapshots name all of them
        const names = new Map<number, string>();
        await until(
            () => {
                for (const snap of alice.history) for (const p of snap.playerInfos ?? []) names.set(p.playerId, p.name);
                return names.size >= FILL;
            },
            5000,
            "player infos of every bot",
        );
        expect([...names.values()].every((n) => n.length > 0)).toBe(true);
        // the fill stops at the target
        await new Promise((r) => setTimeout(r, 200));
        expect(playersIn(room)).toBe(FILL);
        // human player counts leave the bots out
        expect(room.playerCount).toBe(1);
        expect(room.stats()).toMatchObject({ players: 1, bots: FILL - 1 });
        const health = (await (await fetch(`${server.url}/health`)).json()) as { players: number };
        expect(health.players).toBe(1);

        const bob = await join("bob");
        expect(roomOf(server, bob.joined!.playerId)).toBe(room);
        expect(playersIn(room)).toBe(FILL);
        expect(room.bots?.count).toBe(FILL - 2);
        expect(room.playerCount).toBe(2);
        await bob.waitForSnapshot((s) => s.localPlayerId === bob.joined!.playerId);
    }, 20_000);

    it("closes a game whose humans left even though its bots still play", async () => {
        const carol = await join("carol");
        const room = roomOf(server, carol.joined!.playerId);
        await until(() => (room.bots?.count ?? 0) >= 3, 5000, "some bots");
        carol.close();
        await until(() => !server.host.rooms.has(room.id), 5000, "the room to close");
        expect(room.bots?.aliveCount).toBeGreaterThan(0);
    }, 20_000);

    it("a network bot joins and plays through the protocol", async () => {
        const human = await join("dave");
        const room = roomOf(server, human.joined!.playerId);
        const nb = await NetworkBot.join({ baseUrl: server.url, name: "netbot", seed: 3 });
        clients.push(nb);
        expect(roomOf(server, nb.playerId)).toBe(room);
        const player = room.game.getPlayer(nb.playerId)!;
        // walk somewhere 25 units away: perception, navigation and inputs all go through the wire
        const grid = NavGrid.forMap(nb.client.map!);
        const goal = grid.center(grid.nearestWalkable({ x: player.pos.x + 25, y: player.pos.y }, 15));
        nb.bot!.setOrder({ type: "goto", pos: goal });
        await until(() => Math.hypot(player.pos.x - goal.x, player.pos.y - goal.y) < 2.5, 10000, "the bot to arrive");
        expect(nb.bot?.model.snapshots).toBeGreaterThan(10);
    }, 20_000);
});

describe("bot fill in a full game", () => {
    const member: RoomMember = { ack: 0, bufferedAmount: 0, sendFrame: () => {} };

    it("a human still joins a game the bots filled to the mode's player limit", () => {
        const config = makeConfig({ log: false, botFill: 80, botFillIntervalMs: 0 });
        const room = new GameRoom(config, "main", 77, 0);
        for (let i = 0; i < 100 && playersIn(room) < 80; i++) room.tick();
        expect(playersIn(room)).toBe(80);
        // the game itself is full (80 living players), but a bot can give up its seat
        expect(room.game.canJoin()).toBe(false);
        expect(room.canJoin()).toBe(true);
        const { playerId } = room.join(member, "human");
        expect(room.game.getPlayer(playerId)).toBeDefined();
        expect(playersIn(room)).toBe(80);
        expect(room.bots?.count).toBe(79);
        for (let i = 0; i < 30; i++) room.tick();
        expect(room.bots?.errors).toBe(0);
        expect(playersIn(room)).toBe(80);
    }, 20_000);

    it("bots never join once the join window closed", () => {
        const config = makeConfig({ log: false, botFill: 10, botFillIntervalMs: 0, minPlayers: 1 });
        const room = new GameRoom(config, "main", 78, 0);
        room.join(member, "solo human");
        room.game.rules.minActiveTime = 0;
        room.game.rules.joinWindowSeconds = 0.05;
        for (let i = 0; i < 20; i++) room.tick();
        const count = playersIn(room);
        expect(room.game.canJoin()).toBe(false);
        // kill a few bots: the dead stay in the game, nobody replaces them after the window
        for (let i = 0; i < 200; i++) room.tick();
        expect(playersIn(room)).toBe(count);
    });
});
