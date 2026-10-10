// Breaking loot containers: most loot outside buildings sits in crates (and in furniture inside them) that must be
// destroyed first. The bot walks up to the nearest worthwhile container it can see and punches it (or shoots it when
// it carries plenty of ammo), then the loot behaviour picks up what drops. Explosive barrels are left alone. Air drop
// crates are opened with Use (and waited for: they open after their useDelay), then their inner crate is broken.
//
// Bot overhaul LOOT-1..4, LOOT-7 (bug fixes for every brain, the documented exceptions to THE RULE in features.ts;
// diagnoses lazy-loot, crate-one-hit and airdrop, both rounds):
// - how much the bot still needs loot counts helmet and vest apart, the backpack and heals, and a weak gun (C+ or
//   lower) is no loadout: a bot with two loaded guns and no armour broke 0/30 crates;
// - only an enemy that threatens the bot damps a container (brain/lootRisk.ts); a container the bot already damaged
//   is finished (commit bonus, never zeroed by the cutoff); the distance term is smooth (it jumped at 6 units);
// - plated containers only with a piercing melee, never shot; furniture under the roof of a building the bot is not in
//   is not targeted from outside (brain/containers.ts containerVisible); a container is picked only with a spot to
//   punch it from;
// - the give-up clock counts only time in reach without the container losing health (ObstacleView.healthT, what the
//   client shows), over interruptions; out of reach without getting closer, the bot tries another side, then gives up
//   for a while (it idled 8 s against walls before); the melee reach comes from the melee def;
// - air drops: Use from the server's reach (interactionRad + the player's radius), a step straight at the crate when
//   the stand spot leaves it short, the 2.5 s opening waited out, the inner crate valued like the air drop (it scored
//   12 and was never broken: 0/8 on HEAD), a score floor that does not shrink with the loadout.
// LOOT2 (user report 21: a container a bot started should end broken unless a real interruption comes; bug fixes for
// every brain like LOOT-1..4, the documented exception to THE RULE): one it is finishing (damaged by its own attempt,
// close, a few seconds left) outlasts the early zone, an item or an air drop run; one it damaged is never swapped for
// another, and damage landing between two decisions counts as its own; a visible enemy that does not threaten the bot
// no longer holds the attack (the combat layer drew the gun and held fire while the give-up clock ran); that clock
// runs at full rate only while the bot actually attacks the container.
import { type Vec2, v2 } from "@rebirth/core";
import { Input, WeaponSlot } from "@rebirth/defs";
import { colliderCenter, colliderRadius, distanceToCollider } from "../geom.ts";
import type { HeldGun } from "../knowledge/arsenal.ts";
import { isWeakGun } from "../knowledge/gunTiers.ts";
import type { SeenObstacle } from "../perception/world.ts";
import { byThoroughness } from "../persona.ts";
import { BASEMENT_FURNITURE, inLootedBasement } from "./basement.ts";
import { addCombatLayer } from "./combat.ts";
import {
    AIRDROP_LOOT_VALUE,
    clearApproach,
    closestPoint,
    containerGrid,
    containerValue,
    containerVisible,
    finishSeconds,
    isAirdropLoot,
    meleeBreaks,
    meleeReach,
    onBotFloor,
    plated,
    reachableOn,
    standSpots,
    swingLands,
    useReach,
} from "./containers.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { lootDamping, underThreat } from "./lootRisk.ts";
import { steadyGoal } from "./steady.ts";
import { onTheWay, zonePressure } from "./survival.ts";
import { inSweptBuilding, SWEEP_FURNITURE } from "./sweep.ts";

