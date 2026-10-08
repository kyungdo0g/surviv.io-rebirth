// Match lifecycle: waiting until the start condition, the join window, alive count, kill (and knock, M6a) events with
// kill credit, the kill leader, game over with the winner and ranks, and each player's GameOver result. Team modes
// (M6a) count groups: the match starts with two groups, ends when one group is left alive (downed members count), ranks
// groups, sends PlayerStats to a player who died while its group plays on and GameOver to every member of a group once
// it is eliminated or wins. 50v50 (M7a) counts factions (player.teamId): the match starts with two factions ready and
// ends when one is left; a player who dies while both play on gets PlayerStats, everyone gets the GameOver at the end
// with both factions' first Commanders and the match MVP in its stats (rebirth-deviations.md, the owner's screenshot of
// the original's four cards); every role holder's death is announced (RoleAnnouncement).
// Behaviour follows survev server/src/game/game.ts (start, canJoin, checkGameOver), gameModeManager.ts (alive count,
// isGameStarted, getWinningTeamId, showStatsMsg, getGameoverPlayers, getPlayersSortedByRank) and objects/player.ts
// (kill, down, promoteToKillLeader, addGameOverMsg); docs/research/ui/hud.md (kill feed, kill leader, death and win
// screens).
import { DamageType, getMapDef, playerLimit } from "@rebirth/defs";
import { TICK_HZ } from "../api.ts";
import type { DamageParams } from "../combat/damage.ts";
import type { GameOverEvent, KillEvent, KillLeaderView, PlayerStatsView, RoleAnnouncementEvent } from "../view.ts";
import type { Player } from "../world/player.ts";
import { damageSourceOf, EventLog } from "./events.ts";
import type { Gas } from "./gas.ts";
import type { Group } from "./teams.ts";

/** Role id announced for the kill leader (GameObjectDefs role). */
export const KILL_LEADER_ROLE = "kill_leader";
/** Events are kept this long for viewers that skip snapshots (congested sockets). */
const EVENT_RETENTION_TICKS = 30 * TICK_HZ;

/**
 * Whether a disconnecting player leaves the game (survev player.ts:3116-3124 canDespawn): a living, standing player
 * that joined less than `minActiveTime` ago, but never a 50v50 role holder.
 */
export function canDespawn(p: Player, factionMode: boolean, minActiveTime: number): boolean {
    if (factionMode && p.role) return false;
    return p.timeAlive < minActiveTime - 1e-9 && !p.dead && !p.downed;
}

export interface MatchOptions {
    /**
     * Sandbox / loopback: the match starts on the first tick whatever the player count, never ends (no game over)
     * and always accepts joins.
     */
    sandbox: boolean;
    /** players alive for at least `rules.minActiveTime` needed to start (original: 2, survev isGameStarted) */
    minPlayers: number;
    /** the game's player cap (GameOptions.maxPlayers): where it grows the map, that many play (defs playerLimit) */
    maxPlayers?: number;
}

/**
 * Players a game holds at most, the dead included: the wire's player lists count in 8 bits (protocol PlayerInfos,
 * team and faction status) and solo group ids run out at 255 (protocol teams.ts MAX_GROUP_ID).
 */
export const MAX_PLAYERS_IN_GAME = 255;

/** What the match needs from the game. */
export interface MatchHost {
    readonly tick: number;
    readonly gas: Gas;
    readonly options: { mapName: string };
    readonly rules: {
        joinWindowSeconds: number;
        killLeaderMinKills: number;
        minActiveTime: number;
        startWhenFull: boolean;
    };
    /** groups (M6a); solo: one per player */
    readonly teams: { readonly teamMode: number; aliveGroups(except?: Player): Group[] };
    /** 50v50 factions (M7a), null on other maps */
    readonly faction: { readonly teams: ReadonlyArray<{ readonly id: number; readonly leader: Player | null }> } | null;
    /** Savannah's The Hunted follows the kill leader (M7a) */
    readonly roles: { onKillLeader(leader: Player, previous: Player | undefined): void };
    players(): Iterable<Player>;
    getPlayer(id: number): Player | undefined;
    nextEventSeq(): number;
}

