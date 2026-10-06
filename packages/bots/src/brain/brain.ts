// Utility-based decision making: every think, each behaviour scores how much it matters right now (escape the gas,
// fight, flee, heal, revive, regroup, loot, explore, plus the extension behaviours its BrainFeatures enable); the best
// one (with a little hysteresis for the current one) plans the Intent. Weapon handling (slot to carry, reloading when
// safe), grenade opportunities and dodging are layered on top.
import type { Rng } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { Input, WeaponSlot } from "@rebirth/defs";
import type { DifficultyParams } from "../difficulty.ts";
import { carrySlot, currentGun, hasAmmo, heldGunsWithAmmo } from "../knowledge/arsenal.ts";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import type { WorldModel } from "../perception/world.ts";
import { addCombatLayer, freeDir, grenadeOpportunity, planFight, selectTarget } from "./combat.ts";
import { type BehaviourName, type BrainCtx, BrainMemory, emptyIntent, type Intent } from "./context.ts";
import { bestLoot, lootScore, planExplore, planLoot } from "./explore.ts";
import { EXTENSION_BEHAVIOURS } from "./extensions.ts";
import { BRAIN_PRESETS, type BrainFeatures } from "./features.ts";
import { planLayerEscape } from "./layers.ts";
import { bestBreakable, breakScore, planBreak } from "./scavenge.ts";
import { fleeScore, healScore, planFlee, planHeal, planZone, zoneScore } from "./survival.ts";
import { planDowned, planRegroup, planRevive, regroupScore, reviveScore } from "./team.ts";

/** Bonus of the current behaviour; larger right after switching, so near-equal scores do not flip-flop. */
const HYSTERESIS = 0.08;
const COMMIT_BONUS = 0.12;
const COMMIT_TIME = 1.5;
const EXPLORE_SCORE = 0.12;
/** Projectiles worth running from. */
const DANGEROUS = new Set(["frag", "mirv", "mirv_mini", "martyr_nade", "bomb_iron"]);

export class Brain {
    readonly mem = new BrainMemory();
    private readonly model: WorldModel;
    private readonly params: DifficultyParams;
    private readonly rng: Rng;
    /** what this brain knows how to do (default: the baseline brain, every flag off) */
    readonly features: Readonly<BrainFeatures>;
    /** scores of the last decision (diagnostics) */
    lastScores: Partial<Record<BehaviourName, number>> = {};

    constructor(
        model: WorldModel,
        params: DifficultyParams,
        rng: Rng,
        features: Readonly<BrainFeatures> = BRAIN_PRESETS.baseline,
    ) {
        this.model = model;
        this.params = params;
        this.rng = rng;
        this.features = features;
    }

    context(now: number): BrainCtx {
        const model = this.model;
        const self = model.self;
        const enemies = model.enemies();
        const guns = heldGunsWithAmmo(self);
        const ctx: BrainCtx = {
            model,
            self,
            params: this.params,
            features: this.features,
            rng: this.rng,
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
        };
        const cell = model.nav.nearestWalkable(self.pos, 3);
        if (cell >= 0) ctx.myComp = model.nav.component(cell);
        ctx.target = selectTarget(ctx);
        if (ctx.target) ctx.targetDist = v2.distance(self.pos, ctx.target.pos);
        return ctx;
    }

    think(now: number, thinkDt: number): Intent {
        const self = this.model.self;
        if (self.dead) return emptyIntent("idle");
        const ctx = this.context(now);
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

        const loot = bestLoot(ctx);
        const crate = bestBreakable(ctx);
        const options: Array<[BehaviourName, number, () => Intent]> = [
            ["zone", zoneScore(ctx), () => planZone(ctx)],
            ["fight", fightScore(ctx), () => planFight(ctx)],
            ["flee", fleeScore(ctx), () => planFlee(ctx)],
            ["heal", healScore(ctx), () => planHeal(ctx)],
            ["revive", reviveScore(ctx), () => planRevive(ctx)],
            ["regroup", regroupScore(ctx), () => planRegroup(ctx)],
            ["loot", loot ? lootScore(ctx, loot) : 0, () => (loot ? planLoot(ctx, loot) : planExplore(ctx))],
            ["break", crate ? breakScore(ctx, crate) : 0, () => (crate ? planBreak(ctx, crate) : planExplore(ctx))],
        ];
        // behaviours of enabled features only: a disabled one is never scored (no rng draws, no memory writes)
        for (const ext of EXTENSION_BEHAVIOURS) {
            if (ctx.features[ext.feature]) options.push([ext.name, ext.score(ctx), () => ext.plan(ctx)]);
        }
        options.push(["explore", EXPLORE_SCORE, () => planExplore(ctx)]);
        let best = options[options.length - 1];
        let bestScore = Number.NEGATIVE_INFINITY;
        const scores: Partial<Record<BehaviourName, number>> = {};
        const bonus = HYSTERESIS + (now - this.mem.currentSince < COMMIT_TIME ? COMMIT_BONUS : 0);
        for (const opt of options) {
            const s = opt[1] + (opt[0] === this.mem.current ? bonus : 0);
            scores[opt[0]] = opt[1];
            if (s > bestScore) {
                bestScore = s;
                best = opt;
            }
        }
        this.lastScores = scores;
        const intent = best[2]();
        if (intent.behaviour !== this.mem.current) this.mem.currentSince = now;
        this.mem.current = intent.behaviour;
        this.manageWeapons(ctx, intent);
        if (!intent.throwPlan && (intent.behaviour === "fight" || intent.behaviour === "zone")) {
            intent.throwPlan = grenadeOpportunity(ctx, thinkDt);
        }
        this.dodge(ctx, intent);
        return intent;
    }

