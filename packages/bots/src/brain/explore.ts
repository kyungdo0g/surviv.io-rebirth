// Looting and exploring: the most valuable remembered item weighed by distance (weapons first while unarmed), walking
// onto it and picking it up with Input.Loot (switching to the weaker gun first when both gun slots are full so the
// pickup replaces it), and otherwise walking from building to building inside the safe zone, where the loot is.
//
// Bot overhaul LOOT-8/9 (both brains): guns are valued by the tier list and the bot's taste (knowledge/desire.ts); an
// under-armed bot (its best gun weak) goes for a real gun like an unarmed one; only a threatening enemy halves loot (any
// enemy in view did, so a known upgrade lost to a far unarmed player); Loot is pressed only when the target is the
// closest item in reach or the closer one is welcome (the sim picks the closest: a pistol next to the target replaced
// a better gun). The persona's thoroughness scales how far loot is worth walking and the value floor (NEUTRAL: today's
// 70 units and 6), its roam radius the buildings it explores (240). With BrainFeatures.sweep, a building is visited
// only once swept (brain/sweep.ts) and buildings are weighed by their loot potential. With BrainFeatures.outfits, an
// outfit close by is worth a short detour by the bot's taste when it is quiet (brain/outfits.ts, LOOT2).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, getMapObjectDef, hasDef, hasMapObjectDef, Input } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";
import { colliderBounds, transformCollider } from "../geom.ts";
import { buildingLootValue } from "../knowledge/buildingValue.ts";
import type { Taste } from "../knowledge/desire.ts";
import { lootValue, slotToReplace } from "../knowledge/loot.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import type { SeenLoot } from "../perception/world.ts";
import { byThoroughness } from "../persona.ts";
import { heatPenalty } from "./alert.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { scopeLootValue } from "./gear.ts";
import { lootDamping } from "./lootRisk.ts";
import { isOutfit, noteOutfit, OUTFIT_SCORE, outfitValue } from "./outfits.ts";
import { steadyGoal } from "./steady.ts";
import { onTheWay } from "./survival.ts";
import { buildingPotential, sweepPending } from "./sweep.ts";

const LOOT_RADIUS = GameConfig.lootRadius as Readonly<Record<string, number>>;
const MAX_LOOT_DIST = 70;
/** Buildings farther than this are not explored (NEUTRAL; persona roamRadius). */
const ROAM = 240;
/** Items worth less than this are left (NEUTRAL; lower for thorough personas). */
const VALUE_FLOOR = 6;
/** A weak-only bot treats a real gun like an unarmed bot treats any gun (design 2.4: lootScore at least 0.65). */
const WEAK_GUN_URGENCY = 0.65;
/** Loot worth this much is a known upgrade: a non-threatening enemy in view does not cut it. */
const UPGRADE_VALUE = 40;

/** Ammo on the ground this close to the bot counts as at hand for its guns and the guns it finds (desire.ts). */
const AMMO_NEAR = 20;
/**
 * With BrainFeatures.steady, ammo at hand stays so while a stack of it lies this close: a bot walking from 5.56 ammo to
 * an HK416 28 units from it valued the gun at nothing once the ammo fell 20 units behind, turned to a scope the other
 * way, had the ammo back within 20 and turned again (85 s back and forth at the radio station, movestats seed 7).
 */
const AMMO_KEEP = 40;
/** A gun just swapped out is not picked up again for this long (whatever the valuation says: no swapping back). */
const SWAP_GUARD = 15;

const ammoCache = new WeakMap<object, { at: number; set: Set<string> }>();

