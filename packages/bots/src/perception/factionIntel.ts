// A bot's 50v50 knowledge (BrainFeatures.faction, bot round 6; installed by perception/install.ts on faction maps
// only): which side it is on, its squad and faction, its role and perks, and what the faction and the squad share
// (perception/factionBoard.ts). Built only from the bot's own snapshots: PlayerInfos (teamId is the faction, groupId
// the squad), Snapshot.factionStatus (the faction minimap), teamAliveCounts, the kill feed, pings (a Commander's reach
// the faction, a squadmate's the squad), LocalPlayerState role and perks, and the enemies on its own screen, which it
// files on its squad's board for its squadmates. Allies' bullets, shots and kills are friendly information: they go
// to the front estimate, never to the threats (the WorldModel's isTeammate covers the whole faction already).
import { type Vec2, v2 } from "@rebirth/core";
import type { MapData, Snapshot } from "@rebirth/sim";
import {
    type AllyRow,
    boardsFor,
    type FactionBoard,
    type FactionBoards,
    SIGHTING_LIFE,
    type SquadBoard,
} from "./factionBoard.ts";
import { type FactionMap, factionMapOf, isFactionMap, nearestRiverPoint, riverSide } from "./factionMap.ts";
import type { WorldModel } from "./world.ts";

/** The squad's sightings are pruned this often (s). */
const PRUNE_EVERY = 2;

export class FactionIntel {
    /** the map plays 50v50 */
    readonly active: boolean;
    readonly geo: FactionMap | null;
    /** faction (1 Red, 2 Blue) and squad of the bot, 0 until PlayerInfos named them */
    team = 0;
    group = 0;
    /** the bot's role ("" for none) and perks (LocalPlayerState) */
    role = "";
    readonly perks = new Set<string>();
    private readonly boards: FactionBoards;
    private faction: FactionBoard | null = null;
    private squad: SquadBoard | null = null;
    private prunedAt = Number.NEGATIVE_INFINITY;
    private selfId = 0;

    constructor(map: MapData, boards: FactionBoards = boardsFor(map)) {
        this.active = isFactionMap(map);
        this.geo = this.active ? factionMapOf(map) : null;
        this.boards = boards;
    }

    /** The faction's shared board (null until the bot knows its faction). */
    get factionBoard(): FactionBoard | null {
        return this.faction;
    }

    /** The squad's shared board (null until the bot knows its squad). */
    get squadBoard(): SquadBoard | null {
        return this.squad;
    }

    hasPerk(type: string): boolean {
        return this.perks.has(type);
    }

    ingest(snap: Snapshot, model: WorldModel): void {
        if (!this.active) return;
        this.selfId = model.selfId;
        const team = model.teamOf.get(model.selfId) ?? 0;
        const group = model.groupOf.get(model.selfId) ?? 0;
        if (team && team !== this.team) {
            this.team = team;
            this.faction = this.boards.faction(team);
        }
        if (group && group !== this.group) {
            this.group = group;
            this.squad = this.boards.squad(group);
        }
        if (model.self.dead) return;
        const local = snap.local;
        if (local.role !== undefined) this.role = local.role;
        if (local.perks) {
            this.perks.clear();
            for (const p of local.perks) this.perks.add(p.type);
        }
        const now = model.time;
        const fb = this.faction;
        const sb = this.squad;
        if (fb) {
            if (snap.factionStatus) fb.fileStatus(snap.factionStatus, snap.time, (id) => model.teamOf.get(id));
            if (snap.teamAliveCounts) fb.aliveCounts = snap.teamAliveCounts;
            if (fb.side === 0 && this.geo && model.snapshots > 0) {
                const s = riverSide(this.geo, model.self.pos);
                if (Math.abs(s) > this.geo.halfWidth) fb.side = Math.sign(s);
            }
        }
        for (const e of snap.emotes ?? []) {
            if (!e.isPing || !e.pos) continue;
            const mate = e.playerId === model.selfId || model.teammates.has(e.playerId);
            // (a faction member outside the squad reaches the bot only as a Commander, Captain or Lone Survivr)
            if (mate) sb?.filePing(e.playerId, e.pos, now, e.type);
            else if (fb && model.teamOf.get(e.playerId) === this.team) fb.filePing(e.playerId, e.pos, now, e.type);
        }
        for (const k of snap.kills ?? []) {
            const killer = k.killerId;
            const victimAlly = model.teamOf.get(k.targetId) === this.team;
            if (k.killed && !victimAlly) sb?.forget(k.targetId);
            if (!fb || !killer || killer === k.targetId || victimAlly) continue;
            if (model.teamOf.get(killer) !== this.team) continue;
            const at = fb.members.get(killer)?.pos ?? (killer === model.selfId ? model.self.pos : undefined);
            if (at) fb.fileKill(killer, k.targetId, at, now);
        }
        if (sb) {
            for (const c of model.contacts.values()) {
                if (c.visible && !c.teammate && !c.dead) sb.see(c.id, c.pos, now, c.downed, model.selfId);
            }
            if (now - this.prunedAt > PRUNE_EVERY) {
                this.prunedAt = now;
                sb.prune(now);
            }
        }
    }

