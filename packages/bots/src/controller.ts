// In-process bots: a BotController drives one player of a Game. Call `update()` once per tick before `game.step()`:
// every SNAPSHOT_EVERY_TICKS ticks it takes the player's own snapshot (exactly what a networked client would get),
// and every tick it sets the player's input. Bots take their snapshots on ticks staggered by player id, so a game full
// of bots spreads perception and decisions evenly over the ticks. Deterministic: the bot's random stream is seeded.
import type { Game } from "@rebirth/sim";
import { type AddPlayerOptions, SNAPSHOT_EVERY_TICKS, TICK_HZ } from "@rebirth/sim";
import { Bot, type BotOptions } from "./bot.ts";

const DT = 1 / TICK_HZ;

export interface SpawnBotOptions extends BotOptions {
    name: string;
    /** team modes: party key / auto fill (default: auto fill) */
    addOptions?: AddPlayerOptions;
}

export class BotController {
    readonly game: Game;
    readonly playerId: number;
    readonly bot: Bot;
    private observed = false;
    private finished = false;
    /** tick phase (0..SNAPSHOT_EVERY_TICKS-1) of this bot's snapshots */
    private readonly phase: number;

    constructor(game: Game, playerId: number, opts: BotOptions) {
        this.game = game;
        this.playerId = playerId;
        this.bot = new Bot(game.mapData, opts);
        this.phase = playerId % SNAPSHOT_EVERY_TICKS;
    }

    /** Adds a player to `game` and returns its controller (the API to add a bot-controlled player). */
    static spawn(game: Game, opts: SpawnBotOptions): BotController {
        const id = game.addPlayer(opts.name, opts.addOptions);
        return new BotController(game, id, opts);
    }

    /** The player died (or left the game) and its last snapshot was seen: nothing left to control. */
    get done(): boolean {
        return this.finished;
    }

    /** One tick of control; call before `game.step()`. */
    update(): void {
        if (this.finished) return;
        const game = this.game;
        const player = game.getPlayer(this.playerId);
        if (!player) {
            this.finished = true;
            return;
        }
        if (!this.observed || game.tick % SNAPSHOT_EVERY_TICKS === this.phase) {
            this.bot.observe(game.getSnapshot(this.playerId));
            this.observed = true;
            // Cobalt: the class menu choice (M7b)
            if (this.bot.classChoice) game.selectRole(this.playerId, this.bot.classChoice);
            if (player.dead) {
                this.finished = true;
                return;
            }
        }
        game.setInput(this.playerId, this.bot.act(DT));
    }
}
