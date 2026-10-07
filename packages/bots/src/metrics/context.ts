// Shared state of the match metrics collectors (metrics/collector.ts builds it once per match): the game, its bots by
// player id, each bot's counters and the roof index. The collectors only read the game and the bots.
import type { Game, Player } from "@rebirth/sim";
import type { BotController } from "../controller.ts";
import type { RoofIndex } from "./truth.ts";
import type { BotMetrics } from "./types.ts";

export interface MetricsCtx {
    readonly game: Game;
    readonly bots: readonly BotController[];
    readonly byId: ReadonlyMap<number, BotController>;
    readonly metrics: ReadonlyMap<number, BotMetrics>;
    readonly roofs: RoofIndex;
}

/** The living bots with their players and counters (downed included). */
export function* livingBots(ctx: MetricsCtx): Generator<{ bot: BotController; p: Player; m: BotMetrics }> {
    for (const bot of ctx.bots) {
        const p = ctx.game.getPlayer(bot.playerId);
        const m = ctx.metrics.get(bot.playerId);
        if (!p || p.dead || !m) continue;
        yield { bot, p, m };
    }
}

/** Ticks between samples of each collector (the sim runs 100 ticks per second). */
export const SAMPLE = {
    /** exposure and sightings (30 ms) */
    sight: 3,
    /** throws, item uses, revives, pickups */
    events: 5,
    /** slots, gun swaps, S-tier opportunities, chases, flights */
    state: 10,
    /** building visits */
    visits: 25,
    /** aim without fire, travel holstering, fight weapon, boosts, loadouts (0.5 s, the triage probe's rate) */
    slow: 50,
} as const;
