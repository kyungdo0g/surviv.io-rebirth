// Blasting a gate open (BrainFeatures.gateBreach; the owner's wave 3, 2026-10-10: "a bunker only strong firepower like
// the M202 can open", "an abandoned subway station: strong firepower must blast its door"). Explosion-gated obstacles
// (defs ObstacleDef.explosionGate: blast_door_01, subway_gate_01; sim combat.ts passesExplosionGate) take only an
// explosion's own hit, of the listed explosion ids; the blast door counts hits (`hitsToOpen`, the owner, 2026-10-11: one
// M202 rocket, two NLAW rounds or six RPG-7 rockets, mixed rounds adding up their shares). The routing never plans
// through them (nav/breakThrough.ts). A player who carries the right launcher and wants in shoots the gate, so:
// - an intermediate or expert bot (a seeded share by tier: GOER), with a launcher whose round opens the gate and rounds
//   enough to finish it, sees the gate standing on its screen within the round's reach. On a hit-counted gate the
//   rounds needed come from the health it last saw (the shares left) and it spends the cheapest ammo that finishes the
//   door: the launcher needing the most hits (RPG-7 rockets from the bag first, then NLAWs, the single-use M202 last).
//   One NLAW is no start on a fresh door (it needs two and holds one), only on a door already half open;
// - nobody threatening it in view and the zone not pressing; it fires at most MAX_TRIES volleys without seeing the gate
//   take a hit before it gives the gate a rest (COOLDOWN);
// - it stands off beyond the blast (the launcher's minimum distance plus slack), with a line of fire to the gate's
//   face, and fires, waiting out an RPG-7's reload there; once the snapshot shows the gate gone the navigation opens
//   and its basement trip may take it in.

import { type Collider, type Vec2, v2 } from "@rebirth/core";
import { hasDef, type ObstacleDef } from "@rebirth/defs";
import { gateTotalShares, type MapData } from "@rebirth/sim";
import { colliderCenter, obstacleCollider, obstacleDef } from "../geom.ts";
import type { HeldGun } from "../knowledge/arsenal.ts";
import { type LauncherSpec, launcherSpec } from "../knowledge/launchers.ts";
import { type BrainCtx, emptyIntent, type Intent, usableSpot } from "./context.ts";
import { underThreat } from "./lootRisk.ts";
import { zonePressure } from "./survival.ts";

/** The share of bots of each tier that blast a gate open when they can (beginners never think of it). */
const GOER: Readonly<Record<"beginner" | "intermediate" | "expert", number>> = {
    beginner: 0,
    intermediate: 0.5,
    expert: 0.9,
};
const GOER_SALT = 0x51ed27a3;
/** The behaviour's utility (above exploring, below the basement trip it leads to and anything urgent). */
const SCORE = 0.2;
/** Stand this much beyond the launcher's minimum distance. */
const STAND_SLACK = 2;
/** Never with the zone pressing harder than this (basement.ts ZONE_LIMIT). */
const ZONE_LIMIT = 0.3;
/**
 * Volleys at one gate without seeing it take a hit before it is given a rest of COOLDOWN seconds, beyond the rounds the
 * launcher needs to open it (the door often lies just off the screen at the stand-off spot: its health is not seen).
 */
const MAX_TRIES = 3;
const COOLDOWN = 60;
/** The near face of the gate is checked for a line of fire this far in front of it (barrelShot.ts SURFACE_GAP). */
const SURFACE_GAP = 0.1;

interface BreachMemory {
    /** gate id -> volleys fired at it since it last took a hit, and when it may be tried again */
    tries: Map<number, number>;
    restUntil: Map<number, number>;
    /** gate id -> the health it showed when last seen (ObstacleView.healthT), and at the last volley */
    health: Map<number, number>;
    volleyHealth: Map<number, number>;
    /** gate id -> the gun it fired its last volley at the gate with (kept while it holds rounds: gateLauncher) */
    committed: Map<number, string>;
    /** the gate being fired at (0: none), the launcher held at it (slot, gun id) and its rounds at the last look */
    gate: number;
    lastSlot: number;
    lastGun: string;
    lastMag: number;
}

const memory = new WeakMap<object, BreachMemory>();

function mem(ctx: BrainCtx): BreachMemory {
    let m = memory.get(ctx.mem);
    if (!m) {
        m = {
            tries: new Map(),
            restUntil: new Map(),
            health: new Map(),
            volleyHealth: new Map(),
            committed: new Map(),
            gate: 0,
            lastSlot: -1,
            lastGun: "",
            lastMag: -1,
        };
        memory.set(ctx.mem, m);
    }
    return m;
}

