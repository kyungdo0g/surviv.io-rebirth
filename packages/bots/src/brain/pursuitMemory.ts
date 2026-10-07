// Pursuit state (bot overhaul MOVE, BrainMemory.pursuit): the futile-engagement clocks (one per target, counting
// out-of-sight time), the targets given up and until when, the flight in progress, the places the bot was chased out
// of (brain/danger.ts), the heal it broke off and the enemies that covered a downed teammate; and (round 3) the
// episode under fire from an unseen shooter (brain/evade.ts), the last sighting of the fight target and the search
// for it (brain/search.ts), and the fighting position next to cover (brain/position.ts). When a clock runs out
// against a target the bot could shoot but has no line of fire on, it raises `futileTarget` once (COMBAT reads it for
// one reposition, COMBAT-10) before the bot drops the target with an ignore window (brain/pursuit.ts ignoredTarget).
// Written only by the code paths of BrainFeatures.pursuit (fightScore.ts, pursuit.ts, flight.ts, danger.ts,
// survival.ts, team.ts, evade.ts, search.ts, position.ts, strikes.ts, endgame.ts), so a bot without the flag keeps
// all of it at the defaults.
import type { Vec2 } from "@rebirth/core";
import type { Contact } from "../perception/world.ts";
import type { ZigzagState } from "./zigzag.ts";

/** One engagement's progress clock (brain/pursuit.ts notePursuit). */
export interface EngageClock {
    /** game time of the last update */
    last: number;
    /** game time of the last progress: closing in, damage dealt or taken */
    progressAt: number;
    /** distance at the last progress (closing is measured from here) */
    refDist: number;
    /** damage dealt to it and taken from it since the last progress */
    damage: number;
    /** the intel's health estimate of the target at the last update (damage dealt) */
    estHealth: number;
    /** own health at the last update (damage taken) */
    health: number;
}

/** A target given up: ignored until `until` unless it comes back (brain/pursuit.ts reacquire). */
export interface GiveUp {
    until: number;
    /** distance when it was given up (coming this much closer again re-engages it) */
    dist: number;
}

/** A place the bot was chased out of (brain/danger.ts). */
export interface DangerArea {
    /** building id it is keyed by (0: a spot in the open) */
    building: number;
    pos: Vec2;
    rad: number;
    /** a spot in the open recorded unarmed: how far the gun the bot ran from reaches (it keeps out of that, unarmed) */
    reach: number;
    /** a spot in the open: the enemy it follows (its last noted position; 0 for a building) */
    enemyId: number;
    until: number;
    /** recorded while the bot was unarmed: it no longer applies once the bot has a gun */
    unarmed: boolean;
    /** flights from it so far (each one makes the memory longer) */
    count: number;
    /** game time it was last noted (notes within a few seconds belong to the same flight) */
    noted: number;
    /** the bot got clear of it after the last flight (brain/danger.ts dangerToLeave: once per flight) */
    left: boolean;
}

/** An armed enemy seen covering a downed teammate (brain/team.ts reviveThreat). */
export interface Coverer {
    contact: Contact;
    pos: Vec2;
    seen: number;
}

/** How the bot answers fire from a shooter it cannot see (brain/evade.ts; picked once per episode by persona). */
export type EvadeStyle = "run" | "cover" | "push";

/** One episode under fire from an unseen shooter (brain/evade.ts). */
export interface EvadeState {
    style: EvadeStyle;
    /** where the shooter seems to be (the tracer's origin estimate, updated with every new bullet) */
    origin: Vec2;
    shooterId: number;
    since: number;
    /** game time of its last bullet that passed close, and of the last hit while it lasted */
    lastFire: number;
    lastHit: number;
    /** when the bot takes notice: the first bullet's arrival plus a human reaction (params.dodgeReaction) */
    noticeAt: number;
    /** zigzag: the side of the current leg (+1 / -1), its angle off the base direction (radians) and its end */
    legSign: number;
    legAngle: number;
    legUntil: number;
    /** cover and push: the spot the bot heads for (or holds), and the pause on a push hop */
    spot: Vec2 | null;
    pauseUntil: number;
}

