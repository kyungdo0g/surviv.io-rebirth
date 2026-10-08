// 50v50 revives (BrainFeatures.faction, bot round 6). In faction mode a player revives any downed member of its
// faction, not only its squad: survev getPlayerToRevive takes the closest downed player of its team (the faction) in
// reach, as the sim does (world/downed.ts playerToRevive, teammatesInRange by teamId). The faction minimap shows who is
// down and where (Snapshot.factionStatus), so a bot heads for a downed faction member near it when no other standing
// ally is clearly closer (one reviver per downed ally, not a crowd), and leaves one somebody already revives. The
// revive itself is team.ts planRevive: no kneeling in an enemy's sights, smoke on the threat line first (guard), cover
// next to the downed ally while someone covers it (pursuit). A Medic (Mass Medicate: its revive stands up every downed
// teammate within reach) reaches twice as far, and with Revivify revives itself when downed and nobody is in its face.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { FACTION_TUNING, factionOf } from "./factionCtx.ts";
import { inStrike } from "./strikes.ts";
import { mates } from "./team.ts";

/** A downed squadmate is gone for this far (team.ts reviveScore's own limit is 60)... */
const SQUAD_RANGE = 60;
/** ...a downed faction member outside the squad this far, a Medic's anyone this far. */
const FACTION_RANGE = 35;
const MEDIC_RANGE = 80;
/** Another standing ally this much closer to the downed one goes instead. */
const CLOSER_BY = 3;
/** Revivify: no self revive with a standing enemy in view this close (it crawls away first). */
const SELF_REVIVE_CLEAR = 22;
const SELF_REVIVE_EVERY = 0.6;

type Downed = TeamMemberView & { at: Vec2 };

/** One answer per decision (team.ts asks from several behaviours' scores and plans). */
const cache = new WeakMap<BrainCtx, { best: Downed | undefined }>();

/**
 * The downed ally the bot should revive in faction mode (undefined for none), or null when the faction brain does not
 * run (team.ts downedMate then picks among the squad as before).
 */
export function factionDowned(ctx: BrainCtx): Downed | undefined | null {
    const fi = factionOf(ctx);
    if (!fi) return null;
    const hit = cache.get(ctx);
    if (hit) return hit.best;
    const best = pickDowned(ctx);
    cache.set(ctx, { best });
    return best;
}

function pickDowned(ctx: BrainCtx): Downed | undefined {
    const fi = factionOf(ctx);
    if (!fi) return undefined;
    const me = ctx.self.pos;
    const medic = fi.role === "medic";
    let best: Downed | undefined;
    let bestD = Number.POSITIVE_INFINITY;
    const squad = new Set<number>();
    for (const m of mates(ctx)) {
        squad.add(m.playerId);
        if (!m.downed || outOfReach(ctx, m.at)) continue;
        const c = ctx.model.contacts.get(m.playerId);
        if (c?.visible && c.reviving && ctx.self.action.targetId !== m.playerId) continue;
        const d = v2.distance(m.at, me);
        if (d < Math.max(SQUAD_RANGE, medic ? MEDIC_RANGE : 0) && d < bestD) {
            bestD = d;
            best = m;
        }
    }
    const range = medic ? MEDIC_RANGE : FACTION_RANGE;
    if (!FACTION_TUNING.factionRevive) return best;
    for (const row of fi.downedAllies()) {
        if (squad.has(row.playerId)) continue;
        const c = ctx.model.contacts.get(row.playerId);
        if (c && (c.dead || (c.visible && !c.downed))) continue;
        if (c?.visible && c.reviving && ctx.self.action.targetId !== row.playerId) continue;
        const at = c?.visible ? c.pos : row.pos;
        if (outOfReach(ctx, at)) continue;
        const d = v2.distance(at, me);
        if (d >= range || d >= bestD) continue;
        // one reviver: a standing ally clearly closer to it goes (a Medic goes anyway)
        if (!medic && closerAlly(ctx, at, d)) continue;
        bestD = d;
        best = {
            playerId: row.playerId,
            name: "",
            health: 0,
            downed: true,
            dead: false,
            disconnected: false,
            pos: v2.copy(row.pos),
            role: row.role,
            at: v2.copy(at),
        };
    }
    return best;
}

/** An ally downed in the gas is left there: 8 s of kneeling beside it in the gas kills the reviver too. */
/** A downed ally out of reach for now: in the gas, or in a known air strike (team.ts reviveScore would refuse it). */
function outOfReach(ctx: BrainCtx, p: Vec2): boolean {
    return !ctx.model.insideCurrentCircle(p, 2) || (ctx.features.pursuit && inStrike(ctx, p));
}

function closerAlly(ctx: BrainCtx, at: Vec2, d: number): boolean {
    const fi = factionOf(ctx);
    if (!fi) return false;
    for (const m of fi.allies()) {
        if (m.playerId === ctx.self.id) continue;
        if (v2.distance(m.pos, at) < d - CLOSER_BY) return true;
    }
    return false;
}

/** Downed with Revivify (the Medic's self_revive): revive itself when no standing enemy is in its face, else null. */
export function planSelfRevive(ctx: BrainCtx): Intent | null {
    const fi = factionOf(ctx);
    if (!fi?.hasPerk("self_revive") || !ctx.self.downed) return null;
    const intent = emptyIntent("downed");
    if (ctx.self.action.type === "revive") {
        intent.stop = true;
        return intent;
    }
    for (const e of ctx.visibleEnemies) {
        if (!e.downed && v2.distance(e.pos, ctx.self.pos) < SELF_REVIVE_CLEAR) return null;
    }
    intent.stop = true;
    const fm = ctx.mem.faction;
    if (ctx.now - fm.lastSelfRevive > SELF_REVIVE_EVERY) {
        fm.lastSelfRevive = ctx.now;
        intent.actions.push(Input.Revive);
    }
    return intent;
}
