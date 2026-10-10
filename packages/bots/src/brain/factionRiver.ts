// 50v50 river discipline (BrainFeatures.faction; owner report 2026-10-08: "most of the faction's bots stand in the
// river"). The main river is the 50v50 front (docs/research/modes/faction.md "Map"): a player in its water moves at
// water speed (sim world/player.ts: -PLAYER.waterSpeedPenalty, 12 -> 9 u/s, survev's water speed) on open ground with
// no cover, in the enemy bank's sights. The faction bots held spots computed from half the water's true half width
// (perception/factionMap.ts), so their bank, crossing and formation spots lay in the water. Here: spots are kept on a
// bank (dryOn: past the riverbank onto the grass, where cover grows) and snapped to dry cells (nearestDry: bridges and
// docks are dry, their floors override the water in the navigation grid), and no faction bot idles in water
// (keepDry, after every decision): standing still, holding, healing or fighting in the water turns into getting out
// on the nearer bank (its own bank when enemies are known on the other), crossing goes on. Crossing itself keeps to
// what the path needs: wading straight over (the navigation's water cost) or a bridge. And no errand takes a bot from
// its own bank over the river (keepErrandsHome): the owner wants the faction to hold its bank and cross attacking.
import { type Vec2, v2 } from "@rebirth/core";
import { nearestRiverPoint, riverSide } from "../perception/factionMap.ts";
import type { WorldModel } from "../perception/world.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { FACTION_TUNING, factionOf } from "./factionCtx.ts";
import { inStrike } from "./strikes.ts";

/** Bank spots lie this far past the riverbank's outer edge (on the grass, out of the river's open sand). */
export const BANK_CLEAR = 3;
/** A dry cell is looked for this far around a spot at most. */
const DRY_SEARCH = 12;
/** Out of the water: the nearest dry cell this close (a wide river's middle is farther from both banks). */
const EXIT_SEARCH = 24;
/** A goal in the water this close to the bot is a stop in the water: it moves onto the bank. */
const NEAR_GOAL = 8;
/**
 * Behaviours keepDry leaves alone: running from danger (they move anyway; an air strike's exit in the water moves onto
 * dry ground out of the strike when there is some), kneeling, orders. (An evade that stops to hide from unseen fire in
 * the water walks out instead.)
 */
const WET_OK = new Set<BehaviourName>(["evacuate", "flee", "disengage", "downed", "revive", "order", "idle"]);
/** A dry spot out of an air strike keeps this far past its edge (u). */
const STRIKE_PAD = 2;
/** Loot in the water is picked up (one step in, one out). */
const GRAB = new Set<BehaviourName>(["loot", "break", "airdrop"]);
/** Errands kept on the faction's own bank (keepErrandsHome); loot or a crate over the river is left alone this long. */
const ERRANDS = new Set<BehaviourName>(["loot", "break", "sweep", "explore", "basement", "puzzle"]);
const ERRAND_SKIP = 60;

/** Nearest walkable cell out of the water within `maxRadius` of `p` (in component `comp` when not 0), or -1. */
export function nearestDry(model: WorldModel, p: Vec2, maxRadius: number, comp = 0): number {
    const nav = model.nav;
    const start = nav.cellOf(p);
    const cs = nav.cellSize;
    const cx = start % nav.w;
    const cy = Math.floor(start / nav.w);
    const ok = (i: number) =>
        nav.walkable(i) && !nav.isWaterAt(nav.center(i)) && (comp === 0 || nav.component(i) === comp);
    if (ok(start)) return start;
    const maxR = Math.ceil(maxRadius / cs);
    for (let r = 1; r <= maxR; r++) {
        let best = -1;
        let bestD = Number.POSITIVE_INFINITY;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const x = cx + dx;
                const y = cy + dy;
                if (!nav.inside(x, y)) continue;
                const i = y * nav.w + x;
                if (!ok(i)) continue;
                const d = v2.distanceSqr(nav.center(i), p);
                if (d < bestD) {
                    bestD = d;
                    best = i;
                }
            }
        }
        if (best >= 0) return best;
    }
    return -1;
}

