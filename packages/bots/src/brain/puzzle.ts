// Puzzles, switches, control panels and vault doors (BrainFeatures.puzzles, the "puzzle" behaviour): a bot near a
// locked room whose way in it knows (knowledge/puzzles.ts: the club's круг, the bathhouse switch, the police cell
// panel, the bank vault door, ...) walks to the pieces and presses them in order with Use, like a player: from the
// face a player stands at (brain/puzzleSites.ts pieceFront), within the server's reach (interactionRad plus the
// player's radius), each press checked on the next snapshots (the piece switches on: ObstacleView.button) before the
// next one, inside the puzzle's piece window (pieceResetDelay), after a short human pause. A wrong input shows (the
// building's errSeq, or the pieces switching back off): a bot that slipped (a beginner pressing two pieces the wrong
// way round, knowledge/puzzles.ts SLIP_CHANCE) waits for the reset and tries once more the right way; any other
// failure ends it for a long while. Then it waits for the doors (completeUseDelay, a panel's useDelay, a vault door's
// openDelay), walks in and breaks the containers inside (brain/puzzleRoom.ts); the loot behaviour picks up what drops.
//
// Only when it is quiet: no enemy in view or seen close lately, no hit and no bullet passing close for a while, out of
// the gas, healthy, the site inside the safe zone. Any of that changing ends it at once (the site waits a while):
// nobody camps a puzzle with enemies around; nor while the site lies in a place the bot was chased out of (BrainFeatures
// .pursuit danger memory). Fair: the state of a door, a piece or a button is read only while the client draws it on
// the bot's screen (brain/puzzleSight.ts: its floor, on the screen, not under a roof the bot is not under), a door known
// open stays known (seen or heard), and a piece is pressed only when it is drawn and on its floor; positions come from
// MapData and the defs (the minimap and the labels painted next to the pieces); the solutions are learned knowledge,
// never the server's codes.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, Input } from "@rebirth/defs";
import type { BuildingView } from "@rebirth/sim";
import { colliderCenter, distanceToCollider } from "../geom.ts";
import { drawPuzzleKnowledge, SLIP_CHANCE } from "../knowledge/puzzles.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import type { SeenObstacle } from "../perception/world.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import type { PuzzleMemory } from "./puzzleMemory.ts";
import { planRoom, roomDone } from "./puzzleRoom.ts";
import { doorUnseen, knownOpen, piecesIdle, seenPiece, seenSpent, siteInDanger } from "./puzzleSight.ts";
import {
    floorGrid,
    type PieceFront,
    type PuzzleSite,
    pieceFront,
    puzzleSites,
    type SitePiece,
    siteUnderground,
} from "./puzzleSites.ts";
import { zonePressure } from "./survival.ts";
import { onLeash } from "./team.ts";

const PLAYER_RAD = GameConfig.player.radius;
/** A site this close (to the bot, NEUTRAL; scaled by the persona's thoroughness) is worth the detour. */
const NEAR = 60;
const CHECK_EVERY = 1;
/** Health below this: heal first, no puzzles. */
const HEALTHY = 55;
/** Quiet this long after a hit, a bullet passing close or a standing enemy in view. */
const QUIET = 5;
/** A remembered enemy seen this recently within ENEMY_NEAR is still around. */
const ENEMY_RECENT = 6;
const ENEMY_NEAR = 50;
/** Unseen gunfire this close (threat board) is too close for a puzzle. */
const HEARD_NEAR = 45;
/** Zone pressure (survival.ts) above which the bot leaves a site for the zone. */
const ZONE_LIMIT = 0.3;
/** A site left for a threat waits this long; one that failed this long. */
const THREAT_COOLDOWN = 25;
const FAIL_COOLDOWN = 240;
/** The pieces must all be off and usable (no one else's input, no reset running) within this long. */
const READY_WAIT = 12;
/** A press that does not show on the piece within this long is sent again, at most MAX_PRESSES times. */
const PRESS_RETRY = 1;
const MAX_PRESSES = 3;
/** The next press must come this much before the piece window closes. */
const WINDOW_MARGIN = 0.4;
/** The doors get this long past their delay to move before the attempt counts as failed. */
const DOOR_GRACE = 4;
/** Walking to a site, or to the next piece, takes at most this long (s): the way is blocked otherwise. */
const GO_LIMIT = 45;
const STEP_LIMIT = 12;
/** Use goes out a little inside the server's reach. */
const REACH_SLACK = 0.03;
/** Closer than this to the front spot (and the piece on the bot's floor), the last steps go straight at the piece. */
const STEP_IN = 2.8;
/** Human pause before a press (s), shorter for skilled bots. */
const PAUSE: readonly [number, number] = [0.15, 0.5];
/** Scores: walking there (plus the room's worth), pressing and waiting (above loot and crates), the room. */
const SCORE_GO = 0.36;
const SCORE_PRESS = 0.64;
const SCORE_ROOM = 0.5;

