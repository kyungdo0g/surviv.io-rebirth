// Utility-based decision making: every think, each behaviour scores how much it matters right now (escape the gas,
// fight, flee, heal, revive, regroup, loot, explore, plus the extension behaviours its BrainFeatures enable); the best
// one (with a little hysteresis for the current one) plans the Intent. Weapon handling (slot to carry, reloading when
// safe, holstering: brain/weapons.ts), grenade opportunities and dodging (brain/dodge.ts) are layered on top.
// Exploring keeps no hysteresis while a container worth breaking is within 6 units or the building it is in is being
// swept (bot overhaul LOOT-1, both brains: explore's 0.20-0.32 with the bonus outscored every armed bot's crate score,
// so armed bots walked past crates next to them).
import { createRng, type Rng, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import type { DifficultyParams } from "../difficulty.ts";
import { hasAmmo, heldGunsWithAmmo } from "../knowledge/arsenal.ts";
import { POTATO_GUNS } from "../knowledge/gunTiers.ts";
import type { WorldModel } from "../perception/world.ts";
import { NEUTRAL, PERSONA_SALT, type PersonaParams } from "../persona.ts";
import { type SkillProfile, skillOf } from "../skill.ts";
import { reactToThreats } from "./alert.ts";
import { assessCached, wantsAssessment } from "./assess.ts";
import { addCombatLayer, selectTarget } from "./combat.ts";
import { type BehaviourName, type BrainCtx, BrainMemory, emptyIntent, type Intent } from "./context.ts";
import { noteContested } from "./danger.ts";
import { noteDeadEnd, planDeadEnd } from "./deadEnd.ts";
import { updateTrade } from "./disengage.ts";
import { dodge } from "./dodge.ts";
import { DoorBrain } from "./doors.ts";
import { crateFirstChoice, crateFirstScore } from "./early.ts";
import { escapeFrag } from "./escapeFrag.ts";
import { bestLoot, lootScore, planExplore, planLoot } from "./explore.ts";
import { EXTENSION_BEHAVIOURS } from "./extensions.ts";
import { factionScores } from "./factionFight.ts";
import { applyFactionRoles, grenadierThrow } from "./factionRoles.ts";
import { guardCrossing } from "./factionSquad.ts";
import { BRAIN_PRESETS, type BrainFeatures } from "./features.ts";
import { fightScore } from "./fightScore.ts";
import { manageScope } from "./gear.ts";
import { grenadeOpportunity, smartGrenade } from "./grenades.ts";
import { judged } from "./judgement.ts";
import { planLayerEscape } from "./layers.ts";
import { bestBreakable, breakScore, planBreak } from "./scavenge.ts";
import { noteChoice, noteFlight, steadyCrate, steadyLoot, steadyScores } from "./steady.ts";
import { noteStillHit, unpinUnderFire } from "./stillHit.ts";
import { fleeScore, healScore, planFlee, planHeal, planZone, zoneScore } from "./survival.ts";
import { planSweep, sweepScore } from "./sweep.ts";
import { planFight } from "./tactics.ts";
import { planDowned, planRegroup, planRevive, regroupScore, reviveScore } from "./team.ts";
import { applyTeamplay } from "./teamplay.ts";
import { manageWeapons } from "./weapons.ts";

/** Bonus of the current behaviour; larger right after switching, so near-equal scores do not flip-flop. */
const HYSTERESIS = 0.08;
const COMMIT_BONUS = 0.12;
const COMMIT_TIME = 1.5;
const EXPLORE_SCORE = 0.12;
/** A container this close that is worth breaking takes the hysteresis off exploring. */
const CRATE_NEAR = 6;
/** Behaviours the smart brain may throw frags from (the baseline: fight and zone). */
const SMART_THROW = new Set<BehaviourName>(["fight", "zone", "hold", "disengage"]);
/** Behaviours that run from a chaser: the smart brain may throw a frag back at its path (round 4, escapeFrag.ts). */
const ESCAPE_THROW = new Set<BehaviourName>(["flee", "disengage"]);

/** Who the bot is beyond its difficulty: persona, skill profile and their rng stream (Bot fills it; tests may not). */
export interface BrainProfile {
    persona?: Readonly<PersonaParams>;
    skill?: Readonly<SkillProfile>;
    personaRng?: Rng;
    /**
     * the bot's seed (BotOptions.seed): streams of feature code that must not shift the brain's draws (doors), and the
     * stream of what it learned (puzzle codes, knowledge/puzzles.ts), drawn only when used
     */
    seed?: number;
}

/**
 * pursuit: kneeling over a teammate while the brain chose something else (an enemy walked in, the bot was hit): get up
 * (Input.Cancel), or the kneel blocks the fight it chose (no shot, no weapon switch: manageWeapons treats a revive as
 * busy) and the bot stands there flipping between fight and revive (adversarial review: 4.6-6.5 s per team match).
 * The rest of this think sees the action as already cancelled, as it will be once the input lands.
 */
function leaveRevive(ctx: BrainCtx, intent: Intent): void {
    const self = ctx.self;
    if (self.action.type !== "revive" || intent.behaviour === "revive" || self.downed) return;
    intent.actions.push(Input.Cancel);
    self.action = { type: "none", item: "", time: 0, duration: 0, targetId: 0 };
}

export class Brain {
    readonly mem = new BrainMemory();
    private readonly model: WorldModel;
    private readonly params: DifficultyParams;
    private readonly rng: Rng;
    /** what this brain knows how to do (default: the baseline brain, every flag off) */
    readonly features: Readonly<BrainFeatures>;
    /** the bot's taste (persona.ts; NEUTRAL by default) */
    readonly persona: Readonly<PersonaParams>;
    /** the bot's skill (skill.ts; the preset's PRESET_SKILL by default) */
    readonly skill: Readonly<SkillProfile>;
    private readonly personaRng: Rng;
    /** doors (BrainFeatures.doors): door state, alerts and the close behind; null with the flag off */
    readonly doors: DoorBrain | null;
    /** scores of the last decision (diagnostics) */
    lastScores: Partial<Record<BehaviourName, number>> = {};

    constructor(
        model: WorldModel,
        params: DifficultyParams,
        rng: Rng,
        features: Readonly<BrainFeatures> = BRAIN_PRESETS.baseline,
        profile: BrainProfile = {},
    ) {
        this.model = model;
        this.params = params;
        this.rng = rng;
        this.features = features;
        this.persona = profile.persona ?? NEUTRAL;
        this.skill = Object.freeze({ ...(profile.skill ?? skillOf(params)) });
        this.personaRng = profile.personaRng ?? createRng(PERSONA_SALT);
        this.doors = features.doors ? new DoorBrain(profile.seed ?? 0) : null;
        // (a number only: the knowledge is drawn from it on first use, by an enabled feature)
        this.mem.puzzle.seed = profile.seed ?? 0;
    }

    context(now: number): BrainCtx {
        const model = this.model;
        const self = model.self;
        const enemies = model.enemies();
        // (round 6, report 42: the Spud Gun and the Potato Cannon only for a brain that knows them)
        const all = heldGunsWithAmmo(self);
        const guns = this.features.potatoGuns ? all : all.filter((g) => !POTATO_GUNS.has(g.info.id));
        const ctx: BrainCtx = {
            model,
            self,
            params: this.params,
            features: this.features,
            rng: this.rng,
            persona: this.persona,
            skill: this.skill,
            personaRng: this.personaRng,
            now,
            mem: this.mem,
            enemies,
            visibleEnemies: enemies.filter((c) => c.visible),
            target: null,
            targetDist: Number.POSITIVE_INFINITY,
            guns,
            armed: guns.some(hasAmmo),
            teamMode: model.team.length > 0,
            myComp: 0,
            assessment: null,
        };
        const cell = model.nav.nearestWalkable(self.pos, 3);
        if (cell >= 0) ctx.myComp = model.nav.component(cell);
        ctx.target = selectTarget(ctx);
        if (ctx.target) ctx.targetDist = v2.distance(self.pos, ctx.target.pos);
        // fight assessment: pure arithmetic, only while a feature reads it; as the bot believes it (judgement.ts: a
        // beginner's belief error, round 4)
        if (ctx.target && wantsAssessment(this.features)) ctx.assessment = judged(ctx, assessCached(ctx, ctx.target));
        return ctx;
    }

    think(now: number, thinkDt: number): Intent {
        const self = this.model.self;
        if (self.dead) return emptyIntent("idle");
        const ctx = this.context(now);
        // doors: what the snapshot's doors show and sound like, before anything is decided
        this.doors?.observe(ctx);
        const order = this.mem.order;
        if (order) {
            const intent = emptyIntent("order");
            if (order.type === "goto") {
                intent.goal = v2.copy(order.pos);
                intent.arriveDist = order.arriveDist ?? 1;
            } else {
                intent.stop = true;
            }
            return intent;
        }
        if (self.downed) return planDowned(ctx);
        // off the ground floor (stairs, underground): walk back up first
        const upstairs = planLayerEscape(ctx);
        if (upstairs) {
            addCombatLayer(ctx, upstairs);
            return upstairs;
        }

        // basements (navigation): walk back out of a dead end the grid does not connect (a bank vault)
        const back = ctx.features.basements ? planDeadEnd(ctx) : null;
        if (back) {
            addCombatLayer(ctx, back);
            this.mem.current = back.behaviour;
            return back;
        }

        if (ctx.features.disengage) updateTrade(ctx);
        if (ctx.features.pursuit) noteStillHit(ctx);
        if (ctx.features.steady && this.mem.current === "flee") noteFlight(ctx);
        // steadiness: the loot and crate choices hold for a moment (no flip-flopping between near-equal items)
        const loot = ctx.features.steady ? steadyLoot(ctx) : bestLoot(ctx);
        // report 41: unarmed with an enemy near, the nearest cheap crate first (early.ts crateFirstChoice)
        const first = ctx.features.crateFirst ? crateFirstChoice(ctx) : null;
        const crate = first ?? (ctx.features.steady ? steadyCrate(ctx) : bestBreakable(ctx));
        const crateScore = crate ? Math.max(breakScore(ctx, crate), first ? crateFirstScore(ctx, first) : 0) : 0;
        const options: Array<[BehaviourName, number, () => Intent]> = [
            ["zone", zoneScore(ctx), () => planZone(ctx)],
            ["fight", fightScore(ctx), () => planFight(ctx)],
            ["flee", fleeScore(ctx), () => planFlee(ctx)],
            ["heal", healScore(ctx), () => planHeal(ctx)],
            ["revive", reviveScore(ctx), () => planRevive(ctx)],
            ["regroup", regroupScore(ctx), () => planRegroup(ctx)],
            ["loot", loot ? lootScore(ctx, loot) : 0, () => (loot ? planLoot(ctx, loot) : planExplore(ctx))],
            ["break", crateScore, () => (crate ? planBreak(ctx, crate) : planExplore(ctx))],
        ];
        // house clearing (BrainFeatures.sweep): offered next to the baseline behaviours, like an extension
        const sweep = ctx.features.sweep ? sweepScore(ctx) : 0;
        if (ctx.features.sweep) options.push(["sweep", sweep, () => planSweep(ctx)]);
        // behaviours of enabled features only: a disabled one is never scored (no rng draws, no memory writes)
        for (const ext of EXTENSION_BEHAVIOURS) {
            if (ctx.features[ext.feature]) options.push([ext.name, ext.score(ctx), () => ext.plan(ctx)]);
        }
        options.push(["explore", EXPLORE_SCORE, () => planExplore(ctx)]);
        // 50v50: local numbers, the faction's formation instead of the regroup, role priorities (factionFight.ts)
        if (ctx.features.faction) factionScores(ctx, options);
        // steadiness: a behaviour locked out after dithering gets its score cut
        if (ctx.features.steady) steadyScores(ctx, options);
        let best = options[options.length - 1];
        let bestScore = Number.NEGATIVE_INFINITY;
        const scores: Partial<Record<BehaviourName, number>> = {};
        const bonus = HYSTERESIS + (now - this.mem.currentSince < COMMIT_TIME ? COMMIT_BONUS : 0);
        // a crate next to the bot or a house being swept: exploring holds on to nothing (both are worth stopping for);
        // sweeping never does (it is the filler while in a house: whatever loot or furniture it finds comes first)
        const exploreFree = (crate !== null && crate.dist < CRATE_NEAR && crateScore > 0) || sweep > 0;
        for (const opt of options) {
            const free = opt[0] === "sweep" || (exploreFree && opt[0] === "explore");
            const held = opt[0] === this.mem.current && !free;
            const s = opt[1] + (held ? bonus : 0);
            scores[opt[0]] = opt[1];
            if (s > bestScore) {
                bestScore = s;
                best = opt;
            }
        }
        this.lastScores = scores;
        const intent = best[2]();
        if (ctx.features.steady) noteChoice(ctx, this.mem.current, intent.behaviour);
        if (ctx.features.basements) noteDeadEnd(ctx, intent);
        if (intent.behaviour !== this.mem.current) this.mem.currentSince = now;
        this.mem.current = intent.behaviour;
        if (ctx.features.pursuit) {
            leaveRevive(ctx, intent);
            // round 5: an armed enemy in the house the bot loots on: the house waits (no in-out loop)
            noteContested(ctx, intent);
        }
        // doors: an alert's look and pause, the close behind, out of a doorway (before the weapon, which may draw for it)
        this.doors?.apply(ctx, intent);
        manageWeapons(ctx, intent);
        if (ctx.features.grenades) {
            // round 4: running from a chaser, a frag thrown back at its path (escapeFrag.ts) comes first
            if (!intent.throwPlan && ESCAPE_THROW.has(intent.behaviour))
                intent.throwPlan = escapeFrag(ctx, intent, thinkDt);
            if (!intent.throwPlan && SMART_THROW.has(intent.behaviour)) intent.throwPlan = smartGrenade(ctx, thinkDt);
            // 50v50: the Grenadier's own explosives (factionRoles.ts)
            if (!intent.throwPlan && ctx.features.faction && SMART_THROW.has(intent.behaviour))
                intent.throwPlan = grenadierThrow(ctx, thinkDt);
        } else if (!intent.throwPlan && (intent.behaviour === "fight" || intent.behaviour === "zone")) {
            intent.throwPlan = grenadeOpportunity(ctx, thinkDt);
        }
        if (ctx.features.teamplay) applyTeamplay(ctx, intent);
        // 50v50: role actions (Commander pings, the bugle, the medic's heals) and the no-solo-crossing rule
        if (ctx.features.faction) {
            applyFactionRoles(ctx, intent);
            guardCrossing(ctx, intent);
        }
        if (ctx.features.threats) reactToThreats(ctx, intent);
        if (ctx.features.scope) manageScope(ctx, intent);
        // pursuit: shot on the spot it stands on: step off it (stillHit.ts)
        if (ctx.features.pursuit) unpinUnderFire(ctx, intent);
        dodge(ctx, intent);
        // doors: the bot's own Use (a door it toggles is no sign of anyone else)
        if (this.doors && intent.actions.includes(Input.Use)) this.doors.noteUse(now);
        return intent;
    }
}
