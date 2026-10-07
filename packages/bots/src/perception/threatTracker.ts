// The real threat board (BrainFeatures.threats; installed by perception/install.ts): everything a player knows beyond
// the enemies on its screen, built only from its own snapshots, like the original client shows it:
// - gunfire: every bullet of a non-friendly shooter whose tracer crosses the screen; a shooter not on screen becomes an
//   UnseenShooter and a ghost contact at the fuzzy origin the tracer and the shot sound give (perception/bulletSight.ts:
//   back along the tracer from where it enters the screen, never the exact muzzle; bot overhaul COMBAT-5);
// - explosions in view, the kill feed (with positions only where the bot last saw the killer or the victim, or the
//   victim's dead body), teammates' pings (EmoteEvent isPing), the kill leader;
// - air drops (the "ping_airdrop" map indicator appears when the crate is released and it lands
//   GameConfig.airdrop.fallTime later; falling crates in view; the crate obstacle once seen), air strikes ("ping_airstrike"
//   indicators of strobes and 50v50 zones, the zones themselves), planes coming into view, live grenades in view.
// Events go to a 64-entry ring buffer on the simulation clock; `heat` sums them with a recency weight. Pure and
// deterministic: no rng, no wall clock.
import { type Vec2, v2 } from "@rebirth/core";
import { AIRSTRIKE_VARIANTS, type AirstrikeVariant, GameConfig, GameObjectDefs, hasDef } from "@rebirth/defs";
import type { Snapshot } from "@rebirth/sim";
import { bulletOrigin } from "./bulletSight.ts";
import type {
    AirdropIntel,
    DangerZone,
    KillLeaderIntel,
    ReportedThreat,
    ThreatBoard,
    ThreatEvent,
    ThreatKind,
    UnseenShooter,
} from "./threats.ts";
import type { WorldModel } from "./world.ts";

const RING_SIZE = 64;
/** Heat of an event decays as exp(-age / HEAT_TAU) (seconds). */
const HEAT_TAU = 8;
/** Events older than this are ignored by `heat`. */
const HEAT_MAX_AGE = 30;
/** Ghost contacts (reported threats) fade linearly to nothing over this many seconds. */
export const REPORT_LIFE = 6;
/** An unseen shooter is forgotten after this long without a new shot. */
const SHOOTER_LIFE = 10;
/** Shots of one shooter within this time and distance merge into one gunfire event (keeps the ring readable). */
const MERGE_TIME = 1.5;
const MERGE_DIST = 6;
/** A falling crate crushes what is under it: keep this far from the landing point until it lands. */
const CRATE_DANGER_RAD = 6;
const FALL_TIME = GameConfig.airdrop.fallTime;
/**
 * A strobe or zone strike: bombs fall within a few seconds on a strip of bombCount x bombOffset units ahead of the
 * target (survev plane.ts; sim match/airstrikes.ts): keep about half of it away for the strike window.
 */
const STRIKE_DANGER_RAD = (GameConfig.airstrike.bombCount * GameConfig.airstrike.bombOffset) / 2 + 4;
const STRIKE_DANGER_TIME = 6;

/** A plane id unseen this long is a new plane when it shows up again (ids 1..255 are reused). */
const PLANE_MEMORY = 30;
/** An air drop is forgotten this long after it landed unless its crate was seen (then until it is opened). */
const AIRDROP_MEMORY = 180;
/** Projectiles that explode (brain/brain.ts DANGEROUS), with their explosion radius. */
const GRENADES = ["frag", "mirv", "mirv_mini", "martyr_nade", "bomb_iron", "bomb_heavy"] as const;
const KIND_WEIGHT: Readonly<Record<ThreatKind, number>> = {
    gunfire: 1,
    explosion: 2,
    kill: 3,
    ping: 2,
    airstrike: 3,
    airdrop: 1,
    grenade: 2,
};
/** Heat of each teammate ping type (ping_coming is no threat). */
const PING_WEIGHT: Readonly<Record<string, number>> = { ping_danger: 2, ping_help: 1 };

function explosionRad(throwable: string): number {
    if (!hasDef(throwable)) return 0;
    const t = GameObjectDefs[throwable] as { explosionType?: string };
    const ex =
        t.explosionType && hasDef(t.explosionType)
            ? (GameObjectDefs[t.explosionType] as { rad?: { max: number } })
            : null;
    return ex?.rad?.max ?? 0;
}

