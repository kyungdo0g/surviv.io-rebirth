// Single-use join tokens issued by POST /api/find_game and consumed by the /play WebSocket (survev game.ts
// joinTokens: 10 s lifetime).
import { randomUUID } from "node:crypto";

interface TokenEntry {
    gameId: string;
    expiresAt: number;
}

export class JoinTokens {
    private readonly ttlMs: number;
    private readonly now: () => number;
    private readonly tokens = new Map<string, TokenEntry>();

    constructor(ttlMs: number, now: () => number = Date.now) {
        this.ttlMs = ttlMs;
        this.now = now;
    }

    get size(): number {
        return this.tokens.size;
    }

    issue(gameId: string): string {
        const token = randomUUID();
        this.tokens.set(token, { gameId, expiresAt: this.now() + this.ttlMs });
        return token;
    }

    /** The game id of a valid token, which is consumed; null for unknown, used or expired tokens. */
    consume(token: string): string | null {
        const entry = this.tokens.get(token);
        if (!entry) return null;
        this.tokens.delete(token);
        return entry.expiresAt >= this.now() ? entry.gameId : null;
    }

    /** Outstanding (unexpired) tokens for a game: seats reserved by find_game. */
    pendingFor(gameId: string): number {
        const now = this.now();
        let n = 0;
        for (const e of this.tokens.values()) if (e.gameId === gameId && e.expiresAt >= now) n++;
        return n;
    }

    /** Drops expired tokens. */
    sweep(): void {
        const now = this.now();
        for (const [token, e] of this.tokens) if (e.expiresAt < now) this.tokens.delete(token);
    }
}
