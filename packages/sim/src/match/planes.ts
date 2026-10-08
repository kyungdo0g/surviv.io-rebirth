// Planes and air drops. On every circle change the map's plane timings (MapDef.gameConfig.planes) are scheduled;
// when one is due, a plane spawns 15 s of flight away and flies at GameConfig.airdrop.planeVel over a drop point
// inside the next safe circle, releases a crate that falls for GameConfig.airdrop.fallTime, crushes what is under
// it and lands as an airdrop_crate_* obstacle that players open with Interact. Each release puts an air drop
// marker on the minimap (MapIndicatorView "ping_airdrop" for the ping's mapLife). Air strike planes (strobes and the
// 50v50 scheduled zones) fly over their target and drop iron bombs (match/airstrikes.ts); on faction maps each
// scheduled zone rolls a rebirth variant (normal / heavy / carpet) from rules.roles.factionAirstrikeVariants, and the
// rebirth variant strobes call heavy or carpet strike lines (combat/projectiles.ts).
// Rebirth air drop tiers (rules.airdropTiers, docs/research/rebirth-deviations.md): a normal drop picked by the map's
// crate weights is a tier 1 or a tier 2 drop (defs tieredAirdropCrates, by the gas circle); the shell stays the normal
// one and opens into the tier's inner crate (Obstacle.destroyTypeOverride, kept server-side until it is opened).
// Behaviour follows docs/research/mechanics/airdrop-airstrike.md (survev objects/plane.ts, objects/airdrop.ts).
import { type Bounds, type Collider, ColliderType, collider, math, type Rng, type Vec2, v2 } from "@rebirth/core";
import {
    AIRSTRIKE_VARIANTS,
    type AirdropTier,
    type AirstrikeVariant,
    airdropTierCrate,
    DamageType,
    GameConfig,
    GameObjectDefs,
    getMapDef,
    getMapObjectDefOfType,
    type MapDef,
    Plane,
    tieredAirdropCrates,
} from "@rebirth/defs";
import { TICK_HZ } from "../api.ts";
import type { DamageParams } from "../combat/damage.ts";
import { toBounds, transformOri } from "../geom/transform.ts";
import { randomPointInCircle, subRng } from "../mapgen/random.ts";
import type { AirdropView, AirstrikeZoneView, MapIndicatorView, PlaneView } from "../view.ts";
import { createMapEntity, type Obstacle } from "../world/entities.ts";
import type { Player } from "../world/player.ts";
import { sameLayer, type World } from "../world/world.ts";
import {
    AIRSTRIKE_SPAWN_TIME,
    AirstrikeZones,
    type BombDropper,
    bombPositions,
    pickAirstrikeVariant,
    type StrikeState,
    updateStrike,
} from "./airstrikes.ts";
import type { Gas } from "./gas.ts";
import { type MapIndicator, MapIndicatorSystem } from "./indicators.ts";

export type { MapIndicator } from "./indicators.ts";

const AIRDROP = GameConfig.airdrop;
/** Planes spawn this far from the drop point: 15 s of flight (survev plane.ts AIRDROP_PLANE_SPAWN_DIST). */
const AIRDROP_SPAWN_DIST = AIRDROP.planeVel * 15;
/** The crate is released once the plane is this close to the drop point (survev AirdropPlane.update). */
const RELEASE_DIST = 5;
/** Planes live inside the map expanded by this much (survev PlaneBarn.planeBounds). */
const PLANE_BOUNDS_MARGIN = 256;
/** Landed crates are removed this long after landing (survev AirdropBarn.update: fallTime <= -1). */
const LANDED_LINGER_TICKS = TICK_HZ;
/** Half size of a falling crate's broadphase box (survev Airdrop.bounds 5x5 extents). */
const AIRDROP_VIEW_EXTENT = 5;
/** Overlap resolution attempts for a drop point; a random 3 u nudge on some of them (survev addAirdrop). */
const DROP_ATTEMPTS = 10000;
const NUDGE_DIST = 3;
const PLANE_IDS = 255;
/** Crush damage of survev's instant kill. */
const INSTANT_KILL_DAMAGE = 1e10;

type PlaneOptions = MapDef["gameConfig"]["planes"]["timings"][number]["options"];