/** Containers farther than this are not worth a detour (scaled by the persona's thoroughness; 26 for NEUTRAL). */
const MAX_DIST = 26;
/** Closer than this, the bot walks straight at the container (the collision stops it within punching reach). */
const APPROACH_DIST = 4;
/** A bot with plenty of ammo shoots containers from this far (never snipers: their ammo is scarce). */
const SHOOT_RANGE = 7;
/** ... with a gun whose spread (standing plus moving, degrees) stays under this (an MP5 7, an AK 10, a G18C 22). */
const SHOOT_SPREAD = 10;
/** A plated container this close to the target catches stray rounds. */
const PLATED_NEAR = 5;
/** Seconds in reach without the container losing health before the bot gives up on it (3 tries from different stand
 * spots, REPOSITION each; LOOT2: it was 3 from one spot) ... */
const NO_PROGRESS = 4;
/** ... for this long. */
const GIVE_UP = 20;
/** Out of reach and not getting closer for this long: another stand spot; after STALL_GIVE_UP: give up for a while. */
const STALL = 1.5;
const STALL_GIVE_UP = 4.5;
const STALL_BLACKLIST = 12;
const STALL_BLACKLIST_MINE = 5;
/** The break target is still pursued this long after it dropped out of the snapshot (s). */
const BREAK_OUT_OF_VIEW = 8;
/** Seconds of work within NO_HIT_NEAR of a container without hurting it after which the bot gives up on it. */
const NO_HIT_GIVE_UP = 10;
const NO_HIT_NEAR = 8;
/** A container the bot damaged keeps this bonus (finish what it started, critique C1). */
const COMMIT = 0.1;
/** Air drop crates (and the inner crate) score at least this, whatever the loadout (airdrop fix 2). */
const AIRDROP_FLOOR = 0.45;
/** Below this a container is not worth starting (a well-equipped bot leaves it to exploring); persona-scaled. */
const CUTOFF = 0.14;
/** At most this many of the best containers are checked for a stand spot per decision. */
const STAND_CHECKS = 3;
/**
 * LOOT2 (user report 21): a container the bot is finishing (its own attempt damaged it, it stands within its reach
 * plus FINISH_SLACK and the rest takes at most FINISH_TIME) is kept through the zone filters while the gas is not on
 * the bot and the zone pressure stays under FINISH_ZONE, and scores at least FINISH_FLOOR unless something threatens
 * the bot: the first circle's announcement (zone 0.12-0.45, ~10 s in) and the 120 s circle took bots off crates one
 * punch from breaking, and so did an early air drop run or an item; fights and flights still come first.
 */
const FINISH_SLACK = 2.5;
const FINISH_TIME = 3.5;
const FINISH_FLOOR = 0.62;
const FINISH_ZONE = 0.6;
/** A container the bot damaged is preferred this much over the others (no switching away from a half-broken one). */
const COMMIT_PICK = 4;
/** In reach but not attacking (the gun drawn at an enemy, a weapon switch): the no-progress clock runs this slow. */
const IDLE_RATE = 0.35;
/** Punching from one spot without hurting the container this long: another stand spot, walked to for at most ... */
const REPOSITION = 1.2;
const REPOSITION_TIME = 2.5;
/** Attacking means facing the container within this cosine (about 50 degrees). */
const FACING_COS = 0.64;
/** A container the bot damaged stays committed this long after its last hit on it. */
const COMMIT_MEMORY = 60;
/** A container this close to an armed enemy the bot fled this recently is no exemption (steady.ts FLED_*). */
const FLED_RECENT = 8;
const FLED_NEAR = 16;

function breakable(o: SeenObstacle): boolean {
    const d = o.def;
    return !o.view.dead && d.destructible && d.collidable && d.loot.length > 0 && !d.explosion && !d.door && !d.button;
}

/** A landed air drop crate that can still be opened (Interact / Use within its interaction radius). */
function openable(o: SeenObstacle): boolean {
    return !o.view.dead && !!o.def.airdropCrate && !!o.view.button?.canUse;
}

/** The air drop crate the bot opened, still playing its opening (button useDelay, then its inner crate appears). */
function opening(ctx: BrainCtx, o: SeenObstacle): boolean {
    const lm = ctx.mem.loot2;
    return !o.view.dead && !!o.def.airdropCrate && lm.openId === o.view.id && ctx.now < lm.openUntil;
}

