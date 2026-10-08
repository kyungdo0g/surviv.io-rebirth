// Air strikes (BrainFeatures.pursuit, bot overhaul round 3, user report 27: "airstrike variants need bigger avoidance
// from airstrike zones and falling bombs"). Only what a human sees: the red strike circles drawn on the map (the threat
// board's air strike zones, from the snapshot's AirstrikeZoneView list, and the strobe / zone strike markers) and the
// bombs falling on the screen (WorldModel.projectiles). Every distance comes from the data, none is a tuned constant:
// - a zone is dangerous out to its drawn radius (the view's `rad`, which already includes a variant's growth: the
//   heavy-shell variant grows its circle by its larger blast) plus the blast of the bombs its planes drop (planes aim
//   anywhere inside the circle, survev getAirstrikePos, so a bomb at the edge still reaches its blast radius past it:
//   explosion_bomb_iron rad.max 17.5 from GameObjectDefs), less what the variant's marker already adds (round 5:
//   zoneMargin, the carpet marker covers every blast);
// - a falling bomb (a throwable with explodeOnImpact: the iron bomb, and any heavier shell a variant drops) is
//   dangerous out to its own explosion def's rad.max, plus the player's radius and its drift while it falls
//   (GameConfig.airstrike.bombVel, ~1 s of fall).
// Loot, containers and explore goals in a strike (or on a way through one) are left alone (danger.ts avoidPos), the
// flight and the zone rotation do not run into one, and a bot inside one leaves it by the shortest way out that stays
// clear of the others ("evacuate", above every behaviour but the gas), holstered when nobody is in view (13 u/s with
// melee out, 12 with a gun: sim player.ts equip speed).
import { type Vec2, v2 } from "@rebirth/core";
import {
    AIRSTRIKE_VARIANTS,
    type AirstrikeVariant,
    GameConfig,
    GameObjectDefs,
    hasDef,
    WeaponSlot,
} from "@rebirth/defs";
import { distToSegment } from "../geom.ts";
import type { WorldModel } from "../perception/world.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

/**
 * The margin past a zone's drawn radius (round 5, user reports 27 and 32): planes aim anywhere inside the aim radius,
 * so a bomb at its edge reaches its blast past it. The drawn radius is the aim radius plus the variant's zoneRadAdd
 * (defs AIRSTRIKE_VARIANTS), so the margin is the blast of the variant's bomb less that: normal 17.5 - 0, heavy
 * shells 47.5 - 30 (both: aim radius + their own blast), carpet 0 (its marker already covers every blast). It was the
 * iron bomb's blast for every zone. (Blasts x1.25 since the owner's 2026-10-08 strike size: 14 - 0 and 38 - 24 before.)
 */
function zoneMargin(variant: AirstrikeVariant | undefined): number {
    const v = AIRSTRIKE_VARIANTS[variant ?? "normal"];
    return Math.max(0, blastRadius(v.bombType) - v.zoneRadAdd);
}
const PLAYER_RAD = GameConfig.player.radius;
/** A falling bomb drifts along its plane's heading at bombVel u/s for about a second before it lands. */
const BOMB_DRIFT = GameConfig.airstrike.bombVel;
/** Scores: inside a strike circle; under a falling bomb (the gas in full 0.97, the gas 0.93: brain/survival.ts). */
const ZONE_SCORE = 0.9;
const BOMB_SCORE = 0.96;
/** Leaving: aim this far past the edge; the danger counts this much larger while leaving (no edge flicker). */
const EXIT_PAST = 3;
const LEAVING_PAD = 2;
/** Exit directions tried, off the straight way out from the centre (radians). */
const EXIT_TRIES = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2, Math.PI];

const blastCache = new Map<string, number>();

/** rad.max of the explosion a throwable makes (0 when it makes none): explosion_bomb_iron 17.5. */
export function blastRadius(type: string): number {
    const hit = blastCache.get(type);
    if (hit !== undefined) return hit;
    let rad = 0;
    if (hasDef(type)) {
        const t = GameObjectDefs[type] as { explosionType?: string };
        if (t.explosionType && hasDef(t.explosionType)) {
            rad = (GameObjectDefs[t.explosionType] as { rad?: { max: number } }).rad?.max ?? 0;
        }
    }
    blastCache.set(type, rad);
    return rad;
}

/** Whether a projectile type is a bomb that explodes where it lands (air strike bombs: not a thrown grenade). */
export function isFallingBomb(type: string): boolean {
    if (!hasDef(type)) return false;
    const t = GameObjectDefs[type] as { type?: string; explodeOnImpact?: boolean };
    return t.type === "throwable" && t.explodeOnImpact === true && blastRadius(type) > 0;
}

/** One strike danger: a circle to stay out of until `until`. */
export interface StrikeDanger {
    pos: Vec2;
    rad: number;
    until: number;
    bomb: boolean;
    /** a strobe's strike (marker or thrown strobe, perception/strobes.ts): stepped out of, never detoured round */
    strobe?: boolean;
}

interface Cached {
    time: number;
    zones: readonly unknown[];
    zoneCount: number;
    projectiles: readonly unknown[];
    list: StrikeDanger[];
}

/** Built once per snapshot (the board rebuilds its zone list, the model replaces its projectile list, every snapshot). */
const cache = new WeakMap<WorldModel, Cached>();

