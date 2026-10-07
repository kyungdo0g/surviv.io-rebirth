// Network tools reach the web through the HTTP(S)_PROXY environment variables when they are set, which Node's fetch
// honours only with NODE_USE_ENV_PROXY=1, read once when Node starts. The package scripts used to set it with a POSIX
// env prefix (`NODE_USE_ENV_PROXY=1 node ...`) that cmd.exe and PowerShell cannot run; a tool calls this first instead:
// when a proxy is configured and the flag is not set, it runs itself again with the flag and exits with that run's
// code. Without a proxy nothing changes (the flag would do nothing).
import { spawnSync } from "node:child_process";

const PROXY_VARS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] as const;

/** Whether this process must be started again with NODE_USE_ENV_PROXY=1 for `env`. */
export function needsEnvProxyRelaunch(env: NodeJS.ProcessEnv): boolean {
    return !env.NODE_USE_ENV_PROXY && PROXY_VARS.some((v) => !!env[v]);
}

/** Restarts the current script with NODE_USE_ENV_PROXY=1 when a proxy is configured; returns only when not needed. */
export function ensureEnvProxy(): void {
    if (!needsEnvProxyRelaunch(process.env)) return;
    const run = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
        stdio: "inherit",
        env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
    });
    if (run.error) throw run.error;
    process.exit(run.status ?? 1);
}
