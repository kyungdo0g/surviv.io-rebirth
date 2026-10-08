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
import { fragNoThrowNear } from "./brain/fragMath.ts";
import { throwBlocker } from "./brain/fragSkill.ts";
import { QuickSwitch } from "./brain/quickSwitch.ts";
import { zonePressure } from "./brain/survival.ts";
import { ThrowController, TriggerController, throwAimPoint, throwMouseLen } from "./brain/trigger.ts";
import { type Difficulty, type DifficultyParams, difficultyParams, type SkillTierName } from "./difficulty.ts";
import { angleOf, dirOf, distanceToCollider } from "./geom.ts";
import { HumanMotor, type MotorGoal, ONSET_SHARE } from "./motor/human.ts";
import { KeyStick, octantFree, octantKeys, PathCarrot } from "./motor/keys.ts";
import { AimController, legacyTolerance } from "./motor/legacy.ts";
import { sameLayer } from "./nav/cellGrid.ts";
import { PathFollower } from "./nav/follower.ts";
import { NavGrid } from "./nav/grid.ts";
import { installPerception } from "./perception/install.ts";
import { concealed } from "./perception/sight.ts";
import { type Contact, WorldModel } from "./perception/world.ts";
import { botPersona, PERSONA_SALT, type PersonaName, type PersonaParams } from "./persona.ts";
import { drawSkill, type SkillProfile, skillOf, skillParams, tierOfSkill } from "./skill.ts";

export interface BotOptions {
    /** preset name or custom parameters (default "normal"); ignored when `skill` is given */
    difficulty?: Difficulty | DifficultyParams;
    /**
     * skill tier (s drawn in its band, g = s + N(0, 0.2)) or an exact mechanics skill s in 0..1: the parameters are then
     * composed by skill.ts skillParams instead of a preset (bot overhaul POPULATION-3)
     */
    skill?: number | SkillTierName;
    /** game sense g in 0..1 with a numeric `skill` (default g = s; a tier draws its own) */
    sense?: number;
    /** persona name or custom parameters (default NEUTRAL: today's bot) */
    persona?: PersonaName | PersonaParams;
    /** draw the bot's own gun taste over a named, non-neutral persona (persona.ts botPersona; default true) */
    taste?: boolean;
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
/**
 * A throw being readied is broken off when a standing enemy comes inside the frag's no-throw distance (its blast's
 * full-damage radius plus 3 in the defs: 8 for the frag; bot overhaul COMBAT-11, brain/fragMath.ts)...
 * ...or rushes in this fast (u/s) from within ABORT_RUSH_DIST.
 */
const ABORT_RUSH = 6;
const ABORT_RUSH_DIST = 14;
/** An enemy seen or a hit taken this recently (s): the bot is alert, nothing that follows is a surprise. */
const CALM_AFTER = 3;
function isGunSlot(slot: number): boolean {
    return slot === WeaponSlot.Primary || slot === WeaponSlot.Secondary;
}

/** A goal this close is lined up on with short key taps (motor/keys.ts StickMode.fine). */
const FINE_DIST = 2.5;
/** Zone pressure (brain/survival.ts) above which a rotation is in a hurry: no walking pauses. */
const ZONE_HURRY = 0.3;
/** Behaviours that are travel: calm, they get the stop-and-go rhythm of walking (motor/rhythm.ts, round 5). */
const CALM_TRAVEL = new Set("explore loot break sweep regroup zone airdrop advance rally".split(" "));

export class Bot {
    readonly model: WorldModel;
    readonly brain: Brain;
    readonly params: DifficultyParams;
    /** what the brain knows how to do (also `ctx.features` in behaviours) */
    readonly features: Readonly<BrainFeatures>;
    /** preset the features equal, or "custom" */
    readonly brainName: BrainName | "custom";
    readonly rng: Rng;
    /** the seed of the bot's own streams (BotOptions.seed) */
    readonly seed: number;
    /** the bot's taste (persona.ts) and skill (skill.ts); drawn from their own stream, apart from `rng` */
    readonly persona: Readonly<PersonaParams>;
    readonly skill: Readonly<SkillProfile>;
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
    /** round 6 (report 44): an expert's quick switch after a slow gun's shot (BrainFeatures.quickSwitch), else null */
    readonly quick: QuickSwitch | null;
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
    /** human motor: the reaction to a surprise runs until `reactUntil`; the keys follow `reactIntent` until then */
    private reactUntil = Number.NEGATIVE_INFINITY;
    private reactIntent: Intent | null = null;
    /** WorldModel.lastHurt as of the previous snapshot, and the last snapshot with an enemy in view */
    private hurtBefore = Number.NEGATIVE_INFINITY;
    private enemyBefore = Number.NEGATIVE_INFINITY;

