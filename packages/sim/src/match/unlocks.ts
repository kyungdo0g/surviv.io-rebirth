// Scheduled unlocks (MapDef gameConfig.unlocks): when the gas reaches a timing's circle, `wait` seconds later the
// locked doors of the named building open one every `stagger` seconds (a locked door type opens at once), each with
// a map ping. Only Cobalt uses it (the twins bunker).
// Behaviour follows survev server/src/game/map.ts (scheduleUnlocks, update) and objects/obstacle.ts unlock;
// docs/research/maps/puzzles.md "Scheduled unlocks and ping_unlock".
import { getMapDef } from "@rebirth/defs";
import type { SimRules } from "../rules.ts";
import type { SimContext } from "../world/context.ts";
import { unlockDoor } from "../world/doors.ts";
import type { Obstacle } from "../world/entities.ts";

/** Timer comparisons tolerate float drift of summed 0.01 s steps. */
const TIME_EPS = 1e-9;

export interface UnlockTiming {
    /** a building type (its locked child doors open) or a locked door type */
    type: string;
    stagger: number;
    circleIdx: number;
    wait: number;
}

interface Scheduled {
    type: string;
    stagger: number;
    time: number;
}

interface Staggered {
    doors: Obstacle[];
    stagger: number;
    ticker: number;
}

/** The map's unlock timings with the rules' circle/wait overrides applied (conflicts.md twins-unlock-time). */
export function unlockTimings(mapName: string, rules: Pick<SimRules, "unlockOverrides">): UnlockTiming[] {
    const timings = getMapDef(mapName).gameConfig.unlocks?.timings ?? [];
    return timings.map((t) => ({ ...t, ...rules.unlockOverrides[t.type] }));
}

export class UnlockSystem {
    private readonly ctx: SimContext;
    private readonly scheduled: Scheduled[] = [];
    private readonly staggered: Staggered[] = [];
    /** doors unlocked so far (tests, stats) */
    unlocked = 0;

    constructor(ctx: SimContext) {
        this.ctx = ctx;
    }

    /** The gas entered circle `circleIdx` (a waiting stage started): schedules that circle's unlocks. */
    onCircle(circleIdx: number): void {
        for (const t of unlockTimings(this.ctx.world.mapData.mapName, this.ctx.rules)) {
            if (t.circleIdx === circleIdx) this.scheduled.push({ type: t.type, stagger: t.stagger, time: t.wait });
        }
    }

    update(dt: number): void {
        for (let i = 0; i < this.staggered.length; i++) {
            const s = this.staggered[i];
            s.ticker -= dt;
            if (s.ticker > TIME_EPS) continue;
            const door = s.doors.shift();
            if (door) this.unlock(door);
            if (s.doors.length === 0) this.staggered.splice(i--, 1);
            else s.ticker = s.stagger;
        }
        for (let i = 0; i < this.scheduled.length; i++) {
            const s = this.scheduled[i];
            s.time -= dt;
            if (s.time > TIME_EPS) continue;
            this.scheduled.splice(i--, 1);
            this.fire(s);
        }
    }

    private unlock(door: Obstacle): void {
        unlockDoor(this.ctx, door);
        this.unlocked++;
    }

    /** The first building of the type gets its locked doors opened one by one; else the first locked door. */
    private fire(s: Scheduled): void {
        const world = this.ctx.world;
        const building = world.buildings.find((b) => b.type === s.type);
        if (!building) {
            for (const obj of world.objects.values()) {
                if (obj.kind === "obstacle" && obj.type === s.type && obj.door?.locked) {
                    this.unlock(obj);
                    return;
                }
            }
            return;
        }
        const doors: Obstacle[] = [];
        for (const id of building.childIds) {
            const obj = world.get(id);
            if (obj?.kind === "obstacle" && obj.door?.locked) doors.push(obj);
        }
        if (doors.length > 0) this.staggered.push({ doors, stagger: s.stagger, ticker: s.stagger });
    }
}
