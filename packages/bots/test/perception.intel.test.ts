// Enemy intel from synthetic snapshots: health estimates from the hits the bot sees land (its own bullets and melee,
// other players' bullets) with armour and the expected headshot share, watched heals, the drift back up out of sight;
// what an enemy is busy with, who it fights, whether it just fought.
import { v2 } from "@rebirth/core";
import { getDefOfType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { EnemyIntelTracker, expectedHitDamage } from "../src/perception/enemyIntel.ts";
import { action, bullet, newModel, ORIGIN, player, SELF, snap } from "./perceptionSnap.ts";

function setup() {
    const model = newModel();
    const intel = new EnemyIntelTracker();
    model.intel = intel;
    return { model, intel };
}

const EAST = { x: 1, y: 0 };

/** M9 round damage: survev's 13 under survev balance (survev bulletDefs.ts bullet_m9; the original client's 12) */
const M9_DAMAGE = getDefOfType("bullet", "bullet_m9").damage;

/** Expected damage of an M9 round (falloff 0.7 over 100 units) that stopped after `dist`, headshot unknown. */
function m9Hit(dist: number, helmet = "", chest = ""): number {
    return expectedHitDamage(M9_DAMAGE * (1 - 0.3 * (dist / 100)), "m9", helmet, chest);
}

describe("enemy intel", () => {
    it("lowers the health estimate by the expected damage of the bot's hits, armour included", () => {
        const { model, intel } = setup();
        const enemyPos = v2.add(ORIGIN, { x: 10, y: 0 });
        const armoured = v2.add(ORIGIN, { x: 0, y: 10 });
        const objects = [player(50, enemyPos), player(51, armoured, { helmet: "helmet03", chest: "chest03" })];
        model.observe(snap(1, { objects }));
        expect(intel.of(50)).toMatchObject({ estHealth: 100, action: null, justFought: false });
        const hit = bullet(SELF, ORIGIN, EAST, { hitPlayer: true, endDist: 9 });
        const hit2 = bullet(SELF, ORIGIN, { x: 0, y: 1 }, { hitPlayer: true, endDist: 9 });
        model.observe(snap(1.1, { objects, bullets: [hit, hit2] }));
        expect(intel.of(50).estHealth).toBeCloseTo(100 - m9Hit(9), 5);
        expect(intel.of(50).lastHitByMe).toBe(1.1);
        expect(intel.of(51).estHealth).toBeCloseTo(100 - m9Hit(9, "helmet03", "chest03"), 5);
        // armour cuts the expected damage roughly in half; a headshot chance keeps it above the body-only value
        expect(m9Hit(9, "helmet03", "chest03")).toBeLessThan(m9Hit(9) * 0.6);
        expect(M9_DAMAGE).toBe(13);
        expect(m9Hit(0)).toBeCloseTo(13 * (0.85 + 0.15 * 2), 5);
        // the hit report seen again is not a second hit; a miss (no hitPlayer) is none
        model.observe(snap(1.2, { objects, bullets: [hit, bullet(SELF, ORIGIN, EAST)] }));
        expect(intel.of(50).estHealth).toBeCloseTo(100 - m9Hit(9), 5);
        expect(intel.of(50).justFought).toBe(false);
    });

    it("counts the bot's own melee hits", () => {
        const { model, intel } = setup();
        const enemyPos = v2.add(ORIGIN, { x: 2.2, y: 0 });
        const objects = [player(50, enemyPos)];
        model.observe(snap(1, { objects, self: { anim: { type: "none", seq: 4 } } }));
        model.observe(snap(1.1, { objects, self: { anim: { type: "melee", seq: 5 } } }));
        expect(intel.of(50).estHealth).toBeCloseTo(100 - expectedHitDamage(24, "fists", "", ""), 5);
        // the same swing seen in the next snapshot is not a second hit
        model.observe(snap(1.2, { objects, self: { anim: { type: "melee", seq: 5 } } }));
        expect(intel.of(50).estHealth).toBeCloseTo(100 - expectedHitDamage(24, "fists", "", ""), 5);
    });

    it("tells who an enemy fights and that it just fought", () => {
        const { model, intel } = setup();
        const a = v2.add(ORIGIN, { x: 20, y: 0 });
        const b = v2.add(ORIGIN, { x: 20, y: 15 });
        const objects = [player(50, a), player(51, b)];
        // 50 shoots towards 51 (a miss), then 51 lands a hit on 50
        model.observe(snap(1, { objects, bullets: [bullet(50, a, { x: 0, y: 1 })] }));
        expect(intel.of(50).engagedWith).toBe(51);
        expect(intel.of(51).engagedWith).toBeUndefined();
        model.observe(
            snap(1.2, { objects, bullets: [bullet(51, b, { x: 0, y: -1 }, { hitPlayer: true, endDist: 14.5 })] }),
        );
        expect(intel.of(50).justFought).toBe(true);
        expect(intel.of(50).engagedWith).toBe(51);
        expect(intel.of(51).engagedWith).toBe(50);
        expect(intel.of(50).estHealth).toBeCloseTo(100 - m9Hit(14.5), 5);
        // an enemy shooting at the bot is engaged with the bot
        model.observe(snap(1.4, { objects, bullets: [bullet(51, b, v2.normalize(v2.sub(ORIGIN, b)))] }));
        expect(intel.of(51).engagedWith).toBe(SELF);
        // a kill in the feed is a fight too; a killed player is forgotten
        const kill = {
            targetId: 50,
            killerId: 51,
            killCreditId: 51,
            killerKills: 1,
            damageType: 0,
            source: "gun" as const,
            itemSourceType: "m9",
            mapSourceType: "",
            downed: false,
            killed: true,
        };
        model.observe(snap(1.6, { objects: [player(51, b)], kills: [kill] }));
        expect(intel.of(51).justFought).toBe(true);
        expect(intel.of(50)).toEqual({ estHealth: 100, action: null, justFought: false });
        // the fight fades from memory
        model.observe(snap(20, { objects: [player(51, b)] }));
        expect(intel.of(51).justFought).toBe(false);
        expect(intel.of(51).engagedWith).toBeUndefined();
    });

    it("reads what an enemy is busy with, adds heals it watched finish, drifts back up out of sight", () => {
        const { model, intel } = setup();
        const pos = v2.add(ORIGIN, { x: 8, y: 0 });
        const seen = (t: number, extra = {}) => model.observe(snap(t, { objects: [player(50, pos, extra)] }));
        seen(1);
        for (let i = 0; i < 4; i++) {
            model.observe(
                snap(1.1 + i * 0.05, {
                    objects: [player(50, pos)],
                    bullets: [bullet(SELF, ORIGIN, EAST, { hitPlayer: true, endDist: 7 })],
                }),
            );
        }
        const hurt = intel.of(50).estHealth;
        expect(hurt).toBeCloseTo(100 - 4 * m9Hit(7), 5);
        seen(2, { action: action("reload", "m9", 1.5) });
        expect(intel.of(50).action).toBe("reload");
        seen(3, { action: action("use", "bandage", 3, 2) });
        expect(intel.of(50).action).toBe("use");
        seen(4.5, { action: action("use", "bandage", 3, 2) });
        // cancelled half way: no heal
        seen(4.6);
        expect(intel.of(50).action).toBeNull();
        expect(intel.of(50).estHealth).toBeCloseTo(hurt, 5);
        seen(5, { action: action("use", "bandage", 3, 3) });
        seen(8.1);
        expect(intel.of(50).estHealth).toBeCloseTo(hurt + 15, 5);
        // out of sight: its action is unknown, and after a while it probably healed
        model.observe(snap(9));
        expect(intel.of(50).action).toBeNull();
        const before = intel.of(50).estHealth;
        model.observe(snap(16));
        expect(intel.of(50).estHealth).toBeCloseTo(before, 5);
        model.observe(snap(18.1));
        expect(intel.of(50).estHealth).toBeCloseTo(before + 4 * 2, 5);
        model.observe(snap(40));
        expect(intel.of(50).estHealth).toBe(100);
    });
});
