// Deep comparison with per-field quantization tolerances: numbers may differ by the tolerance of their path,
// everything else must be equal. Properties whose value is undefined count as absent.

/** Tolerance for a numeric value at `path` (e.g. ["objects", "3", "pos", "x"]); 0 means exact. */
export type TolFn = (path: readonly string[]) => number;

export const exact: TolFn = () => 0;

/**
 * Tolerance table keyed by "grandparent.parent.key", "parent.key" or "key" (the most specific entry wins); array
 * indices are skipped, so ["bullets", "3", "dir", "x"] matches "bullets.dir.x".
 */
export function tolTable(table: Record<string, number>): TolFn {
    return (fullPath) => {
        const path = fullPath.filter((p) => !/^\d+$/.test(p));
        const key = path[path.length - 1];
        const parent = path[path.length - 2];
        const grand = path[path.length - 3];
        return table[`${grand}.${parent}.${key}`] ?? table[`${parent}.${key}`] ?? table[key] ?? 0;
    };
}

function definedKeys(o: object): string[] {
    return Object.keys(o)
        .filter((k) => (o as Record<string, unknown>)[k] !== undefined)
        .sort();
}

/** Returns a description of the first difference, or null when `actual` matches `expected`. */
export function diffClose(actual: unknown, expected: unknown, tol: TolFn, path: string[] = []): string | null {
    const at = path.join(".") || "(root)";
    if (typeof expected === "number") {
        if (typeof actual !== "number") return `${at}: expected number ${expected}, got ${String(actual)}`;
        const t = tol(path);
        if (t === 0 ? actual !== expected : !(Math.abs(actual - expected) <= t)) {
            return `${at}: expected ${expected} (+-${t}), got ${actual}`;
        }
        return null;
    }
    if (expected === null || typeof expected !== "object") {
        return Object.is(actual, expected) ? null : `${at}: expected ${String(expected)}, got ${String(actual)}`;
    }
    if (actual === null || typeof actual !== "object") return `${at}: expected an object, got ${String(actual)}`;
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual)) return `${at}: expected an array`;
        if (actual.length !== expected.length) return `${at}: length ${actual.length} != ${expected.length}`;
        for (let i = 0; i < expected.length; i++) {
            const d = diffClose(actual[i], expected[i], tol, [...path, String(i)]);
            if (d) return d;
        }
        return null;
    }
    const ka = definedKeys(actual);
    const ke = definedKeys(expected);
    if (ka.join(",") !== ke.join(",")) return `${at}: keys [${ka}] != [${ke}]`;
    for (const k of ke) {
        const d = diffClose((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k], tol, [
            ...path,
            k,
        ]);
        if (d) return d;
    }
    return null;
}

export function assertClose(actual: unknown, expected: unknown, tol: TolFn, label = ""): void {
    const d = diffClose(actual, expected, tol);
    if (d) throw new Error(`${label ? `${label}: ` : ""}${d}`);
}
