// Third-partying (BrainFeatures.thirdparty): when two other players trade shots (intel: engaged with each other; or
// one firing while facing the other and the other answering; or bullets seen flying from one at the other; or two
// shooters heard close together on the threat board), the bot does not
// join at once: it moves to cover at its gun's ideal range of the nearer one and waits, crosshair on the fight, for
// the kill feed or for one of them to drop low (intel estimate), then turns on the survivor (or the weakened one)
// with the regular fight. The wait is capped at 20 s; being shot at ends it at once. In team modes a follower watches
// only fights within 30 units of its leader (team.ts onLeash).
import { type Vec2, v2 } from "@rebirth/core";
import { distToSegment } from "../geom.ts";
import { fightSlot, hasAmmo } from "../knowledge/arsenal.ts";
import type { Contact } from "../perception/world.ts";
import { faces } from "./assess.ts";
import { blastDropsSpot } from "./blast.ts";
import { findCoverFrom } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, reachable, usableSpot } from "./context.ts";
import { zonePressure } from "./survival.ts";
import { onLeash } from "./team.ts";

const WAIT_CAP = 20;
const COOLDOWN = 15;
const MAX_DIST = 90;
const LOW_HEALTH = 40;
const SCAN_EVERY = 0.3;
/** Score while watching a fight: above an unprovoked fight (even a won or opportunistic one), below being shot at. */
const WATCH_SCORE = 0.82;

interface Party {
    id: number;
    pos: Vec2;
}

/** Two other parties trading shots, the nearer first; null when none. */
export function findTrade(ctx: BrainCtx): [Party, Party] | null {
    const { model, now, self } = ctx;
    const me = self.pos;
    const fighters = ctx.visibleEnemies.filter((e) => !e.downed && !(faces(e, me, 12) && now - e.lastShotAt < 2));
    const found: { best: [Party, Party] | null; d: number } = { best: null, d: Number.POSITIVE_INFINITY };
    const consider = (a: Party, b: Party) => {
        const da = v2.distance(a.pos, me);
        const db = v2.distance(b.pos, me);
        const near = da <= db ? a : b;
        const far = near === a ? b : a;
        const d = Math.min(da, db);
        if (d < found.d && d <= MAX_DIST) {
            found.d = d;
            found.best = [near, far];
        }
    };
    for (let i = 0; i < fighters.length; i++) {
        const a = fighters[i];
        for (let j = i + 1; j < fighters.length; j++) {
            const b = fighters[j];
            if (model.groupOf.get(a.id) !== undefined && model.groupOf.get(a.id) === model.groupOf.get(b.id)) continue;
            if (v2.distance(a.pos, b.pos) > 60) continue;
            const ia = model.intel.of(a.id);
            const ib = model.intel.of(b.id);
            const intel = ia.engagedWith === b.id || ib.engagedWith === a.id;
            // one firing while facing the other, the other firing back or facing it
            const firing = (x: Contact, y: Contact) => now - x.lastShotAt < 1.5 && faces(x, y.pos, 20);
            const answering = (x: Contact, y: Contact) => now - x.lastShotAt < 3 || faces(x, y.pos, 25);
            const seen = (firing(a, b) && answering(b, a)) || (firing(b, a) && answering(a, b));
            if (intel || seen) consider(a, b);
        }
    }
    if (found.best) return found.best;
    // bullets in this snapshot flying from one other player at another one in sight
    for (const bl of model.bullets) {
        if (bl.shooterId === self.id || bl.reflectCount > 0 || model.isTeammate(bl.shooterId)) continue;
        const end = v2.add(bl.pos, v2.mul(bl.dir, bl.endDist ?? bl.maxDist));
        if (distToSegment(me, bl.pos, end) < 4) continue;
        for (const e of fighters) {
            if (e.id === bl.shooterId || distToSegment(e.pos, bl.pos, end) > 2) continue;
            const shooter = model.contacts.get(bl.shooterId);
            consider(
                { id: bl.shooterId, pos: shooter && !shooter.dead ? shooter.pos : bl.pos },
                { id: e.id, pos: e.pos },
            );
        }
    }
    if (found.best) return found.best;
    // heard, not seen: two shooters firing close together
    const heard = model.threats.unseenShooters().filter((s) => now - s.lastShot < 2);
    for (let i = 0; i < heard.length; i++) {
        for (let j = i + 1; j < heard.length; j++) {
            const a = heard[i];
            const b = heard[j];
            if (model.isTeammate(a.id) || model.isTeammate(b.id) || v2.distance(a.pos, b.pos) > 50) continue;
            consider({ id: a.id, pos: a.pos }, { id: b.id, pos: b.pos });
        }
    }
    return found.best;
}

