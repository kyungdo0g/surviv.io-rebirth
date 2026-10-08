// What the bot knows about loot containers (bot overhaul LOOT-3/5/7): which ones its melee can break (armour- and
// stone-plated crates need a piercing melee: sim combat.ts canDamageObstacle), how far its melee reaches, which
// containers it can see (furniture under the roof of a building it is not in is hidden, like the players and loot
// there: perception/roofs.ts; furniture it saw from inside is remembered), the value of a container's loot table (the
// inner crate of an air drop holds the best loot of the match), where to stand to punch one and how long the rest of
// it takes (LOOT2). With BrainFeatures.basements, containers on the bot's own floor: underground the ones of the
// basement it stands in, on that floor's grid (nav/underground.ts).
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import {
    AIRDROP_TIER_SPLITS,
    GameConfig,
    GameObjectDefs,
    hasDef,
    hasMapObjectDef,
    MapObjectDefs,
    type MeleeDef,
    WeaponSlot,
} from "@rebirth/defs";
import { colliderCenter, pointInBounds } from "../geom.ts";
import type { GunInfo } from "../knowledge/weapons.ts";
import { type CellGrid, sameLayer } from "../nav/cellGrid.ts";
import { roofRegions } from "../perception/roofs.ts";
import type { SeenObstacle, SelfState, WorldModel } from "../perception/world.ts";
import { type BrainCtx, reachable } from "./context.ts";

const PLAYER_RAD = GameConfig.player.radius;
/**
 * Value of the inner crate of an air drop (tier_airdrop_* loot: the best guns, armour and scopes of the match): today's
 * normal drop (crate_10, tier_airdrop_uncommon), which is the rebirth tier 2 drop (crate_10t2: tier_airdrop_tier2).
 */
export const AIRDROP_LOOT_VALUE = 88;
/**
 * Round 5 (user reports 31, 33): air drops by tier, gold > tier 2 > tier 1. The gold crate (crate_11*, and crate_12 /
 * crate_13 that roll tier_airdrop_rare or tier_airdrop_mythic) holds the M249 / PKP / AWM-S family; a tier 1 crate
 * (crate_10t1 / crate_10svt1: tier_airdrop_tier1) holds the low-tier DMRs and SPAS-12, on woods a MIRV or a strobe in
 * about a third of its gun rolls.
 */
export const AIRDROP_GOLD_VALUE = 96;
export const AIRDROP_TIER1_VALUE = 80;
/** Value of an unopened air drop crate whose contents the bot cannot tell (a class pod, an event shell). */
export const AIRDROP_VALUE = 80;
/** An unopened shell is worth its expected inner crate less this (it still has to be opened and broken). */
const SHELL_DISCOUNT = 8;
/** A normal shell's tier is unknown until it opens (same type id on the wire): the even mix of tier 1 and tier 2. */
const NORMAL_SHELL_TIER1_SHARE = 0.5;
/** Worth of a normal shell (and of a drop whose crate the bot has not seen yet: most drops are normal ones). */
export const NORMAL_SHELL_VALUE =
    NORMAL_SHELL_TIER1_SHARE * AIRDROP_TIER1_VALUE +
    (1 - NORMAL_SHELL_TIER1_SHARE) * AIRDROP_LOOT_VALUE -
    SHELL_DISCOUNT;

/** Worth of an air drop's inner crate from its loot tiers: gold, tier 2 (today's normal drop), tier 1; else null. */
export function airdropInnerValue(tiers: readonly string[]): number | null {
    if (tiers.some((t) => t === "tier_airdrop_rare" || t === "tier_airdrop_mythic")) return AIRDROP_GOLD_VALUE;
    if (tiers.some((t) => t === "tier_airdrop_tier1")) return AIRDROP_TIER1_VALUE;
    if (tiers.some((t) => t === "tier_airdrop_tier2" || t === "tier_airdrop_uncommon")) return AIRDROP_LOOT_VALUE;
    return tiers.some((t) => t.startsWith("tier_airdrop")) ? AIRDROP_LOOT_VALUE : null;
}

/**
 * Worth of an unopened air drop shell: a gold shell shows (its own type, airdrop_crate_02*: the gold-trimmed crate); a
 * normal shell that splits into tiers (defs AIRDROP_TIER_SPLITS) is the even mix of tier 1 and tier 2.
 */
