// Mobile players (M8): the touch movement stick, the mobile scope zoom table (camera and view culling), the 1.4x loot
// reach, and server-side auto loot and door opening (survev player.ts update "Mobile auto interaction", 2024-2099).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    addPerk,
    closestLoot,
    emptyInput,
    type Game,
    type Loot,
    type Obstacle,
    type Player,
    type PlayerInput,
} from "../src/index.ts";
import { wantsAutoLoot } from "../src/world/autoLoot.ts";
import { flatGame, giveGun, openSpot, steps } from "./combatHelpers.ts";
import { findClearPath } from "./helpers.ts";
import { addAt, flatTeamGame, hit } from "./teamHelpers.ts";

const MOBILE_ZOOM = GameConfig.scopeZoomRadius.mobile;
const DESKTOP_ZOOM = GameConfig.scopeZoomRadius.desktop;

/** Adds a player (mobile unless `isMobile` is false) at `pos` facing +x. */
function playerAt(game: Game, pos: Vec2, isMobile = true): Player {
    const id = game.addPlayer(isMobile ? "touch" : "desk", { isMobile });
    game.teleportPlayer(id, pos);
    const p = game.getPlayer(id)!;
    p.input = { ...emptyInput(), toMouseDir: { x: 1, y: 0 } };
    return p;
}

function send(game: Game, p: Player, input: Partial<PlayerInput>): void {
    game.setInput(p.id, { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, ...input });
}

function drop(game: Game, type: string, pos: Vec2, count = 1): Loot {
    return game.loot.addLoot(type, pos, 0, count, { pushSpeed: 0, noSideAmmo: true })!;
}

function ground(game: Game): string[] {
    return [...game.loot.items.values()].map((l) => l.type).sort();
}

/** A flat game with one mobile (or desktop) player on an open spot. */
function looter(isMobile = true): { game: Game; p: Player } {
    const game = flatGame();
    return { game, p: playerAt(game, openSpot(game, 20), isMobile) };
}

describe("touch movement", () => {
    /** Where a player starting at the same clear spot ends after one second of `input`. */
    function walkOneSecond(dir: Vec2, input: Partial<PlayerInput>, isMobile = true): Vec2 {
        const game = flatGame();
        const start = findClearPath(game.world, dir, 20, 4);
        const p = playerAt(game, start, isMobile);
        send(game, p, input);
        steps(game, 100);
        return v2.sub(p.pos, start);
    }

    it("walks along the stick at the speed of the keys on the same axis, whatever the pull", () => {
        const right = walkOneSecond({ x: 1, y: 0 }, { moveRight: true });
        expect(right.x).toBeCloseTo(GameConfig.player.moveSpeed + getDefOfType("melee", "fists").speed.equip, 6);
        for (const len of [1, 128, 255]) {
            const touch = walkOneSecond(
                { x: 1, y: 0 },
                { touchMoveActive: true, touchMoveDir: { x: 1, y: 0 }, touchMoveLen: len },
            );
            expect(touch.x).toBeCloseTo(right.x, 9);
            expect(touch.y).toBeCloseTo(0, 9);
        }
        // desktop clients may send it too: the movement rule does not depend on isMobile
        const desk = walkOneSecond(
            { x: 1, y: 0 },
            { touchMoveActive: true, touchMoveDir: { x: 1, y: 0 }, touchMoveLen: 9 },
            false,
        );
        expect(desk.x).toBeCloseTo(right.x, 9);
    });

    it("walks diagonally at the key speed and normalizes a stick that is not a unit vector", () => {
        const dir = v2.normalize({ x: -1, y: 1 });
        const keys = walkOneSecond(dir, { moveLeft: true, moveUp: true });
        const touch = walkOneSecond(dir, { touchMoveActive: true, touchMoveDir: { x: -3, y: 3 }, touchMoveLen: 40 });
        expect(touch.x).toBeCloseTo(keys.x, 6);
        expect(touch.y).toBeCloseTo(keys.y, 6);
        expect(v2.length(touch)).toBeCloseTo(13, 6);
    });

    it("uses the keys while the stick is inactive or has no pull, and ignores the keys while it is active", () => {
        const dir = { x: 1, y: 0 };
        const inactive = walkOneSecond(dir, {
            moveRight: true,
            touchMoveActive: false,
            touchMoveDir: { x: 0, y: 1 },
            touchMoveLen: 255,
        });
        expect(inactive.x).toBeCloseTo(13, 6);
        const noPull = walkOneSecond(dir, {
            moveRight: true,
            touchMoveActive: true,
            touchMoveDir: { x: 0, y: 1 },
            touchMoveLen: 0,
        });
        expect(noPull.x).toBeCloseTo(13, 6);
        expect(noPull.y).toBeCloseTo(0, 9);
        const up = { x: 0, y: 1 };
        const override = walkOneSecond(up, {
            moveDown: true,
            touchMoveActive: true,
            touchMoveDir: up,
            touchMoveLen: 200,
        });
        expect(override.y).toBeCloseTo(13, 6);
        expect(override.x).toBeCloseTo(0, 9);
    });
});

