// What a player report needs to know about a match after the fact (M8): which player a reporter's join token belongs
// to (ReportSessions: the token stays valid for reports while its game runs and REPORT_WINDOW_MS after it closed) and
// the players of games that already closed, with their final telemetry (MatchArchive, kept as long).
import type { TelemetrySnapshot } from "../anticheat/player.ts";

/** A player of a match as reports record it. */
export interface PlayerRecord {
    playerId: number;
    name: string;
    /** client address of a human (null for bots) */
    ip: string | null;
    /** a fill bot (reports against bots are stored but marked) */
    bot: boolean;
    /** anti-cheat telemetry (null for bots or with ANTICHEAT=0) */
    telemetry: TelemetrySnapshot | null;
}

/** A live room or an archived match. */
export interface MatchContext {
    gameId: string;
    mapName: string;
    teamMode: number;
    player(playerId: number): PlayerRecord | null;
}

export interface SessionIdentity {
    gameId: string;
    playerId: number;
    name: string;
    ip: string;
    /** players this session already reported */
    reported: Set<number>;
    /** wall-clock ms after which the token no longer authenticates reports (Infinity while the game runs) */
    expiresAt: number;
}

/** Join tokens of joined players: the credential of POST /api/report. */
export class ReportSessions {
    private readonly byToken = new Map<string, SessionIdentity>();
    private readonly windowMs: number;
    private readonly now: () => number;

    constructor(windowMs: number, now: () => number = Date.now) {
        this.windowMs = windowMs;
        this.now = now;
    }

    get size(): number {
        return this.byToken.size;
    }

    register(token: string, who: { gameId: string; playerId: number; name: string; ip: string }): void {
        this.byToken.set(token, { ...who, reported: new Set(), expiresAt: Number.POSITIVE_INFINITY });
    }

    get(token: string): SessionIdentity | null {
        const s = this.byToken.get(token);
        if (!s) return null;
        if (s.expiresAt <= this.now()) {
            this.byToken.delete(token);
            return null;
        }
        return s;
    }

    /** The game closed: its tokens keep working for reports for the report window. */
    onGameClosed(gameId: string): void {
        const until = this.now() + this.windowMs;
        for (const s of this.byToken.values()) if (s.gameId === gameId) s.expiresAt = Math.min(s.expiresAt, until);
    }

    sweep(): void {
        const now = this.now();
        for (const [token, s] of this.byToken) if (s.expiresAt <= now) this.byToken.delete(token);
    }
}

interface ArchivedMatch {
    gameId: string;
    mapName: string;
    teamMode: number;
    players: Map<number, PlayerRecord>;
    closedAt: number;
}

/** Closed matches (players and final telemetry) for reports made after the game ended. */
export class MatchArchive {
    private readonly matches = new Map<string, ArchivedMatch>();
    private readonly windowMs: number;
    private readonly max: number;
    private readonly now: () => number;

    constructor(windowMs: number, max = 500, now: () => number = Date.now) {
        this.windowMs = windowMs;
        this.max = max;
        this.now = now;
    }

    get size(): number {
        return this.matches.size;
    }

    add(match: { gameId: string; mapName: string; teamMode: number; players: PlayerRecord[] }): void {
        const players = new Map(match.players.map((p) => [p.playerId, p]));
        this.matches.set(match.gameId, { ...match, players, closedAt: this.now() });
        // the oldest go first when the archive is full (Map keeps insertion order)
        while (this.matches.size > this.max) this.matches.delete(this.matches.keys().next().value as string);
    }

    get(gameId: string): MatchContext | null {
        const m = this.matches.get(gameId);
        if (!m) return null;
        if (this.now() - m.closedAt > this.windowMs) {
            this.matches.delete(gameId);
            return null;
        }
        return {
            gameId: m.gameId,
            mapName: m.mapName,
            teamMode: m.teamMode,
            player: (id) => m.players.get(id) ?? null,
        };
    }

    sweep(): void {
        const now = this.now();
        for (const [id, m] of this.matches) if (now - m.closedAt > this.windowMs) this.matches.delete(id);
    }
}
