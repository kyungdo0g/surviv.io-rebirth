// Dead ends (BrainFeatures.basements, the navigation feature): a bot can walk into a room the navigation grid does
// not connect back to the map, e.g. a bank vault entered through its slow door (the grid treats the door as a wall,
// so every plan out of the vault fails and the path follower falls back to a straight line into the vault wall).
// Tournament diagnostics: one such bot pressed against a vault wall for 50 s produced 31 stuck events, more than the
// rest of its 24 matches together. A trapped bot walks back the way it came: it keeps a trail of where it stood
// (one point a second) and, after about 10 s within a few units of one spot while its behaviours wanted to go
// somewhere farther, heads straight for the trail point from before the trap (it came in from there, so that way is
// open) for a few seconds, then lets the behaviours plan again from outside.
import { type Vec2, v2 } from "@rebirth/core";
import { freeDir } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

/** One trail point per this many seconds, kept for TRAIL_KEEP seconds. */
const TRAIL_EVERY = 1;
const TRAIL_KEEP = 40;
/** Trapped: this long within TRAP_RADIUS of one spot while wanting to go at least TRAP_GOAL away. */
const TRAP_TIME = 10;
const TRAP_RADIUS = 4;
const TRAP_GOAL = 8;
/** The way back out is walked this long, towards a trail point at least this far from the trap. */
const ESCAPE_TIME = 4;
const ESCAPE_DIST = 6;
/** No new escape for this long after one (the behaviours get their turn from outside). */
const COOLDOWN = 8;

/** Records the bot's trail and whether its last intent wanted to go somewhere farther (call after every think). */
export function noteDeadEnd(ctx: BrainCtx, intent: Intent): void {
    const de = ctx.mem.smart.deadEnd;
    const { now } = ctx;
    const me = ctx.self.pos;
    const last = de.trail[de.trail.length - 1];
    if (!last || now - last.t >= TRAIL_EVERY || now < last.t) de.trail.push({ t: now, pos: v2.copy(me) });
    while (de.trail.length && de.trail[0].t < now - TRAIL_KEEP) de.trail.shift();
    const wantsFar = !intent.stop && !!intent.goal && v2.distance(intent.goal, me) > TRAP_GOAL;
    if (!wantsFar || !de.anchor || v2.distance(de.anchor, me) > TRAP_RADIUS) {
        de.anchor = v2.copy(me);
        de.since = wantsFar ? now : Number.POSITIVE_INFINITY;
    } else if (!Number.isFinite(de.since)) de.since = now;
}

/** The way back out of a dead end, while the bot is trapped (or still walking out), else null. */
export function planDeadEnd(ctx: BrainCtx): Intent | null {
    const de = ctx.mem.smart.deadEnd;
    const { now, model } = ctx;
    const me = ctx.self.pos;
    if (de.escapeTo && now < de.escapeUntil && v2.distance(de.escapeTo, me) > 1.5)
        return escapeIntent(ctx, de.escapeTo);
    de.escapeTo = null;
    if (now < de.cooldown || !de.anchor || now - de.since < TRAP_TIME || model.inGasNow()) return null;
    // the newest trail point from before the trap, far enough from it
    let to: Vec2 | null = null;
    for (let i = de.trail.length - 1; i >= 0; i--) {
        const p = de.trail[i];
        if (p.t < de.since && v2.distance(p.pos, de.anchor) >= ESCAPE_DIST) {
            to = p.pos;
            break;
        }
    }
    de.since = Number.POSITIVE_INFINITY;
    de.cooldown = now + ESCAPE_TIME + COOLDOWN;
    if (!to) return null;
    de.escapeTo = v2.copy(to);
    de.escapeUntil = now + ESCAPE_TIME;
    return escapeIntent(ctx, to);
}

function escapeIntent(ctx: BrainCtx, to: Vec2): Intent {
    const intent = emptyIntent("explore");
    const me = ctx.self.pos;
    // straight back along the trail (the grid does not connect the dead end, so planning a path would fail again)
    intent.moveDir = freeDir(ctx.model, me, v2.normalizeSafe(v2.sub(to, me))) ?? v2.normalizeSafe(v2.sub(to, me));
    return intent;
}
