// Runs the authoritative simulation inside the page: fixed TICK_HZ steps driven by requestAnimationFrame through
// an accumulator, a snapshot every SNAPSHOT_EVERY_TICKS ticks, and the local input applied before each step.
import { Game, type GameOptions, type PlayerInput, SNAPSHOT_EVERY_TICKS, TICK_HZ } from "@rebirth/sim";
import { type Transport, TransportEvents } from "./transport.ts";

const TICK_DT = 1 / TICK_HZ;
/** most ticks simulated in one frame; a longer stall drops the backlog instead of fast-forwarding */
const MAX_TICKS_PER_FRAME = 25;
/** longest frame time fed into the accumulator (s) */
const MAX_FRAME_DT = 0.25;

export class LoopbackTransport implements Transport {
    readonly game: Game;
    readonly playerId: number;
    private readonly events = new TransportEvents();
    private accumulator = 0;
    private lastFrame = -1;
    private raf = 0;
    private closed = false;
    /** ticks simulated in the most recent frame (debug) */
    lastFrameTicks = 0;

    constructor(options: GameOptions) {
        this.game = new Game(options);
        this.playerId = this.game.addPlayer("player");
        // let the caller register its callbacks first
        queueMicrotask(() => {
            if (this.closed) return;
            this.events.emitJoin(this.game.mapData, this.playerId);
            this.events.emitSnapshot(this.game.getSnapshot(this.playerId));
            this.raf = requestAnimationFrame(this.frame);
        });
    }

    onJoin(cb: Parameters<Transport["onJoin"]>[0]): void {
        this.events.onJoin(cb);
    }

    onSnapshot(cb: Parameters<Transport["onSnapshot"]>[0]): void {
        this.events.onSnapshot(cb);
    }

    sendInput(input: PlayerInput): void {
        if (!this.closed) this.game.setInput(this.playerId, input);
    }

    close(): void {
        this.closed = true;
        cancelAnimationFrame(this.raf);
        this.events.clear();
    }

    private readonly frame = (now: number): void => {
        if (this.closed) return;
        const dt = this.lastFrame < 0 ? 0 : Math.min((now - this.lastFrame) / 1000, MAX_FRAME_DT);
        this.lastFrame = now;
        this.accumulator += dt;
        let ticks = 0;
        while (this.accumulator >= TICK_DT && ticks < MAX_TICKS_PER_FRAME) {
            this.game.step();
            this.accumulator -= TICK_DT;
            ticks++;
            if (this.game.tick % SNAPSHOT_EVERY_TICKS === 0) {
                this.events.emitSnapshot(this.game.getSnapshot(this.playerId));
            }
        }
        if (ticks === MAX_TICKS_PER_FRAME) this.accumulator = Math.min(this.accumulator, TICK_DT);
        this.lastFrameTicks = ticks;
        this.raf = requestAnimationFrame(this.frame);
    };
}
