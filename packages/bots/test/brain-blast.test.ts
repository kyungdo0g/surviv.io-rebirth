// Exploding obstacles (BrainFeatures.blastAware / barrelShot; owner, 2026-10-08: "bots taking cover behind explosive
// barrels is a bit odd: they don't seem to know it explodes"): the explosive list comes from the defs, a bot in a fight
// next to a barrel and a crate hides behind the crate, one forced behind a barrel leaves it once the barrel is shot, a
// bot beside a barrel being shot steps out of the blast (a healing bot in a simulation too), no bot shoots past an
// explosive close enough to hurt it, and intermediate and expert bots shoot a barrel next to their target when they
// stand outside its blast and it breaks within a moment. The baseline knows none of it.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, getMapObjectDef, type ObstacleDef } from "@rebirth/defs";
import type { Obstacle } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { barrelShotFor } from "../src/brain/barrelShot.ts";
import { findCover } from "../src/brain/combat.ts";
import { BRAIN_PRESETS, type BrainFeatures, withFeatures } from "../src/brain/features.ts";
import { planFight } from "../src/brain/tactics.ts";
import { BotController } from "../src/controller.ts";
import { blastDamage, blastReach, explosiveOf, explosiveTypes } from "../src/knowledge/explosives.ts";
import { installBlastWatch } from "../src/perception/blasts.ts";
import { screenBounds } from "../src/perception/sight.ts";
import type { SeenObstacle } from "../src/perception/world.ts";
import { addEnemy, addObstacle, brainOf, faceTo, NOW, type TestWorld, testWorld } from "./brain-world.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";

const COVER: ["cover", "blastAware"] = ["cover", "blastAware"];

/** The obstacle added last (addObstacle does not return it). */
function last(w: TestWorld): SeenObstacle {
    return w.model.obstacles[w.model.obstacles.length - 1];
}

/** A world whose screen is set around the bot (the hits on an explosive count only on the screen). */
function screenWorld(): TestWorld {
    const w = testWorld();
    w.model.screen = screenBounds(w.spot, w.model.self.zoom);
    return w;
}

/** A fight at 20 u with a barrel a few steps off the bot and a crate farther away, both shielding from the enemy. */
function barrelAndCrate() {
    const w = screenWorld();
    const e = addEnemy(w, 2, { x: 20, y: 0 });
    faceTo(e, w.spot);
    addObstacle(w, { x: 2, y: 3 }, "barrel_01");
    const barrel = last(w);
    addObstacle(w, { x: -2, y: -5 }, "crate_01");
    const crate = last(w);
    return { w, e, barrel, crate };
}

function centre(o: SeenObstacle): Vec2 {
    return o.col.type === 0 ? o.col.pos : v2.mul(v2.add(o.col.min, o.col.max), 0.5);
}

/** Steps the snapshot clock: the model's time and the explosive's health as the snapshot shows it. */
function snap(w: TestWorld, t: number, o?: SeenObstacle, healthT?: number): void {
    w.model.time = t;
    if (o && healthT !== undefined) o.view = { ...o.view, healthT };
}

describe("explosive obstacles: knowledge", () => {
    it("lists the obstacles that explode from the defs: destructible ones with a damaging explosion", () => {
        const types = explosiveTypes();
        for (const t of ["barrel_01", "barrel_01b", "propane_01", "power_box_01", "oven_01", "grill_01", "stove_01"])
            expect(types).toContain(t);
        expect(types).toContain("control_panel_01");
        // indestructible ones carry explosion_barrel too but never go off (explosions.md "Obstacles and explosions")
        for (const t of ["recorder_01", "switch_02", "bathhouse_rocks_01", "table_06", "crate_01", "tree_01"])
            expect(types).not.toContain(t);
        for (const t of types) {
            const def = getMapObjectDef(t) as ObstacleDef;
            expect(def.destructible).toBe(true);
            expect(def.explosion).toBeTruthy();
        }
    });

    it("blast damage follows the simulation's step falloff: full inside rad.min, none past rad.max", () => {
        const e = explosiveOf(getMapObjectDef("barrel_01") as ObstacleDef)!;
        expect(e).toMatchObject({ damage: 125, radMin: 5, radMax: 12, health: 150 });
        expect(blastDamage(e, 3.25)).toBe(125);
        expect(blastDamage(e, 6)).toBe(125);
        expect(blastDamage(e, 7)).toBeCloseTo(125 * (1 - 6 / 12));
        expect(blastDamage(e, blastReach(e))).toBe(0);
        expect(blastDamage(e, 20)).toBe(0);
    });
});