/** Whether a seen obstacle can still be broken open or opened (bestBreakable's filter) on the floor of `layer`. */
export function breakableNow(o: SeenObstacle, layer = 0): boolean {
    return (breakable(o) || openable(o)) && (o.view.layer & 1) === (layer & 1);
}

export interface BreakChoice {
    obstacle: SeenObstacle;
    value: number;
    dist: number;
}

/** Whether a plated container stands within PLATED_NEAR of `o` (shooting `o` would hit it too). */
function platedNear(ctx: BrainCtx, o: SeenObstacle): boolean {
    const c = colliderCenter(o.col);
    for (const x of ctx.model.obstacles) {
        if (x === o || !plated(x) || x.view.dead) continue;
        if (distanceToCollider(c, x.col) < PLATED_NEAR + colliderRadius(o.col)) return true;
    }
    return false;
}

function giveUp(ctx: BrainCtx, id: number, seconds: number, keepCommit = false): void {
    const { mem, now } = ctx;
    mem.lootBlacklist.set(id, now + seconds);
    mem.loot2.noProgress.delete(id);
    if (!keepCommit) mem.loot2.damaged.delete(id);
    if (mem.breakTarget === id) mem.breakTarget = 0;
    if (mem.loot2.breakId === id) mem.loot2.breakId = 0;
}

/** Whether some stand spot around `o` lets a punch land on it (checked at most once a second per container). */
function hasLandingSpot(ctx: BrainCtx, o: SeenObstacle): boolean {
    const lm = ctx.mem.loot2;
    if (lm.landingId !== o.view.id || ctx.now >= lm.landingUntil) {
        lm.landingId = o.view.id;
        lm.landingUntil = ctx.now + 1;
        lm.landing = standSpots(ctx, o).some((p) => swingLands(ctx, o, p));
    }
    return lm.landing;
}

/** Whether the bot can get at `o`: within reach with a clear way, or a stand spot to punch it from. */
function hasStandSpot(ctx: BrainCtx, o: SeenObstacle, dist: number): boolean {
    const lm = ctx.mem.loot2;
    if (lm.standOkId === o.view.id && ctx.now < lm.standOkUntil) return true;
    // (in shooting or walking range with a clear way, or a stand spot)
    const ok = (dist < SHOOT_RANGE && clearApproach(ctx, o)) || standSpots(ctx, o).length > 0;
    if (ok) {
        lm.standOkId = o.view.id;
        lm.standOkUntil = ctx.now + 1;
    }
    return ok;
}

/**
 * Whether the bot's own attempt already damaged the container (it finishes it). The damage seen since the attempt
 * started counts too, before trackBreak registered it: a shot landing between two decisions left the flag unset and a
 * crate under the cutoff was dropped at 40% (LOOT2).
 */
function committed(ctx: BrainCtx, o: SeenObstacle): boolean {
    const lm = ctx.mem.loot2;
    const id = o.view.id;
    // one it damaged earlier stays its own for a while (a moment off the list left it to a new target for good)
    const at = lm.damaged.get(id);
    if (at !== undefined && ctx.now - at < COMMIT_MEMORY) return true;
    if (lm.breakId !== id || ctx.mem.breakTarget !== id) return false;
    return lm.breakHit || o.view.healthT < lm.breakHealthT - 1e-6;
}

/**
 * The gun to shoot `o` with, or undefined to punch it: shooting costs ammo, so only with plenty to spare (`spare`: any
 * loaded one, for the last hits) and a gun that hits what it aims at (never at plating, nor next to it: sprayed pistol
 * and shotgun rounds struck the plated crate beside the target).
 */
