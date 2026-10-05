import { getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    constantRng,
    DT,
    flatGame,
    giveGun,
    intervals,
    openSpot,
    recordShots,
    send,
    spawnAt,
    steps,
} from "./combatHelpers.ts";

const HOLD = { shootHold: true };
const CLICK = { shootHold: true, shootStart: true };

function shooter(gun: string, reserve = 300) {
    const game = flatGame();
    game.combatRng = constantRng();
    const p = spawnAt(game, openSpot(game, 10));
    const def = giveGun(p, gun, { reserve });
    return { game, p, def };
}

/** Mean of a list. */
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("fire modes", () => {
    it.each(["ak47", "mp5", "m249", "vector", "mac10", "dp28"])(
        "auto %s fires every fireDelay with no drift",
        (gun) => {
            const { game, p, def } = shooter(gun);
            p.weaponManager.weapons[WeaponSlot.Primary].ammo = 1000;
            const shots = recordShots(game, p, 1000, () => HOLD);
            const gaps = intervals(shots);
            expect(gaps.length).toBeGreaterThan(20);
            for (const g of gaps) expect(Math.abs(g - def.fireDelay)).toBeLessThanOrEqual(DT + 1e-9);
            // exact carry-over: the average interval converges to fireDelay instead of rounding up to whole ticks
            expect(mean(gaps)).toBeCloseTo(def.fireDelay, 2);
            const span = (shots[shots.length - 1] - shots[0]) * DT;
            expect(Math.abs(span - gaps.length * def.fireDelay)).toBeLessThanOrEqual(DT + 1e-9);
        },
    );

    it.each(["m9", "deagle", "m870", "mosin", "m1911", "mk12"])(
        "single %s fires once per click, every fireDelay when spammed",
        (gun) => {
            const { game, p, def } = shooter(gun);
            p.weaponManager.weapons[WeaponSlot.Primary].ammo = 1000;
            const shots = recordShots(game, p, 1500, () => CLICK);
            const gaps = intervals(shots);
            for (const g of gaps.slice(1)) expect(Math.abs(g - def.fireDelay)).toBeLessThanOrEqual(DT + 1e-9);
            expect(mean(gaps.slice(1))).toBeCloseTo(def.fireDelay, 2);
            // holding without new clicks fires nothing more
            const held = recordShots(game, p, 300, () => HOLD);
            expect(held).toEqual([]);
        },
    );

    it("burst famas fires burstCount shots burstDelay apart, then waits fireDelay after the last one", () => {
        const { game, p, def } = shooter("famas");
        p.weaponManager.weapons[WeaponSlot.Primary].ammo = 999;
        const shots = recordShots(game, p, 1200, () => HOLD);
        const gaps = intervals(shots);
        const n = def.burstCount ?? 1;
        const bd = def.burstDelay ?? 0;
        const inBurst = gaps.filter((_, i) => i % n !== n - 1);
        const between = gaps.filter((_, i) => i % n === n - 1);
        for (const g of inBurst) expect(Math.abs(g - bd)).toBeLessThanOrEqual(DT + 1e-9);
        for (const g of between) expect(Math.abs(g - def.fireDelay)).toBeLessThanOrEqual(DT + 1e-9);
        // one burst cycle is (burstCount - 1) gaps + fireDelay
        const cycle = (shots[n * 10] - shots[0]) * DT;
        expect(cycle / 10).toBeCloseTo((n - 1) * bd + def.fireDelay, 2);
    });

    it("dual pistols alternate barrels", () => {
        const { game, p } = shooter("m9_dual");
        const hands: boolean[] = [];
        for (let i = 0; i < 200 && hands.length < 6; i++) {
            const seq = p.shotSeq;
            send(game, p, CLICK);
            game.step();
            if (p.shotSeq !== seq) hands.push(p.shotOffhand);
        }
        expect(hands).toEqual([false, true, false, true, false, true]);
    });

    it("m870 fires 9 pellets per shot and uses one shell", () => {
        const { game, p } = shooter("m870");
        const before = game.bullets.active.length;
        send(game, p, CLICK);
        game.step();
        expect(game.bullets.active.length - before).toBe(9);
        expect(p.weapons[WeaponSlot.Primary].ammo).toBe(4);
        // shotFx only on the first pellet
        expect(game.bullets.active.filter((b) => b.shotFx)).toHaveLength(1);
    });

    it("spreads shots by shotSpread standing and shotSpread + moveSpread moving", () => {
        for (const moving of [false, true]) {
            const game = flatGame();
            game.combatRng = constantRng(0); // deviation = -spread / 2
            const p = spawnAt(game, openSpot(game, 10));
            const def = giveGun(p, "ak47", { reserve: 90 });
            send(game, p, { ...HOLD, moveUp: moving });
            game.step();
            const b = game.bullets.active[0];
            const angle = (Math.atan2(b.dir.y, b.dir.x) * 180) / Math.PI;
            const spread = def.shotSpread + (moving ? def.moveSpread : 0);
            expect(angle).toBeCloseTo(-spread / 2, 6);
        }
    });

    it("gives deagle shots first-shot accuracy after recoilTime", () => {
        const game = flatGame();
        game.combatRng = constantRng(0);
        const p = spawnAt(game, openSpot(game, 10));
        const def = giveGun(p, "deagle", { reserve: 50 });
        steps(game, Math.ceil(def.recoilTime / DT) + 1);
        send(game, p, CLICK);
        game.step();
        expect(game.bullets.active[0].dir.y).toBeCloseTo(0, 9);
        // a quick follow-up shot gets the spread back
        steps(game, Math.ceil(def.fireDelay / DT) + 1);
        send(game, p, CLICK);
        game.step();
        const last = game.bullets.active[game.bullets.active.length - 1];
        expect(Math.abs(last.dir.y)).toBeGreaterThan(0.001);
    });

    it("slows the shooter by speed.attack and x0.5 while the shot slowdown runs", () => {
        const { game, p } = shooter("m249");
        p.weaponManager.weapons[WeaponSlot.Primary].ammo = 100;
        send(game, p, { ...HOLD, moveRight: true });
        steps(game, 20);
        const def = getDefOfType("gun", "m249");
        expect(p.speed).toBeCloseTo((12 + def.speed.equip + def.speed.attack) * 0.5, 9);
        send(game, p, { moveRight: true });
        steps(game, 30);
        expect(p.speed).toBe(12);
    });

    it("refuses to fire guns that need later systems (projectiles, explosive rounds)", () => {
        for (const gun of ["usas", "potato_cannon"]) {
            const { game, p } = shooter(gun, 0);
            const ammo = p.weapons[WeaponSlot.Primary].ammo;
            recordShots(game, p, 200, () => CLICK);
            expect(p.shotSeq).toBe(0);
            expect(p.weapons[WeaponSlot.Primary].ammo).toBe(ammo);
        }
    });
});

