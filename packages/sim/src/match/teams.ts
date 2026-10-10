// Groups (M6a): solo gives every player its own group; duo and squad group players by party key or auto fill, place
// teammates next to their group's spawn position, decide between a knock and a death on lethal damage (team wipes
// included), and keep the group status (positions, dead, downed) the team HUD shows, refreshed at the original rate.
// Behaviour follows survev server/src/game/group.ts, gameModeManager.ts handlePlayerDeath, objects/player.ts
// getGroupAndTeam / addGroup / activatePlayer and the group spawn position ticker of update, and
// docs/research/mechanics/downed-revive.md "When a player goes down" and "Kill credit for downed players".
// M7a: in 50v50 the groups live inside the Red / Blue factions (match/faction.ts): a group belongs to one faction,
// player.teamId is the faction, and knocks, wipes and Revivify consider the whole faction (survev handlePlayerDeath
// uses the Team in faction mode).
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig } from "@rebirth/defs";
import { killPlayer } from "../combat/combat.ts";
import type { DamageParams } from "../combat/damage.ts";
import type { AddPlayerOptions, TeamMemberView } from "../view.ts";
import type { SimContext } from "../world/context.ts";
import { downPlayer } from "../world/downed.ts";
import type { Player } from "../world/player.ts";
import type { FactionSystem } from "./faction.ts";
import { canPlayerSpawn, randomSpawnPos, type SpawnHost, teammateSpawnPos } from "./spawn.ts";

/** Group and team ids are u8 on the wire; 0 means none. */
const MAX_GROUP_ID = 255;
/** The group's first player moves the group spawn position to where it stands once a second (survev update). */
const SPAWN_POSITION_INTERVAL = 1;

export class Group {
    readonly id: number;
    readonly autoFill: boolean;
    readonly maxPlayers: number;
    /** members in join order */
    readonly players: Player[] = [];
    /** seats claimed by the parties that joined (survev reservedSlots) */
    reservedSlots = 0;
    /** where the next teammate spawns (around it) */
    spawnPosition: Vec2 | null = null;
    /** faction of the group (50v50: Red 1, Blue 2; 0 outside faction mode) (M7a) */
    factionTeam = 0;
    spawnPositionTicker = 0;

    constructor(id: number, autoFill: boolean, maxPlayers: number) {
        this.id = id;
        this.autoFill = autoFill;
        this.maxPlayers = maxPlayers;
    }

    /** A member is alive (downed members count). */
    get alive(): boolean {
        return this.players.some((p) => !p.dead);
    }

    /** Every member is dead or disconnected (survev allDeadOrDisconnected): the group is out for its players. */
    get allDeadOrDisconnected(): boolean {
        return this.players.every((p) => p.dead || p.disconnected);
    }

    /** A party of `n` may auto fill into this group (survev Group.canJoin). */
    canJoin(n: number): boolean {
        return this.maxPlayers - this.reservedSlots - n >= 0 && !this.allDeadOrDisconnected;
    }

    /** No member other than `player` is alive and connected (survev checkAllDeadOrDisconnected). */
    othersDeadOrDisconnected(player: Player): boolean {
        return othersDeadOrDisconnected(this.players, player);
    }

    /** Every living, connected member other than `player` is downed (survev checkAllDowned). */
    othersDowned(player: Player): boolean {
        return othersDowned(this.players, player);
    }

    /** A living, connected member holds Revivify: nobody is finished off yet (survev checkSelfRevive). */
    hasSelfRevive(): boolean {
        return hasSelfRevive(this.players);
    }
}

function othersDeadOrDisconnected(players: readonly Player[], player: Player): boolean {
    return !players.some((p) => p !== player && !p.dead && !p.disconnected);
}

function othersDowned(players: readonly Player[], player: Player): boolean {
    return players.every((p) => p === player || p.downed || p.dead || p.disconnected);
}

function hasSelfRevive(players: readonly Player[]): boolean {
    return players.some((p) => !p.dead && !p.disconnected && p.hasPerk("self_revive"));
}

/** What the team system needs from the game. */
export interface TeamHost extends SpawnHost {
    readonly rules: { teamStatusInterval: number };
    canJoin(): boolean;
}

interface Status {
    pos: Vec2;
    dead: boolean;
    downed: boolean;
}

export class TeamSystem {
    /** 1 solo, 2 duo, 4 squad */
    readonly teamMode: number;
    private readonly host: TeamHost;
    private readonly groups: Group[] = [];
    private readonly keyToGroup = new Map<string, Group>();
    private readonly status = new Map<number, Status>();
    private statusTicker = 0;
    /** the factions above the groups (50v50, M7a) */
    faction: FactionSystem | null = null;