export function breakGun(ctx: BrainCtx, o: SeenObstacle, spare = false): HeldGun | undefined {
    if (plated(o) || platedNear(ctx, o)) return undefined;
    // basements: punched only underground (bunker and vault walls send rounds back at the shooter)
    if (ctx.features.basements && (o.view.layer & 1) === 1) return undefined;
    return ctx.guns.find(
        (g) =>
            g.mag > 0 &&
            (spare || g.reserve >= g.info.def.maxClip * 2) &&
            g.info.cls !== "sniper" &&
            g.info.def.shotSpread + g.info.def.moveSpread <= SHOOT_SPREAD,
    );
}

/** Whether the bot is finishing `o` (LOOT2): its own attempt damaged it, it is close and the rest takes seconds. */
function finishing(ctx: BrainCtx, o: SeenObstacle, dist: number): boolean {
    if (!committed(ctx, o)) return false;
    const gun = breakGun(ctx, o);
    if (dist > (gun ? SHOOT_RANGE : meleeReach(ctx.self)) + FINISH_SLACK) return false;
    return finishSeconds(o, ctx.self, gun?.info) <= FINISH_TIME;
}

/**
 * Whether a finishing container at `p` may ignore the zone filters: the gas is not on the bot and does not press hard,
 * and (steady) it is not next to an armed enemy the bot just ran from (steady.ts steadyGoal's rule, without its zone
 * part).
 */
function finishFree(ctx: BrainCtx, p: Vec2): boolean {
    const { model, now } = ctx;
    if (model.inGasNow() || zonePressure(model) >= FINISH_ZONE) return false;
    if (!ctx.features.steady) return true;
    const me = ctx.self.pos;
    for (const f of ctx.mem.smart.fled) {
        if (now - f.time >= FLED_RECENT) continue;
        const d = v2.distance(f.pos, p);
        if (d < FLED_NEAR && (!ctx.features.pursuit || d < v2.distance(f.pos, me) + 2)) return false;
    }
    return true;
}

export function bestBreakable(ctx: BrainCtx): BreakChoice | null {
    const { model, self, mem, now } = ctx;
    const maxDist = byThoroughness(ctx.persona, MAX_DIST, 0.8);
    const found: Array<BreakChoice & { s: number }> = [];
    // the container it heads for stays a candidate while its path leads out of view for a moment (around a building:
    // adversarial follow-up, squad bots dithered for 40 s at the police station between the crate's stand spot, whose
    // path led out of the snapshot first, and sweeping back to where the crate showed again)
    const away = mem.breakTarget ? model.rememberedObstacle(mem.breakTarget, BREAK_OUT_OF_VIEW) : undefined;
    for (const o of away ? [...model.obstacles, away] : model.obstacles) {
        const waiting = opening(ctx, o);
        if (!(breakable(o) || openable(o) || waiting) || !onBotFloor(ctx, o.view.layer)) continue;
        const until = mem.lootBlacklist.get(o.view.id);
        if (until !== undefined && until > now) continue;
        const d = distanceToCollider(self.pos, o.col);
        // a container one or two hits from breaking is finished before the walk to the zone (LOOT2)
        const fin = finishing(ctx, o, d) && finishFree(ctx, colliderCenter(o.col));
        if (!fin) {
            if (d > maxDist || !model.insideCurrentCircle(colliderCenter(o.col), 2)) continue;
            if (!onTheWay(model, colliderCenter(o.col))) continue;
            if (ctx.features.steady && !steadyGoal(ctx, colliderCenter(o.col))) continue;
        }
        // danger memory seam (MOVE): a container in a place the bot was chased out of
        if (avoidPos(ctx, colliderCenter(o.col))) continue;
        // plated: only a piercing melee breaks it (sim combat.ts canDamageObstacle; bullets never do)
        if (breakable(o) && !meleeBreaks(self, o)) continue;
        // furniture under someone else's roof is not on the bot's screen (remembered once seen from inside)
        if (!containerVisible(ctx, o)) continue;
        const value = waiting ? AIRDROP_LOOT_VALUE : containerValue(o);
        // (the current target is checked too: the old bonus skipped the check and kept bots on unreachable crates; one
        // the bot already damaged is not: it got at it, and a shrunk crate sits deep in the grid's spawn-size footprint)
        if (!committed(ctx, o) && !reachableOn(ctx, colliderCenter(o.col), colliderRadius(o.col) + 1.8, o.view.layer)) {
            mem.lootBlacklist.set(o.view.id, now + 30);
            continue;
        }
        let s = value / (1 + d / 10);
        // the current target is kept; one the bot already damaged is not swapped for another (LOOT2)
        if (committed(ctx, o)) s *= COMMIT_PICK;
        else if (o.view.id === mem.breakTarget) s *= 1.5;
        found.push({ obstacle: o, value, dist: d, s });
    }
    found.sort((a, b) => b.s - a.s);
    let checks = 0;
    for (const f of found) {
        if (checks++ >= STAND_CHECKS) break;
        // a container with no spot to punch it from (a vault's deposit boxes, lockers behind bars, a toilet behind the
        // outhouse wall) is passed over at once instead of idled at for the whole timeout
        if (!opening(ctx, f.obstacle) && !openable(f.obstacle) && !hasStandSpot(ctx, f.obstacle, f.dist)) {
            mem.lootBlacklist.set(f.obstacle.view.id, now + 15);
            continue;
        }
        return { obstacle: f.obstacle, value: f.value, dist: f.dist };
    }
    return null;
}

