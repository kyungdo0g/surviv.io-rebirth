// A bot: perceives through its snapshots, decides with the brain every few snapshots, and turns the Intent into a
// PlayerInput every tick (8-way keys dithered to approximate any direction, a rate-limited aim with human error, fire
// discipline, grenade throws, weapon switches and one-shot actions). Pure and deterministic given its seed: no wall
// clock, no unseeded randomness. BotController (in-process) and NetworkBot (WebSocket) feed it.
import { createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef, Input, WeaponSlot } from "@rebirth/defs";
import { emptyInput, type MapData, type PlayerInput, type Snapshot } from "@rebirth/sim";
import { AimController } from "./brain/aim.ts";
import { Brain } from "./brain/brain.ts";
import { type BotOrder, emptyIntent, type Intent } from "./brain/context.ts";
import { ThrowController, TriggerController } from "./brain/trigger.ts";
import { type Difficulty, type DifficultyParams, difficultyParams } from "./difficulty.ts";
import { angleOf, dirOf } from "./geom.ts";
import { gunInfo } from "./knowledge/weapons.ts";
import { PathFollower } from "./nav/follower.ts";
import { NavGrid } from "./nav/grid.ts";
import { WorldModel } from "./perception/world.ts";

export interface BotOptions {
    /** preset name or custom parameters (default "normal") */
    difficulty?: Difficulty | DifficultyParams;
    /** seed of the bot's own random stream (aim error, tactics, exploration) */
    seed: number;
    /** navigation grid override (default: the shared grid of the map) */
    nav?: NavGrid;
}

const SLOT_ACTIONS = [Input.EquipPrimary, Input.EquipSecondary, Input.EquipMelee, Input.EquipThrowable];
const DIRS: readonly Vec2[] = Array.from({ length: 8 }, (_, k) => dirOf((k * Math.PI) / 4));
const DEG = Math.PI / 180;

export class Bot {
    readonly model: WorldModel;
    readonly brain: Brain;
    readonly params: DifficultyParams;
    readonly rng: Rng;
    readonly follower: PathFollower;
    readonly aim: AimController;
    readonly trigger: TriggerController;
    readonly throws: ThrowController;
    intent: Intent = emptyIntent();
    /** decisions taken (diagnostics) */
    thinks = 0;
    private clock = 0;
    private lastThink = Number.NEGATIVE_INFINITY;
    private seq = 0;
    private moveErr: Vec2 = { x: 0, y: 0 };
    private moveDir: Vec2 | null = null;
    private readonly pendingActions: number[] = [];
    private pendingUse = "";
    private lastSlotRequest = Number.NEGATIVE_INFINITY;

    constructor(map: MapData, opts: BotOptions) {
        this.params = difficultyParams(opts.difficulty ?? "normal");
        this.rng = createRng(opts.seed);
        this.model = new WorldModel(map, opts.nav ?? NavGrid.forMap(map));
        this.model.memory = this.params.memory;
        this.brain = new Brain(this.model, this.params, this.rng);
        this.follower = new PathFollower(this.rng);
        this.aim = new AimController(this.params, this.rng);
        this.trigger = new TriggerController(this.params, this.rng);
        this.throws = new ThrowController();
    }

    /** Overrides the brain (tests, scripted scenarios); null gives control back. */
    setOrder(order: BotOrder | null): void {
        this.brain.mem.order = order;
        this.lastThink = Number.NEGATIVE_INFINITY;
    }

    get dead(): boolean {
        return this.model.self.dead;
    }

    observe(snap: Snapshot): void {
        const model = this.model;
        model.observe(snap);
        this.clock = model.time;
        if (model.self.dead) {
            this.intent = emptyIntent("idle");
            this.moveDir = null;
            return;
        }
        const hurt = model.lastHealthLoss === model.time;
        let sighted = false;
        for (const c of model.contacts.values())
            if (c.visible && c.firstSeen === model.time && !c.teammate) sighted = true;
        const due = model.snapshots % this.params.thinkEvery === 0;
        if (due || hurt || sighted || this.lastThink === Number.NEGATIVE_INFINITY) this.think();
        this.updateSteering();
    }

    private think(): void {
        const dt = Number.isFinite(this.lastThink) ? this.clock - this.lastThink : 0.1;
        this.lastThink = this.clock;
        this.thinks++;
        const intent = this.brain.think(this.clock, dt);
        this.intent = intent;
        for (const a of intent.actions) this.pendingActions.push(a);
        if (intent.useItem) this.pendingUse = intent.useItem;
        if (intent.throwPlan && !this.throws.active) this.throws.start(intent.throwPlan, this.clock);
    }

