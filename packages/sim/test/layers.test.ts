// Layers and stairs (M5b): players walk 0 -> 2 -> 3 -> 1 down a bunker's stairs and back, bullets stay on their
// floor but hit players on stairs, the aim layer on stairs, explosions only hurt their floor, thrown projectiles go
// down stairs, loot is picked up on its floor only, snapshots leave out players and loot of the other floor.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { checkStairs, emptyInput, type Game, type Player, type Structure } from "../src/index.ts";
import { findStructure, mapGame, placePlayer, stairCenter, walk } from "./buildingHelpers.ts";
import { constantRng, fireOnce, flatGame, giveGun, openSpot, steps } from "./combatHelpers.ts";

/** A flat game with only the stairs of a storm bunker structure (no floors) in an open area. */
function stairsGame(): { game: Game; structure: Structure; spot: Vec2 } {
    const probe = flatGame();
    const spot = openSpot(probe, 60);
    const game = flatGame([{ type: "bunker_structure_03", kind: "structure", pos: v2.add(spot, { x: 30, y: 0 }) }]);
    game.combatRng = constantRng(0.5);
    const structure = game.world.get(1) as Structure;
    return { game, structure, spot };
}

/** A point `depth` units into the lower (down) half of a stair, at its centre line. */
function onLowerHalf(structure: Structure, depth = 1): Vec2 {
    const stair = structure.stairs[0];
    return v2.add(stairCenter(structure), v2.mul(stair.downDir, depth));
}

describe("stairs", () => {
    it("move a player 0 -> 2 -> 3 -> 1 down a bunker and 1 -> 3 -> 2 -> 0 back up", () => {
        const game = mapGame();
        // the chrysanthemum bunker has no door at the bottom of its stairs
        const bunker = findStructure(game, "bunker_structure_08");
        const stair = bunker.stairs[0];
        const p = placePlayer(game, v2.sub(stairCenter(bunker), v2.mul(stair.downDir, 6)));
        const seen: number[] = [0];
        const localSeen: number[] = [0];
        const record = () => {
            if (seen[seen.length - 1] !== p.layer) seen.push(p.layer);
            const local = game.getSnapshot(p.id).local.layer;
            if (localSeen[localSeen.length - 1] !== local) localSeen.push(local);
        };
        for (let i = 0; i < 300; i++) {
            walk(game, p, stair.downDir, 1);
            record();
        }
        expect(seen).toEqual([0, 2, 3, 1]);
        for (let i = 0; i < 300; i++) {
            walk(game, p, v2.neg(stair.downDir), 1);
            record();
        }
        expect(seen).toEqual([0, 2, 3, 1, 3, 2, 0]);
        expect(localSeen).toEqual(seen);
    });

    it("take the deeper half when a player overlaps both", () => {
        const { game, structure } = stairsGame();
        const stair = structure.stairs[0];
        const up = placePlayer(game, v2.add(stairCenter(structure), v2.mul(stair.downDir, -0.3)));
        const down = placePlayer(game, onLowerHalf(structure, 0.3));
        game.step();
        expect(up.layer).toBe(2);
        expect(down.layer).toBe(3);
    });
});

describe("bridges", () => {
    it("only move loot: river loot floats under the deck on layer 1 and comes out on layer 0", () => {
        const game = mapGame();
        const bridge = findStructure(game, "bridge_md_structure_01");
        const stair = bridge.stairs[1];
        expect(stair.lootOnly).toBe(true);
        const centre = stairCenter(bridge, 1);
        // players (and projectiles) ignore lootOnly stairs
        expect(checkStairs(centre, 1, 0, [bridge]).layer).toBe(0);
        expect(checkStairs(centre, 1, 0, [bridge], true).layer).not.toBe(0);
        const start = v2.sub(centre, v2.mul(stair.downDir, 3));
        const loot = game.loot.addLoot("bandage", start, 0, 1, { pushSpeed: 14, dir: stair.downDir })!;
        const seen: string[] = ["0"];
        for (let i = 0; i < 6000; i++) {
            game.step();
            const tag = `${loot.layer}${loot.belowBridge ? "b" : ""}`;
            if (seen[seen.length - 1] !== tag) seen.push(tag);
        }
        // pushed onto the stairs, then carried by the river under the deck and out the other side
        expect(seen).toEqual(["0", "2b", "3b", "1b", "3b", "2b", "0"]);
        expect(v2.distance(loot.pos, start)).toBeGreaterThan(30);
    });
});

