// M8 mobile support and regions through the server: touch stick validation, the Join's isMobile flag reaching the
// game, touch movement over the wire, REGION / REGION_SERVERS and /api/site_info.
import { GameConfig } from "@rebirth/defs";
import { HeadlessClient, type SiteInfoRes } from "@rebirth/protocol";
import { emptyInput } from "@rebirth/sim";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadConfig, makeConfig } from "../src/config.ts";
import { sanitizeInput } from "../src/input.ts";
import { parseRegionServers, regionL10n, siteRegions } from "../src/regions.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, sleep, until } from "./helpers.ts";

describe("touch input validation", () => {
    const prev = { x: 1, y: 0 };

    it("normalizes the stick direction and rounds and clamps its pull to 0..255", () => {
        const s = sanitizeInput(
            { ...emptyInput(), touchMoveActive: true, touchMoveDir: { x: 3, y: 4 }, touchMoveLen: 300 },
            prev,
        );
        expect(s.touchMoveActive).toBe(true);
        expect(s.touchMoveDir?.x).toBeCloseTo(0.6, 9);
        expect(s.touchMoveDir?.y).toBeCloseTo(0.8, 9);
        expect(s.touchMoveLen).toBe(255);
        const low = sanitizeInput(
            { ...emptyInput(), touchMoveActive: true, touchMoveDir: prev, touchMoveLen: -4 },
            prev,
        );
        expect(low.touchMoveLen).toBe(0);
        const mid = sanitizeInput(
            { ...emptyInput(), touchMoveActive: true, touchMoveDir: prev, touchMoveLen: 99.6 },
            prev,
        );
        expect(mid.touchMoveLen).toBe(100);
        const inf = sanitizeInput(
            { ...emptyInput(), touchMoveActive: true, touchMoveDir: prev, touchMoveLen: Number.POSITIVE_INFINITY },
            prev,
        );
        expect(inf.touchMoveLen).toBe(255);
        // no pull given: the original InputMsg default (255)
        expect(sanitizeInput({ ...emptyInput(), touchMoveActive: true, touchMoveDir: prev }, prev).touchMoveLen).toBe(
            255,
        );
    });

    it("ignores NaN: a NaN pull is 0, an unusable direction drops the stick", () => {
        const nanLen = sanitizeInput(
            { ...emptyInput(), touchMoveActive: true, touchMoveDir: prev, touchMoveLen: Number.NaN },
            prev,
        );
        expect(nanLen.touchMoveActive).toBe(true);
        expect(nanLen.touchMoveLen).toBe(0);
        for (const dir of [
            { x: Number.NaN, y: 1 },
            { x: 0, y: 0 },
            { x: Number.POSITIVE_INFINITY, y: 0 },
        ]) {
            const s = sanitizeInput(
                { ...emptyInput(), touchMoveActive: true, touchMoveDir: dir, touchMoveLen: 9 },
                prev,
            );
            expect(s.touchMoveActive).toBeUndefined();
            expect(s.touchMoveDir).toBeUndefined();
            expect(s.touchMoveLen).toBeUndefined();
        }
    });

    it("drops the stick fields while the stick is inactive", () => {
        const s = sanitizeInput(
            { ...emptyInput(), moveUp: true, touchMoveActive: false, touchMoveDir: prev, touchMoveLen: 200 },
            prev,
        );
        expect(s.moveUp).toBe(true);
        expect("touchMoveActive" in s || "touchMoveDir" in s || "touchMoveLen" in s).toBe(false);
    });
});

