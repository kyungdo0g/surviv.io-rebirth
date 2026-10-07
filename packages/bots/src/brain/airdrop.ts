// Air drop contesting (BrainFeatures.airdrop): an air drop the bot knows about (perception/airdrops.ts, every brain's
// memory of the map marker, the falling crate and the landed crate; the threat board's drops too) is worth the trip
// when the bot can get there in time: its run (8.5 u/s) takes no longer than the time to the landing plus 15 s
// (persona-scaled), inside the safe zone. The score has a floor that does not shrink with the loadout (the drop holds
// the best loot of the match) but stays below fights, flight and urgent heals. With gunfire around the drop (heat on
// the threat board, the drop's own marker and crush zone left out) or enemies in view, the bot stops in cover 15-25
// units away and scans for 3-6 s; otherwise it walks straight in, staying out of the crush radius until the landing.
// It opens the crate (Use from the server's reach), waits out the opening and breaks the inner crate (the scavenge
// behaviour's planBreak); the loot behaviour picks up what drops. Capped at 45 s from the landing (and given up when
// the bot stops getting closer), then the drop is left alone for a minute. Unarmed bots leave drops alone; in team
// modes a follower goes only for a drop within 30 units of its leader (team.ts onLeash).
//
// Bot overhaul LOOT-7: the old gate saw drops within 120 units only (they land anywhere in the next circle), counted
// the drop's own marker and crush zone as danger (heat 2.4-2.9 against a limit of 3), shrank with the loot need,
// started the cap at the marker, stalled at 1.8 units from the crate (the server takes 2.0) and stopped right after
// Use, so the inner crate was never broken (0/8 drops on HEAD).
import { type Vec2, v2 } from "@rebirth/core";
import { distanceToCollider } from "../geom.ts";
import type { SeenObstacle, WorldModel } from "../perception/world.ts";
import { byThoroughness } from "../persona.ts";
import { addCombatLayer, findCoverFrom } from "./combat.ts";
import { containerValue, isAirdropLoot, NORMAL_SHELL_VALUE } from "./containers.ts";
import { type BrainCtx, emptyIntent, type Intent, reachable, usableSpot } from "./context.ts";
import { lootNeed, planBreak } from "./scavenge.ts";
import { onLeash } from "./team.ts";

const STAND_MIN = 15;
/** The score stays below fights, flight and urgent heals. */
const MAX_SCORE = 0.66;
const STAND_MAX = 25;
const CAP = 45;
const COOLDOWN = 60;
const HOT = 3;
/** Rotation speed through terrain and obstacles (u/s; survival.ts TRAVEL_SPEED). */
const TRAVEL_SPEED = 8.5;
/**
 * Seconds after the landing a run may still take (NEUTRAL; scaled by the persona's thoroughness): from the marker a
 * run of up to ~280 units, once landed ~210 (few players are left by the first drop, so one far off is often still
 * closed; farther, others get there first).
 */
const LATE = 25;
/** The falling crate crushes what is under it (threatTracker CRATE_DANGER_RAD). */
const CRUSH_RAD = 6;
/** Approaching without getting 2 units closer for this long: something is in the way. */
const NO_GAIN = 12;
const CRATE_SCAN_EVERY = 8;
/** Without a known drop, the search runs at most this often. */
const CHECK_EVERY = 1;
/** Heat half-life on the threat board (threatTracker HEAT_TAU) and the oldest event counted. */
const HEAT_TAU = 8;
const HEAT_MAX_AGE = 30;

const crateCache = new WeakMap<WorldModel, { snap: number; crates: SeenObstacle[] }>();

/** Landed air drop crates in view that can still be opened, and inner crates (scanned every few snapshots). */
function cratesInView(model: WorldModel): SeenObstacle[] {
    let entry = crateCache.get(model);
    if (!entry) {
        entry = { snap: Number.NEGATIVE_INFINITY, crates: [] };
        crateCache.set(model, entry);
    }
    // crates are rare and do not move: a look every few snapshots is enough
    if (model.snapshots - entry.snap >= CRATE_SCAN_EVERY || model.snapshots < entry.snap) {
        entry.snap = model.snapshots;
        entry.crates = model.obstacles.filter(
            (o) => !o.view.dead && ((o.def.airdropCrate && !!o.view.button?.canUse) || isAirdropLoot(o)),
        );
    }
    return entry.crates;
}

interface DropChoice {
    pos: Vec2;
    landed: boolean;
    /** estimated game time of the landing (in the past once landed) */
    landsAt: number;
}