/** The solutions this bot knows (drawn on first use from its own stream). */
function knows(ctx: BrainCtx, name: string): boolean {
    const pm = ctx.mem.puzzle;
    pm.known ??= drawPuzzleKnowledge(pm.seed, ctx.skill, ctx.persona);
    return pm.known.has(name);
}

/** Whether nothing threatens the bot: quiet for a while, out of the gas, healthy, no enemy around. */
export function calm(ctx: BrainCtx): boolean {
    const { model, self, now } = ctx;
    if (self.downed || self.health < HEALTHY || model.inGasNow()) return false;
    if (now - model.lastHurt < QUIET) return false;
    if (model.underFire && now - model.underFire.time < QUIET) return false;
    if (now - ctx.mem.loot2.lastThreat < QUIET) return false;
    for (const e of ctx.enemies) {
        if (e.downed && !e.visible) continue;
        if (e.visible && !e.downed) return false;
        if (now - e.lastSeen < ENEMY_RECENT && v2.distance(e.pos, self.pos) < ENEMY_NEAR) return false;
    }
    if (ctx.features.threats) {
        for (const s of model.threats.unseenShooters()) {
            if (now - s.lastShot < QUIET && v2.distance(s.pos, self.pos) < HEARD_NEAR) return false;
        }
    }
    return true;
}

function buildingView(ctx: BrainCtx, site: PuzzleSite): BuildingView | undefined {
    return ctx.model.buildings.find((b) => b.id === site.buildingId);
}

/** A press shows: the button flipped (seq, onOff) or the door started (seq, used up, open). */
function pressShows(o: SeenObstacle, seq: number): boolean {
    const b = o.view.button;
    if (b) return b.seq !== seq || b.onOff;
    const d = o.view.door;
    return !!d && ((d.seq ?? 0) !== seq || !d.canUse || d.open);
}

/** A panel or a vault door that can still be used (not used up, not open, not locked). */
function usable(o: SeenObstacle): boolean {
    const b = o.view.button;
    if (b) return b.canUse && !b.onOff;
    const d = o.view.door;
    return !!d && d.canUse && !d.open && !d.locked;
}

function seqOf(o: SeenObstacle | undefined): number {
    return o?.view.button?.seq ?? o?.view.door?.seq ?? 0;
}

function pieceById(site: PuzzleSite, id: number): SitePiece | undefined {
    return site.pieces.find((p) => p.id === id);
}

function frontOf(ctx: BrainCtx, site: PuzzleSite, piece: SitePiece): PieceFront | null {
    const grid = floorGrid(ctx.model, piece.layer, piece.pos);
    return grid ? pieceFront(site, piece, grid) : null;
}

