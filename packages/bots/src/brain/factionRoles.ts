// 50v50 roles (BrainFeatures.faction, bot round 6): what each faction role does with the kit and perks survev gives it
// (docs/research/items/roles.md "Perks per role" and the role kits; sim roles/loadouts.ts):
// - Commander (leader; the fork Captain alike): its pings reach the whole faction (survev client.ts:588-616), so it
//   pings the enemies it sees every few seconds; it holds a little behind the front (factionFront.ts ROLE_SETBACK).
// - Bugler: the bugle (Inspiration: teammates within 30 u get a 3 s haste, one charge back every 8 s; sim
//   perks/perkRules.ts inspirationRange, effects.ts playBugle) is played when three allies or more are around it
//   and a fight is near (enemies seen lately, a push or a fall back), and nobody is in its face.
// - Medic (Mass Medicate aoe_heal: heals reach teammates within 8 u, revives all downed teammates in reach; Revivify
//   self_revive): it stays by the most hurt squadmate (factionSquad.ts formationSlot), heals when a squadmate next to
//   it is hurt, revives first (factionFight.ts), and revives itself when downed (factionRevive.ts).
// - Grenadier (12 frags + 8 MIRVs, Flak Jacket): explosives at groups, at enemies behind cover and at campers, with a
//   shorter cooldown than anyone else; never inside the blast (fragMath.ts fragMinDist).
// - Marksman: holds long angles from farther back (ROLE_SETBACK), never pushes (factionFront.ts).
// - Recon: holds up front and pings every enemy it spots for its squad.
// - Lone Survivr (last_man): fights on (factionFight.ts: no flight, no break-off, fights what it sees).
import { type Vec2, v2 } from "@rebirth/core";
import { bodyShot, FRAG_TYPES, reactedTo } from "./combat.ts";
import type { BrainCtx, Intent, ThrowPlan } from "./context.ts";
import { FACTION_TUNING, factionOf } from "./factionCtx.ts";
import { fragGroupRadius, fragMaxDist, fragMinDist } from "./fragMath.ts";
import { checksPath, clearLanding } from "./fragSkill.ts";
import { enemyClose, fragPlan } from "./grenades.ts";
import { PING_DANGER } from "./teamplay.ts";

/** Commander pings at most this often; a Recon's at most this often. */
const LEADER_PING_EVERY = 6;
const RECON_PING_EVERY = 3;
/** Bugle: this many allies within BUGLE_RANGE (inside Inspiration's 30 u), a fight within BUGLE_FIGHT_AGE... */
const BUGLE_ALLIES = 3;
const BUGLE_RANGE = 25;
const BUGLE_FIGHT_RANGE = 60;
const BUGLE_FIGHT_AGE = 8;
/** ...and no standing enemy in view this close. A call decided holds the bugle out this long (the switch to it takes
 * its deploy time: decisions come several times a second and must not take it away again before it sounds). */
const BUGLE_CLEAR = 15;
const BUGLE_HOLD = 2.5;
/** Medic: heals when a squadmate within MEDIC_REACH (Mass Medicate reaches 8 u) is under MEDIC_HURT health. */
const MEDIC_REACH = 7;
const MEDIC_HURT = 65;
const MEDIC_EVERY = 1.5;
/** Grenadier: a throw at most this often (everyone else: 5-6 s, grenades.ts), at targets seen this recently. */
const GRENADIER_COOLDOWN = 2.5;
const GRENADIER_RATE = 1.5;
const HIDING_AGE = 2.5;
/** Behaviours calm enough for a bugle call or a medic heal (no fight, flight or kneel going on). */
const CALM = new Set(["advance", "rally", "explore", "loot", "regroup", "assist", "hold", "zone"]);

/** Role actions on top of the chosen intent (pings, the bugle, the medic's heals). */
export function applyFactionRoles(ctx: BrainCtx, intent: Intent): void {
    const fi = factionOf(ctx);
    if (!fi || ctx.self.downed || !FACTION_TUNING.roles) return;
    const role = fi.role;
    if (role === "leader" || role === "captain") rolePing(ctx, intent, LEADER_PING_EVERY, false);
    else if (role === "recon") rolePing(ctx, intent, RECON_PING_EVERY, true);
    else if (role === "bugler") bugle(ctx, intent);
    else if (role === "medic") medicHeal(ctx, intent);
}

/** A danger ping at the enemies in view (their nearest member): the Commander's reach the faction. */
function rolePing(ctx: BrainCtx, intent: Intent, every: number, fresh: boolean): void {
    const fm = ctx.mem.faction;
    if (intent.emote || ctx.now - fm.lastLeaderPing < every) return;
    let best: Vec2 | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const e of ctx.visibleEnemies) {
        if (e.downed || (fresh && ctx.now - e.firstSeen > 1.5)) continue;
        const d = v2.distance(e.pos, ctx.self.pos);
        if (d < bestD) {
            bestD = d;
            best = e.pos;
        }
    }
    if (!best) return;
    fm.lastLeaderPing = ctx.now;
    intent.emote = { type: PING_DANGER, pos: v2.copy(best) };
}

/** The slot holding the bugle with a charge in it, or -1. */
export function bugleSlot(ctx: BrainCtx): number {
    const w = ctx.self.weapons;
    for (let i = 0; i < w.length; i++) if (w[i]?.type === "bugle" && w[i].ammo > 0) return i;
    return -1;
}

