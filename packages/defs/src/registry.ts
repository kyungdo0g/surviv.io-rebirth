// Id <-> small integer mapping used to serialize definition ids on the wire, as in the original protocol:
// id 0 is the empty type "", definitions follow in JSON key order (the original client's, then the survev-only ones
// the port takes), then the rebirth-only defs (data.ts), so every original type keeps its original id. Game objects
// use 10 bits, map objects 12.
import { gameObjectsData, mapObjectsData } from "./data.ts";

/**
 * Bump whenever the wire format in @rebirth/protocol changes, so clients built against an older format are rejected
 * at join (it feeds PROTOCOL_HASH). 1: M3 · 2: M4 match sections, M5a effects/extended flags, M5b doors/puzzles/recorders
 * · 3: M6a team/group status, emotes, revive actions · 4: M7a perks, roles and haste of players, faction status and
 * alive counts, bullet tracer flags, PerkModeRoleSelect · 5: M7b frozen players (snowball / potato hits), DropItem
 * · 6: M8 touch movement stick in Input (touchMoveActive bit, touchMoveDir 8+8, touchMoveLen u8) · 7: M9 DeadBody objects
 * (type code 5: layer, playerId u16, pos), bullet tracer speed factor (hasSpeedMult bit + 10 bits), the loot's
 * isPreloadedGun bit · 8: the player action's alternate-reload bit (the Mosin's full reload, original Action.ReloadAlt)
 * as the last field of the player table, in the action group · 9: rebirth air strike variants: each AirstrikeZones
 * record ends with the zone's variant (2 bits, index into AIRSTRIKE_VARIANT_IDS); the rebirth-only bomb_heavy and
 * explosion_bomb_heavy game types and the decal_bomb_heavy_explosion and decal_frag_large_explosion map types follow
 * the generated ones; then (still 9, unreleased) the air drop tier crates crate_10t1, crate_10t2, crate_10svt1 and
 * crate_10svt2 after those map types (the registry change alters PROTOCOL_HASH) · 10: the survev-only guns
 * (tools/port-survev/policy.json): bullet_barrett, bullet_sw500, bullet_ash12, bullet_imbel, bullet_invis,
 * explosion_potato_lmgshot, imbel, spas16, barrett, sw500, ash12, potato_lmg, svd_winter, sv98_winter, awc_winter and
 * potato_lmgshot take game type ids after the original ones and before the rebirth-only ones (bomb_heavy and
 * explosion_bomb_heavy move up by 16); every original id keeps its index. No record layout changed · 11: rebirth hit
 * feedback: the Update message's extended flag bit 9 announces a Hits section after FactionStatus (protocol hits.ts:
 * the hits the active player dealt or took, with amount, headshot, armour and the direction of hits taken) · 12: the
 * rebirth new guns (beta, rebirth/newGuns.ts): the 40mm, rocket and 57mm ammo, the guns' bullets, explosions and the
 * 40 mm grenade, then the 32 guns take game type ids after explosion_bomb_heavy; the three ammo join the bag after
 * 45acp, so the inventory section (5) carries three more rows. No record layout changed otherwise · 13: the rebirth
 * variant strobes (rebirth/strobes.ts): game types strobe_heavy, strobe_carpet, ping_airstrike_heavy and
 * ping_airstrike_carpet after the new guns' ids, and strobe_heavy and strobe_carpet as the last two
 * GameConfig.bagSizes items, so the Local message's inventory section carries two more counts at its end (every
 * earlier id and bag item keeps its place) · 14: survev content wave (tools/port-survev/policy.json): the survev-only
 * melee iceaxe, cutlass, cutlass_gold, naginata_daemon and karambit_borealis, the throwables coconut and tomato with
 * explosion_coconut and explosion_tomato, and the pirate perk take game type ids in survev order among the survev-only
 * ones; the bag gains the coconut and tomato rows (GameConfig.bagSizes order: two more inventory entries in the local
 * player record); later stages of the wave add the level-4 packs, role helmets, six perks and the captain / classless
 * roles, then survev's outfits, emotes and heal / boost effects; the obstacle record gains the original's static isSkin
 * bit + skinPlayerId u16 (obstacle disguises) · 15: survev's presentation flags of the survev content wave's perks:
 * each bullet record ends with an apRounds bit (AP Rounds tracer colour, survev bullet apRounds) and the player table
 * ends with a lastStand bit in the status group (Indomitable Spirit, survev lastStandEffect) · 16: loadouts (survev
 * content wave stage 4b): the Join message ends with survev's loadout (outfit, melee, heal and boost game types, then
 * an 8-bit emote count and the emotes); PlayerInfos carry the heal and boost types in their existing fields.
 * · 17: the potato-faction gold drop (survev parity wave): the survev-only map types crate_13po and
 * airdrop_crate_04po take ids in survev order among the survev-only ones (map ids from crate_17 on move up).
 * · 18: the faction status (FactionStatus) also lists the enemies revealed by firing (survev timeUntilHidden), after
 * the viewer's faction; no record layout changed.
 * · 19: the owner's club secret room (2026-10-08, rebirth/ownerLoot.ts): the rebirth-only map type deposit_box_02_club
 * follows the air drop tier crates as the last map type; every earlier id keeps its index. No record layout changed.
 * · 20: the rebirth buildings (the owner, 2026-10-08; rebirth/buildings.ts): the map types loot_tier_medical, clinic_01,
 * outpost_01r and outpost_01b follow deposit_box_02_club as the last map types. No record layout changed.
 * · 21: bigger maps and more rebirth buildings (the owner, 2026-10-08; rebirth/mapScale.ts, rebirth/buildings): the
 * Emote request's position spans 0..2048 (was the original's 0..1024, which clamped pings on the 1034-unit 50v50
 * map); the new rebirth map types follow outpost_01b as the last map types.
 */
