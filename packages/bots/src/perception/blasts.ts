// Exploding obstacles in view (BrainFeatures.blastAware; owner, 2026-10-08: bots hid behind red barrels as if they
// did not know they explode). Built from the snapshot like a client sees it: the obstacles in view whose def explodes
// (knowledge/explosives.ts), the health each shows (ObstacleView.healthT: barrels shrink and smoke as they take damage,
// and the server sends every hit on one at once so the client can show it, docs/research/mechanics/explosions.md
// "Obstacles and explosions"), and when an explosive on the screen was last seen losing health (someone is shooting
// it). The Brain installs one per model when the flag is on; without it nothing here runs and the cover search
// (brain/combat.ts findCoverFrom) is unchanged.
// What it answers:
// - coverCost: what hiding at a spot behind an obstacle costs on top of the walk: an explosive obstacle is poor cover
//   (EXPLOSIVE_COVER), none at all while it is being shot or once it is badly damaged; a spot inside a blast pays for
//   the damage it would take there (BLAST_COST per 100 HP), and a spot inside the blast of an explosive being shot (or
//   the hard blast of a badly damaged one) is refused;
// - exposure / danger: the blast a body at a spot would take, and the explosive being shot whose blast reaches the bot
//   (it steps out until clear of the blast: brain/blast.ts);
// - inShot: the explosives close enough to hurt the bot that its own shots may strike (brain/blast.ts holds fire when
//   they would break one soon).
// A wall, door or tree between the explosive and the spot stops the blast (rays stop at collidable obstacles taller
// than 0.5: explosions.md "Damage model" 5); crates, stones and other 0.5-high cover do not.
import { type Vec2, v2 } from "@rebirth/core";
import { colliderCenter, colliderRadius } from "../geom.ts";
import { blastDamage, blastReach, type Explosive, explosiveOf, stopsBlast } from "../knowledge/explosives.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import { segmentHitsCollider } from "./rays.ts";
import type { SeenObstacle, WorldModel } from "./world.ts";

/** An explosive whose health dropped this recently (s) is being shot. */
export const HOT_KEEP = 1.5;
/** Below this share of its health an explosive is no cover at all (it smokes; one more burst sets it off). */
export const LOW_HEALTH = 0.5;
/** Cover cost (units of walking) of hiding behind an explosive obstacle, on top of its blast at the spot. */
const EXPLOSIVE_COVER = 12;
/** Cover cost (units of walking) per 100 HP of blast damage the spot would take. */
const BLAST_COST = 6;
/** A spot taking this much blast damage or more from an explosive being shot is no cover... */
export const HOT_HP = 10;
/** ...nor one taking this much from a badly damaged one (its hard blast: a barrel's within about 7.7 u). */
const LOW_HP = 50;
/** A bot stepping out of a blast walks this far past its reach. */
const OUT_MARGIN = 1;
/** Tracked health of explosives out of view is forgotten after this long. */
const FORGET = 30;

export interface LiveExplosive {
    o: SeenObstacle;
    e: Explosive;
    /** the collider's centre (where the blast starts) */
    c: Vec2;
    /** health left (healthT x the def's health) */
    hp: number;
    /** last time it was seen losing health on the screen (-Infinity: never) */
    hitAt: number;
    /** when the current run of hits began */
    hitSince: number;
}

interface Track {
    hp: number;
    hitAt: number;
    hitSince: number;
    seen: number;
}

/** Whether a collidable obstacle taller than 0.5 stands between the explosive `x` and `p` (the blast stops there). */
export function blastShielded(model: WorldModel, x: SeenObstacle, from: Vec2, p: Vec2): boolean {
    for (const o of model.obstacles) {
        if (o === x || o.view.dead || !stopsBlast(o.def) || !sameLayer(x.view.layer, o.view.layer)) continue;
        if (segmentHitsCollider(o.col, from, p)) return true;
    }
    return false;
}

export class BlastWatch {
    private list: LiveExplosive[] = [];
    private readonly byId = new Map<number, LiveExplosive>();
    private readonly track = new Map<number, Track>();
    private src: SeenObstacle[] | null = null;
    private len = -1;
    private time = Number.NaN;
    private layer = -1;

    /** The live explosives on the bot's floor in the latest snapshot (refreshed once per snapshot). */
    sync(model: WorldModel): readonly LiveExplosive[] {
        const now = model.time;
        if (model.obstacles === this.src && model.obstacles.length === this.len && now === this.time) {
            if (model.self.layer === this.layer) return this.list;
        }
        const fresh = now !== this.time;
        this.src = model.obstacles;
        this.len = model.obstacles.length;
        this.time = now;
        this.layer = model.self.layer;
        this.list = [];
        this.byId.clear();
        for (const o of model.obstacles) {
            if (o.view.dead) continue;
            const e = explosiveOf(o.def);
            if (!e) continue;
            const hp = o.view.healthT * e.health;
            let t = this.track.get(o.view.id);
            if (!t) {
                t = { hp, hitAt: Number.NEGATIVE_INFINITY, hitSince: Number.NEGATIVE_INFINITY, seen: now };
                this.track.set(o.view.id, t);
            } else if (fresh) {
                // a drop seen on the screen is a hit someone landed (smoke and the shrinking barrel show it)
                const c = colliderCenter(o.col);
                if (hp < t.hp - 1e-6 && model.onScreen(c, 1)) {
                    if (now - t.hitAt > HOT_KEEP) t.hitSince = now;
                    t.hitAt = now;
                }
                t.hp = hp;
                t.seen = now;
            }
            if (!sameLayer(model.self.layer, o.view.layer)) continue;
            const x: LiveExplosive = { o, e, c: colliderCenter(o.col), hp, hitAt: t.hitAt, hitSince: t.hitSince };
            this.list.push(x);
            this.byId.set(o.view.id, x);
        }
        if (fresh && this.track.size > this.list.length + 32) {
            for (const [id, t] of this.track) if (now - t.seen > FORGET) this.track.delete(id);
        }
        return this.list;
    }

