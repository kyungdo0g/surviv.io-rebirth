// Gun tier rebuild, step 3 (docs/design/gun-tiers.md 2.7 and 3): computes the variant metrics (no deliberate aim,
// SKILL_SIGMA band midpoints, a stationary target) that are missing, scores the stationary one for the launcher table,
// and writes how many tiered guns change their stat tier under other weights or model inputs (sens.txt).
// usage (repo root, after compute.ts): node tools/research/gun-tiers/sens.ts  [env FRESH=1 recomputes the variants]
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve("research-cache/gun-tiers");
const HERE = new URL(".", import.meta.url).pathname;
const ORDER = ["S", "S-aim", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];

/** variant metrics: file, environment for compute.ts */
const VARIANTS: Array<[string, Record<string, string>]> = [
    ["metrics-notau.json", { AIM_TAU: "inf" }],
    ["metrics-sigma.json", { SIGMAS: "1.8,3.2,6.2" }],
    ["metrics-still.json", { DODGE: "0" }],
];

function runNode(args: string[], env: Record<string, string>): Promise<void> {
    return new Promise((done, fail) => {
        const p = spawn("node", args, { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "inherit"] });
        p.on("exit", (code) => (code === 0 ? done() : fail(new Error(`${args.join(" ")} exited ${code}`))));
    });
}

await Promise.all(
    VARIANTS.filter(([file]) => process.env.FRESH || !existsSync(`${DIR}/${file}`)).map(([file, env]) =>
        runNode([`${HERE}compute.ts`], { ...env, OUT: `${DIR}/${file}` }),
    ),
);
await runNode([`${HERE}score.ts`, `${DIR}/metrics-still.json`, `${DIR}/tiers-still.json`], { QUIET: "1" });

async function statTiers(metrics: string, env: Record<string, string> = {}): Promise<Map<string, string>> {
    const out = `${DIR}/sens-tmp.json`;
    await runNode([`${HERE}score.ts`, `${DIR}/${metrics}`, out], { ...env, QUIET: "1" });
    const j = JSON.parse(readFileSync(out, "utf8"));
    return new Map<string, string>(
        j.rows.filter((r: { inRows: boolean }) => r.inRows).map((r: { id: string; stat: string }) => [r.id, r.stat]),
    );
}

const base = await statTiers("metrics.json");
const cases: Array<[string, string, Record<string, string>]> = [
    ["no deliberate aim (critique's fixed sigma)", "metrics-notau.json", {}],
    ["SKILL_SIGMA band midpoints 1.8 / 3.2 / 6.2", "metrics-sigma.json", {}],
    ["role 0.26 / range 0.20", "metrics.json", { W_JSON: '{"role":0.26,"range":0.2}' }],
    ["no damage-per-shot term (alpha 0, role 0.40)", "metrics.json", { W_JSON: '{"alpha":0,"role":0.4}' }],
    ["sustain 0.12, role 0.38", "metrics.json", { W_JSON: '{"sustain":0.12,"role":0.38}' }],
    ["handling 0.10, role 0.40", "metrics.json", { W_JSON: '{"handling":0.1,"role":0.4}' }],
];
const lines: string[] = [];
for (const [name, metrics, env] of cases) {
    const alt = await statTiers(metrics, env);
    let one = 0;
    const big: string[] = [];
    for (const [id, t] of base) {
        const a = alt.get(id) as string;
        const steps = Math.abs(ORDER.indexOf(a) - ORDER.indexOf(t));
        if (steps >= 1) one++;
        if (steps >= 2) big.push(`${id} ${t}->${a}`);
    }
    lines.push(
        `${name}: ${one} change 1+ step, ${big.length} change 2+ steps${big.length ? `: ${big.join(", ")}` : ""}`,
    );
}
writeFileSync(`${DIR}/sens.txt`, `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
