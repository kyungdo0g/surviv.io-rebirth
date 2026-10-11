// Damage on a hit-counted blast door (ObstacleDef.explosionGate.hitsToOpen: blast_door_01; the owner, 2026-10-11: one
// M202 rocket, two NLAW rounds or six RPG-7 rockets open it). Its health on the wire (ObstacleView.healthT) is the share
// of the door left: 5/6 after one RPG-7 rocket. The slab never shrinks (scale.destroy 1: it must keep blocking the
// doorway), so the progress shows as scorching instead: the steel darkens with every hit, down to SCORCH_MAX at the
// last hit before it gives, and a door that took a hit smokes like a damaged barrel (survev's smoke_barrel emitter).
import type { ObstacleDef } from "@rebirth/defs";

/** The darkest the door gets: its colour value drops by this much as its health runs out. */
export const SCORCH_MAX = 0.6;

/** Whether the obstacle counts hits (and shows them by scorching). */
export function isHitCountedGate(def: ObstacleDef): boolean {
    return !!def.explosionGate?.hitsToOpen;
}

/** The colour value factor of a hit-counted door at `healthT` (1 untouched, 1 - SCORCH_MAX at no health left). */
export function gateScorch(healthT: number): number {
    const t = Math.min(Math.max(healthT, 0), 1);
    return 1 - SCORCH_MAX * (1 - t);
}

/** Whether a hit-counted door smokes: it took a hit and still stands. */
export function gateSmokes(healthT: number, dead: boolean): boolean {
    return !dead && healthT < 1 - 1e-3;
}
