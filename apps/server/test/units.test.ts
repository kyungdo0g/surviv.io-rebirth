// Unit tests of the server parts that need no sockets: config validation, input sanitizing, tokens, tick loop.
import { Input } from "@rebirth/defs";
import { emptyInput, SNAPSHOT_EVERY_TICKS } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { loadConfig, makeConfig } from "../src/config.ts";
import { GameHost } from "../src/host.ts";
import { sanitizeInput } from "../src/input.ts";
import type { RoomMember } from "../src/room.ts";
import { sanitizeName } from "../src/session.ts";
import { SampleWindow } from "../src/stats.ts";
import { JoinTokens } from "../src/tokens.ts";

describe("config", () => {
    it("parses and validates the environment", () => {
        const c = loadConfig({ PORT: "9000", HOST: "0.0.0.0", MAX_PLAYERS: "40", MAP_NAME: "desert" });
        expect(c).toMatchObject({ port: 9000, host: "0.0.0.0", maxPlayers: 40, defaultMap: "desert" });
        expect(loadConfig({})).toMatchObject({ port: 8001, maxPlayers: 80, maxConnectionsPerIp: 5 });
        expect(() => loadConfig({ PORT: "http" })).toThrow(/PORT/);
        expect(() => loadConfig({ MAX_PLAYERS: "0" })).toThrow(/MAX_PLAYERS/);
        expect(() => loadConfig({ MAP_NAME: "atlantis" })).toThrow(/MAP_NAME/);
    });
});

describe("input validation", () => {
    it("normalizes directions, clamps lengths and drops unknown actions", () => {
        const s = sanitizeInput(
            {
                ...emptyInput(300),
                toMouseDir: { x: 3, y: 4 },
                toMouseLen: 1e9,
                actions: [Input.Reload, 99, Input.MoveLeft, Input.Fire, Input.Count, 1.5, Input.EquipPrimary],
            },
            { x: 1, y: 0 },
        );
        expect(s.seq).toBe(300 & 0xff);
        expect(s.toMouseDir.x).toBeCloseTo(0.6, 9);
        expect(s.toMouseDir.y).toBeCloseTo(0.8, 9);
        expect(s.toMouseLen).toBe(64);
        expect(s.actions).toEqual([Input.Reload, Input.EquipPrimary]);
        const zero = sanitizeInput({ ...emptyInput(), toMouseDir: { x: 0, y: 0 }, toMouseLen: -5 }, { x: 0, y: 1 });
        expect(zero.toMouseDir).toEqual({ x: 0, y: 1 });
        expect(zero.toMouseLen).toBe(0);
        const many = sanitizeInput({ ...emptyInput(), actions: Array(15).fill(Input.Reload) }, { x: 1, y: 0 });
        expect(many.actions.length).toBe(7);
    });

    it("cleans names", () => {
        expect(sanitizeName("  bob\u0007 ")).toBe("bob");
        expect(sanitizeName("\n")).toBe("Player");
    });
});

describe("join tokens", () => {
    it("are single-use and expire", () => {
        let now = 0;
        const tokens = new JoinTokens(10_000, () => now);
        const t = tokens.issue("g1");
        expect(tokens.pendingFor("g1")).toBe(1);
        expect(tokens.consume(t)).toBe("g1");
        expect(tokens.consume(t)).toBeNull();
        const late = tokens.issue("g1");
        now = 10_001;
        expect(tokens.pendingFor("g1")).toBe(0);
        expect(tokens.consume(late)).toBeNull();
        tokens.issue("g2");
        now = 30_000;
        tokens.sweep();
        expect(tokens.size).toBe(0);
    });
});

describe("game host", () => {
    it("runs fixed ticks from wall-clock time, caps catch-up and sends updates", () => {
        const host = new GameHost(makeConfig({ log: false, maxCatchUpTicks: 5 }));
        const room = host.createRoom("main");
        const frames: Uint8Array[] = [];
        const member: RoomMember = { ack: 0, bufferedAmount: 0, sendFrame: (b) => frames.push(b) };
        const { playerId, frame } = room.join(member, "x");
        expect(playerId).toBeGreaterThan(0);
        expect(frame.length).toBeGreaterThan(room.mapMsg.length);
        host.loop(1000);
        host.loop(1030); // 30 ms -> 3 ticks, one snapshot
        expect(room.game.tick).toBe(3);
        expect(frames.length).toBe(1);
        host.loop(2030); // a 1 s stall runs only 5 ticks and drops the rest
        expect(room.game.tick).toBe(8);
        expect(room.stats().droppedTicks).toBeGreaterThan(90);
        expect(frames.length).toBe(Math.floor(8 / SNAPSHOT_EVERY_TICKS));
        expect(room.stats().tickMs.count).toBe(8);
        room.leave(playerId, Date.now() - 60_000);
        host.sweep();
        expect(host.rooms.size).toBe(0);
    });

    it("skips updates for congested sockets", () => {
        const host = new GameHost(makeConfig({ log: false, maxBufferedBytes: 1024 }));
        const room = host.createRoom("main");
        let sent = 0;
        room.join({ ack: 0, bufferedAmount: 1 << 20, sendFrame: () => sent++ }, "slow");
        for (let i = 0; i < 6; i++) room.tick();
        expect(sent).toBe(0);
        expect(room.stats().skippedUpdates).toBe(2);
    });
});

describe("sample window", () => {
    it("reports percentiles", () => {
        const w = new SampleWindow(100);
        for (let i = 1; i <= 100; i++) w.add(i);
        const s = w.summary();
        expect(s.p50).toBe(51);
        expect(s.p99).toBe(100);
        expect(s.max).toBe(100);
        expect(s.mean).toBe(50.5);
    });
});
