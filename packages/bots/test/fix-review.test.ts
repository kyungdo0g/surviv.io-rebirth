// Fixes after the adversarial review of the bot overhaul (stage FIX): a kneeling reviver gets up when an enemy walks in
// (and the kneel no longer blocks the fight it chose), a spot the bot is shot on while parked is burned and stepped off,
// cover must hide the whole body, bullets fired under someone else's roof show only from where they leave it, the fight
// slot holds for a moment after a switch, big flicks peak at their own top speed under the motor's cap, and runs under
// fire go in irregular legs.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, Input, WeaponSlot } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { heldSlot } from "../src/brain/combat.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { burned, noteStillHit, unpinUnderFire } from "../src/brain/stillHit.ts";
import { kneelThreat, reviveScore } from "../src/brain/team.ts";
import { newZigzag, zigzagStep } from "../src/brain/zigzag.ts";
import { capTurnRate, peakTurnRate, planFlick } from "../src/motor/flick.ts";
import { addEnemy, addObstacle, brainOf, giveGun, NOW, testWorld } from "./brain-world.ts";
import { bullet, newModel, ORIGIN, player, snap } from "./perceptionSnap.ts";

function member(id: number, pos: Vec2, over: Partial<TeamMemberView> = {}): TeamMemberView {
    return { playerId: id, name: `m${id}`, health: 100, downed: false, dead: false, disconnected: false, pos, ...over };
}

const DEG = Math.PI / 180;

describe("reviving under an enemy walking in", () => {
    /** A bot kneeling over its downed teammate 1 unit away, 3 s into the 8 s revive. */
    function kneeling() {
        const w = testWorld();
        const matePos = v2.add(w.spot, { x: 1, y: 0 });
        w.model.team = [member(1, w.spot), member(10, matePos, { downed: true })];
        w.model.teammates.add(10);
        addEnemy(w, 10, { x: 1, y: 0 }, { teammate: true, downed: true });
        w.model.self.action = { type: "revive", item: "", time: 3, duration: 8, targetId: 10 };
        return { w, matePos };
    }

    it("an armed enemy closing in within view ends the kneel; one far and still does not", () => {
        const { w, matePos } = kneeling();
        const far = addEnemy(w, 20, { x: 30, y: 0 }, { vel: { x: 0, y: 0 } });
        const brain = brainOf(w, BRAIN_PRESETS.smart);
        expect(kneelThreat(brain.context(NOW), matePos)).toBeNull();
        expect(reviveScore(brain.context(NOW))).toBe(0.95);
        // it walks at the bot: 5 u/s closing from 30 u
        far.vel = { x: -5, y: 0 };
        expect(kneelThreat(brain.context(NOW), matePos)).toBe(far);
        expect(reviveScore(brain.context(NOW))).toBe(0);
        // the baseline keeps its old rule (only a hit ends it)
        expect(reviveScore(brainOf(w, BRAIN_PRESETS.baseline).context(NOW))).toBe(0.95);
    });

    it("an enemy noticed only a moment ago (inside the human reaction) does not end it yet", () => {
        const { w, matePos } = kneeling();
        addEnemy(w, 20, { x: 12, y: 0 }, { firstSeen: NOW - 0.05 });
        expect(kneelThreat(brainOf(w, BRAIN_PRESETS.smart).context(NOW), matePos)).toBeNull();
    });

    it("the brain gets up (Input.Cancel) when it chooses to fight, so the fight can shoot and switch", () => {
        const { w } = kneeling();
        addEnemy(w, 20, { x: 14, y: 0 }, { vel: { x: -4, y: 0 }, lastShotAt: NOW - 0.2 });
        const brain = brainOf(w, BRAIN_PRESETS.smart);
        const intent = brain.think(NOW, 0.1);
        expect(intent.behaviour).not.toBe("revive");
        expect(intent.actions).toContain(Input.Cancel);
        // and it does not kneel again in front of that enemy right away
        w.model.self.action = { type: "none", item: "", time: 0, duration: 0, targetId: 0 };
        w.model.self.pos = v2.add(w.spot, { x: 0.5, y: 0 });
        expect(reviveScore(brain.context(NOW + 1))).toBeLessThanOrEqual(0.2);
    });
});

