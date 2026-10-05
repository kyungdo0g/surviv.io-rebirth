// Firing one gun shot: muzzle position clipped against obstacles, spread, pellets with jitter, bullet spawn.
// Behaviour follows survev server/src/game/weaponManager.ts fireWeapon and docs/research/items/guns.md.
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, type GunDef, getDefOfType } from "@rebirth/defs";
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

/**
 * Why a gun cannot fire yet, or null. Guns that need systems of a later milestone refuse to fire:
 * TODO(M5): projectile guns (potato cannon, spud gun: `isLauncher` / `projType`) need the projectile system;
 * TODO(M5): bullets with an `onHit` explosion (USAS-12 frag rounds) need explosions.
 */
export function gunFireGate(def: GunDef): "projectile" | "explosion" | null {
    if (def.isLauncher || def.projType) return "projectile";
    if (getDefOfType("bullet", def.bulletType).onHit) return "explosion";
    return null;
}

interface MuzzleClip {
    len: number;
    point: Vec2;
    normal: Vec2;
}

/** Nearest obstacle surface between the gun and barrelLength + 1.5 ahead (survev fireWeapon clipping). */
function clipMuzzle(ctx: SimContext, player: Player, gunPos: Vec2, dir: Vec2, gunLen: number, layer: number): MuzzleClip {
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
 * null for burst shots, whose timing the burst queue owns. Returns true when bullets were fired.
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

    // TODO(M4+): firing down stairs uses the aim layer; players stay on their layer until stairs exist
    const layer = player.layer;
    const gunOff = def.isDual ? (def.dualOffset ?? 0) * (offHand ? 1 : -1) : def.barrelOffset;
    const gunPos = v2.add(player.pos, v2.mul(v2.perp(dir), gunOff));
    const gunLen = def.barrelLength;
    const clip = clipMuzzle(ctx, player, gunPos, dir, gunLen, layer);

    let spread = def.shotSpread;
    if (v2.distance(player.pos, player.posOld) > MOVE_SPREAD_EPS) spread += def.moveSpread;
    // first-shot accuracy: no spread when the last shot (or switch) was at least recoilTime ago
    if (wm.recoilTicker >= def.recoilTime) spread = 0;
    wm.recoilTicker = 0;

    const rng = ctx.combatRng;
    const jitter = def.jitter ?? DEFAULT_JITTER;
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
        ctx.bullets.fire({
            shooterId: player.id,
            bulletType: def.bulletType,
            sourceType: weapon.type,
            pos: v2.add(gunPos, v2.mul(startDir, startLen)),
            dir: shotDir,
            layer,
            shotFx: i === 0,
            offHand,
        });
    }
    // TODO(M5): bullet_flare (addFlare) calls in an airdrop where it is fired
    player.shotSeq++;
    player.shotOffhand = offHand;
    return true;
}
