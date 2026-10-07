// Fetches the port inputs: the survev reference clone (.survev, at the pinned commit) and the original client defs
// (research-cache/live/defs.json). Plain Node and git, so it runs the same from cmd.exe, PowerShell and POSIX shells.
// Usage: pnpm survev:fetch (node tools/port-survev/fetch.ts), from any directory.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** survev commit the port, the assets and the oracle fixtures are pinned to */
const SURVEV_COMMIT = "c6185e31fe25a4a07def77a2bb25b1710bda90ac";
const SURVEV_REPO = "https://github.com/survev/survev";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function git(args: string[], quiet = false): string {
    try {
        return (
            execFileSync("git", args, {
                cwd: ROOT,
                encoding: "utf8",
                stdio: ["ignore", quiet ? "pipe" : "inherit", "inherit"],
            }) ?? ""
        );
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
            console.error("error: git is not installed or not on PATH (https://git-scm.com/downloads)");
            process.exit(1);
        }
        throw e;
    }
}

if (!existsSync(join(ROOT, ".survev", ".git"))) {
    git(["clone", SURVEV_REPO, ".survev"]);
    git(["-C", ".survev", "checkout", "--quiet", SURVEV_COMMIT]);
}
const head = git(["-C", ".survev", "rev-parse", "HEAD"], true).trim();
if (head !== SURVEV_COMMIT) {
    // one command per line: Windows PowerShell 5.1 has no &&
    console.error(`error: .survev is at ${head}, expected ${SURVEV_COMMIT}; run:`);
    console.error("       git -C .survev fetch");
    console.error(`       git -C .survev checkout ${SURVEV_COMMIT}`);
    process.exit(1);
}
console.log(`.survev at ${SURVEV_COMMIT}`);

if (!existsSync(join(ROOT, "research-cache", "live", "defs.json"))) {
    execFileSync(process.execPath, ["tools/research/extract-live-defs.ts"], {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
    });
}
console.log("research-cache/live/defs.json present");
