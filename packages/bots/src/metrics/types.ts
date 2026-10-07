// Match metrics (bot overhaul HARNESS): the per-bot counters and match-level records the read-only collectors fill
// (metrics/collector.ts behind MatchConfig.metrics), one field per user report or acceptance threshold of the bot
// overhaul (scratchpad triage section 5.3). Everything is plain JSON so worker threads can ship it.
import type { BrainName } from "../brain/features.ts";
import type { Difficulty, SkillTierName } from "../difficulty.ts";
import type { GunTier } from "../knowledge/gunTiers.ts";
import type { PersonaName } from "../persona.ts";
import { type DeliberateContainers, emptyRound3, type Round3Bot } from "./round3Types.ts";

/** Game seconds of the loadout checkpoints (tier distribution of held guns, pistol-only, survivorship). */
export const CHECKPOINTS: readonly number[] = [60, 120, 180, 240];
/** The alive curve is sampled every this many game seconds. */
export const ALIVE_STEP = 30;

/** A bot's loadout at a checkpoint: the living now, the dead with what they carried when they died. */
export interface LoadoutSample {
    t: number;
    alive: boolean;
    /** tier of the best gun with ammo (magazine + bag), "none" unarmed */
    best: GunTier | "none";
    bestId: string;
    /** the best gun with ammo is weak (knowledge/gunTiers isWeakGun: C+ or lower; critique C3 "pistol-only") */
    weakOnly: boolean;
    /** every gun with ammo is of the pistol class (the triage's literal pistol-only) */
    pistolOnly: boolean;
    unarmed: boolean;
    /** weak or unarmed and the bot perceives a better gun (not weak) on its floor within 40 units */
    seesBetter: boolean;
}

/** A chase: fighting a standing target beyond the held gun's ideal range (seconds), and the persona's patience. */
export interface ChaseEpisode {
    duration: number;
    /** persona chasePatience capped at 30 s (triage MOVE-1) */
    patience: number;
    /** the target was unarmed (no gun with ammo) when the chase began */
    unarmedTarget: boolean;
}

export interface BotMetrics {
    id: number;
    teamId: number;
    tier: SkillTierName;
    persona: PersonaName;
    difficulty: Difficulty;
    brain: BrainName | "custom";
    /** game time of the death, -1 alive at the end */
    deathAt: number;
    /** seconds alive and not downed while the metrics ran */
    aliveSeconds: number;

    // fairness (COMBAT): what a human player would see (perception/sight.ts)
    /** shots fired (trigger pulls of a gun) */
    shots: number;
    /** shots fired with a living player as the intent target */
    targetedShots: number;
    /** ...at a target off the 16:9 screen (1 unit body slack) */
    offScreenShots: number;
    /** ...at a target hidden by foliage (sight.concealed) */
    concealedShots: number;
    /** first shots of an engagement (no shot at that target in the previous 3 s) */
    firstShots: number;
    /** ...at a concealed target that had not revealed itself (fired or was hit in the last 2 s) */
    concealedFirstShots: number;
    /** aim acquisitions of a player target (human motor: acquisition counter; legacy: a new target) */
    aimStarts: number;
    /** ...while the target was off the screen */
    offScreenAimStarts: number;
    /** ...while it was on the screen but hidden (roof, smoke, foliage, another floor) */
    hiddenAimStarts: number;
    /** seconds from the target's on-screen exposure (visible, a line of fire) to the first shot at it */
    exposureLatency: number[];
    /** samples aiming at a visible enemy, how many without firing, and why (the triage probe's classifier) */
    aimSamples: number;
    aimNoFire: number;
    noFire: Record<string, number>;

    // looting (LOOT)
    /** containers (destructible obstacles with loot) this bot hit while breaking, broke, and left standing */
    containersHit: number;
    containersBroken: number;
    containersAbandoned: number;
    /** distinct plated containers it hit while looting without effect (no piercing melee) */
    platedHits: number;
    /** building visits (inside a zoomIn region for 1 s or more) and items picked up during them */
    buildingVisits: number;
    visitPickups: number;
    emptyVisits: number;
    /** items picked up in total */
    pickups: number;
    /** a usable gun dropped for a lower-tier one */
    tierDowngrades: number;
    /** S-tier gun seen within 20 units outside a fight, and held within 15 s */
    sTierSeen: number;
    sTierTaken: number;
    /** samples armed, travelling, nothing in view; how many holstered (melee slot) */
    travelSamples: number;
    travelHolstered: number;
    /** fight samples with a gun in hand, with a pistol, with a pistol while the other gun suits the range better */
    fightGunSamples: number;
    fightPistol: number;
    wrongSlotPistol: number;
    /** fight samples with two different usable guns, how many holding the one that suits the range best */
    twoGunSamples: number;
    rightGun: number;
    /** switches between the two gun slots during fights, and seconds of fighting */
    fightSwitches: number;
    fightSeconds: number;
    loadout: LoadoutSample[];