/**
 * How much the bot still needs loot (1 unarmed .. 0.3 fully kitted): a gun that is not weak (gunTiers isWeakGun: C+ or
 * lower, the pistols bots are asked to replace) with two magazines of ammo, a second one, then helmet and vest each,
 * a backpack and heals. Two pistols or an M93R are not a loadout.
 */
export function lootNeed(ctx: BrainCtx): number {
    const { self, guns } = ctx;
    const loaded = guns.filter((g) => g.mag + g.reserve >= g.info.def.maxClip * 2);
    const strong = loaded.filter((g) => !isWeakGun(g.info.id)).length;
    let need = 1;
    if (strong >= 1) need -= 0.25;
    else if (loaded.length >= 1) need -= 0.1;
    if (loaded.length >= 2 && strong >= 1) need -= 0.1;
    if (self.helmet) need -= 0.12;
    if (self.chest) need -= 0.12;
    if (self.backpack && self.backpack !== "backpack00") need -= 0.08;
    const inv = self.inventory;
    if ((inv.bandage ?? 0) + 3 * (inv.healthkit ?? 0) >= 5) need -= 0.08;
    return Math.max(0.3, need);
}

export function breakScore(ctx: BrainCtx, choice: BreakChoice | null): number {
    if (!choice) return 0;
    const o = choice.obstacle;
    const damp = lootDamping(ctx);
    const unarmed = !ctx.armed;
    // smooth with distance (it jumped from 1 to 1.3 at 6 units, so the bot flipped between break and explore there)
    const near = choice.dist <= 6 ? 1 : 0.3 + 4.2 / choice.dist;
    // an armed bot stops for a container next to it (the old 0.16 base never beat exploring once it held a gun)
    const base = unarmed ? 0.16 : 0.16 + 0.06 * near;
    let s = (base + (choice.value / 100) * (unarmed ? 0.55 : 0.3) * near) * lootNeed(ctx) * damp;
    // air drops hold the best loot of the match: worth it whatever the loadout, unless someone threatens the bot
    if (opening(ctx, o) || openable(o) || isAirdropLoot(o)) s = Math.max(s, AIRDROP_FLOOR * damp);
    // sweeping a house (BrainFeatures.sweep): its furniture is broken even with a full loadout (thorough personas)
    else if (ctx.persona.lootThoroughness >= 0.5 && inSweptBuilding(ctx, colliderCenter(o.col)))
        s = Math.max(s, SWEEP_FURNITURE * damp);
    // the basement it went down to loot: its containers are what it came for (basement.ts)
    else if (inLootedBasement(ctx, o)) s = Math.max(s, BASEMENT_FURNITURE * damp);
    if (committed(ctx, o)) {
        s = Math.min(0.6, s + COMMIT);
        // finishing: the last seconds beat a weak zone score, an item or an air drop run, not a threat (LOOT2)
        if (damp >= 0.9 && finishing(ctx, o, choice.dist)) s = Math.max(s, FINISH_FLOOR);
        return s;
    }
    // thoroughness only gates starting a detour, never finishing a container (critique C1)
    if (s < CUTOFF * (1 - 0.6 * (ctx.persona.lootThoroughness - 0.5))) return 0;
    s = Math.min(0.6, s);
    return s;
}

