// Behaviours added on top of the baseline brain, each behind the BrainFeatures flag that enables it. Brain.think adds an
// option for every enabled entry to the utility choice; a disabled entry is never scored or planned (no rng draws, no
// memory writes), so a bot with every flag off decides exactly like the baseline brain.

import { airdropScore, planAirdrop } from "./airdrop.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { disengageScore, planDisengage } from "./disengage.ts";
import { planRush, rushScore } from "./early.ts";
import { holdScore, planHold } from "./endgame.ts";
import { evadeScore, planEvade } from "./evade.ts";
import { advanceScore, planAdvance, planRally, rallyScore } from "./factionSquad.ts";
import type { BrainFeature } from "./features.ts";
import { guardScore, planGuard } from "./guard.ts";
import { planPuzzle, puzzleScore } from "./puzzle.ts";
import { planSearch, searchScore } from "./search.ts";
import { planEvacuate, strikeScore } from "./strikes.ts";
import { assistScore, planAssist } from "./teamplay.ts";
import { planThirdparty, thirdpartyScore } from "./thirdparty.ts";

export interface ExtensionBehaviour {
    name: BehaviourName;
    /** the flag that enables it */
    feature: BrainFeature;
    /** utility now (0..1, compared with the baseline behaviours' scores) */
    score(ctx: BrainCtx): number;
    plan(ctx: BrainCtx): Intent;
}

export const EXTENSION_BEHAVIOURS: readonly ExtensionBehaviour[] = [
    { name: "disengage", feature: "disengage", score: disengageScore, plan: planDisengage },
    { name: "thirdparty", feature: "thirdparty", score: thirdpartyScore, plan: planThirdparty },
    { name: "guard", feature: "guard", score: guardScore, plan: planGuard },
    { name: "airdrop", feature: "airdrop", score: airdropScore, plan: planAirdrop },
    { name: "hold", feature: "endgame", score: holdScore, plan: planHold },
    { name: "assist", feature: "teamplay", score: assistScore, plan: planAssist },
    // bot overhaul round 3 (MOVE): unseen fire, the search for a lost target, air strikes
    { name: "evade", feature: "pursuit", score: evadeScore, plan: planEvade },
    { name: "search", feature: "pursuit", score: searchScore, plan: planSearch },
    { name: "evacuate", feature: "pursuit", score: strikeScore, plan: planEvacuate },
    // bot round 6 (50v50): the squad to the front, followers in formation (inert outside faction maps)
    { name: "advance", feature: "faction", score: advanceScore, plan: planAdvance },
    { name: "rally", feature: "faction", score: rallyScore, plan: planRally },
    // bot round 6, user report 38: early-game fist rushes at armed enemies
    { name: "rush", feature: "fistRush", score: rushScore, plan: planRush },
    // bot interactions: puzzles, switches, panels and vault doors, and the rooms they open
    { name: "puzzle", feature: "puzzles", score: puzzleScore, plan: planPuzzle },
];
