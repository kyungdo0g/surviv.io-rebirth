// Fight state (bot overhaul COMBAT, BrainMemory.fight): the exposure reaction clock of the current target (COMBAT-3),
// the aim point of the last shot check (a body edge when only that shows), where the target last showed with a clear
// shot and since when it has been behind cover (COMBAT-7, COMBAT-11), the stalled-engagement reposition (COMBAT-10),
// the frag back-off and throw decision (COMBAT-11) and the grenades seen on the screen with their dodge reactions
// (COMBAT-4). Round 3: faint targets under a canopy (faint.ts), the reaction to fire from an unseen shooter
// (unseenFire.ts, read by MOVE through unseenReaction), smoke stand-offs (smokeFight.ts), corner holds and prefire on a
// lost target (lostTarget.ts) and the combat decision trace (cook reasons, unseen-fire and smoke choices). Round 4:
// whether the bot thought of its frags in this engagement, its escape throws (escapeFrag.ts) and its belief about the
// current fight (judgement.ts). Written only by COMBAT's code paths (brain/combat.ts, tactics.ts, grenades.ts,
// dodge.ts and the round 3 and 4 files).
import type { Vec2 } from "@rebirth/core";
import type { HeldChoice } from "./earlyMemory.ts";

/** One combat decision worth a look afterwards (tests, match diagnostics). */
export interface CombatTraceEntry {
    t: number;
    kind: "cook" | "unseen" | "smoke" | "prefire" | "faint" | "cover" | "frag" | "judge" | "blast";
    detail: string;
}

/** The last few combat decisions of a bot (a ring of TRACE_SIZE entries, oldest first in `entries()`). */
export class CombatTrace {
    private readonly ring: CombatTraceEntry[] = [];
    /** decisions recorded so far, per kind (the ring forgets, the counts do not) */
    readonly counts = new Map<string, number>();

    add(t: number, kind: CombatTraceEntry["kind"], detail: string): void {
        this.ring.push({ t, kind, detail });
        if (this.ring.length > TRACE_SIZE) this.ring.shift();
        const key = `${kind}:${detail.split(" ")[0]}`;
        this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    }

    entries(): readonly CombatTraceEntry[] {
        return this.ring;
    }

    last(kind?: CombatTraceEntry["kind"]): CombatTraceEntry | undefined {
        for (let i = this.ring.length - 1; i >= 0; i--) if (!kind || this.ring[i].kind === kind) return this.ring[i];
        return undefined;
    }
}

const TRACE_SIZE = 32;

/** How the bot answers fire from a shooter off its screen (unseenFire.ts; MOVE acts on "evade"). */
export type UnseenChoice = "return" | "hold" | "evade";

/** The current unseen-fire episode: one shooter, one decision. */
export interface UnseenReaction {
    choice: UnseenChoice;
    shooterId: number;
    /** where the shooter seems to be (the fuzzy origin of its tracers, perception/bulletSight.ts), refreshed */
    origin: Vec2;
    /** when the episode began and when the shooter was last heard */
    since: number;
    lastShot: number;
    /** the estimated distance to the shooter when decided */
    dist: number;
    /** why this choice (persona draw or the situation) */
    why: string;
}

/** How the bot deals with a target that walked into smoke (smokeFight.ts). */
export type SmokeChoice = "spray" | "frag" | "hold";

export interface SmokeStandoff {
    target: number;
    /** when the target vanished (its last-seen record), the episode's key */
    vanishedAt: number;
    choice: SmokeChoice;
    since: number;
    /** seconds of fire into the smoke so far, and rounds in the magazine when it began */
    sprayed: number;
    magAtStart: number;
    burstUntil: number;
    pauseUntil: number;
    lastThink: number;
    /** this burst's aim point in the cloud */
    aim: Vec2 | null;
}

export class CombatMemory {
    /** point blank (pointBlank.ts): per enemy, swing at it (yes) or back off, held until `until`; since when at it */
    readonly pointBlank = new Map<number, HeldChoice & { since: number }>();
    // exposure (combat.ts shotCheck)
    /** contact the exposure clock follows */
    expTarget = 0;
    /** think at which the target last stepped out with a clear shot (the current exposure began) */
    expSince = Number.NEGATIVE_INFINITY;
    /** last think the target showed with a clear shot */
    expLast = Number.NEGATIVE_INFINITY;
    /** the fresh reaction drawn for the current exposure (params.exposureReaction) */
    expDelay = 0;
    /** the point the last clear shot check aimed at (the centre, or the edge of a half-covered body) */
    aimPoint: Vec2 | null = null;
    /** where the target last showed with a clear shot, and when (blocked: the crosshair holds that angle) */
    lastClearPos: Vec2 | null = null;
    lastClearAt = Number.NEGATIVE_INFINITY;
    /** the bot decided to fire at this target at this time (an exchange on: return fire out to the gun's reach) */
    fireTarget = 0;
    fireAt = Number.NEGATIVE_INFINITY;
    /** the gun slot in hand at the last fight decision, and since when (combat.ts heldSlot) */
    slotHeld = -1;
    slotSince = Number.NEGATIVE_INFINITY;