/**
 * Progress on the container (LOOT-4): the give-up clock runs only while the bot is in reach and the container does
 * not lose health, adding up over interruptions (an interruption itself costs nothing: the old timer ran from the
 * first pick, walk and fights included, and blacklisted a crate the moment the bot came back to it); out of reach
 * without getting closer, the bot tries another stand spot, then gives up for a while. Returns true when it gave up.
 */
function trackBreak(ctx: BrainCtx, o: SeenObstacle, inReach: boolean): boolean {
    const { self, now } = ctx;
    const lm = ctx.mem.loot2;
    const id = o.view.id;
    if (lm.breakId !== id) {
        lm.breakId = id;
        lm.breakHealthT = o.view.healthT;
        lm.breakHit = false;
        lm.standShift = 0;
        lm.spotNoProgress = 0;
        lm.repositionUntil = 0;
        lm.stallPos = v2.copy(self.pos);
        lm.stallSince = now;
        lm.breakTracked = now;
        lm.breakNoHit = 0;
    }
    const dt = Math.min(0.5, Math.max(0, now - lm.breakTracked));
    lm.breakTracked = now;
    if (o.view.healthT < lm.breakHealthT - 1e-6) {
        lm.breakNoHit = 0;
        lm.breakHealthT = o.view.healthT;
        lm.breakHit = true;
        lm.noProgress.delete(id);
        lm.damaged.set(id, now);
        lm.spotNoProgress = 0;
    } else if (inReach) {
        // (attacking it since the last decision, facing it: full rate; in reach but busy elsewhere, or turned away by
        // a later layer such as the unseen-fire "hold" that aims at a far shooter: slower, LOOT2)
        const toward = v2.normalizeSafe(v2.sub(closestPoint(o, self.pos), self.pos));
        const facing = v2.dot(self.dir, toward) > FACING_COS;
        const attacking = lm.attackId === id && now - lm.attackAt < 0.6 && facing;
        lm.noProgress.set(id, (lm.noProgress.get(id) ?? 0) + dt * (attacking ? 1 : IDLE_RATE));
        // punching from here only hits the plated crate or the wall next to it: try another side (LOOT2)
        if (attacking) lm.spotNoProgress += dt;
        if (lm.spotNoProgress > REPOSITION) {
            lm.spotNoProgress = 0;
            lm.standShift++;
            lm.repositionUntil = now + REPOSITION_TIME;
        }
    }
    if ((lm.noProgress.get(id) ?? 0) > NO_PROGRESS) {
        giveUp(ctx, id, GIVE_UP);
        return true;
    }
    // working on it close by without a single hit for this long, whatever the stand spots and stall clocks say: give up
    // (adversarial review: a damaged crate shrunk inside a stack, out of fist reach, guns vetoed by the plated crate
    // next to it; every new stand spot restarted the stall clock and the bot pushed at it for 40 s)
    if (distanceToCollider(self.pos, o.col) < NO_HIT_NEAR) lm.breakNoHit += dt;
    if (lm.breakNoHit > NO_HIT_GIVE_UP) {
        // the first time a short break, still committed (clearing a neighbour may open the way, LOOT2's stack case);
        // the second time for good
        const strikes = (lm.noHitStrikes.get(id) ?? 0) + 1;
        lm.noHitStrikes.set(id, strikes);
        if (strikes > 1) giveUp(ctx, id, GIVE_UP);
        else giveUp(ctx, id, STALL_BLACKLIST_MINE, lm.damaged.has(id));
        return true;
    }
    if (inReach || !lm.stallPos || v2.distance(lm.stallPos, self.pos) > 0.5 || dt >= 0.5) {
        lm.stallPos = v2.copy(self.pos);
        lm.stallSince = now;
    } else if (now - lm.stallSince > STALL_GIVE_UP) {
        // a damaged one that shrank out of reach inside a stack of crates: a short break to open the way (its
        // neighbours), then back to it, still committed (LOOT2)
        const mine = lm.damaged.has(id);
        giveUp(ctx, id, mine ? STALL_BLACKLIST_MINE : STALL_BLACKLIST, mine);
        return true;
    } else if (now - lm.stallSince > STALL * (lm.standShift + 1)) {
        lm.standShift++;
    }
    return false;
}

