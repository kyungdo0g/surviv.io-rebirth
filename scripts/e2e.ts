// `pnpm e2e [playwright test args]`: runs the Playwright suite from any shell (cmd.exe and PowerShell cannot run a
// POSIX env prefix). Uses the preinstalled browsers at /opt/pw-browsers when they exist and PLAYWRIGHT_BROWSERS_PATH
// is not set (the development container), else Playwright's own browser location (`npx playwright install chromium`).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const PREINSTALLED = "/opt/pw-browsers";
const env = { ...process.env };
if (!env.PLAYWRIGHT_BROWSERS_PATH && existsSync(PREINSTALLED)) env.PLAYWRIGHT_BROWSERS_PATH = PREINSTALLED;
const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const run = spawnSync(process.execPath, [cli, "test", ...process.argv.slice(2)], { stdio: "inherit", env });
if (run.error) throw run.error;
process.exit(run.status ?? 1);
