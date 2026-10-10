// Brain feature flags: every decision-making improvement of the "smart" brain sits behind one flag, so a tournament can
// pit the smart brain against the baseline (scripts/tournament.ts) and ablate one feature at a time (`--features`).
//
// THE RULE: when a flag is off, its code path must not run at all, and above all must not draw from the bot's rng (nor
// change any state another path reads). A bot with every flag off must replay exactly like the brain before the flags
// existed, seed for seed (compare runMatch reports of a few seeds before and after a change). Gate new code with
// `if (ctx.features.x)` before any rng draw, memory write or extra behaviour option; extra behaviours register in
// brain/extensions.ts with the flag that enables them.
//
// Difficulty and brain are independent axes: DifficultyParams say how well a bot executes (reaction, aim, tactics
// probabilities), BrainFeatures what it knows how to do. A feature may still read a difficulty parameter (e.g.
// `smartReload` combines with DifficultyParams.smartReload: easy bots never reload smartly).

export interface BrainFeatures {
    /** fight assessment: compare own and enemy health, armour, weapon and position before committing to a fight */
    assess: boolean;
    /** break off a losing fight (the "disengage" behaviour): smoke, cover, run along the zone */
    disengage: boolean;
    /** reload behind cover or switch to the other loaded gun instead of reloading in the open */
    smartReload: boolean;
    /** peek from cover: shoot, step back behind it to reload / heal, peek again */
    cover: boolean;
    /** punish enemies that are reloading, healing or reviving */
    opportunism: boolean;
    /** third-partying: move on fights between other players (the "thirdparty" behaviour) */
    thirdparty: boolean;
    /** team play: pings (Intent.emote), focus fire on the team's target, trading */
    teamplay: boolean;
    /** guard a downed or healing teammate (the "guard" behaviour) */
    guard: boolean;
    /** endgame positioning: hold strong spots inside the last circles instead of wandering */
    endgame: boolean;
    /** grenades to flush campers out of cover and to finish downed enemies behind cover */
    grenades: boolean;
    /** scope use: equip the scope that fits the fight, step out of a building's zoom for long sight lines */
    scope: boolean;
    /** contest air drops (the "airdrop" behaviour) */
    airdrop: boolean;
    /** read the threat board (WorldModel.threats): off-screen gunfire, explosions, kill feed, air strikes, pings */
    threats: boolean;
    /** navigation: basements and bunkers (underground layers), and walking back out of dead ends (brain/deadEnd.ts) */
    basements: boolean;
    /** commit to a chosen course: no running back and forth between two goals (flee / zone / loot dithering) */
    steady: boolean;
    // bot overhaul (stage 0 flags; their code lands in wave 1, so until then they change nothing)
    /**
     * patience: give up stalled fights and futile chases, fist-chase give-up, holster sprint (MOVE: pursuit.ts); the
     * flight, danger memory, survival items and revive memory; round 3: unseen fire (evade.ts), searching a lost
     * target (search.ts), fighting from cover (position.ts), air strikes (strikes.ts)
     */
    pursuit: boolean;
    /** holster (fists / melee) while travelling with no enemy in sight, draw on sight (LOOT: weapons.ts) */
    holster: boolean;
    /** clear houses room by room, weight buildings by loot potential (the "sweep" behaviour, LOOT: sweep.ts) */
    sweep: boolean;
    /** put on outfits by persona taste when it is quiet and they lie close (LOOT2: outfits.ts, user report 22) */
    outfits: boolean;
    /**
     * 50v50 (bot round 6): faction perception (perception/factionIntel.ts), the front line, squad cohesion and the
     * no-solo-crossing rule (brain/factionSquad.ts), push / fall back by local numbers, the faction roles
     * (brain/factionRoles.ts) and reviving any downed faction member; inert outside faction maps
     */
    faction: boolean;
    // bot round 6, the owner's early-game items (user reports 38-41, every mode)
    /** early game, unarmed: rush an armed enemy with fists, juking all the way in (brain/early.ts; persona mix) */
    fistRush: boolean;
    /** a fist rusher at point blank: swap to melee and fight it out, or keep the gun (brain/early.ts; persona mix) */
    meleeAnswer: boolean;
    /** explore the buildings whose loot is likely to hold high-tier guns first (knowledge/buildingValue.ts) */
    lootRoute: boolean;
    /** unarmed with an enemy near: break a cheap crate close by and grab its gun first (brain/early.ts) */
    crateFirst: boolean;
    // bot round 6, the owner's gun-use items (user reports 42-44, every mode)
    /** the Spud Gun and the Potato Cannon as real guns, scored by their explosions (knowledge/gunTiers.ts) */
    potatoGuns: boolean;
    /** DMRs for average aim: a milder skill penalty than bolt snipers, a long gun of choice (knowledge/desire.ts) */
    dmrFit: boolean;
    /** experts quick-switch after a shot with a slow-cycling gun (brain/quickSwitch.ts; sim switch rules) */
    quickSwitch: boolean;
    // bot interactions (task 50: "bots open and close doors like players")
    /**
     * doors: open the doors on the way without stopping against them (nav/follower.ts), close the door behind when
     * staying in a building to loot, heal or hold, never on a following teammate, step out of doorways, and take a door
     * heard or found opened as a sign of someone (brain/doors.ts, brain/doorClose.ts, perception/doorWatch.ts)
     */
    doors: boolean;
    /**
     * code puzzles, switches, control panels and vault doors, then the room behind (the "puzzle" behaviour:
     * brain/puzzle.ts; who knows which code: knowledge/puzzles.ts, its own rng stream)
     */
    puzzles: boolean;
    // exploding obstacles (owner, 2026-10-08: "bots take cover behind explosive barrels as if they did not know")
    /**
     * barrels, propane tanks, power boxes and every other obstacle that explodes (knowledge/explosives.ts) are poor
     * cover and their blasts poor spots: the cover searches prefer anything else and never hide behind one being shot
     * or badly damaged, a bot deep in the blast of one being shot steps out of it, and no bot fires shots that would
     * soon set one off next to itself (perception/blasts.ts, brain/blast.ts)
     */
    blastAware: boolean;
    /**
     * intermediate and expert bots shoot an explosive next to an enemy when they stand outside its blast and it would
     * break within a moment (brain/barrelShot.ts)
     */
    barrelShot: boolean;
    // early-game pacing (the owner's report of 2026-10-08: bots die en masse from the very start)
    /**
     * the loot phase, until the second gas stage ends: an armed bot takes on an enemy it is not already fighting only at
     * low persona odds, does not shoot at one it leaves be and looks for its loot away from it; shot at, hit, rushed
     * or met at arm's reach it fights (brain/earlyPace.ts); fist duels near loot give way to the loot (brain/fists.ts)
     */
    earlyPace: boolean;
    /**
     * break through what blocks the way: routes cross breakable obstacles indoors and the house rule's (the club's
     * couch, the mansion's panels, the police station's interior walls, greenhouse glass), and glass walls for a
     * persona-driven share; the bot breaks the one on its way once it sees it (nav/breakThrough.ts, brain/breakThrough.ts)
     */
    breakThrough: boolean;
    /**
     * point blank: no shots whose bullets spawn past the target's body (barrel longer than the gap); the bot backs off
     * to where its gun hits or swaps to melee, by persona and skill (brain/pointBlank.ts)
     */
    pointBlank: boolean;
    /**
     * knocked down: crawl to the nearest standing friend (50v50: any faction member) and to cover from a close enemy,
     * away from enemies, instead of standing still with no squadmate or enemy in view (brain/downed.ts)
     */
    crawl: boolean;
    /**
     * a third player joining a duel: most bots turn on it or take cover from it while finishing the first fight, a
     * persona-driven minority stays tunnel-visioned on the first opponent (brain/newcomer.ts)
     */
    thirdPartyReact: boolean;
}

