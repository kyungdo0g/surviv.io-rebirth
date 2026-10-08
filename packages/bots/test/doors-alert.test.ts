// Doors (BrainFeatures.doors) as information, and its fairness: a door heard or seen opening nearby that neither the
// bot, a teammate nor an enemy on the screen accounts for puts the bot on alert (the gun comes out, the crosshair goes
// to the door after a reaction, a looting bot stops for a moment); a door found open that was closed when the bot last
// saw it draws a glance (someone passed). Only what a player perceives: a door that just streamed into the snapshot
// played no sound, one out of the sound's range and off the screen is neither heard nor seen, one only in the
// snapshot's margin is heard but its state was never seen, and an automatic door closing by itself is no news. Then
// in the simulation: a bot healing in a house turns to the door an unseen enemy opens, and does not hear one beyond
// its snapshot.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { emptyInput } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { BotController } from "../src/controller.ts";
import { addEnemy, brainOf, NOW, testWorld } from "./brain-world.ts";
import { doorFrame, seenDoor, setScreen } from "./doorWorld.ts";
import { cachedMap, firstOfType, mainGame, placePlayer } from "./helpers.ts";

const DOOR = "house_door_01";

/** A synthetic world with a door brain (the hard preset) and its screen set. */
function world() {
    const w = testWorld();
    setScreen(w);
    const brain = brainOf(w, ["doors"], "hard");
    return { w, brain, doors: brain.doors! };
}

/** A loot intent walking somewhere else (what the alert interrupts). */
function looting(w: ReturnType<typeof testWorld>) {
    const intent = emptyIntent("loot");
    intent.goal = v2.add(w.spot, { x: -6, y: 0 });
    return intent;
}

