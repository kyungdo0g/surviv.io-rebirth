// Fairness metrics (user report 3 "they look like they hack", reports 4 and 5 "aim without shooting"): shots and aim
// acquisitions at players a human at the bot's place could not see (off the 16:9 screen, under a roof, in smoke or
// foliage), the time from a target's on-screen exposure to the first shot at it, and why bots aim at a visible enemy
// without firing (the triage probe's classifier). Ground truth: the simulation's player positions and the bot's own
// view of the obstacles. Read-only.
import type { Bullet, DamageParams, Player } from "@rebirth/sim";
import type { BotController } from "../controller.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { concealed, onHumanScreen } from "../perception/sight.ts";
import { livingBots, type MetricsCtx, SAMPLE } from "./context.ts";
import { PairClock } from "./episodes.ts";
import { BODY_SLACK, bodyLineOfFire, humanSight } from "./truth.ts";

/** A shot at a target not shot at for this long starts an engagement (a "first shot"). */
const ENGAGEMENT_GAP = 3;
/** A concealed player that fired or was hit this recently has revealed itself (COMBAT-2 reveals it briefly). */
export const REVEAL_SECONDS = 2;

export class FairnessCollector {
    private readonly ctx: MetricsCtx;
    private readonly pairs = new Map<number, Map<number, PairClock>>();
    /** the target whose line of fire each bot's pair clock tracks */
    private readonly tracked = new Map<number, number>();
    private readonly lastShotAt = new Map<number, Map<number, number>>();
    /** any player's last shot and last hurt (by a player): concealed players reveal themselves */
    private readonly firedAt = new Map<number, number>();
    private readonly hurtAt = new Map<number, number>();
    /** human motor acquisitions (or legacy aim targets) seen last */
    private readonly acquisition = new Map<number, number>();

    constructor(ctx: MetricsCtx) {
        this.ctx = ctx;
    }

    private pair(botId: number, targetId: number): PairClock {
        let m = this.pairs.get(botId);
        if (!m) this.pairs.set(botId, (m = new Map()));
        let c = m.get(targetId);
        if (!c) m.set(targetId, (c = new PairClock()));
        return c;
    }

    private revealed(id: number, now: number): boolean {
        return (
            now - (this.firedAt.get(id) ?? Number.NEGATIVE_INFINITY) <= REVEAL_SECONDS ||
            now - (this.hurtAt.get(id) ?? Number.NEGATIVE_INFINITY) <= REVEAL_SECONDS
        );
    }

    onShotFired(shooter: Player, _weapon: string, _bullets: readonly Bullet[]): void {
        const { game, byId, metrics, roofs } = this.ctx;
        const now = game.time;
        this.firedAt.set(shooter.id, now);
        const bot = byId.get(shooter.id);
        const m = metrics.get(shooter.id);
        if (!bot || !m) return;
        m.shots++;
        const tid = bot.bot.intent.targetId;
        const t = tid ? game.getPlayer(tid) : undefined;
        if (!t || t.dead || t.teamId === shooter.teamId) return;
        m.targetedShots++;
        const sight = humanSight(game, roofs, bot, shooter, t);
        if (sight === "offscreen") m.offScreenShots++;
        const hidden = concealed(bot.bot.model, t.pos, t.layer);
        if (hidden) m.concealedShots++;
        let last = this.lastShotAt.get(shooter.id);
        if (!last) this.lastShotAt.set(shooter.id, (last = new Map()));
        if (now - (last.get(t.id) ?? Number.NEGATIVE_INFINITY) > ENGAGEMENT_GAP) {
            m.firstShots++;
            if (hidden && !this.revealed(t.id, now)) m.concealedFirstShots++;
        }
        last.set(t.id, now);
        // exposure clock: bring the pair up to date at the shot, then time the shot
        const clock = this.pair(shooter.id, t.id);
        const visible = sight === "visible";
        clock.see(now, visible);
        if (clock.tracking) clock.expose(now, visible && bodyLineOfFire(bot, shooter.pos, t.pos));
        const latency = clock.shot(now);
        if (latency !== null) m.exposureLatency.push(Math.round(latency * 1000) / 1000);
    }

    onPlayerDamaged(target: Player, params: DamageParams): void {
        if (params.sourceId) this.hurtAt.set(target.id, this.ctx.game.time);
    }

