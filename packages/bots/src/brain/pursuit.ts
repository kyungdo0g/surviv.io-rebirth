// Patience in fights (BrainFeatures.pursuit, bot overhaul MOVE-1 and MOVE-4; user report 11 "they never give up: a
// chase across the map for two minutes", report 10 fist chases). Every engagement gets a progress clock (per target,
// out-of-sight time included): it restarts whenever the fight goes somewhere (the bot closed in by 3 units, or by a
// third of the gap in a fist fight; 10 HP dealt or taken since the last progress, counted as a total so chip hits do
// not hold it up forever; shots that miss are no progress: a match probe had an AK bot firing at an unarmed runner
// 20-50 units away for 38 s). When it runs past the bot's patience (persona chasePatience,
// 12 s for NEUTRAL, at most 30 s; 6 s against an unarmed target, 3 s for a fist chase; halved for each earlier give-up
// of the same target), the bot gives the target up: a target out of its reach at once, a stand-off in reach but behind
// cover after one reposition (PursuitMemory.futileTarget, COMBAT-10). A given-up target is ignored for 15 s
// (ignoredTarget, read by combat.ts selectTarget) unless it shoots at the bot, hits it, comes back within 12 units, or
// steps into the bot's reach with a line of fire without running away (critique fix concern 3: a target that walks
// back into range is shot, not walked past). Exempt: a downed target; an exchange (in reach with a line of fire)
// among the last three players or on a front line (three teammates around). A chase out of reach or a stand-off behind
// cover still runs the clock, with twice the patience among the last three (match probe: the last three, two AK
// rushers 40 units apart behind cover for 73 s, never a line of fire, held on the "fight" by the old blanket
// exemption). Diagnosis (round 2, endless chase): patience alone took long chases
// (20 s+) from 61 to 2 on four seeds; gun holders are slower than melee holders (12 vs 13 u/s, sim player.ts equip
// speed), so a bot also holsters to sprint after a runner it cannot shoot back at (planChase).
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { type HeldGun, hasAmmo } from "../knowledge/arsenal.ts";
import type { Contact } from "../perception/world.ts";
import { enemyGun, engagingMe } from "./assess.ts";
import type { BrainCtx, Intent } from "./context.ts";
import type { EngageClock, GiveUp } from "./pursuitMemory.ts";

/** Persona patience is capped here (triage MOVE-1; HARNESS metrics/movement.ts PATIENCE_CAP). */
export const PATIENCE_CAP = 30;
/** Patience of a bot without a persona (NEUTRAL's chasePatience is unlimited). */
export const NEUTRAL_PATIENCE = 12;
const MIN_PATIENCE = 2;
/** An unarmed target that does not threaten the bot is worth this much patience at most (diagnosis prototype: 4 s). */
const UNARMED_PATIENCE = 6;
/** A fist chase ends after this long without a hit or closing in (MOVE-4, diagnosis fix 5: ~3 s). */
const FIST_PATIENCE = 3;
/** Damage dealt plus taken since the last progress that counts as progress (critique C2: a rate, not "any hit"). */
const PROGRESS_DAMAGE = 10;
/** Closing in by this much counts as progress (a third of the gap when that is less, at least 1 unit). */
const CLOSE_STEP = 3;
/** A stand-off flagged futile gets this long for its one reposition before the target is dropped. */
const REPOSITION_GRACE = 3;
/** A given-up target is ignored this long (diagnosis prototype: 15 s). */
const IGNORE = 15;
/** ...unless it comes back this close. */
const REACQUIRE_NEAR = 12;
/** Give-ups of a target are remembered this long (each one halves the next patience against it). */
const STRIKE_MEMORY = 60;
/** A clock not updated for this long restarts (the bot fought someone else in between). */
const CLOCK_GAP = 3;
const CLOCK_STALE = 8;
/** Players left at which a fight in reach is fought out; a chase out of reach gets LAST_FACTOR x the patience. */
const LAST_ALIVE = 3;
const LAST_FACTOR = 2;
/** A front line: this many teammates within FRONT_RADIUS (50v50, squads). */
const FRONT_MATES = 3;
const FRONT_RADIUS = 30;
/** Holstered sprint: starts this far beyond the bot's reach against a target moving away this fast, stops closer. */
const SPRINT_START = 6;
const SPRINT_STOP = 3;
const SPRINT_AWAY = 3;
/** ...only while the target cannot shoot the bot: unarmed, or this far beyond its own gun's reach. */
const SPRINT_SAFE = 6;
/** Reach of a punch (combat.ts MELEE_REACH 2.4 + its 0.5 slack). */
const FIST_RANGE = 2.9;

/**
 * Distance the bot can shoot from with its best gun with ammo (combat.ts canShoot's gate: maxEngage x rangeMult, at
 * least 10, within bullet range); a punch's reach when unarmed.
 */
