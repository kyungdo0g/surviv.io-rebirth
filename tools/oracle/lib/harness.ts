// In-process survev game driver: fixed-step ticking, scripted player input, and recording of shots, bullets
// and damage events. Tick numbers count completed `game.update(dt)` calls; an event recorded during the update
// that completes tick N carries tick N (time N * dt).
import { NET_SYNC_TPS, TICK_DT } from "./paths.ts";
import { type HeadshotMode, type RandomSource, seeded, useRandom } from "./rng.ts";
import { type Survev, setHeadshotMode } from "./survev.ts";

export const ORACLE_MAP = "oracle_flat";

/** Scenario rows start this far from the map border: the outer ~50 m of the oracle map are ocean and beach. */
export const ORIGIN = { x: 150, y: 150 } as const;

export type TeamModeName = "solo" | "duo" | "squad";

export interface Vec {
    x: number;
    y: number;
}

export interface HarnessOptions {
    map?: string;
    teamMode?: TeamModeName;
    dt?: number;
    seed?: number;
    /** let the game start (gas, planes, game over); off by default so test scenarios never end the game */
    started?: boolean;
}

export interface BulletRecord {
    tick: number;
    playerId: number;
    bulletType: string;
    reflectCount: number;
    bullet: any;
    distance: number;
    speed: number;
    /** distance covered during the tick the bullet was fired in */
    firstStep?: number;
    endTick?: number;
    distanceTraveled?: number;
}

export interface ShotRecord {
    tick: number;
    playerId: number;
    weapon: string;
    bullets: BulletRecord[];
}

export interface DamageEvent {
    tick: number;
    amount: number;
    applied: number;
    damageType: number;
    gameSourceType?: string;
    isExplosion?: boolean;
    healthAfter: number;
    downed: boolean;
    dead: boolean;
}

export interface InputState {
    moveLeft?: boolean;
    moveRight?: boolean;
    moveUp?: boolean;
    moveDown?: boolean;
    shootHold?: boolean;
    /** send shootStart on every tick (spam clicking): the fastest a single-fire weapon can be fired */
    shootStart?: boolean;
    dir?: Vec;
    toMouseLen?: number;
}

interface PlayerControl {
    state: InputState;
    pending: string[];
    useItem: string;
}

/** Registers the empty oracle map: survev's `test_normal` (no rivers, lakes or spawns) enlarged to 1024 base units. */
export function registerOracleMap(sv: Survev): void {
    if (sv.MapDefs[ORACLE_MAP]) return;
    sv.MapDefs[ORACLE_MAP] = sv.util.mergeDeep({}, sv.MapDefs.test_normal, {
        mapGen: { map: { baseWidth: 1024, baseHeight: 1024 } },
    });
}

export class Harness {
    readonly sv: Survev;
    readonly game: any;
    readonly dt: number;
    tick = 0;
    readonly shots: ShotRecord[] = [];
    readonly bullets: BulletRecord[] = [];
    private openBullets: BulletRecord[] = [];
    private controls = new Map<any, PlayerControl>();
    private lastSync = -1;
    /** netSync serializes health in [0, 100]; it is paused while the health cap is raised */
    private netSyncPaused = false;
    /** the shot being recorded while WeaponManager.fireWeapon runs (bullets fired elsewhere are not shots) */
    private firing: ShotRecord | null | undefined;

    constructor(sv: Survev, opts: HarnessOptions = {}) {
        this.sv = sv;
        this.dt = opts.dt ?? TICK_DT;
        registerOracleMap(sv);
        useRandom(seeded(opts.seed ?? 1));
        const teamMode = { solo: sv.TeamMode.Solo, duo: sv.TeamMode.Duo, squad: sv.TeamMode.Squad }[
            opts.teamMode ?? "solo"
        ];
        this.game = new sv.Game("oracle", { mapName: opts.map ?? ORACLE_MAP, teamMode });
        this.game.preventStart = !opts.started;
        const barn = this.game.bulletBarn;
        const fire = barn.fireBullet.bind(barn);
        barn.fireBullet = (params: any) => {
            this.closeBullets();
            const bullet = fire(params);
            this.recordBullet(params, bullet);
            return bullet;
        };
    }

