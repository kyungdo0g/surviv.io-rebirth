// A fight target that walked into smoke (round 3, user report 23: "spray into the smoke, throw a grenade into it, or
// hold the angle"; BrainFeatures.cover, the frag also BrainFeatures.grenades). A player whose centre is in a smoke cloud
// is left out of the snapshots (sim view.ts smokeHidesPlayers): the bot sees it walk in and no more, so there is no
// tracking through smoke. Once per smoke stand-off (the target and the time it vanished) the bot picks, by persona and
// situation:
// - "spray": short bursts into the cloud where the target's last heading leads (a fresh guess for every burst, never
//   the true position), at most SPRAY_CAP seconds of trigger time or half the magazine; then it holds;
// - "frag": a frag into the cloud, cooked to burst as it arrives (reason "smoke": brain/grenades.ts fragPlan), then it
//   holds;
// - "hold": the crosshair on the edge it will come out of (along its heading, or the edge facing the bot when it
//   stood still), from cover a few units away when there is some, else standing; at most HOLD_CAP.
// A neutral bot decides from the situation (a frag when it has one and the target was shooting, a spray with an
// automatic gun up close, else hold); persona draws come from the persona rng. Every choice goes to the combat trace.
import { type Vec2, v2 } from "@rebirth/core";
import type { SmokeView } from "@rebirth/sim";
import type { HeldGun } from "../knowledge/arsenal.ts";
import { gaussian } from "../motor/noise.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import type { LastSeenTrack } from "../perception/lastSeen.ts";
import type { Contact, WorldModel } from "../perception/world.ts";
import { isNeutral, type PersonaName } from "../persona.ts";
import { FRAG_TYPES, findCover, reactedTo } from "./combat.ts";
import type { SmokeChoice, SmokeStandoff } from "./combatMemory.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { fragMinDist } from "./fragMath.ts";
import { checksPath } from "./fragSkill.ts";
import { enemyClose, fragPlan } from "./grenades.ts";

/** A smoke stand-off lasts at most this long after the target vanished. */
const EPISODE = 6;
/** Spraying: bursts and pauses (s), at most SPRAY_CAP s of trigger time or SPRAY_MAG of the magazine. */
const BURST: [number, number] = [0.25, 0.45];
const PAUSE: [number, number] = [0.5, 0.9];
const SPRAY_CAP = 2;
const SPRAY_MAG = 0.5;
/** Each burst's guess scatters this much (units) around where the heading leads. */
const SPRAY_SCATTER = 1.2;
/** Holding the exit: at most this long, from cover this close to the bot. */
const HOLD_CAP = 4;
const HOLD_COVER = 4;
/** Frags: at most this far, at least the frag's minimum distance; no new throw within THROW_COOLDOWN. */
const FRAG_MAX = 27;
const THROW_COOLDOWN = 5;
/** Persona weights of [spray, frag, hold] (design choice). */
const WEIGHTS: Readonly<Record<Exclude<PersonaName, "neutral">, readonly [number, number, number]>> = {
    rusher: [0.55, 0.25, 0.2],
    rifleman: [0.35, 0.3, 0.35],
    marksman: [0.1, 0.2, 0.7],
    camper: [0.15, 0.35, 0.5],
    looter: [0.3, 0.3, 0.4],
    rat: [0.1, 0.2, 0.7],
};

/** The smoke cloud around `p` on `layer` (the biggest within its radius plus `pad`), or null. */
export function smokeAt(model: WorldModel, p: Vec2, layer: number, pad = 1.5): SmokeView | null {
    let best: SmokeView | null = null;
    for (const s of model.smokes) {
        if (!sameLayer(s.layer, layer) || v2.distance(s.pos, p) > s.rad + pad) continue;
        if (!best || s.rad > best.rad) best = s;
    }
    return best;
}

/** Where the target's heading leads inside the cloud (clamped to it). */
function insideGuess(tr: Readonly<LastSeenTrack>, cloud: SmokeView, now: number): Vec2 {
    const run = Math.min(tr.speed * 0.7 * Math.max(0, now - tr.at), 2 * cloud.rad);
    const p = v2.add(tr.pos, v2.mul(tr.heading, run));
    const off = v2.sub(p, cloud.pos);
    const lim = Math.max(0.5, cloud.rad - 0.5);
    return v2.length(off) > lim ? v2.add(cloud.pos, v2.mul(v2.normalize(off), lim)) : p;
}

/** The edge the target will likely come out of: along its heading, or the edge facing the bot when it stood still. */
function exitPoint(ctx: BrainCtx, tr: Readonly<LastSeenTrack>, cloud: SmokeView): Vec2 {
    const dir = tr.speed > 1 ? tr.heading : v2.normalizeSafe(v2.sub(ctx.self.pos, cloud.pos));
    return v2.add(cloud.pos, v2.mul(dir, cloud.rad + 0.5));
}

/** The frag the bot could throw into the cloud now, or null (in the bag, in range, gates of a throw). */
function fragFor(ctx: BrainCtx, t: Contact, d: number): string | null {
    if (!ctx.features.grenades) return null;
    const item = FRAG_TYPES.find((it) => (ctx.self.inventory[it] ?? 0) > 0);
    if (!item || d < fragMinDist(item) || d > FRAG_MAX || ctx.self.action.type !== "none") return null;
    if (ctx.now - ctx.mem.lastThrow < THROW_COOLDOWN || enemyClose(ctx, item) || !reactedTo(ctx, t)) return null;
    return item;
}

