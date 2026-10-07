// Scheduled unlocks (M5b): MapDef gameConfig.unlocks opens the Cobalt twins bunker's locked doors one every
// `stagger` seconds, `wait` seconds after the gas reaches the timing's circle, each with a ping_unlock marker. The
// default rules follow the ported def (survev's circle 1 + 30 s, survev balance); `unlockOverrides` can restore the
// original timing (circle 2 + 5 s, conflicts.md twins-unlock-time).
import { GameConfig, type GasStage } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Obstacle, unlockTimings } from "../src/index.ts";
import { childObstacles, findBuilding } from "./buildingHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** Stage table with short stages so the circles come quickly (waiting stages keep 1 s, moving stages 0.5 s). */
const FAST_GAS: GasStage[] = GameConfig.gas.stages.map((st, i) =>
    i === 0 ? st : { ...st, duration: i % 2 ? 20 : 0.5 },
);

function cobalt(): { game: Game; doors: Obstacle[] } {
    const game = new Game(
        { mapName: "cobalt", seed: 3 },
        { generation: cachedMap("cobalt", 1), spawnLoot: false, sandbox: true, gasStages: FAST_GAS },
    );
    const twins = findBuilding(game, "bunker_twins_sublevel_01");
    return { game, doors: childObstacles(game, twins, "lab_door_locked_01") };
}

describe("scheduled unlocks", () => {
    it("use survev's twins timing by default and the original one through the overrides", () => {
        const { game } = cobalt();
        expect(unlockTimings("cobalt", game.rules)).toEqual([
            { type: "bunker_twins_sublevel_01", stagger: 0.2, circleIdx: 1, wait: 30 },
        ]);
        expect(
            unlockTimings("cobalt", { unlockOverrides: { bunker_twins_sublevel_01: { circleIdx: 2, wait: 5 } } }),
        ).toEqual([{ type: "bunker_twins_sublevel_01", stagger: 0.2, circleIdx: 2, wait: 5 }]);
        expect(unlockTimings("main", game.rules)).toEqual([]);
    });

    it("open the twins bunker's locked doors one by one, wait s after the circle starts, with pings", () => {
        const { game, doors } = cobalt();
        game.rules.unlockOverrides = { bunker_twins_sublevel_01: { circleIdx: 2, wait: 5 } };
        expect(doors.length).toBe(4);
        for (const d of doors) expect(d.door).toMatchObject({ locked: true, open: false });
        const id = game.addPlayer("watcher");
        game.rules.minActiveTime = 0;
        let circle2Tick = -1;
        const openedAt: number[] = [];
        for (let i = 0; i < 200 * 100 && openedAt.length < doors.length; i++) {
            game.step();
            if (circle2Tick < 0 && game.gas.circleIdx === 2) circle2Tick = game.tick;
            const open = doors.filter((d) => d.door?.open).length;
            while (openedAt.length < open) openedAt.push(game.tick);
        }
        expect(circle2Tick).toBeGreaterThan(0);
        // circle 2 + wait 5 s, then one door every stagger 0.2 s (the first after one stagger, as in survev); the
        // timers start counting in the tick the circle starts (the gas updates first), hence one tick less
        expect(openedAt.map((t) => t - circle2Tick)).toEqual([519, 539, 559, 579]);
        for (const d of doors) expect(d.door).toMatchObject({ locked: false, open: true, canUse: false });
        expect(game.unlocks.unlocked).toBe(4);
        const pings = (game.getSnapshot(id).mapIndicators ?? []).filter((m) => m.type === "ping_unlock");
        expect(pings.length).toBe(4);
    });

    it("follow the def timing without overrides (the default)", () => {
        const { game, doors } = cobalt();
        game.addPlayer("watcher");
        game.rules.minActiveTime = 0;
        let circle1Tick = -1;
        let firstOpen = -1;
        for (let i = 0; i < 200 * 100 && firstOpen < 0; i++) {
            game.step();
            if (circle1Tick < 0 && game.gas.circleIdx === 1) circle1Tick = game.tick;
            if (doors.some((d) => d.door?.open)) firstOpen = game.tick;
        }
        expect(firstOpen - circle1Tick).toBe(3019);
    });
});
