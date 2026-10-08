// Obstacle disguises: an outfit with an `obstacleType` (Halloween costumes: Barrel, Stone, Bush, Spoopy Barkskin...)
// puts a copy of that obstacle over its wearer. The copy follows the wearer, shows their health, never collides and
// takes no hits (survev obstacle.ts isSkin); it dies with the wearer like a destroyed obstacle, loot and explosion
// included (survev player.ts kill -> obstacleOutfit.kill). survev player.ts setOutfit, map.ts genOutfitObstacle.
import { math, v2 } from "@rebirth/core";
import { GameConfig, getDefOfType, getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import type { SimContext } from "./context.ts";
import { Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import type { Entity } from "./world.ts";

/** Health changes smaller than this leave the disguise's health as it is (survev math.eqAbs(healthT, t, 0.01)). */
const HEALTH_EPS = 0.01;

/** The live disguise obstacle over `player`, if any. */
export function disguiseOf(ctx: SimContext, player: Player): Obstacle | undefined {
    if (!player.disguiseId) return undefined;
    const obj = ctx.world.get(player.disguiseId);
    return obj instanceof Obstacle && !obj.dead ? obj : undefined;
}

/** Puts `outfit` on `player`, replacing the old outfit's disguise (removed without effects, survev destroy). */
export function setOutfit(ctx: SimContext, player: Player, outfit: string): void {
    if (player.outfit === outfit) return;
    player.outfit = outfit;
    removeDisguise(ctx, player);
    const def = getDefOfType("outfit", outfit);
    if (!def.obstacleType || !hasMapObjectDef(def.obstacleType)) return;
    const obstacleDef = getMapObjectDef(def.obstacleType);
    if (obstacleDef.type !== "obstacle") return;
    const skin = new Obstacle(
        {
            id: ctx.world.allocId(),
            kind: "obstacle",
            type: def.obstacleType,
            pos: v2.copy(player.pos),
            ori: 0,
            scale: def.baseScale ?? obstacleDef.scale.createMax,
            layer: player.layer,
            parentId: 0,
        },
        player.id,
    );
    skin.healthT = healthT(player);
    ctx.world.add(skin);
    player.disguiseId = skin.id;
}

/** Takes `player`'s disguise out of the world without effects (survev obstacle destroy). */
export function removeDisguise(ctx: SimContext, player: Player): void {
    const old = player.disguiseId ? ctx.world.get(player.disguiseId) : undefined;
    if (old) ctx.world.remove(old);
    player.disguiseId = 0;
}

/** Keeps a living player's disguise on them: position, floor and health (survev player.ts update / health setter). */
export function updateDisguise(ctx: SimContext, player: Player): void {
    if (player.dead) return;
    const skin = disguiseOf(ctx, player);
    if (!skin) return;
    if (!v2.eq(skin.pos, player.pos)) skin.setTransform(player.pos, 0);
    skin.layer = player.layer;
    const t = healthT(player);
    if (Math.abs(skin.healthT - t) > HEALTH_EPS) skin.healthT = t;
}

/** The wearer of a living disguise, which is seen exactly when its wearer is (snapshots); undefined otherwise. */
export function wearerOf(ctx: SimContext, obj: Entity): Player | undefined {
    if (obj.kind !== "obstacle" || !obj.isSkin || obj.dead) return undefined;
    return ctx.getPlayer(obj.skinPlayerId);
}

function healthT(player: Player): number {
    return math.clamp(player.health / GameConfig.player.health, 0, 1);
}
