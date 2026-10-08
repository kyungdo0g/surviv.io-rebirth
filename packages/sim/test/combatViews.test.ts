import { v2 } from "@rebirth/core";
import { Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { emptyInput, Game, type PlayerView } from "../src/index.ts";
import { constantRng, fireOnce, flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";

const CLICK = { shootHold: true, shootStart: true };

describe("pans", () => {
    function panDuel(worn: boolean) {
        const game = flatGame();
        game.combatRng = constantRng();
        const origin = openSpot(game, 30);
        const holder = spawnAt(game, v2.add(origin, { x: 20, y: 0 }), worn ? { x: 1, y: 0 } : { x: -1, y: 0 });
        if (worn) {
            giveGun(holder, "mp5", { reserve: 0 });
            holder.weaponManager.setWeapon(WeaponSlot.Melee, "pan", 0);
        } else {
            holder.weaponManager.setWeapon(WeaponSlot.Melee, "pan", 0);
        }
        // the bullet line crosses the pan before the body (see the pan reflectSurface in the melee defs)
        const shooter = spawnAt(game, v2.add(holder.pos, { x: -12, y: worn ? -0.7 : 0.4 }));
        giveGun(shooter, "ak47", { reserve: 0 });
        return { game, holder, shooter };
    }

    it("a held pan reflects bullets instead of taking them", () => {
        const { game, holder, shooter } = panDuel(false);
        expect(holder.activeWeapon).toBe("pan");
        expect(holder.hasActivePan()).toBe(true);
        fireOnce(game, shooter);
        steps(game, 20);
        expect(holder.health).toBe(100);
        const bullets = game.bullets.reports.map((r) => r.bullet);
        expect(bullets.some((b) => b.reflectCount === 1 && b.reflectObjId === 0)).toBe(true);
    });

    it("a pan worn on the back reflects bullets from behind", () => {
        const { game, holder, shooter } = panDuel(true);
        expect(holder.wearingPan).toBe(true);
        expect(game.getSnapshot(holder.id).objects.find((o) => o.id === holder.id)).toMatchObject({ wearingPan: true });
        fireOnce(game, shooter);
        steps(game, 20);
        expect(holder.health).toBe(100);
        // without the pan the same shot hits
        const bare = panDuel(true);
        bare.holder.weaponManager.setWeapon(WeaponSlot.Melee, "fists", 0);
        expect(bare.holder.wearingPan).toBe(false);
        fireOnce(bare.game, bare.shooter);
        steps(bare.game, 20);
        expect(bare.holder.health).toBeLessThan(100);
    });
});

describe("outsideOnly guns", () => {
    it("refuse to fire indoors (a building zoom region) and fire outside", () => {
        const game = new Game({ mapName: "main", seed: 12345 }, { spawnLoot: false });
        const id = game.addPlayer("a");
        const p = game.getPlayer(id)!;
        giveGun(p, "flare_gun", { reserve: 2 });
        const house = game.mapData.objects.find((o) => o.type === "house_red_01")!;
        game.teleportPlayer(id, house.pos);
        send(game, p, {});
        steps(game, 2);
        expect(p.indoors).toBe(true);
        fireOnce(game, p);
        expect(p.shotSeq).toBe(0);
        expect(p.weapons[WeaponSlot.Primary].ammo).toBe(1);
        // somewhere outdoors 40 u away (the map's other buildings move with its generation)
        for (const [dx, dy] of [
            [0, -40],
            [0, 40],
            [-40, 0],
            [40, 0],
        ]) {
            game.teleportPlayer(id, { x: house.pos.x + dx, y: house.pos.y + dy });
            send(game, p, {});
            steps(game, 100);
            if (!p.indoors) break;
        }
        expect(p.indoors).toBe(false);
        fireOnce(game, p);
        expect(p.shotSeq).toBe(1);
    });
});

describe("player views", () => {
    it("report the melee animation, reload action and cooldowns", () => {
        const game = flatGame();
        const p = spawnAt(game, openSpot(game, 10));
        const view = () => game.getSnapshot(p.id).objects.find((o) => o.id === p.id) as PlayerView;
        expect(view()).toMatchObject({
            anim: { type: "none", seq: 0 },
            action: { type: "none", seq: 0, item: "", duration: 0 },
            shot: { seq: 0, offHand: false },
            wearingPan: false,
        });
        send(game, p, CLICK);
        game.step();
        send(game, p, {});
        expect(view().anim).toEqual({ type: "melee", seq: 1 });
        steps(game, 30);
        expect(view().anim).toEqual({ type: "none", seq: 2 });

        giveGun(p, "ak47", { reserve: 90, ammo: 10 });
        send(game, p, { actions: [Input.Reload] });
        game.step();
        send(game, p, {});
        game.step();
        const snap = game.getSnapshot(p.id);
        const v = snap.objects.find((o) => o.id === p.id) as PlayerView;
        expect(v.action).toMatchObject({ type: "reload", item: "ak47", duration: 2.5 });
        expect(snap.local.action).toMatchObject({ type: "reload", item: "ak47", duration: 2.5 });
        expect(snap.local.action!.time).toBeCloseTo(0.01, 9);
        expect(snap.local.weapons[WeaponSlot.Primary]).toEqual({ type: "ak47", ammo: 10 });
        expect(snap.local.inventory["762mm"]).toBe(90);
        expect(snap.local.scope).toBe("1xscope");
        expect(snap.local.backpack).toBe("backpack03");
        expect(snap.local.cooldowns!.weapons).toHaveLength(4);
        steps(game, 260);
        expect(game.getSnapshot(p.id).local.weapons[WeaponSlot.Primary].ammo).toBe(30);
    });

    it("consume a click that arrives between ticks exactly once", () => {
        const game = flatGame();
        const p = spawnAt(game, openSpot(game, 10));
        giveGun(p, "m9", { reserve: 0 });
        // two client frames before one tick: the click must not be lost, and fires once
        game.setInput(p.id, { ...emptyInput(1), toMouseDir: { x: 1, y: 0 }, shootStart: true, shootHold: true });
        game.setInput(p.id, { ...emptyInput(2), toMouseDir: { x: 1, y: 0 }, shootHold: true });
        steps(game, 50);
        expect(p.shotSeq).toBe(1);
    });
});

describe("combat determinism", () => {
    it("produces identical snapshots for identical inputs (shooting, loot, deaths)", () => {
        const run = () => {
            const game = new Game({ mapName: "main", seed: 777 });
            const a = game.addPlayer("a");
            const b = game.addPlayer("b");
            const pa = game.getPlayer(a)!;
            const pb = game.getPlayer(b)!;
            game.teleportPlayer(b, v2.add(pa.pos, { x: 12, y: 3 }));
            giveGun(pa, "m870", { reserve: 30 });
            giveGun(pb, "mp5", { reserve: 120 });
            const snaps = [];
            for (let i = 0; i < 400; i++) {
                const toB = v2.normalize(v2.sub(pb.pos, pa.pos));
                game.setInput(a, {
                    ...emptyInput(i),
                    toMouseDir: toB,
                    shootStart: i % 7 === 0,
                    shootHold: true,
                    moveUp: i % 50 < 20,
                });
                game.setInput(b, {
                    ...emptyInput(i),
                    toMouseDir: v2.neg(toB),
                    shootHold: i % 3 !== 0,
                    moveLeft: i % 40 < 10,
                });
                game.step();
                if (i % 3 === 0) snaps.push(game.getSnapshot(a), game.getSnapshot(b));
            }
            return snaps;
        };
        const first = run();
        expect(first.some((s) => (s.bullets?.length ?? 0) > 0)).toBe(true);
        expect(run()).toEqual(first);
    });
});