    /** Whether `x` is being shot: seen losing health within HOT_KEEP of `now`. */
    hot(x: LiveExplosive, now: number): boolean {
        return now - x.hitAt <= HOT_KEEP;
    }

    /** Whether `x` is badly damaged (under LOW_HEALTH of its health). */
    low(x: LiveExplosive): boolean {
        return x.hp < x.e.health * LOW_HEALTH;
    }

    /**
     * Blast exposure of a body at `p`: the damage it would take from each explosive in view, as a cover cost, the worst
     * single blast, and whether one being shot would hit it for HOT_HP or more, or a badly damaged one for LOW_HP or
     * more (walls between stop a blast).
     */
    exposure(model: WorldModel, p: Vec2): { cost: number; worst: number; hot: boolean } {
        let cost = 0;
        let worst = 0;
        let hot = false;
        for (const x of this.sync(model)) {
            const d = v2.distance(x.c, p);
            if (d >= blastReach(x.e)) continue;
            const dmg = blastDamage(x.e, d);
            if (dmg <= 0 || blastShielded(model, x.o, x.c, p)) continue;
            cost += (BLAST_COST * dmg) / 100;
            worst = Math.max(worst, dmg);
            if (this.hot(x, model.time) ? dmg >= HOT_HP : this.low(x) && dmg >= LOW_HP) hot = true;
        }
        return { cost, worst, hot };
    }

    /**
     * Extra cost of a cover spot behind obstacle `id` (walking units), or null when it is no cover at all: the
     * obstacle is an explosive being shot or badly damaged, or the spot lies in the blast of one (see the header).
     */
    coverCost(model: WorldModel, id: number, spot: Vec2): number | null {
        this.sync(model);
        let cost = 0;
        const own = this.byId.get(id);
        if (own) {
            if (this.hot(own, model.time) || this.low(own)) return null;
            cost += EXPLOSIVE_COVER;
        }
        const ex = this.exposure(model, spot);
        return ex.hot ? null : cost + ex.cost;
    }

    /**
     * The explosives whose blast would hit a body at `from` for HOT_HP or more (nothing between) that lie within
     * `cone` radians of any of `dirs` (unit vectors), each with its angular offset from the nearest direction, its
     * angular half-width as seen from `from` (a box by its half diagonal), the unit direction to its centre and its
     * distance: what a shot from there may strike, setting it off next to the shooter (brain/blast.ts holdBlastFire
     * weighs how soon).
     */
    inShot(
        model: WorldModel,
        from: Vec2,
        dirs: readonly Vec2[],
        cone: number,
    ): Array<{ x: LiveExplosive; off: number; half: number; u: Vec2; d: number }> {
        const out: Array<{ x: LiveExplosive; off: number; half: number; u: Vec2; d: number }> = [];
        for (const x of this.sync(model)) {
            const to = v2.sub(x.c, from);
            const d = v2.length(to);
            if (d >= blastReach(x.e) || blastDamage(x.e, d) < HOT_HP) continue;
            const r = colliderRadius(x.o.col);
            const half = d <= r ? Math.PI : Math.asin(r / d);
            const u = v2.div(to, Math.max(d, 1e-6));
            let off = Math.PI;
            for (const dir of dirs) off = Math.min(off, Math.acos(Math.max(-1, Math.min(1, v2.dot(dir, u)))));
            if (off > half + cone || blastShielded(model, x.o, x.c, from)) continue;
            out.push({ x, off, half, u, d });
        }
        return out;
    }

    /**
     * The explosive being shot that a body at `p` should walk away from, noticed at least `reaction` seconds after its
     * hits began (nothing between it and `p`): one whose blast would hit `p` for `startHp` or more, or the one `p` is
     * already walking away from (`from`, an obstacle id) while `p` is within OUT_MARGIN past its reach, so a bot
     * stepping out walks clear of it, not to the edge; the nearest relative to its reach first. Null when none. `dmg`
     * is the blast the body would take at `p`.
     */
    danger(
        model: WorldModel,
        p: Vec2,
        reaction: number,
        startHp: number,
        from: number,
    ): { x: LiveExplosive; dmg: number } | null {
        let best: { x: LiveExplosive; dmg: number } | null = null;
        let bestIn = 0;
        const now = model.time;
        for (const x of this.sync(model)) {
            if (!this.hot(x, now) || now - x.hitSince < reaction) continue;
            const d = v2.distance(x.c, p);
            const inside = blastReach(x.e) + OUT_MARGIN - d;
            const dmg = blastDamage(x.e, d);
            if (inside <= bestIn || (x.o.view.id !== from && dmg < startHp)) continue;
            if (blastShielded(model, x.o, x.c, p)) continue;
            bestIn = inside;
            best = { x, dmg };
        }
        return best;
    }
}

const watches = new WeakMap<WorldModel, BlastWatch>();

/** Installs the blast watch on `model` (BrainFeatures.blastAware; the Brain does it once). */
export function installBlastWatch(model: WorldModel): BlastWatch {
    let w = watches.get(model);
    if (!w) {
        w = new BlastWatch();
        watches.set(model, w);
    }
    return w;
}

/** The blast watch of `model`, null when its brain does not know about exploding obstacles. */
export function blastWatchOf(model: WorldModel): BlastWatch | null {
    return watches.get(model) ?? null;
}