export function shootRange(ctx: BrainCtx): number {
    let best = 0;
    for (const g of ctx.guns) {
        if (!hasAmmo(g)) continue;
        best = Math.max(best, Math.min(Math.max(g.info.maxEngage * ctx.params.rangeMult, 10), g.info.range));
    }
    return best > 0 ? best : FIST_RANGE;
}

/** How fast `c` comes towards the bot (u/s; negative: it moves away). */
export function closingSpeed(ctx: BrainCtx, c: Contact): number {
    const to = v2.normalizeSafe(v2.sub(ctx.self.pos, c.pos));
    return v2.dot(c.vel, to);
}

/** The bot's patience with `t` (seconds without progress before it gives up). */
export function patienceOf(ctx: BrainCtx, t: Contact): number {
    const p = ctx.persona.chasePatience;
    let s = Math.min(PATIENCE_CAP, Math.max(MIN_PATIENCE, Number.isFinite(p) ? p : NEUTRAL_PATIENCE));
    if (!ctx.armed) s = Math.min(s, FIST_PATIENCE);
    else if (!enemyGun(ctx, t)) s = Math.min(s, UNARMED_PATIENCE);
    if (lastFew(ctx)) s = Math.min(PATIENCE_CAP, s * LAST_FACTOR);
    const strikes = ctx.mem.pursuit.strikes.get(t.id)?.n ?? 0;
    return Math.max(MIN_PATIENCE, s / 2 ** strikes);
}

/** Three players left or fewer (aliveCount from the snapshot's alive counter; 0 when unknown). */
function lastFew(ctx: BrainCtx): boolean {
    const alive = ctx.model.aliveCount;
    return alive > 0 && alive <= LAST_ALIVE;
}

/** Lost health was dealt by `t`: its bullets passed close, it shoots at the bot, or it stands in punch reach. */
function hurtBy(ctx: BrainCtx, t: Contact): boolean {
    const uf = ctx.model.underFire;
    if (uf && uf.shooterId === t.id && ctx.now - uf.time < 1) return true;
    return engagingMe(ctx, t) || (t.visible && ctx.targetDist < 4.5);
}

/** Fights that are fought out whatever the clock says. */
function exempt(ctx: BrainCtx, t: Contact): boolean {
    if (t.downed) return true;
    // the last three, and a front line held by many (50v50, squads): an exchange in reach goes on; a chase out of
    // reach or a stand-off behind cover runs the clock like any other
    if (ctx.targetDist > shootRange(ctx) || !t.visible || !ctx.model.lineOfFire(ctx.self.pos, t.pos)) return false;
    if (lastFew(ctx)) return true;
    if (!ctx.teamMode) return false;
    let mates = 0;
    for (const c of ctx.model.contacts.values()) {
        if (!c.teammate || !c.visible || c.downed || c.dead || c.id === ctx.self.id) continue;
        if (v2.distance(c.pos, ctx.self.pos) < FRONT_RADIUS && ++mates >= FRONT_MATES) return true;
    }
    return false;
}

function newClock(ctx: BrainCtx, t: Contact): EngageClock {
    const self = ctx.self;
    return {
        last: ctx.now,
        progressAt: ctx.now,
        refDist: ctx.targetDist,
        damage: 0,
        estHealth: ctx.model.intel.of(t.id).estHealth,
        health: self.health,
    };
}

/** Drops `t`: ignored for IGNORE seconds (unless it comes back), one more strike against it. */
function giveUp(ctx: BrainCtx, t: Contact): void {
    const pm = ctx.mem.pursuit;
    const now = ctx.now;
    pm.ignored.set(t.id, { until: now + IGNORE, dist: ctx.targetDist });
    pm.strikes.set(t.id, { n: (pm.strikes.get(t.id)?.n ?? 0) + 1, at: now });
    pm.clocks.delete(t.id);
    if (pm.futileTarget === t.id) pm.futileTarget = 0;
    if (pm.sprintTarget === t.id) pm.sprintTarget = 0;
}

/**
 * Runs the progress clock of the engagement against ctx.target (every think, from fightScore while the flag is on):
 * only while the bot fought that target in its last decision. Gives the target up when the clock runs out.
 */
