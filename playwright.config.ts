import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "tests/e2e",
    timeout: 60_000,
    fullyParallel: false,
    reporter: [["list"]],
    use: {
        baseURL: "http://127.0.0.1:5173",
        viewport: { width: 1280, height: 720 },
        launchOptions: {
            args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
        },
    },
    webServer: {
        command: "pnpm --filter @rebirth/client dev",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
