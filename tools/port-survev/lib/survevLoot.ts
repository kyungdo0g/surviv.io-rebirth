// Loot placements of the survev-only items the policy ports (policy.json): they spawn where survev places them.
// Two steps keep them: the balance revert must not delete them (it reverts survev's loot tables to the pre-fork
// values, where these items were absent), and maps whose tables an event-map fix rebuilt (Savannah's pre-fork
// reconstruction) get survev's entries back afterwards, unless the map's loot bans forbid the item.
import type { RevertEntry, RevertLog } from "./balance.ts";
import { isPlainObject } from "./util.ts";

/** A loot-table revert entry, read as map list + tier + item (undefined for other entries). */
interface LootTarget {
    maps: string[];
    tier: string;
    item: string;
}

function lootTarget(entry: RevertEntry, mapNames: readonly string[]): LootTarget | undefined {
    if (String(entry.section ?? "").toLowerCase() !== "loottables") return undefined;
    const m = entry.target.match(/^(?:([A-Za-z0-9_]+)\.)?lootTables?\.(tier_[A-Za-z0-9_]+)\[([^\]]+)\]$/);
    if (!m) return undefined;
    const [, head, tier, item] = m;
    const listed = Array.isArray(entry.maps) ? entry.maps : [];
    const maps = head ? [head] : listed.length > 0 ? listed : [...mapNames];
    return { maps, tier, item };
}

const isAbsent = (v: unknown) => typeof v === "string" && /^(absent|removed|none)\b/i.test(v.trim());

/**
 * Splits the balance-revert entries into those to apply and skip logs for the ones that would undo a ported item's
 * survev placement: every loot entry of a ported survev-only item, and the entry that would put a skin's base back
 * where survev swapped the base for the skin (snow's eye block: AWM-S 1 -> AWM-S winter 0.75), so the table keeps
 * survev's swap instead of holding both guns.
 */
export function keepSurvevPlacements(
    entries: unknown,
    ported: ReadonlySet<string>,
    skins: Readonly<Record<string, string>>,
    mapNames: readonly string[],
): { apply: unknown[]; skipped: RevertLog[] } {
    if (!Array.isArray(entries)) throw new Error("balance-revert.json must be an array");
    const reason = "survev-only item ported as survev places it (tools/port-survev/policy.json)";
    const kept = new Set<RevertEntry>();
    const swapped = new Set<string>(); // "map|tier|base" where a ported skin replaced its base
    for (const e of entries) {
        if (!isPlainObject(e) || typeof e.target !== "string") continue;
        const t = lootTarget(e as RevertEntry, mapNames);
        if (!t || !ported.has(t.item)) continue;
        kept.add(e as RevertEntry);
        const base = skins[t.item];
        if (base && isAbsent(e.originalValue)) for (const m of t.maps) swapped.add(`${m}|${t.tier}|${base}`);
    }
    for (const e of entries) {
        if (!isPlainObject(e) || typeof e.target !== "string" || kept.has(e as RevertEntry)) continue;
        const t = lootTarget(e as RevertEntry, mapNames);
        if (t && isAbsent(e.forkValue) && t.maps.every((m) => swapped.has(`${m}|${t.tier}|${t.item}`))) {
            kept.add(e as RevertEntry);
        }
    }
    const skipped: RevertLog[] = [...kept].map((entry) => ({ status: "skipped", entry, reason }));
    return { apply: entries.filter((e) => !kept.has(e as RevertEntry)), skipped };
}

export interface PlacementLog {
    map: string;
    tier: string;
    item: string;
    weight: number;
    reason: string;
}

/**
 * Puts survev's loot entries of the ported items back into tables that lost them after the balance revert and the
 * event-map fixes (an entry is added only when its tier exists and the item is not in it and not banned there).
 */
export function restoreSurvevPlacements(
    maps: Record<string, any>,
    survevMaps: Record<string, any>,
    ported: ReadonlySet<string>,
    bans: Readonly<Record<string, readonly string[]>>,
): PlacementLog[] {
    const log: PlacementLog[] = [];
    for (const [name, def] of Object.entries(maps)) {
        const banned = new Set(bans[name] ?? []);
        for (const [tier, entries] of Object.entries<any[]>(survevMaps[name]?.lootTable ?? {})) {
            const table = def.lootTable?.[tier];
            if (!Array.isArray(table)) continue;
            for (const e of entries) {
                if (!ported.has(e.name) || banned.has(e.name) || table.some((x) => x.name === e.name)) continue;
                table.push({ name: e.name, count: e.count, weight: e.weight });
                log.push({ map: name, tier, item: e.name, weight: e.weight, reason: "survev placement restored" });
            }
        }
    }
    return log;
}

/** Map-level game config targets of the `other` section that belong to map generation (unlocks, air drop crates). */
const MAP_LEVEL_OTHER = /^(cache variants|[a-z0-9_]+\.gameConfig\.(unlocks|airdrop|planes)\b)/i;

/**
 * Splits the balance-revert entries for survev's map generation (policy.json survevMapGen, survev content wave stage
 * 3): map-spawn entries, the cache-variant reskin entry and map-level game config entries (Cobalt's unlock timing,
 * Potato vs Tomato's air drop crates) are skipped, so maps keep survev's buildings, spawn counts and variants.
 */
export function splitMapGenEntries(entries: readonly unknown[]): { apply: unknown[]; skipped: RevertLog[] } {
    const reason = "survev map generation (tools/port-survev/policy.json survevMapGen)";
    const apply: unknown[] = [];
    const skipped: RevertLog[] = [];
    for (const e of entries) {
        const entry = e as RevertEntry;
        const section = String(entry?.section ?? "").toLowerCase();
        const mapGen =
            section === "mapspawns" || (section === "other" && MAP_LEVEL_OTHER.test(String(entry?.target ?? "")));
        if (mapGen) skipped.push({ status: "skipped", entry, reason });
        else apply.push(e);
    }
    return { apply, skipped };
}
