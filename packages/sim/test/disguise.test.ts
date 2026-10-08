// Obstacle disguises (world/disguise.ts): an outfit with an `obstacleType` puts a non-collidable copy of the obstacle
// over its wearer that follows them, shows their health, takes no hits and dies with them, loot and explosion
// included (survev player.ts setOutfit / kill, map.ts genOutfitObstacle, obstacle.ts isSkin; KB items/cosmetics.md).
import { v2 } from "@rebirth/core";
import { DamageType, getMapObjectDef } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    applyObstacleDamage,
    disguiseOf,
    type Game,
    killPlayer,
    type ObstacleView,
    type Player,
    pickupLoot,
    setOutfit,
} from "../src/index.ts";
import { flatGame, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { logExplosions } from "./fxHelpers.ts";

function disguised(outfit: string): { game: Game; p: Player } {
    const game = flatGame();
    const p = spawnAt(game, openSpot(game));
    setOutfit(game, p, outfit);
    return { game, p };
}

describe("obstacle disguises", () => {
    it("picking up a costume puts its obstacle over the wearer, at the costume's scale, non-collidable", () => {
        const game = flatGame();
        const p = spawnAt(game, openSpot(game));
        const loot = game.loot.addLoot("outfitBarrel", p.pos, p.layer, 1, { pushSpeed: 0 })!;
        p.pickupTicker = 0;
        pickupLoot(game, p, loot);
        expect(p.outfit).toBe("outfitBarrel");
        const skin = disguiseOf(game, p)!;
        expect(skin.type).toBe("barrel_01");
        expect(skin.scale).toBeCloseTo(0.8, 6);
        expect(skin.pos).toEqual(p.pos);
        expect(skin.collidable).toBe(false);
        expect(getMapObjectDef("barrel_01").type === "obstacle" && skin.def.collidable).toBe(true);
        const view = game.getSnapshot(p.id).objects.find((o) => o.id === skin.id) as ObstacleView;
        expect(view.skinPlayerId).toBe(p.id);
    });

    it("follows the wearer and shows their health", () => {
        const { game, p } = disguised("outfitStone");
        const skin = disguiseOf(game, p)!;
        send(game, p, { moveRight: true });
        steps(game, 30);
        expect(v2.distance(p.pos, skin.pos)).toBeLessThan(1e-3);
        expect(skin.layer).toBe(p.layer);
        game.damagePlayer(p, { amount: 40, damageType: DamageType.Gas, dir: { x: 1, y: 0 } });
        game.step();
        expect(skin.healthT).toBeCloseTo(p.health / 100, 2);
        expect(skin.scale).toBeCloseTo(0.9, 6);
    });

    it("takes no hits: bullets, melee and explosions leave it whole", () => {
        const { game, p } = disguised("outfitCrate");
        const skin = disguiseOf(game, p)!;
        applyObstacleDamage(game, skin, { amount: 500, damageType: DamageType.Player, dir: { x: 1, y: 0 } });
        expect(skin.dead).toBe(false);
        expect(skin.health).toBe(skin.maxHealth);
    });

    it("a new outfit replaces the disguise; a plain outfit removes it without effects", () => {
        const { game, p } = disguised("outfitBush");
        const bush = disguiseOf(game, p)!;
        setOutfit(game, p, "outfitTree");
        expect(game.world.get(bush.id)).toBeUndefined();
        expect(disguiseOf(game, p)?.type).toBe("tree_07");
        setOutfit(game, p, "outfitBase");
        expect(disguiseOf(game, p)).toBeUndefined();
        expect(p.disguiseId).toBe(0);
    });

    it("dies with the wearer: the barrel blows up, the crate drops its loot", () => {
        const { game, p } = disguised("outfitBarrel");
        const skin = disguiseOf(game, p)!;
        const explosions = logExplosions(game);
        killPlayer(game, p, { amount: 100, damageType: DamageType.Gas, dir: { x: 1, y: 0 } });
        expect(skin.dead).toBe(true);
        expect(game.world.get(skin.id)).toBe(skin);
        expect(explosions.map((e) => [e.type, e.mapSourceType])).toEqual([["explosion_barrel", "barrel_01"]]);

        // the crate's tier_world roll (a gun drops with its ammo) on top of the wearer's own items (barrel_01 has no loot)
        const lootAfterDeath = (outfit: string) => {
            const g = disguised(outfit);
            killPlayer(g.game, g.p, { amount: 100, damageType: DamageType.Gas, dir: { x: 1, y: 0 } });
            return [...g.game.world.objects.values()].filter((o) => o.kind === "loot").length;
        };
        expect(lootAfterDeath("outfitCrate")).toBeGreaterThan(lootAfterDeath("outfitBarrel"));
    });

    it("a removed player takes the disguise along", () => {
        const { game, p } = disguised("outfitPumpkin");
        const skin = disguiseOf(game, p)!;
        game.removePlayer(p.id);
        expect(game.world.get(skin.id)).toBeUndefined();
    });
});
