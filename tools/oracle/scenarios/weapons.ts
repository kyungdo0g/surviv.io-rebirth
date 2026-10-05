// weapons.json: per-gun fire intervals, magazine size, reloads, switch delays, pellets, bullet range and speed.
import { type Ctx, type FixtureResult, idsOfType } from "../lib/context.ts";
import { Harness, ORIGIN } from "../lib/harness.ts";
import { SLOT, triggerFor, waitBulletsGone, waitForShot } from "../lib/measure.ts";
import { FINE_DT, TICK_DT } from "../lib/paths.ts";
import { CENTERED, HIGH, LOW, type RandomSource } from "../lib/rng.ts";
import { fireAndReload, partialReload, quickSwitch, switchDelays } from "./gunCycle.ts";

const QUICK_SWITCH_PAIRS: Array<[string, string]> = [
    ["m870", "spas12"],
    ["spas12", "m870"],
    ["m870", "mosin"],
    ["mosin", "sv98"],
    ["sv98", "awc"],
    ["mp220", "m870"],
    ["deagle", "m870"],
];

/** One shot into empty space per random mode: pellets, travel distance until removal, speed. */
function bulletFlight(ctx: Ctx, id: string, mode: RandomSource) {
    const h = new Harness(ctx.sv, { seed: 21 });
    const p = h.addPlayer({ x: ORIGIN.x, y: h.center.y });
    p.debug.godMode = true;
    const def = h.giveGun(p, id);
    p.weaponManager.setCurWeapIndex(SLOT.primary);
    h.stepSeconds(3);
    h.setMode(mode, "never");
    // usas (toMouseHit) bullets stop at the cursor: aim far away so the bullet def distance applies
    h.hold(p, { ...triggerFor(def.fireMode), toMouseLen: 1000 });
    const shot = waitForShot(h, p, 500);
    h.hold(p, { toMouseLen: 1000 });
    if (!shot) return null;
    waitBulletsGone(h, 2000);
    const pellets = shot.bullets;
    const traveled = pellets.map((b) => b.distanceTraveled ?? Number.NaN);
    return {
        pellets: pellets.length,
        distance: { min: Math.min(...traveled), max: Math.max(...traveled) },
        configuredDistance: {
            min: Math.min(...pellets.map((b) => b.distance)),
            max: Math.max(...pellets.map((b) => b.distance)),
        },
        flightSeconds: Math.max(...pellets.map((b) => ((b.endTick ?? shot.tick) - shot.tick + 1) * h.dt)),
        speed: pellets[0].speed,
        firstTickDistance: pellets[0].firstStep ?? null,
    };
}

function gunEntry(ctx: Ctx, id: string) {
    const def = ctx.defs[id];
    const bulletDef = ctx.defs[def.bulletType] ?? {};
    const timing = (dt: number) => {
        const cycle = fireAndReload(ctx, id, dt);
        return {
            ...cycle,
            partialReload: partialReload(ctx, id, dt),
            ...(def.reloadTimeAlt ? { lowReserveReload: lowReserve(ctx, id, dt) } : {}),
            switch: switchDelays(ctx, id, dt),
        };
    };
    return {
        def: {
            fireMode: def.fireMode,
            fireDelay: def.fireDelay,
            burstCount: def.burstCount,
            burstDelay: def.burstDelay,
            maxClip: def.maxClip,
            maxReload: def.maxReload,
            reloadTime: def.reloadTime,
            maxReloadAlt: def.maxReloadAlt,
            reloadTimeAlt: def.reloadTimeAlt,
            switchDelay: def.switchDelay,
            deployGroup: def.deployGroup,
            bulletCount: def.bulletCount,
            bulletType: def.bulletType,
            bulletSpeed: bulletDef.speed,
            bulletDistance: bulletDef.distance,
            ammo: def.ammo,
        },
        tick100Hz: timing(TICK_DT),
        tick1000Hz: timing(FINE_DT),
        bullet: {
            centered: bulletFlight(ctx, id, CENTERED),
            low: bulletFlight(ctx, id, LOW),
            high: bulletFlight(ctx, id, HIGH),
        },
    };
}

