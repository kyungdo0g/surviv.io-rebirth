// Snowball and potato hits (M7b): besides the explosion damage, a hit on an enemy slows it for a while, shows the
// frozen pose turned towards the hit, and makes it drop a random item (survev explosion.ts explode -> player.freeze /
// dropRandomLoot; docs/research/items/throwables.md "Snowball", modes/snow.md, modes/potato.md). Durations and drop
// counts are rules.modes.throwableHits.
import { math, type Vec2 } from "@rebirth/core";
import type { SimContext } from "../world/context.ts";
import { dropRandomLoot } from "../world/dropItem.ts";
import type { Player } from "../world/player.ts";

/**
 * Frozen pose orientation: the player's facing plus the hit direction, quantized to quarter turns (survev:
 * (radToOri(playerRot) + radToOri(-collisionRot) + 2) % 4).
 */
export function frozenOri(facing: Vec2, hitDir: Vec2): number {
    const playerRot = Math.atan2(facing.y, facing.x);
    const collRot = -Math.atan2(hitDir.y, hitDir.x);
    return (((math.radToOri(playerRot) + math.radToOri(collRot) + 2) % 4) + 4) % 4;
}

/**
 * Effects of explosion `type` on `target` before its damage: nothing for the source's teammates (the source itself
 * included), else the slowdown and the random drops of rules.modes.throwableHits.
 */
export function applyThrowableHit(
    ctx: SimContext,
    target: Player,
    type: string,
    hitDir: Vec2,
    source: Player | undefined,
): void {
    const rule = ctx.rules.modes.throwableHits[type];
    if (!rule || target.dead || target.awaitingClass) return;
    if (source && source.teamId === target.teamId) return;
    if (rule.freeze > 0) {
        target.frozen.ticker = rule.freeze;
        target.frozen.ori = frozenOri(target.dir, hitDir);
    }
    for (let i = 0; i < rule.dropRandomLoot; i++) dropRandomLoot(ctx, target);
}