/** The pieces in the order of the code (a label on two pieces, МИХАИЛ's И: the one nearer the previous piece). */
function plannedOrder(site: PuzzleSite): number[] {
    if (site.entry.kind !== "code") return site.pieces.slice(0, 1).map((p) => p.id);
    const used = new Set<number>();
    const out: number[] = [];
    let prev: Vec2 | null = null;
    for (const label of site.code) {
        let best: SitePiece | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        for (const p of site.pieces) {
            if (p.label !== label || used.has(p.id)) continue;
            const d = prev ? v2.distance(prev, p.pos) : 0;
            if (d < bestD) {
                bestD = d;
                best = p;
            }
        }
        if (!best) return [];
        used.add(best.id);
        out.push(best.id);
        prev = best.pos;
    }
    return out;
}

/** Whether the bot could work this site at all: it knows the way in, has the floors' navigation and a front. */
function workable(ctx: BrainCtx, site: PuzzleSite): boolean {
    const e = site.entry;
    if (e.lore === "squad" || !knows(ctx, e.name)) return false;
    if (siteUnderground(site) && !ctx.model.underground) return false;
    if (plannedOrder(site).length === 0) return false;
    return site.pieces.every((p) => frontOf(ctx, site, p) !== null);
}

/** The nearest site worth working now, or null. */
function chooseSite(ctx: BrainCtx): PuzzleSite | null {
    const { model, self, now } = ctx;
    const pm = ctx.mem.puzzle;
    const near = NEAR * (0.7 + 0.6 * ctx.persona.lootThoroughness);
    let best: PuzzleSite | null = null;
    let bestD = near;
    for (const site of puzzleSites(model.map)) {
        if (pm.finished.has(site.index) || now < (pm.cooldown.get(site.index) ?? 0)) continue;
        const first = site.pieces[0];
        const d = v2.distance(self.pos, first.pos);
        if (d >= bestD) continue;
        if (seenSpent(ctx, site)) {
            pm.finished.add(site.index);
            continue;
        }
        if (!model.insideSafeZone(first.pos, 6) || !onLeash(ctx, first.pos) || !workable(ctx, site)) continue;
        // a place the bot was chased out of waits as long as the danger memory holds it (pursuit)
        if (siteInDanger(ctx, site)) continue;
        // a teammate closer to it does it (two players pressing the same switches spoil each other's input)
        if (model.team.some((m) => m.playerId !== self.id && !m.dead && v2.distance(m.pos, first.pos) < d)) continue;
        const front = frontOf(ctx, site, first);
        if (!front) continue;
        const layer = first.layer & 1;
        const ug = model.underground;
        const reach = ug
            ? ug.canPathTo(model.nav, self.pos, self.layer, front.spot, layer)
            : layer === 0 && model.nav.reachable(self.pos, front.spot);
        if (!reach) continue;
        bestD = d;
        best = site;
    }
    return best;
}

function clear(pm: PuzzleMemory): void {
    pm.site = -1;
    pm.stage = "go";
    pm.order = [];
    pm.slipped = false;
    pm.step = 0;
    pm.pressId = 0;
    pm.pressTries = 0;
    pm.errSeq = -1;
    pm.tries = 0;
    pm.roomTarget = 0;
    pm.roomSkip.clear();
    pm.cleared.clear();
    pm.visited.clear();
}

/** Leaves the site for `cooldown` seconds (a threat, a failure). */
export function leaveSite(ctx: BrainCtx, cooldown: number): void {
    const pm = ctx.mem.puzzle;
    if (pm.site >= 0) pm.cooldown.set(pm.site, ctx.now + cooldown);
    clear(pm);
    pm.checkAt = ctx.now + CHECK_EVERY;
}

/** Done with the site for good. */
export function finishSite(ctx: BrainCtx): void {
    const pm = ctx.mem.puzzle;
    if (pm.site >= 0) pm.finished.add(pm.site);
    clear(pm);
    pm.checkAt = ctx.now + CHECK_EVERY;
}

function setStage(ctx: BrainCtx, stage: PuzzleMemory["stage"]): void {
    const pm = ctx.mem.puzzle;
    pm.stage = stage;
    pm.since = ctx.now;
    if (stage === "room") forgetVerdicts(ctx, pm.site);
}

