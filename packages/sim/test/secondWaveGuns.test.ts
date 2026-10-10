// Owner-approved specs: docs/design/second-wave-gun-specs-draft.md (2026-10-10).
// Exercise firing, reloading and carrying in the real simulation, beyond checking data objects.
import { GameConfig, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { constantRng, DT, flatGame, giveGun, openSpot, recordShots, send, spawnAt, steps } from "./combatHelpers.ts";

function holder(id: string) {
    const game = flatGame();
    game.combatRng = constantRng();
    const p = spawnAt(game, openSpot(game, 80));
    const def = giveGun(p, id, { reserve: 200 });
    return { game, p, def, wm: p.weaponManager };
}

describe("second wave: finite charges", () => {
    it.each([
        ["nlaw", 1],
        ["bazooka", 1],
        ["pvg42", 10],
        ["maadi", 8],
    ] as const)("%s fires exactly %i shots, cannot reload, and leaves its slot", (id, count) => {
        const { game, p, def, wm } = holder(id);
        p.perks.push("endless_ammo");
        const shots = recordShots(game, p, Math.ceil((count * def.fireDelay + 1) / DT), () => ({
            shootStart: true,
            shootHold: true,
            toMouseLen: 70,
        }));
        expect(shots).toHaveLength(count);
        expect(wm.weapons[WeaponSlot.Primary].type).toBe("");
        giveGun(p, id, { ammo: count - 1 });
        expect(wm.tryReload()).toBe(false);
        expect(wm.activeSlot.ammo).toBe(count - 1);
        expect(p.inv.capacity(def.ammo)).toBe(0);
    });
});

describe("second wave: reload and fire rate", () => {
    it.each(["paw20", "rpd", "bren", "jackhammer", "mg3", "negev", "kpv"])(
        "%s uses reserve ammo and reloads its complete magazine",
        (id) => {
            const { game, p, def, wm } = holder(id);
            wm.activeSlot.ammo = 0;
            const reserve = p.inv.get(def.ammo);
            expect(wm.tryReload()).toBe(true);
            expect(p.action.type).toBe("reload");
            steps(game, Math.ceil(def.reloadTime / DT) + 2);
            expect(wm.activeSlot.ammo).toBe(def.maxClip);
            expect(p.inv.get(def.ammo)).toBe(reserve - def.maxClip);
        },
    );

    it.each(["rpd", "bren", "mg3", "negev", "kpv"])("%s maintains its configured automatic interval", (id) => {
        const { game, p, def } = holder(id);
        const shots = recordShots(game, p, 100, () => ({ shootHold: true, toMouseLen: 70 }));
        expect(shots.length).toBeGreaterThan(5);
        const elapsed = (shots.at(-1)! - shots[0]) * DT;
        expect(Math.abs(elapsed - (shots.length - 1) * def.fireDelay)).toBeLessThanOrEqual(DT + 1e-8);
    });

    it("Jackhammer emits nine pellets per shell", () => {
        const { game, p, wm } = holder("jackhammer");
        send(game, p, { shootHold: true });
        game.step();
        expect(game.bullets.active.filter((b) => b.bulletType === "bullet_jackhammer")).toHaveLength(9);
        expect(wm.activeSlot.ammo).toBe(9);
    });
});

describe("second wave: heavy carry", () => {
    it.each([
        ["negev", -1.5],
        ["kpv", -2.5],
    ] as const)("%s slows the carrier in either slot while a rifle is equipped", (id, carry) => {
        for (const slot of [WeaponSlot.Primary, WeaponSlot.Secondary]) {
            const { game, p, wm } = holder("ak47");
            const other = slot === WeaponSlot.Primary ? WeaponSlot.Secondary : WeaponSlot.Primary;
            giveGun(p, "ak47", { slot: other });
            wm.setWeapon(slot, id, getDefOfType("gun", id).maxClip);
            expect(p.carrySpeed()).toBe(carry);
            expect(p.computeSpeed(game.world)).toBe(GameConfig.player.moveSpeed + carry);
        }
    });

    it("Negev and KPV carry penalties add across the two slots", () => {
        const { p, wm } = holder("negev");
        wm.setWeapon(WeaponSlot.Secondary, "kpv", 40);
        expect(p.carrySpeed()).toBe(-4);
    });
});
