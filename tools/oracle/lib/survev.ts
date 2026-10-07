// Loads the survev reference server modules in-process. Everything survev exports is typed `any` on purpose:
// the modules are imported dynamically by URL so `tsc` never type-checks the .survev sources.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { installSurvevHooks } from "./hooks.ts";
import { SURVEV_COMMIT, SURVEV_DIR } from "./paths.ts";
import { type HeadshotMode, seeded, useRandom } from "./rng.ts";

export interface Survev {
    Game: any;
    Config: any;
    GameConfig: any;
    TeamMode: any;
    GameObjectDefs: any;
    RawGameObjectDefs: any;
    BulletDefs: any;
    GunDefs: any;
    MapDefs: any;
    InputMsg: any;
    PerkProperties: any;
    util: any;
    v2: any;
    commit: string;
    /** survev's own GameConfig.player.headshotChance before the oracle touches it */
    defaultHeadshotChance: number;
}

async function importSurvev(rel: string): Promise<any> {
    const file = join(SURVEV_DIR, rel);
    if (!existsSync(file)) throw new Error(`${file} missing: run pnpm survev:fetch`);
    return import(pathToFileURL(file).href);
}

function survevHead(): string {
    try {
        return execFileSync("git", ["-C", SURVEV_DIR, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
        return "unknown";
    }
}

let loaded: Survev | undefined;

export async function loadSurvev(): Promise<Survev> {
    if (loaded) return loaded;
    if (!existsSync(join(SURVEV_DIR, "node_modules/hjson"))) {
        throw new Error(
            ".survev dependencies missing: run `pnpm install --frozen-lockfile --ignore-scripts " +
                "--filter survev --filter @survev/shared` inside .survev (see tools/oracle/README.md)",
        );
    }
    const commit = survevHead();
    if (commit !== SURVEV_COMMIT) {
        console.warn(`warning: .survev is at ${commit}, fixtures are pinned to ${SURVEV_COMMIT}`);
    }
    installSurvevHooks();
    // module initialisation may call Math.random: make it reproducible too
    useRandom(seeded(0x5eed));

    const [config, game, gameConfig, register, rawDefs, bulletDefs, gunDefs, mapDefs, inputMsg, perkDefs, util, v2] =
        await Promise.all([
            importSurvev("server/src/config.ts"),
            importSurvev("server/src/game/game.ts"),
            importSurvev("shared/gameConfig.ts"),
            importSurvev("shared/defs/register.ts"),
            importSurvev("shared/defs/gameObjectDefs.ts"),
            importSurvev("shared/defs/gameObjects/bulletDefs.ts"),
            importSurvev("shared/defs/gameObjects/gunDefs.ts"),
            importSurvev("shared/defs/mapDefs.ts"),
            importSurvev("shared/net/inputMsg.ts"),
            importSurvev("shared/defs/gameObjects/perkDefs.ts"),
            importSurvev("shared/utils/util.ts"),
            importSurvev("shared/utils/v2.ts"),
        ]);

    const Config = config.Config;
    Config.logging.logDate = false;
    Config.logging.debugLogs = false;
    Config.logging.infoLogs = false;
    Config.logging.warnLogs = false;
    Config.logging.errorLogs = true;

    loaded = {
        Game: game.Game,
        Config,
        GameConfig: gameConfig.GameConfig,
        TeamMode: gameConfig.TeamMode,
        GameObjectDefs: register.GameObjectDefs,
        RawGameObjectDefs: rawDefs.RawGameObjectDefs,
        BulletDefs: bulletDefs.BulletDefs,
        GunDefs: gunDefs.GunDefs,
        MapDefs: mapDefs.MapDefs,
        InputMsg: inputMsg.InputMsg,
        PerkProperties: perkDefs.PerkProperties,
        util: util.util,
        v2: v2.v2,
        commit,
        defaultHeadshotChance: gameConfig.GameConfig.player.headshotChance,
    };
    return loaded;
}

export function setHeadshotMode(sv: Survev, mode: HeadshotMode): void {
    sv.GameConfig.player.headshotChance = mode === "never" ? 0 : mode === "always" ? 1 : sv.defaultHeadshotChance;
}
