// Client effects of the rebirth's beta new guns (2026-10-07; docs/design/new-gun-stats.md section 4), built only from
// existing particles and sounds:
// - after a local shot: the DP-12 pumps (sound.cycle) only after the shots the sim pumped, read from the slot's cooldown
//   in the same local state (the pump delay instead of the fire delay; sim weaponManager.ts pump), so a cancelled
//   reload, a pickup or a slot swap can never put the sound out of step; a single-use gun's last shot plays neither the
//   bolt nor the pull;
// - a single-use gun (Boys, Panzerfaust, M202: `discardWhenEmpty`) that leaves its slot empty plays `sound.discard`;
// - launch: a launcher shot puffs smoke at the muzzle, and a rocket (the `rocket` tracer: RPG-7, Panzerfaust, M202)
//   also behind the shooter (the back-blast of a recoilless tube) and trails smoke while it flies (airdropSmoke, the
//   light-grey puff of a landing air drop, drawn smaller and just above the players). The blast itself is the
//   explosion def's existing effect (fx/explosions.ts).
import type { Vec2 } from "@rebirth/core";
import { type BulletDef, GameObjectDefs, type GunDef } from "@rebirth/defs";
import type { BulletEvent, LocalPlayerState } from "@rebirth/sim";
import type { ParticleSystem } from "./particles.ts";

const SMOKE = "airdropSmoke";
/** puff sizes (airdropSmoke's own scale is 0.67-0.72) and draw order (players 18, tracers 20) */
const TRAIL_SCALE = 0.16;
const MUZZLE_SCALE = 0.2;
const BLAST_SCALE = 0.26;
const PUFF_Z_ORD = 19;
/** seconds between two trail puffs of a flying rocket */
const TRAIL_INTERVAL = 0.035;
/** puffs at the muzzle and behind a rocket launcher */
const MUZZLE_PUFFS = 4;
const BLAST_PUFFS = 5;
/** rockets tracked at once at most */
const MAX_ROCKETS = 32;

/**
 * Whether the sim pumped a pump gun (DP-12) on the shot that left its slot `cooldown` seconds to wait: a pumped shot
 * waits `pumpDelay` (0.7 s), the others `fireDelay` (0.2 s); the threshold halfway between them absorbs the tick and
 * the snapshot that passed since the shot and the cooldown's 8-bit quantization. Always true for other guns.
 */
export function pumpedShot(def: GunDef, cooldown: number): boolean {
    if (!def.pumpEvery) return true;
    return cooldown > (def.fireDelay + (def.pumpDelay ?? def.fireDelay)) / 2;
}

/**
 * The sound after a local single-fire shot of `def` with `ammoLeft` rounds left (`pumped`: pumpedShot): the cycle (or
 * the pull on an empty clip), none between the shots of a DP-12 pair or after a single-use gun's last.
 */
export function cycleSoundAfterShot(def: GunDef, ammoLeft: number, pumped: boolean): string | undefined {
    if (def.discardWhenEmpty && ammoLeft <= 0) return undefined;
    if (!pumped) return undefined;
    return ammoLeft > 0 ? def.sound.cycle : def.sound.pull;
}

/** Single-use guns that left their slot empty between two local states (discarded, not dropped). */
export function discardedGuns(prev: LocalPlayerState, cur: LocalPlayerState): GunDef[] {
    const out: GunDef[] = [];
    for (let i = 0; i < prev.weapons.length; i++) {
        const before = prev.weapons[i];
        if (!before?.type || before.ammo > 0 || cur.weapons[i]?.type === before.type) continue;
        const def = GameObjectDefs[before.type];
        if (def?.type === "gun" && def.discardWhenEmpty) out.push(def);
    }
    return out;
}

interface Rocket {
    id: number;
    pos: Vec2;
    dir: Vec2;
    layer: number;
    speed: number;
    dist: number;
    age: number;
    nextPuff: number;
}