describe("reloads", () => {
    /** Empties the magazine and returns the tick of the last shot. */
    function emptyMag(game: ReturnType<typeof flatGame>, p: ReturnType<typeof spawnAt>, auto: boolean): number {
        let last = 0;
        for (let i = 0; i < 2000 && p.weapons[p.curWeapIdx].ammo > 0; i++) {
            const seq = p.shotSeq;
            send(game, p, auto ? HOLD : CLICK);
            game.step();
            if (p.shotSeq !== seq) last = game.tick;
        }
        return last;
    }

    /** Ticks at which reload actions start and end, until `ticks` pass. */
    function reloadActions(game: ReturnType<typeof flatGame>, p: ReturnType<typeof spawnAt>, ticks: number) {
        const actions: Array<{ start: number; end: number; ammoAfter: number; type: string }> = [];
        let open: { start: number; type: string } | null = null;
        for (let i = 0; i < ticks; i++) {
            const seq = p.action.seq;
            send(game, p, {});
            game.step();
            if (p.action.seq === seq) continue;
            if (open) actions.push({ ...open, end: game.tick, ammoAfter: p.weapons[p.curWeapIdx].ammo });
            open = p.action.type === "none" ? null : { start: game.tick, type: p.action.type };
        }
        return actions;
    }

    it("reloads an empty ak47 in exactly reloadTime once the fire cooldown has passed", () => {
        const { game, p, def } = shooter("ak47", 90);
        const last = emptyMag(game, p, true);
        const actions = reloadActions(game, p, 400);
        expect(actions).toHaveLength(1);
        expect((actions[0].start - last) * DT).toBeCloseTo(def.fireDelay, 9);
        expect((actions[0].end - actions[0].start) * DT).toBeCloseTo(def.reloadTime, 9);
        expect(actions[0].ammoAfter).toBe(30);
        expect(p.inv.get("762mm")).toBe(60);
    });

    it("reloads an m870 one shell per reloadTime, chained without gaps", () => {
        const { game, p, def } = shooter("m870", 30);
        emptyMag(game, p, false);
        const actions = reloadActions(game, p, 600);
        expect(actions.map((a) => a.ammoAfter)).toEqual([1, 2, 3, 4, 5]);
        for (const a of actions) expect((a.end - a.start) * DT).toBeCloseTo(def.reloadTime, 9);
        expect((actions[4].end - actions[0].start) * DT).toBeCloseTo(5 * def.reloadTime, 9);
        expect(p.inv.get("12gauge")).toBe(25);
    });

    it("uses the mosin's full-clip alternate reload when empty with enough reserve, single rounds otherwise", () => {
        const { game, p, def } = shooter("mosin", 20);
        emptyMag(game, p, false);
        const alt = reloadActions(game, p, 500);
        expect(alt).toHaveLength(1);
        expect((alt[0].end - alt[0].start) * DT).toBeCloseTo(def.reloadTimeAlt ?? 0, 9);
        expect(alt[0].ammoAfter).toBe(5);
        // only maxReload rounds left: the short single-round reload
        const low = shooter("mosin", 1);
        emptyMag(low.game, low.p, false);
        const single = reloadActions(low.game, low.p, 300);
        expect(single).toHaveLength(1);
        expect((single[0].end - single[0].start) * DT).toBeCloseTo(def.reloadTime, 9);
        expect(single[0].ammoAfter).toBe(1);
    });

    it("reloads on request, cancels on switch and refuses with an empty bag", () => {
        const { game, p } = shooter("ak47", 90);
        recordShots(game, p, 5, () => HOLD);
        send(game, p, { actions: [Input.Reload] });
        steps(game, 20);
        expect(p.action.type).toBe("reload");
        send(game, p, { actions: [Input.EquipMelee] });
        game.step();
        expect(p.action.type).toBe("none");
        expect(p.activeWeapon).toBe("fists");
        const dry = shooter("ak47", 0);
        recordShots(dry.game, dry.p, 40, () => HOLD);
        send(dry.game, dry.p, { actions: [Input.Reload] });
        steps(dry.game, 30);
        expect(dry.p.action.type).toBe("none");
    });

    it("firing a gun with rounds left cancels its reload", () => {
        const { game, p } = shooter("m870", 30);
        recordShots(game, p, 1, () => CLICK);
        send(game, p, { actions: [Input.Reload] });
        steps(game, 95);
        expect(p.action.type).toBe("reload");
        const shots = recordShots(game, p, 2, () => CLICK);
        expect(shots).toHaveLength(1);
        expect(p.action.type).toBe("none");
    });
});

