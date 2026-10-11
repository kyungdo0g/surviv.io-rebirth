// A* over a CellGrid (the ground NavGrid or an underground grid): 8-connected without corner cutting, octile heuristic (slightly weighted for speed), terrain and
// door costs, a node budget (returns the partial path to the node closest to the goal when it runs out), then string
// pulling over grid line of sight. Scratch arrays are shared per grid (searches never run concurrently).
import { type Vec2, v2 } from "@rebirth/core";
import { BREAK_BITS, BREAK_STEP, breakableCell, CROSS_EXPAND, HURRY_BREAK_STEP } from "./breakThrough.ts";
import type { CellGrid } from "./cellGrid.ts";

export interface PathResult {
    /** waypoints after smoothing, the goal last (the start is not included) */
    points: Vec2[];
    /** the goal was reached (false: partial path towards it) */
    complete: boolean;
    /** nodes expanded */
    expanded: number;
}

export interface PathOptions {
    /** node budget (default 12000, ~5 ms; a partial path leads towards the goal and the next plan continues) */
    maxExpand?: number;
    /** heuristic weight (default 1.3) */
    weight?: number;
    /** skip line-of-sight smoothing */
    raw?: boolean;
    /** walkable cell to start from (default: the start's own cell when tight, else the nearest walkable cell) */
    startCell?: number;
    /**
     * break classes the bot breaks through (nav/breakThrough.ts): cells blocked only by such obstacles are crossed at
     * BREAK_STEP more per cell, and a goal behind them (another component) is searched for with CROSS_EXPAND nodes
     */
    breakMask?: number;
}

const SQRT2 = Math.SQRT2;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

class Scratch {
    readonly g: Float32Array;
    readonly parent: Int32Array;
    readonly seen: Uint32Array;
    readonly closed: Uint32Array;
    gen = 0;
    heapIdx: Int32Array = new Int32Array(1024);
    heapF: Float32Array = new Float32Array(1024);
    size = 0;

    constructor(n: number) {
        this.g = new Float32Array(n);
        this.parent = new Int32Array(n);
        this.seen = new Uint32Array(n);
        this.closed = new Uint32Array(n);
    }

    push(idx: number, f: number): void {
        if (this.size >= this.heapIdx.length) {
            const ni = new Int32Array(this.heapIdx.length * 2);
            ni.set(this.heapIdx);
            const nf = new Float32Array(this.heapF.length * 2);
            nf.set(this.heapF);
            this.heapIdx = ni;
            this.heapF = nf;
        }
        let i = this.size++;
        const hi = this.heapIdx;
        const hf = this.heapF;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (hf[p] <= f) break;
            hi[i] = hi[p];
            hf[i] = hf[p];
            i = p;
        }
        hi[i] = idx;
        hf[i] = f;
    }

    pop(): number {
        const hi = this.heapIdx;
        const hf = this.heapF;
        const top = hi[0];
        const n = --this.size;
        if (n > 0) {
            const idx = hi[n];
            const f = hf[n];
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                if (l >= n) break;
                const r = l + 1;
                const c = r < n && hf[r] < hf[l] ? r : l;
                if (hf[c] >= f) break;
                hi[i] = hi[c];
                hf[i] = hf[c];
                i = c;
            }
            hi[i] = idx;
            hf[i] = f;
        }
        return top;
    }
}

const scratches = new WeakMap<CellGrid, Scratch>();

function scratchFor(grid: CellGrid): Scratch {
    let s = scratches.get(grid);
    if (!s) {
        s = new Scratch(grid.w * grid.h);
        scratches.set(grid, s);
    }
    s.gen++;
    if (s.gen >= 0xfffffff0) {
        s.seen.fill(0);
        s.closed.fill(0);
        s.gen = 1;
    }
    s.size = 0;
    return s;
}

function octile(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return dx > dy ? dx + (SQRT2 - 1) * dy : dy + (SQRT2 - 1) * dx;
}

/**
 * Path from `start` to `goal`, or null when no walkable cell near the start, or no cell near the goal in the start's
 * connected component, exists (an enclosed vault, an outhouse too narrow to enter): the goal snaps to the closest cell
 * the bot can actually reach, so hopeless searches never burn the node budget. Tight cells (CellGrid.tight) are
 * passable at a higher cost.
 */
