// 50v50 Faction mode (M7a): team balance and squads inside factions, spawn bands, faction-wide teammates and wipes,
// the win condition and results, the role schedule with its AFK filter, Lone Survivr, the optional Commander
// succession, alive counts and the faction minimap rows, the air strike / gold drop schedules, the comeback drop, and
// the faction map's team buildings and statues. Values: docs/research/modes/faction.md, items/roles.md, conflicts.md.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type GameInit, type Player, type RoleAnnouncementEvent } from "../src/index.ts";
import { cachedMap } from "./helpers.ts";

const SEED = 7;

function factionGame(init: GameInit = {}): Game {
    const generation = cachedMap("faction", SEED, 4);
    const game = new Game({ mapName: "faction", seed: SEED, teamMode: 4 }, { generation, spawnLoot: false, ...init });
    game.rules.minActiveTime = 0;
    return game;
}

function add(game: Game, n: number, prefix = "p"): Player[] {
    return Array.from({ length: n }, (_, i) => game.getPlayer(game.addPlayer(`${prefix}${i}`))!);
}

function watchRoles(game: Game): Array<RoleAnnouncementEvent & { tick: number }> {
    const out: Array<RoleAnnouncementEvent & { tick: number }> = [];
    const announce = game.match.announce.bind(game.match);
    game.match.announce = (e) => {
        out.push({ ...e, tick: game.tick });
        announce(e);
    };
    return out;
}

function kill(game: Game, target: Player, source?: Player): void {
    game.damagePlayer(target, {
        amount: 1000,
        damageType: DamageType.Player,
        sourceId: source?.id ?? 0,
        gameSourceType: source ? "ak47" : undefined,
        dir: { x: 1, y: 0 },
    });
}

/** Kills `target` for good: a knock first when its faction still stands, then the finish after the damage buffer. */
function finish(game: Game, target: Player, source?: Player): void {
    kill(game, target, source);
    if (!target.downed) return;
    for (let i = 0; i < 12; i++) game.step();
    kill(game, target, source);
}

/** Moves every player in `players` a little each tick (they stay active for the AFK filter). */
function keepMoving(game: Game, players: readonly Player[]): void {
    for (const p of players) {
        game.setInput(p.id, { ...p.input, moveLeft: game.tick % 200 < 100, moveRight: game.tick % 200 >= 100 });
    }
}

describe("teams", () => {
    it("joiners go to the faction with fewer living players; squads of 4 never mix factions (faction.md Teams)", () => {
        const game = factionGame();
        expect(game.options.teamMode).toBe(4);
        const players = add(game, 10);
        expect(players.map((p) => p.teamId)).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
        const party = Array.from(
            { length: 4 },
            (_, i) => game.getPlayer(game.addPlayer(`party${i}`, { group: "k", partySize: 4, autoFill: false }))!,
        );
        expect(new Set(party.map((p) => p.teamId)).size).toBe(1);
        expect(new Set(party.map((p) => p.groupId)).size).toBe(1);
        for (const g of game.teams.all()) {
            expect(g.players.length).toBeLessThanOrEqual(4);
            expect(new Set(g.players.map((p) => p.teamId))).toEqual(new Set([g.factionTeam]));
        }
        // PlayerInfos: teamId is the faction, groupId the squad
        const infos = game.getSnapshot(players[0].id).playerInfos ?? [];
        expect(infos.every((i) => (i.teamId === 1 || i.teamId === 2) && i.groupId > 0)).toBe(true);
        // the party joined the smaller faction (Red on the 5 / 5 tie) as one squad
        expect(game.faction!.aliveCounts()).toEqual([9, 5]);
    });

    it("each squad's first player spawns in the outermost tenth of its side (conflicts.md faction-spawn-band)", () => {
        const game = factionGame();
        const players = add(game, 40);
        const faction = game.faction!;
        const inside = (pos: Vec2, team: number) => {
            const b = faction.spawnBand(team);
            return pos.x >= b.min.x - 5 && pos.x <= b.max.x + 5 && pos.y >= b.min.y - 5 && pos.y <= b.max.y + 5;
        };
        expect(players.every((p) => inside(p.pos, p.teamId))).toBe(true);
        const red = faction.spawnBand(1);
        const blue = faction.spawnBand(2);
        const size = game.mapData.width - 2 * game.mapData.shoreInset;
        const along = (faction.splitOri ^ 1) === 0 ? "x" : "y";
        expect(red.max[along] - red.min[along]).toBeCloseTo(size / 10, 6);
        expect(blue.min[along] - red.max[along]).toBeCloseTo((size * 8) / 10, 6);
    });

    it("the whole faction is friendly: no damage, knocks while anyone stands, then a faction wipe", () => {
        const game = factionGame();
        const [r1, b1, r2] = add(game, 3);
        expect([r1.teamId, b1.teamId, r2.teamId]).toEqual([1, 2, 1]);
        // r1 and r2 are in different squads but the same faction
        game.damagePlayer(r2, { amount: 50, damageType: DamageType.Player, sourceId: r1.id, gameSourceType: "ak47" });
        expect(r2.health).toBe(100);
        kill(game, r1, b1);
        expect([r1.downed, r1.dead]).toEqual([true, false]);
        kill(game, r2, b1);
        expect([r1.dead, r2.dead]).toEqual([true, true]);
    });
});

