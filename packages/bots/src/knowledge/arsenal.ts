// The bot's own weapons: guns with their magazine and reserve, which slot to hold for a fight at a given distance
// (the gun that kills fastest there, knowledge/duel.ts expectedTtk, with the players' range habits: a shotgun up close,
// a heavy single round far away; user report 18) and which gun to carry otherwise (the one it wants most,
// knowledge/desire.ts).
import { GameConfig, WeaponSlot } from "@rebirth/defs";
import type { SelfState } from "../perception/world.ts";
import { DEFAULT_TASTE, gunDesire, type Taste } from "./desire.ts";
import { expectedTtk } from "./duel.ts";
import { type GunInfo, gunInfo, suitability } from "./weapons.ts";

export interface HeldGun {
    slot: number;
    info: GunInfo;
    /** rounds in the magazine */
    mag: number;
    /** rounds of its ammo in the bag */
    reserve: number;
}

/** Magazines in the bag of a gun with infinite ammo, as the decisions see it. */
const INFINITE_MAGS = 10;

export function heldGunsWithAmmo(self: SelfState): HeldGun[] {
    const out: HeldGun[] = [];
    for (const slot of [WeaponSlot.Primary, WeaponSlot.Secondary]) {
        const w = self.weapons[slot];
        const info = w ? gunInfo(w.type) : undefined;
        if (!w || !info || info.score <= 0) continue;
        // a gun with infinite ammo (the PMG-134, round 5) reloads from nothing: its bag never runs dry
        const infinite = (info.def as { ammoInfinite?: boolean }).ammoInfinite === true;
        const reserve = infinite ? info.def.maxClip * INFINITE_MAGS : (self.inventory[info.ammo] ?? 0);
        out.push({ slot, info, mag: w.ammo, reserve });
    }
    return out;
}

export function hasAmmo(g: HeldGun): boolean {
    return g.mag > 0 || g.reserve > 0;
}

/** What fightSlot assumes about the fight (defaults: an average aim against level 1 armour). */
export interface FightSlotOptions {
    /** the bot's effective aim error, degrees (skill.ts skillSigma); default 3.5 (an average shooter, half strafing) */
    sigmaDeg?: number;
    /** the target's armour as seen (default level 1 of both: early fights are often unarmoured, later ones not) */
    helmet?: string;
    chest?: string;
}

const DEFAULT_SIGMA = 3.5;
/** A switch costs this when the bot has not switched for a second (GameConfig.player.baseSwitchDelay, freeSwitchCooldown). */
const SWITCH_COST = GameConfig.player.baseSwitchDelay;
/** The current slot is kept unless another one kills at least this much faster (no flip-flopping at the margins). */
const KEEP = 0.9;
/** Beyond this distance duels turn into peek trades (players strafe, duck behind cover and heal between exposures). */
const PEEK_FROM = 25;

/** Bolt actions (a second or more per round) risk one miss up close, where the target crosses the screen fastest. */
const BOLT_CLOSE = 12;

/**
 * The players' range habits on top of the time to kill (user report 18: "shotgun close, rifle mid, sniper far"):
 * - a shotgun within 8 units: its expected damage per shell averages away the point-blank one-shot (x0.75);
 * - a bolt action within 12 units: a strafing target up close is easy to miss once, and a miss costs a whole cycle
 *   (+ cycle x (12 - d) / 12 seconds);
 * - beyond PEEK_FROM, what one round delivers counts most: x (25 / d)^(2k), k = 0 for 15 damage per round or less up
 *   to 1 for 60 or more (a Mosin or SV-98 round sends the target to heal; a stream of light rounds is healed off
 *   between peeks). The pellets of a shotgun shell do not count as one heavy round.
 */
function habitCost(info: GunInfo, dist: number, cost: number): number {
    if (info.cls === "shotgun") return dist <= 8 ? cost * 0.75 : cost;
    let c = cost;
    if (info.cycle >= 1 && dist < BOLT_CLOSE) c += (info.cycle * (BOLT_CLOSE - dist)) / BOLT_CLOSE;
    if (dist > PEEK_FROM && info.def.bulletCount === 1) {
        const k = Math.min(1, Math.max(0, (info.damage - 15) / 45));
        c *= (PEEK_FROM / dist) ** (2 * k);
    }
    return c;
}