function shellValue(o: SeenObstacle): number {
    if (Object.hasOwn(AIRDROP_TIER_SPLITS, o.view.type)) return NORMAL_SHELL_VALUE;
    const inner = (o.def as { destroyType?: string }).destroyType;
    const def =
        inner && hasMapObjectDef(inner)
            ? (MapObjectDefs[inner] as { loot?: Array<{ tier?: string; type?: string }> })
            : undefined;
    const value = def?.loot ? airdropInnerValue(def.loot.map((l) => l.tier ?? l.type ?? "")) : null;
    return value === null ? AIRDROP_VALUE : value - SHELL_DISCOUNT;
}

/** Rough worth of a container's loot table (0..100). */
export function containerValue(o: SeenObstacle): number {
    // air drops hold the best loot of the match (by tier: round 5)
    if (o.def.airdropCrate) return shellValue(o);
    const tiers = o.def.loot.map((l) => l.tier ?? l.type ?? "");
    // the crate an opened air drop leaves (crate_10..13: tier_airdrop_* tables; it scored 12 and was never broken)
    const inner = airdropInnerValue(tiers);
    if (inner !== null) return inner;
    if (tiers.some((t) => t === "tier_soviet" || t === "tier_chest" || t === "deagle" || t === "m870")) return 45;
    if (tiers.some((t) => t === "tier_world" || t === "tier_container" || t === "tier_toilet")) return 32;
    if (tiers.some((t) => t === "tier_throwables" || t.startsWith("tier_vending"))) return 18;
    if (tiers.some((t) => t.startsWith("tier_ammo"))) return 15;
    return 12;
}

/** Whether the container holds an air drop's loot (its inner crate). */
export function isAirdropLoot(o: SeenObstacle): boolean {
    return o.def.loot.some((l) => (l.tier ?? "").startsWith("tier_airdrop"));
}

/** The bot's melee def (fists when none). */
export function meleeDef(self: SelfState): MeleeDef {
    const id = self.weapons[WeaponSlot.Melee]?.type || "fists";
    const def = hasDef(id) ? GameObjectDefs[id] : undefined;
    return (def?.type === "melee" ? def : GameObjectDefs.fists) as MeleeDef;
}

/**
 * Reach of the bot's melee from its centre to an obstacle's surface: the swing circle's offset plus its radius (sim
 * weapons/melee.ts meleeCollider: fists 1.35 + 0.9), less 0.2 of slack for the aim; fists 2.05 (it was a fixed 2).
 */
export function meleeReach(self: SelfState): number {
    const a = meleeDef(self).attack;
    return a.offset.x + a.rad - 0.2;
}

/** Plated containers only break to a piercing melee (sim combat.ts canDamageObstacle); bullets never break them. */
export function plated(o: SeenObstacle): boolean {
    return !!o.def.armorPlated || !!o.def.stonePlated;
}

/** Whether the bot's melee can break `o` (plating needs armorPiercing, stone plating stonePiercing). */
export function meleeBreaks(self: SelfState, o: SeenObstacle): boolean {
    const m = meleeDef(self) as MeleeDef & { armorPiercing?: boolean; stonePiercing?: boolean };
    if (o.def.armorPlated && !m.armorPiercing) return false;
    if (o.def.stonePlated && !m.stonePiercing) return false;
    return true;
}

/** Obstacles lower than this are not hit by a swing (GameConfig.player.meleeHeight; sim weapons/melee.ts). */
const MELEE_HEIGHT = GameConfig.player.meleeHeight;
/** Obstacles whose position is farther than this from the swing circle are not checked (the largest colliders). */
const SWING_SCAN = 12;
/** Swing directions checked around the aim (radians): the human motor's cursor wobbles by about 10 degrees. */
const SWING_WOBBLE = [0, 0.21, -0.21];
/** The attack cycle of a melee is at least this long for a bot (its trigger does not click every cooldown). */
const MELEE_CYCLE_MIN = 0.4;

/**
 * Seconds the bot needs to break `o` from the health it shows now (ObstacleView.healthT x the def's health, what the
 * client knows), hitting it with `gun` (bullet damage x obstacleDamage x pellets per cycle) or its melee.
 */
export function finishSeconds(o: SeenObstacle, self: SelfState, gun?: GunInfo): number {
    const left = o.view.healthT * o.def.health;
    let perHit: number;
    let cycle: number;
    if (gun) {
        const bullet = hasDef(gun.def.bulletType)
            ? (GameObjectDefs[gun.def.bulletType] as { obstacleDamage?: number })
            : {};
        perHit = gun.damage * (bullet.obstacleDamage ?? 1) * Math.max(1, gun.def.bulletCount);
        cycle = gun.cycle;
    } else {
        const m = meleeDef(self);
        perHit = m.damage * m.obstacleDamage;
        cycle = Math.max(MELEE_CYCLE_MIN, m.attack.cooldownTime);
    }
    return Math.ceil(left / Math.max(1, perHit)) * cycle;
}

