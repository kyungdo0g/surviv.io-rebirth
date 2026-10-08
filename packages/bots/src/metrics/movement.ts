// Movement metrics (user reports 10, 11, 13, 14, 15 and 16): chases of a target beyond the held gun's ideal range and
// flights (episodes with 3 s gap tolerance), contested spots a bot keeps fleeing from and coming back to, revives
// started while team.ts reviveThreat sees a threat, frag throws started and released with a standing enemy under 6
// units, smoke at the bot's own feet, and boost use when safe. Read-only: reviveThreat gets a context built from the
// bot's model and memory with a scratch random stream, never the brain's.
import { createRng, v2 } from "@rebirth/core";
import type { Player } from "@rebirth/sim";
import type { BrainCtx } from "../brain/context.ts";
import { reviveThreat } from "../brain/team.ts";
import type { BotController } from "../controller.ts";
import { hasAmmo, heldGunsWithAmmo } from "../knowledge/arsenal.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { HURT_RECENT } from "./arsenal.ts";
import { livingBots, type MetricsCtx, SAMPLE } from "./context.ts";
import { EpisodeClock, FleeSpots } from "./episodes.ts";
import { nearestEnemy, usableGuns } from "./truth.ts";
import type { BotMetrics } from "./types.ts";

/** Chases and flights shorter than this are not recorded. */
const MIN_EPISODE = 5;
/** Ideal range of fists and melee weapons. */
const MELEE_IDEAL = 3.5;
/** The persona's chase patience is capped here (triage MOVE-1). */
export const PATIENCE_CAP = 30;
/** A frag released or started with a standing enemy this close is a melee-range grenade (report 15). */
export const FRAG_NEAR = 6;
const BOOSTS = new Set(["soda", "painkiller"]);
const HEALS = new Set(["bandage", "healthkit"]);
/** Boost bar below which a boost is worth taking when safe. */
const BOOST_ROOM = 50;
/** A threat sighted this recently when a revive began appeared as it began (the bot could not have seen it). */
const SAME_MOMENT = 0.2;
/** Health lost while kneeling over a teammate that counts as a revive under fire. */
const KNEEL_HURT = 10;
/** A switch back to the behaviour before the last one within this many seconds is a flip (dithering). */
const FLIP_WINDOW = 3;
/** Behaviours of a bot heading somewhere on its own (it came back to a contested spot by choice). */
const APPROACH = new Set(["explore", "loot", "break", "sweep", "airdrop", "zone", "regroup", "advance", "rally"]);