/** Danger time of a carpet strike's marker (six planes, round 5). */
const CARPET_DANGER_TIME = 12.5;
/** A marker and a zone this close are the same strike (client Minimap.styledPing). */
const SAME_STRIKE = 2;

/**
 * Round 5 (user reports 27, 32): a marker whose strike zone (within 2 u, as Minimap.styledPing matches them) is a
 * variant: heavy shells keep half their strip plus their blast away (16 + 38 u: a heavy plane is lethal about 20 u to
 * each side of its line and hurts out to 39 u), a carpet strike's six planes keep the danger up for 12.5 s.
 */
function strikeDanger(variant: AirstrikeVariant | undefined): { rad: number; time: number } {
    const v = AIRSTRIKE_VARIANTS[variant ?? "normal"];
    if (variant === "heavy")
        return { rad: ((v.bombCount - 1) * v.bombOffset) / 2 + explosionRad(v.bombType), time: STRIKE_DANGER_TIME };
    if (variant === "carpet") return { rad: STRIKE_DANGER_RAD, time: CARPET_DANGER_TIME };
    return { rad: STRIKE_DANGER_RAD, time: STRIKE_DANGER_TIME };
}

const GRENADE_RAD: ReadonlyMap<string, number> = new Map(GRENADES.map((g) => [g, explosionRad(g)]));

interface ShooterState {
    id: number;
    pos: Vec2;
    firstShot: number;
    lastShot: number;
    shots: number;
    weapon: string;
}

interface ReportState extends ReportedThreat {
    /** key that coalesces repeated reports (shooter id, reporter's ping) */
    key: string;
}

interface DropState extends AirdropIntel {
    /** indicator id while the map marker lives, -1 after */
    indicator: number;
    /** expected landing time */
    landsAt: number;
    /** last time its crate was in view */
    crateSeen: number;
}

export class ThreatTracker implements ThreatBoard {
    /** game time of the latest snapshot */
    now = 0;
    private readonly ring: Array<ThreatEvent | undefined> = new Array(RING_SIZE);
    private head = 0;
    private count = 0;
    private readonly shooters = new Map<number, ShooterState>();
    private readonly reports: ReportState[] = [];
    private readonly drops: DropState[] = [];
    private zones: DangerZone[] = [];
    private strikes: DangerZone[] = [];
    private shooterList: UnseenShooter[] = [];
    private reportList: ReportedThreat[] = [];
    private dropList: AirdropIntel[] = [];
    /** bullet ids already counted (each bullet is reported again when it hits a player) */
    private readonly seenBullets = new Set<number>();
    private readonly bulletOrder: number[] = [];
    /** last known position of every player the bot saw, for kill feed positions */
    private readonly lastPos = new Map<number, { pos: Vec2; time: number }>();
    private leader: KillLeaderIntel | null = null;
    /** plane ids (reused by the server after a while) and when each was last in view */
    private readonly planes = new Map<number, number>();

    heat(pos: Vec2, r: number): number {
        let h = 0;
        const now = this.now;
        const rr = Math.max(r, 1e-3);
        for (let k = 0; k < this.count; k++) {
            const e = this.ring[(this.head - 1 - k + RING_SIZE) % RING_SIZE];
            if (!e) continue;
            const age = now - e.time;
            if (age > HEAT_MAX_AGE) continue;
            const d = v2.distance(e.pos, pos);
            if (d > rr) continue;
            h += e.weight * Math.exp(-Math.max(0, age) / HEAT_TAU) * (1 - (0.5 * d) / rr);
        }
        for (const z of this.zones) {
            const d = v2.distance(z.pos, pos);
            if (d < z.rad + rr) h += KIND_WEIGHT[z.kind] * 2 * (d < z.rad ? 1 : 0.5);
        }
        return h;
    }

    unseenShooters(): readonly UnseenShooter[] {
        return this.shooterList;
    }

    reported(): readonly ReportedThreat[] {
        return this.reportList;
    }

    dangerZones(): readonly DangerZone[] {
        return this.zones;
    }

