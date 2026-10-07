// Random Hits section contents (rebirth hit feedback, schema 11) for the Update property tests: every hit names the
// active player as its target (taken, maybe with a direction, maybe self damage) or as its source (dealt, no direction).
import type { Rng } from "@rebirth/core";
import type { HitEvent } from "@rebirth/sim";

export function randHits(rng: Rng, activeId: number): HitEvent[] {
    if (rng.bool(0.6)) return [];
    return Array.from({ length: rng.int(1, 12) }, () => {
        const taken = rng.bool(0.5);
        const other = rng.bool(0.15) ? 0 : rng.bool(0.1) ? activeId : rng.int(1, 65535);
        const hit: HitEvent = {
            targetId: taken ? activeId : other,
            sourceId: taken ? other : activeId,
            amount: rng.range(0.01, 100),
            damageType: rng.int(0, 4),
            headshot: rng.bool(0.15),
            armored: rng.bool(0.4),
        };
        if (taken && rng.bool(0.8)) {
            const a = rng.range(-Math.PI, Math.PI);
            hit.dir = { x: Math.cos(a), y: Math.sin(a) };
        }
        return hit;
    });
}
