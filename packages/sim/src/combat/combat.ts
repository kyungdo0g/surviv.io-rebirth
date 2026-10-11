// Damage entry points shared by bullets and melee: player damage with death, obstacle damage with destruction.
// Behaviour follows survev server/src/game/objects/player.ts (damage, kill) and obstacle.ts (damage, kill); lethal
// damage goes through the team rules (match/teams.ts handlePlayerDeath: knock or death, M6a).
import type { Vec2 } from "@rebirth/core";
import { DamageType, GameObjectDefs, getMapDef, hasDef } from "@rebirth/defs";
import { buryEverythingOnDeath, dropEverythingOnDeath, dropObstacleLoot, spawnDestroyType } from "../loot/drops.ts";
import { DEATH_EMOTE_DELAY } from "../match/emotes.ts";
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
import { collapseBuilding, collapsesWith } from "../world/collapse.ts";
import type { SimContext } from "../world/context.ts";
import { disguiseOf, removeDisguise } from "../world/disguise.ts";
import { downPlayer } from "../world/downed.ts";
import type { Obstacle } from "../world/entities.ts";
import type { Player } from "../world/player.ts";
import { armorCovers, computeDamage, type DamageParams, rollHeadshot } from "./damage.ts";

/** Result of the last hit a player took (tests, kill feed later). */
export interface HitRecord {
    amount: number;
    headshot: boolean;
    sourceId: number;
    gameSourceType: string;
}

/**
 * Combat Stimulants: while the shooter's bonus runs, its gun hits on a teammate heal 6 % of the hit and show the heal
 * effect (survev player.ts:2423-2439).
 */
function combatStimsHeal(ctx: SimContext, source: Player, target: Player, params: DamageParams): void {
    if (source.combatStimsTicker <= 0 || !params.gameSourceType || !hasDef(params.gameSourceType)) return;
    if (GameObjectDefs[params.gameSourceType].type !== "gun") return;
    const heal = params.amount * ctx.rules.perks.combatStims.healPercent;
    if (heal <= 0 || target.dead) return;
    target.health = Math.min(100, target.health + heal);
    target.healEffectTicker = 0.5;
}

export function applyPlayerDamage(ctx: SimContext, target: Player, params: DamageParams): void {
    // Cobalt players in the class menu take no damage (survev damage: perkMode && !role; M7b)
    if (target.dead || target.awaitingClass) return;
    // the buffer right after a knock (downed-revive.md "The down itself")
    if (target.downed && target.downedDamageTicker > 0) return;
    const source = params.sourceId ? ctx.getPlayer(params.sourceId) : undefined;
    // teammates cannot hurt each other unless the target left; self damage stays (damage-armor.md "Pipeline order" 2)
    if (source && source !== target && source.teamId === target.teamId && !target.disconnected) {
        combatStimsHeal(ctx, source, target, params);
        return;
    }
    const headshot = rollHeadshot(params, ctx.rules, ctx.combatRng);
    let damage = computeDamage(params, headshot, target, ctx.rules);
    // Indomitable Spirit: adrenaline absorbs a fatal hit at 2 per HP, leaving 1 HP (survev player.ts:2493-2510)
    if (target.health - damage < 0 && target.hasPerk("lifeline")) {
        const excess = damage - target.health + 1;
        const rate = ctx.rules.perks.lifeline.conversionRate;
        if (target.boost / rate >= excess) {
            target.boost -= excess * rate;
            damage = target.health - 1;
            target.lastStandTicker = 1;
        }
    }
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
    // rebirth hit feedback (user/2026-10-07-hit-feedback): the dealer and the target learn of the hit
    const armored = armorCovers(params, headshot, target, ctx.rules);
    ctx.hitLog?.record(target.id, params.sourceId ?? 0, damage, params.damageType, headshot, armored, params.dir);
    ctx.observer?.onPlayerDamaged?.(target, params, damage, headshot);
    if (target.health > 0) return;
    // Revivify downs its holder even in solo; otherwise the team rules decide between a knock and a death
    if (!target.downed && target.hasPerk("self_revive")) downPlayer(ctx, target, params);
    else ctx.onLethalDamage(target, params);
}

