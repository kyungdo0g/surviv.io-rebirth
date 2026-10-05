// Single-use join tokens issued by POST /api/find_game (and the party rooms, M6a) and consumed by the /play WebSocket
// (survev game.ts joinTokens: 10 s lifetime). A token may carry the group data of a party (survev groupData): every
// member's token names the same party key, so the members land in the same group.
import { randomUUID } from "node:crypto";
import type { AddPlayerOptions } from "@rebirth/sim";

/** What a consumed token grants: a seat in a game, in a party's group in team modes. */
export interface JoinTicket {
    gameId: string;
    group?: AddPlayerOptions;
}

interface TokenEntry extends JoinTicket {
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

    issue(gameId: string, group?: AddPlayerOptions): string {
        const token = randomUUID();
        const entry: TokenEntry = { gameId, expiresAt: this.now() + this.ttlMs };
        if (group) entry.group = { ...group };
        this.tokens.set(token, entry);
        return token;
    }

    /** The ticket of a valid token, which is consumed; null for unknown, used or expired tokens. */
    consumeTicket(token: string): JoinTicket | null {
        const entry = this.tokens.get(token);
        if (!entry) return null;
        this.tokens.delete(token);
        if (entry.expiresAt < this.now()) return null;
        return entry.group ? { gameId: entry.gameId, group: entry.group } : { gameId: entry.gameId };
    }

    /** The game id of a valid token, which is consumed; null for unknown, used or expired tokens. */
    consume(token: string): string | null {
        return this.consumeTicket(token)?.gameId ?? null;
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
