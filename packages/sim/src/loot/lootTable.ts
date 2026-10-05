// Loot tier tables: weighted picks with nested tiers (survev server/src/game/objects/loot.ts getLootTable).
import type { Rng } from "@rebirth/core";
import type { LootSpawnDef, LootTableEntry } from "@rebirth/defs";

export interface RolledItem {
    type: string;
    count: number;
    /** guns from preload tables (or `preloadGuns` props) carry their ammo inside instead of side stacks */
    preload: boolean;
}

/** Maximum nesting of `tier_*` entries followed before giving up (guards against cyclic tables). */
const MAX_TIER_DEPTH = 16;

/** One weighted entry of a table; an entry wins when the draw falls inside its weight (zero weights never win). */
export function pickEntry(table: readonly LootTableEntry[], rng: Rng): LootTableEntry | undefined {
    let total = 0;
    for (const e of table) if (e.weight > 0) total += e.weight;
    if (!(total > 0)) return undefined;
    let r = rng.next() * total;
    let last: LootTableEntry | undefined;
    for (const e of table) {
        if (!(e.weight > 0)) continue;
        last = e;
        if (r < e.weight) return e;
        r -= e.weight;
    }
    return last;
}

/**
 * Rolls one item from `tier`, following nested `tier_*` entries. Returns undefined for "" (no drop) entries and
 * for unknown tiers (reported through `onUnknownTier`).
 */
export function rollTier(
    tables: Readonly<Record<string, readonly LootTableEntry[]>>,
    tier: string,
    rng: Rng,
    onUnknownTier?: (tier: string) => void,
): LootTableEntry | undefined {
    let name = tier;
    for (let depth = 0; depth < MAX_TIER_DEPTH; depth++) {
        const table = Object.hasOwn(tables, name) ? tables[name] : undefined;
        if (!table) {
            onUnknownTier?.(name);
            return undefined;
        }
        const entry = pickEntry(table, rng);
        if (!entry || !entry.name) return undefined;
        if (!entry.name.startsWith("tier_")) return entry;
        name = entry.name;
    }
    onUnknownTier?.(name);
    return undefined;
}

/**
 * Items dropped by a map object's `loot` list when it is destroyed: each `tierLoot(tier, min, max)` rolls
 * randomInt(min, max) times, each `autoLoot(type, count)` drops as is (survev obstacle.ts kill).
 */
export function rollLootList(
    tables: Readonly<Record<string, readonly LootTableEntry[]>>,
    list: readonly LootSpawnDef[],
    rng: Rng,
    onUnknownTier?: (tier: string) => void,
): RolledItem[] {
    const items: RolledItem[] = [];
    for (const entry of list) {
        if (entry.tier) {
            const min = entry.min ?? 1;
            const max = entry.max ?? min;
            const count = rng.int(min, Math.max(min, max));
            for (let i = 0; i < count; i++) {
                const item = rollTier(tables, entry.tier, rng, onUnknownTier);
                if (!item) continue;
                items.push({
                    type: item.name,
                    count: item.count,
                    preload: !!entry.props?.preloadGuns || !!item.preload,
                });
            }
        } else if (entry.type) {
            items.push({ type: entry.type, count: entry.count ?? 1, preload: !!entry.props?.preloadGuns });
        }
    }
    return items;
}
