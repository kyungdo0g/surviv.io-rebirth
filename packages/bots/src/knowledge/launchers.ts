// The rebirth beta launchers (bot round 6; defs gunClasses launcher: M79, MGL, GL-06, RPG-7, Panzerfaust, M202;
// docs/design/new-gun-stats.md), as the bots read them from the defs: what one round deals (the explosion, plus the
// rocket's own hit), how far and how fast it flies, how wide it bursts and how close is too close.
// - Rockets and the GL-06 round are bullets with an `onHit` explosion and an `armDistance`: stopped before it, the
//   round is a dud (sim combat/bullets.ts).
// - The M79 and the MGL fire a 40 mm grenade (projType m79_grenade): it flies at its throw speed, bursts on touching a
//   player or a tall obstacle, or where it lands when its fuse runs out (sim combat/projectiles.ts); its carrier
//   bullet deals nothing.
// Point blank is never allowed: a blast hurts its shooter (self damage stays in every mode, sim combat/damage.ts), so a
// launcher is fired only beyond its blast's outer radius plus the body radius and some slack, and never before the
// round arms.
import { GameConfig, GameObjectDefs, type GunDef, hasDef } from "@rebirth/defs";
import { gunClassOf } from "./gunTiers.ts";

export interface LauncherSpec {
    id: string;
    /** explosion of one round: damage and blast radii */
    blastDamage: number;
    blastMin: number;
    blastMax: number;
    /** direct-hit damage of the round itself (rockets), 0 for a grenade */
    hitDamage: number;
    /** flight speed (u/s) and reach (u) */
    speed: number;
    range: number;
    /** the round explodes only after this many units (0: from the muzzle) */
    armDistance: number;
    /** never fired at targets closer than this: max(arming distance, blast reach to the body + slack) */
    minDist: number;
    /** rounds per volley (the M202 fires four) */
    rounds: number;
    /** the round's explosion id (explosion-gated doors open to listed ids only: brain/gateBreach.ts) */
    explosion: string;
}

const BODY = GameConfig.player.radius;
/** Slack beyond the blast's reach: the round may burst a little short of the target (on cover, on the target's edge). */
const SLACK = 2;
/** Gravity of thrown projectiles and the height guns launch theirs from (sim combat/projectiles.ts, weapons/gun.ts). */
const GRAVITY = 10.5;
const LAUNCH_HEIGHT = 0.5;

const cache = new Map<string, LauncherSpec | null>();

function explosionOf(id: string | undefined): { damage: number; min: number; max: number } | null {
    if (!id || !hasDef(id)) return null;
    const e = GameObjectDefs[id] as { type?: string; damage?: number; rad?: { min: number; max: number } };
    return e.type === "explosion" && e.rad ? { damage: e.damage ?? 0, min: e.rad.min, max: e.rad.max } : null;
}

/** Launcher knowledge of a gun id, or undefined when it is no launcher (defs gunClass). */
export function launcherSpec(id: string): LauncherSpec | undefined {
    const hit = cache.get(id);
    if (hit !== undefined) return hit ?? undefined;
    let out: LauncherSpec | null = null;
    // (the bots' class: the beta launchers, and the Potato Cannon since round 6)
    if (hasDef(id) && GameObjectDefs[id].type === "gun" && gunClassOf(id) === "launcher") {
        const def = GameObjectDefs[id] as GunDef & { projType?: string };
        const bullet = hasDef(def.bulletType)
            ? (GameObjectDefs[def.bulletType] as {
                  damage?: number;
                  distance?: number;
                  speed?: number;
                  onHit?: string;
                  armDistance?: number;
              })
            : {};
        const proj =
            def.projType && hasDef(def.projType)
                ? (GameObjectDefs[def.projType] as {
                      explosionType?: string;
                      fuseTime?: number;
                      throwPhysics?: { speed?: number; velZ?: number };
                  })
                : null;
        const blast = explosionOf(proj?.explosionType ?? bullet.onHit);
        if (blast) {
            let speed = bullet.speed ?? 100;
            let range = bullet.distance ?? 0;
            let hitDamage = bullet.damage ?? 0;
            if (proj) {
                // a lobbed grenade: in the air until it lands or its fuse runs out, at its throw speed
                speed = proj.throwPhysics?.speed ?? 40;
                const vz = proj.throwPhysics?.velZ ?? 0;
                const air = (vz + Math.sqrt(vz * vz + 2 * GRAVITY * LAUNCH_HEIGHT)) / GRAVITY;
                range = speed * Math.min(proj.fuseTime ?? air, air > 0 ? air : (proj.fuseTime ?? 1));
                hitDamage = 0;
            }
            const armDistance = bullet.armDistance ?? 0;
            out = {
                id,
                blastDamage: blast.damage,
                blastMin: blast.min,
                blastMax: blast.max,
                hitDamage,
                speed,
                range,
                armDistance,
                minDist: Math.max(armDistance, blast.max + BODY + SLACK),
                rounds: Math.max(1, def.bulletCount),
                explosion: proj?.explosionType ?? bullet.onHit ?? "",
            };
        }
    }
    cache.set(id, out);
    return out ?? undefined;
}

/** Whether a gun id is a launcher. */
export function isLauncher(id: string): boolean {
    return launcherSpec(id) !== undefined;
}
