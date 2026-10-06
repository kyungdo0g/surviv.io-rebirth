// Behaviours added on top of the baseline brain, each behind the BrainFeatures flag that enables it. Brain.think adds an
// option for every enabled entry to the utility choice; a disabled entry is never scored or planned (no rng draws, no
// memory writes), so a bot with every flag off decides exactly like the baseline brain.

import { airdropScore, planAirdrop } from "./airdrop.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { disengageScore, planDisengage } from "./disengage.ts";
import { holdScore, planHold } from "./endgame.ts";
import type { BrainFeature } from "./features.ts";
import { guardScore, planGuard } from "./guard.ts";
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
];
