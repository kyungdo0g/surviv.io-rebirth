// Last-seen memory (round 3, user report 25: "if the target hides mid-chase, keep the last seen position / direction,
// search and prefire; a bot must not forget where the target went"). Seen from above, obstacles hide nobody: an enemy
// drops out of sight by walking under a roof, into a bush, into smoke or off the screen. At that moment the tracker
// records where it was last seen, its heading and speed, why it vanished and the spot to hold or prefire (the door or
// window it went in by, the bush, the smoke cloud, the screen edge it left by), with a confidence that decays with time.
// WorldModel keeps the contact itself only for DifficultyParams.memory (2-6 s); this record lasts KEEP seconds, so the
// corner hold and prefire (brain/lostTarget.ts) and a search (MOVE: `searchPoints`) outlive it. Built from the bot's
// own snapshots: the record is what the screen showed at the moment of loss and is never updated by anything the bot
// cannot see (it is dropped when the enemy shows again, dies or KEEP runs out). Pure: no rng, no clock.
import { type Vec2, v2 } from "@rebirth/core";
import { sameLayer } from "../nav/cellGrid.ts";
import { concealedAmong, concealerOf, covers } from "./foliage.ts";
import type { Contact, WorldModel } from "./world.ts";

export type VanishCause = "roof" | "foliage" | "smoke" | "offscreen" | "unknown";

export interface LastSeenTrack {
    id: number;
    /** where it was last seen */
    pos: Vec2;
    /** its direction of travel then (its facing when it stood still), unit */
    heading: Vec2;
    /** its speed then (u/s) */
    speed: number;
    layer: number;
    /** game time it was last seen */
    at: number;
    cause: VanishCause;
    /**
     * the spot to hold or prefire: the last-seen spot at the door or window it went under the roof by, the middle of the
     * bush it walked into, the centre of the smoke cloud, the last-seen spot at the screen edge
     */
    corner: Vec2;
    /** it had fired within HOSTILE seconds of vanishing (it was in a fight, likely with the bot) */
    hostile: boolean;
    /** it held a gun when it vanished */
    armed: boolean;
}

/** A lost enemy is remembered this long (s). */
const KEEP = 20;
/** Confidence e-folding time (s): 1 at the loss, 0.37 after TAU, 0.05 after 3 TAU. */
const TAU = 5;
/** Fired this recently before vanishing: hostile. */
const HOSTILE = 2;
/** The predicted spot runs at most this far along the heading (units), at this fraction of the last speed. */
const PRED_MAX = 8;
const PRED_ROOF = 3;
const PRED_SPEED = 0.7;
/** A search covers at least this radius, growing with the time lost (a walking player, half its pace), up to SEARCH_MAX. */
const SEARCH_MIN = 1.5;
const SEARCH_MAX = 20;
const SEARCH_PACE = 0.5;
/** Points this far along its heading are probed for where it went (a roof, a bush, the screen edge). */
const PROBES = [1, 2, 3];

export class LastSeenTracker {
    private readonly tracks = new Map<number, LastSeenTrack>();
    /** enemies visible at the last snapshot */
    private readonly live = new Set<number>();

    /**
     * One snapshot (WorldModel.updateObjects, after the contacts): an enemy visible last time and not now vanished;
     * one seen again, dead or deleted drops its record. `hidden` tells a point under someone else's roof.
     */
    note(model: WorldModel, deleted: readonly number[] | undefined, hidden: (p: Vec2) => boolean): void {
        for (const id of deleted ?? []) {
            this.tracks.delete(id);
            this.live.delete(id);
        }
        for (const c of model.contacts.values()) {
            if (c.teammate) continue;
            if (c.visible) {
                this.live.add(c.id);
                this.tracks.delete(c.id);
            } else if (this.live.delete(c.id)) {
                this.tracks.set(c.id, vanish(model, c, hidden));
            }
        }
        // a visible enemy whose contact is gone at once died (or left the game): nothing to look for
        for (const id of this.live) if (!model.contacts.get(id)?.visible) this.live.delete(id);
        for (const [id, t] of this.tracks) if (model.time - t.at > KEEP) this.tracks.delete(id);
    }

    /** The record of an enemy out of sight, or undefined (seen now, never seen, dead or forgotten). */
    get(id: number): Readonly<LastSeenTrack> | undefined {
        return this.tracks.get(id);
    }

