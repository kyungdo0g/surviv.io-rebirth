// Rebirth-only game objects and map objects (not in v0.8.82), appended after the generated ones so every original type
// keeps its wire id. Deliberate rebirth additions requested by the user (2026-10-07): the heavy shell of the "heavy"
// 50v50 air strike variant (rebirth/airstrikeVariants.ts holds its values and why), the scorch decals of the two
// enlarged blasts (the heavy shell, the x1.3 frag grenade) and the tier 1 / tier 2 inner crates of the normal air drop
// (rebirth/airdropTiers.ts, airdropLoot.ts); then the owner's new guns with their ammo, bullets and explosions
// (rebirth/newGuns.ts, the beta of 2026-10-07); then the variant strobes and their air strike pings
// (rebirth/strobes.ts), then the owner's Molotov and flashbang (rebirth/throwables.ts). The owner's club gun box
// (2026-10-08, rebirth/ownerLoot.ts) follows the air drop crates.
import type { DecalDef, ExplosionDef, GameObjectDef, MapObjectDef, PingDef, ThrowableDef } from "../types/index.ts";
import { airdropTierCrates } from "./airdropLoot.ts";
import {
    HEAVY_BOMB_DECAL_TYPE,
    HEAVY_BOMB_EFFECT_TYPE,
    HEAVY_BOMB_EXPLOSION,
    HEAVY_BOMB_SPRITE_SCALE,
    IRON_BOMB_RAD_MAX,
} from "./airstrikeVariants.ts";
import { rebirthWallDefs } from "./buildings/walls.ts";
import { rebirthBuildings, rebirthWave3Defs } from "./buildings.ts";
import { FRAG_DECAL_TYPE, FRAG_RADIUS_MULT, IRON_BOMB_DECAL_TYPE, scaleDefValue } from "./deviations.ts";
import { rebirthGroundDecals } from "./discardDecals.ts";
import { newGunDefs } from "./newGuns.ts";
import { CLUB_VAULT_BOX, clubVaultBox } from "./ownerLoot.ts";
import { airstrikePingDefs, strobeVariantDefs } from "./strobes.ts";
import { rebirthThrowableDefs } from "./throwables.ts";

/**
 * The rebirth-only game objects, built from the generated air strike bomb so they follow its sprites, sounds and
 * physics: `bomb_heavy` is bomb_iron with its own explosion and a bigger sprite; `explosion_bomb_heavy` is
 * explosion_bomb_iron with the heavy shell's damage, radius and shrapnel, its own client explosion effect
 * ("bomb_heavy": a bigger, longer burst sized from the radius, a lower and louder boom and a stronger shake;
 * apps/client fx/explosions.ts) and its own, larger scorch decal. Both keep the iron bomb's shrapnel type. The new guns
 * and their defs follow (newGunDefs), so the air strike ids keep their place; then the variant strobes `strobe_heavy`
 * and `strobe_carpet`, built from `deviated`'s strobe (its survev strikeDelay), and their pings `ping_airstrike_heavy`
 * and `ping_airstrike_carpet` (rebirth/strobes.ts).
 */
export function rebirthOnlyDefs(
    generated: Readonly<Record<string, GameObjectDef>>,
    deviated: Readonly<Record<string, GameObjectDef>> = generated,
): Record<string, GameObjectDef> {
    const iron = generated.bomb_iron as ThrowableDef;
    const ironExplosion = generated.explosion_bomb_iron as ExplosionDef;
    const bombHeavy: ThrowableDef = {
        ...iron,
        name: "Heavy Bomb",
        explosionType: "explosion_bomb_heavy",
        worldImg: { ...iron.worldImg, scale: HEAVY_BOMB_SPRITE_SCALE },
    };
    const explosionHeavy: ExplosionDef = {
        ...ironExplosion,
        damage: HEAVY_BOMB_EXPLOSION.damage,
        obstacleDamage: HEAVY_BOMB_EXPLOSION.obstacleDamage,
        rad: { ...HEAVY_BOMB_EXPLOSION.rad },
        explosionEffectType: HEAVY_BOMB_EFFECT_TYPE,
        decalType: HEAVY_BOMB_DECAL_TYPE,
        shrapnelCount: HEAVY_BOMB_EXPLOSION.shrapnelCount,
    };
    return {
        bomb_heavy: bombHeavy,
        explosion_bomb_heavy: explosionHeavy,
        ...newGunDefs(),
        ...strobeVariantDefs(deviated.strobe as ThrowableDef),
        ...airstrikePingDefs(generated.ping_airstrike as PingDef),
        // the owner's Molotov and flashbang (2026-10-10, rebirth/throwables.ts), built from the frag
        ...rebirthThrowableDefs(deviated.frag as ThrowableDef),
    };
}

