// Wire constants: message numbering, object type codes, update sections, disconnect reasons and value ranges.
// Numbering follows the original 0.8.82 protocol 78 message table (docs/research/engine/netcode.md "Message
// types"); Ping/Pong are rebirth additions after the original range.

/** Message type, the first byte of every message in a frame. */
export const MsgType = {
    /** end-of-frame marker (a frame may also simply end) */
    None: 0,
    Join: 1,
    Disconnect: 2,
    Input: 3,
    /** debug edit message (reserved, not implemented) */
    Edit: 4,
    Joined: 5,
    Update: 6,
    Kill: 7,
    GameOver: 8,
    /** pickup feedback (reserved, not implemented) */
    Pickup: 9,
    Map: 10,
    Spectate: 11,
    /** client -> server: drop an item (M7b; original layout: item game type, weapIdx u8) */
    DropItem: 12,
    /** client -> server emote or ping request (M6a) */
    Emote: 13,
    PlayerStats: 14,
    /** original ad-status message (reserved, never used) */
    AdStatus: 15,
    /** original loadout message (reserved, never used) */
    Loadout: 16,
    RoleAnnouncement: 17,
    /** original anti-cheat stats string (reserved, never used) */
    Stats: 18,
    /** reserved, not implemented */
    UpdatePass: 19,
    AliveCounts: 20,
    /** client -> server: Cobalt class choice (M7a; original layout: role game type) */
    PerkModeRoleSelect: 21,
    /** rebirth: client clock probe, echoed by Pong (round-trip time) */
    Ping: 22,
    /** rebirth: echo of a Ping */
    Pong: 23,
} as const;

export type MsgTypeValue = (typeof MsgType)[keyof typeof MsgType];

/** Wire code of each object kind (original ObjectType numbering; 4 bits). */
export const ObjectTypeCode = {
    Player: 1,
    Obstacle: 2,
    Loot: 3,
    DeadBody: 5,
    Building: 6,
    Structure: 7,
    Decal: 8,
    Projectile: 9,
    Smoke: 10,
    Airdrop: 11,
} as const;

export const OBJECT_TYPE_BITS = 4;

/**
 * Update message section flags (u16). Sections appear in bit order (M4 added bits 6-14). Bit 15 (Extended, M5)
 * announces a second u16 flags word (UpdateExtFlag) right after the ack byte, for the sections after DeletePlayerIds.
 */
export const UpdateFlag = {
    DeletedObjects: 1 << 0,
    FullObjects: 1 << 1,
    PartObjects: 1 << 2,
    ActivePlayerId: 1 << 3,
    LocalPlayer: 1 << 4,
    Bullets: 1 << 5,
    /** gas state changed (original Gas section + stage, circleIdx, damage) */
    Gas: 1 << 6,
    /** gas progress changed (original GasCircle) */
    GasT: 1 << 7,
    /** planes in view (sent every update while any) */
    Planes: 1 << 8,
    /** falling air drops in view (sent every update while any) */
    Airdrops: 1 << 9,
    /** new, changed and removed map indicators */
    MapIndicators: 1 << 10,
    /** kill leader changed */
    KillLeader: 1 << 11,
    /** the update follows a spectated player (no payload; ActivePlayerId names it) */
    Spectating: 1 << 12,
    /** players that joined (original PlayerInfos) */
    PlayerInfos: 1 << 13,
    /** players removed from the game (original DeletePlayerIds) */
    DeletePlayerIds: 1 << 14,
    /** a second flags word (UpdateExtFlag) follows the ack byte (M5) */
    Extended: 0x8000,
} as const;

/**
 * Extended Update section flags (u16 after the ack byte when UpdateFlag.Extended is set). Sections follow the
 * DeletePlayerIds section in bit order (M5a: bits 0-3, M5b: bit 4, M6a: bits 5-7, M7a: bit 8, rebirth hit feedback:
 * bit 9). Bits 10-15 are reserved for the sections still to come; a decoder rejects them until they are defined.
 */
