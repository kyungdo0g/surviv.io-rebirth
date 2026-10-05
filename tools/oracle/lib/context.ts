// Shared types for fixture scenarios.
import type { PatchReport } from "./patch.ts";
import type { Survev } from "./survev.ts";

export interface Ctx {
    sv: Survev;
    patch: PatchReport;
    /** our gameObjects.json */
    defs: Record<string, any>;
    /** our gameConfig.json */
    config: Record<string, any>;
}

export interface FixtureResult {
    /** scenario parameters, copied into meta.params */
    params: Record<string, unknown>;
    /** fixture body (merged next to `meta`) */
    data: Record<string, unknown>;
}

export type Scenario = (ctx: Ctx) => FixtureResult;

export function idsOfType(defs: Record<string, any>, type: string): string[] {
    return Object.keys(defs).filter((id) => defs[id].type === type);
}