/** The stand-off's choice: persona weights masked by what is possible, or the neutral rule. */
function decide(ctx: BrainCtx, tr: Readonly<LastSeenTrack>, gun: HeldGun, d: number, frag: boolean): SmokeChoice {
    const canSpray = gun.mag > 0 && d <= gun.info.range && d <= 30;
    if (isNeutral(ctx.persona)) {
        if (frag && tr.hostile) return "frag";
        const auto = gun.info.def.fireMode !== "single" || gun.info.cls === "shotgun";
        return canSpray && auto && d <= 20 ? "spray" : "hold";
    }
    const [s0, f0, h0] = WEIGHTS[ctx.persona.name as Exclude<PersonaName, "neutral">] ?? WEIGHTS.rifleman;
    const spray = canSpray ? s0 : 0;
    const fr = frag ? f0 : 0;
    const r = ctx.personaRng.next() * (spray + fr + h0);
    if (r < spray) return "spray";
    return r < spray + fr ? "frag" : "hold";
}

/**
 * planFight's branch for a target that vanished into smoke: spray, frag or hold its exit. Returns false when this is no
 * smoke stand-off (or it is over), so the usual lost-target plan runs.
 */
export function planSmoke(ctx: BrainCtx, intent: Intent, t: Contact, gun: HeldGun): boolean {
    const { model, now, self } = ctx;
    const tr = model.lastSeen.get(t.id);
    if (tr?.cause !== "smoke" || now - tr.at > EPISODE) return false;
    // the cloud it walked into (smoke drifts a little: near the recorded centre, else near where it was last seen)
    const cloud = smokeAt(model, tr.corner, tr.layer, 2) ?? smokeAt(model, tr.pos, tr.layer, 2);
    if (!cloud) return false;
    const f = ctx.mem.fight;
    const d = v2.distance(self.pos, cloud.pos);
    let st: SmokeStandoff | null = f.smoke;
    if (!st || st.target !== t.id || st.vanishedAt !== tr.at) {
        const frag = fragFor(ctx, t, d);
        const choice = decide(ctx, tr, gun, d, frag !== null);
        st = {
            target: t.id,
            vanishedAt: tr.at,
            choice,
            since: now,
            sprayed: 0,
            magAtStart: gun.mag,
            burstUntil: Number.NEGATIVE_INFINITY,
            pauseUntil: Number.NEGATIVE_INFINITY,
            lastThink: now,
            aim: null,
        };
        f.smoke = st;
        f.trace.add(now, "smoke", `${choice} ${t.id} d ${d.toFixed(0)}`);
        if (choice === "frag" && frag) {
            intent.throwPlan = fragPlan(ctx, frag, insideGuess(tr, cloud, now + 1.5), "smoke", checksPath(ctx));
            ctx.mem.lastThrow = now;
            ctx.mem.lastThrowPos = v2.copy(intent.throwPlan.pos);
        }
    }
    const dt = Math.min(0.2, Math.max(0, now - st.lastThink));
    st.lastThink = now;
    intent.targetId = 0;
    if (st.choice === "spray") {
        const used = st.magAtStart - gun.mag;
        const done = st.sprayed >= SPRAY_CAP || used >= st.magAtStart * SPRAY_MAG || gun.mag <= 0;
        if (!done) {
            if (now >= st.pauseUntil) {
                st.burstUntil = now + ctx.rng.range(BURST[0], BURST[1]);
                st.pauseUntil = st.burstUntil + ctx.rng.range(PAUSE[0], PAUSE[1]);
                const g = insideGuess(tr, cloud, now);
                st.aim = { x: g.x + gaussian(ctx.rng) * SPRAY_SCATTER, y: g.y + gaussian(ctx.rng) * SPRAY_SCATTER };
            }
            intent.slot = gun.slot;
            intent.aim = v2.copy(st.aim ?? cloud.pos);
            intent.fire = now < st.burstUntil && gun.slot === self.curWeapIdx && model.lineOfFire(self.pos, intent.aim);
            if (intent.fire) st.sprayed += dt;
            standOff(ctx, intent, cloud);
            return true;
        }
        st.choice = "hold";
        st.since = now;
    }
    if (st.choice === "frag") {
        st.choice = "hold";
        st.since = now;
    }
    if (now - st.since > HOLD_CAP) return false;
    intent.aim = exitPoint(ctx, tr, cloud);
    intent.fire = false;
    standOff(ctx, intent, cloud);
    return true;
}

/** Keeps out of the smoke: cover a few units away from the cloud when there is some, else stand. */
function standOff(ctx: BrainCtx, intent: Intent, cloud: SmokeView): void {
    const cover = findCover(ctx.model, cloud.pos, HOLD_COVER);
    if (cover && v2.distance(cover, ctx.self.pos) > 0.6) {
        intent.goal = cover;
        intent.arriveDist = 0.6;
    } else {
        intent.goal = null;
        intent.stop = true;
    }
}