/** Reach of Use on an air drop crate: the server tests interactionRad + the player's radius (sim interact.ts). */
export function useReach(o: SeenObstacle): number {
    return (o.def.button?.interactionRad ?? 1) + PLAYER_RAD - 0.05;
}

/** Closest point of the container's collider to `p`. */
export function closestPoint(o: SeenObstacle, p: Vec2): Vec2 {
    const col = o.col;
    if (col.type === 0) return v2.add(col.pos, v2.mul(v2.normalizeSafe(v2.sub(p, col.pos)), col.rad));
    return { x: Math.min(Math.max(p.x, col.min.x), col.max.x), y: Math.min(Math.max(p.y, col.min.y), col.max.y) };
}

/** A point just outside the container's surface towards `p` (a line to it does not end inside the container). */
export function nearSurface(o: SeenObstacle, p: Vec2): Vec2 {
    const c = closestPoint(o, p);
    return v2.add(c, v2.mul(v2.normalizeSafe(v2.sub(p, c)), 0.3));
}

/** Distance from a container's centre to its surface along the unit direction `u` (box: its support function). */
function extentAlong(o: SeenObstacle, u: Vec2): number {
    const col = o.col;
    if (col.type === 0) return col.rad;
    return Math.abs(u.x) * (col.max.x - col.min.x) * 0.5 + Math.abs(u.y) * (col.max.y - col.min.y) * 0.5;
}

/** Offsets of the stand spots from the surface: a damaged container shrinks (sim entities.ts) but the navigation
 * grid keeps its spawn-size footprint plus clearance, so the nearest offsets fall inside it on a broken-in crate. */
const STAND_OFFSETS = [1.5, 2.25, 3];

/**
 * Spots to stand on to punch the container: of the eight spots 1.5 units off its surface around it (a little further
 * where the grid still blocks the spot), the walkable, reachable ones with nothing between them and the container
 * (furniture and toilets stand in rooms: the spot outside the room's wall is useless), cheapest first (the distance
 * from the bot, more when it cannot see the spot). The last steps from there go straight in (scavenge.ts).
 */
export function standSpots(ctx: BrainCtx, o: SeenObstacle): Vec2[] {
    const me = ctx.self.pos;
    const model = ctx.model;
    const c = colliderCenter(o.col);
    // (basements: an underground container's spots lie on its floor's grid)
    const grid = containerGrid(ctx, o);
    if (!grid) return [];
    const out: Array<{ p: Vec2; cost: number }> = [];
    for (let k = 0; k < 8; k++) {
        const u = { x: Math.cos((k * Math.PI) / 4), y: Math.sin((k * Math.PI) / 4) };
        const ext = extentAlong(o, u);
        let p: Vec2 | null = null;
        for (const off of STAND_OFFSETS) {
            const q = v2.add(c, v2.mul(u, ext + off));
            if (grid.walkableAt(q)) {
                p = q;
                break;
            }
        }
        if (!p || !reachableOn(ctx, p, 1, o.view.layer)) continue;
        if (!model.lineOfFire(p, nearSurface(o, p))) continue;
        out.push({ p, cost: v2.distance(me, p) + (model.lineOfFire(me, p) ? 0 : 6) });
    }
    out.sort((a, b) => a.cost - b.cost);
    return out.map((x) => x.p);
}

/** Signed distance from `p` to a collider's surface (negative inside). */
function signedDistance(p: Vec2, col: SeenObstacle["col"]): number {
    if (col.type === 0) return v2.distance(p, col.pos) - col.rad;
    const dx = Math.max(col.min.x - p.x, 0, p.x - col.max.x);
    const dy = Math.max(col.min.y - p.y, 0, p.y - col.max.y);
    if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
    return -Math.min(p.x - col.min.x, col.max.x - p.x, p.y - col.min.y, col.max.y - p.y);
}

/**
 * Whether a punch thrown from `p` at the container does not go into plating or a wall: the sim's swing hits only the
 * obstacle its circle overlaps most (sim weapons/melee.ts meleeDamage sorts by penetration), so a plated crate or a
 * wall pressed against the target took every blow from some sides and the container was given up at 68% (LOOT2); a
 * breakable crate in between is broken on the way. Uses only what the client knows (the obstacles on its screen).
 */
