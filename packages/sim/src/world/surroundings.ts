// What a player's surroundings do to it after it moved: building heal regions, automatic doors, and the stairs that
// move it between floors (with the layer its bullets fly on).
// Behaviour follows survev server/src/game/objects/player.ts update ("Scope zoom, heal regions and auto open doors",
// "Calculate layer").
import { healRegionRate } from "./buildings.ts";
import type { SimContext } from "./context.ts";
import { autoOpenDoors } from "./doors.ts";
import { aimLayerOf, checkStairs } from "./layers.ts";
import type { Player } from "./player.ts";
import type { Entity } from "./world.ts";

/** `objs` is the player's movement broadphase result (it covers the reach of this tick's movement). */
export function updateSurroundings(ctx: SimContext, player: Player, objs: readonly Entity[], dt: number): void {
    // heal regions work for players standing up, outside the red zone (fandom Steam_Rock; survev player.ts)
    player.healEffectTicker = Math.max(0, player.healEffectTicker - dt);
    player.healEffect = player.healEffectTicker > 0;
    if (!player.downed && !ctx.gas.isInGas(player.pos)) {
        const rate = healRegionRate(player.pos, player.layer, objs);
        if (rate > 0) {
            player.health = Math.min(player.health + rate * dt, 100);
            player.healEffect = true;
        }
    }
    autoOpenDoors(ctx, player, objs);
    const stairs = checkStairs(player.pos, player.rad, player.layer, objs);
    player.layer = stairs.layer;
    player.aimLayer = aimLayerOf(player.dir, player.layer, stairs.stair);
}