export type BrainFeature = keyof BrainFeatures;

export const BRAIN_FEATURES: readonly BrainFeature[] = [
    "assess",
    "disengage",
    "smartReload",
    "cover",
    "opportunism",
    "thirdparty",
    "teamplay",
    "guard",
    "endgame",
    "grenades",
    "scope",
    "airdrop",
    "threats",
    "basements",
    "steady",
    "pursuit",
    "holster",
    "sweep",
    "outfits",
    "faction",
    "fistRush",
    "meleeAnswer",
    "lootRoute",
    "crateFirst",
    "potatoGuns",
    "dmrFit",
    "quickSwitch",
    "doors",
    "puzzles",
    "blastAware",
    "barrelShot",
    "earlyPace",
    "breakThrough",
    "pointBlank",
    "crawl",
    "thirdPartyReact",
];

export type BrainName = "baseline" | "smart";

export const BRAIN_NAMES: readonly BrainName[] = ["baseline", "smart"];

/**
 * Features the smart preset leaves out; their code stays for ablations (`tournament.ts --features scope`). Each was
 * measured against the baseline in mirrored tournaments (48 matches per configuration) and could not be made to help:
 * - scope: the view is the zoom, and the baseline already wears the best scope it picks up (a better one is equipped
 *   at once, sim Player.addItem), so the feature can only change how often the bot owns a big scope. The first
 *   version stepped down to the 1x in close fights, which blinded the bot to third parties (a third of its losses to
 *   enemies it could not see came at the 1x zoom); valuing scopes as loot instead (brain/gear.ts) moved the
 *   head-to-head kill share by +0.014 with hard bots and -0.029 with normal ones: noise or worse, so it stays off.
 */
