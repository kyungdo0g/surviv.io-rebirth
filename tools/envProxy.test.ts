// tools/envProxy.ts: a tool behind a proxy restarts itself with NODE_USE_ENV_PROXY=1 (what the POSIX-only script
// prefix used to set), keeping its arguments and exit code; without a proxy it runs as it is.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { needsEnvProxyRelaunch } from "./envProxy.ts";

describe("ensureEnvProxy", () => {
    it("relaunches only when a proxy is set and the flag is not", () => {
        expect(needsEnvProxyRelaunch({})).toBe(false);
        expect(needsEnvProxyRelaunch({ HTTPS_PROXY: "http://proxy:3128" })).toBe(true);
        expect(needsEnvProxyRelaunch({ http_proxy: "http://proxy:3128" })).toBe(true);
        expect(needsEnvProxyRelaunch({ HTTPS_PROXY: "http://proxy:3128", NODE_USE_ENV_PROXY: "1" })).toBe(false);
        expect(needsEnvProxyRelaunch({ HTTPS_PROXY: "" })).toBe(false);
    });

    it("runs the script again with the flag, its arguments and its exit code", () => {
        const dir = mkdtempSync(join(tmpdir(), "env-proxy-"));
        try {
            const script = join(dir, "tool.ts");
            const lib = pathToFileURL(join(import.meta.dirname, "envProxy.ts")).href;
            writeFileSync(
                script,
                `import { ensureEnvProxy } from ${JSON.stringify(lib)};\n` +
                    "ensureEnvProxy();\n" +
                    "console.log(JSON.stringify({ flag: process.env.NODE_USE_ENV_PROXY ?? null, args: process.argv.slice(2) }));\n" +
                    "process.exit(3);\n",
            );
            const base = { ...process.env };
            for (const v of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NODE_USE_ENV_PROXY"])
                delete base[v];
            const run = (env: NodeJS.ProcessEnv) =>
                spawnSync(process.execPath, [script, "--x", "y"], { env, encoding: "utf8" });
            const proxied = run({ ...base, HTTPS_PROXY: "http://127.0.0.1:9" });
            expect(proxied.status).toBe(3);
            expect(JSON.parse(proxied.stdout.trim())).toEqual({ flag: "1", args: ["--x", "y"] });
            const direct = run(base);
            expect(direct.status).toBe(3);
            expect(JSON.parse(direct.stdout.trim())).toEqual({ flag: null, args: ["--x", "y"] });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
