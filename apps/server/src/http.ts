// HTTP routes (Hono): health, stats, matchmaking (find_game -> /play URL + single-use token) and, when a built
// client exists, static files.
import { serveStatic } from "@hono/node-server/serve-static";
import { MapDefs } from "@rebirth/defs";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { ServerConfig } from "./config.ts";
import type { GameHost } from "./host.ts";

const FindGameBody = z.object({
    mapName: z.string().max(32).optional(),
    region: z.string().max(32).optional(),
});

/** ws(s)://host/play for a request, from PUBLIC_URL or the Host / X-Forwarded-Proto headers. */
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
        const mapName = body.data.mapName ?? config.defaultMap;
        if (!Object.hasOwn(MapDefs, mapName)) return c.json({ error: "invalid_map" }, 400);
        const room = host.findRoom(mapName);
        if (!room) return c.json({ error: "full" }, 503);
        const token = host.tokens.issue(room.id);
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
