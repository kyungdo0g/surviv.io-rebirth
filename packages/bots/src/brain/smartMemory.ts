// State kept between decisions by the BrainFeatures behaviours (assessment, disengaging, cover peeks, third-partying,
// team play, endgame holds, air drops, threat reactions). Only the code path of an enabled feature writes its fields,
// so a baseline brain leaves all of it at the defaults.
import type { Vec2 } from "@rebirth/core";
import type { BehaviourName } from "./context.ts";
import type { LootChoice } from "./explore.ts";
import type { BreakChoice } from "./scavenge.ts";

/** One think's worth of the trade monitor (brain/disengage.ts). */
export interface TradeSample {
    time: number;
    /** health lost to enemies since the previous sample */
    taken: number;
    /** estimated damage dealt to enemies since the previous sample */
    dealt: number;
}

export type CoverState = "none" | "hide" | "peek";

/** Trail and trap state of the dead-end escape (brain/deadEnd.ts). */
export interface DeadEndMemory {
    trail: Array<{ t: number; pos: Vec2 }>;
    /** since when the bot has stayed near `anchor` while wanting to go farther (Infinity: not trapped) */
    since: number;
    anchor: Vec2 | null;
    escapeTo: Vec2 | null;
    escapeUntil: number;
    cooldown: number;
}

export function emptyDeadEnd(): DeadEndMemory {
    return {
        trail: [],
        since: Number.POSITIVE_INFINITY,
        anchor: null,
        escapeTo: null,
        escapeUntil: Number.NEGATIVE_INFINITY,
        cooldown: Number.NEGATIVE_INFINITY,
    };
}

export type AirdropState = "approach" | "scan" | "loot";

export class SmartMemory {
    // trade monitor (disengage)
    readonly trade: TradeSample[] = [];
    tradeHealth = -1;
    tradeSnapshots = 0;
    /** magazine and slot at the previous think, and the last time either changed (the bot fired or swapped) */
    tradeMag = -1;
    tradeSlot = -1;
    tradeFiredAt = Number.NEGATIVE_INFINITY;
    /** estimated health of each enemy at the previous think (damage dealt from intel) */
    readonly estHealth = new Map<number, number>();
    // disengage
    disengageUntil = Number.NEGATIVE_INFINITY;
    disengageStart = Number.NEGATIVE_INFINITY;
    disengageCooldown = Number.NEGATIVE_INFINITY;
    disengageSpot: Vec2 | null = null;
    // cover peeks (cover)
    cover: CoverState = "none";
    coverTarget = 0;
    coverSince = Number.NEGATIVE_INFINITY;
    coverStateSince = 0;
    coverStateUntil = 0;
    coverSpot: Vec2 | null = null;
    peekSpot: Vec2 | null = null;
    peekSide = 1;
    /** health when the current peek started */
    peekHealth = 100;
    coverCooldown = Number.NEGATIVE_INFINITY;
    /** holding the last-seen angle of a lost target since */
    holdAngleSince = Number.NEGATIVE_INFINITY;
    holdAngleTarget = 0;
    /** door the bot passed while holding a building (closed behind it) */
    lastDoorClose = Number.NEGATIVE_INFINITY;
    buildingHoldUntil = Number.NEGATIVE_INFINITY;
    buildingCooldown = Number.NEGATIVE_INFINITY;
    buildingSpot: Vec2 | null = null;
    buildingScanAt = Number.NEGATIVE_INFINITY;
    /** the last flank spot search: its time, target, the target's position then and the spot found */
    flankAt = Number.NEGATIVE_INFINITY;
    flankTarget = 0;
    flankFrom: Vec2 | null = null;
    flankSpot: Vec2 | null = null;
    // third-partying
    tpA = 0;
    tpB = 0;
    tpStart = Number.NEGATIVE_INFINITY;
    tpCooldown = Number.NEGATIVE_INFINITY;
    tpSpot: Vec2 | null = null;
    tpSurvivor = 0;
    tpScanAt = Number.NEGATIVE_INFINITY;
    // team play
    lastPing = Number.NEGATIVE_INFINITY;
    readonly pinged = new Map<number, number>();
    /** enemies the team's bullets fly towards, with the time they were seen doing it */
    readonly teamFocus = new Map<number, number>();
    // guard
    guardSince = Number.NEGATIVE_INFINITY;
    // endgame
    holdSpot: Vec2 | null = null;
    holdSearchAt = Number.NEGATIVE_INFINITY;
    holdScanAngle = 0;
    /** last time an enemy was in sight while the endgame hold was considered */
    holdQuietSince = Number.NEGATIVE_INFINITY;
    // air drops
    airdropState: AirdropState = "approach";
    airdropPos: Vec2 | null = null;
    airdropSpot: Vec2 | null = null;
    airdropScanUntil = 0;
    airdropSince = Number.NEGATIVE_INFINITY;
    airdropCooldown = Number.NEGATIVE_INFINITY;
    airdropCheckAt = Number.NEGATIVE_INFINITY;
    // threats
    unseenSince = Number.NEGATIVE_INFINITY;
    // scope
    lastScope = Number.NEGATIVE_INFINITY;
    scopeCheckAt = Number.NEGATIVE_INFINITY;
    // reload
    lastSwap = Number.NEGATIVE_INFINITY;
    // steadiness: recent behaviour swaps, and the behaviour locked out by a dithering lock until lockUntil
    readonly swaps: Array<{ time: number; from: BehaviourName; to: BehaviourName }> = [];
    lockDrop: BehaviourName | null = null;
    lockUntil = Number.NEGATIVE_INFINITY;
    /** the last loot and crate choices (steadiness keeps them for a moment) */
    lootChoice: { at: number; from: Vec2; choice: LootChoice | null } | null = null;
    crateChoice: { at: number; from: Vec2; choice: BreakChoice | null } | null = null;
    /** where armed enemies the bot fled from stood, and when */
    readonly fled: Array<{ pos: Vec2; time: number }> = [];
    /** last time a non-downed enemy was in sight (after a kill, top up before looting) */
    lastEnemySeen = Number.NEGATIVE_INFINITY;
    /** kills counted so far, and when the last one came */
    kills = 0;
    lastKill = Number.NEGATIVE_INFINITY;
    /** the trail and trap state of the dead-end escape (basements: navigation) */
    readonly deadEnd: DeadEndMemory = emptyDeadEnd();
}
