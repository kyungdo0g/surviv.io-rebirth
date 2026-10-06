// Air drop contesting (BrainFeatures.airdrop): an air drop the bot knows about (ThreatBoard.airdrops: map indicator,
// plane, falling crate; or a landed crate in view) is worth the trip when the bot still needs loot, the trade looks
// fine and it lies within 120 units in the safe zone. The bot does not run straight onto it: it stops in cover 15-25
// units away, scans the area for 3-6 s (players drawn to the drop show up), then goes for the crate (opening it with
// the break behaviour's Use). It skips a drop with a lot of threat heat around it, unless it means to third-party the
// fight there. Capped at 45 s per drop, then the drop is left alone for a minute.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { colliderCenter, colliderRadius, distanceToCollider } from "../geom.ts";
import type { SeenObstacle, WorldModel } from "../perception/world.ts";
import { addCombatLayer, findCoverFrom } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, reachable, usableSpot } from "./context.ts";
import { lootNeed } from "./scavenge.ts";

const MAX_DIST = 120;
const STAND_MIN = 15;
const STAND_MAX = 25;
const CAP = 45;
const COOLDOWN = 60;
const HOT = 3;
const CRATE_SCAN_EVERY = 8;
/** Without a known drop, the search runs at most this often. */
const CHECK_EVERY = 1;

const crateCache = new WeakMap<WorldModel, { snap: number; crates: SeenObstacle[] }>();

/** Landed air drop crates in view that can still be opened (scanned every few snapshots). */
function cratesInView(model: WorldModel): SeenObstacle[] {
    let entry = crateCache.get(model);
    if (!entry) {
        entry = { snap: Number.NEGATIVE_INFINITY, crates: [] };
        crateCache.set(model, entry);
    }
    // crates are rare and do not move: a look every few snapshots is enough
    if (model.snapshots - entry.snap >= CRATE_SCAN_EVERY || model.snapshots < entry.snap) {
        entry.snap = model.snapshots;
        entry.crates = model.obstacles.filter((o) => o.def.airdropCrate && !o.view.dead && !!o.view.button?.canUse);
    }
    return entry.crates;
}

/** The air drop to go for: the nearest known one in reach inside the safe zone. */
function chooseDrop(ctx: BrainCtx): { pos: Vec2; crateId: number; landed: boolean } | null {
    const { model, self } = ctx;
    const found: { best: { pos: Vec2; crateId: number; landed: boolean } | null; d: number } = {
        best: null,
        d: MAX_DIST,
    };
    const consider = (pos: Vec2, crateId: number, landed: boolean) => {
        const d = v2.distance(pos, self.pos);
        if (d < found.d && model.insideSafeZone(pos, 5)) {
            found.d = d;
            found.best = { pos, crateId, landed };
        }
    };
    for (const a of model.threats.airdrops()) consider(a.pos, a.crateId, a.landed);
    for (const o of cratesInView(model)) consider(colliderCenter(o.col), o.view.id, true);
    return found.best;
}

function done(ctx: BrainCtx): void {
    const sm = ctx.mem.smart;
    sm.airdropCooldown = ctx.now + COOLDOWN;
    sm.airdropPos = null;
    sm.airdropSpot = null;
    sm.airdropState = "approach";
}

/** Utility of contesting an air drop now (0..1); 0 keeps the behaviour out of the choice. */
export function airdropScore(ctx: BrainCtx): number {
    const { model, now } = ctx;
    const sm = ctx.mem.smart;
    if (now < sm.airdropCooldown || model.inGasNow()) return 0;
    // nothing known: look again in a moment (air drops are rare)
    if (!sm.airdropPos && now - sm.airdropCheckAt < CHECK_EVERY) return 0;
    sm.airdropCheckAt = now;
    const drop = chooseDrop(ctx);
    if (!drop) {
        if (sm.airdropPos) done(ctx);
        return 0;
    }
    if (!sm.airdropPos || v2.distance(sm.airdropPos, drop.pos) > 8) {
        sm.airdropPos = v2.copy(drop.pos);
        sm.airdropSince = now;
        sm.airdropState = "approach";
        sm.airdropSpot = null;
    }
    if (now - sm.airdropSince > CAP) {
        done(ctx);
        return 0;
    }
    const heat = model.threats.heat(drop.pos, 20);
    const watching = ctx.features.thirdparty && sm.tpA !== 0;
    if (heat > HOT && !watching) return 0;
    if ((ctx.assessment?.advantage ?? 0) < -0.3 && ctx.target?.visible) return 0;
    const d = v2.distance(drop.pos, ctx.self.pos);
    const s = 0.3 + 0.35 * lootNeed(ctx) - d / 600 - heat * 0.05;
    return Math.max(0, Math.min(0.66, s));
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
    if (sm.airdropState === "scan") {
        intent.stop = true;
        const crateUp = chooseDrop(ctx)?.landed ?? false;
        if (now >= sm.airdropScanUntil && crateUp) sm.airdropState = "loot";
    }
    if (sm.airdropState === "loot") {
        const crate = cratesInView(model)[0];
        if (!crate && d < 6) {
            // opened (or taken): the loot behaviour picks up what dropped
            done(ctx);
            return intent;
        }
        const reach = crate ? (crate.def.button?.interactionRad ?? 1) + 1 - 0.2 : 0;
        if (crate && distanceToCollider(me, crate.col) < reach) {
            // air drop crates open with Use within their interaction radius
            intent.stop = true;
            if (now - mem.lastUseObstacle > 0.5) {
                mem.lastUseObstacle = now;
                intent.actions.push(Input.Use);
            }
        } else {
            // walk up to the crate's side facing the bot (its centre is inside the obstacle)
            const at = crate ? colliderCenter(crate.col) : drop;
            const r = crate ? colliderRadius(crate.col) * (crate.col.type === 1 ? 0.75 : 1) : 0;
            const side = v2.add(at, v2.mul(v2.normalizeSafe(v2.sub(me, at)), r + 1));
            const cell = model.nav.nearestWalkable(side, 3, ctx.myComp);
            intent.goal = cell >= 0 ? model.nav.center(cell) : side;
            intent.arriveDist = 0.8;
        }
    }
    addCombatLayer(ctx, intent);
    return intent;
}
