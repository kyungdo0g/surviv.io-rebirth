// Probes buildings (packages/sim/test/buildingProbe.ts) and prints a table: walkable, cramped and unreachable floor,
// gaps under 2.6 units, loot and interactions. `node tools/research/building-probe.ts [type ...] [--json out.json]`;
// without types it probes the rebirth buildings and survev's reference buildings.
import { writeFileSync } from "node:fs";
import { type ProbeResult, probeBuilding } from "../../packages/sim/test/buildingProbe.ts";

const REBIRTH = [
    "clinic_01",
    "firestation_01",
    "library_01",
    "radio_station_01",
    "outpost_01r",
    "arsenal_01",
    "blockhouse_01r",
    "military_base_01",
];
const REFERENCE = ["house_red_01", "warehouse_01", "bank_01", "police_01", "mansion_01"];

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : undefined;
const types = args.filter((a, i) => (!a.startsWith("--") && i !== jsonAt + 1) || (jsonAt < 0 && !a.startsWith("--")));
const list = types.length ? types : [...REBIRTH, ...REFERENCE];

const results: ProbeResult[] = [];
const f = (n: number) => n.toFixed(1);
console.log(
    "| building | size | walkable u² | cramped u² | unreachable u² (pockets) | squeezes 2-2.6 | blocked <2 | containers | floor spots | guns | unlocks |",
);
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
for (const type of list) {
    const r = probeBuilding(type);
    results.push(r);
    const sum = (k: "walkable" | "cramped" | "unreachable") => r.layers.reduce((s, l) => s + l[k], 0);
    const pockets = r.layers.reduce((s, l) => s + l.pockets.length, 0);
    const unlocks = r.unlocks
        .map((u) => `${u.door} (${u.how}): +${f(u.area)} u², ${u.containers} loot, ${u.guns} guns`)
        .join("; ");
    console.log(
        `| ${type} | ${r.width}x${r.height} | ${f(sum("walkable"))} | ${f(sum("cramped"))} | ${f(sum("unreachable"))} (${pockets}) | ${r.squeezes.length} | ${r.blocked.length} | ${r.containers} | ${r.floorSpots} | ${r.guns} | ${unlocks || "-"} |`,
    );
}
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(results, null, 1)}\n`);
