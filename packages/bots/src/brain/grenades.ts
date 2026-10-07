// Grenades: a frag worth throwing now, at an enemy hiding behind cover or a group of enemies, within throwing range.
// The smart brain (BrainFeatures.grenades) also lands frags just behind the cover an enemy hides at, throws at an
// enemy last seen going into a building (under its roof, out of sight), and punishes an enemy healing behind cover.
// Human gates (bot overhaul COMBAT-11, both brains; diagnosis round 1 issue 2 RC2: a throw could start 0.15 s after
// the first sighting, before the bot could even shoot): the bot must have reacted to the target (the first-shot
// reaction clock), a covered or hiding target must have been out of the line of fire for a second, and a clear, loaded
// shot at a target in the open beats throwing at its group; no frag is started with any standing enemy within 8 units
// (Bot breaks a started one off at that distance). When planFight decided to throw at a covered target this
// think (CombatMemory.throwNow), the per-think roll is skipped: the throw starts now instead of being waited for.
// Round 3 (user reports 24, 27): distances come from the frag's blast in the defs (brain/fragMath.ts), and the cook is
// computed (fuse - flight - a human margin) and only used with a reason: the target behind cover (a burst in the air
// over low cover, landing behind tall cover), denying a revive or heal, denying a push (smart: an enemy rushing in
// while the bot has no clear loaded shot); the reason goes to the decision trace (CombatMemory.trace).
// Round 4 (user report 30), smart only, all through DifficultyParams.frag (fragSkill.ts): the engagement's recall roll
// (beginners forget their frags), the wait behind cover before a frag goes (coverWait: beginners throw late), the
// craft that scales the deliberate throws (push and revive denial, buildings, bursts over low cover instead of plain
// throws), wasted frags at enemies in the open or out of reach, the path check (walls and trees a frag would bounce
// off: a point beside them, or no throw) and the hand's error (short, wide); the persona's caution or boldness scales
// push denial and cover flushing. The longest throw and the group radius come from the defs (user report 32).
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { colliderCenter, colliderRadius, pointInBounds, segmentHits } from "../geom.ts";
import { currentGun } from "../knowledge/arsenal.ts";
import { segmentHitsCollider } from "../perception/rays.ts";
import { roofRegions } from "../perception/roofs.ts";
import type { Contact, WorldModel } from "../perception/world.ts";
import { bodyShot, FRAG_TYPES, noteCover, reactedTo } from "./combat.ts";
import type { BrainCtx, ThrowPlan } from "./context.ts";
import {
    airburstPoint,
    airReach,
    type CookReason,
    cookFor,
    fragGroupRadius,
    fragMaxDist,
    fragMinDist,
    fragNoThrowNear,
} from "./fragMath.ts";
import {
    boldTaste,
    cautionTaste,
    checksPath,
    clearAirburst,
    clearLanding,
    handError,
    recallsFrags,
    wastesFrag,
} from "./fragSkill.ts";

/** A covered or hiding target must have been out of the line of fire this long before a frag goes at it. */
const MIN_COVER_TIME = 1;
const COOLDOWN = 6;
const SMART_COOLDOWN = 5;
/** Frags are thrown at most this far (a full-strength throw lands about 30 units out: 27 for the frag). */
const FRAG_MAX = fragMaxDist("frag");
/** Enemies this close to the target share its blast (the frag's full-damage radius plus 1: 6). */
const GROUP = fragGroupRadius("frag");
/** A beginner's wasted frag goes at an enemy up to this far (beyond the longest throw: it falls short). */
const WASTE_FAR = 40;
/** Obstacles this low or lower let a frag fly over them and do not stop its blast (sim explosions BLOCK_HEIGHT). */
const LOW_COVER = 0.5;
/** Denying a push (smart): an enemy closing in at least this fast (u/s), from PUSH_MIN to PUSH_MAX units. */
const PUSH_SPEED = 4;
const PUSH_MIN = 14;
const PUSH_MAX = 24;

/** The frag type the bot would throw (the first in the bag), "frag" when none. */
function fragItem(ctx: BrainCtx): string {
    return FRAG_TYPES.find((it) => (ctx.self.inventory[it] ?? 0) > 0) ?? "frag";
}

/** A standing enemy the bot sees within the frag's no-throw distance (8 for the frag): a frag now is at melee range. */
export function enemyClose(ctx: BrainCtx, item = fragItem(ctx)): boolean {
    const near = fragNoThrowNear(item);
    for (const e of ctx.visibleEnemies) if (!e.downed && v2.distance(e.pos, ctx.self.pos) < near) return true;
    return false;
}

