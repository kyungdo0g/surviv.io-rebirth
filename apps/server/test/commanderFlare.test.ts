// The 50v50 Commander's automatic flare in a real server room (owner report 2026-10-10: "it never fires"; sim
// rules.roles.leaderAutoFlare, roles/roleSystem.ts autoFlare, docs/research/rebirth-deviations.md "The Commander's
// automatic flare"): in a GameRoom with bot fill, a bot Commander and a human Commander both fire their flare gun on
// the tick 5 s after the promotion, the human's own snapshots carry its flare, and both drops land. A human taking a
// fill bot's seat in the join window never takes the Commander's (the promotion comes 50 s in, inside the 60 s window).

import { MsgType, ServerMsgDecoder } from "@rebirth/protocol";
import { emptyInput, type Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { GameRoom, type RoomMember } from "../src/room.ts";

/** A member whose frames are decoded like a client's: the flare rounds its snapshots carried, by shooter. */
function client() {
    const decoder = new ServerMsgDecoder();
    const flareShooters = new Set<number>();
    const member: RoomMember = {
        ack: 0,
        bufferedAmount: 0,
        sendFrame: (bytes) => {
            for (const m of decoder.decode(bytes)) {
                if (m.type !== MsgType.Update) continue;
                for (const b of m.snapshot.bullets ?? [])
                    if (b.bulletType === "bullet_flare") flareShooters.add(b.shooterId);
            }
        },
    };
    return { decoder, member, flareShooters };
}

/** A faction room filled with `bots` fill bots; the Commanders are promoted `wait` s into the first circle. */
function factionRoom(bots: number, wait: number, seed = 5): GameRoom {
    const room = new GameRoom(
        makeConfig({ log: false, botFill: 0, factionBotFill: bots, botFillIntervalMs: 0 }),
        "faction",
        seed,
        0,
        4,
    );
    // the default schedule promotes 50 s in; a shorter wait keeps the test quick, the flare delay stays 5 s
    room.game.rules.roles.factionSchedule = [{ roles: ["leader"], circleIdx: 0, wait }];
    return room;
}

const leaders = (room: GameRoom): Player[] => [...room.game.players()].filter((p) => p.role === "leader");

describe("the 50v50 Commander's automatic flare in a server room with bot fill", () => {
    it("a bot Commander and a human Commander fire 5 s after the promotion; the drops land", () => {
        const room = factionRoom(12, 2);
        const game = room.game;
        expect(game.rules.roles.leaderAutoFlare).toBe(true);
        expect(game.rules.roles.leaderAutoFlareDelay).toBe(5);
        const c = client();
        const { playerId, frame } = room.join(c.member, "owner");
        c.decoder.decode(frame);
        // the human is its team's pick (a moving player; the other team's Commander is a bot)
        const pick = game.roles.pickPromotable.bind(game.roles);
        game.roles.pickPromotable = (candidates) => candidates.find((p) => p.id === playerId) ?? pick(candidates);
        const flares = new Map<number, number>();
        let promoted = -1;
        for (let i = 0; i < 2000 && (promoted < 0 || game.tick < promoted + 520); i++) {
            const t = game.tick;
            room.setInput(playerId, { ...emptyInput(t), moveUp: (t >> 6) % 2 === 0, moveDown: (t >> 6) % 2 === 1 });
            room.tick();
            for (const { bullet } of game.bullets.reports) {
                if (bullet.bulletType === "bullet_flare" && !flares.has(bullet.shooterId))
                    flares.set(bullet.shooterId, game.tick);
            }
            if (promoted < 0 && leaders(room).length > 0) promoted = game.tick;
        }
        const cmds = leaders(room);
        expect(cmds).toHaveLength(2);
        const human = cmds.find((p) => p.id === playerId);
        const bot = cmds.find((p) => p.id !== playerId);
        expect(human).toBeDefined();
        expect(room.bots?.isBot(bot!.id) ?? false).toBe(true);
        for (const cmd of cmds) {
            // fired on the tick the 5 s were up (the promotion tick counts as the first 0.01 s)
            expect(flares.get(cmd.id), `${cmd.id}`).toBe(promoted + 499);
            expect(cmd.firedFlare).toBe(true);
            const flare = cmd.weaponManager.weapons.find((w) => w.type === "flare_gun");
            expect(flare?.ammo).toBe(0);
        }
        // the human's client was sent its own flare round
        expect(c.flareShooters.has(playerId)).toBe(true);
        // one air drop per flare, and each crate lands on the map
        expect(game.planes.planes.filter((p) => !p.strike)).toHaveLength(2);
        const landed = new Set<number>();
        for (let i = 0; i < 3000 && landed.size < 2; i++) {
            room.tick();
            for (const d of game.planes.airdrops) if (d.landed) landed.add(d.id);
        }
        expect(landed.size).toBe(2);
    }, 60000);

    it("a human joining in the join window takes a fill bot's seat, never the Commander's", () => {
        const room = factionRoom(10, 1, 9);
        const game = room.game;
        for (let i = 0; i < 2000 && !game.started; i++) room.tick();
        expect(game.started).toBe(true);
        // make the Commanders the latest bots to join, the seats humans take first
        const ids = [...game.players()].map((p) => p.id).sort((a, b) => b - a);
        const byTeam = new Map<number, Player>();
        for (const id of ids) {
            const p = game.getPlayer(id)!;
            if (!byTeam.has(p.teamId)) byTeam.set(p.teamId, p);
        }
        game.roles.pickPromotable = (candidates) => candidates.find((p) => byTeam.get(p.teamId) === p);
        while (leaders(room).length === 0) room.tick();
        const cmds = leaders(room).map((p) => p.id);
        expect(cmds.sort()).toEqual([...byTeam.values()].map((p) => p.id).sort());
        const quiet: RoomMember = { ack: 0, bufferedAmount: 0, sendFrame: () => {} };
        for (let i = 0; i < 2; i++) room.join(quiet, `late${i}`);
        expect(
            leaders(room)
                .map((p) => p.id)
                .sort(),
        ).toEqual(cmds);
        expect(room.bots?.count).toBe(8);
        for (let i = 0; i < 500; i++) room.tick();
        for (const id of cmds) expect(game.getPlayer(id)?.firedFlare).toBe(true);
    }, 60000);
});