/** `decal` with its sprite scaled by `mult` (same sprite, tint, layer, lifetime and fade chance). */
function scaledDecal(decal: DecalDef, mult: number): DecalDef {
    return { ...decal, img: { ...decal.img, scale: scaleDefValue(decal.img.scale, mult) } };
}

/**
 * The rebirth-only map objects:
 * - scorch decals that grow with the enlarged blasts, by the blast radius ratio over the decal the explosion it is
 *   built from leaves (both originals draw map-barrel-res-01 at 0.2): `decal_bomb_heavy_explosion` is the rebirth
 *   decal_bomb_iron_explosion (`deviated`'s: 0.2 x 1.25 = 0.25 with the iron bomb's 17.5 u blast, rebirth/deviations.ts)
 *   x 47.5 / 17.5 (-> ~0.679, 0.2 x 47.5 / 14), left by explosion_bomb_heavy; `decal_frag_large_explosion` is
 *   decal_frag_explosion x 1.3 (0.2 -> 0.26), left by the rebirth frag grenade (rebirth/deviations.ts) and the M202
 *   FLASH's 16 u rockets (rebirth/newGuns.json); the MIRV keeps decal_frag_explosion.
 * - the air drop tier inner crates crate_10t1, crate_10t2, crate_10svt1 and crate_10svt2 (rebirth/airdropLoot.ts);
 * - the club secret room's gun box deposit_box_02_club, deposit_box_02 rolling its gun from tier_club_vault (the
 *   owner, 2026-10-08; rebirth/ownerLoot.ts).
 * - the rebirth buildings clinic_01, outpost_01r and outpost_01b and their loot_tier_medical (rebirth/buildings.ts).
 * - the ground decals of 2026-10-10: the Molotov's fire and the discarded launchers (rebirth/discardDecals.ts).
 * - the breakable partitions rebirth_wall_int_<length> (2026-10-10, rebirth/buildings/walls.ts; schema 26).
 * - wave 3 (2026-10-10, rebirth/buildings.ts rebirthWave3Defs; schema 27).
 */
export function rebirthOnlyMapObjects(
    generated: Readonly<Record<string, MapObjectDef>>,
    deviated: Readonly<Record<string, MapObjectDef>> = generated,
): Record<string, MapObjectDef> {
    const ironDecal = deviated[IRON_BOMB_DECAL_TYPE] as DecalDef;
    const fragDecal = generated.decal_frag_explosion as DecalDef;
    return {
        [HEAVY_BOMB_DECAL_TYPE]: scaledDecal(ironDecal, HEAVY_BOMB_EXPLOSION.rad.max / IRON_BOMB_RAD_MAX),
        [FRAG_DECAL_TYPE]: scaledDecal(fragDecal, FRAG_RADIUS_MULT),
        ...airdropTierCrates(generated),
        [CLUB_VAULT_BOX]: clubVaultBox(generated),
        ...rebirthBuildings(generated),
        // the Molotov's burning ground and the discarded launchers' bodies (2026-10-10, rebirth/discardDecals.ts)
        ...rebirthGroundDecals(),
        // the rebirth buildings' breakable partitions (the owner, 2026-10-10: "the walls can't be broken"), after
        // every earlier id (schema 26)
        ...rebirthWallDefs(generated),
        // the owner's wave 3 (2026-10-10, schema 27): breakable shells, explosion-gated doors, the new buildings
        ...rebirthWave3Defs(generated),
    };
}
