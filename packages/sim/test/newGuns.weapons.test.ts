// The rebirth's new guns in the simulation (beta; docs/design/new-gun-stats.md section 4, defs rebirth/newGuns.ts):
// single-use guns (Boys 7 shots, Panzerfaust 1, M202 one volley of 4) are never reloaded and leave their slot after the
// last shot, a dropped one keeps its shots; the DP-12 pumps after every 2 shots; the DShK slows its carrier in a slot
// and more when held; the M16A4 fires 3-round bursts and the AA-12 single slugs on full auto; Endless Ammo never feeds
// the launchers; gold-only guns are never potato-swapped.
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig, getDef, getDefOfType, Input, NEW_GUN_IDS, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Player } from "../src/index.ts";
import { pickupLoot } from "../src/loot/pickup.ts";
import { randomWeaponSwap } from "../src/weapons/potatoSwap.ts";
import {
    constantRng,
    DT,
    fireOnce,
    flatGame,
    giveGun,
    intervals,
    openSpot,
    recordShots,
    send,
    spawnAt,
    steps,
} from "./combatHelpers.ts";
import { addAt, flatTeamGame, hit, party } from "./teamHelpers.ts";

/** Shooter facing +x at an open spot with `gun` in the primary slot (full magazine, 200 rounds in the bag). */
function range(gun: string) {
    const game = flatGame();
    game.combatRng = constantRng();
    const p = spawnAt(game, openSpot(game, 70));
    const def = giveGun(p, gun, { reserve: 200 });
    return { game, p, def, wm: p.weaponManager };
}

/** Clicks every tick (single-fire guns fire whenever ready) for `ticks` ticks; the ticks of the shots. */
const clickFor = (game: ReturnType<typeof flatGame>, p: Player, ticks: number) =>
    recordShots(game, p, ticks, () => ({ shootStart: true, shootHold: true }));

