// Basements and bunkers (BrainFeatures.basements, the "basement" behaviour; owner 2026-10-08: "why don't the bots go
// underground? The military base's basement shows no sign of being looted"). Exploring only ever led bots to the
// interiors of ground-floor buildings, and underground loot does not show from the surface, so no bot walked down a
// stair unless it chased someone. Players who know the map go for the basements they know: the military base's, the
// Hydra bunker, the club's bathhouse. So a share of bots does too, more of the thorough looters and of the players who
// know the map (basementChance: by persona thoroughness and skill tier, drawn once per bot from its own stream). Such a
// bot, once nothing around it is left to loot (the trip starts in place of exploring), picks a basement within its
// reach (its roaming radius, stretched by what the floor is known to hold:
// knowledge/basements.ts, a per-bot spread so not everyone heads for the same one), walks down the stairs (the path
// follower's underground navigation), walks through the floor's rooms (waypoints over its floor, nearest first) while
// the loot and break behaviours take what it finds there (containers on its basement's floor are worth breaking even
// with a full loadout: scavenge.ts breakScore; the vault doors and switches are the puzzle behaviour's), then leaves:
// done, the basement is never visited again, and exploring takes it back up to the ground floor.
// Owner report 2026-10-10: nobody went down into the military base's basement, and bots skipped the greenhouse's
// (the Chrysanthemum bunker's stairs stand in the greenhouse) and the Crimson Ring club's (its bathhouse); they did
// visit the mansion and barn cellars. Those three are the basements every player knows (FAMOUS): their worth counts
// FAME times in the reach and the choice, and a bot that is no basement-goer still goes down one within its reach when
// its own draw says it knows them (famousChance: about half of the population, more of thorough and skilled ones).
// Fair: what it knows is map knowledge (where the structures and their stairs are, what kind of floor lies under them);
// what is down there now is seen only on the floor (perception: other floors' loot is culled, containers are read only
// while drawn on its floor), so a looted basement is found empty by walking through it, like a player does.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { type BasementSite, basementSites } from "../knowledge/basements.ts";
import type { UndergroundGrid } from "../nav/underground.ts";
import type { SeenObstacle } from "../perception/world.ts";
import type { PersonaParams } from "../persona.ts";
import type { SkillProfile } from "../skill.ts";
import { heatPenalty } from "./alert.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { underThreat } from "./lootRisk.ts";
import { zonePressure } from "./survival.ts";
import { onLeash } from "./team.ts";

/** Salt of the basement-goer draw: createRng(seed ^ BASEMENT_SALT), apart from the brain, motor, persona and puzzles. */
export const BASEMENT_SALT = 0x1b873593;
/** Utility of the trip: above exploring held (0.12 + 0.08), below an item worth a detour or a fight, zone, flight. */
const SCORE = 0.215;
/** A container on the floor being looted scores at least this (above SCORE held): breaking it is the point. */
export const BASEMENT_FURNITURE = 0.31;
/** A basement is looked for this often (s) while the bot has none; another trip waits COOLDOWN after one ends. */
const CHOOSE_EVERY = 3;
const COOLDOWN = 20;
const MAX_TRIPS = 2;
/** Reach: this share of the persona's roaming radius plus VALUE_WEIGHT units of walk per unit of floor value. */
const REACH_SHARE = 0.4;
const VALUE_WEIGHT = 45;
/** The floor must lie this far inside the safe zone. */
const SAFE_MARGIN = 10;
/** Zone pressure (survival.ts) above which no trip starts and a trip under way is dropped. */
const ZONE_LIMIT = 0.3;
/** Seconds of the trip's own behaviour to reach the floor, and game seconds on it, at most. */
const GO_LIMIT = 70;
const BELOW_LIMIT = 100;
/** Floor waypoints: at most about MAX_POINTS, at least MIN_SPACING apart; visited within VISITED; one not reached in
 * NOT_REACHED seconds of walking to it is dropped. */
