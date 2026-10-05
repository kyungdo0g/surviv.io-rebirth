// Shared setup for the M5 tests (throwables, explosions, smoke, air strikes): flat games with obstacles placed
// relative to an open spot, throwable holders, cook-and-release helpers and explosion bookkeeping.
import type { Vec2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import type { ExplosionReport, Game, Player } from "../src/index.ts";
import { constantRng, flatGame, type ObstacleSpec, openSpot, send, spawnAt } from "./combatHelpers.ts";

/** An open, dry spot of the flat test terrain with a clear path of `length` towards +x (no obstacles placed). */
export function clearSpot(length = 60): Vec2 {
    return openSpot(flatGame(), length);
}

/**
 * A flat game with `obstacles` (positions relative to `origin`) and a player at `origin` facing +x. The fx rng is
 * constant (0.5): shrapnel flies towards -x with a medium variance, so targets placed towards +x only take the
 * explosion itself.
 */
export function fxGame(origin: Vec2, obstacles: ObstacleSpec[] = []): { game: Game; p: Player } {
    const game = flatGame(obstacles.map((o) => ({ ...o, pos: { x: origin.x + o.pos.x, y: origin.y + o.pos.y } })));
    game.fxRng = constantRng(0.5);
    game.combatRng = constantRng(0.5);
    const p = spawnAt(game, origin);
    return { game, p };
}

/** Gives `count` of a throwable (largest backpack) and equips the throwable slot showing it. */
export function holdThrowable(p: Player, item: string, count: number): void {
    p.backpack = "backpack03";
    p.inv.set(item, count);
    const wm = p.weaponManager;
    if (wm.weapons[WeaponSlot.Throwable].type !== item) wm.setWeapon(WeaponSlot.Throwable, item, 0);
    wm.setCurWeapIndex(WeaponSlot.Throwable, true);
    wm.freeSwitchTimer = 0;
}

/**
 * Presses attack (cook) for `cookTicks` ticks, then releases with the mouse `mouseLen` units ahead and steps the
 * tick of the throw. Returns the tick before the press (the pin pull happens in the next tick).
 */
export function cookAndThrow(game: Game, p: Player, cookTicks: number, mouseLen = 18): number {
    const start = game.tick;
    send(game, p, { shootStart: true, shootHold: true, toMouseLen: mouseLen });
    game.step();
    send(game, p, { shootHold: true, toMouseLen: mouseLen });
    for (let i = 1; i < cookTicks; i++) game.step();
    send(game, p, { toMouseLen: mouseLen });
    game.step();
    return start;
}

/** Steps until `n` more explosions resolved (at most `max` ticks); returns the tick of the last one or null. */
export function untilExplosions(game: Game, n = 1, max = 2000): number | null {
    const target = game.explosions.count + n;
    for (let i = 0; i < max; i++) {
        game.step();
        if (game.explosions.count >= target) return game.tick;
    }
    return null;
}

/** Explosion reports (latest first trimmed by the game after a second) of `type`. */
export function reportsOf(game: Game, type: string): ExplosionReport[] {
    return game.explosions.reports.filter((r) => r.type === type);
}

export interface LoggedExplosion {
    tick: number;
    type: string;
    pos: Vec2;
    sourceId: number;
    damageType: number;
    gameSourceType: string;
    mapSourceType: string;
}

/** Records every explosion queued from now on (reports are pruned after a second, this log is not). */
export function logExplosions(game: Game): LoggedExplosion[] {
    const log: LoggedExplosion[] = [];
    const system = game.explosions;
    const add = system.add.bind(system);
    system.add = (type, pos, layer, source) => {
        log.push({
            tick: game.tick + 1,
            type,
            pos: { x: pos.x, y: pos.y },
            sourceId: source.sourceId ?? 0,
            damageType: source.damageType,
            gameSourceType: source.gameSourceType ?? "",
            mapSourceType: source.mapSourceType ?? "",
        });
        add(type, pos, layer, source);
    };
    return log;
}
