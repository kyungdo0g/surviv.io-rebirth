// HTTP routes of the moderation services (M8), mounted by http.ts:
//   POST   /api/report             a player reports another player of its match (protocol report.ts); 10/min per IP
//   GET    /api/admin/suspects     recent anti-cheat flags and the live scores of players in running games
//   GET    /api/admin/reports      stored reports, newest first (?limit, gameId, playerId, reason)
//   GET    /api/admin/bans         bans in force
//   POST   /api/admin/bans         add a ban {type: "ip" | "name", value, reason?, durationMinutes?}
//   DELETE /api/admin/bans/:id     lift a ban
// The admin routes need `Authorization: Bearer <ADMIN_TOKEN>` (or `X-Admin-Token`); without ADMIN_TOKEN they answer
// 403 admin_disabled. docs/deploy.md documents payloads and answers.
import { createHash, timingSafeEqual } from "node:crypto";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, Hono, MiddlewareHandler } from "hono";
import { z } from "zod";
import type { LiveScore } from "../anticheat/match.ts";
import type { ServerConfig } from "../config.ts";
import type { GameHost } from "../host.ts";
import type { Ban } from "./bans.ts";
import type { Moderation } from "./index.ts";
import { fileReport, ReportBody } from "./reports.ts";

/** Reports accepted per client address per minute (on top of REPORT_MAX_PER_MATCH per reporter). */
const REPORTS_PER_MINUTE_PER_IP = 10;
/** Largest JSON body of the moderation routes. */
const MAX_BODY_BYTES = 4096;
/** Live scores listed by /api/admin/suspects. */
const LIVE_LIMIT = 50;

/** The client address of a request: X-Forwarded-For's first entry behind a trusted proxy, else the socket's. */
export function requestIp(c: Context, trustProxy: boolean): string {
    if (trustProxy) {
        const first = c.req.header("x-forwarded-for")?.split(",")[0].trim();
        if (first) return first;
    }
    try {
        return getConnInfo(c).remote.address ?? "unknown";
    } catch {
        return "unknown";
    }
}

/** Constant-time comparison of two secrets (hashed first so lengths do not leak). */
export function secretEquals(given: string, expected: string): boolean {
    const a = createHash("sha256").update(given).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
}

function bearer(c: Context): string | null {
    const auth = c.req.header("authorization");
    const m = auth ? /^Bearer\s+(\S+)\s*$/i.exec(auth) : null;
    return m ? m[1] : (c.req.header("x-admin-token")?.trim() ?? null);
}

/** Middleware of the /api/admin routes. */
export function adminAuth(config: ServerConfig): MiddlewareHandler {
    return async (c, next) => {
        if (!config.adminToken) return c.json({ error: "admin_disabled" }, 403);
        const given = bearer(c);
        if (!given || !secretEquals(given, config.adminToken)) return c.json({ error: "unauthorized" }, 401);
        await next();
    };
}

/** Fixed-window request counter per key (client address). */
export class RequestLimiter {
    private readonly max: number;
    private readonly windowMs: number;
    private readonly now: () => number;
    private readonly windows = new Map<string, { start: number; count: number }>();

    constructor(max: number, windowMs: number, now: () => number = Date.now) {
        this.max = max;
        this.windowMs = windowMs;
        this.now = now;
    }

    /** Counts a request; false when the key is over its limit. */
    hit(key: string): boolean {
        const now = this.now();
        let w = this.windows.get(key);
        if (!w || now - w.start >= this.windowMs) {
            w = { start: now, count: 0 };
            this.windows.set(key, w);
            if (this.windows.size > 10_000) this.sweep();
        }
        return ++w.count <= this.max;
    }

    sweep(): void {
        const now = this.now();
        for (const [k, w] of this.windows) if (now - w.start >= this.windowMs) this.windows.delete(k);
    }
}

