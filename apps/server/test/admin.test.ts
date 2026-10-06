// Moderation end to end (M8): a real server with ADMIN_TOKEN, temporary report / ban / suspect files and headless
// clients: player reports over HTTP, the admin routes, bans at find_game / Join / live sessions, the name filter at
// Join and anti-cheat flags reaching /api/admin/suspects.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { DisconnectReason, HeadlessClient, submitReport } from "@rebirth/protocol";
import { emptyInput } from "@rebirth/sim";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mergeThresholds } from "../src/anticheat/thresholds.ts";
import { makeConfig } from "../src/config.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, until } from "./helpers.ts";

const ADMIN = "test-admin-token-0123456789";
let server: RunningServer;
let dir: string;
const clients: HeadlessClient[] = [];

async function join(name: string): Promise<HeadlessClient> {
    const c = await HeadlessClient.join({ baseUrl: server.url, name });
    clients.push(c);
    return c;
}

function admin(path: string, init: RequestInit = {}, token = ADMIN): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (init.body) headers.set("content-type", "application/json");
    return fetch(`${server.url}${path}`, { ...init, headers });
}

function report(body: object, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${server.url}/api/report`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
}

beforeAll(async () => {
    dir = mkdtempSync(joinPath(tmpdir(), "rebirth-admin-"));
    server = await startServer(
        makeConfig({
            port: 0,
            log: false,
            adminToken: ADMIN,
            reportsFile: joinPath(dir, "reports.jsonl"),
            banFile: joinPath(dir, "bans.json"),
            suspectsFile: joinPath(dir, "suspects.jsonl"),
            botFill: 6,
            botFillIntervalMs: 0,
            // long enough that a room never closes between a token being used and its Join arriving
            emptyGameGraceMs: 500,
            // a low bar so a short scripted stream is flagged: one run of 20 constant aim deltas is 25 points
            antiCheat: mergeThresholds({ flagScore: 20, constantAim: { minRun: 20, hardRuns: 1 } }),
        }),
    );
});

afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await until(() => server.sessions.size === 0, 3000, "sessions to close");
});

afterAll(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
});

describe("admin routes", () => {
    it("need the admin token", async () => {
        expect((await admin("/api/admin/suspects", {}, "")).status).toBe(401);
        expect((await admin("/api/admin/reports", {}, "wrong-token-wrong-token")).status).toBe(401);
        const ok = await admin("/api/admin/suspects");
        expect(ok.status).toBe(200);
        expect(await ok.json()).toMatchObject({ antiCheat: true, flagScore: 20, flags: [], live: [] });
        const alt = await fetch(`${server.url}/api/admin/bans`, { headers: { "x-admin-token": ADMIN } });
        expect(await alt.json()).toEqual({ bans: [] });
    });

    it("are disabled without ADMIN_TOKEN", async () => {
        const plain = await startServer(makeConfig({ port: 0, log: false, banFile: joinPath(dir, "none.json") }));
        try {
            const res = await fetch(`${plain.url}/api/admin/suspects`, {
                headers: { authorization: `Bearer ${ADMIN}` },
            });
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({ error: "admin_disabled" });
        } finally {
            await plain.close();
        }
    });
});

describe("reports", () => {
    it("are filed with the join token, limited, stored with telemetry and listed for admins", async () => {
        const alice = await join("alice");
        const bob = await join("bob");
        const aliceId = alice.joined!.playerId;
        const bobId = bob.joined!.playerId;
        const room = roomOf(server, aliceId);
        expect(roomOf(server, bobId)).toBe(room);
        expect(alice.joinToken).toBeTruthy();
        await until(() => room.bots!.count >= 3, 3000, "bots");
        const botIds = [...room.game.players()].map((p) => p.id).filter((id) => id !== aliceId && id !== bobId);

        const first = await submitReport(server.url, {
            token: alice.joinToken!,
            playerId: bobId,
            reason: "cheating",
            text: "aimbot from across the map",
        });
        expect(first.ok).toBe(true);
        expect(await (await report({ token: alice.joinToken, playerId: bobId, reason: "other" })).json()).toEqual({
            error: "duplicate",
        });
        expect((await report({ token: alice.joinToken, playerId: aliceId, reason: "other" })).status).toBe(400);
        expect((await report({ token: "not-a-token", playerId: bobId, reason: "other" })).status).toBe(401);
        expect((await report({ playerId: bobId, reason: "other" })).status).toBe(401);
        expect((await report({ token: alice.joinToken, playerId: bobId, reason: "nope" })).status).toBe(400);
        expect((await report({ token: alice.joinToken, playerId: 60000, reason: "other" })).status).toBe(404);
        // the token may come as a bearer header; a bot is reportable (and marked)
        const second = await report(
            { playerId: botIds[0], reason: "teaming" },
            { authorization: `Bearer ${alice.joinToken}` },
        );
        expect(second.status).toBe(200);

        const listed = await admin("/api/admin/reports");
        const { reports } = (await listed.json()) as { reports: any[] };
        expect(reports.map((r) => r.reported.playerId)).toEqual([botIds[0], bobId]);
        expect(reports[1]).toMatchObject({
            gameId: room.id,
            reason: "cheating",
            text: "aimbot from across the map",
            reporter: { playerId: aliceId, name: "alice", bot: false },
            reported: { playerId: bobId, name: "bob", bot: false },
        });
        expect(reports[1].reporter.telemetry.playerId).toBe(aliceId);
        expect(reports[1].reported.telemetry.playerId).toBe(bobId);
        expect(reports[1].reported.ip).toMatch(/127\.0\.0\.1/);
        expect(reports[0].reported).toMatchObject({ bot: true, telemetry: null });
        expect(readFileSync(joinPath(dir, "reports.jsonl"), "utf8").trim().split("\n")).toHaveLength(2);
        const filtered = await admin(`/api/admin/reports?playerId=${bobId}&reason=cheating`);
        expect(((await filtered.json()) as { reports: any[] }).reports).toHaveLength(1);

        // after the game closed the token still works (archived match), up to the per-match limit
        const token = alice.joinToken!;
        alice.close();
        bob.close();
        await until(() => !server.host.rooms.has(room.id), 4000, "room to close");
        expect((await report({ token, playerId: botIds[1], reason: "name" })).status).toBe(200);
        const limited = await report({ token, playerId: botIds[2], reason: "name" });
        expect(limited.status).toBe(429);
        expect(await limited.json()).toEqual({ error: "report_limit" });
    });
});

describe("name filter", () => {
    it("renames offensive players at Join", async () => {
        const c = await join("씨 발");
        const id = c.joined!.playerId;
        expect(roomOf(server, id).game.getPlayer(id)?.name).toBe("Player");
        const ok = await join("friendly");
        expect(roomOf(server, ok.joined!.playerId).game.getPlayer(ok.joined!.playerId)?.name).toBe("friendly");
    });
});

describe("bans", () => {
    it("refuse banned names at Join", async () => {
        const res = await admin("/api/admin/bans", {
            method: "POST",
            body: JSON.stringify({ type: "name", value: "*cheat*", reason: "name" }),
        });
        expect(res.status).toBe(201);
        const { ban } = (await res.json()) as { ban: { id: string } };
        try {
            const c = new HeadlessClient({ baseUrl: server.url, name: "xXcheaterXx" });
            await expect(c.connect()).rejects.toThrow();
            expect(c.disconnectReason).toBe(DisconnectReason.Banned);
        } finally {
            expect((await admin(`/api/admin/bans/${ban.id}`, { method: "DELETE" })).status).toBe(200);
        }
        expect((await admin(`/api/admin/bans/${ban.id}`, { method: "DELETE" })).status).toBe(404);
    });

    it("kick live sessions of a banned address and refuse it at find_game until lifted", async () => {
        const c = await join("victim");
        const res = await admin("/api/admin/bans", {
            method: "POST",
            body: JSON.stringify({ type: "ip", value: "127.0.0.0/8", reason: "test", durationMinutes: 5 }),
        });
        const body = (await res.json()) as { ban: { id: string; expiresAt: string }; kicked: number };
        try {
            expect(body.kicked).toBe(1);
            expect(body.ban.expiresAt).toBeTruthy();
            expect(await c.waitForDisconnect()).toBe(DisconnectReason.Banned);
            const find = await fetch(`${server.url}/api/find_game`, { method: "POST", body: "{}" });
            expect(find.status).toBe(403);
            expect(await find.json()).toEqual({ error: "banned" });
            const again = new HeadlessClient({ baseUrl: server.url, name: "again" });
            await expect(again.connect()).rejects.toThrow(/banned/);
            expect(again.disconnectReason).toBe(DisconnectReason.Banned);
            const listed = (await (await admin("/api/admin/bans")).json()) as { bans: Array<{ id: string }> };
            expect(listed.bans.map((b) => b.id)).toEqual([body.ban.id]);
            expect(JSON.parse(readFileSync(joinPath(dir, "bans.json"), "utf8")).bans).toHaveLength(1);
        } finally {
            await admin(`/api/admin/bans/${body.ban.id}`, { method: "DELETE" });
        }
        expect((await fetch(`${server.url}/api/find_game`, { method: "POST", body: "{}" })).status).toBe(200);
        const bad = await admin("/api/admin/bans", {
            method: "POST",
            body: JSON.stringify({ type: "ip", value: "x" }),
        });
        expect(bad.status).toBe(400);
    });
});

describe("anti-cheat flags", () => {
    it("reach /api/admin/suspects and the suspects file", async () => {
        const c = await join("spinner");
        const id = c.joined!.playerId;
        let angle = 0;
        for (let i = 0; i < 40; i++) {
            angle += 0.1;
            c.sendInput({ ...emptyInput(i), toMouseDir: { x: Math.cos(angle), y: Math.sin(angle) }, toMouseLen: 10 });
        }
        await until(() => server.moderation.suspects.size > 0, 4000, "a flag");
        const res = (await (await admin("/api/admin/suspects")).json()) as { flags: any[]; live: any[] };
        expect(res.flags[0]).toMatchObject({ playerId: id, name: "spinner", score: 25 });
        expect(res.flags[0].components[0].code).toBe("constant_aim");
        expect(res.flags[0].stats.aim.constantAimRuns).toBe(1);
        expect(res.live.find((s) => s.playerId === id)?.score).toBe(25);
        expect(existsSync(joinPath(dir, "suspects.jsonl"))).toBe(true);
    });
});
