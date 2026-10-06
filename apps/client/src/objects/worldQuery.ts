// Client-side queries against the objects in view and the terrain, for the player and building views (M9):
// - groundSurface: the surface under a point (survev client/src/map.ts getGroundSurface: decal surfaces first, then
//   the floor of the topmost building, then river water, then grass / the biome's river-shore sound / sand / sea), with
//   the water and ripple colours of lakes and rivers;
// - submersion: how deep a point is in its water (survev player.ts updateSubmersion);
// - bushAt: the bush a player stands in (survev player.ts update, a circle of a quarter of the player radius);
// - scanCollider: whether the player can see into a ceiling region past the walls (survev
//   shared/utils/collisionHelpers.ts scanCollider, the same in the 0.8.82 client), used by the ceiling reveal, and the
//   viewer's noCeilingReveal ticker (survev player.ts updateRenderLayer: 0.25 s after touching `noCeilingReveal` stairs
//   off the ground floor, so walking down an outside cellar entrance does not peek into the house).
// Views reach it through their ViewDeps (`worldQueriesOf`); the client creates one per map.
import { type Bounds, type Collider, collider, math, type Vec2, v2 } from "@rebirth/core";
import {
    type BuildingDef,
    type DecalDef,
    GameConfig,
    type MapDef,
    MapObjectDefs,
    type ObstacleDef,
    type StructureDef,
} from "@rebirth/defs";
import { type ObstacleView, type River, sameLayer, type Terrain } from "@rebirth/sim";
import type { ViewDeps } from "./types.ts";
import type { ObjectWorld } from "./world.ts";

export interface GroundSurface {
    /** footstep surface: grass, sand, water, or a building floor (house, tile, container, ...) */
    type: string;
    waterColor: number;
    rippleColor: number;
    /** the river or lake whose water this is (null for the sea, decals and dry ground) */
    river: River | null;
}

export interface QueryObstacle {
    id: number;
    def: ObstacleDef;
    layer: number;
    dead: boolean;
    col: Collider;
    box: Bounds;
}

/** cache entries remember the last refresh that saw their object */
interface Stamped {
    frame: number;
}

interface CachedObstacle extends QueryObstacle, Stamped {
    view: ObstacleView;
}

interface FloorCache extends Stamped {
    zIdx: number;
    layer: number;
    surfaces: Array<{ type: string; cols: Collider[] }>;
}

/** a decal's floor surface (`col` null for decals without one) */
interface DecalSurface extends Stamped {
    layer: number;
    col: Collider | null;
    type: string;
    waterColor?: number;
    rippleColor?: number;
}

/** Extra ViewDeps field the client sets (the view deps interface is shared; this keeps the field typed). */
export interface WorldQueryDeps {
    worldQueries?: WorldQuery;
}

export function worldQueriesOf(deps: ViewDeps): WorldQuery | null {
    return (deps as ViewDeps & WorldQueryDeps).worldQueries ?? null;
}

/** even-odd point in polygon (survev math.pointInsidePolygon) */
function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

function distToSegmentSq(p: Vec2, a: Vec2, b: Vec2): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len = abx * abx + aby * aby;
    const t = len > 0 ? math.clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len, 0, 1) : 0;
    const dx = a.x + abx * t - p.x;
    const dy = a.y + aby * t - p.y;
    return dx * dx + dy * dy;
}

/** survev math.distToPolygon */
function distToPolygon(p: Vec2, poly: readonly Vec2[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < poly.length; i++)
        best = Math.min(best, distToSegmentSq(p, poly[i], poly[(i + 1) % poly.length]));
    return Math.sqrt(best);
}