/**
 * A frag plan at `pos` for `reason` with the computed cook (fragMath.ts cookFor); an air burst is aimed past the
 * target so the faster throw is over it in the air when the fuse ends. Records the decision in the combat trace.
 * `checked` (round 4: the bot looked at the path, fragSkill.ts checksPath) keeps that path in ThrowPlan.check.
 */
export function fragPlan(ctx: BrainCtx, item: string, pos: Vec2, reason: CookReason, checked = false): ThrowPlan {
    const me = ctx.self.pos;
    // smart (round 4): the hand's error (DifficultyParams.frag: short and wide by skill)
    let aim = ctx.features.grenades ? handError(ctx, item, pos) : v2.copy(pos);
    let mode: "land" | "air" = "land";
    let burst = aim;
    if (reason === "airburst") {
        // the hand's error does not push an air burst the bot can reach beyond its reach (it throws at full strength)
        const reach = airReach(item) - 0.01;
        if (v2.distance(me, aim) > reach && v2.distance(me, pos) <= reach)
            aim = v2.add(me, v2.mul(v2.normalize(v2.sub(aim, me)), reach));
        const p = airburstPoint(item, me, aim);
        if (p) {
            burst = aim;
            aim = p;
            mode = "air";
        } else reason = "cover";
    }
    const plan = cookFor(ctx, item, v2.distance(me, pos), reason, mode);
    ctx.mem.fight.planReason = plan.reason;
    const off = v2.distance(aim, pos);
    ctx.mem.fight.trace.add(
        ctx.now,
        "cook",
        `${plan.reason} cook ${plan.cook.toFixed(2)} flight ${plan.flight.toFixed(2)} fuse ${plan.fuse} d ${v2.distance(me, pos).toFixed(1)}${mode === "land" && off > 0.05 ? ` off ${off.toFixed(1)}` : ""}`,
    );
    const out: ThrowPlan = { item, pos: aim, cook: plan.cook };
    if (checked) out.check = { to: mode === "air" ? burst : aim, mode };
    return out;
}

/** Why a frag at a covered or hiding `t` is cooked: a revive or heal to deny, low cover to burst over, else cover. */
function coverReason(ctx: BrainCtx, t: Contact, covered: boolean): CookReason {
    const busy = ctx.model.intel.of(t.id).action;
    if (t.reviving || busy === "revive" || busy === "use") return "revive";
    if (!covered) return "cover";
    // the cover between: low (a stone, a crate) lets the frag fly over it and burst above the target
    let low = false;
    for (const o of ctx.model.obstacles) {
        if (!o.blocksBullets || !segmentHitsCollider(o.col, ctx.self.pos, t.pos)) continue;
        if (o.def.height > LOW_COVER) return "cover";
        low = true;
    }
    return low ? "airburst" : "cover";
}

/** The bot holds a loaded gun with a clear line to some of `t`'s body. */
function clearShot(ctx: BrainCtx, t: Contact): boolean {
    const g = currentGun(ctx.self, ctx.guns);
    return t.visible && !!g && g.mag > 0 && bodyShot(ctx, t) !== null;
}

/**
 * The human gates of a frag at a covered or hiding `t` (COMBAT-11): a frag in the bag, no action running, the throw
 * cooldown over, the bot reacted to the target, and the target behind cover (whole body) or out of sight for a second.
 */
export function fragGates(
    ctx: BrainCtx,
    t: Contact,
    cooldown: number = ctx.features.grenades ? SMART_COOLDOWN : COOLDOWN,
): boolean {
    const { self, now, mem } = ctx;
    if (now - mem.lastThrow < cooldown || self.action.type !== "none" || enemyClose(ctx)) return false;
    if (!FRAG_TYPES.some((it) => (self.inventory[it] ?? 0) > 0) || !reactedTo(ctx, t)) return false;
    const since = noteCover(ctx, t, !t.visible || bodyShot(ctx, t) === null);
    // smart (round 4): the wait follows the game sense (frag.coverWait: beginners throw late, experts early)
    return now - since >= (ctx.features.grenades ? ctx.params.frag.coverWait : MIN_COVER_TIME);
}

