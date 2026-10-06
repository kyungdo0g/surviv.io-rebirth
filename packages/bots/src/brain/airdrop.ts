// Air drop contesting (BrainFeatures.airdrop; wave 2): go for an air drop the bot knows about (ThreatBoard.airdrops:
// map indicator, plane, falling crate) when it is worth the risk, or hold an angle on it and ambush the players it
// attracts. Stub: never chosen until implemented.
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

/** Utility of contesting an air drop now (0..1); 0 keeps the behaviour out of the choice. */
export function airdropScore(_ctx: BrainCtx): number {
    return 0;
}

export function planAirdrop(_ctx: BrainCtx): Intent {
    return emptyIntent("airdrop");
}