    airdrops(): readonly AirdropIntel[] {
        return this.dropList;
    }

    killLeader(): Readonly<KillLeaderIntel> | null {
        return this.leader;
    }

    events(): readonly ThreatEvent[] {
        const out: ThreatEvent[] = [];
        for (let k = this.count - 1; k >= 0; k--) {
            const e = this.ring[(this.head - 1 - k + RING_SIZE) % RING_SIZE];
            if (e) out.push(e);
        }
        return out;
    }

    ingest(snap: Snapshot, model: WorldModel): void {
        this.now = model.time;
        if (model.self.dead) return;
        this.ingestBullets(model);
        this.ingestExplosions(snap);
        this.ingestKills(snap, model);
        this.ingestPings(snap, model);
        this.ingestIndicators(snap);
        this.ingestAirdrops(snap, model);
        this.ingestPlanes(snap);
        if (snap.killLeader)
            this.leader = snap.killLeader.id ? { id: snap.killLeader.id, kills: snap.killLeader.kills } : null;
        this.rememberPositions(snap, model);
        this.rebuild(snap, model);
    }

    private push(kind: ThreatKind, pos: Vec2, sourceId: number, weight = KIND_WEIGHT[kind]): ThreatEvent {
        const e: ThreatEvent = { kind, pos: v2.copy(pos), time: this.now, weight, sourceId };
        this.ring[this.head] = e;
        this.head = (this.head + 1) % RING_SIZE;
        this.count = Math.min(RING_SIZE, this.count + 1);
        return e;
    }

    /** The newest event of `kind` from `sourceId` near `pos` within MERGE_TIME, if any. */
    private recent(kind: ThreatKind, sourceId: number, pos: Vec2): ThreatEvent | undefined {
        for (let k = 0; k < this.count; k++) {
            const e = this.ring[(this.head - 1 - k + RING_SIZE) % RING_SIZE];
            if (!e || this.now - e.time > MERGE_TIME) return undefined;
            if (e.kind === kind && e.sourceId === sourceId && v2.distance(e.pos, pos) < MERGE_DIST) return e;
        }
        return undefined;
    }

    private markBullet(id: number): boolean {
        if (this.seenBullets.has(id)) return false;
        this.seenBullets.add(id);
        this.bulletOrder.push(id);
        if (this.bulletOrder.length > 512) this.seenBullets.delete(this.bulletOrder.shift() as number);
        return true;
    }

    private ingestBullets(model: WorldModel): void {
        for (const b of model.bullets) {
            if (!this.markBullet(b.id)) continue;
            const sid = b.shooterId;
            // first bullet of a shot only (no extra pellets, no ricochets: their start is not the shooter)
            if (sid === 0 || sid === model.selfId || model.isTeammate(sid) || !b.shotFx || b.reflectCount > 0) continue;
            const from = bulletOrigin(b);
            const merged = this.recent("gunfire", sid, from);
            if (merged) {
                merged.time = this.now;
                merged.pos = v2.copy(from);
                merged.weight = Math.min(merged.weight + 0.5, 4);
            } else {
                this.push("gunfire", from, sid);
            }
            const c = model.contacts.get(sid);
            if (c?.visible) {
                this.shooters.delete(sid);
                continue;
            }
            let s = this.shooters.get(sid);
            if (!s || this.now - s.lastShot > SHOOTER_LIFE) {
                s = { id: sid, pos: v2.copy(from), firstShot: this.now, lastShot: this.now, shots: 0, weapon: "" };
                this.shooters.set(sid, s);
            }
            s.pos = v2.copy(from);
            s.lastShot = this.now;
            s.shots++;
            s.weapon = b.sourceType;
            this.report("gunfire", from, sid, b.sourceType, `shot:${sid}`);
        }
    }

    private ingestExplosions(snap: Snapshot): void {
        for (const ex of snap.explosions ?? []) {
            // smoke and strobe "explosions" hurt nobody
            const def = hasDef(ex.type) ? (GameObjectDefs[ex.type] as { damage?: number }) : null;
            if ((def?.damage ?? 0) <= 1) continue;
            this.push("explosion", ex.pos, 0);
        }
    }

