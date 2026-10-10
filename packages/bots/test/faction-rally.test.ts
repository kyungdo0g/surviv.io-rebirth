// Owner report 2026-10-08 (50v50): the faction's bots stood in the river, and most players should go to the Commander
// except some. On the synthetic faction world (faction-world.ts: a straight river 40 u east of the bot): the water as
// wide as the terrain makes it, bank, crossing and formation spots out of it, no bot idling in it, the rally to the
// Commander (slots around it, spacing, the minority that keeps to itself, a knocked Commander, its flare's drop), the
// Commander leading, errands kept on the own bank; and a short faction match (scripts/factionRallyLib.ts's probe).
import { type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { RiverRallyProbe } from "../scripts/factionRallyLib.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { FACTION_TUNING } from "../src/brain/factionCtx.ts";
import { objective } from "../src/brain/factionFront.ts";
import {
    commanderOf,
    commanderWaits,
    independent,
    rallyCommander,
    rallyPoint,
    rallySlot,
} from "../src/brain/factionRally.ts";
import { factionDowned } from "../src/brain/factionRevive.ts";
import { keepDry, keepErrandsHome } from "../src/brain/factionRiver.ts";
import {
    advanceScore,
    followTarget,
    formationSlot,
    guardCrossing,
    planAdvance,
    rallyScore,
} from "../src/brain/factionSquad.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { type FactionMap, factionMapOf, inRiver, nearestRiverPoint, riverSide } from "../src/perception/factionMap.ts";
import { PERSONA_MIX, PERSONAS, type PersonaName } from "../src/persona.ts";
import { runMatch } from "../src/runner.ts";
import { addEnemy, brainOf, ctxOf, giveGun, NOW } from "./brain-world.ts";
import { FACTION_MAP, factionWorld, kit, RIVER_WIDTH, RIVER_X, SPOT } from "./faction-world.ts";

const found = factionMapOf(FACTION_MAP);
if (!found) throw new Error("no faction geography");
const geo: FactionMap = found;
/** The bot at `x` u east of SPOT (the river's centre line is at +40). */
const east = (x: number, y = 0): Vec2 => v2.add(SPOT, { x, y });

describe("the river as wide as it is", () => {
    it("water and riverbank half widths come from the terrain: `width` each side in the middle, wider at the ends", () => {
        const mid = Math.floor(geo.water.length / 2);
        expect(geo.halfWidth).toBe(RIVER_WIDTH);
        expect(geo.water[mid]).toBeCloseTo(RIVER_WIDTH, 0);
        expect(Math.max(...geo.water)).toBeGreaterThan(2 * RIVER_WIDTH);
        expect(geo.bank[mid] - geo.water[mid]).toBeGreaterThan(4);
        // the navigation grid's water (the sim's own polygons) agrees with the half width at the bot's latitude
        const w = factionWorld();
        const { water } = nearestRiverPoint(geo, SPOT);
        expect(w.model.nav.isWaterAt(east(40 - water + 2))).toBe(true);
        expect(w.model.nav.isWaterAt(east(40 - water - 2))).toBe(false);
        expect(inRiver(geo, east(40 - water + 2))).toBe(true);
        expect(inRiver(geo, east(40 - water - 2))).toBe(false);
        expect(w.fi.ownBank(east(40 - water + 2))).toBe(false);
    });
});

/** Out of the water: on a dry cell, on the faction's own (left, negative x) bank past the water. */
function dryOwnBank(w: ReturnType<typeof factionWorld>, p: Vec2 | null | undefined): void {
    expect(p).toBeTruthy();
    if (!p) return;
    expect(w.model.nav.isWaterAt(p)).toBe(false);
    expect(riverSide(geo, p)).toBeGreaterThan(nearestRiverPoint(geo, p).water);
    expect(p.x).toBeLessThan(RIVER_X);
}

describe("bank spots out of the water", () => {
    it("with no enemy known every role holds past the riverbank, the Recon too", () => {
        for (const role of ["", "recon", "leader", "marksman"]) {
            const w = factionWorld({ role });
            giveGun(w, 0, "ak47", 30, 120);
            const obj = objective(ctxOf(w, ["faction"]), SPOT);
            dryOwnBank(w, obj?.pos);
            expect(riverSide(geo, obj?.pos ?? SPOT)).toBeGreaterThan(nearestRiverPoint(geo, SPOT).bank);
        }
    });

    it("facing enemies over the river the hold stays on its own bank; a push onto enemies in the water stops at it", () => {
        const w = factionWorld();
        giveGun(w, 0, "ak47", 30, 120);
        // an enemy on the far bank's edge: rifle range from it would be in the water
        w.fi.squadBoard?.see(30, east(64, 0), NOW, false, 1);
        const hold = objective(ctxOf(w, ["faction"]), SPOT);
        expect(hold?.push || hold?.fallback).toBe(false);
        dryOwnBank(w, hold?.pos);
        const strong = factionWorld({
            mates: [
                { x: -4, y: 3 },
                { x: -4, y: -3 },
                { x: -8, y: 0 },
            ],
        });
        giveGun(strong, 0, "ak47", 30, 120);
        strong.fi.squadBoard?.see(30, east(25, 0), NOW, false, 10);
        const push = objective(ctxOf(strong, ["faction"]), SPOT);
        expect(push?.push).toBe(true);
        dryOwnBank(strong, push?.pos);
        // ...still closer than the contact hold (24 u)
        expect(v2.distance(push?.pos ?? SPOT, east(25, 0))).toBeLessThan(24);
    });

    it("a bot held back by the no-solo-crossing rule waits past the riverbank, not in the water", () => {
        const w = factionWorld();
        addEnemy(w, 30, { x: 75, y: 3 });
        addEnemy(w, 31, { x: 78, y: -4 });
        const intent = emptyIntent("explore");
        intent.goal = east(80);
        guardCrossing(ctxOf(w, ["faction"]), intent);
        dryOwnBank(w, intent.goal);
    });

    it("formation slots by a leader at the water's edge are dry", () => {
        const w = factionWorld({ mates: [{ x: 16, y: 0 }] });
        w.model.selfId = 12;
        w.model.self.id = 12;
        w.model.team = [
            { ...w.model.team[1], playerId: 10 },
            { ...w.model.team[0], playerId: 12 },
        ];
        w.model.teammates.clear();
        w.model.teammates.add(10);
        const ctx = ctxOf(w, ["faction"]);
        const { water } = nearestRiverPoint(geo, SPOT);
        const leaderAt = east(40 - water - 1);
        const slot = formationSlot(ctx, 10, leaderAt);
        expect(w.model.nav.isWaterAt(slot)).toBe(false);
    });
});

describe("no idling in the water", () => {
    it("a bot in the water that would stand still walks out onto its own bank; moving through is left alone", () => {
        const { water } = nearestRiverPoint(geo, SPOT);
        const at = east(40 - water / 2);
        const w = factionWorld();
        w.model.self.pos = v2.copy(at);
        expect(w.model.nav.isWaterAt(at)).toBe(true);
        for (const behaviour of ["explore", "rally", "advance", "heal", "fight"] as const) {
            const intent = emptyIntent(behaviour);
            intent.stop = true;
            keepDry(ctxOf(w, ["faction"]), intent);
            expect(intent.stop).toBe(false);
            dryOwnBank(w, intent.goal);
        }
        // a goal in the water a few steps off moves onto the bank
        const near = emptyIntent("advance");
        near.goal = east(40 - water / 2 + 2, 3);
        keepDry(ctxOf(w, ["faction"]), near);
        expect(w.model.nav.isWaterAt(near.goal ?? at)).toBe(false);
        // crossing on (a goal on the far bank), fleeing and kneeling stay as they are
        const cross = emptyIntent("advance");
        cross.goal = east(80);
        keepDry(ctxOf(w, ["faction"]), cross);
        expect(cross.goal).toEqual(east(80));
        const flee = emptyIntent("flee");
        flee.stop = true;
        keepDry(ctxOf(w, ["faction"]), flee);
        expect(flee.goal).toBeNull();
        // off the flag: as before
        FACTION_TUNING.dry = false;
        const off = emptyIntent("explore");
        off.stop = true;
        keepDry(ctxOf(w, ["faction"]), off);
        FACTION_TUNING.dry = true;
        expect(off.goal).toBeNull();
    });

    it("the whole brain: a bot healing in the river walks out while it bandages (the smart preset, faction on)", () => {
        const { water } = nearestRiverPoint(geo, SPOT);
        const at = east(40 - water / 2);
        const w = factionWorld();
        kit(w);
        w.model.self.pos = v2.copy(at);
        w.model.self.health = 40;
        const intent = brainOf(w, BRAIN_PRESETS.smart).think(NOW, 0.1);
        expect(intent.behaviour).toBe("heal");
        expect(intent.useItem).toBe("bandage");
        expect(intent.stop).toBe(false);
        dryOwnBank(w, intent.goal);
        expect(v2.distance(intent.goal ?? at, at)).toBeLessThan(30);
        // the same bot on its bank heals where it stands
        const dry = factionWorld();
        kit(dry);
        dry.model.self.health = 40;
        const still = brainOf(dry, BRAIN_PRESETS.smart).think(NOW, 0.1);
        expect(still.behaviour).toBe("heal");
        expect(still.goal).toBeNull();
    });

    it("no errand takes a bot from its own bank over the river; fights, the zone and a Recon still cross", () => {
        const errand = (behaviour: "loot" | "explore" | "sweep" | "fight" | "zone", role = "", at = SPOT) => {
            const w = factionWorld({ role });
            w.model.self.pos = v2.copy(at);
            const intent = emptyIntent(behaviour);
            intent.goal = east(80);
            const ctx = ctxOf(w, ["faction"]);
            ctx.mem.lootTarget = 77;
            keepErrandsHome(ctx, intent);
            return { w, intent, ctx };
        };
        for (const behaviour of ["loot", "explore", "sweep"] as const) {
            const { w, intent } = errand(behaviour);
            dryOwnBank(w, intent.goal);
            // across from the errand, by the river
            expect(Math.abs((intent.goal?.y ?? 0) - SPOT.y)).toBeLessThan(15);
        }
        // loot over the river is left alone for a while
        const loot = errand("loot");
        expect(loot.ctx.mem.lootBlacklist.get(77)).toBeGreaterThan(NOW + 30);
        expect(errand("fight").intent.goal).toEqual(east(80));
        expect(errand("zone").intent.goal).toEqual(east(80));
        expect(errand("loot", "recon").intent.goal).toEqual(east(80));
        // from the river's own half too (the Commander looting at the water's edge), but a bot already over the river
        // goes about its errands there
        const { water } = nearestRiverPoint(geo, SPOT);
        const wading = errand("loot", "", east(40 - water / 2));
        dryOwnBank(wading.w, wading.intent.goal);
        expect(errand("loot", "", east(75)).intent.goal).toEqual(east(80));
        // off the flag: as before
        FACTION_TUNING.dry = false;
        const off = errand("loot").intent.goal;
        FACTION_TUNING.dry = true;
        expect(off).toEqual(east(80));
    });

    it("an air strike's exit in the water moves onto dry ground out of the strike", () => {
        const { water } = nearestRiverPoint(geo, SPOT);
        const w = factionWorld();
        const intent = emptyIntent("evacuate");
        intent.goal = east(40 - water + 3);
        keepDry(ctxOf(w, ["faction"]), intent);
        dryOwnBank(w, intent.goal);
        expect(v2.distance(intent.goal ?? SPOT, east(40 - water + 3))).toBeLessThan(10);
    });

    it("out of the far half of the river it takes the nearer bank, its own when enemies are known over there", () => {
        const { water } = nearestRiverPoint(geo, SPOT);
        const at = east(40 + water / 2);
        const quiet = factionWorld();
        quiet.model.self.pos = v2.copy(at);
        const a = emptyIntent("explore");
        a.stop = true;
        keepDry(ctxOf(quiet, ["faction"]), a);
        expect(a.goal?.x ?? 0).toBeGreaterThan(RIVER_X + water);
        const watched = factionWorld();
        watched.model.self.pos = v2.copy(at);
        addEnemy(watched, 30, { x: 40 + water + 15, y: 0 });
        const b = emptyIntent("explore");
        b.stop = true;
        keepDry(ctxOf(watched, ["faction"]), b);
        dryOwnBank(watched, b.goal);
    });
});

/** A faction world with a Commander (row 20) `off` from the bot, the bot's persona and role. */
function withCommander(
    off: Vec2,
    opts: { persona?: PersonaName; role?: string; downed?: boolean; id?: number; armed?: boolean; more?: Vec2[] } = {},
) {
    const w = factionWorld({
        role: opts.role,
        allies: [
            { off, role: "leader", downed: opts.downed },
            { off: { x: 20, y: 50 } },
            { off: { x: 20, y: -50 } },
            ...(opts.more ?? []).map((o) => ({ off: o })),
        ],
    });
    if (opts.id !== undefined) {
        w.model.selfId = opts.id;
        w.model.self.id = opts.id;
        w.model.team[0] = { ...w.model.team[0], playerId: opts.id };
    }
    if (opts.armed !== false) kit(w);
    const persona = PERSONAS[opts.persona ?? "neutral"];
    return { w, ctx: () => ctxOf(w, ["faction"], "normal", { persona }) };
}

/** An id whose draw rallies (or keeps to itself) for `persona`. */
function idFor(persona: PersonaName, rallies: boolean): number {
    for (let id = 2; id < 5000; id++) {
        if (id === 20) continue;
        const { ctx } = withCommander({ x: -60, y: 0 }, { persona, id });
        if (independent(ctx()) !== rallies) return id;
    }
    throw new Error("no id");
}

describe("rally to the Commander", () => {
    it("most bots follow the Commander, from far off in a hurry; unarmed ones arm first", () => {
        const id = idFor("neutral", true);
        const { ctx } = withCommander({ x: -100, y: 0 }, { id });
        const c = ctx();
        expect(commanderOf(c)?.id).toBe(20);
        expect(rallyCommander(c)?.id).toBe(20);
        expect(followTarget(c)?.id).toBe(20);
        expect(rallyScore(c)).toBeGreaterThan(0.6);
        // a squad leader that rallies does not take its squad to the front on its own any more
        expect(advanceScore(c)).toBe(0);
        const unarmed = withCommander({ x: -100, y: 0 }, { id, armed: false });
        unarmed.w.model.self.weapons[0] = { type: "", ammo: 0 };
        expect(rallyScore(unarmed.ctx())).toBe(0);
        // without the flag: the squads as before
        FACTION_TUNING.rally = false;
        expect(followTarget(ctx())).toBeNull();
        FACTION_TUNING.rally = true;
    });

    it("around the Commander the bots take spaced slots of a loose group, on its bank, out of the water", () => {
        const cmdAt = east(-20, 0);
        const slots: Vec2[] = [];
        // a faction of 50 on the minimap: the Commander (20), two allies (21, 22) and members 23..69
        const members = Array.from({ length: 47 }, (_, i) => ({ x: -200, y: -100 + i * 4 }));
        for (let id = 21; id < 70; id++) {
            const { w, ctx } = withCommander({ x: -20, y: 0 }, { id, more: members });
            const c = ctx();
            const cmd = commanderOf(c);
            if (!cmd) throw new Error("no Commander");
            const slot = rallySlot(c, cmd, cmd.at);
            slots.push(slot);
            expect(v2.distance(slot, cmdAt)).toBeLessThan(30);
            expect(v2.distance(slot, cmdAt)).toBeGreaterThan(4);
            expect(w.model.nav.isWaterAt(slot)).toBe(false);
            expect(riverSide(geo, slot)).toBeGreaterThan(nearestRiverPoint(geo, slot).water);
        }
        // spaced: no two of the first ring's slots share a spot, and most slots have nobody within 3 u
        let crowded = 0;
        for (let i = 0; i < slots.length; i++) {
            let near = 0;
            for (let j = 0; j < slots.length; j++) if (i !== j && v2.distance(slots[i], slots[j]) < 3) near++;
            if (near > 0) crowded++;
        }
        expect(crowded).toBeLessThan(slots.length * 0.25);
    });

    it("near the Commander a bot walks to its slot and holds it (above exploring), looting what is near beats it", () => {
        const id = idFor("neutral", true);
        const probe = withCommander({ x: -20, y: 0 }, { id });
        const c = probe.ctx();
        const cmd = commanderOf(c);
        if (!cmd) throw new Error("no Commander");
        const slot = rallySlot(c, cmd, cmd.at);
        probe.w.model.self.pos = v2.copy(slot);
        const at = probe.ctx();
        const s = rallyScore(at);
        expect(s).toBeGreaterThan(0.12);
        expect(s).toBeLessThan(0.2);
        // a few steps off its slot it walks back: above exploring with its hysteresis (0.2), below looting (0.22)
        probe.w.model.self.pos = v2.add(slot, { x: 0, y: 8 });
        const off = rallyScore(probe.ctx());
        expect(off).toBeGreaterThan(0.2);
        expect(off).toBeLessThan(0.22);
    });

    it("a minority keeps to itself: most rats, many campers and looters, about a quarter in all; Recons scout", () => {
        const share = (persona: PersonaName) => {
            let n = 0;
            for (let id = 100; id < 1100; id++) {
                const { ctx } = withCommander({ x: -60, y: 0 }, { persona, id });
                if (independent(ctx())) n++;
            }
            return n / 1000;
        };
        const by = Object.fromEntries(
            (["neutral", ...Object.keys(PERSONA_MIX)] as PersonaName[]).map((p) => [p, share(p)]),
        ) as Record<PersonaName, number>;
        expect(by.rat).toBeGreaterThan(0.7);
        expect(by.camper).toBeGreaterThan(0.5);
        expect(by.rusher).toBeLessThan(0.15);
        expect(by.neutral).toBeGreaterThan(0.2);
        expect(by.neutral).toBeLessThan(0.3);
        let mix = 0;
        let total = 0;
        for (const [p, wgt] of Object.entries(PERSONA_MIX)) {
            mix += wgt * by[p as PersonaName];
            total += wgt;
        }
        expect(mix / total).toBeGreaterThan(0.2);
        expect(mix / total).toBeLessThan(0.3);
        // a bot on its own follows no Commander and leads itself to the front...
        const id = idFor("rat", false);
        const own = withCommander({ x: -60, y: 0 }, { persona: "rat", id });
        const c = own.ctx();
        expect(rallyCommander(c)).toBeNull();
        expect(followTarget(c)).toBeNull();
        expect(advanceScore(c)).toBeGreaterThan(0);
        // ...or follows a squadmate that keeps to itself too (they tell their squad), never one that rallies
        const pair = withCommander({ x: -60, y: 0 }, { persona: "rat", id });
        // (squadmate 1: below every id idFor gives)
        pair.w.model.team.push({ ...pair.w.model.team[0], playerId: 1, pos: east(-10, 4) });
        pair.w.model.teammates.add(1);
        const sb = pair.w.fi.squadBoard;
        sb?.rallies.set(1, true);
        expect(followTarget(pair.ctx())).toBeNull();
        sb?.rallies.set(1, false);
        expect(followTarget(pair.ctx())?.id).toBe(1);
        expect(advanceScore(pair.ctx())).toBe(0);
        expect(sb?.rallies.get(id)).toBe(false);
        // roles: a Recon scouts, Medics and Buglers rally
        expect(independent(withCommander({ x: -60, y: 0 }, { role: "recon", id: idFor("neutral", true) }).ctx())).toBe(
            true,
        );
        expect(independent(withCommander({ x: -60, y: 0 }, { role: "medic", id }).ctx())).toBe(false);
    });

    it("a knocked Commander: the group closes in around it and two of the nearest go to revive it", () => {
        const id = idFor("neutral", true);
        const { w, ctx } = withCommander({ x: -50, y: 0 }, { id, downed: true });
        const c = ctx();
        const cmd = commanderOf(c);
        expect(cmd?.downed).toBe(true);
        expect(rallyScore(c)).toBeGreaterThan(0.55);
        if (!cmd) return;
        expect(v2.distance(rallySlot(c, cmd, cmd.at), cmd.at)).toBeLessThan(13);
        // 50 u off: a faction member outside the squad is beyond the usual 35 u, the Commander is not
        expect(factionDowned(c)?.playerId).toBe(20);
        expect(w.fi.downedAllies().map((r) => r.playerId)).toEqual([20]);
        // one ally clearly closer to it: the bot is the second reviver; two closer: it stays in the group
        const one = withCommander({ x: -50, y: 0 }, { id, downed: true, more: [{ x: -46, y: 2 }] });
        expect(factionDowned(one.ctx())?.playerId).toBe(20);
        const two = withCommander(
            { x: -50, y: 0 },
            {
                id,
                downed: true,
                more: [
                    { x: -46, y: 2 },
                    { x: -47, y: -3 },
                ],
            },
        );
        expect(factionDowned(two.ctx())).toBeUndefined();
    });

    it("the Commander's flare drop near it is where the group forms until it is opened", () => {
        const id = idFor("neutral", true);
        const { w, ctx } = withCommander({ x: -30, y: 0 }, { id });
        const dropAt = east(-30, 25);
        const drops = w.model.airdrops.known() as Array<{
            pos: Vec2;
            stage: string;
            since: number;
            lastSeen: number;
            obstacleId: number;
            landsAt: number;
            innerId: number;
        }>;
        drops.push({
            pos: dropAt,
            stage: "falling",
            since: NOW - 3,
            lastSeen: NOW,
            obstacleId: 0,
            landsAt: NOW + 5,
            innerId: 0,
        });
        const c = ctx();
        const cmd = commanderOf(c);
        if (!cmd) throw new Error("no Commander");
        expect(rallyPoint(c, cmd)).toEqual(dropAt);
        expect(followTarget(c)?.at).toEqual(dropAt);
        drops[0].stage = "opened";
        expect(rallyPoint(ctx(), cmd)).toEqual(cmd.at);
    });

    it("a Commander over the river on an errand has its group across from it on the own bank; a push takes it over", () => {
        const id = idFor("neutral", true);
        const { w, ctx } = withCommander({ x: 80, y: 0 }, { id });
        const c = ctx();
        const cmd = commanderOf(c);
        if (!cmd) throw new Error("no Commander");
        const slot = rallySlot(c, cmd, cmd.at);
        dryOwnBank(w, slot);
        // ...where it holds rather than hurrying on towards the Commander (the urgency is measured from the slot)
        w.model.self.pos = v2.copy(slot);
        expect(rallyScore(ctx())).toBeLessThan(0.22);
        // the Commander's call is a push over the river: the group crosses with it
        const fb = w.fi.factionBoard;
        if (!fb) throw new Error("no faction board");
        fb.commanderPlan = { leader: 20, objective: east(85), front: east(110), time: NOW, push: true };
        const over = rallySlot(ctx(), cmd, cmd.at);
        expect(riverSide(geo, over)).toBeLessThan(-nearestRiverPoint(geo, over).water);
        expect(w.model.nav.isWaterAt(over)).toBe(false);
        fb.commanderPlan = null;
    });

    it("the Commander leads: it advances even as a squad follower, once its group gathered around it", () => {
        const commander = (near: number, at = SPOT) => {
            const w = factionWorld({
                role: "leader",
                mates: [{ x: -3, y: 2 }],
                allies: Array.from({ length: 12 }, (_, i) => ({
                    off: i < near ? { x: -10, y: -12 + i * 6 } : { x: -200, y: -60 + i * 10 },
                })),
            });
            // the bot (id 12) is not its squad's lowest id: it would follow mate 10 as a squadmate
            w.model.selfId = 12;
            w.model.self.id = 12;
            w.model.team = [
                { ...w.model.team[1], playerId: 10 },
                { ...w.model.team[0], playerId: 12 },
            ];
            w.model.teammates.clear();
            w.model.teammates.add(10);
            w.model.self.pos = v2.copy(at);
            kit(w);
            return ctxOf(w, ["faction"]);
        };
        const alone = commander(0);
        expect(followTarget(alone)).toBeNull();
        // its group is still on the way (30 % of the 14 standing members, 4, within 35 u; mate 10 is one): it holds
        // where it is, facing the front, looting what it sees (from 0.22) but not exploring off (0.12)
        expect(advanceScore(alone)).toBeGreaterThan(0.12);
        expect(advanceScore(alone)).toBeLessThan(0.22);
        expect(commanderWaits(alone)).toBe(true);
        const waits = planAdvance(alone);
        expect(waits.stop).toBe(true);
        expect(waits.goal).toBeNull();
        // three more allies around it: it takes them to the front
        const ready = commander(3, east(-25));
        expect(commanderWaits(ready)).toBe(false);
        expect(advanceScore(ready)).toBeGreaterThan(0);
        expect(planAdvance(ready).goal).not.toBeNull();
    });

    it("the Commander does not wait for its group forever, nor in the water", () => {
        const w = factionWorld({
            role: "leader",
            allies: Array.from({ length: 6 }, (_, i) => ({ off: { x: -200, y: i * 8 } })),
        });
        kit(w);
        // one brain: its memory carries the wait (30 % of 7 standing members: 2 allies to wait for, none near)
        const brain = brainOf(w, ["faction"]);
        expect(commanderWaits(brain.context(NOW))).toBe(true);
        expect(commanderWaits(brain.context(NOW + 20))).toBe(true);
        // 25 s on it goes regardless, for 15 s, and then waits again
        expect(commanderWaits(brain.context(NOW + 26))).toBe(false);
        expect(commanderWaits(brain.context(NOW + 40))).toBe(false);
        expect(commanderWaits(brain.context(NOW + 42))).toBe(true);
        // never in the water
        const { water } = nearestRiverPoint(geo, SPOT);
        w.model.self.pos = east(40 - water / 2);
        expect(commanderWaits(brain.context(NOW + 43))).toBe(false);
        // with its group around it, it goes
        const near = factionWorld({
            role: "leader",
            allies: [
                ...Array.from({ length: 2 }, (_, i) => ({ off: { x: -8, y: i * 8 } })),
                ...Array.from({ length: 4 }, (_, i) => ({ off: { x: -200, y: i * 8 } })),
            ],
        });
        kit(near);
        expect(commanderWaits(brainOf(near, ["faction"]).context(NOW))).toBe(false);
    });
});

describe("a short 50v50 match", () => {
    // 24 bots on the faction map (seed 11, the server's personas) up to 140 s: the Commander is promoted at 50 s. Before
    // the rally the members that would rally stood within 40 u of it 19 % of the time and the minority 71 %; with it
    // 41 % and 19 % (the group is still gathering from the whole half of the map)
    it("the faction gathers around its Commander, the minority keeps to itself, nobody idles in the river", () => {
        const probe = new RiverRallyProbe();
        const report = runMatch({
            faction: true,
            seed: 11,
            bots: 24,
            maxTicks: 14000,
            difficulty: "mixed",
            population: { personas: true },
            probes: [probe],
        });
        expect(report.exceptions).toBe(0);
        const res = probe.finish();
        const share = (rows: Record<string, { samples: number; near: number }> | undefined) => {
            const all = Object.values(rows ?? {});
            const samples = all.reduce((a, r) => a + r.samples, 0);
            return samples > 0 ? all.reduce((a, r) => a + r.near, 0) / samples : 0;
        };
        expect(res.commanderSeconds).toBeGreaterThan(100);
        const rallying = share(res.rallying);
        expect(rallying).toBeGreaterThan(0.3);
        expect(share(res.own)).toBeLessThan(rallying);
        // standing still in the main river: a few bot-seconds at most in the whole match (1 of 3360; 3.5 before)
        let standing = 0;
        let still = 0;
        for (const w of Object.values(res.water)) {
            standing += w.standing;
            still += w.riverStill ?? 0;
        }
        expect(still / standing).toBeLessThan(0.002);
    }, 600_000);
});