/** The strike dangers the bot knows of now: drawn strike circles (with the bombs' blast) and falling bombs. */
export function strikeDangers(ctx: BrainCtx): readonly StrikeDanger[] {
    if (!ctx.features.pursuit) return [];
    const model = ctx.model;
    const zones = model.threats.dangerZones();
    const hit = cache.get(model);
    if (
        hit &&
        hit.time === model.time &&
        hit.zones === zones &&
        hit.zoneCount === zones.length &&
        hit.projectiles === model.projectiles
    )
        return hit.list;
    const list: StrikeDanger[] = [];
    const now = ctx.now;
    for (const z of zones) {
        if (z.kind !== "airstrike" || now >= z.until) continue;
        // (bot round 6) a strobe's danger already holds its bombs' blast (perception/strobes.ts)
        if (z.strobe) list.push({ pos: z.pos, rad: z.rad, until: z.until, bomb: false, strobe: true });
        else list.push({ pos: z.pos, rad: z.rad + zoneMargin(z.variant), until: z.until, bomb: false });
    }
    for (const p of model.projectiles) {
        if (!isFallingBomb(p.type)) continue;
        list.push({ pos: p.pos, rad: blastRadius(p.type) + PLAYER_RAD + BOMB_DRIFT, until: now + 1, bomb: true });
    }
    cache.set(model, { time: model.time, zones, zoneCount: zones.length, projectiles: model.projectiles, list });
    return list;
}

/** Whether `p` lies in a strike danger (`pad` units larger). */
export function inStrike(ctx: BrainCtx, p: Vec2, pad = 0): boolean {
    for (const d of strikeDangers(ctx)) if (v2.distance(p, d.pos) < d.rad + pad) return true;
    return false;
}

/**
 * Whether a goal at `p` should be left alone for the strikes: in one, or the straight way there crosses one the bot is
 * not already in (one it stands in it is leaving anyway; the goal itself must still be outside). A strobe's strike only
 * keeps goals out of it: bots never detour for strobes (bot round 6).
 */
export function strikeBlocks(ctx: BrainCtx, p: Vec2): boolean {
    const me = ctx.self.pos;
    for (const d of strikeDangers(ctx)) {
        if (v2.distance(p, d.pos) < d.rad) return true;
        if (!d.strobe && v2.distance(me, d.pos) >= d.rad && distToSegment(d.pos, me, p) < d.rad) return true;
    }
    return false;
}

/** The dangers the bot stands in (larger by LEAVING_PAD while it is already leaving). */
function around(ctx: BrainCtx): StrikeDanger[] {
    const pad = ctx.mem.current === "evacuate" ? LEAVING_PAD : 0;
    const me = ctx.self.pos;
    return strikeDangers(ctx).filter((d) => v2.distance(me, d.pos) < d.rad + pad);
}

/** Utility of getting out of an air strike (BrainFeatures.pursuit). */
export function strikeScore(ctx: BrainCtx): number {
    if (!ctx.features.pursuit) return 0;
    const inside = around(ctx);
    if (!inside.length) return 0;
    return inside.some((d) => d.bomb) ? BOMB_SCORE : ZONE_SCORE;
}

/** How far along unit `dir` from `p` the circle (c, r) ends (0 when `p` is outside it). */
function exitDistance(p: Vec2, dir: Vec2, c: Vec2, r: number): number {
    const m = v2.sub(p, c);
    const b = v2.dot(m, dir);
    const k = v2.dot(m, m) - r * r;
    if (k >= 0) return 0;
    return -b + Math.sqrt(b * b - k);
}

/** The way out of the strikes the bot stands in: the nearest walkable point past their edge, clear of the others. */
export function planEvacuate(ctx: BrainCtx): Intent {
    const intent = emptyIntent("evacuate");
    const { model, self } = ctx;
    const me = self.pos;
    const inside = around(ctx);
    // away from the centres, the deeper inside the more
    let away = { x: 0, y: 0 };
    for (const d of inside) {
        const depth = Math.max(0.1, d.rad - v2.distance(me, d.pos)) * (d.bomb ? 4 : 1);
        away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(me, d.pos)), depth));
    }
    if (v2.lengthSqr(away) < 1e-9) away = v2.normalizeSafe(v2.sub(model.gas?.posNew ?? me, me));
    if (v2.lengthSqr(away) < 1e-9) away = { x: 1, y: 0 };
    away = v2.normalizeSafe(away);
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const a of EXIT_TRIES) {
        const dir = a === 0 ? away : v2.rotate(away, a);
        let out = 0;
        for (const d of inside) out = Math.max(out, exitDistance(me, dir, d.pos, d.rad + LEAVING_PAD));
        const raw = v2.add(me, v2.mul(dir, out + EXIT_PAST));
        const cell = model.nav.nearestWalkable(raw, 4, ctx.myComp);
        if (cell < 0) continue;
        const p = model.nav.center(cell);
        if (inStrike(ctx, p)) continue;
        // the safe zone matters less than the bombs, but an exit into the gas costs more
        const cost = v2.distance(me, p) + (model.insideSafeZone(p) ? 0 : 15) + Math.abs(a) * 2;
        if (cost < bestCost) {
            bestCost = cost;
            best = p;
        }
    }
    if (best) {
        intent.goal = best;
        intent.arriveDist = 1.5;
    } else {
        intent.moveDir = away;
    }
    // nobody to shoot: the melee out runs faster (the combat layer draws the gun again for a target in reach)
    if (!ctx.visibleEnemies.some((e) => !e.downed)) intent.slot = WeaponSlot.Melee;
    addCombatLayer(ctx, intent);
    return intent;
}
