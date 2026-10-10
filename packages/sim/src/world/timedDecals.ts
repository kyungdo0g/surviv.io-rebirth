// Decals the simulation adds during a game and removes after a fixed lifetime, like survev's timed decals (survev
// server/src/game/objects/decal.ts lifetime): the rebirth's discarded launcher bodies (defs rebirth/discardDecals.ts,
// turned to the shooter's facing with DecalView.rot) and the Molotov's burning ground (world/fires.ts). Plain map
// objects in the world grid, so every player in view is sent them; decals never collide. No randomness: a def
// lifetime given as a range uses its minimum (the explosion scorches keep their own random fade, explosions.ts).
import { type Vec2, v2 } from "@rebirth/core";
import { discardDecalOf, getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import { createMapEntity, type Decal } from "./entities.ts";
import type { Player } from "./player.ts";
import type { World } from "./world.ts";

export interface TimedDecalOptions {
    /** free rotation in radians, counter-clockwise (DecalView.rot) */
    rot?: number;
    /** seconds before it is removed; default: the def's lifetime, else it stays */
    life?: number;
}

export class TimedDecalSystem {
    private readonly world: World;
    private readonly timed: Array<{ decal: Decal; life: number }> = [];

    constructor(world: World) {
        this.world = world;
    }

    /** Decals still waiting for removal (tests). */
    get count(): number {
        return this.timed.length;
    }

    /** Adds a decal of map type `type` at `pos`; undefined when `type` is not a decal def. */
    spawn(type: string, pos: Vec2, layer: number, opts: TimedDecalOptions = {}): Decal | undefined {
        if (!type || !hasMapObjectDef(type)) return undefined;
        const def = getMapObjectDef(type);
        if (def.type !== "decal") return undefined;
        const decal = createMapEntity({
            id: this.world.allocId(),
            kind: "decal",
            type,
            pos: this.world.clampToMap(pos, 0),
            ori: 0,
            scale: 1,
            layer,
            parentId: 0,
        }) as Decal;
        decal.rot = opts.rot ?? 0;
        this.world.add(decal);
        const lifetime =
            def.lifetime === undefined || typeof def.lifetime === "number" ? def.lifetime : def.lifetime.min;
        const life = opts.life ?? lifetime;
        if (life !== undefined) this.timed.push({ decal, life });
        return decal;
    }

    /** Removes `decal` now (a fire put out early). */
    remove(decal: Decal): void {
        const i = this.timed.findIndex((t) => t.decal === decal);
        if (i >= 0) this.timed.splice(i, 1);
        this.world.remove(decal);
    }

    update(dt: number): void {
        for (let i = 0; i < this.timed.length; i++) {
            const t = this.timed[i];
            t.life -= dt;
            if (t.life > 1e-9) continue;
            this.world.remove(t.decal);
            this.timed.splice(i--, 1);
        }
    }
}

/**
 * A single-use launcher `gun` just left `player`'s hands empty (weaponManager.ts discardSpent): its body drops at the
 * player's feet as a decal along the player's facing (the sprite's up axis, its muzzle, points where the player
 * looks). Guns without a discard decal (the Boys, the Maadi) leave nothing.
 */
export function dropDiscardedGun(decals: TimedDecalSystem, player: Player, gun: string): Decal | undefined {
    const type = discardDecalOf(gun);
    if (!type) return undefined;
    const rot = Math.atan2(player.dir.y, player.dir.x) - Math.PI / 2;
    return decals.spawn(type, v2.copy(player.pos), player.layer, { rot });
}