describe("mobile view", () => {
    it("uses the mobile scope zoom table for the camera radius", () => {
        const game = flatGame();
        const spot = openSpot(game, 20);
        const m = playerAt(game, spot);
        const d = playerAt(game, spot, false);
        expect([m.isMobile, d.isMobile]).toEqual([true, false]);
        expect(m.zoom).toBe(MOBILE_ZOOM["1xscope"]);
        expect(d.zoom).toBe(DESKTOP_ZOOM["1xscope"]);
        for (const scope of ["2xscope", "4xscope", "8xscope", "15xscope"]) {
            m.inv.set(scope, 1);
            d.inv.set(scope, 1);
            game.step();
            expect(m.zoom).toBe(MOBILE_ZOOM[scope]);
            expect(d.zoom).toBe(DESKTOP_ZOOM[scope]);
        }
        expect(MOBILE_ZOOM["1xscope"]).toBe(32);
        expect(MOBILE_ZOOM["15xscope"]).toBe(88);
        expect(game.getSnapshot(m.id).local.zoom).toBe(MOBILE_ZOOM["15xscope"]);
    });

    it("culls the snapshot with the mobile camera radius", () => {
        const game = flatGame();
        const spot = openSpot(game, 60);
        const m = playerAt(game, spot);
        const d = playerAt(game, spot, false);
        // 1x: desktop sees 28 + 4 units sideways, mobile 32 + 4; the item's bounds start 1 unit before its centre
        const loot = drop(game, "outfitDemo", v2.add(spot, { x: 34.5, y: 0 }));
        const ids = (p: Player) => game.getSnapshot(p.id).objects.map((o) => o.id);
        expect(ids(m)).toContain(loot.id);
        expect(ids(d)).not.toContain(loot.id);
    });
});

describe("mobile loot reach", () => {
    it("reaches loot from player rad + 1.4 x loot rad (touchLootRadMult)", () => {
        expect(GameConfig.player.touchLootRadMult).toBe(1.4);
        const game = flatGame();
        const spot = openSpot(game, 60);
        const m = playerAt(game, spot);
        const d = playerAt(game, v2.add(spot, { x: 30, y: 0 }), false);
        // an outfit (loot rad 1, never auto looted): desktop reach 2, mobile 2.4
        const nearM = drop(game, "outfitDemo", v2.add(m.pos, { x: 2.2, y: 0 }));
        drop(game, "outfitDemo", v2.add(d.pos, { x: 2.2, y: 0 }));
        expect(closestLoot(game, m)).toBe(nearM);
        expect(closestLoot(game, d)).toBeUndefined();
        const far = drop(game, "outfitDemo", v2.add(m.pos, { x: 0, y: 2.45 }));
        expect(closestLoot(game, m)).toBe(nearM);
        game.loot.remove(nearM);
        expect(closestLoot(game, m)).toBeUndefined();
        expect(far.destroyed).toBe(false);
    });
});

