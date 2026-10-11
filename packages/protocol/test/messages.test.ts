// Randomized round-trip property tests: every message is encoded and decoded 2000+ times with random contents and
// must come back equal within its quantization tolerance.
import { createRng, type Rng } from "@rebirth/core";
import { PROTOCOL_HASH } from "@rebirth/defs";
import { loadoutChoices } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    type ClientMsg,
    DisconnectReason,
    decodeClientFrame,
    dequantizeUnitVec,
    encodeClientMsg,
    encodeMapMsg,
    encodeServerMsg,
    INPUT_TOUCH_DIR_BITS,
    MsgType,
    type PlayerStatsData,
    ProtocolError,
    peekJoinProtocol,
    quantizeUnit,
    ServerMsgDecoder,
    type ServerSimpleMsg,
    SpectateAction,
    spectateActionName,
    touchMoveLenWire,
} from "../src/index.ts";
import { assertClose, exact } from "./close.ts";
import { netTolerances, randGameType, randInput, randMap, randMapType, randString } from "./gen.ts";

const CASES = 2000;

function pickOf<T>(rng: Rng, list: readonly T[]): T {
    return list[rng.int(0, list.length - 1)];
}

function forCases(seed: number, fn: (rng: Rng, i: number) => void): void {
    const rng = createRng(seed);
    for (let i = 0; i < CASES; i++) fn(rng, i);
}

function clientRoundTrip(msg: ClientMsg): ClientMsg {
    const decoded = decodeClientFrame(encodeClientMsg(msg));
    expect(decoded.length).toBe(1);
    return decoded[0];
}

function serverRoundTrip(msg: ServerSimpleMsg): unknown {
    const decoded = new ServerMsgDecoder().decode(encodeServerMsg(msg));
    expect(decoded.length).toBe(1);
    return decoded[0];
}

function randStats(rng: Rng): PlayerStatsData {
    return {
        playerId: rng.int(0, 65535),
        timeAlive: rng.int(0, 65535),
        kills: rng.int(0, 255),
        dead: rng.bool(),
        damageDealt: rng.int(0, 65535),
        damageTaken: rng.int(0, 65535),
    };
}