export class Match {
    readonly options: MatchOptions;
    started = false;
    /** a winner was decided (the simulation keeps running; hosts close the game after a grace period) */
    over = false;
    /** tick of the start / of the game over, -1 before */
    startTick = -1;
    overTick = -1;
    winningTeamId = 0;
    winnerIds: number[] = [];
    killLeaderId = 0;
    /**
     * 50v50: the match MVP, chosen once at game over (survev game.ts:365 factionsMvp); null before, or without both
     * Commanders
     */
    factionMvp: Player | null = null;
    readonly kills = new EventLog<KillEvent>();
    readonly roles = new EventLog<RoleAnnouncementEvent>();
    readonly results = new EventLog<{ playerId: number; event: GameOverEvent }>();
    /** team modes: stats of players who died while their group plays on (the original PlayerStats message) */
    readonly statsResults = new EventLog<{ playerId: number; stats: PlayerStatsView }>();
    private readonly host: MatchHost;
    private readonly killLeaderEnabled: boolean;
    private readonly maxPlayers: number;
    private nextKilledIndex = 0;
    private readonly resultSent = new Set<number>();
    private readonly statsSent = new Set<number>();
    private pendingResults: Player[] = [];

    constructor(host: MatchHost, options: MatchOptions) {
        this.host = host;
        this.options = options;
        const def = getMapDef(host.options.mapName);
        this.killLeaderEnabled = def.gameMode.killLeaderEnabled;
        // a cap that grows the map lets that many play (defs mapDefForPlayers, playerLimit)
        this.maxPlayers = Math.min(MAX_PLAYERS_IN_GAME, playerLimit(def, options.maxPlayers));
    }

    /** Living players in join (id) order. */
    living(): Player[] {
        const out: Player[] = [];
        for (const p of this.host.players()) if (!p.dead) out.push(p);
        return out.sort((a, b) => a.id - b.id);
    }

    get aliveCount(): number {
        let n = 0;
        for (const p of this.host.players()) if (!p.dead) n++;
        return n;
    }

    /** Seconds since the start (0 before). */
    get startedSeconds(): number {
        return this.started ? (this.host.tick - this.startTick) / TICK_HZ : 0;
    }

    /**
     * Whether a new player may join: not over, fewer living players than the mode's maximum (or the game's player cap
     * where it grows the map), fewer than MAX_PLAYERS_IN_GAME in the game, and the match started less than
     * `joinWindowSeconds` ago (survev game.ts canJoin). Sandbox matches always accept joins.
     */
    canJoin(): boolean {
        if (this.options.sandbox) return true;
        if (this.over || this.full) return false;
        return !this.started || this.startedSeconds < this.host.rules.joinWindowSeconds;
    }

    /**
     * The game takes no more players: as many living players as it takes (the mode's maximum, or the player cap where
     * it grows the map), or MAX_PLAYERS_IN_GAME in the game, the dead included (never past what the wire can list).
     */
    get full(): boolean {
        if (this.aliveCount >= this.maxPlayers) return true;
        let inGame = 0;
        for (const _ of this.host.players()) inGame++;
        return inGame >= MAX_PLAYERS_IN_GAME;
    }

    private get teamMode(): number {
        return this.host.teams.teamMode;
    }

    /**
     * Sides with a living (possibly downed) member, excluding `except` (survev modeManager.aliveCount): solo players,
     * duo / squad groups or 50v50 factions; `player.teamId` names the side in every mode.
     */
    aliveSides(except?: Player): number[] {
        const sides = new Set<number>();
        for (const p of this.host.players()) if (p !== except && !p.dead) sides.add(p.teamId);
        return [...sides].sort((a, b) => a - b);
    }

    aliveGroupCount(except?: Player): number {
        return this.aliveSides(except).length;
    }

