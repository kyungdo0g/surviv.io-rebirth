// Downed (knocked out) players and reviving, team modes (and Revivify): the knock itself, the damage buffer, bleeding,
// the inputs a downed player keeps, starting and completing revives (Mass Medicate auras included).
// Behaviour follows docs/research/mechanics/downed-revive.md (survev objects/player.ts down, update "Action logic" and
// "Take bleeding damage", shouldAcceptInput, getPlayerToRevive, revive, applyActionFunc, getAOEPlayers).
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, getMapDef, Input, WeaponSlot } from "@rebirth/defs";
import type { DamageParams } from "../combat/damage.ts";
import { throwThrowable } from "../weapons/throwable.ts";
import type { SimContext } from "./context.ts";
import type { Player } from "./player.ts";
import { sameLayer } from "./world.ts";

const PLAYER = GameConfig.player;
/** The knock pushes the player along the hit direction at 10 u/s, damped by 1 / (1 + 4 dt) per tick (survev down). */
const KNOCKBACK_SPEED = 10;
/** Red zone radius under which the optional 50 HP down rule applies (survev player.ts down). */
const FINAL_CIRCLE_RAD = 0.1;
const TIME_EPS = 1e-9;

/**
 * Knocks `player` down (survev down): bleeding health 100 (50 in a fully closed zone with rules.downHealthFinalCircle),
 * the 0.1 s damage buffer, boost lost, a cooked grenade dropped at the feet, actions and firing cancelled, the melee
 * slot forced (a pan in it is worn on the back), and a Kill event with `downed` true.
 */
export function downPlayer(ctx: SimContext, player: Player, params: DamageParams): void {
    player.downed = true;
    player.downedCount++;
    player.downedDamageTicker = ctx.rules.downedDamageBuffer;
    // the first bleed tick comes on the next tick, inside the damage buffer (oracle revive.json firstBleeds)
    player.bleedTicker = 0;
    player.boost = 0;
    const finalCircle = ctx.rules.downHealthFinalCircle && ctx.gas.currentRad <= FINAL_CIRCLE_RAD;
    player.health = finalCircle ? 50 : PLAYER.health;
    player.knockback = params.dir ? v2.mul(params.dir, KNOCKBACK_SPEED) : { x: 0, y: 0 };
    const wm = player.weaponManager;
    if (wm.cooking) throwThrowable(ctx, player, true);
    player.cancelAnim();
    player.shootStart = false;
    player.shootHold = false;
    player.cancelAction();
    wm.setCurWeapIndex(WeaponSlot.Melee, true);
    if (wm.weapons[WeaponSlot.Melee].type === "pan") player.wearingPan = true;
    const source = params.sourceId ? ctx.getPlayer(params.sourceId) : undefined;
    player.downedBy = source ? source.id : 0;
    ctx.onPlayerDowned(player, params, source);
    // 50v50: a knock may leave a faction with its last standing players (Lone Survivr, M7a)
    ctx.roles.onPlayerDowned(player);
}

/** Bleed damage of one tick for a player downed `downedCount` times on `mapName` (downed-revive.md "Bleeding"). */
export function bleedDamage(mapName: string, downedCount: number, escalation: "linear" | "compound"): number {
    const cfg = getMapDef(mapName).gameConfig;
    const mult = cfg.bleedDamageMult;
    if (mult === 1) return cfg.bleedDamage;
    return cfg.bleedDamage * (escalation === "compound" ? mult ** downedCount : downedCount * mult);
}

/**
 * Per tick, before the player's action advances (survev update order): a revive whose target died or moved out of
 * reviveRange is cancelled, the damage buffer runs down, and a downed player that is not being revived bleeds every
 * bleedTickRate seconds (armour does not apply). The bleed may kill the player.
 */
export function updateDowned(ctx: SimContext, player: Player, dt: number): void {
    const target = player.playerBeingRevived;
    if (target && player.action.type === "revive") {
        if (target.dead || v2.distance(player.pos, target.pos) > PLAYER.reviveRange) player.cancelAction();
    }
    if (player.downedDamageTicker > 0) {
        player.downedDamageTicker -= dt;
        if (player.downedDamageTicker <= TIME_EPS) player.downedDamageTicker = 0;
    }
    if (!player.downed) return;
    // That Sucks (trick_drain) runs on its own timer in perks/effects.ts, standing or downed
    player.bleedTicker -= dt;
    if (player.action.type !== "none" || player.bleedTicker > TIME_EPS) return;
    player.bleedTicker = PLAYER.bleedTickRate;
    const amount = bleedDamage(ctx.options.mapName, player.downedCount, ctx.rules.bleedEscalation);
    ctx.damagePlayer(player, { amount, damageType: DamageType.Bleeding, dir: v2.copy(player.dir) });
}

/**
 * The inputs a downed player keeps (survev shouldAcceptInput): Interact and Use (doors, buttons), Revive with
 * Revivify, and Cancel unless a Mass Medicate medic revives it (a self reviving medic may still cancel).
 */
