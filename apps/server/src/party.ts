// Party rooms (M6a): the original team lobby protocol, JSON messages `{type, data}` over the /team_v2 WebSocket (also
// served at /team). A player creates a room (a 4-character code), friends join it by code, the leader picks duo or
// squad, auto fill and region and starts: the server finds one game for the whole party and sends every member its own
// join token for that game, all naming the same party key so the members share a group.
// Message names and shapes follow the original client (survev shared/types/team.ts, server/src/teamMenu.ts;
// docs/research/ui/menus.md "Team lobby"); `joinGame` carries our find_game answer `{url, token}` instead of the
// original `{urls, joinToken}`. Limits follow survev teamMenu.ts: 1 KiB messages, 50 messages/s per socket, 5 sockets
// per IP, 5 s to create or join a room, members silent for 8 minutes are dropped (clients keepAlive every 45 s).
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import type { GameHost } from "./host.ts";

/** Game modes a party may queue for, by the original gameModeIdx (0 solo, 1 duo, 2 squad). */
export const GAME_MODES: ReadonlyArray<{ teamMode: 1 | 2 | 4 }> = [{ teamMode: 1 }, { teamMode: 2 }, { teamMode: 4 }];
/** Indices of the team modes (parties never queue for solo). */
export const TEAM_MODE_IDXS = [1, 2];
/** Room codes: 4 characters without I, O, l, o, 0 (survev generateTeamCode). */
export const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
const CODE_LENGTH = 4;
const NAME_MAX_BYTES = 16;
const REGION_MAX = 32;

export type PartyErrorType =
    | "join_full"
    | "join_not_found"
    | "join_failed"
    | "create_failed"
    | "lost_conn"
    | "find_game_error"
    | "find_game_full"
    | "kicked"
    | "rate_limited";

export interface PartyRoomData {
    /** "#" + code */
    roomUrl: string;
    findingGame: boolean;
    lastError?: PartyErrorType;
    region: string;
    autoFill: boolean;
    enabledGameModeIdxs: number[];
    gameModeIdx: number;
    /** 2 for duo, 4 for squad */
    maxPlayers: number;
    captchaEnabled: boolean;
}

export interface PartyMemberData {
    name: string;
    /** index in the room (0 is the leader) */
    playerId: number;
    isLeader: boolean;
    inGame: boolean;
}

/** Server -> client messages. */
export type PartyServerMsg =
    | { type: "state"; data: { localPlayerId: number; room: PartyRoomData; players: PartyMemberData[] } }
    | { type: "joinGame"; data: { url: string; token: string } }
    | { type: "kicked"; data: Record<string, never> }
    | { type: "error"; data: { type: PartyErrorType } }
    | { type: "keepAlive"; data: Record<string, never> };

const RoomProps = z.object({
    roomUrl: z.string().max(16).optional(),
    findingGame: z.boolean().optional(),
    lastError: z.string().max(32).optional(),
    region: z.string().max(REGION_MAX),
    autoFill: z.boolean(),
    gameModeIdx: z.number().int(),
});
const PlayerData = z.object({ name: z.string().max(64) });

/** Client -> server messages (survev zTeamClientMsg). */
export const PartyClientMsg = z.discriminatedUnion("type", [
    z.object({ type: z.literal("create"), data: z.object({ roomData: RoomProps, playerData: PlayerData }) }),
    z.object({ type: z.literal("join"), data: z.object({ roomUrl: z.string().max(16), playerData: PlayerData }) }),
    z.object({ type: z.literal("changeName"), data: z.object({ name: z.string().max(64) }) }),
    z.object({ type: z.literal("setRoomProps"), data: RoomProps }),
    z.object({ type: z.literal("kick"), data: z.object({ playerId: z.number().int() }) }),
    z.object({
        type: z.literal("playGame"),
        data: z
            .object({
                version: z.number().optional(),
                region: z.string().max(REGION_MAX).optional(),
                zones: z.array(z.string().max(REGION_MAX)).max(16).optional(),
            })
            .optional(),
    }),
    z.object({ type: z.literal("gameComplete"), data: z.object({}).optional() }),
    z.object({ type: z.literal("keepAlive"), data: z.object({}).optional() }),
]);
export type PartyClientMsg = z.infer<typeof PartyClientMsg>;

