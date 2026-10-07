// Short position histories of the bot and of the enemies on its screen, one sample per snapshot (bot overhaul
// COMBAT-12): a human reacts to what its screen showed a moment ago, and the screen delays both players together, so a
// lagged percept takes the bot's own position and the target's from the same moment (diagnosis round 2 issue 2 RC2 and
// fix concern 1: a delayed target against the bot's true position under-reports the gap in a chase).
import { type Vec2, v2 } from "@rebirth/core";

/** Samples kept per player: 16 snapshots, ~0.5 s at 30 ms. */
const SIZE = 16;

class Ring {
    readonly t = new Float64Array(SIZE).fill(Number.NEGATIVE_INFINITY);
    readonly x = new Float64Array(SIZE);
    readonly y = new Float64Array(SIZE);
    head = 0;
    last = Number.NEGATIVE_INFINITY;

    push(time: number, p: Vec2): void {
        this.t[this.head] = time;
        this.x[this.head] = p.x;
        this.y[this.head] = p.y;
        this.head = (this.head + 1) % SIZE;
        this.last = time;
    }

    /** The newest sample at or before `time`, or null. */
    at(time: number): Vec2 | null {
        for (let k = 1; k <= SIZE; k++) {
            const i = (this.head - k + SIZE) % SIZE;
            if (this.t[i] <= time + 1e-9) return { x: this.x[i], y: this.y[i] };
        }
        return null;
    }
}

export interface LaggedPercept {
    /** the bot's own position and the target's, `lag` seconds ago */
    self: Vec2;
    target: Vec2;
}

export class Trails {
    private readonly self = new Ring();
    private readonly others = new Map<number, Ring>();

    /** One snapshot: the bot's position and every enemy it sees now. */
    record(time: number, selfPos: Vec2, seen: Iterable<{ id: number; pos: Vec2 }>): void {
        this.self.push(time, selfPos);
        for (const c of seen) {
            let r = this.others.get(c.id);
            if (!r) this.others.set(c.id, (r = new Ring()));
            r.push(time, c.pos);
        }
        if (this.others.size > 64) {
            for (const [id, r] of this.others) if (time - r.last > 2) this.others.delete(id);
        }
    }

    /**
     * Both positions as the screen showed them `lag` seconds before `now`: null when the target was not on screen then
     * (a fresh sighting has nothing older to show).
     */
    lagged(id: number, now: number, lag: number): LaggedPercept | null {
        const r = this.others.get(id);
        if (!r) return null;
        const target = r.at(now - lag);
        const self = this.self.at(now - lag);
        return target && self ? { self, target } : null;
    }

    /** The relative offset target - self the screen showed `lag` seconds before `now`, or null. */
    laggedOffset(id: number, now: number, lag: number): Vec2 | null {
        const p = this.lagged(id, now, lag);
        return p ? v2.sub(p.target, p.self) : null;
    }
}