export function swingLands(ctx: BrainCtx, o: SeenObstacle, p: Vec2): boolean {
    const a = meleeDef(ctx.self).attack;
    const u = v2.normalizeSafe(v2.sub(closestPoint(o, p), p));
    const layer = ctx.self.layer & 1;
    // the cursor wobbles around its aim point (motor noise): the punch must land a little either side of it too
    for (const turn of SWING_WOBBLE) {
        const dir = v2.rotate(u, turn);
        const c = v2.add(p, v2.mul(dir, a.offset.x));
        const mine = a.rad - signedDistance(c, o.col);
        if (mine <= 0) return false;
        for (const x of ctx.model.obstacles) {
            // (the sim's swing does not ask whether the obstacle is collidable: a bush takes a punch too)
            if (x === o || x.view.dead || x.def.height < MELEE_HEIGHT || !sameLayer(x.view.layer, layer)) continue;
            if (Math.abs(x.view.pos.x - c.x) > SWING_SCAN || Math.abs(x.view.pos.y - c.y) > SWING_SCAN) continue;
            // a breakable neighbour taking the blow is fine (it breaks and opens the way); plating or a wall is not
            if (a.rad - signedDistance(c, x.col) >= mine && !(x.def.destructible && meleeBreaks(ctx.self, x))) {
                return false;
            }
        }
    }
    return true;
}

/** Nothing stops the bot from walking straight at the container (its own collider aside). */
export function clearApproach(ctx: BrainCtx, o: SeenObstacle): boolean {
    return ctx.model.lineOfFire(ctx.self.pos, nearSurface(o, ctx.self.pos));
}

interface RoofView {
    snap: number;
    /** zoomIn regions of the roofs over someone else's head (the bot is not under them) */
    hidden: Bounds[];
    /** zoomIn regions of the building the bot stands in */
    inside: Bounds[];
}

const roofViews = new WeakMap<WorldModel, RoofView>();
const roofCaches = new WeakMap<WorldModel, Map<number, Bounds[]>>();

function roofView(model: WorldModel): RoofView {
    let v = roofViews.get(model);
    if (v && v.snap === model.snapshots) return v;
    let cache = roofCaches.get(model);
    if (!cache) {
        cache = new Map();
        roofCaches.set(model, cache);
    }
    const me = model.self.pos;
    v = { snap: model.snapshots, hidden: [], inside: [] };
    for (const r of roofRegions(model.buildings, cache)) {
        const under = r.regions.some((b) => pointInBounds(me, b));
        for (const b of r.regions) (under ? v.inside : v.hidden).push(b);
    }
    roofViews.set(model, v);
    return v;
}

/**
 * Whether the bot can see container `o`: not under the roof of a building it is not in (the original client draws the
 * ceiling over the furniture; bots used to target drawers and toilets through the walls from outside and stall at the
 * wall: lazy-loot missed cause 1). Furniture seen from inside stays known after the bot walked out.
 */
export function containerVisible(ctx: BrainCtx, o: SeenObstacle): boolean {
    // basements: underground no ceiling hides anything (the client covers the ground floor with the underground fill)
    if (ctx.features.basements && (ctx.self.layer & 1) === 1) return (o.view.layer & 1) === 1;
    const v = roofView(ctx.model);
    const c = colliderCenter(o.col);
    const id = o.view.id;
    const seenInside = ctx.mem.loot2.seenInside;
    if (v.inside.some((b) => pointInBounds(c, b))) {
        seenInside.add(id);
        return true;
    }
    if (!v.hidden.some((b) => pointInBounds(c, b))) return true;
    return seenInside.has(id);
}

/**
 * Whether a container (or anything) on `layer` is on the bot's floor: the ground floor only without basements (the
 * bot walks back up from anywhere else), else the floor it stands on (stairs: the floor of their half).
 */
export function onBotFloor(ctx: BrainCtx, layer: number): boolean {
    if (!ctx.features.basements) return (layer & 1) === 0;
    return (layer & 1) === (ctx.self.layer & 1);
}

/** The navigation grid of the floor container `o` stands on: the ground grid, or (basements) its underground grid. */
export function containerGrid(ctx: BrainCtx, o: SeenObstacle): CellGrid | null {
    if (!ctx.features.basements || (o.view.layer & 1) === 0) return ctx.model.nav;
    return ctx.model.underground?.regionAt(o.view.pos, 2) ?? null;
}

/** context.ts reachable for a point on the floor `layer` (basements: underground points through the stairs). */
export function reachableOn(ctx: BrainCtx, p: Vec2, slack: number, layer: number): boolean {
    if (!ctx.features.basements || (layer & 1) === 0) return reachable(ctx, p, slack);
    const ug = ctx.model.underground;
    const grid = ug?.regionAt(p, 2);
    if (!ug || !grid) return false;
    const cell = grid.nearestWalkable(p, slack);
    return cell >= 0 && ug.canPathTo(ctx.model.nav, ctx.self.pos, ctx.self.layer, grid.center(cell), 1);
}
