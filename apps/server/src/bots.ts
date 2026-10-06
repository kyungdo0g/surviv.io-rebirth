// Bot fill (rebirth feature for testing and low-population regions, docs/research/community-ko.md): while a game is
// joinable, in-process bots join one at a time until the game holds BOT_FILL players; a human joining a game at its
// target (or at the mode's player limit) takes the seat of a bot that has not fought yet, as long as the original join
// window is open. Bots are ordinary players (names from a Korean/English list, auto-fill groups in team modes), driven
// by @rebirth/bots through their own snapshots with a seeded random stream. They never hold a game open: rooms count
// only human seats, so a game whose humans all left closes as usual, and the match ends by the normal rules.
import { BotController, DIFFICULTIES, type Difficulty, pickBotName } from "@rebirth/bots";
import { createRng, type Rng } from "@rebirth/core";
import type { Game } from "@rebirth/sim";

export type BotDifficultySetting = Difficulty | "mixed";

export interface BotFillOptions {
    /** players the game should hold (humans + bots) */
    target: number;
    difficulty: BotDifficultySetting;
    /** ticks between two bot joins (0: all at once) */
    joinIntervalTicks: number;
    /** seed of the bots' names and random streams */
    seed: number;
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
    private nextJoinTick = 0;
    private added = 0;
    /** bot exceptions caught (the bot stops being controlled) */
    errors = 0;

    constructor(game: Game, options: BotFillOptions) {
        this.game = game;
        this.options = options;
        this.rng = createRng(options.seed ^ 0x2c1b3c6d);
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
        if (this.playersInGame() >= Math.min(this.options.target, this.game.match.maxPlayers)) return;
        this.addBot();
        this.nextJoinTick = game.tick + this.options.joinIntervalTicks;
        // a zero interval fills the game to its target at once instead of one bot per tick
        while (
            this.options.joinIntervalTicks <= 0 &&
            game.canJoin() &&
            this.playersInGame() < Math.min(this.options.target, this.game.match.maxPlayers)
        )
            this.addBot();
    }

    private addBot(): void {
        const { difficulty, seed } = this.options;
        const d = difficulty === "mixed" ? DIFFICULTIES[this.added % DIFFICULTIES.length] : difficulty;
        const teamMode = this.game.options.teamMode ?? 1;
        const bot = BotController.spawn(this.game, {
            name: pickBotName(this.rng, this.names),
            difficulty: d,
            seed: (seed + this.added * 7919) >>> 0,
            addOptions: teamMode > 1 ? { autoFill: true, partySize: 1 } : undefined,
        });
        this.added++;
        this.controllers.set(bot.playerId, bot);
        this.botIds.add(bot.playerId);
    }

    /** A bot whose seat a human may take: alive, standing, and (once the match started) not in a fight yet. */
    private replaceable(): number | undefined {
        if (!this.joinWindowOpen()) return undefined;
        const started = this.game.started;
        let pick: number | undefined;
        for (const id of this.botIds) {
            const p = this.game.getPlayer(id);
            if (!p || p.dead || p.downed) continue;
            if (started && (p.kills > 0 || p.damageDealt > 0 || p.damageTaken > 0)) continue;
            // the most recent bot leaves first
            if (pick === undefined || id > pick) pick = id;
        }
        return pick;
    }

    /** Whether a human could join although the game itself is full (by taking a bot's seat). */
    canMakeRoom(): boolean {
        return this.replaceable() !== undefined;
    }

    /**
     * A human is about to join: when the game is at its fill target or at the mode's player limit, a bot leaves to make
     * room. Returns whether a bot left.
     */
    makeRoom(): boolean {
        const game = this.game;
        const atTarget = this.options.target > 0 && this.playersInGame() >= this.options.target;
        const atLimit = game.aliveCount >= this.game.match.maxPlayers;
        if (!atTarget && !atLimit) return false;
        const id = this.replaceable();
        if (id === undefined) return false;
        this.controllers.delete(id);
        this.botIds.delete(id);
        game.removePlayer(id);
        return true;
    }
}
