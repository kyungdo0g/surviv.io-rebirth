// What a 50v50 faction and a squad legitimately share (bot round 6), kept once per game instead of once per bot:
// - FactionBoard (one per faction): the faction minimap (Snapshot.factionStatus: every member's position, knock,
//   death and role, refreshed every 0.5 s; docs/research/modes/faction.md "Teams and match rules"; and since sim
//   schema 18 the enemy shooters it reveals while the server's rules.roles.factionRevealTime is on, off by default),
//   the knocks and deaths it shows, the kill feed's kills by faction members, Commander pings (they reach the whole
//   faction: items/roles.md, survev client.ts:588-616) and the living counts (AliveCounts). Every member's snapshot
//   carries the same rows, so whichever bot sees a newer refresh first files it for all; the front estimate from them
//   is computed once per FRONT_EVERY per faction.
// - SquadBoard (one per squad): what the squadmates see (the enemies on each one's screen, as a squad shares them by
//   voice) and the squad's own pings (regular pings reach only the squad).
// Boards live in a registry per MapData: in-process bots of one game share one MapData; a networked bot gets its own
// map and so keeps its boards to itself. Deterministic: no rng, no wall clock; the order bots file things in is the
// runner's fixed order.
import { type Vec2, v2 } from "@rebirth/core";
import type { FactionMemberView, MapData } from "@rebirth/sim";

/** Front evidence older than this is ignored (s): knocks and deaths, kills by faction members. */
const EVENT_LIFE = 25;
/**
 * The rows come with every snapshot but change only at a refresh (every 0.5 s): filed again at most this often, so
 * a refresh is filed within a quarter second (sim match/faction.ts statusView).
 */
const STATUS_EVERY = 0.25;
/** Commander and squad pings count this long (ping_danger's map life is about this). */
const PING_LIFE = 10;
/** A squad's sightings count this long (s). */
export const SIGHTING_LIFE = 10;
/** The faction front estimate is recomputed at most this often (s). */
const FRONT_EVERY = 0.5;
const MAX_EVENTS = 64;
/** A squad answers the faction's fights within this distance (frontNear). */
const NEAR_FRONT = 120;
const EVENT_WEIGHT = { knock: 2, death: 2, kill: 1.5, ping: 2, reveal: 1.5 } as const;
/** A revealed enemy shooter is filed again at most this often (it stays on the list for 1 s after each shot). */
const REVEAL_EVERY = 1;

/** Commander pings and revealed shooters are short-lived evidence; knocks, deaths and kills last EVENT_LIFE. */
function lifeOf(kind: keyof typeof EVENT_WEIGHT): number {
    return kind === "ping" || kind === "reveal" ? PING_LIFE : EVENT_LIFE;
}

export interface AllyRow extends FactionMemberView {
    /** game time of the refresh that carried this row */
    time: number;
}

export interface FrontEvent {
    kind: keyof typeof EVENT_WEIGHT;
    pos: Vec2;
    time: number;
}

export interface Sighting {
    id: number;
    pos: Vec2;
    time: number;
    downed: boolean;
    /** squadmate that saw it */
    by: number;
}

export interface SquadPing {
    pos: Vec2;
    time: number;
    type: string;
    from: number;
}

export class FactionBoard {
    readonly team: number;
    /** game time of the last factionStatus filed */
    statusTime = Number.NEGATIVE_INFINITY;
    readonly members = new Map<number, AllyRow>();
    readonly events: FrontEvent[] = [];
    /** living players of [Red, Blue] (Snapshot.teamAliveCounts) */
    aliveCounts: number[] = [];
    /** sign of the river side the faction spawned on (factionMap.ts riverSide), 0 until known */
    side = 0;
    /**
     * the Commander's call (owner 2026-10-08: the faction rallies to its Commander): refreshed with every decision it
     * takes to advance, as a squad leader's on its squad board; null while it does not lead the faction anywhere
     */
    commanderPlan: SquadPlan | null = null;
    private readonly pingKeys = new Set<string>();
    private readonly killKeys = new Set<string>();
    private readonly revealedAt = new Map<number, number>();
    private frontAt = Number.NEGATIVE_INFINITY;
    private frontPos: Vec2 | null = null;
    private standingList: AllyRow[] = [];

    constructor(team: number) {
        this.team = team;
    }

