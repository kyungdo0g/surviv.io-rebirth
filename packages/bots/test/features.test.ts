// Brain contracts: feature presets and helpers, the extension behaviours offered only while their flag is on, the
// emote / ping plumbing from an Intent to the game, the inert threat board and intel every model starts with, and the
// motor parameters of every difficulty.
import { v2 } from "@rebirth/core";
import type { EmoteRequest } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { EXTENSION_BEHAVIOURS } from "../src/brain/extensions.ts";
import {
    BRAIN_FEATURES,
    BRAIN_PRESETS,
    brainFeatures,
    brainLabel,
    DEFAULT_BRAIN,
    SMART_EXCLUDED,
    withFeatures,
} from "../src/brain/features.ts";
import { BotController } from "../src/controller.ts";
import { DIFFICULTIES, DIFFICULTY_PRESETS } from "../src/difficulty.ts";
import { flatGame, openSpot, placePlayer, runUntil } from "./helpers.ts";

describe("brain features", () => {
    it("presets: baseline has every flag off, smart every flag but the excluded ones on", () => {
        for (const f of BRAIN_FEATURES) {
            expect(BRAIN_PRESETS.baseline[f]).toBe(false);
            expect(BRAIN_PRESETS.smart[f]).toBe(!SMART_EXCLUDED.includes(f));
        }
        expect(SMART_EXCLUDED.every((f) => BRAIN_FEATURES.includes(f))).toBe(true);
        expect(brainFeatures(undefined)).toBe(BRAIN_PRESETS[DEFAULT_BRAIN]);
        expect(brainLabel(brainFeatures("smart"))).toBe("smart");
        const ablation = withFeatures(BRAIN_PRESETS.baseline, ["cover", "assess"]);
        expect(brainLabel(ablation)).toBe("custom");
        expect(BRAIN_FEATURES.filter((f) => ablation[f])).toEqual(["assess", "cover"]);
        const smartList = BRAIN_FEATURES.filter((f) => !SMART_EXCLUDED.includes(f));
        expect(brainLabel(withFeatures(BRAIN_PRESETS.baseline, smartList))).toBe("smart");
    });

    it("extension behaviours are offered only while their flag is on", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bots = (["baseline", "smart"] as const).map((brain, i) => {
            const p = placePlayer(game, brain, v2.add(spot, { x: i * 30, y: 0 }));
            return new BotController(game, p.id, { seed: 3, brain });
        });
        runUntil(game, bots, () => false, 30);
        const [base, smart] = bots.map((b) => b.bot);
        expect(base.features).toBe(BRAIN_PRESETS.baseline);
        expect(smart.brainName).toBe("smart");
        for (const ext of EXTENSION_BEHAVIOURS) {
            expect(base.brain.lastScores[ext.name]).toBeUndefined();
            expect(smart.brain.lastScores[ext.name]).toBe(0);
        }
        expect(base.brain.context(game.time).features).toBe(base.features);
    });

    it("an Intent's emote reaches the game once: pings with their position, emotes without", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const p = placePlayer(game, "bot", spot);
        const ctrl = new BotController(game, p.id, { seed: 1 });
        const sent: EmoteRequest[] = [];
        game.emote = (_id, req) => sent.push(req);
        const queue = [
            { type: "ping_danger", pos: v2.add(spot, { x: 5, y: 2 }) },
            { type: "emote_thumbsup", pos: spot },
        ];
        ctrl.bot.brain.think = () => {
            const intent = emptyIntent("idle");
            const e = queue.shift();
            if (e) intent.emote = e;
            return intent;
        };
        runUntil(game, [ctrl], () => false, 40);
        expect(sent).toEqual([
            { type: "ping_danger", isPing: true, pos: v2.add(spot, { x: 5, y: 2 }) },
            { type: "emote_thumbsup", isPing: false },
        ]);
        expect(ctrl.bot.takeEmote()).toBeNull();
    });

    it("every model starts with an inert threat board and intel", () => {
        const game = flatGame({ sandbox: true });
        const p = placePlayer(game, "bot", openSpot(game));
        const ctrl = new BotController(game, p.id, { seed: 1 });
        runUntil(game, [ctrl], () => false, 10);
        const m = ctrl.bot.model;
        expect(m.threats.heat(m.self.pos, 50)).toBe(0);
        expect(m.threats.unseenShooters()).toEqual([]);
        expect(m.threats.reported()).toEqual([]);
        expect(m.threats.dangerZones()).toEqual([]);
        expect(m.threats.airdrops()).toEqual([]);
        expect(m.intel.of(12345)).toEqual({ estHealth: 100, action: null, justFought: false });
    });

    it("every difficulty carries motor parameters, the human model, finer for harder presets", () => {
        const [easy, normal, hard] = DIFFICULTIES.map((d) => DIFFICULTY_PRESETS[d].motor);
        for (const m of [easy, normal, hard]) expect(m.model).toBe("human");
        // calibrated against the legacy aim with scripts/aimbench.ts (test/fixtures/aim-baseline.json)
        expect(normal).toMatchObject({ fittsA: 0.05, fittsB: 0.05, pursuitKp: 7, confirmDelay: 0.07 });
        expect(easy.endpointSigma).toBeGreaterThan(normal.endpointSigma);
        expect(normal.endpointSigma).toBeGreaterThan(hard.endpointSigma);
        expect(easy.fittsB).toBeGreaterThan(normal.fittsB);
        expect(normal.fittsB).toBeGreaterThan(hard.fittsB);
        expect(easy.pursuitLag).toBeGreaterThan(normal.pursuitLag);
        expect(normal.pursuitLag).toBeGreaterThan(hard.pursuitLag);
        expect(easy.pursuitPred).toBeLessThan(hard.pursuitPred);
    });
});
