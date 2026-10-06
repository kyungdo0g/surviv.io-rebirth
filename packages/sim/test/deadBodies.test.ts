// Dead bodies (M9): created where a player dies, sliding along the killing hit (speed 10, drag 4), never removed, sent
// to viewers as "deadBody" objects (survev server/src/game/objects/deadBody.ts, player.ts kill).
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { DeadBodyView, Game, Player } from "../src/index.ts";
import { flatGame, openSpot, spawnAt, steps } from "./combatHelpers.ts";

function arena(): { game: Game; killer: Player; victim: Player; origin: Vec2 } {
    const game = flatGame();
    const origin = openSpot(game, 40);
    const killer = spawnAt(game, origin);
    const victim = spawnAt(game, v2.add(origin, { x: 10, y: 0 }));
    return { game, killer, victim, origin };
}

function kill(game: Game, victim: Player, sourceId: number, dir?: Vec2): void {
    game.damagePlayer(victim, { amount: 1000, damageType: DamageType.Player, sourceId, dir });
}

function bodiesOf(game: Game, viewerId: number): DeadBodyView[] {
    return game.getSnapshot(viewerId).objects.filter((o): o is DeadBodyView => o.kind === "deadBody");
}

describe("dead bodies", () => {
    it("appear where a player dies, with its id and layer, in the snapshots of players in view", () => {
        const { game, killer, victim } = arena();
        expect(bodiesOf(game, killer.id)).toEqual([]);
        const at = v2.copy(victim.pos);
        kill(game, victim, killer.id);
        expect(victim.dead).toBe(true);
        expect(game.deadBodies.bodies).toHaveLength(1);
        const [view] = bodiesOf(game, killer.id);
        expect(view).toMatchObject({ kind: "deadBody", type: "deadBody", playerId: victim.id, layer: 0 });
        expect(view.pos).toEqual(at);
        // a body is an object of its own (a new id, not the player's)
        expect(view.id).not.toBe(victim.id);
    });

    it("slide 10 / 4 = 2.5 units along the killing hit's direction, then rest", () => {
        const { game, killer, victim } = arena();
        const at = v2.copy(victim.pos);
        kill(game, victim, killer.id, { x: 0, y: 1 });
        const body = game.deadBodies.bodies[0];
        expect(body.vel).toEqual({ x: 0, y: 10 });
        game.step();
        // vel *= 1 / (1 + dt * 4), then pos += vel * dt
        expect(body.pos.y - at.y).toBeCloseTo((10 / 1.04) * 0.01, 9);
        steps(game, 600);
        expect(body.pos.x).toBeCloseTo(at.x, 9);
        expect(body.pos.y - at.y).toBeCloseTo(2.5, 3);
        const rest = v2.copy(body.pos);
        steps(game, 100);
        expect(body.pos).toEqual(rest);
        expect(bodiesOf(game, killer.id)[0].pos).toEqual(rest);
    });

    it("stay put without a hit direction (red zone, bleeding)", () => {
        const { game, killer, victim } = arena();
        const at = v2.copy(victim.pos);
        kill(game, victim, 0);
        steps(game, 50);
        expect(game.deadBodies.bodies[0].pos).toEqual(at);
        expect(killer.dead).toBe(false);
    });

    it("are never removed, even when the dead player leaves the game", () => {
        const { game, killer, victim } = arena();
        kill(game, victim, killer.id, { x: 1, y: 0 });
        steps(game, 200);
        game.removePlayer(victim.id);
        steps(game, 3000);
        expect(game.deadBodies.bodies).toHaveLength(1);
        const views = bodiesOf(game, killer.id);
        expect(views).toHaveLength(1);
        expect(views[0].playerId).toBe(victim.id);
    });

    it("are not pushed by explosions", () => {
        const { game, killer, victim } = arena();
        kill(game, victim, killer.id);
        game.step();
        const body = game.deadBodies.bodies[0];
        const rest = v2.copy(body.pos);
        game.explosions.add("explosion_frag", v2.add(rest, { x: 1, y: 0 }), 0, {
            gameSourceType: "frag",
            damageType: DamageType.Player,
            sourceId: killer.id,
        });
        steps(game, 100);
        expect(body.pos).toEqual(rest);
    });

    it("leave the view like any object and come back with it", () => {
        const { game, killer, victim, origin } = arena();
        kill(game, victim, killer.id);
        const [view] = bodiesOf(game, killer.id);
        game.teleportPlayer(killer.id, v2.add(origin, { x: 0, y: 300 }));
        game.step();
        const away = game.getSnapshot(killer.id);
        expect(away.deletedIds).toContain(view.id);
        game.teleportPlayer(killer.id, origin);
        game.step();
        expect(bodiesOf(game, killer.id).map((b) => b.id)).toEqual([view.id]);
    });

    it("are deterministic", () => {
        const run = () => {
            const { game, killer, victim } = arena();
            kill(game, victim, killer.id, v2.normalize({ x: 0.3, y: -1 }));
            steps(game, 77);
            return game.deadBodies.bodies.map((b) => b.toView());
        };
        expect(run()).toEqual(run());
    });
});
