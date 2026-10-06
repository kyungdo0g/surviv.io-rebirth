// A bot: perceives through its snapshots, decides with the brain every few snapshots, and turns the Intent into a
// PlayerInput every tick (8-way movement keys, the aim, fire discipline, grenade throws, weapon switches and one-shot
// actions). The aim is either the legacy rate-limited aim (motor/legacy.ts) or the human
// cursor motor model (motor/human.ts), per DifficultyParams.motor.model. Pure and deterministic given its seed: no wall
// clock, no unseeded randomness. BotController (in-process) and NetworkBot (WebSocket) feed it.
import { type Collider, createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef, Input, WeaponSlot } from "@rebirth/defs";
import { type EmoteRequest, emptyInput, type MapData, type PlayerInput, type Snapshot } from "@rebirth/sim";
import { Brain } from "./brain/brain.ts";
import { ClassPicker } from "./brain/classPick.ts";
import { type BotOrder, emptyIntent, type Intent, type IntentEmote } from "./brain/context.ts";
import { type BrainFeatures, type BrainName, brainFeatures, brainLabel } from "./brain/features.ts";
import { ThrowController, TriggerController, throwMouseLen } from "./brain/trigger.ts";
import { type Difficulty, type DifficultyParams, difficultyParams } from "./difficulty.ts";
import { angleOf, dirOf, distanceToCollider } from "./geom.ts";
import { HumanMotor, type MotorGoal } from "./motor/human.ts";
import { KeyStick, octantFree, octantKeys, PathCarrot } from "./motor/keys.ts";
import { AimController, legacyTolerance } from "./motor/legacy.ts";
import { sameLayer } from "./nav/cellGrid.ts";
import { PathFollower } from "./nav/follower.ts";
import { NavGrid } from "./nav/grid.ts";
import { installPerception } from "./perception/install.ts";
import { WorldModel } from "./perception/world.ts";

export interface BotOptions {
    /** preset name or custom parameters (default "normal") */
    difficulty?: Difficulty | DifficultyParams;
    /** seed of the bot's own random stream (aim error, tactics, exploration) */
    seed: number;
    /** brain preset name or custom feature flags (default DEFAULT_BRAIN, "smart") */
    brain?: BrainName | BrainFeatures;
    /** navigation grid override (default: the shared grid of the map) */
    nav?: NavGrid;
}

const SLOT_ACTIONS = [Input.EquipPrimary, Input.EquipSecondary, Input.EquipMelee, Input.EquipThrowable];
const DIRS: readonly Vec2[] = Array.from({ length: 8 }, (_, k) => dirOf((k * Math.PI) / 4));
/** Own speed estimates above this are teleports or respawns, not walking (units/s). */
const MAX_SELF_SPEED = 30;

export class Bot {
    readonly model: WorldModel;
    readonly brain: Brain;
    readonly params: DifficultyParams;
    /** what the brain knows how to do (also `ctx.features` in behaviours) */
    readonly features: Readonly<BrainFeatures>;
    /** preset the features equal, or "custom" */
    readonly brainName: BrainName | "custom";
    readonly rng: Rng;
    readonly follower: PathFollower;
    /** the legacy aim (motor model "legacy"), else null */
    readonly aim: AimController | null;
    /** the human cursor motor (motor model "human"), else null; its own random stream */
    readonly motor: HumanMotor | null;
    /** human motor: 8-way keys held like a person's (hysteresis, minimum holds), else null (per-tick dithering) */
    readonly stick: KeyStick | null;
    private readonly carrot = new PathCarrot();
    /** human keys: colliders of the movement-blocking obstacles close by (refreshed every snapshot) */
    private nearColliders: Collider[] = [];
    readonly trigger: TriggerController;
    readonly throws: ThrowController;
    /** Cobalt class menu (M7b): its own random stream, so the other decisions stay as on any map */
    readonly classPicker: ClassPicker;
    /** class chosen by the last observe(), to send once (Game.selectRole / PerkModeRoleSelect) */
    classChoice: string | null = null;
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
    private pendingEmote: EmoteRequest | null = null;
    private lastSlotRequest = Number.NEGATIVE_INFINITY;
    // human motor: the brain's lead offset from the target at the last decision, and the bot's own velocity
    private aimOffset: Vec2 | null = null;
    private selfVel: Vec2 = { x: 0, y: 0 };
    private lastSelf: { pos: Vec2; time: number } | null = null;