    constructor(host: TeamHost, teamMode: number) {
        this.host = host;
        this.teamMode = teamMode;
    }

    /** Every group in creation order. */
    all(): readonly Group[] {
        return this.groups;
    }

    /** Groups with a living (possibly downed) member. */
    aliveGroups(except?: Player): Group[] {
        return this.groups.filter((g) => g.players.some((p) => p !== except && !p.dead));
    }

    /**
     * The group a joining player goes into (survev getGroupAndTeam): its own in solo; else the party key's group while
     * it has room, then an auto-fill group with room for the party, else a new group. A party's seats are reserved
     * the first time its key is used.
     */
    assign(opts: AddPlayerOptions = {}): Group {
        if (this.teamMode <= 1) return this.newGroup(false);
        const partySize = Math.max(1, Math.min(this.teamMode, Math.floor(opts.partySize ?? 1)));
        const autoFill = opts.autoFill ?? true;
        const key = opts.group;
        // 50v50: a new party goes to the faction with fewer living players (survev getGroupAndTeam)
        const faction = this.faction ? this.faction.smallestTeam().id : 0;
        let group = key !== undefined ? this.keyToGroup.get(key) : undefined;
        if (group && group.players.length >= group.maxPlayers) group = undefined;
        if (!group && autoFill) {
            group = this.groups.find((g) => g.autoFill && g.factionTeam === faction && g.canJoin(partySize));
        }
        if (!group) {
            group = this.newGroup(autoFill);
            group.factionTeam = faction;
        }
        if (key === undefined || this.keyToGroup.get(key) !== group) {
            group.reservedSlots += partySize;
            if (key !== undefined) this.keyToGroup.set(key, group);
        }
        return group;
    }

    /** Smallest group id no group uses (solo keeps the M4 team ids: 1, 2, ... reused once a player left). */
    private newGroup(autoFill: boolean): Group {
        const used = new Set(this.groups.map((g) => g.id));
        let id = 1;
        while (used.has(id) && id < MAX_GROUP_ID) id++;
        const group = new Group(id, autoFill, Math.max(1, this.teamMode));
        this.groups.push(group);
        return group;
    }

    /** Spawn point of a player joining `group` (next to its teammates in team modes). */
    spawnPos(group: Group, rng: Rng): Vec2 {
        if (this.teamMode > 1 && group.spawnPosition && group.players.length > 0) {
            return teammateSpawnPos(this.host, rng, group, group.spawnPosition);
        }
        // 50v50: the group's first player spawns in its faction's band (faction.ts spawnBand)
        const band = this.faction && group.factionTeam ? this.faction.spawnBand(group.factionTeam) : undefined;
        return randomSpawnPos(this.host, rng, group, band, group.factionTeam);
    }

    /**
     * Puts a new player into its group (ids, spawn position, status). `spawned` false: the player waits elsewhere
     * (Cobalt's Twins bunker, M7b) and sets the group's spawn position once it leaves (modes/classSelect.ts).
     */
    add(player: Player, group: Group, spawned = true): void {
        player.group = group;
        player.groupId = group.id;
        player.teamId = group.factionTeam || group.id;
        this.faction?.add(player, group.factionTeam);
        group.players.push(player);
        if (this.teamMode > 1 && !group.spawnPosition && spawned) group.spawnPosition = v2.copy(player.pos);
        this.refreshStatus(player);
    }

    /** A player left the game: an empty group disappears (its id may be reused, like the M4 team ids). */
    remove(player: Player): void {
        this.status.delete(player.id);
        this.faction?.remove(player);
        const group = player.group;
        if (!group) return;
        const i = group.players.indexOf(player);
        if (i >= 0) group.players.splice(i, 1);
        if (group.players.length > 0) return;
        this.groups.splice(this.groups.indexOf(group), 1);
        for (const [key, g] of this.keyToGroup) if (g === group) this.keyToGroup.delete(key);
    }