    /**
     * Start check, run at the beginning of a tick: the match starts once `minPlayers` sides have a player that can no
     * longer despawn (survev cantDespawnAliveCount > 1), at once in a sandbox, and (rules.startWhenFull, the owner's
     * ruling) at once in a full game with `minPlayers` sides alive. Returns true on the start.
     */
    checkStart(): boolean {
        if (this.started) return false;
        if (!this.options.sandbox) {
            const need = Math.max(1, this.options.minPlayers);
            // sides with a living player and a member that can no longer despawn (survev cantDespawnAliveCount: a
            // downed player, a dead teammate and a 50v50 role holder count too)
            const factionMode = !!getMapDef(this.host.options.mapName).gameMode.factionMode;
            const alive = new Set(this.living().map((p) => p.teamId));
            const ready = new Set<number>();
            for (const p of this.host.players()) {
                if (alive.has(p.teamId) && !canDespawn(p, factionMode, this.host.rules.minActiveTime)) {
                    ready.add(p.teamId);
                }
            }
            // a full game no longer waits minActiveTime for its players (rebirth-deviations.md "Start when full")
            const fullStart = this.host.rules.startWhenFull && this.full && alive.size >= need;
            if (ready.size < need && !fullStart) return false;
        }
        this.started = true;
        this.startTick = this.host.tick;
        this.host.gas.start();
        return true;
    }

    /** Kill bookkeeping after `victim` died (killPlayer already gave the kill credit). */
    onPlayerKilled(victim: Player, params: DamageParams, credit: Player | undefined): void {
        victim.killedIndex = this.nextKilledIndex++;
        const itemSourceType = params.gameSourceType ?? "";
        const mapSourceType = params.mapSourceType ?? "";
        const sourcePlayer = params.sourceId ? this.host.getPlayer(params.sourceId) : undefined;
        this.logKill({
            targetId: victim.id,
            // bleeding kills name no killer (survev player.ts kill)
            killerId: sourcePlayer && params.damageType !== DamageType.Bleeding ? sourcePlayer.id : 0,
            killCreditId: credit?.id ?? 0,
            killerKills: credit?.kills ?? 0,
            damageType: params.damageType,
            source: damageSourceOf(params.damageType, itemSourceType, mapSourceType),
            itemSourceType,
            mapSourceType,
            downed: false,
            killed: true,
        });
        // a role holder's death is announced (survev kill: RoleAnnouncement killed for this.role)
        if (victim.role) {
            const killerId = sourcePlayer?.id ?? 0;
            this.announce({ playerId: victim.id, killerId, role: victim.role, assigned: false, killed: true });
        }
        const victimWasLeader = victim.id === this.killLeaderId;
        // The Hunted is the kill leader on Savannah: its role announcement replaces the kill leader's
        if (victimWasLeader && victim.role !== "the_hunted") {
            this.logRole({ playerId: victim.id, killerId: sourcePlayer?.id ?? 0, assigned: false, killed: true });
        }
        // any credit re-checks the kill leader, a teamkill too: the dead leader's kills no longer count (survev
        // player.ts:2869-2891)
        if (this.killLeaderEnabled && credit) this.updateKillLeader(credit);
        if (victimWasLeader && this.killLeaderId === victim.id) this.killLeaderId = 0;
        this.checkGameOver();
        this.pendingResults.push(victim);
    }

    /**
     * `victim` was knocked down (M6a; survev down): a Kill event with `downed` true, the knocker as killer and credit.
     */
    onPlayerDowned(victim: Player, params: DamageParams, source: Player | undefined): void {
        const itemSourceType = params.gameSourceType ?? "";
        const mapSourceType = params.mapSourceType ?? "";
        this.logKill({
            targetId: victim.id,
            killerId: source?.id ?? 0,
            killCreditId: source?.id ?? 0,
            killerKills: 0,
            damageType: params.damageType,
            source: damageSourceOf(params.damageType, itemSourceType, mapSourceType),
            itemSourceType,
            mapSourceType,
            downed: true,
            killed: false,
        });
    }

    /**
     * A new kill leader is the living player with the most kills (at least killLeaderMinKills; ties keep the
     * earlier joiner), promoted only when it is the player who just scored and beats the current leader
     * (survev player.ts kill / getPlayerWithHighestKills).
     */
    private updateKillLeader(credit: Player): void {
        const current = this.killLeaderId ? this.host.getPlayer(this.killLeaderId) : undefined;
        const currentKills = current && !current.dead ? current.kills : 0;
        let best: Player | undefined;
        for (const p of this.living()) {
            if (p.kills < this.host.rules.killLeaderMinKills) continue;
            if (!best || p.kills > best.kills) best = p;
        }
        if (best === credit && current !== credit && credit.kills > currentKills) {
            this.killLeaderId = credit.id;
            // on Savannah the new kill leader becomes The Hunted (announced as that role) (survev promoteToKillLeader)
            if (getMapDef(this.host.options.mapName).gameMode.sniperMode) {
                this.host.roles.onKillLeader(credit, current);
            } else {
                this.logRole({ playerId: credit.id, killerId: 0, assigned: true, killed: false });
            }
        }
    }

