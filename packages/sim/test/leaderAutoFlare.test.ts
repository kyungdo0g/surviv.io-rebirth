// The Commander's automatic flare (rules.roles.leaderAutoFlare / leaderAutoFlareDelay, roles/roleSystem.ts autoFlare):
// the owner's ruling of 2026-10-08 turns it on with a 5 s delay (docs/research/rebirth-deviations.md "The Commander's
// automatic flare"); survev's fork fires it after 15 s (survev player.ts:885-888, 1478-1495).
import { v2 } from "@rebirth/core";
import { DamageType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { defaultRoleRules, Game, type Player, type RoleRules } from "../src/index.ts";
import { fireOnce, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** A started 50v50 game of `n` players; `roles` tweaks the role rules before the first tick. */
function faction(n = 8, roles: Partial<RoleRules> = {}): { game: Game; red: Player[]; blue: Player[] } {
    const game = new Game(
        { mapName: "faction", seed: 7, teamMode: 4 },
        { generation: cachedMap("faction", 7, 4), spawnLoot: false },
    );
    game.rules.minActiveTime = 0;
    Object.assign(game.rules.roles, roles);
    const players = Array.from({ length: n }, (_, i) => game.getPlayer(game.addPlayer(`p${i}`)) as Player);
    game.step();
    expect(game.started).toBe(true);
    return { game, red: players.filter((p) => p.teamId === 1), blue: players.filter((p) => p.teamId === 2) };
}

function flareSlot(p: Player): number {
    return p.weaponManager.weapons.findIndex((w) => w.type === "flare_gun" || w.type === "flare_gun_dual");
}

function hit(game: Game, target: Player, amount = 1000): void {
    game.damagePlayer(target, { amount, damageType: DamageType.Player, dir: v2.create(1, 0) });
}

/** Steps until every plane delivered and every falling crate landed. */
function untilLanded(game: Game, max = 8000): void {
    for (let i = 0; i < max; i++) {
        game.step();
        if (game.planes.planes.every((p) => p.actionComplete) && game.planes.airdrops.every((d) => d.landed)) return;
    }
    throw new Error("the crate did not land");
}

describe("the Commander's automatic flare (the owner's 5 s; survev's fork 15 s)", () => {
    it("is on by default with a 5 s delay", () => {
        const rules = defaultRoleRules();
        expect(rules.leaderAutoFlare).toBe(true);
        expect(rules.leaderAutoFlareDelay).toBe(5);
        expect(rules.leaderFlareLocked).toBe(true);
    });

    it("fires on the tick 5 s after the promotion, the way the Commander faces, and its drop lands on the map", () => {
        const { game, red } = faction();
        const [cmd] = red;
        game.roles.promote(cmd, "leader");
        const idx = flareSlot(cmd);
        expect(idx).toBeGreaterThanOrEqual(0);
        const ammo = cmd.weaponManager.weapons[idx].ammo;
        const planes = game.planes.planes.length;
        steps(game, 499);
        expect(cmd.firedFlare).toBe(false);
        expect(cmd.weaponManager.weapons[idx].ammo).toBe(ammo);
        expect(game.planes.planes.length).toBe(planes);
        steps(game, 1);
        expect(cmd.firedFlare).toBe(true);
        expect(cmd.weaponManager.curWeapIdx).toBe(idx);
        expect(cmd.weaponManager.weapons[idx].ammo).toBe(ammo - 1);
        // the flare flies the way the Commander faces (survev fireWeapon with the player's dir)
        const flare = game.bullets.active.find((b) => b.shooterId === cmd.id && b.bulletType === "bullet_flare");
        expect(flare).toBeDefined();
        expect(v2.dot(flare?.dir ?? v2.create(0, 0), cmd.dir)).toBeGreaterThan(0.999);
        // one air drop, called where the shot is fired (survev bullet.ts:117-118 addFlare), on the map
        expect(game.planes.planes.length).toBe(planes + 1);
        const plane = game.planes.planes[game.planes.planes.length - 1];
        expect(v2.distance(plane.target, cmd.pos)).toBeLessThan(20);
        const { width, height } = game.mapData;
        expect(plane.target.x).toBeGreaterThan(0);
        expect(plane.target.y).toBeGreaterThan(0);
        expect(plane.target.x).toBeLessThan(width);
        expect(plane.target.y).toBeLessThan(height);
        // the drop arrives: the plane passes, the crate falls and lands as an air drop crate where it was aimed
        const target = v2.copy(plane.target);
        untilLanded(game);
        const crates = [...game.world.objects.values()].filter(
            (o) => o.kind === "obstacle" && o.type.startsWith("airdrop_crate_") && v2.distance(o.pos, target) < 1e-6,
        );
        expect(crates).toHaveLength(1);
    }, 60_000);

    it("the scheduled Commander fires it within 5 s of the tick the schedule promotes it", () => {
        const { game, red, blue } = faction(8, { factionSchedule: [{ roles: ["leader"], circleIdx: 0, wait: 1 }] });
        const planes = game.planes.planes.length;
        const leaders = () => [...red, ...blue].filter((p) => p.role === "leader");
        for (let i = 0; i < 200 && leaders().length === 0; i++) game.step();
        expect(leaders()).toHaveLength(2);
        expect(leaders().every((p) => !p.firedFlare)).toBe(true);
        // the promotion tick already counts its 0.01 s: the shot comes on the 500th tick from the promotion's
        steps(game, 498);
        expect(leaders().every((p) => !p.firedFlare)).toBe(true);
        steps(game, 1);
        expect(leaders().every((p) => p.firedFlare)).toBe(true);
        expect(game.planes.planes.length).toBe(planes + 2);
    }, 60_000);

    it("does not fire again when the Commander fired the flare gun itself first", () => {
        const { game, red } = faction();
        const [cmd] = red;
        game.roles.promote(cmd, "leader");
        const idx = flareSlot(cmd);
        steps(game, 200);
        cmd.weaponManager.setCurWeapIndex(idx, true);
        cmd.weaponManager.weapons[idx].cooldown = 0;
        cmd.weaponManager.freeSwitchTimer = 0;
        cmd.indoors = false;
        const ammo = cmd.weaponManager.weapons[idx].ammo;
        const planes = game.planes.planes.length;
        fireOnce(game, cmd);
        expect(cmd.firedFlare).toBe(true);
        expect(cmd.weaponManager.weapons[idx].ammo).toBe(ammo - 1);
        expect(game.planes.planes.length).toBe(planes + 1);
        steps(game, 500);
        expect(cmd.weaponManager.weapons[idx].ammo).toBe(ammo - 1);
        expect(game.planes.planes.length).toBe(planes + 1);
    }, 60_000);

    it("never fires for a Commander that died first", () => {
        const { game, red } = faction();
        const [cmd] = red;
        game.roles.promote(cmd, "leader");
        const planes = game.planes.planes.length;
        steps(game, 100);
        hit(game, cmd);
        // a knocked player shrugs off hits for the downed damage buffer (0.1 s), then dies
        if (cmd.downed) {
            steps(game, 12);
            hit(game, cmd);
        }
        expect(cmd.dead).toBe(true);
        steps(game, 600);
        expect(game.planes.planes.length).toBe(planes);
        expect(game.bullets.active.some((b) => b.shooterId === cmd.id)).toBe(false);
    }, 60_000);

    it("a downed Commander still fires at 5 s, then goes back to its melee weapon (survev player.ts:1486-1492)", () => {
        const { game, red } = faction();
        const [cmd] = red;
        game.roles.promote(cmd, "leader");
        const planes = game.planes.planes.length;
        steps(game, 300);
        hit(game, cmd);
        expect(cmd.downed).toBe(true);
        steps(game, 200);
        expect(cmd.dead).toBe(false);
        expect(cmd.firedFlare).toBe(true);
        expect(game.planes.planes.length).toBe(planes + 1);
        expect(cmd.weaponManager.curWeapIdx).toBe(WeaponSlot.Melee);
    }, 60_000);

    it("off (v0.8.82): the flare waits for the player", () => {
        const { game, red } = faction(8, { leaderAutoFlare: false });
        const [cmd] = red;
        game.roles.promote(cmd, "leader");
        const planes = game.planes.planes.length;
        steps(game, 1600);
        expect(cmd.firedFlare).toBe(false);
        expect(game.planes.planes.length).toBe(planes);
    }, 60_000);
});