    private updateSteering(): void {
        const it = this.intent;
        if (it.stop) {
            this.moveDir = null;
        } else if (it.moveDir) {
            this.moveDir = it.moveDir;
        } else if (it.goal) {
            const r = this.follower.steer(this.model, it.goal, this.clock, it.arriveDist);
            this.moveDir = r.dir;
            if (r.openDoor) this.pendingActions.push(Input.Use);
            if (r.failed) {
                const mem = this.brain.mem;
                mem.failedGoal = v2.copy(it.goal);
                mem.failedUntil = this.clock + 20;
                if (it.behaviour === "loot" && mem.lootTarget) mem.lootBlacklist.set(mem.lootTarget, this.clock + 30);
                if (it.behaviour === "explore") mem.exploreGoal = null;
                this.follower.clear();
            }
        } else {
            this.moveDir = null;
        }
    }

    /** 8-way keys whose average over ticks follows `dir` (error diffusion). */
    private keys(input: PlayerInput, dir: Vec2): void {
        this.moveErr = v2.add(this.moveErr, dir);
        let best = 0;
        let bestDot = Number.NEGATIVE_INFINITY;
        for (let k = 0; k < 8; k++) {
            const d = v2.dot(this.moveErr, DIRS[k]);
            if (d > bestDot) {
                bestDot = d;
                best = k;
            }
        }
        const pick = DIRS[best];
        this.moveErr = v2.sub(this.moveErr, pick);
        const len = v2.length(this.moveErr);
        if (len > 1.5) this.moveErr = v2.mul(this.moveErr, 1.5 / len);
        input.moveRight = pick.x > 0.3;
        input.moveLeft = pick.x < -0.3;
        input.moveUp = pick.y > 0.3;
        input.moveDown = pick.y < -0.3;
    }

    /** Aim tolerance for firing: the target's body plus part of the weapon's spread. */
    private tolerance(weapon: string, dist: number): number {
        const base = Math.atan2(1.1, Math.max(dist, 1));
        if (!weapon || !hasDef(weapon)) return base;
        const def = GameObjectDefs[weapon];
        if (def.type === "melee") return 35 * DEG;
        const info = gunInfo(weapon);
        const spread = info && info.def.bulletCount > 1 ? info.def.shotSpread * 0.4 * DEG : 0;
        return Math.min(25 * DEG, Math.max(1.2 * DEG, base + spread));
    }

    /** The input for the next `dt` seconds. */
    act(dt: number): PlayerInput {
        this.clock += dt;
        const input = emptyInput(++this.seq & 0xff);
        const self = this.model.self;
        input.toMouseDir = dirOf(this.aim.angle);
        if (self.dead) return input;
        const still = this.throws.active && this.throws.holdStill(this.clock);
        if (this.moveDir && !still) this.keys(input, this.moveDir);
        else this.moveErr = { x: 0, y: 0 };

        const throwing = this.throws.active ? this.throws.update(this.clock, self) : null;
        const intent = this.intent;
        const aimPoint = throwing?.aim ?? intent.aim;
        const target = intent.targetId ? this.model.contacts.get(intent.targetId) : undefined;
        const wanted = aimPoint ? angleOf(v2.sub(aimPoint, self.pos)) : null;
        const idle = this.moveDir ? angleOf(this.moveDir) : null;
        const speed = target ? v2.length(target.vel) : 0;
        const goal = this.aim.update(dt, this.clock, wanted, idle, intent.targetId, speed);
        input.toMouseDir = dirOf(this.aim.angle);
        const dist = aimPoint ? v2.distance(self.pos, aimPoint) : 0;
        input.toMouseLen = aimPoint ? dist : 8;

        if (throwing) {
            input.shootStart = throwing.shootStart;
            input.shootHold = throwing.shootHold;
            input.toMouseLen = throwing.mouseLen;
            if (throwing.useItem) input.useItem = throwing.useItem;
        } else {
            const weapon = self.weapons[self.curWeapIdx]?.type ?? "";
            const want = intent.fire && wanted !== null && this.aim.onTarget(goal, this.tolerance(weapon, dist));
            const shot = this.trigger.update(this.clock, want, weapon, dist);
            input.shootStart = shot.shootStart;
            input.shootHold = shot.shootHold;
            const slot = intent.slot;
            if (
                slot !== null &&
                slot !== self.curWeapIdx &&
                self.weapons[slot]?.type &&
                this.clock - this.lastSlotRequest > 0.35 &&
                !(slot === WeaponSlot.Throwable && self.curWeapIdx === WeaponSlot.Throwable)
            ) {
                this.lastSlotRequest = this.clock;
                this.pendingActions.push(SLOT_ACTIONS[slot]);
            }
        }
        if (this.pendingActions.length) input.actions = this.pendingActions.splice(0, 7);
        if (this.pendingUse) {
            input.useItem = this.pendingUse;
            this.pendingUse = "";
        }
        return input;
    }
}
