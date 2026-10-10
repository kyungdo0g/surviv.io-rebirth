// Third parties in a 1v1 (owner request 2026-10-10; BrainFeatures.thirdPartyReact). A bot in a duel that a third
// player joins (the newcomer shoots at it) mostly reacts to the newcomer: it turns on it or gets out of its line of
// fire behind cover while it finishes the first fight; a minority stays tunnel-visioned on its first opponent, as some
// players do. Before (scripts/thirdParty.ts, 80 bots, 3 seeds): no bot kept its first opponent where it stood; who
// switched was only the side effect of the target score (a shooter scores x2.1, the current target x1.3).
// - tunnel vision: a draw per bot from its seed (no rng shift) under tunnelOdds (persona: bold and risk-taking bots more,
//   game sense less; about a fifth to a quarter of the server's mix): its duel target scores x4 and a newcomer's
//   shooting counts for nothing in the target choice;
// - the others: a newcomer shooting at the bot scores x1.5 more (it turns on a close one), and while it keeps its first
//   opponent it moves behind cover from the newcomer (within COVER_RANGE), still shooting at the first one.
import { v2 } from "@rebirth/core";
import type { Contact } from "../perception/world.ts";
import { engagingMe } from "./assess.ts";
import { findCoverFrom } from "./combat.ts";
import type { BrainCtx, Intent } from "./context.ts";

/** The duel target is the one the bot fired at within DUEL_FIRE, or one engaging it. */
const DUEL_FIRE = 3;
const TUNNEL_MULT = 4;
const TUNNEL_IGNORE = 1 / 2.1;
const REACT_MULT = 1.5;
const COVER_RANGE = 8;

/** A unit number from the bot's seed (the Brain's profile seed, kept by the puzzle memory) and a salt. */
function unit(ctx: BrainCtx, salt: number): number {
    let h = Math.imul((ctx.mem.puzzle.seed ^ salt) >>> 0, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** The share of bots that stay on their first opponent when a third player joins (persona and game sense). */
export function tunnelOdds(ctx: BrainCtx): number {
    const p = ctx.persona;
    const odds = 0.22 + 0.4 * p.aggressionBias + 0.2 * (p.riskTolerance - 0.5) - 0.3 * (ctx.skill.g - 0.5);
    return Math.min(0.6, Math.max(0.05, odds));
}

/** Whether this bot is tunnel-visioned (its draw under tunnelOdds). */
export function tunnelVision(ctx: BrainCtx): boolean {
    return unit(ctx, 0x7a11) < tunnelOdds(ctx);
}

/** The bot's duel opponent: its current target, in view, that it fired at lately or that shoots at it; else null. */
function duelTarget(ctx: BrainCtx): Contact | null {
    const id = ctx.mem.targetId;
    const a = id ? ctx.model.contacts.get(id) : undefined;
    if (!a?.visible || a.downed || a.dead) return null;
    const f = ctx.mem.fight;
    return (f.fireTarget === a.id && ctx.now - f.fireAt < DUEL_FIRE) || engagingMe(ctx, a) ? a : null;
}

/** The target-score multiplier of `c` (combat.ts selectTarget) while the bot is in a duel (see the header). */
export function newcomerMult(ctx: BrainCtx, c: Contact): number {
    const a = duelTarget(ctx);
    if (!a) return 1;
    if (c.id === a.id) return tunnelVision(ctx) ? TUNNEL_MULT : 1;
    if (!engagingMe(ctx, c)) return 1;
    return tunnelVision(ctx) ? TUNNEL_IGNORE : REACT_MULT;
}

/**
 * After the decision: a reacting bot still fighting its first opponent while a newcomer shoots at it with a line of
 * fire moves behind cover from the newcomer (the aim and the fire on the first opponent stay).
 */
export function coverFromNewcomer(ctx: BrainCtx, intent: Intent): void {
    if (intent.behaviour !== "fight" || !intent.targetId || tunnelVision(ctx)) return;
    const me = ctx.self.pos;
    for (const c of ctx.visibleEnemies) {
        if (c.id === intent.targetId || c.downed || !engagingMe(ctx, c)) continue;
        if (!ctx.model.lineOfFire(c.pos, me)) return;
        const cover = findCoverFrom(ctx.model, me, c.pos, COVER_RANGE);
        if (!cover || v2.distance(cover, me) < 0.8) return;
        intent.goal = cover;
        intent.arriveDist = 0.6;
        intent.moveDir = null;
        intent.stop = false;
        return;
    }
}