/** What planes need from the game. */
export interface PlaneHost {
    readonly world: World;
    readonly gas: Gas;
    readonly tick: number;
    readonly rules: {
        airdropCrushDamage: number;
        airdropCrushInstantKill: boolean;
        airdropTiers: boolean;
        roles: {
            factionAirstrikeWaits: Readonly<Record<number, number>>;
            factionAirstrikeVariants: Readonly<Partial<Record<AirstrikeVariant, number>>>;
        };
    };
    /** air strike bombs are projectiles */
    readonly projectiles: BombDropper;
    players(): Iterable<Player>;
    damagePlayer(target: Player, params: DamageParams): void;
    damageObstacle(obstacle: Obstacle, params: DamageParams): void;
    wakeLoot(bounds: Bounds, layer: number): void;
    nextEventSeq(): number;
}

interface ScheduledPlane {
    ticks: number;
    options: PlaneOptions;
}

export interface PlaneState {
    id: number;
    type: number;
    pos: Vec2;
    dir: Vec2;
    actionComplete: boolean;
    /** drop point */
    target: Vec2;
    crateType: string;
    /** rebirth air drop tiers: the inner crate the shell opens into instead of its destroyType ("" for that) */
    innerType: string;
    crateCollider: Collider;
    /** air strike planes: their bomb run */
    strike?: StrikeState;
}

export interface FallingAirdrop {
    id: number;
    pos: Vec2;
    crateType: string;
    innerType: string;
    crateCollider: Collider;
    ticks: number;
    landed: boolean;
    landedTicks: number;
}

export class PlaneSystem {
    readonly planes: PlaneState[] = [];
    readonly airdrops: FallingAirdrop[] = [];
    /** minimap indicators: timed pings and tracked roles / loot (M7a, indicators.ts) */
    readonly mapIndicators: MapIndicatorSystem;
    /** 50v50 scheduled air strike zones */
    readonly zones: AirstrikeZones;
    private readonly scheduled: ScheduledPlane[] = [];
    private readonly host: PlaneHost;
    private readonly rng: Rng;
    /** rolls the variant of scheduled faction zones, apart from `rng` so normal zones keep the original draws */
    private readonly variantRng: Rng;
    private readonly mapName: string;
    private readonly fallTicks = Math.round(AIRDROP.fallTime * TICK_HZ);
    private readonly planeBounds: Bounds;
    private nextPlaneId = 1;
    private readonly freePlaneIds: number[] = [];

    /** `seed`: the game seed; planes draw from its "planes:<map>" stream, variants from "airstrikeVariants:<map>" */
    constructor(host: PlaneHost, mapName: string, seed: number) {
        this.host = host;
        this.mapName = mapName;
        const rng = subRng(seed, `planes:${mapName}`);
        this.rng = rng;
        this.variantRng = subRng(seed, `airstrikeVariants:${mapName}`);
        const { width, height } = host.world;
        this.planeBounds = {
            min: { x: -PLANE_BOUNDS_MARGIN, y: -PLANE_BOUNDS_MARGIN },
            max: { x: width + PLANE_BOUNDS_MARGIN, y: height + PLANE_BOUNDS_MARGIN },
        };
        this.mapIndicators = new MapIndicatorSystem(host);
        this.zones = new AirstrikeZones(
            {
                gas: host.gas,
                world: host.world,
                players: () => host.players(),
                addAirstrike: (pos, dir, ownerId, variant) => this.addAirstrike(pos, dir, ownerId, variant),
                addPing: (type, pos) => this.addPing(type, pos),
            },
            rng,
        );
    }

    /** Live indicators (timed and tracked). */
    get indicators(): readonly MapIndicator[] {
        return this.mapIndicators.indicators;
    }

    /**
     * Queues the map's plane timings of a new circle (survev gas.ts advanceGasStage -> schedulePlane). On faction maps
     * `rules.roles.factionAirstrikeWaits` replaces air strike waits (conflicts.md faction-airstrike-timing).
     */
    scheduleCircle(circleIdx: number): void {
        const def = getMapDef(this.mapName);
        const overrides = def.gameMode.factionMode ? this.host.rules.roles.factionAirstrikeWaits : {};
        for (const timing of def.gameConfig.planes.timings) {
            if (timing.circleIdx !== circleIdx) continue;
            const strike = timing.options.type === Plane.Airstrike;
            const wait = strike ? (overrides[circleIdx] ?? timing.wait) : timing.wait;
            this.scheduled.push({ ticks: Math.round(wait * TICK_HZ), options: timing.options });
        }
    }

