// Enemy intel (wave 2): what the bot can tell about each enemy from its snapshots beyond position and weapon: an
// estimate of its health (hits the bot saw land, heals, armour), what it is busy with (reloading, healing, reviving),
// who it is fighting, whether it just came out of a fight. Behaviours read it through `ctx.model.intel.of(id)` (the
// assessment, opportunism and third-partying features); WorldModel.observe feeds every snapshot to `ingest`.
//
// NO_INTEL is the inert provider every WorldModel starts with: every enemy looks fresh (full health, idle), so bots
// without the features keep deciding exactly as before.
import type { Snapshot } from "@rebirth/sim";
import type { WorldModel } from "./world.ts";

/** What an enemy is busy with (it cannot shoot back right away). */
export type EnemyAction = "reload" | "use" | "revive" | null;

export interface EnemyIntel {
    /** estimated health 0..100 (100 when nothing is known) */
    estHealth: number;
    /** what it is doing right now, null for nothing that keeps it from shooting */
    action: EnemyAction;
    /** player it is fighting (shooting at, or being shot by), when known */
    engagedWith?: number;
    /** it fought within the last few seconds (fired, was hit, got a kill): likely hurt and low on ammo */
    justFought: boolean;
    /** game time the bot last hit it */
    lastHitByMe?: number;
}

export interface EnemyIntelProvider {
    /** intel on the player `id` (a fresh-enemy default when nothing is known); do not mutate the result */
    of(id: number): Readonly<EnemyIntel>;
    /** called by WorldModel.observe with every snapshot, after the model itself was updated */
    ingest(snap: Snapshot, model: WorldModel): void;
}

const UNKNOWN: Readonly<EnemyIntel> = Object.freeze({ estHealth: 100, action: null, justFought: false });

/** A provider that knows nothing: the default of every WorldModel. */
export class NullEnemyIntel implements EnemyIntelProvider {
    of(_id: number): Readonly<EnemyIntel> {
        return UNKNOWN;
    }
    ingest(_snap: Snapshot, _model: WorldModel): void {}
}

/** Shared inert provider (stateless). */
export const NO_INTEL: EnemyIntelProvider = new NullEnemyIntel();