    constructor(map: MapData, opts: BotOptions) {
        // persona and skill draws: their own stream, so they never shift the brain's or the motor's sequences
        const personaRng = createRng(opts.seed ^ PERSONA_SALT);
        this.skill = resolveSkill(opts, personaRng);
        this.params =
            opts.skill === undefined
                ? difficultyParams(opts.difficulty ?? "normal")
                : skillParams(this.skill.s, this.skill.g, this.skill.tier);
        this.persona = botPersona(opts.persona, opts.seed, opts.taste !== false);
        this.features = brainFeatures(opts.brain);
        this.brainName = brainLabel(this.features);
        this.seed = opts.seed;
        this.rng = createRng(opts.seed);
        this.model = new WorldModel(map, opts.nav ?? NavGrid.forBrain(map, this.features));
        this.model.memory = this.params.memory;
        installPerception(this.model, this.features);
        this.brain = new Brain(this.model, this.params, this.rng, this.features, {
            persona: this.persona,
            skill: this.skill,
            personaRng,
            seed: opts.seed,
        });
        this.follower = new PathFollower(this.rng, this.brain.doors);
        const human = this.params.motor.model === "human";
        // the motor's own stream (like the class picker's): motor noise never shifts the brain's decisions
        const motorRng = createRng(opts.seed ^ 0x9e3779b9);
        this.aim = human ? null : new AimController(this.params, this.rng);
        this.motor = human ? new HumanMotor(this.params, motorRng) : null;
        this.stick = human ? new KeyStick(motorRng) : null;
        this.trigger = new TriggerController(this.params, human ? motorRng : this.rng);
        this.throws = new ThrowController();
        this.classPicker = new ClassPicker(map.mapName, createRng(opts.seed ^ 0x2545f491));
        this.quick = this.features.quickSwitch && this.skill.tier === "expert" ? new QuickSwitch() : null;
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
        this.quick?.observe(this.clock, snap.local.cooldowns?.freeSwitch);
        // own motion: the human motor's relative targets, and a throw on the run (round 4: ThrowPlan.run)
        this.trackSelf();
        if (model.self.dead) {
            this.intent = emptyIntent("idle");
            this.moveDir = null;
            return;
        }
        this.abortThrowWhenRushed();
        const hurt = model.lastHealthLoss === model.time;
        let sighted: Contact | null = null;
        let inView = false;
        for (const c of model.contacts.values()) {
            if (c.teammate || c.dead || !c.visible) continue;
            inView = true;
            if (c.firstSeen === model.time) sighted ??= c;
        }
        // no enemy in view and no hit in the last CALM_AFTER before this snapshot: what happens now is a surprise
        const calm = model.time - this.enemyBefore >= CALM_AFTER && model.time - this.hurtBefore >= CALM_AFTER;
        this.hurtBefore = model.lastHurt;
        if (inView) this.enemyBefore = model.time;
        const due = model.snapshots % this.params.thinkEvery === 0;
        if (due || hurt || sighted || this.lastThink === Number.NEGATIVE_INFINITY) {
            const before = this.intent;
            // human motor: a surprise (an enemy showing up, a hit out of the blue) is acted on only after a reaction
            const surprise = this.motor !== null && calm && (sighted !== null || model.lastHurt === model.time);
            this.think(surprise);
            if (surprise) this.gateReaction(before, sighted);
        }
        this.updateSteering();
    }

