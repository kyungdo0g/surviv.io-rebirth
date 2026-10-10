// Danger memory (BrainFeatures.pursuit, bot overhaul MOVE-5; user report 14: "an unarmed bot tries to enter a house
// to loot, sees the armed player inside, flees, comes back, flees ... until the player kills it"). A place the bot
// fled from an armed enemy is remembered, keyed by building when the enemy stood under a roof (the roof hides it again
// the moment the bot steps out, so the old 2.5 s threat memory and the smart brain's 8 s / 16 u fled-spot memory let
// the bot walk straight back in), else as a spot in the open around the enemy's last noted position (14 units,
// remembered half as long: an enemy in the open moves on, and its spot moves with it: a trail of spots walled bots
// in). Loot, containers, explore goals and the follower's regroup (team.ts) in it, or on the way through it, are left
// alone (the avoidPos seam in explore.ts bestLoot / pickExploreGoal, scavenge.ts bestBreakable, team.ts) for 45 s
// while the bot is unarmed (it goes elsewhere and arms first; the memory no longer applies once it has a gun), 20 s
// when it fled armed (low health, outnumbered); every new flight from the same place adds the same again (up to three
// times), so a bot that keeps running into the same house stays away longer each time. Unarmed, a spot in the open is
// avoided out to the reach of the enemy's gun (its maxEngage + 8, 14..40 units: the flight radius of brain/flight.ts;
// with 14 units a match probe had unarmed followers flee, regroup to a leader 20-30 units from the gunman and flee
// again, up to 5 times in 3 minutes). An explore goal inside is dropped, and an unarmed bot walks on until it is 32
// units clear of the house (dangerToLeave: the house sweep, brain/sweep.ts, would walk it straight back in). The zone
// rotation goes round such a place (survival.ts, dangerAcross). Triage probe (house.ts, seed 3): 7 flee cycles in a
// row before the bot got the gun, and only because the player never shot. Goals in an air strike, or on the way
// through one, are avoided too (brain/strikes.ts). Round 5 (report 35): a building with an armed enemy in it that the
// bot does not deal with (it loots, sweeps or explores on) is remembered the same way (noteContested), and a building
// recorded unarmed waits 120 s per flight: the bot arms up elsewhere instead of walking back in to the same gunman.
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { distToSegment, pointInBounds } from "../geom.ts";
import { roofRegions } from "../perception/roofs.ts";
import type { Contact, WorldModel } from "../perception/world.ts";
import { enemyGun } from "./assess.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { nearLeftBe } from "./earlyPace.ts";
import type { DangerArea } from "./pursuitMemory.ts";
import { strikeBlocks } from "./strikes.ts";

/** Seconds a place is avoided per flight from it: recorded unarmed, recorded armed. */
const UNARMED_MEMORY = 45;
const ARMED_MEMORY = 20;
/**
 * A building recorded unarmed waits this long per flight (round 5, report 35: it goes elsewhere to arm up; the record
 * stops applying once it has a gun, so this only keeps an unarmed bot from walking back in to the same gunman).
 */
const UNARMED_BUILDING_MEMORY = 120;
/** Behaviours that deal with the enemy itself (a building it stands in is not contested by them, round 5). */
const FACING_IT = new Set(["fight", "flee", "evade", "disengage", "search", "hold", "revive", "downed", "zone"]);
/** Flights from one place that lengthen its memory at most. */
const MAX_COUNT = 3;
/** Radius of a spot in the open (remembered half as long: an enemy in the open moves on), the margin around rooms. */
const OPEN_RADIUS = 14;
const OPEN_FACTOR = 0.5;
/** Unarmed, a spot in the open is avoided out to the enemy gun's maxEngage + REACH_PAD (OPEN_RADIUS..REACH_MAX). */
const REACH_PAD = 8;
const REACH_MAX = 40;
const BUILDING_PAD = 6;
/** Notes of one place closer together than this belong to the same flight. */
const SAME_FLIGHT = 5;
const MAX_AREAS = 16;
/**
 * An unarmed bot that fled from a building keeps going until it is this far outside it (past the house sweep's own
 * leave distance, 30 units from the rooms, brain/sweep.ts LEAVE: the sweep of that house is dropped, not resumed;
 * `rad` already holds BUILDING_PAD), for up to LEAVE_TIME.
 */