export const PROTOCOL_SCHEMA_VERSION = 21;
export const GAME_OBJECT_TYPE_BITS = 10;
export const MAP_OBJECT_TYPE_BITS = 12;

export class DefRegistry {
    readonly name: string;
    readonly bits: number;
    /** all types including "" at index 0 */
    readonly types: readonly string[];
    private readonly typeToIdMap = new Map<string, number>();

    constructor(name: string, ids: readonly string[], bits: number) {
        this.name = name;
        this.bits = bits;
        const capacity = 2 ** bits;
        if (ids.length + 1 > capacity) {
            throw new Error(`${name}: ${ids.length} types (+ empty type) do not fit in ${bits} bits (max ${capacity})`);
        }
        this.types = Object.freeze(["", ...ids]);
        this.types.forEach((type, id) => {
            if (this.typeToIdMap.has(type)) throw new Error(`${name}: duplicate type "${type}"`);
            this.typeToIdMap.set(type, id);
        });
    }

    /** number of ids in use, including the empty type */
    get size(): number {
        return this.types.length;
    }

    has(type: string): boolean {
        return this.typeToIdMap.has(type);
    }

    typeToId(type: string): number {
        const id = this.typeToIdMap.get(type);
        if (id === undefined) throw new Error(`${this.name}: unknown type "${type}"`);
        return id;
    }

    idToType(id: number): string {
        const type = this.types[id];
        if (type === undefined) throw new Error(`${this.name}: unknown id ${id}`);
        return type;
    }
}

/** 32-bit FNV-1a over the UTF-8 bytes of `text`, as an unsigned integer. */
export function fnv1a32(text: string): number {
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(text)) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** Hash identifying the wire schema: schema version + both id lists in registry order. */
export function computeProtocolHash(
    schemaVersion: number,
    gameObjectIds: readonly string[],
    mapObjectIds: readonly string[],
): number {
    return fnv1a32(`${schemaVersion}\n${gameObjectIds.join(",")}\n${mapObjectIds.join(",")}`);
}

export const GameObjectRegistry = new DefRegistry(
    "GameObjectDefs",
    Object.keys(gameObjectsData),
    GAME_OBJECT_TYPE_BITS,
);
export const MapObjectRegistry = new DefRegistry("MapObjectDefs", Object.keys(mapObjectsData), MAP_OBJECT_TYPE_BITS);

export const PROTOCOL_HASH = computeProtocolHash(
    PROTOCOL_SCHEMA_VERSION,
    GameObjectRegistry.types,
    MapObjectRegistry.types,
);