/** Empty magazine with only maxReload rounds in reserve: survev skips the alternate (full) reload. */
function lowReserve(ctx: Ctx, id: string, dt: number) {
    const h = new Harness(ctx.sv, { dt, seed: 15 });
    h.setMode(CENTERED, "never");
    const p = h.addPlayer(h.rowPos(0, 12));
    p.debug.godMode = true;
    const def = h.giveGun(p, id, { ammo: 0, reserve: ctx.defs[id].maxReload });
    p.weaponManager.setCurWeapIndex(SLOT.primary);
    const ref = h.tick;
    let start: number | undefined;
    let end: number | undefined;
    for (let i = 0; i < Math.round(10 / dt) && end === undefined; i++) {
        const before = p.actionType;
        h.step();
        if (before === 0 && p.actionType !== 0) start = h.tick;
        if (before !== 0 && p.actionType === 0) end = h.tick;
    }
    return {
        reserve: ctx.defs[id].maxReload,
        action: start === undefined || end === undefined ? null : h.span(start, end),
        startAfterEquip: start === undefined ? null : h.span(ref, start),
        ammoAfter: p.weapons[SLOT.primary].ammo,
        maxClip: def.maxClip,
    };
}

export function weapons(ctx: Ctx): FixtureResult {
    const guns: Record<string, unknown> = {};
    const skipped: Record<string, string> = {};
    for (const id of idsOfType(ctx.defs, "gun")) {
        try {
            guns[id] = gunEntry(ctx, id);
        } catch (err) {
            skipped[id] = String(err instanceof Error ? err.message : err);
        }
        process.stdout.write(".");
    }
    process.stdout.write("\n");
    const quick = QUICK_SWITCH_PAIRS.map(([a, b]) => quickSwitch(ctx, a, b));
    return {
        params: {
            random: "centered (zero deviation and jitter), headshots never; bullet flights also in low/high modes",
            shooter: "stationary test player with debug.godMode, facing +x on the empty oracle map",
            trigger: "auto/burst: shootHold every tick; single: shootHold + shootStart every tick (spam clicking)",
            reserveAmmo: 990,
            timeConvention:
                "times are tick differences * dt; an input sent before tick N+1 and a shot fired during tick M " +
                "are (M - N) * dt apart",
            tickRates: { tick100Hz: TICK_DT, tick1000Hz: FINE_DT },
        },
        data: {
            notes: [
                "fire cooldowns are decremented by dt every tick and compared with <= 0 (auto) or < 0 (single, burst); " +
                    "with a fixed dt the float residue of repeated subtraction can add one extra tick " +
                    "(e.g. ak47 fireDelay 0.1 -> 0.11 s at 100 Hz)",
                "reload.actions times are relative to the last shot of the magazine; a new reload of a single-load " +
                    "gun starts on the tick after the previous one completes (Player.reloadAgain)",
                "switch delays: freeSwitch uses GameConfig.player.baseSwitchDelay when freeSwitchTimer < 0; " +
                    "rapidSwitch uses the gun's switchDelay (WeaponManager.setCurWeapIndex)",
                "bullet distance = bulletDef.distance * (1 + variance) + distAdj, distAdj in [-1, 1] m " +
                    "(0 in centered mode; shotgun bullets with noDistAdj always 0)",
                "bugle has no reload action: survev refills bugle_ammo on a role/perk timer, not via reload",
            ],
            guns,
            skipped,
            quickSwitch: quick,
            pelletsPerShot: Object.fromEntries(
                Object.entries(guns).map(([id, g]: [string, any]) => [id, g.bullet.centered?.pellets ?? null]),
            ),
        },
    };
}
