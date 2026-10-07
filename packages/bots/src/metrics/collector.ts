// The match metrics collector (bot overhaul HARNESS): one read-only MatchProbe that runs the fairness, looting,
// weapon and movement collectors over a match and returns MatchMetrics (runMatch puts it in MatchReport.metrics when
// MatchConfig.metrics is set). It reads the game and the bots and never writes them: no random draws, no snapshots
// (Game.getSnapshot keeps per-client state), Game.damageObstacle only wrapped. A match replays identically with or
// without it (test/metrics.test.ts).
import type { Bullet, CombatObserver, DamageParams, Game, Player } from "@rebirth/sim";
import type { BotController } from "../controller.ts";
import type { MatchProbe } from "../runner.ts";
import { ArsenalCollector } from "./arsenal.ts";
import type { MetricsCtx } from "./context.ts";
import { FairnessCollector } from "./fairness.ts";
import { DeliberateCollector, FragCollector } from "./frags.ts";
import { AirdropCollector, ContainerCollector, VisitCollector } from "./looting.ts";
import { MovementCollector } from "./movement.ts";
import { TacticsCollector } from "./round3.ts";
import type { Round3Bot } from "./round3Types.ts";
import { RoofIndex } from "./truth.ts";
import { ALIVE_STEP, type BotMetrics, emptyBotMetrics, type MatchMetrics } from "./types.ts";

export const METRICS_PROBE = "metrics";

export class MetricsCollector implements MatchProbe {
    readonly name = METRICS_PROBE;
    private ctx: MetricsCtx | null = null;
    private fairness: FairnessCollector | null = null;
    private containers: ContainerCollector | null = null;
    private airdrops: AirdropCollector | null = null;
    private visits: VisitCollector | null = null;
    private arsenal: ArsenalCollector | null = null;
    private movement: MovementCollector | null = null;
    private frags: FragCollector | null = null;
    private deliberate: DeliberateCollector | null = null;
    private tactics: TacticsCollector | null = null;
    private readonly alive: Array<{ t: number; alive: number }> = [];
    private readonly faction: Array<{ t: number; front: number; spread: number }> = [];
    private nextAlive = ALIVE_STEP;
    private readonly dead = new Set<number>();

    /** Combat notifications (runMatch chains it after the match statistics). */
    readonly observer: CombatObserver = {
        onShotFired: (shooter: Player, weapon: string, bullets: readonly Bullet[]) => {
            this.fairness?.onShotFired(shooter, weapon, bullets);
            this.tactics?.onShotFired(shooter);
        },
        onPlayerDamaged: (target: Player, params: DamageParams, amount: number) => {
            this.fairness?.onPlayerDamaged(target, params);
            this.frags?.onPlayerDamaged(target, params, amount);
            this.tactics?.onPlayerDamaged(target, params, amount);
        },
    };

    start(game: Game, bots: readonly BotController[]): void {
        const metrics = new Map<number, BotMetrics>();
        const byId = new Map<number, BotController>();
        for (const b of bots) {
            const p = game.getPlayer(b.playerId);
            byId.set(b.playerId, b);
            metrics.set(
                b.playerId,
                emptyBotMetrics(b.playerId, {
                    teamId: p?.teamId ?? 0,
                    tier: b.bot.skill.tier,
                    persona: b.bot.persona.name,
                    difficulty: b.bot.params.name,
                    brain: b.bot.brainName,
                }),
            );
        }
        const ctx: MetricsCtx = { game, bots, byId, metrics, roofs: new RoofIndex(game) };
        this.ctx = ctx;
        this.fairness = new FairnessCollector(ctx);
        this.containers = new ContainerCollector(ctx);
        this.airdrops = new AirdropCollector(ctx);
        this.visits = new VisitCollector(ctx);
        this.arsenal = new ArsenalCollector(ctx);
        this.movement = new MovementCollector(ctx);
        const r3 = (id: number): Round3Bot | undefined => metrics.get(id)?.r3;
        this.frags = new FragCollector(ctx, r3);
        this.deliberate = new DeliberateCollector(ctx);
        this.tactics = new TacticsCollector(ctx, r3);
    }

