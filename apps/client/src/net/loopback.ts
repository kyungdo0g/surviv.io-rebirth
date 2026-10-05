// Runs the authoritative simulation inside the page: fixed TICK_HZ steps driven by requestAnimationFrame through
// an accumulator, a snapshot every SNAPSHOT_EVERY_TICKS ticks, and the local input applied before each step.
// Sandbox extras: standing dummy players in front of the local player, a starting gun, and respawning. The caller
// picks the match rules through `extras.init` (GameInit: `sandbox` for a match that starts at once and never ends,
// `gasStages` for a shortened red zone).
import { v2 } from "@rebirth/core";
import { GameObjectDefs, WeaponSlot } from "@rebirth/defs";
import {
    BAG_ITEMS,
    emptyInput,
    Game,
    type GameInit,
    type GameOptions,
    type PlayerInput,
    SNAPSHOT_EVERY_TICKS,
    type SpectateActionName,
    TICK_HZ,
} from "@rebirth/sim";
import { type Transport, TransportEvents } from "./transport.ts";

const TICK_DT = 1 / TICK_HZ;
/** most ticks simulated in one frame; a longer stall drops the backlog instead of fast-forwarding */
const MAX_TICKS_PER_FRAME = 25;
/** longest frame time fed into the accumulator (s) */
const MAX_FRAME_DT = 0.25;
/** dummies stand this far in front of the local player, this far apart */
const DUMMY_DIST = 8;
const DUMMY_SPACING = 3.5;

export interface LoopbackExtras {
    init?: GameInit;
    /** extra players standing still in front of the local player */
    dummies?: number;
    /** gun id put in the primary slot with a full magazine and a full reserve */
    give?: string;
}

export class LoopbackTransport implements Transport {
    readonly game: Game;
    playerId: number;
    /** ids of the sandbox dummies */
    readonly dummies: number[] = [];
    private readonly extras: LoopbackExtras;
    private readonly events = new TransportEvents();
    private accumulator = 0;
    private lastFrame = -1;
    private raf = 0;
    private closed = false;
    /** ticks simulated in the most recent frame (debug) */
    lastFrameTicks = 0;

    constructor(options: GameOptions, extras: LoopbackExtras = {}) {
        this.extras = extras;
        this.game = new Game(options, extras.init);
        this.playerId = this.game.addPlayer("player");
        this.setupLocal();
        if (extras.dummies) this.spawnDummies(extras.dummies);
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

    spectate(action: SpectateActionName): void {
        if (!this.closed) this.game.spectate(this.playerId, action);
    }

    playerName(id: number): string | undefined {
        return this.game.getPlayer(id)?.name;
    }

    /** Replaces the local player with a fresh one at a new spawn point (sandbox "play again"). */
    respawn(): void {
        this.game.removePlayer(this.playerId);
        this.playerId = this.game.addPlayer("player");
        this.setupLocal();
        this.events.emitJoin(this.game.mapData, this.playerId);
        this.events.emitSnapshot(this.game.getSnapshot(this.playerId));
    }

    close(): void {
        this.closed = true;
        cancelAnimationFrame(this.raf);
        this.events.clear();
    }

    private setupLocal(): void {
        const give = this.extras.give;
        const def = give ? GameObjectDefs[give] : undefined;
        if (!give) return;
        if (def?.type !== "gun") {
            console.warn(`sandbox: give=${give} is not a gun`);
            return;
        }
        const player = this.game.getPlayer(this.playerId);
        if (!player) return;
        const wm = player.weaponManager;
        wm.setWeapon(WeaponSlot.Primary, give, def.maxClip);
        if (BAG_ITEMS.includes(def.ammo)) player.inv.give(def.ammo, player.inv.capacity(def.ammo));
        wm.setCurWeapIndex(WeaponSlot.Primary);
    }

    /** Whether the straight path from `a` to `b` stays on clear, dry grass (canPlayerSpawn every 0.5 units). */
    private clearPath(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
        const len = v2.distance(a, b);
        for (let d = 0; d <= len; d += 0.5) {
            const t = len > 0 ? d / len : 0;
            if (!this.game.canPlayerSpawn({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
        }
        return this.game.canPlayerSpawn(b);
    }

    /** Whether no obstacle (including tree crowns and other sprite bounds) is within `pad` of the box a..b. */
    private openGround(a: { x: number; y: number }, b: { x: number; y: number }, pad: number): boolean {
        const box = {
            min: { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad },
            max: { x: Math.max(a.x, b.x) + pad, y: Math.max(a.y, b.y) + pad },
        };
        return this.game.world.query(box).every((e) => e.kind !== "obstacle" && e.kind !== "building");
    }

    private dummySpots(center: { x: number; y: number }, n: number): Array<{ x: number; y: number }> | null {
        const spots = Array.from({ length: n }, (_, i) => ({
            x: center.x + DUMMY_DIST,
            y: center.y + (i - (n - 1) / 2) * DUMMY_SPACING,
        }));
        const ok = spots.every((s) => this.clearPath(center, s) && this.openGround(center, s, 2.5));
        return ok ? spots : null;
    }

    /** Adds `n` dummies facing the local player, moving the local player to open ground if needed. */
    private spawnDummies(n: number): void {
        const game = this.game;
        const self = game.getPlayer(this.playerId);
        if (!self) return;
        let center = v2.copy(self.pos);
        let spots = this.dummySpots(center, n);
        const { width, height } = game.mapData;
        for (let ring = 4; !spots && ring < width / 2; ring += 4) {
            for (let a = 0; a < 16 && !spots; a++) {
                const ang = (a / 16) * Math.PI * 2;
                const p = { x: self.pos.x + Math.cos(ang) * ring, y: self.pos.y + Math.sin(ang) * ring };
                if (p.x < 60 || p.y < 60 || p.x > width - 60 || p.y > height - 60) continue;
                spots = this.dummySpots(p, n);
                if (spots) center = p;
            }
        }
        if (!spots) return;
        game.teleportPlayer(this.playerId, center);
        spots.forEach((spot, i) => {
            const id = game.addPlayer(`dummy ${i + 1}`);
            game.teleportPlayer(id, spot);
            const toPlayer = v2.normalize(v2.sub(center, spot));
            game.setInput(id, { ...emptyInput(), toMouseDir: toPlayer, toMouseLen: DUMMY_DIST });
            this.dummies.push(id);
        });
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
