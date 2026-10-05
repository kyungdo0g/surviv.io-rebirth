// Air strikes: a plane spawns 2.5 s of flight behind its target, flies along the strike direction at 350 u/s and,
// once past the target, drops GameConfig.airstrike.bombCount iron bombs (one every second tick) on a strip of jittered
// points ahead of the target; the bombs fall from height 5 and explode on impact. Strikes come from thrown strobes
// (combat/projectiles.ts) and from the 50v50 scheduled air strike zones: a zone over the densest group of players,
// a "ping_airstrike" marker, then 3-5 planes `delay` seconds apart, each aimed at a random point in the zone or, half
// of the time, near a random player in it.
// Behaviour follows docs/research/mechanics/airdrop-airstrike.md "Air strikes" (survev objects/plane.ts).
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, getDefOfType, type MapDef } from "@rebirth/defs";
import { randomPointInCircle } from "../mapgen/random.ts";
import type { AirstrikeZoneView } from "../view.ts";
import type { Player } from "../world/player.ts";

const STRIKE = GameConfig.airstrike;
/** Strike planes spawn 2.5 s of flight before their target (survev AIRSTRIKE_PLANE_SPAWN_DIST). */
export const AIRSTRIKE_SPAWN_TIME = 2.5;
/** Bombs leave the plane at this height (survev AirStrikePlane.dropBomb). */
const BOMB_HEIGHT = 5;
/** One bomb every this many ticks once past the target (survev dropDelayCounter). */
const BOMB_TICKS = 2;
/** Zone defaults when the timing options leave them out (survev PlaneBarn.update). */
const DEFAULT_WAIT = 1.5;
const DEFAULT_DELAY = 1;
const DEFAULT_PLANES = 3;
/** A zone lasts wait + 2.5 + planes x delay + 2.5 s (survev addAirstrikeZone). */
const ZONE_FINISH_BUFFER = 2.5;
/** Half of the aim points are near a player of the zone: random offset up to bombCount x bombOffset / 4. */
const AIM_CHANCE = 0.5;
/** Zone centre: random offset up to 3 u around the chosen player (survev getAirstrikeZonePos). */
const ZONE_JITTER = 3;
const MAX_ZONE_ID = 255;
const TIME_EPS = 1e-9;

type PlaneOptions = MapDef["gameConfig"]["planes"]["timings"][number]["options"];

/** Bomb run state of a strike plane. */
export interface StrikeState {
    startPos: Vec2;
    /** bomb positions still to drop, in order */
    bombs: Vec2[];
    reachedTarget: boolean;
    dropCounter: number;
    /** player credited (the strobe thrower), 0 for the game */
    ownerId: number;
}

interface Zone {
    id: number;
    pos: Vec2;
    rad: number;
    duration: number;
    elapsed: number;
    startTicker: number;
    strikeTicker: number;
    planesLeft: number;
    interval: number;
    planeDir: Vec2;
}

/** What strikes need from the game and the plane system. */
export interface AirstrikeHost {
    readonly gas: { posNew: Vec2 };
    readonly world: { clampToMap(pos: Vec2, rad: number): Vec2 };
    players(): Iterable<Player>;
    /** spawns a strike plane flying along `dir` over `pos` */
    addAirstrike(pos: Vec2, dir: Vec2, ownerId: number): void;
    addPing(type: string, pos: Vec2): void;
}

/** Bomb points of one strike: target + dir x bombOffset x i + jitter (survev PlaneBarn.addAirStrike). */
export function bombPositions(rng: Rng, target: Vec2, dir: Vec2): Vec2[] {
    const out: Vec2[] = [];
    for (let i = 0; i < STRIKE.bombCount; i++) {
        const p = v2.add(target, v2.mul(dir, STRIKE.bombOffset * i));
        out.push(v2.add(p, randomPointInCircle(rng, STRIKE.bombJitter)));
    }
    return out;
}

/** What a strike plane's bomb run needs. */
export interface BombDropper {
    add(p: {
        ownerId: number;
        type: string;
        pos: Vec2;
        posZ: number;
        layer: number;
        vel: Vec2;
        fuse: number;
        damageType: number;
        sourceType: string;
    }): unknown;
}

/**
 * One tick of a strike plane that already moved: once it passed its target it drops a bomb every second tick.
 * Returns true when every bomb is dropped (the plane's action is complete).
 */
export function updateStrike(strike: StrikeState, pos: Vec2, target: Vec2, dir: Vec2, dropper: BombDropper): boolean {
    if (!strike.reachedTarget) {
        const start = v2.sub(target, strike.startPos);
        const now = v2.sub(target, pos);
        // the target is behind the plane once both directions point opposite ways
        if (v2.dot(start, now) < 0) strike.reachedTarget = true;
    }
    if (!strike.reachedTarget) return false;
    if (strike.bombs.length === 0) return true;
    if (strike.dropCounter % BOMB_TICKS === 0) {
        const bombPos = strike.bombs.shift() as Vec2;
        dropper.add({
            ownerId: strike.ownerId,
            type: "bomb_iron",
            pos: bombPos,
            posZ: BOMB_HEIGHT,
            layer: 0,
            vel: v2.mul(dir, STRIKE.bombVel),
            fuse: getDefOfType("throwable", "bomb_iron").fuseTime,
            damageType: DamageType.Airstrike,
            // potato mode swaps weapons like a strobe kill (survev dropBomb)
            sourceType: "strobe",
        });
        strike.dropCounter = 0;
    }
    strike.dropCounter++;
    return false;
}