const MAX_POINTS = 14;
const MIN_SPACING = 9;
const VISITED = 2.5;
const NOT_REACHED = 10;
/** The basements every player knows (structure types), their worth's weight, and the salt of the famous-goer draw. */
const FAMOUS: ReadonlySet<string> = new Set([
    "military_base_01",
    "bunker_structure_08",
    "bunker_structure_08b",
    "club_structure_01",
]);
const FAME = 1.6;
const FAMOUS_SALT = 0x2545f491;
/** What a skill tier knows of the map's basements (beginners have not found most of them yet). */
const TIER_KNOWS: Readonly<Record<SkillProfile["tier"], number>> = { beginner: 0.55, intermediate: 0.85, expert: 1 };

/**
 * Chance that a bot of this persona and skill goes for basements: thorough looters most (looter ~0.8 of experts),
 * rushers least (~0.15); about a third of the population mix.
 */
export function basementChance(persona: Readonly<PersonaParams>, skill: Readonly<SkillProfile>): number {
    const base = 0.15 + 1.1 * (persona.lootThoroughness - 0.35);
    return Math.max(0.05, Math.min(0.9, base * TIER_KNOWS[skill.tier]));
}

/** Whether this bot goes for basements at all (drawn once, on first use, from its own stream). */
export function basementGoer(ctx: BrainCtx): boolean {
    const lm = ctx.mem.loot2;
    if (lm.basementGoer === null) {
        const roll = createRng((ctx.mem.puzzle.seed ^ BASEMENT_SALT) >>> 0).next();
        lm.basementGoer = roll < basementChance(ctx.persona, ctx.skill);
    }
    return lm.basementGoer;
}

/** Chance that a bot that is no basement-goer still goes down the famous basements (persona thoroughness, skill). */
export function famousChance(persona: Readonly<PersonaParams>, skill: Readonly<SkillProfile>): number {
    return Math.max(0.1, Math.min(0.9, (0.3 + 0.6 * persona.lootThoroughness) * TIER_KNOWS[skill.tier]));
}

/** Whether this bot goes down the famous basements even if it is no basement-goer (its own draw, no rng shift). */
export function famousGoer(ctx: BrainCtx): boolean {
    const lm = ctx.mem.loot2;
    if (lm.famousGoer === null) {
        const roll = createRng((ctx.mem.puzzle.seed ^ FAMOUS_SALT) >>> 0).next();
        lm.famousGoer = roll < famousChance(ctx.persona, ctx.skill);
    }
    return lm.famousGoer;
}

/** A fixed per-bot spread of 0.6..1.4 on a basement's worth (not every goer heads for the same one). */
function spread(selfId: number, structureId: number): number {
    return 0.6 + (0.8 * ((((selfId * 83492791) ^ (structureId * 2971215073)) >>> 0) % 1000)) / 1000;
}

function siteOf(ctx: BrainCtx, id: number): BasementSite | null {
    const ug = ctx.model.underground;
    if (!ug || id < 0) return null;
    return basementSites(ctx.model.map, ug).find((s) => s.region.id === id) ?? null;
}

/** The basement worth going to now, or null: within reach, inside the safe zone, not done, not a place it fled. */
function chooseSite(ctx: BrainCtx, famousOnly = false): BasementSite | null {
    const { model, self } = ctx;
    const ug = model.underground;
    if (!ug) return null;
    const lm = ctx.mem.loot2;
    let best: BasementSite | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const site of basementSites(model.map, ug)) {
        if (lm.basementsDone.has(site.region.id)) continue;
        const famous = FAMOUS.has(site.type);
        if (famousOnly && !famous) continue;
        if (!model.insideSafeZone(site.center, SAFE_MARGIN) || avoidPos(ctx, site.center) || !onLeash(ctx, site.center))
            continue;
        let d = Number.POSITIVE_INFINITY;
        for (const p of site.region.portals) {
            if (!p.top || !p.bottom) continue;
            const dd = v2.distance(self.pos, p.top);
            if (dd < d && model.nav.reachable(self.pos, p.top)) d = dd;
        }
        if (!Number.isFinite(d)) continue;
        const bonus = VALUE_WEIGHT * site.value * spread(self.id, site.region.structureId) * (famous ? FAME : 1);
        if (d > REACH_SHARE * ctx.persona.roamRadius + bonus) continue;
        let cost = d - bonus;
        if (ctx.features.threats) cost += (1 / heatPenalty(ctx, site.center) - 1) * 40;
        if (cost < bestCost) {
            bestCost = cost;
            best = site;
        }
    }
    return best;
}

