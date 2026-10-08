// Ammo availability on the main map for the gun-tier doc (docs/design/gun-tiers.md 2.5): ammo-box rows and the rounds
// floor guns bring, from survev's main tables with the rebirth rows (no beta floor).
// usage (repo root): node tools/research/gun-tiers/ammo.ts  (report.ts imports ammoTable)
import { GameConfig, getDef, getMapDef, hasDef } from "../../../packages/defs/src/index.ts";

type Any = any;
const AMMOS = ["9mm", "762mm", "556mm", "12gauge", "45acp", "50AE", "308sub", "57mm", "40mm", "rocket"];

export function ammoTable(): string {
    const lt = getMapDef("main").lootTable as Any;
    const share = (table: string) => {
        const rows: Any[] = lt[table] ?? [];
        const tot = rows.reduce((a: number, r: Any) => a + r.weight, 0);
        const out: Record<string, string> = {};
        for (const r of rows) out[r.name] = `${((100 * r.weight) / tot).toFixed(0)} % x ${r.count}`;
        return out;
    };
    const box = share("tier_ammo");
    const crate = share("tier_ammo_crate");
    const guns: Record<string, number> = {};
    const totG = lt.tier_guns.reduce((a: number, r: Any) => a + r.weight, 0);
    for (const r of lt.tier_guns as Any[]) {
        if (!hasDef(r.name) || getDef(r.name).type !== "gun") continue;
        const g = getDef(r.name) as Any;
        guns[g.ammo] = (guns[g.ammo] ?? 0) + (r.weight / totG) * (g.ammoSpawnCount ?? 0);
    }
    const bag = (GameConfig as Any).bagSizes;
    const lines = [
        "| ammo | tier_ammo (box) | tier_ammo_crate | rounds per floor gun roll | bag (no pack) |",
        "|---|---|---|---|---|",
    ];
    for (const a of AMMOS)
        lines.push(
            `| ${a} | ${box[a] ?? "-"} | ${crate[a] ?? "-"} | ${(guns[a] ?? 0).toFixed(2)} | ${bag[a]?.[0] ?? "-"} |`,
        );
    return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(ammoTable());