/**
 * The doors just opened: verdicts taken while they were shut (the vault's deposit boxes have no stand spot, the item
 * behind the wall cannot be reached: scavenge.ts and explore.ts blacklist those) no longer hold.
 */
function forgetVerdicts(ctx: BrainCtx, index: number): void {
    const site = puzzleSites(ctx.model.map)[index];
    if (!site) return;
    const black = ctx.mem.lootBlacklist;
    for (const room of site.rooms) {
        for (const id of room.containers) black.delete(id);
        for (const l of ctx.model.loot.values()) {
            const b = room.bounds;
            if (l.pos.x >= b.min.x && l.pos.x <= b.max.x && l.pos.y >= b.min.y && l.pos.y <= b.max.y)
                black.delete(l.id);
        }
    }
    if (ctx.mem.failedGoal && site.rooms.some((r) => v2.distance(r.center, ctx.mem.failedGoal as Vec2) < 12)) {
        ctx.mem.failedGoal = null;
    }
}

/** Starts an attempt: the order to press (a slip swaps two neighbours), from the first step. */
function startAttempt(ctx: BrainCtx, site: PuzzleSite, slipOk: boolean): void {
    const pm = ctx.mem.puzzle;
    pm.order = plannedOrder(site);
    pm.slipped = false;
    if (slipOk && pm.order.length >= 2 && ctx.rng.next() < SLIP_CHANCE[ctx.skill.tier]) {
        const i = ctx.rng.int(0, pm.order.length - 2);
        [pm.order[i], pm.order[i + 1]] = [pm.order[i + 1], pm.order[i]];
        pm.slipped = true;
    }
    pm.step = 0;
    pm.pressId = 0;
    pm.pressTries = 0;
    pm.errSeq = -1;
    pm.lastOn = Number.NEGATIVE_INFINITY;
}

/** A failed attempt: one retry the right way after a slip, else the site waits a long while. */
function fail(ctx: BrainCtx, site: PuzzleSite): void {
    const pm = ctx.mem.puzzle;
    pm.tries++;
    if (pm.slipped && pm.tries < 2) {
        startAttempt(ctx, site, false);
        setStage(ctx, "ready");
        return;
    }
    leaveSite(ctx, FAIL_COOLDOWN);
}

/** The building's error counter grew since the attempt started (a wrong code or the piece window ran out). */
function errored(ctx: BrainCtx, site: PuzzleSite): boolean {
    const pm = ctx.mem.puzzle;
    const err = buildingView(ctx, site)?.puzzle?.errSeq;
    if (err === undefined) return false;
    if (pm.errSeq < 0) {
        pm.errSeq = err;
        return false;
    }
    return err > pm.errSeq;
}

