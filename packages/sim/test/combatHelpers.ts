// Shared setup for the M2 combat, weapon and loot tests: a game on a map without objects, scripted inputs,
// constant random streams and loadout helpers.
import { createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { getDefOfType, WeaponSlot } from "@rebirth/defs";
import { emptyInput, Game, type GeneratedObject, type Player, type PlayerInput } from "../src/index.ts";
import { cachedMap, findClearPath } from "./helpers.ts";

export const DT = 0.01;

/**
 * Rng whose every draw is `value`: 0.5 gives zero spread deviation, zero pellet jitter, no bullet range jitter and
 * never a headshot (the oracle's "centered" mode).
 */
export function constantRng(value = 0.5): Rng {
    const base = createRng(1);
    return {
        ...base,
        next: () => value,
        int: (min, max) => Math.ceil(min) + Math.floor(value * (Math.floor(max) - Math.ceil(min) + 1)),
        range: (min, max) => min + value * (max - min),
        bool: (p = 0.5) => value < p,
    };
}

export type ObstacleSpec = Pick<GeneratedObject, "type" | "pos"> & Partial<GeneratedObject>;

/** A game on the main 12345 terrain with only the given obstacles and no map loot. */
export function flatGame(obstacles: ObstacleSpec[] = [], seed = 12345): Game {
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
    return new Game({ mapName: "main", seed }, { generation, spawnLoot: false });
}

/** A dry, open spot on the flat map with a clear straight line of `length` towards +x. */
export function openSpot(game: Game, length = 60): Vec2 {
    return findClearPath(game.world, { x: 1, y: 0 }, length, 4);
}

/** Adds a player at `pos` facing `dir`. */
export function spawnAt(game: Game, pos: Vec2, dir: Vec2 = { x: 1, y: 0 }): Player {
    const id = game.addPlayer(`p${pos.x.toFixed(0)}`);
    game.teleportPlayer(id, pos);
    const p = game.getPlayer(id)!;
    p.dir = v2.normalize(dir);
    p.input = { ...emptyInput(), toMouseDir: v2.copy(p.dir) };
    return p;
}

/** Puts a gun with a full magazine in `slot`, `reserve` rounds in the bag, and equips it with its delay elapsed. */
export function giveGun(p: Player, gun: string, opts: { slot?: number; reserve?: number; ammo?: number } = {}) {
    const def = getDefOfType("gun", gun);
    const slot = opts.slot ?? WeaponSlot.Primary;
    p.weaponManager.setWeapon(slot, gun, opts.ammo ?? def.maxClip);
    if (p.inv.capacity(def.ammo) > 0 && opts.reserve !== undefined) {
        p.backpack = "backpack03";
        p.inv.set(def.ammo, opts.reserve);
    }
    p.weaponManager.setCurWeapIndex(slot);
    p.weaponManager.weapons[slot].cooldown = 0;
    p.weaponManager.freeSwitchTimer = 0;
    return def;
}

/** Sends an input for the next tick (direction kept from the player). */
export function send(game: Game, p: Player, input: Partial<PlayerInput>): void {
    game.setInput(p.id, { ...emptyInput(), toMouseDir: v2.copy(p.dir), ...input });
}

export function steps(game: Game, n: number): void {
    for (let i = 0; i < n; i++) game.step();
}

/** Ticks on which `p` fired a shot while `input(tick)` is sent every tick, for `ticks` ticks. */
export function recordShots(
    game: Game,
    p: Player,
    ticks: number,
    input: (i: number) => Partial<PlayerInput>,
): number[] {
    const shots: number[] = [];
    for (let i = 0; i < ticks; i++) {
        const before = p.shotSeq;
        send(game, p, input(i));
        game.step();
        if (p.shotSeq !== before) shots.push(game.tick);
    }
    return shots;
}

export function intervals(ticks: readonly number[]): number[] {
    const out: number[] = [];
    for (let i = 1; i < ticks.length; i++) out.push((ticks[i] - ticks[i - 1]) * DT);
    return out;
}

/** Pulls the trigger for one tick and releases it (inputs persist until replaced). */
export function fireOnce(game: Game, p: Player): void {
    send(game, p, { shootHold: true, shootStart: true });
    game.step();
    send(game, p, {});
}
