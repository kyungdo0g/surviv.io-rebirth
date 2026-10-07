// Faint targets (round 3, user report 26: "under a tree canopy a player is partly visible -> shoot probabilistically
// (lower confidence, short bursts), not perfect knowledge and not ignore"). An enemy whose whole body is under a tree
// canopy shows only faintly (perception/foliage.ts partial concealers, Contact.faint); bushes, tables and statues still
// hide it fully. The bot may engage a faint body, with less confidence than one in the open:
// - it notices it later: an extra delay on top of its reaction, longer for lower skill;
// - it fires short bursts with pauses (it is never sure it is on the body), each burst aimed at a fresh guess around it
//   (gaussian, 0.6-1.4 units by skill);
// - it gives up sooner: after 2-4.5 s (by skill) of faint sighting without the body ever showing clearly, the target is
//   dropped for FAINT_DROP s (it fires or gets hit: revealed, no longer faint, and the normal fight takes over);
// - the hand does not track it smoothly (bot.ts gives the motor no pursuit velocity for a faint target).
// Draws come from ctx.rng, only while a faint target is engaged; the decisions go to the combat trace.
import { type Vec2, v2 } from "@rebirth/core";
import { gaussian } from "../motor/noise.ts";
import type { Contact } from "../perception/world.ts";
import type { BrainCtx } from "./context.ts";

/** A faint sighting interrupted (a clear one, another target) for this long starts over. */
const FAINT_GAP = 0.6;
/** A faint target given up on is left alone this long (s). */
const FAINT_DROP = 5;
/** Extra notice delay (s) x (1.4 - 0.8 s): beginners 0.3-0.8 s, experts 0.2-0.4 s. */
const NOTICE: [number, number] = [0.25, 0.6];
/** Bursts (s) and the pauses between them (s). */
const BURST: [number, number] = [0.2, 0.45];
const PAUSE: [number, number] = [0.45, 0.9];

/** Whether the bot gave up on the faint target `c` for now (target selection skips it). */
export function faintDropped(ctx: BrainCtx, c: Contact): boolean {
    const f = ctx.mem.fight;
    return !!c.faint && f.faintDropId === c.id && ctx.now < f.faintDropUntil;
}

/** A clear sighting of `c` ends its faint engagement (the next faint one starts over). */
export function noteClear(ctx: BrainCtx, c: Contact): void {
    const f = ctx.mem.fight;
    if (f.faintTarget === c.id) f.faintTarget = 0;
    if (f.faintDropId === c.id) f.faintDropId = 0;
}

/**
 * Whether a shot at the faint target `c` may go now (its other gates passed): noticed, inside a burst, patience left.
 * Starts a burst (a fresh aim guess) when the pause is over; drops the target when patience runs out.
 */
export function faintGate(ctx: BrainCtx, c: Contact): boolean {
    const f = ctx.mem.fight;
    const now = ctx.now;
    if (f.faintDropId === c.id && now < f.faintDropUntil) return false;
    const s = ctx.skill.s;
    if (f.faintTarget !== c.id || now - f.faintLastAt > FAINT_GAP) {
        f.faintTarget = c.id;
        f.faintSince = now;
        f.faintNotice = ctx.rng.range(NOTICE[0], NOTICE[1]) * (1.4 - 0.8 * s);
        f.faintPatience = 2 + 2 * s + ctx.rng.range(0, 0.5);
        f.faintBurstUntil = Number.NEGATIVE_INFINITY;
        f.faintPauseUntil = Number.NEGATIVE_INFINITY;
        f.faintAim = { x: 0, y: 0 };
    }
    f.faintLastAt = now;
    if (now - f.faintSince > f.faintPatience) {
        f.faintDropId = c.id;
        f.faintDropUntil = now + FAINT_DROP;
        f.faintTarget = 0;
        f.trace.add(now, "faint", `drop ${c.id} after ${f.faintPatience.toFixed(1)} s`);
        return false;
    }
    if (now - f.faintSince < f.faintNotice) return false;
    if (now < f.faintBurstUntil) return true;
    if (now < f.faintPauseUntil) return false;
    f.faintBurstUntil = now + ctx.rng.range(BURST[0], BURST[1]);
    f.faintPauseUntil = f.faintBurstUntil + ctx.rng.range(PAUSE[0], PAUSE[1]);
    const sigma = 0.6 + 0.8 * (1 - s);
    f.faintAim = { x: gaussian(ctx.rng) * sigma, y: gaussian(ctx.rng) * sigma };
    return true;
}

/** Where the bot guesses the faint body of `c` is for this burst: `p` (its lead point) moved by the burst's guess. */
export function faintAim(ctx: BrainCtx, c: Contact, p: Vec2): Vec2 {
    const f = ctx.mem.fight;
    return c.faint && f.faintTarget === c.id ? v2.add(p, f.faintAim) : p;
}
