// Module hooks that let survev's in-process Game load without the server workspace's dependencies.
//
// - `server/src/utils/badWords.ts` imports `obscenity` (a server-workspace dependency that is not installed,
//   because installing that workspace also fetches the uWebSockets.js git dependency). Only
//   `validateUserName` is reachable from the Game, so the module is replaced by a passthrough stub.
// - `zod` is imported (for types only, but Node keeps the import) by `server/src/utils/types.ts`; it is
//   resolved from the installed `shared` workspace instead.
// - `.survev/config.ts` reads `survev-config.hjson` (and creates it when missing). The oracle must not depend on
//   a local config, so the file access is disabled in the loaded source and survev's defaults are used.
import { registerHooks } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { SURVEV_DIR } from "./paths.ts";

const BAD_WORDS_URL = pathToFileURL(join(SURVEV_DIR, "server/src/utils/badWords.ts")).href;
const CONFIG_URL = pathToFileURL(join(SURVEV_DIR, "config.ts")).href;
const SHARED_PARENT_URL = pathToFileURL(join(SURVEV_DIR, "shared/gameConfig.ts")).href;

const BAD_WORDS_STUB = `
export function checkForBadWords(_name) { return false; }
export function validateUserName(name) {
    const validName = typeof name === "string" && name.trim() ? name.trim() : "Player";
    return { originalWasInvalid: validName !== name, validName };
}
`;

function patchConfigSource(source: string): string {
    const replacements: Array<[string | RegExp, string]> = [
        ["fs.existsSync(configPath)", "false"],
        ["fs.writeFileSync(", "void ("],
        [/console\.log\([^;]*\);/g, ""],
    ];
    let out = source;
    for (const [from, to] of replacements) {
        const next = out.replace(from, to);
        if (next === out) throw new Error(`oracle hooks: pattern ${String(from)} not found in .survev/config.ts`);
        out = next;
    }
    return out;
}

let installed = false;

export function installSurvevHooks(): void {
    if (installed) return;
    installed = true;
    registerHooks({
        resolve(specifier, context, nextResolve) {
            if (specifier === "zod" && context.parentURL?.startsWith(pathToFileURL(SURVEV_DIR).href)) {
                return nextResolve(specifier, { ...context, parentURL: SHARED_PARENT_URL });
            }
            return nextResolve(specifier, context);
        },
        load(url, context, nextLoad) {
            if (url === BAD_WORDS_URL) {
                return { format: "module", source: BAD_WORDS_STUB, shortCircuit: true };
            }
            const result = nextLoad(url, context);
            if (url === CONFIG_URL && result.source !== undefined) {
                return { ...result, source: patchConfigSource(String(result.source)) };
            }
            return result;
        },
    });
}