describe("shot while parked", () => {
    it("burns the spot and steps sideways across the line of fire, unless it is trading shots from it", () => {
        const w = testWorld();
        const brain = brainOf(w, BRAIN_PRESETS.smart);
        const m = w.model;
        noteStillHit(brain.context(NOW));
        // standing there 1 s, then hit for 20 from the east
        m.self.health = 80;
        m.lastHurt = NOW + 1;
        m.underFire = { time: NOW + 1, from: v2.add(w.spot, { x: 30, y: 0 }), shooterId: 9 };
        const ctx = brain.context(NOW + 1);
        noteStillHit(ctx);
        expect(burned(ctx, w.spot)).toBe(true);
        const intent = emptyIntent("disengage");
        intent.stop = true;
        unpinUnderFire(ctx, intent);
        expect(intent.stop).toBe(false);
        expect(intent.moveDir).not.toBeNull();
        // across the line to the shooter, not along it
        expect(Math.abs(intent.moveDir?.x ?? 1)).toBeLessThan(0.75);

        // the same hit while it fires back from the spot: a trade, nothing burned
        const t = testWorld();
        const b2 = brainOf(t, BRAIN_PRESETS.smart);
        noteStillHit(b2.context(NOW));
        t.model.self.health = 80;
        t.model.lastHurt = NOW + 1;
        b2.mem.fight.fireAt = NOW + 0.9;
        const c2 = b2.context(NOW + 1);
        noteStillHit(c2);
        expect(burned(c2, t.spot)).toBe(false);
    });
});

describe("cover hides the whole body", () => {
    it("a centre ray blocked while an edge ray is clear is not cover", () => {
        const w = testWorld();
        // a thin pole-like obstacle right on the line: blocks the centre ray only
        addObstacle(w, { x: 5, y: 0 }, "tree_01");
        const threat = v2.add(w.spot, { x: 20, y: 0 });
        const behind = v2.add(w.spot, { x: 3, y: 0 });
        expect(w.model.lineOfFire(threat, behind)).toBe(false);
        // the body (radius 1) pokes out past a trunk: an edge ray reaches it
        const trunk = w.model.obstacles[w.model.obstacles.length - 1];
        const r = trunk.col.type === 0 ? trunk.col.rad : 2;
        if (r < 0.9) expect(w.model.bodyLineOfFire(threat, behind)).toBe(true);
        else expect(w.model.bodyLineOfFire(threat, v2.add(behind, { x: 0, y: r + 0.2 }))).toBe(true);
    });
});

describe("bullets under someone else's roof", () => {
    it("a shot fired under a roof shows from where it leaves the house, its shooter a fuzzy estimate", () => {
        const model = newModel();
        const def = getMapObjectDef("house_red_01") as { ceiling: { zoomRegions: Array<{ zoomIn?: unknown }> } };
        const z = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn as { min: Vec2; max: Vec2 };
        const housePos = v2.add(ORIGIN, { x: 15, y: 0 });
        const house = {
            id: 950,
            kind: "building" as const,
            type: "house_red_01",
            pos: housePos,
            layer: 0,
            ori: 0,
            occupied: true,
            ceilingDead: false,
            ceilingDamaged: false,
        };
        const inside = { x: housePos.x + (z.min.x + z.max.x) / 2 + 2, y: housePos.y + (z.min.y + z.max.y) / 2 + 1.5 };
        const dir = v2.normalize(v2.sub(ORIGIN, inside));
        model.observe(snap(1, { objects: [house, player(41, inside)] }));
        model.observe(
            snap(1.03, { objects: [house, player(41, inside)], bullets: [bullet(41, inside, dir, { maxDist: 60 })] }),
        );
        expect(model.contacts.get(41)?.visible ?? false).toBe(false);
        const seen = model.bullets.find((b) => b.shooterId === 41);
        expect(seen?.clipped).toBe(true);
        expect(v2.distance(seen?.origin ?? inside, inside)).toBeGreaterThan(0.5);
        expect(v2.distance(model.underFire?.from ?? inside, inside)).toBeGreaterThan(0.5);
        // the tracer starts at the roof's edge, not at the muzzle
        expect(v2.distance(seen?.pos ?? inside, inside)).toBeGreaterThan(1);
    });
});