describe("mobile auto loot", () => {
    it("puts guns into empty gun slots that are not held, drawing the first one", () => {
        const { game, p } = looter();
        drop(game, "ak47", p.pos);
        steps(game, 1);
        expect(p.weapons[WeaponSlot.Primary].type).toBe("ak47");
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
        drop(game, "mp5", p.pos);
        steps(game, 25);
        expect(p.weapons[WeaponSlot.Secondary].type).toBe("mp5");
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
        // both slots full: a third gun stays on the ground (no swap of the held gun)
        drop(game, "scar", p.pos);
        steps(game, 50);
        expect(p.weapons[WeaponSlot.Primary].type).toBe("ak47");
        expect(ground(game)).toEqual(["scar"]);
    });

    it("leaves a second single pistol alone (it would fill an occupied slot as the dual version)", () => {
        const { game, p } = looter();
        giveGun(p, "ak47", { slot: WeaponSlot.Primary });
        giveGun(p, "m9", { slot: WeaponSlot.Secondary });
        p.weaponManager.setCurWeapIndex(WeaponSlot.Primary);
        drop(game, "m9", p.pos);
        steps(game, 50);
        expect(p.weapons[WeaponSlot.Secondary].type).toBe("m9");
        expect(ground(game)).toEqual(["m9"]);
    });

    it("takes a melee weapon over fists only", () => {
        const { game, p } = looter();
        drop(game, "machete", p.pos);
        steps(game, 1);
        expect(p.weapons[WeaponSlot.Melee].type).toBe("machete");
        drop(game, "katana", p.pos);
        steps(game, 50);
        expect(p.weapons[WeaponSlot.Melee].type).toBe("machete");
        expect(ground(game)).toEqual(["katana"]);
    });

    it("takes a perk only without a loot perk, never Trick or Treat?, and never one it cannot hold", () => {
        const { game, p } = looter();
        drop(game, "halloween_mystery", p.pos);
        steps(game, 20);
        expect(p.perks).toEqual([]);
        game.loot.remove([...game.loot.items.values()][0]);
        drop(game, "firepower", p.pos);
        steps(game, 1);
        expect(p.perks).toEqual(["firepower"]);
        drop(game, "splinter", p.pos);
        steps(game, 50);
        expect(p.perks).toEqual(["firepower"]);
        expect(ground(game)).toEqual(["splinter"]);
        // a role perk is not a loot perk, but a perk already held is not taken again
        const other = looter();
        addPerk(other.p, "splinter");
        const same = drop(other.game, "splinter", other.p.pos);
        expect(wantsAutoLoot(other.game, other.p, same)).toBe(false);
        steps(other.game, 30);
        expect(same.destroyed).toBe(false);
        expect(other.p.perks).toEqual(["splinter"]);
    });

    it("takes better armour and backpacks only", () => {
        const { game, p } = looter();
        for (const item of ["helmet02", "chest01", "backpack02"]) {
            drop(game, item, p.pos);
            steps(game, 15);
        }
        expect([p.helmet, p.chest, p.backpack]).toEqual(["helmet02", "chest01", "backpack02"]);
        // the level 0 pack is not dropped
        expect(ground(game)).toEqual([]);
        // a worse helmet stays (and, being the nearest item, it is the only one considered: survev getClosestLoot)
        const worse = drop(game, "helmet01", p.pos);
        steps(game, 60);
        expect(p.helmet).toBe("helmet02");
        expect(ground(game)).toEqual(["helmet01"]);
        game.loot.remove(worse);
        // an upgrade drops the old piece, which is then left alone
        drop(game, "chest02", p.pos);
        steps(game, 60);
        expect(p.chest).toBe("chest02");
        expect(ground(game)).toEqual(["chest01"]);
    });

    it("takes other items until their bag stack is full, and never outfits", () => {
        const { game, p } = looter();
        const cap = p.inv.capacity("bandage");
        p.inv.set("bandage", cap - 2);
        drop(game, "bandage", p.pos, 5);
        steps(game, 1);
        expect(p.inv.get("bandage")).toBe(cap);
        // the rest went back down; a full stack is left alone
        steps(game, 60);
        expect(p.inv.get("bandage")).toBe(cap);
        expect([...game.loot.items.values()].map((l) => [l.type, l.count])).toEqual([["bandage", 3]]);
        game.loot.remove([...game.loot.items.values()][0]);
        drop(game, "4xscope", p.pos);
        steps(game, 1);
        expect(p.scope).toBe("4xscope");
        const owned = drop(game, "4xscope", p.pos);
        steps(game, 60);
        expect(ground(game)).toEqual(["4xscope"]);
        game.loot.remove(owned);
        drop(game, "outfitDemo", p.pos);
        steps(game, 60);
        expect(p.outfit).toBe("outfitBase");
        expect(ground(game)).toEqual(["outfitDemo"]);
    });

    it("pauses for 3 s after the player dropped something", () => {
        const { game, p } = looter();
        p.inv.set("painkiller", 2);
        game.dropItem(p.id, "painkiller");
        expect(p.inv.get("painkiller")).toBe(1);
        expect(p.mobileDropTicker).toBe(3);
        const soda = drop(game, "soda", p.pos);
        steps(game, 290);
        expect(soda.destroyed).toBe(false);
        steps(game, 15);
        expect(soda.destroyed).toBe(true);
        expect(p.inv.get("soda")).toBe(1);
        expect(p.mobileDropTicker).toBe(0);
    });

    it("never runs for desktop players or downed mobile players", () => {
        const { game, p } = looter(false);
        drop(game, "ak47", p.pos);
        drop(game, "bandage", p.pos);
        drop(game, "helmet01", p.pos);
        steps(game, 100);
        expect(ground(game)).toEqual(["ak47", "bandage", "helmet01"]);
        expect(p.weapons[WeaponSlot.Primary].type).toBe("");

        const duo = flatTeamGame(2);
        const spot = openSpot(duo, 20);
        const opts = { group: "k", partySize: 2, autoFill: false };
        const m = addAt(duo, "m", spot, { ...opts, isMobile: true });
        addAt(duo, "mate", v2.add(spot, { x: 10, y: 0 }), opts);
        hit(duo, m, 150);
        expect(m.downed).toBe(true);
        drop(duo, "bandage", m.pos);
        steps(duo, 50);
        expect(ground(duo)).toEqual(["bandage"]);
    });
});

