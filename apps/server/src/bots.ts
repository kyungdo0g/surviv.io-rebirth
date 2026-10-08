// Bot fill (rebirth feature for testing and low-population regions, docs/research/community-ko.md): while a game is
// joinable, in-process bots join one at a time until the game holds BOT_FILL players; a human joining a game at its
// target (or at the mode's player limit) takes the seat of a bot that has not fought yet, as long as the original join
// window is open. Bots are ordinary players (names from a Korean/English list, auto-fill groups in team modes), driven
// by @rebirth/bots through their own snapshots with a seeded random stream. They never hold a game open: rooms count
// only human seats, so a game whose humans all left closes as usual, and the match ends by the normal rules.
//
// Population (bot overhaul POPULATION-5): BOT_DIFFICULTY "mixed" (the default) draws each bot's skill tier from a
// shuffle bag of 20 in the BOT_SKILL_MIX proportions (35 / 45 / 20 beginner / intermediate / expert: 7 / 9 / 4), and
// with BOT_PERSONAS on its persona from a bag of 50 in the persona mix, so small lobbies get the mix too. Each bot then
// draws its own skill inside the tier band from its own seed. A tier name puts every bot in that tier; the legacy
// presets easy / normal / hard keep their fixed parameters. The bags use their own rng: bot names and seeds stay as
// before.
import {
    BotController,
    DEFAULT_SKILL_MIX,
    type DifficultySetting,
    isSkillTier,
    PERSONA_MIX,
    type PersonaName,
    pickBotName,
    type SkillTierName,
    shuffleBag,
} from "@rebirth/bots";
import { createRng, type Rng } from "@rebirth/core";
import { getMapDef, playerLimit } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";

/** BOT_DIFFICULTY: a legacy preset, a skill tier, or "mixed" (the tier mix of BOT_SKILL_MIX). */
export type BotDifficultySetting = DifficultySetting | "mixed";

/** Shuffle bag sizes: 20 tiers (35/45/20 is exactly 7/9/4), 50 personas (22/30/14/10/14/10 is 11/15/7/5/7/5). */
export const SKILL_BAG = 20;
export const PERSONA_BAG = 50;

export interface BotFillOptions {
    /** players the game should hold (humans + bots) */
    target: number;
    difficulty: BotDifficultySetting;
    /** ticks between two bot joins (0: all at once) */
    joinIntervalTicks: number;
    /** seed of the bots' names and random streams */
    seed: number;
    /** tier weights of "mixed" (default DEFAULT_SKILL_MIX: 35 / 45 / 20) */
    skillMix?: Readonly<Record<SkillTierName, number>>;
    /** give fill bots personas (default true; false: every bot is the neutral persona) */
    personas?: boolean;
    /** called once when a bot throws (its control is dropped; the player idles) */
    onError?: (err: unknown) => void;
}

export class BotFill {
    readonly game: Game;
    readonly options: BotFillOptions;
    /** bots still controlled, by player id */
    private readonly controllers = new Map<number, BotController>();
    /** every bot player id ever added and still in the game */
    private readonly botIds = new Set<number>();
    private readonly names = new Set<string>();
    private readonly rng: Rng;
    /** the population bags' own stream (tiers and personas), apart from the names */
    private readonly bagRng: Rng;
    private skillBag: SkillTierName[] = [];
    private personaBag: PersonaName[] = [];
    private readonly modeMaxPlayers: number;
    private nextJoinTick = 0;
    private added = 0;
    /** bot exceptions caught (the bot stops being controlled) */
    errors = 0;

    constructor(game: Game, options: BotFillOptions) {
        this.game = game;
        this.options = options;
        this.rng = createRng(options.seed ^ 0x2c1b3c6d);
        this.bagRng = createRng(options.seed ^ 0x1b873593);
        // a player cap that grows the map (defs mapDefForPlayers) fills that far, else the mode's maxPlayers
        this.modeMaxPlayers = playerLimit(getMapDef(game.options.mapName), game.options.maxPlayers);
        for (const p of game.players()) this.names.add(p.name);
    }

    /** Bots in the game (alive or dead). */
    get count(): number {
        return this.botIds.size;
    }

    get aliveCount(): number {
        let n = 0;
        for (const id of this.botIds) if (!this.game.getPlayer(id)?.dead) n++;
        return n;
    }

    isBot(playerId: number): boolean {
        return this.botIds.has(playerId);
    }

    /** The controller of a bot still controlled (its Bot carries the skill profile and persona), else undefined. */
    controller(playerId: number): BotController | undefined {
        return this.controllers.get(playerId);
    }