/** Visible party name: control characters removed, trimmed, at most 16 UTF-8 bytes, "Player" when empty. */
export function partyName(name: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
    let clean = name.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
    const enc = new TextEncoder();
    while (enc.encode(clean).length > NAME_MAX_BYTES) clean = clean.slice(0, -1);
    return clean || "Player";
}

/** One connected lobby client. */
export interface PartyPeer {
    send(msg: PartyServerMsg): void;
    close(): void;
}

export class PartyMember {
    readonly peer: PartyPeer;
    /** ws(s)://host/play URL of this member's server address (the token is appended) */
    readonly playBase: string;
    name = "Player";
    room: PartyRoom | null = null;
    inGame = false;
    /** game the member was sent to (its room closing ends inGame) */
    gameId: string | null = null;
    lastMsgAt: number;

    constructor(peer: PartyPeer, now: number, playBase: string) {
        this.peer = peer;
        this.lastMsgAt = now;
        this.playBase = playBase;
    }
}

export class PartyRoom {
    readonly code: string;
    readonly members: PartyMember[] = [];
    region = "";
    autoFill = true;
    gameModeIdx = TEAM_MODE_IDXS[0];
    findingGame = false;
    lastError: PartyErrorType | undefined;
    /** party starts so far (each start gets its own party key) */
    starts = 0;

    constructor(code: string) {
        this.code = code;
    }

    get maxPlayers(): number {
        return GAME_MODES[this.gameModeIdx].teamMode;
    }

    get leader(): PartyMember | undefined {
        return this.members[0];
    }

    data(): PartyRoomData {
        const data: PartyRoomData = {
            roomUrl: `#${this.code}`,
            findingGame: this.findingGame,
            region: this.region,
            autoFill: this.autoFill,
            enabledGameModeIdxs: [...TEAM_MODE_IDXS],
            gameModeIdx: this.gameModeIdx,
            maxPlayers: this.maxPlayers,
            captchaEnabled: false,
        };
        if (this.lastError) data.lastError = this.lastError;
        return data;
    }
}

/** Dependencies of the lobby: the game host (find a game, issue tokens) and the map parties play. */
export interface PartyDeps {
    host: GameHost;
    mapName: string;
    now?: () => number;
    /** the name filter (M8): offensive party names become "Player" */
    filterName?: (name: string) => string;
}

/** Party rooms by code and the lobby protocol (transport independent; partySocket.ts feeds it). */
export class PartyLobby {
    readonly rooms = new Map<string, PartyRoom>();
    private readonly deps: PartyDeps;
    private readonly now: () => number;

    constructor(deps: PartyDeps) {
        this.deps = deps;
        this.now = deps.now ?? Date.now;
    }

    /** A member's visible name: cleaned (partyName), then the name filter (M8). */
    private memberName(raw: string): string {
        const name = partyName(raw);
        return this.deps.filterName ? this.deps.filterName(name) : name;
    }

    /** A new code unused by any room (crypto random, survev's alphabet). */
    private newCode(): string {
        for (;;) {
            let code = "";
            for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
            if (!this.rooms.has(code)) return code;
        }
    }

