// Fighting from cover (BrainFeatures.cover): peek spots with a clear line of fire on alternating sides, the
// hide -> peek -> hide cycle in a losing trade (reload / heal while hidden, back behind cover after a burst or a real
// hit), no hiding from an even trade with a loaded gun, nor in a won trade or a brawl, holding the last-seen angle of
// a lost target for a few seconds, and taking an even fight at range into a building (closing the door on the threat's
// side).
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { peekSpot } from "../src/brain/cover.ts";
import { buildingSpots } from "../src/brain/explore.ts";
import { planFight } from "../src/brain/tactics.ts";
import { obstacleCollider, obstacleDef } from "../src/geom.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { addEnemy, addObstacle, brainOf, faceTo, NOW, TableIntel, testWorld } from "./brain-world.ts";
import { cachedMap } from "./helpers.ts";

function coverWorld() {
    const w = testWorld();
    const e = addEnemy(w, 2, { x: 20, y: 0 });
    faceTo(e, w.spot);
    addObstacle(w, { x: 2, y: 4 });
    return { w, e };
}

describe("cover", () => {
    it("peek spots have a clear line of fire and alternate sides", () => {
        const { w, e } = coverWorld();
        const brain = brainOf(w, ["cover"]);
        const ctx = brain.context(NOW);
        const spot = v2.add(w.spot, { x: -2.2, y: 4.4 });
        expect(w.model.lineOfFire(e.pos, spot)).toBe(false);
        const a = peekSpot(ctx, spot, e.pos)!;
        const b = peekSpot(ctx, spot, e.pos)!;
        for (const p of [a, b]) {
            expect(w.model.lineOfFire(p, e.pos)).toBe(true);
            // 1.5-2.5 units sideways, snapped to the centre of its navigation cell (up to 0.71 off)
            expect(v2.distance(p, spot)).toBeGreaterThanOrEqual(1.4 - 0.71);
            expect(v2.distance(p, spot)).toBeLessThanOrEqual(2.6 + 0.71);
        }
    });

    it("losing in the open: hides, reloads behind cover, peeks out with a clear shot, steps back when hit", () => {
        const { w, e } = coverWorld();
        w.model.self.health = 40;
        w.model.self.weapons[0].ammo = 12;
        const brain = brainOf(w, ["cover"]);
        const sm = brain.mem.smart;
        const hide = planFight(brain.context(NOW));
        expect(sm.cover).toBe("hide");
        // still in the enemy's line of fire on the way: it shoots back
        expect(hide.fire).toBe(true);
        expect(hide.lookAt).toEqual(e.pos);
        expect(hide.goal).not.toBeNull();
        expect(w.model.lineOfFire(e.pos, hide.goal!)).toBe(false);
        // at the spot: reload there
        w.model.self.pos = v2.copy(hide.goal!);
        const reload = planFight(brain.context(NOW + 0.1));
        expect(reload.actions).toContain(Input.Reload);
        expect(reload.stop).toBe(true);
        expect(reload.fire).toBe(false);
        expect(reload.aim).toEqual(e.pos);
        // reloaded and the hide time is up: peek
        w.model.self.weapons[0].ammo = 30;
        e.lastSeen = NOW + 2;
        const peek = planFight(brain.context(NOW + 2));
        expect(sm.cover).toBe("peek");
        expect(sm.peekSpot).not.toBeNull();
        expect(w.model.lineOfFire(sm.peekSpot!, e.pos)).toBe(true);
        expect(peek.goal).toEqual(sm.peekSpot);
        w.model.self.pos = v2.copy(sm.peekSpot!);
        const out = planFight(brain.context(NOW + 2.5));
        expect(out.stop).toBe(true);
        expect(sm.cover).toBe("peek");
        // a graze keeps the peek going, a real hit sends it back behind cover
        w.model.lastHurt = NOW + 2.6;
        w.model.self.health = 36;
        planFight(brain.context(NOW + 2.65));
        expect(sm.cover).toBe("peek");
        w.model.lastHurt = NOW + 2.8;
        w.model.self.health = 26;
        planFight(brain.context(NOW + 2.9));
        expect(sm.cover).toBe("hide");
    });

    it("heals behind cover when hurt", () => {
        const { w } = coverWorld();
        w.model.self.health = 45;
        w.model.self.inventory.bandage = 3;
        const brain = brainOf(w, ["cover"]);
        const hide = planFight(brain.context(NOW));
        w.model.self.pos = v2.copy(hide.goal!);
        const heal = planFight(brain.context(NOW + 0.1));
        expect(heal.useItem).toBe("bandage");
    });

    it("fights in the open in a won trade and in a brawl", () => {
        const { w, e } = coverWorld();
        const intel = new TableIntel();
        intel.table.set(2, { estHealth: 20 });
        w.model.intel = intel;
        const brain = brainOf(w, ["cover", "assess"]);
        planFight(brain.context(NOW));
        expect(brain.mem.smart.cover).toBe("none");
        intel.table.clear();
        e.pos = v2.add(w.spot, { x: 5, y: 0 });
        planFight(brain.context(NOW + 1));
        expect(brain.mem.smart.cover).toBe("none");
    });

    it("holds the last-seen angle of a lost target for a few seconds, then goes to look", () => {
        const { w, e } = coverWorld();
        e.visible = false;
        e.lastSeen = NOW;
        // a hard bot remembers a lost enemy for 6 s
        const brain = brainOf(w, ["cover"], "hard");
        const hold = planFight(brain.context(NOW));
        expect(hold.fire).toBe(false);
        expect(hold.aim).toEqual(e.pos);
        expect(hold.lookAt).toEqual(e.pos);
        expect(hold.arriveDist).not.toBe(4);
        const later = planFight(brain.context(NOW + 3.5));
        expect(later.goal).toEqual(e.pos);
        expect(later.arriveDist).toBe(4);
    });

    it("does not hide from an even trade with a loaded gun", () => {
        const { w } = coverWorld();
        const brain = brainOf(w, ["cover"]);
        const plan = planFight(brain.context(NOW));
        expect(brain.mem.smart.cover).toBe("none");
        expect(plan.fire).toBe(true);
    });

    it("the session is capped: after 20 s the bot fights in the open for a while", () => {
        const { w, e } = coverWorld();
        w.model.self.health = 40;
        const brain = brainOf(w, ["cover"]);
        planFight(brain.context(NOW));
        expect(brain.mem.smart.cover).toBe("hide");
        e.lastSeen = NOW + 21;
        planFight(brain.context(NOW + 21));
        expect(brain.mem.smart.cover).toBe("none");
        e.lastSeen = NOW + 22;
        planFight(brain.context(NOW + 22));
        expect(brain.mem.smart.cover).toBe("none");
    });

    it("takes an even fight at range into a nearby building and shuts the door on the threat's side", () => {
        const map = cachedMap("main", 12345).mapData;
        const nav = NavGrid.forMap(map);
        // a building interior with an open spot 11 units off it and room for the enemy 25 units farther out
        let found: { b: Vec2; at: Vec2; enemy: Vec2 } | null = null;
        for (const s of buildingSpots(map)) {
            for (let k = 0; k < 8 && !found; k++) {
                const dir = { x: Math.cos((k * Math.PI) / 4), y: Math.sin((k * Math.PI) / 4) };
                const at = v2.add(s.pos, v2.mul(dir, 11));
                const enemy = v2.add(at, v2.mul(dir, 25));
                if (nav.walkableAt(at) && nav.walkableAt(enemy) && nav.walkableAt(s.pos) && nav.reachable(at, s.pos)) {
                    found = { b: s.pos, at, enemy };
                }
            }
            if (found) break;
        }
        expect(found).not.toBeNull();
        const { b, at, enemy } = found!;
        const w = testWorld(map, at);
        const e = addEnemy(w, 2, v2.sub(enemy, at));
        faceTo(e, at);
        const brain = brainOf(w, ["cover"]);
        const go = planFight(brain.context(NOW));
        expect(go.goal).not.toBeNull();
        expect(v2.distance(go.goal!, b)).toBeLessThan(5);
        expect(go.lookAt).toEqual(e.pos);
        // the bot stands inside under the roof, an open door next to it on the enemy's side
        const building = map.objects.find((o) => buildingSpots(map).some((s) => s.id === o.id && s.pos === b))!;
        w.model.buildings = [
            {
                kind: "building",
                id: building.id,
                type: building.type,
                pos: building.pos,
                layer: 0,
                ori: building.ori,
                occupied: true,
                ceilingDead: false,
                ceilingDamaged: false,
            },
        ];
        w.model.snapshots++;
        w.model.self.pos = v2.copy(brain.mem.smart.buildingSpot!);
        const towards = v2.normalizeSafe(v2.sub(e.pos, w.model.self.pos));
        addDoor(w, v2.add(w.model.self.pos, v2.mul(towards, 1.8)));
        const hold = planFight(brain.context(NOW + 3));
        expect(hold.stop).toBe(true);
        expect(hold.actions).toContain(Input.Use);
        // capped: after 10 s the bot fights on from where it stands
        e.lastSeen = NOW + 11;
        planFight(brain.context(NOW + 11));
        expect(brain.mem.smart.buildingSpot).toBeNull();
    });
});

/** An open door (a door obstacle whose view says open) at `pos`. */
function addDoor(w: ReturnType<typeof testWorld>, pos: Vec2): void {
    const type = "house_door_01";
    const def = obstacleDef(type)!;
    w.model.obstacles.push({
        view: {
            kind: "obstacle",
            id: 9000,
            type,
            pos,
            layer: 0,
            ori: 0,
            scale: 1,
            healthT: 1,
            dead: false,
            door: { open: true, locked: false, canUse: true },
        },
        def,
        col: obstacleCollider(def, pos, 0, 1),
        solid: true,
        blocksBullets: true,
        blocksMove: true,
    });
}