/** `p` on a dry cell near it (within DRY_SEARCH), else `p` itself. */
export function drySpot(ctx: BrainCtx, p: Vec2, radius = DRY_SEARCH): Vec2 {
    const cell = FACTION_TUNING.dry
        ? nearestDry(ctx.model, p, radius, ctx.myComp)
        : ctx.model.nav.nearestWalkable(p, radius, ctx.myComp);
    return cell >= 0 ? ctx.model.nav.center(cell) : p;
}

/**
 * `p` kept out of the main river on bank `side` (riverSide sign; 0: the faction's own bank, or `p`'s): a spot in the
 * water band or on the riverbank, or on the other bank when `side` is given, moves along the river's normal to
 * BANK_CLEAR past the riverbank on that bank. Spots already on that bank's grass stay. Not snapped to a cell.
 */
export function dryOn(ctx: BrainCtx, p: Vec2, side = 0): Vec2 {
    const geo = factionOf(ctx)?.geo;
    if (!geo || !FACTION_TUNING.dry) return p;
    const s = riverSide(geo, p);
    const { point, dir, bank } = nearestRiverPoint(geo, p);
    const want = side || factionOf(ctx)?.side || Math.sign(s) || 1;
    if (s * want >= bank + BANK_CLEAR) return p;
    const left = { x: -dir.y, y: dir.x };
    return v2.add(point, v2.mul(left, want * (bank + BANK_CLEAR)));
}

/**
 * A cover search's filter (combat.ts findCoverFrom) that turns down spots in the water: a river stone hides a player
 * standing in the river at water speed. Off with FACTION_TUNING.dry (every spot accepted).
 */
export function dryCover(ctx: BrainCtx): (spot: Vec2) => boolean {
    return (spot) => !FACTION_TUNING.dry || !ctx.model.nav.isWaterAt(spot);
}

/** Whether the bot stands in water now (bridges and docks are dry: their floors override the navigation's terrain). */
export function inWater(ctx: BrainCtx): boolean {
    return ctx.model.nav.isWaterAt(ctx.self.pos);
}

/** The bank to get out on from the water: the nearer one, the own bank when enemies are known near the other. */
function exitSide(ctx: BrainCtx): number {
    const fi = factionOf(ctx);
    const geo = fi?.geo;
    if (!fi || !geo) return 0;
    const near = Math.sign(riverSide(geo, ctx.self.pos)) || fi.side;
    if (!fi.side || near === fi.side) return near;
    const ahead = v2.add(ctx.self.pos, v2.mul(fi.forward(ctx.self.pos) ?? { x: 0, y: 0 }, 20));
    return fi.enemiesNear(ctx.model, ahead, 40, 8) > 0 ? fi.side : near;
}

/**
 * After the decision, before keepDry: a faction bot on its own bank (or in the river) does not cross the main river on
 * an errand (loot, a crate, a house to sweep or explore, a basement, a puzzle) to the other bank, the enemy's, wading
 * at water speed in the open to stand alone over there (owner 2026-10-08: hold the own bank, cross at bridges or
 * quickly attacking; seed 11's Commander waded over for loot from the river's edge and took its group with it). Loot
 * and crates over there are left alone for ERRAND_SKIP; the other errands wait on the own bank across from their goal
 * until the bot picks another. Fights, pushes, the zone, flight, revives and air drops still cross; so does an errand
 * whose own bank across lies outside the next safe circle (a bot rotating over with the gas). A bot already over the
 * river goes about its errands there; a Recon scouts.
 */