/** The air drop to go for: the nearest known one the bot can reach in time, inside the safe zone. */
function chooseDrop(ctx: BrainCtx): DropChoice | null {
    const { model, self, now } = ctx;
    const late = byThoroughness(ctx.persona, LATE, 0.8);
    let best: DropChoice | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    const consider = (pos: Vec2, landed: boolean, landsAt: number) => {
        const d = v2.distance(pos, self.pos);
        // in time: the run takes no longer than the landing plus a little (others get there first otherwise)
        if (d / TRAVEL_SPEED > Math.max(0, landsAt - now) + late) return;
        if (d < bestD && model.insideSafeZone(pos, 5)) {
            bestD = d;
            best = { pos, landed, landsAt };
        }
    };
    for (const a of model.airdrops.open()) consider(a.pos, a.stage === "landed" || a.stage === "opened", a.landsAt);
    for (const a of model.threats.airdrops()) if (a.crateId >= 0) consider(a.pos, a.landed, a.landed ? a.seenAt : now);
    for (const o of cratesInView(model)) consider(o.view.pos, true, now);
    return best;
}

function done(ctx: BrainCtx): void {
    const sm = ctx.mem.smart;
    sm.airdropCooldown = ctx.now + COOLDOWN;
    sm.airdropPos = null;
    sm.airdropSpot = null;
    sm.airdropState = "approach";
}

/**
 * Danger heat around the drop without the drop itself: the threat board's events (gunfire, explosions, kills, pings)
 * and danger zones other than its own marker and crush zone (a lone bot read 2.4-2.9 at its own drop, HOT is 3).
 */
function dropHeat(ctx: BrainCtx, pos: Vec2, r: number): number {
    const board = ctx.model.threats;
    if (!board.events) return board.heat(pos, r);
    let h = 0;
    for (const e of board.events()) {
        if (e.kind === "airdrop") continue;
        const age = ctx.now - e.time;
        const d = v2.distance(e.pos, pos);
        if (age > HEAT_MAX_AGE || d > r) continue;
        h += e.weight * Math.exp(-Math.max(0, age) / HEAT_TAU) * (1 - (0.5 * d) / r);
    }
    for (const z of board.dangerZones()) {
        if (z.kind === "airdrop") continue;
        const d = v2.distance(z.pos, pos);
        if (d < z.rad + r) h += 2 * (z.kind === "airstrike" ? 3 : 2) * (d < z.rad ? 1 : 0.5);
    }
    return h;
}

/** Utility of contesting an air drop now (0..1); 0 keeps the behaviour out of the choice. */
export function airdropScore(ctx: BrainCtx): number {
    const { model, now } = ctx;
    const sm = ctx.mem.smart;
    const lm = ctx.mem.loot2;
    // unarmed: a contested drop is no place to be without a gun (the guns lying around come first)
    if (now < sm.airdropCooldown || model.inGasNow() || !ctx.armed) return 0;
    // nothing known: look again in a moment (air drops are rare)
    if (!sm.airdropPos && now - sm.airdropCheckAt < CHECK_EVERY) return 0;
    sm.airdropCheckAt = now;
    const drop = chooseDrop(ctx);
    if (!drop) {
        if (sm.airdropPos) done(ctx);
        return 0;
    }
    const d = v2.distance(drop.pos, ctx.self.pos);
    if (!sm.airdropPos || v2.distance(sm.airdropPos, drop.pos) > 8) {
        sm.airdropPos = v2.copy(drop.pos);
        // the cap counts from the landing (the 8 s fall used to eat into it)
        sm.airdropSince = Math.max(now, drop.landsAt);
        sm.airdropState = "approach";
        sm.airdropSpot = null;
        lm.dropBest = d;
        lm.dropGainAt = now;
    }
    if (d < lm.dropBest - 2) {
        lm.dropBest = d;
        lm.dropGainAt = now;
    }
    const stuck = sm.airdropState === "approach" && now - lm.dropGainAt > NO_GAIN && d > STAND_MAX + 2;
    if (now - sm.airdropSince > CAP || stuck) {
        done(ctx);
        return 0;
    }
    // team modes: a follower does not wander off alone to a drop
    if (!onLeash(ctx, drop.pos)) return 0;
    const heat = dropHeat(ctx, drop.pos, 20);
    // round 5 (user report 31): what the drop is worth by tier once its crate is in view (a gold shell shows; the inner
    // crate of an opened one tells its tier), a normal shell's mix before that: gold is worth more risk, tier 1 less
    const crate = dropCrate(model, drop.pos);
    const worth = (crate ? containerValue(crate) : NORMAL_SHELL_VALUE) / NORMAL_SHELL_VALUE;
    const watching = ctx.features.thirdparty && sm.tpA !== 0;
    if (heat > HOT * worth && !watching) return 0;
    if ((ctx.assessment?.advantage ?? 0) < -0.3 && ctx.target?.visible) return 0;
    // a floor that does not shrink with the loadout (the best loot of the match), below fights, flight and urgent heals
    const late = Math.max(1, Math.max(0, drop.landsAt - now) + byThoroughness(ctx.persona, LATE, 0.8));
    const s = 0.45 * worth + 0.1 * lootNeed(ctx) - (0.08 * d) / (TRAVEL_SPEED * late) - heat * 0.05;
    return Math.max(0, Math.min(MAX_SCORE, s));
}

