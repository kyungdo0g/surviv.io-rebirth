// Collapsing buildings (the owner, 2026-10-10; sim world/collapse.ts): a building whose def sets
// `ceiling.destroy.collapse` caves in once `wallCount` of its walls are broken: everyone on its floor dies at once
// (DamageType.Collapse, credited to whoever broke the last wall, nothing dropped), its obstacles and the loot on its
// floor are gone, and players outside are untouched. The building is a test-only def built from the breakable brick
// walls (rebirth_wall_brk_4), added to the defs for this file only (the real collapsing buildings come next).
import { type Vec2, v2 } from "@rebirth/core";
import {
    type BuildingChildDef,
    type BuildingDef,
    DamageType,
    getMapObjectDefOfType,
    type MapObjectDef,
    MapObjectDefs,
    rebirthWallBrk,
} from "@rebirth/defs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Building, Game, type Obstacle, type Player, setOutfit } from "../src/index.ts";
import { generateShowcase } from "../src/mapgen/showcase.ts";
import { placePlayer } from "./buildingHelpers.ts";

const TYPE = "test_collapse_hut_01";
const HALF = 6;
/** 12 brick wall pieces round a 12 x 12 floor; the roof (and the hut) falls with the fifth (40 %). */
const WALL_COUNT = 5;

function hutDef(): BuildingDef {
    const base = getMapObjectDefOfType("building", "clinic_01");
    const wall = rebirthWallBrk(4);
    const child = (type: string, x: number, y: number, ori = 0): BuildingChildDef => ({
        type,
        pos: { x, y },
        scale: 1,
        ori,
    });
    const walls: BuildingChildDef[] = [];
    for (const t of [-4, 0, 4]) {
        walls.push(child(wall, -HALF, t), child(wall, HALF, t), child(wall, t, -HALF, 1), child(wall, t, HALF, 1));
    }
    const floor = { type: 1 as const, min: { x: -HALF, y: -HALF }, max: { x: HALF, y: HALF }, height: 0 };
    return {
        ...base,
        mapObstacleBounds: undefined,
        occupiedEmitters: undefined,
        healRegions: undefined,
        puzzle: undefined,
        soundEmitters: undefined,
        floor: { surfaces: [{ type: "house", collision: [floor] }], imgs: [] },
        ceiling: {
            zoomRegions: [{ zoomIn: floor }],
            imgs: [],
            destroy: {
                wallCount: WALL_COUNT,
                particle: "shackBreak",
                particleCount: 25,
                residue: "",
                collapse: true,
            },
        },
        mapObjects: [...walls, child("crate_01", -3, -3), child("barrel_01", 3, 3)],
    };
}

const defs = MapObjectDefs as Record<string, MapObjectDef>;

beforeAll(() => {
    defs[TYPE] = hutDef();
});
afterAll(() => {
    delete defs[TYPE];
});

/** A sandbox game on a showcase map holding only the hut. */
function hutGame(): { game: Game; hut: Building } {
    const show = generateShowcase(TYPE, 1, "main");
    const game = new Game(
        { mapName: "main", seed: 1 },
        { generation: show.generation, spawnLoot: false, sandbox: true },
    );
    const hut = game.world.buildings.find((b) => b.type === TYPE);
    if (!hut) throw new Error("no hut");
    return { game, hut };
}

function children(game: Game, hut: Building): Obstacle[] {
    return hut.childIds.map((id) => game.world.get(id)).filter((o): o is Obstacle => o?.kind === "obstacle");
}

function lootNear(game: Game, pos: Vec2, rad: number): string[] {
    const out: string[] = [];
    for (const o of game.world.objects.values())
        if (o.kind === "loot" && v2.distance(o.pos, pos) < rad) out.push(o.type);
    return out;
}

function breakWall(game: Game, wall: Obstacle, by: Player): void {
    game.damageObstacle(wall, { amount: 1000, damageType: DamageType.Player, gameSourceType: "ak47", sourceId: by.id });
}