    /** Every lost enemy, freshest first. */
    all(): Readonly<LastSeenTrack>[] {
        return [...this.tracks.values()].sort((a, b) => b.at - a.at);
    }

    /** Forgets an enemy (a search found nothing there). */
    drop(id: number): void {
        this.tracks.delete(id);
    }
}

/** How sure the bot is that the enemy is still about where `t` says: 1 at the loss, decaying (e-folding TAU). */
export function lastSeenConfidence(t: Readonly<LastSeenTrack>, now: number): number {
    return Math.exp(-Math.max(0, now - t.at) / TAU);
}

/**
 * Where the enemy of `t` most likely is now: along its heading at part of its last speed, at most PRED_MAX units (3
 * into a building: a human remembers the door, not a track behind the walls); the corner itself in smoke or a bush.
 */
export function lastSeenPredicted(t: Readonly<LastSeenTrack>, now: number): Vec2 {
    if (t.cause === "smoke" || t.cause === "foliage") return v2.copy(t.corner);
    const cap = t.cause === "roof" ? PRED_ROOF : PRED_MAX;
    const run = Math.min(cap, t.speed * PRED_SPEED * Math.max(0, now - t.at));
    return v2.add(t.pos, v2.mul(t.heading, run));
}

/** Radius of the area the enemy of `t` may be in by now (a search covers it). */
export function lastSeenRadius(t: Readonly<LastSeenTrack>, now: number): number {
    const pace = Math.max(t.speed, 3) * SEARCH_PACE;
    return Math.min(SEARCH_MAX, SEARCH_MIN + pace * Math.max(0, now - t.at));
}

/** Spots worth checking for the enemy of `t`, most likely first: the corner, the predicted spot, the last-seen spot. */
export function searchPoints(t: Readonly<LastSeenTrack>, now: number): Vec2[] {
    const out: Vec2[] = [];
    for (const p of [t.corner, lastSeenPredicted(t, now), t.pos]) {
        if (!out.some((q) => v2.distance(q, p) < 1.5)) out.push(v2.copy(p));
    }
    return out;
}

/** Why `c` dropped out of sight this snapshot, and the spot to hold. */
function vanish(model: WorldModel, c: Contact, hidden: (p: Vec2) => boolean): LastSeenTrack {
    const age = Math.max(0, model.time - c.lastSeen);
    const speed = v2.length(c.vel);
    const heading = speed > 0.5 ? v2.div(c.vel, speed) : v2.normalizeSafe(c.dir, { x: 1, y: 0 });
    // where it is about now (one more step along its way: it was last drawn a snapshot ago) and a few units on
    const next = v2.add(c.pos, v2.mul(c.vel, Math.min(age, 0.25) + 0.05));
    const probes = [next, ...PROBES.map((k) => v2.add(c.pos, v2.mul(heading, k)))];
    let cause: VanishCause = "unknown";
    let corner = v2.copy(c.pos);
    const smoke = model.smokes.find((s) => sameLayer(s.layer, c.layer) && v2.distance(s.pos, next) < s.rad + 1.5);
    const bush = probes.find((p) => concealedAmong(model.obstacles, p, c.layer));
    if (smoke) {
        cause = "smoke";
        corner = v2.copy(smoke.pos);
    } else if (hidden(c.pos) || probes.some(hidden)) {
        cause = "roof";
    } else if (bush) {
        cause = "foliage";
        corner = concealerAt(model, bush, c.layer) ?? v2.copy(bush);
    } else if (probes.some((p) => !model.onScreen(p, 0.5))) {
        cause = "offscreen";
    }
    return {
        id: c.id,
        pos: v2.copy(c.pos),
        heading,
        speed,
        layer: c.layer,
        at: c.lastSeen,
        cause,
        corner,
        hostile: model.time - c.lastShotAt < HOSTILE,
        armed: model.time - c.lastArmedAt < HOSTILE,
    };
}

/** The centre of the bush (or table) hiding a body at `p`, or null. */
function concealerAt(model: WorldModel, p: Vec2, layer: number): Vec2 | null {
    for (const o of model.obstacles) {
        const k = concealerOf(o);
        if (k && !k.partial && sameLayer(k.layer, layer) && covers(k, p, 1)) return v2.copy(k.c);
    }
    return null;
}