/**
 * The stand spot to go to now (the stand spots in turn; `punch`: those a punch lands from, when any), or null. The
 * choice is kept until the shift changes or the container shrinks: the list is sorted by the distance from the bot, so
 * indexing it afresh at every step flipped the bot between two spots on either side of a crate for good (LOOT2).
 */
function pickStand(ctx: BrainCtx, o: SeenObstacle, punch: boolean): Vec2 | null {
    const lm = ctx.mem.loot2;
    // (a container shrinks as it loses health: the spots move in with it)
    const same = lm.standFor === o.view.id && lm.standFrom === lm.standShift && lm.standHealthT === o.view.healthT;
    if (same && lm.standSpot) return lm.standSpot;
    let spots = standSpots(ctx, o);
    if (punch) {
        const landing = spots.filter((p) => swingLands(ctx, o, p));
        if (landing.length) spots = landing;
    }
    lm.standFor = o.view.id;
    lm.standFrom = lm.standShift;
    lm.standHealthT = o.view.healthT;
    lm.standSpot = spots.length ? spots[lm.standShift % spots.length] : null;
    return lm.standSpot;
}

/**
 * Walks to a spot to punch (or open) the container from: the stand spots in turn, the surface towards the bot last.
 * `punch`: only spots a punch lands from (swingLands), when there are any.
 */
function goToStand(ctx: BrainCtx, o: SeenObstacle, intent: Intent, punch = false): void {
    const spot = pickStand(ctx, o, punch);
    if (spot) {
        intent.goal = spot;
        intent.arriveDist = 0.3;
        return;
    }
    const me = ctx.self.pos;
    const c = colliderCenter(o.col);
    const out = v2.normalizeSafe(v2.sub(me, c));
    const p = v2.add(closestPoint(o, me), v2.mul(out, 1.3));
    const grid = containerGrid(ctx, o) ?? ctx.model.nav;
    const cell = grid.nearestWalkable(p, 3, grid === ctx.model.nav ? ctx.myComp : 0);
    intent.goal = cell >= 0 ? grid.center(cell) : p;
    intent.arriveDist = 0.3;
}

