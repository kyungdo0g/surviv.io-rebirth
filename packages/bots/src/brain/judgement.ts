// Judging a fight (round 4, user report 30: beginners "misjudge when to fight or run"). The assessment (assess.ts) is
// arithmetic on what the bot sees; a player's belief about a fight is not. A bot with game sense below the average
// carries a belief error for each engagement, drawn once when it first sizes the target up (or again once the target
// has been out of mind for BELIEF_GAP seconds) and kept, so it does not flicker between thinks:
//   error = DifficultyParams.overconfidence + N(0, DifficultyParams.misjudge)   (ln of the time-to-kill ratio)
// added to the advantage the fight decisions read (fightScore, disengage, cover, holdFire, third parties, air drops).
// skill.ts interpolates both in g from the easy preset (0.3 and 0.6: a beginner mostly thinks it wins, and is off by
// about a factor of 1.8 in time to kill either way) to the normal and hard presets (0: the assessment itself, whose own
// approximations are an average player's judgement). The draw comes from the persona/skill stream (ctx.personaRng),
// never from the brain's rng; a bot with both fields at 0 draws nothing and reads the assessment unchanged.
import { gaussian } from "../motor/noise.ts";
import type { Assessment } from "./assess.ts";
import type { BrainCtx } from "./context.ts";

/** A target out of the bot's mind this long (not assessed) is sized up afresh: a new belief. */
const BELIEF_GAP = 8;
/** The assessment's clamp (assess.ts MAX_A). */
const MAX_A = 3;

/** The assessment as the bot believes it: its advantages shifted by the engagement's belief error. */
export function judged(ctx: BrainCtx, a: Assessment): Assessment {
    const { misjudge, overconfidence } = ctx.params;
    if (misjudge <= 0 && overconfidence === 0) return a;
    const f = ctx.mem.fight;
    if (f.beliefTarget !== a.targetId || ctx.now - f.beliefSeen > BELIEF_GAP) {
        f.beliefTarget = a.targetId;
        f.beliefError = overconfidence + (misjudge > 0 ? gaussian(ctx.personaRng) * misjudge : 0);
        const mood = f.beliefError >= 0 ? "bold" : "timid";
        f.trace.add(ctx.now, "judge", `${mood} ${f.beliefError.toFixed(2)} vs ${a.targetId}`);
    }
    f.beliefSeen = ctx.now;
    const e = f.beliefError;
    const shift = (x: number) => Math.max(-MAX_A, Math.min(MAX_A, x + e));
    return { ...a, advantage: shift(a.advantage), openAdvantage: shift(a.openAdvantage) };
}