describe("bullets and layers", () => {
    function shoot(game: Game, shooter: Player, target: Player): number {
        giveGun(shooter, "m9");
        const before = target.health;
        fireOnce(game, shooter);
        steps(game, 30);
        return before - target.health;
    }

    it("never cross floors, but hit players on stairs from either floor", () => {
        for (const [shooterLayer, targetLayer, hits] of [
            [0, 0, true],
            [0, 1, false],
            [1, 0, false],
            [1, 1, true],
        ] as const) {
            const probe = flatGame();
            const spot = openSpot(probe, 40);
            const game = flatGame();
            game.combatRng = constantRng(0.5);
            const shooter = placePlayer(game, spot, shooterLayer);
            const target = placePlayer(game, v2.add(spot, { x: 10, y: 0 }), targetLayer);
            expect([shooterLayer, targetLayer, shoot(game, shooter, target) > 0]).toEqual([
                shooterLayer,
                targetLayer,
                hits,
            ]);
        }
        for (const shooterLayer of [0, 1]) {
            const { game, structure } = stairsGame();
            const stair = structure.stairs[0];
            const targetPos = onLowerHalf(structure);
            const target = placePlayer(game, targetPos, 0);
            game.step();
            expect(target.layer).toBe(3);
            // the shooter stands beside the stairs, off them, firing across
            const side = v2.perp(stair.downDir);
            const shooter = placePlayer(game, v2.add(targetPos, v2.mul(side, 8)), shooterLayer, v2.neg(side));
            expect(shoot(game, shooter, target)).toBeGreaterThan(0);
        }
    });

    it("on stairs, facing down or up them fires into that floor", () => {
        const { game, structure } = stairsGame();
        const stair = structure.stairs[0];
        const p = placePlayer(game, onLowerHalf(structure), 0);
        for (const [dir, layer] of [
            [stair.downDir, 3],
            [v2.neg(stair.downDir), 2],
            [v2.perp(stair.downDir), 3],
        ] as const) {
            game.setInput(p.id, { ...emptyInput(), toMouseDir: dir });
            game.step();
            expect(p.aimLayer).toBe(layer);
            giveGun(p, "m9");
            fireOnce(game, p);
            expect(game.bullets.active.at(-1)?.layer).toBe(layer);
        }
    });
});

describe("melee across floors", () => {
    it("a swing only reaches players on the swinger's floor", () => {
        for (const [targetLayer, hits] of [
            [0, true],
            [1, false],
        ] as const) {
            const probe = flatGame();
            const spot = openSpot(probe, 20);
            const game = flatGame();
            game.combatRng = constantRng(0.5);
            const p = placePlayer(game, spot, 0);
            const target = placePlayer(game, v2.add(spot, { x: 1.8, y: 0 }), targetLayer);
            game.setInput(p.id, { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, shootStart: true, shootHold: true });
            steps(game, 30);
            expect([targetLayer, target.health < 100]).toEqual([targetLayer, hits]);
        }
    });
});

