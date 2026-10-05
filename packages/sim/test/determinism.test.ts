import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));
// split so this file itself never contains the forbidden tokens
const FORBIDDEN = [["Math", "random"].join("."), ["Date", "now"].join("."), ["performance", "now"].join(".")];

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listSourceFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
    });
}

describe("determinism", () => {
    it("sim sources never read wall-clock time or unseeded randomness", () => {
        const files = listSourceFiles(SRC_DIR);
        expect(files.length).toBeGreaterThan(5);
        const offenders: string[] = [];
        for (const file of files) {
            readFileSync(file, "utf8")
                .split("\n")
                .forEach((line, i) => {
                    for (const token of FORBIDDEN) {
                        if (line.includes(token)) offenders.push(`${file}:${i + 1}: ${token}`);
                    }
                });
        }
        expect(offenders).toEqual([]);
    });

    it("sim sources do not import node built-ins", () => {
        const offenders = listSourceFiles(SRC_DIR).filter((f) => /from "node:/.test(readFileSync(f, "utf8")));
        expect(offenders).toEqual([]);
    });
});
