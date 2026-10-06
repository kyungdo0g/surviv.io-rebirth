// Game server: Hono HTTP routes, the /play WebSocket and the party lobby WebSocket (/team_v2, alias /team; M6a) (ws,
// noServer mode) on one Node HTTP server, plus the GameHost loop. `startServer` resolves once listening (port 0 picks
// a free port, as tests do). M8: the moderation services (name filter, bans, reports, anti-cheat flag log) are created
// here; a closing room is archived for late reports, a new ban disconnects the sessions it matches.
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { createAdaptorServer } from "@hono/node-server";
import { CLOSE_CODE_DISCONNECT, DisconnectReason, NetLimits } from "@rebirth/protocol";
import { WebSocketServer } from "ws";
import type { ServerConfig } from "./config.ts";
import { GameHost } from "./host.ts";
import { createApp, playUrl } from "./http.ts";
import { createModeration, type Moderation, sweepModeration } from "./moderation/index.ts";
import { PartyLobby } from "./party.ts";
import { PARTY_MAX_MSG_BYTES, PartySocket } from "./partySocket.ts";
import { ClientSession } from "./session.ts";

/** WebSocket heartbeat period: a socket that misses one ping is dropped (survev idleTimeout 30 s). */
const HEARTBEAT_MS = 15_000;
/** Party lobby paths: the original /team_v2 and a short alias. */
const PARTY_PATHS = new Set(["/team_v2", "/team"]);
/** Idle party members are looked for this often (survev teamMenu: every second). */
const PARTY_SWEEP_MS = 1000;
/** Expired report tokens and archived matches are dropped this often (M8). */
const MODERATION_SWEEP_MS = 60_000;

export interface RunningServer {
    readonly config: ServerConfig;
    readonly host: GameHost;
    /** http://host:port */
    readonly url: string;
    readonly port: number;
    readonly sessions: ReadonlySet<ClientSession>;
    /** open game sockets per client IP */
    readonly connectionsPerIp: ReadonlyMap<string, number>;
    /** party rooms (M6a) */
    readonly lobby: PartyLobby;
    /** open party lobby sockets */
    readonly partySockets: ReadonlySet<PartySocket>;
    /** name filter, bans, reports, anti-cheat flags (M8) */
    readonly moderation: Moderation;
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

/** Counts a connection against its IP for the lifetime of the TCP socket; false when the IP is over `max`. */
function holdIpSlot(counts: Map<string, number>, ip: string, max: number, socket: Duplex): boolean {
    if ((counts.get(ip) ?? 0) >= max) return false;
    counts.set(ip, (counts.get(ip) ?? 0) + 1);
    socket.once("close", () => {
        const n = (counts.get(ip) ?? 1) - 1;
        if (n <= 0) counts.delete(ip);
        else counts.set(ip, n);
    });
    return true;
}

export function startServer(config: ServerConfig): Promise<RunningServer> {
    const host = new GameHost(config);
    const moderation = createModeration(config);
    const sessions = new Set<ClientSession>();
    const app = createApp(config, host, moderation, {
        onBan: () => {
            let kicked = 0;
            for (const s of [...sessions]) {
                if (s.closed || !moderation.bans.check(s.ip, s.name || undefined)) continue;
                s.disconnect(DisconnectReason.Banned);
                kicked++;
            }
            return kicked;
        },
    });
    const wss = new WebSocketServer({ noServer: true, maxPayload: NetLimits.MaxClientMsgBytes });
    const partyWss = new WebSocketServer({ noServer: true, maxPayload: PARTY_MAX_MSG_BYTES * 4 });
    const partySockets = new Set<PartySocket>();
    const perIp = new Map<string, number>();
    const partyPerIp = new Map<string, number>();
    const lobby = new PartyLobby({
        host,
        mapName: config.defaultMap,
        filterName: (name) => moderation.names.filter(name),
    });

    const release = (s: ClientSession) => {
        sessions.delete(s);
    };

    host.onFlag = (flag) => moderation.suspects.record(flag);
    host.onRoomClosed = (room) => {
        // players and final telemetry stay available to reports for REPORT_WINDOW_MS (M8)
        moderation.matches.add({
            gameId: room.id,
            mapName: room.mapName,
            teamMode: room.teamMode,
            players: room.playerRecords(),
        });
        moderation.sessions.onGameClosed(room.id);
        for (const s of sessions) if (s.room === room) s.disconnect(DisconnectReason.GameClosed);
        lobby.onGameClosed(room.id);
    };

    return new Promise((resolve, reject) => {
        const server = createAdaptorServer({ fetch: app.fetch, hostname: config.host }) as Server;
        server.once("error", reject);

        server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            const ip = clientIp(req, config.trustProxy);
            if (PARTY_PATHS.has(url.pathname)) {
                if (!holdIpSlot(partyPerIp, ip, config.partyMaxConnectionsPerIp, socket)) {
                    rejectUpgrade(socket, 429, "Too Many Requests");
                    return;
                }
                const headers = new Headers();
                for (const [k, v] of Object.entries(req.headers)) {
                    if (typeof v === "string") headers.set(k, v);
                    else if (Array.isArray(v)) headers.set(k, v.join(", "));
                }
                const reqUrl = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
                const playBase = playUrl(config, reqUrl, headers);
                partyWss.handleUpgrade(req, socket, head, (ws) => {
                    const limits = {
                        maxMsgsPerSecond: config.partyMaxMsgsPerSecond,
                        joinTimeoutMs: config.partyJoinTimeoutMs,
                    };
                    const party = new PartySocket(ws, lobby, playBase, limits, (s) => partySockets.delete(s));
                    if (!party.closed) partySockets.add(party);
                });
                return;
            }
            if (url.pathname !== "/play") {
                rejectUpgrade(socket, 404, "Not Found");
                return;
            }
            // the slot is held for the lifetime of the TCP connection, whatever happens to the upgrade
            if (!holdIpSlot(perIp, ip, config.maxConnectionsPerIp, socket)) {
                rejectUpgrade(socket, 429, "Too Many Requests");
                return;
            }
            wss.handleUpgrade(req, socket, head, (ws) => {
                const session = new ClientSession(ws, ip, url.searchParams.get("token"), {
                    host,
                    config,
                    moderation,
                    onClosed: release,
                });
                // the constructor may already have closed it (invalid token)
                if (session.state !== "closed") sessions.add(session);
            });
        });

        const heartbeat = setInterval(() => {
            for (const s of sessions) s.heartbeat();
        }, HEARTBEAT_MS);
        const partySweep = setInterval(() => lobby.sweep(config.partyIdleMs), PARTY_SWEEP_MS);
        const moderationSweep = setInterval(() => sweepModeration(moderation), MODERATION_SWEEP_MS);

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
                lobby,
                partySockets,
                moderation,
                close: async () => {
                    clearInterval(heartbeat);
                    clearInterval(partySweep);
                    clearInterval(moderationSweep);
                    for (const s of [...sessions]) s.disconnect(DisconnectReason.ServerShutdown);
                    for (const p of [...partySockets]) p.close();
                    host.stop();
                    for (const ws of wss.clients) ws.close(CLOSE_CODE_DISCONNECT, DisconnectReason.ServerShutdown);
                    wss.close();
                    partyWss.close();
                    server.closeAllConnections?.();
                    await new Promise<void>((done) => server.close(() => done()));
                },
            });
        });
    });
}