/** Moves the attempt on from what the snapshot shows (every think while the site is worked on). */
function advance(ctx: BrainCtx, site: PuzzleSite): void {
    const pm = ctx.mem.puzzle;
    const now = ctx.now;
    const entry = site.entry;
    if (pm.stage === "room") return;
    // the doors known open (seen or heard): someone solved it (or the bot did): in to loot
    if (knownOpen(ctx, site)) {
        setStage(ctx, "room");
        return;
    }
    if (seenSpent(ctx, site)) {
        finishSite(ctx);
        return;
    }
    const solved = !!buildingView(ctx, site)?.puzzle?.solved;
    if (pm.stage === "go") {
        const first = pieceById(site, pm.order[0]);
        const front = first ? frontOf(ctx, site, first) : null;
        if (!first || !front) {
            leaveSite(ctx, FAIL_COOLDOWN);
            return;
        }
        const there = v2.distance(ctx.self.pos, front.spot) < 3 && sameLayer(ctx.self.layer, first.layer);
        if (there && seenPiece(ctx, site, first.id)) setStage(ctx, "ready");
        else if (now - pm.since > GO_LIMIT) leaveSite(ctx, FAIL_COOLDOWN);
        return;
    }
    if (pm.stage === "ready") {
        if (solved) {
            setStage(ctx, "wait");
            return;
        }
        // panels and doors: still usable, or used up already (someone pressed it: the doors are on their way)
        if (entry.kind !== "code") {
            const first = seenPiece(ctx, site, pm.order[0]);
            if (first && usable(first)) {
                pm.readyAt = now + reaction(ctx);
                setStage(ctx, "press");
            } else setStage(ctx, "wait");
            return;
        }
        if (piecesIdle(ctx, site)) {
            pm.errSeq = buildingView(ctx, site)?.puzzle?.errSeq ?? -1;
            pm.readyAt = now + reaction(ctx);
            setStage(ctx, "press");
        } else if (now - pm.since > READY_WAIT) {
            leaveSite(ctx, THREAT_COOLDOWN);
        }
        return;
    }
    if (pm.stage === "press") {
        if (solved) {
            setStage(ctx, "wait");
            return;
        }
        if (errored(ctx, site)) {
            fail(ctx, site);
            return;
        }
        // a piece pressed earlier in this attempt is off again: the input was reset
        for (let i = 0; i < pm.step; i++) {
            const b = seenPiece(ctx, site, pm.order[i])?.view.button;
            if (b && !b.onOff && entry.kind === "code") {
                fail(ctx, site);
                return;
            }
        }
        const id = pm.order[pm.step];
        const o = seenPiece(ctx, site, id);
        if (pm.pressId === id && o) {
            if (pressShows(o, pm.pressSeq)) {
                pm.step++;
                pm.lastOn = now;
                pm.pressId = 0;
                pm.pressTries = 0;
                pm.readyAt = now + reaction(ctx);
                if (pm.step >= pm.order.length) setStage(ctx, "wait");
                return;
            }
            if (now - pm.pressedAt > PRESS_RETRY) {
                pm.pressId = 0;
                if (++pm.pressTries >= MAX_PRESSES) fail(ctx, site);
                return;
            }
        }
        // the next piece cannot come in time any more: the input will reset (or the way to it is blocked)
        if (pm.step > 0 && pm.pressId !== id && now - pm.lastOn > entry.pieceWindow - WINDOW_MARGIN) fail(ctx, site);
        else if (now - Math.max(pm.since, pm.lastOn) > STEP_LIMIT) fail(ctx, site);
        return;
    }
    // wait: the doors move after the delay; an error (a slip) shows at once
    if (entry.kind === "code" && errored(ctx, site)) {
        fail(ctx, site);
        return;
    }
    if (now - pm.since > entry.openAfter + DOOR_GRACE) {
        // solved (or the panel used) and no door seen or heard opening: one out of its sight opened (the bathhouse's
        // vault below the switch): in to look; every door in view and still shut: they did not open
        if (solved || entry.kind !== "code") {
            if (doorUnseen(ctx, site)) setStage(ctx, "room");
            else finishSite(ctx);
        } else fail(ctx, site);
    }
}

function reaction(ctx: BrainCtx): number {
    const slow = 1 - 0.5 * ctx.skill.s;
    return ctx.rng.range(PAUSE[0], PAUSE[1]) * slow;
}

/** Utility of working a puzzle site now (0 keeps the behaviour out of the choice). */
export function puzzleScore(ctx: BrainCtx): number {
    const pm = ctx.mem.puzzle;
    const { now, model } = ctx;
    if (pm.site < 0) {
        if (now < pm.checkAt) return 0;
        pm.checkAt = now + CHECK_EVERY;
        if (!calm(ctx)) return 0;
        const site = chooseSite(ctx);
        if (!site) return 0;
        clear(pm);
        pm.site = site.index;
        startAttempt(ctx, site, true);
        setStage(ctx, "go");
    }
    const site = puzzleSites(model.map)[pm.site];
    if (!site) {
        clear(pm);
        return 0;
    }
    // a threat ends it at once: nobody camps a puzzle with enemies around (nor in a place it was chased out of)
    if (!calm(ctx) || zonePressure(model) > ZONE_LIMIT || siteInDanger(ctx, site)) {
        leaveSite(ctx, THREAT_COOLDOWN);
        return 0;
    }
    advance(ctx, site);
    if (pm.site < 0) return 0;
    if (pm.stage === "room") {
        if (!roomDone(ctx, site)) return SCORE_ROOM;
        finishSite(ctx);
        return 0;
    }
    if (pm.stage === "go") return SCORE_GO + 0.2 * (site.entry.value / 100);
    return SCORE_PRESS;
}