describe("mobile auto doors", () => {
    function doorGame(): { game: Game; door: Obstacle; hinge: Vec2 } {
        const probe = flatGame();
        const hinge = v2.add(openSpot(probe, 30), { x: 10, y: 0 });
        const game = flatGame([{ type: "house_door_01", pos: hinge, ori: 0 }]);
        return { game, door: game.world.get(1) as Obstacle, hinge };
    }

    it("opens closed doors in reach for mobile players only", () => {
        const desk = doorGame();
        playerAt(desk.game, v2.add(desk.hinge, { x: 1.4, y: 0.9 }), false);
        steps(desk.game, 50);
        expect(desk.door.door?.open).toBe(false);

        const { game, door, hinge } = doorGame();
        const far = playerAt(game, v2.add(hinge, { x: 6, y: 2 }));
        steps(game, 20);
        expect(door.door?.open).toBe(false);
        game.teleportPlayer(far.id, v2.add(hinge, { x: 1.4, y: 0.9 }));
        steps(game, 1);
        expect(door.door?.open).toBe(true);
        // it swung away from the player
        expect(door.ori).toBe(1);
    });

    it("waits with doors too while the drop pause runs", () => {
        const { game, door, hinge } = doorGame();
        const p = playerAt(game, v2.add(hinge, { x: 6, y: 2 }));
        p.inv.set("bandage", 4);
        game.dropItem(p.id, "bandage");
        game.teleportPlayer(p.id, v2.add(hinge, { x: 1.4, y: 0.9 }));
        steps(game, 250);
        expect(door.door?.open).toBe(false);
        steps(game, 60);
        expect(door.door?.open).toBe(true);
    });
});