/** Ammo types the bot knows on the ground within AMMO_NEAR (once per decision; AMMO_KEEP for those already at hand). */
export function ammoKnown(ctx: BrainCtx): ReadonlySet<string> {
    const c = ammoCache.get(ctx.mem);
    if (c && c.at === ctx.now) return c.set;
    const kept = ctx.features.steady ? c?.set : undefined;
    const set = new Set<string>();
    for (const o of ctx.model.loot.values()) {
        if (!set.has(o.type) && hasDef(o.type) && GameObjectDefs[o.type].type === "ammo") {
            const d = v2.distance(o.pos, ctx.self.pos);
            if (d < AMMO_NEAR || (d < AMMO_KEEP && !!kept?.has(o.type))) set.add(o.type);
        }
    }
    ammoCache.set(ctx.mem, { at: ctx.now, set });
    return set;
}

/** Whether `p` lies at an opened air drop the bot knows (its guns carry their ammo inside). */
function nearOpenedDrop(ctx: BrainCtx, p: Vec2): boolean {
    for (const d of ctx.model.airdrops.known()) if (d.stage === "opened" && v2.distance(d.pos, p) < 10) return true;
    return false;
}

/** The bot's taste for loot decisions: its persona and mechanics skill. */
export function tasteOf(ctx: BrainCtx): Taste {
    // (round 6: only the flags that are on reach the taste, so a bot without them values guns as before)
    const f = ctx.features;
    if (!f.potatoGuns && !f.dmrFit) return { persona: ctx.persona, s: ctx.skill.s };
    return { persona: ctx.persona, s: ctx.skill.s, potatoGuns: f.potatoGuns, dmrFit: f.dmrFit };
}

export interface LootChoice {
    loot: SeenLoot;
    value: number;
    dist: number;
}

function lootRad(type: string): number {
    if (!hasDef(type)) return 1;
    return LOOT_RADIUS[GameObjectDefs[type].type] ?? 1;
}

/** The item most worth walking to, or null. */
export function bestLoot(ctx: BrainCtx): LootChoice | null {
    const { model, self, mem, now } = ctx;
    let best: LootChoice | null = null;
    let bestScore = 0;
    // basements: loot on underground floors too, reachable through the stairs (nav/underground.ts)
    const below = ctx.features.basements ? model.underground : null;
    const taste = tasteOf(ctx);
    const maxDist = byThoroughness(ctx.persona, MAX_LOOT_DIST, 0.8);
    const floor = VALUE_FLOOR * (1 - 0.8 * (ctx.persona.lootThoroughness - 0.5));
    if (ctx.features.outfits) noteOutfit(ctx);
    for (const l of model.loot.values()) {
        if ((l.layer & 1) !== 0 && !below) continue;
        const until = mem.lootBlacklist.get(l.id);
        if (until !== undefined) {
            if (until > now) continue;
            mem.lootBlacklist.delete(l.id);
        }
        const d = v2.distance(self.pos, l.pos);
        if (d > maxDist || !model.insideCurrentCircle(l.pos, 2) || nearFailedGoal(ctx, l.pos)) continue;
        if (!onTheWay(model, l.pos)) continue;
        if (ctx.features.steady && !steadyGoal(ctx, l.pos)) continue;
        // danger memory seam (MOVE): loot in a place the bot was chased out of
        if (avoidPos(ctx, l.pos)) continue;
        // scope: a better scope is worth a detour (the bot's view, brain/gear.ts)
        // no swapping back to a gun it just dropped
        if (ctx.now < mem.loot2.swapGuardUntil && l.type === mem.loot2.swapGuardType) continue;
        // guns from an air drop come loaded (preloaded tables): no side stacks of ammo to see
        const ammo = nearOpenedDrop(ctx, l.pos) ? undefined : ammoKnown(ctx);
        let value = ctx.features.scope
            ? Math.max(lootValue(self, l.type, taste, ammo), scopeLootValue(self, l.type) * ctx.persona.scopeAffinity)
            : lootValue(self, l.type, taste, ammo);
        // outfits by persona taste, close by and only when it is quiet (brain/outfits.ts)
        if (ctx.features.outfits && isOutfit(l.type)) value = outfitValue(ctx, l.type, d);
        if (value < floor) continue;
        const canReach = below
            ? below.canPathTo(model.nav, self.pos, self.layer, l.pos, l.layer & 1)
            : reachable(ctx, l.pos, 1.4);
        if (!canReach) {
            mem.lootBlacklist.set(l.id, now + 20);
            continue;
        }
        let s = value / (1 + d / 14);
        if (l.id === mem.lootTarget) s *= 1.3;
        // threats: loot in a hot area is worth less
        if (ctx.features.threats) s *= heatPenalty(ctx, l.pos);
        if (s > bestScore) {
            bestScore = s;
            best = { loot: l, value, dist: d };
        }
    }
    return best;
}