describe("single-use guns (new-gun-stats.md 4.2)", () => {
    it("Boys: 7 shots 1.5 s apart from one load, never reloaded (Endless Ammo neither), then discarded", () => {
        const { game, p, def, wm } = range("boys");
        expect(wm.activeSlot.ammo).toBe(7);
        const first = clickFor(game, p, 310);
        expect(first).toHaveLength(3);
        expect(wm.activeSlot.ammo).toBe(4);
        // R does nothing, with Endless Ammo too
        p.perks.push("endless_ammo");
        send(game, p, { actions: [Input.Reload] });
        game.step();
        expect(p.action.type).toBe("none");
        expect(wm.tryReload()).toBe(false);
        expect(wm.activeSlot.ammo).toBe(4);
        const rest = clickFor(game, p, 600);
        const shots = [...first, ...rest];
        expect(shots).toHaveLength(7);
        for (const gap of intervals(shots)) expect(gap).toBeGreaterThanOrEqual(def.fireDelay - 1e-9);
        // the empty rifle stays for the last shot's fire delay, then leaves the slot: fists out, nothing dropped
        expect(wm.activeSlot.ammo).toBe(0);
        const loot = game.loot.items.size;
        steps(game, Math.round(def.fireDelay / DT) + 2);
        expect(wm.weapons[WeaponSlot.Primary].type).toBe("");
        expect(wm.curWeapIdx).toBe(WeaponSlot.Melee);
        expect(game.loot.items.size).toBe(loot);
        // Firepower cannot add shots: the extended magazine is the charges
        expect(wm.ammoStats(getDefOfType("gun", "boys")).maxClip).toBe(7);
        p.perks.push("firepower");
        expect(wm.ammoStats(getDefOfType("gun", "boys")).maxClip).toBe(7);
    });

    it("Panzerfaust: one rocket, discarded 0.5 s later; the other gun is drawn", () => {
        const { game, p, wm } = range("panzerfaust");
        giveGun(p, "ak47", { slot: WeaponSlot.Secondary, reserve: 90 });
        wm.setCurWeapIndex(WeaponSlot.Primary, true);
        wm.activeSlot.cooldown = 0;
        fireOnce(game, p);
        expect(game.bullets.active.filter((b) => b.bulletType === "bullet_panzerfaust")).toHaveLength(1);
        expect(wm.activeSlot.ammo).toBe(0);
        steps(game, 45);
        expect(wm.weapons[WeaponSlot.Primary].type).toBe("panzerfaust");
        steps(game, 10);
        expect(wm.weapons[WeaponSlot.Primary].type).toBe("");
        expect(wm.curWeapIdx).toBe(WeaponSlot.Secondary);
        expect(wm.activeWeapon).toBe("ak47");
    });

    it("a heal started after the last shot survives the discard: the switch is not the player's", () => {
        for (const gun of ["boys", "panzerfaust"]) {
            const { game, p, def, wm } = range(gun);
            giveGun(p, "ak47", { slot: WeaponSlot.Secondary, reserve: 90 });
            wm.setCurWeapIndex(WeaponSlot.Primary, true);
            wm.activeSlot.cooldown = 0;
            wm.activeSlot.ammo = 1;
            p.health = 50;
            p.inv.set("bandage", 5);
            fireOnce(game, p);
            expect(wm.activeSlot.ammo, gun).toBe(0);
            send(game, p, { useItem: "bandage" });
            game.step();
            send(game, p, {});
            expect(p.action.type, gun).toBe("use");
            steps(game, Math.round(def.fireDelay / DT) + 2);
            // the tube is gone and the AK drawn, the bandage still going
            expect(wm.weapons[WeaponSlot.Primary].type, gun).toBe("");
            expect(wm.activeWeapon, gun).toBe("ak47");
            expect(p.action.type, gun).toBe("use");
            steps(game, 400);
            expect(p.health, gun).toBeCloseTo(65, 0);
            expect(p.inv.get("bandage"), gun).toBe(4);
        }
    });

    it("a revive started after the last shot survives the discard too", () => {
        const game = flatTeamGame(4);
        const at = openSpot(game, 40);
        const enemy = addAt(game, "A", v2.add(at, { x: 0, y: 20 }), { group: "enemy", autoFill: false });
        const [b, c] = party(game, "T", 2, at, 2);
        hit(game, b, 999, enemy);
        expect(b.downed).toBe(true);
        game.teleportPlayer(c.id, v2.add(b.pos, { x: 2, y: 0 }));
        giveGun(c, "panzerfaust");
        fireOnce(game, c);
        expect(c.weaponManager.activeSlot.ammo).toBe(0);
        send(game, c, { actions: [Input.Revive] });
        game.step();
        send(game, c, {});
        expect(c.action.type).toBe("revive");
        steps(game, 60);
        expect(c.weaponManager.weapons[WeaponSlot.Primary].type).toBe("");
        expect(c.action.type).toBe("revive");
        expect(c.animType).toBe("revive");
        steps(game, 800);
        expect(b.downed).toBe(false);
    });

    it("M202: one trigger pull fires the volley of 4 rockets, then the launcher is discarded", () => {
        const { game, p, wm } = range("m202");
        // the rockets burst at the cursor (owner, 2026-10-08), so aim 30 u ahead
        send(game, p, { shootHold: true, shootStart: true, toMouseLen: 30 });
        game.step();
        send(game, p, { toMouseLen: 30 });
        expect(game.bullets.active.filter((b) => b.bulletType === "bullet_m202")).toHaveLength(1);
        expect(wm.activeSlot.ammo).toBe(3);
        steps(game, 12);
        expect(game.bullets.active.filter((b) => b.bulletType === "bullet_m202")).toHaveLength(4);
        expect(wm.activeSlot.ammo).toBe(0);
        expect(p.shotSeq).toBe(4);
        steps(game, 55);
        expect(wm.weapons[WeaponSlot.Primary].type).toBe("");
        expect(wm.curWeapIdx).toBe(WeaponSlot.Melee);
    });

    it("a dropped single-use gun keeps its shots on the server; a spent one drops nothing", () => {
        const { game, p, wm } = range("boys");
        clickFor(game, p, 160);
        expect(wm.activeSlot.ammo).toBe(5);
        game.dropItem(p.id, "boys", WeaponSlot.Primary);
        const loot = [...game.loot.items.values()].find((l) => l.type === "boys")!;
        expect(loot.charges).toBe(5);
        expect(loot.toView()).not.toHaveProperty("charges");
        const other = spawnAt(game, v2.add(p.pos, { x: 0, y: 6 }));
        other.pickupTicker = 0;
        expect(pickupLoot(game, other, loot)).toBe("success");
        expect(other.weaponManager.weapons[WeaponSlot.Primary]).toMatchObject({ type: "boys", ammo: 5 });
        // a fresh one from the map comes with all 7
        const fresh = game.loot.addLoot("boys", other.pos, 0, 1)!;
        expect(fresh.charges).toBeUndefined();
        const third = spawnAt(game, v2.add(p.pos, { x: 0, y: -6 }));
        third.pickupTicker = 0;
        pickupLoot(game, third, fresh);
        expect(third.weaponManager.weapons[WeaponSlot.Primary]).toMatchObject({ type: "boys", ammo: 7 });
        // the last shot fired, a death drops no empty tube
        const spent = range("panzerfaust");
        fireOnce(spent.game, spent.p);
        spent.game.dropItem(spent.p.id, "panzerfaust", WeaponSlot.Primary);
        expect([...spent.game.loot.items.values()].filter((l) => l.type === "panzerfaust")).toEqual([]);
    });
});

