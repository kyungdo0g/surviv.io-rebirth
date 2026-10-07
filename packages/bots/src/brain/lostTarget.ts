// A fight target out of sight (round 3, user report 25, the combat side): the crosshair holds the spot it vanished at
// (perception/lastSeen.ts: the door or window it went under a roof by, the bush it walked into, the screen edge it left
// by) instead of a point extrapolated after it, and right after it vanished mid-fight into a bush or through a door the
// bot may prefire that spot with one short burst (spraying the bush a player just ran into is what people do). The
// prefire is decided once per vanishing: by persona from the persona rng (rushers almost always, marksmen and rats
// rarely), by game sense for a neutral bot (no draw); only with an automatic or burst gun (a shotgun up close) loaded
// to a quarter, a clear line to the spot, within PREFIRE_WINDOW of the loss and against an enemy that was shooting.
// The burst is aimed at the spot, not at the enemy (Intent.targetId 0): the bot does not see it. MOVE's search reads
// the same records (lastSeen.ts searchPoints); `prefireLayer` also prefires a fresh corner while the bot does
// something else (searching, chasing) and its crosshair is free.
import { type Vec2, v2 } from "@rebirth/core";
import { currentGun, type HeldGun } from "../knowledge/arsenal.ts";
import type { LastSeenTrack } from "../perception/lastSeen.ts";
import type { Contact } from "../perception/world.ts";
import { isNeutral, type PersonaName } from "../persona.ts";
import { leadPoint, returningFire } from "./combat.ts";
import type { BrainCtx, Intent } from "./context.ts";

/** The vanish spot is held this long after the loss (then the lead point, the old behaviour). */
const CORNER_HOLD = 3;
/** Prefire: within this long of the loss, from PREFIRE_MIN to PREFIRE_MAX units, one burst of BURST seconds. */
const PREFIRE_WINDOW = 2;
const PREFIRE_MIN = 3;
const PREFIRE_MAX = 30;
const BURST: [number, number] = [0.35, 0.7];
/** Shotguns prefire only this close. */
const SHOTGUN_PREFIRE = 10;
/** Chance a persona prefires a vanishing (design choice). */
const PREFIRE_CHANCE: Readonly<Record<Exclude<PersonaName, "neutral">, number>> = {
    rusher: 0.85,
    rifleman: 0.6,
    marksman: 0.15,
    camper: 0.45,
    looter: 0.35,
    rat: 0.15,
};

/** Where the crosshair holds for a lost target: its vanish spot while fresh, else its lead point. */
export function lostAim(ctx: BrainCtx, t: Contact): Vec2 {
    const tr = ctx.model.lastSeen.get(t.id);
    if (tr && ctx.now - tr.at < CORNER_HOLD) return v2.copy(tr.corner);
    return leadPoint(ctx, t);
}

/** A gun that suits a prefire at `d` units: automatic or burst, a shotgun close in; loaded to a quarter. */
function prefireGun(ctx: BrainCtx, d: number): HeldGun | null {
    const g = currentGun(ctx.self, ctx.guns);
    if (!g || g.mag < Math.max(1, g.info.def.maxClip * 0.25) || d > g.info.range) return null;
    if (g.info.cls === "shotgun") return d <= SHOTGUN_PREFIRE ? g : null;
    return g.info.def.fireMode === "single" ? null : g;
}

/** Whether this vanishing gets a prefire: decided once (persona rng, or game sense for a neutral bot). */
function wantsPrefire(ctx: BrainCtx, tr: Readonly<LastSeenTrack>): boolean {
    const f = ctx.mem.fight;
    if (f.prefireTarget === tr.id && f.prefireAt === tr.at) return f.prefireWanted;
    f.prefireTarget = tr.id;
    f.prefireAt = tr.at;
    f.prefireUntil = Number.NEGATIVE_INFINITY;
    const chance = isNeutral(ctx.persona)
        ? ctx.skill.g >= 0.5
            ? 1
            : 0
        : (PREFIRE_CHANCE[ctx.persona.name as Exclude<PersonaName, "neutral">] ?? 0.5);
    f.prefireWanted = chance >= 1 || (chance > 0 && ctx.personaRng.next() < chance);
    return f.prefireWanted;
}

/**
 * A short burst at the spot the lost enemy `id` vanished at (a bush, a door), when the rules above allow it. Returns
 * whether the intent now prefires (aim on the spot, fire on).
 */
export function prefireCorner(ctx: BrainCtx, intent: Intent, id: number): boolean {
    const { model, now, self } = ctx;
    const tr = model.lastSeen.get(id);
    if (!tr || (tr.cause !== "foliage" && tr.cause !== "roof") || now - tr.at > PREFIRE_WINDOW) return false;
    const c = model.contacts.get(id);
    if (!tr.hostile && !(c && returningFire(ctx, c))) return false;
    const d = v2.distance(self.pos, tr.corner);
    if (d < PREFIRE_MIN || d > PREFIRE_MAX || self.action.type !== "none") return false;
    const gun = prefireGun(ctx, d);
    if (!gun || !model.lineOfFire(self.pos, tr.corner) || !wantsPrefire(ctx, tr)) return false;
    const f = ctx.mem.fight;
    if (f.prefireUntil === Number.NEGATIVE_INFINITY) {
        f.prefireUntil = now + ctx.rng.range(BURST[0], BURST[1]);
        f.trace.add(now, "prefire", `${tr.cause} ${id} d ${d.toFixed(0)}`);
    }
    if (now >= f.prefireUntil) return false;
    intent.aim = v2.copy(tr.corner);
    intent.targetId = 0;
    intent.slot = gun.slot;
    intent.fire = true;
    return true;
}

/**
 * Prefire on top of another behaviour (searching, chasing, holding): the freshest hostile vanishing that qualifies,
 * while the intent neither aims nor fires (BrainFeatures.cover, from brain/alert.ts).
 */
export function prefireLayer(ctx: BrainCtx, intent: Intent): void {
    if (intent.aim || intent.fire || intent.throwPlan) return;
    for (const tr of ctx.model.lastSeen.all()) {
        if (ctx.now - tr.at > PREFIRE_WINDOW) break;
        if (prefireCorner(ctx, intent, tr.id)) return;
    }
}
