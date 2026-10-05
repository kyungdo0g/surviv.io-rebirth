// Reference walkers over the raw definition formats: which ids a map def, a map object or a loot table points at.
// Pure functions on plain JSON, shared by the port tool (tools/port-survev) and the game code.

type Obj = Record<string, any>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Ids named by a building child `type`: a string, or every key of a `{ id: weight }` random pick. */
export function childTypeIds(type: unknown): string[] {
    if (typeof type === "string") return type ? [type] : [];
    if (isObj(type)) return Object.keys(type).filter(Boolean);
    return [];
}

/**
 * Map object ids a map object references: building children, structure layers, destroy/use/puzzle targets.
 * A `smartLoot` obstacle's `destroyType` is a prefix completed with the opener's role, see {@link smartLootIds}.
 * With `roles`, those role-suffixed ids are included.
 */
export function mapObjectChildIds(def: Obj, roles: readonly string[] = []): string[] {
    const out: string[] = [];
    for (const child of def.mapObjects ?? []) out.push(...childTypeIds(child?.type));
    for (const layer of def.layers ?? []) if (layer?.type) out.push(layer.type);
    if (def.smartLoot) out.push(...smartLootIds(def, roles));
    else if (typeof def.destroyType === "string" && def.destroyType) out.push(def.destroyType);
    if (typeof def.button?.useType === "string" && def.button.useType) out.push(def.button.useType);
    if (typeof def.puzzle?.completeUseType === "string" && def.puzzle.completeUseType) {
        out.push(def.puzzle.completeUseType);
    }
    return out;
}

/** Ids a `smartLoot` obstacle turns into when destroyed by a player with one of `roles` (`${destroyType}_${role}`). */
export function smartLootIds(def: Obj, roles: readonly string[]): string[] {
    if (!def.smartLoot || typeof def.destroyType !== "string" || !def.destroyType) return [];
    return roles.map((role) => `${def.destroyType}_${role}`);
}

/** Roles a map def can hand out in perk mode (cobalt classes): the suffixes of smart loot destroy types. */
export function perkModeRoles(maps: Iterable<Obj>): string[] {
    const out = new Set<string>();
    for (const map of maps) for (const r of map.gameMode?.perkModeRoles ?? []) if (typeof r === "string") out.add(r);
    return [...out];
}

/** Loot references of a map object: tier tables (tierLoot) and direct item drops (autoLoot). */
export function mapObjectLootRefs(def: Obj): { tiers: string[]; items: string[] } {
    const tiers: string[] = [];
    const items: string[] = [];
    for (const l of def.loot ?? []) {
        if (typeof l?.tier === "string" && l.tier) tiers.push(l.tier);
        if (typeof l?.type === "string" && l.type) items.push(l.type);
    }
    return { tiers, items };
}

export interface MapSpawnRef {
    id: string;
    where: string;
}

/** Map object ids a map def spawns: mapGen spawn lists, bridges, lake centers, airdrop crates, unlock targets. */
export function mapDefSpawnRefs(map: Obj): MapSpawnRef[] {
    const out: MapSpawnRef[] = [];
    const add = (id: unknown, where: string) => {
        if (typeof id === "string" && id) out.push({ id, where });
    };
    const gen = map.mapGen ?? {};
    for (const d of gen.densitySpawns ?? []) for (const id of Object.keys(d ?? {})) add(id, "densitySpawns");
    for (const d of gen.fixedSpawns ?? []) for (const id of Object.keys(d ?? {})) add(id, "fixedSpawns");
    for (const r of gen.randomSpawns ?? []) for (const id of r?.spawns ?? []) add(id, "randomSpawns");
    for (const d of gen.spawnReplacements ?? []) {
        for (const [from, to] of Object.entries(d ?? {})) {
            add(from, "spawnReplacements");
            add(to, "spawnReplacements");
        }
    }
    for (const l of gen.customSpawnRules?.locationSpawns ?? []) add(l?.type, "customSpawnRules.locationSpawns");
    for (const id of gen.customSpawnRules?.placeSpawns ?? []) add(id, "customSpawnRules.placeSpawns");
    for (const id of gen.importantSpawns ?? []) add(id, "importantSpawns");
    for (const id of Object.values(gen.bridgeTypes ?? {})) add(id, "bridgeTypes");
    for (const lake of gen.map?.rivers?.lakes ?? []) add(lake?.centerObj, "rivers.lakes.centerObj");
    for (const c of map.gameConfig?.planes?.crates ?? []) add(c?.name, "gameConfig.planes.crates");
    for (const t of map.gameConfig?.planes?.timings ?? []) add(t?.options?.airdropType, "gameConfig.planes.timings");
    for (const u of map.gameConfig?.unlocks?.timings ?? []) add(u?.type, "gameConfig.unlocks.timings");
    return out;
}

/** Role ids a map def references (role timings, role overrides, perk mode roles). */
export function mapDefRoleRefs(map: Obj): string[] {
    const out: string[] = [];
    for (const t of map.gameConfig?.roles?.timings ?? []) if (typeof t?.role === "string") out.push(t.role);
    out.push(...Object.keys(map.gameConfig?.roles?.roleOverrides ?? {}));
    for (const r of map.gameMode?.perkModeRoles ?? []) if (typeof r === "string") out.push(r);
    return out;
}

/** Map object ids reachable from `roots` through {@link mapObjectChildIds}, in discovery order. */
export function mapObjectClosure(
    roots: Iterable<string>,
    defs: Record<string, Obj | undefined>,
    roles: readonly string[] = [],
): string[] {
    const seen = new Set<string>();
    const queue = [...roots];
    while (queue.length > 0) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const def = defs[id];
        if (def) queue.push(...mapObjectChildIds(def, roles));
    }
    return [...seen];
}