    /** Switches the random source and headshot rule for the rest of the scenario. */
    setMode(random: RandomSource, headshot: HeadshotMode): void {
        useRandom(random);
        setHeadshotMode(this.sv, headshot);
    }

    /** Position of scenario row `row` (rows are stacked along +y, `x` metres from the ORIGIN column). */
    rowPos(row: number, spacing: number, x = 0): Vec {
        return { x: ORIGIN.x + x, y: ORIGIN.y + row * spacing };
    }

    get center(): Vec {
        return { x: this.game.map.width / 2, y: this.game.map.height / 2 };
    }

    addPlayer(pos: Vec, opts: { group?: any; dir?: Vec } = {}): any {
        const player = this.game.playerBarn.addTestPlayer({ pos: this.sv.v2.create(pos.x, pos.y), group: opts.group });
        const dir = opts.dir ?? { x: 1, y: 0 };
        player.dir = this.sv.v2.create(dir.x, dir.y);
        player.dirNew = this.sv.v2.create(dir.x, dir.y);
        const wm = player.weaponManager;
        const fireWeapon = wm.fireWeapon.bind(wm);
        wm.fireWeapon = (...args: unknown[]) => {
            this.firing = null;
            try {
                return fireWeapon(...args);
            } finally {
                this.firing = undefined;
            }
        };
        return player;
    }

    /** Sets the persistent input of a player (re-sent every tick until changed). */
    hold(player: any, state: InputState): void {
        this.control(player).state = { ...state };
    }

    /** Queues one-shot inputs (GameConfig.Input names) and/or an item use for the next tick. */
    press(player: any, inputs: string[], useItem = ""): void {
        const c = this.control(player);
        c.pending.push(...inputs);
        if (useItem) c.useItem = useItem;
    }

    private control(player: any): PlayerControl {
        let c = this.controls.get(player);
        if (!c) {
            c = { state: {}, pending: [], useItem: "" };
            this.controls.set(player, c);
        }
        return c;
    }

    private sendInputs(): void {
        const { InputMsg, GameConfig, v2 } = this.sv;
        for (const [player, c] of this.controls) {
            if (player.dead) continue;
            const msg = new InputMsg();
            const s = c.state;
            msg.moveLeft = !!s.moveLeft;
            msg.moveRight = !!s.moveRight;
            msg.moveUp = !!s.moveUp;
            msg.moveDown = !!s.moveDown;
            msg.shootHold = !!s.shootHold;
            msg.shootStart = !!s.shootStart;
            const dir = s.dir ?? { x: player.dir.x, y: player.dir.y };
            msg.toMouseDir = v2.create(dir.x, dir.y);
            msg.toMouseLen = s.toMouseLen ?? 10;
            for (const name of c.pending) {
                const input = GameConfig.Input[name];
                if (input === undefined) throw new Error(`unknown input ${name}`);
                msg.addInput(input);
            }
            msg.useItem = c.useItem;
            c.pending = [];
            c.useItem = "";
            player.handleInput(msg);
        }
    }

    step(n = 1): void {
        for (let i = 0; i < n; i++) {
            this.sendInputs();
            this.tick++;
            this.game.update(this.dt);
            this.afterTick();
            const sync = Math.floor(this.tick * this.dt * NET_SYNC_TPS + 1e-9);
            if (sync !== this.lastSync && !this.netSyncPaused) {
                this.lastSync = sync;
                this.game.netSync();
            }
        }
    }

    /** Steps until `pred` holds after a tick; returns that tick, or undefined after `maxTicks`. */
    stepUntil(pred: () => boolean, maxTicks: number): number | undefined {
        for (let i = 0; i < maxTicks; i++) {
            this.step();
            if (pred()) return this.tick;
        }
        return undefined;
    }

