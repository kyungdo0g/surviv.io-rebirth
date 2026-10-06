// Firing one gun shot: muzzle position clipped against obstacles, spread, pellets with jitter, bullet spawn; potato
// guns also launch their projectile, flare guns call an air drop, Explosive Rounds make bullets explode on impact.
// M7a: perk modifiers (perks/shotPerks.ts), Splinter Rounds side bullets, the bugle's Inspiration and the Commander's
// flare. Behaviour follows survev server/src/game/weaponManager.ts fireWeapon and docs/research/items/guns.md.
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getDefOfType } from "@rebirth/defs";
import type { Bullet } from "../combat/bullets.ts";
import { playBugle } from "../perks/effects.ts";
import { shotPerks } from "../perks/shotPerks.ts";
import type { SimContext } from "../world/context.ts";
import type { Player } from "../world/player.ts";
import { sameLayer } from "../world/world.ts";

/** Muzzle clipping probes 1.5 beyond the barrel because pellets spawn up to that far ahead (survev). */
const CLIP_EXTRA = 1.5;
/** Pellet start offsets are random(-jitter, jitter) * 1.11 on each axis (survev). */
const JITTER_SCALE = 1.11;
/** Default pellet jitter when the def has none (survev). */
const DEFAULT_JITTER = 0.25;
/** The player moved this tick when it travelled more than this (moveSpread applies) (survev). */
const MOVE_SPREAD_EPS = 0.01;

/** Radius of the gun probe that skips colliders of the other floor (survev: GameConfig.player.radius). */
const PLAYER_RAD = GameConfig.player.radius;
/** Projectiles of potato guns leave the muzzle at this height (survev fireWeapon addProjectile). */
const PROJECTILE_HEIGHT = 0.5;

interface MuzzleClip {
    len: number;
    point: Vec2;
    normal: Vec2;
}

/** Nearest obstacle surface between the gun and barrelLength + 1.5 ahead (survev fireWeapon clipping). */
function clipMuzzle(
    ctx: SimContext,
    player: Player,
    gunPos: Vec2,
    dir: Vec2,
    gunLen: number,
    layer: number,
): MuzzleClip {
    // firing down a stairwell the gun can start inside a collider of the other floor: that one is ignored (survev)
    const ownFloor = player.layer & 1;
    let clip: MuzzleClip = {
        len: gunLen + CLIP_EXTRA,
        point: v2.add(gunPos, v2.mul(dir, gunLen + CLIP_EXTRA)),
        normal: v2.neg(dir),
    };
    const reach = player.rad + gunLen + CLIP_EXTRA;
    const box = { min: v2.sub(player.pos, { x: reach, y: reach }), max: v2.add(player.pos, { x: reach, y: reach }) };
    for (const obj of ctx.world.query(box, player.scratch)) {
        if (obj.kind !== "obstacle" || obj.dead || !obj.collidable) continue;
        if (!sameLayer(obj.layer, layer) || obj.height < GameConfig.bullet.height) continue;
        if (
            !sameLayer(ownFloor, layer) &&
            collider.intersect(collider.createCircle(gunPos, PLAYER_RAD), obj.collider)
        ) {
            continue;
        }
        const res = collider.intersectSegment(obj.collider, gunPos, clip.point);
        if (!res) continue;
        const colPos = v2.add(res.point, v2.mul(res.normal, 0.01));
        const len = v2.distance(colPos, gunPos);
        if (len < clip.len) clip = { len, point: colPos, normal: res.normal };
    }
    return clip;
}

/**
 * Fires the active gun once. `cooldown` is the new weapon cooldown (fireDelay plus the carried remainder), or
 * null to leave it unchanged. Returns true when bullets were fired.
 */