describe("match", () => {
    it("ends when one faction is left; everyone learns the result with both Commanders' stats (faction.md)", () => {
        const game = factionGame();
        const players = add(game, 6);
        game.step();
        game.step();
        expect(game.started).toBe(true);
        const red = players.filter((p) => p.teamId === 1);
        const blue = players.filter((p) => p.teamId === 2);
        game.roles.promote(red[0], "leader");
        game.roles.promote(blue[0], "leader");
        game.rules.joinWindowSeconds = 0;
        finish(game, blue[1], red[1]);
        game.step();
        // PlayerStats while both factions play on
        expect(game.getSnapshot(blue[1].id).playerStats).toBeDefined();
        for (const b of blue) if (!b.dead) kill(game, b, red[1]);
        // knocked blues die with the last standing one
        expect(blue.every((b) => b.dead)).toBe(true);
        game.step();
        expect(game.over).toBe(true);
        expect(game.match.winningTeamId).toBe(1);
        const winner = game.getSnapshot(red[2].id).gameOver!;
        expect(winner).toMatchObject({ teamId: 1, teamRank: 1, gameOver: true, winningTeamId: 1 });
        expect(winner.playerStats.map((s) => s.playerId)).toEqual([red[2].id, red[0].id, blue[0].id]);
        const loser = game.getSnapshot(blue[2].id).gameOver!;
        expect(loser).toMatchObject({ teamId: 2, gameOver: true, winningTeamId: 1 });
    });

    it("snapshots carry the alive counts per faction and the faction's minimap rows (original AliveCounts)", () => {
        const game = factionGame();
        const players = add(game, 5);
        game.roles.promote(players[0], "medic");
        game.step();
        const snap = game.getSnapshot(players[0].id);
        expect(snap.teamAliveCounts).toEqual([3, 2]);
        expect(snap.aliveCount).toBe(5);
        expect(snap.factionStatus?.map((m) => m.playerId)).toEqual(
            players.filter((p) => p.teamId === 1).map((p) => p.id),
        );
        expect(snap.factionStatus?.[0].role).toBe("medic");
        expect(snap.local.team?.length).toBeLessThanOrEqual(4);
    });
});

describe("pings", () => {
    it("a Commander's pings reach its whole faction, other pings only the squad (fandom Commander)", () => {
        const game = factionGame();
        const players = add(game, 12);
        const red = players.filter((p) => p.teamId === 1);
        const otherSquad = red.find((p) => p.groupId !== red[0].groupId)!;
        const blue = players.find((p) => p.teamId === 2)!;
        game.step();
        for (const p of players) game.getSnapshot(p.id);
        game.emote(red[0].id, { type: "ping_danger", isPing: true, pos: { x: 100, y: 100 } });
        game.step();
        expect(game.getSnapshot(otherSquad.id).emotes).toEqual([]);
        game.roles.promote(red[0], "leader");
        for (let i = 0; i < 1000; i++) game.step();
        for (const p of players) game.getSnapshot(p.id);
        game.emote(red[0].id, { type: "ping_coming", isPing: true, pos: { x: 100, y: 100 } });
        game.step();
        expect(game.getSnapshot(otherSquad.id).emotes?.map((e) => e.type)).toEqual(["ping_coming"]);
        expect(game.getSnapshot(blue.id).emotes).toEqual([]);
    });
});

