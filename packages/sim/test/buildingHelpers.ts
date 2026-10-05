// Shared setup for the M5b building tests: games on real generated maps, lookups of buildings and their children,
// scripted walking and interacting.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { type Building, emptyInput, Game, type Obstacle, type Player, type Structure } from "../src/index.ts";
import { cachedMap } from "./helpers.ts";

/** A sandbox game (no gas start condition, never ends) on a cached generated map, without map loot. */
export function mapGame(mapName = "main", mapSeed = 12345, seed = 1): Game {
    return new Game({ mapName, seed }, { generation: cachedMap(mapName, mapSeed), spawnLoot: false, sandbox: true });
}

/** The first building of a type (throws when the map has none). */
export function findBuilding(game: Game, type: string): Building {
    const b = game.world.buildings.find((x) => x.type === type);
    if (!b) throw new Error(`no ${type} on this map`);
    return b;
}

/** The first structure of a type (throws when the map has none). */
export function findStructure(game: Game, type: string): Structure {
    for (const obj of game.world.objects.values()) if (obj.kind === "structure" && obj.type === type) return obj;
    throw new Error(`no ${type} on this map`);
}

/** Direct child obstacles of a building, optionally of one type. */
export function childObstacles(game: Game, building: Building, type?: string): Obstacle[] {
    const out: Obstacle[] = [];
    for (const id of building.childIds) {
        const obj = game.world.get(id);
        if (obj?.kind === "obstacle" && (type === undefined || obj.type === type)) out.push(obj);
    }
    return out;
}

/** Adds a player at `pos` (on `layer`) facing `dir`. */
export function placePlayer(game: Game, pos: Vec2, layer = 0, dir: Vec2 = { x: 1, y: 0 }): Player {
    const id = game.addPlayer(`p${game.tick}-${pos.x.toFixed(0)}`);
    game.teleportPlayer(id, pos, layer);
    const p = game.getPlayer(id)!;
    p.dir = v2.normalize(dir);
    p.input = { ...emptyInput(), toMouseDir: v2.copy(p.dir) };
    return p;
}

/** Movement keys for a unit direction along an axis (diagonals use both keys). */
export function keysFor(dir: Vec2) {
    return { moveLeft: dir.x < -0.5, moveRight: dir.x > 0.5, moveUp: dir.y > 0.5, moveDown: dir.y < -0.5 };
}

/** Walks `p` along `dir` for `ticks` ticks (facing `face`, default `dir`), pressing Interact every `interactEvery`. */
export function walk(game: Game, p: Player, dir: Vec2, ticks: number, interactEvery = 0, face: Vec2 = dir): void {
    for (let i = 0; i < ticks; i++) {
        const actions = interactEvery > 0 && i % interactEvery === interactEvery - 1 ? [Input.Interact] : [];
        game.setInput(p.id, { ...emptyInput(), ...keysFor(dir), toMouseDir: v2.copy(face), actions });
        game.step();
    }
    game.setInput(p.id, { ...emptyInput(), toMouseDir: v2.copy(face) });
}

/** One tick with Interact pressed (and no movement). */
export function interact(game: Game, p: Player): void {
    game.setInput(p.id, { ...emptyInput(), toMouseDir: v2.copy(p.dir), actions: [Input.Interact] });
    game.step();
    game.setInput(p.id, { ...emptyInput(), toMouseDir: v2.copy(p.dir) });
}

export function stepSeconds(game: Game, seconds: number): void {
    const n = Math.round(seconds * 100);
    for (let i = 0; i < n; i++) game.step();
}

/** Centre of a stair's box. */
export function stairCenter(structure: Structure, i = 0): Vec2 {
    const c = structure.stairs[i].collision;
    return { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
}
