// Doors (BrainFeatures.doors), closing behind: a bot that walks into a house through its closed front door to loot
// shuts the door behind it from inside, out of the doorway, and stays inside to loot (a cautious expert: closeChance
// near its cap); a baseline bot leaves it open; the door stays open while a teammate waits right outside (following),
// and is shut once the teammate is far; when a teammate opens it again while the bot is inside, the bot shuts it again.
// All on the real main map (seed 12345), the first unrotated red house and its south door.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { emptyInput, type Game, type Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { FOLLOW_RADIUS } from "../src/brain/doorClose.ts";
import { underRoof } from "../src/brain/grenades.ts";
import { BotController } from "../src/controller.ts";
import { obstacleDef } from "../src/geom.ts";
import { doorShape, inDoorway, sideOf } from "../src/nav/doorGeom.ts";
import { cachedMap, firstOfType, mainGame, placePlayer } from "./helpers.ts";

const gen = cachedMap("main", 12345);
const house = firstOfType(gen, "house_red_02", 0);
// the south front door (the house's two exterior doors turn a quarter: ori 1 south, ori 3 north)
const front = gen.objects.find((o) => o.parentId === house.id && o.type === "house_door_01" && o.ori === 1)!;
const shape = doorShape(front.id, obstacleDef(front.type)!, front.pos, front.ori, front.scale)!;
const insideSide = Math.sign(sideOf(shape, house.pos));
const outsideStart = { x: front.pos.x - 2, y: front.pos.y + 5 };

function doorOpen(game: Game): boolean {
    const o = game.world.get(front.id);
    return o?.kind === "obstacle" && !!o.door?.open;
}

/**
 * A house-looting run: a bot outside the front door, an mp5 inside at `loot` from the house's centre (`teamMode` 2: with
 * a teammate `mate` spawned far away).
 */
function lootRun(opts: { brain?: "smart" | "baseline"; teamMode?: 1 | 2; seed?: number; loot?: Vec2 } = {}) {
    const teamMode = opts.teamMode ?? 1;
    const game = mainGame({}, teamMode);
    const party = teamMode === 2 ? { group: "p", autoFill: false, partySize: 2 } : undefined;
    const p = placePlayer(game, "bot", outsideStart, party);
    const mate = teamMode === 2 ? placePlayer(game, "mate", v2.add(outsideStart, { x: 0, y: 80 }), party) : null;
    const bot = new BotController(game, p.id, {
        seed: opts.seed ?? 1,
        persona: "camper",
        skill: "expert",
        brain: opts.brain ?? "smart",
    });
    game.loot.addLoot("mp5", v2.add(house.pos, opts.loot ?? { x: 2, y: 6 }), 0, 1, { pushSpeed: 0 });
    return { game, p, bot, mate };
}

/** Steps a run; `each` sees every tick. */
function step(run: ReturnType<typeof lootRun>, ticks: number, each: (i: number) => void): void {
    for (let i = 0; i < ticks; i++) {
        run.bot.update();
        run.game.step();
        each(i);
    }
}

describe("doors: closing behind", () => {
    it("shuts the front door behind it from inside, out of the doorway, and loots on", () => {
        const run = lootRun();
        let entered = false;
        let wasOpen = false;
        let closedAt: Vec2 | null = null;
        let insideWhenClosed = false;
        let gotGun = -1;
        step(run, 1000, (i) => {
            const open = doorOpen(run.game);
            if (underRoof(run.bot.bot.model, run.p.pos)) entered = true;
            if (open) wasOpen = true;
            if (entered && wasOpen && !open && !closedAt) {
                closedAt = v2.copy(run.p.pos);
                insideWhenClosed = underRoof(run.bot.bot.model, run.p.pos);
            }
            if (gotGun < 0 && run.p.weaponManager.weapons[0].type === "mp5") gotGun = i;
        });
        expect(closedAt).not.toBeNull();
        expect(insideWhenClosed).toBe(true);
        // pressed from inside, not standing in the doorway the leaf closes into
        expect(Math.sign(sideOf(shape, closedAt!))).toBe(insideSide);
        expect(inDoorway(shape, closedAt!)).toBe(false);
        expect(run.bot.bot.brain.doors?.closes).toBeGreaterThanOrEqual(1);
        // and it went on looting inside (the gun picked up, the door still shut)
        expect(gotGun).toBeGreaterThan(0);
        expect(doorOpen(run.game)).toBe(false);
        expect(run.bot.bot.follower.stuckEvents).toBe(0);
    });

    it("the baseline brain leaves the door open behind it", () => {
        const run = lootRun({ brain: "baseline" });
        let entered = false;
        let closedInside = false;
        step(run, 1000, () => {
            if (underRoof(run.bot.bot.model, run.p.pos)) entered = true;
            if (entered && !doorOpen(run.game) && underRoof(run.bot.bot.model, run.p.pos)) closedInside = true;
        });
        expect(entered).toBe(true);
        expect(closedInside).toBe(false);
        expect(run.bot.bot.brain.doors).toBeNull();
    });

    it("does not shut the door on a teammate following it in, and shuts it with nobody behind", () => {
        // the teammate waits right outside the door
        const near = lootRun({ teamMode: 2 });
        near.game.teleportPlayer(near.mate!.id, v2.add(outsideStart, { x: 0, y: 1 }));
        let wanted = false;
        let shut = false;
        step(near, 1000, () => {
            if (near.bot.bot.brain.doors?.entry?.wants) wanted = true;
            if (wanted && !doorOpen(near.game)) shut = true;
        });
        expect(v2.distance(near.mate!.pos, shape.pos)).toBeLessThan(FOLLOW_RADIUS);
        expect(wanted).toBe(true);
        expect(shut).toBe(false);
        // the same bot with its teammate far away
        const far = lootRun({ teamMode: 2 });
        let closed = false;
        step(far, 1000, () => {
            if (far.bot.bot.brain.doors?.entry && !doorOpen(far.game)) closed = true;
        });
        expect(closed).toBe(true);
    });

    it("shuts it again when a teammate opens it while the bot is inside", () => {
        // (the gun lies near the door: the bot is still close by when the door opens again)
        const run = lootRun({ teamMode: 2, loot: { x: 6, y: 8 } });
        const mate = run.mate as Player;
        let openAt = Number.POSITIVE_INFINITY;
        let reopened = false;
        let reclosed = false;
        step(run, 1500, (i) => {
            const closes = run.bot.bot.brain.doors?.closes ?? 0;
            if (closes >= 1 && openAt === Number.POSITIVE_INFINITY) openAt = i + 60;
            // the teammate steps up to the door, opens it and walks off
            if (i === openAt) run.game.teleportPlayer(mate.id, { x: front.pos.x - 2, y: front.pos.y + 1.8 });
            if (i === openAt + 30) run.game.teleportPlayer(mate.id, v2.add(outsideStart, { x: 0, y: 80 }));
            run.game.setInput(mate.id, { ...emptyInput(i & 0xff), actions: i === openAt + 2 ? [Input.Use] : [] });
            if (i > openAt + 2 && doorOpen(run.game)) reopened = true;
            if (reopened && !doorOpen(run.game) && underRoof(run.bot.bot.model, run.p.pos)) reclosed = true;
        });
        expect(reopened).toBe(true);
        expect(reclosed).toBe(true);
        expect(run.bot.bot.brain.doors?.closes).toBeGreaterThanOrEqual(2);
    });
});