    // cover between (tactics.ts planFight, grenades.ts)
    /** contact the cover clock follows, and since when its whole body has been behind cover */
    coverTarget = 0;
    coveredSince = Number.NEGATIVE_INFINITY;
    /** this engagement's frag decision (rolled once per cover stand-off from grenadeRate): throw when the gates hold */
    fragWanted = false;
    fragRolledAt = Number.NEGATIVE_INFINITY;
    /** planFight asked for the frag this think (grenades.ts skips its per-think roll when this equals now) */
    throwNow = Number.NEGATIVE_INFINITY;
    /** backing off to a safe throwing distance since (capped) */
    backOffSince = Number.NEGATIVE_INFINITY;

    // stalled engagement (tactics.ts reposition)
    /** a step to a spot with a line of fire: its target, the spot, until when it is kept */
    repoTarget = 0;
    repoSpot: Vec2 | null = null;
    repoUntil = Number.NEGATIVE_INFINITY;
    /** no new stall reposition against the same target before this */
    repoCooldown = Number.NEGATIVE_INFINITY;
    /** the target whose futile engagement (PursuitMemory.futileTarget) got its one reposition */
    futileDone = 0;

    // dodging (dodge.ts)
    /** grenades on the screen: when each was first seen and the reaction drawn for it */
    readonly grenadeSeen = new Map<number, { at: number; delay: number }>();
    /** projectile ids of the bot's own frags (seen leaving its hand: brain/dodge.ts), with when they showed */
    readonly ownFrags = new Map<number, number>();
    /** grenades seen leaving a teammate's hand, by projectile id, with when they showed (dodge.ts: no friendly fire) */
    readonly friendlyFrags = new Map<number, number>();

    // faint targets under a canopy (faint.ts)
    faintTarget = 0;
    faintSince = Number.NEGATIVE_INFINITY;
    faintLastAt = Number.NEGATIVE_INFINITY;
    faintNotice = 0;
    faintPatience = 0;
    faintBurstUntil = Number.NEGATIVE_INFINITY;
    faintPauseUntil = Number.NEGATIVE_INFINITY;
    /** this burst's guess of where the faint body is, relative to the lead point */
    faintAim: Vec2 = { x: 0, y: 0 };
    /** the faint target given up on, until when */
    faintDropId = 0;
    faintDropUntil = Number.NEGATIVE_INFINITY;

    // fire from an unseen shooter (unseenFire.ts)
    unseen: UnseenReaction | null = null;
    unseenBurstUntil = Number.NEGATIVE_INFINITY;
    unseenPauseUntil = Number.NEGATIVE_INFINITY;
    /** the angle (radians, about the bot) this return-fire burst is off the origin estimate (unseenFire.ts) */
    unseenScatter = 0;
    /** seconds of return fire in this episode */
    unseenFired = 0;
    unseenLastThink = Number.NEGATIVE_INFINITY;

    // smoke (smokeFight.ts)
    smoke: SmokeStandoff | null = null;

    // a lost target's corner (lostTarget.ts)
    /** the vanishing (target, last-seen time) whose prefire was decided, the decision and the burst's end */
    prefireTarget = 0;
    prefireAt = Number.NEGATIVE_INFINITY;
    prefireWanted = false;
    prefireUntil = Number.NEGATIVE_INFINITY;

    // grenade craft (round 4: fragSkill.ts, escapeFrag.ts)
    /** the target whose engagement rolled DifficultyParams.frag.recall, and whether the bot thought of its frags */
    recallTarget = 0;
    recallSeen = Number.NEGATIVE_INFINITY;
    recalled = true;
    /** the last frag thrown back on the run, and how many so far */
    escapeAt = Number.NEGATIVE_INFINITY;
    escapes = 0;

    // judgement (round 4: judgement.ts)
    /** the target of the current belief, when it was last judged, and the belief's error (added to the advantage) */
    beliefTarget = 0;
    beliefSeen = Number.NEGATIVE_INFINITY;
    beliefError = 0;

    /** why the last frag plan was cooked (grenades.ts fragPlan): Bot keeps a "push" throw going against the rusher */
    planReason = "";
    /** the current cover session (cover.ts) is an even trade from cover (shorter hides), not a lost trade or a reload */
    tradeSession = false;

    /** the last combat decisions (cook reasons, unseen-fire, smoke and prefire choices) */
    readonly trace = new CombatTrace();
}