    tick(): void {
        const tick = this.ctx.game.tick;
        this.aimStarts();
        if (tick % SAMPLE.sight === 0) this.sightings();
        if (tick % SAMPLE.slow === 0) this.aimWithoutFire();
    }

    /** Aim acquisitions of player targets, and where the target was for a human at the bot's place. */
    private aimStarts(): void {
        const { game, roofs } = this.ctx;
        for (const { bot, p, m } of livingBots(this.ctx)) {
            const b = bot.bot;
            const it = b.intent;
            // human motor: each acquisition (a new target, or the same one back in view); legacy: a new aimed target
            const key = b.motor ? b.motor.acquisition : it.aim ? it.targetId : 0;
            const prev = this.acquisition.get(p.id);
            this.acquisition.set(p.id, key);
            if (prev === undefined || key === prev || !it.aim || !it.targetId || b.throws.active || p.downed) continue;
            const t = game.getPlayer(it.targetId);
            if (!t || t.dead || t.teamId === p.teamId) continue;
            m.aimStarts++;
            const sight = humanSight(game, roofs, bot, p, t);
            if (sight === "offscreen") m.offScreenAimStarts++;
            else if (sight === "hidden") m.hiddenAimStarts++;
        }
    }

    /** Pair clocks of every enemy on each bot's screen; the line of fire of each bot's current target. */
    private sightings(): void {
        const { game, roofs } = this.ctx;
        const now = game.time;
        const players = [...game.players()].filter((q) => !q.dead);
        for (const { bot, p } of livingBots(this.ctx)) {
            if (p.downed) continue;
            const tid = bot.bot.intent.targetId;
            const prevTracked = this.tracked.get(p.id) ?? 0;
            if (prevTracked && prevTracked !== tid) this.pairs.get(p.id)?.get(prevTracked)?.track(false);
            this.tracked.set(p.id, tid);
            for (const q of players) {
                if (q === p || q.teamId === p.teamId) continue;
                const isTarget = q.id === tid;
                if (!isTarget && !onHumanScreen(p.pos, p.zoom, q.pos, BODY_SLACK)) continue;
                const clock = this.pair(p.id, q.id);
                const visible = humanSight(game, roofs, bot, p, q) === "visible";
                clock.see(now, visible);
                if (isTarget) {
                    clock.track(true);
                    clock.expose(now, visible && bodyLineOfFire(bot, p.pos, q.pos));
                }
            }
        }
    }

    /** Why bots aim at an enemy they see without firing (triage section 1: range gate, line of fire, ...). */
    private aimWithoutFire(): void {
        for (const { bot, p, m } of livingBots(this.ctx)) {
            if (p.downed) continue;
            const it = bot.bot.intent;
            const c = it.targetId ? bot.bot.model.contacts.get(it.targetId) : undefined;
            if (!it.aim || !c?.visible || c.dead || c.downed) continue;
            m.aimSamples++;
            if (it.fire) continue;
            m.aimNoFire++;
            const why = noFireReason(bot, p, c.pos, c.firstSeen);
            m.noFire[why] = (m.noFire[why] ?? 0) + 1;
        }
    }
}

/** The triage probe's classifier of an aim without fire (first matching reason). */
export function noFireReason(
    bot: BotController,
    p: Player,
    targetPos: { x: number; y: number },
    firstSeen: number,
): string {
    const b = bot.bot;
    const it = b.intent;
    const cur = p.weaponManager.weapons[p.weaponManager.curWeapIdx];
    const gi = cur?.type ? gunInfo(cur.type) : undefined;
    const d = Math.hypot(targetPos.x - p.pos.x, targetPos.y - p.pos.y);
    const mem = b.brain.mem;
    if (p.action.type === "use" || p.action.type === "revive") return `busy:${p.action.type}`;
    if (b.throws.active) return "throw";
    if (!gi) return "melee";
    if (cur.ammo <= 0) return "mag0";
    if (d > Math.max(gi.maxEngage * b.params.rangeMult, 10) || d > gi.range) return `range:${gi.cls}`;
    if (!b.model.lineOfFire(b.model.self.pos, targetPos)) return "los";
    if (b.model.time - Math.max(firstSeen, mem.engageStart) < mem.reaction) return "reaction";
    if (it.behaviour !== "fight") return `beh:${it.behaviour}`;
    return "other";
}
