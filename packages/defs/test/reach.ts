// Where a map can actually hand out an item: the loot tables reachable from what the map spawns (map generation
// spawns and their building children, air drop crates and the rebirth tier inner crates they open into), from the
// tiers the Scavenger perks add to kills (survev/shared/defs/gameObjects/perkDefs.ts:105-118; the sim's
// rules.perks.scavengerTiers) when such a perk can drop, and from role loadouts (roleOverrides).
import {
    AIRDROP_TIER_SPLITS,
    getMapDef,
    MapObjectDefs,
    mapDefSpawnRefs,
    mapObjectClosure,
    mapObjectLootRefs,
    perkModeRoles,
} from "../src/index.ts";

/** Loot tiers a perk adds (Scavenger: a tier_world roll per kill, Master Scavenger: tier_scavenger_adv). */
const PERK_TIERS: Readonly<Record<string, string>> = { scavenger: "tier_world", scavenger_adv: "tier_scavenger_adv" };

export interface Reach {
    /** reachable loot tier -> the map object (or perk) that first reaches it */
    tiers: Map<string, string>;
    /** items of role loadouts (roleOverrides weapons, $weighted options included) */
    loadoutItems: Set<string>;
}

export function mapReach(mapName: string): Reach {
    const map = getMapDef(mapName);
    const roles = perkModeRoles([map]);
    const roots = mapDefSpawnRefs(map).map((r) => r.id);
    for (const crate of map.gameConfig.planes.crates) {
        const split = Object.hasOwn(AIRDROP_TIER_SPLITS, crate.name) ? AIRDROP_TIER_SPLITS[crate.name] : undefined;
        if (split) roots.push(...Object.values(split));
    }
    const tiers = new Map<string, string>();
    const queue: Array<[string, string]> = [];
    for (const id of mapObjectClosure(roots, MapObjectDefs, roles)) {
        const def = MapObjectDefs[id];
        if (def) for (const tier of mapObjectLootRefs(def).tiers) queue.push([tier, id]);
    }
    while (queue.length > 0) {
        const [tier, via] = queue.shift()!;
        if (tiers.has(tier)) continue;
        tiers.set(tier, via);
        for (const e of map.lootTable[tier] ?? []) {
            if (e.name.startsWith("tier_")) queue.push([e.name, via]);
            const perkTier = PERK_TIERS[e.name];
            if (perkTier) queue.push([perkTier, `perk ${e.name}`]);
        }
    }
    const loadoutItems = new Set<string>();
    JSON.stringify(map.gameConfig.roles?.roleOverrides ?? {}, (key, value) => {
        if (key === "type" && typeof value === "string" && value) loadoutItems.add(value);
        return value;
    });
    return { tiers, loadoutItems };
}

/** "<tier> <weight>" for every reachable table of the map holding `item`, sorted. */
export function reachablePlacements(mapName: string, item: string): string[] {
    const map = getMapDef(mapName);
    const { tiers } = mapReach(mapName);
    const out: string[] = [];
    for (const tier of tiers.keys()) {
        for (const e of map.lootTable[tier] ?? []) if (e.name === item) out.push(`${tier} ${e.weight}`);
    }
    return out.sort();
}

/** Tables of the map that hold `item` but that nothing on the map reaches, sorted. */
export function unreachablePlacements(mapName: string, item: string): string[] {
    const map = getMapDef(mapName);
    const { tiers } = mapReach(mapName);
    return Object.entries(map.lootTable)
        .filter(([tier, entries]) => !tiers.has(tier) && entries.some((e) => e.name === item))
        .map(([tier]) => tier)
        .sort();
}
