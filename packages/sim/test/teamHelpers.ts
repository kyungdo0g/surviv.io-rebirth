// Shared setup for the M6a tests: duo / squad games on the empty flat map, parties placed side by side, a damage
// recorder and knock helpers.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { type AddPlayerOptions, emptyInput, Game, type GameInit, type Player } from "../src/index.ts";
import { cachedMap } from "./helpers.ts";

/** A team game on the main 12345 terrain without objects or loot. */
export function flatTeamGame(teamMode: 1 | 2 | 4, init: GameInit = {}, seed = 12345): Game {
    const gen = cachedMap("main", 12345);
    const generation = { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    return new Game({ mapName: "main", seed, teamMode }, { generation, spawnLoot: false, ...init });
}

/** Adds a player with `opts` and moves it to `pos` facing +x. */
export function addAt(game: Game, name: string, pos: Vec2, opts: AddPlayerOptions = {}): Player {
    const id = game.addPlayer(name, opts);
    game.teleportPlayer(id, pos);
    const p = game.getPlayer(id)!;
    p.dir = { x: 1, y: 0 };
    p.input = { ...emptyInput(), toMouseDir: { x: 1, y: 0 } };
    return p;
}

/** A no-fill party of `n` players sharing the key `key`, `spacing` apart along +x from `pos`. */
export function party(game: Game, key: string, n: number, pos: Vec2, spacing = 2): Player[] {
    const out: Player[] = [];
    for (let i = 0; i < n; i++) {
        const opts = { group: key, partySize: n, autoFill: false };
        out.push(addAt(game, `${key}${i}`, v2.add(pos, { x: i * spacing, y: 0 }), opts));
    }
    return out;
}

/** Lethal player damage, optionally from `source` with `weapon`. */
export function hit(game: Game, target: Player, amount: number, source?: Player, weapon = "ak47", type = 0): void {
    game.damagePlayer(target, {
        amount,
        damageType: type || DamageType.Player,
        gameSourceType: source ? weapon : undefined,
        sourceId: source?.id ?? 0,
        dir: { x: 1, y: 0 },
    });
}

export interface DamageRecord {
    /** tick the damage happened in (the tick a step completes; between steps: the last completed tick) */
    tick: number;
    damageType: number;
    /** health lost (0 when ignored: damage buffer, teammate) */
    applied: number;
}

/** Records every damage call on `target` (the survev oracle's watchDamage). */
export function watchDamage(game: Game, target: Player): DamageRecord[] {
    const events: DamageRecord[] = [];
    const orig = game.damagePlayer.bind(game);
    let inStep = false;
    const step = game.step.bind(game);
    game.step = () => {
        inStep = true;
        step();
        inStep = false;
    };
    game.damagePlayer = (t, params) => {
        const before = t.health;
        const wasDowned = t.downed;
        orig(t, params);
        if (t !== target) return;
        // a knock resets the health to the bleeding health: count what the hit took
        const applied = !wasDowned && t.downed ? before : before - (t.dead ? 0 : t.health);
        events.push({ tick: game.tick + (inStep ? 1 : 0), damageType: params.damageType, applied });
    };
    return events;
}

/** Steps until `cond` holds (at most `max` ticks); the tick count when it did, or undefined. */
export function stepUntil(game: Game, cond: () => boolean, max: number): number | undefined {
    for (let i = 0; i < max; i++) {
        game.step();
        if (cond()) return game.tick;
    }
    return undefined;
}