export const UpdateExtFlag = {
    /** explosions since the previous update (original Explosions) */
    Explosions: 1 << 0,
    /** projectiles in view (sent every update while any) */
    Projectiles: 1 << 1,
    /** smoke clouds in view (sent every update while any) */
    Smokes: 1 << 2,
    /** live air strike zones (sent every update while any) */
    AirstrikeZones: 1 << 3,
    /** recorders used since the previous update (M5b) */
    Recorders: 1 << 4,
    /** team positions, dead and downed of the viewer's group, when they changed (original PlayerStatus, M6a) */
    PlayerStatus: 1 << 5,
    /** team health and disconnected flags, when they changed (original GroupStatus, M6a) */
    GroupStatus: 1 << 6,
    /** emotes and pings since the previous update (original Emotes, M6a) */
    Emotes: 1 << 7,
    /** 50v50: the viewer's faction on the minimap, when it changed (original faction PlayerStatus, M7a) */
    FactionStatus: 1 << 8,
    /** rebirth: hits the active player dealt or took since the previous update (Snapshot.hits, schema 11) */
    Hits: 1 << 9,
    /** not defined yet */
    Reserved: 0xfc00,
} as const;

/** Reasons carried by the Disconnect message (and the WebSocket close frame). */
export const DisconnectReason = {
    InvalidProtocol: "invalid_protocol",
    InvalidToken: "invalid_token",
    InvalidPacket: "invalid_packet",
    RateLimited: "rate_limited",
    Full: "full",
    JoinTimeout: "join_timeout",
    GameClosed: "game_closed",
    ServerShutdown: "server_shutdown",
    /** rebirth M8: the client's address or name is banned (BAN_FILE); find_game answers 403 {error: "banned"} */
    Banned: "banned",
    /** client side: the socket closed without a reason */
    ConnectionLost: "connection_lost",
    /** client side: find_game failed */
    FindGameFailed: "find_game_failed",
} as const;

export type DisconnectReasonValue = (typeof DisconnectReason)[keyof typeof DisconnectReason];

/** WebSocket close code used together with a Disconnect message (application range 4000-4999). */
export const CLOSE_CODE_DISCONNECT = 4000;

/** Spectate actions (survev spectateMsg.ts; the 0.8.82 message used one flag per action). */
export const SpectateAction = { None: 0, Begin: 1, Next: 2, Prev: 3 } as const;

/** Spectate action of the wire to the simulation's name (null for None / unknown values). */
export function spectateActionName(action: number): "begin" | "next" | "prev" | null {
    switch (action) {
        case SpectateAction.Begin:
            return "begin";
        case SpectateAction.Next:
            return "next";
        case SpectateAction.Prev:
            return "prev";
        default:
            return null;
    }
}

/** Value limits and quantization ranges (survev shared/net/net.ts Constants, same in 0.8.82). */
export const NetLimits = {
    PlayerNameMaxBytes: 16,
    MapNameMaxBytes: 24,
    PlaceNameMaxBytes: 64,
    DisconnectReasonMaxBytes: 64,
    /** toMouseLen range */
    MouseMaxDist: 64,
    /** discrete inputs per Input message (4-bit count); the original client sends at most 7 */
    MaxInputActions: 15,
    ActionMaxDuration: 8.5,
    /** local weapon/switch cooldown range in seconds */
    CooldownMax: 4,
    PlayerMinScale: 0.75,
    PlayerMaxScale: 2,
    MapObjectMinScale: 0.125,
    MapObjectMaxScale: 2.5,
    /** bullet travel distances (survev MaxPosition; the sim caps bullet range at 1024) */
    MaxBulletDist: 1024,
    /** bag item counts (9 bits, original) */
    MaxItemCount: 511,
    /** largest client message the server accepts, in bytes (survev maxPayloadLength) */
    MaxClientMsgBytes: 1024,
} as const;
