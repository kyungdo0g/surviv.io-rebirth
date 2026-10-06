// Moderation units (M8): the name filter (normalization, Korean jamo, the shipped list), bans (addresses, subnets,
// name patterns, expiry, the file), report validation and storage, and the party lobby's use of the filter.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { GameHost } from "../src/host.ts";
import { BanList, nameKey, normalizeIp, validIpBan } from "../src/moderation/bans.ts";
import { recomposeJamo } from "../src/moderation/hangul.ts";
import { MatchArchive, type MatchContext, type PlayerRecord, ReportSessions } from "../src/moderation/matches.ts";
import { DEFAULT_NAME_FILTER_FILE, FILTERED_NAME, NameFilter, nameForms } from "../src/moderation/nameFilter.ts";
import { cleanReportText, fileReport, ReportStore } from "../src/moderation/reports.ts";
import { PartyLobby, PartyMember, type PartyServerMsg } from "../src/party.ts";

let dir: string;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rebirth-mod-"));
});
afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe("name filter", () => {
    const filter = NameFilter.fromFile(DEFAULT_NAME_FILTER_FILE);

    it("ships a short list", () => {
        expect(filter.entries.length).toBeGreaterThan(20);
        expect(filter.entries.length).toBeLessThan(80);
    });

    it("sees through case, spacing, punctuation, leetspeak, repeats, full-width and look-alike letters", () => {
        for (const name of [
            "nigger",
            "NiGgEr",
            "n i g g e r",
            "n.i.g.g.e.r",
            "N1GG3R",
            "niiiggggerrr",
            "ｎｉｇｇｅｒ",
            "nіgger", // Cyrillic і
            "xX_faggot_Xx",
            "Fag",
            "f4g",
            "hitler88",
        ]) {
            expect(filter.filter(name), name).toBe(FILTERED_NAME);
        }
    });

    it("sees through Korean spacing, inserted characters and jamo typed one by one", () => {
        for (const name of [
            "씨발",
            "씨 발",
            "씨1발",
            "시a발",
            "ㅅㅣㅂㅏㄹ",
            "ㅆㅣ발",
            "ㅅㅂ",
            "ㅅ ㅂ",
            "개새끼야",
            "병1신",
        ]) {
            expect(filter.filter(name), name).toBe(FILTERED_NAME);
        }
    });

    it("leaves innocent names alone", () => {
        for (const name of [
            "Player",
            "spicy",
            "Niger",
            "assassin",
            "grape",
            "Shiba",
            "조조",
            "옷방",
            "좆같은이름이아닌",
            "시바견",
            "김씨부인",
            "생존자",
            "surviv_kr",
        ]) {
            // "좆같은..." contains 좆같: filtered; everything else passes
            const expected = name.startsWith("좆같") ? FILTERED_NAME : name;
            expect(filter.filter(name), name).toBe(expected);
        }
    });

    it("supports whole-name entries and comments", () => {
        const f = new NameFilter(["# comment", "", "=bad", "worse # trailing comment"]);
        expect(f.entries.map((e) => e.source)).toEqual(["=bad", "worse"]);
        expect(f.filter("bad")).toBe(FILTERED_NAME);
        expect(f.filter("b a d 1")).toBe(FILTERED_NAME);
        expect(f.filter("badger")).toBe("badger");
        expect(f.filter("theworseone")).toBe(FILTERED_NAME);
    });

    it("recomposes jamo the way an IME does", () => {
        expect(recomposeJamo("ㅅㅣㅂㅏㄹ")).toBe("시발");
        expect(recomposeJamo("ㄱㅏㄴㅏ")).toBe("가나");
        expect(recomposeJamo("ㅂㅅ")).toBe("ㅂㅅ");
        expect(recomposeJamo("ㅎㅏㄴㄱㅡㄹ")).toBe("한글");
        expect(nameForms("시 a 발")).toContain("시발");
    });
});