    /**
     * A scheduled air strike zone with the timing `options` `wait` seconds from now, as if a map timing came due (it
     * rolls its variant like one: faction maps only).
     */
    scheduleAirstrike(options: PlaneOptions, wait: number): void {
        this.scheduled.push({ ticks: Math.round(wait * TICK_HZ), options: { ...options, type: Plane.Airstrike } });
    }

    /** A scheduled air drop of `crateType` `wait` seconds from now (the 50v50 gold military drop, M7a). */
    scheduleCrate(crateType: string, wait: number): void {
        this.scheduled.push({
            ticks: Math.round(wait * TICK_HZ),
            options: { type: Plane.Airdrop, airdropType: crateType },
        });
    }

    update(dt: number): void {
        for (let i = 0; i < this.planes.length; i++) {
            const plane = this.planes[i];
            const vel = plane.type === Plane.Airdrop ? AIRDROP.planeVel : GameConfig.airstrike.planeVel;
            plane.pos = v2.add(plane.pos, v2.mul(plane.dir, vel * dt));
            if (plane.strike) {
                if (!plane.actionComplete) {
                    const dropper = this.host.projectiles;
                    plane.actionComplete = updateStrike(plane.strike, plane.pos, plane.target, plane.dir, dropper);
                }
            } else if (!plane.actionComplete && v2.distance(plane.pos, plane.target) < RELEASE_DIST) {
                plane.actionComplete = true;
                this.releaseCrate(plane);
            }
            if (plane.actionComplete && !inBounds(plane.pos, this.planeBounds)) {
                this.planes.splice(i--, 1);
                this.freePlaneIds.push(plane.id);
            }
        }
        for (let i = 0; i < this.airdrops.length; i++) {
            const drop = this.airdrops[i];
            if (!drop.landed) {
                if (++drop.ticks >= this.fallTicks) this.land(drop);
            } else if (++drop.landedTicks >= LANDED_LINGER_TICKS) {
                this.airdrops.splice(i--, 1);
            }
        }
        for (let i = 0; i < this.scheduled.length; i++) {
            const s = this.scheduled[i];
            if (--s.ticks > 0) continue;
            this.scheduled.splice(i--, 1);
            if (s.options.type === Plane.Airdrop) this.scheduleAirdrop(s.options.airdropType);
            else if (s.options.type === Plane.Airstrike) this.zones.schedule(s.options, this.rollVariant());
        }
        this.zones.update(dt);
        this.mapIndicators.update();
    }

    /**
     * Variant of a scheduled air strike zone: rolled from rules.roles.factionAirstrikeVariants on faction maps (rebirth
     * deviation, docs/research/rebirth-deviations.md), normal elsewhere.
     */
    private rollVariant(): AirstrikeVariant {
        if (!getMapDef(this.mapName).gameMode.factionMode) return "normal";
        return pickAirstrikeVariant(this.variantRng, this.host.rules.roles.factionAirstrikeVariants);
    }

    /**
     * An air strike plane: it spawns 2.5 s of flight behind `target`, flies along `dir` and bombs a strip starting at
     * `target` (survev PlaneBarn.addAirStrike) with the bombs of `variant`. `ownerId` is credited with the bombs
     * (strobe thrower, 0 for the game); `sourceType` is the strobe that called the plane ("strobe" for the zones).
     */
    addAirstrike(
        target: Vec2,
        dir: Vec2,
        ownerId: number,
        variant: AirstrikeVariant = "normal",
        sourceType = "strobe",
    ): void {
        const id = this.allocPlaneId();
        if (id === 0) return;
        const d = v2.normalizeSafe(dir, { x: 1, y: 0 });
        const pos = v2.sub(target, v2.mul(d, GameConfig.airstrike.planeVel * AIRSTRIKE_SPAWN_TIME));
        const strip = AIRSTRIKE_VARIANTS[variant];
        this.planes.push({
            id,
            type: Plane.Airstrike,
            pos,
            dir: d,
            actionComplete: false,
            target: v2.copy(target),
            crateType: "",
            innerType: "",
            crateCollider: collider.createCircle(target, 0),
            strike: {
                startPos: v2.copy(pos),
                bombs: bombPositions(this.rng, target, d, strip),
                reachedTarget: false,
                // the first bomb drops on the tick the plane passes the target (survev dropDelayCounter = 2)
                dropCounter: 2,
                bombType: strip.bombType,
                ownerId,
                sourceType,
            },
        });
    }