    /** A player left the game (despawned): it no longer counts as alive. */
    onPlayerRemoved(player: Player): void {
        if (player.id === this.killLeaderId) this.killLeaderId = 0;
        this.pendingResults = this.pendingResults.filter((p) => p !== player);
        if (!player.dead) this.checkGameOver(player);
    }

    /**
     * Game over: started and at most one player (team modes: group, 50v50: faction) alive (survev game.ts
     * checkGameOver).
     */
    private checkGameOver(removed?: Player): void {
        if (this.over || !this.started || this.options.sandbox) return;
        const sides = this.aliveSides(removed);
        if (sides.length > 1) return;
        this.over = true;
        this.overTick = this.host.tick;
        this.factionMvp = this.pickFactionMvp(removed);
        this.winningTeamId = sides[0] ?? 0;
        this.winnerIds = this.living()
            .filter((p) => p !== removed && p.teamId === this.winningTeamId && this.winningTeamId !== 0)
            .map((p) => p.id);
    }

    /**
     * 50v50 MVP once both Commanders exist (survev gameModeManager.ts:253-276 getFactionMvp): the most kills over every
     * player, dead ones included, in join order; equal kills go to the later player unless the earlier one dealt more
     * damage (survev's reduce: `best.damageDealt > p.damageDealt ? best : p`). A player leaving at the game over is
     * already out of survev's list.
     */
    private pickFactionMvp(removed?: Player): Player | null {
        const faction = this.host.faction;
        if (!faction?.teams.every((t) => t.leader)) return null;
        let best: Player | null = null;
        for (const p of this.host.players()) {
            if (p === removed) continue;
            if (!best || p.kills > best.kills || (p.kills === best.kills && !(best.damageDealt > p.damageDealt))) {
                best = p;
            }
        }
        return best;
    }

    /**
     * End of a tick: GameOver results for the players that died this tick (ranked against the players still alive,
     * survev addGameOverMsg after all updates) and, once the match is over, for the survivors (the winner).
     */
    endTick(): void {
        const pending = this.pendingResults;
        this.pendingResults = [];
        for (const p of pending) {
            // team modes: a player whose group plays on gets its stats; the group's GameOver comes when it is out
            if (this.teamMode > 1 && !this.over && this.groupPlaysOn(p)) this.addStats(p);
            else this.addGroupResult(p);
        }
        if (this.over) for (const p of this.living()) this.addGroupResult(p);
        // 50v50: everyone learns the result (survev only forwards it to spectators of the survivors)
        if (this.over && this.host.faction) for (const p of this.host.players()) this.addGroupResult(p);
        const minTick = this.host.tick - EVENT_RETENTION_TICKS;
        this.kills.prune(minTick);
        this.roles.prune(minTick);
        this.results.prune(minTick);
        this.statsResults.prune(minTick);
    }

    /** A member other than `p` is alive and connected while other groups remain (survev showStatsMsg). */
    private groupPlaysOn(p: Player): boolean {
        // 50v50: stats while both factions play on (survev showStatsMsg Faction)
        if (this.host.faction) return this.aliveGroupCount() > 1;
        const group = p.group;
        if (!group || group.allDeadOrDisconnected) return false;
        return this.aliveGroupCount() > 1;
    }

    private addStats(player: Player): void {
        if (this.statsSent.has(player.id)) return;
        this.statsSent.add(player.id);
        this.statsResults.push(this.host.nextEventSeq(), this.host.tick, {
            playerId: player.id,
            stats: playerStats(player),
        });
    }

