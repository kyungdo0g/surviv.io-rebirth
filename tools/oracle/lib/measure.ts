// Small measurement helpers shared by the scenarios.
import type { Harness, ShotRecord } from "./harness.ts";
import { round } from "./json.ts";

export const SLOT = { primary: 0, secondary: 1, melee: 2, throwable: 3 } as const;

/** Distinct values (rounded to 1e-6) with their counts, in first-seen order. */
export function histogram(values: number[]): Array<{ value: number; count: number }> {
    const out: Array<{ value: number; count: number }> = [];
    for (const v of values) {
        const r = round(v);
        const hit = out.find((e) => e.value === r);
        if (hit) hit.count++;
        else out.push({ value: r, count: 1 });
    }
    return out;
}

export function intervals(ticks: number[], dt: number): number[] {
    return ticks.slice(1).map((t, i) => (t - ticks[i]) * dt);
}

/** Holds the trigger the way the weapon's fire mode needs (spam clicks for single fire). */
export function triggerFor(fireMode: string | undefined) {
    return { shootHold: true, shootStart: fireMode !== "auto" && fireMode !== "burst" };
}

/** Steps until `player` fires a new shot; returns the shot or undefined after maxTicks. */
export function waitForShot(h: Harness, player: any, maxTicks: number): ShotRecord | undefined {
    const before = h.shotsBy(player).length;
    const tick = h.stepUntil(() => h.shotsBy(player).length > before, maxTicks);
    return tick === undefined ? undefined : h.shotsBy(player)[before];
}

/** Steps until every bullet fired so far is gone (or maxTicks). */
export function waitBulletsGone(h: Harness, maxTicks: number): void {
    h.stepUntil(() => h.bullets.every((b) => b.endTick !== undefined), maxTicks);
}

/** Action type name for fixture output. */
export function actionName(sv: { GameConfig: any }, actionType: number): string {
    const entry = Object.entries(sv.GameConfig.Action).find(([k, v]) => v === actionType && k !== "Count");
    return entry ? entry[0] : String(actionType);
}