/**
 * Slot to hold for a fight at `dist`: the gun with ammo that kills the target fastest there (expectedTtk: hits it
 * needs at its spread and falloff, the magazine and reloads, the free switch delay for another slot), weighed by the
 * range habits; the current slot is kept unless another one is clearly faster. Melee when no gun has ammo. Replaces the
 * class-band suitability, which picked a pistol over a loaded shotgun at 10-16 units and a G18C over an AK up close.
 */
export function fightSlot(
    self: SelfState,
    guns: readonly HeldGun[],
    dist: number,
    opts: Readonly<FightSlotOptions> = {},
): number {
    const ttkOpts = {
        sigmaDeg: opts.sigmaDeg ?? DEFAULT_SIGMA,
        helmet: opts.helmet ?? "helmet01",
        chest: opts.chest ?? "chest01",
    };
    let best = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    let curCost = Number.POSITIVE_INFINITY;
    let anyAmmo = false;
    for (const g of guns) {
        if (!hasAmmo(g)) continue;
        // launchers are fired only where they fit (brain/launch.ts): never ranked by their time to kill
        if (g.info.cls === "launcher") continue;
        anyAmmo = true;
        const ttk = expectedTtk(g.info, g.mag, g.reserve, dist, ttkOpts);
        const cost = habitCost(g.info, dist, ttk + (g.slot === self.curWeapIdx ? 0 : SWITCH_COST));
        if (g.slot === self.curWeapIdx) curCost = cost;
        if (cost < bestCost) {
            bestCost = cost;
            best = g.slot;
        }
    }
    if (!anyAmmo) return launcherOnly(guns, dist);
    // no gun can finish the fight with what it has (out of range, a few rounds left): the old range-band choice
    if (best < 0) return bandSlot(self, guns, dist);
    if (Number.isFinite(curCost) && bestCost >= curCost * KEEP) return self.curWeapIdx;
    return best;
}

/** Only launchers have ammo: the one that may fire at `dist` (beyond its minimum distance), else melee. */
function launcherOnly(guns: readonly HeldGun[], dist: number): number {
    for (const g of guns) if (hasAmmo(g) && g.info.cls === "launcher" && suitability(g.info, dist) > 0) return g.slot;
    return WeaponSlot.Melee;
}

/** The class-band choice (suitability, loaded first), the fallback of fightSlot. */
function bandSlot(self: SelfState, guns: readonly HeldGun[], dist: number): number {
    let best = -1;
    let bestScore = -1;
    for (const g of guns) {
        if (!hasAmmo(g) || g.info.cls === "launcher") continue;
        const s = suitability(g.info, dist) * (g.mag > 0 ? 1 : 0.45) + (g.slot === self.curWeapIdx ? 0.05 : 0);
        if (s > bestScore) {
            bestScore = s;
            best = g.slot;
        }
    }
    return best < 0 ? WeaponSlot.Melee : best;
}

/**
 * Slot to carry outside fights: the gun with ammo the bot wants most (knowledge/desire.ts: the tier list, not the old
 * DPS score that carried an M93R over a Mosin or an M1100 over an M249), else melee.
 */
export function carrySlot(self: SelfState, guns: readonly HeldGun[], taste: Readonly<Taste> = DEFAULT_TASTE): number {
    let best = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const g of guns) {
        if (!hasAmmo(g)) continue;
        // a launcher is drawn for its shot (brain/launch.ts), not carried: its switch is slow and its rounds few
        const s =
            gunDesire(g.info.id, taste) + (g.slot === self.curWeapIdx ? 3 : 0) - (g.info.cls === "launcher" ? 40 : 0);
        if (s > bestScore) {
            bestScore = s;
            best = g.slot;
        }
    }
    return best < 0 ? WeaponSlot.Melee : best;
}

/** Gun in the current slot, if any. */
export function currentGun(self: SelfState, guns: readonly HeldGun[]): HeldGun | undefined {
    return guns.find((g) => g.slot === self.curWeapIdx);
}
