// The rebirth defs layer: deliberate deviations from v0.8.82 requested by the user, applied to the generated defs when
// @rebirth/defs loads (data.ts), before the id registries are built. Generated JSON is never edited by hand
// (tools/port-survev regenerates it); everything the rebirth changes or adds lives here, in code, with its reason.
// docs/research/rebirth-deviations.md is the cited list.
import type { ExplosionDef, GameConfigDef, GameObjectDef, LootSpawnDef, MapDef, MapObjectDef } from "../types/index.ts";
import { AIRDROP_TIER_SPLITS } from "./airdropTiers.ts";
import { applyRebirthBuildingSpawns } from "./buildings.ts";
import { rebirthOnlyDefs, rebirthOnlyMapObjects } from "./defs.ts";
import { applyBalanceDeviations, applyMapObjectDeviations, type DefDeviation } from "./deviations.ts";
import { applyGunSpeedOverrides } from "./gunSpeeds.ts";
import { applyHeldGunArt } from "./heldGunArt.ts";
import { applyRebirthMapScale, REBIRTH_MAP_SCALE } from "./mapScale.ts";
import { applyNewGunLoot } from "./newGunLoot.ts";
import { applyOwnerLoot, CLUB_VAULT_BOX, clubVaultBuilding, GOLD_BONUS_CRATES, goldBonusCrates } from "./ownerLoot.ts";
import { applyStrobeVariantLoot, rareThrowableCrates } from "./strobeLoot.ts";
import { applySurvevStrobe, strobeVariantBagSizes } from "./strobes.ts";
import { applyRebirthGoldGuns, applyWikiStatOverrides } from "./survevGuns.ts";

export * from "./airdropLoot.ts";
export * from "./airdropTiers.ts";
export * from "./airstrikeVariants.ts";
export * from "./buildings.ts";
export { type DefDeviation, FRAG_DECAL_TYPE, FRAG_RADIUS_MULT, IRON_BOMB_DECAL_TYPE } from "./deviations.ts";
export * from "./gunBeta.ts";
export * from "./gunSpeeds.ts";
export * from "./heldGunArt.ts";
export * from "./mapScale.ts";
export * from "./newGunAssets.ts";
export * from "./newGunLoot.ts";
export * from "./newGuns.ts";
export * from "./ownerLoot.ts";
export * from "./ownerLootWeights.ts";
export * from "./strobeLoot.ts";
export * from "./strobes.ts";
export * from "./survevGuns.ts";

export interface RebirthDefs {
    /** generated game objects with the deviations applied, then the rebirth-only ones (in registry order) */
    gameObjects: Record<string, GameObjectDef>;
    /** generated map objects, then the rebirth-only ones (in registry order) */
    mapObjects: Record<string, MapObjectDef>;
    /** balance deviations applied to generated defs (game objects, then map objects) */
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
        ...applyGunSpeedOverrides(gameObjects),
        ...applyHeldGunArt(gameObjects),
        ...applySurvevStrobe(gameObjects),
        ...applyMapObjectDeviations(mapObjects),
    ];
    // the variant strobes are built from the strobe with its survev strikeDelay
    const addedGameObjects = append(gameObjects, rebirthOnlyDefs(generatedGameObjects, gameObjects));
    // the rare crates roll their throwables from the rare table (rebirth/strobeLoot.ts) and the club's secret room
    // boxes take the owner's odds and the club's gun box (rebirth/ownerLoot.ts); then the gold crates (rare throwables
    // included) get the owner's bonus roll (ownerLoot.ts); the generated defs stay as is
    Object.assign(mapObjects, rareThrowableCrates(generatedMapObjects), clubVaultBuilding(generatedMapObjects));
    Object.assign(mapObjects, goldBonusCrates(mapObjects));
    // the heavy shell's scorch decal is built from the iron bomb's resized one
    const addedMapObjects = append(mapObjects, rebirthOnlyMapObjects(generatedMapObjects, mapObjects));
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
 * the SVD and the SCAR-SSR, rebirth/survevGuns.ts) in the gold drop of main and its seasonal copies, then the owner's
 * 2026-10-08 rows (the classic floor's USAS-12, the bathhouse ring case, the club gun box's table;
 * rebirth/ownerLoot.ts), then the rare crates' throwables with the variant strobes (rebirth/strobeLoot.ts), then the
 * bigger classic and 50v50 maps (`scales`, REBIRTH_MAP_SCALE by default; rebirth/mapScale.ts), then the rebirth
 * buildings in their maps' fixed spawns (rebirth/buildings.ts). Checks that every tier inner crate a map can
 * drop and the club's gun box find their tiers in that map's table. `gameObjects` gives the guns' ammo (the floor rule
 * of the new guns and of the club table).
 */
export function applyRebirthMaps(
    generatedMaps: Readonly<Record<string, MapDef>>,
    mapObjects: Readonly<Record<string, MapObjectDef>>,
    gameObjects: Readonly<Record<string, GameObjectDef>>,
    scales: Readonly<Record<string, number>> = REBIRTH_MAP_SCALE,
): Record<string, MapDef> {
    const ammoOf = (id: string) => {
        const def = Object.hasOwn(gameObjects, id) ? gameObjects[id] : undefined;
        return def?.type === "gun" ? def.ammo : undefined;
    };
    const maps = applyRebirthBuildingSpawns(
        applyRebirthMapScale(
            applyStrobeVariantLoot(
                applyOwnerLoot(applyRebirthGoldGuns(applyNewGunLoot(generatedMaps, ammoOf)), ammoOf),
            ),
            scales,
            (type) => {
                const terrain = (mapObjects[type] as { terrain?: Record<string, unknown> } | undefined)?.terrain;
                return !!terrain?.grass && !terrain.bridge && !terrain.waterEdge && !terrain.nearbyRiver;
            },
        ),
    );
    for (const [name, def] of Object.entries(maps)) {
        // the owner's map objects are in every map's object set: their tiers must resolve everywhere
        for (const id of [CLUB_VAULT_BOX, ...GOLD_BONUS_CRATES]) {
            const loot: readonly LootSpawnDef[] = (mapObjects[id] as { loot?: LootSpawnDef[] })?.loot ?? [];
            const missing = loot.find((l) => l.tier && !Object.hasOwn(def.lootTable, l.tier));
            if (missing) throw new Error(`${name}: ${id} loot tier "${missing.tier}" is not in the loot table`);
        }
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
