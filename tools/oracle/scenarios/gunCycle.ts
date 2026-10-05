// Per-gun timing: one magazine fired with the trigger held (or spam-clicked), the automatic reload that follows,
// a partial reload, and the switch/deploy delays. Run once at the 100 Hz tick and once at 1000 Hz.
import type { Ctx } from "../lib/context.ts";
import { Harness } from "../lib/harness.ts";
import { actionName, histogram, intervals, SLOT, triggerFor, waitForShot } from "../lib/measure.ts";
import { CENTERED } from "../lib/rng.ts";

const READY_SECONDS = 3;

export interface ReloadAction {
    action: string;
    /** seconds from the reference shot to the start of the action */
    start: number;
    end: number;
    duration: number;
    ammoBefore: number;
    ammoAfter: number;
}

function newShooter(h: Harness, row: number): any {
    const p = h.addPlayer(h.rowPos(row, 12));
    p.debug.godMode = true; // flare airdrops, explosive bullets: nothing may interrupt the measurement
    return p;
}

/** Steps until the gun is idle again (full, or nothing happened for 3 s) and records every reload action. */
function recordReloads(
    h: Harness,
    p: any,
    refTick: number,
    maxClip: number,
    maxSeconds: number,
    beforeStep?: () => void,
): ReloadAction[] {
    const out: ReloadAction[] = [];
    const weapon = p.weapons[p.curWeapIdx];
    let current: ReloadAction | undefined;
    let lastChange = h.tick;
    const limit = Math.round(maxSeconds / h.dt);
    for (let i = 0; i < limit; i++) {
        beforeStep?.();
        const ammoBefore = weapon.ammo;
        const actionBefore = p.actionType;
        h.step();
        if (p.actionType !== actionBefore && actionBefore !== h.sv.GameConfig.Action.None && current) {
            current.end = h.span(refTick, h.tick);
            current.duration = current.end - current.start;
            current.ammoAfter = weapon.ammo;
            out.push(current);
            current = undefined;
            lastChange = h.tick;
        }
        if (p.actionType !== actionBefore && p.actionType !== h.sv.GameConfig.Action.None) {
            current = {
                action: actionName(h.sv, p.actionType),
                start: h.span(refTick, h.tick),
                end: 0,
                duration: 0,
                ammoBefore,
                ammoAfter: ammoBefore,
            };
            lastChange = h.tick;
        }
        if (!current && weapon.ammo >= maxClip) break;
        if (!current && h.span(lastChange, h.tick) > 3) break;
    }
    return out;
}

export function fireAndReload(ctx: Ctx, id: string, dt: number) {
    const h = new Harness(ctx.sv, { dt, seed: 11 });
    h.setMode(CENTERED, "never");
    const p = newShooter(h, 0);
    const def = h.giveGun(p, id);
    p.weaponManager.setCurWeapIndex(SLOT.primary);
    h.stepSeconds(READY_SECONDS);

    // 1. one magazine
    const trigger = triggerFor(def.fireMode);
    h.hold(p, { ...trigger, toMouseLen: 1000 });
    h.stepUntil(() => p.weapons[SLOT.primary].ammo === 0, Math.round(60 / dt));
    h.hold(p, { toMouseLen: 1000 });
    const shots = h.shotsBy(p);
    const shotTicks = shots.map((s) => s.tick);
    const first = shotTicks[0];
    const last = shotTicks.at(-1)!;

    // 2. automatic reload after the magazine is empty (trigger released)
    const reloads = recordReloads(h, p, last, def.maxClip, 30);
    const full = p.weapons[SLOT.primary].ammo >= def.maxClip;

    // 3. first shot of the next magazine with the trigger held again
    let nextShot: number | undefined;
    if (full) {
        h.hold(p, { ...trigger, toMouseLen: 1000 });
        nextShot = waitForShot(h, p, Math.round(5 / dt))?.tick;
        h.hold(p, { toMouseLen: 1000 });
    }

    return {
        shotsPerMag: shots.length,
        pelletsPerShot: histogram(shots.map((s) => s.bullets.length)),
        shotTimes: shotTicks.map((t) => (t - first) * dt),
        intervals: histogram(intervals(shotTicks, dt)),
        reload: {
            actions: reloads,
            fullAfterLastShot: full && reloads.length ? reloads.at(-1)!.end : null,
            lastShotToNextMagFirstShot: nextShot === undefined ? null : h.span(last, nextShot),
        },
    };
}

/**
 * Fires one shot (one burst for burst guns) from a full magazine and presses Reload once the burst is over and the
 * fire cooldown has expired: the reload of a partly filled magazine. Action times are relative to the shot. (A
 * magazine left with <= 1 round reloads automatically; pressing Reload mid-burst is overwritten by the next shot.)
 */
