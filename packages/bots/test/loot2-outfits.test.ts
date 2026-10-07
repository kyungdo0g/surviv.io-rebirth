// LOOT2 (user report 22): outfits by persona taste. The habit ("any", "liked" with a stable ranked list, "never") is
// drawn once per bot from the persona's outfitMix on the persona stream (NEUTRAL never, without a draw); an outfit is a
// short, cheap detour taken only when it is quiet, never before a fight, a flight, a heal or the zone; the outfit taken
// off is never put back on. Owner: LOOT.
import { createRng, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { lootScore } from "../src/brain/explore.ts";
import {
    drawOutfitTaste,
    isCamo,
    lootableOutfit,
    OUTFIT_SCORE,
    outfitPool,
    outfitValue,
} from "../src/brain/outfits.ts";
import { BotController } from "../src/controller.ts";
import { NEUTRAL, PERSONA_NAMES, PERSONAS } from "../src/persona.ts";
import { addEnemy, ctxOf, NOW, testWorld } from "./brain-world.ts";
import { flatGame, giveGun, openSpot, placePlayer, runUntil } from "./helpers.ts";

const LOOTER = { persona: PERSONAS.looter };

function quietCtx(features: Parameters<typeof ctxOf>[1] = ["outfits"], profile = LOOTER) {
    const w = testWorld();
    const ctx = ctxOf(w, features, "normal", profile);
    ctx.mem.loot2.lastThreat = NOW - 10;
    return { w, ctx };
}

describe("outfit habits", () => {
    it("NEUTRAL never bothers and draws nothing", () => {
        let draws = 0;
        const t = drawOutfitTaste({ persona: NEUTRAL }, () => {
            draws++;
            return 0.5;
        });
        expect(t.style).toBe("never");
        expect(draws).toBe(0);
    });

    it("habits follow each persona's mix; liked lists are 4-8 distinct lootable outfits, camouflage for the cautious", () => {
        for (const name of PERSONA_NAMES) {
            const p = PERSONAS[name];
            const rng = createRng(11);
            const n = 2000;
            const count = { any: 0, liked: 0, never: 0 };
            let camo = 0;
            let listed = 0;
            for (let i = 0; i < n; i++) {
                const t = drawOutfitTaste({ persona: p }, () => rng.next());
                count[t.style]++;
                if (t.style !== "liked") {
                    expect(t.likes).toEqual([]);
                    continue;
                }
                expect(t.likes.length).toBeGreaterThanOrEqual(4);
                expect(t.likes.length).toBeLessThanOrEqual(8);
                expect(new Set(t.likes).size).toBe(t.likes.length);
                for (const id of t.likes) expect(lootableOutfit(id)).toBe(true);
                camo += t.likes.filter(isCamo).length;
                listed += t.likes.length;
            }
            const total = p.outfitMix.any + p.outfitMix.liked + p.outfitMix.never;
            for (const k of ["any", "liked", "never"] as const) {
                expect(count[k] / n, `${name} ${k}`).toBeCloseTo(p.outfitMix[k] / total, 1);
            }
            const share = camo / listed;
            const base = outfitPool().filter(isCamo).length / outfitPool().length;
            // risk tolerance below 0.6 leans to camouflage, above it away from it
            if (p.riskTolerance < 0.5) expect(share, name).toBeGreaterThan(base);
            if (p.riskTolerance > 0.7) expect(share, name).toBeLessThan(base);
        }
        expect(lootableOutfit("outfitBase")).toBe(false);
        expect(lootableOutfit("outfitMedic")).toBe(false);
        expect(lootableOutfit("outfitCamo")).toBe(true);
    });
});

describe("outfit value (cheap, only when it is quiet)", () => {
    it('"any": every new outfit close by, never the basic one, never one it wore', () => {
        const { ctx } = quietCtx();
        ctx.mem.loot2.outfitTaste = { style: "any", likes: [] };
        expect(outfitValue(ctx, "outfitCamo", 6)).toBeGreaterThan(6);
        expect(outfitValue(ctx, "outfitCamo", 20)).toBe(0);
        expect(outfitValue(ctx, "outfitBase", 3)).toBe(0);
        ctx.mem.loot2.outfitsWorn.add("outfitCamo");
        expect(outfitValue(ctx, "outfitCamo", 6)).toBe(0);
        expect(outfitValue(ctx, "outfitKeyLime", 6)).toBeGreaterThan(6);
    });

    it('"liked": only listed outfits ranked above the one it wears', () => {
        const { w, ctx } = quietCtx();
        ctx.mem.loot2.outfitTaste = { style: "liked", likes: ["outfitGhillie", "outfitCamo", "outfitWoodland"] };
        expect(outfitValue(ctx, "outfitKeyLime", 5)).toBe(0);
        expect(outfitValue(ctx, "outfitWoodland", 5)).toBeGreaterThan(0);
        // the best one first
        expect(outfitValue(ctx, "outfitGhillie", 5)).toBeGreaterThan(outfitValue(ctx, "outfitWoodland", 5));
        w.model.self.outfit = "outfitCamo";
        expect(outfitValue(ctx, "outfitWoodland", 5)).toBe(0);
        expect(outfitValue(ctx, "outfitGhillie", 5)).toBeGreaterThan(0);
    });

    it('"never", NEUTRAL and a role outfit: nothing', () => {
        const never = quietCtx().ctx;
        never.mem.loot2.outfitTaste = { style: "never", likes: [] };
        expect(outfitValue(never, "outfitCamo", 5)).toBe(0);
        const neutral = quietCtx(["outfits"], { persona: NEUTRAL }).ctx;
        expect(outfitValue(neutral, "outfitCamo", 5)).toBe(0);
        // (and NEUTRAL drew no habit)
        expect(neutral.mem.loot2.outfitTaste).toBeNull();
        const role = quietCtx();
        role.ctx.mem.loot2.outfitTaste = { style: "any", likes: [] };
        role.w.model.self.outfit = "outfitMedic";
        expect(outfitValue(role.ctx, "outfitCamo", 5)).toBe(0);
    });

    it("never with an enemy in view, after a threat, hurt or in a zone hurry; capped below fights", () => {
        const seen = quietCtx();
        addEnemy(seen.w, 9, { x: 60, y: 0 }, { activeWeapon: "fists", dir: { x: 1, y: 0 } });
        const s = ctxOf(seen.w, ["outfits"], "normal", LOOTER);
        s.mem.loot2.lastThreat = NOW - 10;
        s.mem.loot2.outfitTaste = { style: "any", likes: [] };
        expect(outfitValue(s, "outfitCamo", 5)).toBe(0);
        const shot = quietCtx().ctx;
        shot.mem.loot2.outfitTaste = { style: "any", likes: [] };
        shot.mem.loot2.lastThreat = NOW - 2;
        expect(outfitValue(shot, "outfitCamo", 5)).toBe(0);
        const hurt = quietCtx();
        hurt.ctx.mem.loot2.outfitTaste = { style: "any", likes: [] };
        hurt.w.model.self.health = 45;
        expect(outfitValue(hurt.ctx, "outfitCamo", 5)).toBe(0);
        // the loot score of an outfit stays under every fight / flight / heal / zone score
        const { ctx } = quietCtx();
        const loot = { id: 1, type: "outfitCamo", pos: v2.copy(ctx.self.pos), count: 1, layer: 0, lastSeen: NOW };
        expect(lootScore(ctx, { loot, value: 14, dist: 1 })).toBeLessThanOrEqual(OUTFIT_SCORE);
    });
});

describe("outfits in the simulation", () => {
    const spot = openSpot(flatGame(), 40);

    function outfitGame(items: Array<[string, { x: number; y: number }]>) {
        const game = flatGame({ sandbox: true });
        const p = placePlayer(game, "bot", spot);
        placePlayer(game, "dummy", v2.add(spot, { x: 250, y: 250 }));
        for (const [type, off] of items) game.loot.addLoot(type, v2.add(spot, off), 0, 1, { pushSpeed: 0 });
        return { game, p };
    }

    it('an "any" looter puts on a new outfit close by and never the old one again; a neutral bot never does', () => {
        for (const seed of [1, 2, 3]) {
            const { game, p } = outfitGame([["outfitCamo", { x: 6, y: 2 }]]);
            const bot = new BotController(game, p.id, { seed, persona: "looter" });
            bot.bot.brain.mem.loot2.outfitTaste = { style: "any", likes: [] };
            // quiet from the start (no threat seen yet)
            const took = runUntil(game, [bot], () => p.outfit === "outfitCamo", 600);
            expect(took, `seed ${seed}`).toBeGreaterThan(0);
            runUntil(game, [bot], () => false, 800);
            expect(p.outfit).toBe("outfitCamo");
        }
        const { game, p } = outfitGame([["outfitCamo", { x: 6, y: 2 }]]);
        const bot = new BotController(game, p.id, { seed: 1 });
        runUntil(game, [bot], () => false, 800);
        expect(p.outfit).toBe("outfitBase");
        expect(bot.bot.brain.mem.loot2.outfitTaste).toBeNull();
    });

    it("an outfit lying closer than the item a bot wants is not put on by accident (Loot takes the closest)", () => {
        for (const seed of [1, 2]) {
            const { game, p } = outfitGame([
                ["9mm", { x: 8, y: 0 }],
                ["outfitCamo", { x: 7.3, y: 0.2 }],
            ]);
            giveGun(p, "mp5", 0);
            const bot = new BotController(game, p.id, { seed });
            const got = runUntil(game, [bot], () => p.inv.get("9mm") > 0, 900);
            expect(got, `seed ${seed}`).toBeGreaterThan(0);
            runUntil(game, [bot], () => false, 300);
            expect(p.outfit).toBe("outfitBase");
        }
    });

    it('a "liked" bot climbs its list and leaves the others on the ground', () => {
        const { game, p } = outfitGame([
            ["outfitKeyLime", { x: 3, y: 0 }],
            ["outfitWoodland", { x: 6, y: 4 }],
            ["outfitCamo", { x: -9, y: 3 }],
        ]);
        const bot = new BotController(game, p.id, { seed: 4, persona: "camper" });
        bot.bot.brain.mem.loot2.outfitTaste = { style: "liked", likes: ["outfitCamo", "outfitWoodland"] };
        const worn = new Set<string>();
        runUntil(
            game,
            [bot],
            () => {
                worn.add(p.outfit);
                return false;
            },
            1500,
        );
        expect(p.outfit).toBe("outfitCamo");
        expect(worn.has("outfitKeyLime")).toBe(false);
    });
});
