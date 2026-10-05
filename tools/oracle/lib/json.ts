// Stable fixture output: numbers rounded to 1e-6, short objects and arrays on one line, Biome formatting applied
// after writing so `biome check` accepts the files unchanged.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./paths.ts";

const INLINE_MAX = 100;

/** Rounds to 6 decimals and normalises -0, so tiny float noise never changes a fixture. */
export function round(x: number, decimals = 6): number {
    if (!Number.isFinite(x)) return x;
    const f = 10 ** decimals;
    const r = Math.round(x * f) / f;
    return Object.is(r, -0) ? 0 : r;
}

function normalise(v: unknown): unknown {
    if (typeof v === "number") return Number.isFinite(v) ? round(v) : null;
    if (Array.isArray(v)) return v.map(normalise);
    if (typeof v === "object" && v !== null) {
        const out: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = normalise(x);
        return out;
    }
    return v;
}

function inline(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
    if (typeof v === "object" && v !== null) {
        const parts = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`);
        return parts.length ? `{ ${parts.join(", ")} }` : "{}";
    }
    return JSON.stringify(v);
}

function format(v: unknown, indent: string): string {
    const flat = inline(v);
    if (typeof v !== "object" || v === null || flat.length + indent.length <= INLINE_MAX) return flat;
    const inner = `${indent}    `;
    if (Array.isArray(v)) return `[\n${v.map((x) => inner + format(x, inner)).join(",\n")}\n${indent}]`;
    const entries = Object.entries(v).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${format(x, inner)}`);
    return `{\n${entries.join(",\n")}\n${indent}}`;
}

export function stableStringify(data: unknown): string {
    return `${format(normalise(data), "")}\n`;
}

export function writeFixture(file: string, data: unknown): void {
    writeFileSync(file, stableStringify(data));
}

/** Runs Biome on the written fixtures (same formatter `pnpm lint` checks). */
export function biomeFormat(files: string[]): void {
    const biome = join(ROOT, "node_modules/.bin/biome");
    if (!existsSync(biome) || files.length === 0) {
        console.warn("warning: node_modules/.bin/biome not found, fixtures left unformatted");
        return;
    }
    execFileSync(biome, ["format", "--write", ...files], { cwd: ROOT, stdio: "pipe" });
}
