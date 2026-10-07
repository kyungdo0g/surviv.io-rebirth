// Reacting to threats the bot cannot see (BrainFeatures.threats): what the threat board (WorldModel.threats) knows
// from the bot's own snapshots: bullets from off-screen shooters, explosions, the kill feed, teammates' pings. Under
// fire from an unseen shooter the bot glances towards it (Intent.lookAt); hit by one, it drops looting and healing in
// the open and gets to cover against that origin; loot and explore goals in hot areas are penalised (explore.ts reads heatPenalty);
// danger zones (grenades about to blow, air strike zones) are dodged like grenades (Brain.dodge). With nothing
// shooting, the crosshair rests where an enemy most likely shows up (the last one that left view, a ping, gunfire), so
// the hand has less far to flick when it does. Only what a human could know (bot overhaul COMBAT-5): an unseen
// shooter's spot is the fuzzy origin its tracer and shot sound give (perception/bulletSight.ts), and an enemy that left
// view is looked for where it was last seen, at most half a second along its way and never into a building it walked
// into (a human remembers the spot or the door, not a track behind a roof). Round 3 (user report 20): how the weapon
// answers an unseen shooter, return fire at its estimated origin, hold its angle or leave it to MOVE's evasion, is
// decided once per episode by persona and situation (brain/unseenFire.ts) and layered on the chosen intent here.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { findCover } from "./combat.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { underRoof } from "./grenades.ts";
import { prefireLayer } from "./lostTarget.ts";
import { applyUnseenReaction, freshUnseen } from "./unseenFire.ts";

/** Behaviours an unseen shooter interrupts (the bot is busy with something that leaves it in the open). */
const INTERRUPTIBLE: ReadonlySet<BehaviourName> = new Set<BehaviourName>([
    "loot",
    "break",
    "explore",
    "heal",
    "hold",
    "sweep",
]);
/** Hit this recently by an unseen shooter: take cover (a near miss alone only turns the bot's head). */
const HIT_MEMORY = 1.5;
/** Enemies out of sight and reports this old still draw the crosshair. */
const LOOK_MEMORY = 6;
/** A remembered enemy is looked for at most this far (seconds) along its last heading. */
const LOOK_AHEAD = 0.5;

/** The origin of the freshest fire from a shooter the bot does not see, or null (brain/unseenFire.ts freshUnseen). */
export function unseenFire(ctx: BrainCtx): Vec2 | null {
    return freshUnseen(ctx)?.origin ?? null;
}

/**
 * Where an enemy will most likely show up: the freshest enemy that left view within the last 6 s (where it was heading),
 * else a teammate's danger ping or heard gunfire on the threat board (the freshest within 60 units), else null.
 */
export function likelyThreat(ctx: BrainCtx): Vec2 | null {
    const { now, model, self } = ctx;
    let best: Vec2 | null = null;
    let bestT = Number.NEGATIVE_INFINITY;
    for (const e of ctx.enemies) {
        if (e.visible || e.downed || now - e.lastSeen > LOOK_MEMORY || e.lastSeen <= bestT) continue;
        bestT = e.lastSeen;
        const ahead = v2.add(e.pos, v2.mul(e.vel, Math.min(LOOK_AHEAD, now - e.lastSeen)));
        best = underRoof(model, ahead) ? e.pos : ahead;
    }
    if (best) return best;
    for (const r of model.threats.reported()) {
        if (r.kind !== "ping" && r.kind !== "gunfire") continue;
        if (r.reporterId === self.id || now - r.time > LOOK_MEMORY || r.time <= bestT) continue;
        if (r.kind === "ping" && !model.isTeammate(r.reporterId)) continue;
        if (v2.distance(r.pos, self.pos) > 60) continue;
        bestT = r.time;
        best = r.pos;
    }
    return best ? v2.copy(best) : null;
}

/** Penalty factor (0..1] for a goal at `p` in a hot area: 1 when nothing is known. */
export function heatPenalty(ctx: BrainCtx, p: Vec2): number {
    const h = ctx.model.threats.heat(p, 15);
    return h > 0 ? 1 / (1 + 0.5 * h) : 1;
}

/** Threat reactions on top of the chosen intent. */
export function reactToThreats(ctx: BrainCtx, intent: Intent): void {
    const origin = unseenFire(ctx);
    const sm = ctx.mem.smart;
    if (!origin) {
        // a fresh corner a hostile enemy just vanished at: one prefire burst (smart cover play, lostTarget.ts)
        if (ctx.features.cover) prefireLayer(ctx, intent);
        // nothing shooting: keep the crosshair where an enemy is most likely to show up (pre-aim)
        if (!intent.aim && !intent.lookAt) {
            const p = likelyThreat(ctx);
            if (p) intent.lookAt = p;
        }
        return;
    }
    sm.unseenSince = ctx.now;
    if (!intent.aim) intent.lookAt = v2.copy(origin);
    // the weapon's answer: return fire at the origin or hold its angle (unseenFire.ts)
    applyUnseenReaction(ctx, intent);
    // already shooting back at someone, using an item, or reviving: leave it; a near miss only draws a glance, being
    // hit sends the bot to cover
    const using = ctx.self.action.type === "use" || ctx.self.action.type === "revive";
    if (!INTERRUPTIBLE.has(intent.behaviour) || using || intent.fire) return;
    if (ctx.now - ctx.model.lastHurt > HIT_MEMORY) return;
    intent.actions = intent.actions.filter((a) => a !== Input.Loot);
    intent.useItem = "";
    const cover = findCover(ctx.model, origin, 10);
    if (cover) {
        intent.goal = cover;
        intent.arriveDist = 0.6;
        intent.moveDir = null;
        intent.stop = v2.distance(cover, ctx.self.pos) < 0.6;
    }
}