    /**
     * Files a factionStatus refresh: knocks and deaths since the previous one become front events. Since sim schema 18
     * the rows also carry the enemies revealed by firing (a shooter an enemy could see shows on the other faction's
     * minimap for rules.roles.factionRevealTime, survev timeUntilHidden 1 s; the rebirth's default 0 sends none), with
     * no team field: `teamOf` (PlayerInfos) tells them apart. A revealed enemy is a front event where it fired, never
     * a member; a row of unknown team is skipped.
     */
    fileStatus(rows: readonly FactionMemberView[], time: number, teamOf: (id: number) => number | undefined): void {
        if (time - this.statusTime < STATUS_EVERY) return;
        this.statusTime = time;
        for (const r of rows) {
            const team = teamOf(r.playerId);
            if (team !== this.team) {
                if (team !== undefined && !r.dead && time - (this.revealedAt.get(r.playerId) ?? -1e9) >= REVEAL_EVERY) {
                    this.revealedAt.set(r.playerId, time);
                    this.addEvent("reveal", r.pos, time);
                }
                continue;
            }
            const prev = this.members.get(r.playerId);
            if (prev && !prev.dead) {
                if (r.dead) this.addEvent("death", r.pos, time);
                else if (r.downed && !prev.downed) this.addEvent("knock", r.pos, time);
            }
            this.members.set(r.playerId, { ...r, pos: v2.copy(r.pos), time });
        }
        this.standingList = [];
        for (const m of this.members.values()) if (!m.dead && !m.downed) this.standingList.push(m);
    }

    /** Standing members as of the last refresh. */
    standing(): readonly AllyRow[] {
        return this.standingList;
    }

    /** A Commander's (or Captain's, Lone Survivr's) ping that reached the faction (deduplicated across members). */
    filePing(from: number, pos: Vec2, time: number, type: string): void {
        if (type !== "ping_danger") return;
        const key = `${from}:${Math.round(time * 10)}`;
        if (this.pingKeys.has(key)) return;
        this.pingKeys.add(key);
        if (this.pingKeys.size > 64) this.pingKeys.clear();
        this.addEvent("ping", pos, time);
    }

    /** A kill or knock by a faction member at `pos` (where the minimap shows the killer). */
    fileKill(killerId: number, targetId: number, pos: Vec2, time: number): void {
        const key = `${killerId}:${targetId}:${Math.round(time * 10)}`;
        if (this.killKeys.has(key)) return;
        this.killKeys.add(key);
        if (this.killKeys.size > 128) this.killKeys.clear();
        this.addEvent("kill", pos, time);
    }

    private addEvent(kind: FrontEvent["kind"], pos: Vec2, time: number): void {
        this.events.push({ kind, pos: v2.copy(pos), time });
        if (this.events.length > MAX_EVENTS) this.events.shift();
        this.frontAt = Number.NEGATIVE_INFINITY;
    }

    /**
     * Where the faction is fighting: the recency-weighted centre of the knocks, deaths, kills and Commander pings of the
     * last EVENT_LIFE seconds, or null when nothing happened lately. Shared by the whole faction (cached).
     */
    front(now: number): Vec2 | null {
        if (now - this.frontAt < FRONT_EVERY) return this.frontPos;
        this.frontAt = now;
        let wx = 0;
        let wy = 0;
        let w = 0;
        for (const e of this.events) {
            const age = now - e.time;
            const life = lifeOf(e.kind);
            if (age < 0 || age > life) continue;
            const k = EVENT_WEIGHT[e.kind] * (1 - age / life);
            wx += e.pos.x * k;
            wy += e.pos.y * k;
            w += k;
        }
        this.frontPos = w > 0.5 ? { x: wx / w, y: wy / w } : null;
        return this.frontPos;
    }

    /**
     * The faction's fight nearest `p`: the same evidence within NEAR_FRONT of `p`, nearer events weighing more, or null
     * (a faction fights in several places at once; the faction-wide centre can fall between them).
     */
    frontNear(p: Vec2, now: number): Vec2 | null {
        let wx = 0;
        let wy = 0;
        let w = 0;
        for (const e of this.events) {
            const age = now - e.time;
            const life = lifeOf(e.kind);
            const d = v2.distance(e.pos, p);
            if (age < 0 || age > life || d > NEAR_FRONT) continue;
            const k = EVENT_WEIGHT[e.kind] * (1 - age / life) * (1 - (0.5 * d) / NEAR_FRONT);
            wx += e.pos.x * k;
            wy += e.pos.y * k;
            w += k;
        }
        return w > 0.5 ? { x: wx / w, y: wy / w } : null;
    }
}

