// Explosion effects (survev client/src/objects/explosion.ts; docs/research/mechanics/explosions.md): every
// ExplosionEvent plays its def's `explosionEffectType`: a burst particle (the expanding fireball), scattered pieces for
// snowballs and potatoes, the grass or water sound (sfx channel, range x2, muffled on another floor) and water
// ripples, then shakes the camera for `shakeDur` seconds. Air strike bombs that burst under a roof show no visuals
// (the original hides them indoors). Visuals go to the explosion's layer, so the renderer hides an explosion on the
// other floor like every other object; its sound is halved and muffled there by the audio engine.
// The scorch mark is a DecalView from the simulation (objects/decal.ts).
import type { Vec2 } from "@rebirth/core";
import { type ExplosionDef, GameObjectDefs } from "@rebirth/defs";
import type { ExplosionEvent } from "@rebirth/sim";
import type { AudioEngine, SoundHandle } from "../audio/audio.ts";
import type { ParticleSystem } from "./particles.ts";

interface EffectDef {
    burst: { particle: string; scale: number; grass: string; water: string; detune?: number; volume?: number };
    scatter?: { particle: string; count: number; speed: readonly [number, number] };
    rippleCount: number;
    shakeStr: number;
    shakeDur: number;
    lifetime: number;
}

function fx(
    particle: string,
    scale: number,
    grass: string,
    water: string,
    rippleCount: number,
    shake: readonly [number, number],
    lifetime: number,
    extra: Partial<EffectDef["burst"]> & { scatter?: EffectDef["scatter"] } = {},
): EffectDef {
    const { scatter, ...burst } = extra;
    return {
        burst: { particle, scale, grass, water, ...burst },
        scatter,
        rippleCount,
        shakeStr: shake[0],
        shakeDur: shake[1],
        lifetime,
    };
}

const scatter = (particle: string, count: number) => ({ particle, count, speed: [5, 25] as const });

/** survev explosion.ts ExplosionEffectDefs (same values as the 0.8.82 client) */
const EFFECTS: Readonly<Record<string, EffectDef>> = {
    frag: fx("explosionBurst", 1, "explosion_01", "explosion_02", 10, [0.2, 0.35], 2),
    smoke: fx("explosionBurst", 0, "explosion_smoke_01", "explosion_smoke_01", 10, [0, 0], 6),
    strobe: fx("explosionBurst", 0.25, "explosion_04", "explosion_02", 3, [0, 0], 2),
    barrel: fx("explosionBurst", 1, "explosion_01", "explosion_02", 10, [0.2, 0.35], 2),
    usas: fx("explosionUSAS", 0.75, "explosion_03", "explosion_02", 10, [0.12, 0.25], 1.25),
    rounds: fx("explosionRounds", 0.32, "explosion_04", "explosion_04", 1, [0, 0], 1, { detune: 500, volume: 0.5 }),
    rounds_sg: fx("explosionRounds", 0.32, "explosion_04", "explosion_04", 1, [0, 0], 1, { detune: 500, volume: 0.2 }),
    mirv: fx("explosionMIRV", 1, "explosion_01", "explosion_02", 10, [0.2, 0.35], 2),
    mirv_mini: fx("explosionMIRV", 0.75, "explosion_03", "explosion_02", 3, [0.1, 0.2], 1.25),
    martyr_nade: fx("explosionBurst", 0.75, "explosion_03", "explosion_02", 3, [0.1, 0.2], 1.25),
    snowball: fx("", 0.75, "snowball_01", "frag_water_01", 1, [0, 0], 1, { scatter: scatter("snowball_impact", 5) }),
    snowball_heavy: fx("", 0.75, "snowball_02", "frag_water_01", 1, [0, 0], 1, {
        scatter: scatter("snowball_impact", 8),
    }),
    potato: fx("", 0.75, "potato_01", "frag_water_01", 1, [0, 0], 1, { scatter: scatter("potato_impact", 5) }),
    potato_heavy: fx("", 0.75, "potato_02", "frag_water_01", 1, [0, 0], 1, { scatter: scatter("potato_impact", 8) }),
    potato_cannonball: fx("explosionPotato", 0.75, "explosion_05", "explosion_02", 10, [0.12, 0.25], 1.25, {
        scatter: scatter("potato_impact", 8),
    }),
    potato_smgshot: fx("", 0.2, "potato_01", "potato_02", 1, [0, 0], 0.5, {
        detune: 250,
        volume: 0.5,
        scatter: scatter("potato_smg_impact", 2),
    }),
    bomb_iron: fx("explosionBomb", 2, "explosion_01", "explosion_02", 12, [0.25, 0.4], 2),
};

/** the scattered pieces slow down like the original's physics particles (vel / (1 + dt * 5)) */
const SCATTER_DRAG = 5;
const SOUND_UPDATE_INTERVAL = 0.1;