describe("client messages", () => {
    it("Join round-trips", () => {
        forCases(1, (rng) => {
            const msg: ClientMsg = {
                type: MsgType.Join,
                protocol: rng.int(0, 2 ** 32 - 1),
                name: randString(rng, 16),
                useTouch: rng.bool(),
                isMobile: rng.bool(),
                bot: rng.bool(),
                // survev content wave stage 4b: survev's loadout at the end
                loadout: {
                    outfit: pickOf(rng, loadoutChoices("outfit")),
                    melee: pickOf(rng, loadoutChoices("melee")),
                    heal: pickOf(rng, loadoutChoices("heal")),
                    boost: pickOf(rng, loadoutChoices("boost")),
                    emotes: Array.from({ length: rng.int(0, 6) }, () => pickOf(rng, loadoutChoices("emote"))),
                },
            };
            assertClose(clientRoundTrip(msg), msg, exact);
        });
    });

    it("Join without a loadout reads back empty ids (the server takes the defaults)", () => {
        const msg: ClientMsg = {
            type: MsgType.Join,
            protocol: 1,
            name: "a",
            useTouch: false,
            isMobile: false,
            bot: true,
        };
        expect(clientRoundTrip(msg)).toEqual({
            ...msg,
            loadout: { outfit: "", melee: "", heal: "", boost: "", emotes: [] },
        });
    });

    it("Input round-trips within tolerance", () => {
        const tol = netTolerances();
        forCases(2, (rng) => {
            const input = randInput(rng);
            const decoded = clientRoundTrip({ type: MsgType.Input, input });
            assertClose(decoded, { type: MsgType.Input, input }, tol);
        });
    });

    it("Ping and Spectate round-trip", () => {
        forCases(3, (rng) => {
            const ping: ClientMsg = { type: MsgType.Ping, nonce: rng.int(0, 2 ** 32 - 1) };
            assertClose(clientRoundTrip(ping), ping, exact);
            const spec: ClientMsg = { type: MsgType.Spectate, action: rng.pick(Object.values(SpectateAction)) };
            assertClose(clientRoundTrip(spec), spec, exact);
        });
        expect([0, 1, 2, 3, 200].map(spectateActionName)).toEqual([null, "begin", "next", "prev", null]);
    });

    it("Emote round-trips (M6a: original layout, positions over 0..2048 with 16 bits since schema 21, only for pings)", () => {
        const posTol = 2048 / 65535 / 2 + 1e-9;
        forCases(31, (rng) => {
            const isPing = rng.bool();
            // up to past the 1126-unit 50v50 map (the original's 0..1024 clamped there)
            const msg: ClientMsg = {
                type: MsgType.Emote,
                emote: isPing
                    ? { type: randGameType(rng), isPing, pos: { x: rng.range(0, 1200), y: rng.range(0, 1200) } }
                    : { type: randGameType(rng), isPing },
            };
            const bytes = encodeClientMsg(msg);
            // type byte + 16 + 16 + 10 + 1 bits, padded
            expect(bytes.length).toBe(1 + 6);
            assertClose(clientRoundTrip(msg), msg, (path) => (path.includes("pos") ? posTol : 0));
        });
    });

    it("PerkModeRoleSelect round-trips (M7a: original layout, role game type + 6 pad bits)", () => {
        forCases(5, (rng) => {
            const msg: ClientMsg = {
                type: MsgType.PerkModeRoleSelect,
                role: rng.pick(["tank", "scout", randGameType(rng)]),
            };
            expect(encodeClientMsg(msg).length).toBe(1 + 2);
            assertClose(clientRoundTrip(msg), msg, exact);
        });
    });

    it("DropItem round-trips (M7b: original layout, item game type + weapIdx u8)", () => {
        forCases(5, (rng) => {
            const msg: ClientMsg = {
                type: MsgType.DropItem,
                item: rng.pick(["762mm", "chest02", "windwalk", randGameType(rng)]),
                weapIdx: rng.int(0, 3),
            };
            // type byte, 10-bit game type and 8-bit index padded to a byte
            expect(encodeClientMsg(msg).length).toBe(1 + 3);
            assertClose(clientRoundTrip(msg), msg, exact);
        });
    });

    it("several messages share one frame", () => {
        forCases(4, (rng) => {
            const msgs: ClientMsg[] = Array.from({ length: rng.int(1, 5) }, () =>
                rng.bool()
                    ? { type: MsgType.Input, input: randInput(rng) }
                    : { type: MsgType.Ping, nonce: rng.int(0, 1e9) },
            );
            const parts = msgs.map(encodeClientMsg);
            const frame = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
            let off = 0;
            for (const p of parts) {
                frame.set(p, off);
                off += p.length;
            }
            assertClose(decodeClientFrame(frame), msgs, netTolerances());
        });
    });

    it("clamps out-of-range input values and caps the action list", () => {
        const input = {
            ...randInput(createRng(9)),
            seq: 300,
            toMouseLen: 500,
            actions: Array.from({ length: 20 }, (_, i) => i),
        };
        const decoded = clientRoundTrip({ type: MsgType.Input, input });
        if (decoded.type !== MsgType.Input) throw new Error("not an input");
        expect(decoded.input.seq).toBe(300 & 0xff);
        expect(decoded.input.toMouseLen).toBe(64);
        expect(decoded.input.actions).toEqual(input.actions.slice(0, 15));
    });

    it("carries the touch stick only while active (M8: bit + 8+8 unit vec + u8, survev inputMsg.ts:39-43)", () => {
        const base = { ...randInput(createRng(11)), actions: [], useItem: undefined };
        delete base.touchMoveActive;
        delete base.touchMoveDir;
        delete base.touchMoveLen;
        const plain = encodeClientMsg({ type: MsgType.Input, input: base });
        // an inactive stick costs one bit; stray direction / length fields are not sent
        const inactive = { ...base, touchMoveActive: false, touchMoveDir: { x: 0, y: 1 }, touchMoveLen: 9 };
        const inactiveBytes = encodeClientMsg({ type: MsgType.Input, input: inactive });
        expect(inactiveBytes).toEqual(plain);
        const decodedInactive = clientRoundTrip({ type: MsgType.Input, input: inactive });
        if (decodedInactive.type !== MsgType.Input) throw new Error("not an input");
        expect(decodedInactive.input.touchMoveActive).toBeUndefined();
        expect(decodedInactive.input.touchMoveDir).toBeUndefined();
        expect(decodedInactive.input.touchMoveLen).toBeUndefined();
        // active: 24 more bits; the pull is rounded and clamped
        const active = { ...base, touchMoveActive: true, touchMoveDir: { x: 0.6, y: -0.8 }, touchMoveLen: 300.4 };
        const activeBytes = encodeClientMsg({ type: MsgType.Input, input: active });
        // seq 8 + 6 flags + touch bit + toMouseDir 20 + toMouseLen 8 + 4 (no actions) + 1 (no item) = 48 bits
        expect(plain.length).toBe(1 + 6);
        expect(activeBytes.length).toBe(1 + 9);
        const decoded = clientRoundTrip({ type: MsgType.Input, input: active });
        if (decoded.type !== MsgType.Input) throw new Error("not an input");
        expect(decoded.input.touchMoveActive).toBe(true);
        expect(decoded.input.touchMoveLen).toBe(255);
        expect(decoded.input.touchMoveDir?.x).toBeCloseTo(0.6, 2);
        expect(decoded.input.touchMoveDir?.y).toBeCloseTo(-0.8, 2);
        const half = clientRoundTrip({ type: MsgType.Input, input: { ...active, touchMoveLen: 127.6 } });
        if (half.type !== MsgType.Input) throw new Error("not an input");
        expect(half.input.touchMoveLen).toBe(128);
        // a missing pull is sent as 255 (the original InputMsg default), NaN as 0
        const missing = clientRoundTrip({ type: MsgType.Input, input: { ...active, touchMoveLen: undefined } });
        if (missing.type !== MsgType.Input) throw new Error("not an input");
        expect(missing.input.touchMoveLen).toBe(255);
        const nan = clientRoundTrip({ type: MsgType.Input, input: { ...active, touchMoveLen: Number.NaN } });
        if (nan.type !== MsgType.Input) throw new Error("not an input");
        expect(nan.input.touchMoveLen).toBe(0);
    });

    it("decodes the touch stick to exactly its quantized wire values", () => {
        forCases(12, (rng) => {
            const input = randInput(rng);
            const decoded = clientRoundTrip({ type: MsgType.Input, input });
            if (decoded.type !== MsgType.Input) throw new Error("not an input");
            if (!input.touchMoveActive || !input.touchMoveDir) {
                expect(decoded.input.touchMoveActive).toBeUndefined();
                return;
            }
            const bits = INPUT_TOUCH_DIR_BITS;
            const dir = input.touchMoveDir;
            expect(decoded.input.touchMoveDir).toEqual(
                dequantizeUnitVec(quantizeUnit(dir.x, bits), quantizeUnit(dir.y, bits), bits),
            );
            expect(decoded.input.touchMoveLen).toBe(touchMoveLenWire(input.touchMoveLen));
        });
    });

    it("rejects malformed and unexpected frames", () => {
        expect(() => decodeClientFrame(new Uint8Array([MsgType.Join, 1, 2]))).toThrow(ProtocolError);
        expect(() => decodeClientFrame(new Uint8Array([MsgType.Update, 0, 0, 0, 0]))).toThrow(ProtocolError);
        expect(() => decodeClientFrame(new Uint8Array([200]))).toThrow(ProtocolError);
        // a 17-byte name is refused
        const long = encodeClientMsg({
            type: MsgType.Join,
            protocol: PROTOCOL_HASH,
            name: "x".repeat(16),
            useTouch: false,
            isMobile: false,
            bot: false,
        });
        const tampered = new Uint8Array([...long.subarray(0, 5), 120, ...long.subarray(5)]);
        expect(() => decodeClientFrame(tampered)).toThrow(ProtocolError);
        expect(decodeClientFrame(new Uint8Array([]))).toEqual([]);
        expect(decodeClientFrame(new Uint8Array([0, 99, 99]))).toEqual([]);
    });

    it("exposes the Join protocol before decoding the rest (hash mismatch -> invalid_protocol)", () => {
        const frame = encodeClientMsg({
            type: MsgType.Join,
            protocol: (PROTOCOL_HASH + 1) >>> 0,
            name: "old",
            useTouch: false,
            isMobile: false,
            bot: false,
        });
        expect(peekJoinProtocol(frame)).toBe((PROTOCOL_HASH + 1) >>> 0);
        expect(peekJoinProtocol(frame)).not.toBe(PROTOCOL_HASH);
        // an old client's Join whose tail no longer parses is still recognized by its protocol field
        expect(peekJoinProtocol(new Uint8Array([MsgType.Join, 78, 0, 0, 0, 0xff]))).toBe(78);
        expect(peekJoinProtocol(encodeClientMsg({ type: MsgType.Ping, nonce: 1 }))).toBeNull();
        expect(DisconnectReason.InvalidProtocol).toBe("invalid_protocol");
    });
});