export const SMART_EXCLUDED: readonly BrainFeature[] = ["scope"];

function featureSet(on: (f: BrainFeature) => boolean): Readonly<BrainFeatures> {
    const out = {} as BrainFeatures;
    for (const f of BRAIN_FEATURES) out[f] = on(f);
    return Object.freeze(out);
}

/** baseline: the brain as it was before the flags (every flag off); smart: every feature but SMART_EXCLUDED */
export const BRAIN_PRESETS: Readonly<Record<BrainName, Readonly<BrainFeatures>>> = {
    baseline: featureSet(() => false),
    smart: featureSet((f) => !SMART_EXCLUDED.includes(f)),
};

/**
 * Default brain of a bot without `BotOptions.brain`: "smart" since it passed the tournament gate against the
 * bug-fixed baseline (solo normal 120 matches: wins 89/31, h2h kill share 0.527; squad 96: wins 52/44, h2h 0.553;
 * solo hard 144: wins 99/45, h2h 0.525 — its stuck events were 1.32x, about 1.15x per second alive, as smart bots
 * live longer). The baseline stays for comparison runs (scripts/tournament.ts).
 */
export const DEFAULT_BRAIN: BrainName = "smart";

export function isBrainName(s: string): s is BrainName {
    return (BRAIN_NAMES as readonly string[]).includes(s);
}

export function isBrainFeature(s: string): s is BrainFeature {
    return (BRAIN_FEATURES as readonly string[]).includes(s);
}

/** The feature set of a preset name or a custom set (a frozen copy), DEFAULT_BRAIN when undefined. */
export function brainFeatures(brain: BrainName | BrainFeatures | undefined): Readonly<BrainFeatures> {
    if (brain === undefined) return BRAIN_PRESETS[DEFAULT_BRAIN];
    if (typeof brain === "string") return BRAIN_PRESETS[brain];
    return Object.freeze({ ...brain });
}

/** `base` with the listed features turned on (ablation: baseline plus a few features). */
export function withFeatures(base: Readonly<BrainFeatures>, on: readonly BrainFeature[]): Readonly<BrainFeatures> {
    const out = { ...base };
    for (const f of on) out[f] = true;
    return Object.freeze(out);
}

/** The preset name a feature set equals, or "custom". */
export function brainLabel(f: Readonly<BrainFeatures>): BrainName | "custom" {
    for (const name of BRAIN_NAMES) {
        const p = BRAIN_PRESETS[name];
        if (BRAIN_FEATURES.every((k) => p[k] === f[k])) return name;
    }
    return "custom";
}
