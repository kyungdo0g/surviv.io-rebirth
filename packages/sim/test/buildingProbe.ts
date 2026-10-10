// Building probe (the owner's rebirth buildings rework, 2026-10-10): walks a building with player-sized circles through
// the sim's own colliders and counts what it holds. A building is generated alone (mapgen showcase.ts) and probed on a
// 0.25-unit grid per floor: where a player (radius 1, GameConfig.player.radius) can stand, what it reaches from outside
// (ground) or from the stairs (basement) with every ordinary door passable, what only a squeeze reaches (cells a
// radius-1.3 circle, a 2.6-unit passage, never comes within 0.75 of), the gaps between two obstacles that a player can
// barely pass or not pass at all, the pockets nobody can enter, the loot (containers, floor spawners, expected guns from
// the map's loot table) and every interaction with what opening it adds.
import { type Bounds, type Collider, collider } from "@rebirth/core";
import {
    GameConfig,
    GameObjectDefs,
    getMapDef,
    getMapObjectDef,
    hasMapObjectDef,
    type LootSpawnDef,
    type LootTableEntry,
} from "@rebirth/defs";
import { Game, type Obstacle, sameLayer } from "../src/index.ts";
import { generateShowcase } from "../src/mapgen/showcase.ts";

const STEP = 0.25;
const isGun = (id: string) => Object.hasOwn(GameObjectDefs, id) && GameObjectDefs[id].type === "gun";
const PLAYER_RAD = GameConfig.player.radius;
/** a passage at least this wide is comfortable (the owner's rework: about 2.6 or more, 3 on main routes) */
export const COMFORT_GAP = 2.6;
/** gaps closer than this are flush (props against walls), not passages */
const FLUSH_GAP = 0.3;

/** Positions are in the building's own frame (the showcase places it at ori 0). */
export interface ProbeGap {
    a: string;
    b: string;
    /** clear width between the two colliders */
    width: number;
    x: number;
    y: number;
    layer: number;
}

export interface ProbePocket {
    layer: number;
    area: number;
    min: { x: number; y: number };
    max: { x: number; y: number };
}

export interface ProbeUnlock {
    /** what opens it: the door type and how it opens (locked, a button's or puzzle's, a delayed vault door) */
    door: string;
    how: string;
    /** floor area only reachable through it (u²) */
    area: number;
    containers: number;
    guns: number;
}

export interface ProbeLayer {
    layer: number;
    /** floor area a player can stand on inside the building, reached from the entrance (u²) */
    walkable: number;
    /** of which only reached through passages narrower than COMFORT_GAP */
    cramped: number;
    /** free floor no player reaches, every interaction done (pockets behind props, closed rooms), u² */
    unreachable: number;
    pockets: ProbePocket[];
    /** clusters of cramped floor of 1 u² or more (where a squeeze is) */
    crampedAt: ProbePocket[];
    /** true when a basement's flood leaks out of the building's bounds */
    leaks: boolean;
}

export interface ProbeResult {
    type: string;
    mapName: string;
    width: number;
    height: number;
    layers: ProbeLayer[];
    /** gaps a player squeezes through (2..COMFORT_GAP) and gaps nobody passes (FLUSH_GAP..2) */
    squeezes: ProbeGap[];
    blocked: ProbeGap[];
    containers: number;
    floorSpots: number;
    /** expected guns from every container and floor spawner, plus those behind interactions */
    guns: number;
    buttons: { type: string; target: string }[];
    unlocks: ProbeUnlock[];
}

type Tables = Readonly<Record<string, readonly LootTableEntry[]>>;

/** Expected guns of one roll of `tier` (nested tiers followed). */
function tierGuns(tables: Tables, tier: string, memo: Map<string, number>, depth = 0): number {
    const known = memo.get(tier);
    if (known !== undefined) return known;
    const table = Object.hasOwn(tables, tier) ? tables[tier] : undefined;
    if (!table || depth > 16) return 0;
    let total = 0;
    let guns = 0;
    for (const e of table) {
        if (!(e.weight > 0)) continue;
        total += e.weight;
        if (!e.name) continue;
        if (e.name.startsWith("tier_")) guns += e.weight * tierGuns(tables, e.name, memo, depth + 1);
        else if (isGun(e.name)) guns += e.weight;
    }
    const out = total > 0 ? guns / total : 0;
    memo.set(tier, out);
    return out;
}