/** Walks to a spot on a floor (goal layer for the underground navigation). */
function walkTo(intent: Intent, p: Vec2, layer: number, arrive: number): void {
    intent.goal = v2.copy(p);
    intent.goalLayer = layer & 1;
    intent.arriveDist = arrive;
}

/** Use at a piece: walk to its front, step in against it, press once in reach after the pause. */
function pressPiece(ctx: BrainCtx, site: PuzzleSite, piece: SitePiece, intent: Intent): void {
    const pm = ctx.mem.puzzle;
    const me = ctx.self.pos;
    const front = frontOf(ctx, site, piece);
    if (!front) return;
    const o = seenPiece(ctx, site, piece.id);
    const floor = sameLayer(ctx.self.layer, piece.layer);
    const c = colliderCenter(piece.col);
    intent.lookAt = c;
    if (!o || !floor) {
        walkTo(intent, front.spot, piece.layer, 0.6);
        return;
    }
    const d = distanceToCollider(me, piece.col);
    if (d < piece.reach + PLAYER_RAD - REACH_SLACK) {
        intent.stop = true;
        if (pm.pressId !== piece.id && ctx.now >= pm.readyAt) {
            intent.actions.push(Input.Use);
            pm.pressId = piece.id;
            pm.pressedAt = ctx.now;
            pm.pressSeq = seqOf(o);
            // the doors this press may set moving: the bot knows it is its own doing (no door alert, brain/doors.ts)
            const until = ctx.now + site.entry.openAfter + DOOR_GRACE;
            for (const door of site.doors) ctx.mem.ownDoors.set(door.id, until);
        }
        return;
    }
    if (v2.distance(me, front.spot) < STEP_IN || d < STEP_IN) {
        // the last steps straight at the face's middle (a person leans into the switch), or at the piece over what
        // stands in front of it (a bottle on the saloon's bar counter: puzzleSites.ts pieceFront)
        intent.moveDir = v2.normalizeSafe(v2.sub(front.lean, me), v2.mul(front.face, -1));
        intent.nudge = true;
        return;
    }
    walkTo(intent, front.spot, piece.layer, 0.5);
}

export function planPuzzle(ctx: BrainCtx): Intent {
    const intent = emptyIntent("puzzle");
    const pm = ctx.mem.puzzle;
    const site = pm.site >= 0 ? puzzleSites(ctx.model.map)[pm.site] : undefined;
    if (!site) return intent;
    if (pm.stage === "room") {
        planRoom(ctx, site, intent);
        intent.behaviour = "puzzle";
    } else if (pm.stage === "wait") {
        // stand by the pieces facing the doors
        intent.stop = true;
        const door = site.doors[0];
        if (door) intent.lookAt = v2.copy(door.pos);
    } else {
        const piece = pieceById(site, pm.order[Math.min(pm.step, pm.order.length - 1)]);
        if (piece) {
            if (pm.stage === "press") pressPiece(ctx, site, piece, intent);
            else {
                const front = frontOf(ctx, site, piece);
                if (front) walkTo(intent, front.spot, piece.layer, pm.stage === "ready" ? 1.2 : 0.8);
                intent.lookAt = colliderCenter(piece.col);
            }
        }
    }
    addCombatLayer(ctx, intent);
    return intent;
}
