// 50v50 score adjustments (BrainFeatures.faction, bot round 6), applied to the utility options before the choice (like
// steady.ts steadyScores), only while the faction brain runs:
// - local numbers (factionCtx.ts localOdds: standing allies against the enemies the bot and its squad saw within 35 u
//   in the last 6 s): with 1.5 allies per enemy the bot takes the fight it sees (push); clearly outnumbered it does not
//   start one it is not already in (the squad falls back together instead: factionFront.ts);
// - the squad's regroup gives way to the faction's tighter formation ("rally", factionSquad.ts);
// - the Medic revives first; the Lone Survivr fights on (no flight, no break-off, the fight it sees).
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { FACTION_TUNING, factionOf, favourable, localOdds, outnumbered } from "./factionCtx.ts";
import { threatened } from "./fightScore.ts";

/** A push raises an unprovoked fight by this much, up to PUSH_CAP. */
const PUSH_GAIN = 0.15;
const PUSH_CAP = 0.8;
/** Outnumbered, a fight not yet on is capped here. */
const OUTNUMBERED_CAP = 0.3;
/** The Lone Survivr fights what it sees at least this much; its flight and break-off keep this share. */
const LAST_MAN_FIGHT = 0.8;
const LAST_MAN_FLIGHT = 0.4;
/** The Medic's revive score gain and cap. */
const MEDIC_REVIVE_GAIN = 0.12;
const MEDIC_REVIVE_CAP = 0.96;

export function factionScores(ctx: BrainCtx, options: Array<[BehaviourName, number, () => Intent]>): void {
    const fi = factionOf(ctx);
    if (!fi) return;
    const role = fi.role;
    for (const opt of options) {
        switch (opt[0]) {
            case "regroup":
                opt[1] = 0;
                break;
            case "fight":
                opt[1] = fightAdjust(ctx, opt[1], role);
                break;
            case "flee":
            case "disengage":
                if (role === "last_man") opt[1] *= LAST_MAN_FLIGHT;
                break;
            case "revive":
                if (role === "medic" && opt[1] > 0) opt[1] = Math.min(MEDIC_REVIVE_CAP, opt[1] + MEDIC_REVIVE_GAIN);
                break;
        }
    }
}

function fightAdjust(ctx: BrainCtx, s: number, role: string): number {
    const t = ctx.target;
    if (!t || s <= 0 || !t.visible || t.downed || !ctx.armed) return s;
    if (role === "last_man") return Math.max(s, LAST_MAN_FIGHT);
    if (!FACTION_TUNING.fightOdds) return s;
    const odds = localOdds(ctx);
    if (favourable(odds)) return Math.max(s, Math.min(PUSH_CAP, s + PUSH_GAIN));
    if (FACTION_TUNING.outnumberedCap && outnumbered(odds) && !threatened(ctx)) return Math.min(s, OUTNUMBERED_CAP);
    return s;
}
