// Id <-> small integer mapping used to serialize definition ids on the wire, as in the original protocol:
// id 0 is the empty type "", definitions follow in JSON key order, then the rebirth-only defs (data.ts), so every
// original type keeps its original id. Game objects use 10 bits, map objects 12.
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
 * the generated ones.
 */
export const PROTOCOL_SCHEMA_VERSION = 9;
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
