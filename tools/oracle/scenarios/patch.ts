// patch.json: what the defs patch changed in survev (every gameplay value where survev differs from our data).
import type { Ctx, FixtureResult } from "../lib/context.ts";

export function patch(ctx: Ctx): FixtureResult {
    const r = ctx.patch;
    const byType: Record<string, Record<string, number>> = {};
    for (const c of r.gameplayChanges) {
        const counts = (byType[ctx.defs[c.id].type] ??= {});
        counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    }
    return {
        params: {
            source: "packages/defs/src/generated/gameObjects.json + gameConfig.json",
            gameplayTypes: "gun, bullet, melee, throwable, explosion, helmet, chest, heal, boost",
        },
        data: {
            replacedIds: r.replacedIds,
            idsWithChangedValues: r.idsWithChangedValues,
            addedIds: r.addedIds,
            keptSurvevOnlyFields: r.keptSurvevOnly,
            gameplayChangesByType: byType,
            gameplayChanges: r.gameplayChanges,
            gameConfigChanges: r.gameConfigChanges,
            gameConfigNotApplied: r.gameConfigNotApplied,
            verification: r.verification,
        },
    };
}
