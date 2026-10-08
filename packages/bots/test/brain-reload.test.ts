// Smart reloading (BrainFeatures.smartReload with DifficultyParams.smartReload): no reload while an enemy has a line
// of fire and rounds remain; a reload swap to the other loaded gun (when it suits the range) when caught empty or
// mid-reload; a full top-up after a kill, reloads when the enemy broke line of sight far away or while it is busy;
// reloading behind close cover.
import { Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { manageReload, smartReloadOn } from "../src/brain/reload.ts";
import { planFight } from "../src/brain/tactics.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, faceTo, giveGun, NOW, TableIntel, testWorld } from "./brain-world.ts";

function reloads(intent: ReturnType<typeof emptyIntent>): boolean {
    return intent.actions.includes(Input.Reload);
}

describe("smart reload", () => {
    it("is on only with the feature and a difficulty that reloads smartly", () => {
        const w = testWorld();
        expect(smartReloadOn(ctxOf(w, ["smartReload"]))).toBe(true);
        expect(smartReloadOn(ctxOf(w, ["smartReload"], "easy"))).toBe(false);
        expect(smartReloadOn(ctxOf(w, []))).toBe(false);
    });

    it("never reloads with an enemy in line of fire while the magazine has rounds", () => {
        const w = testWorld();
        w.model.self.weapons[0].ammo = 8;
        faceTo(addEnemy(w, 2, { x: 18, y: 0 }), w.spot);
        const intent = emptyIntent("fight");
        manageReload(ctxOf(w, ["smartReload"]), intent);
        expect(reloads(intent)).toBe(false);
    });

    it("tops up fully once nobody is in sight right after a kill (before looting)", () => {
        const w = testWorld();
        w.model.self.weapons[0].ammo = 24;
        const brain = brainOf(w, ["smartReload"]);
        brain.mem.smart.lastEnemySeen = NOW - 2;
        // 24 of 30 rounds: no reload without a kill
        const plain = emptyIntent("loot");
        manageReload(brain.context(NOW), plain);
        expect(reloads(plain)).toBe(false);
        w.model.self.kills = 1;
        const intent = emptyIntent("loot");
        manageReload(brain.context(NOW + 0.1), intent);
        expect(reloads(intent)).toBe(true);
        // not again right away
        const again = emptyIntent("loot");
        manageReload(brain.context(NOW + 0.2), again);
        expect(reloads(again)).toBe(false);
    });

    it("no top-up while an enemy kneels in a revive within reach: it is finished first (50v50 endgame)", () => {
        const w = testWorld();
        w.model.self.weapons[0].ammo = 10;
        w.model.self.kills = 1;
        // a downed enemy that only bleeds out does not hold the reload up...
        const bleeding = addEnemy(w, 2, { x: 15, y: 0 }, { downed: true });
        const brain = brainOf(w, ["smartReload"]);
        brain.mem.smart.lastEnemySeen = NOW - 2;
        const plain = emptyIntent("zone");
        manageReload(brain.context(NOW), plain);
        expect(reloads(plain)).toBe(true);
        // ...one reviving itself (a Medic's Revivify) or being revived does, while rounds remain
        bleeding.reviving = true;
        const kneeling = emptyIntent("zone");
        manageReload(brain.context(NOW + 2), kneeling);
        expect(reloads(kneeling)).toBe(false);
        w.model.self.weapons[0].ammo = 0;
        const empty = emptyIntent("zone");
        manageReload(brain.context(NOW + 4), empty);
        expect(reloads(empty)).toBe(true);
    });

    it("waits a moment after the last enemy left sight unless the magazine is low", () => {
        const w = testWorld();
        w.model.self.weapons[0].ammo = 26;
        const ctx = ctxOf(w, ["smartReload"]);
        ctx.mem.smart.lastEnemySeen = NOW - 0.2;
        const intent = emptyIntent("explore");
        manageReload(ctx, intent);
        expect(reloads(intent)).toBe(false);
        w.model.self.weapons[0].ammo = 10;
        const low = emptyIntent("explore");
        manageReload(ctxOf(w, ["smartReload"]), low);
        expect(reloads(low)).toBe(true);
    });

    it("reloads when the enemy broke line of sight beyond 25 units", () => {
        const w = testWorld();
        w.model.self.weapons[0].ammo = 12;
        addObstacle(w, { x: 6, y: 0 }, "crate_01");
        faceTo(addEnemy(w, 2, { x: 32, y: 0 }), w.spot);
        expect(w.model.lineOfFire(w.spot, w.model.contacts.get(2)!.pos)).toBe(false);
        const intent = emptyIntent("fight");
        manageReload(ctxOf(w, ["smartReload"]), intent);
        expect(reloads(intent)).toBe(true);
    });

    it("reloads while a close enemy without a line of fire is busy healing", () => {
        const w = testWorld();
        w.model.self.weapons[0].ammo = 14;
        addObstacle(w, { x: 5, y: 0 }, "crate_01");
        addEnemy(w, 2, { x: 14, y: 0 });
        const intent = emptyIntent("fight");
        manageReload(ctxOf(w, ["smartReload"]), intent);
        expect(reloads(intent)).toBe(false);
        const intel = new TableIntel();
        intel.table.set(2, { action: "use" });
        w.model.intel = intel;
        const busy = emptyIntent("fight");
        manageReload(ctxOf(w, ["smartReload"]), busy);
        expect(reloads(busy)).toBe(true);
    });

    it("swaps to the other loaded gun when caught empty or mid-reload by an enemy", () => {
        const w = testWorld();
        giveGun(w, 1, "m870");
        w.model.self.weapons[0].ammo = 0;
        faceTo(addEnemy(w, 2, { x: 12, y: 0 }), w.spot);
        const intent = emptyIntent("fight");
        manageReload(ctxOf(w, ["smartReload"]), intent);
        expect(intent.slot).toBe(1);
        // a shotgun is no answer at 25 units: reload instead
        w.model.contacts.get(2)!.pos = { x: w.spot.x + 25, y: w.spot.y };
        const far = emptyIntent("fight");
        manageReload(ctxOf(w, ["smartReload"]), far);
        expect(far.slot).toBeNull();
        // mid-reload with rounds left
        const w2 = testWorld();
        giveGun(w2, 1, "m870");
        w2.model.self.weapons[0].ammo = 6;
        w2.model.self.action = { type: "reload", item: "mp5", time: 0.5, duration: 2, targetId: 0 };
        faceTo(addEnemy(w2, 2, { x: 12, y: 0 }), w2.spot);
        const mid = emptyIntent("fight");
        manageReload(ctxOf(w2, ["smartReload"]), mid);
        expect(mid.slot).toBe(1);
    });

    it("reloads behind cover within 4 units, else keeps fighting in the open", () => {
        const w = testWorld();
        w.model.self.weapons[0].ammo = 0;
        const e = addEnemy(w, 2, { x: 20, y: 0 });
        faceTo(e, w.spot);
        const open = planFight(ctxOf(w, ["smartReload"]));
        expect(open.goal).toBeNull();
        addObstacle(w, { x: 2.5, y: 2.5 }, "crate_01");
        const covered = planFight(ctxOf(w, ["smartReload"]));
        expect(covered.goal).not.toBeNull();
        expect(w.model.lineOfFire(e.pos, covered.goal!)).toBe(false);
    });
});