/** Scheduled 50v50 air strike zones. */
export class AirstrikeZones {
    private readonly host: AirstrikeHost;
    private readonly rng: Rng;
    readonly zones: Zone[] = [];
    private nextId = 1;

    constructor(host: AirstrikeHost, rng: Rng) {
        this.host = host;
        this.rng = rng;
    }

    /** A scheduled air strike timing came due (survev PlaneBarn.update, Plane.Airstrike). */
    schedule(options: PlaneOptions): void {
        const rad = options.airstrikeZoneRad;
        if (!rad) return;
        const planes = options.numPlanes?.length
            ? this.rng.weighted(options.numPlanes, (n) => n.weight).count
            : DEFAULT_PLANES;
        this.addZone(this.zonePos(rad), rad, planes, options.wait ?? DEFAULT_WAIT, options.delay ?? DEFAULT_DELAY);
    }

    /** A zone at `pos`; the ping marks it on the map (survev addAirstrikeZone). */
    addZone(pos: Vec2, rad: number, planeCount: number, wait: number, interval: number): void {
        const duration = wait + AIRSTRIKE_SPAWN_TIME + planeCount * interval + ZONE_FINISH_BUFFER;
        const id = this.nextId;
        this.nextId = this.nextId >= MAX_ZONE_ID ? 1 : this.nextId + 1;
        this.zones.push({
            id,
            pos: v2.copy(pos),
            rad,
            duration,
            elapsed: 0,
            startTicker: wait,
            strikeTicker: 0,
            planesLeft: planeCount,
            interval,
            planeDir: v2.randomUnit(this.rng),
        });
        this.host.addPing("ping_airstrike", pos);
    }

    private connectedLiving(): Player[] {
        const out: Player[] = [];
        for (const p of this.host.players()) if (!p.dead && !p.disconnected) out.push(p);
        return out.sort((a, b) => a.id - b.id);
    }

    /**
     * Zone centre over a high player density (survev getAirstrikeZonePos): the connected players are shuffled and
     * the one with the most above-ground players within `rad` wins, stopping once more than a third are covered.
     */
    zonePos(rad: number): Vec2 {
        let pos = v2.copy(this.host.gas.posNew);
        const players = this.rng.shuffle(this.connectedLiving());
        const enough = Math.floor(players.length / 3);
        let best = 0;
        for (const p of players) {
            let n = 0;
            for (const q of players) if (q.layer !== 1 && v2.distance(q.pos, p.pos) <= rad) n++;
            if (n > best) {
                best = n;
                pos = v2.copy(p.pos);
                if (best > enough) break;
            }
        }
        return this.host.world.clampToMap(v2.add(pos, randomPointInCircle(this.rng, ZONE_JITTER)), 0);
    }

    /** Aim point of one plane of `zone`, shifted back so the bomb strip centres on it (survev getAirstrikePos). */
    private strikePos(zone: Zone): Vec2 {
        let pos = v2.add(zone.pos, randomPointInCircle(this.rng, zone.rad));
        if (this.rng.next() < AIM_CHANCE) {
            for (const p of this.rng.shuffle(this.connectedLiving())) {
                const test = v2.add(p.pos, randomPointInCircle(this.rng, (STRIKE.bombCount * STRIKE.bombOffset) / 4));
                if (p.layer !== 1 && v2.distance(zone.pos, test) <= zone.rad) {
                    pos = test;
                    break;
                }
            }
        }
        return v2.add(pos, v2.mul(zone.planeDir, (-(STRIKE.bombCount + 1.75) * STRIKE.bombOffset) / 2));
    }

    update(dt: number): void {
        for (let i = 0; i < this.zones.length; i++) {
            const zone = this.zones[i];
            zone.elapsed += dt;
            this.updateZone(zone, dt);
            if (zone.elapsed >= zone.duration - TIME_EPS) this.zones.splice(i--, 1);
        }
    }

    private updateZone(zone: Zone, dt: number): void {
        if (zone.startTicker > 0) {
            zone.startTicker -= dt;
            if (zone.startTicker > TIME_EPS) return;
            zone.startTicker = 0;
            this.strike(zone);
            return;
        }
        if (zone.planesLeft <= 0) return;
        zone.strikeTicker -= dt;
        if (zone.strikeTicker <= TIME_EPS) this.strike(zone);
    }

    private strike(zone: Zone): void {
        this.host.addAirstrike(this.strikePos(zone), zone.planeDir, 0);
        zone.strikeTicker = zone.interval;
        zone.planesLeft--;
    }

    views(): AirstrikeZoneView[] {
        return this.zones.map((z) => ({
            id: z.id,
            pos: v2.copy(z.pos),
            rad: z.rad,
            duration: z.duration,
            zoneT: Math.min(1, z.elapsed / z.duration),
        }));
    }
}
