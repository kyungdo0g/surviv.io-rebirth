// Shared brain types: the Intent a decision produces (where to go, what to aim at, whether to fire, which slot to
// hold, one-shot actions), the per-bot memory behaviours keep between decisions, and the context they read.
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import type { DifficultyParams } from "../difficulty.ts";
import type { HeldGun } from "../knowledge/arsenal.ts";
import type { Contact, SelfState, WorldModel } from "../perception/world.ts";
import type { Assessment } from "./assess.ts";
import type { BrainFeatures } from "./features.ts";
import { SmartMemory } from "./smartMemory.ts";

export type BehaviourName =
    | "idle"
    | "explore"
    | "loot"
    | "break"
    | "fight"
    | "flee"
    | "heal"
    | "zone"
    | "revive"
    | "regroup"
    | "downed"
    | "order"
    // registered in brain/extensions.ts, only offered while their BrainFeatures flag is on
    | "disengage"
    | "thirdparty"
    | "guard"
    | "airdrop"
    | "hold"
    | "assist";

export interface ThrowPlan {
    /** throwable to use (frag, mirv, smoke) */
    item: string;
    /** world point to land it on */
    pos: Vec2;
    /** seconds to cook before releasing */
    cook: number;
}

export interface Intent {
    behaviour: BehaviourName;
    /** walk here (pathfinding); null: no destination */
    goal: Vec2 | null;
    /**
     * Floor of `goal`: 0 ground, 1 underground (basements and bunkers, BrainFeatures.basements); undefined keeps ground
     * navigation. Bot hands it to PathFollower.steer.
     */
    goalLayer?: number;
    arriveDist: number;
    /** walk in this direction directly (overrides `goal`), e.g. strafing or backing off */
    moveDir: Vec2 | null;
    /** stand still (accuracy, reviving) */
    stop: boolean;
    /** world point to aim at; null: look where walking */
    aim: Vec2 | null;
    /** contact the aim tracks (0 for none); used for the reaction delay and the aim error */
    targetId: number;
    /** pull the trigger when the aim is on target */
    fire: boolean;
    /** weapon slot to hold; null: keep the current one */
    slot: number | null;
    /** one-shot input actions (defs Input values) */
    actions: number[];
    /** bag item to use (heal, boost) */
    useItem: string;
    /** grenade to throw */
    throwPlan: ThrowPlan | null;
    /**
     * A point the cursor should glance at or pre-aim while `aim` is null (a corner an enemy was heard behind, a door
     * about to be entered). Only the human motor model reads it; the legacy aim ignores it.
     */
    lookAt?: Vec2;
    /**
     * An emote or ping to send once (team play: "ping_danger" at an enemy, "ping_coming" to a teammate); `pos` is the
     * world position of a ping. Bot.takeEmote hands it to the host (BotController: Game.emote, NetworkBot: sendEmote).
     */
    emote?: IntentEmote;
}

/** An emote or ping a behaviour asks for (GameObjectDefs id; pings carry the world position to mark). */
export interface IntentEmote {
    type: string;
    pos?: Vec2;
}

export function emptyIntent(behaviour: BehaviourName = "idle"): Intent {
    return {
        behaviour,
        goal: null,
        arriveDist: 1,
        moveDir: null,
        stop: false,
        aim: null,
        targetId: 0,
        fire: false,
        slot: null,
        actions: [],
        useItem: "",
        throwPlan: null,
    };
}

/** An order given to a bot from outside (tests, scripted scenarios): it overrides the brain. */
export type BotOrder = { type: "goto"; pos: Vec2; arriveDist?: number } | { type: "hold" };

