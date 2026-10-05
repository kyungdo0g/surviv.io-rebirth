// Damage entry points shared by bullets and melee: player damage with death, obstacle damage with destruction.
// Behaviour follows survev server/src/game/objects/player.ts (damage, kill) and obstacle.ts (damage, kill).
import { DamageType, GameObjectDefs, hasDef } from "@rebirth/defs";
import { dropEverythingOnDeath, dropObstacleLoot, spawnDestroyType } from "../loot/drops.ts";
import type { SimContext } from "../world/context.ts";
import type { Obstacle } from "../world/entities.ts";
import type { Player } from "../world/player.ts";
import { computeDamage, type DamageParams, rollHeadshot } from "./damage.ts";

/** Result of the last hit a player took (tests, kill feed later). */
export interface HitRecord {
    amount: number;
    headshot: boolean;
    sourceId: number;
    gameSourceType: string;
}

export function applyPlayerDamage(ctx: SimContext, target: Player, params: DamageParams): void {
    if (target.dead) return;
    // TODO(M6): teammates cannot hurt each other (survev player.ts damage) once teams exist
    const headshot = rollHeadshot(params, ctx.rules, ctx.combatRng);
    let damage = computeDamage(params, headshot, target, ctx.rules);
    // overkill is clamped to the remaining health
    if (target.health - damage < 0) damage = target.health;
    const source = params.sourceId ? ctx.getPlayer(params.sourceId) : undefined;
    target.damageTaken += damage;
    if (source && source !== target) {
        source.damageDealt += damage;
        target.lastDamagedBy = source.id;
    }
    target.health = Math.max(0, Math.min(100, target.health - damage));
    target.lastHit = {
        amount: damage,
        headshot,
        sourceId: params.sourceId ?? 0,
        gameSourceType: params.gameSourceType ?? "",
    };
    // TODO(M6): downed state in team modes; solo players die at 0 HP
    if (target.health === 0) killPlayer(ctx, target, params);
}

/** Kills a player: kill credit, everything it carried drops (survev player.ts kill). */
export function killPlayer(ctx: SimContext, player: Player, params: DamageParams): void {
    if (player.dead) return;
    player.downed = false;
    player.dead = true;
    player.boost = 0;
    player.cancelAction();
    player.cancelAnim();
    player.shootHold = false;
    const credit = params.sourceId ? ctx.getPlayer(params.sourceId) : undefined;
    if (credit) {
        player.killedBy = credit.id;
        // TODO(M6): no credit for killing a teammate
        if (credit !== player) credit.kills++;
    }
    dropEverythingOnDeath(ctx, player);
}

/** Whether a damage source may hurt a plated obstacle (stone/armour plating needs a piercing melee weapon). */
export function canDamageObstacle(obstacle: Obstacle, params: DamageParams): boolean {
    if (obstacle.dead || !obstacle.destructible) return false;
    if (params.damageType !== DamageType.Player) return true;
    const src = params.gameSourceType && hasDef(params.gameSourceType) ? GameObjectDefs[params.gameSourceType] : null;
    const pierce = (src ?? {}) as { armorPiercing?: boolean; stonePiercing?: boolean };
    if (obstacle.def.armorPlated && !pierce.armorPiercing) return false;
    if (obstacle.def.stonePlated && !pierce.stonePiercing) return false;
    return true;
}

export function applyObstacleDamage(ctx: SimContext, obstacle: Obstacle, params: DamageParams): void {
    if (!canDamageObstacle(obstacle, params)) return;
    const destroyed = obstacle.damage(params.amount);
    // loot resting against it may now move (survev forceLootUpdates)
    ctx.loot.wakeAround(obstacle.bounds, obstacle.layer);
    if (!destroyed) return;
    spawnDestroyType(ctx, obstacle);
    dropObstacleLoot(ctx, obstacle, params.dir);
    // TODO(M5): obstacles with an `explosion` (barrels, propane tanks) explode on destruction
    // TODO(M4): destroying walls breaks the doors and windows in them and damages the building ceiling
}