describe("server messages", () => {
    it("Joined, Disconnect and Pong round-trip", () => {
        forCases(10, (rng) => {
            const joined: ServerSimpleMsg = {
                type: MsgType.Joined,
                teamMode: rng.pick([1, 2, 4]),
                playerId: rng.int(0, 65535),
                started: rng.bool(),
                emotes: Array.from({ length: rng.int(0, 6) }, () => randGameType(rng)),
            };
            assertClose(serverRoundTrip(joined), joined, exact);
            const disc: ServerSimpleMsg = { type: MsgType.Disconnect, reason: randString(rng, 64) };
            assertClose(serverRoundTrip(disc), disc, exact);
            const pong: ServerSimpleMsg = { type: MsgType.Pong, nonce: rng.int(0, 2 ** 32 - 1) };
            assertClose(serverRoundTrip(pong), pong, exact);
        });
    });

    it("Kill round-trips", () => {
        forCases(11, (rng) => {
            const msg: ServerSimpleMsg = {
                type: MsgType.Kill,
                damageType: rng.int(0, 4),
                itemSourceType: randGameType(rng),
                mapSourceType: randMapType(rng),
                targetId: rng.int(0, 65535),
                killerId: rng.int(0, 65535),
                killCreditId: rng.int(0, 65535),
                killerKills: rng.int(0, 255),
                downed: rng.bool(),
                killed: rng.bool(),
            };
            assertClose(serverRoundTrip(msg), msg, exact);
        });
    });

    it("PlayerStats, GameOver, AliveCounts and RoleAnnouncement round-trip", () => {
        forCases(12, (rng) => {
            const stats: ServerSimpleMsg = { type: MsgType.PlayerStats, stats: randStats(rng) };
            assertClose(serverRoundTrip(stats), stats, exact);
            const over: ServerSimpleMsg = {
                type: MsgType.GameOver,
                teamId: rng.int(0, 255),
                teamRank: rng.int(0, 255),
                gameOver: rng.bool(),
                winningTeamId: rng.int(0, 255),
                playerStats: Array.from({ length: rng.int(0, 4) }, () => randStats(rng)),
            };
            assertClose(serverRoundTrip(over), over, exact);
            const alive: ServerSimpleMsg = {
                type: MsgType.AliveCounts,
                teamAliveCounts: Array.from({ length: rng.int(0, 2) }, () => rng.int(0, 255)),
            };
            assertClose(serverRoundTrip(alive), alive, exact);
            const role: ServerSimpleMsg = {
                type: MsgType.RoleAnnouncement,
                playerId: rng.int(0, 65535),
                killerId: rng.int(0, 65535),
                role: randGameType(rng),
                assigned: rng.bool(),
                killed: rng.bool(),
            };
            assertClose(serverRoundTrip(role), role, exact);
        });
    });

    it("a 50v50 GameOver's four cards round-trip: self, both Commanders, the MVP (listed twice when it is one of them)", () => {
        const card = (playerId: number, kills: number) => ({
            playerId,
            timeAlive: 300,
            kills,
            dead: playerId !== 7,
            damageDealt: kills * 120,
            damageTaken: 100,
        });
        const over: ServerSimpleMsg = {
            type: MsgType.GameOver,
            teamId: 2,
            teamRank: 2,
            gameOver: true,
            winningTeamId: 1,
            playerStats: [card(12, 1), card(7, 3), card(12, 1), card(40, 9)],
        };
        assertClose(serverRoundTrip(over), over, exact);
    });

    it("Map round-trips within quantization tolerance", () => {
        forCases(13, (rng) => {
            const map = randMap(rng);
            const decoded = new ServerMsgDecoder().decode(encodeMapMsg(map));
            expect(decoded.length).toBe(1);
            assertClose(decoded[0], { type: MsgType.Map, map }, netTolerances(Math.max(map.width, map.height)));
        });
    }, 60_000);

    it("rejects an Update before the Map", () => {
        expect(() => new ServerMsgDecoder().decode(new Uint8Array([MsgType.Update, 0, 0, 0, 0, 0, 0, 0]))).toThrow(
            ProtocolError,
        );
    });
});