describe("explosive obstacles: cover", () => {
    it("losing a fight next to a barrel and a crate: hides behind the crate (cover alone takes the barrel)", () => {
        const { w, barrel, crate } = barrelAndCrate();
        w.model.self.health = 40;
        // cover alone: the barrel is the closest cover
        const plain = brainOf(w, ["cover"]);
        const before = planFight(plain.context(NOW));
        expect(plain.mem.smart.cover).toBe("hide");
        expect(v2.distance(before.goal!, centre(barrel))).toBeLessThan(4);
        // knowing barrels explode: the crate, out of the barrel's full-damage blast
        const aware = brainOf(w, COVER);
        const hide = planFight(aware.context(NOW));
        expect(aware.mem.smart.cover).toBe("hide");
        const goal = hide.goal!;
        expect(v2.distance(goal, centre(crate))).toBeLessThan(5);
        expect(blastDamage(explosiveOf(barrel.def)!, v2.distance(goal, centre(barrel)))).toBeLessThan(30);
        expect(w.model.bodyLineOfFire(w.model.contacts.get(2)!.pos, goal)).toBe(false);
    });

    it("every cover search pays for explosives once the watch is installed (reload cover, holds)", () => {
        const { w, e, barrel, crate } = barrelAndCrate();
        const spotA = findCover(w.model, e.pos);
        expect(v2.distance(spotA!, centre(barrel))).toBeLessThan(4);
        installBlastWatch(w.model);
        const spotB = findCover(w.model, e.pos);
        expect(v2.distance(spotB!, centre(crate))).toBeLessThan(5);
    });

    it("a barrel as the only cover: taken, then left as soon as it is being shot", () => {
        const w = screenWorld();
        const e = addEnemy(w, 2, { x: 20, y: 0 });
        faceTo(e, w.spot);
        w.model.self.health = 40;
        addObstacle(w, { x: 2, y: 3 }, "barrel_01");
        const barrel = last(w);
        const brain = brainOf(w, COVER);
        snap(w, NOW);
        const hide = planFight(brain.context(NOW));
        expect(brain.mem.smart.cover).toBe("hide");
        w.model.self.pos = v2.copy(hide.goal!);
        snap(w, NOW + 0.1);
        planFight(brain.context(NOW + 0.1));
        expect(brain.mem.smart.cover).toBe("hide");
        // the enemy's bullets land in the barrel: its health falls
        snap(w, NOW + 0.2, barrel, 0.85);
        e.lastSeen = NOW + 0.2;
        planFight(brain.context(NOW + 0.2));
        expect(brain.mem.smart.cover).toBe("none");
        // and it does not come back to it while the barrel is being shot
        snap(w, NOW + 0.6, barrel, 0.8);
        e.lastSeen = NOW + 0.6;
        planFight(brain.context(NOW + 0.6));
        expect(brain.mem.smart.coverSpot).toBeNull();
    });

    it("a badly damaged barrel is no cover at all", () => {
        const { w, e, barrel } = barrelAndCrate();
        w.model.obstacles.pop();
        barrel.view = { ...barrel.view, healthT: 0.4 };
        installBlastWatch(w.model);
        expect(findCover(w.model, e.pos)).toBeNull();
    });
});

