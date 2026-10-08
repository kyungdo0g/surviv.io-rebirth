// Move speeds the owner changed on survev's guns (deliberate rebirth deviation, user/2026-10-08-loot-speed). The
// owner's new guns carry their speeds in their own defs (rebirth/newGuns.json, the balance sheet
// docs/design/new-gun-stats.json): there the launchers M79, GL-06 and Milkor MGL lost their held slowdown (equip 0) the
// same day, while the RPG-7 (-2), Panzerfaust (-1.5) and M202 (-2.5) keep theirs. survev's Barrett M107 (equip -1) and
// the Hécate II (equip -1) already slow their holder and stay as they are.
// `speed.carry` (types/weapons.ts) is a field of every gun def: the simulation sums it over both gun slots for any gun
// (packages/sim/src/world/player.ts carrySpeed), so a survev gun that gets one here slows its carrier like the DShK.
import type { GameObjectDef, GunDef } from "../types/index.ts";
import type { DefDeviation } from "./deviations.ts";

export interface GunSpeedOverride {
    id: string;
    /** survev's speed (the generated def's; the override throws if the port ever brings another) */
    survev: GunDef["speed"];
    /** the rebirth speed (applied) */
    rebirth: GunDef["speed"];
    reason: string;
}

/**
 * The PMG-134 (potato_lmg) slows its carrier like the DShK: -2 while it sits in either gun slot, -1 more when held
 * (-3 held, survev -1.5), attack -6 kept (survev/shared/defs/gameObjects/gunDefs.ts:3553).
 */
export const GUN_SPEED_OVERRIDES: readonly GunSpeedOverride[] = [
    {
        id: "potato_lmg",
        survev: { equip: -1.5, attack: -6 },
        rebirth: { carry: -2, equip: -1, attack: -6 },
        reason: "owner (2026-10-08): slower carried, slower still held, the DShK's scheme (carry -2, equip -1)",
    },
];

/** Applies GUN_SPEED_OVERRIDES to `defs` (a mutable copy of the generated record). Returns what changed. */
export function applyGunSpeedOverrides(defs: Record<string, GameObjectDef>): DefDeviation[] {
    return GUN_SPEED_OVERRIDES.map((o) => {
        const def = defs[o.id];
        if (def?.type !== "gun") throw new Error(`gun speed override: "${o.id}" is not a gun`);
        if (JSON.stringify(def.speed) !== JSON.stringify(o.survev)) {
            throw new Error(
                `${o.id}.speed is ${JSON.stringify(def.speed)}, expected survev's ${JSON.stringify(o.survev)}`,
            );
        }
        defs[o.id] = { ...def, speed: { ...o.rebirth } };
        return { id: o.id, field: "speed", original: def.speed, rebirth: { ...o.rebirth }, reason: o.reason };
    });
}