    constructor(map: MapData, opts: BotOptions) {
        this.params = difficultyParams(opts.difficulty ?? "normal");
        this.features = brainFeatures(opts.brain);
        this.brainName = brainLabel(this.features);
        this.rng = createRng(opts.seed);
        this.model = new WorldModel(map, opts.nav ?? NavGrid.forMap(map));
        this.model.memory = this.params.memory;
        installPerception(this.model, this.features);
        this.brain = new Brain(this.model, this.params, this.rng, this.features);
        this.follower = new PathFollower(this.rng);
        const human = this.params.motor.model === "human";
        // the motor's own stream (like the class picker's): motor noise never shifts the brain's decisions
        const motorRng = createRng(opts.seed ^ 0x9e3779b9);
        this.aim = human ? null : new AimController(this.params, this.rng);
        this.motor = human ? new HumanMotor(this.params, motorRng) : null;
        this.stick = human ? new KeyStick(motorRng) : null;
        this.trigger = new TriggerController(this.params, human ? motorRng : this.rng);
        this.throws = new ThrowController();
        this.classPicker = new ClassPicker(map.mapName, createRng(opts.seed ^ 0x2545f491));
    }

    /** Overrides the brain (tests, scripted scenarios); null gives control back. */
    setOrder(order: BotOrder | null): void {
        this.brain.mem.order = order;
        this.lastThink = Number.NEGATIVE_INFINITY;
    }

    get dead(): boolean {
        return this.model.self.dead;
    }

    /** The emote or ping the brain asked for since the last call (team play), or null; the host sends it once. */
    takeEmote(): EmoteRequest | null {
        const e = this.pendingEmote;
        this.pendingEmote = null;
        return e;
    }