async function jsonBody(c: Context): Promise<unknown> {
    const text = await c.req.text();
    if (text.length > MAX_BODY_BYTES) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function intQuery(c: Context, name: string, min: number, max: number): number | undefined {
    const raw = c.req.query(name);
    if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
    return Math.min(max, Math.max(min, Number(raw)));
}

const NewBanBody = z.object({
    type: z.enum(["ip", "name"]),
    value: z.string().min(1).max(64),
    reason: z.string().max(200).optional(),
    /** 0 or absent: permanent */
    durationMinutes: z
        .number()
        .int()
        .min(0)
        .max(10 * 365 * 24 * 60)
        .optional(),
});

export interface ModerationRouteDeps {
    config: ServerConfig;
    host: GameHost;
    moderation: Moderation;
    /** a ban was added: disconnect matching sessions, returns how many (server.ts) */
    onBan?: (ban: Ban) => number;
}

export function mountModerationRoutes(app: Hono, deps: ModerationRouteDeps): void {
    const { config, host, moderation } = deps;
    const limiter = new RequestLimiter(REPORTS_PER_MINUTE_PER_IP, 60_000);

    app.post("/api/report", async (c) => {
        if (!limiter.hit(requestIp(c, config.trustProxy))) return c.json({ error: "rate_limited" }, 429);
        const parsed = ReportBody.safeParse(await jsonBody(c));
        if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
        const header = c.req.header("authorization");
        const token = parsed.data.token ?? (header ? /^Bearer\s+(\S+)\s*$/i.exec(header)?.[1] : undefined);
        if (!token) return c.json({ error: "invalid_token" }, 401);
        const outcome = fileReport(
            {
                sessions: moderation.sessions,
                store: moderation.reports,
                maxPerMatch: config.reportMaxPerMatch,
                findMatch: (gameId) => host.getRoom(gameId)?.matchContext() ?? moderation.matches.get(gameId),
            },
            token,
            parsed.data,
        );
        if (!outcome.ok) return c.json({ error: outcome.error }, outcome.status);
        const r = outcome.record;
        if (config.log) {
            console.log(
                JSON.stringify({
                    level: "info",
                    event: "player_report",
                    id: r.id,
                    gameId: r.gameId,
                    reason: r.reason,
                    reporter: r.reporter.playerId,
                    reported: r.reported.playerId,
                    reportedName: r.reported.name,
                }),
            );
        }
        return c.json({ ok: true, id: r.id });
    });

    app.use("/api/admin/*", adminAuth(config));

    app.get("/api/admin/suspects", (c) => {
        const limit = intQuery(c, "limit", 1, 1000) ?? 100;
        const minScore = intQuery(c, "minScore", 0, 100);
        const gameId = c.req.query("gameId") || undefined;
        const live: LiveScore[] = [];
        for (const room of host.rooms.values()) {
            if (gameId && room.id !== gameId) continue;
            for (const s of room.telemetry?.liveScores() ?? []) {
                if (minScore === undefined ? s.score > 0 : s.score >= minScore) live.push(s);
            }
        }
        live.sort((a, b) => b.score - a.score);
        return c.json({
            antiCheat: config.antiCheat !== null,
            flagScore: config.antiCheat?.flagScore ?? null,
            flags: moderation.suspects.recent({ limit, gameId, minScore }),
            live: live.slice(0, LIVE_LIMIT),
        });
    });

    app.get("/api/admin/reports", (c) => {
        const reports = moderation.reports.recent({
            limit: intQuery(c, "limit", 1, 1000) ?? 100,
            gameId: c.req.query("gameId") || undefined,
            playerId: intQuery(c, "playerId", 0, 0xffff),
            reason: c.req.query("reason") || undefined,
        });
        return c.json({ reports });
    });

    app.get("/api/admin/bans", (c) => c.json({ bans: moderation.bans.list() }));

    app.post("/api/admin/bans", async (c) => {
        const parsed = NewBanBody.safeParse(await jsonBody(c));
        if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
        let ban: Ban;
        try {
            ban = moderation.bans.add(parsed.data);
        } catch (err) {
            return c.json({ error: "invalid_ban", message: (err as Error).message }, 400);
        }
        const kicked = deps.onBan?.(ban) ?? 0;
        if (config.log) console.log(JSON.stringify({ level: "info", event: "ban_added", ...ban, kicked }));
        return c.json({ ban, kicked }, 201);
    });

    app.delete("/api/admin/bans/:id", (c) => {
        const id = c.req.param("id");
        if (!moderation.bans.remove(id)) return c.json({ error: "not_found" }, 404);
        if (config.log) console.log(JSON.stringify({ level: "info", event: "ban_removed", id }));
        return c.json({ ok: true });
    });
}
