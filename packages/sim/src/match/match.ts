// Match lifecycle (solo rules): waiting until the start condition, the join window, alive count, kill events with
// kill credit, the kill leader, game over with the winner and ranks, and each player's GameOver result.
// Behaviour follows survev server/src/game/game.ts (start, canJoin, checkGameOver), gameModeManager.ts (solo
// alive count, isGameStarted) and objects/player.ts (kill, promoteToKillLeader, addGameOverMsg);
// docs/research/ui/hud.md (kill feed, kill leader, death and win screens).
import { DamageType, getMapDef } from "@rebirth/defs";
import { TICK_HZ } from "../api.ts";
import type { DamageParams } from "../combat/damage.ts";
import type { GameOverEvent, KillEvent, KillLeaderView, PlayerStatsView, RoleAnnouncementEvent } from "../view.ts";
import type { Player } from "../world/player.ts";
import { damageSourceOf, EventLog } from "./events.ts";
import type { Gas } from "./gas.ts";

/** Role id announced for the kill leader (GameObjectDefs role). */
export const KILL_LEADER_ROLE = "kill_leader";
/** Events are kept this long for viewers that skip snapshots (congested sockets). */
const EVENT_RETENTION_TICKS = 30 * TICK_HZ;
/** Team ids are u8 on the wire (GameOver teamId / winningTeamId); 0 means none. */
const MAX_TEAM_ID = 255;

export interface MatchOptions {
    /**
     * Sandbox / loopback: the match starts on the first tick whatever the player count, never ends (no game over)
     * and always accepts joins.
     */
    sandbox: boolean;
    /** players alive for at least `rules.minActiveTime` needed to start (original: 2, survev isGameStarted) */
    minPlayers: number;
}

/** What the match needs from the game. */
export interface MatchHost {
    readonly tick: number;
    readonly gas: Gas;
    readonly options: { mapName: string };
    readonly rules: { joinWindowSeconds: number; killLeaderMinKills: number; minActiveTime: number };
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
    readonly kills = new EventLog<KillEvent>();
    readonly roles = new EventLog<RoleAnnouncementEvent>();
    readonly results = new EventLog<{ playerId: number; event: GameOverEvent }>();
    private readonly host: MatchHost;
    private readonly killLeaderEnabled: boolean;
    private readonly maxPlayers: number;
    private nextKilledIndex = 0;
    private readonly resultSent = new Set<number>();
    private pendingResults: Player[] = [];

