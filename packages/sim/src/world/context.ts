// What the per-player systems (weapons, melee, pickups, drops) may touch: the world, the shared systems, the
// seeded random streams and the damage entry points. `Game` implements it.
import type { Rng } from "@rebirth/core";
import type { BulletSystem } from "../combat/bullets.ts";
import type { DamageParams } from "../combat/damage.ts";
import type { LootSystem } from "../loot/loot.ts";
import type { SimRules } from "../rules.ts";
import type { Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import type { World } from "./world.ts";

export interface SimContext {
    readonly world: World;
    readonly rules: SimRules;
    /** spread, pellet jitter, bullet range jitter and headshot rolls */
    readonly combatRng: Rng;
    /** loot tier rolls, drop directions and push speeds */
    readonly lootRng: Rng;
    readonly bullets: BulletSystem;
    readonly loot: LootSystem;
    /** simulation time in seconds */
    readonly time: number;
    getPlayer(id: number): Player | undefined;
    /** Full player damage pipeline: headshot roll, reductions, health, death and drops. */
    damagePlayer(target: Player, params: DamageParams): void;
    /** Obstacle damage: plating rules, then loot, destroyType and wakes on destruction. */
    damageObstacle(obstacle: Obstacle, params: DamageParams): void;
}
