// Contract types added by M6a (teams, downed/revive, emotes and pings). They are re-exported from view.ts, whose
// header documents how they are used; consumers import them from "@rebirth/sim" like every other view type.
import type { Vec2 } from "@rebirth/core";
import type { JoinLoadout } from "./match/loadout.ts";

/**
 * One member of the viewer's group in a team mode (the original PlayerStatus + GroupStatus records). Every member is
 * listed, the viewer included, in group join order. `pos`, `dead` and `downed` are refreshed every
 * `rules.teamStatusInterval` seconds (0.25 s, the original PlayerStatus rate) whether or not the member is in view, so
 * clients can draw off-screen arrows and minimap dots; `health` and `disconnected` are live (the original
 * GroupStatus, sent when they change).
 */
export interface TeamMemberView {
    playerId: number;
    /** the member's name (as in PlayerInfoView) */
    name: string;
    /** 0..100 (7 bits on the wire); the bleeding health while downed, 0 once dead */
    health: number;
    downed: boolean;
    dead: boolean;
    /** the member's client left; it stays in the game idle */
    disconnected: boolean;
    /** world position at the last status refresh */
    pos: Vec2;
    /** role id, "" for none (the original PlayerStatus role; M7a) */
    role?: string;
}

/**
 * An emote or a ping (the original UpdateMsg emote record). Emotes float over the player for 0.75 s in + 1 s + 0.1 s
 * out; player pings (`isPing`, def type "ping": ping_danger, ping_coming, ping_help) mark `pos` in the world for the
 * def's `pingLife` and on the map for its `mapLife`, each new ping replacing that player's previous map ping
 * (docs/research/ui/hud.md "Pings and emote wheel").
 */
export interface EmoteEvent {
    /** player who sent it */
    playerId: number;
    /** GameObjectDefs emote or ping id, e.g. "emote_thumbsup", "ping_danger" */
    type: string;
    /** "emote_loot" only: the item shown in the bubble (a Mass Medicate medic's heal or boost), else "" */
    itemType: string;
    isPing: boolean;
    /** pings only: the pinged world position */
    pos?: Vec2;
}

/** An emote or ping a client asks for (the original Emote message, client to server). */
export interface EmoteRequest {
    /** GameObjectDefs emote or ping id */
    type: string;
    isPing: boolean;
    /** pings: the world position to mark (clamped to the map) */
    pos?: Vec2;
}

/** Options of `GameApi.addPlayer` (M6a). */
export interface AddPlayerOptions {
    /**
     * Party key (team modes): players added with the same key join the same group as long as it has room. The server
     * uses one key per party room start (the original find_game group hash).
     */
    group?: string;
    /**
     * Auto fill (team modes, default true): a player or party without a group yet joins an auto-fill group that has
     * room for it, and its new group accepts strangers later. With false the party plays alone (the original "No Fill").
     */
    autoFill?: boolean;
    /** seats the party reserves in its group when its key is first used (default 1) */
    partySize?: number;
    /**
     * Touch client (M8; the original JoinMsg.isMobile): 1.4x loot pickup radius (touchLootRadMult), the mobile scope
     * zoom table, server-side auto loot and auto-opened doors (docs/research/ui/controls.md "Mobile and touch controls").
     */
    isMobile?: boolean;
    /**
     * The Join message's loadout (survev content wave stage 4b): outfit, melee skin, heal / boost particles and emotes;
     * validated against the defs, anything invalid takes the default (match/loadout.ts).
     */
    loadout?: Partial<JoinLoadout>;
}
