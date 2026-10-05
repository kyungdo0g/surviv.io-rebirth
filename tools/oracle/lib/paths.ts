// Locations and pinned versions used by the oracle.
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../../..");
export const SURVEV_DIR = join(ROOT, ".survev");
export const FIXTURES_DIR = join(ROOT, "tools/oracle/fixtures");
export const GAME_OBJECTS_JSON = join(ROOT, "packages/defs/src/generated/gameObjects.json");
export const GAME_CONFIG_JSON = join(ROOT, "packages/defs/src/generated/gameConfig.json");

/** survev commit the fixtures are recorded against (same pin as tools/port-survev/fetch.sh). */
export const SURVEV_COMMIT = "c6185e31fe25a4a07def77a2bb25b1710bda90ac";

/** Fixed simulation step, matching survev's `Config.gameTps` (100) and our `TICK_HZ` (packages/sim/src/api.ts). */
export const TICK_DT = 0.01;
/** Fine step used for a second timing measurement that shows the behaviour without 10 ms quantization. */
export const FINE_DT = 0.001;
/** survev's `Config.netSyncTps`: the oracle calls `game.netSync()` at this rate, as the real game process does. */
export const NET_SYNC_TPS = 33;
