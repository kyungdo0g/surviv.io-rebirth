// State of the puzzle behaviour (BrainFeatures.puzzles: brain/puzzle.ts); only its code paths write it, except the
// knowledge seed the Brain sets at construction (a number, no draw).

/** The steps of a site: walk there, check the pieces, press them in order, wait for the doors, loot the room. */
export type PuzzleStage = "go" | "ready" | "press" | "wait" | "room";

export class PuzzleMemory {
    /** seed of the bot's knowledge stream (BrainProfile.seed; knowledge/puzzles.ts drawPuzzleKnowledge) */
    seed = 0;
    /** knowledge keys of the solutions this bot knows, drawn on first use */
    known: Set<string> | null = null;
    /** no site chosen: look again at this time */
    checkAt = Number.NEGATIVE_INFINITY;
    /** index of the site worked on (brain/puzzleSites.ts), -1 for none */
    site = -1;
    stage: PuzzleStage = "go";
    /** when the stage began */
    since = 0;
    /** piece ids to press, in order (a slip swaps two of them) */
    order: number[] = [];
    /** the planned order holds a slip (a beginner's wrong order: error sound, then a retry the right way) */
    slipped = false;
    /** index in `order` of the next piece */
    step = 0;
    /** the last Use sent: when, at which piece, and that piece's button seq then */
    pressedAt = Number.NEGATIVE_INFINITY;
    pressId = 0;
    pressSeq = -1;
    /** presses sent at the current piece without it switching on */
    pressTries = 0;
    /** when the last piece of this attempt showed on (the piece window runs from it) */
    lastOn = Number.NEGATIVE_INFINITY;
    /** a human pause before the next press until this time */
    readyAt = 0;
    /** the building's error counter when the attempt started (-1: not seen) */
    errSeq = -1;
    /** attempts on this site (a slip earns one retry) */
    tries = 0;
    /** sites left alone until a time (a threat, a failure), by site index */
    readonly cooldown = new Map<number, number>();
    /** sites done with for good (opened and looted, opened by someone else, a broken panel) */
    readonly finished = new Set<number>();
    /**
     * Site doors the bot knows open: seen open on its screen or heard opening, until seen or heard shut (brain/
     * puzzleSight.ts; a door out of its sight is unknown, never read from the snapshot)
     */
    readonly seenOpen = new Set<number>();
    /** the path follower's stuck events so far (Bot.updateSteering copies them in while the flag is on) */
    followerStuck = 0;
    /**
     * room stage: the container being broken, its health when last seen hurt, the seconds punched since without it
     * losing any, the last update, and the last time the bot was punching it (the walk to it is capped)
     */
    roomTarget = 0;
    roomHealth = 1;
    roomSince = 0;
    roomAt = 0;
    roomWalk = 0;
    /**
     * room stage, at the stand spot of the container being broken: the closest the bot got to it, the seconds spent at
     * the spot since without getting 0.1 closer or landing a punch, and the follower's stuck events when it became the
     * target (brain/puzzleRoom.ts trackProgress)
     */
    roomBest = Number.POSITIVE_INFINITY;
    roomNear = 0;
    roomStuck = 0;
    /** containers given up in this room */
    readonly roomSkip = new Set<number>();
    /** blockers seen broken (the grid's components were relabelled for each) */
    readonly cleared = new Set<number>();
    /** rooms of the site looked into (by index in PuzzleSite.rooms) */
    readonly visited = new Set<number>();
}