    // movement (MOVE)
    /** chases of 5 s or more */
    chases: ChaseEpisode[];
    /** flee episodes of 5 s or more (seconds) */
    flees: number[];
    /** contested spots (flee starts within 20 units) and re-flees there after coming back (house.ts pattern) */
    oscSpots: number;
    oscCycles: number;
    oscMaxCycles: number;
    /** behaviour flips back within 3 s (A -> B -> A: zone <-> loot, explore <-> flee dithering) */
    flips: number;
    /** revives started, and those started while team.ts reviveThreat saw a threat */
    revives: number;
    unsafeRevives: number;
    /** revives during which the reviver lost 10 HP or more, and seconds kneeling while another behaviour ran */
    revivesHurt: number;
    /** revives that began as a threat first came into view (not in unsafeRevives: the bot could not have seen it) */
    revivesSurprised: number;
    kneelOtherSeconds: number;
    /** frag (non-smoke) throws started and released, and how many with a standing enemy under 6 units */
    fragStarts: number;
    fragStartsNear: number;
    fragReleases: number;
    fragReleasesNear: number;
    /** smoke grenades aimed at the bot's own feet (within 3 units) */
    smokeAtFeet: number;
    /** seconds safe (no enemy in view, not hurt for 3 s, out of the gas) with a boost in the bag and room to boost */
    safeBoostSeconds: number;
    /** boosts (soda, pills) started in that state; boosts and heals started in total */
    safeBoostUses: number;
    boostUses: number;
    healUses: number;

    /** round 3 and 4 (stage EVALUATE: metrics/round3.ts, frags.ts); missing in metrics recorded before them */
    r3?: Round3Bot;
}

export interface AirdropRecord {
    landedAt: number;
    /** game time the crate was opened, -1 never */
    openedAt: number;
    /** the inner crate (crate_10..13) broke, -1 never */
    innerBrokenAt: number;
    /** an item that came out of it was picked up, -1 never */
    lootedAt: number;
}

export interface ContainerTotals {
    /** distinct containers bots hit while breaking, broke, left standing after a break attempt (the breaker lived on) */
    hit: number;
    broken: number;
    abandoned: number;
    /** distinct plated containers hit while looting without effect */
    plated: number;
}

export interface MatchMetrics {
    bots: BotMetrics[];
    containers: ContainerTotals;
    airdrops: AirdropRecord[];
    /** living bots every ALIVE_STEP seconds */
    alive: Array<{ t: number; alive: number }>;
    /** 50v50: distance between the faction centroids and their spread along that axis, every ALIVE_STEP seconds */
    faction?: Array<{ t: number; front: number; spread: number }>;
    /** deliberately started containers (round 3, user report 21: metrics/frags.ts) */
    deliberate?: DeliberateContainers;
}

export function emptyBotMetrics(
    id: number,
    meta: Pick<BotMetrics, "teamId" | "tier" | "persona" | "difficulty" | "brain">,
): BotMetrics {
    return {
        id,
        ...meta,
        deathAt: -1,
        aliveSeconds: 0,
        shots: 0,
        targetedShots: 0,
        offScreenShots: 0,
        concealedShots: 0,
        firstShots: 0,
        concealedFirstShots: 0,
        aimStarts: 0,
        offScreenAimStarts: 0,
        hiddenAimStarts: 0,
        exposureLatency: [],
        aimSamples: 0,
        aimNoFire: 0,
        noFire: {},
        containersHit: 0,
        containersBroken: 0,
        containersAbandoned: 0,
        platedHits: 0,
        buildingVisits: 0,
        visitPickups: 0,
        emptyVisits: 0,
        pickups: 0,
        tierDowngrades: 0,
        sTierSeen: 0,
        sTierTaken: 0,
        travelSamples: 0,
        travelHolstered: 0,
        fightGunSamples: 0,
        fightPistol: 0,
        wrongSlotPistol: 0,
        twoGunSamples: 0,
        rightGun: 0,
        fightSwitches: 0,
        fightSeconds: 0,
        loadout: [],
        chases: [],
        flees: [],
        oscSpots: 0,
        oscCycles: 0,
        oscMaxCycles: 0,
        flips: 0,
        revives: 0,
        unsafeRevives: 0,
        revivesHurt: 0,
        revivesSurprised: 0,
        kneelOtherSeconds: 0,
        fragStarts: 0,
        fragStartsNear: 0,
        fragReleases: 0,
        fragReleasesNear: 0,
        smokeAtFeet: 0,
        safeBoostSeconds: 0,
        safeBoostUses: 0,
        boostUses: 0,
        healUses: 0,
        r3: emptyRound3(),
    };
}
