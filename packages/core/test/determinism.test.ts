import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));
const FORBIDDEN = ["Math.random", "Date.now", "performance.now"];

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listSourceFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
    });
}

describe("determinism", () => {
    it("core sources never read wall-clock time or unseeded randomness", () => {
        const files = listSourceFiles(SRC_DIR);
        expect(files.length).toBeGreaterThan(0);
        const offenders: string[] = [];
        for (const file of files) {
            const lines = readFileSync(file, "utf8").split("\n");
            lines.forEach((line, i) => {
                for (const token of FORBIDDEN) {
                    if (line.includes(token)) {
                        offenders.push(`${file}:${i + 1}: ${token}`);
                    }
                }
            });
        }
        expect(offenders).toEqual([]);
    });
});