    private ingestKills(snap: Snapshot, model: WorldModel): void {
        const kills = snap.kills;
        if (!kills?.length) return;
        const bodies = new Map<number, Vec2>();
        // M9 dead bodies (kind "deadBody") carry the dead player's id; read loosely so older views still type-check;
        // only bodies on the screen (the snapshot's margin is not drawn: bot overhaul COMBAT-1)
        for (const o of snap.objects as ReadonlyArray<{ kind: string; pos: Vec2; playerId?: number }>) {
            if (o.kind === "deadBody" && o.playerId && model.onScreen(o.pos)) bodies.set(o.playerId, o.pos);
        }
        for (const k of kills) {
            const killer = k.killerId;
            const friendlyKiller = killer === model.selfId || (killer !== 0 && model.isTeammate(killer));
            if (friendlyKiller) continue;
            const killerPos = killer ? this.positionOf(killer, model) : null;
            const victimPos = bodies.get(k.targetId) ?? this.positionOf(k.targetId, model);
            const pos = killerPos ?? victimPos;
            if (!pos) continue;
            this.push("kill", pos, killer);
            this.report("kill", pos, killer, k.itemSourceType || k.source, `kill:${killer}:${k.targetId}`);
        }
    }

    private positionOf(id: number, model: WorldModel): Vec2 | null {
        const c = model.contacts.get(id);
        if (c) return c.pos;
        const last = this.lastPos.get(id);
        return last && this.now - last.time < 10 ? last.pos : null;
    }

    private ingestPings(snap: Snapshot, model: WorldModel): void {
        for (const e of snap.emotes ?? []) {
            if (!e.isPing || !e.pos || e.playerId === model.selfId || !model.isTeammate(e.playerId)) continue;
            const w = PING_WEIGHT[e.type] ?? 0;
            if (w > 0) this.push("ping", e.pos, e.playerId, w);
            this.report("ping", e.pos, e.playerId, e.type, `ping:${e.playerId}`);
        }
    }

    private ingestIndicators(snap: Snapshot): void {
        for (const ind of snap.mapIndicators ?? []) {
            if (ind.type === "ping_airdrop") {
                const known = this.drops.find((d) => d.indicator === ind.id);
                if (ind.dead) {
                    if (known) {
                        known.indicator = -1;
                        known.landed = true;
                    }
                    continue;
                }
                if (known || this.drops.some((d) => v2.distance(d.pos, ind.pos) < 4 && !d.landed)) continue;
                this.drops.push({
                    pos: v2.copy(ind.pos),
                    seenAt: this.now,
                    landed: false,
                    crateId: 0,
                    indicator: ind.id,
                    landsAt: this.now + FALL_TIME,
                    crateSeen: Number.NEGATIVE_INFINITY,
                });
                this.push("airdrop", ind.pos, 0);
            } else if (ind.type === "ping_airstrike" && !ind.dead) {
                if (this.strikes.some((z) => v2.distance(z.pos, ind.pos) < 2 && z.until > this.now)) continue;
                const variant = snap.airstrikeZones?.find((z) => v2.distance(z.pos, ind.pos) < SAME_STRIKE)?.variant;
                const danger = strikeDanger(variant);
                this.strikes.push({
                    kind: "airstrike",
                    pos: v2.copy(ind.pos),
                    rad: danger.rad,
                    until: this.now + danger.time,
                    ...(variant && variant !== "normal" ? { variant } : {}),
                });
                this.push("airstrike", ind.pos, 0);
            }
        }
    }

    private ingestAirdrops(snap: Snapshot, model: WorldModel): void {
        for (const a of snap.airdrops ?? []) {
            let d = this.drops.find((x) => v2.distance(x.pos, a.pos) < 4);
            if (!d) {
                d = {
                    pos: v2.copy(a.pos),
                    seenAt: this.now,
                    landed: false,
                    crateId: 0,
                    indicator: -1,
                    landsAt: this.now + (1 - a.fallT) * FALL_TIME,
                    crateSeen: Number.NEGATIVE_INFINITY,
                };
                this.drops.push(d);
                this.push("airdrop", a.pos, 0);
            }
            d.landsAt = this.now + (1 - a.fallT) * FALL_TIME;
            if (a.landed) d.landed = true;
        }
        for (const d of this.drops) {
            if (!d.landed && this.now >= d.landsAt) d.landed = true;
            for (const o of model.obstacles) {
                if (!o.def.airdropCrate || v2.distance(o.view.pos, d.pos) > 4) continue;
                d.landed = true;
                d.crateSeen = this.now;
                d.crateId = o.view.dead || !o.view.button?.canUse ? -1 : o.view.id;
            }
        }
        // forget opened crates, and drops long landed whose crate was never seen
        for (let i = 0; i < this.drops.length; i++) {
            const d = this.drops[i];
            const stale = d.landed && d.crateId === 0 && this.now - d.landsAt > AIRDROP_MEMORY;
            if (d.crateId === -1 || stale) this.drops.splice(i--, 1);
        }
    }