    observe(snap: Snapshot): void {
        const model = this.model;
        model.observe(snap);
        this.classChoice = this.classPicker.update(snap);
        this.clock = model.time;
        if (this.motor) this.trackSelf();
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

    /** Own velocity from consecutive snapshots (human motor: targets move relative to the cursor as the bot walks). */
    private trackSelf(): void {
        const s = this.model.self;
        const last = this.lastSelf;
        if (last && this.model.time > last.time) {
            const inst = v2.div(v2.sub(s.pos, last.pos), this.model.time - last.time);
            this.selfVel = v2.length(inst) > MAX_SELF_SPEED ? { x: 0, y: 0 } : v2.lerp(0.5, this.selfVel, inst);
        }
        this.lastSelf = { pos: v2.copy(s.pos), time: this.model.time };
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
        if (intent.emote) this.pendingEmote = emoteRequest(intent.emote);
        if (this.motor) {
            // the brain leads the target by an offset; the hand applies it to the target as it sees it every snapshot
            const t = intent.targetId ? this.model.contacts.get(intent.targetId) : undefined;
            this.aimOffset = intent.aim && t ? v2.sub(intent.aim, t.pos) : null;
        }
    }

    private updateSteering(): void {
        const it = this.intent;
        if (this.stick) {
            const self = this.model.self;
            this.nearColliders = [];
            for (const o of this.model.obstacles)
                if (o.blocksMove && sameLayer(self.layer, o.view.layer) && distanceToCollider(self.pos, o.col) < 3)
                    this.nearColliders.push(o.col);
        }
        if (it.stop) {
            this.moveDir = null;
        } else if (it.moveDir) {
            this.moveDir = it.moveDir;
        } else if (it.goal) {
            // goal layer (0 ground, 1 underground: basements and bunkers); undefined keeps ground navigation
            const goalLayer = (it as Intent & { goalLayer?: number }).goalLayer;
            const r = this.follower.steer(this.model, it.goal, this.clock, it.arriveDist, goalLayer);
            // human keys: head for a carrot on the path leg, so 8-way motion converges on the line
            this.moveDir =
                r.dir && this.stick ? this.carrot.heading(this.model.self.pos, this.follower.points, r.dir) : r.dir;
            if (r.openDoor) this.pendingActions.push(Input.Use);
            if (r.failed) {
                const mem = this.brain.mem;
                mem.failedGoal = v2.copy(it.goal);
                mem.failedUntil = this.clock + 20;
                if (it.behaviour === "loot" && mem.lootTarget) mem.lootBlacklist.set(mem.lootTarget, this.clock + 30);
                // an obstacle behind walls (vault deposit boxes, police cells) is not retried until BREAK_TIMEOUT
                if (it.behaviour === "break" && mem.breakTarget)
                    mem.lootBlacklist.set(mem.breakTarget, this.clock + 30);
                if (it.behaviour === "explore") mem.exploreGoal = null;
                this.follower.clear();
            }
        } else {
            this.moveDir = null;
        }
    }

    /** Legacy motor: 8-way keys whose average over ticks follows `dir` (error diffusion, a key change most ticks). */
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

    /** Human motor: the key octant held for the wanted heading (hysteresis, minimum holds; motor/keys.ts). */
    private humanKeys(input: PlayerInput, dir: Vec2 | null, stick: KeyStick): void {
        const it = this.intent;
        const pos = this.model.self.pos;
        const free = (octant: number) => octantFree(pos, octant, this.nearColliders);
        const k = octantKeys(stick.update(dir, this.clock, it.behaviour === "fight" || it.moveDir !== null, free));
        input.moveRight = k.right;
        input.moveLeft = k.left;
        input.moveUp = k.up;
        input.moveDown = k.down;
    }

    /** The input for the next `dt` seconds. */
    act(dt: number): PlayerInput {
        this.clock += dt;
        const input = emptyInput(++this.seq & 0xff);
        const self = this.model.self;
        input.toMouseDir = this.motor ? this.motor.mouseDir : dirOf(this.aim?.angle ?? 0);
        if (self.dead) return input;
        const still = this.throws.active && this.throws.holdStill(this.clock);
        if (this.stick) this.humanKeys(input, still ? null : this.moveDir, this.stick);
        else if (this.moveDir && !still) this.keys(input, this.moveDir);
        else this.moveErr = { x: 0, y: 0 };
        if (this.motor) this.aimHuman(input, dt, this.motor);
        else if (this.aim) this.aimLegacy(input, dt, this.aim);
        if (this.pendingActions.length) input.actions = this.pendingActions.splice(0, 7);
        if (this.pendingUse) {
            input.useItem = this.pendingUse;
            this.pendingUse = "";
        }
        return input;
    }

    /** Legacy aim and trigger (unchanged, so legacy runs replay exactly). */
    private aimLegacy(input: PlayerInput, dt: number, aim: AimController): void {
        const self = this.model.self;
        const throwing = this.throws.active ? this.throws.update(this.clock, self) : null;
        const intent = this.intent;
        const aimPoint = throwing?.aim ?? intent.aim;
        const target = intent.targetId ? this.model.contacts.get(intent.targetId) : undefined;
        const wanted = aimPoint ? angleOf(v2.sub(aimPoint, self.pos)) : null;
        const idle = this.moveDir ? angleOf(this.moveDir) : null;
        const speed = target ? v2.length(target.vel) : 0;
        const goal = aim.update(dt, this.clock, wanted, idle, intent.targetId, speed);
        input.toMouseDir = dirOf(aim.angle);
        const dist = aimPoint ? v2.distance(self.pos, aimPoint) : 0;
        input.toMouseLen = aimPoint ? dist : 8;

        if (throwing) {
            input.shootStart = throwing.shootStart;
            input.shootHold = throwing.shootHold;
            input.toMouseLen = throwing.mouseLen;
            if (throwing.useItem) input.useItem = throwing.useItem;
        } else {
            const weapon = self.weapons[self.curWeapIdx]?.type ?? "";
            const want = intent.fire && wanted !== null && aim.onTarget(goal, legacyTolerance(weapon, dist));
            const shot = this.trigger.update(this.clock, want, weapon, dist);
            input.shootStart = shot.shootStart;
            input.shootHold = shot.shootHold;
            this.requestSlot();
        }
    }

    /** Human motor: the hand moves the cursor towards the goal, the trigger finger fires when it is on target. */
    private aimHuman(input: PlayerInput, dt: number, motor: HumanMotor): void {
        const self = this.model.self;
        const intent = this.intent;
        const plan = this.throws.active ? this.throws.plan : null;
        let goal: MotorGoal | null = null;
        let aimPoint: Vec2 | null = null;
        if (plan) {
            aimPoint = plan.pos;
            const rel = v2.sub(plan.pos, self.pos);
            goal = { kind: "throw", rel, len: throwMouseLen(plan.item, v2.length(rel)) };
        } else if (intent.aim) {
            const target = intent.targetId ? this.model.contacts.get(intent.targetId) : undefined;
            aimPoint = target && this.aimOffset ? v2.add(target.pos, this.aimOffset) : intent.aim;
            const [lo, hi] = this.params.reactionTime;
            const mem = this.brain.mem;
            goal = {
                kind: "target",
                key: target ? target.id : -1,
                rel: v2.sub(aimPoint, self.pos),
                vel: target?.visible ? target.vel : { x: 0, y: 0 },
                at: this.model.time,
                firstSeen: target?.firstSeen ?? this.model.time,
                reaction: target && mem.engagedTarget === target.id ? mem.reaction : (lo + hi) / 2,
            };
        }
        const lookAt = intent.lookAt ? v2.sub(intent.lookAt, self.pos) : null;
        const selfVel = this.selfVel;
        motor.update({ dt, now: this.clock, zoom: self.zoom, goal, selfVel, moveDir: this.moveDir, lookAt });
        input.toMouseDir = motor.mouseDir;
        input.toMouseLen = motor.mouseLen;
        const throwing = plan ? this.throws.update(this.clock, self, motor.aimReady) : null;
        if (throwing) {
            input.shootStart = throwing.shootStart;
            input.shootHold = throwing.shootHold;
            if (throwing.useItem) input.useItem = throwing.useItem;
            return;
        }
        const weapon = self.weapons[self.curWeapIdx]?.type ?? "";
        const dist = aimPoint ? v2.distance(self.pos, aimPoint) : 0;
        const sense = {
            dir: motor.mouseDir,
            cursor: motor.cursor,
            cursorVel: motor.vel,
            aim: motor.aim,
            aimVel: motor.aimVel,
            acquisition: motor.acquisition,
        };
        const shot = this.trigger.updateHuman(this.clock, intent.fire && aimPoint !== null, sense, weapon, dist);
        input.shootStart = shot.shootStart;
        input.shootHold = shot.shootHold;
        this.requestSlot();
    }

    /** Asks for the intent's weapon slot (throttled; never re-selects the throwable while holding it). */
    private requestSlot(): void {
        const self = this.model.self;
        const slot = this.intent.slot;
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
}

/** The Emote message for an intent's emote: pings (def type "ping") mark their position, emotes float over the bot. */
function emoteRequest(e: IntentEmote): EmoteRequest {
    const isPing = hasDef(e.type) && GameObjectDefs[e.type].type === "ping";
    return isPing && e.pos ? { type: e.type, isPing, pos: v2.copy(e.pos) } : { type: e.type, isPing };
}