    /** A map marker of a ping def (ping_airdrop, ping_airstrike) for the ping's mapLife. */
    addPing(type: string, pos: Vec2): void {
        const ping = GameObjectDefs[type] as { mapLife?: number } | undefined;
        this.mapIndicators.add(type, pos, ping?.mapLife ?? 10);
    }

    /** Every live air strike zone. */
    zoneViews(): AirstrikeZoneView[] {
        return this.zones.views();
    }

    /**
     * A scheduled air drop: a uniform point inside the next safe circle, moved off indestructible obstacles, roofs and
     * other crates, which can push it a few units out of the circle (survev plane.ts:94-102). Without `crateType` the
     * map's crate weights pick it (with the rebirth tiers); `tier` forces a tier of a splittable shell.
     */
    scheduleAirdrop(crateType?: string, tier?: AirdropTier): void {
        const gas = this.host.gas;
        const { type, inner } = this.crateChoice(crateType, tier);
        const target = v2.add(gas.posNew, randomPointInCircle(this.rng, gas.radNew));
        this.addPlane(target, this.findDropPos(target, type), type, inner);
    }

    /**
     * An air drop at `target` (flare guns, tests): the drop point is only moved off what it overlaps, it may lie
     * anywhere (survev PlaneBarn.addAirdrop). `crateType` and `tier` as in scheduleAirdrop.
     */
    addAirdrop(target: Vec2, crateType?: string, tier?: AirdropTier): void {
        const { type, inner } = this.crateChoice(crateType, tier);
        this.addPlane(target, this.findDropPos(target, type), type, inner);
    }

    /**
     * Crate of a drop: `crateType` as asked (a forced `tier` of a splittable shell picks its inner crate; an explicit
     * crate is never tiered otherwise, e.g. the 50v50 gold drop), else a pick from the map's crate weights. With
     * rules.airdropTiers the splittable normal shells are split by the current circle (defs tieredAirdropCrates); the
     * pick is one weighted draw either way, so the gold drop keeps its chance and the draws stay in step.
     */
    private crateChoice(crateType?: string, tier?: AirdropTier): { type: string; inner: string } {
        if (crateType) return { type: crateType, inner: (tier && airdropTierCrate(crateType, tier)) || "" };
        const crates = getMapDef(this.mapName).gameConfig.planes.crates;
        if (!crates.some((c) => c.weight > 0)) return { type: "airdrop_crate_01", inner: "" };
        if (!this.host.rules.airdropTiers) return { type: this.rng.weighted(crates, (c) => c.weight).name, inner: "" };
        const pick = this.rng.weighted(tieredAirdropCrates(crates, this.host.gas.circleIdx), (c) => c.weight);
        return { type: pick.name, inner: pick.inner ?? "" };
    }

    private crateCollider(type: string, pos: Vec2): Collider {
        return transformOri(getMapObjectDefOfType("obstacle", type).collision, pos, 0, 1);
    }

    /**
     * Drop point for a crate aimed at `target` (survev PlaneBarn.addAirdrop): the crate collider is pushed out of
     * whatever it overlaps, up to 10000 times, and kept on the map (a box by its larger side, a round crate by its
     * radius).
     */
    findDropPos(target: Vec2, type: string): Vec2 {
        const { world } = this.host;
        let pos = v2.copy(target);
        for (let attempt = 1; attempt <= DROP_ATTEMPTS; attempt++) {
            let coll = this.crateCollider(type, pos);
            if (attempt % 100 > 75) coll = translate(coll, v2.mul(v2.randomUnit(this.rng), NUDGE_DIST));
            const push = this.overlapPush(coll, world);
            if (push) coll = translate(coll, push);
            const b = toBounds(coll);
            const rad = coll.type === ColliderType.Circle ? coll.rad : Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
            pos = world.clampToMap(v2.mul(v2.add(b.min, b.max), 0.5), rad);
            if (!push) break;
        }
        return pos;
    }