const LEAVE_MARGIN = 26;
const LEAVE_TIME = 10;

const roofCache = new WeakMap<WorldModel, Map<number, Bounds[]>>();

/** The building (with a standing roof) whose rooms hold `p`: its id, centre and radius with the margin. */
function buildingAround(model: WorldModel, p: Vec2): { id: number; pos: Vec2; rad: number } | null {
    let cache = roofCache.get(model);
    if (!cache) {
        cache = new Map();
        roofCache.set(model, cache);
    }
    for (const r of roofRegions(model.buildings, cache)) {
        if (!r.regions.some((b) => pointInBounds(p, b))) continue;
        const min = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };
        const max = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY };
        for (const b of r.regions) {
            min.x = Math.min(min.x, b.min.x);
            min.y = Math.min(min.y, b.min.y);
            max.x = Math.max(max.x, b.max.x);
            max.y = Math.max(max.y, b.max.y);
        }
        const pos = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
        return { id: r.id, pos, rad: v2.distance(pos, max) + BUILDING_PAD };
    }
    return null;
}

/** Records (or refreshes) the place of the armed enemy `e` the bot is running from. */
export function noteDanger(ctx: BrainCtx, e: Contact): void {
    if (!ctx.features.pursuit) return;
    const pm = ctx.mem.pursuit;
    const now = ctx.now;
    for (let i = pm.dangers.length - 1; i >= 0; i--) if (now >= pm.dangers[i].until) pm.dangers.splice(i, 1);
    const b = buildingAround(ctx.model, e.pos);
    // in the open, one area per enemy that follows it (it moves on; a trail of areas walled the bot in)
    let a: DangerArea | undefined = b
        ? pm.dangers.find((x) => x.building === b.id)
        : pm.dangers.find((x) => x.building === 0 && (x.enemyId === e.id || v2.distance(x.pos, e.pos) < OPEN_RADIUS));
    const g = enemyGun(ctx, e);
    const reach = Math.min(REACH_MAX, Math.max(OPEN_RADIUS, (g ? Math.min(g.maxEngage, g.range) : 0) + REACH_PAD));
    if (!a) {
        a = {
            building: b?.id ?? 0,
            pos: b ? b.pos : v2.copy(e.pos),
            rad: b ? b.rad : OPEN_RADIUS,
            reach: b ? b.rad : reach,
            enemyId: b ? 0 : e.id,
            until: now,
            unarmed: true,
            count: 0,
            noted: Number.NEGATIVE_INFINITY,
            left: false,
        };
        pm.dangers.push(a);
        if (pm.dangers.length > MAX_AREAS) pm.dangers.shift();
    }
    if (now - a.noted > SAME_FLIGHT) a.count = Math.min(MAX_COUNT, a.count + 1);
    a.noted = now;
    a.left = false;
    if (ctx.armed) a.unarmed = false;
    if (!b) {
        a.pos = v2.copy(e.pos);
        a.enemyId = e.id;
        a.reach = Math.max(a.reach, reach);
    }
    const per = ctx.armed ? ARMED_MEMORY : b ? UNARMED_BUILDING_MEMORY : UNARMED_MEMORY;
    const memory = per * a.count * (b ? 1 : OPEN_FACTOR);
    a.until = Math.max(a.until, now + memory);
    // an explore goal in there, or beyond it, is dropped (explore keeps a goal for 30 s: straight back in)
    const goal = ctx.mem.exploreGoal;
    if (goal && inDanger(ctx, goal, false)) {
        ctx.mem.exploreGoal = null;
        ctx.mem.exploreUntil = 0;
    }
}

/**
 * The building an unarmed bot just fled from and is still next to (within LEAVE_MARGIN of it, the last sighting of the
 * enemy in it less than LEAVE_TIME ago): the flight carries it out of the way (the roof hides the enemy again the
 * moment the bot steps out, and the house sweep would walk it back in: brain/flight.ts).
 */
export function dangerToLeave(ctx: BrainCtx): DangerArea | null {
    if (!ctx.features.pursuit || ctx.armed) return null;
    for (const a of ctx.mem.pursuit.dangers) {
        if (a.building === 0 || !a.unarmed || a.left || ctx.now >= a.until) continue;
        // once clear of it (or after a while) the leaving is done; avoidPos keeps the bot's goals out of it
        if (ctx.now - a.noted > LEAVE_TIME || v2.distance(ctx.self.pos, a.pos) >= a.rad + LEAVE_MARGIN) a.left = true;
        else return a;
    }
    return null;
}

