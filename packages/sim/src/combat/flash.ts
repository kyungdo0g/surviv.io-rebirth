// The flashbang's bang (the owner, 2026-10-10; defs rebirth/throwables.ts FLASHBANG_FLASH): no damage; every living
// player on its floor within `rad` is caught, at full strength within `fullRad` and fading linearly to nothing at
// `rad`. A player who sees the bang (world/sight.ts: no wall between them) is blinded and deafened at that strength;
// one behind a wall is only deafened, at `deafThroughWalls` of it. Everyone is caught, the thrower and his teammates
// too. The strongest flash of a tick is reported once to the player's snapshots (Snapshot.flash: the client's white
// screen and muffled audio), and the seconds left of each stay readable here (bots). Deterministic: no randomness.
import { math, type Vec2, v2 } from "@rebirth/core";
import type { FlashDef } from "@rebirth/defs";
import type { FlashEvent } from "../viewFlash.ts";
import { clearSight } from "../world/sight.ts";
import { type Entity, sameLayer, type World } from "../world/world.ts";

/** Flashes weaker than this on both counts are not reported. */
const MIN_STRENGTH = 0.02;

interface FlashState {
    /** tick of the latest flash */
    tick: number;
    /** strongest flash of that tick */
    blind: number;
    deaf: number;
    /** seconds of blindness and deafness left */
    blindLeft: number;
    deafLeft: number;
}

/** How strongly a flash `def` at `pos` catches a player at `target` (0..1 each), given the sight line. */
export function flashStrength(def: FlashDef, pos: Vec2, target: Vec2, inSight: boolean): FlashEvent {
    const dist = v2.distance(pos, target);
    if (dist > def.rad) return { blind: 0, deaf: 0 };
    const t = dist <= def.fullRad ? 1 : math.clamp(math.remap(dist, def.fullRad, def.rad, 1, 0), 0, 1);
    return inSight ? { blind: t, deaf: t } : { blind: 0, deaf: t * def.deafThroughWalls };
}

export class FlashSystem {
    private readonly world: World;
    private readonly states = new Map<number, FlashState>();
    private readonly scratch: Entity[] = [];
    /** tick the flashes recorded now belong to (the game keeps it at its tick count + 1, like the explosions') */
    tick = 1;

    constructor(world: World) {
        this.world = world;
    }

    /** A flashbang went off: catches every living player in range (see the header). Returns how many were caught. */
    burst(def: FlashDef, pos: Vec2, layer: number): number {
        const r = def.rad;
        const box = { min: v2.sub(pos, { x: r, y: r }), max: v2.add(pos, { x: r, y: r }) };
        let caught = 0;
        for (const obj of this.world.query(box, this.scratch)) {
            if (obj.kind !== "player" || obj.dead || !sameLayer(obj.layer, layer)) continue;
            if (v2.distance(obj.pos, pos) > r) continue;
            const s = flashStrength(def, pos, obj.pos, clearSight(this.world, pos, obj.pos, layer));
            if (s.blind < MIN_STRENGTH && s.deaf < MIN_STRENGTH) continue;
            caught++;
            const prev = this.states.get(obj.id);
            const same = prev && prev.tick === this.tick ? prev : undefined;
            this.states.set(obj.id, {
                tick: this.tick,
                blind: Math.max(same?.blind ?? 0, s.blind),
                deaf: Math.max(same?.deaf ?? 0, s.deaf),
                blindLeft: Math.max(prev?.blindLeft ?? 0, s.blind * def.blindTime),
                deafLeft: Math.max(prev?.deafLeft ?? 0, s.deaf * def.deafTime),
            });
        }
        return caught;
    }

    /** Seconds of blindness and deafness `playerId` has left (0 when none; bots, tests). */
    state(playerId: number): { blind: number; deaf: number } {
        const s = this.states.get(playerId);
        return { blind: s?.blindLeft ?? 0, deaf: s?.deafLeft ?? 0 };
    }

    /** The flash `playerId` took after `sinceTick` up to `untilTick`, if any (Snapshot.flash). */
    eventFor(playerId: number, sinceTick: number, untilTick: number): FlashEvent | undefined {
        const s = this.states.get(playerId);
        if (!s || s.tick <= sinceTick || s.tick > untilTick) return undefined;
        return { blind: s.blind, deaf: s.deaf };
    }

    update(dt: number): void {
        for (const [id, s] of this.states) {
            s.blindLeft = Math.max(0, s.blindLeft - dt);
            s.deafLeft = Math.max(0, s.deafLeft - dt);
            // kept a few seconds after it wore off, so a snapshot taken late still reports it
            if (s.blindLeft <= 0 && s.deafLeft <= 0 && this.tick - s.tick > 60) this.states.delete(id);
        }
    }
}
