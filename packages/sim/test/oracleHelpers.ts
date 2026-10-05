// Loading the survev oracle fixtures (tools/oracle/fixtures, see tools/oracle/README.md) and collecting mismatches.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIXTURES = fileURLToPath(new URL("../../../tools/oracle/fixtures/", import.meta.url));

export function hasFixture(name: string): boolean {
    return existsSync(`${FIXTURES}${name}.json`);
}

export function loadFixture<T = any>(name: string): T {
    return JSON.parse(readFileSync(`${FIXTURES}${name}.json`, "utf8")) as T;
}

/** One simulation tick, the tolerance unit for timings (survev's fixed-step float residue adds up to one tick). */
export const TICK = 0.01;

/** Collects comparison failures with a description, so a test reports all of them at once. */
export class Mismatches {
    readonly list: string[] = [];
    checked = 0;

    near(what: string, ours: number | null | undefined, oracle: number | null | undefined, tol: number): void {
        this.checked++;
        if (ours === null || ours === undefined || oracle === null || oracle === undefined) {
            if (ours !== oracle) this.list.push(`${what}: ours ${ours} vs oracle ${oracle}`);
            return;
        }
        if (!(Math.abs(ours - oracle) <= tol + 1e-9)) {
            this.list.push(`${what}: ours ${round(ours)} vs oracle ${round(oracle)} (tolerance ${tol})`);
        }
    }

    equal(what: string, ours: unknown, oracle: unknown): void {
        this.checked++;
        if (JSON.stringify(ours) !== JSON.stringify(oracle)) {
            this.list.push(`${what}: ours ${JSON.stringify(ours)} vs oracle ${JSON.stringify(oracle)}`);
        }
    }
}

function round(x: number): number {
    return Math.round(x * 1e6) / 1e6;
}

/** Values of a fixture histogram ([{ value, count }]). */
export function histogramValues(h: Array<{ value: number; count: number }>): number[] {
    return h.map((e) => e.value);
}
