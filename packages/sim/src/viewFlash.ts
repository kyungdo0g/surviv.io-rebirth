// Contract type of the rebirth flashbang (the owner, 2026-10-10; docs/research/rebirth-deviations.md "Molotov and
// flashbang"), re-exported from view.ts; consumers import it from "@rebirth/sim".

/**
 * The active player was caught by a flashbang since its previous snapshot (rebirth, Snapshot.flash; the strongest one
 * when several went off). Strengths are 0..1: the client whites the screen out for `blind` x the def's blindTime and
 * muffles its audio for `deaf` x deafTime (defs FLASHBANG_FLASH). `blind` is 0 when a wall hid the bang.
 */
export interface FlashEvent {
    blind: number;
    deaf: number;
}
