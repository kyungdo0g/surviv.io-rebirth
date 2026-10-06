// Team play (BrainFeatures.teamplay, duo / squad): pings and focus fire. On first spotting an enemy no teammate is
// near, the bot pings it ("ping_danger" at its position, at most one ping per 4 s); a teammate's danger ping (threat
// board reports) becomes a contact the bot moves to support ("assist"); the enemy the team's visible bullets fly
// towards gets a target selection bonus so the team focuses one player.
import { type Vec2, v2 } from "@rebirth/core";
import { distToSegment } from "../geom.ts";
import type { ReportedThreat } from "../perception/threats.ts";
import type { Contact } from "../perception/world.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { zonePressure } from "./survival.ts";

/** GameObjectDefs ping id (defs: ping_danger, ping_coming, ping_help, ...). */
export const PING_DANGER = "ping_danger";
const PING_INTERVAL = 4;
/** A teammate within this distance of an enemy has probably seen it already. */
const MATE_NEAR = 25;
/** An enemy is pinged again only after this long. */
const REPING = 12;
const FOCUS_TIME = 1.5;
const FOCUS_MULT = 1.3;
/** Teammates' pings are followed for this long, within this distance. */
const PING_LIFE = 8;
const ASSIST_RANGE = 70;

/** Focus fire weight of `c` (1.3 while the team's bullets fly at it). */
export function focusMult(ctx: BrainCtx, c: Contact): number {
    const at = ctx.mem.smart.teamFocus.get(c.id);
    return at !== undefined && ctx.now - at < FOCUS_TIME ? FOCUS_MULT : 1;
}

/** Notes which enemies the team's bullets (this snapshot) fly towards. */
function updateFocus(ctx: BrainCtx): void {
    const { model, now, self } = ctx;
    const sm = ctx.mem.smart;
    for (const b of model.bullets) {
        if (b.shooterId === self.id || !model.isTeammate(b.shooterId) || b.reflectCount > 0) continue;
        const end = v2.add(b.pos, v2.mul(b.dir, b.endDist ?? b.maxDist));
        for (const e of ctx.visibleEnemies) {
            if (!e.downed && distToSegment(e.pos, b.pos, end) < 1.5) sm.teamFocus.set(e.id, now);
        }
    }
    if (sm.teamFocus.size > 32) {
        for (const [id, at] of sm.teamFocus) if (now - at > FOCUS_TIME) sm.teamFocus.delete(id);
    }
}

/** The enemy worth pinging now: newly seen, no teammate near it, not pinged lately. */
function pingCandidate(ctx: BrainCtx): Contact | null {
    const { model, now, self } = ctx;
    const sm = ctx.mem.smart;
    let best: Contact | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const e of ctx.visibleEnemies) {
        if (e.downed || now - e.firstSeen > 1) continue;
        const last = sm.pinged.get(e.id);
        if (last !== undefined && now - last < REPING) continue;
        const mateNear = model.team.some(
            (m) => m.playerId !== self.id && !m.dead && !m.downed && v2.distance(m.pos, e.pos) < MATE_NEAR,
        );
        if (mateNear) continue;
        const d = v2.distance(e.pos, self.pos);
        if (d < bestD) {
            bestD = d;
            best = e;
        }
    }
    return best;
}

/** Team play on top of the chosen intent: focus bookkeeping and danger pings (Intent.emote). */
export function applyTeamplay(ctx: BrainCtx, intent: Intent): void {
    if (!ctx.teamMode || ctx.self.downed) return;
    updateFocus(ctx);
    const sm = ctx.mem.smart;
    if (intent.emote || ctx.now - sm.lastPing < PING_INTERVAL) return;
    const e = pingCandidate(ctx);
    if (!e) return;
    sm.lastPing = ctx.now;
    sm.pinged.set(e.id, ctx.now);
    if (sm.pinged.size > 32) {
        for (const [id, at] of sm.pinged) if (ctx.now - at > REPING) sm.pinged.delete(id);
    }
    intent.emote = { type: PING_DANGER, pos: v2.copy(e.pos) };
}

/** The freshest danger ping of a teammate within reach, or null. */
export function teammatePing(ctx: BrainCtx): ReportedThreat | null {
    const { model, now, self } = ctx;
    let best: ReportedThreat | null = null;
    for (const r of model.threats.reported()) {
        if (r.kind !== "ping" || r.type !== PING_DANGER || now - r.time > PING_LIFE) continue;
        if (r.reporterId === self.id || !model.isTeammate(r.reporterId)) continue;
        if (v2.distance(r.pos, self.pos) > ASSIST_RANGE) continue;
        if (!best || r.time > best.time) best = r;
    }
    return best;
}

/** Utility of moving to support a teammate's danger ping (0..1). */
export function assistScore(ctx: BrainCtx): number {
    if (!ctx.teamMode || !ctx.armed || ctx.model.inGasNow() || zonePressure(ctx.model) > 0.5) return 0;
    if (ctx.target && ctx.now - ctx.target.lastSeen < 3) return 0;
    const ping = teammatePing(ctx);
    if (!ping || v2.distance(ping.pos, ctx.self.pos) < 12) return 0;
    return 0.48;
}

export function planAssist(ctx: BrainCtx): Intent {
    const intent = emptyIntent("assist");
    const ping = teammatePing(ctx);
    if (!ping) return intent;
    const goal: Vec2 = ping.pos;
    const cell = ctx.model.nav.nearestWalkable(goal, 6, ctx.myComp);
    intent.goal = cell >= 0 ? ctx.model.nav.center(cell) : v2.copy(goal);
    intent.arriveDist = 10;
    intent.lookAt = v2.copy(goal);
    addCombatLayer(ctx, intent);
    return intent;
}
