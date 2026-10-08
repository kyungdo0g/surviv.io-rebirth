// Round 5 follow-ups of the merged content (user reports 27, 31-34): air strike danger by variant (the heavy shell's
// blast, the carpet marker that already covers every blast, a marker matched to its zone's variant), air drops valued
// by tier (gold > tier 2 > tier 1; a normal shell's tier unknown before it opens), and the PMG-134 scored by its potato
// explosions (the gun re-rank itself is pinned in gunTiers.test.ts and packages/defs/test/airdropTiers.test.ts).
import { v2 } from "@rebirth/core";
import { AIRSTRIKE_VARIANTS, GameObjectDefs } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    AIRDROP_GOLD_VALUE,
    AIRDROP_LOOT_VALUE,
    AIRDROP_TIER1_VALUE,
    containerValue,
    NORMAL_SHELL_VALUE,
} from "../src/brain/containers.ts";
import { blastRadius, strikeDangers } from "../src/brain/strikes.ts";
import { hasAmmo, heldGunsWithAmmo } from "../src/knowledge/arsenal.ts";
import { gunRank, gunTier } from "../src/knowledge/gunTiers.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
import { MARKER_DANGER_TIME } from "../src/perception/strobes.ts";
import { ThreatTracker } from "../src/perception/threatTracker.ts";
import { addObstacle, brainOf, FixedBoard, NOW, testWorld } from "./brain-world.ts";
import { newModel, ORIGIN, snap } from "./perceptionSnap.ts";

describe("air strike variants (reports 27, 32)", () => {
    it("a zone's danger is its drawn radius plus its bomb's blast less what the variant's marker already adds", () => {
        const w = testWorld();
        const board = new FixedBoard();
        const at = (x: number) => v2.add(w.spot, { x, y: 200 });
        board.zones = [
            { kind: "airstrike", pos: at(0), rad: 50, until: NOW + 10 },
            { kind: "airstrike", pos: at(200), rad: 74, until: NOW + 10, variant: "heavy" },
            { kind: "airstrike", pos: at(400), rad: 92, until: NOW + 10, variant: "carpet" },
        ];
        w.model.threats = board;
        const list = strikeDangers(brainOf(w, ["pursuit"]).context(NOW));
        const iron = blastRadius("bomb_iron");
        const heavy = blastRadius("bomb_heavy");
        expect(heavy).toBe(38);
        // normal: aim radius + the iron blast (as before); heavy: the marker holds +24, so aim + 38 = rad + 14
        expect(list[0].rad).toBe(50 + iron);
        expect(list[1].rad).toBe(74 + heavy - AIRSTRIKE_VARIANTS.heavy.zoneRadAdd);
        // carpet: its marker covers every blast already (it was rad + 14)
        expect(list[2].rad).toBe(92);
    });

    it("a strike marker takes its zone's variant: as wide as its lines spread plus its bomb's blast (bot round 6)", () => {
        // the lines' spread (5 u, the carpet's 21), the bombs' 4 u jitter, the blast (iron 14, heavy 38) and the body
        for (const [variant, rad, time] of [
            [undefined, 24, MARKER_DANGER_TIME],
            ["heavy", 48, MARKER_DANGER_TIME],
            ["carpet", 40, MARKER_DANGER_TIME],
        ] as const) {
            const model = newModel();
            const board = new ThreatTracker();
            model.threats = board;
            const pos = v2.add(ORIGIN, { x: 40, y: 0 });
            model.observe(
                snap(20, {
                    airstrikeZones: [
                        {
                            id: 1,
                            pos: v2.add(pos, { x: 1, y: 0 }),
                            rad: 60,
                            duration: 1,
                            zoneT: 0.99,
                            ...(variant ? { variant } : {}),
                        },
                    ],
                    mapIndicators: [{ id: 4, type: "ping_airstrike", pos, dead: false, equipped: false }],
                }),
            );
            const marker = board.dangerZones().find((z) => v2.distance(z.pos, pos) < 0.5);
            expect(marker?.rad, String(variant)).toBeCloseTo(rad, 6);
            expect(marker?.until, String(variant)).toBeCloseTo(20 + time, 6);
            const zone = board.dangerZones().find((z) => z.rad === 60);
            expect(zone?.variant).toBe(variant);
        }
    });
});

describe("air drops by tier (reports 31, 33)", () => {
    it("gold > tier 2 > tier 1 for inner crates; a gold shell shows, a normal shell is the tier mix", () => {
        const w = testWorld();
        const value = (type: string) => {
            addObstacle(w, { x: 30, y: 30 }, type);
            return containerValue(w.model.obstacles[w.model.obstacles.length - 1]);
        };
        expect(value("crate_11")).toBe(AIRDROP_GOLD_VALUE);
        expect(value("crate_13")).toBe(AIRDROP_GOLD_VALUE);
        expect(value("crate_10t2")).toBe(AIRDROP_LOOT_VALUE);
        expect(value("crate_10")).toBe(AIRDROP_LOOT_VALUE);
        expect(value("crate_10t1")).toBe(AIRDROP_TIER1_VALUE);
        expect(value("crate_10svt1")).toBe(AIRDROP_TIER1_VALUE);
        expect(AIRDROP_GOLD_VALUE).toBeGreaterThan(AIRDROP_LOOT_VALUE);
        expect(AIRDROP_LOOT_VALUE).toBeGreaterThan(AIRDROP_TIER1_VALUE);
        // shells: the gold-trimmed crate is its own type; a normal one opens into tier 1 or tier 2 (unknown)
        const gold = value("airdrop_crate_02");
        const normal = value("airdrop_crate_01");
        expect(normal).toBe(NORMAL_SHELL_VALUE);
        expect(gold).toBeGreaterThan(normal);
        expect(normal).toBeLessThan(AIRDROP_TIER1_VALUE);
        expect(value("airdrop_crate_01sv")).toBe(normal);
    });
});

describe("PMG-134 (report 34)", () => {
    it("is scored by its potato explosions, reaches about 70 units and never runs dry", () => {
        const pmg = gunInfo("potato_lmg");
        const ex = GameObjectDefs.explosion_potato_lmgshot as unknown as { damage: number };
        expect(pmg?.cls).toBe("lmg");
        expect(pmg?.damage).toBe(ex.damage);
        expect(pmg?.range).toBe(70);
        expect(pmg?.score).toBeGreaterThan(gunInfo("ak47")?.score ?? 0);
        expect(gunTier("potato_lmg")?.tier).toBe("A");
        expect(gunRank("potato_lmg")).toBeLessThan(gunRank("m249"));
        // (round 6, report 42: the Spud Gun and the Potato Cannon are real guns too, behind BrainFeatures.potatoGuns;
        // the flare guns stay useless)
        expect(gunInfo("potato_smg")?.score ?? 0).toBeGreaterThan(0);
        expect(gunInfo("flare_gun")?.score).toBe(0);
        // an empty magazine is not "out of ammo": it reloads from nothing
        const w = testWorld();
        w.model.self.weapons[0] = { type: "potato_lmg", ammo: 0 };
        const held = heldGunsWithAmmo(w.model.self).find((g) => g.info.id === "potato_lmg");
        expect(held && hasAmmo(held)).toBe(true);
    });
});