export function lootScore(ctx: BrainCtx, choice: LootChoice | null): number {
    if (!choice) return 0;
    let s = 0.22 + 0.5 * (choice.value / 100) * (choice.dist < 20 ? 1 : 20 / choice.dist + 0.2);
    const isGun = !!gunInfo(choice.loot.type);
    if (!ctx.armed && isGun) s = Math.max(s, 0.7);
    // under-armed (best gun C+ or lower): a real gun first (knowledge/desire.ts values it at 88 and more)
    else if (isGun && choice.value >= 88) s = Math.max(s, WEAK_GUN_URGENCY);
    if (ctx.armed) {
        // only a threat halves it (a real gun for an under-armed bot: a quarter off, a pistol fight is the worse bet);
        // an enemy that is merely in view leaves a known upgrade alone (lootRisk.ts)
        const damp = lootDamping(ctx);
        if (damp < 0.5) s *= isGun && choice.value >= 88 ? 0.75 : 0.5;
        else if (damp < 1 && choice.value < UPGRADE_VALUE) s *= damp;
    }
    // an outfit is a short detour that never comes before a fight, a flight, a heal or the zone
    if (ctx.features.outfits && isOutfit(choice.loot.type)) return Math.min(OUTFIT_SCORE, s);
    return Math.min(0.75, s);
}

/** The closest other item the sim would hand over before `l` (in reach, on the bot's floor), or null. */
function closerItem(ctx: BrainCtx, l: SeenLoot, dist: number): SeenLoot | null {
    const me = ctx.self.pos;
    let best: SeenLoot | null = null;
    let bestD = dist;
    for (const o of ctx.model.loot.values()) {
        if (o.id === l.id || (o.layer & 1) !== (l.layer & 1)) continue;
        const d = v2.distance(me, o.pos);
        if (d < bestD && d < 1 + lootRad(o.type)) {
            bestD = d;
            best = o;
        }
    }
    return best;
}