describe("doors: alert", () => {
    it("a door heard opening nearby with nobody to account for it puts the bot on alert", () => {
        const { w, brain, doors } = world();
        const at = v2.add(w.spot, { x: 10, y: 3 });
        doorFrame(w, brain, NOW, [seenDoor(1, DOOR, at, 0)]);
        expect(doors.alert).toBeNull();
        const ctx = doorFrame(w, brain, NOW + 0.1, [seenDoor(1, DOOR, at, 1, { open: true, seq: 1 })]);
        const e = doors.watch.events.at(-1)!;
        expect(e.kind).toBe("heard");
        expect(e.cause).toBe("unknown");
        expect(doors.alert?.kind).toBe("heard");
        // the gun comes out (no holstering: brain/weapons.ts)
        expect(ctx.mem.loot2.lastThreat).toBe(NOW + 0.1);
        // before the reaction nothing changes; after it the crosshair goes to the door and the looting stops a moment
        const early = looting(w);
        doors.apply(brain.context(NOW + 0.12), early);
        expect(early.lookAt).toBeUndefined();
        const t1 = doors.alert!.start + 0.05;
        const look = looting(w);
        doors.apply(brain.context(t1), look);
        expect(look.lookAt).toEqual(doors.alert!.pos);
        expect(look.stop).toBe(true);
        expect(look.goal).toBeNull();
        // the pause ends, the look stays a while, then it is over
        const later = looting(w);
        doors.apply(brain.context(doors.alert!.pauseUntil + 0.1), later);
        expect(later.lookAt).toEqual(doors.alert!.pos);
        expect(later.stop).toBe(false);
        const until = doors.alert!.until;
        const done = looting(w);
        doors.apply(brain.context(until + 0.1), done);
        expect(done.lookAt).toBeUndefined();
        expect(doors.alert).toBeNull();
    });

    it("its own Use, a teammate or an enemy on the screen next to the door is no alarm", () => {
        // the bot itself pressed Use next to the door
        {
            const { w, brain, doors } = world();
            const at = v2.add(w.spot, { x: 1.6, y: -2 });
            doorFrame(w, brain, NOW, [seenDoor(1, DOOR, at, 0)]);
            doors.noteUse(NOW + 0.05);
            doorFrame(w, brain, NOW + 0.1, [seenDoor(1, DOOR, at, 1, { open: true, seq: 1 })]);
            expect(doors.watch.events.at(-1)?.cause).toBe("self");
            expect(doors.alert).toBeNull();
        }
        // a teammate (the team UI's position) stands at it
        {
            const { w, brain, doors } = world();
            const at = v2.add(w.spot, { x: 10, y: 3 });
            w.model.team = [
                {
                    playerId: 2,
                    name: "m",
                    health: 100,
                    downed: false,
                    dead: false,
                    disconnected: false,
                    pos: v2.add(at, { x: 1.5, y: 2 }),
                },
            ];
            doorFrame(w, brain, NOW, [seenDoor(1, DOOR, at, 0)]);
            doorFrame(w, brain, NOW + 0.1, [seenDoor(1, DOOR, at, 1, { open: true, seq: 1 })]);
            expect(doors.watch.events.at(-1)?.cause).toBe("team");
            expect(doors.alert).toBeNull();
        }
        // an enemy on the screen opened it: the fight has its own aim, no glance over it
        {
            const { w, brain, doors } = world();
            const at = v2.add(w.spot, { x: 10, y: 3 });
            addEnemy(w, 3, { x: 11.5, y: 5 });
            doorFrame(w, brain, NOW, [seenDoor(1, DOOR, at, 0)]);
            doorFrame(w, brain, NOW + 0.1, [seenDoor(1, DOOR, at, 1, { open: true, seq: 1 })]);
            expect(doors.watch.events.at(-1)?.cause).toBe("enemy");
            const intent = looting(w);
            doors.apply(brain.context(doors.alert!.start + 0.05), intent);
            expect(intent.lookAt).toBeUndefined();
        }
    });

    it("is fair: no sound from a door just streamed in, nothing from one beyond hearing and off the screen", () => {
        const { w, brain, doors } = world();
        const near = v2.add(w.spot, { x: 10, y: 3 });
        // streamed in already open: the client plays no sound for it, and the bot never saw it closed
        doorFrame(w, brain, NOW, []);
        doorFrame(w, brain, NOW + 0.1, [seenDoor(1, DOOR, near, 1, { open: true, seq: 1 })]);
        expect(doors.watch.events.length).toBe(0);
        // 60 units off (the sound carries 48) and off the 16:9 screen: a change there is neither heard nor seen
        const far = v2.add(w.spot, { x: 60, y: 0 });
        doorFrame(w, brain, NOW + 0.2, [seenDoor(2, DOOR, far, 0)]);
        doorFrame(w, brain, NOW + 0.3, [seenDoor(2, DOOR, far, 1, { open: true, seq: 1 })]);
        expect(doors.watch.events.length).toBe(0);
        expect(doors.alert).toBeNull();
        // 40 units off: off the screen, but within the sound's range: heard
        const side = v2.add(w.spot, { x: 40, y: 0 });
        expect(w.model.onScreen(side)).toBe(false);
        doorFrame(w, brain, NOW + 0.4, [seenDoor(3, DOOR, side, 0)]);
        doorFrame(w, brain, NOW + 0.5, [seenDoor(3, DOOR, side, 1, { open: true, seq: 1 })]);
        expect(doors.watch.events.at(-1)?.kind).toBe("heard");
    });

    it("a door found open that was closed when last seen means someone passed: a glance, no stop", () => {
        const { w, brain, doors } = world();
        const at = v2.add(w.spot, { x: 10, y: 3 });
        doorFrame(w, brain, NOW, [seenDoor(1, DOOR, at, 0)]);
        // out of the snapshot for a while (the bot looked elsewhere), then back in view: open
        doorFrame(w, brain, NOW + 0.1, []);
        doorFrame(w, brain, NOW + 5, []);
        doorFrame(w, brain, NOW + 5.1, [seenDoor(1, DOOR, at, 1, { open: true, seq: 1 })]);
        const e = doors.watch.events.at(-1)!;
        expect(e.kind).toBe("passed");
        expect(doors.alert?.kind).toBe("passed");
        const intent = looting(w);
        doors.apply(brain.context(doors.alert!.start + 0.05), intent);
        expect(intent.lookAt).toEqual(doors.alert!.pos);
        expect(intent.stop).toBe(false);
        // a door it never saw (only in the snapshot's margin) tells nothing when it shows up open
        const { w: w2, brain: b2, doors: d2 } = world();
        const margin = v2.add(w2.spot, { x: 30, y: 0 });
        expect(w2.model.onScreen(margin, 0.5)).toBe(false);
        doorFrame(w2, b2, NOW, [seenDoor(5, DOOR, margin, 0)]);
        doorFrame(w2, b2, NOW + 0.1, []);
        w2.model.self.pos = v2.add(w2.spot, { x: 10, y: 0 });
        setScreen(w2);
        doorFrame(w2, b2, NOW + 3, [seenDoor(5, DOOR, margin, 1, { open: true, seq: 1 })]);
        expect(d2.watch.events.length).toBe(0);
    });

    it("an automatic door closing by itself is no news", () => {
        const { w, brain, doors } = world();
        const at = v2.add(w.spot, { x: 10, y: 3 });
        const slide = (open: boolean) =>
            seenDoor(1, "lab_door_01", open ? v2.add(at, { x: 0, y: -3.75 }) : at, 0, { open, seq: 1 });
        doorFrame(w, brain, NOW, [slide(true)]);
        doorFrame(w, brain, NOW + 1.1, [slide(false)]);
        expect(doors.watch.events.length).toBe(0);
        expect(doors.alert).toBeNull();
    });
});

