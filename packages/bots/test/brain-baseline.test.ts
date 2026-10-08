// The baseline stays the baseline: bots with every BrainFeatures flag off never touch the smart brain's memory (no
// feature code path ran) and never compute an assessment, while smart bots in the same fight do; every extension
// behaviour is registered with the flag that enables it.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { EXTENSION_BEHAVIOURS } from "../src/brain/extensions.ts";
import { BRAIN_FEATURES } from "../src/brain/features.ts";
import { SmartMemory } from "../src/brain/smartMemory.ts";
import { BotController } from "../src/controller.ts";
import { flatGame, giveGun, openSpot, placePlayer, runUntil } from "./helpers.ts";

describe("baseline isolation", () => {
    it("baseline bots never write the smart memory; smart bots in the same fight do", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bots = (["baseline", "baseline", "smart", "smart"] as const).map((brain, i) => {
            const p = placePlayer(
                game,
                `${brain}${i}`,
                v2.add(spot, { x: (i % 2) * 24 - 12, y: Math.floor(i / 2) * 18 }),
            );
            giveGun(p, "mp5", 90);
            p.inv.set("bandage", 3);
            return new BotController(game, p.id, { seed: 50 + i, brain });
        });
        runUntil(game, bots, () => false, 1500);
        const fresh = new SmartMemory();
        for (const b of bots.slice(0, 2)) {
            expect(b.bot.brain.mem.smart).toEqual(fresh);
            expect(b.bot.brain.context(game.time).assessment).toBeNull();
        }
        expect(bots.slice(2).some((b) => JSON.stringify(b.bot.brain.mem.smart) !== JSON.stringify(fresh))).toBe(true);
    });

    it("every extension behaviour has a known flag", () => {
        for (const ext of EXTENSION_BEHAVIOURS) expect(BRAIN_FEATURES).toContain(ext.feature);
        expect(EXTENSION_BEHAVIOURS.map((e) => e.name)).toEqual([
            "disengage",
            "thirdparty",
            "guard",
            "airdrop",
            "hold",
            "assist",
            "evade",
            "search",
            "evacuate",
            "advance",
            "rally",
            "rush",
            "puzzle",
        ]);
    });
});
