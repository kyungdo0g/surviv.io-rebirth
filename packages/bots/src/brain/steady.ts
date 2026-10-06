// Steadiness (BrainFeatures.steady): some behaviour pairs pull the bot back and forth because each one's score depends
// on where the bot stands between their goals (loot <-> zone, flee <-> zone, break <-> flee, explore <-> loot): walking
// towards one goal raises the other's score, and the hysteresis cannot hold a flip of that size. When the same two
// behaviours swapped three times within 8 s, the bot commits to one of them for 4 s (the zone first, then running,
// healing, looting, exploring last): the other one's score is cut while the lock lasts, unless it turns urgent. Fights
// are never locked out (their score swings are tactical, not positional). Two causes are removed at the source: loot
// and crates next to an armed enemy the bot just ran from are left alone for a while (flee <-> loot), and once the zone
// presses, loot and crates outside the next circle are not picked (they would start the zone behaviour at once). The
// loot and crate choices are kept for 0.3 s while the bot moved little (no flip-flopping between near-equal items).
import { type Vec2, v2 } from "@rebirth/core";
import { distanceToCollider } from "../geom.ts";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import type { BehaviourName, BrainCtx } from "./context.ts";
import { bestLoot, type LootChoice } from "./explore.ts";
import { type BreakChoice, bestBreakable, breakableNow } from "./scavenge.ts";
import { zonePressure } from "./survival.ts";

const WINDOW = 8;
const SWAPS = 3;
const LOCK = 4;
const CUT = 0.4;
/** A score this high gets through the lock anyway (the gas, an item use under way, being revived). */
const URGENT = 0.9;
/** Which behaviour of a dithering pair the bot commits to: the earlier in this list. */
const PREFERENCE: readonly BehaviourName[] = [
    "zone",
    "flee",
    "disengage",
    "heal",
    "revive",
    "guard",
    "loot",
    "break",
    "airdrop",
    "thirdparty",
    "assist",
    "regroup",
    "hold",
    "explore",
];

function rank(b: BehaviourName): number {
    const i = PREFERENCE.indexOf(b);
    return i < 0 ? PREFERENCE.length : i;
}

/** Cuts the score of the behaviour locked out by a dithering lock (scores by behaviour, changed in place). */
export function steadyScores(ctx: BrainCtx, options: Array<[BehaviourName, number, unknown]>): void {
    const sm = ctx.mem.smart;
    if (!sm.lockDrop || ctx.now >= sm.lockUntil) return;
    for (const opt of options) {
        if (opt[0] === sm.lockDrop && opt[1] < URGENT) opt[1] *= CUT;
    }
}

/** Records the behaviour chosen this think; three swaps between the same two behaviours start a lock. */
export function noteChoice(ctx: BrainCtx, from: BehaviourName, to: BehaviourName): void {
    const sm = ctx.mem.smart;
    const now = ctx.now;
    if (from === to) return;
    sm.swaps.push({ time: now, from, to });
    while (sm.swaps.length && sm.swaps[0].time < now - WINDOW) sm.swaps.shift();
    if (from === "fight" || to === "fight" || now < sm.lockUntil) return;
    let n = 0;
    for (const s of sm.swaps) if ((s.from === from && s.to === to) || (s.from === to && s.to === from)) n++;
    if (n < SWAPS) return;
    const keep = rank(from) <= rank(to) ? from : to;
    sm.lockDrop = keep === from ? to : from;
    sm.lockUntil = now + LOCK;
    sm.swaps.length = 0;
}

/** Armed enemies the bot ran from are remembered this long, and loot within FLED_RADIUS of them is left alone. */
const FLED_MEMORY = 8;
const FLED_RADIUS = 16;
/** Zone pressure (survival.ts) above which goals outside the next circle (with a margin) are not picked. */
const ZONE_PRESS = 0.15;
const ZONE_MARGIN = 8;

/** While fleeing: remembers where the armed enemies it runs from are. */
export function noteFlight(ctx: BrainCtx): void {
    const sm = ctx.mem.smart;
    const now = ctx.now;
    for (let i = sm.fled.length - 1; i >= 0; i--) if (now - sm.fled[i].time > FLED_MEMORY) sm.fled.splice(i, 1);
    for (const e of ctx.enemies) {
        if (e.downed || now - e.lastSeen > 2.5) continue;
        const armed = !isMeleeWeapon(e.activeWeapon) || now - e.lastArmedAt < 15;
        if (armed && v2.distance(e.pos, ctx.self.pos) < 40) sm.fled.push({ pos: v2.copy(e.pos), time: now });
    }
    if (sm.fled.length > 24) sm.fled.splice(0, sm.fled.length - 24);
}

/** Whether a loot or crate goal at `p` keeps the bot steady: not next to an enemy it just fled, not out of the zone. */
export function steadyGoal(ctx: BrainCtx, p: Vec2): boolean {
    const { model, now } = ctx;
    for (const f of ctx.mem.smart.fled)
        if (now - f.time < FLED_MEMORY && v2.distance(f.pos, p) < FLED_RADIUS) return false;
    if (model.gas && model.gas.mode !== "inactive" && zonePressure(model) > ZONE_PRESS) {
        if (!model.insideSafeZone(p, ZONE_MARGIN)) return false;
    }
    return true;
}

/** A loot or crate choice is kept this long while the bot moved little and the item is still there. */
const CHOICE_KEEP = 0.3;
const CHOICE_MOVE = 2;

/** bestLoot, kept for a moment while the bot moved little and the item is still known (its distance refreshed). */
export function steadyLoot(ctx: BrainCtx): LootChoice | null {
    const sm = ctx.mem.smart;
    const k = sm.lootChoice;
    if (k && ctx.now - k.at < CHOICE_KEEP && ctx.now >= k.at && v2.distance(k.from, ctx.self.pos) < CHOICE_MOVE) {
        if (!k.choice) return null;
        const l = ctx.model.loot.get(k.choice.loot.id);
        const until = ctx.mem.lootBlacklist.get(k.choice.loot.id);
        if (l && !(until !== undefined && until > ctx.now)) {
            return { loot: l, value: k.choice.value, dist: v2.distance(ctx.self.pos, l.pos) };
        }
    }
    const choice = bestLoot(ctx);
    sm.lootChoice = { at: ctx.now, from: v2.copy(ctx.self.pos), choice };
    return choice;
}

/** bestBreakable, kept for a moment like steadyLoot (while the container is still standing). */
export function steadyCrate(ctx: BrainCtx): BreakChoice | null {
    const sm = ctx.mem.smart;
    const k = sm.crateChoice;
    if (k && ctx.now - k.at < CHOICE_KEEP && ctx.now >= k.at && v2.distance(k.from, ctx.self.pos) < CHOICE_MOVE) {
        if (!k.choice) return null;
        const o = ctx.model.obstacleById.get(k.choice.obstacle.view.id);
        const until = ctx.mem.lootBlacklist.get(k.choice.obstacle.view.id);
        if (o && breakableNow(o) && !(until !== undefined && until > ctx.now)) {
            return { obstacle: o, value: k.choice.value, dist: distanceToCollider(ctx.self.pos, o.col) };
        }
    }
    const choice = bestBreakable(ctx);
    sm.crateChoice = { at: ctx.now, from: v2.copy(ctx.self.pos), choice };
    return choice;
}
