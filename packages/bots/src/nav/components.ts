// Connected components of a CellGrid's passable cells (free or tight), with the moves of A*: 8-connected steps without
// corner cutting connect exactly what 4-connectivity connects. A full labelling is a two-pass union-find over rows
// (about 9 ms on the 842 x 842 main map grid); between full labellings the labels follow the grid as cheaply as each
// change allows:
// - an obstacle gone (a crate broken, a door destroyed, a sealed door seen open) frees cells; each pocket of them takes
//   the label of the one component it borders at once, and a pocket bordering two components (the crate blocked the
//   corridor between them) has the grid relabelled at the next query. Removals used to wait like additions, and a bot
//   whose way a broken crate had just opened stood still behind it for 12 s (the crossing bunker's storage room).
//   Breaking all 2536 breakable ground obstacles of main 12345 one by one relabels 23 times (a crate or a wall in a
//   doorway); `joins` counts those, and the path follower plans again for a goal it had given up as cut off;
// - an obstacle added (an open door's panel, an air drop crate) can only cut components apart: the labels keep saying
//   "connected" a little longer (a hint, A* finds out) and are relabelled after STALE_CHANGES of those changes.

/** A freed pocket larger than this relabels the grid instead (a broken crate frees about 50 cells). */
const POCKET_LIMIT = 4096;
/** After this many added obstacles, the labels are relabelled once this many queries came since. */
const STALE_CHANGES = 60;
const STALE_QUERIES = 600;
const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

export class CellLabels {
    /**
     * Component of each passable cell (0 for blocked ones): the union-find root of the last full labelling, or a label
     * given to a freed pocket since (fresh ones above w * h).
     */
    readonly comp: Int32Array;
    /** full labellings so far (diagnostics, tests) */
    relabels = 0;
    /**
     * times components may have grown together (a freed pocket bordering two, soon()): a goal given up as cut off is
     * worth trying again (nav/follower.ts)
     */
    joins = 0;
    private readonly w: number;
    private readonly h: number;
    private readonly blocked: Uint8Array;
    private readonly tight: Uint8Array;
    private fresh: number;
    private changes = 0;
    private queries = 0;
    /** relabel at the next query (a removal joined two components, a sealed door moved) */
    private stale = false;
    private readonly pocket: number[] = [];

    constructor(w: number, h: number, blocked: Uint8Array, tight: Uint8Array) {
        this.w = w;
        this.h = h;
        this.blocked = blocked;
        this.tight = tight;
        this.comp = new Int32Array(w * h);
        this.fresh = w * h + 1;
    }

    private passable(i: number): boolean {
        return this.blocked[i] === 0 || this.tight[i] !== 0;
    }

    /** Labels every passable cell anew. */
    label(): void {
        const { w, h, comp } = this;
        const parent = new Int32Array(w * h + 1);
        let next = 1;
        const find = (a: number): number => {
            while (parent[a] !== a) {
                parent[a] = parent[parent[a]];
                a = parent[a];
            }
            return a;
        };
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (!this.passable(i)) {
                    comp[i] = 0;
                    continue;
                }
                const left = x > 0 ? comp[i - 1] : 0;
                const up = y > 0 ? comp[i - w] : 0;
                if (left === 0 && up === 0) {
                    parent[next] = next;
                    comp[i] = next++;
                } else if (left !== 0 && up !== 0) {
                    const a = find(left);
                    const b = find(up);
                    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
                    comp[i] = Math.min(a, b);
                } else {
                    comp[i] = left || up;
                }
            }
        }
        for (let i = 0; i < w * h; i++) if (comp[i] !== 0) comp[i] = find(comp[i]);
        this.fresh = w * h + 1;
        this.changes = 0;
        this.queries = 0;
        this.stale = false;
        this.relabels++;
    }

    /** Component of a cell (0 when blocked), relabelling first when the labels went stale. */
    of(idx: number): number {
        if (this.stale || (this.changes >= STALE_CHANGES && ++this.queries >= STALE_QUERIES)) this.label();
        return this.passable(idx) ? this.comp[idx] : 0;
    }

    /** Relabel at the next query (something may have joined components: a sealed door moved, a blocker broke). */
    soon(): void {
        this.stale = true;
        this.joins++;
    }

    /** An obstacle was added: components may have been cut apart. */
    added(): void {
        this.changes++;
    }

    /**
     * An obstacle covering the cells x0..x1, y0..y1 is gone: label its freed cells (passable now, blocked at the last
     * labelling) by pockets, each with the label of the one component it borders, a fresh label when it borders none,
     * or relabel at the next query when it borders two.
     */
    freed(x0: number, y0: number, x1: number, y1: number): void {
        // (a relabel is pending: whatever this frees is labelled then, and it may join components too)
        if (this.stale) {
            this.joins++;
            return;
        }
        const { w, h, comp, pocket } = this;
        for (let y = y0; y <= y1 && !this.stale; y++) {
            for (let x = x0; x <= x1 && !this.stale; x++) {
                const i = y * w + x;
                if (comp[i] !== 0 || !this.passable(i)) continue;
                // flood the pocket (marked -1 while flooding), noting the labels around it
                pocket.length = 0;
                pocket.push(i);
                comp[i] = -1;
                let label = 0;
                let joined = false;
                for (let k = 0; k < pocket.length && !joined; k++) {
                    const c = pocket[k];
                    const cx = c % w;
                    const cy = (c - cx) / w;
                    for (let d = 0; d < 4; d++) {
                        const nx = cx + DX[d];
                        const ny = cy + DY[d];
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                        const n = ny * w + nx;
                        if (!this.passable(n)) continue;
                        const l = comp[n];
                        if (l === 0) {
                            comp[n] = -1;
                            pocket.push(n);
                        } else if (l > 0 && l !== label) {
                            if (label !== 0) joined = true;
                            label = l;
                        }
                    }
                    if (pocket.length > POCKET_LIMIT) joined = true;
                }
                const l = joined ? 0 : label || this.fresh++;
                for (const c of pocket) comp[c] = l;
                if (joined) this.soon();
            }
        }
    }

    /** Takes over the labels and clocks of another grid's labels (same size). */
    copyFrom(src: CellLabels): void {
        this.comp.set(src.comp);
        this.relabels = src.relabels;
        this.joins = src.joins;
        this.fresh = src.fresh;
        this.changes = src.changes;
        this.queries = src.queries;
        this.stale = src.stale;
    }
}
