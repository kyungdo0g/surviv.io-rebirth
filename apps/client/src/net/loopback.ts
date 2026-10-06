// Runs the authoritative simulation inside the page: fixed TICK_HZ steps driven by requestAnimationFrame through
// an accumulator, a snapshot every SNAPSHOT_EVERY_TICKS ticks, and the local input applied before each step.
// Sandbox extras: standing dummy players in front of the local player, a starting gun, and respawning. The caller
// picks the match rules through `extras.init` (GameInit: `sandbox` for a match that starts at once and never ends,
// `gasStages` for a shortened red zone).
// M6: a team game (GameOptions.teamMode 2 / 4) puts the local player and `teammates` idle teammates in one group (a
// party key with no auto fill), next to each other; the dummies are enemies, one group each. Emotes go to Game.emote.
// M7: Cobalt class choices go to Game.selectRole and HUD drops to Game.dropItem.
import { v2 } from "@rebirth/core";
import { GameObjectDefs, WeaponSlot } from "@rebirth/defs";
import {
    type AddPlayerOptions,
    BAG_ITEMS,
    type EmoteRequest,
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
/** teammates stand this far behind the local player, this far apart */
const TEAMMATE_DIST = 4;
const TEAMMATE_SPACING = 3;
/** the sandbox party key of the local player's group */
const LOCAL_GROUP = "sandbox-local";

export interface LoopbackExtras {
    init?: GameInit;
    /** extra players standing still in front of the local player (enemies in team modes) */
    dummies?: number;
    /** team modes: idle teammates in the local player's group, standing behind it (M6) */
    teammates?: number;
    /**
     * Comma-separated items for the local player: guns go to the primary (then secondary) slot with a full magazine and
     * reserve, bag items (throwables, heals, boosts, scopes) are filled to capacity; the first gun or throwable listed
     * is equipped (M5: `give=frag`, `give=smoke,4xscope`, `give=bandage`).
     */
    give?: string;
}

export class LoopbackTransport implements Transport {
    readonly game: Game;
    playerId: number;
    /** ids of the sandbox dummies */
    readonly dummies: number[] = [];
    /** ids of the sandbox teammates (team modes) */
    readonly teammates: number[] = [];
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
        const teamMode = options.teamMode ?? 1;
        const teammates = teamMode > 1 ? Math.max(0, Math.min(teamMode - 1, Math.floor(extras.teammates ?? 0))) : 0;
        this.playerId = this.game.addPlayer("player", this.localGroup(1 + teammates));
        this.setupLocal();
        for (let i = 0; i < teammates; i++) {
            this.teammates.push(this.game.addPlayer(`teammate ${i + 1}`, this.localGroup(1)));
        }
        if (extras.dummies || teammates) this.arrangeSandbox(extras.dummies ?? 0);
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

    emote(req: EmoteRequest): void {
        if (!this.closed) this.game.emote(this.playerId, req);
    }

    selectRole(role: string): void {
        if (!this.closed) this.game.selectRole(this.playerId, role);
    }

    dropItem(item: string, weapIdx: number): void {
        if (!this.closed) this.game.dropItem(this.playerId, item, weapIdx);
    }

    get teamMode(): number {
        return this.game.options.teamMode ?? 1;
    }

    get emoteLoadout(): readonly string[] | undefined {
        return this.game.getPlayer(this.playerId)?.emoteLoadout;
    }

    /** addPlayer options of the local group: a party key without auto fill (team modes only). */
    private localGroup(partySize: number): AddPlayerOptions {
        return (this.game.options.teamMode ?? 1) > 1 ? { group: LOCAL_GROUP, autoFill: false, partySize } : {};
    }

    playerName(id: number): string | undefined {
        return this.game.getPlayer(id)?.name;
    }

    /** Replaces the local player with a fresh one at a new spawn point (sandbox "play again"). */
    respawn(): void {
        this.game.removePlayer(this.playerId);
        this.playerId = this.game.addPlayer("player", this.localGroup(1));
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
        const items = (this.extras.give ?? "").split(",").filter(Boolean);
        const player = this.game.getPlayer(this.playerId);
        if (!items.length || !player) return;
        const wm = player.weaponManager;
        let equip = -1;
        let gunSlot: number = WeaponSlot.Primary;
        for (const item of items) {
            const def = GameObjectDefs[item];
            if (def?.type === "gun") {
                wm.setWeapon(gunSlot, item, def.maxClip);
                if (BAG_ITEMS.includes(def.ammo)) player.inv.give(def.ammo, player.inv.capacity(def.ammo));
                if (equip < 0) equip = gunSlot;
                gunSlot = WeaponSlot.Secondary;
            } else if (def && BAG_ITEMS.includes(item)) {
                player.inv.give(item, player.inv.capacity(item));
                if (def.type === "throwable" && equip < 0) {
                    // the slot shows the first throwable added; select the one asked for
                    wm.setWeapon(WeaponSlot.Throwable, item, 0);
                    equip = WeaponSlot.Throwable;
                }
            } else {
                console.warn(`sandbox: give=${item} is not a gun or a bag item`);
            }
        }
        if (equip >= 0) wm.setCurWeapIndex(equip);
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

    /** Dummies in a row in front of `center`, teammates in a row behind it, or null when they do not fit there. */
    private sandboxSpots(
        center: { x: number; y: number },
        n: number,
        m: number,
    ): Array<{ x: number; y: number }> | null {
        const row = (count: number, dx: number, spacing: number) =>
            Array.from({ length: count }, (_, i) => ({
                x: center.x + dx,
                y: center.y + (i - (count - 1) / 2) * spacing,
            }));
        const spots = [...row(n, DUMMY_DIST, DUMMY_SPACING), ...row(m, -TEAMMATE_DIST, TEAMMATE_SPACING)];
        const ok = spots.every((s) => this.clearPath(center, s) && this.openGround(center, s, 2.5));
        return ok ? spots : null;
    }

    /**
     * Adds `n` dummies facing the local player and lines up its teammates behind it, moving the local player to open
     * ground if needed.
     */
    private arrangeSandbox(n: number): void {
        const game = this.game;
        const self = game.getPlayer(this.playerId);
        if (!self) return;
        const m = this.teammates.length;
        let center = v2.copy(self.pos);
        let spots = this.sandboxSpots(center, n, m);
        const { width, height } = game.mapData;
        for (let ring = 4; !spots && ring < width / 2; ring += 4) {
            for (let a = 0; a < 16 && !spots; a++) {
                const ang = (a / 16) * Math.PI * 2;
                const p = { x: self.pos.x + Math.cos(ang) * ring, y: self.pos.y + Math.sin(ang) * ring };
                if (p.x < 60 || p.y < 60 || p.x > width - 60 || p.y > height - 60) continue;
                spots = this.sandboxSpots(p, n, m);
                if (spots) center = p;
            }
        }
        if (!spots) return;
        game.teleportPlayer(this.playerId, center);
        const enemy: AddPlayerOptions = (game.options.teamMode ?? 1) > 1 ? { autoFill: false } : {};
        spots.slice(0, n).forEach((spot, i) => {
            const id = game.addPlayer(`dummy ${i + 1}`, enemy);
            game.teleportPlayer(id, spot);
            const toPlayer = v2.normalize(v2.sub(center, spot));
            game.setInput(id, { ...emptyInput(), toMouseDir: toPlayer, toMouseLen: DUMMY_DIST });
            this.dummies.push(id);
        });
        spots.slice(n).forEach((spot, i) => {
            const id = this.teammates[i];
            game.teleportPlayer(id, spot);
            game.setInput(id, { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, toMouseLen: DUMMY_DIST });
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
