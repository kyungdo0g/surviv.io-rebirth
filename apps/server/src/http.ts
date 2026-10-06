// HTTP routes (Hono): health, stats, matchmaking (find_game -> /play URL + single-use token; solo, or a single player
// queueing for duo / squad, M6a; a 50v50 map always queues into squads inside the factions, M7a) and, when a built
// client exists, static files.
import { serveStatic } from "@hono/node-server/serve-static";
import { MapDefs } from "@rebirth/defs";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { ServerConfig } from "./config.ts";
import type { GameHost } from "./host.ts";
import { resolveFindGame } from "./modes.ts";

const FindGameBody = z.object({
    mapName: z.string().max(32).optional(),
    region: z.string().max(32).optional(),
    /** 1 solo (default), 2 duo, 4 squad (M6a) */
    teamMode: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
    /** the original body's mode index (0 solo, 1 duo, 2 squad); `teamMode` wins when both are given */
    gameModeIdx: z.number().int().min(0).max(2).optional(),
    /** team modes: may be grouped with strangers (default true, the original "Auto Fill") */
    autoFill: z.boolean().optional(),
});

/** ws(s)://host/play for a request, from PUBLIC_URL or the Host / X-Forwarded-Host / X-Forwarded-Proto headers. */
export function playUrl(config: ServerConfig, reqUrl: string, headers: Headers): string {
    if (config.publicUrl) {
        const u = new URL("/play", config.publicUrl);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        return u.toString();
    }
    const url = new URL(reqUrl);
    const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.replace(":", "");
    const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? url.host;
    return `${proto === "https" ? "wss" : "ws"}://${host}/play`;
}

export function createApp(config: ServerConfig, host: GameHost): Hono {
    const app = new Hono();
    app.use("/api/*", cors());

    app.get("/health", (c) => c.json({ ok: true, games: host.rooms.size, players: host.playerCount }));

    app.get("/api/stats", (c) => {
        // a heap figure after a collection, when the process runs with --expose-gc (soak runs)
        const gc = (globalThis as { gc?: () => void }).gc;
        if (c.req.query("gc") === "1" && gc) gc();
        const stats = host.stats();
        // ?reset=1 restarts the timing windows (soak runs measure after a warm-up)
        if (c.req.query("reset") === "1") for (const room of host.rooms.values()) room.resetTimings();
        return c.json(stats);
    });

    // the play buttons and region populations (survev SiteInfoRes; M7b)
    app.get("/api/site_info", (c) =>
        c.json({
            modes: config.modes,
            pops: { local: { playerCount: host.playerCount, l10n: "en" } },
            youtube: { name: "", link: "" },
            twitch: [],
            country: "US",
            gitRevision: "rebirth",
            captchaEnabled: false,
            clientTheme: config.modes[0].mapName,
        }),
    );

    app.post("/api/find_game", async (c) => {
        let raw: unknown = {};
        const text = await c.req.text();
        if (text.trim()) {
            try {
                raw = JSON.parse(text);
            } catch {
                return c.json({ error: "invalid_request" }, 400);
            }
        }
        const body = FindGameBody.safeParse(raw);
        if (!body.success) return c.json({ error: "invalid_request" }, 400);
        if (body.data.mapName !== undefined && !Object.hasOwn(MapDefs, body.data.mapName)) {
            return c.json({ error: "invalid_map" }, 400);
        }
        // a button index plays its configured map and queue; a named map without a mode its event queue; 50v50 always
        // squads (M7a / M7b, modes.ts)
        const { mapName, teamMode } = resolveFindGame(config.modes, body.data);
        const room = host.findRoom(mapName, teamMode);
        if (!room) return c.json({ error: "full" }, 503);
        // a solo queuer in a team mode joins an auto-fill group (or a group of its own with autoFill false)
        const group = teamMode > 1 ? { autoFill: body.data.autoFill ?? true, partySize: 1 } : undefined;
        const token = host.tokens.issue(room.id, group);
        const url = `${playUrl(config, c.req.url, c.req.raw.headers)}?token=${encodeURIComponent(token)}`;
        return c.json({ url, token });
    });

    if (config.clientDist) {
        const root = config.clientDist;
        app.use("/*", serveStatic({ root }));
        // single-page fallback
        app.get("*", serveStatic({ root, path: "index.html" }));
    }
    return app;
}