describe("regions (unit)", () => {
    it("REGION defaults to local; REGION_SERVERS lists region origins; empty values count as unset", () => {
        expect(loadConfig({})).toMatchObject({ region: "local", regionServers: {} });
        expect(loadConfig({ REGION: "", REGION_SERVERS: "" })).toMatchObject({ region: "local", regionServers: {} });
        const c = loadConfig({
            REGION: "eu",
            REGION_SERVERS: " kr=https://kr.example.com/ , na=http://10.0.0.5:8001,",
        });
        expect(c.region).toBe("eu");
        expect(c.regionServers).toEqual({ kr: "https://kr.example.com", na: "http://10.0.0.5:8001" });
        expect(Object.keys(c.regionServers)).toEqual(["kr", "na"]);
    });

    it("rejects bad region ids and URLs", () => {
        expect(() => loadConfig({ REGION: "Europe West" })).toThrow(/REGION/);
        expect(() => loadConfig({ REGION_SERVERS: "kr" })).toThrow(/REGION_SERVERS.*id=url/);
        expect(() => loadConfig({ REGION_SERVERS: "kr=not a url" })).toThrow(/REGION_SERVERS.*not a URL/);
        expect(() => loadConfig({ REGION_SERVERS: "kr=ftp://kr.example.com" })).toThrow(/http\(s\)/);
        expect(() => loadConfig({ REGION_SERVERS: "kr=https://example.com/kr" })).toThrow(/origin/);
        expect(() => loadConfig({ REGION_SERVERS: "kr=https://a.example.com,kr=https://b.example.com" })).toThrow(
            /twice/,
        );
        expect(() => parseRegionServers("KR=https://kr.example.com")).toThrow(/region id/);
        expect(parseRegionServers("")).toEqual({});
    });

    it('site regions: this server first with origin "", its own entry in REGION_SERVERS ignored', () => {
        const servers = parseRegionServers(
            "na=https://na.example.com,eu=https://eu.example.com,kr=https://kr.example.com",
        );
        const regions = siteRegions("eu", servers);
        expect(regions).toEqual({ eu: "", na: "https://na.example.com", kr: "https://kr.example.com" });
        expect(Object.keys(regions)).toEqual(["eu", "na", "kr"]);
        expect(siteRegions("local", {})).toEqual({ local: "" });
        // the original region labels (index.html #server-opts), "index-local" for any other id (survev config.ts)
        expect(["na", "sa", "eu", "as", "kr", "local", "mars"].map(regionL10n)).toEqual([
            "index-north-america",
            "index-south-america",
            "index-europe",
            "index-asia",
            "index-korea",
            "index-local",
            "index-local",
        ]);
    });
});

let server: RunningServer;
const clients: HeadlessClient[] = [];

beforeAll(async () => {
    server = await startServer(
        makeConfig({
            port: 0,
            log: false,
            emptyGameGraceMs: 100,
            region: "kr",
            regionServers: parseRegionServers("eu=https://eu.example.com,kr=https://self.example.com"),
        }),
    );
});

afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await until(() => server.sessions.size === 0, 3000, "sessions to close");
});

afterAll(async () => {
    await server.close();
});

describe("regions through the server", () => {
    it("/api/site_info lists this region's population and every region's server", async () => {
        const c = await HeadlessClient.join({ baseUrl: server.url, name: "pop" });
        clients.push(c);
        const body = (await (await fetch(`${server.url}/api/site_info`)).json()) as SiteInfoRes;
        expect(body.pops).toEqual({ kr: { playerCount: 1, l10n: "index-korea" } });
        expect(body.regions).toEqual({ kr: "", eu: "https://eu.example.com" });
        expect(body.modes.length).toBe(3);
    });

    it("a server without regions answers for local", async () => {
        const plain = await startServer(makeConfig({ port: 0, log: false }));
        try {
            const body = (await (await fetch(`${plain.url}/api/site_info`)).json()) as SiteInfoRes;
            expect(body.pops).toEqual({ local: { playerCount: 0, l10n: "index-local" } });
            expect(body.regions).toEqual({ local: "" });
        } finally {
            await plain.close();
        }
    });
});

describe("mobile players through the server", () => {
    it("the Join's isMobile reaches the game (mobile zoom table); desktop clients stay desktop", async () => {
        const m = await HeadlessClient.join({ baseUrl: server.url, name: "touch", isMobile: true, useTouch: true });
        const d = await HeadlessClient.join({ baseUrl: server.url, name: "desk" });
        clients.push(m, d);
        const mp = roomOf(server, m.joined!.playerId).game.getPlayer(m.joined!.playerId)!;
        const dp = roomOf(server, d.joined!.playerId).game.getPlayer(d.joined!.playerId)!;
        expect(mp.isMobile).toBe(true);
        expect(dp.isMobile).toBe(false);
        const snap = await m.waitForSnapshot();
        expect(snap.local.zoom).toBe(GameConfig.scopeZoomRadius.mobile["1xscope"]);
        expect((await d.waitForSnapshot()).local.zoom).toBe(GameConfig.scopeZoomRadius.desktop["1xscope"]);
    });

    it("walks along a touch stick sent over the wire", async () => {
        const c = await HeadlessClient.join({ baseUrl: server.url, name: "stick", isMobile: true });
        clients.push(c);
        const id = c.joined!.playerId;
        const room = roomOf(server, id);
        const start = { ...room.game.getPlayer(id)!.pos };
        c.sendInput({ ...emptyInput(7), touchMoveActive: true, touchMoveDir: { x: 0, y: -1 }, touchMoveLen: 90 });
        await c.waitForSnapshot(() => c.ack === 7);
        await sleep(200);
        const p = room.game.getPlayer(id)!;
        expect(p.input.touchMoveActive).toBe(true);
        expect(p.input.touchMoveLen).toBe(90);
        expect(p.input.touchMoveDir?.y).toBeCloseTo(-1, 3);
        expect(p.pos.y).toBeLessThan(start.y);
    });
});
