// Anti-cheat telemetry of one game (M8): the game's CombatObserver. Human players are tracked from their join (the
// room calls `track`; fill bots never are, so they are excluded everywhere); shots, bullet hits, damage and kills arrive
// from the simulation, inputs from the room. `evaluate` (the room calls it once per simulated second, on leave and at
// the end) scores every tracked player and returns the flags to log: a player is flagged once its score reaches
// `flagScore`, and again whenever it rose by `reflagDelta` since the previous flag.
import { v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import type { Bullet, CombatObserver, DamageParams, Player, PlayerInput } from "@rebirth/sim";
import { PlayerTelemetry, type ScoreComponent, type ShotRecord, type TelemetrySnapshot } from "./player.ts";
import type { AntiCheatThresholds } from "./thresholds.ts";

/** One flag: a player whose suspicion score reached the threshold (logged as JSON, listed by /api/admin/suspects). */
export interface SuspectFlag {
    /** ISO time */
    time: string;
    gameId: string;
    mapName: string;
    teamMode: number;
    playerId: number;
    name: string;
    ip: string;
    score: number;
    components: ScoreComponent[];
    stats: TelemetrySnapshot;
}

/** A tracked player's current score (live suspects). */
export interface LiveScore {
    gameId: string;
    playerId: number;
    name: string;
    ip: string;
    score: number;
    components: ScoreComponent[];
    left: boolean;
}

export interface MatchTelemetryOptions {
    gameId: string;
    mapName: string;
    teamMode: number;
    thresholds: AntiCheatThresholds;
    /** wall clock in ms (tests inject one) */
    clock?: () => number;
}

/** What the telemetry reads from the game: players by id (shooter teams for friendly hits). */
export interface TelemetryGame {
    getPlayer(id: number): Player | undefined;
}

export class MatchTelemetry implements CombatObserver {
    readonly options: MatchTelemetryOptions;
    readonly players = new Map<number, PlayerTelemetry>();
    private readonly game: TelemetryGame;
    private readonly clock: () => number;
    /** the shot of every bullet fired by a tracked player (dropped with the bullet) */
    private readonly shots = new WeakMap<Bullet, ShotRecord>();
    /** score of each player's last flag */
    private readonly flagged = new Map<number, number>();

    constructor(game: TelemetryGame, options: MatchTelemetryOptions) {
        this.game = game;
        this.options = options;
        this.clock = options.clock ?? Date.now;
    }

    /** Starts tracking a human player (its stats stay after it leaves, for reports). */
    track(playerId: number, name: string, ip: string): PlayerTelemetry {
        const t = new PlayerTelemetry(playerId, name, ip, this.options.thresholds);
        this.players.set(playerId, t);
        return t;
    }

    isTracked(playerId: number): boolean {
        return this.players.has(playerId);
    }

    /** The player's socket closed. */
    leave(playerId: number): void {
        const t = this.players.get(playerId);
        if (t) t.left = true;
    }

    onInput(playerId: number, input: PlayerInput): void {
        this.players.get(playerId)?.onInput(input, this.clock());
    }

    onShotFired(shooter: Player, weaponType: string, bullets: readonly Bullet[]): void {
        const t = this.players.get(shooter.id);
        if (!t) return;
        const shot = t.onShot(weaponType, bullets.length, this.clock());
        for (const b of bullets) this.shots.set(b, shot);
    }

    onBulletHitPlayer(bullet: Bullet, target: Player): void {
        const shot = this.shots.get(bullet);
        if (!shot || target.id === shot.playerId) return;
        const t = this.players.get(shot.playerId);
        const shooter = this.game.getPlayer(shot.playerId);
        // bullets cross teammates without hurting them: not a hit
        if (!t || (shooter && shooter.teamId === target.teamId)) return;
        t.onBulletHit(shot, v2.distance(bullet.startPos, target.pos));
    }

    onPlayerDamaged(target: Player, params: DamageParams, amount: number, headshot: boolean): void {
        const sourceId = params.sourceId ?? 0;
        if (params.damageType !== DamageType.Player || !sourceId || sourceId === target.id) return;
        const t = this.players.get(sourceId);
        if (!t || !params.gameSourceType) return;
        const shooter = this.game.getPlayer(sourceId);
        if (shooter && shooter.teamId === target.teamId) return;
        t.onDamage(params.gameSourceType, amount, headshot);
    }

    onPlayerKilled(victim: Player, params: DamageParams, credit: Player | undefined): void {
        if (!credit || credit === victim || credit.teamId === victim.teamId) return;
        this.players.get(credit.id)?.onKill(params.gameSourceType ?? "", v2.distance(credit.pos, victim.pos));
    }

    snapshot(playerId: number): TelemetrySnapshot | null {
        return this.players.get(playerId)?.snapshot() ?? null;
    }

    /** Current scores of every tracked player. */
    liveScores(): LiveScore[] {
        const out: LiveScore[] = [];
        for (const t of this.players.values()) {
            const { score, components } = t.score();
            out.push({
                gameId: this.options.gameId,
                playerId: t.playerId,
                name: t.name,
                ip: t.ip,
                score,
                components,
                left: t.left,
            });
        }
        return out;
    }

    /** Scores every tracked player (or only `playerId`) and returns the new flags. */
    evaluate(playerId?: number): SuspectFlag[] {
        const flags: SuspectFlag[] = [];
        const th = this.options.thresholds;
        const list = playerId === undefined ? this.players.values() : [this.players.get(playerId)];
        for (const t of list) {
            if (!t) continue;
            const { score } = t.score();
            if (score < th.flagScore) continue;
            const last = this.flagged.get(t.playerId);
            if (last !== undefined && score < last + th.reflagDelta) continue;
            this.flagged.set(t.playerId, score);
            const stats = t.snapshot();
            flags.push({
                time: new Date(this.clock()).toISOString(),
                gameId: this.options.gameId,
                mapName: this.options.mapName,
                teamMode: this.options.teamMode,
                playerId: t.playerId,
                name: t.name,
                ip: t.ip,
                score: stats.score,
                components: stats.components,
                stats,
            });
        }
        return flags;
    }
}