export function notePursuit(ctx: BrainCtx): void {
    const pm = ctx.mem.pursuit;
    const { now, self } = ctx;
    for (const [id, c] of pm.clocks) if (now - c.last > CLOCK_STALE) pm.clocks.delete(id);
    for (const [id, g] of pm.ignored) if (now >= g.until) pm.ignored.delete(id);
    for (const [id, s] of pm.strikes) if (now - s.at > STRIKE_MEMORY) pm.strikes.delete(id);
    if (pm.futileTarget && (now - pm.futileSince > 3 * REPOSITION_GRACE || !ctx.model.contacts.has(pm.futileTarget)))
        pm.futileTarget = 0;
    const t = ctx.target;
    if (!t || ctx.mem.current !== "fight" || ctx.mem.targetId !== t.id) return;
    const d = ctx.targetDist;
    const c = pm.clocks.get(t.id);
    if (!c || now - c.last > CLOCK_GAP) {
        pm.clocks.set(t.id, newClock(ctx, t));
        return;
    }
    c.last = now;
    // damage dealt (the intel's estimate drops as the bot's hits land) and taken from it
    const est = ctx.model.intel.of(t.id).estHealth;
    if (est < c.estHealth) c.damage += c.estHealth - est;
    c.estHealth = est;
    if (self.health < c.health && hurtBy(ctx, t)) c.damage += c.health - self.health;
    c.health = self.health;
    const step = Math.min(CLOSE_STEP, Math.max(1, c.refDist / 3));
    if (c.damage >= PROGRESS_DAMAGE || d <= c.refDist - step || exempt(ctx, t)) {
        c.progressAt = now;
        c.refDist = d;
        c.damage = 0;
        if (pm.futileTarget === t.id) pm.futileTarget = 0;
        return;
    }
    if (now - c.progressAt < patienceOf(ctx, t)) return;
    if (t.visible && d <= shootRange(ctx) && !ctx.model.lineOfFire(self.pos, t.pos)) {
        // a stand-off in reach behind cover: one reposition first (COMBAT reads isFutile), then give the target up
        if (pm.futileTarget !== t.id) {
            pm.futileTarget = t.id;
            pm.futileSince = now;
            return;
        }
        if (now - pm.futileSince < REPOSITION_GRACE) return;
    }
    giveUp(ctx, t);
}

/** Whether ctx.target was given up (this think): the fight is over. */
export function givenUp(ctx: BrainCtx, t: Contact): boolean {
    return ctx.features.pursuit && ctx.mem.pursuit.ignored.has(t.id);
}

/** A given-up target that comes back: shoots at or hits the bot, comes much closer, or steps into reach. */
function reacquire(ctx: BrainCtx, c: Contact, g: GiveUp): boolean {
    const me = ctx.self.pos;
    const d = v2.distance(me, c.pos);
    if (engagingMe(ctx, c)) return true;
    if (ctx.now - ctx.model.lastHurt < 1 && c.visible && d < 6) return true;
    if (d < Math.min(REACQUIRE_NEAR, g.dist - 2)) return true;
    if (!c.visible || d > shootRange(ctx) || closingSpeed(ctx, c) < -0.5) return false;
    // in reach with a line of fire and not running away: a stand-off target that peeks, a runner that came back
    return ctx.model.lineOfFire(me, c.pos) && (d < g.dist - 2 || g.dist <= shootRange(ctx));
}

/**
 * Called by selectTarget (combat.ts) for every remembered enemy: true skips it as a target (a given-up engagement
 * inside its ignore window that has not come back).
 */
export function ignoredTarget(ctx: BrainCtx, c: Contact): boolean {
    if (!ctx.features.pursuit) return false;
    const pm = ctx.mem.pursuit;
    const g = pm.ignored.get(c.id);
    if (!g || ctx.now >= g.until) return false;
    if (!reacquire(ctx, c, g)) return true;
    pm.ignored.delete(c.id);
    return false;
}

/**
 * Called by planFight (tactics.ts) when the target is out of the held gun's reach, before the default "close in along
 * the path": the holstered sprint. Melee holders run faster than gun holders (13 vs 12 u/s), so a runner the bot cannot
 * shoot opens the gap forever; while the target moves away beyond the bot's reach and cannot shoot it back (unarmed,
 * or far beyond its own gun's reach), the bot runs with its melee out and draws again just outside its reach.
 */
export function planChase(ctx: BrainCtx, intent: Intent, _gun: HeldGun): boolean {
    if (!ctx.features.pursuit) return false;
    const t = ctx.target;
    const pm = ctx.mem.pursuit;
    if (!t) return false;
    const d = ctx.targetDist;
    const range = shootRange(ctx);
    const theirs = enemyGun(ctx, t);
    const harmless = !theirs || d > Math.min(theirs.maxEngage, theirs.range) + SPRINT_SAFE;
    const keep = pm.sprintTarget === t.id && d > range + SPRINT_STOP;
    const start = t.visible && -closingSpeed(ctx, t) > SPRINT_AWAY && d > range + SPRINT_START;
    if (!harmless || !(keep || start) || ctx.self.action.type !== "none") {
        if (pm.sprintTarget === t.id) pm.sprintTarget = 0;
        return false;
    }
    pm.sprintTarget = t.id;
    intent.slot = WeaponSlot.Melee;
    intent.fire = false;
    intent.goal = v2.copy(t.pos);
    intent.arriveDist = Math.max(1, range - SPRINT_STOP);
    return true;
}
