// Sprites the original atlas stored pre-shrunk. Definition scales of these ceilings assume the shrunk texture,
// so the texture store bakes the factor into the texture's logical size.
// Source: survev client/atlas-builder/atlasDefs.ts `scaledSprites` (mirrors the original atlases).
const ATLAS_SCALE: Readonly<Record<string, number>> = {
    "map-building-house-ceiling.img": 0.75,
    "map-building-hut-ceiling-01.img": 0.75,
    "map-building-hut-ceiling-02.img": 0.75,
    "map-building-hut-ceiling-03.img": 0.75,
    "map-building-police-ceiling-01.img": 0.75,
    "map-building-police-ceiling-02.img": 0.75,
    "map-building-police-ceiling-03.img": 0.75,
    "map-building-shack-ceiling-01.img": 0.75,
    "map-building-shack-ceiling-02.img": 0.75,
    "map-building-barn-ceiling-02.img": 0.75,
    "map-building-barn-ceiling-01.img": 0.5,
    "map-building-mansion-ceiling.img": 0.5,
    "map-building-vault-ceiling.img": 0.5,
    "map-building-warehouse-ceiling-01.img": 0.5,
    "map-building-warehouse-ceiling-02.img": 0.5,
    "map-bunker-conch-chamber-ceiling-01.img": 0.5,
    "map-bunker-conch-chamber-ceiling-02.img": 0.5,
    "map-bunker-conch-compartment-ceiling-01.img": 0.5,
    "map-bunker-egg-chamber-ceiling-01.img": 0.5,
    "map-bunker-storm-chamber-ceiling-01.img": 0.5,
    "map-bunker-hydra-ceiling-01.img": 0.5,
    "map-bunker-hydra-chamber-ceiling-01.img": 0.5,
    "map-bunker-hydra-chamber-ceiling-02.img": 0.5,
    "map-bunker-hydra-chamber-ceiling-03.img": 0.5,
    "map-bunker-hydra-compartment-ceiling-02.img": 0.5,
    "map-bunker-hydra-compartment-ceiling-03.img": 0.5,
};

/** Factor between the source image size and the size the definitions' sprite scales expect. */
export function atlasScale(spriteId: string): number {
    return ATLAS_SCALE[spriteId] ?? 1;
}
