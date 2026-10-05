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
    /** reserved, not implemented */
    DropItem: 12,
    /** reserved, not implemented */
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
    /** reserved, not implemented */
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
 * Update message section flags (u16). Sections appear in bit order. Bits 6-15 are reserved for the sections of the
 * original UpdateMsg still to come (gas, player infos/status, explosions, emotes, planes...); a decoder rejects them
 * until they are defined, and bit 15 is kept to announce a second flags word.
 */
export const UpdateFlag = {
    DeletedObjects: 1 << 0,
    FullObjects: 1 << 1,
    PartObjects: 1 << 2,
    ActivePlayerId: 1 << 3,
    LocalPlayer: 1 << 4,
    Bullets: 1 << 5,
    /** reserved: Gas 6, GasCircle 7, PlayerInfos 8, DeletePlayerIds 9, PlayerStatus 10, GroupStatus 11,
     * Explosions 12, Emotes 13, Planes 14, ExtendedFlags 15 */
    Reserved: 0xffc0,
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
    /** client side: the socket closed without a reason */
    ConnectionLost: "connection_lost",
    /** client side: find_game failed */
    FindGameFailed: "find_game_failed",
} as const;

export type DisconnectReasonValue = (typeof DisconnectReason)[keyof typeof DisconnectReason];

/** WebSocket close code used together with a Disconnect message (application range 4000-4999). */
export const CLOSE_CODE_DISCONNECT = 4000;

/** Spectate actions (survev spectateMsg.ts). */
export const SpectateAction = { None: 0, Begin: 1, Next: 2, Prev: 3 } as const;

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
