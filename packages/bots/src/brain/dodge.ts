// Dodging layered on every decision (Brain.think, last): run from grenades landing nearby and, with the threat board,
// from its danger zones (grenades about to blow, air strike zones). Split out of brain.ts in the bot overhaul's stage 0.
// A human reaction (bot overhaul COMBAT-4, both brains; diagnosis round 1 issue 1 RC4: the hard bot ran 0.03 s after a
// frag appeared): a grenade is dodged only params.dodgeReaction after it first showed on the screen (WorldModel keeps
// only grenades on the screen and not under someone else's roof, and when each one showed).
// Round 4 (COMBAT2, smart brain: BrainFeatures.grenades): its own frag was ignored for 5 s whenever it lay nearer its
// planned point than the bot, that is always once it had landed, so a bot pushing its target walked into its own
// blast (population runs: 14-20 HP of self-damage per frag thrown). Now its own frag is known without a reaction and
// run from like any other once it has been out of the hand for OWN_GRACE seconds and lies within its blast.
// Owner report 2026-10-10: bots ran from their teammates' grenades and from grenades behind a wall. Teammates cannot
// hurt each other in any mode (docs/research/mechanics/damage-armor.md "Pipeline order" 2; sim combat/combat.ts
// applyPlayerDamage drops the hit, a disconnected target aside), so a grenade the bot saw leave a teammate's hand is no
// threat (friendlyFrag; its own still is: self-damage counts). And a grenade lying on the ground with a wall between it
// and the bot's whole body is no threat either: the sim's explosion casts rays from its centre and a collidable
// obstacle taller than BLOCK_HEIGHT stops each one (sim combat/explosions.ts), so the bot checks the rays to its centre
// and both sides of its body against the obstacles it sees (shielded).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, MOLOTOV_FIRE } from "@rebirth/defs";
import type { ProjectileView } from "@rebirth/sim";
import { segmentHits } from "../geom.ts";
import { freeDir } from "./combat.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { fragBlast } from "./fragMath.ts";

/** Projectiles worth running from. */
const DANGEROUS = new Set(["frag", "mirv", "mirv_mini", "martyr_nade", "bomb_iron", "bomb_heavy", "molotov"]);
/** A Molotov's flight is checked this far ahead of where it is (a full throw carries it about 25 u). */
const MOLOTOV_REACH = 15;
const dodgeRadii = new Map<string, number>();
/** Its own frag counts as a danger this long after it showed (leaving the hand it is next to the thrower). */
const OWN_GRACE = 0.5;

/** How close to a live grenade the bot runs from it: its blast's outer radius from the defs less 1 (frag: 11). */
function dodgeRadius(type: string): number {
    let r = dodgeRadii.get(type);
    if (r === undefined) {
        const max = fragBlast(type).max;
        r = max > 0 ? max - 1 : 11;
        dodgeRadii.set(type, r);
    }
    return r;
}

/** The sim's explosion rays stop at collidable obstacles taller than this (combat/explosions.ts BLOCK_HEIGHT). */
const BLOCK_HEIGHT = 0.5;
/** A grenade this low (posZ) lies on the ground: where it lies is where it blows. */
const ON_GROUND = 0.05;
const PLAYER_RAD = GameConfig.player.radius;
/** A grenade is attributed to a thrower within this long of showing, and up to this far back along its flight. */
const ATTRIBUTE_WINDOW = 0.5;
const ATTRIBUTE_BACK = 15;

/**
 * Whether grenade `p` left a teammate's hand: within ATTRIBUTE_WINDOW of showing, the player in view nearest the line
 * it flew in on (within OWN_HAND of it, at most ATTRIBUTE_BACK behind the grenade) is a teammate (remembered).
 */
function friendlyFrag(ctx: BrainCtx, p: ProjectileView): boolean {
    const f = ctx.mem.fight;
    if (f.friendlyFrags.has(p.id)) return true;
    const showed = ctx.model.projectileSeen.get(p.id) ?? ctx.now;
    if (ctx.now - showed > ATTRIBUTE_WINDOW) return false;
    const back = v2.mul(v2.normalizeSafe(p.dir, { x: 1, y: 0 }), -1);
    let best = OWN_HAND;
    let friend = false;
    for (const c of ctx.model.contacts.values()) {
        if (!c.visible || c.dead) continue;
        const rel = v2.sub(c.pos, p.pos);
        const along = v2.dot(rel, back);
        if (along < -OWN_HAND || along > ATTRIBUTE_BACK) continue;
        const off = v2.length(v2.sub(rel, v2.mul(back, along)));
        if (off >= best) continue;
        best = off;
        friend = c.teammate;
    }
    if (!friend) return false;
    f.friendlyFrags.set(p.id, showed);
    for (const [id, at] of f.friendlyFrags) if (ctx.now - at > OWN_KEEP) f.friendlyFrags.delete(id);
    return true;
}

/** Whether a wall the bot sees stands between grenade `p`, lying on the ground, and the bot's whole body. */
function shielded(ctx: BrainCtx, p: ProjectileView): boolean {
    if (p.posZ > ON_GROUND) return false;
    const me = ctx.self.pos;
    const side = v2.mul(v2.perp(v2.normalizeSafe(v2.sub(me, p.pos), { x: 1, y: 0 })), PLAYER_RAD * 0.9);
    const ends = [me, v2.add(me, side), v2.sub(me, side)];
    return ends.every((end) =>
        ctx.model.obstacles.some(
            (o) =>
                !o.view.dead &&
                o.def.collidable &&
                o.def.height > BLOCK_HEIGHT &&
                (o.view.layer & 1) === (p.layer & 1) &&
                segmentHits(o.col, p.pos, end),
        ),
    );
}