describe("doors: alert in the simulation", () => {
    const gen = cachedMap("main", 12345);
    const house = firstOfType(gen, "house_red_02", 0);
    // the north door (ori 3): its panel runs along +x from its position, the house lies to the south
    const north = gen.objects.find((o) => o.parentId === house.id && o.type === "house_door_01" && o.ori === 3)!;
    const middle = v2.add(north.pos, { x: 2, y: 0 });

    /** A bot healing in the house `dy` south of the north door; an enemy outside opens the door at tick 150. */
    function run(dy: number) {
        const game = mainGame();
        const a = placePlayer(game, "a", v2.add(middle, { x: 0, y: dy }));
        a.health = 40;
        a.inv.set("bandage", 5);
        const c = placePlayer(game, "c", v2.add(middle, { x: 0, y: -2 }));
        const bot = new BotController(game, a.id, { seed: 1, persona: "camper", skill: "expert" });
        let look: Vec2 | undefined;
        let seen = false;
        let opened = false;
        for (let i = 0; i < 300; i++) {
            game.setInput(c.id, { ...emptyInput(i & 0xff), actions: i === 150 ? [Input.Use] : [] });
            bot.update();
            game.step();
            const d = game.world.get(north.id);
            if (d?.kind === "obstacle" && d.door?.open) opened = true;
            if (bot.bot.model.contacts.get(c.id)?.visible) seen = true;
            if (i > 150 && !look && bot.bot.intent.lookAt) look = v2.copy(bot.bot.intent.lookAt);
        }
        return { look, seen, opened, alert: bot.bot.brain.doors?.alert ?? null };
    }

    it("a bot healing inside turns to the door an unseen enemy opens", () => {
        // the door 17.5 units north: in the snapshot (and the sound's range) but off the screen; the enemy beyond
        const r = run(17.5);
        expect(r.opened).toBe(true);
        expect(r.seen).toBe(false);
        expect(r.look).toBeDefined();
        expect(v2.distance(r.look!, middle)).toBeLessThan(4);
    });

    it("does not hear a door beyond its snapshot", () => {
        // 22 units north: outside the snapshot's area at this zoom (sim game.ts viewBounds): no sound reaches the client
        const r = run(22);
        expect(r.opened).toBe(true);
        expect(r.look === undefined || v2.distance(r.look, middle) > 4).toBe(true);
    });
});
