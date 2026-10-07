// The rebirth defs layer: deliberate deviations from v0.8.82 requested by the user, applied to the generated defs when
// @rebirth/defs loads (data.ts), before the id registries are built. Generated JSON is never edited by hand
// (tools/port-survev regenerates it); everything the rebirth changes or adds lives here, in code, with its reason.
// docs/research/rebirth-deviations.md is the cited list.
import type { ExplosionDef, GameConfigDef, GameObjectDef, LootSpawnDef, MapDef, MapObjectDef } from "../types/index.ts";
import { AIRDROP_TIER_SPLITS } from "./airdropTiers.ts";
import { rebirthOnlyDefs, rebirthOnlyMapObjects } from "./defs.ts";
import { applyBalanceDeviations, type DefDeviation } from "./deviations.ts";
import { applyNewGunLoot } from "./newGunLoot.ts";
import { applyStrobeVariantLoot, rareThrowableCrates } from "./strobeLoot.ts";
import { applySurvevStrobe, strobeVariantBagSizes } from "./strobes.ts";
import { applyRebirthGoldGuns, applyWikiStatOverrides } from "./survevGuns.ts";

export * from "./airdropLoot.ts";
export * from "./airdropTiers.ts";
export * from "./airstrikeVariants.ts";
export { type DefDeviation, FRAG_DECAL_TYPE, FRAG_RADIUS_MULT } from "./deviations.ts";
export * from "./gunBeta.ts";
export * from "./newGunAssets.ts";
export * from "./newGunLoot.ts";
export * from "./newGuns.ts";
export * from "./strobeLoot.ts";
export * from "./strobes.ts";
export * from "./survevGuns.ts";

export interface RebirthDefs {
    /** generated game objects with the deviations applied, then the rebirth-only ones (in registry order) */
    gameObjects: Record<string, GameObjectDef>;
    /** generated map objects, then the rebirth-only ones (in registry order) */
    mapObjects: Record<string, MapObjectDef>;
    /** balance deviations applied to generated defs */
    deviations: DefDeviation[];
    /** ids of the rebirth-only game objects, appended after every generated id */
    addedGameObjects: string[];
    /** ids of the rebirth-only map objects, appended after every generated id */
    addedMapObjects: string[];
}

/** Adds `extra` after the ids of `defs`; a clash with an existing id throws. */
function append<T>(defs: Record<string, T>, extra: Record<string, T>): string[] {
    for (const [id, def] of Object.entries(extra)) {
        if (Object.hasOwn(defs, id)) throw new Error(`rebirth def "${id}" clashes with a generated def`);
        defs[id] = def;
    }
    return Object.keys(extra);
}

/** Applies the rebirth layer to the generated game and map objects (which are left untouched). */
export function applyRebirthDefs(
    generatedGameObjects: Readonly<Record<string, GameObjectDef>>,
    generatedMapObjects: Readonly<Record<string, MapObjectDef>>,
): RebirthDefs {
    const gameObjects: Record<string, GameObjectDef> = { ...generatedGameObjects };
    const mapObjects: Record<string, MapObjectDef> = { ...generatedMapObjects };
    const deviations = [
        ...applyBalanceDeviations(gameObjects),
        ...applyWikiStatOverrides(gameObjects),
        ...applySurvevStrobe(gameObjects),
    ];
    // the variant strobes are built from the strobe with its survev strikeDelay
    const addedGameObjects = append(gameObjects, rebirthOnlyDefs(generatedGameObjects, gameObjects));
    // the rare crates roll their throwables from the rare table (rebirth/strobeLoot.ts); the generated defs stay as is
    Object.assign(mapObjects, rareThrowableCrates(generatedMapObjects));
    const addedMapObjects = append(mapObjects, rebirthOnlyMapObjects(generatedMapObjects));
    // every scorch decal an explosion leaves must exist (the rebirth ones point at the rebirth decals)
    for (const [id, def] of Object.entries(gameObjects)) {
        const decal = def.type === "explosion" ? (def as ExplosionDef).decalType : "";
        if (decal && mapObjects[decal]?.type !== "decal") throw new Error(`${id}: decal "${decal}" is not a decal`);
    }
    return { gameObjects, mapObjects, deviations, addedGameObjects, addedMapObjects };
}

/**
 * The GameConfig with the rebirth bag items (the variant strobes, rebirth/strobes.ts) after every other one, so the
 * original items keep their protocol order (the Local message's inventory section).
 */
export function applyRebirthGameConfig(generated: GameConfigDef): GameConfigDef {
    const added = strobeVariantBagSizes(generated.bagSizes);
    for (const id of Object.keys(added)) {
        if (Object.hasOwn(generated.bagSizes, id))
            throw new Error(`rebirth bag item "${id}" clashes with a generated one`);
    }
    return { ...generated, bagSizes: { ...generated.bagSizes, ...added } };
}

/**
 * The generated map defs with the rebirth loot tables added to copies of their loot tables: the new guns' rows around
 * the air drop tier tables (rebirth/newGunLoot.ts, rebirth/airdropLoot.ts), then the rebirth gold guns (the Barrett,
 * rebirth/survevGuns.ts) in the gold drop of main and its seasonal copies, then the rare crates' throwables with the
 * variant strobes (rebirth/strobeLoot.ts). Checks that every tier inner crate a map can drop finds its tiers in that
 * map's table. `gameObjects` gives the guns' ammo (the new guns' floor rule).
 */
export function applyRebirthMaps(
    generatedMaps: Readonly<Record<string, MapDef>>,
    mapObjects: Readonly<Record<string, MapObjectDef>>,
    gameObjects: Readonly<Record<string, GameObjectDef>>,
): Record<string, MapDef> {
    const ammoOf = (id: string) => {
        const def = Object.hasOwn(gameObjects, id) ? gameObjects[id] : undefined;
        return def?.type === "gun" ? def.ammo : undefined;
    };
    const maps = applyStrobeVariantLoot(applyRebirthGoldGuns(applyNewGunLoot(generatedMaps, ammoOf)));
    for (const [name, def] of Object.entries(maps)) {
        for (const crate of def.gameConfig.planes.crates) {
            const split = Object.hasOwn(AIRDROP_TIER_SPLITS, crate.name) ? AIRDROP_TIER_SPLITS[crate.name] : undefined;
            for (const inner of Object.values(split ?? {})) {
                const loot: readonly LootSpawnDef[] = (mapObjects[inner] as { loot?: LootSpawnDef[] })?.loot ?? [];
                const missing = loot.find((l) => l.tier && !Object.hasOwn(def.lootTable, l.tier));
                if (missing) throw new Error(`${name}: ${inner} loot tier "${missing.tier}" is not in the loot table`);
            }
        }
    }
    return maps;
}