describe("bans", () => {
    it("matches addresses, IPv4-mapped addresses and subnets", () => {
        const bans = new BanList(join(dir, "bans.json"));
        bans.add({ type: "ip", value: "203.0.113.7", reason: "aimbot" });
        bans.add({ type: "ip", value: "198.51.100.0/24" });
        bans.add({ type: "ip", value: "2001:db8::/32" });
        expect(bans.matchIp("203.0.113.7")?.reason).toBe("aimbot");
        expect(bans.matchIp("::ffff:203.0.113.7")).not.toBeNull();
        expect(bans.matchIp("198.51.100.200")).not.toBeNull();
        expect(bans.matchIp("198.51.101.1")).toBeNull();
        expect(bans.matchIp("2001:db8:1::5")).not.toBeNull();
        expect(bans.matchIp("2001:db9::5")).toBeNull();
        expect(bans.matchIp("unknown")).toBeNull();
        expect(normalizeIp("::FFFF:10.0.0.1")).toBe("10.0.0.1");
        expect(validIpBan("10.0.0.0/33")).toBe(false);
        expect(validIpBan("nope")).toBe(false);
        expect(() => bans.add({ type: "ip", value: "999.1.1.1" })).toThrow();
    });

    it("matches name patterns on the normalized name", () => {
        const bans = new BanList(null);
        bans.add({ type: "name", value: "*cheat*" });
        bans.add({ type: "name", value: "Exact Name" });
        expect(bans.matchName("xXCheaterXx")).not.toBeNull();
        expect(bans.matchName("c h e a t")).not.toBeNull();
        expect(bans.matchName("exactname")).not.toBeNull();
        expect(bans.matchName("exactname2")).not.toBeNull();
        expect(bans.matchName("my exact name")).toBeNull();
        expect(bans.check("192.0.2.1", "honest")).toBeNull();
        expect(nameKey("Ab C1!")).toBe("abc");
        expect(() => bans.add({ type: "name", value: "*" })).toThrow(/letters/);
    });

    it("expires bans, persists them and picks up edits to the file", () => {
        let now = Date.parse("2026-01-01T00:00:00Z");
        const file = join(dir, "sub", "bans.json");
        const bans = new BanList(file, () => now);
        const temp = bans.add({ type: "ip", value: "192.0.2.1", durationMinutes: 10 });
        const perm = bans.add({ type: "name", value: "griefer" });
        expect(temp.expiresAt).toBe("2026-01-01T00:10:00.000Z");
        expect(JSON.parse(readFileSync(file, "utf8")).bans).toHaveLength(2);
        // a second server process reading the same file
        expect(new BanList(file, () => now).list().map((b) => b.id)).toEqual([temp.id, perm.id]);
        now += 11 * 60_000;
        expect(bans.matchIp("192.0.2.1")).toBeNull();
        expect(bans.list().map((b) => b.id)).toEqual([perm.id]);
        expect(bans.remove(perm.id)).toBe(true);
        expect(bans.remove(perm.id)).toBe(false);
        expect(JSON.parse(readFileSync(file, "utf8")).bans).toEqual([]);
        // edited by hand: reloaded on the next check after a few seconds
        writeFileSync(file, JSON.stringify([{ id: "x", type: "ip", value: "192.0.2.9" }, { type: "bogus" }]));
        now += 6000;
        expect(bans.matchIp("192.0.2.9")?.id).toBe("x");
    });
});

function record(playerId: number, name: string, bot = false): PlayerRecord {
    return { playerId, name, ip: bot ? null : `192.0.2.${playerId}`, bot, telemetry: null };
}

