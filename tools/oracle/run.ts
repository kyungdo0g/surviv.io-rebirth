// Records golden fixtures by running the survev reference simulation in-process with our definitions.
//
//   node --experimental-transform-types tools/oracle/run.ts [fixture...]
//
// Without arguments every fixture is regenerated. See tools/oracle/README.md.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Ctx, Scenario } from "./lib/context.ts";
import { biomeFormat, writeFixture } from "./lib/json.ts";
import { fixtureMeta } from "./lib/meta.ts";
import { patchSurvev, readOurGameConfig, readOurGameObjects } from "./lib/patch.ts";
import { FIXTURES_DIR } from "./lib/paths.ts";
import { restoreNativeRandom } from "./lib/rng.ts";
import { loadSurvev } from "./lib/survev.ts";
import { boost } from "./scenarios/boost.ts";
import { damage } from "./scenarios/damage.ts";
import { gas } from "./scenarios/gas.ts";
import { heal } from "./scenarios/heal.ts";
import { melee } from "./scenarios/melee.ts";
import { movement } from "./scenarios/movement.ts";
import { patch } from "./scenarios/patch.ts";
import { revive } from "./scenarios/revive.ts";
import { ttk } from "./scenarios/ttk.ts";
import { weapons } from "./scenarios/weapons.ts";

const SCENARIOS: Record<string, Scenario> = {
    patch,
    weapons,
    ttk,
    damage,
    melee,
    movement,
    gas,
    boost,
    heal,
    revive,
};

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const unknown = args.filter((a) => !(a in SCENARIOS));
    if (unknown.length) {
        console.error(`unknown fixture(s): ${unknown.join(", ")}; known: ${Object.keys(SCENARIOS).join(", ")}`);
        process.exit(2);
    }
    const names = args.length ? args : Object.keys(SCENARIOS);

    const sv = await loadSurvev();
    const report = patchSurvev(sv);
    const ctx: Ctx = { sv, patch: report, defs: readOurGameObjects(), config: readOurGameConfig() };
    console.log(
        `survev ${sv.commit.slice(0, 8)}: ${report.replacedIds} defs replaced (${report.idsWithChangedValues} changed), ` +
            `${report.addedIds.length} added, ${report.gameConfigChanges.length} GameConfig values changed`,
    );

    mkdirSync(FIXTURES_DIR, { recursive: true });
    const written: string[] = [];
    for (const name of names) {
        const started = performance.now();
        const result = SCENARIOS[name](ctx);
        const file = join(FIXTURES_DIR, `${name}.json`);
        writeFixture(file, { meta: fixtureMeta(ctx, name, result.params), ...result.data });
        written.push(file);
        console.log(`${name}.json written in ${((performance.now() - started) / 1000).toFixed(1)} s`);
    }
    restoreNativeRandom();
    biomeFormat(written);
}

await main();