describe("collapsing buildings", () => {
    it("cave in at wallCount broken walls: everyone inside dies buried, the hut and its loot are gone", () => {
        const { game, hut } = hutGame();
        const c = hut.pos;
        // offsets inside the floor whatever the hut's ori, clear of the crate and the barrel on the diagonals
        const inside = placePlayer(game, v2.add(c, { x: 0, y: 2 }));
        const downed = placePlayer(game, v2.add(c, { x: 0, y: -2 }));
        const outside = placePlayer(game, v2.add(c, { x: 0, y: 16 }));
        const shooter = placePlayer(game, v2.add(c, { x: 16, y: 0 }));
        inside.weaponManager.setWeapon(0, "ak47", 30);
        inside.helmet = "helmet02";
        inside.inv.give("bandage", 5);
        downed.downed = true;
        game.loot.addLoot("bandage", v2.add(c, { x: 2, y: 0 }), 0, 1, { pushSpeed: 0 });
        game.loot.addLoot("bandage", v2.add(c, { x: 0, y: 20 }), 0, 1, { pushSpeed: 0 });
        game.getSnapshot(outside.id);

        const walls = children(game, hut).filter((o) => o.type === rebirthWallBrk(4));
        expect(walls).toHaveLength(12);
        expect(walls[0].def).toMatchObject({ health: 300, destructible: true, isWall: true, material: "brick" });
        const childIds = children(game, hut).map((o) => o.id);
        for (const w of walls.slice(0, WALL_COUNT - 1)) breakWall(game, w, shooter);
        // one wall short: the hut stands
        expect([hut.ceilingDead, inside.dead, downed.dead]).toEqual([false, false, false]);
        expect(childIds.every((id) => game.world.get(id))).toBe(true);

        breakWall(game, walls[WALL_COUNT - 1], shooter);
        expect(hut.ceilingDead).toBe(true);
        expect([inside.dead, downed.dead, outside.dead, shooter.dead]).toEqual([true, true, false, false]);
        expect(shooter.kills).toBe(2);
        expect(inside.killedBy).toBe(shooter.id);
        // walls, crate and barrel removed silently: no loot, no explosion
        expect(childIds.filter((id) => game.world.get(id))).toEqual([]);
        expect(lootNear(game, c, HALF * 1.5)).toEqual([]);
        expect(lootNear(game, v2.add(c, { x: 0, y: 20 }), 1)).toEqual(["bandage"]);
        // nothing was dropped and nothing is carried any more
        expect([inside.helmet, inside.inv.get("bandage"), inside.weaponManager.weapons[0].type]).toEqual(["", 0, ""]);
        for (let i = 0; i < 100; i++) game.step();
        expect(lootNear(game, c, HALF * 2)).toEqual([]);
        expect(outside.dead).toBe(false);

        const kills = (game.getSnapshot(outside.id).kills ?? []).filter((k) => k.killed);
        expect(kills.map((k) => [k.targetId, k.damageType, k.mapSourceType, k.killCreditId, k.source])).toEqual([
            [inside.id, DamageType.Collapse, TYPE, shooter.id, "collapse"],
            [downed.id, DamageType.Collapse, TYPE, shooter.id, "collapse"],
        ]);
    });

    it("a hut brought down by no player credits nobody", () => {
        const { game, hut } = hutGame();
        const inside = placePlayer(game, v2.add(hut.pos, { x: 0, y: 2 }));
        const walls = children(game, hut).filter((o) => o.isWall);
        for (const w of walls.slice(0, WALL_COUNT)) {
            game.damageObstacle(w, { amount: 1000, damageType: DamageType.Airstrike, isExplosion: true });
        }
        expect(inside.dead).toBe(true);
        expect(inside.killedBy).toBe(0);
    });

    it("a buried barrel disguise goes silently: no explosion, no loot", () => {
        const { game, hut } = hutGame();
        const inside = placePlayer(game, v2.add(hut.pos, { x: 0, y: 2 }));
        const shooter = placePlayer(game, v2.add(hut.pos, { x: 9, y: 0 }));
        setOutfit(game, inside, "outfitBarrel");
        const skinId = inside.disguiseId;
        expect(skinId).toBeGreaterThan(0);
        for (const w of children(game, hut)
            .filter((o) => o.isWall)
            .slice(0, WALL_COUNT))
            breakWall(game, w, shooter);
        expect(inside.dead).toBe(true);
        expect(game.world.get(skinId)).toBeUndefined();
        for (let i = 0; i < 30; i++) game.step();
        expect(shooter.health).toBe(100);
        expect(lootNear(game, hut.pos, HALF * 2)).toEqual([]);
    });
});
