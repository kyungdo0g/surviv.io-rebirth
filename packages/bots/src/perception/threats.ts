// The threat board (wave 2, BrainFeatures.threats): what a player knows beyond the enemies on its screen, built only
// from what its snapshots carry, like the original client shows it: bullets and their sound from off-screen shooters,
// explosions, the kill feed, air drop and air strike indicators, teammates' pings. WorldModel.observe feeds every
// snapshot to `ingest`; behaviours read it through `ctx.model.threats` while `ctx.features.threats` is on.
//
// NO_THREATS is the inert board every WorldModel starts with (nothing known, heat 0): installing a real board is the
// only way to change what the brain sees, so bots without the feature keep deciding exactly as before.
import type { Vec2 } from "@rebirth/core";
import type { Snapshot } from "@rebirth/sim";
import type { WorldModel } from "./world.ts";

/** What a threat entry comes from. */
export type ThreatKind = "gunfire" | "explosion" | "kill" | "ping" | "airstrike" | "airdrop" | "grenade";

/** An enemy heard (its bullets crossed the bot's snapshot) but not on screen. */
export interface UnseenShooter {
    /** shooter player id */
    id: number;
    /** estimated position (where its latest bullets started) */
    pos: Vec2;
    /** game time of its latest reported bullet */
    lastShot: number;
    /** shots reported since it was first heard */
    shots: number;
    /** weapon that fired (GameObjectDefs id) */
    weapon: string;
}

/** A position someone else flagged: a teammate's ping, a kill in the feed with a known place. */
export interface ReportedThreat {
    kind: ThreatKind;
    pos: Vec2;
    /** game time it was reported */
    time: number;
    /** player who reported it (the pinging teammate, the killer), 0 for none */
    reporterId: number;
    /** emote / ping id or kill source, e.g. "ping_danger" */
    type: string;
}

/** An area to keep out of until `until`: grenades about to blow, air strike zones, recent explosions. */
export interface DangerZone {
    kind: ThreatKind;
    pos: Vec2;
    rad: number;
    /** game time it stops being dangerous */
    until: number;
}

/** An air drop the bot knows about (map indicator, plane, falling crate or the landed crate). */
export interface AirdropIntel {
    pos: Vec2;
    /** game time it was first known */
    seenAt: number;
    landed: boolean;
    /** id of the crate obstacle once seen, 0 before */
    crateId: number;
}

export interface ThreatBoard {
    /** danger around `pos` within `r` units (0 = nothing known; unbounded, compare relative values) */
    heat(pos: Vec2, r: number): number;
    /** enemies heard but not seen recently */
    unseenShooters(): readonly UnseenShooter[];
    /** positions reported by others (pings, kill feed) */
    reported(): readonly ReportedThreat[];
    /** areas to avoid right now */
    dangerZones(): readonly DangerZone[];
    /** air drops known */
    airdrops(): readonly AirdropIntel[];
    /** called by WorldModel.observe with every snapshot, after the model itself was updated */
    ingest(snap: Snapshot, model: WorldModel): void;
}

const NONE: readonly never[] = Object.freeze([]);

/** A board that knows nothing: the default of every WorldModel. */
export class NullThreatBoard implements ThreatBoard {
    heat(_pos: Vec2, _r: number): number {
        return 0;
    }
    unseenShooters(): readonly UnseenShooter[] {
        return NONE;
    }
    reported(): readonly ReportedThreat[] {
        return NONE;
    }
    dangerZones(): readonly DangerZone[] {
        return NONE;
    }
    airdrops(): readonly AirdropIntel[] {
        return NONE;
    }
    ingest(_snap: Snapshot, _model: WorldModel): void {}
}

/** Shared inert board (stateless). */
export const NO_THREATS: ThreatBoard = new NullThreatBoard();