    /**
     * Human motor, surprised in calm (no enemy in view or seen in the last CALM_AFTER): the decision it takes at once
     * (the brain plans the fight on the very snapshot the enemy shows) reaches the keys and the weapon only after a
     * human reaction: until then the bot keeps moving as before and does not draw or throw (adversarial review: the gun
     * came out and the keys changed on the frame the enemy appeared, and only the cursor flick waited, so holstered
     * travel cost bots nothing). The hands move when the cursor hand does: ONSET_SHARE of the reaction the brain drew for
     * the new target (else the mean reaction), never before params.onsetFloor (motor/human.ts onsetDelay); to a hit from
     * nowhere, the mean dodge reaction.
     */
    private gateReaction(before: Intent, sighted: Contact | null): void {
        const mem = this.brain.mem;
        const p = this.params;
        let r: number;
        if (sighted) {
            const drawn = mem.engagedTarget === sighted.id ? mem.reaction : (p.reactionTime[0] + p.reactionTime[1]) / 2;
            r = Math.max(ONSET_SHARE * drawn, p.onsetFloor);
        } else r = (p.dodgeReaction[0] + p.dodgeReaction[1]) / 2;
        const from = sighted ? sighted.firstSeen : this.model.time;
        if (from + r <= this.clock) return;
        this.reactUntil = from + r;
        this.reactIntent = before;
    }

    /** The intent the keys follow: the one before a surprise while its reaction lasts (gateReaction), else the latest. */
    private steerIntent(): Intent {
        return this.clock < this.reactUntil && this.reactIntent ? this.reactIntent : this.intent;
    }

    /**
     * A frag being equipped or cooked while a standing enemy comes within ABORT_NEAR, or rushes in: break the throw off
     * and fight (COMBAT-11; diagnosis: a started throw ran its ~1-4 s of equip and cook against a rushing human).
     */
    private abortThrowWhenRushed(): void {
        // a smoke is the way out of such a fight: it goes on
        if (!this.throws.active || this.throws.plan?.item === "smoke") return;
        const me = this.model.self.pos;
        const near = fragNoThrowNear(this.throws.plan?.item ?? "frag");
        // a frag thrown to deny a push, or back at a chaser's path while running (round 4), goes on against the rusher
        // until it is inside the no-throw distance
        const reason = this.brain.mem.fight.planReason;
        const push = reason === "push" || reason === "escape";
        for (const c of this.model.contacts.values()) {
            if (!c.visible || c.teammate || c.dead || c.downed) continue;
            const d = v2.distance(c.pos, me);
            const closing = v2.dot(c.vel, v2.normalizeSafe(v2.sub(me, c.pos)));
            if (d < near || (!push && d < ABORT_RUSH_DIST && closing > ABORT_RUSH)) {
                this.throws.abort(this.clock);
                return;
            }
        }
    }

    /**
     * Whether the intent's fire still holds: its target (if any) is still on the screen (it may leave between thinks)
     * and not just walking under a bush or a canopy (where it is heading as the screen shows it moving).
     */
    private fireHolds(): boolean {
        const it = this.intent;
        if (!it.fire) return false;
        const t = it.targetId ? this.model.contacts.get(it.targetId) : undefined;
        if (!t) return true;
        if (!t.visible) return false;
        const ahead = v2.add(t.pos, v2.mul(t.vel, Math.max(0, this.clock - t.lastSeen)));
        return this.model.revealed(t.id) || !concealed(this.model, ahead, t.layer);
    }

