// Smoke: emitters (smoke grenades, destroyed fire extinguishers) release smoke clouds that grow to a random radius,
// drift and vanish together when the emitter's active time ends. Players inside a cloud have their vision obscured
// (camera forced to 1x until 0.5 s after leaving) and, with rules.smokeHidesPlayers, are hidden from other players.
// Behaviour follows survev server/src/game/objects/smoke.ts and player.ts (visionObscured);
// docs/research/items/throwables.md "Smoke Grenade".
import { type Bounds, collider, math, type Rng, type Vec2, v2 } from "@rebirth/core";
import type { SmokeView } from "../view.ts";
import type { World } from "./world.ts";
import { sameLayer } from "./world.ts";

/** Clouds released at once when an emitter starts (survev SmokeBarn.addEmitter). */
const START_SMOKES = 3;
/** Further clouds, one every SPAWN_INTERVAL seconds (survev SmokeEmitter.update). */
const MAX_SPAWNED = 8;
const SPAWN_INTERVAL = 1.75;
/** Final cloud radius random(5.5, 6.5) (survev Smoke.maxSize). */
const MIN_SIZE = 5.5;
const MAX_SIZE = 6.5;
/** Start clouds grow in 0.1 s, drift up to 1.5 u/s with drag 0.3; later ones grow in 2 s, 0.5-1.5 u/s, drag 0.1. */
const START_GROW = 0.1;
const START_SPEED = 1.5;
const START_DRAG = 0.3;
const GROW = 2;
const MIN_SPEED = 0.5;
const MAX_SPEED = 1.5;
const DRAG = 0.1;
/** Vision stays obscured this long after leaving the smoke (survev player.ts visionRecoveryTicker). */
export const VISION_RECOVERY_TIME = 0.5;
const MAX_ID = 0xffff;

interface Emitter {
    pos: Vec2;
    layer: number;
    interior: boolean;
    spawned: number;
    spawnTicker: number;
    activeTicker: number;
    active: boolean;
}

export interface Smoke {
    id: number;
    pos: Vec2;
    layer: number;
    interior: boolean;
    rad: number;
    maxSize: number;
    vel: Vec2;
    growTime: number;
    drag: number;
    emitter: Emitter;
}

/** What smoke needs from the game; the rng and the duration knob are read on use. */
export interface SmokeHost {
    readonly world: World;
    readonly fxRng: Rng;
    readonly rules: { smokeDuration: number };
}

export class SmokeSystem {
    private readonly host: SmokeHost;
    readonly smokes: Smoke[] = [];
    private readonly emitters: Emitter[] = [];
    private nextId = 1;

    constructor(host: SmokeHost) {
        this.host = host;
    }

    /** Starts an emitter at `pos`; it is "interior" when inside a building's ceiling region (survev addEmitter). */
    addEmitter(pos: Vec2, layer: number): void {
        const probe = collider.createCircle(pos, 1);
        let interior = false;
        const box = { min: v2.sub(pos, { x: 1, y: 1 }), max: v2.add(pos, { x: 1, y: 1 }) };
        for (const obj of this.host.world.query(box)) {
            if (obj.kind !== "building" || !sameLayer(obj.layer, layer)) continue;
            for (const r of obj.zoomRegions) {
                if (r.zoomIn && collider.intersect(probe, { type: 1, min: r.zoomIn.min, max: r.zoomIn.max })) {
                    interior = true;
                }
            }
        }
        const emitter: Emitter = {
            pos: v2.copy(pos),
            layer,
            interior,
            spawned: 0,
            spawnTicker: 0,
            activeTicker: 0,
            active: true,
        };
        for (let i = 0; i < START_SMOKES; i++) this.addSmoke(emitter, true);
        this.emitters.push(emitter);
    }

    private allocId(): number {
        const id = this.nextId;
        this.nextId = this.nextId >= MAX_ID ? 1 : this.nextId + 1;
        return id;
    }

    private addSmoke(emitter: Emitter, start: boolean): void {
        const rng = this.host.fxRng;
        const maxSize = rng.range(MIN_SIZE, MAX_SIZE);
        const speed = start ? rng.range(0, START_SPEED) : rng.range(MIN_SPEED, MAX_SPEED);
        this.smokes.push({
            id: this.allocId(),
            pos: v2.copy(emitter.pos),
            layer: emitter.layer,
            interior: emitter.interior,
            rad: 0,
            maxSize,
            vel: v2.mul(v2.randomUnit(rng), speed),
            growTime: start ? START_GROW : GROW,
            drag: start ? START_DRAG : DRAG,
            emitter,
        });
    }

    update(dt: number): void {
        const world = this.host.world;
        for (let i = 0; i < this.smokes.length; i++) {
            const s = this.smokes[i];
            if (!s.emitter.active) {
                this.smokes.splice(i--, 1);
                continue;
            }
            s.rad = math.clamp(s.rad + (s.maxSize / s.growTime) * dt, 0, s.maxSize);
            s.vel = v2.mul(s.vel, 1 / (1 + dt * s.drag));
            s.pos = world.clampToMap(v2.add(s.pos, v2.mul(s.vel, dt)), s.rad);
        }
        const duration = this.host.rules.smokeDuration;
        for (let i = 0; i < this.emitters.length; i++) {
            const e = this.emitters[i];
            e.spawnTicker -= dt;
            if (e.spawnTicker <= 1e-9 && e.spawned < MAX_SPAWNED) {
                this.addSmoke(e, false);
                e.spawned++;
                e.spawnTicker = SPAWN_INTERVAL;
            }
            e.activeTicker += dt;
            if (e.activeTicker >= duration - 1e-9) {
                e.active = false;
                this.emitters.splice(i--, 1);
            }
        }
    }

    /** Whether a circle on `layer` touches any smoke cloud (vision obscured; survev testCircleCircle). */
    touches(pos: Vec2, rad: number, layer: number): boolean {
        for (const s of this.smokes) {
            if (!sameLayer(s.layer, layer)) continue;
            const r = rad + s.rad;
            if (v2.distanceSqr(pos, s.pos) < r * r) return true;
        }
        return false;
    }

    /** Whether `pos` lies inside a smoke cloud on `layer` (players there are hidden from others). */
    contains(pos: Vec2, layer: number): boolean {
        for (const s of this.smokes) {
            if (sameLayer(s.layer, layer) && v2.distanceSqr(pos, s.pos) < s.rad * s.rad) return true;
        }
        return false;
    }

    /** Clouds touching `view`, by id (at most `max`). */
    views(view: Bounds, max = 255): SmokeView[] {
        const out: SmokeView[] = [];
        for (const s of this.smokes) {
            const dx = s.pos.x - math.clamp(s.pos.x, view.min.x, view.max.x);
            const dy = s.pos.y - math.clamp(s.pos.y, view.min.y, view.max.y);
            if (dx * dx + dy * dy > s.rad * s.rad) continue;
            out.push({ id: s.id, pos: v2.copy(s.pos), rad: s.rad, layer: s.layer, interior: s.interior });
        }
        out.sort((a, b) => a.id - b.id);
        return out.length > max ? out.slice(0, max) : out;
    }
}