export function planBreak(ctx: BrainCtx, choice: BreakChoice): Intent {
    const intent = emptyIntent("break");
    const { mem, now, self } = ctx;
    const o = choice.obstacle;
    const lm = mem.loot2;
    mem.breakTarget = o.view.id;
    intent.aim = colliderCenter(o.col);
    // basements: the container's floor guides the path follower
    if (ctx.features.basements) intent.goalLayer = o.view.layer & 1;
    if (opening(ctx, o)) {
        // opened: it plays its opening for useDelay seconds, then its inner crate appears right here
        intent.stop = true;
        addCombatLayer(ctx, intent);
        return intent;
    }
    if (openable(o)) {
        // air drop crates open with Use within interactionRad of the player's circle (sim interact.ts)
        const reach = useReach(o);
        if (trackBreak(ctx, o, choice.dist < reach)) return intent;
        if (choice.dist < reach) {
            intent.stop = true;
            lm.attackId = o.view.id;
            lm.attackAt = now;
            if (now - mem.lastUseObstacle > 0.5) {
                mem.lastUseObstacle = now;
                intent.actions.push(Input.Use);
                lm.openId = o.view.id;
                lm.openUntil = now + (o.def.button?.useDelay ?? 2.5) + 1;
                lm.openPos = colliderCenter(o.col);
            }
        } else if (choice.dist < APPROACH_DIST + 1 && clearApproach(ctx, o)) {
            // the nav-snapped stand spot can leave the bot just short of the reach: the last steps go straight
            intent.moveDir = v2.normalizeSafe(v2.sub(closestPoint(o, self.pos), self.pos));
        } else {
            goToStand(ctx, o, intent);
        }
        addCombatLayer(ctx, intent);
        return intent;
    }
    // shoot it with ammo to spare and a gun that hits what it aims at, otherwise punch it; a damaged container the fists
    // cannot get at any more (it shrank away inside a stack of crates) is finished with whatever loaded gun fits (LOOT2)
    const stalled =
        lm.breakId === o.view.id && !!lm.stallPos && now - lm.breakTracked < 0.6 && now - lm.stallSince > STALL;
    const rich = breakGun(ctx, o) ?? (stalled && committed(ctx, o) ? breakGun(ctx, o, true) : undefined);
    const reach = rich ? SHOOT_RANGE : meleeReach(self);
    intent.slot = rich ? rich.slot : WeaponSlot.Melee;
    // (a shot needs a clear line to the container: from behind a wall it only hits the wall)
    const clear = clearApproach(ctx, o);
    let inReach = choice.dist <= reach && clear;
    // a punch from here would land on the plated crate or the wall next to it: another side first (LOOT2)
    // (standing at the spot it picked is good enough: it cannot always squeeze into it exactly)
    const atSpot = lm.standFor === o.view.id && !!lm.standSpot && v2.distance(lm.standSpot, self.pos) < 0.8;
    let blocked = inReach && !rich && !atSpot && !swingLands(ctx, o, self.pos) && hasLandingSpot(ctx, o);
    // ... or punches from here did not hurt it: walk to the next stand spot before trying again
    if (!blocked && lm.breakId === o.view.id && now < lm.repositionUntil) {
        const spot = pickStand(ctx, o, !rich);
        if (spot && v2.distance(spot, self.pos) > 0.6) blocked = true;
        else lm.repositionUntil = 0;
    }
    if (blocked) inReach = false;
    if (trackBreak(ctx, o, inReach)) return intent;
    if (inReach) {
        intent.stop = true;
        intent.fire = self.curWeapIdx === intent.slot;
        // the swing circle sits in front of the bot: face the closest point of the container, not its centre
        if (!rich) intent.aim = closestPoint(o, self.pos);
    } else if (choice.dist < APPROACH_DIST && clear && !blocked && !stalled) {
        // (after a stall the straight line stays blocked, wedged between crates: the stand spots take over)
        // (the line to the container's centre always crosses the container itself: check the way to its surface)
        intent.moveDir = v2.normalizeSafe(v2.sub(closestPoint(o, self.pos), self.pos));
        intent.aim = closestPoint(o, self.pos);
    } else {
        goToStand(ctx, o, intent, !rich);
    }
    const want = { slot: intent.slot, aim: intent.aim };
    addCombatLayer(ctx, intent);
    // an enemy in view that does not threaten the bot and is not shot at does not stop the attack: the combat layer
    // drew the gun and held fire, the container stood untouched and its give-up clock ran out (LOOT2)
    if (inReach && !intent.fire && (intent.slot !== want.slot || intent.aim !== want.aim) && !underThreat(ctx)) {
        intent.slot = want.slot;
        intent.aim = want.aim;
        intent.targetId = 0;
        intent.fire = self.curWeapIdx === want.slot;
    }
    if (inReach && intent.fire && intent.aim === want.aim && self.curWeapIdx === want.slot) {
        lm.attackId = o.view.id;
        lm.attackAt = now;
    }
    return intent;
}