describe("explosive obstacles: awareness", () => {
    function besideBarrel(features: readonly ("blastAware" | "pursuit")[]) {
        const w = screenWorld();
        addObstacle(w, { x: 3, y: 0 }, "barrel_01");
        const barrel = last(w);
        const brain = brainOf(w, features);
        const intents = [];
        // the barrel takes hits from someone off to the side: its health falls snapshot after snapshot
        const hp = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
        for (let k = 0; k < hp.length; k++) {
            const t = NOW + k * 0.15;
            snap(w, t, barrel, hp[k]);
            intents.push(brain.think(t, 0.15));
        }
        return { w, barrel, brain, intents };
    }

    it("standing beside a barrel being shot: steps straight out of its blast after a reaction", () => {
        const { w, barrel, brain, intents } = besideBarrel(["blastAware"]);
        const away = v2.normalizeSafe(v2.sub(w.spot, centre(barrel)));
        // the first hit shows at the second snapshot; a normal bot reacts after 0.4 s
        expect(intents[1].urgent).toBeFalsy();
        const late = intents[intents.length - 1];
        expect(late.urgent).toBe(true);
        expect(late.moveDir).not.toBeNull();
        expect(v2.dot(late.moveDir!, away)).toBeGreaterThan(0.7);
        expect(brain.mem.fight.trace.last("blast")?.detail).toMatch(/^out/);
    });

    it("the baseline does not know: it stays", () => {
        const { brain, intents } = besideBarrel([]);
        for (const i of intents) expect(i.urgent).toBeFalsy();
        expect(brain.mem.fight.trace.last("blast")).toBeUndefined();
    });

    it("a wall between the barrel and the bot stops the blast: no step", () => {
        const w = screenWorld();
        addObstacle(w, { x: 6, y: 0 }, "barrel_01");
        const barrel = last(w);
        // a tree (collidable, taller than 0.5) between them
        addObstacle(w, { x: 3, y: 0 }, "tree_01");
        const brain = brainOf(w, ["blastAware"]);
        let urgent = false;
        for (let k = 0; k < 7; k++) {
            const t = NOW + k * 0.15;
            snap(w, t, barrel, 1 - k * 0.1);
            urgent ||= !!brain.think(t, 0.15).urgent;
        }
        expect(urgent).toBe(false);
    });

    it("never shoots past a propane tank close enough to blow it up in its own face", () => {
        const tankWorld = (off: Vec2) => {
            const w = screenWorld();
            faceTo(addEnemy(w, 2, { x: 9, y: 0 }), w.spot);
            addObstacle(w, off, "propane_01");
            return w;
        };
        // the tank 3 u off, 0.15 u beside the line of fire (under 3 degrees): the shot clears its edge, its spread and
        // the hand's wobble would not
        const w = tankWorld({ x: 3, y: 1.4 });
        const plain = brainOf(w, []).think(NOW, 0.1);
        expect(plain.behaviour).toBe("fight");
        expect(plain.fire).toBe(true);
        const aware = brainOf(w, ["blastAware"]);
        const held = aware.think(NOW, 0.1);
        expect(held.behaviour).toBe("fight");
        expect(held.fire).toBe(false);
        expect(aware.mem.fight.trace.last("blast")?.detail).toMatch(/^hold/);
        // the same tank well off the line: it shoots
        expect(brainOf(tankWorld({ x: 3, y: 4 }), ["blastAware"]).think(NOW, 0.1).fire).toBe(true);
    });
});

describe("explosive obstacles: simulation", () => {
    const SPOT = openSpot(flatGame(), 40);

    /**
     * A hurt bot healing 3.5 u from a barrel that someone off screen keeps shooting (0.8 HP a tick from 1 s: it blows
     * at 2.87 s); the bot's health lost to the blast and its distance from the barrel when it went off.
     */
    function healBesideBarrel(brain: Readonly<BrainFeatures>) {
        const barrelPos = v2.add(SPOT, { x: 3.5, y: 0 });
        const game = flatGame({ sandbox: true }, 1, [{ type: "barrel_01", pos: barrelPos }]);
        const barrel = [...game.world.objects.values()].find(
            (o): o is Obstacle => o.kind === "obstacle" && o.type === "barrel_01",
        )!;
        const me = placePlayer(game, "bot", SPOT);
        giveGun(me, "mp5", 120);
        me.health = 50;
        me.inv.set("bandage", 5);
        const bot = new BotController(game, me.id, { seed: 1, brain });
        let lost = -1;
        let dist = -1;
        for (let i = 0; i < 400; i++) {
            bot.update();
            const before = me.health;
            if (i >= 100 && !barrel.dead) {
                game.damageObstacle(barrel, { amount: 0.8, damageType: DamageType.Player });
                if (barrel.dead) dist = v2.distance(me.pos, barrelPos);
            }
            // (the explosion resolves in the next step)
            game.step();
            if (dist >= 0 && lost < 0) lost = Math.max(0, before - me.health);
        }
        return { lost, dist, dead: me.dead, steps: bot.bot.brain.mem.fight.trace.counts.get("blast:out") ?? 0 };
    }

    it("a bot healing beside a barrel being shot walks out before it blows; the baseline stays and dies", () => {
        const aware = healBesideBarrel(withFeatures(BRAIN_PRESETS.baseline, ["blastAware"]));
        expect(aware.dead).toBe(false);
        expect(aware.steps).toBeGreaterThan(0);
        expect(aware.dist).toBeGreaterThan(10);
        expect(aware.lost).toBeLessThan(20);
        const base = healBesideBarrel(BRAIN_PRESETS.baseline);
        expect(base.steps).toBe(0);
        expect(base.dist).toBeLessThan(5);
        expect(base.dead).toBe(true);
    });
});

