// Cobalt class selection (M7b, modes/classSelect.ts): players wait in the Twins bunker without a class, cannot act or be
// hurt, and move to a surface spawn point once they have one (chosen, or the server's random one after 25 s); class pods follow the opener's
// class. docs/research/modes/cobalt.md "Class selection and spawning" / "Class pods".
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig, getMapDef, getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Player, TWINS_WAITING_ROOM } from "../src/index.ts";
import { send, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

const CLASSES = getMapDef("cobalt").gameMode.perkModeRoles ?? [];

function cobaltGame(teamMode: 1 | 2 | 4 = 1): Game {
    return new Game(
        { mapName: "cobalt", seed: 5, teamMode },
        { generation: cachedMap("cobalt", 5, teamMode), spawnLoot: false },
    );
}

function room(game: Game) {
    const b = game.world.buildings.find((x) => x.type === TWINS_WAITING_ROOM);
    if (!b) throw new Error("no twins bunker");
    return b;
}

function add(game: Game, name: string, group?: string): Player {
    return game.getPlayer(game.addPlayer(name, group ? { group, autoFill: false } : {}))!;
}

describe("Cobalt class menu waiting room", () => {
    it("a joining player waits at the Twins bunker, underground, without a class, immune and inert", () => {
        const game = cobaltGame();
        const p = add(game, "a");
        const r = room(game);
        expect(p.awaitingClass).toBe(true);
        expect(p.role).toBe("");
        expect(p.pos).toEqual(r.pos);
        expect(p.layer).toBe(r.layer);
        expect(r.layer).toBe(1);
        game.damagePlayer(p, { amount: 500, damageType: DamageType.Player });
        expect(p.health).toBe(GameConfig.player.health);
        send(game, p, { moveRight: true, shootStart: true, shootHold: true });
        steps(game, 50);
        expect(p.pos).toEqual(r.pos);
        game.emote(p.id, { type: p.emoteLoadout[0], isPing: false });
        expect(game.getSnapshot(p.id).emotes).toEqual([]);
    });

    it("choosing a class moves the player to a spawn point on the surface, where it can act", () => {
        const game = cobaltGame();
        const p = add(game, "a");
        expect(game.selectRole(p.id, "scout")).toBe(true);
        expect(p.awaitingClass).toBe(false);
        expect(p.layer).toBe(0);
        expect(v2.distance(p.pos, room(game).pos)).toBeGreaterThan(1);
        expect(game.world.isOnWater(p.pos, 0)).toBe(false);
        const start = v2.copy(p.pos);
        send(game, p, { moveRight: true });
        steps(game, 20);
        expect(v2.distance(p.pos, start)).toBeGreaterThan(0.5);
        game.damagePlayer(p, { amount: 10, damageType: DamageType.Player });
        expect(p.health).toBeLessThan(GameConfig.player.health);
    });

    it("without a choice a random class comes after the server's 25 s (the client confirms at 20 s), with the move to the surface", () => {
        const game = cobaltGame();
        const p = add(game, "idle");
        steps(game, 2499);
        expect(p.awaitingClass).toBe(true);
        steps(game, 2);
        expect(CLASSES).toContain(p.role);
        expect(p.awaitingClass).toBe(false);
        expect(p.layer).toBe(0);
    });

    it("in squads the first member to pick sets the group's spawn, the others land next to it", () => {
        const game = cobaltGame(4);
        const [a, b] = [add(game, "a", "sq"), add(game, "b", "sq")];
        expect(a.group).toBe(b.group);
        expect(a.group?.spawnPosition).toBeNull();
        game.selectRole(a.id, "tank");
        expect(a.group?.spawnPosition).toEqual(a.pos);
        game.selectRole(b.id, "healer");
        expect(b.layer).toBe(0);
        expect(v2.distance(a.pos, b.pos)).toBeLessThanOrEqual(GameConfig.player.teammateSpawnRadius + 1e-6);
    });

    it("with the waiting room off players wait at their spawn point, still inert until they have a class", () => {
        const game = cobaltGame();
        game.rules.modes.cobaltWaitingRoom = false;
        const p = add(game, "a");
        expect(p.layer).toBe(0);
        expect(p.awaitingClass).toBe(true);
        const at = v2.copy(p.pos);
        game.selectRole(p.id, "demo");
        expect(p.pos).toEqual(at);
        expect(p.awaitingClass).toBe(false);
    });

    it("other maps never wait for a class", () => {
        const game = new Game({ mapName: "main", seed: 1 }, { generation: cachedMap("main", 12345), spawnLoot: false });
        expect(add(game, "m").awaitingClass).toBe(false);
    });
});

describe("Cobalt class pods", () => {
    it("every class has a common and a rare pod whose loot lists the class's gun tier and melee (cobalt.md)", () => {
        const melee: Record<string, string> = {
            scout: "crowbar_scout",
            sniper: "kukri_sniper",
            healer: "bonesaw_healer",
            demo: "katana_demo",
            assault: "spade_assault",
            tank: "warhammer_tank",
        };
        const tables = getMapDef("cobalt").lootTable;
        for (const cls of CLASSES) {
            for (const rarity of ["common", "rare"]) {
                const type = `class_crate_${rarity}_${cls}`;
                expect(hasMapObjectDef(type)).toBe(true);
                const def = getMapObjectDef(type);
                if (def.type !== "obstacle") throw new Error(type);
                const tiers = def.loot.filter((l) => l.tier).map((l) => l.tier as string);
                expect(tiers).toContain(`tier_guns_${rarity}_${cls}`);
                for (const t of tiers) expect([type, t, !!tables[t]]).toEqual([type, t, true]);
                expect(def.loot.some((l) => l.type === melee[cls])).toBe(true);
            }
        }
        // the mythic pod is the same for everyone: Master Scavenger, Explosive or Splinter Rounds, or survev's
        // Indomitable Spirit (survev content wave stage 2)
        expect(tables.tier_class_crate_mythic.map((e) => e.name).sort()).toEqual([
            "explosive",
            "lifeline",
            "scavenger_adv",
            "splinter",
        ]);
    });
});
