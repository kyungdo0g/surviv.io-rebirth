// Melee hit resolution at each damage time of a swing (survev server/src/game/weaponManager.ts meleeDamage,
// docs/research/items/melee.md "How a melee swing works").
import { type Circle, collider, type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, type MeleeDef } from "@rebirth/defs";
import type { SimContext } from "../world/context.ts";
import type { Obstacle } from "../world/entities.ts";
import type { Player } from "../world/player.ts";
import { type Entity, sameLayer } from "../world/world.ts";

const scratch: Entity[] = [];

interface MeleeHit {
    obj: Obstacle | Player;
    /** 0 enemy player, 1 obstacle, 2 teammate (survev) */
    prio: number;
    pen: number;
    dir: Vec2;
}

/** The swing circle: attack.offset (pushed out by the player's extra scale) rotated by the facing (survev). */
export function meleeCollider(player: Player, def: MeleeDef): Circle {
    const rot = Math.atan2(player.dir.y, player.dir.x);
    const offset = v2.add(def.attack.offset, { x: player.scale - 1, y: 0 });
    return collider.createCircle(v2.add(player.pos, v2.rotate(offset, rot)), def.attack.rad);
}

/** Distance along the ray until the first obstacle of the list at least `height` tall (survev intersectSegmentDist). */
function obstacleDist(obstacles: readonly Obstacle[], pos: Vec2, dir: Vec2, len: number, height: number, layer: number) {
    let dist = len;
    let id = 0;
    const end = v2.add(pos, v2.mul(dir, len));
    for (const o of obstacles) {
        if (o.dead || !o.collidable || o.def.isWindow || o.height < height || !sameLayer(o.layer, layer)) continue;
        const res = collider.intersectSegment(o.collider, pos, end);
        if (res && res.dist < dist) {
            dist = res.dist;
            id = o.id;
        }
    }
    return { dist, id };
}

export function meleeDamage(ctx: SimContext, player: Player, def: MeleeDef): void {
    const col = meleeCollider(player, def);
    const reach = col.rad + v2.distance(player.pos, col.pos);
    const box = { min: v2.sub(col.pos, { x: col.rad, y: col.rad }), max: v2.add(col.pos, { x: col.rad, y: col.rad }) };
    const objs = ctx.world.query(box, scratch);
    const obstacles: Obstacle[] = [];
    for (const obj of objs) {
        if (obj.kind === "obstacle" && collider.intersect(col, obj.collider)) obstacles.push(obj);
    }
    const hits: MeleeHit[] = [];
    for (const o of obstacles) {
        if (o.dead || o.height < GameConfig.player.meleeHeight || !sameLayer(o.layer, player.layer & 1)) continue;
        const res = collider.intersect(col, o.collider);
        if (!res) continue;
        // cleaving weapons must not hit obstacles behind walls
        if (def.cleave) {
            const toObs = v2.normalizeSafe(v2.sub(o.pos, player.pos), { x: 1, y: 0 });
            const wall = obstacleDist(obstacles, player.pos, toObs, reach, o.height, player.layer);
            if (wall.id !== 0 && wall.id !== o.id) continue;
        }
        hits.push({ obj: o, prio: 1, pen: res.pen, dir: res.dir });
    }
    for (const obj of objs) {
        if (obj.kind !== "player" || obj.id === player.id || obj.dead || !sameLayer(obj.layer, player.layer)) continue;
        const res = collider.intersect(col, collider.createCircle(obj.pos, obj.rad));
        if (!res) continue;
        const dir = v2.normalizeSafe(v2.sub(obj.pos, player.pos), { x: 1, y: 0 });
        const line = collider.intersectSegment(
            collider.createCircle(obj.pos, obj.rad),
            player.pos,
            v2.add(player.pos, v2.mul(dir, reach)),
        );
        const distToPlayer = v2.distance(line ? line.point : obj.pos, player.pos);
        // a player behind an obstacle closer than itself along the swing line is not hit
        const blocked = obstacleDist(obstacles, player.pos, dir, reach, GameConfig.player.meleeHeight, player.layer);
        if (blocked.dist < distToPlayer) continue;
        // TODO(M6): teammates get priority 2 once teams exist
        hits.push({ obj, prio: 0, pen: res.pen, dir });
    }
    hits.sort((a, b) => (a.prio === b.prio ? b.pen - a.pen : a.prio - b.prio));
    const count = def.cleave ? hits.length : Math.min(hits.length, 1);
    for (let i = 0; i < count; i++) {
        const hit = hits[i];
        if (hit.obj.kind === "obstacle") {
            ctx.damageObstacle(hit.obj, {
                amount: def.damage * def.obstacleDamage,
                damageType: DamageType.Player,
                gameSourceType: player.activeWeapon,
                sourceId: player.id,
                dir: v2.copy(player.dir),
            });
        } else {
            ctx.damagePlayer(hit.obj, {
                amount: def.damage,
                damageType: DamageType.Player,
                gameSourceType: player.activeWeapon,
                sourceId: player.id,
                dir: hit.dir,
            });
        }
    }
}