/**
 * Waypoints over the floor: one walkable floor cell per square of the spacing (the one nearest the square's middle),
 * reachable from a stair and with a way back to one (the Hydra's one-way doors); the spacing grows until there are at
 * most about MAX_POINTS (the bot sees some 25 units around it: the containers of every room show on the way).
 */
export function floorPoints(region: UndergroundGrid): Vec2[] {
    const portals = region.portals.filter((p) => p.top && p.bottom);
    const cells: number[] = [];
    for (let i = 0; i < region.w * region.h; i++) if (region.floor[i] && region.walkable(i)) cells.push(i);
    const usable = (c: Vec2) =>
        portals.some((p) => Number.isFinite(region.costToPortal(p, c))) &&
        portals.some((p) => Number.isFinite(region.costToPortal(p, c, true)));
    let spacing = Math.max(MIN_SPACING, Math.sqrt((cells.length * region.cellSize ** 2) / MAX_POINTS));
    let out: Vec2[] = [];
    for (let round = 0; round < 6; round++) {
        const buckets = new Map<number, { cell: number; d: number }>();
        for (const i of cells) {
            const c = region.center(i);
            const gx = Math.floor((c.x - region.ox) / spacing);
            const gy = Math.floor((c.y - region.oy) / spacing);
            const d = Math.hypot(c.x - region.ox - (gx + 0.5) * spacing, c.y - region.oy - (gy + 0.5) * spacing);
            const key = gy * 4096 + gx;
            const b = buckets.get(key);
            if (!b || d < b.d) buckets.set(key, { cell: i, d });
        }
        out = [];
        for (const { cell } of buckets.values()) {
            const c = region.center(cell);
            if (usable(c)) out.push(c);
        }
        if (out.length <= MAX_POINTS * 1.25) break;
        spacing *= 1.2;
    }
    return out;
}

function start(ctx: BrainCtx, site: BasementSite): void {
    const lm = ctx.mem.loot2;
    lm.basementSite = site.region.id;
    lm.basementTrips++;
    lm.basementWalked = 0;
    lm.basementTracked = ctx.now;
    lm.basementBelowAt = -1;
    lm.basementPoints = floorPoints(site.region);
    lm.basementPointWalked = 0;
}

function end(ctx: BrainCtx): void {
    const lm = ctx.mem.loot2;
    if (lm.basementSite >= 0) lm.basementsDone.add(lm.basementSite);
    lm.basementSite = -1;
    lm.basementPoints = [];
    lm.basementCheckAt = ctx.now + COOLDOWN;
}

/** Whether the bot stands on the floor of `region` (or on its lower stairs). */
function onFloorOf(ctx: BrainCtx, region: UndergroundGrid): boolean {
    return (ctx.self.layer & 1) === 1 && region.onFloor(ctx.self.pos, 1.5);
}

