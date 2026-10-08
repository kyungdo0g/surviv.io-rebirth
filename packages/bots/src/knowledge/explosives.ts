// What every player knows about exploding obstacles (owner, 2026-10-08: "bots taking cover behind explosive barrels is
// a bit odd: they don't seem to know it explodes"): red barrels, propane tanks, ovens, grills, power boxes, stoves and
// the destructible control panels blow up when they break. The list comes from the defs, not from names: a map
// obstacle is explosive when its def names an `explosion` that deals damage and the obstacle can be destroyed (the
// recorders, switches, bathhouse rocks and the survev tables carry explosion_barrel too but are indestructible, so they
// never go off: docs/research/mechanics/explosions.md "Obstacles and explosions"). The blast follows the simulation's
// damage model (explosions.md "Damage model", sim combat/explosions.ts damageAt with the default "step" falloff): full
// damage while the body touches the rad.min circle, then damage x (1 - dist / rad.max) to the body's surface, nothing
// past rad.max; the rays stop at collidable obstacles taller than 0.5 (walls, doors, trees), not at the 0.5-high
// crates, stones and barrels.
import { GameConfig, GameObjectDefs, hasDef, MapObjectDefs, type ObstacleDef } from "@rebirth/defs";

const PLAYER_RAD = GameConfig.player.radius;
/** A collidable obstacle taller than this stops a blast ray (explosions.md "Damage model" 5; sim BLOCK_HEIGHT). */
const BLAST_BLOCK_HEIGHT = 0.5;

export interface Explosive {
    /** the explosion def id (explosion_barrel, explosion_stove, ...) */
    explosion: string;
    /** damage inside the full-damage circle */
    damage: number;
    /** full damage while the body touches a circle this big around the centre (explosion rad.min) */
    radMin: number;
    /** no damage past this distance from the centre to the body's surface (explosion rad.max) */
    radMax: number;
    /** the obstacle's full health (ObstacleView.healthT is a fraction of it) */
    health: number;
}

const byDef = new WeakMap<ObstacleDef, Explosive | null>();

/** The blast of an obstacle that explodes when destroyed, from its def; null for every other obstacle. */
export function explosiveOf(def: ObstacleDef): Explosive | null {
    let e = byDef.get(def);
    if (e === undefined) {
        e = null;
        const ex = def.destructible && def.explosion && hasDef(def.explosion) ? GameObjectDefs[def.explosion] : null;
        if (ex && ex.type === "explosion" && ex.damage > 0 && ex.rad.max > 0)
            e = {
                explosion: def.explosion as string,
                damage: ex.damage,
                radMin: ex.rad.min,
                radMax: ex.rad.max,
                health: def.health,
            };
        byDef.set(def, e);
    }
    return e;
}

/** Ids of every explosive obstacle in the defs (definition order). */
export function explosiveTypes(): string[] {
    const out: string[] = [];
    for (const [id, def] of Object.entries(MapObjectDefs))
        if (def.type === "obstacle" && explosiveOf(def)) out.push(id);
    return out;
}

/**
 * Damage the blast deals to a body (radius 1) whose centre stands `dist` from the explosive's centre, before armour
 * (sim damageAt: the body touching the rad.min circle takes it all, else the falloff to its surface).
 */
export function blastDamage(e: Explosive, dist: number): number {
    const surface = Math.max(0, dist - PLAYER_RAD);
    if (surface <= e.radMin) return e.damage;
    return Math.max(0, e.damage * (1 - surface / e.radMax));
}

/** The distance from the centre past which a body takes no blast damage at all (rad.max plus the body's radius). */
export function blastReach(e: Explosive): number {
    return e.radMax + PLAYER_RAD;
}

/** Whether `def` stops blast rays (collidable and taller than BLAST_BLOCK_HEIGHT: walls, doors, trees; not stones). */
export function stopsBlast(def: ObstacleDef): boolean {
    return def.collidable && def.height > BLAST_BLOCK_HEIGHT;
}