describe("the fight slot holds after a switch", () => {
    it("keeps the gun just drawn for 2 s while it has rounds, then follows the choice; an empty gun switches at once", () => {
        const w = testWorld();
        giveGun(w, WeaponSlot.Secondary, "m870");
        const brain = brainOf(w, BRAIN_PRESETS.smart);
        expect(heldSlot(brain.context(NOW), WeaponSlot.Primary)).toBe(WeaponSlot.Primary);
        expect(heldSlot(brain.context(NOW + 0.5), WeaponSlot.Secondary)).toBe(WeaponSlot.Primary);
        expect(heldSlot(brain.context(NOW + 2.1), WeaponSlot.Secondary)).toBe(WeaponSlot.Secondary);
        // drawn again just now: held; emptied: let go
        w.model.self.curWeapIdx = WeaponSlot.Secondary;
        expect(heldSlot(brain.context(NOW + 2.2), WeaponSlot.Primary)).toBe(WeaponSlot.Secondary);
        w.model.self.weapons[WeaponSlot.Secondary].ammo = 0;
        expect(heldSlot(brain.context(NOW + 2.3), WeaponSlot.Primary)).toBe(WeaponSlot.Primary);
    });
});

describe("flick top speed", () => {
    it("a big turn gets its own top speed under the 1300 deg/s cap and a slightly longer stroke; a small one is left alone", () => {
        const rng = createRng(5);
        const spec = { kind: "primary" as const, now: 0, width: 1.25, gain: 1, sigma: 0, kappa: 0 };
        const caps = new Set<number>();
        for (let i = 0; i < 40; i++) {
            const big = planFlick(rng, {
                ...spec,
                from: { x: 8, y: 0 },
                goal: v2.rotate({ x: 10, y: 0 }, (150 + i) * DEG),
                fittsA: 0.03,
                fittsB: 0.04,
            });
            const mt0 = big.mt;
            const peak0 = peakTurnRate(big.p0, big.k, big.p1, big.mt);
            const cap = capTurnRate(rng, big);
            expect(cap).toBeGreaterThanOrEqual(1000 * DEG - 1e-9);
            expect(cap).toBeLessThanOrEqual(1300 * DEG + 1e-9);
            // stretched towards the cap, by 25% at most (the motor's clamp holds the rest at this flick's cap)
            expect(big.mt).toBeGreaterThanOrEqual(mt0);
            expect(big.mt).toBeLessThanOrEqual(mt0 * 1.25 + 1e-9);
            expect(peakTurnRate(big.p0, big.k, big.p1, big.mt)).toBeLessThanOrEqual(peak0);
            caps.add(Math.round(cap / DEG / 10));
        }
        // not one fixed top speed
        expect(caps.size).toBeGreaterThan(5);
        const small = planFlick(rng, {
            ...spec,
            from: { x: 10, y: 0 },
            goal: { x: 10, y: 2 },
            fittsA: 0.1,
            fittsB: 0.1,
        });
        const mt = small.mt;
        expect(capTurnRate(rng, small)).toBe(Number.POSITIVE_INFINITY);
        expect(small.mt).toBe(mt);
    });
});

describe("running under fire", () => {
    it("goes in irregular legs off the way out, changing side", () => {
        const w = testWorld();
        const brain = brainOf(w, BRAIN_PRESETS.smart);
        const z = newZigzag();
        const base = { x: 1, y: 0 };
        const sides = new Set<number>();
        for (let k = 0; k < 40; k++) {
            const d = zigzagStep(brain.context(NOW + k * 0.1), z, base);
            expect(d).not.toBeNull();
            const v = d as Vec2;
            expect(v2.dot(v, base)).toBeGreaterThan(0.5);
            sides.add(Math.sign(v.y));
        }
        expect(sides.has(1) && sides.has(-1)).toBe(true);
    });
});