    /** Players in the game: humans and bots, alive, dead or disconnected (removed players excluded). */
    private playersInGame(): number {
        let n = 0;
        for (const _ of this.game.players()) n++;
        return n;
    }

    /** The original join window: not over, and not started or started less than `joinWindowSeconds` ago. */
    joinWindowOpen(): boolean {
        const game = this.game;
        if (game.over) return false;
        return !game.started || game.match.startedSeconds < game.rules.joinWindowSeconds;
    }

    /** One tick: drive the bots, then let one more bot join when the game is joinable and below its target. */
    update(): void {
        for (const [id, bot] of this.controllers) {
            try {
                bot.update();
            } catch (err) {
                this.errors++;
                this.controllers.delete(id);
                this.options.onError?.(err);
                continue;
            }
            if (bot.done) this.controllers.delete(id);
        }
        for (const id of this.botIds) if (!this.game.getPlayer(id)) this.botIds.delete(id);
        const game = this.game;
        if (this.options.target <= 0 || game.tick < this.nextJoinTick || !game.canJoin()) return;
        if (this.playersInGame() >= Math.min(this.options.target, this.modeMaxPlayers)) return;
        this.addBot();
        this.nextJoinTick = game.tick + this.options.joinIntervalTicks;
    }

    /** The next tier of the "mixed" population (a refilled shuffle bag). */
    private nextTier(): SkillTierName {
        if (this.skillBag.length === 0)
            this.skillBag = shuffleBag(this.bagRng, SKILL_BAG, this.options.skillMix ?? DEFAULT_SKILL_MIX);
        return this.skillBag.pop() ?? "intermediate";
    }

    /** The next persona (a refilled shuffle bag). */
    private nextPersona(): PersonaName {
        if (this.personaBag.length === 0) this.personaBag = shuffleBag(this.bagRng, PERSONA_BAG, PERSONA_MIX);
        return this.personaBag.pop() ?? "neutral";
    }

    private addBot(): void {
        const { difficulty, seed } = this.options;
        const teamMode = this.game.options.teamMode ?? 1;
        const legacy = difficulty !== "mixed" && !isSkillTier(difficulty) ? difficulty : undefined;
        const skill = difficulty === "mixed" ? this.nextTier() : isSkillTier(difficulty) ? difficulty : undefined;
        const persona = this.options.personas !== false ? this.nextPersona() : undefined;
        const bot = BotController.spawn(this.game, {
            name: pickBotName(this.rng, this.names),
            ...(legacy !== undefined ? { difficulty: legacy } : { skill }),
            ...(persona !== undefined ? { persona } : {}),
            seed: (seed + this.added * 7919) >>> 0,
            addOptions: teamMode > 1 ? { autoFill: true, partySize: 1 } : undefined,
        });
        this.added++;
        this.controllers.set(bot.playerId, bot);
        this.botIds.add(bot.playerId);
    }

    /** Whether a human may take bot `id`'s seat: alive, standing, and (once the match started) not in a fight yet. */
    private canLeave(id: number): boolean {
        const p = this.game.getPlayer(id);
        if (!p || p.dead || p.downed) return false;
        return !this.game.started || (p.kills === 0 && p.damageDealt === 0 && p.damageTaken === 0);
    }

    /** The bot whose seat the next human takes (the latest that may leave); none once the join window closed. */
    private replaceable(): number | undefined {
        if (!this.joinWindowOpen()) return undefined;
        let pick: number | undefined;
        for (const id of this.botIds) if (this.canLeave(id) && (pick === undefined || id > pick)) pick = id;
        return pick;
    }

    /** Whether a human could join although the game itself is full (by taking a bot's seat). */
    canMakeRoom(): boolean {
        return this.replaceable() !== undefined;
    }

    /**
     * How many bots could leave for humans now (0 once the join window closed): each join frees at most one, so
     * find_game routes no more joins past MAX_PLAYERS_IN_GAME than this.
     */
    replaceableCount(): number {
        if (!this.joinWindowOpen()) return 0;
        let n = 0;
        for (const id of this.botIds) if (this.canLeave(id)) n++;
        return n;
    }

    /**
     * A human is about to join: when the game is at its fill target or at the mode's player limit, a bot leaves to make
     * room. Returns whether a bot left.
     */
    makeRoom(): boolean {
        const game = this.game;
        const atTarget = this.options.target > 0 && this.playersInGame() >= this.options.target;
        const atLimit = game.aliveCount >= this.modeMaxPlayers;
        if (!atTarget && !atLimit) return false;
        const id = this.replaceable();
        if (id === undefined) return false;
        this.controllers.delete(id);
        this.botIds.delete(id);
        game.removePlayer(id);
        return true;
    }
}