/** Expected guns of a loot list (tier rolls randomInt(min, max) times; autoloot guns count once). */
export function lootGuns(tables: Tables, list: readonly LootSpawnDef[], memo = new Map<string, number>()): number {
    let n = 0;
    for (const e of list) {
        if (e.tier) n += (((e.min ?? 1) + (e.max ?? e.min ?? 1)) / 2) * tierGuns(tables, e.tier, memo);
        else if (e.type && isGun(e.type)) n += 1;
    }
    return n;
}

const hasTierLoot = (list: readonly LootSpawnDef[] | undefined) => !!list?.some((e) => e.tier || e.type);

interface Grid {
    x0: number;
    y0: number;
    nx: number;
    ny: number;
}

const cellPos = (g: Grid, i: number) => ({ x: g.x0 + (i % g.nx) * STEP, y: g.y0 + Math.floor(i / g.nx) * STEP });
const inBounds = (b: Bounds, p: { x: number; y: number }) =>
    p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;

/** Cells where a circle of `rad` touches none of `cols`. */
function freeMask(g: Grid, cols: readonly Collider[], rad: number): Uint8Array {
    const free = new Uint8Array(g.nx * g.ny).fill(1);
    for (const c of cols) {
        const bb = collider.toAabb(c);
        const ix0 = Math.max(0, Math.floor((bb.min.x - rad - g.x0) / STEP));
        const ix1 = Math.min(g.nx - 1, Math.ceil((bb.max.x + rad - g.x0) / STEP));
        const iy0 = Math.max(0, Math.floor((bb.min.y - rad - g.y0) / STEP));
        const iy1 = Math.min(g.ny - 1, Math.ceil((bb.max.y + rad - g.y0) / STEP));
        for (let iy = iy0; iy <= iy1; iy++) {
            for (let ix = ix0; ix <= ix1; ix++) {
                const i = iy * g.nx + ix;
                if (!free[i]) continue;
                const p = { x: g.x0 + ix * STEP, y: g.y0 + iy * STEP };
                if (collider.distance({ type: 0, pos: p, rad }, c) < 0) free[i] = 0;
            }
        }
    }
    return free;
}

/** Cells reached from `seeds` over free cells (4-neighbour). */
function flood(g: Grid, free: Uint8Array, seeds: readonly number[]): Uint8Array {
    const seen = new Uint8Array(free.length);
    const stack: number[] = [];
    for (const s of seeds) {
        if (free[s] && !seen[s]) {
            seen[s] = 1;
            stack.push(s);
        }
    }
    while (stack.length) {
        const i = stack.pop() as number;
        const ix = i % g.nx;
        const next = [ix > 0 ? i - 1 : -1, ix < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx];
        for (const j of next) {
            if (j < 0 || j >= free.length || seen[j] || !free[j]) continue;
            seen[j] = 1;
            stack.push(j);
        }
    }
    return seen;
}

/**
 * `mask` grown by 0.75 (three cells, a disk): a cell whose nearest wide-probe cell is 0.3 away on the continuous floor
 * (0.42 in a corner) can be 0.5 or more from one on the grid; narrow passages longer than that stay cramped, and the
 * gap list names the short ones.
 */
function dilate(g: Grid, mask: Uint8Array): Uint8Array {
    const out = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        const ix = i % g.nx;
        for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                if (dx * dx + dy * dy > 9 || ix + dx < 0 || ix + dx >= g.nx) continue;
                const j = i + dy * g.nx + dx;
                if (j >= 0 && j < mask.length) out[j] = 1;
            }
        }
    }
    return out;
}

/** Whether an obstacle is a door that only a lock, a button, a puzzle or a delay opens. */
function specialDoor(o: Obstacle): string | null {
    const d = o.door;
    if (!d) return null;
    if (d.locked) return "locked";
    if (!d.canUse) return "button or puzzle";
    if (d.openDelay >= 1) return `opens ${d.openDelay} s after Interact`;
    return null;
}