/** A grenade that first showed this close to the bot within OWN_THROWN of its last throw left its own hand. */
const OWN_HAND = 2.5;
const OWN_THROWN = 5;
/** Own frags are remembered this long after they showed (the longest fuse). */
const OWN_KEEP = 6;

/**
 * Whether `p` is the bot's own frag: seen leaving its hand (it first showed next to the bot after a throw), or it flies
 * to, or lies nearer, its planned point than the bot. A frag that bounced back off the bot's own cover lies behind the
 * bot, nearer it than the planned point: only the first rule knows it.
 */
function isOwn(ctx: BrainCtx, p: ProjectileView): boolean {
    const f = ctx.mem.fight;
    if (f.ownFrags.has(p.id)) return true;
    const showed = ctx.model.projectileSeen.get(p.id) ?? ctx.now;
    if (
        ctx.features.grenades &&
        ctx.now - ctx.mem.lastThrow < OWN_THROWN &&
        ctx.now - showed < 0.15 &&
        v2.distance(p.pos, ctx.self.pos) < OWN_HAND
    ) {
        f.ownFrags.set(p.id, showed);
        for (const [id, at] of f.ownFrags) if (ctx.now - at > OWN_KEEP) f.ownFrags.delete(id);
        return true;
    }
    const own = ctx.mem.lastThrowPos;
    return (
        !!own && ctx.now - ctx.mem.lastThrow < OWN_THROWN && v2.distance(p.pos, own) < v2.distance(ctx.self.pos, own)
    );
}

/** Whether the bot has reacted to grenade `p`: its dodge reaction (drawn once per grenade) has passed since it showed. */
function noticed(ctx: BrainCtx, p: ProjectileView): boolean {
    const seen = ctx.model.projectileSeen.get(p.id) ?? ctx.now;
    const memo = ctx.mem.fight.grenadeSeen;
    let g = memo.get(p.id);
    if (!g || g.at !== seen) {
        const [lo, hi] = ctx.params.dodgeReaction;
        g = { at: seen, delay: ctx.rng.range(lo, hi) };
        memo.set(p.id, g);
        if (memo.size > 32) for (const [id, e] of memo) if (ctx.now - e.at > 10) memo.delete(id);
    }
    return ctx.now - g.at >= g.delay;
}

/** Runs from grenades landing nearby. */
export function dodge(ctx: BrainCtx, intent: Intent): void {
    if (intent.behaviour === "revive") return;
    // a bot that does not dodge grenades (low game sense) still steps out of its own (smart brain): it knows where it
    // threw it (stage FIX: own frags hurt low-sense throwers that bounced them off their own cover and stayed next to
    // them, 34-94 HP)
    const ownOnly = !ctx.params.dodgeGrenades;
    if (ownOnly && !ctx.features.grenades) return;
    const me = ctx.self.pos;
    let away = { x: 0, y: 0 };
    const seen: Vec2[] = [];
    for (const p of ctx.model.projectiles) {
        if (!DANGEROUS.has(p.type)) continue;
        // its own grenade, flying to where it was thrown, is no threat (the smart brain: until it has left the hand
        // and the bot finds itself inside its blast; it knows its own frag without a reaction)
        const mine = isOwn(ctx, p);
        // (attributed on its first think in view, before the reaction: a teammate's throw is seen as it happens)
        const friendly = !mine && friendlyFrag(ctx, p);
        if (mine) {
            const showed = ctx.model.projectileSeen.get(p.id) ?? ctx.now;
            if (!ctx.features.grenades || ctx.now - showed < OWN_GRACE) continue;
        } else if (ownOnly || friendly || !noticed(ctx, p)) continue;
        if (shielded(ctx, p)) continue;
        // an incoming Molotov bursts where it lands: off its flight line (brain/rebirthThrows.ts)
        if (p.type === "molotov") {
            if (!ctx.features.rebirthThrows || mine) continue;
            const ahead = v2.normalizeSafe(p.dir, { x: 1, y: 0 });
            const along = Math.max(0, Math.min(MOLOTOV_REACH, v2.dot(v2.sub(me, p.pos), ahead)));
            const spot = v2.add(p.pos, v2.mul(ahead, along));
            const off = v2.distance(spot, me);
            if (off < MOLOTOV_FIRE.rad + 1)
                away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(me, spot), v2.perp(ahead)), 1 / Math.max(off, 1)));
            continue;
        }
        seen.push(p.pos);
        const d = v2.distance(p.pos, me);
        // inside its blast (defs explosion rad.max, 12 for the frag) less a unit; its own (smart): out of the blast's
        // whole reach (rad.max plus the body radius: damage counts to the body's surface)
        if (d <= (mine && ctx.features.grenades ? fragBlast(p.type).max + 1 : dodgeRadius(p.type)))
            away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(me, p.pos)), 1 / Math.max(d, 1)));
    }
    if (ctx.features.threats && !ownOnly) {
        // danger zones of the threat board: grenades about to blow (once noticed), air strike zones
        for (const z of ctx.model.threats.dangerZones()) {
            const d = v2.distance(z.pos, me);
            if (ctx.now >= z.until || d > z.rad + 2) continue;
            if (z.kind === "grenade" && !seen.some((p) => v2.distance(p, z.pos) < 1.5)) continue;
            away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(me, z.pos)), 1 / Math.max(d, 1)));
        }
    }
    if (v2.lengthSqr(away) < 1e-9) return;
    const dir = freeDir(ctx.model, me, v2.normalize(away));
    if (dir) {
        intent.moveDir = dir;
        intent.stop = false;
        intent.urgent = true;
    }
}