export function findPath(grid: CellGrid, start: Vec2, goal: Vec2, opts: PathOptions = {}): PathResult | null {
    // a bot squeezing through a tight cell starts there (the nearest free cell may lie behind the wall it touches)
    const own = grid.cellOf(start);
    const s = opts.startCell ?? (grid.covers(start) && grid.tight[own] !== 0 ? own : grid.nearestWalkable(start, 4));
    if (s < 0) return null;
    const mask = opts.breakMask ?? 0;
    let t = grid.nearestWalkable(goal, 6, grid.component(s));
    let maxExpand = opts.maxExpand ?? 12000;
    if (mask) {
        // a goal behind a breakable obstacle lies in another component: searched for, on a smaller budget
        const any = grid.nearestWalkable(goal, 6);
        if (any >= 0 && any !== t && grid.component(any) !== grid.component(s)) {
            t = any;
            maxExpand = Math.min(maxExpand, CROSS_EXPAND);
        }
    }
    if (t < 0) return null;
    const open = (i: number) => grid.passable(i) || (mask !== 0 && breakableCell(grid, i, mask));
    const weight = opts.weight ?? 1.3;
    const w = grid.w;
    const sc = scratchFor(grid);
    const gen = sc.gen;
    const tx = t % w;
    const ty = Math.floor(t / w);
    sc.g[s] = 0;
    sc.parent[s] = -1;
    sc.seen[s] = gen;
    sc.push(s, octile(s % w, Math.floor(s / w), tx, ty) * weight);
    let best = s;
    let bestH = Number.POSITIVE_INFINITY;
    let expanded = 0;
    let found = false;
    while (sc.size > 0) {
        const cur = sc.pop();
        if (sc.closed[cur] === gen) continue;
        sc.closed[cur] = gen;
        if (cur === t) {
            found = true;
            break;
        }
        const cx = cur % w;
        const cy = (cur - cx) / w;
        const h = octile(cx, cy, tx, ty);
        if (h < bestH) {
            bestH = h;
            best = cur;
        }
        if (++expanded > maxExpand) break;
        const gCur = sc.g[cur];
        for (let k = 0; k < 8; k++) {
            const nx = cx + DX[k];
            const ny = cy + DY[k];
            if (nx < 0 || ny < 0 || nx >= w || ny >= grid.h) continue;
            const ni = ny * w + nx;
            if (sc.closed[ni] === gen) continue;
            let extra = 0;
            if (grid.blocked[ni] !== 0 && grid.tight[ni] === 0) {
                if (mask === 0 || !breakableCell(grid, ni, mask)) continue;
                // (in a hurry, BREAK_BITS.Hurry: only where there is no reasonable way round)
                extra = mask & BREAK_BITS.Hurry ? HURRY_BREAK_STEP : BREAK_STEP;
            }
            let step = 1;
            if (k >= 4) {
                // no corner cutting: both orthogonal neighbours must be free
                if (!open(cy * w + nx) || !open(ny * w + cx)) continue;
                step = SQRT2;
            }
            if ((grid.oneWay[ni] !== 0 || grid.oneWay[cur] !== 0) && !grid.oneWayAllows(cur, ni)) continue;
            const g = gCur + step * (grid.cost(ni) + extra);
            if (sc.seen[ni] === gen && g >= sc.g[ni]) continue;
            sc.seen[ni] = gen;
            sc.g[ni] = g;
            sc.parent[ni] = cur;
            sc.push(ni, g + octile(nx, ny, tx, ty) * weight);
        }
    }
    const end = found ? t : best;
    const cells: number[] = [];
    for (let c = end; c !== -1; c = sc.parent[c]) {
        cells.push(c);
        if (c === s) break;
    }
    cells.reverse();
    let points = cells.map((c) => grid.center(c));
    if (found && t === grid.cellOf(goal)) points[points.length - 1] = v2.copy(goal);
    if (!opts.raw) points = smoothPath(grid, start, points);
    else points = points.slice(1);
    return { points, complete: found, expanded };
}

/**
 * String pulling: from each anchor, jump to the farthest following point still in line of sight. The start itself
 * is the first anchor and is not returned.
 */
export function smoothPath(grid: CellGrid, start: Vec2, points: readonly Vec2[]): Vec2[] {
    const out: Vec2[] = [];
    if (points.length === 0) return out;
    let anchor = start;
    let i = 0;
    while (i < points.length) {
        // farthest point still in line of sight: gallop forward, then bisect (line of sight is nearly monotonic)
        const limit = Math.min(points.length - 1, i + 120);
        let lo = i;
        let hi = -1;
        let step = 1;
        while (lo < limit) {
            const k = Math.min(limit, lo + step);
            if (!grid.lineWalkable(anchor, points[k])) {
                hi = k;
                break;
            }
            lo = k;
            step *= 2;
        }
        while (hi > lo + 1) {
            const mid = (lo + hi) >> 1;
            if (grid.lineWalkable(anchor, points[mid])) lo = mid;
            else hi = mid;
        }
        const j = lo;
        out.push(points[j]);
        anchor = points[j];
        i = j + 1;
    }
    return out;
}