export function partialReload(ctx: Ctx, id: string, dt: number, reserve?: number) {
    const h = new Harness(ctx.sv, { dt, seed: 12 });
    h.setMode(CENTERED, "never");
    const p = newShooter(h, 0);
    const def = h.giveGun(p, id, { reserve });
    if (def.maxClip < 2) return null;
    p.weaponManager.setCurWeapIndex(SLOT.primary);
    h.stepSeconds(READY_SECONDS);
    h.hold(p, triggerFor(def.fireMode));
    const shot = waitForShot(h, p, Math.round(5 / dt));
    h.hold(p, {});
    if (!shot) return null;
    let pressed = false;
    const pressWhenIdle = () => {
        const wm = p.weaponManager;
        if (pressed || wm.bursts.length || p.weapons[SLOT.primary].cooldown > 0) return;
        pressed = true;
        h.press(p, ["Reload"]);
    };
    return { reserve: reserve ?? null, actions: recordReloads(h, p, shot.tick, def.maxClip, 30, pressWhenIdle) };
}

/**
 * Switch/deploy delays, measured as seconds from the equip input to the end of the tick of the first shot
 * (trigger held / spam-clicked from the input on):
 * - freeSwitch: melee -> gun after more than freeSwitchCooldown (1 s) without switching
 * - rapidSwitch: gun -> melee -> gun on consecutive ticks (the second switch is inside the free-switch cooldown)
 * - pickupIntoActiveSlot: the active gun slot receives the gun (setWeapon, as picking up loot does)
 */
export function switchDelays(ctx: Ctx, id: string, dt: number) {
    const h = new Harness(ctx.sv, { dt, seed: 13 });
    h.setMode(CENTERED, "never");
    const def = ctx.sv.GameObjectDefs.typeToDef(id, "gun");
    const trigger = triggerFor(def.fireMode);
    const maxTicks = Math.round(5 / dt);

    const free = newShooter(h, 0);
    h.giveGun(free, id);
    const rapid = newShooter(h, 1);
    h.giveGun(rapid, id);
    rapid.weaponManager.setCurWeapIndex(SLOT.primary);
    const pickup = newShooter(h, 2);
    h.giveGun(pickup, id === "m9" ? "glock" : "m9");
    pickup.weaponManager.setCurWeapIndex(SLOT.primary);
    h.stepSeconds(READY_SECONDS);

    const measure = (p: any, inputs: string[], before?: () => void) => {
        before?.();
        const ref = h.tick;
        if (inputs.length) h.press(p, inputs);
        h.hold(p, trigger);
        const shot = waitForShot(h, p, maxTicks);
        h.hold(p, {});
        return shot ? h.span(ref, shot.tick) : null;
    };

    const freeSwitch = measure(free, ["EquipPrimary"]);
    h.press(rapid, ["EquipMelee"]);
    h.step();
    const rapidSwitch = measure(rapid, ["EquipPrimary"]);
    const pickupIntoActiveSlot = measure(pickup, [], () => h.giveGun(pickup, id));
    return { freeSwitch, rapidSwitch, pickupIntoActiveSlot };
}

/**
 * Quick-switch between two guns: fire A, switch to B on the next tick (free switch available), fire B as soon
 * as possible, switch back to A on the next tick (now inside the free-switch cooldown), fire A again.
 */
export function quickSwitch(ctx: Ctx, a: string, b: string) {
    const h = new Harness(ctx.sv, { seed: 14 });
    h.setMode(CENTERED, "never");
    const p = newShooter(h, 0);
    h.giveGun(p, a, { slot: SLOT.primary });
    h.giveGun(p, b, { slot: SLOT.secondary });
    p.weaponManager.setCurWeapIndex(SLOT.primary);
    h.stepSeconds(READY_SECONDS);
    const fire = (type: string) => {
        h.hold(p, triggerFor(ctx.sv.GameObjectDefs.typeToDef(type, "gun").fireMode));
        const shot = waitForShot(h, p, 500);
        h.hold(p, {});
        return shot;
    };
    const shotA = fire(a);
    h.press(p, ["EquipSecondary"]);
    const shotB = fire(b);
    h.press(p, ["EquipPrimary"]);
    const shotA2 = fire(a);
    if (!shotA || !shotB || !shotA2) return { a, b, error: "a shot did not happen" };
    return {
        a,
        b,
        sameDeployGroup: ctx.defs[a].deployGroup !== undefined && ctx.defs[a].deployGroup === ctx.defs[b].deployGroup,
        aShotToBShot: h.span(shotA.tick, shotB.tick),
        bShotToAShot: h.span(shotB.tick, shotA2.tick),
        aFireDelay: ctx.defs[a].fireDelay,
    };
}
