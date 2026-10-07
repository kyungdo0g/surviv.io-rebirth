// Throwables: attack starts cooking (the cook animation; a cookable grenade's fuse runs in the hand), releasing the
// trigger throws after the minimum cook time. The throw speed scales with the mouse distance (always full for
// `forceMaxThrowDistance` items), plus part of the player's motion; the projectile spawns at the throwing hand,
// pulled back in front of any wall. A grenade held past its fuse is thrown automatically and explodes at once in the
// hand. Switching away or dying while cooking drops it at the feet (zero speed). Each throw uses one item; the slot
// then shows the next throwable type (inventory onItemRemoved -> showNextThrowable).
// Behaviour follows survev server/src/game/weaponManager.ts (update, cookThrowable, throwThrowable) and
// docs/research/items/throwables.md "Throwing, cooking and flight rules".
import { collider, math, v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef, type ThrowableDef, WeaponSlot } from "@rebirth/defs";
import { rulesOf } from "../perks/perks.ts";
import type { SimContext } from "../world/context.ts";
import type { Player } from "../world/player.ts";
import { sameLayer } from "../world/world.ts";

const PLAYER = GameConfig.player;
/** The throwing hand, relative to the player facing +x (survev throwThrowable). */
const HAND_OFFSET = { x: 0.5, y: -1.0 };
/** Projectiles leave the hand at this height; obstacles at least this tall clip the spawn point. */
const SPAWN_HEIGHT = 0.5;
/** The throw animation lasts 0.15 s longer than throwTime (survev: the client animation has an extra 0.15 s). */
const THROW_ANIM_EXTRA = 0.15;
const TIME_EPS = 1e-9;

export function throwableDef(type: string): ThrowableDef | undefined {
    if (!type || !hasDef(type)) return undefined;
    const def = GameObjectDefs[type];
    return def.type === "throwable" ? def : undefined;
}

/** Starts cooking the held throwable: cancels the running action, plays the cook animation (survev cookThrowable). */
export function cookThrowable(player: Player): void {
    const wm = player.weaponManager;
    const def = throwableDef(player.activeWeapon);
    if (!def || wm.cooking || wm.throwableCooldown > 0) return;
    player.cancelAction();
    wm.cookTicker = 0;
    // non-cookable throwables (smoke, strobe) can be held forever
    player.playAnim("cook", def.cookable ? def.fuseTime : Number.POSITIVE_INFINITY);
}

/**
 * Throws the cooked throwable (survev throwThrowable). Nothing happens before the minimum cook time. `noSpeed`
 * drops it at the feet (switching away, dying). Without a game context (a bare Player in a unit test) the item is
 * used up but no projectile spawns. `cookedThisTick` is the part of the cook time counted in the current tick: the
 * projectile also burns its fuse in this tick, so it is given back (survev counts that tick twice: a thrown frag
 * explodes 3.99 s after the pin is pulled, a held one at 4.01 s; here both take exactly fuseTime).
 */
export function throwThrowable(ctx: SimContext | null, player: Player, noSpeed = false, cookedThisTick = 0): void {
    const wm = player.weaponManager;
    if (!wm.cooking || wm.cookTicker < PLAYER.cookTime - TIME_EPS) return;
    const item = wm.weapons[WeaponSlot.Throwable].type;
    const def = throwableDef(item);
    if (!def || player.inv.get(item) <= 0) return;
    // TODO(M8): heavy snowballs/potatoes (heavyType) need the original cook time, unknown (throwables.md)
    // Hyperfragmentation: x1.75 aim range and x2 throw speed (survev weaponManager.ts:1236-1247)
    const amped = player.hasPerk("amped_explosives") ? rulesOf(player).perks.ampedExplosives : undefined;
    const maxDist = PLAYER.throwableMaxMouseDist * (amped?.throwableRangeMult ?? 1);
    let strength: number;
    if (def.forceMaxThrowDistance) strength = 1;
    else if (wm.curWeapIdx !== WeaponSlot.Throwable || noSpeed) strength = 0;
    else strength = math.clamp(player.input.toMouseLen, 0, maxDist) / maxDist;

    const hand = v2.add(player.pos, v2.rotate(HAND_OFFSET, Math.atan2(player.dir.y, player.dir.x)));
    let spawnPos = v2.copy(hand);
    if (ctx) {
        // pulled back in front of any wall between the player and the hand
        let closest = Number.MAX_VALUE;
        for (const obj of ctx.world.querySegment(player.pos, hand, player.scratch)) {
            if (obj.kind !== "obstacle" || obj.dead || !obj.collidable) continue;
            if (!sameLayer(obj.layer, player.layer) || obj.height < SPAWN_HEIGHT) continue;
            const res = collider.intersectSegment(obj.collider, player.pos, hand);
            if (!res) continue;
            const colPos = v2.add(res.point, v2.mul(res.normal, 0.01));
            const dist = v2.distance(colPos, hand);
            if (dist < closest) {
                closest = dist;
                spawnPos = colPos;
            }
        }
    }
    let dir = v2.copy(player.dir);
    // snowball-type throwables aim at a point aimDistance ahead instead of along the hand offset
    if (def.aimDistance > 0) {
        const target = v2.add(player.pos, v2.mul(player.dir, def.aimDistance));
        dir = v2.normalizeSafe(v2.sub(target, spawnPos), { x: 1, y: 0 });
    }
    const vel = v2.add(
        v2.mul(player.moveVel, def.throwPhysics.playerVelMult),
        v2.mul(dir, strength * def.throwPhysics.speed * (amped?.throwableSpeedMult ?? 1)),
    );
    const fuse = def.cookable ? Math.max(0, def.fuseTime - wm.cookTicker + cookedThisTick) : def.fuseTime;
    if (ctx) {
        const proj = ctx.projectiles.add({
            ownerId: player.id,
            type: item,
            pos: spawnPos,
            posZ: SPAWN_HEIGHT,
            layer: player.layer,
            vel,
            fuse,
            throwDir: dir,
            sourceType: item,
        });
        if (item === "strobe" && def.strikeDelay) ctx.projectiles.armStrobe(proj, def.strikeDelay);
    }
    player.playAnim("throw", THROW_ANIM_EXTRA + PLAYER.throwTime);
    wm.throwableCooldown = PLAYER.throwTime;
    // the inventory hook shows the next throwable type, or leaves the slot, when this was the last one
    player.inv.take(item, 1);
}

/** Per-tick throwable logic of the weapon manager (after the weapon cooldowns ticked). */
export function updateThrowable(ctx: SimContext | null, player: Player, dt: number): void {
    const wm = player.weaponManager;
    const def = throwableDef(player.activeWeapon);
    if (def && player.shootStart && !wm.cooking) cookThrowable(player);
    if (!wm.cooking) return;
    wm.cookTicker += dt;
    if (wm.curWeapIdx !== WeaponSlot.Throwable) {
        throwThrowable(ctx, player, false, dt);
        return;
    }
    // held past the fuse: thrown with no fuse left, it explodes in the hand this tick
    const cookedOff = !!def?.cookable && wm.cookTicker >= def.fuseTime - TIME_EPS;
    const released = !player.shootHold && wm.cookTicker >= PLAYER.cookTime - TIME_EPS;
    if (cookedOff || released) throwThrowable(ctx, player, false, dt);
}