/**
 * Kills a player: kill credit, a dead body (M9), everything it carried drops (survev player.ts kill). `creditId`
 * overrides the credited player (the knocker of a downed player, M6a); killing a teammate credits no kill. `buried`
 * (a collapsing building, world/collapse.ts) loses the items instead of dropping them.
 */
export function killPlayer(
    ctx: SimContext,
    player: Player,
    params: DamageParams,
    creditId?: number,
    opts?: { buried?: boolean },
): void {
    if (player.dead) return;
    player.downed = false;
    player.dead = true;
    player.boost = 0;
    player.cancelAction();
    // a cooked throwable drops at the feet (survev player.ts kill); a buried one is lost with the rest
    if (player.weaponManager.cooking && !opts?.buried) throwThrowable(ctx, player, true);
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
            onKillCredited(ctx, credit, player, params.gameSourceType);
        }
    }
    // Last Breath and Martyrdom (the perk, or the Grenadier / Demo role) (M7a, perks/effects.ts)
    // (buried: no Martyrdom grenades out of the rubble)
    onPerkHolderDeath(ctx, player, !!opts?.buried);
    // kill feed, role announcements, alive count, kill leader, game over (match/match.ts)
    ctx.onPlayerKilled(player, params, credit);
    ctx.observer?.onPlayerKilled?.(player, params, credit);
    // Woods King ping, The Hunted's role, Lone Survivr, Commander succession, comeback drop (roles/roleSystem.ts)
    ctx.roles.onPlayerKilled(player, credit);
    // potato mode: a kill swaps the killer's weapon too (survev player.ts kill: lastDamagedBy.randomWeaponSwap)
    const killer = player.lastDamagedBy ? ctx.getPlayer(player.lastDamagedBy) : undefined;
    const potato = !!getMapDef(ctx.options.mapName).gameMode.potatoMode;
    if (
        potato &&
        killer &&
        killer !== player &&
        params.sourceId !== player.id &&
        params.damageType === DamageType.Player
    ) {
        randomWeaponSwap(ctx, killer, params);
    }
    // the body slides along the killing hit, before the loot drops (survev player.ts kill addDeadBody) (M9)
    // (buried by a collapse: no body, it lies under the rubble)
    if (!opts?.buried) ctx.deadBodies.add(player.pos, player.id, player.layer, params.dir);
    // the loadout's death emote follows 0.3 s later (match/emotes.ts updateSlotEmotes)
    player.deathEmoteTicker = DEATH_EMOTE_DELAY;
    // an obstacle disguise dies with its wearer, loot and explosion included (survev player.ts kill obstacleOutfit)
    // (buried by a collapse, world/collapse.ts: it goes silently, without loot or explosion)
    const disguise = disguiseOf(ctx, player);
    if (disguise && opts?.buried) removeDisguise(ctx, player);
    else if (disguise) destroyObstacle(ctx, disguise, params.dir, params);
    if (opts?.buried) buryEverythingOnDeath(player);
    else dropEverythingOnDeath(ctx, player);
    goreRegionKill(ctx, player);
}

/** Whether a damage source may hurt a plated obstacle (stone/armour plating needs a piercing melee weapon). */
export function canDamageObstacle(obstacle: Obstacle, params: DamageParams): boolean {
    // a disguise takes no hits: it dies with its wearer (survev obstacle.ts damage: isSkin)
    if (obstacle.dead || obstacle.isSkin || !obstacle.destructible) return false;
    if (!passesExplosionGate(obstacle, params)) return false;
    if (params.damageType !== DamageType.Player) return true;
    const src = params.gameSourceType && hasDef(params.gameSourceType) ? GameObjectDefs[params.gameSourceType] : null;
    const pierce = (src ?? {}) as { armorPiercing?: boolean; stonePiercing?: boolean };
    if (obstacle.def.armorPlated && !pierce.armorPiercing) return false;
    if (obstacle.def.stonePlated && !pierce.stonePiercing) return false;
    return true;
}