    constructor(host: MatchHost, options: MatchOptions) {
        this.host = host;
        this.options = options;
        const mode = getMapDef(host.options.mapName).gameMode;
        this.killLeaderEnabled = mode.killLeaderEnabled;
        this.maxPlayers = mode.maxPlayers;
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
     * Whether a new player may join: not over, fewer living players than the mode's maximum, and the match started
     * less than `joinWindowSeconds` ago (survev game.ts canJoin). Sandbox matches always accept joins.
     */
    canJoin(): boolean {
        if (this.options.sandbox) return true;
        if (this.over || this.aliveCount >= this.maxPlayers) return false;
        return !this.started || this.startedSeconds < this.host.rules.joinWindowSeconds;
    }

    /** Smallest team id no current player uses (solo: every player is its own team). */
    allocTeamId(): number {
        const used = new Set<number>();
        for (const p of this.host.players()) used.add(p.teamId);
        for (let id = 1; id <= MAX_TEAM_ID; id++) if (!used.has(id)) return id;
        return MAX_TEAM_ID;
    }

    /**
     * Start check, run at the beginning of a tick: the match starts once `minPlayers` living players have been
     * alive for `minActiveTime` (survev cantDespawnAliveCount > 1), at once in a sandbox. Returns true on the start.
     */
    checkStart(): boolean {
        if (this.started) return false;
        if (!this.options.sandbox) {
            let ready = 0;
            const minTime = this.host.rules.minActiveTime - 1e-9;
            for (const p of this.host.players()) if (!p.dead && p.timeAlive >= minTime) ready++;
            if (ready < Math.max(1, this.options.minPlayers)) return false;
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
        const victimWasLeader = victim.id === this.killLeaderId;
        if (victimWasLeader) {
            this.logRole({ playerId: victim.id, killerId: sourcePlayer?.id ?? 0, assigned: false, killed: true });
        }
        if (this.killLeaderEnabled && credit && credit !== victim) this.updateKillLeader(credit);
        if (victimWasLeader && this.killLeaderId === victim.id) this.killLeaderId = 0;
        this.checkGameOver();
        this.pendingResults.push(victim);
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
            this.logRole({ playerId: credit.id, killerId: 0, assigned: true, killed: false });
        }
    }

    /** A player left the game (despawned): it no longer counts as alive. */
    onPlayerRemoved(player: Player): void {
        if (player.id === this.killLeaderId) this.killLeaderId = 0;
        this.pendingResults = this.pendingResults.filter((p) => p !== player);
        if (!player.dead) this.checkGameOver(player);
    }

    /** Solo game over: started and at most one player alive (survev game.ts checkGameOver). */
    private checkGameOver(removed?: Player): void {
        if (this.over || !this.started || this.options.sandbox) return;
        const living = this.living().filter((p) => p !== removed);
        if (living.length > 1) return;
        this.over = true;
        this.overTick = this.host.tick;
        const winner = living[0];
        this.winningTeamId = winner?.teamId ?? 0;
        this.winnerIds = winner ? [winner.id] : [];
    }

    /**
     * End of a tick: GameOver results for the players that died this tick (ranked against the players still alive,
     * survev addGameOverMsg after all updates) and, once the match is over, for the survivors (the winner).
     */
    endTick(): void {
        const pending = this.pendingResults;
        this.pendingResults = [];
        for (const p of pending) this.addResult(p);
        if (this.over) for (const p of this.living()) this.addResult(p);
        const minTick = this.host.tick - EVENT_RETENTION_TICKS;
        this.kills.prune(minTick);
        this.roles.prune(minTick);
        this.results.prune(minTick);
    }

    private addResult(player: Player): void {
        if (this.resultSent.has(player.id)) return;
        this.resultSent.add(player.id);
        const won = this.winningTeamId !== 0 && this.winningTeamId === player.teamId;
        const event: GameOverEvent = {
            teamId: player.teamId,
            teamRank: won ? 1 : this.aliveCount + 1,
            gameOver: this.winningTeamId !== 0,
            winningTeamId: this.winningTeamId,
            playerStats: [playerStats(player)],
        };
        this.results.push(this.host.nextEventSeq(), this.host.tick, { playerId: player.id, event });
    }

    /** The GameOver result of `playerId` logged after `seq`, if any. */
    resultSince(playerId: number, seq: number): GameOverEvent | undefined {
        for (const r of this.results.since(seq)) if (r.playerId === playerId) return r.event;
        return undefined;
    }

    killLeader(): KillLeaderView {
        const p = this.killLeaderId ? this.host.getPlayer(this.killLeaderId) : undefined;
        return p ? { id: p.id, kills: p.kills } : { id: 0, kills: 0 };
    }

    /**
     * Final ranking: survivors first, then the dead from the last to the first killed (survev
     * getPlayersSortedByRank); players dying in the same tick share no rank here, the later index ranks higher.
     */
    ranking(): Array<{ playerId: number; rank: number }> {
        const players = [...this.host.players()].sort((a, b) => {
            const ka = a.dead ? a.killedIndex : Number.MAX_SAFE_INTEGER;
            const kb = b.dead ? b.killedIndex : Number.MAX_SAFE_INTEGER;
            return kb - ka || a.id - b.id;
        });
        return players.map((p, i) => ({ playerId: p.id, rank: i + 1 }));
    }

    private logKill(event: KillEvent): void {
        this.kills.push(this.host.nextEventSeq(), this.host.tick, event);
    }

    private logRole(e: Omit<RoleAnnouncementEvent, "role">): void {
        this.roles.push(this.host.nextEventSeq(), this.host.tick, { ...e, role: KILL_LEADER_ROLE });
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