/** State behaviours keep between decisions. */
export class BrainMemory {
    // fight
    strafeSign = 1;
    strafeUntil = 0;
    tacticsUntil = 0;
    standStill = false;
    engagedTarget = 0;
    engageStart = 0;
    reaction = 0.3;
    strafing = true;
    useCover = false;
    targetId = 0;
    // loot
    lootTarget = 0;
    readonly lootBlacklist = new Map<number, number>();
    lootAttemptId = 0;
    lootAttemptAt = Number.NEGATIVE_INFINITY;
    lootAttemptPos: Vec2 | null = null;
    breakTarget = 0;
    breakStart = 0;
    // explore
    exploreGoal: Vec2 | null = null;
    exploreUntil = 0;
    readonly visited = new Set<number>();
    // actions
    lastUseRequest = Number.NEGATIVE_INFINITY;
    lastReloadRequest = Number.NEGATIVE_INFINITY;
    lastReviveRequest = Number.NEGATIVE_INFINITY;
    lastLootRequest = Number.NEGATIVE_INFINITY;
    lastThrow = Number.NEGATIVE_INFINITY;
    lastThrowPos: Vec2 | null = null;
    lastSmoke = Number.NEGATIVE_INFINITY;
    lastUseObstacle = Number.NEGATIVE_INFINITY;
    /** goal the path follower could not reach, and until when it is avoided */
    failedGoal: Vec2 | null = null;
    failedUntil = 0;
    order: BotOrder | null = null;
    /** a follower walking back to its leader (team modes) */
    regrouping = false;
    current: BehaviourName = "idle";
    /** when the current behaviour was chosen */
    currentSince = 0;
    /** state of the BrainFeatures behaviours; written only by the code paths of enabled features */
    readonly smart = new SmartMemory();
}

export interface BrainCtx {
    model: WorldModel;
    self: SelfState;
    params: DifficultyParams;
    /** what this brain knows how to do (BRAIN_PRESETS); a flag that is off must not draw from `rng` */
    features: Readonly<BrainFeatures>;
    rng: Rng;
    now: number;
    mem: BrainMemory;
    /** living enemies, visible or remembered */
    enemies: Contact[];
    visibleEnemies: Contact[];
    /** the enemy the bot fights, if any */
    target: Contact | null;
    targetDist: number;
    /** guns with their ammo */
    guns: HeldGun[];
    /** holds a gun with rounds in the magazine or the bag */
    armed: boolean;
    /** duo or squad */
    teamMode: boolean;
    /** navigation component the bot stands in (0 when unknown): targets outside it cannot be reached */
    myComp: number;
    /** fight assessment against `target` (brain/assess.ts); null while no feature that reads it is on, or no target */
    assessment: Assessment | null;
}

/** Whether a walkable cell within `slack` of `p` lies in the bot's navigation component. */
export function reachable(ctx: BrainCtx, p: Vec2, slack = 1.5): boolean {
    // basements: underground (or on stairs) the ground grid's components mean nothing; ask the floor-aware navigation
    const below = ctx.features.basements ? ctx.model.underground : null;
    if (below && ctx.self.layer !== 0) return below.canPathTo(ctx.model.nav, ctx.self.pos, ctx.self.layer, p, 0);
    if (ctx.myComp === 0) return true;
    return ctx.model.nav.nearestWalkable(p, slack, ctx.myComp) >= 0;
}

/** Whether `p` lies at a goal the path follower recently failed to reach (avoided for a while). */
export function nearFailedGoal(ctx: BrainCtx, p: Vec2): boolean {
    const f = ctx.mem.failedGoal;
    return !!f && ctx.now < ctx.mem.failedUntil && v2.distance(f, p) < 2;
}

/**
 * A walkable spot the bot can get to near `p` (its navigation component, not a goal that just failed), or null: the
 * smart behaviours' goals go through it so the path follower is not sent at points inside obstacles or across water.
 */
export function usableSpot(ctx: BrainCtx, p: Vec2, slack = 2): Vec2 | null {
    if (nearFailedGoal(ctx, p)) return null;
    const cell = ctx.model.nav.nearestWalkable(p, slack, ctx.myComp);
    return cell >= 0 ? ctx.model.nav.center(cell) : null;
}
