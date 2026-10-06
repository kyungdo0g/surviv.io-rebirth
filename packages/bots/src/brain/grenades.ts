// Grenades: a frag worth throwing now, at an enemy hiding behind cover or a group of enemies, within throwing range.
// The smart brain (BrainFeatures.grenades) also lands frags just behind the cover an enemy hides at, throws at an
// enemy last seen going into a building (under its roof, out of sight), and punishes an enemy healing behind cover.
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { colliderCenter, colliderRadius, pointInBounds, segmentHits } from "../geom.ts";
import { roofRegions } from "../perception/roofs.ts";
import type { WorldModel } from "../perception/world.ts";
import { FRAG_TYPES } from "./combat.ts";
import type { BrainCtx, ThrowPlan } from "./context.ts";

/** A grenade worth throwing now: at an enemy hiding behind cover or a group of enemies, within throwing range. */
export function grenadeOpportunity(ctx: BrainCtx, thinkDt: number): ThrowPlan | null {
    const { self, now, mem, params, rng } = ctx;
    if (now - mem.lastThrow < 6 || self.action.type !== "none") return null;
    const item = FRAG_TYPES.find((it) => (self.inventory[it] ?? 0) > 0);
    if (!item) return null;
    const t = ctx.target;
    if (!t) return null;
    const d = ctx.targetDist;
    // the frag's blast reaches 12 units (explosion_frag rad.max): never closer than 10
    if (d < 10 || d > 27) return null;
    const hiding = !t.visible && now - t.lastSeen < 2.5;
    const behindCover = t.visible && !ctx.model.lineOfFire(self.pos, t.pos);
    let cluster = 0;
    for (const e of ctx.enemies) if (e !== t && e.visible && v2.distance(e.pos, t.pos) < 6) cluster++;
    if (!hiding && !behindCover && cluster === 0 && !t.downed) return null;
    // a group, or an enemy camping behind its cover, is the best moment for a grenade
    const camping = v2.length(t.vel) < 2 && (hiding || behindCover);
    const boost = (cluster > 0 ? 2 : 1) * (camping ? 2 : 1);
    if (!rng.bool(Math.min(1, params.grenadeRate * thinkDt * boost))) return null;
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(t.pos);
    // lead a moving target a little (at most 3 units: velocity estimates are noisy)
    let lead = v2.mul(t.vel, 0.6);
    if (v2.length(lead) > 3) lead = v2.mul(v2.normalize(lead), 3);
    return { item, pos: v2.add(t.pos, lead), cook: rng.range(1.2, 2.2) };
}

const roofCaches = new WeakMap<WorldModel, { cache: Map<number, Bounds[]>; sig: number; roofs: Bounds[] }>();

/** A cheap signature of the buildings in view (which ones, and which roofs fell): roofs change only with it. */
function buildingSignature(model: WorldModel): number {
    let sig = model.buildings.length;
    for (const b of model.buildings) sig = (sig * 31 + b.id * (b.ceilingDead ? 7 : 3)) % 2147483647;
    return sig;
}

/** Whether `p` lies under a standing roof (inside a building, hidden from outside). */
export function underRoof(model: WorldModel, p: Vec2): boolean {
    let entry = roofCaches.get(model);
    if (!entry) {
        entry = { cache: new Map(), sig: -1, roofs: [] };
        roofCaches.set(model, entry);
    }
    const sig = buildingSignature(model);
    if (entry.sig !== sig) {
        entry.sig = sig;
        entry.roofs = roofRegions(model.buildings, entry.cache).flatMap((r) => r.regions);
    }
    for (const b of entry.roofs) if (pointInBounds(p, b)) return true;
    return false;
}

/** Where a frag lands best against an enemy hiding at `t`: 1.5 units behind the obstacle between, when it hugs it. */
export function behindCoverPoint(model: WorldModel, from: Vec2, t: Vec2): Vec2 {
    const dir = v2.normalizeSafe(v2.sub(t, from));
    let best: Vec2 | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const o of model.obstacles) {
        if (!o.blocksBullets || !segmentHits(o.col, from, t)) continue;
        const c = colliderCenter(o.col);
        const d = v2.distance(c, t);
        if (d < bestD) {
            bestD = d;
            best = v2.add(c, v2.mul(dir, colliderRadius(o.col) * (o.col.type === 1 ? 0.75 : 1) + 1.5));
        }
    }
    return best && v2.distance(best, t) < 4 ? best : v2.copy(t);
}

/** Smart frags (BrainFeatures.grenades): behind cover, into buildings, at healers behind cover. */
export function smartGrenade(ctx: BrainCtx, thinkDt: number): ThrowPlan | null {
    const { self, now, mem, params, rng, model } = ctx;
    if (now - mem.lastThrow < 5 || self.action.type !== "none") return null;
    const item = FRAG_TYPES.find((it) => (self.inventory[it] ?? 0) > 0);
    const t = ctx.target;
    if (!item || !t) return null;
    const d = ctx.targetDist;
    // the frag's blast reaches 12 units (explosion_frag rad.max): never closer than 10
    if (d < 10 || d > 27) return null;
    const busy = model.intel.of(t.id).action;
    const covered = t.visible && !model.lineOfFire(self.pos, t.pos);
    const hiding = !t.visible && now - t.lastSeen < 2.5;
    const indoors = !t.visible && now - t.lastSeen < 4 && underRoof(model, t.pos);
    let cluster = 0;
    for (const e of ctx.enemies) if (e !== t && e.visible && v2.distance(e.pos, t.pos) < 6) cluster++;
    if (!hiding && !covered && !indoors && cluster === 0 && !t.downed) return null;
    const camping = v2.length(t.vel) < 2 && (hiding || covered);
    let boost = (cluster > 0 ? 2 : 1) * (camping ? 2 : 1);
    if (indoors) boost *= 2;
    if (covered && (busy === "use" || busy === "revive" || t.reviving)) boost *= 3;
    if (!rng.bool(Math.min(1, params.grenadeRate * thinkDt * boost))) return null;
    let pos: Vec2;
    if (covered || hiding) pos = behindCoverPoint(model, self.pos, t.pos);
    else {
        let lead = v2.mul(t.vel, 0.6);
        if (v2.length(lead) > 3) lead = v2.mul(v2.normalize(lead), 3);
        pos = v2.add(t.pos, lead);
    }
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(pos);
    return { item, pos, cook: rng.range(1.2, 2.2) };
}