/** Utility of the basement trip (0: no trip, it is done, given up, or something threatens the bot). */
export function basementScore(ctx: BrainCtx): number {
    const { model, self, now } = ctx;
    if (!model.underground) return 0;
    const goer = basementGoer(ctx);
    if (!goer && !famousGoer(ctx)) return 0;
    const lm = ctx.mem.loot2;
    if (lm.basementSite < 0) {
        // a trip starts in place of exploring: what lies around (an item, a crate, the house it sweeps, a puzzle) first
        if (now < lm.basementCheckAt || ctx.mem.current !== "explore") return 0;
        lm.basementCheckAt = now + CHOOSE_EVERY;
        if (lm.basementTrips >= MAX_TRIPS || self.layer !== 0 || underThreat(ctx) || zonePressure(model) > ZONE_LIMIT)
            return 0;
        const site = chooseSite(ctx, !goer);
        if (!site) return 0;
        start(ctx, site);
    }
    const site = siteOf(ctx, lm.basementSite);
    if (!site) {
        end(ctx);
        return 0;
    }
    // the clocks count the trip's own time only (an item or a crate on the way, a fight, are not walking there)
    const dt = Math.min(0.5, Math.max(0, now - lm.basementTracked));
    lm.basementTracked = now;
    const mine = ctx.mem.current === "basement";
    if (mine) lm.basementWalked += dt;
    const below = onFloorOf(ctx, site.region);
    if (below && lm.basementBelowAt < 0) lm.basementBelowAt = now;
    if (!model.insideSafeZone(site.center, SAFE_MARGIN) || zonePressure(model) > ZONE_LIMIT) {
        end(ctx);
        return 0;
    }
    if (lm.basementBelowAt < 0 ? lm.basementWalked > GO_LIMIT : now - lm.basementBelowAt > BELOW_LIMIT) {
        end(ctx);
        return 0;
    }
    // chased out of it (danger memory) before getting down: another time
    if (lm.basementBelowAt < 0 && avoidPos(ctx, site.center)) {
        end(ctx);
        return 0;
    }
    if (lm.basementBelowAt >= 0) {
        // visited, failed or not reached in time: off the list (the time counts only while walking the floor)
        if (mine && below) lm.basementPointWalked += dt;
        const first = lm.basementPoints[0];
        lm.basementPoints = lm.basementPoints.filter(
            (p) => !(below && v2.distance(p, self.pos) < VISITED) && !nearFailedGoal(ctx, p),
        );
        if (first && lm.basementPoints[0] === first && lm.basementPointWalked > NOT_REACHED) lm.basementPoints.shift();
        if (lm.basementPoints[0] !== first) lm.basementPointWalked = 0;
        if (lm.basementPoints.length === 0) {
            end(ctx);
            return 0;
        }
    }
    if (underThreat(ctx)) return 0;
    return SCORE;
}

/** The waypoint to enter by: the one nearest the bottom of the stairs closest to the bot. */
function entryPoint(ctx: BrainCtx, region: UndergroundGrid, points: readonly Vec2[]): Vec2 | null {
    const me = ctx.self.pos;
    let portal = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const p of region.portals) {
        if (!p.top || !p.bottom) continue;
        const d = v2.distance(me, p.top);
        if (d < bestD) {
            bestD = d;
            portal = p;
        }
    }
    if (!portal) return null;
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const q of points) {
        const c = region.costToPortal(portal, q);
        if (c < bestCost) {
            bestCost = c;
            best = q;
        }
    }
    return best ?? portal.bottom;
}

/** Down the stairs to the floor, then through its rooms, nearest waypoint first. */
export function planBasement(ctx: BrainCtx): Intent {
    const intent = emptyIntent("basement");
    const lm = ctx.mem.loot2;
    const site = siteOf(ctx, lm.basementSite);
    if (site) {
        const me = ctx.self.pos;
        let goal: Vec2 | null;
        if (onFloorOf(ctx, site.region)) {
            lm.basementPoints.sort((a, b) => v2.distance(a, me) - v2.distance(b, me));
            goal = lm.basementPoints[0] ?? null;
        } else goal = entryPoint(ctx, site.region, lm.basementPoints);
        if (goal) {
            intent.goal = v2.copy(goal);
            intent.goalLayer = 1;
            intent.arriveDist = 1.5;
        }
    }
    addCombatLayer(ctx, intent);
    return intent;
}

/** Whether container `o` lies on the floor of the basement the bot is looting, with the bot down there (scavenge.ts). */
export function inLootedBasement(ctx: BrainCtx, o: SeenObstacle): boolean {
    const lm = ctx.mem.loot2;
    if (!ctx.features.basements || lm.basementSite < 0 || lm.basementBelowAt < 0 || (o.view.layer & 1) !== 1)
        return false;
    const site = siteOf(ctx, lm.basementSite);
    return !!site && onFloorOf(ctx, site.region) && site.region.onFloor(o.view.pos, 2);
}
