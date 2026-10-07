// Looting metrics (user reports 2, 6 and 7): containers bots hit while breaking, broke or left standing, plated ones
// punched to no effect; air drops landed, opened, inner crate broken and looted; building visits and the items picked
// up during them. Containers are watched by wrapping Game.damageObstacle (it calls the original first and changes
// nothing), the rest by sampling the world. Read-only.
import type { Bounds, Vec2 } from "@rebirth/core";
import { AIRDROP_TIER_BASE_CRATES, MapObjectDefs } from "@rebirth/defs";
import { canDamageObstacle, type DamageParams, type Game } from "@rebirth/sim";
import { pointInBounds } from "../geom.ts";
import { livingBots, type MetricsCtx, SAMPLE } from "./context.ts";
import type { AirdropRecord, ContainerTotals } from "./types.ts";

/** Behaviours that hit containers on purpose (stray fight bullets do not count). */
const LOOTING = new Set(["break", "sweep", "loot", "airdrop"]);
/** A container is abandoned when the bot that last hit it while breaking lived this long after without breaking it. */
const ABANDON_AFTER = 10;
/**
 * Inner crates of an opened air drop: the destroyType of every airdrop_crate* obstacle (crate_10..13 and the event
 * variants: crate_11de on desert, crate_10sv on savannah, ...) and the rebirth air drop tier crates the server swaps
 * in when a normal drop opens (crate_10t1 / crate_10t2 / crate_10svt1 / crate_10svt2, @rebirth/defs airdropTiers).
 */
const INNER = new Set([
    ...Object.entries(MapObjectDefs).flatMap(([id, d]) => {
        const inner = (d as { destroyType?: string }).destroyType;
        return id.startsWith("airdrop_crate") && inner ? [inner] : [];
    }),
    ...Object.keys(AIRDROP_TIER_BASE_CRATES),
]);
/** A building visit: inside a zoomIn region for at least VISIT_MIN s; it ends after VISIT_GAP s outside. */
const VISIT_MIN = 1;
const VISIT_GAP = 2;

type ObstacleLike = Parameters<Game["damageObstacle"]>[0];

interface ContainerState {
    plated: boolean;
    /** last bot that hit it while looting, when, and whether that hit had no effect (plating) */
    breaker: number;
    lastBreakHit: number;
    broken: boolean;
    /** bots that hit it while looting (each counts it once) */
    hitters: Set<number>;
    platedBy: Set<number>;
}

export class ContainerCollector {
    private readonly ctx: MetricsCtx;
    private readonly containers = new Map<number, ContainerState>();

    constructor(ctx: MetricsCtx) {
        this.ctx = ctx;
        const game = ctx.game;
        const original = game.damageObstacle.bind(game);
        game.damageObstacle = (o: ObstacleLike, params: DamageParams) => {
            const watch = this.before(o, params);
            original(o, params);
            if (watch && o.dead) this.broken(o, params);
        };
    }

    private before(o: ObstacleLike, params: DamageParams): boolean {
        if (o.dead || !o.destructible || !o.def.loot?.length || !params.sourceId) return false;
        const bot = this.ctx.byId.get(params.sourceId);
        const m = this.ctx.metrics.get(params.sourceId);
        if (!bot || !m || !LOOTING.has(bot.bot.intent.behaviour)) return false;
        let c = this.containers.get(o.id);
        if (!c) {
            c = {
                plated: !!(o.def.armorPlated || o.def.stonePlated),
                breaker: 0,
                lastBreakHit: 0,
                broken: false,
                hitters: new Set(),
                platedBy: new Set(),
            };
            this.containers.set(o.id, c);
        }
        if (!c.hitters.has(m.id)) {
            c.hitters.add(m.id);
            m.containersHit++;
        }
        c.breaker = m.id;
        c.lastBreakHit = this.ctx.game.time;
        if (c.plated && !canDamageObstacle(o, params) && !c.platedBy.has(m.id)) {
            c.platedBy.add(m.id);
            m.platedHits++;
        }
        return true;
    }

    private broken(o: ObstacleLike, params: DamageParams): void {
        const c = this.containers.get(o.id);
        if (!c || c.broken) return;
        c.broken = true;
        const m = params.sourceId ? this.ctx.metrics.get(params.sourceId) : undefined;
        if (m) m.containersBroken++;
    }

    /** Totals at the end; abandoned containers are charged to their last breaker. */
    finish(now: number): ContainerTotals {
        const t: ContainerTotals = { hit: 0, broken: 0, abandoned: 0, plated: 0 };
        for (const c of this.containers.values()) {
            t.hit++;
            if (c.platedBy.size) t.plated++;
            if (c.broken) {
                t.broken++;
                continue;
            }
            const m = this.ctx.metrics.get(c.breaker);
            if (!m || c.plated) continue;
            const until = m.deathAt >= 0 ? m.deathAt : now;
            if (until - c.lastBreakHit >= ABANDON_AFTER) {
                t.abandoned++;
                m.containersAbandoned++;
            }
        }
        return t;
    }
}

interface DropState extends AirdropRecord {
    id: number;
    pos: Vec2;
    inner: number;
    /** items that came out of the inner crate: id -> last position */
    items: Map<number, Vec2>;
}

export class AirdropCollector {
    private readonly ctx: MetricsCtx;
    private readonly drops = new Map<number, DropState>();

