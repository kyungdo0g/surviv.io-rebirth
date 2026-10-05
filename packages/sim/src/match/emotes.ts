// Emotes and pings: a player's emote / ping requests (the original Emote message) with the original throttle, the
// medic's automatic "emote_loot", and per-viewer delivery: regular emotes reach the players who see the emoter,
// team-only emotes the emoter's group or team among them, player pings the emoter's group wherever it is.
// Behaviour follows survev server/src/game/objects/player.ts emoteFromMsg / emoteFromSlot and the emote cooldown
// block of update, client.ts getUpdateMsg shouldSendEmote; docs/research/ui/hud.md "Pings and emote wheel".
// M7a: a Commander's pings reach its whole faction (survev client.ts: leader pings to the team; fandom Commander);
// Cobalt players cannot emote before choosing a class; Gabby Ghost emotes come from perks/effects.ts.
// TODO(M8): loadouts: the death emote 0.3 s after dying and the win emote 1 s after the game over (slots 4 and 5,
// empty by default).
import { math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, getMapDef, hasDef } from "@rebirth/defs";
import type { EmoteEvent, EmoteRequest } from "../view.ts";
import type { Player } from "../world/player.ts";
import { EventLog } from "./events.ts";

const PLAYER = GameConfig.player;
/** Emote wheel slots a regular emote must come from (survev emoteFromMsg: slots 0-3). */
const WHEEL_SLOTS = 4;
/** survev multiplies both cooldowns by 1.5: the counter decays every 3 s, a full counter blocks emotes for 9 s */
const COOLDOWN_SCALE = 1.5;

interface EmoteDefLike {
    type: string;
    teamOnly?: boolean;
    mapEvent?: boolean;
}

function emoteDef(type: string): EmoteDefLike | undefined {
    if (!type || !hasDef(type)) return undefined;
    const def = GameObjectDefs[type] as EmoteDefLike;
    return def.type === "emote" || def.type === "ping" ? def : undefined;
}

/** Per tick: the emote counter decays by one every 3 s, or resets once a 9 s block ran out (survev update). */
export function updateEmoteThrottle(player: Player, dt: number): void {
    player.emoteSoftTicker -= dt;
    if (player.emoteCounter >= PLAYER.emoteThreshold && player.emoteHardTicker > 0) {
        player.emoteHardTicker -= dt;
        if (player.emoteHardTicker < 0) player.emoteCounter = 0;
    } else if (player.emoteSoftTicker < 0 && player.emoteCounter > 0) {
        player.emoteCounter--;
        player.emoteSoftTicker = PLAYER.emoteSoftCooldown * COOLDOWN_SCALE;
    }
}

interface Entry {
    event: EmoteEvent;
    groupId: number;
    teamId: number;
    teamOnly: boolean;
    /** a Commander's ping: the whole faction receives it */
    teamPing: boolean;
}

/** What the emote system needs from the game. */
export interface EmoteHost {
    readonly tick: number;
    /** Cobalt (perkMode): no emotes before a class is chosen */
    readonly options: { mapName: string };
    readonly mapData: { width: number; height: number };
    nextEventSeq(): number;
    getPlayer(id: number): Player | undefined;
}

export class EmoteSystem {
    private readonly host: EmoteHost;
    private readonly log = new EventLog<Entry>();

    constructor(host: EmoteHost) {
        this.host = host;
    }

    /**
     * An emote or ping request (survev emoteFromMsg). Ignored for dead players, while the throttle blocks emotes, for
     * unknown types, map-event pings (air drops, air strikes: the server places those) and regular emotes outside the
     * player's wheel. Returns whether it was accepted.
     */
    request(player: Player, req: EmoteRequest): boolean {
        if (player.dead || player.emoteHardTicker > 0) return false;
        // Cobalt players cannot emote before choosing a class (survev emoteFromMsg: perkModeTwinsBunker && !role)
        if (!player.role && getMapDef(this.host.options.mapName).gameMode.perkMode) return false;
        const def = emoteDef(req.type);
        if (!def) return false;
        if (req.isPing) {
            if (def.type !== "ping" || def.mapEvent) return false;
            const pos = req.pos ?? player.pos;
            const { width, height } = this.host.mapData;
            const clamped = { x: math.clamp(pos.x, 0, width), y: math.clamp(pos.y, 0, height) };
            if (!Number.isFinite(clamped.x) || !Number.isFinite(clamped.y)) return false;
            this.push(player, { playerId: player.id, type: req.type, itemType: "", isPing: true, pos: clamped }, false);
        } else {
            if (def.type !== "emote") return false;
            if (def.teamOnly) {
                this.add(player, req.type);
            } else {
                const slot = player.emoteLoadout.indexOf(req.type);
                if (slot < 0 || slot >= WHEEL_SLOTS) return false;
                this.add(player, player.emoteLoadout[slot]);
            }
        }
        player.emoteCounter++;
        if (player.emoteCounter >= PLAYER.emoteThreshold && !(player.emoteHardTicker > 0)) {
            player.emoteHardTicker = PLAYER.emoteHardCooldown * COOLDOWN_SCALE;
        }
        return true;
    }

    /** An emote over `player` (survev addEmote; the medic's "emote_loot" carries the item). Not throttled. */
    add(player: Player, type: string, itemType = ""): void {
        const def = emoteDef(type);
        if (def?.type !== "emote") return;
        this.push(player, { playerId: player.id, type, itemType, isPing: false }, !!def.teamOnly);
    }

    private push(player: Player, event: EmoteEvent, teamOnly: boolean): void {
        this.log.push(this.host.nextEventSeq(), this.host.tick, {
            event,
            groupId: player.groupId,
            teamId: player.teamId,
            teamOnly,
            teamPing: event.isPing && player.role === "leader",
        });
    }

    /**
     * Emotes and pings logged after `seq` that `viewer` (the active player of a snapshot) receives (survev
     * shouldSendEmote): emotes need the emoter in view (`visible`); regular ones then always go, team-only ones to the
     * emoter's group or team; pings go to the emoter's group.
     */
    eventsFor(viewer: Player, visible: ReadonlySet<number>, seq: number): EmoteEvent[] {
        const out: EmoteEvent[] = [];
        for (const e of this.log.since(seq)) {
            const ev = e.event;
            const sameGroup = e.groupId === viewer.groupId;
            if (ev.isPing) {
                if (!sameGroup && !(e.teamPing && e.teamId === viewer.teamId)) continue;
            } else {
                if (!visible.has(ev.playerId)) continue;
                if (e.teamOnly && !sameGroup && e.teamId !== viewer.teamId) continue;
            }
            out.push(ev.pos ? { ...ev, pos: v2.copy(ev.pos as Vec2) } : { ...ev });
        }
        return out;
    }

    prune(minTick: number): void {
        this.log.prune(minTick);
    }
}
