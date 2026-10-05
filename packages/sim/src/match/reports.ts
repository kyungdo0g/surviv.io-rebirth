// Per-viewer report helpers of the snapshot (moved out of game.ts, M7a): recorders used in view since a viewer's
// previous snapshot (event sequence numbers) and bullets whose drawn path crosses its view since its previous tick.
import { type Bounds, v2 } from "@rebirth/core";
import { type Bullet, BulletSystem } from "../combat/bullets.ts";
import { segmentIntersectsAabb } from "../geom/polygon.ts";
import type { BulletEvent, RecorderEvent } from "../view.ts";

/** Recorders used (M5b), reported once to viewers in range; entries older than the retention window are dropped. */
export class RecorderLog {
    private readonly reports: Array<{ seq: number; tick: number; event: RecorderEvent }> = [];

    push(seq: number, tick: number, event: RecorderEvent): void {
        this.reports.push({ seq, tick, event });
    }

    /** Drops reports older than `minTick`. */
    prune(minTick: number): void {
        let stale = 0;
        while (stale < this.reports.length && this.reports[stale].tick < minTick) stale++;
        if (stale > 0) this.reports.splice(0, stale);
    }

    /** Recorders used after event sequence number `sinceSeq` inside `view`, in order. */
    eventsIn(sinceSeq: number, view: Bounds): RecorderEvent[] {
        const out: RecorderEvent[] = [];
        for (const { seq, event } of this.reports) {
            const p = event.pos;
            if (seq <= sinceSeq || p.x < view.min.x || p.x > view.max.x || p.y < view.min.y || p.y > view.max.y) {
                continue;
            }
            out.push({ ...event, pos: v2.copy(p) });
        }
        return out;
    }
}

/** Bullets reported after `sinceTick` whose drawn path crosses `view` (latest state, one entry per bullet). */
export function bulletEventsIn(
    reports: ReadonlyArray<{ tick: number; bullet: Bullet }>,
    sinceTick: number,
    view: Bounds,
): BulletEvent[] {
    const byId = new Map<number, BulletEvent>();
    for (const { tick, bullet } of reports) {
        if (tick <= sinceTick || byId.has(bullet.id)) continue;
        const end = v2.add(bullet.startPos, v2.mul(bullet.dir, bullet.clientDistance));
        if (!segmentIntersectsAabb(bullet.startPos, end, view.min, view.max)) continue;
        byId.set(bullet.id, BulletSystem.toEvent(bullet));
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
}
