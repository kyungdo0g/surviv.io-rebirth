// What a bot knows of a puzzle site's state (BrainFeatures.puzzles), as a player would (review of the interactions:
// the snapshot holds the obstacles of both floors, the ones under roofs the bot is not under and a margin past the
// screen edge, and the puzzle behaviour read them all). A door, a piece or a button is read only while the client draws
// it on the bot's screen (perception/drawn.ts: its floor, on the screen, not under a foreign roof; a door shows from
// either side of its panel); otherwise its state is unknown. A site door seen open, or heard opening (perception/
// doorWatch.ts belief: door sounds carry to the other floor too), stays known open (PuzzleMemory.seenOpen) until it is
// seen or heard shut: a door someone else opened out of the bot's sight it learns like a human, on arrival or by ear.
import type { Vec2 } from "@rebirth/core";
import type { DoorWatch } from "../perception/doorWatch.ts";
import { drawnObstacle } from "../perception/drawn.ts";
import type { SeenObstacle } from "../perception/world.ts";
import type { BrainCtx } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { floorGrid, type PuzzleSite, pieceFront, puzzleSites, type SiteDoor } from "./puzzleSites.ts";

/** Obstacle `id` as the bot sees it now (in the snapshot and drawn: `normal` for a door), else undefined: unknown. */
export function seenOf(ctx: BrainCtx, id: number, normal: Vec2 | null = null): SeenObstacle | undefined {
    const o = ctx.model.obstacleById.get(id);
    return o && drawnObstacle(ctx.model, o, normal) ? o : undefined;
}

/** A site door as the bot sees it now, else undefined. */
export function seenDoor(ctx: BrainCtx, d: SiteDoor): SeenObstacle | undefined {
    return seenOf(ctx, d.id, d.normal);
}

/** A piece of `site` by id as the bot sees it now, else undefined. */
export function seenPiece(ctx: BrainCtx, site: PuzzleSite, id: number): SeenObstacle | undefined {
    const p = site.pieces.find((x) => x.id === id);
    return p ? seenOf(ctx, id, p.normal) : undefined;
}

/**
 * First in every decision (Brain.think, after the door watch): the site doors the bot sees now update what it knows of
 * them, else what the door watch believes (seen or heard; null with BrainFeatures.doors off).
 */
export function observePuzzleDoors(ctx: BrainCtx, watch: DoorWatch | null): void {
    const known = ctx.mem.puzzle.seenOpen;
    for (const site of puzzleSites(ctx.model.map)) {
        for (const d of site.doors) {
            const door = seenDoor(ctx, d)?.view.door;
            const open = door ? door.open : watch?.belief(d.id);
            if (open === true) known.add(d.id);
            else if (open === false) known.delete(d.id);
        }
    }
}

/** Whether the bot knows a door of the site open (seen or heard, BrainMemory.puzzle.seenOpen). */
export function knownOpen(ctx: BrainCtx, site: PuzzleSite): boolean {
    const known = ctx.mem.puzzle.seenOpen;
    return site.doors.some((d) => known.has(d.id));
}

/** Whether the site is done with as the bot knows it: a door known open, or a piece seen broken (a shot police panel). */
export function seenSpent(ctx: BrainCtx, site: PuzzleSite): boolean {
    if (knownOpen(ctx, site)) return true;
    return site.pieces.some((p) => seenOf(ctx, p.id, p.normal)?.view.dead);
}

/** Whether the pieces the bot sees are all off and usable (nobody else's input, no reset running); unseen: no veto. */
export function piecesIdle(ctx: BrainCtx, site: PuzzleSite): boolean {
    for (const p of site.pieces) {
        const b = seenOf(ctx, p.id, p.normal)?.view.button;
        if (b && (b.onOff || !b.canUse)) return false;
    }
    return true;
}

/** Whether a door of the site is out of the bot's sight now (another floor, off the screen, under a roof). */
export function doorUnseen(ctx: BrainCtx, site: PuzzleSite): boolean {
    return site.doors.some((d) => !seenDoor(ctx, d));
}

/**
 * BrainFeatures.pursuit: the site's first piece, its front or one of its rooms lies in a place the bot was chased out of
 * (or the way there crosses one: brain/danger.ts avoidPos). An unarmed bot that fled a gunman at the police panel waited
 * out the site's THREAT_COOLDOWN (25 s) and walked straight back in while the building's danger memory (120 s per
 * flight) still held (review of the interactions, the round 5 house loop through the puzzle behaviour).
 */
export function siteInDanger(ctx: BrainCtx, site: PuzzleSite): boolean {
    if (!ctx.features.pursuit) return false;
    const first = site.pieces[0];
    if (!first) return false;
    if (avoidPos(ctx, first.pos)) return true;
    const grid = floorGrid(ctx.model, first.layer, first.pos);
    const front = grid ? pieceFront(site, first, grid) : null;
    if (front && avoidPos(ctx, front.spot)) return true;
    return site.rooms.some((r) => avoidPos(ctx, r.center));
}