    /** Handles one decoded message of `member` (create / join before anything else, survev TeamMenu.onMsg). */
    handle(member: PartyMember, msg: PartyClientMsg): void {
        member.lastMsgAt = this.now();
        if (!member.room) {
            if (msg.type === "create") {
                const room = new PartyRoom(this.newCode());
                this.applyProps(room, msg.data.roomData);
                this.rooms.set(room.code, room);
                member.name = this.memberName(msg.data.playerData.name);
                this.addMember(room, member);
            } else if (msg.type === "join") {
                const code = msg.data.roomUrl.replace(/^#/, "");
                const room = this.rooms.get(code);
                if (!room) {
                    this.fail(member, "join_not_found");
                } else if (room.members.length >= room.maxPlayers) {
                    this.fail(member, "join_full");
                } else {
                    member.name = this.memberName(msg.data.playerData.name);
                    this.addMember(room, member);
                }
            } else {
                // anything else before being in a room closes the socket (survev)
                member.peer.close();
            }
            return;
        }
        const room = member.room;
        const isLeader = room.leader === member;
        switch (msg.type) {
            case "changeName":
                member.name = this.memberName(msg.data.name);
                this.sendState(room);
                break;
            case "keepAlive":
                member.peer.send({ type: "keepAlive", data: {} });
                break;
            case "gameComplete":
                member.inGame = false;
                member.gameId = null;
                this.sendState(room);
                break;
            case "setRoomProps":
                if (!isLeader) break;
                this.applyProps(room, msg.data);
                // members that no longer fit are kicked, last joiners first (survev setProps)
                while (room.members.length > room.maxPlayers) this.kick(room, room.members.length - 1);
                this.sendState(room);
                break;
            case "kick":
                if (isLeader && msg.data.playerId !== 0) this.kick(room, msg.data.playerId);
                break;
            case "playGame":
                if (isLeader) this.playGame(room, msg.data?.region);
                break;
            default:
                break;
        }
    }

    private fail(member: PartyMember, type: PartyErrorType): void {
        member.peer.send({ type: "error", data: { type } });
        member.peer.close();
    }

    private applyProps(room: PartyRoom, props: z.infer<typeof RoomProps>): void {
        room.region = props.region;
        room.autoFill = props.autoFill;
        room.gameModeIdx = TEAM_MODE_IDXS.includes(props.gameModeIdx) ? props.gameModeIdx : TEAM_MODE_IDXS[0];
    }

    private addMember(room: PartyRoom, member: PartyMember): void {
        room.members.push(member);
        member.room = room;
        this.sendState(room);
    }

    private kick(room: PartyRoom, index: number): void {
        const member = room.members[index];
        if (!member) return;
        member.peer.send({ type: "kicked", data: {} });
        this.remove(member);
        member.peer.close();
    }

    /** A member left (socket closed, kicked, idle): the next member leads, an empty room disappears. */
    remove(member: PartyMember): void {
        const room = member.room;
        if (!room) return;
        member.room = null;
        const i = room.members.indexOf(member);
        if (i >= 0) room.members.splice(i, 1);
        if (room.members.length === 0) this.rooms.delete(room.code);
        else this.sendState(room);
    }

    /**
     * The leader starts (survev Room.findGame): one game of the party's mode with room for every member, then a join
     * token per member, all with the same party key, auto fill flag and party size.
     */
    private playGame(room: PartyRoom, region: string | undefined): void {
        if (room.findingGame || room.members.some((m) => m.inGame)) return;
        if (region !== undefined) room.region = region;
        const teamMode = GAME_MODES[room.gameModeIdx].teamMode;
        const partySize = room.members.length;
        const host = this.deps.host;
        const game = host.findRoom(this.deps.mapName, teamMode, partySize);
        if (!game) {
            room.lastError = "find_game_full";
            this.sendState(room);
            return;
        }
        room.lastError = undefined;
        room.starts++;
        const group = {
            group: `party:${room.code}:${room.starts}:${randomUUID()}`,
            autoFill: room.autoFill,
            partySize,
        };
        for (const m of room.members) {
            const token = host.tokens.issue(game.id, group);
            m.inGame = true;
            m.gameId = game.id;
            const url = `${m.playBase}?token=${encodeURIComponent(token)}`;
            m.peer.send({ type: "joinGame", data: { url, token } });
        }
        this.sendState(room);
    }

    /** A game closed: its party members are back in their lobby. */
    onGameClosed(gameId: string): void {
        for (const room of this.rooms.values()) {
            let changed = false;
            for (const m of room.members) {
                if (m.gameId !== gameId) continue;
                m.inGame = false;
                m.gameId = null;
                changed = true;
            }
            if (changed) this.sendState(room);
        }
    }

    /** Drops members silent for longer than `idleMs` with a lost_conn error (survev: 8 minutes). */
    sweep(idleMs: number): void {
        const now = this.now();
        for (const room of [...this.rooms.values()]) {
            for (const m of [...room.members]) {
                if (now - m.lastMsgAt <= idleMs) continue;
                m.peer.send({ type: "error", data: { type: "lost_conn" } });
                this.remove(m);
                m.peer.close();
            }
        }
    }

    sendState(room: PartyRoom): void {
        const players = room.members.map((m, i) => ({
            name: m.name,
            playerId: i,
            isLeader: i === 0,
            inGame: m.inGame,
        }));
        const data = room.data();
        room.members.forEach((m, i) => {
            m.peer.send({ type: "state", data: { localPlayerId: i, room: data, players } });
        });
    }
}
