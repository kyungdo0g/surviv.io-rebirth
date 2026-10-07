// Bundle-size budget (M8): builds the client (skip with --no-build) and fails when the main JS bundle, the entry chunk
// that apps/client/dist/index.html loads, is larger than scripts/bundle-budget.json allows (raw and gzip bytes).
// Usage: pnpm check:bundle [--no-build]. docs/deploy.md "Bundle budget" explains how the numbers were set.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "apps/client/dist");
const BUDGET_FILE = join(ROOT, "scripts/bundle-budget.json");

interface Budget {
    mainJsBytes: number;
    mainJsGzipBytes: number;
}

const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;

if (!process.argv.includes("--no-build")) {
    const build = ["--filter", "@rebirth/client", "build"];
    // under `pnpm check:bundle` npm_execpath is pnpm's own script: run it with this Node, since Windows cannot start
    // the pnpm.cmd shim without a shell; started some other way, fall back to pnpm on the PATH
    const pnpm = process.env.npm_execpath;
    if (pnpm && /\.[cm]?js$/.test(pnpm))
        execFileSync(process.execPath, [pnpm, ...build], { cwd: ROOT, stdio: "inherit" });
    else execFileSync("pnpm", build, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
}

const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8")) as Budget;
const html = readFileSync(join(DIST, "index.html"), "utf8");
const entry = /<script[^>]*type="module"[^>]*src="\/?([^"]+\.js)"/.exec(html)?.[1];
if (!entry) {
    console.error("check:bundle: no module script in apps/client/dist/index.html");
    process.exit(1);
}
const file = join(DIST, entry);
const bytes = readFileSync(file);
const raw = statSync(file).size;
const gzip = gzipSync(bytes, { level: 9 }).length;
const rows = [
    { what: "raw", size: raw, limit: budget.mainJsBytes },
    { what: "gzip", size: gzip, limit: budget.mainJsGzipBytes },
];
let failed = false;
console.log(`main bundle ${entry}`);
for (const r of rows) {
    const over = r.size > r.limit;
    failed ||= over;
    const pct = ((r.size / r.limit) * 100).toFixed(1);
    console.log(
        `  ${r.what.padEnd(4)} ${kb(r.size).padStart(10)} of ${kb(r.limit).padStart(10)} (${pct}%)${over ? "  OVER BUDGET" : ""}`,
    );
}
if (failed) {
    console.error("check:bundle: the main bundle is over budget (scripts/bundle-budget.json, docs/deploy.md)");
    process.exit(1);
}
console.log("check:bundle: within budget");
