// Recent player hits for the rebirth hit feedback (user/2026-10-07-hit-feedback): every damaging hit is logged with
// the tick it belongs to, and each snapshot lists the ones its active player dealt or took since the viewer's previous
// snapshot (the explosion report convention: tick > sinceTick). Deterministic: no randomness, plain records.
import { type Vec2, v2 } from "@rebirth/core";
import type { HitEvent } from "../viewHits.ts";

interface HitEntry {
    tick: number;
    targetId: number;
    sourceId: number;
    amount: number;
    damageType: number;
    headshot: boolean;
    armored: boolean;
    dir: Vec2 | null;
}

export class HitLog {
    /** tick the hits recorded now belong to (the game keeps it at its tick count + 1) */
    tick = 1;
    private readonly entries: HitEntry[] = [];

    get size(): number {
        return this.entries.length;
    }

    record(
        targetId: number,
        sourceId: number,
        amount: number,
        damageType: number,
        headshot: boolean,
        armored: boolean,
        dir: Vec2 | undefined,
    ): void {
        if (!(amount > 0)) return;
        const d = dir ? v2.normalizeSafe(dir, { x: 1, y: 0 }) : null;
        this.entries.push({ tick: this.tick, targetId, sourceId, amount, damageType, headshot, armored, dir: d });
    }

    /**
     * Hits `activeId` dealt or took after `sinceTick` up to `untilTick` (the snapshot's tick: a hit dealt between steps
     * belongs to the next tick and waits for its snapshot), oldest first, at most `max`. The other player's id is masked to
     * 0 unless it is in `visible` (the viewer's view this snapshot), so a shooter hidden in smoke stays anonymous. Only
     * hits the active player took carry a direction; self damage is listed once, as taken.
     */
    eventsFor(
        activeId: number,
        sinceTick: number,
        untilTick: number,
        visible: ReadonlySet<number>,
        max = 255,
    ): HitEvent[] {
        let start = this.entries.length;
        while (start > 0 && this.entries[start - 1].tick > sinceTick) start--;
        const out: HitEvent[] = [];
        for (let i = start; i < this.entries.length && out.length < max; i++) {
            const e = this.entries[i];
            if (e.tick > untilTick) break;
            const taken = e.targetId === activeId;
            if (!taken && e.sourceId !== activeId) continue;
            const mask = (id: number) => (id === activeId || visible.has(id) ? id : 0);
            const hit: HitEvent = {
                targetId: taken ? activeId : mask(e.targetId),
                sourceId: taken ? mask(e.sourceId) : activeId,
                amount: e.amount,
                damageType: e.damageType,
                headshot: e.headshot,
                armored: e.armored,
            };
            if (taken && e.dir) hit.dir = { x: e.dir.x, y: e.dir.y };
            out.push(hit);
        }
        return out;
    }

    /** Drops hits logged before `minTick`. */
    prune(minTick: number): void {
        let n = 0;
        while (n < this.entries.length && this.entries[n].tick < minTick) n++;
        if (n > 0) this.entries.splice(0, n);
    }
}
