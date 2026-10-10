// The threat board (wave 2, BrainFeatures.threats): what a player knows beyond the enemies on its screen, built only
// from what its snapshots carry, like the original client shows it: bullets and their sound from off-screen shooters,
// explosions, the kill feed, air drop and air strike indicators, teammates' pings. WorldModel.observe feeds every
// snapshot to `ingest`; behaviours read it through `ctx.model.threats` while `ctx.features.threats` is on.
//
// NO_THREATS is the inert board every WorldModel starts with (nothing known, heat 0): installing a real board is the
// only way to change what the brain sees, so bots without the feature keep deciding exactly as before. The real board
// is perception/threatTracker.ts (ThreatTracker), installed by perception/install.ts.
//
// Wave 2 additions (all optional, so other implementations of the interface stay valid): ReportedThreat.confidence,
// ThreatBoard.killLeader() and ThreatBoard.events(), the ThreatEvent and KillLeaderIntel types.

import type { Vec2 } from "@rebirth/core";
import type { AirstrikeVariant } from "@rebirth/defs";
import type { Snapshot } from "@rebirth/sim";
import type { WorldModel } from "./world.ts";

/** What a threat entry comes from. */
export type ThreatKind = "gunfire" | "explosion" | "kill" | "ping" | "airstrike" | "airdrop" | "grenade" | "fire";

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

/**
 * A ghost contact: a position someone else flagged (a teammate's ping, a kill in the feed with a known place) or where
 * an off-screen shooter was heard ("gunfire": `reporterId` is the shooter, `type` its weapon). Kept for ~6 s.
 */
export interface ReportedThreat {
    kind: ThreatKind;
    pos: Vec2;
    /** game time it was reported */
    time: number;
    /** player who reported it (the pinging teammate, the killer, the heard shooter), 0 for none */
    reporterId: number;
    /** emote / ping id, kill source or weapon, e.g. "ping_danger" */
    type: string;
    /** (added in wave 2, optional) 1 when reported, fading linearly to 0 over ~6 s (absent: 1) */
    confidence?: number;
}

/** (added in wave 2) One entry of the board's event ring buffer (64 entries, newest last in `events()`). */
export interface ThreatEvent {
    kind: ThreatKind;
    pos: Vec2;
    /** game time of the event (merged gunfire: of its latest shot) */
    time: number;
    /** heat weight (gunfire grows with merged shots) */
    weight: number;
    /** player behind it (shooter, killer, pinging teammate), 0 for none */
    sourceId: number;
}

/** (added in wave 2) The current kill leader as the HUD shows it (no position). */
export interface KillLeaderIntel {
    id: number;
    kills: number;
}

/**
 * An area to keep out of until `until`: live grenades in view (their explosion radius), air strike zones and strobe /
 * zone strike markers, falling air drop crates (radius 6 around the landing point until it lands).
 */
export interface DangerZone {
    kind: ThreatKind;
    pos: Vec2;
    rad: number;
    /** game time it stops being dangerous */
    until: number;
    /** an air strike zone's variant (AirstrikeZoneView.variant: heavy shells, carpet); absent means normal */
    variant?: AirstrikeVariant;
    /**
     * (bot round 6) a strobe's strike: a strike marker seen without its zone, or a thrown strobe's strip; `rad` already
     * holds the lines' spread and the bombs' blast (perception/strobes.ts), and it never makes a bot detour
     */
    strobe?: boolean;
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
    /** air drops known (falling or landed; dropped once the bot saw the crate opened) */
    airdrops(): readonly AirdropIntel[];
    /** called by WorldModel.observe with every snapshot, after the model itself was updated */
    ingest(snap: Snapshot, model: WorldModel): void;
    /** (added in wave 2, optional) the kill leader, null for none or unknown */
    killLeader?(): Readonly<KillLeaderIntel> | null;
    /** (added in wave 2, optional) the event ring buffer, oldest first */
    events?(): readonly ThreatEvent[];
    /** (rebirth flashbang, optional) game time the bot's own flash blinds it until (Snapshot.flash) */
    blindUntil?(): number;
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