    constructor(ctx: MetricsCtx) {
        this.ctx = ctx;
    }

    tick(): void {
        const { game } = this.ctx;
        if (game.tick % SAMPLE.slow !== 0) return;
        const now = game.time;
        const objects = game.world.objects;
        for (const o of objects.values()) {
            if (o.kind !== "obstacle" || this.drops.has(o.id) || o.dead || !o.type.startsWith("airdrop_crate"))
                continue;
            this.drops.set(o.id, {
                id: o.id,
                pos: { x: o.pos.x, y: o.pos.y },
                landedAt: now,
                openedAt: -1,
                innerBrokenAt: -1,
                lootedAt: -1,
                inner: 0,
                items: new Map(),
            });
        }
        for (const d of this.drops.values()) {
            if (d.lootedAt >= 0) continue;
            const crate = objects.get(d.id);
            if (d.openedAt < 0 && (!crate || (crate.kind === "obstacle" && crate.dead))) {
                d.openedAt = now;
                for (const x of objects.values()) {
                    if (x.kind === "obstacle" && INNER.has(x.type) && !x.dead && near(x.pos, d.pos, 3)) d.inner = x.id;
                }
            }
            if (d.inner && d.innerBrokenAt < 0) {
                const x = objects.get(d.inner);
                if (!x || (x.kind === "obstacle" && x.dead)) d.innerBrokenAt = now;
            }
            if (d.innerBrokenAt < 0) continue;
            // the inner crate's items: remember those around the drop, then wait for one to go with a player beside it
            for (const x of objects.values()) {
                if (x.kind === "loot" && !x.destroyed && near(x.pos, d.pos, 5)) d.items.set(x.id, { ...x.pos });
            }
            for (const [id, pos] of d.items) {
                const x = objects.get(id);
                if (x && !(x.kind === "loot" && x.destroyed)) {
                    if (x.kind === "loot") d.items.set(id, { ...x.pos });
                    continue;
                }
                d.items.delete(id);
                for (const { p } of livingBots(this.ctx)) if (near(p.pos, pos, 4)) d.lootedAt = now;
            }
        }
    }

    finish(): AirdropRecord[] {
        return [...this.drops.values()].map(({ landedAt, openedAt, innerBrokenAt, lootedAt }) => ({
            landedAt,
            openedAt,
            innerBrokenAt,
            lootedAt,
        }));
    }
}

function near(a: Vec2, b: Vec2, r: number): boolean {
    return Math.abs(a.x - b.x) <= r && Math.abs(a.y - b.y) <= r && Math.hypot(a.x - b.x, a.y - b.y) <= r;
}

interface Visit {
    building: number;
    enter: number;
    lastIn: number;
    pickups: number;
}

/** Building visits and pickups (Player.lastPickup is replaced on every pickup). */
export class VisitCollector {
    private readonly ctx: MetricsCtx;
    private readonly regions: Array<{ id: number; region: Bounds }> = [];
    private readonly visits = new Map<number, Visit>();
    private readonly lastPickup = new Map<number, unknown>();

    constructor(ctx: MetricsCtx) {
        this.ctx = ctx;
        for (const b of ctx.game.world.buildings) {
            if (b.layer !== 0) continue;
            for (const z of b.zoomRegions) if (z.zoomIn) this.regions.push({ id: b.id, region: z.zoomIn });
        }
    }

    tick(): void {
        const { game } = this.ctx;
        if (game.tick % SAMPLE.events === 0) {
            for (const { p, m } of livingBots(this.ctx)) {
                const lp = p.lastPickup;
                if (lp && lp !== this.lastPickup.get(p.id) && lp.result === "success") m.pickups++;
                this.lastPickup.set(p.id, lp);
            }
        }
        if (game.tick % SAMPLE.visits !== 0) return;
        const now = game.time;
        for (const { p, m } of livingBots(this.ctx)) {
            const inside = p.layer === 0 ? this.buildingAt(p.pos) : 0;
            const v = this.visits.get(p.id);
            if (v && inside === v.building) {
                v.lastIn = now;
                continue;
            }
            if (v && (inside || now - v.lastIn > VISIT_GAP)) this.close(p.id, m);
            if (inside) this.visits.set(p.id, { building: inside, enter: now, lastIn: now, pickups: m.pickups });
        }
    }

    private buildingAt(p: Vec2): number {
        for (const r of this.regions) if (pointInBounds(p, r.region)) return r.id;
        return 0;
    }

    private close(
        id: number,
        m: { buildingVisits: number; visitPickups: number; emptyVisits: number; pickups: number },
    ) {
        const v = this.visits.get(id);
        this.visits.delete(id);
        if (!v || v.lastIn - v.enter < VISIT_MIN) return;
        const got = m.pickups - v.pickups;
        m.buildingVisits++;
        m.visitPickups += got;
        if (got === 0) m.emptyVisits++;
    }

    /** Closes the visits still open (death, match end). */
    finish(): void {
        for (const [id] of [...this.visits]) {
            const m = this.ctx.metrics.get(id);
            if (m) this.close(id, m);
        }
    }

    /** A bot died: its visit ends. */
    died(id: number): void {
        const m = this.ctx.metrics.get(id);
        if (m && this.visits.has(id)) this.close(id, m);
    }
}