/** A unit number from the bot's seed and a salt (deterministic; no rng stream touched). */
function unit(seed: number, salt: number): number {
    let h = Math.imul((seed ^ salt) >>> 0, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** The point of a box or circle collider nearest `p`. */
function nearestPoint(col: Collider, p: Vec2): Vec2 {
    if (col.type === 0) return v2.add(col.pos, v2.mul(v2.normalizeSafe(v2.sub(p, col.pos)), col.rad));
    return { x: Math.min(Math.max(p.x, col.min.x), col.max.x), y: Math.min(Math.max(p.y, col.min.y), col.max.y) };
}

/** Whether a round of `spec` opens a gate with `gate` (its explosion listed in `hitsToOpen` or `explosionTypes`). */
export function launcherOpens(spec: LauncherSpec, gate: NonNullable<ObstacleDef["explosionGate"]>): boolean {
    if (!spec.explosion || !hasDef(spec.explosion)) return false;
    if (gate.hitsToOpen) return (gate.hitsToOpen[spec.explosion] ?? 0) > 0;
    return !gate.explosionTypes || gate.explosionTypes.includes(spec.explosion);
}

/**
 * Rounds of `spec` still needed to open a hit-counted gate showing `healthT` (the shares left, sim combat.ts
 * gateHitShare: an explosion listed with n takes total / n shares), or 1 for a gate that counts damage (any round
 * may do).
 */
export function roundsToOpen(spec: LauncherSpec, gate: NonNullable<ObstacleDef["explosionGate"]>, healthT: number) {
    const n = gate.hitsToOpen?.[spec.explosion] ?? 0;
    if (!gate.hitsToOpen || n <= 0) return 1;
    const total = gateTotalShares(gate.hitsToOpen);
    // the health travels quantized: round to whole shares
    const left = Math.max(1, Math.round(healthT * total));
    return Math.ceil(left / (total / n));
}

/**
 * The launcher to open `gate` with, or null: one whose round opens it and that holds rounds enough (magazine plus bag)
 * to finish it. On a hit-counted gate the cheapest ammo first: the launcher needing the most hits (RPG-7 6 > NLAW 2 >
 * M202 1), so the single-use M202 is kept for a fight; otherwise the first loaded one. The launcher the bot already
 * fired at the gate (`committed`) is kept while it holds a round: its rounds in flight do not show on the door yet.
 */
export function gateLauncher(
    guns: readonly HeldGun[],
    gate: NonNullable<ObstacleDef["explosionGate"]>,
    healthT: number,
    committed = "",
): { gun: HeldGun; spec: LauncherSpec } | null {
    let best: { gun: HeldGun; spec: LauncherSpec } | null = null;
    let bestHits = 0;
    for (const gun of guns) {
        const spec = launcherSpec(gun.info.id);
        if (!spec || !launcherOpens(spec, gate)) continue;
        if (gate.hitsToOpen && gun.info.id === committed && gun.mag + gun.reserve > 0) return { gun, spec };
        if (!gate.hitsToOpen) {
            if (gun.mag > 0) return { gun, spec };
            continue;
        }
        if (gun.mag + gun.reserve < roundsToOpen(spec, gate, healthT)) continue;
        const hits = gate.hitsToOpen[spec.explosion] ?? 0;
        if (hits > bestHits) {
            best = { gun, spec };
            bestHits = hits;
        }
    }
    return best;
}

interface Gate {
    id: number;
    def: ObstacleDef;
    col: Collider;
    center: Vec2;
    layer: number;
}

const gateCache = new WeakMap<MapData, Gate[]>();

/** The map's explosion-gated obstacles (map knowledge: where the bunker's door and the subway's shutter stand). */
function mapGates(map: MapData): Gate[] {
    let gates = gateCache.get(map);
    if (gates) return gates;
    gates = [];
    for (const o of map.objects) {
        const def = obstacleDef(o.type);
        if (!def?.explosionGate) continue;
        const col = obstacleCollider(def, o.pos, o.ori, o.scale);
        gates.push({ id: o.id, def, col, center: colliderCenter(col), layer: o.layer });
    }
    gateCache.set(map, gates);
    return gates;
}

/**
 * The gate the bot can blast now with its launcher, or null. Where the gates stand is map knowledge (from the stand-off
 * distance the door may lie just off the screen's short side); whether one still stands is what the bot last saw of it:
 * one seen destroyed is forgotten.
 */
function breachTarget(ctx: BrainCtx): { gate: Gate; spec: LauncherSpec; slot: number } | null {
    const tier = ctx.skill.tier;
    if (unit(ctx.mem.puzzle.seed, GOER_SALT) >= GOER[tier]) return null;
    const m = mem(ctx);
    const me = ctx.self.pos;
    const gates = mapGates(ctx.model.map);
    for (const g of gates) {
        const seen = ctx.model.obstacleById.get(g.id);
        if (seen?.view.dead) m.restUntil.set(g.id, Number.POSITIVE_INFINITY);
        if (seen) m.health.set(g.id, seen.view.healthT);
    }
    noteVolley(ctx, m, gates);
    let best: { gate: Gate; spec: LauncherSpec; slot: number } | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const g of gates) {
        if ((g.layer & 1) !== (ctx.self.layer & 1) || ctx.now < (m.restUntil.get(g.id) ?? Number.NEGATIVE_INFINITY))
            continue;
        const gate = g.def.explosionGate;
        const l = gate ? gateLauncher(ctx.guns, gate, m.health.get(g.id) ?? 1, m.committed.get(g.id)) : null;
        if (!l) continue;
        const d = v2.distance(me, g.center);
        if (d > SEE_RANGE || d >= bestD) continue;
        bestD = d;
        best = { gate: g, spec: l.spec, slot: l.gun.slot };
    }
    return best;
}

/**
 * A volley went at the gate being fired at (the launcher held at it lost rounds since the last look): commit to that
 * launcher (its rounds in flight do not show on the door yet) and count the volley unless the gate was seen taking a hit
 * since the last one; the gate rests after the rounds it needs plus MAX_TRIES - 1 volleys without a hit seen.
 */
function noteVolley(ctx: BrainCtx, m: BreachMemory, gates: readonly Gate[]): void {
    const id = m.gate;
    if (!id) return;
    const gun = ctx.guns.find((g) => g.slot === m.lastSlot && g.info.id === m.lastGun);
    if (!gun) {
        m.gate = 0;
        return;
    }
    if (m.lastMag >= 0 && gun.mag < m.lastMag) {
        const health = m.health.get(id) ?? 1;
        const hit = health < (m.volleyHealth.get(id) ?? 1) - 1e-6;
        const n = (hit ? 0 : (m.tries.get(id) ?? 0)) + 1;
        m.tries.set(id, n);
        m.volleyHealth.set(id, health);
        m.committed.set(id, gun.info.id);
        const gate = gates.find((g) => g.id === id)?.def.explosionGate;
        const spec = launcherSpec(gun.info.id);
        const needed = gate && spec ? roundsToOpen(spec, gate, health) : 1;
        if (n >= needed + MAX_TRIES - 1) {
            m.restUntil.set(id, ctx.now + COOLDOWN);
            m.tries.set(id, 0);
        }
    }
    m.lastMag = gun.mag;
}

/** A gate is taken on within this distance (about a screen: the bot has walked up to it). */
const SEE_RANGE = 32;

/** Utility of blasting a gate open now (see the header). */
export function breachScore(ctx: BrainCtx): number {
    if (ctx.self.layer !== 0 || underThreat(ctx) || zonePressure(ctx.model) > ZONE_LIMIT) return 0;
    return breachTarget(ctx) ? SCORE : 0;
}

/** Off to the stand-off spot, then one volley at the gate's face. */
export function planBreach(ctx: BrainCtx): Intent {
    const intent = emptyIntent("breach");
    const t = breachTarget(ctx);
    if (!t) return intent;
    const m = mem(ctx);
    const me = ctx.self.pos;
    const id = t.gate.id;
    const aim = t.gate.center;
    const stand = t.spec.minDist + STAND_SLACK;
    const d = v2.distance(me, aim);
    const near = nearestPoint(t.gate.col, me);
    const front = v2.add(near, v2.mul(v2.normalizeSafe(v2.sub(me, near)), SURFACE_GAP));
    const clear = d <= t.spec.range * 0.9 && ctx.model.lineOfFire(me, front);
    intent.lookAt = v2.copy(aim);
    if (d < stand || !clear) {
        // back off along the line from the gate (or round to a clear line): the stand-off spot facing it
        const out = v2.add(aim, v2.mul(v2.normalizeSafe(v2.sub(me, aim), { x: 1, y: 0 }), stand + 1));
        const spot = usableSpot(ctx, out, 3);
        m.gate = 0;
        if (spot) {
            intent.goal = spot;
            intent.arriveDist = 0.8;
        } else {
            m.restUntil.set(id, ctx.now + COOLDOWN);
        }
        return intent;
    }
    // at the gate with the launcher: its volleys are counted from here (noteVolley)
    const gun = ctx.guns.find((g) => g.slot === t.slot);
    if (m.gate !== id || m.lastSlot !== t.slot || m.lastGun !== (gun?.info.id ?? "")) {
        m.gate = id;
        m.lastSlot = t.slot;
        m.lastGun = gun?.info.id ?? "";
        m.lastMag = gun?.mag ?? -1;
    }
    intent.stop = true;
    intent.slot = t.slot;
    intent.aim = v2.copy(aim);
    // an empty RPG-7 reloads by itself (sim weaponManager scheduledReload): wait it out at the stand-off spot
    intent.fire = ctx.self.curWeapIdx === t.slot && (gun?.mag ?? 0) > 0;
    return intent;
}