export function planLoot(ctx: BrainCtx, choice: LootChoice): Intent {
    const intent = emptyIntent("loot");
    const { self, mem, now } = ctx;
    const l = choice.loot;
    mem.lootTarget = l.id;
    intent.goal = v2.copy(l.pos);
    intent.arriveDist = 0.6;
    const pickR = 1 + lootRad(l.type) - 0.3;
    // basements: the item's floor guides the path follower, and it is in reach only on the same floor
    let sameFloor = true;
    if (ctx.features.basements) {
        intent.goalLayer = l.layer & 1;
        sameFloor = (self.layer & 1) === (l.layer & 1);
    }
    if (choice.dist < pickR && sameFloor) {
        // in reach: Loot takes the closest item, no need to stand on it (items often rest against obstacles)
        intent.stop = true;
        const isGun = !!gunInfo(l.type);
        const taste = tasteOf(ctx);
        const replace = isGun
            ? slotToReplace(self, taste, l.type, nearOpenedDrop(ctx, l.pos) ? undefined : ammoKnown(ctx))
            : null;
        const sameType = self.weapons.some((w) => w.type === l.type);
        // ... the closest: an unwanted gun lying closer would be taken instead (and replace a gun): step onto the
        // target first so it becomes the closest (pistol-keeping RC6)
        const closer = closerItem(ctx, l, choice.dist);
        let unwanted = !!closer && !!gunInfo(closer.type) && lootValue(self, closer.type, taste, ammoKnown(ctx)) <= 0;
        // (outfits: an outfit the bot does not want lying closer would be put on by accident, LOOT2)
        if (ctx.features.outfits && closer && isOutfit(closer.type)) {
            unwanted ||= outfitValue(ctx, closer.type, 0) <= 0;
        }
        if (unwanted && choice.dist > 0.25) {
            intent.stop = false;
            intent.moveDir = v2.normalizeSafe(v2.sub(l.pos, self.pos));
        } else if (unwanted) {
            // both on the same spot: never press (it would hand over the unwanted one)
            if (mem.lootAttemptId !== l.id) {
                mem.lootAttemptId = l.id;
                mem.lootAttemptAt = now;
            } else if (now - mem.lootAttemptAt > 1.5) mem.lootBlacklist.set(l.id, now + 30);
        } else if (replace !== null && !sameType && self.curWeapIdx !== replace) {
            intent.slot = replace;
        } else if (now - mem.lastLootRequest > 0.3) {
            mem.lastLootRequest = now;
            intent.actions.push(Input.Loot);
            // the gun this pickup drops is not picked up again for a while
            if (replace !== null && !sameType) {
                mem.loot2.swapGuardType = self.weapons[replace]?.type ?? "";
                mem.loot2.swapGuardUntil = now + SWAP_GUARD;
            }
            if (mem.lootAttemptId !== l.id) {
                mem.lootAttemptId = l.id;
                mem.lootAttemptAt = now;
            } else if (now - mem.lootAttemptAt > 1.5) {
                // still there after several tries: refused (full bag, better gear) or out of reach
                mem.lootBlacklist.set(l.id, now + 30);
            }
        }
    }
    addCombatLayer(ctx, intent);
    return intent;
}

interface BuildingSpot {
    id: number;
    pos: Vec2;
    /** MapObjectDefs id (loot potential: brain/sweep.ts) */
    type: string;
}

const buildingCache = new WeakMap<MapData, BuildingSpot[]>();

/** Ground-floor buildings with an interior (a ceiling zoom region), at the centre of their interior. */
export function buildingSpots(map: MapData): BuildingSpot[] {
    let spots = buildingCache.get(map);
    if (spots) return spots;
    spots = [];
    for (const o of map.objects) {
        if (o.layer !== 0 || !hasMapObjectDef(o.type)) continue;
        const def = getMapObjectDef(o.type);
        if (def.type !== "building") continue;
        const zone = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn;
        if (!zone) continue;
        const b = colliderBounds(transformCollider(zone, o.pos, o.ori, o.scale));
        spots.push({ id: o.id, pos: { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }, type: o.type });
    }
    buildingCache.set(map, spots);
    return spots;
}

/** Walk (u) a building's good-gun value is worth (knowledge/buildingValue.ts: a warehouse ~0.8, a shack ~0.2). */
const ROUTE_WEIGHT = 80;

/** The loot-route bonus of building `id` of `type` for this bot: its value x a fixed per-bot spread of 0.6..1.4. */
export function routeBonus(ctx: BrainCtx, id: number, type: string): number {
    const spread = 0.6 + (0.8 * ((((ctx.self.id * 73856093) ^ (id * 19349663)) >>> 0) % 1000)) / 1000;
    return ROUTE_WEIGHT * buildingLootValue(ctx.model.map.mapName, type) * spread;
}

/**
 * The ground component the bot explores from: its own, or underground (basements) the one the stairs of the basement it
 * stands in come up in (the ground cell under an underground bot means nothing).
 */
function exploreComp(ctx: BrainCtx): number {
    const ug = ctx.model.underground;
    if (!ctx.features.basements || ctx.self.layer === 0 || !ug) return ctx.myComp;
    const region = ug.regionAt(ctx.self.pos, 2) ?? ug.portalAt(ctx.self.pos, 1.5)?.region;
    const top = region?.portals.find((p) => p.top)?.top;
    const cell = top ? ctx.model.nav.nearestWalkable(top, 3) : -1;
    return cell >= 0 ? ctx.model.nav.component(cell) : ctx.myComp;
}