export interface ExplosionDeps {
    particles: ParticleSystem;
    audio: AudioEngine;
    /** camera shake from a source at `pos` (survev camera.m_addShake) */
    addShake(pos: Vec2, intensity: number): void;
    /** whether the ground at `pos` is water (water sound and ripples) */
    isWater(pos: Vec2): boolean;
    /** biome ripple colour */
    rippleColor: number;
    /** whether `pos` is under a building roof (air strike bombs hide their visuals indoors) */
    insideCeiling(pos: Vec2): boolean;
}

interface Explosion {
    type: string;
    def: EffectDef;
    pos: Vec2;
    layer: number;
    ticker: number;
    sound: SoundHandle | null;
    soundThrottle: number;
}

/** Sound names every explosion effect can play (preloaded on the sfx channel). */
export function explosionSounds(): string[] {
    const out = new Set<string>();
    for (const def of Object.values(EFFECTS)) {
        out.add(def.burst.grass);
        out.add(def.burst.water);
    }
    return [...out];
}

export class ExplosionSystem {
    private readonly deps: ExplosionDeps;
    private readonly active: Explosion[] = [];
    /** explosions started since boot (tests) */
    spawned = 0;
    /** burst particles shown since boot (tests) */
    bursts = 0;

    constructor(deps: ExplosionDeps) {
        this.deps = deps;
    }

    get count(): number {
        return this.active.length;
    }

    add(events: readonly ExplosionEvent[]): void {
        for (const e of events) {
            const def = GameObjectDefs[e.type] as ExplosionDef | undefined;
            const effect = def?.type === "explosion" ? EFFECTS[def.explosionEffectType] : undefined;
            if (!effect) continue;
            const ex: Explosion = {
                type: e.type,
                def: effect,
                pos: { x: e.pos.x, y: e.pos.y },
                layer: e.layer,
                ticker: 0,
                sound: null,
                soundThrottle: SOUND_UPDATE_INTERVAL,
            };
            this.start(ex);
            this.active.push(ex);
            this.spawned++;
        }
    }

    private start(ex: Explosion): void {
        const { particles, audio } = this.deps;
        const def = ex.def;
        const visuals = !(ex.type === "explosion_bomb_iron" && this.deps.insideCeiling(ex.pos));
        if (visuals && def.burst.particle && def.burst.scale > 0) {
            particles.add(def.burst.particle, ex.layer, ex.pos, { x: 0, y: 0 }, { scale: def.burst.scale, rot: 0 });
            this.bursts++;
        }
        if (visuals && def.scatter) {
            const [lo, hi] = def.scatter.speed;
            for (let i = 0; i < def.scatter.count; i++) {
                const ang = Math.random() * Math.PI * 2;
                const speed = lo + Math.random() * (hi - lo);
                const vel = { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed };
                particles.add(def.scatter.particle, ex.layer, ex.pos, vel, { drag: SCATTER_DRAG });
            }
        }
        const water = this.deps.isWater(ex.pos);
        ex.sound = audio.playSound(water ? def.burst.water : def.burst.grass, {
            channel: "sfx",
            pos: ex.pos,
            layer: ex.layer,
            filter: "muffled",
            rangeMult: 2,
            ignoreMinAllowable: true,
            detune: def.burst.detune ?? 0,
            volumeScale: def.burst.volume ?? 1,
        });
        if (water) {
            const maxRad = def.rippleCount * 0.5;
            for (let i = 0; i < def.rippleCount; i++) {
                const ang = Math.random() * Math.PI * 2;
                const d = Math.random() * maxRad;
                const pos = { x: ex.pos.x + Math.cos(ang) * d, y: ex.pos.y + Math.sin(ang) * d };
                particles.add(
                    "waterRipple",
                    ex.layer,
                    pos,
                    { x: 0, y: 0 },
                    {
                        rot: 0,
                        delay: i * 0.06,
                        color: this.deps.rippleColor,
                    },
                );
            }
        }
    }

    update(dt: number): void {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const ex = this.active[i];
            const def = ex.def;
            ex.soundThrottle -= dt;
            if (ex.sound && ex.soundThrottle < 0) {
                ex.soundThrottle = SOUND_UPDATE_INTERVAL;
                this.deps.audio.updateSound(ex.sound, "sfx", {
                    pos: ex.pos,
                    layer: ex.layer,
                    rangeMult: 2,
                    volumeScale: def.burst.volume ?? 1,
                    ignoreMinAllowable: true,
                });
            }
            ex.ticker += dt;
            if (def.shakeStr > 0) {
                const t = Math.min(ex.ticker / def.shakeDur, 1);
                this.deps.addShake(ex.pos, def.shakeStr * (1 - t));
            }
            if (ex.ticker >= def.lifetime) this.active.splice(i, 1);
        }
    }

    clear(): void {
        this.active.length = 0;
    }
}
