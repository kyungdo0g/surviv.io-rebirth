// Pure state machines of the match metrics (no game access, unit-tested on scripted streams): gap-tolerant episodes
// (chases, flights), contested spots a bot keeps fleeing from and coming back to (the house.ts oscillation of user
// report 14), and the exposure clock that times a bot's first shot from the moment a target showed on its screen with
// a line of fire (user report 3: instant shots when a target steps out of cover).

/** Episodes whose samples are at most `gap` seconds apart are one episode. */
export class EpisodeClock {
    private start = Number.NaN;
    private last = Number.NaN;
    private readonly gap: number;

    constructor(gap = 3) {
        this.gap = gap;
    }

    get open(): boolean {
        return !Number.isNaN(this.start);
    }

    /** The condition holds at `now`; returns the duration of an episode it closed (a gap ended it), else -1. */
    on(now: number): number {
        let closed = -1;
        if (this.open && now - this.last > this.gap) closed = this.close();
        if (!this.open) this.start = now;
        this.last = now;
        return closed;
    }

    /** The condition does not hold at `now`: closes the episode once the gap has passed (its duration), else -1. */
    off(now: number): number {
        return this.open && now - this.last > this.gap ? this.close() : -1;
    }

    /** Ends the episode (match end, death): its duration, or -1 without one. */
    close(): number {
        if (!this.open) return -1;
        const d = this.last - this.start;
        this.start = Number.NaN;
        this.last = Number.NaN;
        return d;
    }
}

/** Flee starts this close together are the same contested spot... */
export const SPOT_RADIUS = 20;
/** ...for this long after the last flight from it... */
export const SPOT_MEMORY = 120;
/** ...and a new flight counts as a cycle only after the bot came back this far towards the spot. */
export const SPOT_AWAY = 8;

interface Spot {
    x: number;
    y: number;
    lastFlee: number;
    /** farthest the bot got from the spot since its last flight from it */
    away: number;
    /** it came back SPOT_AWAY towards the spot from the farthest it got, on its own (looting, exploring: not fighting) */
    approached: boolean;
    cycles: number;
}

/**
 * Contested spots of one bot: a flight that starts within SPOT_RADIUS of an earlier one (in the last SPOT_MEMORY s),
 * after the bot had come back at least SPOT_AWAY towards it from the farthest it got, on its own (in an approach
 * behaviour: looting, exploring, the zone; a fight that drags it back does not count), is one more cycle there (flee,
 * return, flee: report 14). A bot that flees in steps along one line never comes back and makes no cycle.
 */
export class FleeSpots {
    private readonly spots: Spot[] = [];

    /** The bot's position every sample (how far it got from its spots) and whether it is in an approach behaviour. */
    move(x: number, y: number, approaching: boolean): void {
        for (const s of this.spots) {
            const d = Math.hypot(x - s.x, y - s.y);
            s.away = Math.max(s.away, d);
            if (approaching && s.away - d >= SPOT_AWAY) s.approached = true;
        }
    }

    /** A flight starts at (x, y): returns whether it is a new cycle at a known spot. */
    flee(now: number, x: number, y: number): boolean {
        for (const s of this.spots) {
            if (now - s.lastFlee > SPOT_MEMORY || Math.hypot(x - s.x, y - s.y) > SPOT_RADIUS) continue;
            const cycle = s.approached;
            if (cycle) s.cycles++;
            s.lastFlee = now;
            s.away = 0;
            s.approached = false;
            return cycle;
        }
        this.spots.push({ x, y, lastFlee: now, away: 0, approached: false, cycles: 0 });
        return false;
    }

    /** Spots where the bot came back at least once, cycles in total and the most at one spot. */
    summary(): { spots: number; cycles: number; max: number } {
        let spots = 0;
        let cycles = 0;
        let max = 0;
        for (const s of this.spots) {
            if (s.cycles > 0) spots++;
            cycles += s.cycles;
            max = Math.max(max, s.cycles);
        }
        return { spots, cycles, max };
    }
}

/** A target hidden (or without a line of fire) for at least this long is exposed afresh when it shows again. */
export const EXPOSURE_GAP = 0.5;

/**
 * One bot's view of one enemy. `see` runs for every pair whose enemy is on the bot's screen (visible as a human
 * would see it or not); `expose` only while the enemy is the bot's target (the line of fire costs ray casts). A shot
 * yields one latency per exposure: from the start of the current exposure (visible with a line of fire; when the line
 * was not tracked, the start of the sighting, which is never later) to the shot.
 */
export class PairClock {
    private visOpen = Number.NaN;
    private visLast = Number.NEGATIVE_INFINITY;
    private expOpen = Number.NaN;
    private expLast = Number.NEGATIVE_INFINITY;
    /** the line of fire is tracked; `fresh` until its first sample */
    private tracked = false;
    private fresh = false;
    /** the exposure start that already produced a latency */
    private sampled = Number.NaN;

    see(now: number, visible: boolean): void {
        if (!visible) return;
        if (Number.isNaN(this.visOpen) || now - this.visLast > EXPOSURE_GAP) this.visOpen = now;
        this.visLast = now;
    }

    visibleAt(now: number): boolean {
        return !Number.isNaN(this.visOpen) && now - this.visLast <= EXPOSURE_GAP;
    }

    /** Starts (or stops) tracking the line of fire: the enemy became (or stopped being) the bot's target. */
    track(on: boolean): void {
        if (on && !this.tracked) this.fresh = true;
        this.tracked = on;
        if (!on) this.expOpen = Number.NaN;
    }

    get tracking(): boolean {
        return this.tracked;
    }

    /** A line-of-fire sample while tracked: `shootable` = visible and some ray to the body is clear. */
    expose(now: number, shootable: boolean): void {
        if (!this.tracked) return;
        const fresh = this.fresh;
        this.fresh = false;
        if (!shootable) return;
        if (Number.isNaN(this.expOpen) || now - this.expLast > EXPOSURE_GAP) {
            // first sample after tracking began: the line may have been clear since the sighting
            this.expOpen = fresh && this.visibleAt(now) ? this.visOpen : now;
        }
        this.expLast = now;
    }

    /** A shot at the enemy now: seconds since the exposure began, once per exposure; null when not exposed. */
    shot(now: number): number | null {
        if (!this.visibleAt(now)) return null;
        let start = this.visOpen;
        if (this.tracked) {
            if (Number.isNaN(this.expOpen) || now - this.expLast > EXPOSURE_GAP) return null;
            start = Math.max(this.expOpen, this.visOpen);
        }
        if (start === this.sampled) return null;
        this.sampled = start;
        return now - start;
    }
}

/** The q-quantile (0..1) of `xs` (nearest rank; NaN when empty). */
export function quantile(xs: readonly number[], q: number): number {
    if (!xs.length) return Number.NaN;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}
