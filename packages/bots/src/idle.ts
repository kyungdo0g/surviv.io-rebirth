// Idle detector (match statistics, runner.ts): a living bot that moved less than 1 unit over the last 5 s although
// nothing asked it to stand still. Standing still on purpose is not idle: downed, using an item, reviving or being
// revived, or an Intent with `stop` (healing in place, reviving, holding a spot, punching a crate, a long shot). What is
// left are bots stuck with a goal they never walk to or a behaviour that forgot to move (spectators of real matches saw
// bots standing face to face for minutes). Each idle episode is recorded once with what the bot was doing when it
// began (behaviour, goal, path, keys, position, the obstacles around it) and its duration. Deterministic: it reads the
// game clock and the bots' state only.
import { type Vec2, v2 } from "@rebirth/core";
import type { Player } from "@rebirth/sim";
import type { BehaviourName } from "./brain/context.ts";
import type { BotController } from "./controller.ts";
import { distanceToCollider } from "./geom.ts";

/** Idle: moved less than MIN_MOVE units over WINDOW seconds. */
const WINDOW = 5;
const MIN_MOVE = 1;
/** Obstacles this close are listed with an event. */
const NEAR = 4;

export interface IdleEvent {
    playerId: number;
    /** game time the window began (the bot had stood still since) and how long the episode lasted (s) */
    start: number;
    duration: number;
    /** still idle when the match ended */
    open: boolean;
    behaviour: BehaviourName;
    goal: Vec2 | null;
    /** distance to the goal (Infinity without one) */
    goalDist: number;
    moveDir: boolean;
    pos: Vec2;
    layer: number;
    /** human keys: the octant held (-1 none), and the path follower's plan length and stuck events */
    octant: number;
    pathPoints: number;
    stuckEvents: number;
    /** obstacle types within 4 units (* blocks movement) */
    near: string[];
}

interface Track {
    trail: Array<{ t: number; pos: Vec2 }>;
    event: IdleEvent | null;
    idleSeconds: number;
    lastSample: number;
}

export class IdleDetector {
    readonly events: IdleEvent[] = [];
    private readonly tracks = new Map<number, Track>();

    /** Looks at every bot now (call every few ticks; the window is measured on the game clock). */
    sample(now: number, bots: readonly BotController[], player: (id: number) => Player | undefined): void {
        for (const b of bots) {
            const p = player(b.playerId);
            let tr = this.tracks.get(b.playerId);
            if (!p || p.dead) {
                if (tr?.event) this.close(tr, now);
                continue;
            }
            if (!tr) {
                tr = { trail: [], event: null, idleSeconds: 0, lastSample: now };
                this.tracks.set(b.playerId, tr);
            }
            const dt = now - tr.lastSample;
            tr.lastSample = now;
            tr.trail.push({ t: now, pos: v2.copy(p.pos) });
            while (tr.trail.length && tr.trail[0].t < now - WINDOW - 1e-6) tr.trail.shift();
            const intent = b.bot.intent;
            const action = p.action.type;
            const onPurpose = p.downed || intent.stop || action === "use" || action === "revive" || action === "reload";
            const span = tr.trail.length ? now - tr.trail[0].t : 0;
            let moved = 0;
            for (const q of tr.trail) moved = Math.max(moved, v2.distance(q.pos, p.pos));
            const idle = !onPurpose && span >= WINDOW - 0.11 && moved < MIN_MOVE;
            if (!idle) {
                if (tr.event) this.close(tr, now);
                continue;
            }
            tr.idleSeconds += dt;
            if (!tr.event) {
                const model = b.bot.model;
                const goal = intent.goal ? v2.copy(intent.goal) : null;
                tr.event = {
                    playerId: b.playerId,
                    start: now - span,
                    duration: span,
                    open: true,
                    behaviour: intent.behaviour,
                    goal,
                    goalDist: goal ? v2.distance(goal, p.pos) : Number.POSITIVE_INFINITY,
                    moveDir: !!intent.moveDir,
                    pos: v2.copy(p.pos),
                    layer: p.layer,
                    octant: b.bot.stick?.octant ?? -1,
                    pathPoints: b.bot.follower.points.length,
                    stuckEvents: b.bot.follower.stuckEvents,
                    near: model.obstacles
                        .filter((o) => distanceToCollider(p.pos, o.col) < NEAR)
                        .map((o) => `${o.view.type}${o.blocksMove ? "*" : ""}`),
                };
                this.events.push(tr.event);
            } else {
                tr.event.duration = now - tr.event.start;
            }
        }
    }

    /** Seconds `playerId` spent idle (after the first WINDOW seconds of each episode). */
    idleSecondsOf(playerId: number): number {
        return this.tracks.get(playerId)?.idleSeconds ?? 0;
    }

    /** Idle episodes of `playerId`. */
    eventsOf(playerId: number): IdleEvent[] {
        return this.events.filter((e) => e.playerId === playerId);
    }

    private close(tr: Track, now: number): void {
        if (!tr.event) return;
        tr.event.duration = now - tr.event.start;
        tr.event.open = false;
        tr.event = null;
    }
}