export function keepErrandsHome(ctx: BrainCtx, intent: Intent): void {
    const fi = factionOf(ctx);
    const geo = fi?.geo;
    const goal = intent.goal;
    if (!fi || !geo || !fi.side || !goal || !FACTION_TUNING.dry || !ERRANDS.has(intent.behaviour)) return;
    if (fi.role === "recon") return;
    // not over on the other bank itself, the goal over there
    const me = ctx.self.pos;
    if (riverSide(geo, me) * fi.side < -nearestRiverPoint(geo, me).water) return;
    if (riverSide(geo, goal) * fi.side >= -nearestRiverPoint(geo, goal).water) return;
    const home = drySpot(ctx, dryOn(ctx, goal, fi.side), DRY_SEARCH);
    if (!ctx.model.insideSafeZone(home)) return;
    // (the loot or the crate is left alone for a while, as after a failed path: bot.ts)
    const mem = ctx.mem;
    if (intent.behaviour === "loot" && mem.lootTarget) mem.lootBlacklist.set(mem.lootTarget, ctx.now + ERRAND_SKIP);
    if (intent.behaviour === "break" && mem.breakTarget) mem.lootBlacklist.set(mem.breakTarget, ctx.now + ERRAND_SKIP);
    intent.goal = home;
    intent.arriveDist = 2;
    intent.stop = false;
    ctx.mem.faction.errandsHeld++;
}

/**
 * After the decision: a faction bot in the water that would stand still there (holding, healing, its slot, a fight's
 * strafe or a goal in the water a few steps off) walks out onto the bank instead; the rest of the intent (aim, fire,
 * items) stays. A goal on dry land, or a far one the path wades towards, is left alone.
 */
export function keepDry(ctx: BrainCtx, intent: Intent): void {
    if (!factionOf(ctx) || !FACTION_TUNING.dry || ctx.self.downed) return;
    const model = ctx.model;
    const goal = intent.goal;
    // out of an air strike onto dry ground when there is some out of it near the exit it picked (seed 11's group at
    // the bank fled a strike into the river and stood there while it fell)
    if (intent.behaviour === "evacuate" && goal && model.nav.isWaterAt(goal)) {
        const dry = nearestDry(model, goal, DRY_SEARCH, ctx.myComp);
        if (dry >= 0 && !inStrike(ctx, model.nav.center(dry), STRIKE_PAD)) intent.goal = model.nav.center(dry);
        return;
    }
    if (WET_OK.has(intent.behaviour)) return;
    if (goal && !model.nav.isWaterAt(goal)) return;
    const wet = inWater(ctx);
    if (goal) {
        // a goal in the water: a far one is a crossing (or a way through), a near one a stop in the water
        if (v2.distance(goal, ctx.self.pos) > NEAR_GOAL || GRAB.has(intent.behaviour)) return;
        const dry = nearestDry(model, goal, DRY_SEARCH, ctx.myComp);
        if (dry < 0) return;
        const to = model.nav.center(dry);
        if (intent.behaviour === "zone" && !model.insideSafeZone(to)) return;
        intent.goal = to;
        intent.arriveDist = Math.min(intent.arriveDist, 1.5);
        return;
    }
    if (!wet || (intent.moveDir && intent.behaviour !== "fight" && intent.behaviour !== "hold")) return;
    const geo = factionOf(ctx)?.geo;
    const side = geo ? exitSide(ctx) : 0;
    const target = geo ? dryOn(ctx, ctx.self.pos, side) : ctx.self.pos;
    // the chosen bank's spot across the river's normal, else the nearest dry cell around
    const dry = nearestDry(model, target, EXIT_SEARCH, ctx.myComp);
    const cell = dry >= 0 ? dry : nearestDry(model, ctx.self.pos, EXIT_SEARCH, ctx.myComp);
    if (cell < 0) return;
    const to = model.nav.center(cell);
    if (intent.behaviour === "zone" && !model.insideSafeZone(to)) return;
    intent.goal = to;
    intent.arriveDist = 1.5;
    intent.moveDir = null;
    intent.stop = false;
    ctx.mem.faction.wetExits++;
}
