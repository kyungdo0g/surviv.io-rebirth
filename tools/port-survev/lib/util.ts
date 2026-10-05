// Generic JSON helpers for the survev port: cloning, comparison, original-wins deep merge and diffing.

export function isPlainObject(v: unknown): v is Record<string, any> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function clone<T>(v: T): T {
    return v === undefined ? v : structuredClone(v);
}

export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a)) {
        return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
    }
    return false;
}

/**
 * Deep merge where `winner` takes precedence over `base` for every key present in both. Arrays are leaves.
 * Key order: winner's keys first (in its insertion order), then keys only present in base.
 */
export function mergeWinner(winner: unknown, base: unknown): any {
    if (isPlainObject(winner) && isPlainObject(base)) {
        const out: Record<string, any> = {};
        for (const k of Object.keys(winner)) out[k] = k in base ? mergeWinner(winner[k], base[k]) : clone(winner[k]);
        for (const k of Object.keys(base)) if (!(k in winner)) out[k] = clone(base[k]);
        return out;
    }
    return clone(winner === undefined ? base : winner);
}

export interface KeyDiff {
    path: string;
    kind: "changed" | "originalOnly" | "survevOnly";
    original?: unknown;
    survev?: unknown;
}

/** Lists keys whose values differ between the original and survev objects (arrays compared as leaves). */
export function diffKeys(original: unknown, survev: unknown, path = ""): KeyDiff[] {
    if (isPlainObject(original) && isPlainObject(survev)) {
        const out: KeyDiff[] = [];
        for (const k of Object.keys(original)) {
            const p = path ? `${path}.${k}` : k;
            if (!(k in survev)) out.push({ path: p, kind: "originalOnly", original: original[k] });
            else out.push(...diffKeys(original[k], survev[k], p));
        }
        for (const k of Object.keys(survev)) {
            if (!(k in original)) out.push({ path: path ? `${path}.${k}` : k, kind: "survevOnly", survev: survev[k] });
        }
        return out;
    }
    return deepEqual(original, survev) ? [] : [{ path, kind: "changed", original, survev }];
}

export function stableJson(v: unknown): string {
    return `${JSON.stringify(v, null, 2)}\n`;
}