describe("single-use guns and roles", () => {
    it("a promotion's magazine refill skips a single-use gun (never reloaded), other guns still fill", () => {
        for (const role of ["medic", "lieutenant", "recon", "last_man"]) {
            const { game, p, wm } = range("boys");
            wm.activeSlot.ammo = 2;
            game.roles.promote(p, role);
            expect(wm.weapons[WeaponSlot.Primary], role).toMatchObject({ type: "boys", ammo: 2 });
        }
        // a spent Panzerfaust waiting for its discard gets no rocket back
        const spent = range("panzerfaust");
        fireOnce(spent.game, spent.p);
        spent.game.roles.promote(spent.p, "medic");
        expect(spent.wm.weapons[WeaponSlot.Primary].ammo).toBe(0);
        const ak = range("ak47");
        ak.wm.activeSlot.ammo = 5;
        ak.game.roles.promote(ak.p, "medic");
        expect(ak.wm.weapons[WeaponSlot.Primary]).toMatchObject({ type: "ak47", ammo: 30 });
    });
});

describe("DP-12 pump (new-gun-stats.md 4.3)", () => {
    it("two shots 0.2 s apart, then a 0.7 s pump, again and again", () => {
        const { game, p } = range("dp12");
        const gaps = intervals(clickFor(game, p, 330));
        expect(gaps.length).toBeGreaterThanOrEqual(6);
        gaps.forEach((g, i) => {
            expect(g, `gap ${i}`).toBeCloseTo(i % 2 === 0 ? 0.2 : 0.7, 6);
        });
    });

    it("a reload leaves it ready for a fresh pair; switching away and back keeps the count", () => {
        const { game, p, wm } = range("dp12");
        giveGun(p, "ak47", { slot: WeaponSlot.Secondary, reserve: 90 });
        wm.setCurWeapIndex(WeaponSlot.Primary, true);
        wm.activeSlot.cooldown = 0;
        fireOnce(game, p);
        expect(wm.activeSlot.pumpShots).toBe(1);
        // switch away and back: the next shot is the second of the pair, so a pump follows it
        wm.setCurWeapIndex(WeaponSlot.Secondary, true);
        steps(game, 120);
        wm.setCurWeapIndex(WeaponSlot.Primary, true);
        steps(game, 120);
        expect(wm.activeSlot.pumpShots).toBe(1);
        fireOnce(game, p);
        expect(wm.activeSlot.pumpShots).toBe(0);
        expect(wm.activeSlot.cooldown).toBeCloseTo(0.7, 6);
        // one shot, then a reload (2 shells, 1.2 s): a fresh pair
        steps(game, 80);
        fireOnce(game, p);
        expect(wm.activeSlot.pumpShots).toBe(1);
        steps(game, 25);
        send(game, p, { actions: [Input.Reload] });
        steps(game, 130);
        send(game, p, {});
        expect(wm.activeSlot.pumpShots ?? 0).toBe(0);
        steps(game, 200);
        const gaps = intervals(clickFor(game, p, 100));
        expect(gaps[0]).toBeCloseTo(0.2, 6);
        expect(gaps[1]).toBeCloseTo(0.7, 6);
    });
});

describe("DShK carry weight (new-gun-stats.md 4.1)", () => {
    it("10 u/s in a slot, 9 held, 2 firing, 11 with the fists; two DShKs carry -4; Small Arms only changes equip", () => {
        const { game, p, wm } = range("dshk");
        const speed = () => p.computeSpeed(game.world);
        const move = GameConfig.player.moveSpeed;
        expect(move).toBe(12);
        expect(speed()).toBe(9);
        p.shotSlowdownTimer = 0.1;
        expect(speed()).toBe(2);
        p.shotSlowdownTimer = 0;
        wm.setCurWeapIndex(WeaponSlot.Melee, true);
        expect(speed()).toBe(move - 2 + (getDef("fists") as { speed: { equip: number } }).speed.equip);
        expect(speed()).toBe(11);
        giveGun(p, "ak47", { slot: WeaponSlot.Secondary, reserve: 90 });
        expect(speed()).toBe(10);
        wm.setCurWeapIndex(WeaponSlot.Primary, true);
        p.perks.push("small_arms");
        expect(speed()).toBe(11);
        p.shotSlowdownTimer = 0.1;
        expect(speed()).toBe(3);
        p.shotSlowdownTimer = 0;
        p.perks.length = 0;
        wm.setWeapon(WeaponSlot.Secondary, "dshk", 30);
        expect(p.carrySpeed()).toBe(-4);
        expect(speed()).toBe(7);
        // Only the three heavy second/first-wave guns carry weight.
        for (const id of NEW_GUN_IDS.filter((g) => !["dshk", "negev", "kpv"].includes(g))) {
            wm.setWeapon(WeaponSlot.Secondary, id, 1);
            wm.setWeapon(WeaponSlot.Primary, id, 1);
            expect(p.carrySpeed(), id).toBe(0);
        }
    });
});