    /** The intent's target stepped out of cover after its sighting (its exposure clock restarted since). */
    private reexposed(): boolean {
        const id = this.intent.targetId;
        const t = id ? this.model.contacts.get(id) : undefined;
        const f = this.brain.mem.fight;
        return !!t && f.expTarget === id && f.expSince > t.firstSeen + 1e-6;
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

    private think(surprise = false): void {
        const dt = Number.isFinite(this.lastThink) ? this.clock - this.lastThink : 0.1;
        this.lastThink = this.clock;
        this.thinks++;
        const intent = this.brain.think(this.clock, dt);
        this.intent = intent;
        for (const a of intent.actions) this.pendingActions.push(a);
        if (intent.useItem) this.pendingUse = intent.useItem;
        // (a throw decided while the reaction to a surprise runs waits for a later think)
        const reacting = surprise || this.clock < this.reactUntil;
        if (intent.throwPlan && !this.throws.active && !reacting) this.throws.start(intent.throwPlan, this.clock);
        if (intent.emote) this.pendingEmote = emoteRequest(intent.emote);
        if (this.motor) {
            // the brain leads the target by an offset; the hand applies it to the target as it sees it every snapshot
            const t = intent.targetId ? this.model.contacts.get(intent.targetId) : undefined;
            this.aimOffset = intent.aim && t ? v2.sub(intent.aim, t.pos) : null;
        }
    }

    private updateSteering(): void {
        const it = this.steerIntent();
        if (this.stick) {
            const self = this.model.self;
            this.nearColliders = [];
            for (const o of this.model.obstacles)
                if (o.blocksMove && sameLayer(self.layer, o.view.layer) && distanceToCollider(self.pos, o.col) < 3)
                    if (!this.follower.walksInto(o)) this.nearColliders.push(o.col); // (a door to open: not slid along)
        }
        if (it.stop) {
            this.moveDir = null;
        } else if (it.moveDir) {
            this.moveDir = it.moveDir;
        } else if (it.goal) {
            // goal layer (0 ground, 1 underground: basements and bunkers); undefined keeps ground navigation
            const r = this.follower.steer(this.model, it.goal, this.clock, it.arriveDist, it.goalLayer);
            if (this.features.puzzles) this.brain.mem.puzzle.followerStuck = this.follower.stuckEvents;
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

    /**
     * Human motor: travelling with no enemy in view, not hit or shot at for CALM_AFTER and in no hurry (out of the gas):
     * the keys get the stop-and-go rhythm of calm walking (motor/rhythm.ts).
     */
    private calmTravel(it: Intent): boolean {
        if (!CALM_TRAVEL.has(it.behaviour) || it.moveDir !== null) return false;
        const m = this.model;
        if (m.time - m.lastHurt < CALM_AFTER || (m.underFire && m.time - m.underFire.time < CALM_AFTER)) return false;
        // a rotation in a hurry (in the gas, or the zone pressing: survival.ts) goes on without a pause
        if (it.behaviour === "zone" && (m.inGasNow() || zonePressure(m) > ZONE_HURRY)) return false;
        return m.time - this.enemyBefore >= CALM_AFTER;
    }

    /**
     * Human motor: getting out of fire from off the screen or out of an air strike: a reversal of the keys comes at
     * once, as a person's would (a flight keeps the committed reversals: its cover and run goals flip as the threats
     * move, and quick reversals there made 27 a minute against the videos' 16).
     */
    private hurried(it: Intent): boolean {
        return it.behaviour === "evade" || it.behaviour === "evacuate";
    }

    /** Human motor: the key octant held for the wanted heading (hysteresis, minimum holds; motor/keys.ts). */
    private humanKeys(input: PlayerInput, dir: Vec2 | null, stick: KeyStick): void {
        const it = this.steerIntent();
        const pos = this.model.self.pos;
        // (stepping up against a switch on purpose: no sliding off it, Intent.nudge)
        const free = it.nudge ? () => true : (octant: number) => octantFree(pos, octant, this.nearColliders);
        const fight = it.behaviour === "fight" || it.moveDir !== null;
        // strafing in a gunfight with a gun in hand: stop, shoot, move on
        const gun =
            isGunSlot(this.model.self.curWeapIdx) && !!this.model.self.weapons[this.model.self.curWeapIdx]?.type;
        const stutter = it.behaviour === "fight" && it.moveDir !== null && gun;
        // lining up on a goal a few steps away outside a fight (a crate's corner, an item, a door): short taps
        const fine = !fight && it.goal !== null && v2.distance(pos, it.goal) < FINE_DIST;
        const mode = {
            calm: this.calmTravel(it),
            urgent: it.urgent === true || this.hurried(it),
            stutter,
            fine,
            engage: it.behaviour === "fight",
        };
        const octant = stick.update(dir, this.clock, fight, free, mode);
        // keys lifted on purpose while there is somewhere to go: no stuck check over the pause (nav/follower.ts)
        if (dir !== null && octant < 0) this.follower.pauseProgress();
        const k = octantKeys(octant);
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
        const throwing = this.throws.active
            ? this.throws.update(this.clock, self, true, this.selfVel, this.throwPathClear())
            : null;
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
            const want = this.fireHolds() && wanted !== null && aim.onTarget(goal, legacyTolerance(weapon, dist));
            const shot = this.trigger.update(this.clock, want, weapon, dist);
            input.shootStart = shot.shootStart;
            input.shootHold = shot.shootHold;
            const quick = this.quick?.step(this.clock, self, this.trigger, shot.shootStart);
            if (quick) this.pendingActions.push(quick);
            this.requestSlot();
        }
    }

    /**
     * Whether a checked throw's path (ThrowPlan.check, round 4) is free from where the bot stands now: the line the frag
     * flies from its hand to the checked point, against the obstacles it has seen. Unchecked throws: always.
     */
    private throwPathClear(): boolean {
        const check = this.throws.active ? this.throws.plan?.check : undefined;
        if (!check) return true;
        const self = this.model.self;
        const item = this.throws.plan?.item ?? "frag";
        return !throwBlocker(item, self.pos, check.to, this.model.obstacles, self.layer, check.mode);
    }

    /** Human motor: the hand moves the cursor towards the goal, the trigger finger fires when it is on target. */
    private aimHuman(input: PlayerInput, dt: number, motor: HumanMotor): void {
        const self = this.model.self;
        const intent = this.intent;
        const plan = this.throws.active ? this.throws.plan : null;
        let goal: MotorGoal | null = null;
        let aimPoint: Vec2 | null = null;
        if (plan) {
            aimPoint = throwAimPoint(plan, self.pos, this.selfVel);
            const rel = v2.sub(aimPoint, self.pos);
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
                // no smooth pursuit of a faint body under a canopy (round 3 item 26: never perfect tracking)
                vel: target?.visible && !target.faint ? target.vel : { x: 0, y: 0 },
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
        const throwing = plan
            ? this.throws.update(this.clock, self, motor.aimReady, this.selfVel, this.throwPathClear())
            : null;
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
            reexposed: this.reexposed(),
        };
        const shot = this.trigger.updateHuman(this.clock, this.fireHolds() && aimPoint !== null, sense, weapon, dist);
        input.shootStart = shot.shootStart;
        input.shootHold = shot.shootHold;
        // round 6 (report 44): a slow gun's click arms an expert's quick switch, sent once the shot shows (quickSwitch.ts)
        const quick = this.quick?.step(this.clock, self, this.trigger, shot.shootStart);
        if (quick) this.pendingActions.push(quick);
        this.requestSlot();
    }

    /** Asks for the intent's weapon slot (throttled; never re-selects the throwable while holding it). */
    private requestSlot(): void {
        // (no weapon key before the reaction to a surprise: gateReaction; none while a quick switch holds the other gun)
        if (this.clock < this.reactUntil || (this.quick && this.clock < this.quick.holdUntil)) return;
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
            this.quick?.noteSwitch(this.clock);
            this.pendingActions.push(SLOT_ACTIONS[slot]);
        }
    }
}

/** The bot's skill profile: a drawn tier, an exact s (g = sense ?? s), or the preset's (PRESET_SKILL). */
function resolveSkill(opts: BotOptions, rng: Rng): SkillProfile {
    const k = opts.skill;
    if (k === undefined) return skillOf(opts.difficulty ?? "normal");
    if (typeof k === "string") return drawSkill(rng, k);
    const s = Math.min(1, Math.max(0, k));
    const g = Math.min(1, Math.max(0, opts.sense ?? s));
    return { tier: tierOfSkill(s), s, g };
}

/** The Emote message for an intent's emote: pings (def type "ping") mark their position, emotes float over the bot. */
function emoteRequest(e: IntentEmote): EmoteRequest {
    const isPing = hasDef(e.type) && GameObjectDefs[e.type].type === "ping";
    return isPing && e.pos ? { type: e.type, isPing, pos: v2.copy(e.pos) } : { type: e.type, isPing };
}
