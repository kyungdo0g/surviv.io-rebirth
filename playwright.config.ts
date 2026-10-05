import { defineConfig } from "@playwright/test";

// E2E runs its own client dev server and game server on dedicated ports and never reuses running ones: a server left
// running from earlier work would serve stale code (e.g. an old PROTOCOL_HASH -> invalid_protocol).
const CLIENT_PORT = 5183;
const SERVER_PORT = 8011;

export default defineConfig({
    testDir: "tests/e2e",
    timeout: 60_000,
    fullyParallel: false,
    reporter: [["list"]],
    use: {
        baseURL: `http://127.0.0.1:${CLIENT_PORT}`,
        viewport: { width: 1280, height: 720 },
        launchOptions: {
            args: [
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--ignore-gpu-blocklist",
            ],
        },
    },
    webServer: [
        {
            command: `pnpm --filter @rebirth/client exec vite --port ${CLIENT_PORT} --strictPort`,
            url: `http://127.0.0.1:${CLIENT_PORT}`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: { REBIRTH_SERVER: `127.0.0.1:${SERVER_PORT}` },
        },
        {
            command: "node apps/server/src/index.ts",
            url: `http://127.0.0.1:${SERVER_PORT}/health`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: { PORT: String(SERVER_PORT), HOST: "127.0.0.1", DEBUG_SPAWN_TOGETHER: "1", LOG: "0" },
        },
    ],
});
