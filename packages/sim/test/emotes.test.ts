// Emotes, pings and the team HUD data (M6a): who receives an emote, a team-only emote or a ping, the original throttle
// (6 in a row block emotes for 9 s, the counter decays by one every 3 s), and the team status rows with their 0.25 s
// position refresh.
import { v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { EmoteEvent, Game, Player } from "../src/index.ts";
import { openSpot, steps } from "./combatHelpers.ts";
import { addAt, flatTeamGame, hit, party } from "./teamHelpers.ts";

function setup() {
    const game = flatTeamGame(2);
    const at = openSpot(game, 60);
    const [a, mate] = party(game, "A", 2, at, 3);
    // an enemy next to A, another enemy far away
    const near = addAt(game, "near", v2.add(at, { x: 0, y: 4 }), { group: "N", autoFill: false });
    const far = addAt(game, "far", v2.add(at, { x: 0, y: 200 }), { group: "F", autoFill: false });
    // the teammate far away too
    game.teleportPlayer(mate.id, v2.add(at, { x: 200, y: 0 }));
    game.step();
    for (const p of [a, mate, near, far]) game.getSnapshot(p.id);
    return { game, a, mate, near, far };
}

function received(game: Game, players: readonly Player[]): Map<number, EmoteEvent[]> {
    return new Map(players.map((p) => [p.id, game.getSnapshot(p.id).emotes ?? []]));
}

describe("emote delivery", () => {
    it("a wheel emote reaches the players who see the emoter; emotes outside the wheel are refused", () => {
        const { game, a, mate, near, far } = setup();
        game.emote(a.id, { type: "emote_thumbsup", isPing: false });
        game.emote(a.id, { type: "emote_flagisrael", isPing: false });
        game.step();
        const got = received(game, [a, mate, near, far]);
        const ev = { playerId: a.id, type: "emote_thumbsup", itemType: "", isPing: false };
        expect(got.get(a.id)).toEqual([ev]);
        expect(got.get(near.id)).toEqual([ev]);
        expect(got.get(mate.id)).toEqual([]);
        expect(got.get(far.id)).toEqual([]);
        // each emote is delivered once
        game.step();
        expect(game.getSnapshot(near.id).emotes).toEqual([]);
        expect(GameConfig.defaultEmoteLoadout.slice(0, 4)).toContain("emote_thumbsup");
    });

    it("team-only emotes reach the group members who see the emoter; pings reach the group anywhere", () => {
        const { game, a, mate, near, far } = setup();
        game.emote(a.id, { type: "emote_medical", isPing: false });
        game.emote(a.id, { type: "ping_danger", isPing: true, pos: { x: 100, y: 120 } });
        // map-event pings are the server's: refused
        game.emote(a.id, { type: "ping_airdrop", isPing: true, pos: { x: 100, y: 120 } });
        game.step();
        const got = received(game, [a, mate, near, far]);
        const ping = { playerId: a.id, type: "ping_danger", itemType: "", isPing: true, pos: { x: 100, y: 120 } };
        expect(got.get(a.id)).toEqual([{ playerId: a.id, type: "emote_medical", itemType: "", isPing: false }, ping]);
        expect(got.get(mate.id)).toEqual([ping]);
        expect(got.get(near.id)).toEqual([]);
        expect(got.get(far.id)).toEqual([]);
        // ping positions are clamped to the map
        game.emote(a.id, { type: "ping_coming", isPing: true, pos: { x: -50, y: 1e6 } });
        game.step();
        expect(game.getSnapshot(mate.id).emotes?.[0].pos).toEqual({ x: 0, y: game.mapData.height });
    });

    it("throttles like the original: the 7th emote in a row is refused, emotes are blocked for 9 s", () => {
        const { game, a, near } = setup();
        const send = () => game.emote(a.id, { type: "emote_happyface", isPing: false });
        for (let i = 0; i < 7; i++) send();
        game.step();
        expect(game.getSnapshot(near.id).emotes?.length).toBe(6);
        steps(game, 899);
        send();
        game.step();
        expect(game.getSnapshot(near.id).emotes?.length).toBe(0);
        steps(game, 2);
        send();
        game.step();
        expect(game.getSnapshot(near.id).emotes?.length).toBe(1);
    });

    it("the counter decays by one every 3 s, so a slow emoter is never blocked", () => {
        const { game, a, near } = setup();
        let total = 0;
        for (let i = 0; i < 20; i++) {
            game.emote(a.id, { type: "emote_sadface", isPing: false });
            steps(game, 300);
            total += game.getSnapshot(near.id).emotes?.length ?? 0;
        }
        expect(total).toBe(20);
        expect(a.emoteHardTicker).toBeLessThanOrEqual(0);
    });

    it("dead players cannot emote", () => {
        const { game, a, near } = setup();
        hit(game, a, 999, near);
        steps(game, 11);
        hit(game, a, 999, near);
        expect(a.dead).toBe(true);
        game.emote(a.id, { type: "emote_happyface", isPing: false });
        game.step();
        expect(game.getSnapshot(near.id).emotes).toEqual([]);
    });
});

describe("team status", () => {
    it("lists every group member with live health and positions refreshed every 0.25 s", () => {
        const { game, a, mate, near } = setup();
        const team = game.getSnapshot(a.id).local.team!;
        expect(team.map((m) => m.playerId)).toEqual([a.id, mate.id]);
        expect(team[1]).toMatchObject({ name: mate.name, health: 100, downed: false, dead: false, disconnected: false });
        // the enemy in view is not in the team
        expect(game.getSnapshot(near.id).local.team?.map((m) => m.playerId)).toEqual([near.id]);
        // positions follow every 25 ticks; health and disconnects at once
        while (game.tick % 25 !== 0) game.step();
        // a refresh just happened; the next one comes with the 25th step from here
        steps(game, 24);
        const start = v2.copy(mate.pos);
        game.teleportPlayer(mate.id, v2.add(start, { x: 10, y: 0 }));
        hit(game, mate, 30, near);
        mate.disconnected = true;
        const now = game.getSnapshot(a.id).local.team![1];
        expect(now.health).toBe(70);
        expect(now.disconnected).toBe(true);
        expect(now.pos).toEqual(start);
        game.step();
        expect(game.getSnapshot(a.id).local.team![1].pos).toEqual(v2.add(start, { x: 10, y: 0 }));
        // knocks show after the next refresh
        mate.disconnected = false;
        hit(game, mate, 999, near);
        expect(game.getSnapshot(a.id).local.team![1].downed).toBe(false);
        steps(game, 25);
        expect(game.getSnapshot(a.id).local.team![1]).toMatchObject({ downed: true, health: 100 });
    });
});