    /** A plane coming into view (its id not seen lately): an air drop or air strike is on its way here. */
    private ingestPlanes(snap: Snapshot): void {
        for (const pl of snap.planes ?? []) {
            const seen = this.planes.get(pl.id);
            this.planes.set(pl.id, this.now);
            if (seen !== undefined && this.now - seen < PLANE_MEMORY) continue;
            this.push(pl.planeType === "airstrike" ? "airstrike" : "airdrop", pl.pos, 0);
        }
    }

    private report(kind: ThreatKind, pos: Vec2, reporterId: number, type: string, key: string): void {
        const r = this.reports.find((x) => x.key === key);
        if (r) {
            r.pos = v2.copy(pos);
            r.time = this.now;
            r.type = type;
            return;
        }
        this.reports.push({ kind, pos: v2.copy(pos), time: this.now, reporterId, type, key, confidence: 1 });
    }

    private rememberPositions(snap: Snapshot, model: WorldModel): void {
        for (const c of model.contacts.values()) if (c.visible) this.lastPos.set(c.id, { pos: c.pos, time: this.now });
        for (const id of snap.deletedPlayerIds ?? []) this.lastPos.delete(id);
        if (this.lastPos.size > 256) {
            for (const [id, p] of this.lastPos) if (this.now - p.time > 10) this.lastPos.delete(id);
        }
    }

    /** Recomputes the lists the getters hand out (once per snapshot, so reads allocate nothing). */
    private rebuild(snap: Snapshot, model: WorldModel): void {
        const now = this.now;
        this.shooterList = [];
        for (const [id, s] of this.shooters) {
            if (now - s.lastShot > SHOOTER_LIFE) {
                this.shooters.delete(id);
                continue;
            }
            if (model.contacts.get(id)?.visible) continue;
            this.shooterList.push({ id, pos: s.pos, lastShot: s.lastShot, shots: s.shots, weapon: s.weapon });
        }
        this.reportList = [];
        for (let i = 0; i < this.reports.length; i++) {
            const r = this.reports[i];
            const age = now - r.time;
            if (age > REPORT_LIFE) {
                this.reports.splice(i--, 1);
                continue;
            }
            // a ghost of a shooter now on screen is no ghost any more
            if (r.kind === "gunfire" && model.contacts.get(r.reporterId)?.visible) continue;
            r.confidence = Math.max(0, 1 - age / REPORT_LIFE);
            this.reportList.push(r);
        }
        this.strikes = this.strikes.filter((z) => z.until > now);
        const zones: DangerZone[] = [...this.strikes];
        for (const z of snap.airstrikeZones ?? []) {
            const until = now + z.duration * (1 - z.zoneT);
            const variant = z.variant && z.variant !== "normal" ? { variant: z.variant } : {};
            zones.push({ kind: "airstrike", pos: v2.copy(z.pos), rad: z.rad, until, ...variant });
        }
        for (const d of this.drops) {
            if (!d.landed) zones.push({ kind: "airdrop", pos: d.pos, rad: CRATE_DANGER_RAD, until: d.landsAt });
        }
        for (const p of model.projectiles) {
            const rad = GRENADE_RAD.get(p.type);
            if (rad) zones.push({ kind: "grenade", pos: v2.copy(p.pos), rad, until: now + 0.5 });
        }
        this.zones = zones;
        this.dropList = this.drops.map((d) => ({
            pos: d.pos,
            seenAt: d.seenAt,
            landed: d.landed,
            crateId: Math.max(0, d.crateId),
        }));
    }
}
