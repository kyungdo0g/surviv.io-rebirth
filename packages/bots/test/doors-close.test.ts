// Doors (BrainFeatures.doors), closing behind: a bot that walks into a house through its closed front door to loot
// shuts the door behind it from inside, out of the doorway, and stays inside to loot (a cautious expert: closeChance
// near its cap); a baseline bot leaves it open; the door stays open while a teammate waits right outside (following),
// and is shut once the teammate is far; when a teammate opens it again while the bot is inside, the bot shuts it again.
// All on the real main map (seed 12345), the first unrotated red house and its south door. And in the bank, whose
// south-east room is reached from the hall only round the outside: a bot that came in by a door and loots on in the
// other wing leaves that door open (it shut it and opened it again a moment later, review of the interactions).
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, Input } from "@rebirth/defs";
import { emptyInput, type Game, type Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { FOLLOW_RADIUS } from "../src/brain/doorClose.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { underRoof } from "../src/brain/grenades.ts";
import { BotController } from "../src/controller.ts";
import { colliderBounds, obstacleDef, pointInBounds, rotateOri, transformCollider } from "../src/geom.ts";
import { doorMiddle, doorShape, inDoorway, sideOf } from "../src/nav/doorGeom.ts";
import { cachedMap, firstOfType, mainGame, placePlayer } from "./helpers.ts";

const gen = cachedMap("main", 12345);
// the first unrotated red house: main 12345's layout moved with the rebirth buildings' rework (2026-10-10) and again
// with the grown hidden rooms (PR #18, 2026-10-10), after which it is the only unrotated house_red_02 left (the third
// staged every run before)
const house = gen.objects.filter((o) => o.type === "house_red_02" && o.ori === 0)[0];
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
function lootRun(
    opts: { brain?: "smart" | "baseline"; teamMode?: 1 | 2; seed?: number; loot?: Vec2; clear?: boolean } = {},
) {
    const teamMode = opts.teamMode ?? 1;
    const game = mainGame({}, teamMode);
    if (opts.clear) clearContainers(game, house, 50);
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

/**
 * Takes the containers within `rad` of a building that are not its own (crates, an outhouse's toilets) out of the game:
 * main 12345 moved with PR #19's wave 3, and those round the house and the bank drew the bots off to break them (the
 * baseline bot never walked in, the bot that shut the door left the house for them before the teammate opened it
 * again, the bank's bot went for a new outhouse's toilets). A container the bot never sees is never one it breaks.
 */
function clearContainers(game: Game, building: { id: number; pos: Vec2 }, rad: number): void {
    for (const o of [...game.world.objects.values()]) {
        if (o.kind !== "obstacle" || o.parentId === building.id || !o.destructible || o.def.explosion) continue;
        if (o.def.loot.length > 0 && v2.distance(o.pos, building.pos) < rad) game.world.remove(o);
    }
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
        // seed 8: since the military base moved the map round the house, a shipping container and a crate east of it
        // drew most baseline bots there first (of seeds 1-12 only 3, 6 and 8 walked into the house within the 10 s);
        // at the house of PR #18's layout all twelve walk in; on PR #19's map the crates round it drew every one of
        // seeds 1-12 off, so the containers that are not the house's are cleared (lootRun clear)
        const run = lootRun({ brain: "baseline", seed: 8, clear: true });
        // under this house's roof (the container's roof next door does not count)
        const def = getMapObjectDef(house.type);
        const zones =
            def.type === "building" ? def.ceiling.zoomRegions.flatMap((r) => (r.zoomIn ? [r.zoomIn] : [])) : [];
        const rooms = zones.map((z) => colliderBounds(transformCollider(z, house.pos, house.ori, house.scale)));
        const inHouse = (p: Vec2) => underRoof(run.bot.bot.model, p) && rooms.some((b) => pointInBounds(p, b));
        let entered = false;
        let closedInside = false;
        step(run, 1000, () => {
            if (inHouse(run.p.pos)) entered = true;
            if (entered && !doorOpen(run.game) && inHouse(run.p.pos)) closedInside = true;
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
        const run = lootRun({ teamMode: 2, loot: { x: 6, y: 8 }, clear: true });
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

describe("doors: closing behind, two wings", () => {
    it("leaves the door it came in by open when the way to its next loot leads back out by it", () => {
        const bank = firstOfType(gen, "bank_01");
        // offsets in the bank's own frame, turned by its ori (they were world offsets of the bank at ori 1 until the
        // military base moved it, at ori 0, elsewhere on main 12345)
        const inBank = (local: Vec2) => v2.add(bank.pos, rotateOri(local, bank.ori));
        // the south-east room's door (the room joins the hall only round the outside), and the bank's doors
        const want = inBank({ x: 17.25, y: -13.5 });
        const se = gen.objects
            .filter((o) => o.type === "house_door_01")
            .sort((a, b) => v2.distance(a.pos, want) - v2.distance(b.pos, want))[0];
        const seShape = doorShape(se.id, obstacleDef(se.type)!, se.pos, se.ori, se.scale)!;
        const mid = doorMiddle(seShape);
        const inSide = Math.sign(sideOf(seShape, bank.pos));
        const doors = gen.objects.filter((o) => obstacleDef(o.type)?.door && v2.distance(o.pos, bank.pos) < 40);
        // seed 1 shut the door during its last pickup in the room and opened it again 0.2 s later for the vest
        // (doorClose.ts: a pickup in reach comes first)
        for (const seed of [6, 1]) {
            const game = mainGame();
            clearContainers(game, bank, 60);
            // outside the south-east door; a vest in the hall, a gun in the south-east room (puzzles off: no vault).
            // The vest lies just past the room's inner window, where the bot sees it from the room (in the west hall it
            // saw it only on its way out: the run passed on the old map because the bot walked round the bank into the
            // hall first; on the moved map nothing made the way to its next loot lead out by the door it came in by)
            const p = placePlayer(game, "bot", v2.sub(mid, v2.mul(seShape.normal, inSide * 4)));
            const bot = new BotController(game, p.id, {
                seed,
                persona: "camper",
                skill: "expert",
                brain: { ...BRAIN_PRESETS.smart, puzzles: false },
            });
            game.loot.addLoot("chest02", inBank({ x: 2, y: 0 }), 0, 1, { pushSpeed: 0 });
            game.loot.addLoot("mp5", v2.add(mid, v2.mul(seShape.normal, inSide * 3.5)), 0, 1, { pushSpeed: 0 });
            const isOpen = (id: number) => {
                const o = game.world.get(id);
                return o?.kind === "obstacle" && !!o.door?.open;
            };
            const prev = new Map(doors.map((d) => [d.id, isOpen(d.id)]));
            const shutAt = new Map<number, number>();
            const reopened: string[] = [];
            let leaves = false;
            let vest = false;
            let gun = false;
            // walked in by the south-east door first (an order to just inside it), then left to itself: on the map of
            // PR #19's wave 3 nothing drew the bot into the room on its own (the gun lies under the bank's roof)
            const inRoom = v2.add(mid, v2.mul(seShape.normal, inSide * 2));
            bot.bot.setOrder({ type: "goto", pos: inRoom, arriveDist: 0.8 });
            for (let i = 0; i < 2500; i++) {
                if (bot.bot.brain.mem.order && v2.distance(p.pos, inRoom) < 1) bot.bot.setOrder(null);
                bot.update();
                game.step();
                for (const d of doors) {
                    const open = isOpen(d.id);
                    if (prev.get(d.id) && !open) shutAt.set(d.id, game.time);
                    const at = shutAt.get(d.id);
                    if (!prev.get(d.id) && open && at !== undefined && game.time - at < 1) {
                        reopened.push(`${d.id} after ${(game.time - at).toFixed(2)} s`);
                    }
                    prev.set(d.id, open);
                }
                if (bot.bot.brain.doors?.entry?.route?.out) leaves = true;
                vest ||= p.chest === "chest02";
                gun ||= p.weaponManager.weapons[0].type === "mp5";
            }
            // no door was shut only to be opened again: the route check saw the way out by the entry door
            expect(reopened, `seed ${seed}`).toEqual([]);
            expect(leaves, `seed ${seed}`).toBe(true);
            expect(vest && gun, `seed ${seed}`).toBe(true);
            expect(bot.bot.follower.stuckEvents, `seed ${seed}`).toBe(0);
        }
    }, 60_000);
});
