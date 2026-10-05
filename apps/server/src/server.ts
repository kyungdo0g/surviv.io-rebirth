// Game server: Hono HTTP routes and the /play WebSocket (ws, noServer mode) on one Node HTTP server, plus the
// GameHost loop. `startServer` resolves once listening (port 0 picks a free port, as tests do).
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { createAdaptorServer } from "@hono/node-server";
import { CLOSE_CODE_DISCONNECT, DisconnectReason, NetLimits } from "@rebirth/protocol";
import { WebSocketServer } from "ws";
import type { ServerConfig } from "./config.ts";
import { GameHost } from "./host.ts";
import { createApp } from "./http.ts";
import { ClientSession } from "./session.ts";

/** WebSocket heartbeat period: a socket that misses one ping is dropped (survev idleTimeout 30 s). */
const HEARTBEAT_MS = 15_000;

export interface RunningServer {
    readonly config: ServerConfig;
    readonly host: GameHost;
    /** http://host:port */
    readonly url: string;
    readonly port: number;
    readonly sessions: ReadonlySet<ClientSession>;
    /** open game sockets per client IP */
    readonly connectionsPerIp: ReadonlyMap<string, number>;
    close(): Promise<void>;
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
    if (trustProxy) {
        const fwd = req.headers["x-forwarded-for"];
        const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0].trim();
        if (first) return first;
    }
    return req.socket.remoteAddress ?? "unknown";
}

function rejectUpgrade(socket: Duplex, status: number, text: string): void {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
}

export function startServer(config: ServerConfig): Promise<RunningServer> {
    const host = new GameHost(config);
    const app = createApp(config, host);
    const wss = new WebSocketServer({ noServer: true, maxPayload: NetLimits.MaxClientMsgBytes });
    const sessions = new Set<ClientSession>();
    const perIp = new Map<string, number>();

    const release = (s: ClientSession) => {
        sessions.delete(s);
    };

    host.onRoomClosed = (room) => {
        for (const s of sessions) if (s.room === room) s.disconnect(DisconnectReason.GameClosed);
    };

    return new Promise((resolve, reject) => {
        const server = createAdaptorServer({ fetch: app.fetch, hostname: config.host }) as Server;
        server.once("error", reject);

        server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (url.pathname !== "/play") {
                rejectUpgrade(socket, 404, "Not Found");
                return;
            }
            const ip = clientIp(req, config.trustProxy);
            if ((perIp.get(ip) ?? 0) >= config.maxConnectionsPerIp) {
                rejectUpgrade(socket, 429, "Too Many Requests");
                return;
            }
            // the slot is held for the lifetime of the TCP connection, whatever happens to the upgrade
            perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
            socket.once("close", () => {
                const n = (perIp.get(ip) ?? 1) - 1;
                if (n <= 0) perIp.delete(ip);
                else perIp.set(ip, n);
            });
            wss.handleUpgrade(req, socket, head, (ws) => {
                const session = new ClientSession(ws, ip, url.searchParams.get("token"), {
                    host,
                    config,
                    onClosed: release,
                });
                // the constructor may already have closed it (invalid token)
                if (session.state !== "closed") sessions.add(session);
            });
        });

        const heartbeat = setInterval(() => {
            for (const s of sessions) s.heartbeat();
        }, HEARTBEAT_MS);

        server.listen(config.port, config.host, () => {
            server.off("error", reject);
            const addr = server.address();
            const port = typeof addr === "object" && addr ? addr.port : config.port;
            const shownHost = config.host.includes(":") ? `[${config.host}]` : config.host;
            host.start();
            resolve({
                config,
                host,
                url: `http://${shownHost}:${port}`,
                port,
                sessions,
                connectionsPerIp: perIp,
                close: async () => {
                    clearInterval(heartbeat);
                    for (const s of [...sessions]) s.disconnect(DisconnectReason.ServerShutdown);
                    host.stop();
                    for (const ws of wss.clients) ws.close(CLOSE_CODE_DISCONNECT, DisconnectReason.ServerShutdown);
                    wss.close();
                    server.closeAllConnections?.();
                    await new Promise<void>((done) => server.close(() => done()));
                },
            });
        });
    });
}
