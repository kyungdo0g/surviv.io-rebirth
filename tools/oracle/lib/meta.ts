// Metadata stamped into every fixture: what produced it and from which inputs.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PROTOCOL_HASH } from "../../../packages/defs/src/registry.ts";
import { type PatchReport, patchSummary } from "./patch.ts";
import { GAME_CONFIG_JSON, GAME_OBJECTS_JSON, NET_SYNC_TPS, SURVEV_COMMIT, TICK_DT } from "./paths.ts";
import { RANDOM_MODE_DOCS } from "./rng.ts";
import type { Survev } from "./survev.ts";

function sha256(file: string): string {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export interface MetaContext {
    sv: Survev;
    patch: PatchReport;
}

export function fixtureMeta(ctx: MetaContext, fixture: string, params: Record<string, unknown>) {
    return {
        fixture,
        generator: "node --experimental-transform-types tools/oracle/run.ts",
        survevCommit: ctx.sv.commit === "unknown" ? SURVEV_COMMIT : ctx.sv.commit,
        defs: {
            protocolHash: PROTOCOL_HASH,
            gameObjectsSha256: sha256(GAME_OBJECTS_JSON),
            gameConfigSha256: sha256(GAME_CONFIG_JSON),
        },
        simulation: {
            dt: TICK_DT,
            netSyncTps: NET_SYNC_TPS,
            note: "game.update(dt) with a fixed dt, game.netSync() at netSyncTps, like survev's game process",
        },
        randomModes: RANDOM_MODE_DOCS,
        patch: patchSummary(ctx.patch),
        params,
    };
}
