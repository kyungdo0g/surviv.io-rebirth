// Shared setup for the bot tests: cached map generations, flat games (terrain only), spawning players and bots at
// fixed spots, giving guns, and stepping a game with its bots.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, type GasStage, getDefOfType, WeaponSlot } from "@rebirth/defs";
import {
    type AddPlayerOptions,
    emptyInput,
    Game,
    type GameInit,
    type GeneratedObject,
    type GenerateMapResult,
    generateMap,
    type Player,
} from "@rebirth/sim";
import { BotController } from "../src/controller.ts";
import type { Difficulty } from "../src/difficulty.ts";

const cache = new Map<string, GenerateMapResult>();

export function cachedMap(mapName: string, seed: number, teamMode: 1 | 2 | 4 = 1): GenerateMapResult {
    const key = `${mapName}:${seed}:${teamMode}`;
    let gen = cache.get(key);
    if (!gen) {
        gen = generateMap(mapName, seed, teamMode);
        cache.set(key, gen);
    }
    return gen;
}

/**
 * The first object of `type` on a generated map, with orientation `ori` when given. Tests find buildings by type, not
 * by id or position, so a map generation change that moves objects (survev's map generation) does not break them.
 */
export function firstOfType(gen: GenerateMapResult, type: string, ori?: number): GeneratedObject {
    const o = gen.objects.find((x) => x.type === type && (ori === undefined || x.ori === ori));
    if (!o) throw new Error(`no ${type}${ori === undefined ? "" : ` with ori ${ori}`} on the map`);
    return o;
}

/** Gas stages at 1/8 of the real durations (at least 1 s): the first circles come within seconds. */
export const FAST_GAS: GasStage[] = GameConfig.gas.stages.map((st, i) =>
    i === 0 ? st : { ...st, duration: Math.max(1, st.duration / 8) },
);

/**
 * Gas stages at 1/4 of the real durations (about two minutes for the whole zone): fast matches where the late circles
 * still leave time to walk in (at 1/8 the last circles close faster than anyone can run).
 */
export const QUICK_GAS: GasStage[] = GameConfig.gas.stages.map((st, i) =>
    i === 0 ? st : { ...st, duration: Math.max(1, st.duration / 4) },
);

/** A game on the main 12345 terrain with no map objects (and no loot), plus optional obstacles. */
export function flatGame(
    init: GameInit = {},
    teamMode: 1 | 2 | 4 = 1,
    obstacles: Array<Pick<GeneratedObject, "type" | "pos"> & Partial<GeneratedObject>> = [],
): Game {
    const gen = cachedMap("main", 12345);
    const objects: GeneratedObject[] = obstacles.map((o, i) => ({
        id: i + 1,
        kind: "obstacle",
        ori: 0,
        scale: 1,
        layer: 0,
        parentId: 0,
        ...o,
    }));
    const generation = { ...gen, objects, lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    return new Game({ mapName: "main", seed: 12345, teamMode }, { generation, spawnLoot: false, ...init });
}

/** The main map, seed 12345, with every building but no loot. */
export function mainGame(init: GameInit = {}, teamMode: 1 | 2 | 4 = 1): Game {
    return new Game(
        { mapName: "main", seed: 12345, teamMode },
        { generation: cachedMap("main", 12345, teamMode), spawnLoot: false, ...init },
    );
}

/** A dry open spot on the flat terrain near the map centre (grass, no water within `half`). */
export function openSpot(game: Game, half = 30): Vec2 {
    const w = game.mapData.width;
    for (let r = 0; r < w / 2; r += 7) {
        for (let a = 0; a < 16; a++) {
            const p = {
                x: w / 2 + Math.cos((a / 16) * Math.PI * 2) * r,
                y: w / 2 + Math.sin((a / 16) * Math.PI * 2) * r,
            };
            let dry = true;
            for (let dx = -half; dx <= half && dry; dx += 3) {
                for (let dy = -half; dy <= half && dry; dy += 3) {
                    if (game.world.isOnWater({ x: p.x + dx, y: p.y + dy }, 0)) dry = false;
                }
            }
            if (dry) return p;
        }
    }
    throw new Error("no open spot");
}

export function placePlayer(game: Game, name: string, pos: Vec2, opts?: AddPlayerOptions): Player {
    const id = game.addPlayer(name, opts);
    game.teleportPlayer(id, pos);
    const p = game.getPlayer(id)!;
    p.input = { ...emptyInput(), toMouseDir: { x: 1, y: 0 } };
    return p;
}

export function placeBot(
    game: Game,
    pos: Vec2,
    opts: { seed?: number; difficulty?: Difficulty; name?: string; addOptions?: AddPlayerOptions } = {},
): BotController {
    const p = placePlayer(game, opts.name ?? "bot", pos, opts.addOptions);
    return new BotController(game, p.id, { seed: opts.seed ?? 1, difficulty: opts.difficulty ?? "normal" });
}

/** Puts a gun with a full magazine in `slot` and `reserve` rounds in the bag (with a backpack). */
export function giveGun(p: Player, gun: string, reserve = 90, slot: number = WeaponSlot.Primary): void {
    const def = getDefOfType("gun", gun);
    p.weaponManager.setWeapon(slot, gun, def.maxClip);
    p.backpack = "backpack02";
    p.inv.set(def.ammo, Math.min(reserve, p.inv.capacity(def.ammo)));
    p.weaponManager.setCurWeapIndex(slot);
    p.weaponManager.weapons[slot].cooldown = 0;
}

/** Steps the game with its bots until `cond` holds or `maxTicks` ran; returns the ticks used (or -1). */
export function runUntil(game: Game, bots: readonly BotController[], cond: () => boolean, maxTicks: number): number {
    for (let i = 0; i < maxTicks; i++) {
        for (const b of bots) b.update();
        game.step();
        if (cond()) return i + 1;
    }
    return -1;
}

export function dist(a: Vec2, b: Vec2): number {
    return v2.distance(a, b);
}