export function acceptsWhileDowned(player: Player, action: number): boolean {
    switch (action) {
        case Input.Interact:
        case Input.Use:
            return true;
        case Input.Revive:
            return player.hasPerk("self_revive");
        case Input.Cancel:
            return !player.revivedBy?.hasPerk("aoe_heal") || player.revivedBy === player.playerBeingRevived;
        default:
            return false;
    }
}

/** Living players of `player`'s team on its layer within `range` of it, itself included (survev getAOEPlayers). */
export function teammatesInRange(ctx: SimContext, player: Player, range: number): Player[] {
    const out: Player[] = [];
    const box = { min: v2.sub(player.pos, { x: range, y: range }), max: v2.add(player.pos, { x: range, y: range }) };
    for (const obj of ctx.world.query(box, [])) {
        if (obj.kind !== "player" || obj.dead || obj.teamId !== player.teamId) continue;
        if (!sameLayer(player.layer, obj.layer) || v2.distanceSqr(player.pos, obj.pos) > range * range) continue;
        out.push(obj);
    }
    return out.sort((a, b) => a.id - b.id);
}

/**
 * Who `player` would revive now (survev getPlayerToRevive): itself when downed with Revivify, else the closest downed
 * teammate on its layer within reviveRange that nobody revives yet; nothing in solo, while downed or while an action
 * runs. There is no line-of-sight check: revives work through thin walls (fandom Knocked Out).
 */
export function playerToRevive(ctx: SimContext, player: Player): Player | undefined {
    if (player.dead || player.action.type !== "none") return undefined;
    if (player.downed && player.hasPerk("self_revive")) return player;
    if ((ctx.options.teamMode ?? 1) === 1 || player.downed) return undefined;
    const range = PLAYER.reviveRange;
    let best: Player | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const p of teammatesInRange(ctx, player, range)) {
        if (p === player || !p.downed || p.action.type === "revive") continue;
        const d = v2.distance(player.pos, p.pos);
        if (d <= range && d < bestDist) {
            best = p;
            bestDist = d;
        }
    }
    return best;
}

/**
 * Starts a revive (survev revive): both players run an 8 s Revive action (the reviver's carries the target id) and the
 * reviver plays the revive animation, dropping a cooked grenade; a self revive is the holder's own action.
 */
export function startRevive(ctx: SimContext, reviver: Player, target: Player | undefined): boolean {
    if (!target) return false;
    const duration = PLAYER.reviveDuration;
    reviver.playerBeingRevived = target;
    target.revivedBy = reviver;
    if (target === reviver) {
        reviver.doAction("", "revive", duration, reviver.id);
        return true;
    }
    target.doAction("", "revive", duration);
    reviver.doAction("", "revive", duration, target.id);
    if (reviver.weaponManager.cooking) throwThrowable(ctx, reviver, true);
    reviver.playAnim("revive", duration);
    return true;
}

function standUp(target: Player): void {
    if (!target.downed) return;
    target.downed = false;
    target.downedBy = 0;
    target.downedDamageTicker = 0;
    target.health = PLAYER.reviveHealth;
    target.knockback = { x: 0, y: 0 };
    // a pan held in hand is no longer worn on the back
    if (target.activeWeapon === "pan") target.wearingPan = false;
}

/**
 * The reviver's Revive action completed (survev update + applyActionFunc): the target stands up with reviveHealth.
 * A Mass Medicate medic revives every downed teammate within medicReviveRange instead; with rules.medicRevivedAoe a
 * teammate completing the revive of a medic triggers the medic's aura too (conflicts.md medic-revived-aoe).
 */
export function completeRevive(ctx: SimContext, reviver: Player): void {
    const target = reviver.playerBeingRevived;
    if (!target) return;
    let medic: Player | null = null;
    if (reviver.hasPerk("aoe_heal")) medic = reviver;
    else if (ctx.rules.medicRevivedAoe && target.hasPerk("aoe_heal")) medic = target;
    if (!medic) {
        standUp(target);
        return;
    }
    for (const p of teammatesInRange(ctx, medic, PLAYER.medicReviveRange)) standUp(p);
    standUp(target);
}

/** Damping rate of a knock-back slide (survev update: vel damped by 1 / (1 + 4 dt)). */
const KNOCKBACK_DECAY = 4;

/**
 * Initial speed of a knock-back slide that covers `distance` units: the damped steps sum to speed / KNOCKBACK_DECAY
 * (rebirth: the M202 FLASH's recoil, weapons/gun.ts).
 */
export function knockbackSpeedFor(distance: number): number {
    return distance * KNOCKBACK_DECAY;
}

/** Knock-back slide of a freshly downed player (survev update: vel damped by 1 / (1 + 4 dt), stops under 0.01). */
export function applyKnockback(player: Player, dt: number): Vec2 | null {
    const kb = player.knockback;
    if (Math.abs(kb.x) <= 0.01 && Math.abs(kb.y) <= 0.01) return null;
    const damp = 1 / (1 + dt * KNOCKBACK_DECAY);
    player.knockback = { x: kb.x * damp, y: kb.y * damp };
    return v2.mul(player.knockback, dt);
}