export function fireGun(ctx: SimContext, player: Player, offHand: boolean, cooldown: number | null): boolean {
    const wm = player.weaponManager;
    const weapon = wm.activeSlot;
    const def = getDefOfType("gun", weapon.type);
    wm.scheduledReload = weapon.ammo <= 1;
    if (weapon.ammo <= 0) return false;

    const firstShotAccuracy = weapon.recoilTime <= 0;
    if (cooldown !== null) weapon.cooldown = cooldown;
    weapon.recoilTime = def.recoilTime;
    // flare guns refuse to fire indoors (the cooldown is still spent, as in survev)
    if (def.outsideOnly && player.indoors) return false;

    const dir = player.dir;
    player.shotSlowdownTimer = def.fireDelay;
    player.cancelAction();
    weapon.ammo--;
    const perks = shotPerks(player, def, weapon.ammo, wm.ammoStats(def).maxClip, ctx.rules.perks);

    // bullets fly on the aim layer: on stairs, facing down or up them shoots into that floor (survev fireWeapon)
    const layer = player.aimLayer;
    const gunOff = def.isDual ? (def.dualOffset ?? 0) * (offHand ? 1 : -1) : def.barrelOffset;
    const gunPos = v2.add(player.pos, v2.mul(v2.perp(dir), gunOff));
    const gunLen = def.barrelLength;
    const clip = clipMuzzle(ctx, player, gunPos, dir, gunLen, layer);

    let spread = def.shotSpread;
    if (v2.distance(player.pos, player.posOld) > MOVE_SPREAD_EPS) spread += def.moveSpread;
    // first-shot accuracy: no spread when the last shot (or switch) was at least recoilTime ago
    if (wm.recoilTicker >= def.recoilTime) spread = 0;
    wm.recoilTicker = 0;
    spread *= perks.spreadMult;

    const rng = ctx.combatRng;
    const jitter = def.jitter ?? DEFAULT_JITTER;
    const bulletDef = getDefOfType("bullet", def.bulletType);
    // Explosive Rounds: bullets explode on impact (they peter out at max range) (perks.md explosive)
    const onHitFx = player.hasPerk("explosive") ? "explosion_rounds" : undefined;
    const projDef = def.projType ? getDefOfType("throwable", def.projType) : undefined;
    // bullets of this shot, collected only for a host's observer (anti-cheat telemetry, M8)
    const fired: Bullet[] | null = ctx.observer?.onShotFired ? [] : null;
    for (let i = 0; i < def.bulletCount; i++) {
        const deviation = firstShotAccuracy ? 0 : rng.range(-0.5, 0.5) * spread;
        const shotDir = v2.rotate(dir, math.deg2rad(deviation));
        let start = v2.add(gunPos, v2.mul(dir, gunLen));
        if (i > 0) {
            const offset = { x: rng.range(-jitter, jitter), y: rng.range(-jitter, jitter) };
            start = v2.add(start, v2.mul(offset, JITTER_SCALE));
        }
        // pull the spawn point back in front of the nearest obstacle plane so pellets cannot start behind a wall
        const toStart = v2.sub(start, gunPos);
        let startLen = v2.length(toStart);
        const startDir = startLen > 0.00001 ? v2.div(toStart, startLen) : { x: 1, y: 0 };
        const dn = v2.dot(startDir, clip.normal);
        if (dn < -0.00001) {
            const t = v2.dot(v2.sub(clip.point, gunPos), clip.normal) / dn;
            if (t < startLen) startLen = t - 0.1;
        }
        const shotPos = v2.add(gunPos, v2.mul(startDir, startLen));
        const params = {
            shooterId: player.id,
            bulletType: def.bulletType,
            sourceType: weapon.type,
            pos: shotPos,
            dir: shotDir,
            layer,
            shotFx: i === 0,
            offHand,
            onHitFx,
            damageMult: perks.damageMult,
            speedMult: perks.speedMult,
            distanceMult: perks.distanceMult,
            saturated: perks.saturated,
            thick: perks.thick,
        };
        const bullet = ctx.bullets.fire(params);
        fired?.push(bullet);
        // Splinter Rounds: two weaker side bullets random(0.2, 0.25) x max(spread, 1) degrees off (perks.md splinter)
        if (perks.splinter) {
            const [lo, hi] = ctx.rules.perks.splinterDeviation;
            for (let j = 0; j < 2; j++) {
                const dev = rng.range(lo, hi) * Math.max(spread, 1) * (j === 0 ? -1 : 1);
                const side = ctx.bullets.fire({
                    ...params,
                    dir: v2.rotate(shotDir, math.deg2rad(dev)),
                    shotFx: false,
                    damageMult: perks.damageMult * ctx.rules.perks.splinterSideDamageMult,
                    splinter: true,
                });
                fired?.push(side);
            }
        }
        // a flare calls an air drop where it is fired (survev BulletBarn.fireBullet addFlare; airdrop-airstrike.md)
        if (bulletDef.addFlare) ctx.planes.addAirdrop(ctx.world.clampToMap(shotPos, 0));
        // potato guns launch their projectile with the (invisible) bullet (survev fireWeapon projType)
        if (def.projType && projDef) {
            ctx.projectiles.add({
                ownerId: player.id,
                type: def.projType,
                pos: shotPos,
                posZ: PROJECTILE_HEIGHT,
                layer,
                vel: v2.mul(shotDir, projDef.throwPhysics.speed),
                fuse: projDef.fuseTime,
                throwDir: shotDir,
                sourceType: weapon.type,
            });
        }
    }
    // projectile guns are all noSplinter, so Splinter never doubles their projectiles (survev would)
    if (weapon.type === "bugle" && player.hasPerk("inspiration")) playBugle(ctx, player);
    // the Commander's flare gun may be dropped once fired (survev fireWeapon hasFiredFlare)
    if (def.bulletType === "bullet_flare" && player.role === "leader") player.firedFlare = true;
    player.shotSeq++;
    player.shotOffhand = offHand;
    if (fired) ctx.observer?.onShotFired?.(player, weapon.type, fired);
    return true;
}