    /**
     * Lethal damage (survev handlePlayerDeath). Solo: death. Team modes: a downed player dies, its knocker credited for
     * bleed-outs, environment kills and finishes by the knocker's team or by the victim's own team; a standing player
     * is knocked down unless no teammate is left standing (all others dead, disconnected or downed, and none holds
     * Revivify): then it dies and every downed teammate dies with it (team wipe, each credited to its knocker).
     */
    handlePlayerDeath(ctx: SimContext, player: Player, params: DamageParams): void {
        const group = player.group;
        if (this.teamMode <= 1 || !group) {
            killPlayer(ctx, player, params);
            return;
        }
        // 50v50: the whole faction decides between a knock and a death
        const mates = this.faction?.team(player.teamId)?.players ?? group.players;
        if (player.downed) {
            killPlayer(ctx, player, params, this.downedKillCredit(ctx, player, params));
            // only possible when a Revivify holder had kept the others from being finished off
            if (othersDowned(mates, player) && !hasSelfRevive(mates)) killAllDowned(ctx, mates);
            return;
        }
        const allDowned = othersDowned(mates, player);
        if (!hasSelfRevive(mates) && (othersDeadOrDisconnected(mates, player) || allDowned)) {
            killPlayer(ctx, player, params);
            if (allDowned) killAllDowned(ctx, mates);
        } else {
            downPlayer(ctx, player, params);
        }
    }

    /** The knocker when it keeps the credit for finishing `player` (gameModeManager.ts; downed-revive.md). */
    private downedKillCredit(ctx: SimContext, player: Player, params: DamageParams): number | undefined {
        const downer = player.downedBy ? ctx.getPlayer(player.downedBy) : undefined;
        if (!downer) return undefined;
        const source = params.sourceId ? ctx.getPlayer(params.sourceId) : undefined;
        const finishedByTeammate = !!source && downer.teamId === source.teamId;
        const nonPlayerKill = params.damageType !== DamageType.Player;
        const teammateStole = !!source && downer.teamId !== source.teamId && player.teamId === source.teamId;
        return finishedByTeammate || nonPlayerKill || teammateStole ? downer.id : undefined;
    }

    /** Per tick: group spawn positions follow their first player, team status refreshes at the original rate. */
    update(dt: number): void {
        if (this.teamMode <= 1) return;
        const joinable = this.host.canJoin();
        for (const g of this.groups) {
            const leader = g.players[0];
            if (!leader || leader.dead || leader.awaitingClass || !joinable || g.players.length >= g.maxPlayers)
                continue;
            g.spawnPositionTicker -= dt;
            if (g.spawnPositionTicker > 0) continue;
            g.spawnPositionTicker = SPAWN_POSITION_INTERVAL;
            if (canPlayerSpawn(this.host, leader.pos)) g.spawnPosition = v2.copy(leader.pos);
        }
        this.statusTicker += dt;
        if (this.statusTicker < this.host.rules.teamStatusInterval - 1e-9) return;
        this.statusTicker = 0;
        for (const p of this.host.players()) this.refreshStatus(p);
    }

    private refreshStatus(p: Player): void {
        this.status.set(p.id, { pos: v2.copy(p.pos), dead: p.dead, downed: p.downed });
    }

    /** The team HUD rows of `player`'s group (team modes only; survev PlayerStatus + GroupStatus). */
    teamView(player: Player): TeamMemberView[] | undefined {
        const group = player.group;
        if (this.teamMode <= 1 || !group) return undefined;
        return group.players.map((p) => {
            const st = this.status.get(p.id) ?? { pos: p.pos, dead: p.dead, downed: p.downed };
            return {
                playerId: p.id,
                name: p.name,
                health: p.dead ? 0 : p.health,
                downed: st.downed,
                dead: st.dead,
                disconnected: p.disconnected,
                pos: v2.copy(st.pos),
                role: p.role,
            };
        });
    }
}

/** Team wipe: every downed member dies of Bleeding, credited to its knocker (survev killAllDowned). */
export function killAllDowned(ctx: SimContext, group: Group | readonly Player[]): void {
    const players = Array.isArray(group) ? group : (group as Group).players;
    for (const p of [...players]) {
        if (p.dead || !p.downed) continue;
        killPlayer(ctx, p, {
            amount: 0,
            damageType: DamageType.Bleeding,
            dir: v2.copy(p.dir),
            sourceId: p.downedBy || undefined,
        });
    }
}

/**
 * A player died outside the knock rules (a collapsing building, world/collapse.ts): when every teammate left is
 * downed and none holds Revivify, the downed die too, as after any team wipe (handlePlayerDeath).
 */
export function wipeIfAllDowned(ctx: SimContext, player: Player): void {
    const mates = ctx.faction?.team(player.teamId)?.players ?? player.group?.players ?? [];
    if (othersDowned(mates, player) && !hasSelfRevive(mates)) killAllDowned(ctx, mates);
}

/** GameConfig team spawn radius, re-exported for tests. */
export const TEAMMATE_SPAWN_RADIUS = GameConfig.player.teammateSpawnRadius;
