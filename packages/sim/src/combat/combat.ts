// Damage entry points shared by bullets and melee: player damage with death, obstacle damage with destruction.
// Behaviour follows survev server/src/game/objects/player.ts (damage, kill) and obstacle.ts (damage, kill); lethal
// damage goes through the team rules (match/teams.ts handlePlayerDeath: knock or death, M6a).
import type { Vec2 } from "@rebirth/core";
import { DamageType, GameObjectDefs, getMapDef, hasDef } from "@rebirth/defs";
import { dropEverythingOnDeath, dropObstacleLoot, spawnDestroyType } from "../loot/drops.ts";
import { onKillCredited, onPerkHolderDeath } from "../perks/effects.ts";
import { clearHaste } from "../perks/perks.ts";
import { randomWeaponSwap } from "../weapons/potatoSwap.ts";
import { throwThrowable } from "../weapons/throwable.ts";
import {
    breakWallAttachments,
    goreRegionKill,
    onBuildingObstacleDestroyed,
    parentBuildingOf,
    removeAnchoredDecals,
} from "../world/buildings.ts";
import type { SimContext } from "../world/context.ts";
import { downPlayer } from "../world/downed.ts";
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
    // Cobalt players in the class menu take no damage (survev damage: perkMode && !role; M7b)
    if (target.dead || target.awaitingClass) return;
    // the buffer right after a knock (downed-revive.md "The down itself")
    if (target.downed && target.downedDamageTicker > 0) return;
    const source = params.sourceId ? ctx.getPlayer(params.sourceId) : undefined;
    // teammates cannot hurt each other unless the target left; self damage stays (damage-armor.md "Pipeline order" 2)
    if (source && source !== target && source.teamId === target.teamId && !target.disconnected) return;
    const headshot = rollHeadshot(params, ctx.rules, ctx.combatRng);
    let damage = computeDamage(params, headshot, target, ctx.rules);
    // overkill is clamped to the remaining health
    if (target.health - damage < 0) damage = target.health;
    target.damageTaken += damage;
    if (source && source !== target) {
        // damage to a (disconnected) group member is not counted as dealt (survev damage)
        if (source.groupId !== target.groupId) source.damageDealt += damage;
        target.lastDamagedBy = source.id;
    }
    target.health = Math.max(0, Math.min(100, target.health - damage));
    target.lastHit = {
        amount: damage,
        headshot,
        sourceId: params.sourceId ?? 0,
        gameSourceType: params.gameSourceType ?? "",
    };
    if (target.health > 0) return;
    // Revivify downs its holder even in solo; otherwise the team rules decide between a knock and a death
    if (!target.downed && target.hasPerk("self_revive")) downPlayer(ctx, target, params);
    else ctx.onLethalDamage(target, params);
}

/**
 * Kills a player: kill credit, everything it carried drops (survev player.ts kill). `creditId` overrides the credited
 * player (the knocker of a downed player, M6a); killing a teammate credits no kill.
 */
export function killPlayer(ctx: SimContext, player: Player, params: DamageParams, creditId?: number): void {
    if (player.dead) return;
    player.downed = false;
    player.dead = true;
    player.boost = 0;
    player.cancelAction();
    // a cooked throwable drops at the feet (survev player.ts kill)
    if (player.weaponManager.cooking) throwThrowable(ctx, player, true);
    player.cancelAnim();
    player.shootHold = false;
    clearHaste(player);
    const creditSource = creditId ?? params.sourceId;
    const credit = creditSource ? ctx.getPlayer(creditSource) : undefined;
    if (credit) {
        player.killedBy = credit.id;
        if (credit !== player && credit.teamId !== player.teamId) {
            credit.kills++;
            // Takedown: health, adrenaline and a speed burst per kill (M7a)
            onKillCredited(ctx, credit);
        }
    }
    // Last Breath and Martyrdom (the perk, or the Grenadier / Demo role) (M7a, perks/effects.ts)
    onPerkHolderDeath(ctx, player);
    // kill feed, role announcements, alive count, kill leader, game over (match/match.ts)
    ctx.onPlayerKilled(player, params, credit);
    // Woods King ping, The Hunted's role, Lone Survivr, Commander succession, comeback drop (roles/roleSystem.ts)
    ctx.roles.onPlayerKilled(player, credit);
    // potato mode: a kill swaps the killer's weapon too (survev player.ts kill: lastDamagedBy.randomWeaponSwap)
    const killer = player.lastDamagedBy ? ctx.getPlayer(player.lastDamagedBy) : undefined;
    const potato = !!getMapDef(ctx.options.mapName).gameMode.potatoMode;
    if (potato && killer && killer !== player && params.damageType === DamageType.Player) {
        randomWeaponSwap(ctx, killer, params);
    }
    dropEverythingOnDeath(ctx, player);
    goreRegionKill(ctx, player);
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
    if (destroyed) onObstacleDestroyed(ctx, obstacle, params);
}

/**
 * Kills an obstacle whatever its destructibility (opened air drop crates, doors in a broken wall), with the usual
 * destruction effects. `params` defaults to a Player hit without a source.
 */
export function destroyObstacle(ctx: SimContext, obstacle: Obstacle, dir?: Vec2, params?: Partial<DamageParams>): void {
    if (obstacle.dead) return;
    obstacle.kill();
    ctx.loot.wakeAround(obstacle.bounds, obstacle.layer);
    onObstacleDestroyed(ctx, obstacle, { amount: 0, damageType: DamageType.Player, ...params, dir });
}

/**
 * Destruction effects in survev's order (obstacle.ts kill): the `destroyType` replacement, the potato weapon swap,
 * the regrow timer, loot, smoke, the explosion, then the parent building (roof, walls), the doors and broken windows
 * of a broken wall, and anchored decals.
 */
function onObstacleDestroyed(ctx: SimContext, obstacle: Obstacle, params: DamageParams): void {
    const def = obstacle.def;
    const source = params.sourceId ? ctx.getPlayer(params.sourceId) : undefined;
    spawnDestroyType(ctx, obstacle, source);
    // potatoes swap the weapon that broke them (survev swapWeaponOnDestroy; modes/potato.md)
    if (def.swapWeaponOnDestroy && source) randomWeaponSwap(ctx, source, params);
    if (def.regrow && def.regrowTimer) {
        obstacle.regrowTicker = def.regrowTimer;
        ctx.activateObstacle(obstacle);
    }
    dropObstacleLoot(ctx, obstacle, params.dir, source);
    // fire extinguishers release smoke (survev obstacle.ts kill createSmoke)
    if (def.createSmoke) ctx.smokes.addEmitter(obstacle.pos, obstacle.layer);
    // barrels, propane tanks, stoves... explode, credited to whoever destroyed them (explosions.md "Obstacles")
    if (def.explosion) {
        ctx.explosions.add(def.explosion, obstacle.pos, obstacle.layer, {
            gameSourceType: "",
            mapSourceType: obstacle.type,
            damageType: params.damageType,
            sourceId: params.sourceId ?? 0,
        });
    }
    const building = parentBuildingOf(ctx, obstacle);
    if (building) onBuildingObstacleDestroyed(building, obstacle);
    if (obstacle.isWall) {
        breakWallAttachments(ctx, obstacle, params, (o, p) => destroyObstacle(ctx, o, p.dir, p));
    }
    if (def.isDecalAnchor && building) removeAnchoredDecals(ctx, building, obstacle);
}