describe("reports", () => {
    function setup(maxPerMatch = 3) {
        const sessions = new ReportSessions(60_000);
        const store = new ReportStore(join(dir, "data", "reports.jsonl"));
        const players = new Map([1, 2, 3, 4, 5].map((id) => [id, record(id, `p${id}`, id === 5)]));
        const match: MatchContext = {
            gameId: "game-1",
            mapName: "main",
            teamMode: 1,
            player: (id) => players.get(id) ?? null,
        };
        sessions.register("tok", { gameId: "game-1", playerId: 1, name: "p1", ip: "192.0.2.1" });
        const deps = { sessions, store, maxPerMatch, findMatch: (id: string) => (id === "game-1" ? match : null) };
        return { sessions, store, deps };
    }

    it("stores a valid report with both players' records", () => {
        const { store, deps } = setup();
        const out = fileReport(deps, "tok", { playerId: 2, reason: "cheating", text: "  aim\u0000bot \n lol " });
        expect(out.ok).toBe(true);
        const [r] = store.recent();
        expect(r).toMatchObject({
            gameId: "game-1",
            reason: "cheating",
            text: "aim bot lol",
            reporter: { playerId: 1, ip: "192.0.2.1" },
            reported: { playerId: 2, name: "p2", ip: "192.0.2.2" },
        });
        expect(readFileSync(store.file, "utf8").trim().split("\n")).toHaveLength(1);
    });

    it("refuses bad tokens, self reports, unknown players, duplicates and more than the per-match limit", () => {
        const { deps } = setup(3);
        expect(fileReport(deps, "nope", { playerId: 2, reason: "other" })).toMatchObject({ status: 401 });
        expect(fileReport(deps, "tok", { playerId: 1, reason: "other" })).toMatchObject({ error: "self_report" });
        expect(fileReport(deps, "tok", { playerId: 9, reason: "other" })).toMatchObject({ error: "unknown_player" });
        expect(fileReport(deps, "tok", { playerId: 2, reason: "other", gameId: "x" })).toMatchObject({
            error: "game_mismatch",
        });
        expect(fileReport(deps, "tok", { playerId: 2, reason: "teaming" }).ok).toBe(true);
        expect(fileReport(deps, "tok", { playerId: 2, reason: "name" })).toMatchObject({ status: 409 });
        expect(fileReport(deps, "tok", { playerId: 3, reason: "name" }).ok).toBe(true);
        // a bot can be reported (marked as such)
        const bot = fileReport(deps, "tok", { playerId: 5, reason: "cheating" });
        expect(bot.ok && bot.record.reported.bot).toBe(true);
        expect(fileReport(deps, "tok", { playerId: 4, reason: "other" })).toMatchObject({
            status: 429,
            error: "report_limit",
        });
    });

    it("lists reports newest first with filters", () => {
        const { store, deps, sessions } = setup(5);
        fileReport(deps, "tok", { playerId: 2, reason: "cheating" });
        fileReport(deps, "tok", { playerId: 3, reason: "name" });
        sessions.register("tok2", { gameId: "game-1", playerId: 4, name: "p4", ip: "192.0.2.4" });
        fileReport(deps, "tok2", { playerId: 2, reason: "cheating" });
        expect(store.recent().map((r) => [r.reporter.playerId, r.reported.playerId])).toEqual([
            [4, 2],
            [1, 3],
            [1, 2],
        ]);
        expect(store.recent({ playerId: 2 })).toHaveLength(2);
        expect(store.recent({ reason: "name" })).toHaveLength(1);
        expect(store.recent({ limit: 1 })).toHaveLength(1);
        expect(store.recent({ gameId: "other" })).toEqual([]);
        expect(new ReportStore(join(dir, "missing.jsonl")).recent()).toEqual([]);
        expect(cleanReportText(undefined)).toBe("");
    });

    it("keeps tokens and archived matches for the report window after the game closed", () => {
        let now = 0;
        const sessions = new ReportSessions(1000, () => now);
        const archive = new MatchArchive(1000, 2, () => now);
        sessions.register("t", { gameId: "g", playerId: 1, name: "a", ip: "" });
        archive.add({ gameId: "g", mapName: "main", teamMode: 1, players: [record(1, "a"), record(2, "b")] });
        now = 5000;
        // still running: no expiry
        expect(sessions.get("t")).not.toBeNull();
        sessions.onGameClosed("g");
        now = 5900;
        expect(sessions.get("t")?.playerId).toBe(1);
        expect(archive.get("g")).toBeNull();
        archive.add({ gameId: "g2", mapName: "main", teamMode: 1, players: [record(2, "b")] });
        expect(archive.get("g2")?.player(2)?.name).toBe("b");
        now = 6100;
        expect(sessions.get("t")).toBeNull();
        archive.add({ gameId: "g3", mapName: "main", teamMode: 1, players: [] });
        archive.add({ gameId: "g4", mapName: "main", teamMode: 1, players: [] });
        expect(archive.size).toBe(2);
    });
});

describe("party names", () => {
    it("go through the name filter", () => {
        const host = new GameHost(makeConfig({ log: false }));
        const filter = new NameFilter(["badword"]);
        const lobby = new PartyLobby({ host, mapName: "main", filterName: (n) => filter.filter(n) });
        const sent: PartyServerMsg[] = [];
        const m = new PartyMember({ send: (msg) => sent.push(msg), close: () => {} }, 0, "ws://x/play");
        lobby.handle(m, {
            type: "create",
            data: { roomData: { region: "kr", autoFill: true, gameModeIdx: 1 }, playerData: { name: "b4dw0rd" } },
        });
        expect(m.name).toBe(FILTERED_NAME);
        lobby.handle(m, { type: "changeName", data: { name: "friendly" } });
        expect(m.name).toBe("friendly");
        host.stop();
    });
});

describe("moderation config", () => {
    it("reads the M8 variables, with empty values as unset", async () => {
        const { loadConfig } = await import("../src/config.ts");
        const c = loadConfig({
            ADMIN_TOKEN: "",
            PUBLIC_URL: "",
            REPORTS_FILE: "x/reports.jsonl",
            REPORT_MAX_PER_MATCH: "5",
            NAME_FILTER: "0",
            ANTICHEAT_FLAG_SCORE: "75",
        });
        expect(c.adminToken).toBeNull();
        expect(c.publicUrl).toBeNull();
        expect(c.reportsFile).toBe(join(process.cwd(), "x/reports.jsonl"));
        expect(c.reportMaxPerMatch).toBe(5);
        expect(c.nameFilterFile).toBeNull();
        expect(c.antiCheat?.flagScore).toBe(75);
        expect(loadConfig({ ANTICHEAT: "false" }).antiCheat).toBeNull();
        expect(loadConfig({}).nameFilterFile).toBe(DEFAULT_NAME_FILTER_FILE);
        expect(() => loadConfig({ ADMIN_TOKEN: "short" })).toThrow(/ADMIN_TOKEN/);
    });
});