describe("role schedule", () => {
    it("Commander 50 s, one of Lieutenant / Marksman / Recon / Grenadier 54 s, Medic 58 s, Bugler 62 s (faction-promotion-order)", () => {
        const game = factionGame();
        const players = add(game, 8);
        const events = watchRoles(game);
        game.step();
        const start = game.match.startTick;
        expect(start).toBeGreaterThanOrEqual(0);
        for (let i = 0; i < 6300; i++) {
            keepMoving(game, players);
            game.step();
        }
        const assigned = events.filter((e) => e.assigned);
        const at = (role: string) => assigned.filter((e) => e.role === role).map((e) => (e.tick - start) / 100);
        expect(at("leader").length).toBe(2);
        expect(at("leader").every((t) => Math.abs(t - 50) < 0.05)).toBe(true);
        const middle = assigned.filter((e) => ["lieutenant", "marksman", "recon", "grenadier"].includes(e.role));
        expect(middle).toHaveLength(2);
        // rolled once, given to both teams
        expect(middle[0].role).toBe(middle[1].role);
        expect(middle.every((e) => Math.abs((e.tick - start) / 100 - 54) < 0.05)).toBe(true);
        expect(at("medic").every((t) => Math.abs(t - 58) < 0.05) && at("medic").length === 2).toBe(true);
        expect(at("bugler").every((t) => Math.abs(t - 62) < 0.05) && at("bugler").length === 2).toBe(true);
        // one role per player, one Commander per team, remembered for the game over
        const holders = players.filter((p) => p.role);
        expect(holders).toHaveLength(8);
        expect(game.faction!.teams.map((t) => t.leader?.role)).toEqual(["leader", "leader"]);
    });

    it("skips AFK players while anybody else is eligible (survev scheduled roles; rules.roles.promotionSkipAfk)", () => {
        const game = factionGame();
        const players = add(game, 8);
        const active = [players[6], players[7]];
        const events = watchRoles(game);
        game.step();
        for (let i = 0; i < 5100; i++) {
            keepMoving(game, active);
            game.step();
        }
        const leaders = events.filter((e) => e.role === "leader").map((e) => e.playerId);
        expect(leaders.sort()).toEqual(active.map((p) => p.id).sort());
        // with every player AFK the role still goes out
        const idle = factionGame();
        add(idle, 4);
        const idleEvents = watchRoles(idle);
        for (let i = 0; i < 5100; i++) idle.step();
        expect(idleEvents.filter((e) => e.role === "leader")).toHaveLength(2);
    });

    it("rules.roles.factionSchedule 'map' hands out all seven roles of the ported def at 50-74 s", () => {
        const game = factionGame();
        game.rules.roles.factionSchedule = "map";
        const players = add(game, 16);
        const events = watchRoles(game);
        game.step();
        for (let i = 0; i < 7500; i++) {
            keepMoving(game, players);
            game.step();
        }
        const roles = new Set(events.filter((e) => e.assigned).map((e) => e.role));
        expect([...roles].sort()).toEqual(
            ["bugler", "grenadier", "leader", "lieutenant", "marksman", "medic", "recon"].sort(),
        );
    });
});

