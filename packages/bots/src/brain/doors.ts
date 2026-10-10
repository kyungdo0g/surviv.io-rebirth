// Doors (BrainFeatures.doors): what a player does with them beyond walking through (the path follower opens closed
// doors on the way: nav/follower.ts), and what they tell it.
// - Closing behind: the exterior door the bot came in by (DoorEntry) is shut behind it when it stays to loot, heal or
//   hold, drawn by skill and persona, never on a teammate following, and again when someone opens it while the bot is
//   inside (brain/doorClose.ts).
// - Not standing in a doorway: a bot about to stand still in an open doorway steps out of it (doorClose.ts).
// - Doors as information: a door heard or seen opening or closing nearby that neither the bot, a teammate nor an enemy
//   on the screen accounts for (perception/doorWatch.ts) puts the bot on alert: the gun comes out (the loot memory's
//   threat clock, brain/weapons.ts), the crosshair goes to the door, and a bot busy looting nearby stops for a moment;
//   a door found open that it last saw closed (someone passed while it was away) draws a shorter glance.
// Brain.think creates a DoorBrain only while the flag is on: observe() runs first in every decision, apply() layers the
// door actions on the planned intent. Its own random stream (seed ^ DOOR_SALT) keeps the other decisions' draws where
// they were; with the flag off nothing here runs, draws or writes.
import { type Collider, createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { distanceToCollider } from "../geom.ts";
import type { DoorUseSink } from "../nav/doorGeom.ts";
import { closable, doorMiddle, sideOf, useReach } from "../nav/doorGeom.ts";
import { type DoorCause, type DoorEvent, DoorWatch } from "../perception/doorWatch.ts";
import type { SeenObstacle } from "../perception/world.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { crossesDoorway, type DoorEntry, leaveDoorway, newEntry, planClose } from "./doorClose.ts";
import { underRoof } from "./grenades.ts";

/** Salt of the door decisions' random stream (createRng(seed ^ DOOR_SALT)). */
export const DOOR_SALT = 0x2d00a7c3;
/** A heard door this close (or anywhere in hearing while inside a building) puts the bot on alert. */
const HEARD_NEAR = 24;
/** A door found changed this close draws a glance. */
const PASSED_NEAR = 30;
/** The gun comes out for door alerts this close. */
const DRAW_NEAR = 25;
/** A bot this close to a heard door stops what it does for a moment. */
const PAUSE_NEAR = 18;
/** A player this close to a door (beyond its Use reach) accounts for a change of it. */
const CAUSE_MARGIN = 1.5;
/** A change of a door in reach this soon after the bot pressed Use is its own doing. */
const OWN_USE = 0.6;
/** Out from under the roof this long, the entry is over (the doorway itself is just outside the roof's region). */
const OUTSIDE_GRACE = 1;
/** Roof probes this far either side of a door tell an exterior door (one side under the roof) from an inner one. */
const ROOF_PROBE = 1.6;
/** Behaviours a door alert's pause may stop (busy with nothing urgent). */
const PAUSABLE = new Set<BehaviourName>(["loot", "break", "sweep", "explore"]);
/** Behaviours with an aim of their own: no glance at a door. */
const OWN_AIM = new Set<BehaviourName>(["fight", "flee", "disengage", "evade", "evacuate", "rush", "downed"]);

export interface DoorAlert {
    id: number;
    kind: DoorEvent["kind"];
    pos: Vec2;
    /** the alert starts after a human reaction, lasts until `until`; a pause of the bot's business until `pauseUntil` */
    start: number;
    until: number;
    pauseUntil: number;
}

export class DoorBrain implements DoorUseSink {
    readonly watch = new DoorWatch();
    private readonly rng: Rng;
    private lastPos: Vec2 | null = null;
    /** when the bot last pressed Use (its brain or its path follower) */
    private lastUse = Number.NEGATIVE_INFINITY;
    /** the exterior door the bot came in by, while it stays inside */
    entry: DoorEntry | null = null;
    /** the latest door alert */
    alert: DoorAlert | null = null;
    /** doors this bot has shut behind it (diagnostics, tests) */
    closes = 0;

    constructor(seed: number) {
        this.rng = createRng(seed ^ DOOR_SALT);
    }

    /** The bot pressed Use (Brain.think for its intents, nav/follower.ts for the doors on its way). */
    noteUse(now: number): void {
        this.lastUse = now;
    }

    /** First in every decision: the doors of the snapshot, the alerts they raise, the door the bot came in by. */
    observe(ctx: BrainCtx): void {
        if (ctx.self.dead) return;
        const events = this.watch.observe(ctx.model, (o, before) => this.causeOf(ctx, o, before));
        for (const e of events) this.onEvent(ctx, e);
        this.trackEntry(ctx);
    }

    /** Layers the door actions on the planned intent: the alert, the close behind, leaving a doorway. */
    apply(ctx: BrainCtx, intent: Intent): void {
        if (ctx.self.dead || ctx.self.downed) return;
        const paused = this.applyAlert(ctx, intent);
        const closing = this.entry ? planClose(ctx, this.entry, this.watch, this.rng, intent, paused) : false;
        if (!closing && !paused) leaveDoorway(ctx, this.watch, intent);
    }

    /**
     * Who accounts for a change of door `o` (`before`: its collider before): the bot when it just pressed Use in reach of
     * it or set it moving from afar (BrainMemory.ownDoors), a friend or an enemy on the screen next to it, else the bot
     * when it stood next to it (an automatic door opening for it, a punch), else nobody the bot knows of.
     */
    private causeOf(ctx: BrainCtx, o: SeenObstacle, before: Collider): DoorCause {
        // a door the bot's own switch, panel or vault press set moving (brain/puzzle.ts), however far from it
        if ((ctx.mem.ownDoors.get(o.view.id) ?? Number.NEGATIVE_INFINITY) >= ctx.now) return "self";
        const reach = useReach(o.def) + CAUSE_MARGIN;
        const shape = this.watch.shape(ctx.model, o);
        const closed = shape?.closedCol ?? o.col;
        const near = (p: Vec2) =>
            distanceToCollider(p, o.col) < reach ||
            distanceToCollider(p, before) < reach ||
            distanceToCollider(p, closed) < reach;
        const here = near(ctx.self.pos) || (!!this.lastPos && near(this.lastPos));
        if (here && ctx.now - this.lastUse < OWN_USE) return "self";
        for (const m of ctx.model.team) if (m.playerId !== ctx.self.id && !m.dead && near(m.pos)) return "team";
        for (const c of ctx.model.contacts.values()) {
            if (!c.visible || c.dead || !near(c.pos)) continue;
            return c.teammate ? "team" : "enemy";
        }
        return here ? "self" : "unknown";
    }

    private onEvent(ctx: BrainCtx, e: DoorEvent): void {
        const { now, self, model } = ctx;
        const entry = this.entry;
        if (entry && e.id === entry.id) {
            if (!e.open) {
                if (e.cause === "self") {
                    entry.closes++;
                    this.closes++;
                }
                entry.since = Number.NEGATIVE_INFINITY;
                entry.spot = null;
            } else if (e.cause === "self") {
                // the bot opened it itself: on its way out
                this.entry = null;
            } else {
                // opened by someone else while the bot is inside: close it again after a look (doorClose maxCloses)
                entry.reactAt = now + this.rng.range(0.4, 0.9);
                entry.since = Number.NEGATIVE_INFINITY;
            }
        }
        if (e.cause === "self" || e.cause === "team") return;
        const d = v2.distance(e.pos, self.pos);
        const inside = underRoof(model, self.pos);
        if (e.kind === "heard" ? d > HEARD_NEAR && !inside : d > PASSED_NEAR) return;
        const g = ctx.skill.g;
        const [lo, hi] = ctx.params.reactionTime;
        const start = now + (lo + hi) / 2;
        const heard = e.kind === "heard";
        this.alert = {
            id: e.id,
            kind: e.kind,
            pos: v2.copy(e.pos),
            start,
            until: start + (heard ? 2.5 + 2 * g : 1.5 + g),
            pauseUntil: heard && d < PAUSE_NEAR ? start + 0.4 + 0.8 * g : Number.NEGATIVE_INFINITY,
        };
        // someone is there: no holstering, the gun comes out (brain/weapons.ts reads the loot memory's threat clock)
        if (d < DRAW_NEAR) ctx.mem.loot2.lastThreat = Math.max(ctx.mem.loot2.lastThreat, now);
    }

    /** The door alert on the intent: the crosshair on the door and, early on, a pause; true while the pause runs. */
    private applyAlert(ctx: BrainCtx, intent: Intent): boolean {
        const a = this.alert;
        const now = ctx.now;
        if (!a) return false;
        if (now > a.until) {
            this.alert = null;
            return false;
        }
        if (now < a.start || OWN_AIM.has(intent.behaviour) || intent.aim) return false;
        if (ctx.visibleEnemies.some((e) => !e.downed)) return false;
        if (!intent.lookAt) intent.lookAt = v2.copy(a.pos);
        const pause = now < a.pauseUntil && PAUSABLE.has(intent.behaviour) && ctx.self.action.type === "none";
        if (pause) {
            intent.stop = true;
            intent.goal = null;
            intent.moveDir = null;
        }
        return pause;
    }

    /**
     * The exterior door the bot just walked in by: its position moved across a closable door's doorway since the last
     * decision, towards the side under the building's roof. Leaving by any exterior door, or staying out from under the
     * roof for OUTSIDE_GRACE, ends the entry.
     */
    private trackEntry(ctx: BrainCtx): void {
        const { model, self, now } = ctx;
        const cur = v2.copy(self.pos);
        const prev = this.lastPos;
        this.lastPos = cur;
        const entry = this.entry;
        if (entry) {
            if (self.layer !== 0 || underRoof(model, cur)) entry.outsideSince = Number.POSITIVE_INFINITY;
            else if (entry.outsideSince === Number.POSITIVE_INFINITY) entry.outsideSince = now;
            else if (now - entry.outsideSince > OUTSIDE_GRACE) this.entry = null;
        }
        if (!prev || self.layer !== 0 || v2.distance(prev, cur) > 6) return;
        for (const o of model.obstacles) {
            if (!o.view.door || o.view.dead || o.view.layer !== 0 || !closable(o.def)) continue;
            const shape = this.watch.shape(model, o);
            if (!shape || distanceToCollider(cur, shape.closedCol) > 6) continue;
            if (!crossesDoorway(shape, prev, cur)) continue;
            const mid = doorMiddle(shape);
            const side = sideOf(shape, cur) > 0 ? 1 : -1;
            const ahead = underRoof(model, v2.add(mid, v2.mul(shape.normal, side * ROOF_PROBE)));
            const behind = underRoof(model, v2.add(mid, v2.mul(shape.normal, -side * ROOF_PROBE)));
            if (ahead === behind) continue;
            // walked in by it (the roof ahead), or out of the building by it
            this.entry = ahead ? newEntry(o.view.id, side, now) : null;
            if (this.entry) this.entry.reactAt = now + this.rng.range(0.25, 0.7);
            return;
        }
    }
}
