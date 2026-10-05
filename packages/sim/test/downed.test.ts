// Downed players (M6a): knocks instead of deaths in team modes, team wipes, kill credit for finished players (the
// survev kill.test.ts cases), the Kill events, cooked grenades dropped on a knock, the inputs a downed player keeps,
// Revivify, Mass Medicate revives and heals, the optional 50 HP final-circle rule and the Faction bleed escalation.
import { v2 } from "@rebirth/core";
import { DamageType, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { bleedDamage, type Game, type KillEvent, type Player } from "../src/index.ts";
import { giveGun, openSpot, send, steps } from "./combatHelpers.ts";
import { addAt, flatTeamGame, hit, party } from "./teamHelpers.ts";

/** A squad game: an enemy solo group, then a party of `n` (B, C, ...) next to each other. */
function squad(n = 2, teamMode: 2 | 4 = 4) {
    const game = flatTeamGame(teamMode);
    const at = openSpot(game, 40);
    const enemy = addAt(game, "A", v2.add(at, { x: 0, y: 20 }), { group: "enemy", autoFill: false });
    const team = party(game, "T", n, at, 2);
    return { game, enemy, team };
}

/** Kill events of the next snapshot of `viewer`. */
function kills(game: Game, viewer: Player): KillEvent[] {
    return game.getSnapshot(viewer.id).kills ?? [];
}

const BUFFER_TICKS = 11;

describe("knocks and deaths", () => {
    it("a squad player is knocked down while a teammate stands: Kill event with downed, knocker credited", () => {
        const { game, enemy, team } = squad();
        const [b, c] = team;
        kills(game, c);
        hit(game, b, 999, enemy, "ak47");
        expect(b.downed).toBe(true);
        expect(b.dead).toBe(false);
        expect(b.health).toBe(100);
        expect(b.downedBy).toBe(enemy.id);
        expect(b.toView().downed).toBe(true);
        expect(enemy.kills).toBe(0);
        expect(kills(game, c)).toEqual([
            {
                targetId: b.id,
                killerId: enemy.id,
                killCreditId: enemy.id,
                killerKills: 0,
                damageType: DamageType.Player,
                source: "gun",
                itemSourceType: "ak47",
                mapSourceType: "",
                downed: true,
                killed: false,
            },
        ]);
        // gas knocks are reported without a killer
        hit(game, c, 999, undefined, "", DamageType.Gas);
        // ...but C was the last one standing: C dies and B goes with it (team wipe)
        expect(c.dead && b.dead).toBe(true);
    });

    it("solo: lethal damage kills (no downed state) unless the player holds Revivify", () => {
        const game = flatTeamGame(1);
        const at = openSpot(game, 20);
        const p = addAt(game, "p", at);
        const q = addAt(game, "q", v2.add(at, { x: 4, y: 0 }));
        hit(game, p, 999);
        expect(p.dead).toBe(true);
        q.perks.push("self_revive");
        hit(game, q, 999);
        expect(q.downed).toBe(true);
        // a self revive with Interact: 8 s at 2 u/s, bleeding paused
        steps(game, 20);
        const health = q.health;
        send(game, q, { actions: [Input.Interact] });
        game.step();
        expect(q.action.type).toBe("revive");
        expect(q.localState().action?.targetId).toBe(q.id);
        steps(game, 799);
        expect(q.downed).toBe(false);
        expect(q.health).toBe(24);
        expect(health).toBe(100);
    });

    it("team wipe: the last standing member dies and every downed member dies of Bleeding, credited to its knocker", () => {
        const { game, enemy, team } = squad(3);
        const [b, c, d] = team;
        const other = addAt(game, "X", v2.add(b.pos, { x: 0, y: -20 }), { group: "x", autoFill: false });
        hit(game, b, 999, enemy);
        hit(game, c, 999, other);
        expect(b.downed && c.downed).toBe(true);
        kills(game, d);
        hit(game, d, 999, enemy);
        expect([b, c, d].every((p) => p.dead)).toBe(true);
        const ev = kills(game, d);
        expect(ev.map((k) => [k.targetId, k.killerId, k.killCreditId, k.damageType, k.downed, k.killed])).toEqual([
            [d.id, enemy.id, enemy.id, DamageType.Player, false, true],
            [b.id, 0, enemy.id, DamageType.Bleeding, false, true],
            [c.id, 0, other.id, DamageType.Bleeding, false, true],
        ]);
        expect(enemy.kills).toBe(2);
        expect(other.kills).toBe(1);
    });

    it("disconnected teammates do not count as standing; a Revivify holder keeps the group from being wiped", () => {
        const a = squad(2);
        a.team[1].disconnected = true;
        hit(a.game, a.team[0], 999, a.enemy);
        expect(a.team[0].dead).toBe(true);
        const b = squad(2);
        b.team[1].perks.push("self_revive");
        hit(b.game, b.team[1], 999, b.enemy);
        expect(b.team[1].downed).toBe(true);
        hit(b.game, b.team[0], 999, b.enemy);
        expect(b.team[0].downed).toBe(true);
        expect(b.team[1].dead).toBe(false);
        // the Revivify holder is finished: nobody can revive the other one any more
        steps(b.game, BUFFER_TICKS);
        hit(b.game, b.team[1], 999, b.enemy);
        expect(b.team[1].dead && b.team[0].dead).toBe(true);
    });
});

describe("kill credit for downed players (survev kill.test.ts)", () => {
    function downedBy(knocker: "enemy" | "mate") {
        const { game, enemy, team } = squad(2);
        const [b, c] = team;
        // teammates only hurt disconnected players
        b.disconnected = true;
        hit(game, b, 999, knocker === "enemy" ? enemy : c);
        expect(b.downed).toBe(true);
        steps(game, BUFFER_TICKS);
        return { game, enemy, b, c };
    }

    it("downed by an enemy, finished by the enemy, by bleeding or by gas: the enemy gets the kill", () => {
        for (const finish of ["enemy", "bleed", "gas"] as const) {
            const { game, enemy, b } = downedBy("enemy");
            if (finish === "enemy") hit(game, b, 999, enemy);
            else hit(game, b, 999, undefined, "", finish === "bleed" ? DamageType.Bleeding : DamageType.Gas);
            expect(b.dead).toBe(true);
            expect(enemy.kills).toBe(1);
            expect(b.killedBy).toBe(enemy.id);
        }
    });

    it("downed by an enemy, finished by a teammate: the enemy keeps the kill", () => {
        const { game, enemy, b, c } = downedBy("enemy");
        hit(game, b, 999, c);
        expect(b.dead).toBe(true);
        expect(enemy.kills).toBe(1);
        expect(c.kills).toBe(0);
    });

    it("downed by a teammate: no kill for it whatever finishes the player, except an enemy finisher", () => {
        for (const finish of ["mate", "bleed", "gas", "enemy"] as const) {
            const { game, enemy, b, c } = downedBy("mate");
            if (finish === "mate") hit(game, b, 999, c);
            else if (finish === "enemy") hit(game, b, 999, enemy);
            else hit(game, b, 999, undefined, "", finish === "bleed" ? DamageType.Bleeding : DamageType.Gas);
            expect(b.dead).toBe(true);
            expect(c.kills).toBe(0);
            expect(enemy.kills).toBe(finish === "enemy" ? 1 : 0);
        }
    });

    it("a bleed-out names no killer but credits the knocker ('finally bled out' / 'finally killed')", () => {
        const { game, enemy, team } = squad(2);
        const [b, c] = team;
        hit(game, b, 999, enemy, "mp5");
        kills(game, c);
        for (let i = 0; i < 60 * 100 && !b.dead; i++) game.step();
        const ev = kills(game, c).find((k) => k.targetId === b.id && k.killed);
        expect(ev).toMatchObject({ killerId: 0, killCreditId: enemy.id, source: "bleed", killerKills: 1 });
    });
});

describe("the knock itself", () => {
    it("drops a cooked grenade at the feet, cancels a heal, forces the melee slot and wears a pan", () => {
        const { game, enemy, team } = squad(2);
        const [b] = team;
        b.inv.set("frag", 2);
        b.weaponManager.setWeapon(WeaponSlot.Melee, "pan", 0);
        b.weaponManager.setWeapon(WeaponSlot.Throwable, "frag", 0);
        b.weaponManager.setCurWeapIndex(WeaponSlot.Throwable);
        b.weaponManager.weapons[WeaponSlot.Throwable].cooldown = 0;
        send(game, b, { shootStart: true, shootHold: true });
        steps(game, 30);
        expect(b.animType).toBe("cook");
        const before = game.projectiles.projectiles.length;
        hit(game, b, 999, enemy);
        expect(b.downed).toBe(true);
        expect(game.projectiles.projectiles.length).toBe(before + 1);
        const nade = game.projectiles.projectiles.at(-1)!;
        expect(nade.type).toBe("frag");
        expect(v2.length(nade.vel)).toBeLessThan(1e-9);
        expect(b.inv.get("frag")).toBe(1);
        expect(b.curWeapIdx).toBe(WeaponSlot.Melee);
        expect(b.wearingPan).toBe(true);
        expect(b.animType).toBe("none");
    });

    it("downs at 50 HP in a fully closed zone only with rules.downHealthFinalCircle (conflicts.md down-health-50)", () => {
        for (const rule of [false, true]) {
            const { game, enemy, team } = squad(2);
            game.rules.downHealthFinalCircle = rule;
            game.gas.currentRad = 0.05;
            hit(game, team[0], 999, enemy);
            expect(team[0].downed).toBe(true);
            expect(team[0].health).toBe(rule ? 50 : 100);
        }
    });

    it("bleeds faster on maps with bleedDamageMult (Faction): linear by default, compounding as the knob", () => {
        expect(bleedDamage("main", 3, "linear")).toBe(2);
        expect(bleedDamage("faction", 1, "linear")).toBeCloseTo(2.5);
        expect(bleedDamage("faction", 2, "linear")).toBeCloseTo(5);
        expect(bleedDamage("faction", 3, "linear")).toBeCloseTo(7.5);
        expect(bleedDamage("faction", 2, "compound")).toBeCloseTo(3.125);
    });

    it("a downed player keeps Interact / Use / Cancel only; a downed disconnected player does not despawn", () => {
        const { game, enemy, team } = squad(2);
        const [b] = team;
        game.rules.minActiveTime = 1000;
        hit(game, b, 999, enemy);
        game.disconnectPlayer(b.id);
        expect(game.getPlayer(b.id)).toBe(b);
        expect(b.disconnected).toBe(true);
    });
});

describe("revives", () => {
    it("Input.Revive revives a downed teammate within reviveRange only; a cancel from either side stops it", () => {
        const { game, enemy, team } = squad(3);
        const [b, c, d] = team;
        hit(game, b, 999, enemy);
        steps(game, 300);
        game.teleportPlayer(c.id, v2.add(b.pos, { x: 4.9, y: 0 }));
        game.teleportPlayer(d.id, v2.add(b.pos, { x: 0, y: 30 }));
        send(game, d, { actions: [Input.Revive] });
        game.step();
        expect(d.action.type).toBe("none");
        send(game, c, { actions: [Input.Revive] });
        game.step();
        send(game, c, {});
        expect(c.action.type).toBe("revive");
        expect(b.action.type).toBe("revive");
        // the downed player cancels (it is not revived by a medic)
        send(game, b, { actions: [Input.Cancel] });
        game.step();
        expect(c.action.type).toBe("none");
        expect(b.action.type).toBe("none");
        expect(c.animType).toBe("none");
        // the reviver switching weapons cancels as well
        giveGun(c, "mp5");
        send(game, c, { actions: [Input.Interact] });
        game.step();
        expect(c.action.type).toBe("revive");
        send(game, c, { actions: [Input.EquipMelee] });
        game.step();
        expect(c.action.type).toBe("none");
        expect(b.action.type).toBe("none");
        send(game, c, { actions: [Input.Interact, Input.Cancel] });
        game.step();
        // Interact then Cancel in one message (mobile): the revive survives
        expect(c.action.type).toBe("revive");
    });

    it("Mass Medicate: a medic's revive stands every downed teammate in 6 u up; its heals reach standing teammates in 8 u", () => {
        const { game, enemy, team } = squad(4);
        const [medic, b, c, d] = team;
        medic.perks.push("aoe_heal");
        hit(game, b, 999, enemy);
        hit(game, c, 999, enemy);
        steps(game, 200);
        game.teleportPlayer(b.id, v2.add(medic.pos, { x: 2, y: 0 }));
        game.teleportPlayer(c.id, v2.add(medic.pos, { x: -5.5, y: 0 }));
        game.teleportPlayer(d.id, v2.add(medic.pos, { x: 0, y: 7 }));
        send(game, medic, { actions: [Input.Interact] });
        game.step();
        send(game, medic, {});
        expect(medic.action.type).toBe("revive");
        steps(game, 800);
        expect(b.downed).toBe(false);
        expect(c.downed).toBe(false);
        expect(b.health).toBe(24);
        expect(c.health).toBe(24);
        // a bandage heals the medic and every standing teammate within 8 u, and shows the item to others
        medic.health = 50;
        medic.inv.set("bandage", 2);
        game.getSnapshot(d.id);
        send(game, medic, { useItem: "bandage" });
        game.step();
        send(game, medic, {});
        const emotes = game.getSnapshot(d.id).emotes ?? [];
        expect(emotes).toContainEqual({ playerId: medic.id, type: "emote_loot", itemType: "bandage", isPing: false });
        steps(game, 400);
        expect(medic.health).toBeCloseTo(65, 0);
        expect(b.health).toBeCloseTo(39, 0);
        expect(d.health).toBe(100);
    });

    it("a teammate reviving a medic also stands up the downed teammates in the medic's aura (rules.medicRevivedAoe)", () => {
        for (const rule of [true, false]) {
            const { game, enemy, team } = squad(3);
            const [medic, b, c] = team;
            game.rules.medicRevivedAoe = rule;
            medic.perks.push("aoe_heal");
            hit(game, medic, 999, enemy);
            hit(game, b, 999, enemy);
            steps(game, 200);
            game.teleportPlayer(b.id, v2.add(medic.pos, { x: 3, y: 0 }));
            game.teleportPlayer(c.id, v2.add(medic.pos, { x: -2, y: 0 }));
            send(game, c, { actions: [Input.Interact] });
            game.step();
            send(game, c, {});
            steps(game, 800);
            expect(medic.downed).toBe(false);
            expect(b.downed).toBe(!rule);
        }
    });
});