    /** Slot to hold and reloads outside of what the behaviour asked for. */
    private manageWeapons(ctx: BrainCtx, intent: Intent): void {
        const { self, mem, now } = ctx;
        const busy = self.action.type === "use" || self.action.type === "revive";
        if (busy) {
            // switching weapons cancels an item use or a revive
            intent.slot = null;
            intent.fire = false;
            return;
        }
        if (intent.slot === null) {
            if (ctx.target?.visible && ctx.armed && intent.behaviour !== "heal") addCombatLayer(ctx, intent);
            if (intent.slot === null) {
                const carry = carrySlot(self, ctx.guns);
                const holdingThrowable = self.curWeapIdx === WeaponSlot.Throwable;
                const holdingUseless = self.curWeapIdx !== carry && !currentGun(self, ctx.guns)?.mag;
                if (holdingThrowable || holdingUseless || self.curWeapIdx === WeaponSlot.Melee) intent.slot = carry;
            }
        }
        // top up the magazine when nobody is in sight
        const gun = currentGun(self, ctx.guns);
        const quiet = !ctx.visibleEnemies.some((e) => !e.downed);
        if (
            gun &&
            quiet &&
            gun.reserve > 0 &&
            gun.mag < gun.info.def.maxClip * 0.7 &&
            self.action.type === "none" &&
            now - mem.lastReloadRequest > 1.5 &&
            intent.behaviour !== "heal"
        ) {
            mem.lastReloadRequest = now;
            intent.actions.push(Input.Reload);
        }
    }

    /** Runs from grenades landing nearby. */
    private dodge(ctx: BrainCtx, intent: Intent): void {
        if (!ctx.params.dodgeGrenades || intent.behaviour === "revive") return;
        const me = ctx.self.pos;
        let away = { x: 0, y: 0 };
        for (const p of ctx.model.projectiles) {
            if (!DANGEROUS.has(p.type)) continue;
            const d = v2.distance(p.pos, me);
            if (d > 11) continue;
            // its own grenade, flying to where it was thrown, is no threat
            const own = ctx.mem.lastThrowPos;
            if (own && ctx.now - ctx.mem.lastThrow < 5 && v2.distance(p.pos, own) < v2.distance(me, own)) continue;
            away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(me, p.pos)), 1 / Math.max(d, 1)));
        }
        if (v2.lengthSqr(away) < 1e-9) return;
        const dir = freeDir(ctx.model, me, v2.normalize(away));
        if (dir) {
            intent.moveDir = dir;
            intent.stop = false;
        }
    }
}

/** Utility of fighting the selected target (0..1). */
function fightScore(ctx: BrainCtx): number {
    const t = ctx.target;
    if (!t) return 0;
    const d = ctx.targetDist;
    if (!ctx.armed) {
        // unarmed: punch back when attacked or when the other one is unarmed too and close; else loot or run
        if (!t.visible || d > 6) return 0;
        const attacked = ctx.now - ctx.model.lastHurt < 2;
        if (attacked) return 0.7;
        return isMeleeWeapon(t.activeWeapon) && d < 4 ? ctx.params.meleeAggression : 0;
    }
    if (!t.visible) return 0.5 * Math.max(0, 1 - (ctx.now - t.lastSeen) / (ctx.params.memory + 0.01));
    const shootingAtMe = ctx.now - t.lastShotAt < 2;
    const reach = Math.max(...ctx.guns.filter(hasAmmo).map((g) => g.info.maxEngage), 10);
    if (d > reach * 1.4 && !shootingAtMe) return 0.35;
    if (t.downed && ctx.visibleEnemies.some((e) => !e.downed && e !== t)) return 0.5;
    // shot at, or too close to ignore: fight; an enemy that has not noticed the bot is a choice (looting may win)
    const threatened = shootingAtMe || ctx.now - ctx.model.lastHurt < 3 || d < 12;
    return threatened ? 0.78 : ctx.params.aggression;
}