    /** Standing faction members other than the bot (positions of the last faction minimap refresh). */
    allies(): readonly AllyRow[] {
        return this.faction?.standing() ?? [];
    }

    /** Standing faction members other than the bot within `r` of `p`. */
    alliesNear(p: Vec2, r: number): number {
        let n = 0;
        const r2 = r * r;
        for (const m of this.allies()) if (m.playerId !== this.selfId && v2.distanceSqr(m.pos, p) <= r2) n++;
        return n;
    }

    /** Downed (not dead) faction members as the minimap shows them. */
    downedAllies(): AllyRow[] {
        const out: AllyRow[] = [];
        for (const m of this.faction?.members.values() ?? [])
            if (m.downed && !m.dead && m.playerId !== this.selfId) out.push(m);
        return out;
    }

    /**
     * Standing enemies known within `r` of `p` and seen in the last `maxAge` seconds: the bot's own contacts and its
     * squad's sightings, each enemy once.
     */
    enemiesNear(model: WorldModel, p: Vec2, r: number, maxAge: number): number {
        const now = model.time;
        const r2 = r * r;
        let n = 0;
        const counted = new Set<number>();
        for (const c of model.contacts.values()) {
            if (c.teammate || c.dead || c.downed || now - c.lastSeen > maxAge) continue;
            if (v2.distanceSqr(c.pos, p) > r2) continue;
            counted.add(c.id);
            n++;
        }
        for (const s of this.squad?.sightings.values() ?? []) {
            if (s.downed || counted.has(s.id) || now - s.time > maxAge || v2.distanceSqr(s.pos, p) > r2) continue;
            const c = model.contacts.get(s.id);
            if (c && (c.dead || c.downed)) continue;
            n++;
        }
        return n;
    }

    /**
     * Where the bot's own fight is: its squad's enemies when it has seen some lately, else the faction's front (its
     * fight nearest `near` when given, FactionBoard.frontNear).
     */
    front(now: number, squadAge = SIGHTING_LIFE, near?: Vec2): Vec2 | null {
        const squad = this.squad?.front(now, squadAge);
        if (squad) return squad;
        if (!this.faction) return null;
        return near ? this.faction.frontNear(near, now) : this.faction.front(now);
    }

    /** Sign of the river side the bot's faction spawned on (factionMap.ts riverSide), 0 while unknown. */
    get side(): number {
        return this.faction?.side ?? 0;
    }

    /** Whether `p` lies on the faction's own bank (out of the water). Unknown side or no river: true. */
    ownBank(p: Vec2): boolean {
        const geo = this.geo;
        const side = this.side;
        if (!geo || !side) return true;
        return riverSide(geo, p) * side > geo.halfWidth;
    }

    /** Unit direction from `p` towards the enemy's side (across the river), null without a river or a known side. */
    forward(p: Vec2): Vec2 | null {
        const geo = this.geo;
        const side = this.side;
        if (!geo || !side) return null;
        const { dir } = nearestRiverPoint(geo, p);
        // riverSide is positive on the left of the river's direction: the faction's bank lies along side x left
        const left = { x: -dir.y, y: dir.x };
        return v2.mul(left, -side);
    }
}