describe("fire modes of the new guns", () => {
    it("M16A4: 3-round bursts 0.075 s apart, the next burst 0.3 s after the last round", () => {
        const { game, p, def } = range("m16a4");
        const shots = recordShots(game, p, 100, () => ({ shootHold: true }));
        const gaps = intervals(shots);
        expect(def.burstCount).toBe(3);
        // 0.075 s is 7.5 ticks: the rounds of a burst come 8 and 7 ticks apart, 0.15 s for the pair
        for (const i of [0, 3]) {
            expect(gaps[i] + gaps[i + 1], `burst ${i / 3}`).toBeCloseTo(0.15, 6);
            expect(Math.abs(gaps[i] - 0.075)).toBeLessThanOrEqual(DT / 2 + 1e-9);
        }
        expect(gaps[2]).toBeCloseTo(0.3, 6);
        expect((shots[3] - shots[0]) * DT).toBeCloseTo(2 * 0.075 + 0.3, 6);
    });

    it("AA-12: one 64-damage slug per shot on full auto, every 0.3 s", () => {
        const { game, p, def } = range("aa12");
        const target = spawnAt(game, v2.add(p.pos, { x: 8, y: 0 }), { x: -1, y: 0 });
        fireOnce(game, p);
        expect(game.bullets.active.filter((b) => b.bulletType === "bullet_aa12")).toHaveLength(1);
        steps(game, 30);
        const bullet = getDefOfType("bullet", "bullet_aa12");
        expect(100 - target.health).toBeGreaterThan(bullet.damage * bullet.falloff);
        expect(100 - target.health).toBeLessThanOrEqual(bullet.damage);
        game.teleportPlayer(target.id, v2.add(p.pos, { x: 0, y: 40 }));
        steps(game, 50);
        const gaps = intervals(recordShots(game, p, 200, () => ({ shootHold: true })));
        expect(gaps.length).toBeGreaterThanOrEqual(4);
        for (const g of gaps) expect(g).toBeCloseTo(def.fireDelay, 6);
    });
});

describe("ammo rules of the launchers", () => {
    it("Endless Ammo never refills a launcher (RPG-7, M79), while other guns reload for free", () => {
        for (const id of ["rpg7", "m79", "gl06", "mgl"]) {
            const { game, p, wm } = range(id);
            p.perks.push("endless_ammo");
            p.inv.set(getDefOfType("gun", id).ammo, 0);
            fireOnce(game, p);
            steps(game, 100);
            expect(wm.activeSlot.ammo, id).toBe(getDefOfType("gun", id).maxClip - 1);
            expect(wm.tryReload(), id).toBe(false);
        }
        const ak = range("ak47");
        ak.p.perks.push("endless_ammo");
        ak.p.inv.set("556mm", 0);
        ak.wm.activeSlot.ammo = 10;
        expect(ak.wm.tryReload()).toBe(true);
    });

    it("the RPG-7 drops with its 4 rockets as two side stacks; reloading takes a rocket from the bag", () => {
        const game = flatGame();
        const pos = openSpot(game, 20);
        game.loot.addLoot("rpg7", pos, 0, 1);
        const rockets = [...game.loot.items.values()].filter((l) => l.type === "rocket").map((l) => l.count);
        expect(rockets).toEqual([2, 2]);
        const { game: g2, p, wm } = range("rpg7");
        p.inv.set("rocket", 3);
        fireOnce(g2, p);
        steps(g2, 30 + 360);
        expect([wm.activeSlot.ammo, p.inv.get("rocket")]).toEqual([1, 2]);
    });
});

describe("gold-only guns", () => {
    it("are never rolled by a potato swap (nor the launchers or the Boys)", () => {
        const { game, p, wm } = range("ak47");
        game.lootRng = constantRng(0.5);
        const seen = new Set<string>();
        for (let i = 0; i < 64; i++) {
            game.lootRng = constantRng(i / 64);
            wm.setWeapon(WeaponSlot.Primary, "ak47", 30);
            wm.setCurWeapIndex(WeaponSlot.Primary, true);
            randomWeaponSwap(game, p, { amount: 1, damageType: DamageType.Player, gameSourceType: "ak47" });
            seen.add(wm.weapons[WeaponSlot.Primary].type);
        }
        for (const id of seen) {
            const def = getDefOfType("gun", id);
            expect(def.goldOnly || def.charges || def.isLauncher, id).toBeFalsy();
        }
        expect([...seen].some((id) => NEW_GUN_IDS.includes(id))).toBe(true);
    });
});