/** A brain context for team.ts reviveThreat: the bot's model and memory, a scratch random stream. */
export function threatCtx(bot: BotController): BrainCtx {
    const b = bot.bot;
    const model = b.model;
    const enemies = model.enemies();
    const guns = heldGunsWithAmmo(model.self);
    const scratch = createRng(1);
    return {
        model,
        self: model.self,
        params: b.params,
        features: b.features,
        rng: scratch,
        persona: b.persona,
        skill: b.skill,
        personaRng: scratch,
        now: model.time,
        mem: b.brain.mem,
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
}

interface BotTrack {
    chases: Map<number, { clock: EpisodeClock; unarmedTarget: boolean }>;
    flee: EpisodeClock;
    spots: FleeSpots;
    lastBehaviour: string;
    /** the behaviour before the current one, and when the current one began */
    prevBehaviour: string;
    switchedAt: number;
    actionSeq: number;
    /** kneeling over a teammate: health when it began (NaN: not kneeling) */
    kneelHealth: number;
    throwing: boolean;
    throwItem: string;
    throws: number;
}

export class MovementCollector {
    private readonly ctx: MetricsCtx;
    private readonly tracks = new Map<number, BotTrack>();

    constructor(ctx: MetricsCtx) {
        this.ctx = ctx;
    }

    private track(id: number): BotTrack {
        let t = this.tracks.get(id);
        if (!t) {
            t = {
                chases: new Map(),
                flee: new EpisodeClock(),
                spots: new FleeSpots(),
                lastBehaviour: "",
                prevBehaviour: "",
                switchedAt: Number.NEGATIVE_INFINITY,
                actionSeq: -1,
                kneelHealth: Number.NaN,
                throwing: false,
                throwItem: "",
                throws: 0,
            };
            this.tracks.set(id, t);
        }
        return t;
    }

    tick(): void {
        const tick = this.ctx.game.tick;
        this.throws();
        if (tick % SAMPLE.events === 0) this.actions();
        if (tick % SAMPLE.state === 0) this.episodes();
        if (tick % SAMPLE.slow === 0) this.safety();
    }

    /** Throws started and released (every tick: the throw controller's phase and counter). */
    private throws(): void {
        const { game } = this.ctx;
        for (const { bot, p, m } of livingBots(this.ctx)) {
            const tr = this.track(p.id);
            const th = bot.bot.throws;
            if (th.active && !tr.throwing) {
                const plan = th.plan;
                tr.throwItem = plan?.item ?? "";
                if (plan && plan.item === "smoke") {
                    if (v2.distance(plan.pos, p.pos) < 3) m.smokeAtFeet++;
                } else if (plan) {
                    m.fragStarts++;
                    if (nearestEnemy(game, p) < FRAG_NEAR) m.fragStartsNear++;
                }
            }
            tr.throwing = th.active;
            if (th.throws !== tr.throws) {
                tr.throws = th.throws;
                if (tr.throwItem && tr.throwItem !== "smoke") {
                    m.fragReleases++;
                    if (nearestEnemy(game, p) < FRAG_NEAR) m.fragReleasesNear++;
                }
            }
        }
    }

    /** Item uses (boosts, heals) and revives as they start; revives while they last (hit, kneeling idle). */
    private actions(): void {
        const { game } = this.ctx;
        for (const { bot, p, m } of livingBots(this.ctx)) {
            const tr = this.track(p.id);
            const a = p.action;
            const kneeling = a.type === "revive" && !p.downed && !!a.targetId && a.targetId !== p.id;
            if (kneeling) {
                if (Number.isNaN(tr.kneelHealth)) tr.kneelHealth = p.health;
                // the brain chose something else while the revive action still runs (it can neither shoot nor switch)
                if (bot.bot.intent.behaviour !== "revive") m.kneelOtherSeconds += SAMPLE.events / 100;
            } else if (!Number.isNaN(tr.kneelHealth)) {
                if (tr.kneelHealth - p.health >= KNEEL_HURT) m.revivesHurt++;
                tr.kneelHealth = Number.NaN;
            }
            if (a.seq === tr.actionSeq) continue;
            tr.actionSeq = a.seq;
            if (a.type === "use") {
                if (BOOSTS.has(a.item)) {
                    m.boostUses++;
                    if (p.boost < BOOST_ROOM && this.safe(bot, p)) m.safeBoostUses++;
                } else if (HEALS.has(a.item)) {
                    m.healUses++;
                }
            } else if (a.type === "revive" && !p.downed && a.targetId && a.targetId !== p.id) {
                const mate = game.getPlayer(a.targetId);
                if (!mate) continue;
                m.revives++;
                // a threat first sighted in the same moment the revive began was not there when the bot decided:
                // counted apart (it is answered by the kneel abort, team.ts kneelThreat)
                const threat = reviveThreat(threatCtx(bot), mate.pos);
                const model = bot.bot.model;
                if (
                    threat !== null &&
                    threat !== "hurt" &&
                    threat.visible &&
                    model.time - threat.firstSeen < SAME_MOMENT
                )
                    m.revivesSurprised++;
                else if (threat !== null) m.unsafeRevives++;
            }
        }
    }

    /** No enemy in view, not hurt lately, out of the gas, standing. */
    private safe(bot: BotController, p: Player): boolean {
        const model = bot.bot.model;
        if (p.downed || model.time - model.lastHurt < HURT_RECENT) return false;
        if (this.ctx.game.gas.isInGas(p.pos)) return false;
        return !model.enemies().some((c) => c.visible && !c.downed);
    }

    /** Safe time with a boost in the bag and room on the boost bar (every 0.5 s). */
    private safety(): void {
        const dt = SAMPLE.slow / 100;
        for (const { bot, p, m } of livingBots(this.ctx)) {
            m.aliveSeconds += p.downed ? 0 : dt;
            const hasBoost = p.inv.get("soda") > 0 || p.inv.get("painkiller") > 0;
            if (hasBoost && p.boost < BOOST_ROOM && this.safe(bot, p)) m.safeBoostSeconds += dt;
        }
    }

    /** Chases, flights and contested spots (every 0.1 s). */
    private episodes(): void {
        const { game } = this.ctx;
        const now = game.time;
        for (const { bot, p, m } of livingBots(this.ctx)) {
            const tr = this.track(p.id);
            const it = bot.bot.intent;
            const behaviour = p.downed ? "downed" : it.behaviour;
            // chase: fighting a standing target beyond the held gun's ideal range (true positions)
            const t = behaviour === "fight" && it.targetId ? game.getPlayer(it.targetId) : undefined;
            let chasing = 0;
            if (t && !t.dead && !t.downed) {
                const held = p.weaponManager.weapons[p.weaponManager.curWeapIdx]?.type ?? "";
                const ideal = gunInfo(held)?.idealMax ?? MELEE_IDEAL;
                if (v2.distance(p.pos, t.pos) > ideal) chasing = t.id;
            }
            if (chasing) {
                let c = tr.chases.get(chasing);
                if (!c?.clock.open) {
                    c = { clock: c?.clock ?? new EpisodeClock(), unarmedTarget: usableGuns(t as Player).length === 0 };
                    tr.chases.set(chasing, c);
                }
                this.chaseDone(m, bot, c.clock.on(now), c.unarmedTarget);
            }
            for (const [id, c] of tr.chases)
                if (id !== chasing) this.chaseDone(m, bot, c.clock.off(now), c.unarmedTarget);
            // flights and the spots they start from
            tr.spots.move(p.pos.x, p.pos.y, APPROACH.has(behaviour));
            if (behaviour === "flee") {
                if (tr.lastBehaviour !== "flee") tr.spots.flee(now, p.pos.x, p.pos.y);
                this.fleeDone(m, tr.flee.on(now));
            } else {
                this.fleeDone(m, tr.flee.off(now));
            }
            if (behaviour !== tr.lastBehaviour) {
                if (tr.lastBehaviour && behaviour === tr.prevBehaviour && now - tr.switchedAt <= FLIP_WINDOW) m.flips++;
                tr.prevBehaviour = tr.lastBehaviour;
                tr.switchedAt = now;
            }
            tr.lastBehaviour = behaviour;
        }
    }

    private chaseDone(m: BotMetrics, bot: BotController, d: number, unarmedTarget: boolean): void {
        if (d < MIN_EPISODE) return;
        const patience = Math.min(bot.bot.persona.chasePatience, PATIENCE_CAP);
        m.chases.push({ duration: Math.round(d * 10) / 10, patience, unarmedTarget });
    }

    private fleeDone(m: BotMetrics, d: number): void {
        if (d >= MIN_EPISODE) m.flees.push(Math.round(d * 10) / 10);
    }

    /** A bot died, or the match ended: close its episodes and sum up its spots. */
    close(id: number): void {
        const tr = this.tracks.get(id);
        const m = this.ctx.metrics.get(id);
        const bot = this.ctx.byId.get(id);
        if (!tr || !m || !bot) return;
        for (const c of tr.chases.values()) this.chaseDone(m, bot, c.clock.close(), c.unarmedTarget);
        this.fleeDone(m, tr.flee.close());
        const s = tr.spots.summary();
        m.oscSpots = s.spots;
        m.oscCycles = s.cycles;
        m.oscMaxCycles = s.max;
        this.tracks.delete(id);
    }
}