/**
 * Whether `p` (an item, a container, an explore goal) lies in a place the bot was chased out of, or the way to it
 * crosses one (from inside one: leads deeper in): loot, containers and explore goals there are left alone (a place
 * recorded while unarmed only until the bot has a gun). The way matters: an explore goal beyond the enemy walked the
 * bot straight back at it every time it lost sight of it (match probe, squads: explore <-> flee every 4 s).
 */
export function avoidPos(ctx: BrainCtx, p: Vec2): boolean {
    // early-game pacing: not up to an armed enemy the bot leaves be either (earlyPace.ts)
    return inDanger(ctx, p, false) || strikeBlocks(ctx, p) || (ctx.features.earlyPace && nearLeftBe(ctx, p));
}

/** avoidPos for buildings only (the flight's own checks keep it away from a threat in the open). */
export function inDangerBuilding(ctx: BrainCtx, p: Vec2): boolean {
    return inDanger(ctx, p, true);
}

function inDanger(ctx: BrainCtx, p: Vec2, buildingsOnly: boolean): boolean {
    if (!ctx.features.pursuit) return false;
    for (const a of ctx.mem.pursuit.dangers) if (blocks(ctx, a, p, buildingsOnly) !== null) return true;
    return false;
}

/** The radius `a` keeps the bot out of now (-1: it does not apply), unarmed: the reach of the gun it ran from. */
function radiusOf(ctx: BrainCtx, a: DangerArea, buildingsOnly: boolean): number {
    if (ctx.now >= a.until || (a.unarmed && ctx.armed) || (buildingsOnly && a.building === 0)) return -1;
    return a.unarmed ? a.reach : a.rad;
}

/** Whether `a` holds `p` ("in") or lies across the way there ("way": through it, or from inside it deeper in). */
function blocks(ctx: BrainCtx, a: DangerArea, p: Vec2, buildingsOnly: boolean): "in" | "way" | null {
    const rad = radiusOf(ctx, a, buildingsOnly);
    if (rad < 0) return null;
    if (v2.distance(p, a.pos) < rad) return "in";
    const me = ctx.self.pos;
    const clear = Math.min(rad, v2.distance(me, a.pos) - 2);
    return distToSegment(a.pos, me, p) < clear ? "way" : null;
}

/**
 * pursuit: the nearest place the bot was chased out of that lies across the way to `p` while `p` itself is outside
 * every such place (the zone rotation walks round it: survival.ts), as its centre and the radius kept from it; null.
 */
export function dangerAcross(ctx: BrainCtx, p: Vec2): { pos: Vec2; rad: number } | null {
    if (!ctx.features.pursuit) return null;
    const me = ctx.self.pos;
    let best: DangerArea | null = null;
    for (const a of ctx.mem.pursuit.dangers) {
        const b = blocks(ctx, a, p, false);
        if (b === "in") return null;
        if (b === "way" && (!best || v2.distance(me, a.pos) < v2.distance(me, best.pos))) best = a;
    }
    return best ? { pos: best.pos, rad: radiusOf(ctx, best, false) } : null;
}

/**
 * Round 5 (user report 35, the house in-out loop): an enemy with a gun in view inside the building the bot is in or
 * walking into, while the bot chose something else than dealing with it (looting, sweeping, exploring, a crate): the
 * building is remembered as contested like a flight from it (noteDanger), so its loot, rooms and explore goals wait
 * (avoidPos). The roof hides the enemy again the moment the bot steps out: without the memory every decision outside
 * forgot it and walked the bot back in (an armed bot leaving a lost trade, an unarmed one whose flight ended).
 */
export function noteContested(ctx: BrainCtx, intent: Intent): void {
    if (!ctx.features.pursuit || FACING_IT.has(intent.behaviour)) return;
    const me = ctx.self.pos;
    for (const e of ctx.visibleEnemies) {
        if (e.downed || !enemyGun(ctx, e)) continue;
        const b = buildingAround(ctx.model, e.pos);
        if (!b) continue;
        const goal = intent.goal;
        const entering = v2.distance(me, b.pos) < b.rad || (!!goal && v2.distance(goal, b.pos) < b.rad);
        if (entering) noteDanger(ctx, e);
    }
}