/** The fight target as the bot last saw it (brain/search.ts): nothing about it after that moment. */
export interface TargetTrack {
    id: number;
    pos: Vec2;
    vel: Vec2;
    time: number;
    /** where the bot stood then (a target hiding behind cover hides on the far side from here) */
    from: Vec2;
    /** it was within the bot's shooting reach then, and seen with a gun (only such a loss is searched) */
    inReach: boolean;
    armed: boolean;
}

/** A search for a lost target (brain/search.ts): the spots to check, in order, and the time it may take. */
export interface SearchState {
    id: number;
    spots: Vec2[];
    idx: number;
    /** game time the current spot became the goal (a spot it cannot get to is skipped) */
    spotSince: number;
    started: number;
    until: number;
}

/** A fighting position next to cover (brain/position.ts): the spot behind it and the edge to shoot from. */
export interface FightPost {
    target: number;
    hide: Vec2;
    edge: Vec2;
    /** the target's position when it was chosen (it is chosen again once the target moved far from there) */
    ref: Vec2;
    until: number;
}

export class PursuitMemory {
    /** contact id of the engagement the clock flagged futile (0: none); COMBAT tries one reposition against it */
    futileTarget = 0;
    /** game time it was flagged */
    futileSince = Number.NEGATIVE_INFINITY;
    /** engagement clocks by target id */
    readonly clocks = new Map<number, EngageClock>();
    /** targets given up, by id */
    readonly ignored = new Map<number, GiveUp>();
    /** give-ups per target id within the last STRIKE_MEMORY seconds (each one halves the next patience) */
    readonly strikes = new Map<number, { n: number; at: number }>();
    /** holstered sprint after a runner (planChase): its target id (0 none) */
    sprintTarget = 0;

    // flight (brain/flight.ts)
    /** fleeing: the stop radius applies instead of the start radius (hysteresis) */
    fleeing = false;
    /** the cover spot the flight runs to, and the threat it hides from */
    fleeSpot: Vec2 | null = null;
    fleeSpotUntil = Number.NEGATIVE_INFINITY;
    /** a flight ended because nobody shot at the bot: enemies that only look at it do not start a new one until then */
    calmUntil = Number.NEGATIVE_INFINITY;

    // places the bot was chased out of (brain/danger.ts)
    readonly dangers: DangerArea[] = [];

    // survival items (brain/survival.ts)
    /** a heal broken off under fire: no new heal or boost until then unless things are quiet */
    healHoldUntil = Number.NEGATIVE_INFINITY;

    // revives (brain/team.ts)
    readonly coverers = new Map<number, Coverer>();
    /** the enemy whose walk-in ended the last revive, and when (no kneeling again in front of it) */
    kneelAbort: { id: number; at: number } | null = null;

    // round 3
    /** under fire from a shooter the bot cannot see (brain/evade.ts) */
    evade: EvadeState | null = null;
    /** the fight target's last sighting, and the search for it once lost (brain/search.ts) */
    track: TargetTrack | null = null;
    search: SearchState | null = null;
    /** the fighting position next to cover (brain/position.ts), and no new look for one before `postRetryAt` */
    post: FightPost | null = null;
    postRetryAt = Number.NEGATIVE_INFINITY;
    /** whether the persona camps its endgame hold (rolled once from campiness: brain/endgame.ts camps), null not yet */
    camper: boolean | null = null;
    /** shot while standing still (brain/stillHit.ts): where the bot stopped, since when, its health there */
    still: { pos: Vec2; since: number; health: number } | null = null;
    /** a spot the bot was shot on while parked, avoided until `until` */
    burned: { pos: Vec2; until: number } | null = null;
    /** the legs of a run under fire (brain/zigzag.ts) */
    runZig: ZigzagState = { legSign: 1, legAngle: 0, legUntil: Number.NEGATIVE_INFINITY };
    /** the sideways juke off a burned spot: until when, and its side */
    jukeUntil = Number.NEGATIVE_INFINITY;
    jukeSign = 1;

    /** Whether the engagement against `targetId` was flagged futile (COMBAT-10 reads this). */
    isFutile(targetId: number): boolean {
        return targetId !== 0 && this.futileTarget === targetId;
    }
}