describe("explosions and projectiles across floors", () => {
    it("explosions only hurt their floor and the stairs half on it", () => {
        const { game, structure, spot } = stairsGame();
        const ground = placePlayer(game, spot, 0);
        const under = placePlayer(game, v2.add(spot, { x: 1, y: 1 }), 1);
        game.explosions.add("explosion_frag", v2.add(spot, { x: 0.5, y: 0.5 }), 0, { damageType: DamageType.Player });
        game.step();
        expect(ground.health).toBeLessThan(100);
        expect(under.health).toBe(100);
        // on the stairs: the upper half (2) shares the ground's explosions, the lower half (3) does not
        const stair = structure.stairs[0];
        const upper = placePlayer(game, v2.sub(stairCenter(structure), v2.mul(stair.downDir, 0.8)), 0);
        const lower = placePlayer(game, onLowerHalf(structure, 0.8), 0);
        game.step();
        expect([upper.layer, lower.layer]).toEqual([2, 3]);
        game.explosions.add("explosion_frag", stairCenter(structure), 0, { damageType: DamageType.Player });
        game.step();
        expect(upper.health).toBeLessThan(100);
        expect(lower.health).toBe(100);
    });

    it("thrown projectiles roll down the stairs to the lower floor", () => {
        const { game, structure } = stairsGame();
        const stair = structure.stairs[0];
        const proj = game.projectiles.add({
            ownerId: 0,
            type: "smoke",
            pos: v2.sub(stairCenter(structure), v2.mul(stair.downDir, 4)),
            posZ: 0,
            layer: 0,
            vel: v2.mul(stair.downDir, 12),
            fuse: 5,
        });
        const seen: number[] = [0];
        for (let i = 0; i < 200 && !proj.dead; i++) {
            game.step();
            if (seen[seen.length - 1] !== proj.layer) seen.push(proj.layer);
        }
        expect(seen).toEqual([0, 2, 3, 1]);
        expect(game.projectiles.views({ min: { x: 0, y: 0 }, max: { x: 1e4, y: 1e4 } })[0]?.layer).toBe(1);
    });
});

describe("loot and snapshots across floors", () => {
    it("loot on layer 1 can only be picked up from layer 1", () => {
        const probe = flatGame();
        const spot = openSpot(probe, 20);
        const game = flatGame();
        const loot = game.loot.addLoot("bandage", spot, 1, 3, { pushSpeed: 0 })!;
        const p = placePlayer(game, spot, 0);
        game.setInput(p.id, { ...emptyInput(), actions: [Input.Loot] });
        game.step();
        expect(loot.destroyed).toBe(false);
        game.teleportPlayer(p.id, spot, 1);
        game.setInput(p.id, { ...emptyInput(), actions: [Input.Loot] });
        game.step();
        expect(loot.destroyed).toBe(true);
        expect(p.inv.get("bandage")).toBe(3);
    });

    it("leave out players and loot of the other floor unless the viewer or the object is on stairs", () => {
        const { game, structure, spot } = stairsGame();
        const viewer = placePlayer(game, spot, 0);
        const under = placePlayer(game, v2.add(spot, { x: 3, y: 0 }), 1);
        const ground = placePlayer(game, v2.add(spot, { x: -3, y: 0 }), 0);
        const lootUnder = game.loot.addLoot("bandage", v2.add(spot, { x: 0, y: 3 }), 1, 1, { pushSpeed: 0 })!;
        const lootGround = game.loot.addLoot("bandage", v2.add(spot, { x: 0, y: -3 }), 0, 1, { pushSpeed: 0 })!;
        game.step();
        const ids = (p: Player) => new Set(game.getSnapshot(p.id).objects.map((o) => o.id));
        let seen = ids(viewer);
        expect(seen.has(ground.id) && seen.has(lootGround.id) && seen.has(structure.id)).toBe(true);
        expect(seen.has(under.id) || seen.has(lootUnder.id)).toBe(false);
        // the underground player sees its floor only
        seen = ids(under);
        expect(seen.has(lootUnder.id) && !seen.has(ground.id) && !seen.has(lootGround.id)).toBe(true);
        // the other player left the view: it is reported deleted to the viewer once it goes underground
        game.teleportPlayer(ground.id, ground.pos, 1);
        expect(game.getSnapshot(viewer.id).deletedIds).toContain(ground.id);
        // a viewer on the stairs sees both floors
        game.teleportPlayer(viewer.id, onLowerHalf(structure), 0);
        game.step();
        expect(viewer.layer).toBe(3);
        seen = ids(viewer);
        expect(seen.has(under.id) && seen.has(lootUnder.id) && seen.has(lootGround.id)).toBe(true);
        expect(game.getSnapshot(viewer.id).local.layer).toBe(3);
        // the rule can be switched off (the original sent every object in view)
        game.rules.cullOtherFloors = false;
        game.teleportPlayer(viewer.id, spot, 0);
        game.step();
        expect(ids(viewer).has(under.id)).toBe(true);
    });
});