describe("Lone Survivr and succession", () => {
    it("once joins are closed, a faction's last 2 standing players become Lone Survivrs, once (role-lone-survivr-trigger)", () => {
        const game = factionGame();
        const players = add(game, 8);
        game.step();
        game.rules.joinWindowSeconds = 0;
        const blue = players.filter((p) => p.teamId === 2);
        const red = players.filter((p) => p.teamId === 1);
        kill(game, blue[0], red[0]);
        expect(blue.some((b) => b.role === "last_man")).toBe(false);
        kill(game, blue[1], red[0]);
        expect([blue[2].role, blue[3].role]).toEqual(["last_man", "last_man"]);
        expect(blue[2].health).toBe(100);
        expect(game.faction!.team(2)!.lastManApplied).toBe(true);
        expect(red.every((r) => r.role === "")).toBe(true);
    });

    it("rules.roles.commanderSuccession: the Lieutenant takes over a dead Commander, keeping its guns (fork Captain)", () => {
        const game = factionGame();
        const players = add(game, 8);
        game.step();
        const red = players.filter((p) => p.teamId === 1);
        const blue = players.filter((p) => p.teamId === 2);
        game.roles.promote(red[0], "leader");
        game.roles.promote(red[1], "lieutenant");
        const gun = red[1].weaponManager.weapons[1].type;
        finish(game, red[0], blue[0]);
        expect(red[0].dead).toBe(true);
        expect(red[1].role).toBe("lieutenant");
        game.rules.roles.commanderSuccession = true;
        const g2 = factionGame();
        g2.rules.roles.commanderSuccession = true;
        const p2 = add(g2, 8);
        g2.step();
        const r2 = p2.filter((p) => p.teamId === 1);
        const b2 = p2.filter((p) => p.teamId === 2);
        g2.roles.promote(r2[0], "leader");
        g2.roles.promote(r2[1], "lieutenant");
        finish(g2, r2[0], b2[0]);
        expect(r2[0].dead).toBe(true);
        expect(r2[1].role).toBe("leader");
        expect(r2[1].weaponManager.weapons[1].type).toBe(gun);
        expect(r2[1].perks).toEqual(["leadership"]);
    });
});

describe("planes", () => {
    it("air strikes #2 and #4 wait 24 / 18 s instead of the ported fork 30 / 21 s (conflicts.md faction-airstrike-timing)", () => {
        const game = factionGame();
        add(game, 4);
        game.planes.scheduleCircle(2);
        for (let i = 0; i < 2390; i++) game.step();
        expect(game.planes.zones.zones).toHaveLength(0);
        for (let i = 0; i < 20; i++) game.step();
        expect(game.planes.zones.zones).toHaveLength(1);
    });

    it("schedules the gold military drop at circle 3 + 2 s (conflicts.md faction-gold-drop)", () => {
        const game = factionGame();
        add(game, 4);
        game.gas.onCircle?.(3);
        for (let i = 0; i < 199; i++) game.step();
        expect(game.planes.planes.some((p) => p.crateType === "airdrop_crate_04")).toBe(false);
        for (let i = 0; i < 2; i++) game.step();
        expect(game.planes.planes.some((p) => p.crateType === "airdrop_crate_04")).toBe(true);
    });

    it("rules.roles.helpLosingTeam: an alive gap sends one gold drop near the losing team and an air strike (fork)", () => {
        const game = factionGame();
        game.rules.roles.helpLosingTeam = true;
        const players = add(game, 14);
        game.step();
        (game.gas as { circleIdx: number }).circleIdx = 1;
        const red = players.filter((p) => p.teamId === 1);
        const blue = players.filter((p) => p.teamId === 2);
        // 7 / 6: below 10 % of the living and a gap under 5
        finish(game, blue[0], red[0]);
        expect(game.faction!.sentHelp).toBe(false);
        // 7 / 5: 2 / 12 >= 10 %
        finish(game, blue[1], red[0]);
        expect(game.planes.planes.some((p) => p.crateType === "airdrop_crate_04")).toBe(true);
        expect(game.planes.zones.zones).toHaveLength(1);
        expect(game.faction!.sentHelp).toBe(true);
        finish(game, blue[2], red[0]);
        expect(game.planes.zones.zones).toHaveLength(1);
    });
});

describe("faction map", () => {
    it("team buildings sit on their team's edge and each statue faces its side (conflicts.md faction-teamid)", () => {
        const game = factionGame();
        const faction = game.faction!;
        const objects = game.mapData.objects;
        const center = (type: string) => objects.find((o) => o.type === type)!.pos;
        const along = (faction.splitOri ^ 1) === 0 ? "x" : "y";
        const band = (team: number) => faction.spawnBand(team);
        // Red holds the low side of the split, Blue the high side (survev divideAabb slices 0 and 9)
        const t = (type: string) => center(type)[along] / game.mapData.width;
        expect(t("bank_01")).toBeLessThan(0.3);
        expect(t("mansion_structure_01")).toBeLessThan(0.3);
        expect(t("police_01")).toBeGreaterThan(0.7);
        expect(t("warehouse_complex_01")).toBeGreaterThan(0.7);
        const red = center("statue_top_01");
        const blue = center("statue_top_02");
        expect(v2.distance(red, band(1).min) < v2.distance(blue, band(1).min)).toBe(true);
    });
});