    /**
     * GameOver for `player` and, in team modes, every member of its group (survev getGameoverPlayers); 50v50: the
     * player alone, its stats followed by the Red and Blue first Commanders once both exist, then the MVP once the
     * game is over (listed even when it is the player or a Commander, as survev does).
     */
    private addGroupResult(player: Player): void {
        const faction = this.host.faction;
        if (faction) {
            const leaders = faction.teams.map((t) => t.leader);
            const stats = leaders.every((l) => l) ? [player, ...(leaders as Player[])] : [player];
            if (stats.length > 1 && this.factionMvp) stats.push(this.factionMvp);
            this.addResult(player, stats);
            return;
        }
        const members = this.teamMode > 1 && player.group ? player.group.players : [player];
        for (const m of members) this.addResult(m, members);
    }

    private addResult(player: Player, members: readonly Player[]): void {
        if (this.resultSent.has(player.id)) return;
        this.resultSent.add(player.id);
        const won = this.winningTeamId !== 0 && this.winningTeamId === player.teamId;
        const event: GameOverEvent = {
            teamId: player.teamId,
            // the GameOver goes out after the alive count was updated (survev addGameOverMsg)
            teamRank: won ? 1 : this.aliveGroupCount() + 1,
            gameOver: this.winningTeamId !== 0,
            winningTeamId: this.winningTeamId,
            playerStats: members.map(playerStats),
        };
        this.results.push(this.host.nextEventSeq(), this.host.tick, { playerId: player.id, event });
    }

    /** The GameOver result of `playerId` logged after `seq`, if any. */
    resultSince(playerId: number, seq: number): GameOverEvent | undefined {
        for (const r of this.results.since(seq)) if (r.playerId === playerId) return r.event;
        return undefined;
    }

    /** The PlayerStats of `playerId` logged after `seq`, if any (team modes). */
    statsSince(playerId: number, seq: number): PlayerStatsView | undefined {
        for (const r of this.statsResults.since(seq)) if (r.playerId === playerId) return r.stats;
        return undefined;
    }

    killLeader(): KillLeaderView {
        const p = this.killLeaderId ? this.host.getPlayer(this.killLeaderId) : undefined;
        return p ? { id: p.id, kills: p.kills } : { id: 0, kills: 0 };
    }

    /**
     * Final ranking: survivors first, then the dead from the last to the first killed (survev
     * getPlayersSortedByRank); players dying in the same tick share no rank here, the later index ranks higher. Team
     * modes rank groups by their last member to die and give every member the group's rank.
     */
    ranking(): Array<{ playerId: number; rank: number }> {
        const lastDeath = (p: Player) => (p.dead ? p.killedIndex : Number.MAX_SAFE_INTEGER);
        if (this.teamMode <= 1) {
            const players = [...this.host.players()].sort((a, b) => lastDeath(b) - lastDeath(a) || a.id - b.id);
            return players.map((p, i) => ({ playerId: p.id, rank: i + 1 }));
        }
        const groups = new Map<number, Player[]>();
        for (const p of this.host.players()) {
            // sides: groups, or 50v50 factions (teamId equals the group id in duo / squad)
            const list = groups.get(p.teamId);
            if (list) list.push(p);
            else groups.set(p.teamId, [p]);
        }
        const ranked = [...groups.values()]
            .map((players) => ({ players, last: Math.max(...players.map(lastDeath)) }))
            .sort((a, b) => b.last - a.last || a.players[0].id - b.players[0].id);
        const out: Array<{ playerId: number; rank: number }> = [];
        ranked.forEach((g, i) => {
            for (const p of g.players) out.push({ playerId: p.id, rank: i + 1 });
        });
        return out;
    }

    private logKill(event: KillEvent): void {
        this.kills.push(this.host.nextEventSeq(), this.host.tick, event);
    }

    private logRole(e: Omit<RoleAnnouncementEvent, "role">): void {
        this.announce({ ...e, role: KILL_LEADER_ROLE });
    }

    /** A role event for every viewer (promotions, role holders' deaths, kill leader) (M7a). */
    announce(e: RoleAnnouncementEvent): void {
        this.roles.push(this.host.nextEventSeq(), this.host.tick, { ...e });
    }
}

export function playerStats(p: Player): PlayerStatsView {
    const s = p.matchStats();
    return {
        playerId: p.id,
        timeAlive: s.timeAlive,
        kills: s.kills,
        dead: p.dead,
        damageDealt: s.damageDealt,
        damageTaken: s.damageTaken,
    };
}
