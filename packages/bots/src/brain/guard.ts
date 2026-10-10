// Guarding (BrainFeatures.guard, team modes): while a teammate revives another (or is being revived), the other
// teammates stand 4-8 units off the downed one, between it and the threat's bearing, in cover when there is some,
// facing the threat and shooting what shows up, instead of looting or wandering off. A revive lasts 8 s
// (GameConfig.player.reviveDuration); the guard is capped a little above that. The smoke a reviver throws on the
// threat line before reviving under pressure lives in brain/team.ts (behind the same flag).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { addCombatLayer, findCoverFrom } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { threatPos } from "./disengage.ts";
import { mates } from "./team.ts";

const GUARD_CAP = GameConfig.player.reviveDuration + 3;
const GUARD_DIST = 6;
const MAX_DIST = 40;

/** The downed teammate a revive is going on for (by another teammate), with the reviver's id. */
function revivedMate(ctx: BrainCtx): { pos: Vec2; id: number } | null {
    const { model, self } = ctx;
    const team = mates(ctx);
    // the reviver plays the revive animation (its action is "revive"); the downed one is the closest downed mate
    const reviver = team.find((m) => !m.downed && m.playerId !== self.id && model.contacts.get(m.playerId)?.reviving);
    const downed = team.filter((m) => m.downed);
    if (!downed.length) return null;
    if (!reviver) {
        const being = downed.find((m) => model.contacts.get(m.playerId)?.reviving);
        return being ? { pos: being.at, id: being.playerId } : null;
    }
    let best = downed[0];
    for (const m of downed) if (v2.distance(m.at, reviver.at) < v2.distance(best.at, reviver.at)) best = m;
    return { pos: best.at, id: best.playerId };
}

/** Utility of guarding a teammate now (0..1); 0 keeps the behaviour out of the choice. */
export function guardScore(ctx: BrainCtx): number {
    if (!ctx.teamMode || !ctx.armed || ctx.self.downed || ctx.self.action.type === "revive") return 0;
    if (ctx.model.inGasNow()) return 0;
    const sm = ctx.mem.smart;
    const m = revivedMate(ctx);
    if (!m || v2.distance(m.pos, ctx.self.pos) > MAX_DIST) {
        sm.guardSince = Number.NEGATIVE_INFINITY;
        return 0;
    }
    if (!Number.isFinite(sm.guardSince)) sm.guardSince = ctx.now;
    if (ctx.now - sm.guardSince > GUARD_CAP) return 0;
    return threatPos(ctx) ? 0.8 : 0.55;
}

export function planGuard(ctx: BrainCtx): Intent {
    const intent = emptyIntent("guard");
    const m = revivedMate(ctx);
    if (!m) return intent;
    const { model, self } = ctx;
    // the threat's bearing: where it was seen or shot from; else face away from the safe zone's centre
    let threat = threatPos(ctx);
    if (!threat) {
        const c = model.gas && model.gas.mode !== "inactive" ? model.gas.posNew : null;
        const out = c ? v2.normalizeSafe(v2.sub(m.pos, c)) : v2.normalizeSafe(v2.sub(self.pos, m.pos));
        threat = v2.add(m.pos, v2.mul(out, 30));
    }
    const dir = v2.normalizeSafe(v2.sub(threat, m.pos));
    const stand = v2.add(m.pos, v2.mul(dir, GUARD_DIST));
    // (out of the water: a guard stands still, and in the river at water speed; owner report 2026-10-08)
    const cover = findCoverFrom(model, stand, threat, 3, (p) => {
        const d = v2.distance(p, m.pos);
        return d >= 4 && d <= 8 && !model.nav.isWaterAt(p);
    });
    const spot = cover ?? stand;
    const cell = model.nav.nearestWalkable(spot, 3, ctx.myComp);
    const goal = cover || cell < 0 ? spot : model.nav.center(cell);
    if (v2.distance(goal, self.pos) > 0.8) {
        intent.goal = goal;
        intent.arriveDist = 0.8;
    } else {
        intent.stop = true;
    }
    intent.lookAt = v2.copy(threat);
    intent.aim = v2.copy(threat);
    addCombatLayer(ctx, intent);
    return intent;
}