    /**
     * Push separating `coll` from the first thing it overlaps, or null when it overlaps nothing. Opened crates still
     * count: survev keeps dead shells in its grid with their collider (survev plane.ts:338-352).
     */
    private overlapPush(coll: Collider, world: World): Vec2 | null {
        const sep = (other: Collider): Vec2 | null => {
            if (coll.type === ColliderType.Aabb && other.type === ColliderType.Aabb) return survevBoxPush(coll, other);
            const res = collider.intersect(coll, other);
            return res ? v2.mul(res.dir, res.pen) : null;
        };
        for (const obj of world.query(toBounds(coll))) {
            if (obj.layer !== 0) continue;
            if (obj.kind === "obstacle" && !obj.destructible) {
                const p = sep(obj.collider);
                if (p) return p;
            } else if (obj.kind === "building" && !obj.def.ceiling.destroy) {
                // crates never land on indestructible roofs
                for (const region of obj.zoomRegions) {
                    if (!region.zoomIn) continue;
                    const p = sep({ type: 1, min: region.zoomIn.min, max: region.zoomIn.max });
                    if (p) return p;
                }
            }
        }
        for (const drop of this.airdrops) {
            const p = sep(drop.crateCollider);
            if (p) return p;
        }
        for (const plane of this.planes) {
            if (plane.type !== Plane.Airdrop || plane.actionComplete) continue;
            const p = sep(plane.crateCollider);
            if (p) return p;
        }
        return null;
    }

    private addPlane(requested: Vec2, drop: Vec2, crateType: string, innerType: string): void {
        const id = this.allocPlaneId();
        if (id === 0) return;
        const pos = v2.add(requested, v2.mul(v2.randomUnit(this.rng), AIRDROP_SPAWN_DIST));
        const toDrop = v2.sub(drop, pos);
        const len = v2.length(toDrop);
        this.planes.push({
            id,
            type: Plane.Airdrop,
            pos,
            dir: len > 1e-5 ? v2.div(toDrop, len) : { x: 1, y: 0 },
            actionComplete: false,
            target: drop,
            crateType,
            innerType,
            crateCollider: this.crateCollider(crateType, drop),
        });
    }

    private allocPlaneId(): number {
        if (this.nextPlaneId <= PLANE_IDS) return this.nextPlaneId++;
        return this.freePlaneIds.shift() ?? 0;
    }

    /** The plane reached the drop point: the crate starts falling and the minimap shows the drop. */
    private releaseCrate(plane: PlaneState): void {
        this.airdrops.push({
            id: this.host.world.allocId(),
            pos: v2.copy(plane.target),
            crateType: plane.crateType,
            innerType: plane.innerType,
            crateCollider: plane.crateCollider,
            ticks: 0,
            landed: false,
            landedTicks: 0,
        });
        this.addPing("ping_airdrop", plane.target);
    }

    /** Landing: crush players and obstacles under the crate, break destructible roofs, place the crate obstacle. */
    private land(drop: FallingAirdrop): void {
        drop.landed = true;
        const { world, rules } = this.host;
        const crate = drop.crateCollider;
        const amount = rules.airdropCrushInstantKill ? INSTANT_KILL_DAMAGE : rules.airdropCrushDamage;
        for (const obj of world.query(toBounds(crate))) {
            if (!sameLayer(obj.layer, 0)) continue;
            if (obj.kind === "player") {
                if (obj.dead || !collider.intersect(collider.createCircle(obj.pos, obj.rad), crate)) continue;
                this.host.damagePlayer(obj, { amount, damageType: DamageType.Airdrop, dir: v2.copy(obj.dir) });
            } else if (obj.kind === "obstacle") {
                // a tree is crushed by its canopy box (survev airdrop.ts:80-86 obstacleAABB, def.aabb)
                const box = obj.def.aabb ? transformOri(obj.def.aabb, obj.pos, obj.ori, obj.scale) : obj.collider;
                if (obj.dead || !collider.intersect(box, crate)) continue;
                this.host.damageObstacle(obj, { amount: INSTANT_KILL_DAMAGE, damageType: DamageType.Airdrop });
            } else if (obj.kind === "building" && !obj.ceilingDead && obj.def.ceiling.destroy) {
                const hit = obj.zoomRegions.some(
                    (r) => r.zoomIn && collider.intersect({ type: 1, min: r.zoomIn.min, max: r.zoomIn.max }, crate),
                );
                if (hit) obj.ceilingDead = true;
            }
        }
        const def = getMapObjectDefOfType("obstacle", drop.crateType);
        const shell = createMapEntity({
            id: world.allocId(),
            kind: "obstacle",
            type: drop.crateType,
            pos: v2.copy(drop.pos),
            ori: 0,
            scale: this.rng.range(def.scale.createMin, def.scale.createMax),
            layer: 0,
            parentId: 0,
        }) as Obstacle;
        // a tiered drop opens into its tier's crate (never on the wire: tier 1 and tier 2 shells look the same)
        shell.destroyTypeOverride = drop.innerType;
        world.add(shell);
        this.host.wakeLoot(toBounds(crate), 0);
    }

