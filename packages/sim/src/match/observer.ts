// Read-only combat notifications for hosts (rebirth M8: the server's anti-cheat telemetry, apps/server/src/anticheat).
// When a game has an observer, the simulation calls it at a few points of the combat pipeline. Observers must not
// change the game (no mutation, no random draws): a game runs identically with or without one.
import type { Bullet } from "../combat/bullets.ts";
import type { DamageParams } from "../combat/damage.ts";
import type { Player } from "../world/player.ts";

export interface CombatObserver {
    /** `shooter` fired one shot of the gun `weaponType`: `bullets` are the bullets it spawned (pellets, splinters) */
    onShotFired?(shooter: Player, weaponType: string, bullets: readonly Bullet[]): void;
    /**
     * A bullet struck `target` (its damage is queued; the team rules may still cancel it). Not called for the bullets
     * of a dead or downed shooter, which deal no damage.
     */
    onBulletHitPlayer?(bullet: Bullet, target: Player): void;
    /** `target` took `amount` damage (after the headshot roll, reductions and the clamp to its health) */
    onPlayerDamaged?(target: Player, params: DamageParams, amount: number, headshot: boolean): void;
    /** `victim` died; `credit` is the player credited with the kill (undefined for none) */
    onPlayerKilled?(victim: Player, params: DamageParams, credit: Player | undefined): void;
}