/**
 * Probes one building or structure type, alone on a showcase map; `breakWalls` walks it with every breakable wall
 * (a destructible wall obstacle) already broken.
 */
export function probeBuilding(type: string, opts: { breakWalls?: boolean } = {}): ProbeResult {
    const show = generateShowcase(type);
    const game = new Game(
        { mapName: show.mapName, seed: 1 },
        { generation: show.generation, spawnLoot: false, sandbox: true },
    );
    const tables: Tables = getMapDef(show.mapName).lootTable;
    const memo = new Map<string, number>();
    const b = show.bounds;
    const origin = show.object.pos;
    const margin = 4;
    const g: Grid = {
        x0: Math.floor(b.min.x - margin),
        y0: Math.floor(b.min.y - margin),
        nx: Math.ceil((b.max.x - b.min.x + 2 * margin) / STEP) + 1,
        ny: Math.ceil((b.max.y - b.min.y + 2 * margin) / STEP) + 1,
    };
    const region: Bounds = {
        min: { x: g.x0, y: g.y0 },
        max: { x: g.x0 + g.nx * STEP, y: g.y0 + g.ny * STEP },
    };
    const obstacles: Obstacle[] = [];
    const stairs: Bounds[] = [];
    const basementFloors: Collider[] = [];
    for (const obj of game.world.query(region, [])) {
        if (obj.kind === "obstacle" && obj.collidable && !obj.dead) {
            if (opts.breakWalls && obj.isWall && obj.def.destructible) continue;
            obstacles.push(obj);
        }
        if (obj.kind === "structure") for (const s of obj.stairs) stairs.push(s.collision);
        if (obj.kind === "building" && obj.layer === 1)
            for (const sf of obj.surfaces) basementFloors.push(...sf.colliders);
    }
    const layers = [...new Set([0, ...(stairs.length ? [1] : [])])];
    const outsideSeed = [0, g.nx - 1, g.nx * (g.ny - 1)];

    // loot of the building: containers (obstacles with loot) and floor spawners
    const containers = obstacles.filter((o) => !o.isWall && !o.door && hasTierLoot(o.def.loot));
    const spots = show.generation.lootSpawns.filter((s) => inBounds(b, s.pos));
    const containerGuns = (o: Obstacle) => lootGuns(tables, o.def.loot ?? [], memo);
    const spotGuns = (type: string) =>
        hasMapObjectDef(type)
            ? lootGuns(tables, (getMapObjectDef(type) as { loot?: LootSpawnDef[] }).loot ?? [], memo)
            : 0;
    const guns = containers.reduce((n, o) => n + containerGuns(o), 0) + spots.reduce((n, s) => n + spotGuns(s.type), 0);

    const result: ProbeResult = {
        type,
        mapName: show.mapName,
        width: Math.round(b.max.x - b.min.x),
        height: Math.round(b.max.y - b.min.y),
        layers: [],
        squeezes: [],
        blocked: [],
        containers: containers.length,
        floorSpots: spots.length,
        guns: Math.round(guns * 100) / 100,
        buttons: [],
        unlocks: [],
    };

    for (const layer of layers) {
        // the ground floor is the building's bounds, a basement its floors
        const insideIdx = (i: number) => {
            const p = cellPos(g, i);
            if (layer === 0) return inBounds(b, p);
            return basementFloors.some((c) => collider.distance({ type: 0, pos: p, rad: 0 }, c) <= 0);
        };
        const onLayer = obstacles.filter((o) => sameLayer(o.layer, layer));
        // ordinary doors are passable; special doors block until their interaction
        const blocking = (open: ReadonlySet<Obstacle>) =>
            onLayer.filter((o) => !o.door || (specialDoor(o) !== null && !open.has(o))).map((o) => o.collider);
        const seedsFor = (free: Uint8Array) => {
            if (layer === 0) return outsideSeed;
            const out: number[] = [];
            for (let i = 0; i < free.length; i++) if (stairs.some((s) => inBounds(s, cellPos(g, i)))) out.push(i);
            return out;
        };
        const none = new Set<Obstacle>();
        const free = freeMask(g, blocking(none), PLAYER_RAD);
        const reach = flood(g, free, seedsFor(free));
        const allSpecial = new Set(onLayer.filter((o) => specialDoor(o) !== null));
        const freeAll = freeMask(g, blocking(allSpecial), PLAYER_RAD);
        const reachAll = flood(g, freeAll, seedsFor(freeAll));
        const freeWide = freeMask(g, blocking(none), COMFORT_GAP / 2);
        const reachWide = dilate(g, flood(g, freeWide, seedsFor(freeWide)));
        let walkable = 0;
        let cramped = 0;
        let unreachable = 0;
        let leaks = false;
        const lost = new Uint8Array(free.length);
        const tight = new Uint8Array(free.length);
        for (let i = 0; i < free.length; i++) {
            if (layer === 1 && reach[i] && !insideIdx(i)) leaks = true;
            if (!insideIdx(i) || !freeAll[i]) continue;
            if (reach[i]) {
                walkable++;
                if (!reachWide[i]) {
                    cramped++;
                    tight[i] = 1;
                }
            } else if (!reachAll[i]) {
                unreachable++;
                lost[i] = 1;
            }
        }
        // pockets (connected unreached free cells) and cramped clusters
        const clusters = (mask: Uint8Array, minArea: number): ProbePocket[] => {
            const out: ProbePocket[] = [];
            const done = new Uint8Array(mask.length);
            for (let i = 0; i < mask.length; i++) {
                if (!mask[i] || done[i]) continue;
                const comp = flood(g, mask, [i]);
                let n = 0;
                const min = { x: Infinity, y: Infinity };
                const max = { x: -Infinity, y: -Infinity };
                for (let j = 0; j < comp.length; j++) {
                    if (!comp[j]) continue;
                    done[j] = 1;
                    n++;
                    const p = cellPos(g, j);
                    min.x = Math.min(min.x, p.x - origin.x);
                    min.y = Math.min(min.y, p.y - origin.y);
                    max.x = Math.max(max.x, p.x - origin.x);
                    max.y = Math.max(max.y, p.y - origin.y);
                }
                const area = n * STEP * STEP;
                if (area >= minArea) out.push({ layer, area, min, max });
            }
            return out;
        };
        const pockets = clusters(lost, 0.5);
        const crampedAt = clusters(tight, 1);
        const a = STEP * STEP;
        result.layers.push({
            layer,
            walkable: walkable * a,
            cramped: cramped * a,
            unreachable: unreachable * a,
            pockets,
            crampedAt,
            leaks,
        });

        // gaps between two obstacles (doors excluded: they fill their own doorways)
        const solid = onLayer.filter((o) => !o.door);
        for (let i = 0; i < solid.length; i++) {
            for (let j = i + 1; j < solid.length; j++) {
                const d = collider.distance(solid[i].collider, solid[j].collider);
                if (d < FLUSH_GAP || d >= COMFORT_GAP) continue;
                const ca = collider.toAabb(solid[i].collider);
                const cb = collider.toAabb(solid[j].collider);
                const x = (Math.max(ca.min.x, cb.min.x) + Math.min(ca.max.x, cb.max.x)) / 2;
                const y = (Math.max(ca.min.y, cb.min.y) + Math.min(ca.max.y, cb.max.y)) / 2;
                if (!inBounds(b, { x, y })) continue;
                // an opening, not two things on either side of a wall: open floor at the midpoint, and a squeeze lies on
                // the walkable floor
                const mid = { type: 0 as const, pos: { x, y }, rad: Math.max(0.05, Math.min(d / 2, PLAYER_RAD) - 0.1) };
                if (onLayer.some((o) => o !== solid[i] && o !== solid[j] && collider.distance(mid, o.collider) < 0))
                    continue;
                const mi = Math.round((y - g.y0) / STEP) * g.nx + Math.round((x - g.x0) / STEP);
                if (d >= 2 * PLAYER_RAD && !reach[mi]) continue;
                const gap = {
                    a: solid[i].type,
                    b: solid[j].type,
                    width: Math.round(d * 100) / 100,
                    x: x - origin.x,
                    y: y - origin.y,
                    layer,
                };
                (d >= 2 * PLAYER_RAD ? result.squeezes : result.blocked).push(gap);
            }
        }

        // what each special door (by type) adds when it opens
        const groups = new Map<string, Obstacle[]>();
        for (const o of onLayer) {
            const how = specialDoor(o);
            if (how) groups.set(`${o.type}|${how}`, [...(groups.get(`${o.type}|${how}`) ?? []), o]);
        }
        for (const [key, doors] of groups) {
            const [door, how] = key.split("|");
            const freeOpen = freeMask(g, blocking(new Set(doors)), PLAYER_RAD);
            const reachOpen = flood(g, freeOpen, seedsFor(freeOpen));
            let n = 0;
            // a container or spawner counts when a cell reachable only now lies within a player's reach of it
            const added = (box: Bounds) => {
                const r = PLAYER_RAD + 0.5;
                const ix0 = Math.max(0, Math.floor((box.min.x - r - g.x0) / STEP));
                const ix1 = Math.min(g.nx - 1, Math.ceil((box.max.x + r - g.x0) / STEP));
                const iy0 = Math.max(0, Math.floor((box.min.y - r - g.y0) / STEP));
                const iy1 = Math.min(g.ny - 1, Math.ceil((box.max.y + r - g.y0) / STEP));
                for (let iy = iy0; iy <= iy1; iy++) {
                    for (let ix = ix0; ix <= ix1; ix++) {
                        const m = iy * g.nx + ix;
                        if (reachOpen[m] && !reach[m]) return true;
                    }
                }
                return false;
            };
            const pointBox = (p: { x: number; y: number }): Bounds => ({ min: p, max: p });
            for (let i = 0; i < reachOpen.length; i++) if (reachOpen[i] && !reach[i] && insideIdx(i)) n++;
            const inside = containers.filter((o) => sameLayer(o.layer, layer) && added(collider.toAabb(o.collider)));
            const spotIn = spots.filter((s) => sameLayer(s.layer, layer) && added(pointBox(s.pos)));
            result.unlocks.push({
                door,
                how,
                area: n * a,
                containers: inside.length + spotIn.length,
                guns:
                    Math.round(
                        (inside.reduce((s, o) => s + containerGuns(o), 0) +
                            spotIn.reduce((s, sp) => s + spotGuns(sp.type), 0)) *
                            100,
                    ) / 100,
            });
        }
    }
    for (const o of obstacles) {
        const btn = o.def.button;
        if (btn) result.buttons.push({ type: o.type, target: btn.useType ? `${btn.useType}` : "(none)" });
    }
    return result;
}

