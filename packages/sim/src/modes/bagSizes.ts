// Bag capacities per map (M7b): GameConfig.bagSizes with the rows a map def overrides, like survev's PlayerBarn
// (util.mergeDeep(GameConfig.bagSizes, mapDef.gameConfig.bagSizes): arrays are replaced). Woods doubles the frag and
// smoke capacity to 6/12/15/18/20 (modes/woods.md "Game mode and rules"; the 5th entry is survev's level-4 pack).
import { GameConfig, getMapDef } from "@rebirth/defs";

const cache = new Map<string, Readonly<Record<string, readonly number[]>>>();

export function mapBagSizes(mapName: string): Readonly<Record<string, readonly number[]>> {
    const cached = cache.get(mapName);
    if (cached) return cached;
    const overrides = getMapDef(mapName).gameConfig.bagSizes ?? {};
    let sizes: Readonly<Record<string, readonly number[]>> = GameConfig.bagSizes;
    const rows = Object.entries(overrides).filter(([item]) => Object.hasOwn(GameConfig.bagSizes, item));
    if (rows.length > 0) {
        const merged: Record<string, readonly number[]> = { ...GameConfig.bagSizes };
        for (const [item, row] of rows) merged[item] = row.slice(0, GameConfig.bagSizes[item].length);
        sizes = merged;
    }
    cache.set(mapName, sizes);
    return sizes;
}