/** A grenade worth throwing now: at an enemy hiding behind cover or a group of enemies, within throwing range. */
export function grenadeOpportunity(ctx: BrainCtx, thinkDt: number): ThrowPlan | null {
    const { self, now, mem, params, rng } = ctx;
    if (now - mem.lastThrow < COOLDOWN || self.action.type !== "none" || enemyClose(ctx)) return null;
    const item = FRAG_TYPES.find((it) => (self.inventory[it] ?? 0) > 0);
    if (!item) return null;
    const t = ctx.target;
    if (!t) return null;
    const d = ctx.targetDist;
    // never inside the blast (the frag's rad.max less 2: 10 units), at most a long throw
    if (d < fragMinDist(item) || d > FRAG_MAX) return null;
    const hiding = !t.visible && now - t.lastSeen < 2.5;
    const behindCover = t.visible && bodyShot(ctx, t) === null;
    let cluster = 0;
    for (const e of ctx.enemies) if (e !== t && e.visible && v2.distance(e.pos, t.pos) < GROUP) cluster++;
    if (!hiding && !behindCover && cluster === 0 && !t.downed) return null;
    // in the open with a loaded gun on it: shoot, do not throw at its group
    if (!hiding && !behindCover && clearShot(ctx, t)) return null;
    if (!reactedTo(ctx, t) || ((hiding || behindCover) && !fragGates(ctx, t, COOLDOWN))) return null;
    // a group, or an enemy camping behind its cover, is the best moment for a grenade
    const camping = v2.length(t.vel) < 2 && (hiding || behindCover);
    const boost = (cluster > 0 ? 2 : 1) * (camping ? 2 : 1);
    const decided = mem.fight.throwNow === now;
    if (!decided && !rng.bool(Math.min(1, params.grenadeRate * thinkDt * boost))) return null;
    // lead a moving target a little (at most 3 units: velocity estimates are noisy)
    let lead = v2.mul(t.vel, 0.6);
    if (v2.length(lead) > 3) lead = v2.mul(v2.normalize(lead), 3);
    const reason = hiding || behindCover ? coverReason(ctx, t, behindCover) : "none";
    const plan = fragPlan(ctx, item, v2.add(t.pos, lead), reason);
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(plan.pos);
    return plan;
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

/**
 * Smart frags (BrainFeatures.grenades): behind cover, into buildings, at healers behind cover, in front of a push; by
 * the bot's craft (round 4, fragSkill.ts): forgotten for a whole engagement, wasted on enemies in the open or out of
 * reach, thrown plainly (no burst over low cover) or past a wall in the way, short and wide by the hand's skill.
 */
export function smartGrenade(ctx: BrainCtx, thinkDt: number): ThrowPlan | null {
    const { self, now, mem, params, rng, model } = ctx;
    if (now - mem.lastThrow < SMART_COOLDOWN || self.action.type !== "none" || enemyClose(ctx)) return null;
    const item = FRAG_TYPES.find((it) => (self.inventory[it] ?? 0) > 0);
    const t = ctx.target;
    if (!item || !t) return null;
    const d = ctx.targetDist;
    // never inside the blast (the frag's rad.max less 2: 10 units); beyond a long throw only a beginner's waste
    if (d < fragMinDist(item) || d > WASTE_FAR) return null;
    if (!recallsFrags(ctx, t.id)) return null;
    if (d > FRAG_MAX) return wasteFrag(ctx, item, t, d, thinkDt);
    const push = pushToDeny(ctx, t, d, thinkDt);
    if (push) return push;
    const craft = params.frag.craft;
    const busy = model.intel.of(t.id).action;
    const covered = t.visible && bodyShot(ctx, t) === null;
    const hiding = !t.visible && now - t.lastSeen < 2.5;
    const indoors = !t.visible && now - t.lastSeen < 4 && underRoof(model, t.pos);
    let cluster = 0;
    for (const e of ctx.enemies) if (e !== t && e.visible && v2.distance(e.pos, t.pos) < GROUP) cluster++;
    const open = !hiding && !covered && !indoors;
    // in the open, alone, or with a loaded gun on it: shoot, do not throw at its group (a beginner may throw anyway)
    if (open && ((cluster === 0 && !t.downed) || clearShot(ctx, t))) return wasteFrag(ctx, item, t, d, thinkDt);
    if (!reactedTo(ctx, t) || (!open && !fragGates(ctx, t, SMART_COOLDOWN))) return null;
    const camping = v2.length(t.vel) < 2 && (hiding || covered);
    let boost = (cluster > 0 ? 2 : 1) * (camping ? 2 : 1);
    if (indoors) boost *= 1 + craft;
    if (covered && (busy === "use" || busy === "revive" || t.reviving)) boost *= 1 + 2 * craft;
    if (!open) boost *= boldTaste(ctx.persona);
    const decided = mem.fight.throwNow === now;
    if (!decided && !rng.bool(Math.min(1, params.grenadeRate * thinkDt * boost))) return null;
    let pos: Vec2 | null;
    let reason: CookReason = "none";
    const checked = checksPath(ctx);
    if (!open) {
        reason = coverReason(ctx, t, covered);
        // a burst over low cover takes craft (else the plain throw behind it) and a clear flight over it
        if (reason === "airburst" && ((craft < 1 && !rng.bool(craft)) || !clearAirburst(ctx, item, t.pos, checked)))
            reason = "cover";
        // a burst over low cover goes at the target itself; landing behind tall cover, just past its far side
        pos = reason === "airburst" ? v2.copy(t.pos) : behindCoverPoint(model, self.pos, t.pos);
    } else {
        let lead = v2.mul(t.vel, 0.6);
        if (v2.length(lead) > 3) lead = v2.mul(v2.normalize(lead), 3);
        pos = v2.add(t.pos, lead);
    }
    if (reason !== "airburst") pos = clearLanding(ctx, item, pos, t.pos, checked);
    if (!pos) return null;
    const plan = fragPlan(ctx, item, pos, reason, checked);
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(plan.pos);
    return plan;
}

/**
 * A beginner's wasted frag (frag.waste per second): at an enemy in the open the bot could shoot, or beyond the longest
 * throw (thrown as far as it goes, it falls short). Never inside the frag's minimum distance (smartGrenade's gate).
 */
function wasteFrag(ctx: BrainCtx, item: string, t: Contact, d: number, thinkDt: number): ThrowPlan | null {
    if (!wastesFrag(ctx, thinkDt) || !t.visible || t.downed || !reactedTo(ctx, t)) return null;
    const me = ctx.self.pos;
    const pos = d > FRAG_MAX + 3 ? v2.add(me, v2.mul(v2.normalize(v2.sub(t.pos, me)), FRAG_MAX + 3)) : v2.copy(t.pos);
    const plan = fragPlan(ctx, item, pos, "waste");
    ctx.mem.lastThrow = ctx.now;
    ctx.mem.lastThrowPos = v2.copy(plan.pos);
    return plan;
}

/**
 * Smart: a frag in front of an enemy rushing in (closing at PUSH_SPEED or more from PUSH_MIN to PUSH_MAX units) while
 * the bot has no clear, loaded shot at it: cooked to burst where it will be as the frag arrives. Round 4: as often as
 * the bot's craft and the persona's caution make it (fragSkill.ts), with its path checked.
 */
function pushToDeny(ctx: BrainCtx, t: Contact, d: number, thinkDt: number): ThrowPlan | null {
    const { self, now, mem, params, rng } = ctx;
    if (!t.visible || t.downed || d < PUSH_MIN || d > PUSH_MAX || clearShot(ctx, t) || !reactedTo(ctx, t)) return null;
    const closing = v2.dot(t.vel, v2.normalizeSafe(v2.sub(self.pos, t.pos)));
    if (closing < PUSH_SPEED || now - mem.lastThrow < SMART_COOLDOWN) return null;
    const appetite = 4 * params.frag.craft * cautionTaste(ctx.persona);
    if (!rng.bool(Math.min(1, params.grenadeRate * thinkDt * appetite))) return null;
    const item = fragItem(ctx);
    // where it will be in about a second and a half (capped: velocity estimates are noisy), not closer than the minimum
    let ahead = v2.mul(t.vel, 1.5);
    if (v2.length(ahead) > 6) ahead = v2.mul(v2.normalize(ahead), 6);
    let pos = v2.add(t.pos, ahead);
    const min = fragMinDist(item);
    if (v2.distance(pos, self.pos) < min) pos = v2.add(self.pos, v2.mul(v2.normalizeSafe(v2.sub(pos, self.pos)), min));
    const checked = checksPath(ctx);
    const clear = clearLanding(ctx, item, pos, pos, checked);
    if (!clear) return null;
    const plan = fragPlan(ctx, item, clear, "push", checked);
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(plan.pos);
    return plan;
}