/** What the squad leader tells its squad it is doing: taking it to an objective near the front ("on me"). */
export interface SquadPlan {
    leader: number;
    objective: Vec2;
    front: Vec2;
    time: number;
    /** the call is a push onto the enemy (brain/factionFront.ts): the Commander's group crosses the river with it */
    push?: boolean;
}

export class SquadBoard {
    readonly group: number;
    /** latest sighting of each enemy by any squadmate */
    readonly sightings = new Map<number, Sighting>();
    /** the leader's call, refreshed with every decision it takes to advance (null: the squad loots on its own) */
    plan: SquadPlan | null = null;
    /**
     * whether each member rallies to the Commander (true) or keeps to itself (false), as it last told its squad (owner
     * 2026-10-08, brain/factionRally.ts): the ones on their own keep a squad among themselves
     */
    readonly rallies = new Map<number, boolean>();
    readonly pings: SquadPing[] = [];
    private readonly pingKeys = new Set<string>();

    constructor(group: number) {
        this.group = group;
    }

    /** A squadmate saw enemy `id` at `pos`. */
    see(id: number, pos: Vec2, time: number, downed: boolean, by: number): void {
        const s = this.sightings.get(id);
        if (s) {
            if (s.time > time) return;
            s.pos = v2.copy(pos);
            s.time = time;
            s.downed = downed;
            s.by = by;
            return;
        }
        this.sightings.set(id, { id, pos: v2.copy(pos), time, downed, by });
    }

    /** An enemy died (kill feed) or left the game: no more sightings of it. */
    forget(id: number): void {
        this.sightings.delete(id);
    }

    filePing(from: number, pos: Vec2, time: number, type: string): void {
        const key = `${from}:${type}:${Math.round(time * 10)}`;
        if (this.pingKeys.has(key)) return;
        this.pingKeys.add(key);
        if (this.pingKeys.size > 64) this.pingKeys.clear();
        this.pings.push({ pos: v2.copy(pos), time, type, from });
        if (this.pings.length > 16) this.pings.shift();
    }

    /** Drops sightings older than SIGHTING_LIFE (called by the members as they file). */
    prune(now: number): void {
        for (const [id, s] of this.sightings) if (now - s.time > SIGHTING_LIFE) this.sightings.delete(id);
    }

    /**
     * Where the squad's enemies are: the recency-weighted centre of the standing enemies the squad saw in the last
     * `maxAge` seconds and its danger pings, or null.
     */
    front(now: number, maxAge = SIGHTING_LIFE): Vec2 | null {
        let wx = 0;
        let wy = 0;
        let w = 0;
        for (const s of this.sightings.values()) {
            const age = now - s.time;
            if (s.downed || age < 0 || age > maxAge) continue;
            const k = 1 - age / (maxAge + 1);
            wx += s.pos.x * k;
            wy += s.pos.y * k;
            w += k;
        }
        for (const p of this.pings) {
            const age = now - p.time;
            if (p.type !== "ping_danger" || age < 0 || age > PING_LIFE) continue;
            const k = 0.8 * (1 - age / PING_LIFE);
            wx += p.pos.x * k;
            wy += p.pos.y * k;
            w += k;
        }
        return w > 0.3 ? { x: wx / w, y: wy / w } : null;
    }
}

/** The boards of one game (one MapData). */
export class FactionBoards {
    private readonly factions = new Map<number, FactionBoard>();
    private readonly squads = new Map<number, SquadBoard>();

    faction(team: number): FactionBoard {
        let b = this.factions.get(team);
        if (!b) this.factions.set(team, (b = new FactionBoard(team)));
        return b;
    }

    squad(group: number): SquadBoard {
        let b = this.squads.get(group);
        if (!b) this.squads.set(group, (b = new SquadBoard(group)));
        return b;
    }
}

const registry = new WeakMap<MapData, FactionBoards>();

/** The shared boards of the game `map` belongs to. */
export function boardsFor(map: MapData): FactionBoards {
    let b = registry.get(map);
    if (!b) registry.set(map, (b = new FactionBoards()));
    return b;
}
