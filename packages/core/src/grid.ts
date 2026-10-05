import type { Bounds } from "./collider.ts";
import type { Vec2 } from "./v2.ts";

interface GridEntry<T> {
    obj: T;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    // Inclusive cell range the entry is registered in.
    cellX0: number;
    cellY0: number;
    cellX1: number;
    cellY1: number;
    /** Last query that visited this entry; dedupes objects spanning several cells. */
    stamp: number;
}

/**
 * Uniform spatial hash grid for broadphase queries. Objects are keyed by `id`
 * and may span many cells; anything outside the grid area is clamped into the
 * border cells, so queries stay exact everywhere.
 */
export class Grid<T extends { id: number }> {
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;
    readonly cols: number;
    readonly rows: number;

    private readonly cells: GridEntry<T>[][];
    private readonly entries = new Map<number, GridEntry<T>>();
    private queryStamp = 0;

    constructor(width: number, height: number, cellSize = 16) {
        if (!(cellSize > 0)) {
            throw new RangeError(`Grid: cellSize must be positive, got ${cellSize}`);
        }
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.max(1, Math.ceil(width / cellSize));
        this.rows = Math.max(1, Math.ceil(height / cellSize));
        this.cells = Array.from({ length: this.cols * this.rows }, () => []);
    }

    get size(): number {
        return this.entries.size;
    }

    has(obj: T): boolean {
        return this.entries.has(obj.id);
    }

    /** Adds an object with the given bounds; throws if its id is already present. */
    insert(obj: T, aabb: Bounds): void {
        if (this.entries.has(obj.id)) {
            throw new Error(`Grid.insert: object ${obj.id} is already in the grid`);
        }
        const entry: GridEntry<T> = {
            obj,
            minX: 0,
            minY: 0,
            maxX: 0,
            maxY: 0,
            cellX0: 0,
            cellY0: 0,
            cellX1: -1,
            cellY1: -1,
            stamp: 0,
        };
        this.entries.set(obj.id, entry);
        this.setBounds(entry, aabb);
        this.addToCells(entry);
    }

    /** Moves an object to new bounds, inserting it if absent. */
    update(obj: T, aabb: Bounds): void {
        const entry = this.entries.get(obj.id);
        if (!entry) {
            this.insert(obj, aabb);
            return;
        }
        entry.obj = obj;
        this.setBounds(entry, aabb);
        const x0 = this.cellX(aabb.min.x);
        const y0 = this.cellY(aabb.min.y);
        const x1 = this.cellX(aabb.max.x);
        const y1 = this.cellY(aabb.max.y);
        if (x0 === entry.cellX0 && y0 === entry.cellY0 && x1 === entry.cellX1 && y1 === entry.cellY1) {
            return;
        }
        this.removeFromCells(entry);
        this.addToCells(entry);
    }

    /** Removes an object; returns false if it was not present. */
    remove(obj: T): boolean {
        const entry = this.entries.get(obj.id);
        if (!entry) {
            return false;
        }
        this.removeFromCells(entry);
        this.entries.delete(obj.id);
        return true;
    }

    clear(): void {
        for (const cell of this.cells) {
            cell.length = 0;
        }
        this.entries.clear();
    }

    /**
     * Every object whose bounds overlap or touch `aabb`, each exactly once.
     * `out` is cleared first, so a scratch array can be reused across calls.
     */
    query(aabb: Bounds, out: T[] = []): T[] {
        return this.collect(aabb.min.x, aabb.min.y, aabb.max.x, aabb.max.y, out);
    }

    /** Every object whose bounds contain `point` (boundary inclusive). */
    queryPoint(point: Vec2, out: T[] = []): T[] {
        return this.collect(point.x, point.y, point.x, point.y, out);
    }

    private collect(minX: number, minY: number, maxX: number, maxY: number, out: T[]): T[] {
        out.length = 0;
        const stamp = ++this.queryStamp;
        const x0 = this.cellX(minX);
        const y0 = this.cellY(minY);
        const x1 = this.cellX(maxX);
        const y1 = this.cellY(maxY);
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                for (const entry of this.cells[cy * this.cols + cx]) {
                    if (entry.stamp === stamp) {
                        continue;
                    }
                    entry.stamp = stamp;
                    if (entry.minX <= maxX && minX <= entry.maxX && entry.minY <= maxY && minY <= entry.maxY) {
                        out.push(entry.obj);
                    }
                }
            }
        }
        return out;
    }

    private setBounds(entry: GridEntry<T>, aabb: Bounds): void {
        entry.minX = aabb.min.x;
        entry.minY = aabb.min.y;
        entry.maxX = aabb.max.x;
        entry.maxY = aabb.max.y;
    }

    private addToCells(entry: GridEntry<T>): void {
        entry.cellX0 = this.cellX(entry.minX);
        entry.cellY0 = this.cellY(entry.minY);
        entry.cellX1 = this.cellX(entry.maxX);
        entry.cellY1 = this.cellY(entry.maxY);
        for (let cy = entry.cellY0; cy <= entry.cellY1; cy++) {
            for (let cx = entry.cellX0; cx <= entry.cellX1; cx++) {
                this.cells[cy * this.cols + cx].push(entry);
            }
        }
    }

    private removeFromCells(entry: GridEntry<T>): void {
        for (let cy = entry.cellY0; cy <= entry.cellY1; cy++) {
            for (let cx = entry.cellX0; cx <= entry.cellX1; cx++) {
                const cell = this.cells[cy * this.cols + cx];
                const idx = cell.indexOf(entry);
                if (idx >= 0) {
                    // Swap-remove: cell order carries no meaning.
                    cell[idx] = cell[cell.length - 1];
                    cell.pop();
                }
            }
        }
    }

    /** Column index for a world x, clamped into the grid (NaN maps to 0). */
    private cellX(x: number): number {
        const c = Math.floor(x / this.cellSize);
        return c > 0 ? (c < this.cols ? c : this.cols - 1) : 0;
    }

    private cellY(y: number): number {
        const c = Math.floor(y / this.cellSize);
        return c > 0 ? (c < this.rows ? c : this.rows - 1) : 0;
    }
}