    tick(game: Game): void {
        const ctx = this.ctx;
        if (!ctx) return;
        // deaths first: close what the dead left open (their last samples stay as they were)
        for (const b of ctx.bots) {
            if (this.dead.has(b.playerId)) continue;
            const p = game.getPlayer(b.playerId);
            if (p && !p.dead) continue;
            this.dead.add(b.playerId);
            const m = ctx.metrics.get(b.playerId);
            if (m) m.deathAt = game.time;
            this.movement?.close(b.playerId);
            this.visits?.died(b.playerId);
            this.frags?.close(b.playerId);
            this.tactics?.close(b.playerId, true);
        }
        this.fairness?.tick();
        this.airdrops?.tick();
        this.visits?.tick();
        this.arsenal?.tick();
        this.movement?.tick();
        this.frags?.tick();
        this.deliberate?.tick();
        this.tactics?.tick();
        if (game.time >= this.nextAlive - 1e-6) {
            const t = this.nextAlive;
            this.nextAlive += ALIVE_STEP;
            this.alive.push({ t, alive: ctx.bots.length - this.dead.size });
            if (game.faction) this.faction.push({ t, ...factionFront(game) });
        }
    }

    finish(game: Game): MatchMetrics {
        const ctx = this.ctx;
        if (!ctx)
            return { bots: [], containers: { hit: 0, broken: 0, abandoned: 0, plated: 0 }, airdrops: [], alive: [] };
        for (const b of ctx.bots) {
            if (this.dead.has(b.playerId)) continue;
            this.movement?.close(b.playerId);
            this.frags?.close(b.playerId);
            this.tactics?.close(b.playerId, false);
        }
        this.visits?.finish();
        const containers = this.containers?.finish(game.time) ?? { hit: 0, broken: 0, abandoned: 0, plated: 0 };
        return {
            bots: [...ctx.metrics.values()],
            containers,
            airdrops: this.airdrops?.finish() ?? [],
            alive: this.alive,
            ...(game.faction ? { faction: this.faction } : {}),
            ...(this.deliberate ? { deliberate: this.deliberate.finish() } : {}),
        };
    }
}

/** 50v50: distance between the two factions' centroids and the mean spread of their players along that axis. */
export function factionFront(game: Game): { front: number; spread: number } {
    const sides = new Map<number, Array<{ x: number; y: number }>>();
    for (const p of game.players()) {
        if (p.dead) continue;
        const list = sides.get(p.teamId) ?? [];
        list.push(p.pos);
        sides.set(p.teamId, list);
    }
    const [a, b] = [sides.get(1) ?? [], sides.get(2) ?? []];
    if (!a.length || !b.length) return { front: 0, spread: 0 };
    const mean = (l: Array<{ x: number; y: number }>) => ({
        x: l.reduce((s, q) => s + q.x, 0) / l.length,
        y: l.reduce((s, q) => s + q.y, 0) / l.length,
    });
    const ca = mean(a);
    const cb = mean(b);
    const front = Math.hypot(cb.x - ca.x, cb.y - ca.y);
    const ax = front > 1e-6 ? { x: (cb.x - ca.x) / front, y: (cb.y - ca.y) / front } : { x: 1, y: 0 };
    const sd = (l: Array<{ x: number; y: number }>, c: { x: number; y: number }) =>
        Math.sqrt(l.reduce((s, q) => s + ((q.x - c.x) * ax.x + (q.y - c.y) * ax.y) ** 2, 0) / l.length);
    return { front: Math.round(front * 10) / 10, spread: Math.round(((sd(a, ca) + sd(b, cb)) / 2) * 10) / 10 };
}
