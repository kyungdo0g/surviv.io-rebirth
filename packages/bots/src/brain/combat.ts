// Fighting basics: target selection, target leading, the shooting check (reaction, range, line of fire), free
// directions and cover spots, and the "combat layer" that lets other behaviours shoot back while moving. The
// engagement itself is brain/tactics.ts, grenades brain/grenades.ts. The bot only uses contacts from its own
// snapshots.
// The shot check (bot overhaul COMBAT-3/8/9, both brains) says why there is no shot as well: a target stepping out
// of cover gets a fresh, short exposure reaction (no triggerbot; diagnosis round 1 issue 1 RC2), a half-covered body is
// shot at its exposed edge (rays from the gun to the body's centre and edges, not the centre only), and a target
// shooting at the bot, or one it already exchanges fire with, is answered out to the gun's real reach instead of the
// comfort range it starts fights at (round 1 issue 2 RC1: 61% of the aim-without-fire samples were range-gated).
// A faint body under a tree canopy (round 3 item 26) is shot only in short bursts at a guess around it, noticed later
// and given up on sooner (brain/faint.ts).
import { type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { colliderCenter, colliderRadius } from "../geom.ts";
import { currentGun, fightSlot, type HeldGun, hasAmmo } from "../knowledge/arsenal.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { blastWatchOf } from "../perception/blasts.ts";
import { bodyAimPoint } from "../perception/rays.ts";
import type { Contact, SeenObstacle, WorldModel } from "../perception/world.ts";
import { aimSigma, engagingMe, holdFire } from "./assess.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { answerSlot } from "./early.ts";
import { faintAim, faintDropped, faintGate, noteClear } from "./faint.ts";
import { launcherSlot, launcherTooClose } from "./launch.ts";
import { heldMelee, swingBand } from "./melee.ts";
import { opportunityMult } from "./opportunity.ts";
import { ignoredTarget } from "./pursuit.ts";
import { focusMult } from "./teamplay.ts";

/** The fists' old swing band less its slack (kept for readers of the constant; melee.ts has the per-weapon reach). */
export const MELEE_REACH = 2.4;
export const FRAG_TYPES = ["frag", "mirv"];
/** The target must be covered or out of sight this long for its next clear shot to count as a new exposure. */
const EXPOSURE_GAP = 0.3;
/** The crosshair already held the spot the target stepped out at (within this angle): a shorter exposure reaction. */
const PRE_AIM_DEG = 8;
const PRE_AIM = 0.75;
/** Shotguns answer fire out to this fraction of their bullet distance (pellet reach, diagnosis fix 1). */
const SHOTGUN_RETURN = 0.75;
/** An exchange the bot opened stays on this long after its last decision to fire. */
const EXCHANGE = 3;
/** A gun drawn for a fight stays in hand at least this long while it has rounds (heldSlot). */
const SLOT_HOLD = 2;

/** Picks the enemy to fight: visible ones first, the closest and the ones shooting at the bot weigh most. */
export function selectTarget(ctx: BrainCtx): Contact | null {
    const { model, now, mem } = ctx;
    const me = ctx.self.pos;
    let best: Contact | null = null;
    let bestScore = 0;
    for (const c of ctx.enemies) {
        const age = now - c.lastSeen;
        if (age > ctx.params.memory) continue;
        // pursuit seam (MOVE): a dropped futile chase inside its ignore window
        if (ignoredTarget(ctx, c)) continue;
        // a faint body under a canopy the bot gave up on (faint.ts)
        if (faintDropped(ctx, c)) continue;
        const d = v2.distance(me, c.pos);
        let s = 40 / (d + 5);
        if (!c.visible) s *= 0.45 * (1 - age / (ctx.params.memory + 0.01));
        else if (c.faint) s *= 0.6;
        if (now - c.lastShotAt < 2) s *= 1.4;
        if (model.underFire && model.underFire.shooterId === c.id && now - model.underFire.time < 2) s *= 1.5;
        // a downed enemy is no threat while others stand; finish it when nothing else is around
        if (c.downed) s *= 0.35;
        if (c.id === mem.targetId) s *= 1.3;
        // smart brain: punish busy or weakened enemies, shoot the one the team is shooting
        if (ctx.features.opportunism) s *= opportunityMult(ctx, c);
        if (ctx.features.teamplay) s *= focusMult(ctx, c);
        if (s > bestScore) {
            bestScore = s;
            best = c;
        }
    }
    return best;
}

/** Where the bot should aim to hit `c`: its position plus lead along its velocity for the bullet flight time. */
export function leadPoint(ctx: BrainCtx, c: Contact): Vec2 {
    const gun = currentGun(ctx.self, ctx.guns);
    const speed = gun?.info.bulletSpeed ?? 100;
    const d = v2.distance(ctx.self.pos, c.pos);
    const t = d / speed + 0.03;
    const lead = ctx.params.leadFactor;
    // remembered contacts drift along their last velocity for a short while
    const extra = c.visible ? 0 : Math.min(0.5, ctx.now - c.lastSeen);
    return v2.add(c.pos, v2.mul(c.vel, t * lead + extra * 0.5));
}

/** Why the bot has no shot at a target now (null: it has one). */
export type NoShot = "hidden" | "empty" | "range" | "blocked" | "reaction" | "exposure" | "faint";

export interface ShotCheck {
    ok: boolean;
    why: NoShot | null;
    /** the point that has a clear line from the gun: the body's centre or an exposed edge (null: none) */
    aim: Vec2 | null;
    /** the distance the bot shoots out to at this target now (comfort range, or the gun's reach in an exchange) */
    limit: number;
}

/** Whether the bot is in an exchange with `c`: it shoots at the bot, or the bot fired at it a moment ago. */
export function returningFire(ctx: BrainCtx, c: Contact): boolean {
    const f = ctx.mem.fight;
    if (f.fireTarget === c.id && ctx.now - f.fireAt < EXCHANGE) return true;
    return engagingMe(ctx, c);
}

/**
 * The distance the bot shoots at `c` out to with `gun`: maxEngage x rangeMult (at least 10) to start a fight (the skill
 * knob); in an exchange the gun's real reach, what the screen shows for pistols and SMGs, 0.75 of the bullet distance
 * for shotguns (COMBAT-8).
 */
export function engageLimit(ctx: BrainCtx, c: Contact, gun: HeldGun): number {
    const comfort = Math.max(gun.info.maxEngage * ctx.params.rangeMult, 10);
    if (!returningFire(ctx, c)) return comfort;
    const reach = gun.info.cls === "shotgun" ? gun.info.range * SHOTGUN_RETURN : gun.info.range;
    return Math.max(comfort, reach);
}

/** Where a shot leaves from: the gun beside the player's centre (sim weapons/gun.ts gunPos, barrelOffset). */
function muzzle(self: Vec2, to: Vec2, gun: HeldGun | undefined): Vec2 {
    const off = gun && !gun.info.def.isDual ? (gun.info.def.barrelOffset ?? 0) : 0;
    if (Math.abs(off) < 1e-6) return self;
    return v2.add(self, v2.mul(v2.perp(v2.normalizeSafe(v2.sub(to, self))), off));
}

/** The point on `c`'s body that has a clear line from the bot's gun (centre first, then an edge), or null. */
export function bodyShot(ctx: BrainCtx, c: Contact): Vec2 | null {
    const from = muzzle(ctx.self.pos, c.pos, currentGun(ctx.self, ctx.guns));
    return bodyAimPoint(from, c.pos, (a, b) => ctx.model.lineOfFire(a, b));
}

/**
 * The cover clock of `c`: since when its whole body has been behind cover from the bot (or out of sight), -Infinity
 * while it shows; the frag gates and the stall reposition read it (COMBAT-10, COMBAT-11).
 */
export function noteCover(ctx: BrainCtx, c: Contact, covered: boolean): number {
    const f = ctx.mem.fight;
    if (f.coverTarget !== c.id) {
        f.coverTarget = c.id;
        f.coveredSince = Number.NEGATIVE_INFINITY;
    }
    if (!covered) f.coveredSince = Number.NEGATIVE_INFINITY;
    else if (f.coveredSince === Number.NEGATIVE_INFINITY) f.coveredSince = c.visible ? ctx.now : c.lastSeen;
    return f.coveredSince;
}

/**
 * The exposure clock (COMBAT-3): a target that steps out with a clear shot after being covered or out of sight for
 * EXPOSURE_GAP gets a fresh reaction drawn from params.exposureReaction (shorter, never under params.onsetFloor, when
 * the crosshair already held that spot). A target the bot turns to for the first time counts from its sighting.
 * Returns whether the current exposure's reaction has passed.
 */
function exposureReady(ctx: BrainCtx, c: Contact, clear: Vec2 | null): boolean {
    const f = ctx.mem.fight;
    const now = ctx.now;
    let fresh = false;
    if (f.expTarget !== c.id) {
        // a target the bot was not following: its exposure counts from its sighting (the reaction gate covers that)
        f.expTarget = c.id;
        f.expSince = Number.NEGATIVE_INFINITY;
        f.expLast = now;
        fresh = true;
    }
    if (!clear) {
        if (fresh) f.expLast = Number.NEGATIVE_INFINITY;
        return false;
    }
    if (fresh || now - f.expLast > EXPOSURE_GAP) {
        f.expSince = fresh ? c.firstSeen : now;
        const [lo, hi] = ctx.params.exposureReaction;
        let delay = ctx.rng.range(lo, hi);
        const to = v2.normalizeSafe(v2.sub(clear, ctx.self.pos));
        if (v2.dot(ctx.self.dir, to) > Math.cos((PRE_AIM_DEG * Math.PI) / 180))
            delay = Math.max(ctx.params.onsetFloor, delay * PRE_AIM);
        f.expDelay = delay;
    }
    f.expLast = now;
    return now - f.expSince >= f.expDelay - 1e-9;
}

/**
 * Whether the bot may shoot at `c` now, and why not: visible, a loaded gun (or melee reach), in range, a clear line to
 * some of its body, reacted to the sighting and to this exposure. Draws the reaction time of a new target and the
 * exposure reaction of a new exposure (in that order).
 */
export function shotCheck(ctx: BrainCtx, c: Contact, dist: number): ShotCheck {
    const no = (why: NoShot, limit = 0, aim: Vec2 | null = null): ShotCheck => ({ ok: false, why, aim, limit });
    if (!c.visible) {
        noteCover(ctx, c, true);
        return no("hidden");
    }
    const mem = ctx.mem;
    if (mem.engagedTarget !== c.id) {
        mem.engagedTarget = c.id;
        mem.engageStart = c.firstSeen;
        const [lo, hi] = ctx.params.reactionTime;
        mem.reaction = ctx.rng.range(lo, hi);
    }
    const reacted = ctx.now - Math.max(c.firstSeen, mem.engageStart) >= mem.reaction;
    const gun = currentGun(ctx.self, ctx.guns);
    if (!gun) {
        // melee: the weapon's reach on the gap the bot perceives is judged by planFight (melee.ts); here the true one
        const band = swingBand(heldMelee(ctx.self));
        if (dist > band) return no("range", band);
        return reacted ? { ok: true, why: null, aim: c.pos, limit: band } : no("reaction", band);
    }
    const aim = bodyShot(ctx, c);
    noteCover(ctx, c, aim === null);
    const exposed = exposureReady(ctx, c, aim);
    const f = mem.fight;
    if (aim) {
        f.lastClearPos = v2.copy(c.pos);
        f.lastClearAt = ctx.now;
    }
    const limit = engageLimit(ctx, c, gun);
    if (gun.mag <= 0) return no("empty", limit, aim);
    // a launcher never fires at point blank (its blast would hurt the bot: brain/launch.ts)
    if (launcherTooClose(gun, dist)) return no("range", limit, aim);
    if (dist > limit || dist > gun.info.range) return no("range", limit, aim);
    if (!aim) return no("blocked", limit);
    if (!reacted) return no("reaction", limit, aim);
    if (!exposed) return no("exposure", limit, aim);
    // a faint body under a canopy: noticed late, short bursts, given up on sooner
    if (c.faint) {
        if (!faintGate(ctx, c)) return no("faint", limit, aim);
    } else noteClear(ctx, c);
    return { ok: true, why: null, aim, limit };
}

/** Whether the bot has reacted to `c`: the reaction time drawn for it (shotCheck) has passed since its sighting. */
export function reactedTo(ctx: BrainCtx, c: Contact): boolean {
    const mem = ctx.mem;
    return mem.engagedTarget === c.id && ctx.now - Math.max(c.firstSeen, mem.engageStart) >= mem.reaction;
}

/** Whether the bot may shoot at `c` now: visible, reacted, in range and in line of fire (shotCheck). */
export function canShoot(ctx: BrainCtx, c: Contact, dist: number): boolean {
    return shotCheck(ctx, c, dist).ok;
}

/**
 * The fight slot at `dist` against `t` with the bot's skill and the armour it sees on the target (LOOT's request). The
 * aim error is the skill's for a typical target (not this think's strafing: a target that stops and starts would flip
 * the TTK ranking and the bot would swap guns every few seconds).
 */
export function slotAgainst(ctx: BrainCtx, t: Contact, dist: number): number {
    // a launcher where it fits: a group, a target behind cover, a still or busy one, beyond its blast (launch.ts)
    const launcher = launcherSlot(ctx, t, dist);
    if (launcher >= 0) return heldSlot(ctx, launcher);
    const slot = fightSlot(ctx.self, ctx.guns, dist, { sigmaDeg: aimSigma(ctx), helmet: t.helmet, chest: t.chest });
    // report 39: a bare-handed rusher at point blank is fought with melee by some (early.ts answerSlot)
    return heldSlot(ctx, ctx.features.meleeAnswer ? answerSlot(ctx, t, dist, slot) : slot);
}

/**
 * The fight slot `want`, unless the gun in hand came out less than SLOT_HOLD ago and still has rounds in its magazine:
 * then that gun (a switch costs its delay without a shot; the expected-TTK choice flips with every few units of distance
 * and every round fired: evaluation F10, 9.8 switches per fight-minute against 1.0 before the overhaul, about a third
 * of them straight back within a second). Melee, an empty gun or a throwable in hand switch at once.
 */
export function heldSlot(ctx: BrainCtx, want: number): number {
    const f = ctx.mem.fight;
    const cur = ctx.self.curWeapIdx;
    if (f.slotHeld !== cur) {
        f.slotHeld = cur;
        f.slotSince = ctx.now;
    }
    if (want === cur || want === WeaponSlot.Melee) return want;
    const gun = ctx.guns.find((g) => g.slot === cur);
    if (!gun || gun.mag <= 0 || ctx.now - f.slotSince >= SLOT_HOLD) return want;
    return cur;
}

/**
 * The lead point of `t`, moved to the exposed edge the shot check found when only an edge shows, and to this burst's
 * guess when it is faint (faint.ts).
 */
export function shotAim(ctx: BrainCtx, t: Contact, check: ShotCheck): Vec2 {
    const lead = leadPoint(ctx, t);
    return faintAim(ctx, t, check.aim ? v2.add(lead, v2.sub(check.aim, t.pos)) : lead);
}

/** A direction near `dir` that does not walk into a wall within 2.5 units (tries mirrored and rotated variants). */
export function freeDir(model: WorldModel, pos: Vec2, dir: Vec2): Vec2 | null {
    const tries = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
    for (const a of tries) {
        const d = a === 0 ? dir : v2.rotate(dir, a);
        const probe = v2.add(pos, v2.mul(d, 2.5));
        if (model.nav.walkableAt(probe) && !model.nav.isWaterAt(probe)) return d;
    }
    return null;
}

/** A spot behind an obstacle that shields the bot from `threat`, within `maxDist`, or null. */
export function findCover(model: WorldModel, threat: Vec2, maxDist = 12): Vec2 | null {
    return findCoverFrom(model, model.self.pos, threat, maxDist);
}

/** Centre and rough radius of an obstacle's collider (cached per seen obstacle: the model reuses unchanged ones). */
export interface ObstacleGeom {
    c: Vec2;
    r: number;
}

const geomCache = new WeakMap<SeenObstacle, ObstacleGeom>();

export function obstacleGeom(o: SeenObstacle): ObstacleGeom {
    let g = geomCache.get(o);
    if (!g) {
        g = { c: colliderCenter(o.col), r: colliderRadius(o.col) };
        geomCache.set(o, g);
    }
    return g;
}

interface CoverCandidate {
    c: Vec2;
    r: number;
    box: boolean;
    /** the obstacle's id (an explosive's cover cost: perception/blasts.ts) */
    id: number;
}

const coverLists = new WeakMap<WorldModel, { src: SeenObstacle[]; len: number; cands: CoverCandidate[] }>();

/**
 * Obstacles in view that can serve as cover (bullet-stopping, no doors, radius 0.9..7), in the model's order, with
 * their centre and radius: built once per snapshot (the model replaces its obstacle list with every snapshot).
 */
function coverCandidates(model: WorldModel): CoverCandidate[] {
    const e = coverLists.get(model);
    if (e && e.src === model.obstacles && e.len === model.obstacles.length) return e.cands;
    const cands: CoverCandidate[] = [];
    for (const o of model.obstacles) {
        if (!o.blocksBullets || o.def.door) continue;
        const { c, r } = obstacleGeom(o);
        if (r < 0.9 || r > 7) continue;
        cands.push({ c, r, box: o.col.type === 1, id: o.view.id });
    }
    coverLists.set(model, { src: model.obstacles, len: model.obstacles.length, cands });
    return cands;
}

/**
 * A spot behind an obstacle that shields from `threat`, within `maxDist` of `from`, or null. `accept` filters the
 * candidate spots (default: all). A brain that knows exploding obstacles (BrainFeatures.blastAware: the model has a
 * blast watch) pays for an explosive cover and for a spot inside a blast, and never hides behind an explosive being
 * shot or badly damaged nor in its blast (perception/blasts.ts coverCost): a crate or a wall a few steps farther wins
 * over a barrel next to the bot.
 */
export function findCoverFrom(
    model: WorldModel,
    from: Vec2,
    threat: Vec2,
    maxDist: number,
    accept?: (spot: Vec2) => boolean,
): Vec2 | null {
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    const blasts = blastWatchOf(model);
    for (const { c, r, box, id } of coverCandidates(model)) {
        if (v2.distance(from, c) > maxDist) continue;
        const away = v2.normalizeSafe(v2.sub(c, threat));
        const raw = v2.add(c, v2.mul(away, r * (box ? 0.75 : 1) + 1.5));
        if (!model.nav.walkableAt(raw)) continue;
        // the centre of its navigation cell: a player can stand there (the raw spot can sit closer to the obstacle
        // than the player's radius, and a goal no one can reach only piles up path follower stuck events)
        const spot = model.nav.center(model.nav.nearestWalkable(raw, 1));
        // the whole body hidden, not only its centre (an edge ray from the threat would still land)
        if (model.bodyLineOfFire(threat, spot)) continue;
        // exploding obstacles (blastAware): an explosive is poor cover, a blast poor company
        const blast = blasts ? blasts.coverCost(model, id, spot) : 0;
        if (blast === null) continue;
        if (accept && !accept(spot)) continue;
        // prefer close spots that do not make the bot walk towards the threat
        const towards = Math.max(0, v2.distance(threat, from) - v2.distance(threat, spot));
        const cost = v2.distance(from, spot) + towards * 1.5 + blast;
        if (cost < bestCost) {
            bestCost = cost;
            best = spot;
        }
    }
    return best;
}

/**
 * Lets a non-fight behaviour shoot back at the target while it moves (looting, rotating, regrouping): adds aim and
 * fire, and the slot to hold, when the target is visible and in reach. Out of reach or behind cover the crosshair only
 * glances at it (COMBAT-7: no tracking lock on a target the bot will not shoot).
 */
export function addCombatLayer(ctx: BrainCtx, intent: Intent): void {
    const t = ctx.target;
    if (!t?.visible || !ctx.armed) return;
    const d = ctx.targetDist;
    const slot = slotAgainst(ctx, t, d);
    if (slot === WeaponSlot.Melee) return;
    intent.slot = slot;
    // (the shot check first: it draws the reaction time of a new target)
    const check = shotCheck(ctx, t, d);
    intent.fire = check.ok && !holdFire(ctx, t, d);
    if (intent.fire) {
        ctx.mem.fight.fireTarget = t.id;
        ctx.mem.fight.fireAt = ctx.now;
    }
    const soon =
        check.why === "reaction" ||
        check.why === "exposure" ||
        check.why === "empty" ||
        (check.why === "faint" && !faintDropped(ctx, t));
    if (intent.fire || (soon && !holdFire(ctx, t, d))) {
        intent.targetId = t.id;
        intent.aim = shotAim(ctx, t, check);
    } else if (!intent.aim && !intent.lookAt) {
        // (no targetId: the behaviour's own aim, a crate say, must not be carried along with the enemy)
        intent.lookAt = v2.copy(t.pos);
    }
}

/** Whether the bot holds a usable gun in its hands (loaded or with reserve). */
export function holdsUsableGun(ctx: BrainCtx): boolean {
    const g = currentGun(ctx.self, ctx.guns);
    return !!g && hasAmmo(g) && !!gunInfo(g.info.id);
}
