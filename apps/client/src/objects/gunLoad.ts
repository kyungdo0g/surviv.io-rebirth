// Whether a player's held gun is empty, for the guns drawn with an empty variant (packages/defs rebirth/heldGunArt.ts
// HELD_GUN_ART_EMPTY: the RPG-7 without its warhead; owner, 2026-10-08: "RPG-7 발사시에는 탄두가 안 꽂혀있는모습으로").
// The followed player's loaded rounds are in its local state (LocalPlayerState.weapons[].ammo); other players' are not
// on the wire, so their views count the shots fired with each such gun since its last finished reload: the snapshots
// carry the shot counter (PlayerView.shot.seq) and the running action (PlayerView.action, whose seq moves on every
// start, cancel and finish, sim world/player.ts doAction / cancelAction). A reload of the gun that ends after its full
// duration (with a snapshot's slack) refills it; one cut short (a switch, a pickup, a heal) leaves it empty. A player
// coming into view is taken as loaded, or as empty while it reloads such a gun. Presentation only, no protocol change.
import { GameObjectDefs, type GunDef } from "@rebirth/defs";
import type { PlayerAction } from "@rebirth/sim";
import { hasEmptyHeldImage } from "./heldGun.ts";

/** A reload seen ending this much before its duration still counts as finished (snapshots arrive at 30 Hz or less). */
export const RELOAD_END_SLACK = 0.15;

function trackedGun(id: string): GunDef | undefined {
    const def = id ? GameObjectDefs[id] : undefined;
    return def?.type === "gun" && hasEmptyHeldImage(def) ? def : undefined;
}

/** Shot and reload bookkeeping of one player's guns that have an empty held image. */
export class GunLoad {
    private clock = 0;
    /** shots fired with each tracked gun since its last finished reload */
    private readonly fired = new Map<string, number>();
    private reload: { item: string; start: number; duration: number } | null = null;

    /** Advances the clock reload durations are measured with (seconds). */
    tick(dt: number): void {
        this.clock += dt;
    }

    /** `n` shots were fired with `gun`. */
    shots(gun: string, n: number): void {
        if (n <= 0 || !trackedGun(gun)) return;
        this.fired.set(gun, (this.fired.get(gun) ?? 0) + n);
    }

    /**
     * The running action changed (a new `seq`): a tracked gun's reload that ran its full duration refills it; a new
     * reload starts timing. `seen`: the player just came into view, so the start of a running reload is unknown.
     */
    action(action: PlayerAction, seen = false): void {
        const prev = this.reload;
        if (prev && this.clock - prev.start >= prev.duration - RELOAD_END_SLACK) this.fired.delete(prev.item);
        this.reload = null;
        const gun = action.type === "reload" ? trackedGun(action.item) : undefined;
        if (!gun) return;
        if (seen) {
            // reloading now, so it is empty; its finish is then taken at face value
            this.fired.set(action.item, Math.max(this.fired.get(action.item) ?? 0, gun.maxClip));
            this.reload = { item: action.item, start: -Infinity, duration: action.duration };
            return;
        }
        this.reload = { item: action.item, start: this.clock, duration: action.duration };
    }

    /**
     * Whether `gun` is empty: from the loaded rounds when known (`ammo`, the followed player's local state), else from
     * the shots counted since its last finished reload. Always false for guns without an empty held image.
     */
    empty(gun: string, ammo?: number): boolean {
        const def = trackedGun(gun);
        if (!def) return false;
        if (ammo !== undefined) return ammo <= 0;
        return (this.fired.get(gun) ?? 0) >= def.maxClip;
    }
}