/** Whether the Bugler should play now (its allies around, a fight near, nobody in its face). */
export function wantsBugle(ctx: BrainCtx, intent: Intent): boolean {
    const fi = factionOf(ctx);
    if (fi?.role !== "bugler" || bugleSlot(ctx) < 0 || ctx.self.action.type !== "none") return false;
    if (!CALM.has(intent.behaviour) || intent.throwPlan) return false;
    if (fi.alliesNear(ctx.self.pos, BUGLE_RANGE) < BUGLE_ALLIES || enemyInFace(ctx)) return false;
    const fm = ctx.mem.faction;
    if (fm.push || fm.fallback) return true;
    return fi.enemiesNear(ctx.model, ctx.self.pos, BUGLE_FIGHT_RANGE, BUGLE_FIGHT_AGE) > 0;
}

function enemyInFace(ctx: BrainCtx): boolean {
    for (const e of ctx.visibleEnemies) if (!e.downed && v2.distance(e.pos, ctx.self.pos) < BUGLE_CLEAR) return true;
    return false;
}

function bugle(ctx: BrainCtx, intent: Intent): void {
    const fm = ctx.mem.faction;
    // a call under way goes on until the bugle sounds (its charge is spent) or the hold runs out
    const calling =
        ctx.now - fm.lastBugle < BUGLE_HOLD &&
        CALM.has(intent.behaviour) &&
        !intent.throwPlan &&
        ctx.self.action.type === "none" &&
        !enemyInFace(ctx);
    if (bugleSlot(ctx) < 0 || (!calling && !wantsBugle(ctx, intent))) return;
    const slot = bugleSlot(ctx);
    if (!calling) fm.lastBugle = ctx.now;
    intent.slot = slot;
    intent.fire = true;
    intent.targetId = 0;
    // the bugle needs no aim: the cursor where the bot already looks
    intent.aim = v2.add(ctx.self.pos, v2.mul(ctx.self.dir, 8));
}

/** The heal a Mass Medicate medic uses for a squadmate next to it, or "". */
export function medicHealItem(ctx: BrainCtx): string {
    const fi = factionOf(ctx);
    if (fi?.role !== "medic" || ctx.self.action.type !== "none") return "";
    let worst = 100;
    for (const m of ctx.model.team) {
        if (m.playerId === ctx.self.id || m.dead || m.downed || m.disconnected) continue;
        const c = ctx.model.contacts.get(m.playerId);
        const at = c?.visible ? c.pos : m.pos;
        if (v2.distance(at, ctx.self.pos) <= MEDIC_REACH) worst = Math.min(worst, m.health);
    }
    if (worst >= MEDIC_HURT) return "";
    const inv = ctx.self.inventory;
    if (worst < 35 && (inv.healthkit ?? 0) > 0) return "healthkit";
    if ((inv.bandage ?? 0) > 0) return "bandage";
    return (inv.healthkit ?? 0) > 0 ? "healthkit" : "";
}

function medicHeal(ctx: BrainCtx, intent: Intent): void {
    if (!CALM.has(intent.behaviour) || intent.useItem || intent.throwPlan) return;
    if (ctx.now - ctx.mem.faction.lastMedicHeal < MEDIC_EVERY) return;
    if (ctx.visibleEnemies.some((e) => !e.downed && v2.distance(e.pos, ctx.self.pos) < 30)) return;
    const item = medicHealItem(ctx);
    if (!item) return;
    ctx.mem.faction.lastMedicHeal = ctx.now;
    intent.useItem = item;
    intent.stop = true;
    intent.goal = null;
    intent.moveDir = null;
}

/**
 * The Grenadier's throw: a MIRV at a group, a frag at an enemy behind cover, hiding or standing still, within the
 * throw's reach and never inside its blast, every GRENADIER_COOLDOWN seconds at most.
 */
export function grenadierThrow(ctx: BrainCtx, thinkDt: number): ThrowPlan | null {
    const fi = factionOf(ctx);
    if (fi?.role !== "grenadier" || !FACTION_TUNING.roles) return null;
    const { self, now, mem } = ctx;
    const t = ctx.target;
    if (!t || t.downed || now - mem.lastThrow < GRENADIER_COOLDOWN || self.action.type !== "none") return null;
    let cluster = 0;
    for (const e of ctx.enemies) {
        if (e !== t && !e.downed && now - e.lastSeen < 1 && v2.distance(e.pos, t.pos) < fragGroupRadius("mirv") * 1.5)
            cluster++;
    }
    const wanted = cluster > 0 ? ["mirv", "frag"] : ["frag", "mirv"];
    const item = wanted.find((it) => FRAG_TYPES.includes(it) && (self.inventory[it] ?? 0) > 0);
    if (!item || enemyClose(ctx, item)) return null;
    const d = ctx.targetDist;
    if (d < fragMinDist(item) || d > fragMaxDist(item)) return null;
    const hiding = !t.visible && now - t.lastSeen < HIDING_AGE;
    const covered = t.visible && bodyShot(ctx, t) === null;
    const still = t.visible && v2.length(t.vel) < 2;
    if (!hiding && !covered && !still && cluster === 0) return null;
    if (!reactedTo(ctx, t)) return null;
    // a group or a camper is worth more (the same boost as everyone's frags, grenades.ts)
    const rate = GRENADIER_RATE * (cluster > 0 ? 2 : 1) * (covered || hiding ? 1.5 : 1);
    if (!ctx.rng.bool(Math.min(1, rate * thinkDt))) return null;
    const checked = checksPath(ctx);
    const lead = t.visible ? v2.mul(t.vel, 0.5) : { x: 0, y: 0 };
    const pos = clearLanding(ctx, item, v2.add(t.pos, lead), t.pos, checked);
    if (!pos) return null;
    const plan = fragPlan(ctx, item, pos, covered || hiding ? "cover" : "none", checked);
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(plan.pos);
    return plan;
}
