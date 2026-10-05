// boost.json: health regeneration, decay and speed as a function of the boost (adrenaline) value.
import type { Ctx, FixtureResult } from "../lib/context.ts";
import { Harness } from "../lib/harness.ts";
import { CENTERED } from "../lib/rng.ts";

const STEP_VALUES = Array.from({ length: 21 }, (_, i) => i * 5);
const EDGE_VALUES = [0.01, 24.99, 25.01, 49.99, 50.01, 87.49, 87.5, 87.51, 99.99];

export function boost(ctx: Ctx): FixtureResult {
    const h = new Harness(ctx.sv, { seed: 81 });
    h.setMode(CENTERED, "never");
    let row = 0;
    const fresh = () => {
        const p = h.addPlayer(h.rowPos(row++, 6));
        h.stepSeconds(1);
        return p;
    };

    /** One tick at boost b (health 50, walking): regen and decay rates and the speed of that tick. */
    const instant = (b: number) => {
        const p = fresh();
        p.health = 50;
        p.boost = b;
        const x = p.pos.x;
        h.hold(p, { moveRight: true });
        h.step();
        h.hold(p, {});
        return {
            boost: b,
            regenPerSecond: (p.health - 50) / h.dt,
            decayPerSecond: (b - p.boost) / h.dt,
            speed: (p.pos.x - x) / h.dt,
        };
    };

    /** One second (100 ticks) starting at boost b without intervention (health starts at 10). */
    const natural = (b: number) => {
        const p = fresh();
        p.health = 10;
        p.boost = b;
        h.stepSeconds(1);
        return { boost: b, healthGained: p.health - 10, boostAfter: p.boost };
    };

    /** Full boost (100) left to decay to 0 with health held at 1: total healing and time. */
    const full = () => {
        const p = fresh();
        p.boost = 100;
        let healed = 0;
        const start = h.tick;
        while (p.boost > 0 && h.span(start, h.tick) < 400) {
            p.health = 1;
            h.step();
            healed += p.health - 1;
        }
        return { seconds: h.span(start, h.tick), totalHealing: healed };
    };

    const values = [...new Set([...STEP_VALUES, ...EDGE_VALUES])].sort((a, b) => a - b);
    const { player } = ctx.sv.GameConfig;
    return {
        params: {
            instant: "boost and health (50) set, one tick walking right: rates are deltas / dt",
            natural: "boost set once, health 10, 100 ticks standing still",
            fullDecay: "boost 100, health reset to 1 before every tick until boost reaches 0",
        },
        data: {
            config: {
                boostDecay: player.boostDecay,
                boostBreakpoints: player.boostBreakpoints,
                boostHealAmounts: player.boostHealAmounts,
                boostMoveSpeed: player.boostMoveSpeed,
            },
            notes: [
                "heal per second uses the boost before this tick's decay; the band is the last breakpoint band " +
                    "with prev <= boost <= max, so a value exactly on a breakpoint (25, 50, 87.5) heals at the higher band",
                "the +boostMoveSpeed bonus needs boost >= 50 after this tick's decay (boost 50 exactly decays to 49.996 " +
                    "first and gets no bonus)",
                "no regeneration at boost 0; downed players lose all boost",
            ],
            instant: values.map(instant),
            natural: values.map(natural),
            fullDecay: full(),
        },
    };
}