function reset(ctx: BrainCtx, cooldown: boolean): void {
    const sm = ctx.mem.smart;
    sm.tpA = 0;
    sm.tpB = 0;
    sm.tpSpot = null;
    if (cooldown) sm.tpCooldown = ctx.now + COOLDOWN;
}

/** A party of the watched fight: where it is now, null when it is gone (dead, or no longer known). */
function partyPos(ctx: BrainCtx, id: number): Contact | null {
    const c = ctx.model.contacts.get(id);
    return c && !c.dead ? c : null;
}

/** Utility of joining someone else's fight now (0..1); 0 keeps the behaviour out of the choice. */
export function thirdpartyScore(ctx: BrainCtx): number {
    const { self, model, now, mem } = ctx;
    const sm = mem.smart;
    if (sm.tpA === 0 && now < sm.tpCooldown) return 0;
    const ready =
        ctx.armed &&
        self.health >= 50 &&
        !model.inGasNow() &&
        zonePressure(model) < 0.6 &&
        ctx.guns.some((g) => hasAmmo(g) && g.mag + g.reserve >= g.info.def.maxClip);
    // shot at: this is the bot's own fight now
    const attacked = now - model.lastHurt < 2 || (!!model.underFire && now - model.underFire.time < 1);
    if (sm.tpA !== 0) {
        if (!ready || attacked || now - sm.tpStart > WAIT_CAP) {
            reset(ctx, true);
            return 0;
        }
        const a = partyPos(ctx, sm.tpA);
        const b = partyPos(ctx, sm.tpB);
        const low = (c: Contact | null) => !!c && (c.downed || model.intel.of(c.id).estHealth < LOW_HEALTH);
        let strike: Contact | null = null;
        if (!a && b) strike = b;
        else if (!b && a) strike = a;
        else if (low(a)) strike = a;
        else if (low(b)) strike = b;
        if (strike || (!a && !b)) {
            // the fight is decided: the regular fight takes the survivor (or the weakened one) as its target
            if (strike) {
                mem.targetId = strike.id;
                sm.tpSurvivor = strike.id;
            }
            reset(ctx, true);
            return 0;
        }
        return WATCH_SCORE;
    }
    if (!ready || attacked || now - sm.tpScanAt < SCAN_EVERY) return 0;
    // the scan walks pairs of enemies and this snapshot's bullets: a few times a second is plenty
    sm.tpScanAt = now;
    const trade = findTrade(ctx);
    // team modes: a follower does not go after someone else's fight alone
    if (!trade || !onLeash(ctx, trade[0].pos)) return 0;
    sm.tpA = trade[0].id;
    sm.tpB = trade[1].id;
    sm.tpStart = now;
    sm.tpSpot = null;
    return WATCH_SCORE;
}

/** Where the nearer party is: the contact, else the shooter's last position on the threat board. */
function nearPos(ctx: BrainCtx): Vec2 | null {
    const sm = ctx.mem.smart;
    const c = partyPos(ctx, sm.tpA);
    if (c) return c.pos;
    const heard = ctx.model.threats.unseenShooters().find((s) => s.id === sm.tpA);
    return heard ? heard.pos : null;
}

export function planThirdparty(ctx: BrainCtx): Intent {
    const intent = emptyIntent("thirdparty");
    const { self, model, mem } = ctx;
    const sm = mem.smart;
    const near = nearPos(ctx);
    if (!near) return intent;
    const me = self.pos;
    const loaded = ctx.guns.filter(hasAmmo);
    const ideal = Math.max(...loaded.map((g) => g.info.idealMax), 15);
    const want = Math.min(40, Math.max(15, ideal));
    // (a spot in the blast of an explosive being shot is given up: blast.ts)
    if (
        !sm.tpSpot ||
        v2.distance(sm.tpSpot, near) > want + 12 ||
        v2.distance(sm.tpSpot, near) < want * 0.5 ||
        blastDropsSpot(ctx, sm.tpSpot)
    ) {
        const ring = v2.add(near, v2.mul(v2.normalizeSafe(v2.sub(me, near)), want));
        sm.tpSpot = findCoverFrom(model, ring, near, 10, (p) => reachable(ctx, p)) ?? usableSpot(ctx, ring, 6);
    }
    const spot = sm.tpSpot;
    if (!spot) {
        // nowhere to watch from: give the fight up
        sm.tpCooldown = ctx.now + 5;
        sm.tpA = 0;
        return intent;
    }
    if (v2.distance(me, spot) > 1) {
        intent.goal = v2.copy(spot);
        intent.arriveDist = 1;
    } else {
        intent.stop = true;
    }
    // ready to shoot, but not a shot until the fight is decided (the slot keeps the combat layer off)
    intent.slot = fightSlot(self, ctx.guns, v2.distance(me, near));
    intent.aim = v2.copy(near);
    intent.lookAt = v2.copy(near);
    return intent;
}