    stepSeconds(seconds: number): void {
        this.step(Math.round(seconds / this.dt));
    }

    private recordBullet(params: any, bullet: any): void {
        const rec: BulletRecord = {
            tick: this.tick,
            playerId: params.playerId,
            bulletType: params.bulletType,
            reflectCount: params.reflectCount ?? 0,
            bullet,
            distance: bullet.distance,
            speed: bullet.speed,
        };
        this.bullets.push(rec);
        this.openBullets.push(rec);
        if (this.firing === undefined) return; // shrapnel, reflections, ...
        if (this.firing === null) {
            this.firing = { tick: this.tick, playerId: params.playerId, weapon: params.gameSourceType, bullets: [] };
            this.shots.push(this.firing);
        }
        this.firing.bullets.push(rec);
    }

    private closeBullets(): void {
        this.openBullets = this.openBullets.filter((rec) => {
            if (rec.bullet.active) return true;
            rec.endTick = this.tick;
            rec.distanceTraveled = rec.bullet.distanceTraveled;
            if (rec.firstStep === undefined) rec.firstStep = rec.bullet.distanceTraveled;
            return false;
        });
    }

    private afterTick(): void {
        for (const rec of this.openBullets) {
            if (rec.firstStep === undefined && rec.tick === this.tick) rec.firstStep = rec.bullet.distanceTraveled;
        }
        this.closeBullets();
    }

    shotsBy(player: any): ShotRecord[] {
        return this.shots.filter((s) => s.playerId === player.__id);
    }

    /** Records every damage call on `player` (wraps the instance's damage method). */
    watchDamage(player: any): DamageEvent[] {
        const events: DamageEvent[] = [];
        const original = player.damage;
        player.damage = (params: any) => {
            if (player.dead) return original.call(player, params); // ignored by survev, not recorded
            const before = player.health;
            const wasDowned = player.downed;
            original.call(player, params);
            const becameDowned = !wasDowned && player.downed;
            events.push({
                tick: this.tick,
                amount: params.amount,
                applied: becameDowned || player.dead ? before : before - player.health,
                damageType: params.damageType,
                gameSourceType: params.gameSourceType,
                isExplosion: params.isExplosion,
                healthAfter: player.health,
                downed: player.downed,
                dead: player.dead,
            });
        };
        return events;
    }

    /** Puts a gun in a slot with a full (or given) magazine and plenty of reserve ammo. */
    giveGun(player: any, type: string, opts: { slot?: number; ammo?: number; reserve?: number } = {}): any {
        const def = this.sv.GameObjectDefs.typeToDef(type, "gun");
        const slot = opts.slot ?? 0;
        player.weaponManager.setWeapon(slot, type, opts.ammo ?? def.maxClip);
        if (player.invManager.isValid(def.ammo)) player.invManager.set(def.ammo, opts.reserve ?? 990);
        return def;
    }

    /**
     * Runs `fn` with survev's health cap (GameConfig.player.health) raised, so a damage call is never clamped by the
     * remaining health. netSync is paused meanwhile (the wire format only holds health 0-100).
     */
    withHealthCap<T>(cap: number, fn: () => T): T {
        const original = this.sv.GameConfig.player.health;
        this.sv.GameConfig.player.health = cap;
        this.netSyncPaused = true;
        try {
            return fn();
        } finally {
            this.sv.GameConfig.player.health = original;
            this.netSyncPaused = false;
        }
    }

    /** Moves a player instantly (keeps the collider linked and the grid up to date). */
    teleport(player: any, pos: Vec): void {
        this.sv.v2.set(player.pos, this.sv.v2.create(pos.x, pos.y));
        this.game.grid.updateObject(player);
    }

    setArmor(player: any, helmet: string, chest: string): void {
        player.helmet = helmet;
        player.chest = chest;
        player.setDirty();
    }

    /** Seconds from tick a to tick b. */
    span(a: number, b: number): number {
        return (b - a) * this.dt;
    }
}