function isRocket(def: BulletDef | undefined): boolean {
    return def?.type === "bullet" && def.tracerColor === "rocket";
}

/** Launch smoke and rocket trails. */
export class LauncherFx {
    private readonly particles: ParticleSystem;
    private readonly rockets: Rocket[] = [];
    /** puffs spawned since boot (tests) */
    puffs = 0;

    constructor(particles: ParticleSystem) {
        this.particles = particles;
    }

    private puff(layer: number, pos: Vec2, vel: Vec2, scale: number): void {
        this.particles.add(SMOKE, layer, pos, vel, { scale, zOrd: PUFF_Z_ORD });
        this.puffs++;
    }

    /** Smoke of a launcher shot from `pos` facing `dir`; a rocket launcher blasts behind too. */
    shot(def: GunDef, layer: number, pos: Vec2, dir: Vec2): void {
        if (!def.isLauncher) return;
        const muzzle = { x: pos.x + dir.x * def.barrelLength, y: pos.y + dir.y * def.barrelLength };
        for (let i = 0; i < MUZZLE_PUFFS; i++) {
            const a = (Math.random() - 0.5) * Math.PI * 0.6;
            const speed = 1.5 + Math.random() * 2;
            const c = Math.cos(a);
            const s = Math.sin(a);
            this.puff(
                layer,
                muzzle,
                { x: (dir.x * c - dir.y * s) * speed, y: (dir.x * s + dir.y * c) * speed },
                MUZZLE_SCALE,
            );
        }
        if (!isRocket(GameObjectDefs[def.bulletType] as BulletDef | undefined)) return;
        const back = { x: pos.x - dir.x * 1.5, y: pos.y - dir.y * 1.5 };
        for (let i = 0; i < BLAST_PUFFS; i++) {
            const a = Math.PI + (Math.random() - 0.5) * Math.PI * 0.7;
            const speed = 3 + Math.random() * 4;
            const c = Math.cos(a);
            const s = Math.sin(a);
            this.puff(
                layer,
                back,
                { x: (dir.x * c - dir.y * s) * speed, y: (dir.x * s + dir.y * c) * speed },
                BLAST_SCALE,
            );
        }
    }

    /** Starts the trail of every new rocket among `events`; a re-report shortens a rocket that stopped. */
    addBullets(events: readonly BulletEvent[]): void {
        for (const e of events) {
            const known = this.rockets.find((r) => r.id === e.id);
            if (known) {
                if (e.endDist !== undefined) known.dist = Math.min(known.dist, e.endDist);
                continue;
            }
            const def = GameObjectDefs[e.bulletType] as BulletDef | undefined;
            if (!isRocket(def) || e.reflectCount > 0) continue;
            if (this.rockets.length >= MAX_ROCKETS) this.rockets.shift();
            this.rockets.push({
                id: e.id,
                pos: { x: e.pos.x, y: e.pos.y },
                dir: { x: e.dir.x, y: e.dir.y },
                layer: e.layer,
                speed: def!.speed * (e.speedMult ?? 1),
                dist: e.endDist ?? e.maxDist,
                age: 0,
                nextPuff: 0,
            });
        }
    }

    /** Advances the rockets and drops their trail puffs. */
    update(dt: number): void {
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i]!;
            r.age += dt;
            const travelled = r.speed * r.age;
            if (travelled >= r.dist) {
                this.rockets.splice(i, 1);
                continue;
            }
            while (r.nextPuff <= r.age) {
                const d = Math.min(r.speed * r.nextPuff, r.dist);
                const at = { x: r.pos.x + r.dir.x * d, y: r.pos.y + r.dir.y * d };
                this.puff(r.layer, at, { x: -r.dir.x * 0.5, y: -r.dir.y * 0.5 }, TRAIL_SCALE);
                r.nextPuff += TRAIL_INTERVAL;
            }
        }
    }

    /** rockets flying (tests) */
    get activeRockets(): number {
        return this.rockets.length;
    }

    clear(): void {
        this.rockets.length = 0;
    }
}