describe("weapon switching", () => {
    function twoGuns(a: string, b: string) {
        const game = flatGame();
        game.combatRng = constantRng();
        const p = spawnAt(game, openSpot(game, 10));
        giveGun(p, b, { slot: WeaponSlot.Secondary, reserve: 90 });
        giveGun(p, a, { slot: WeaponSlot.Primary, reserve: 90 });
        return { game, p };
    }

    /** Ticks from sending `action` (with the trigger spammed) until the first shot. */
    function switchThenShoot(game: ReturnType<typeof flatGame>, p: ReturnType<typeof spawnAt>, action: number) {
        send(game, p, { ...CLICK, actions: [action] });
        const start = game.tick;
        let seq = p.shotSeq;
        game.step();
        for (let i = 0; i < 500 && p.shotSeq === seq; i++) {
            seq = p.shotSeq;
            send(game, p, CLICK);
            game.step();
        }
        return (game.tick - start) * DT;
    }

    it("charges baseSwitchDelay for the first switch per second, the gun's switchDelay after that", () => {
        const { game, p } = twoGuns("ak47", "mp5");
        steps(game, 200);
        // first switch: free (0.25 s)
        const first = switchThenShoot(game, p, Input.EquipSecondary);
        expect(first).toBeCloseTo(0.25, 9);
        // immediately back: the ak47's switchDelay
        const second = switchThenShoot(game, p, Input.EquipPrimary);
        expect(second).toBeCloseTo(getDefOfType("gun", "ak47").switchDelay, 9);
    });

    it("forces the full switchDelay between guns of one deploy group while the first still cycles", () => {
        const { game, p } = twoGuns("m870", "spas12");
        steps(game, 200);
        recordShots(game, p, 1, () => CLICK);
        // even a free switch costs the spas12's full switchDelay after an m870 shot
        const t = switchThenShoot(game, p, Input.EquipSecondary);
        expect(t).toBeCloseTo(getDefOfType("gun", "spas12").switchDelay, 9);
        // a gun outside the group gets the free switch
        const other = twoGuns("m870", "mosin");
        steps(other.game, 200);
        recordShots(other.game, other.p, 1, () => CLICK);
        expect(switchThenShoot(other.game, other.p, Input.EquipSecondary)).toBeCloseTo(0.25, 9);
    });

    it("cycles slots, swaps slots and returns to the last weapon", () => {
        const { game, p } = twoGuns("ak47", "mp5");
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
        send(game, p, { actions: [Input.EquipNextWeap] });
        game.step();
        expect(p.curWeapIdx).toBe(WeaponSlot.Secondary);
        send(game, p, { actions: [Input.EquipNextWeap] });
        game.step();
        expect(p.curWeapIdx).toBe(WeaponSlot.Melee);
        // the empty throwable slot is skipped
        send(game, p, { actions: [Input.EquipNextWeap] });
        game.step();
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
        send(game, p, { actions: [Input.EquipLastWeap] });
        game.step();
        expect(p.curWeapIdx).toBe(WeaponSlot.Melee);
        send(game, p, { actions: [Input.EquipOtherGun] });
        game.step();
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
        send(game, p, { actions: [Input.SwapWeapSlots] });
        game.step();
        expect(p.weapons[WeaponSlot.Primary].type).toBe("mp5");
        expect(p.weapons[WeaponSlot.Secondary].type).toBe("ak47");
        expect(p.activeWeapon).toBe("ak47");
        expect(p.curWeapIdx).toBe(WeaponSlot.Secondary);
    });

    it("cannot switch away in the middle of a burst", () => {
        const { game, p } = twoGuns("famas", "mp5");
        recordShots(game, p, 1, () => HOLD);
        send(game, p, { shootHold: true, actions: [Input.EquipSecondary] });
        game.step();
        expect(p.activeWeapon).toBe("famas");
    });
});
