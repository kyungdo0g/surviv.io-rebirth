// Per-player combat statistics of a match, collected through the simulation's read-only CombatObserver (the same hook
// the server's anti-cheat telemetry uses, packages/sim/src/match/observer.ts): shots, bullets, bullet hits, damage
// dealt and taken, kills, when each player died and who killed it, then the finish order. Used by runMatch for its
// BotRecords (the tournament and the aim bench read them). Observing never changes the game: like every observer it
// only reads, and it forwards each notification to the host's own observer if there is one.
import type { Bullet, CombatObserver, DamageParams, Player } from "@rebirth/sim";

export interface PlayerCombatStats {
    id: number;
    /** shots fired (one per trigger pull of a gun; a shotgun shot counts once) */
    shots: number;
    /** bullets spawned by those shots (pellets and splinters count each) */
    bullets: number;
    /** bullets that struck an enemy */
    bulletHits: number;
    /** damage dealt to enemies (after armour, clamped to their health) */
    damageDealt: number;
    /** damage taken from enemies */
    damageTaken: number;
    /** damage taken from everything else: gas, own grenades, barrels, air strikes, bleeding */
    envDamage: number;
    /** kills credited (enemies only, like Player.kills) */
    kills: number;
    /** game tick of the death, -1 while alive */
    deathTick: number;
    /** player credited with the kill, 0 for none (gas, suicide) */
    killerId: number;
}

/** What the stats read from the game. */
export interface StatsGame {
    readonly tick: number;
    getPlayer(id: number): Player | undefined;
}

function emptyStats(id: number): PlayerCombatStats {
    return {
        id,
        shots: 0,
        bullets: 0,
        bulletHits: 0,
        damageDealt: 0,
        damageTaken: 0,
        envDamage: 0,
        kills: 0,
        deathTick: -1,
        killerId: 0,
    };
}

export class MatchStats implements CombatObserver {
    private readonly game: StatsGame;
    private readonly next: CombatObserver | null;
    private readonly byId = new Map<number, PlayerCombatStats>();

    /** `next`: the host's own observer, notified after the stats (optional) */
    constructor(game: StatsGame, next: CombatObserver | null = null) {
        this.game = game;
        this.next = next;
    }

    /** Stats of a player (zeros when it never fought). */
    of(id: number): PlayerCombatStats {
        let s = this.byId.get(id);
        if (!s) {
            s = emptyStats(id);
            this.byId.set(id, s);
        }
        return s;
    }

    private enemies(a: Player | undefined, b: Player): boolean {
        return !!a && a !== b && a.teamId !== b.teamId;
    }

    onShotFired(shooter: Player, weaponType: string, bullets: readonly Bullet[]): void {
        const s = this.of(shooter.id);
        s.shots++;
        s.bullets += bullets.length;
        this.next?.onShotFired?.(shooter, weaponType, bullets);
    }

    onBulletHitPlayer(bullet: Bullet, target: Player): void {
        // bullets cross teammates without hurting them, ricochets may hit their own shooter: neither is a hit
        if (this.enemies(this.game.getPlayer(bullet.shooterId), target)) this.of(bullet.shooterId).bulletHits++;
        this.next?.onBulletHitPlayer?.(bullet, target);
    }

    onPlayerDamaged(target: Player, params: DamageParams, amount: number, headshot: boolean): void {
        const source = params.sourceId ? this.game.getPlayer(params.sourceId) : undefined;
        if (source && this.enemies(source, target)) {
            this.of(source.id).damageDealt += amount;
            this.of(target.id).damageTaken += amount;
        } else {
            this.of(target.id).envDamage += amount;
        }
        this.next?.onPlayerDamaged?.(target, params, amount, headshot);
    }

    onPlayerKilled(victim: Player, params: DamageParams, credit: Player | undefined): void {
        const v = this.of(victim.id);
        v.deathTick = this.game.tick;
        v.killerId = credit && credit !== victim ? credit.id : 0;
        if (credit && this.enemies(credit, victim)) this.of(credit.id).kills++;
        this.next?.onPlayerKilled?.(victim, params, credit);
    }
}

export interface Finish {
    /** 1 for the last one standing; players dying on the same tick share a place, the living all share 1 */
    placement: number;
    /** the same for whole teams (a team finishes when its last member dies) */
    teamPlacement: number;
}

/**
 * Finish order from death ticks (-1 alive): a player's placement is 1 plus the number of players that outlived it
 * (died on a later tick or are still alive); a team's is 1 plus the number of teams that outlived its last member.
 */
export function finishOrder(
    players: ReadonlyArray<{ id: number; teamId: number; deathTick: number }>,
): Map<number, Finish> {
    const end = (t: number) => (t < 0 ? Number.POSITIVE_INFINITY : t);
    const teamEnd = new Map<number, number>();
    for (const p of players) teamEnd.set(p.teamId, Math.max(teamEnd.get(p.teamId) ?? -1, end(p.deathTick)));
    const teamEnds = [...teamEnd.values()];
    const out = new Map<number, Finish>();
    for (const p of players) {
        const mine = end(p.deathTick);
        const tEnd = teamEnd.get(p.teamId) ?? mine;
        out.set(p.id, {
            placement: 1 + players.filter((q) => end(q.deathTick) > mine).length,
            teamPlacement: 1 + teamEnds.filter((t) => t > tEnd).length,
        });
    }
    return out;
}