/** Debug: an ASCII map of one floor (`#` blocked, `.` walkable, `c` cramped, `x` unreachable), for tools. */
export function probeMap(type: string, layer = 0): string {
    const show = generateShowcase(type);
    const game = new Game(
        { mapName: show.mapName, seed: 1 },
        { generation: show.generation, spawnLoot: false, sandbox: true },
    );
    const b = show.bounds;
    const g: Grid = {
        x0: Math.floor(b.min.x - 2),
        y0: Math.floor(b.min.y - 2),
        nx: Math.ceil((b.max.x - b.min.x + 4) / STEP) + 1,
        ny: Math.ceil((b.max.y - b.min.y + 4) / STEP) + 1,
    };
    const region: Bounds = { min: { x: g.x0, y: g.y0 }, max: { x: g.x0 + g.nx * STEP, y: g.y0 + g.ny * STEP } };
    const cols: Collider[] = [];
    for (const o of game.world.query(region, [])) {
        if (
            o.kind === "obstacle" &&
            o.collidable &&
            !o.dead &&
            sameLayer(o.layer, layer) &&
            (!o.door || specialDoor(o))
        )
            cols.push(o.collider);
    }
    const free = freeMask(g, cols, PLAYER_RAD);
    const reach = flood(g, free, [0]);
    const wide = dilate(g, flood(g, freeMask(g, cols, COMFORT_GAP / 2), [0]));
    const rows: string[] = [];
    for (let iy = g.ny - 1; iy >= 0; iy -= 2) {
        let row = "";
        for (let ix = 0; ix < g.nx; ix += 2) {
            const i = iy * g.nx + ix;
            row += !free[i] ? "#" : !reach[i] ? "x" : !wide[i] ? "c" : ".";
        }
        rows.push(row);
    }
    return rows.join("\n");
}