/** The crate of the drop in view: the closed crate first, else its inner crate. */
function dropCrate(model: WorldModel, drop: Vec2): SeenObstacle | undefined {
    let inner: SeenObstacle | undefined;
    for (const o of cratesInView(model)) {
        if (v2.distance(o.view.pos, drop) > 6 || o.view.dead) continue;
        if (o.def.airdropCrate) return o;
        inner = o;
    }
    return inner;
}

export function planAirdrop(ctx: BrainCtx): Intent {
    const intent = emptyIntent("airdrop");
    const { model, self, now, rng, mem } = ctx;
    const sm = mem.smart;
    const drop = sm.airdropPos;
    if (!drop) return intent;
    const me = self.pos;
    const d = v2.distance(me, drop);
    intent.lookAt = v2.copy(drop);
    if (sm.airdropState === "approach") {
        // scan only when there is something to see: gunfire around the drop or enemies in view
        const busy = dropHeat(ctx, drop, 20) > 0.5 || ctx.visibleEnemies.some((e) => !e.downed);
        if (!busy) {
            sm.airdropState = d > CRUSH_RAD + 2 || now >= sm.airdropSince ? "loot" : "approach";
            if (sm.airdropState === "approach") intent.stop = true;
        } else {
            if (!sm.airdropSpot) {
                const want = Math.min(STAND_MAX, Math.max(STAND_MIN, d * 0.5));
                const ring = v2.add(drop, v2.mul(v2.normalizeSafe(v2.sub(me, drop)), want));
                sm.airdropSpot =
                    findCoverFrom(model, ring, drop, 8, (p) => {
                        const r = v2.distance(p, drop);
                        return r >= STAND_MIN && r <= STAND_MAX && reachable(ctx, p, 1);
                    }) ?? usableSpot(ctx, ring, 6);
            }
            const spot = sm.airdropSpot;
            if (!spot) {
                done(ctx);
                return intent;
            }
            if (d <= STAND_MAX + 2 || v2.distance(me, spot) < 1.2) {
                sm.airdropState = "scan";
                sm.airdropScanUntil = now + rng.range(3, 6);
            } else {
                intent.goal = v2.copy(spot);
                intent.arriveDist = 1;
            }
        }
    }
    if (sm.airdropState === "scan") {
        intent.stop = true;
        if (now >= sm.airdropScanUntil && now >= sm.airdropSince) sm.airdropState = "loot";
    }
    if (sm.airdropState === "loot") {
        const crate = dropCrate(model, drop);
        const lm = mem.loot2;
        const waiting = lm.openPos !== null && now < lm.openUntil && v2.distance(lm.openPos, drop) < 6;
        if (!crate && !waiting) {
            if (d < 6 || now < sm.airdropSince) {
                // not landed yet: wait outside the crush radius; landed and gone: the loot behaviour takes over
                if (now < sm.airdropSince) {
                    intent.goal = v2.add(drop, v2.mul(v2.normalizeSafe(v2.sub(me, drop)), CRUSH_RAD + 2));
                    intent.arriveDist = 1.5;
                } else done(ctx);
                addCombatLayer(ctx, intent);
                return intent;
            }
            // walk up to it (it comes into view on the way)
            intent.goal = v2.copy(drop);
            intent.arriveDist = 4;
        } else if (crate) {
            // open it, wait out the opening, break the inner crate: the scavenge behaviour's steps
            const value = containerValue(crate);
            const step = planBreak(ctx, { obstacle: crate, value, dist: distanceToCollider(me, crate.col) });
            step.behaviour = "airdrop";
            step.lookAt = intent.lookAt;
            return step;
        } else {
            intent.stop = true;
        }
    }
    addCombatLayer(ctx, intent);
    return intent;
}