    /** Planes whose body touches `view` while inside the plane bounds (survev client.ts). */
    planeViews(view: Bounds): PlaneView[] {
        const out: PlaneView[] = [];
        for (const p of this.planes) {
            const rad = p.type === Plane.Airdrop ? AIRDROP.planeRad : GameConfig.airstrike.planeRad;
            if (!circleTouchesBox(p.pos, rad, view) || !inBounds(p.pos, this.planeBounds)) continue;
            out.push({
                id: p.id,
                pos: v2.copy(p.pos),
                dir: v2.copy(p.dir),
                planeType: p.type === Plane.Airdrop ? "airdrop" : "airstrike",
                actionComplete: p.actionComplete,
            });
        }
        return out;
    }

    /** Falling (and just landed) crates in `view`, by id. */
    airdropViews(view: Bounds): AirdropView[] {
        const out: AirdropView[] = [];
        for (const d of this.airdrops) {
            const e = AIRDROP_VIEW_EXTENT;
            const box = { min: { x: d.pos.x - e, y: d.pos.y - e }, max: { x: d.pos.x + e, y: d.pos.y + e } };
            if (!collider.aabbOverlap(box, view)) continue;
            out.push({
                id: d.id,
                pos: v2.copy(d.pos),
                fallT: math.clamp(d.ticks / this.fallTicks, 0, 1),
                landed: d.landed,
            });
        }
        return out.sort((a, b) => a.id - b.id);
    }

    /** Live indicators plus those that died after event `seq` (dead), sorted by id. */
    indicatorViews(seq: number): MapIndicatorView[] {
        return this.mapIndicators.views(seq);
    }
}

function translate(c: Collider, d: Vec2): Collider {
    if (c.type === 0) return { type: 0, pos: v2.add(c.pos, d), rad: c.rad };
    return { type: 1, min: v2.add(c.min, d), max: v2.add(c.max, d) };
}

function inBounds(p: Vec2, b: Bounds): boolean {
    return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

function circleTouchesBox(pos: Vec2, rad: number, b: Bounds): boolean {
    const dx = pos.x - math.clamp(pos.x, b.min.x, b.max.x);
    const dy = pos.y - math.clamp(pos.y, b.min.y, b.max.y);
    return dx * dx + dy * dy <= rad * rad;
}

/**
 * survev's box separation for air drop placement (survev shared/utils/coldet.ts:405-428 intersectAabbAabb, pushed by
 * -dir * pen): it separates along the axis of the larger overlap, where the core collider takes the smaller one.
 */
export function survevBoxPush(a: Bounds, b: Bounds): Vec2 | null {
    const nx = (b.min.x + b.max.x - a.min.x - a.max.x) * 0.5;
    const ny = (b.min.y + b.max.y - a.min.y - a.max.y) * 0.5;
    const xo = (a.max.x - a.min.x + b.max.x - b.min.x) * 0.5 - Math.abs(nx);
    if (xo <= 0) return null;
    const yo = (a.max.y - a.min.y + b.max.y - b.min.y) * 0.5 - Math.abs(ny);
    if (yo <= 0) return null;
    if (xo > yo) return { x: nx < 0 ? xo : -xo, y: 0 };
    return { x: 0, y: ny < 0 ? yo : -yo };
}