/**
 * Rebirth explosion-gated obstacles (ObstacleDef.explosionGate; packages/defs rebirth/buildings/blastDoors.ts): only an
 * explosion's own hit counts (never bullets, melee, shrapnel or projectile impacts), of a listed type when
 * `explosionTypes` is set; a landing air drop crate (Airdrop) still destroys it. A hit-counted gate (`hitsToOpen`)
 * takes only its listed explosions, crate included (gateHitShare).
 */
function passesExplosionGate(obstacle: Obstacle, params: DamageParams): boolean {
    const gate = obstacle.def.explosionGate;
    if (!gate) return true;
    if (gate.hitsToOpen) return gateHitShare(obstacle, params) > 0;
    if (params.damageType === DamageType.Airdrop) return true;
    if (!params.isExplosion || !params.explosionType) return false;
    return !gate.explosionTypes || gate.explosionTypes.includes(params.explosionType);
}

function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
}

const gateTotals = new WeakMap<object, number>();

/**
 * The whole door of a hit-counted gate in integer shares: the least common multiple of its `hitsToOpen` counts
 * ({ m202: 1, nlaw: 2, rpg7: 6 } -> 6), so every hit adds a whole number of shares and the count stays exact.
 */
export function gateTotalShares(hitsToOpen: Readonly<Record<string, number>>): number {
    let total = gateTotals.get(hitsToOpen);
    if (total !== undefined) return total;
    total = 1;
    for (const n of Object.values(hitsToOpen)) {
        if (Number.isInteger(n) && n > 0) total = (total / gcd(total, n)) * n;
    }
    gateTotals.set(hitsToOpen, total);
    return total;
}

/**
 * Shares of the door one hit takes on a hit-counted gate (the owner, 2026-10-11, blast_door_01: M202 1 hit, NLAW 2,
 * RPG-7 6): an explosion listed with n that reaches it (any damage above 0) is one hit worth total / n shares, whatever
 * its damage; anything else is 0.
 */
export function gateHitShare(obstacle: Obstacle, params: DamageParams): number {
    const hits = obstacle.def.explosionGate?.hitsToOpen;
    if (!hits || !params.isExplosion || !params.explosionType || !(params.amount > 0)) return 0;
    const n = Object.hasOwn(hits, params.explosionType) ? hits[params.explosionType] : 0;
    if (!Number.isInteger(n) || n <= 0) return 0;
    return gateTotalShares(hits) / n;
}

export function applyObstacleDamage(ctx: SimContext, obstacle: Obstacle, params: DamageParams): void {
    if (!canDamageObstacle(obstacle, params)) return;
    const hits = obstacle.def.explosionGate?.hitsToOpen;
    // a hit-counted gate counts the hit, its health shows the shares left (Obstacle.gateHit)
    const destroyed = hits
        ? obstacle.gateHit(gateHitShare(obstacle, params), gateTotalShares(hits))
        : obstacle.damage(params.amount);
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
            // survev passes the destroying hit's params on: a barrel shot apart credits the gun (potato swaps)
            weaponSourceType: params.weaponSourceType || params.gameSourceType || "",
            mapSourceType: obstacle.type,
            damageType: params.damageType,
            sourceId: params.sourceId ?? 0,
        });
    }
    const building = parentBuildingOf(ctx, obstacle);
    const collapse = !!building && collapsesWith(building, obstacle);
    if (building) onBuildingObstacleDestroyed(building, obstacle);
    if (obstacle.isWall) {
        breakWallAttachments(ctx, obstacle, params, (o, p) => destroyObstacle(ctx, o, p.dir, p));
    }
    if (def.isDecalAnchor && building) removeAnchoredDecals(ctx, building, obstacle);
    // rebirth: the last wall of a collapsing building brings it down on everyone inside (world/collapse.ts)
    if (collapse && building) collapseBuilding(ctx, building, params.sourceId);
}
