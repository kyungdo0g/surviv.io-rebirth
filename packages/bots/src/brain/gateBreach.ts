// Blasting a gate open (BrainFeatures.gateBreach; the owner's wave 3, 2026-10-10: "a bunker only strong firepower like
// the M202 can open", "an abandoned subway station: strong firepower must blast its door"). Explosion-gated obstacles
// (defs ObstacleDef.explosionGate: blast_door_01, subway_gate_01; sim combat.ts passesExplosionGate) take only an
// explosion's own hit, of the listed explosion ids and at least `minDamage` in one hit; the routing never plans
// through them (nav/breakThrough.ts). A player who carries the right launcher and wants in shoots the gate, so:
// - an intermediate or expert bot (a seeded share by tier: GOER), with a loaded launcher whose round opens the gate
//   (its explosion id listed, its centre hit at least minDamage: only the M202 opens the blast door, an RPG never
//   does), sees the gate standing on its screen within the round's reach;
// - nobody threatening it in view and the zone not pressing; it tries a gate a few times at most (MAX_TRIES volleys)
//   and gives one it could not hit a rest (COOLDOWN);
// - it stands off beyond the blast (the launcher's minimum distance plus slack), with a line of fire to the gate's
//   face, and fires; once the snapshot shows the gate gone the navigation opens and its basement trip may take it in.

import { type Collider, type Vec2, v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef, type ObstacleDef } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";
import { colliderCenter, obstacleCollider, obstacleDef } from "../geom.ts";
import type { LauncherSpec } from "../knowledge/launchers.ts";
import { type BrainCtx, emptyIntent, type Intent, usableSpot } from "./context.ts";
import { loadedLauncher } from "./launch.ts";
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
/** Volleys at one gate before it is given a rest of COOLDOWN seconds. */
const MAX_TRIES = 3;
const COOLDOWN = 60;
/** The near face of the gate is checked for a line of fire this far in front of it (barrelShot.ts SURFACE_GAP). */
const SURFACE_GAP = 0.1;

interface BreachMemory {
    /** gate id -> volleys fired at it, and when it may be tried again */
    tries: Map<number, number>;
    restUntil: Map<number, number>;
    /** the gate being breached, and the launcher round count when the last volley went */
    gate: number;
    lastMag: number;
}

const memory = new WeakMap<object, BreachMemory>();

function mem(ctx: BrainCtx): BreachMemory {
    let m = memory.get(ctx.mem);
    if (!m) {
        m = { tries: new Map(), restUntil: new Map(), gate: 0, lastMag: -1 };
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

/** Whether a round of `spec` opens a gate with `gate` (its explosion listed; its centre hit at least minDamage). */
export function launcherOpens(spec: LauncherSpec, gate: NonNullable<ObstacleDef["explosionGate"]>): boolean {
    if (!spec.explosion || !hasDef(spec.explosion)) return false;
    if (gate.explosionTypes && !gate.explosionTypes.includes(spec.explosion)) return false;
    const e = GameObjectDefs[spec.explosion] as { damage?: number; obstacleDamage?: number };
    return (e.damage ?? 0) * (e.obstacleDamage ?? 1) >= (gate.minDamage ?? 0);
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
    const l = loadedLauncher(ctx);
    if (!l) return null;
    const m = mem(ctx);
    const me = ctx.self.pos;
    let best: { gate: Gate; spec: LauncherSpec; slot: number } | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const g of mapGates(ctx.model.map)) {
        const seen = ctx.model.obstacleById.get(g.id);
        if (seen?.view.dead) m.restUntil.set(g.id, Number.POSITIVE_INFINITY);
        if ((g.layer & 1) !== (ctx.self.layer & 1) || ctx.now < (m.restUntil.get(g.id) ?? Number.NEGATIVE_INFINITY))
            continue;
        if (!g.def.explosionGate || !launcherOpens(l.spec, g.def.explosionGate)) continue;
        const d = v2.distance(me, g.center);
        if (d > SEE_RANGE || d >= bestD) continue;
        bestD = d;
        best = { gate: g, spec: l.spec, slot: l.gun.slot };
    }
    return best;
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
        if (spot) {
            intent.goal = spot;
            intent.arriveDist = 0.8;
        } else {
            m.restUntil.set(id, ctx.now + COOLDOWN);
        }
        return intent;
    }
    // a volley went (the magazine dropped since the last look): count it, rest the gate after MAX_TRIES
    const gun = ctx.guns.find((g) => g.slot === t.slot);
    if (m.gate === id && gun && m.lastMag >= 0 && gun.mag < m.lastMag) {
        const n = (m.tries.get(id) ?? 0) + 1;
        m.tries.set(id, n);
        if (n >= MAX_TRIES) {
            m.restUntil.set(id, ctx.now + COOLDOWN);
            m.tries.set(id, 0);
        }
    }
    m.gate = id;
    m.lastMag = gun?.mag ?? -1;
    intent.stop = true;
    intent.slot = t.slot;
    intent.aim = v2.copy(aim);
    intent.fire = ctx.self.curWeapIdx === t.slot;
    return intent;
}
