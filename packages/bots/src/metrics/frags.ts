// Frag and container metrics of round 3 and 4 (user reports 21, 24, 29 and 30; stage EVALUATE), read-only:
// - frags: every frag or MIRV a bot throws is followed on the simulation's projectile from its release to its burst
//   (cook = the def's fuse minus the fuse left at the release; flight until it comes within a unit of resting, the
//   bot's own "arrived" rule in brain/fragMath.ts; the time it lay before bursting; a burst in the air or in the hand),
//   with the bot's plan (planned cook, reason), whether it ran when it let go, the nearest standing enemy at the burst
//   and the damage its blast dealt (enemies, teammates, itself);
// - deliberately started containers (the LOOT2 probe's definition): a container counts once a bot hit it as its own
//   break target on "break" or "airdrop"; one left standing is charged to the reason its last breaker let it go
//   (died, downed, blacklisted for no progress / stall / no stand spot / unreachable, switched, left:<behaviour>).
import { v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import { canDamageObstacle, type DamageParams, type Game, type Player } from "@rebirth/sim";
import { FRAG_TYPES } from "../brain/combat.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import type { MetricsCtx } from "./context.ts";
import type { DeliberateContainers, FragRecord, Round3Bot } from "./round3Types.ts";

/** Sub-grenades credited to the throw they split from. */
const SPLITS = new Set(["mirv_mini"]);
/** A frag counts as arrived when its slide has under a unit to go: speed under the ground drag (2.3 u/s). */
const ARRIVED_SPEED = 2.3;
/** Explosion damage is credited to the thrower's latest burst at most this long before it (MIRV sub-grenades). */
const CREDIT_WINDOW = 4;
/** Behaviours of a bot running from a chaser (round 4 escape throws). */
const RUNNING = new Set(["flee", "disengage"]);

interface Flying {
    rec: FragRecord;
    owner: number;
    born: number;
    aim: { x: number; y: number } | null;
    lastPos: { x: number; y: number };
    lastZ: number;
    lastFloor: number;
    restAt: number;
    layer: number;
    burstAt: number;
}

type ObstacleLike = Parameters<Game["damageObstacle"]>[0];

function blastOf(item: string): number {
    const d = hasDef(item) ? GameObjectDefs[item] : undefined;
    const ex = d && d.type === "throwable" && d.explosionType && hasDef(d.explosionType) ? d.explosionType : "";
    const e = ex ? (GameObjectDefs[ex] as { rad?: { max: number } }) : undefined;
    return e?.rad?.max ?? 0;
}

export class FragCollector {
    private readonly ctx: MetricsCtx;
    private readonly r3: (id: number) => Round3Bot | undefined;
    private readonly flying = new Map<number, Flying>();
    /** the plan each bot started its current throw with */
    private readonly plans = new Map<
        number,
        { item: string; cook: number; pos: { x: number; y: number }; reason: string }
    >();
    private readonly throwing = new Map<number, boolean>();
    /** each bot's bursts, newest last (explosion damage is credited to the latest within CREDIT_WINDOW) */
    private readonly bursts = new Map<number, Flying[]>();

    constructor(ctx: MetricsCtx, r3: (id: number) => Round3Bot | undefined) {
        this.ctx = ctx;
        this.r3 = r3;
    }

    onPlayerDamaged(target: Player, params: DamageParams, amount: number): void {
        if (!params.isExplosion || !params.sourceId) return;
        const src = params.gameSourceType ?? "";
        if (!FRAG_TYPES.includes(src) && !SPLITS.has(src)) return;
        const list = this.bursts.get(params.sourceId);
        const now = this.ctx.game.time;
        const f = list?.findLast((x) => x.burstAt <= now + 1e-6 && now - x.burstAt <= CREDIT_WINDOW);
        if (!f) return;
        const owner = this.ctx.game.getPlayer(params.sourceId);
        if (target.id === params.sourceId) f.rec.selfDmg += amount;
        else if (owner && target.teamId === owner.teamId) f.rec.teamDmg += amount;
        else {
            f.rec.enemyDmg += amount;
            f.rec.enemiesHit++;
        }
    }

    tick(): void {
        const { game, byId } = this.ctx;
        const now = game.time;
        // the plan each throw started with (ThrowController.plan, kept until the next throw)
        for (const bot of this.ctx.bots) {
            const th = bot.bot.throws;
            const was = this.throwing.get(bot.playerId) ?? false;
            if (th.active && !was && th.plan) {
                const fight = bot.bot.brain.mem.fight as { planReason?: string } | undefined;
                this.plans.set(bot.playerId, {
                    item: th.plan.item,
                    cook: th.plan.cook,
                    pos: { x: th.plan.pos.x, y: th.plan.pos.y },
                    reason: fight?.planReason ?? "",
                });
            }
            this.throwing.set(bot.playerId, th.active);
        }
        const seen = new Set<number>();
        for (const p of game.projectiles.projectiles) {
            seen.add(p.id);
            let f = this.flying.get(p.id) ?? null;
            if (!f) {
                if (p.dead || !FRAG_TYPES.includes(p.type) || !byId.has(p.ownerId)) continue;
                f = this.born(p.id, p.type, p.ownerId, p.fuse, p.def.fuseTime, p.layer);
                if (!f) continue;
            }
            f.lastPos = { x: p.pos.x, y: p.pos.y };
            f.lastZ = p.posZ;
            f.lastFloor = p.obstacleBelowHeight;
            f.layer = p.layer;
            const grounded = p.posZ <= p.obstacleBelowHeight + 1e-3;
            if (f.restAt < 0 && grounded && v2.length(p.vel) < ARRIVED_SPEED) f.restAt = now;
            if (p.dead) this.burst(p.id, f, now);
        }
        for (const [id, f] of this.flying) if (!seen.has(id)) this.burst(id, f, now);
    }

    private born(
        id: number,
        item: string,
        owner: number,
        fuse: number,
        fuseTime: number,
        layer: number,
    ): Flying | null {
        const bot = this.ctx.byId.get(owner);
        const r3 = this.r3(owner);
        if (!bot || !r3) return null;
        const plan = this.plans.get(owner);
        const usePlan = plan && plan.item === item;
        const rec: FragRecord = {
            t: Math.round(this.ctx.game.time * 100) / 100,
            item,
            cook: Math.round(Math.max(0, fuseTime - fuse) * 100) / 100,
            planned: usePlan ? Math.round(plan.cook * 100) / 100 : -1,
            reason: usePlan ? plan.reason : "",
            fleeing: RUNNING.has(bot.bot.intent.behaviour),
            flight: -1,
            rest: -1,
            airborne: false,
            cookedOff: fuse <= 0.02,
            burstOff: -1,
            enemyDist: -1,
            blast: blastOf(item),
            enemyDmg: 0,
            teamDmg: 0,
            selfDmg: 0,
            enemiesHit: 0,
        };
        if (usePlan) this.plans.delete(owner);
        r3.frags.push(rec);
        const f: Flying = {
            rec,
            owner,
            born: this.ctx.game.time,
            aim: usePlan ? plan.pos : null,
            lastPos: { x: 0, y: 0 },
            lastZ: 0,
            lastFloor: 0,
            restAt: -1,
            layer,
            burstAt: -1,
        };
        this.flying.set(id, f);
        return f;
    }

    private burst(id: number, f: Flying, now: number): void {
        this.flying.delete(id);
        f.burstAt = now;
        const r = f.rec;
        r.airborne = f.lastZ > f.lastFloor + 0.05;
        if (f.restAt >= 0) {
            r.flight = Math.round((f.restAt - f.born) * 100) / 100;
            r.rest = Math.round((now - f.restAt) * 100) / 100;
        }
        if (f.aim) r.burstOff = Math.round(v2.distance(f.aim, f.lastPos) * 10) / 10;
        const owner = this.ctx.game.getPlayer(f.owner);
        let best = Number.POSITIVE_INFINITY;
        for (const q of this.ctx.game.players()) {
            if (q.dead || q.downed || q.id === f.owner || (owner && q.teamId === owner.teamId)) continue;
            if (!sameLayer(q.layer, f.layer)) continue;
            best = Math.min(best, v2.distance(q.pos, f.lastPos));
        }
        r.enemyDist = Number.isFinite(best) ? Math.round(best * 10) / 10 : -1;
        const list = this.bursts.get(f.owner) ?? [];
        list.push(f);
        while (list.length > 4) list.shift();
        this.bursts.set(f.owner, list);
    }

    /** A bot died or the match ended: keep the cook and frag counts of its combat decision trace. */
    close(id: number): void {
        const bot = this.ctx.byId.get(id);
        const r3 = this.r3(id);
        const fight = bot?.bot.brain.mem.fight as { trace?: { counts?: Map<string, number> } } | undefined;
        const counts = fight?.trace?.counts;
        if (!r3 || !counts) return;
        for (const [k, v] of counts) if (k.startsWith("cook:") || k.startsWith("frag:")) r3.fragTrace[k] = v;
    }
}

interface Deliberate {
    plated: boolean;
    bots: Set<number>;
    broken: boolean;
    /** the last release by a bot that hit it deliberately */
    release: string;
}

/** Blacklist lengths of brain/scavenge.ts and explore.ts, by the reason they stand for. */
const BLACKLIST: Readonly<Record<number, string>> = {
    20: "noProgress",
    12: "stall",
    5: "stall",
    15: "noStandSpot",
    30: "unreachable",
};
/** The airdrop behaviour keeps a stale break target while it runs to a far drop: work counts within this distance. */
const WORK_RANGE = 30;

export class DeliberateCollector {
    private readonly ctx: MetricsCtx;
    private readonly containers = new Map<number, Deliberate>();
    private readonly work = new Map<number, number>();

    constructor(ctx: MetricsCtx) {
        this.ctx = ctx;
        const game = ctx.game;
        const original = game.damageObstacle.bind(game);
        game.damageObstacle = (o: ObstacleLike, params: DamageParams) => {
            const c = this.before(o, params);
            original(o, params);
            if (c && o.dead) c.broken = true;
        };
    }

    private before(o: ObstacleLike, params: DamageParams): Deliberate | undefined {
        if (o.dead || !o.destructible || !o.def.loot?.length || o.def.explosion) return undefined;
        let c = this.containers.get(o.id);
        if (params.sourceId && !params.isExplosion) {
            const bot = this.ctx.byId.get(params.sourceId);
            const beh = bot?.bot.intent.behaviour;
            if (bot && (beh === "break" || beh === "airdrop") && bot.bot.brain.mem.breakTarget === o.id) {
                if (!c) {
                    const plated = !!(o.def.armorPlated || o.def.stonePlated) && !canDamageObstacle(o, params);
                    c = { plated, bots: new Set(), broken: false, release: "" };
                    this.containers.set(o.id, c);
                }
                c.bots.add(params.sourceId);
            }
        }
        return c;
    }

    /** Who works on which container, and why each let go (every 0.05 s). */
    tick(): void {
        const { game } = this.ctx;
        if (game.tick % 5 !== 0) return;
        const now = game.time;
        for (const bot of this.ctx.bots) {
            const p = game.getPlayer(bot.playerId);
            const alive = !!p && !p.dead;
            const mem = bot.bot.brain.mem;
            const beh = bot.bot.intent.behaviour;
            let w = alive && !p.downed && (beh === "break" || beh === "airdrop") ? mem.breakTarget : 0;
            if (w && p) {
                const o = game.world.objects.get(w);
                if (!o || v2.distance(o.pos, p.pos) > WORK_RANGE) w = 0;
            }
            const prev = this.work.get(bot.playerId) ?? 0;
            if (prev === w) continue;
            if (w) this.work.set(bot.playerId, w);
            else this.work.delete(bot.playerId);
            const c = prev ? this.containers.get(prev) : undefined;
            if (!c || c.broken || !c.bots.has(bot.playerId)) continue;
            const o = game.world.objects.get(prev);
            if (!o || (o.kind === "obstacle" && o.dead)) continue;
            let reason: string;
            if (!alive) reason = "died";
            else if (p.downed) reason = "downed";
            else {
                const until = mem.lootBlacklist.get(prev);
                if (until !== undefined && until > now)
                    reason = BLACKLIST[Math.round(until - now)] ?? `bl${Math.round(until - now)}`;
                else if (w) reason = "switch";
                else reason = `left:${beh}`;
            }
            c.release = reason;
        }
    }

    finish(): DeliberateContainers {
        const out: DeliberateContainers = { started: 0, broken: 0, abandoned: 0, reasons: {}, ongoing: 0, plated: 0 };
        const working = new Set(this.work.values());
        for (const [id, c] of this.containers) {
            out.started++;
            if (c.plated) out.plated++;
            if (c.broken) {
                out.broken++;
                continue;
            }
            if (working.has(id)) {
                out.ongoing++;
                continue;
            }
            out.abandoned++;
            const why = c.plated ? "plated" : c.release || "unknown";
            out.reasons[why] = (out.reasons[why] ?? 0) + 1;
        }
        return out;
    }
}
