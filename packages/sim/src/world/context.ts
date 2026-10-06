// What the per-player systems (weapons, melee, pickups, drops) may touch: the world, the shared systems, the
// seeded random streams and the damage entry points. `Game` implements it.
import type { Rng } from "@rebirth/core";
import type { GameOptions } from "../api.ts";
import type { BulletSystem } from "../combat/bullets.ts";
import type { DamageParams } from "../combat/damage.ts";
import type { ExplosionSystem } from "../combat/explosions.ts";
import type { ProjectileSystem } from "../combat/projectiles.ts";
import type { LootSystem } from "../loot/loot.ts";
import type { Gas } from "../match/gas.ts";
import type { CombatObserver } from "../match/observer.ts";
import type { PlaneSystem } from "../match/planes.ts";
import type { RoleSystem } from "../roles/roleSystem.ts";
import type { SimRules } from "../rules.ts";
import type { RoleAnnouncementEvent } from "../view.ts";
import type { DeadBodySystem } from "./deadBodies.ts";
import type { Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import type { SmokeSystem } from "./smoke.ts";
import type { World } from "./world.ts";

export interface SimContext {
    /** map name and team mode (M6a: bleed damage of the map, revives only in team modes) */
    readonly options: GameOptions;
    readonly world: World;
    readonly rules: SimRules;
    /** spread, pellet jitter, bullet range jitter and headshot rolls */
    readonly combatRng: Rng;
    /** loot tier rolls, drop directions and push speeds */
    readonly lootRng: Rng;
    /** projectile fuse variance and splits, shrapnel directions, explosion loot pushes and decals, smoke (M5) */
    readonly fxRng: Rng;
    /** role kits' weighted choices, promotion picks and perk rolls (M7a) */
    readonly roleRng: Rng;
    /** roles: promotions, Lone Survivr, kill leader roles, map indicators (M7a, roles/roleSystem.ts) */
    readonly roles: RoleSystem;
    readonly bullets: BulletSystem;
    readonly loot: LootSystem;
    /** thrown and launched projectiles (M5) */
    readonly projectiles: ProjectileSystem;
    /** queued explosions, resolved once per tick (M5) */
    readonly explosions: ExplosionSystem;
    /** smoke emitters and clouds (M5) */
    readonly smokes: SmokeSystem;
    /** planes: air drops (flare guns) and air strikes (strobes) (M4/M5); map pings ("ping_unlock", M5b) */
    readonly planes: PlaneSystem;
    /** where players died (M9) */
    readonly deadBodies: DeadBodySystem;
    /** red zone (heal regions do not work in the gas, M5b) */
    readonly gas: Gas;
    /** simulation time in seconds */
    readonly time: number;
    /** read-only combat notifications for the host (anti-cheat telemetry, M8); null or absent for none */
    readonly observer?: CombatObserver | null;
    getPlayer(id: number): Player | undefined;
    /** Full player damage pipeline: headshot roll, reductions, health, death and drops. */
    damagePlayer(target: Player, params: DamageParams): void;
    /** Obstacle damage: plating rules, then loot, destroyType and wakes on destruction. */
    damageObstacle(obstacle: Obstacle, params: DamageParams): void;
    /** Called by killPlayer once the victim is dead and kill credit given: kill feed, alive count, game over. */
    onPlayerKilled(victim: Player, params: DamageParams, credit: Player | undefined): void;
    /** A player reached 0 HP: the team rules knock it down or kill it (M6a, match/teams.ts). */
    onLethalDamage(target: Player, params: DamageParams): void;
    /** Called by downPlayer once the victim is down: the Kill event with `downed` true (M6a). */
    onPlayerDowned(victim: Player, params: DamageParams, source: Player | undefined): void;
    /** An emote over `player` that is not a client request (the Mass Medicate medic's "emote_loot", M6a). */
    addEmote(player: Player, type: string, itemType?: string): void;
    /** Registers an obstacle whose timers (opening crate, button cooldown, door delays, regrowth) run every tick. */
    activateObstacle(obstacle: Obstacle): void;
    /** A recorder was used: viewers in range get a RecorderEvent (M5b). */
    onRecorderUsed(obstacle: Obstacle): void;
    /** A role event for every player's kill feed (M7a; the original RoleAnnouncement). */
    announceRole(event: RoleAnnouncementEvent): void;
}
