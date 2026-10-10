// The Molotov's burning ground (the owner, 2026-10-10; defs rebirth/throwables.ts MOLOTOV_FIRE): survev has no fire,
// so it is built from the gas and bleeding damage plumbing (survev player.ts:1648-1669 and downed bleeding): a fixed
// damage every `tickInterval` that armour, helmets and Flak Jacket do not reduce (DamageParams.ignoreArmor), here
// credited to the thrower through the normal damage pipeline (teammates are spared, the thrower is not). A player
// whose centre is inside the circle, on its floor and in sight of its centre (world/sight.ts: no burning through a
// wall), catches fire and keeps burning `afterburn` seconds after leaving; the first tick bites at once. The burning
// ground is a decal for every client (defs FIRE_DECAL_TYPE), removed with the fire. Over water the bottle only
// splashes. Deterministic: no randomness.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, type FireAreaDef } from "@rebirth/defs";
import type { ExplosionSource } from "../combat/explosions.ts";
import type { SimContext } from "./context.ts";
import type { Decal } from "./entities.ts";
import { clearSight } from "./sight.ts";
import { type Entity, sameLayer } from "./world.ts";

const TIME_EPS = 1e-9;

export interface Fire {
    readonly def: FireAreaDef;
    readonly pos: Vec2;
    readonly layer: number;
    readonly source: ExplosionSource;
    life: number;
    readonly decal: Decal | undefined;
}

interface Burn {
    def: FireAreaDef;
    source: ExplosionSource;
    /** seconds of burning left (refreshed to afterburn while inside a fire) */
    left: number;
    /** seconds to the next damage tick */
    ticker: number;
}

export type FireHost = Pick<SimContext, "world" | "decals" | "getPlayer" | "damagePlayer">;

export class FireSystem {
    private readonly host: FireHost;
    readonly fires: Fire[] = [];
    /** burning players by id */
    private readonly burns = new Map<number, Burn>();
    private readonly scratch: Entity[] = [];

    constructor(host: FireHost) {
        this.host = host;
    }

    /** Starts a fire at `pos` (a Molotov burst); none over water. Returns it, or undefined. */
    add(def: FireAreaDef, pos: Vec2, layer: number, source: ExplosionSource): Fire | undefined {
        if (this.host.world.isOnWater(pos, layer)) return undefined;
        const decal = this.host.decals.spawn(def.decalType, pos, layer, { life: def.duration });
        const fire: Fire = { def, pos: v2.copy(pos), layer, source: { ...source }, life: def.duration, decal };
        this.fires.push(fire);
        return fire;
    }

    /** Seconds `playerId` keeps burning (0 when not on fire; bots, tests). */
    burning(playerId: number): number {
        return this.burns.get(playerId)?.left ?? 0;
    }

    /** Whether `pos` on `layer` is inside a burning area (bots, tests). */
    isBurning(pos: Vec2, layer: number): boolean {
        return this.fires.some((f) => sameLayer(f.layer, layer) && v2.distance(f.pos, pos) <= f.def.rad);
    }

    update(dt: number): void {
        const world = this.host.world;
        for (let i = 0; i < this.fires.length; i++) {
            const fire = this.fires[i];
            fire.life -= dt;
            if (fire.life <= TIME_EPS) {
                if (fire.decal) this.host.decals.remove(fire.decal);
                this.fires.splice(i--, 1);
                continue;
            }
            const r = fire.def.rad;
            const box = { min: v2.sub(fire.pos, { x: r, y: r }), max: v2.add(fire.pos, { x: r, y: r }) };
            for (const obj of world.query(box, this.scratch)) {
                if (obj.kind !== "player" || obj.dead || !sameLayer(obj.layer, fire.layer)) continue;
                if (v2.distance(obj.pos, fire.pos) > r) continue;
                if (!clearSight(world, fire.pos, obj.pos, fire.layer)) continue;
                const burn = this.burns.get(obj.id);
                if (burn) {
                    burn.left = Math.max(burn.left, fire.def.afterburn);
                    burn.def = fire.def;
                    burn.source = fire.source;
                } else {
                    this.burns.set(obj.id, { def: fire.def, source: fire.source, left: fire.def.afterburn, ticker: 0 });
                }
            }
        }
        for (const [id, burn] of this.burns) {
            const player = this.host.getPlayer(id);
            if (!player || player.dead) {
                this.burns.delete(id);
                continue;
            }
            burn.ticker -= dt;
            if (burn.ticker <= TIME_EPS) {
                burn.ticker += burn.def.tickInterval;
                this.host.damagePlayer(player, {
                    amount: burn.def.damage,
                    damageType: burn.source.damageType ?? DamageType.Player,
                    gameSourceType: burn.source.gameSourceType ?? "",
                    weaponSourceType: burn.source.weaponSourceType ?? "",
                    sourceId: burn.source.sourceId ?? 0,
                    ignoreArmor: true,
                });
            }
            burn.left -= dt;
            if (burn.left <= TIME_EPS) this.burns.delete(id);
        }
    }
}