describe("explosive obstacles: shooting the barrel next to the target", () => {
    /** The target 25 u off with a barrel 3 u from it (healthT: what the barrel shows). */
    function shotWorld(healthT: number, barrelOff: Vec2 = { x: 23, y: 2 }, enemyOff: Vec2 = { x: 25, y: 0 }) {
        const w = screenWorld();
        const e = addEnemy(w, 2, enemyOff);
        faceTo(e, w.spot);
        addObstacle(w, barrelOff, "barrel_01");
        const barrel = last(w);
        barrel.view = { ...barrel.view, healthT };
        return { w, e, barrel };
    }

    function shotOf(
        w: TestWorld,
        features: readonly ("barrelShot" | "blastAware")[],
        difficulty: "easy" | "normal" | "hard",
    ) {
        const brain = brainOf(w, features, difficulty);
        const ctx = brain.context(NOW);
        planFight(ctx);
        return { brain, shot: barrelShotFor(ctx) };
    }

    it("a damaged barrel next to the target, the bot outside its blast: the intermediate bot shoots the barrel", () => {
        const { w, barrel } = shotWorld(0.3);
        const brain = brainOf(w, ["barrelShot"], "normal");
        const intent = brain.think(NOW, 0.1);
        expect(intent.behaviour).toBe("fight");
        expect(intent.fire).toBe(true);
        expect(intent.targetId).toBe(0);
        expect(v2.distance(intent.aim!, centre(barrel))).toBeLessThan(0.01);
        expect(brain.mem.fight.trace.last("blast")?.detail).toMatch(/^shot/);
    });

    it("only with the flag, and never for beginners", () => {
        const { w, e } = shotWorld(0.3);
        const plain = brainOf(w, [], "normal").think(NOW, 0.1);
        expect(plain.behaviour).toBe("fight");
        expect(plain.targetId).toBe(e.id);
        expect(shotOf(w, ["barrelShot"], "easy").shot).toBeNull();
        expect(shotOf(w, ["barrelShot"], "hard").shot).not.toBeNull();
    });

    it("needs the right geometry and a barrel about to break", () => {
        // full health: an mp5 needs about 1.3 s to break it, too long for an intermediate bot; an expert takes it on a
        // target standing still behind the barrel, not on one on the move
        const full = shotWorld(1);
        expect(shotOf(full.w, ["barrelShot"], "normal").shot).toBeNull();
        expect(shotOf(full.w, ["barrelShot"], "hard").shot).not.toBeNull();
        full.e.vel = { x: 0, y: 3 };
        expect(shotOf(full.w, ["barrelShot"], "hard").shot).toBeNull();
        // the target out of the blast's hard reach
        expect(shotOf(shotWorld(0.3, { x: 14, y: 8 }).w, ["barrelShot"], "normal").shot).toBeNull();
        // the bot inside the blast itself (the barrel half way, the target close to it)
        expect(shotOf(shotWorld(0.3, { x: 8, y: 1 }, { x: 11, y: 0 }).w, ["barrelShot"], "normal").shot).toBeNull();
        // a wall between the barrel and the target stops the blast
        const walled = shotWorld(0.3, { x: 21, y: 4 });
        expect(shotOf(walled.w, ["barrelShot"], "normal").shot).not.toBeNull();
        addObstacle(walled.w, { x: 23, y: 2.5 }, "tree_01");
        expect(shotOf(walled.w, ["barrelShot"], "normal").shot).toBeNull();
        // no line of fire to the barrel
        const hidden = shotWorld(0.3);
        addObstacle(hidden.w, { x: 18, y: 1.6 }, "crate_01");
        expect(shotOf(hidden.w, ["barrelShot"], "normal").shot).toBeNull();
    });
});