function pickExploreGoal(ctx: BrainCtx): Vec2 {
    const { model, self, mem, rng } = ctx;
    let best: Vec2 | null = null;
    let bestId = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    const roam = ctx.persona.roamRadius;
    const comp = exploreComp(ctx);
    // (basements: underground, a building right overhead is not one the bot is in)
    const below = ctx.features.basements && (self.layer & 1) === 1;
    for (const b of buildingSpots(model.map)) {
        if (mem.visited.has(b.id)) continue;
        const d = v2.distance(self.pos, b.pos);
        if (d < 6 && !below) {
            // sweep: visited once swept to the end (brain/sweep.ts marks it)
            if (!sweepPending(ctx, b.id)) mem.visited.add(b.id);
            continue;
        }
        if (d > Math.max(roam, ROAM) || !model.insideSafeZone(b.pos, 5) || nearFailedGoal(ctx, b.pos)) continue;
        if (avoidPos(ctx, b.pos)) continue;
        // the brain's rng draws for today's radius only, so a persona's roam radius never shifts the brain's stream
        // (persona.ts: taste draws come from their own stream); farther buildings get a fixed jitter by id
        const jitter = d <= ROAM ? rng.range(0, 40) : (((b.id * 2654435761) >>> 0) % 1000) * 0.04;
        if (d > roam) continue;
        let cost = d + jitter;
        if (ctx.features.threats) cost += (1 / heatPenalty(ctx, b.pos) - 1) * 40;
        // sweep: loot-rich buildings first (a house or a warehouse is worth a longer walk than an outhouse)
        if (ctx.features.sweep) cost -= 4 * buildingPotential(b.type);
        // report 40: buildings likely to hold good guns first, spread per bot so not everyone stacks on one
        if (ctx.features.lootRoute) cost -= routeBonus(ctx, b.id, b.type);
        if (cost < bestCost) {
            bestCost = cost;
            best = b.pos;
            bestId = b.id;
        }
    }
    if (best) {
        const cell = model.nav.nearestWalkable(best, 6, comp);
        if (cell >= 0) {
            const spot = model.nav.center(cell);
            if (v2.distance(spot, self.pos) >= 4) return spot;
            // the walkable spot nearest an interior the bot cannot get into is where it already stands: picking it
            // again and again kept bots standing at a wall for minutes; that building is done
            mem.visited.add(bestId);
        } else {
            mem.failedGoal = v2.copy(best);
            mem.failedUntil = ctx.now + 30;
        }
    }
    // nothing left to search nearby: wander inside the safe zone
    for (let i = 0; i < 12; i++) {
        const angle = rng.range(0, Math.PI * 2);
        const p = v2.add(self.pos, v2.mul({ x: Math.cos(angle), y: Math.sin(angle) }, rng.range(25, 70)));
        // (danger memory: not back into a place it was just chased out of; evaluation F7, the flee-and-return cycles)
        if (!model.insideSafeZone(p, 5) || avoidPos(ctx, p)) continue;
        const cell = model.nav.nearestWalkable(p, 6, comp);
        if (cell >= 0 && !model.nav.isWaterAt(p)) return model.nav.center(cell);
    }
    return model.gas && model.gas.mode !== "inactive" ? v2.copy(model.gas.posNew) : v2.copy(self.pos);
}

export function planExplore(ctx: BrainCtx): Intent {
    const intent = emptyIntent("explore");
    const { self, mem, now } = ctx;
    const g = mem.exploreGoal;
    const stale =
        !g || now > mem.exploreUntil || v2.distance(self.pos, g) < 4 || nearFailedGoal(ctx, g) || avoidPos(ctx, g);
    if (stale || !g || !ctx.model.insideSafeZone(g, 3)) {
        mem.exploreGoal = pickExploreGoal(ctx);
        mem.exploreUntil = now + 30;
    }
    intent.goal = mem.exploreGoal;
    intent.arriveDist = 2;
    addCombatLayer(ctx, intent);
    return intent;
}