function inBounds(p: Vec2, b: Bounds): boolean {
    return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

/** survev collider.intersectCircle: `dir` points from the collider to the circle, `pen` >= rad when inside */
function intersectCircle(col: Collider, pos: Vec2, rad: number): { dir: Vec2; pen: number } | null {
    return collider.intersect(collider.createCircle(pos, rad), col);
}

export class WorldQuery {
    private readonly terrain: Terrain;
    private readonly mapDef: MapDef;
    private readonly world: () => ObjectWorld | null;
    private obstacleList: QueryObstacle[] = [];
    private bushList: QueryObstacle[] = [];
    private readonly obstacleCache = new Map<number, CachedObstacle>();
    private floors: FloorCache[] = [];
    private readonly floorCache = new Map<number, FloorCache>();
    private decals: DecalSurface[] = [];
    private readonly decalCache = new Map<number, DecalSurface>();
    /** refresh counter stamped on cache entries still in view */
    private frame = 0;
    /** world-space boxes of `noCeilingReveal` stairs by structure id */
    private readonly noRevealStairs = new Map<number, Bounds[]>();
    private stale = true;
    private snapshots = -1;
    private noCeilingRevealTicker = 0;
    /** increments whenever the object lists were rebuilt (views cache query results per generation) */
    generation = 0;

    constructor(terrain: Terrain, mapDef: MapDef, world: () => ObjectWorld | null) {
        this.terrain = terrain;
        this.mapDef = mapDef;
        this.world = world;
    }

    /**
     * Call once per frame before the views update, with the followed player's drawn position and layer and the count of
     * snapshots applied: the object lists are rebuilt on the next query after a new snapshot (every frame without one).
     */
    beginFrame(dt: number, viewerPos: Vec2, viewerLayer: number, snapshots?: number): void {
        if (snapshots === undefined || snapshots !== this.snapshots) this.stale = true;
        this.snapshots = snapshots ?? -1;
        this.noCeilingRevealTicker -= dt;
        if (viewerLayer !== 0 && this.touchesNoRevealStairs(viewerPos)) this.noCeilingRevealTicker = 0.25;
    }

    /** ceilings may not be revealed now (the viewer is on or just left cellar stairs) */
    get noCeilingReveal(): boolean {
        return this.noCeilingRevealTicker > 0;
    }

    private touchesNoRevealStairs(pos: Vec2): boolean {
        const rad = GameConfig.player.maxVisualRadius;
        let hit = false;
        this.world()?.forEachView("structure", (s) => {
            let boxes = this.noRevealStairs.get(s.id);
            if (!boxes) {
                const def = MapObjectDefs[s.type] as StructureDef | undefined;
                const rot = math.oriToRad(s.ori);
                boxes = (def?.stairs ?? [])
                    .filter((st) => st.noCeilingReveal)
                    .map((st) => collider.transform(st.collision, s.pos, rot, 1));
                this.noRevealStairs.set(s.id, boxes);
            }
            for (const b of boxes) {
                const dx = Math.max(b.min.x - pos.x, 0, pos.x - b.max.x);
                const dy = Math.max(b.min.y - pos.y, 0, pos.y - b.max.y);
                if (dx * dx + dy * dy < rad * rad) hit = true;
            }
        });
        return hit;
    }

    private refresh(): void {
        if (!this.stale) return;
        this.stale = false;
        this.generation++;
        const frame = ++this.frame;
        const world = this.world();
        const obstacles: QueryObstacle[] = [];
        const bushes: QueryObstacle[] = [];
        const floors: FloorCache[] = [];
        const decals: DecalSurface[] = [];
        world?.forEachView("obstacle", (o) => {
            let entry = this.obstacleCache.get(o.id);
            // colliders change only when an obstacle moves (doors), shrinks or dies
            const moved =
                !entry ||
                (entry.view !== o &&
                    (entry.view.pos.x !== o.pos.x ||
                        entry.view.pos.y !== o.pos.y ||
                        entry.view.ori !== o.ori ||
                        entry.view.scale !== o.scale ||
                        entry.view.layer !== o.layer));
            if (moved) {
                const def = MapObjectDefs[o.type] as ObstacleDef | undefined;
                if (!def?.collision) return;
                const col = collider.transform(def.collision, o.pos, math.oriToRad(o.ori), o.scale);
                entry = { id: o.id, def, layer: o.layer, dead: o.dead, col, box: collider.toAabb(col), view: o, frame };
                this.obstacleCache.set(o.id, entry);
            }
            const e = entry!;
            e.view = o;
            e.dead = o.dead;
            e.frame = frame;
            obstacles.push(e);
            if (e.def.isBush) bushes.push(e);
        });
        world?.forEachView("building", (b) => {
            let cache = this.floorCache.get(b.id);
            if (!cache) {
                const def = MapObjectDefs[b.type] as BuildingDef | undefined;
                const rot = math.oriToRad(b.ori);
                const surfaces = (def?.floor.surfaces ?? []).map((s) => ({
                    type: s.type,
                    cols: s.collision.map((c) => collider.transform(c, b.pos, rot, 1)),
                }));
                cache = { zIdx: def?.zIdx ?? 0, layer: b.layer, surfaces, frame };
                this.floorCache.set(b.id, cache);
            }
            cache.frame = frame;
            if (cache.surfaces.length) floors.push(cache);
        });
        world?.forEachView("decal", (d) => {
            let cache = this.decalCache.get(d.id);
            if (!cache) {
                const def = MapObjectDefs[d.type] as DecalDef | undefined;
                const surface = def?.surface as
                    | { type: string; data?: { waterColor?: number; rippleColor?: number } }
                    | undefined;
                cache = {
                    layer: d.layer,
                    col:
                        def && surface ? collider.transform(def.collision, d.pos, math.oriToRad(d.ori), d.scale) : null,
                    type: surface?.type ?? "",
                    waterColor: surface?.data?.waterColor,
                    rippleColor: surface?.data?.rippleColor,
                    frame,
                };
                this.decalCache.set(d.id, cache);
            }
            cache.frame = frame;
            if (cache.col) decals.push(cache);
        });
        // forget objects that left the view (every few hundred frames is enough)
        if (frame % 256 === 0) {
            for (const cache of [this.obstacleCache, this.floorCache, this.decalCache] as Map<number, Stamped>[]) {
                for (const [id, entry] of cache) if (entry.frame !== frame) cache.delete(id);
            }
        }
        this.obstacleList = obstacles;
        this.bushList = bushes;
        this.floors = floors;
        this.decals = decals;
    }

    /** Obstacles in view (rebuilt once per frame). */
    obstacles(): readonly QueryObstacle[] {
        this.refresh();
        return this.obstacleList;
    }

    private surface(type: string, data: Partial<GroundSurface> = {}): GroundSurface {
        const colors = this.mapDef.biome.colors;
        const lake = data.river?.looped ?? false;
        return {
            type,
            waterColor: data.waterColor ?? (lake ? (colors.lakeWater ?? colors.water) : colors.water),
            rippleColor:
                data.rippleColor ?? (lake ? (colors.lakeWaterRipple ?? colors.waterRipple) : colors.waterRipple),
            river: data.river ?? null,
        };
    }

    /** The surface under `pos` on `layer` (survev map.getGroundSurface). */
    groundSurface(pos: Vec2, layer: number): GroundSurface {
        this.refresh();
        for (const d of this.decals) {
            if (d.col && sameLayer(d.layer, layer) && collider.contains(d.col, pos)) {
                return this.surface(d.type, { waterColor: d.waterColor, rippleColor: d.rippleColor });
            }
        }
        // the topmost building floor (a later surface of the same building wins); ground floors win on stairs
        const onStairs = (layer & 2) !== 0;
        let zIdx = 0;
        let floor: string | null = null;
        for (const f of this.floors) {
            if (f.zIdx < zIdx || !(f.layer === layer || onStairs) || (f.layer === 1 && onStairs)) continue;
            for (const s of f.surfaces) {
                if (s.cols.some((c) => collider.contains(c, pos))) {
                    zIdx = f.zIdx;
                    floor = s.type;
                }
            }
        }
        if (floor) return this.surface(floor);
        let onRiverShore = false;
        if (layer !== 1) {
            for (const river of this.terrain.rivers) {
                if (!inBounds(pos, river.aabb) || !pointInPolygon(pos, river.shorePoly)) continue;
                onRiverShore = true;
                if (pointInPolygon(pos, river.waterPoly)) return this.surface("water", { river });
            }
        }
        if (pointInPolygon(pos, this.terrain.grass)) {
            return this.surface(onRiverShore ? this.mapDef.biome.sound.riverShore : "grass");
        }
        return this.surface(pointInPolygon(pos, this.terrain.shore) ? "sand" : "water");
    }

    /** Target submersion 0.6..1 of a point in water, 0 out of it (survev player.ts updateSubmersion). */
    submersion(pos: Vec2, surface: GroundSurface): number {
        if (surface.type !== "water") return 0;
        const river = surface.river;
        const inRiver = !!river && pointInPolygon(pos, this.terrain.shore);
        const dist = inRiver ? riverDistanceToShore(river!, pos) : distToPolygon(pos, this.terrain.shore);
        return math.remap(dist, 0, inRiver ? 12 : 16, 0.6, 1);
    }

    /** The live bush on exactly `layer` that a circle at `pos` touches (survev player.ts insideObstacle). */
    bushAt(pos: Vec2, rad: number, layer: number): QueryObstacle | null {
        this.refresh();
        let found: QueryObstacle | null = null;
        for (const o of this.bushList) {
            if (o.dead || o.layer !== layer) continue;
            if (pos.x < o.box.min.x - rad || pos.x > o.box.max.x + rad) continue;
            if (pos.y < o.box.min.y - rad || pos.y > o.box.max.y + rad) continue;
            if (intersectCircle(o.col, pos, rad)) found = o;
        }
        return found;
    }

    /**
     * Distance along pos + dir * t (t <= len) to the first obstacle that blocks sight at `height` (survev
     * collisionHelpers.intersectSegmentDist): windows and dead or non-collidable obstacles do not; with `hackStairs`
     * ground-floor walls are ignored from the stairs.
     */
    segmentDist(
        list: readonly QueryObstacle[],
        pos: Vec2,
        dir: Vec2,
        len: number,
        height: number,
        layer: number,
        hackStairs: boolean,
    ): number {
        let dist = len;
        const end = v2.add(pos, v2.mul(dir, len));
        for (const o of list) {
            if (o.dead || !o.def.collidable || o.def.isWindow || o.def.height < height) continue;
            if (!sameLayer(o.layer, layer) || (hackStairs && layer & 2 && o.layer === 0)) continue;
            const hit = collider.intersectSegment(o.col, pos, end);
            if (hit) dist = Math.min(dist, v2.length(v2.sub(hit.point, pos)));
        }
        return dist;
    }

    /**
     * Whether a viewer at `pos` sees into `col` (survev collisionHelpers.scanCollider): inside it, or one of
     * `rayCount` rays spread over `scanWidth` across the direction to it (the spread itself stopped by walls) reaches
     * it within `scanDist` before any wall.
     */
    scanCollider(
        col: Collider,
        pos: Vec2,
        layer: number,
        height: number,
        scanWidth: number,
        scanDist: number,
        rayCount: number,
    ): boolean {
        // cheap reject first: most regions in view are farther than the scan distance
        if (collider.distance(col, { type: 0, pos, rad: 0 }) >= scanDist) return false;
        const toCol = intersectCircle(col, pos, scanDist);
        if (!toCol) return false;
        if (toCol.pen >= scanDist) return true;
        // only obstacles that can cut a ray matter
        const reach = scanDist + scanWidth;
        const list = this.obstacles().filter(
            (o) =>
                o.box.max.x >= pos.x - reach &&
                o.box.min.x <= pos.x + reach &&
                o.box.max.y >= pos.y - reach &&
                o.box.min.y <= pos.y + reach,
        );
        const perp = v2.perp(toCol.dir);
        const half = scanWidth * 0.5;
        const startDir = v2.neg(perp);
        const scanStart = v2.add(pos, v2.mul(startDir, this.segmentDist(list, pos, startDir, half, 0, layer, false)));
        const scanEnd = v2.add(pos, v2.mul(perp, this.segmentDist(list, pos, perp, half, 0, layer, false)));
        let scanDir = v2.sub(scanEnd, scanStart);
        const scanLen = v2.length(scanDir);
        scanDir = scanLen > 0.0001 ? v2.div(scanDir, scanLen) : v2.create(1, 0);
        for (let i = 0; i < rayCount; i++) {
            const rayPos = v2.add(scanStart, v2.mul(scanDir, (scanLen * i) / Math.max(rayCount - 1, 1)));
            const res = intersectCircle(col, rayPos, scanDist);
            if (!res) continue;
            const rayDir = v2.neg(res.dir);
            const maxDist = this.segmentDist(list, rayPos, rayDir, scanDist, height, layer, true);
            const hit = collider.intersectSegment(col, rayPos, v2.add(rayPos, v2.mul(rayDir, scanDist)));
            if (hit && v2.length(v2.sub(hit.point, rayPos)) <= maxDist) return true;
        }
        return false;
    }
}

/** survev river.ts distanceToShore: water half width minus the distance to the river's spline */
function riverDistanceToShore(river: River, pos: Vec2): number {
    const t = river.spline.getClosestT(pos);
    const dist = v2.length(v2.sub(pos, river.spline.getPos(t)));
    return Math.max(river.waterWidth - dist, 0);
}
