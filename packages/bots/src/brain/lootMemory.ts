// Looting state (bot overhaul LOOT, BrainMemory.loot2): container progress and budgets, containers remembered from
// inside their building, the air drop being opened, the house being swept, the off-hand reload swap and holstering,
// the outfit habit (LOOT2), the basement trip (BrainFeatures.basements).
// Written only by LOOT's code paths (scavenge.ts, containers.ts, airdrop.ts, sweep.ts, weapons.ts, explore.ts,
// basement.ts).
import type { Vec2 } from "@rebirth/core";
import type { OutfitTaste } from "./outfits.ts";

export class LootMemory {
    // containers (scavenge.ts: LOOT-3/4)
    /** container the progress below belongs to (0 none) */
    breakId = 0;
    /** its health fraction when the bot last saw it lose health */
    breakHealthT = 1;
    /** game time of the last progress update (an interruption is not counted as time spent) */
    breakTracked = Number.NEGATIVE_INFINITY;
    /** the bot's own break attempt damaged it (commit: finish it, scavenge.ts breakScore) */
    breakHit = false;
    /** stand spot index offset: bumped when a stand spot did not lead into reach (try another side) */
    standShift = 0;
    /** the stand spot picked for container `standFor` at shift `standFrom` (kept until the shift changes) */
    standFor = 0;
    standFrom = -1;
    standSpot: Vec2 | null = null;
    standHealthT = 1;
    /** seconds of attacks from the current spot that did not hurt the container, and until when it walks to another */
    spotNoProgress = 0;
    repositionUntil = 0;
    /** seconds spent working on container `breakId` close to it since its last hit (scavenge.ts NO_HIT_GIVE_UP) */
    breakNoHit = 0;
    /** how often each container ran out of NO_HIT_GIVE_UP (the second time it is given up for good) */
    readonly noHitStrikes = new Map<number, number>();
    /** where and since when the bot has been out of reach without getting closer (fail fast) */
    stallPos: Vec2 | null = null;
    stallSince = 0;
    /** containers the bot's own attempt damaged and when it last did (committed: finished first, LOOT2) */
    readonly damaged = new Map<number, number>();
    /** seconds spent in reach of each container without it losing health (cumulative over interruptions) */
    readonly noProgress = new Map<number, number>();
    /** containers seen while the bot stood under their building's roof (furniture it knows from inside: LOOT-5) */
    readonly seenInside = new Set<number>();
    /** the container the bot last attacked (fire or Use at it, in reach) and when (scavenge.ts no-progress clock) */
    attackId = 0;
    attackAt = Number.NEGATIVE_INFINITY;
    /** whether a stand spot around container `landingId` lets a punch land on it, until `landingUntil` (scavenge.ts) */
    landingId = 0;
    landingUntil = 0;
    landing = false;
    /** a container chosen by bestBreakable that passed the stand spot check, and until when that holds */
    standOkId = 0;
    standOkUntil = 0;

    // air drops (scavenge.ts and airdrop.ts: LOOT-7)
    /** the air drop crate the bot pressed Use on, and until when it waits for it to open (useDelay) */
    openId = 0;
    openUntil = 0;
    openPos: Vec2 | null = null;
    /** smart air drop run: the closest the bot got to the drop, and when it last got 2 units closer */
    dropBest = Number.POSITIVE_INFINITY;
    dropGainAt = 0;

    // house sweeps (sweep.ts: LOOT-6)
    /** building being swept (0 none) and its remaining waypoints, nearest first when picked */
    sweepId = 0;
    sweepPoints: Vec2[] = [];
    /** last sweep update, and the seconds spent sweeping towards the current waypoint (one not reached is dropped) */
    sweepPointSince = 0;
    sweepWalked = 0;
    /** buildings swept to the end */
    readonly swept = new Set<number>();

    // basements and bunkers (basement.ts, BrainFeatures.basements)
    /** whether this bot heads for basements at all (drawn once from its own stream), null until drawn */
    basementGoer: boolean | null = null;
    /** whether it goes down the famous basements though no basement-goer (brain/basement.ts famousGoer), drawn once */
    famousGoer: boolean | null = null;
    /** underground grid id of the basement it is on its way to or looting (-1 none), and its trips so far */
    basementSite = -1;
    basementTrips = 0;
    /** when it next looks for a basement to go to */
    basementCheckAt = 0;
    /** seconds spent in the basement behaviour since the trip began, and the game time of the last update */
    basementWalked = 0;
    basementTracked = 0;
    /** game time it first stood on the basement's floor (-1 not yet) */
    basementBelowAt = -1;
    /** the floor's waypoints left (rooms to walk through), and the basement seconds spent on the current one */
    basementPoints: Vec2[] = [];
    basementPointWalked = 0;
    /** basements done (looted, left or given up) */
    readonly basementsDone = new Set<number>();

    // outfits (outfits.ts: LOOT2, user report 22)
    /** the bot's outfit habit and ranked list, drawn once from the persona stream when it first sees an outfit */
    outfitTaste: OutfitTaste | null = null;
    /** outfits the bot has worn (an "any" bot never goes back to one; the one it took off stays on the ground) */
    readonly outfitsWorn = new Set<string>();

    /** the gun a pickup swapped out, not picked up again until then (explore.ts planLoot) */
    swapGuardType = "";
    swapGuardUntil = 0;

    // weapons (weapons.ts: LOOT-11/12)
    /** the off-hand gun swapped in to reload it while quiet, and until when it stays in hand */
    reloadSlot = -1;
    reloadUntil = 0;
    /** last time a threat showed (a visible standing enemy, a bullet passing close, damage, gunfire heard nearby) */
    lastThreat = Number.NEGATIVE_INFINITY;
    /** holstered for travel (melee in hand by choice) */
    holstered = false;
}
